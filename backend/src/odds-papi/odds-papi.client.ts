import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ODDSPAPI_BASE_URL,
  OddsPapiFixture,
  OddsPapiHistoricalOddsResponse,
  OddsPapiMarketDefinition,
  OddsPapiTournament,
} from './odds-papi.types';
import {
  ODDSPAPI_BOOKMAKER_PINNACLE,
  ODDSPAPI_HISTORICAL_ODDS_COOLDOWN_MS,
} from './odds-papi.sport-config';

/** Max retries after the initial attempt when OddsPapi returns RATE_LIMITED. */
export const ODDSPAPI_RATE_LIMIT_MAX_RETRIES = 2;
/** Extra wait beyond retryMs / Retry-After. */
export const ODDSPAPI_RATE_LIMIT_SAFETY_BUFFER_MS = 200;
/** Used when neither retryMs nor Retry-After is available. */
export const ODDSPAPI_RATE_LIMIT_FALLBACK_MS = 2000;
/** Cap RATE_LIMITED waits so a huge retryMs cannot freeze import indefinitely. */
export const ODDSPAPI_RATE_LIMIT_MAX_DELAY_MS = 30_000;
/** Abort hung OddsPapi HTTP calls (connection / body) so GraphQL can surface an error. */
export const ODDSPAPI_FETCH_TIMEOUT_MS = 45_000;

/** OddsPapi returns HTTP 404 with this code when no fixtures match filters. */
export function isOddsPapiFixtureNotFoundBody(body: string): boolean {
  try {
    const parsed = JSON.parse(body) as { error?: { code?: string } };
    return parsed?.error?.code === 'FIXTURE_NOT_FOUND';
  } catch {
    return false;
  }
}

export function isOddsPapiRateLimitedBody(body: string): boolean {
  try {
    const parsed = JSON.parse(body) as { error?: { code?: string } };
    return parsed?.error?.code === 'RATE_LIMITED';
  } catch {
    return false;
  }
}

/**
 * OddsPapi /historical-odds HTTP 404 with code NOT_FOUND —
 * no historical data for that fixture (expected data-availability case).
 */
export function isOddsPapiHistoricalOddsNotFoundBody(body: string): boolean {
  try {
    const parsed = JSON.parse(body) as { error?: { code?: string } };
    return parsed?.error?.code === 'NOT_FOUND';
  } catch {
    return false;
  }
}

/** Thrown only for /historical-odds 404 NOT_FOUND — import maps this to MISSING_PINNACLE_1X2. */
export class OddsPapiHistoricalOddsNotFoundError extends Error {
  readonly code = 'HISTORICAL_ODDS_NOT_FOUND' as const;

  constructor(fixtureId: string) {
    super(`OddsPapi historical odds not found for fixture ${fixtureId}`);
    this.name = 'OddsPapiHistoricalOddsNotFoundError';
  }
}

/**
 * Delay before retrying a RATE_LIMITED response.
 * Prefer body.retryMs / error.retryMs, then Retry-After (seconds), then fallback.
 */
export function resolveOddsPapiRetryDelayMs(
  body: string,
  retryAfterHeader: string | null,
  options?: { safetyBufferMs?: number; fallbackMs?: number; maxDelayMs?: number },
): number {
  const safetyBufferMs = options?.safetyBufferMs ?? ODDSPAPI_RATE_LIMIT_SAFETY_BUFFER_MS;
  const fallbackMs = options?.fallbackMs ?? ODDSPAPI_RATE_LIMIT_FALLBACK_MS;
  const maxDelayMs = options?.maxDelayMs ?? ODDSPAPI_RATE_LIMIT_MAX_DELAY_MS;

  let delayMs: number | null = null;

  try {
    const parsed = JSON.parse(body) as {
      retryMs?: unknown;
      error?: { retryMs?: unknown };
    };
    const raw = parsed?.error?.retryMs ?? parsed?.retryMs;
    if (typeof raw === 'number' && isFinite(raw) && raw >= 0) {
      delayMs = Math.ceil(raw) + safetyBufferMs;
    } else if (typeof raw === 'string' && raw.trim() !== '') {
      const n = Number(raw);
      if (isFinite(n) && n >= 0) delayMs = Math.ceil(n) + safetyBufferMs;
    }
  } catch {
    // ignore parse errors
  }

  if (delayMs == null && retryAfterHeader != null && retryAfterHeader.trim() !== '') {
    const sec = Number(retryAfterHeader);
    if (isFinite(sec) && sec >= 0) {
      delayMs = Math.ceil(sec * 1000) + safetyBufferMs;
    }
  }

  if (delayMs == null) {
    delayMs = fallbackMs + safetyBufferMs;
  }

  return Math.min(delayMs, maxDelayMs);
}

