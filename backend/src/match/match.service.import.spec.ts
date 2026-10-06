import { MatchService } from '../match/match.service';
import { ExternalDataProvider, SportKey } from '../../generated/prisma';

describe('MatchService.upsertImportedMatch', () => {
  const seasonFootball = {
    id: 'season1',
    flipCoef: 1.21,
    baseCoefHomeEqual: 2.2,
    league: { sport: { key: SportKey.FOOTBALL } },
    derbyMatches: [{ homeTeamId: 'teamA', awayTeamId: 'teamB' }],
  };

  function basePrisma(overrides: Partial<any> = {}) {
    let lastComputedUpsert: any = null;
    const prisma: any = {
      season: {
        findUnique: jest.fn().mockResolvedValue(seasonFootball),
      },
      team: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => ({
          id: where.id,
          seasonId: 'season1',
        })),
      },
      match: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) => {
        const tx = {
          match: {
            create: jest.fn().mockResolvedValue({ id: 'm1' }),
            update: jest.fn().mockResolvedValue({ id: 'existing-match' }),
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              id: 'm1',
              seasonId: 'season1',
              tourId: null,
              date: new Date('2026-09-20T17:00:00.000Z'),
              marketType: 'MATCH_1X2_REGULAR_TIME',
              homeTeamId: 'teamB',
              awayTeamId: 'teamA',
              kHome: 2.1,
              kDraw: 3.4,
              kAway: 3.5,
              total: 2.5,
              source: ExternalDataProvider.ODDSPAPI,
              externalFixtureId: 'fx1',
              createdAt: new Date(),
              updatedAt: new Date(),
              homeTeam: { name: 'B' },
              awayTeam: { name: 'A' },
              computed: {
                baseProbUsed: 45,
                pHomeImplied: 0.4,
                pDrawImplied: 0.3,
                pAwayImplied: 0.3,
                deltaHome: 1,
                deltaAway: -1,
              },
            }),
          },
          matchComputed: {
            upsert: jest.fn().mockImplementation(async (args: any) => {
              lastComputedUpsert = args;
              return {};
            }),
          },
        };
        return fn(tx);
      }),
      ...overrides,
      _getLastComputedUpsert: () => lastComputedUpsert,
    };
    // re-bind lastComputedUpsert accessor after spread
    Object.defineProperty(prisma, 'getLastComputedUpsert', {
      get: () => () => lastComputedUpsert,
    });
    return prisma;
  }

  it('derby pair A↔B applies domain calc for reverse venue B home vs A away', async () => {
    let captured: any = null;
    const prisma: any = {
      season: { findUnique: jest.fn().mockResolvedValue(seasonFootball) },
      team: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => ({
          id: where.id,
          seasonId: 'season1',
        })),
      },
      match: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation(async (fn: any) => {
        const tx = {
          match: {
            create: jest.fn().mockResolvedValue({ id: 'm1' }),
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              id: 'm1',
              seasonId: 'season1',
              tourId: null,
              date: new Date(),
              marketType: 'MATCH_1X2_REGULAR_TIME',
              homeTeamId: 'teamB',
              awayTeamId: 'teamA',
              kHome: 2.1,
              kDraw: 3.4,
              kAway: 3.5,
              total: 2.5,
              source: ExternalDataProvider.ODDSPAPI,
              externalFixtureId: 'fx1',
              createdAt: new Date(),
              updatedAt: new Date(),
              homeTeam: { name: 'B' },
              awayTeam: { name: 'A' },
              computed: {
                baseProbUsed: 45,
                pHomeImplied: 0.4,
                pDrawImplied: 0.3,
                pAwayImplied: 0.3,
                deltaHome: 1,
                deltaAway: -1,
              },
            }),
          },
          matchComputed: {
            upsert: jest.fn().mockImplementation(async (args: any) => {
              captured = args;
              return {};
            }),
          },
        };
        return fn(tx);
      }),
    };

    const service = new MatchService(prisma);
    const res = await service.upsertImportedMatch({
      seasonId: 'season1',
      date: '2026-09-20T17:00:00.000Z',
      homeTeamId: 'teamB',
      awayTeamId: 'teamA',
      kHome: 2.1,
      kDraw: 3.4,
      kAway: 3.5,
      total: 2.5,
      source: ExternalDataProvider.ODDSPAPI,
      externalFixtureId: 'fx1',
    });

    expect(res.created).toBe(true);
    expect(captured).toBeTruthy();
    expect(typeof captured.create.deltaHome).toBe('number');
    expect(typeof captured.create.pHomeImplied).toBe('number');
    // Dirty implied: not normalized to sum 1 (margin kept)
    const sum =
      captured.create.pHomeImplied +
      captured.create.pDrawImplied +
      captured.create.pAwayImplied;
    expect(sum).not.toBeCloseTo(1, 6);
  });

  it('idempotent: existing (source, externalFixtureId) updates instead of creating duplicate', async () => {
    const prisma: any = {
      season: {
        findUnique: jest.fn().mockResolvedValue({
          ...seasonFootball,
          derbyMatches: [],
        }),
      },
      team: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => ({
          id: where.id,
          seasonId: 'season1',
        })),
      },
      match: {
        findUnique: jest.fn().mockResolvedValue({ id: 'existing-match' }),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) => {
        const tx = {
          match: {
            update: jest.fn().mockResolvedValue({ id: 'existing-match' }),
            create: jest.fn(),
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              id: 'existing-match',
              seasonId: 'season1',
              tourId: null,
              date: new Date(),
              marketType: 'MATCH_1X2_REGULAR_TIME',
              homeTeamId: 'teamA',
              awayTeamId: 'teamB',
              kHome: 1.8,
              kDraw: 3.5,
              kAway: 4.5,
              total: null,
              source: ExternalDataProvider.ODDSPAPI,
              externalFixtureId: 'fx-dup',
              createdAt: new Date(),
              updatedAt: new Date(),
              homeTeam: { name: 'A' },
              awayTeam: { name: 'B' },
              computed: {
                baseProbUsed: 1,
                pHomeImplied: 0.5,
                pDrawImplied: 0.25,
                pAwayImplied: 0.25,
                deltaHome: 0,
                deltaAway: 0,
              },
            }),
          },
          matchComputed: { upsert: jest.fn().mockResolvedValue({}) },
        };
        const out = await fn(tx);
        expect(tx.match.create).not.toHaveBeenCalled();
        expect(tx.match.update).toHaveBeenCalled();
        return out;
      }),
    };

    const service = new MatchService(prisma);
    const res = await service.upsertImportedMatch({
      seasonId: 'season1',
      date: '2026-09-20T17:00:00.000Z',
      homeTeamId: 'teamA',
      awayTeamId: 'teamB',
      kHome: 1.8,
      kDraw: 3.5,
      kAway: 4.5,
      source: ExternalDataProvider.ODDSPAPI,
      externalFixtureId: 'fx-dup',
    });

    expect(res.created).toBe(false);
  });
});
