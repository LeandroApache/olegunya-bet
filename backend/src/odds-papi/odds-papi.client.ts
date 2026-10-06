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

  private async getJson<T>(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {},
  ): Promise<T> {
    const apiKey = this.getApiKey();
    const url = new URL(`${ODDSPAPI_BASE_URL}${path}`);
    url.searchParams.set('apiKey', apiKey);
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`OddsPapi ${path} failed: ${res.status} ${body.slice(0, 500)}`);
      throw new ServiceUnavailableException(
        `OddsPapi request failed (${res.status}) for ${path}`,
      );
    }

    return (await res.json()) as T;
  }

  async getTournaments(sportId: number): Promise<OddsPapiTournament[]> {
    return this.getJson<OddsPapiTournament[]>('/tournaments', { sportId });
  }

  async getFixtures(params: {
    tournamentId: number;
    from?: string;
    to?: string;
    statusId?: number;
    hasOdds?: boolean;
    bookmakers?: string;
  }): Promise<OddsPapiFixture[]> {
    return this.getJson<OddsPapiFixture[]>('/fixtures', {
      tournamentId: params.tournamentId,
      from: params.from,
      to: params.to,
      statusId: params.statusId,
      hasOdds: params.hasOdds,
      bookmakers: params.bookmakers ?? ODDSPAPI_BOOKMAKER_PINNACLE,
    });
  }

  async getHistoricalOdds(
    fixtureId: string,
    bookmakers: string = ODDSPAPI_BOOKMAKER_PINNACLE,
  ): Promise<OddsPapiHistoricalOddsResponse> {
    await this.waitHistoricalOddsCooldown();
    const data = await this.getJson<OddsPapiHistoricalOddsResponse>('/historical-odds', {
      fixtureId,
      bookmakers,
    });
    this.lastHistoricalOddsAt = Date.now();
    return data;
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
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}
