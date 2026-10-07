import { MatchService } from './match.service';
import { SportKey } from '../../generated/prisma';

describe('MatchService.recalculateDerivedForTeamPair', () => {
  const flipCoef = 1.21;
  const baseCoefHomeEqual = 2.3;
  const odds = { kHome: 1.925, kDraw: 3.33, kAway: 3.86 };

  function season(derbyMatches: Array<{ homeTeamId: string; awayTeamId: string }>) {
    return {
      id: 'season1',
      flipCoef,
      baseCoefHomeEqual,
      league: { sport: { key: SportKey.FOOTBALL } },
      derbyMatches,
    };
  }

  function matchRow(overrides: Partial<{
    id: string;
    homeTeamId: string;
    awayTeamId: string;
  }> = {}) {
    return {
      id: 'mAB',
      seasonId: 'season1',
      homeTeamId: 'teamA',
      awayTeamId: 'teamB',
      kHome: odds.kHome,
      kDraw: odds.kDraw,
      kAway: odds.kAway,
      ...overrides,
    };
  }

  async function recalc(
    derbyMatches: Array<{ homeTeamId: string; awayTeamId: string }>,
    matches: ReturnType<typeof matchRow>[],
  ) {
    const upserts: any[] = [];
    const prisma: any = {
      season: {
        findUnique: jest.fn().mockResolvedValue(season(derbyMatches)),
      },
      match: {
        findMany: jest.fn().mockResolvedValue(matches),
      },
      matchComputed: {
        upsert: jest.fn().mockImplementation(async (args: any) => {
          upserts.push(args);
          return {};
        }),
      },
    };
    const service = new MatchService(prisma);
    const n = await service.recalculateDerivedForTeamPair('season1', 'teamA', 'teamB');
    return { n, upserts, prisma };
  }

  it('add derby: MatchComputed uses derby path (differs from normal); odds not written', async () => {
    const normal = await recalc([], [matchRow()]);
    const derby = await recalc(
      [{ homeTeamId: 'teamA', awayTeamId: 'teamB' }],
      [matchRow()],
    );

    expect(derby.n).toBe(1);
    const nUpd = normal.upserts[0].update;
    const dUpd = derby.upserts[0].update;

    // Same base from baseCoefHomeEqual
    expect(dUpd.baseProbUsed).toBeCloseTo(nUpd.baseProbUsed, 8);
    expect(dUpd.baseProbUsed).toBeCloseTo(100 / baseCoefHomeEqual, 5);

    // Derby home-favorite adjusts kHome by √flipCoef → higher dirty pHome / delta
    const sqrtFlip = Math.sqrt(flipCoef);
    const kAdj = (odds.kHome - 1) / sqrtFlip + 1;
    expect(dUpd.pHomeImplied).toBeCloseTo(1 / kAdj, 8);
    expect(dUpd.deltaHome).toBeCloseTo(dUpd.pHomeImplied * 100 - dUpd.baseProbUsed, 8);
    expect(dUpd.deltaHome).not.toBeCloseTo(nUpd.deltaHome, 3);
    expect(dUpd.deltaHome).toBeGreaterThan(nUpd.deltaHome);

    expect(derby.prisma.match.update).toBeUndefined();
  });

  it('delete derby: with empty derby list uses normal formula again', async () => {
    const derby = await recalc(
      [{ homeTeamId: 'teamA', awayTeamId: 'teamB' }],
      [matchRow()],
    );
    const normal = await recalc([], [matchRow()]);

    expect(normal.upserts[0].update.deltaHome).not.toBeCloseTo(
      derby.upserts[0].update.deltaHome,
      3,
    );
    // Normal dirty path: effective home odds via flipCoef (not √flipCoef)
    expect(normal.upserts[0].update.pHomeImplied).not.toBeCloseTo(
      derby.upserts[0].update.pHomeImplied,
      3,
    );
  });

  it('recalculates both venue directions A↔B', async () => {
    const { n, upserts } = await recalc(
      [{ homeTeamId: 'teamA', awayTeamId: 'teamB' }],
      [
        matchRow({ id: 'mAB', homeTeamId: 'teamA', awayTeamId: 'teamB' }),
        matchRow({ id: 'mBA', homeTeamId: 'teamB', awayTeamId: 'teamA' }),
      ],
    );
    expect(n).toBe(2);
    expect(upserts.map((u) => u.where.matchId).sort()).toEqual(['mAB', 'mBA']);
  });

  it('only selects the team pair (A/B and B/A) via query filter', async () => {
    const { prisma } = await recalc([], []);
    expect(prisma.match.findMany).toHaveBeenCalledWith({
      where: {
        seasonId: 'season1',
        OR: [
          { homeTeamId: 'teamA', awayTeamId: 'teamB' },
          { homeTeamId: 'teamB', awayTeamId: 'teamA' },
        ],
      },
    });
  });
});

