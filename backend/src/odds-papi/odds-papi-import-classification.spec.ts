import { ServiceUnavailableException } from '@nestjs/common';
import {
  isOddsPapiHistoricalOddsNotFoundBody,
  OddsPapiClient,
  OddsPapiHistoricalOddsNotFoundError,
} from './odds-papi.client';
import { OddsPapiService } from './odds-papi.service';
import { SportKey } from '../../generated/prisma';
import { ConfigService } from '@nestjs/config';

describe('isOddsPapiHistoricalOddsNotFoundBody', () => {
  it('detects observed OddsPapi historical 404 shape', () => {
    expect(
      isOddsPapiHistoricalOddsNotFoundBody(
        JSON.stringify({
          error: {
            message: 'No historical odds found.',
            code: 'NOT_FOUND',
            details: 'Please check the provided filters and try again.',
          },
        }),
      ),
    ).toBe(true);
  });

  it('rejects FIXTURE_NOT_FOUND and other codes', () => {
    expect(
      isOddsPapiHistoricalOddsNotFoundBody(
        JSON.stringify({ error: { code: 'FIXTURE_NOT_FOUND' } }),
      ),
    ).toBe(false);
  });
});

describe('OddsPapiClient.getHistoricalOdds NOT_FOUND', () => {
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

  it('404 NOT_FOUND throws OddsPapiHistoricalOddsNotFoundError (not ServiceUnavailable)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
      text: async () =>
        JSON.stringify({
          error: {
            message: 'No historical odds found.',
            code: 'NOT_FOUND',
          },
        }),
    });

    const client = makeClient();
    jest.spyOn(client as any, 'sleep').mockResolvedValue(undefined);

    await expect(client.getHistoricalOdds('id1500')).rejects.toBeInstanceOf(
      OddsPapiHistoricalOddsNotFoundError,
    );
  });

  it('other 404 remains ServiceUnavailableException', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
      text: async () => JSON.stringify({ error: { code: 'SOMETHING_ELSE' } }),
    });

    const client = makeClient();
    jest.spyOn(client as any, 'sleep').mockResolvedValue(undefined);

    await expect(client.getHistoricalOdds('id1500')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe('OddsPapiService.importFixtures missing-odds classification', () => {
  const seasonId = 'season1';
  const from = '2026-09-01T00:00:00.000Z';
  const to = '2026-10-01T00:00:00.000Z';

  const fixture = {
    fixtureId: 'fx1',
    participant1Id: 10,
    participant2Id: 20,
    participant1Name: 'Home',
    participant2Name: 'Away',
    startTime: '2026-09-15T15:00:00.000Z',
    trueStartTime: '2026-09-15T15:03:00.000Z',
    statusId: 2,
    hasOdds: false,
    sportId: 15,
    tournamentId: 1141,
  };

  function makeService(
    client: any,
    matches?: any,
    prismaOverrides?: { alreadyFixtureIds?: string[] },
  ) {
    const prisma: any = {
      season: {
        findUnique: jest.fn().mockResolvedValue({
          id: seasonId,
          leagueId: 'league1',
          league: { sport: { key: SportKey.HOCKEY } },
        }),
      },
      externalLeagueMapping: {
        findUnique: jest.fn().mockResolvedValue({
          externalTournamentId: '1141',
        }),
      },
      externalTeamMapping: {
        findMany: jest.fn().mockResolvedValue([
          { externalParticipantId: '10', teamId: 'tHome' },
          { externalParticipantId: '20', teamId: 'tAway' },
        ]),
      },
      match: {
        findMany: jest.fn().mockResolvedValue(
          (prismaOverrides?.alreadyFixtureIds ?? []).map((externalFixtureId) => ({
            externalFixtureId,
          })),
        ),
      },
    };

    const matchService = matches ?? {
      upsertImportedMatch: jest.fn().mockResolvedValue({
        created: true,
        match: { id: 'm1' },
      }),
    };

    return { service: new OddsPapiService(prisma, client, matchService), prisma, matchService };
  }

  it('already-imported fixture skips before historical-odds (manual override safe)', async () => {
    const getHistoricalOdds = jest.fn();
    const upsertImportedMatch = jest.fn();
    const client = {
      getFixtures: jest.fn().mockResolvedValue([fixture]),
      getMarkets: jest.fn().mockResolvedValue([]),
      getHistoricalOdds,
    };

    const { service } = makeService(
      client,
      { upsertImportedMatch },
      { alreadyFixtureIds: [fixture.fixtureId] },
    );
    const result = await service.importFixtures({ seasonId, from, to });

    expect(result.alreadyImported).toBe(1);
    expect(result.imported).toBe(0);
    expect(getHistoricalOdds).not.toHaveBeenCalled();
    expect(upsertImportedMatch).not.toHaveBeenCalled();
  });

  it('A: historical-odds 404 NOT_FOUND → missingOdds, MISSING_PINNACLE_1X2, failed=0', async () => {
    const client = {
      getFixtures: jest.fn().mockResolvedValue([fixture]),
      getMarkets: jest.fn().mockResolvedValue([]),
      getHistoricalOdds: jest
        .fn()
        .mockRejectedValue(new OddsPapiHistoricalOddsNotFoundError(fixture.fixtureId)),
    };

    const { service } = makeService(client);
    const result = await service.importFixtures({ seasonId, from, to });

    expect(result.fixturesFound).toBe(1);
    expect(result.imported).toBe(0);
    expect(result.missingOdds).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.skips).toEqual([
      expect.objectContaining({
        fixtureId: 'fx1',
        reason: 'MISSING_PINNACLE_1X2',
      }),
    ]);
  });

  it('B: 200 payload but closing 1X2 unresolved → MISSING_PINNACLE_1X2', async () => {
    const client = {
      getFixtures: jest.fn().mockResolvedValue([fixture]),
      getMarkets: jest.fn().mockResolvedValue([]),
      getHistoricalOdds: jest.fn().mockResolvedValue({
        fixtureId: fixture.fixtureId,
        bookmakers: {}, // no pinnacle markets
      }),
    };

    const { service } = makeService(client);
    const result = await service.importFixtures({ seasonId, from, to });

    expect(result.missingOdds).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.skips[0].reason).toBe('MISSING_PINNACLE_1X2');
  });

  it('C: unexpected historical 500 → failed, not missingOdds', async () => {
    const client = {
      getFixtures: jest.fn().mockResolvedValue([fixture]),
      getMarkets: jest.fn().mockResolvedValue([]),
      getHistoricalOdds: jest
        .fn()
        .mockRejectedValue(new ServiceUnavailableException('OddsPapi request failed (500)')),
    };

    const { service } = makeService(client);
    const result = await service.importFixtures({ seasonId, from, to });

    expect(result.failed).toBe(1);
    expect(result.missingOdds).toBe(0);
    expect(result.skips[0].reason).toMatch(/^HISTORICAL_ODDS_ERROR:/);
  });

  it('E: valid 1X2 but no usable Total → import with total=null, importedWithoutTotal', async () => {
    const client = {
      getFixtures: jest.fn().mockResolvedValue([fixture]),
      getMarkets: jest.fn().mockResolvedValue([]), // no totals markets
      getHistoricalOdds: jest.fn().mockResolvedValue({
        fixtureId: fixture.fixtureId,
        bookmakers: {
          pinnacle: {
            markets: {
              '153': {
                outcomes: {
                  '153': {
                    players: {
                      '0': [
                        {
                          createdAt: '2026-09-15T15:00:00.000Z',
                          price: 1.25,
                          active: true,
                        },
                      ],
                    },
                  },
                  '154': {
                    players: {
                      '0': [
                        {
                          createdAt: '2026-09-15T15:00:00.000Z',
                          price: 5.5,
                          active: true,
                        },
                      ],
                    },
                  },
                  '155': {
                    players: {
                      '0': [
                        {
                          createdAt: '2026-09-15T15:00:00.000Z',
                          price: 8.0,
                          active: true,
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      }),
    };

    const upsertImportedMatch = jest.fn().mockResolvedValue({
      created: true,
      match: { id: 'm1' },
    });
    const { service } = makeService(client, { upsertImportedMatch });
    const result = await service.importFixtures({ seasonId, from, to });

    expect(result.imported).toBe(1);
    expect(result.importedWithoutTotal).toBe(1);
    expect(result.missingOdds).toBe(0);
    expect(result.failed).toBe(0);
    expect(upsertImportedMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        total: null,
        kHome: 1.25,
        kDraw: 5.5,
        kAway: 8.0,
      }),
    );
  });
});