@Injectable()
export class OddsPapiClient {
  private readonly logger = new Logger(OddsPapiClient.name);
  private lastHistoricalOddsAt = 0;
  /** Process-level market catalog cache (full list, then filtered by sportId). */
  private marketsCache: OddsPapiMarketDefinition[] | null = null;
  private marketsCacheLoadedAt = 0;
  private static readonly MARKETS_TTL_MS = 6 * 60 * 60 * 1000;

  constructor(private readonly config: ConfigService) {}

  private getApiKey(): string {
    const key = this.config.get<string>('ODDSPAPI_API_KEY')?.trim();
    if (!key) {
      throw new ServiceUnavailableException(
        'ODDSPAPI_API_KEY is not configured on the backend',
      );
    }
    return key;
  }

  private buildUrl(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {},
  ): URL {
    const url = new URL(`${ODDSPAPI_BASE_URL}${path}`);
    url.searchParams.set('apiKey', this.getApiKey());
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
    return url;
  }

  /** Non-secret query params for logging/tests (never includes apiKey). */
  static publicQueryParams(
    query: Record<string, string | number | boolean | undefined>,
  ): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      out[k] = String(v);
    }
    return out;
  }

  /** Testable delay hook. */
  protected async sleep(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  /**
   * GET with RATE_LIMITED (429) retries. Shared by all OddsPapi endpoints.
   * Returns response + body text when body was already consumed for rate-limit parsing.
   */
  private async fetchGet(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {},
  ): Promise<{ res: Response; bodyText: string | null }> {
    const url = this.buildUrl(path, query);
    let lastBody = '';

    for (let attempt = 0; attempt <= ODDSPAPI_RATE_LIMIT_MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ODDSPAPI_FETCH_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(url.toString(), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
      } catch (e: any) {
        const aborted =
          e?.name === 'AbortError' ||
          e?.name === 'TimeoutError' ||
          /aborted|abort/i.test(String(e?.message ?? ''));
        if (aborted) {
          this.logger.error(
            `OddsPapi ${path} timed out after ${ODDSPAPI_FETCH_TIMEOUT_MS}ms`,
          );
          throw new ServiceUnavailableException(
            `OddsPapi request timed out for ${path}`,
          );
        }
        throw e;
      } finally {
        clearTimeout(timer);
      }

      if (res.status !== 429) {
        return { res, bodyText: null };
      }

      const bodyText = await res.text().catch(() => '');
      lastBody = bodyText;

      if (!isOddsPapiRateLimitedBody(bodyText)) {
        // 429 without RATE_LIMITED — do not retry.
        return { res, bodyText };
      }

      if (attempt >= ODDSPAPI_RATE_LIMIT_MAX_RETRIES) {
        break;
      }

      const delayMs = resolveOddsPapiRetryDelayMs(
        bodyText,
        res.headers.get('retry-after'),
      );
      this.logger.warn(
        `OddsPapi ${path} rate limited; retrying in ${delayMs}ms (attempt ${attempt + 1}/${ODDSPAPI_RATE_LIMIT_MAX_RETRIES})`,
      );
      await this.sleep(delayMs);
    }

    this.logger.error(
      `OddsPapi ${path} failed: 429 ${lastBody.slice(0, 500)}`,
    );
    throw new ServiceUnavailableException(
      `OddsPapi request failed (429) for ${path}`,
    );
  }

  private async getJson<T>(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {},
  ): Promise<T> {
    const { res, bodyText } = await this.fetchGet(path, query);

    if (!res.ok) {
      const body = bodyText ?? (await res.text().catch(() => ''));
      this.logger.error(`OddsPapi ${path} failed: ${res.status} ${body.slice(0, 500)}`);
      throw new ServiceUnavailableException(
        `OddsPapi request failed (${res.status}) for ${path}`,
      );
    }

    if (bodyText != null) {
      return JSON.parse(bodyText) as T;
    }
    return (await res.json()) as T;
  }

  async getTournaments(sportId: number): Promise<OddsPapiTournament[]> {
    return this.getJson<OddsPapiTournament[]>('/tournaments', { sportId });
  }

  /**
   * List fixtures. For finished-match discovery do NOT pass hasOdds/bookmakers —
   * finished fixtures typically have hasOdds=false even when historical odds exist.
   */
  async getFixtures(params: {
    tournamentId: number;
    from?: string;
    to?: string;
    statusId?: number;
    hasOdds?: boolean;
    bookmakers?: string;
  }): Promise<OddsPapiFixture[]> {
    const query: Record<string, string | number | boolean | undefined> = {
      tournamentId: params.tournamentId,
      from: params.from,
      to: params.to,
      statusId: params.statusId,
      hasOdds: params.hasOdds,
      bookmakers: params.bookmakers,
    };

    const { res, bodyText } = await this.fetchGet('/fixtures', query);

    if (res.status === 404) {
      const body = bodyText ?? (await res.text().catch(() => ''));
      if (isOddsPapiFixtureNotFoundBody(body)) {
        this.logger.log(
          `OddsPapi /fixtures: no fixtures for criteria (${JSON.stringify(
            OddsPapiClient.publicQueryParams(query),
          )})`,
        );
        return [];
      }
      this.logger.error(`OddsPapi /fixtures failed: 404 ${body.slice(0, 500)}`);
      throw new ServiceUnavailableException(
        'OddsPapi request failed (404) for /fixtures',
      );
    }

    if (!res.ok) {
      const body = bodyText ?? (await res.text().catch(() => ''));
      this.logger.error(`OddsPapi /fixtures failed: ${res.status} ${body.slice(0, 500)}`);
      throw new ServiceUnavailableException(
        `OddsPapi request failed (${res.status}) for /fixtures`,
      );
    }

    if (bodyText != null) {
      return JSON.parse(bodyText) as OddsPapiFixture[];
    }
    return (await res.json()) as OddsPapiFixture[];
  }

  async getHistoricalOdds(
    fixtureId: string,
    bookmakers: string = ODDSPAPI_BOOKMAKER_PINNACLE,
  ): Promise<OddsPapiHistoricalOddsResponse> {
    await this.waitHistoricalOddsCooldown();

    const query = { fixtureId, bookmakers };
    const { res, bodyText } = await this.fetchGet('/historical-odds', query);
    // Count the attempt toward the historical-odds cooldown even on 404/errors.
    this.lastHistoricalOddsAt = Date.now();

    if (res.status === 404) {
      const body = bodyText ?? (await res.text().catch(() => ''));
      if (isOddsPapiHistoricalOddsNotFoundBody(body)) {
        this.logger.log(
          `OddsPapi /historical-odds: no historical data for fixture ${fixtureId}`,
        );
        throw new OddsPapiHistoricalOddsNotFoundError(fixtureId);
      }
      this.logger.error(`OddsPapi /historical-odds failed: 404 ${body.slice(0, 500)}`);
      throw new ServiceUnavailableException(
        'OddsPapi request failed (404) for /historical-odds',
      );
    }

    if (!res.ok) {
      const body = bodyText ?? (await res.text().catch(() => ''));
      this.logger.error(
        `OddsPapi /historical-odds failed: ${res.status} ${body.slice(0, 500)}`,
      );
      throw new ServiceUnavailableException(
        `OddsPapi request failed (${res.status}) for /historical-odds`,
      );
    }

    if (bodyText != null) {
      return JSON.parse(bodyText) as OddsPapiHistoricalOddsResponse;
    }
    return (await res.json()) as OddsPapiHistoricalOddsResponse;
  }

  /**
   * Cached GET /markets — one call per process TTL, not per fixture.
   */
  async getMarkets(sportId?: number): Promise<OddsPapiMarketDefinition[]> {
    const now = Date.now();
    if (
      !this.marketsCache ||
      now - this.marketsCacheLoadedAt > OddsPapiClient.MARKETS_TTL_MS
    ) {
      this.logger.log('Fetching OddsPapi market catalog (/markets)');
      this.marketsCache = await this.getJson<OddsPapiMarketDefinition[]>('/markets', {
        language: 'en',
      });
      this.marketsCacheLoadedAt = now;
    }
    if (sportId == null) return this.marketsCache;
    return this.marketsCache.filter((m) => m.sportId === sportId);
  }

  private async waitHistoricalOddsCooldown(): Promise<void> {
    const elapsed = Date.now() - this.lastHistoricalOddsAt;
    const wait = ODDSPAPI_HISTORICAL_ODDS_COOLDOWN_MS - elapsed;
    if (wait > 0) {
      await this.sleep(wait);
    }
  }
}