describe('DerbyService create/delete ordering', () => {
  const { DerbyService } = require('../derby/derby.service');

  it('create: derby row created before recalculate (same transaction)', async () => {
    const order: string[] = [];
    const tx = {
      seasonDerbyMatch: {
        create: jest.fn().mockImplementation(async () => {
          order.push('create');
          return {
            id: 'd1',
            seasonId: 'season1',
            homeTeamId: 'teamA',
            awayTeamId: 'teamB',
            type: 'DERBY',
            homeTeam: { name: 'A' },
            awayTeam: { name: 'B' },
          };
        }),
      },
    };
    const prisma: any = {
      season: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'season1',
          league: { sport: { key: SportKey.FOOTBALL } },
        }),
      },
      team: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => ({
          id: where.id,
          seasonId: 'season1',
        })),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)),
    };
    const matches = {
      recalculateDerivedForTeamPair: jest.fn().mockImplementation(async () => {
        order.push('recalc');
        return 1;
      }),
    };

    const service = new DerbyService(prisma, matches);
    await service.create({
      seasonId: 'season1',
      homeTeamId: 'teamA',
      awayTeamId: 'teamB',
      type: 'DERBY' as any,
    });

    expect(order).toEqual(['create', 'recalc']);
    expect(matches.recalculateDerivedForTeamPair).toHaveBeenCalledWith(
      'season1',
      'teamA',
      'teamB',
      tx,
    );
  });

  it('delete: derby removed before recalculate (same transaction)', async () => {
    const order: string[] = [];
    const tx = {
      seasonDerbyMatch: {
        delete: jest.fn().mockImplementation(async () => {
          order.push('delete');
          return {};
        }),
      },
    };
    const prisma: any = {
      seasonDerbyMatch: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'd1',
          seasonId: 'season1',
          homeTeamId: 'teamA',
          awayTeamId: 'teamB',
        }),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)),
    };
    const matches = {
      recalculateDerivedForTeamPair: jest.fn().mockImplementation(async () => {
        order.push('recalc');
        return 1;
      }),
    };

    const service = new DerbyService(prisma, matches);
    await service.remove('d1');

    expect(order).toEqual(['delete', 'recalc']);
    expect(matches.recalculateDerivedForTeamPair).toHaveBeenCalledWith(
      'season1',
      'teamA',
      'teamB',
      tx,
    );
  });

  it('does not create StrengthSnapshot', async () => {
    const tx = {
      seasonDerbyMatch: {
        create: jest.fn().mockResolvedValue({
          id: 'd1',
          seasonId: 'season1',
          homeTeamId: 'teamA',
          awayTeamId: 'teamB',
          type: 'DERBY',
          homeTeam: { name: 'A' },
          awayTeam: { name: 'B' },
        }),
      },
    };
    const prisma: any = {
      season: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'season1',
          league: { sport: { key: SportKey.FOOTBALL } },
        }),
      },
      team: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => ({
          id: where.id,
          seasonId: 'season1',
        })),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)),
      strengthSnapshot: { create: jest.fn() },
    };

    const matches = {
      recalculateDerivedForTeamPair: jest.fn().mockResolvedValue(0),
    };
    const service = new DerbyService(prisma, matches);
    await service.create({
      seasonId: 'season1',
      homeTeamId: 'teamA',
      awayTeamId: 'teamB',
      type: 'DERBY' as any,
    });

    expect(prisma.strengthSnapshot.create).not.toHaveBeenCalled();
  });
});
