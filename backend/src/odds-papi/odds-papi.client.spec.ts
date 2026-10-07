import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  isOddsPapiFixtureNotFoundBody,
  isOddsPapiRateLimitedBody,
  OddsPapiClient,
  ODDSPAPI_RATE_LIMIT_MAX_DELAY_MS,
  ODDSPAPI_RATE_LIMIT_MAX_RETRIES,
  ODDSPAPI_RATE_LIMIT_SAFETY_BUFFER_MS,
  resolveOddsPapiRetryDelayMs,
} from './odds-papi.client';
import { OddsPapiService } from './odds-papi.service';
import { ODDSPAPI_BASE_URL } from './odds-papi.types';
import { SportKey } from '../../generated/prisma';

describe('isOddsPapiFixtureNotFoundBody', () => {
  it('detects FIXTURE_NOT_FOUND', () => {
    expect(
      isOddsPapiFixtureNotFoundBody(
        JSON.stringify({
          error: {
            message: 'No fixtures found for the specified criteria.',
            code: 'FIXTURE_NOT_FOUND',
          },
        }),
      ),
    ).toBe(true);
  });

  it('rejects other 404 bodies', () => {
    expect(
      isOddsPapiFixtureNotFoundBody(
        JSON.stringify({ error: { code: 'SOMETHING_ELSE' } }),
      ),
    ).toBe(false);
    expect(isOddsPapiFixtureNotFoundBody('not json')).toBe(false);
  });
});

describe('resolveOddsPapiRetryDelayMs', () => {
  it('prefers error.retryMs + safety buffer', () => {
    expect(
      resolveOddsPapiRetryDelayMs(
        JSON.stringify({ error: { code: 'RATE_LIMITED', retryMs: 1802 } }),
        '99',
      ),
    ).toBe(1802 + ODDSPAPI_RATE_LIMIT_SAFETY_BUFFER_MS);
  });

  it('uses Retry-After seconds when retryMs absent', () => {
    expect(
      resolveOddsPapiRetryDelayMs(
        JSON.stringify({ error: { code: 'RATE_LIMITED' } }),
        '3',
      ),
    ).toBe(3000 + ODDSPAPI_RATE_LIMIT_SAFETY_BUFFER_MS);
  });

  it('caps huge retryMs', () => {
    expect(
      resolveOddsPapiRetryDelayMs(
        JSON.stringify({ error: { code: 'RATE_LIMITED', retryMs: 999_999 } }),
        null,
      ),
    ).toBe(ODDSPAPI_RATE_LIMIT_MAX_DELAY_MS);
  });
});

describe('OddsPapiClient.getFixtures', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function makeClient() {
    const config = {
      get: (key: string) => (key === 'ODDSPAPI_API_KEY' ? 'test-key' : undefined),
    } as unknown as ConfigService;
    return new OddsPapiClient(config);
  }

  function rateLimitedResponse(retryMs = 1802) {
    return {
      ok: false,
      status: 429,
      headers: { get: () => null },
      json: async () => {
        throw new Error('use text');
      },
      text: async () =>
        JSON.stringify({
          error: {
            message: 'Rate limit exceeded',
            code: 'RATE_LIMITED',
            retryAfter: '1.80 seconds',
            retryMs,
          },
        }),
    };
  }

  function okFixturesResponse(rows: any[] = [{ fixtureId: 'fx1' }]) {
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => rows,
      text: async () => JSON.stringify(rows),
    };
  }

  function lastFetchUrl(): URL {
    expect(global.fetch).toHaveBeenCalled();
    const arg = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    return new URL(arg);
  }

  it('finished discovery sends tournamentId/from/to/statusId without hasOdds/bookmakers', async () => {
    global.fetch = jest.fn().mockResolvedValue(okFixturesResponse([]));

    const client = makeClient();
    await client.getFixtures({
      tournamentId: 210,
      from: '2026-09-07T00:00:00.000Z',
      to: '2026-10-07T23:59:59.999Z',
      statusId: 2,
    });

    const url = lastFetchUrl();
    expect(url.origin + url.pathname).toBe(`${ODDSPAPI_BASE_URL}/fixtures`);
    expect(url.searchParams.get('tournamentId')).toBe('210');
    expect(url.searchParams.get('from')).toBe('2026-09-07T00:00:00.000Z');
    expect(url.searchParams.get('to')).toBe('2026-10-07T23:59:59.999Z');
    expect(url.searchParams.get('statusId')).toBe('2');
    expect(url.searchParams.has('hasOdds')).toBe(false);
    expect(url.searchParams.has('bookmakers')).toBe(false);
    expect(url.searchParams.get('apiKey')).toBe('test-key');
  });

  it('404 FIXTURE_NOT_FOUND returns empty list', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
      json: async () => {
        throw new Error('should not parse json');
      },
      text: async () =>
        JSON.stringify({
          error: {
            message: 'No fixtures found for the specified criteria.',
            code: 'FIXTURE_NOT_FOUND',
            details: 'Please check your filters and try again.',
          },
        }),
    });

    const client = makeClient();
    const rows = await client.getFixtures({
      tournamentId: 210,
      from: '2026-09-07T00:00:00.000Z',
      to: '2026-10-07T23:59:59.999Z',
      statusId: 2,
    });
    expect(rows).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('other 404 is NOT converted to empty list', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
      text: async () =>
        JSON.stringify({ error: { code: 'TOURNAMENT_NOT_FOUND' } }),
    });

    const client = makeClient();
    await expect(
      client.getFixtures({ tournamentId: 999, statusId: 2 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('non-404 errors still throw and are not retried', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => null },
      text: async () => 'boom',
    });

    const client = makeClient();
    await expect(
      client.getFixtures({ tournamentId: 210, statusId: 2 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('429 RATE_LIMITED waits then succeeds', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(rateLimitedResponse(1802))
      .mockResolvedValueOnce(okFixturesResponse([{ fixtureId: 'id1' }]));

    const client = makeClient();
    const sleep = jest.spyOn(client as any, 'sleep').mockResolvedValue(undefined);
    const warn = jest.spyOn((client as any).logger, 'warn').mockImplementation();

    const rows = await client.getFixtures({ tournamentId: 210, statusId: 2 });
    expect(rows).toEqual([{ fixtureId: 'id1' }]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1802 + ODDSPAPI_RATE_LIMIT_SAFETY_BUFFER_MS);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(
          `OddsPapi /fixtures rate limited; retrying in ${1802 + ODDSPAPI_RATE_LIMIT_SAFETY_BUFFER_MS}ms \\(attempt 1/${ODDSPAPI_RATE_LIMIT_MAX_RETRIES}\\)`,
        ),
      ),
    );
    const logText = String(warn.mock.calls[0][0]);
    expect(logText).not.toContain('test-key');
    expect(logText).not.toContain('apiKey');
  });

  it('two consecutive 429s then success within retry limit', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(rateLimitedResponse(100))
      .mockResolvedValueOnce(rateLimitedResponse(100))
      .mockResolvedValueOnce(okFixturesResponse([{ fixtureId: 'ok' }]));

    const client = makeClient();
    jest.spyOn(client as any, 'sleep').mockResolvedValue(undefined);

    const rows = await client.getFixtures({ tournamentId: 210, statusId: 2 });
    expect(rows).toEqual([{ fixtureId: 'ok' }]);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('rate limit beyond max retries surfaces error', async () => {
    global.fetch = jest.fn().mockResolvedValue(rateLimitedResponse(50));

    const client = makeClient();
    jest.spyOn(client as any, 'sleep').mockResolvedValue(undefined);

    await expect(
      client.getFixtures({ tournamentId: 210, statusId: 2 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(global.fetch).toHaveBeenCalledTimes(1 + ODDSPAPI_RATE_LIMIT_MAX_RETRIES);
  });

  it('429 without RATE_LIMITED code is not retried', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: () => null },
      text: async () => JSON.stringify({ error: { code: 'OTHER' } }),
    });

    const client = makeClient();
    const sleep = jest.spyOn(client as any, 'sleep').mockResolvedValue(undefined);

    await expect(
      client.getFixtures({ tournamentId: 210, statusId: 2 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('getJson path (/markets) also retries RATE_LIMITED', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(rateLimitedResponse(10))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => [{ marketId: 1 }],
        text: async () => '[]',
      });

    const client = makeClient();
    jest.spyOn(client as any, 'sleep').mockResolvedValue(undefined);

    const markets = await client.getMarkets();
    expect(markets).toEqual([{ marketId: 1 }]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('aborted fetch surfaces as ServiceUnavailableException timeout', async () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    global.fetch = jest.fn().mockRejectedValue(abortErr);

    const client = makeClient();
    await expect(
      client.getFixtures({ tournamentId: 210, statusId: 2 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('isOddsPapiRateLimitedBody', () => {
  it('detects RATE_LIMITED', () => {
    expect(
      isOddsPapiRateLimitedBody(
        JSON.stringify({ error: { code: 'RATE_LIMITED', retryMs: 1 } }),
      ),
    ).toBe(true);
  });
});

describe('OddsPapiService.fetchFinishedFixtures', () => {
  it('does not pass hasOdds or bookmakers to getFixtures', async () => {
    const getFixtures = jest.fn().mockResolvedValue([]);
    const client = { getFixtures } as any;

    const prisma = {
      season: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'season1',
          leagueId: 'league1',
          league: { sport: { key: SportKey.FOOTBALL } },
        }),
      },
      externalLeagueMapping: {
        findUnique: jest.fn().mockResolvedValue({
          externalTournamentId: '210',
        }),
      },
      externalTeamMapping: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const service = new OddsPapiService(prisma, client, {} as any);

    await service.previewFixtures({
      seasonId: 'season1',
      from: '2026-09-07T00:00:00.000Z',
      to: '2026-10-07T23:59:59.999Z',
    });

    expect(getFixtures).toHaveBeenCalledTimes(1);
    expect(getFixtures).toHaveBeenCalledWith({
      tournamentId: 210,
      from: '2026-09-07T00:00:00.000Z',
      to: '2026-10-07T23:59:59.999Z',
      statusId: 2,
    });
    const arg = getFixtures.mock.calls[0][0];
    expect(arg).not.toHaveProperty('hasOdds');
    expect(arg).not.toHaveProperty('bookmakers');
  });
});
