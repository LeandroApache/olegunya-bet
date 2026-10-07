import { BadRequestException } from '@nestjs/common';
import { MatchService } from './match.service';
import { ExternalDataProvider, SportKey } from '../../generated/prisma';

describe('MatchService.update (pricing)', () => {
  const flipCoef = 1.21;
  const baseCoefHomeEqual = 2.3;

  function existingMatch(overrides: Record<string, unknown> = {}) {
    return {
      id: 'm1',
      seasonId: 'season1',
      tourId: null,
      date: new Date('2026-09-20T17:00:00.000Z'),
      marketType: 'MATCH_1X2_REGULAR_TIME',
      homeTeamId: 'teamA',
      awayTeamId: 'teamB',
      kHome: 1.9,
      kDraw: 3.4,
      kAway: 3.8,
      total: 5.5,
      source: ExternalDataProvider.ODDSPAPI,
      externalFixtureId: 'fx-keep',
      season: {
        id: 'season1',
        flipCoef,
        baseCoefHomeEqual,
        league: { sport: { key: SportKey.FOOTBALL } },
        derbyMatches: [] as Array<{ homeTeamId: string; awayTeamId: string }>,
      },
      ...overrides,
    };
  }

  function makePrisma(existing: ReturnType<typeof existingMatch>) {
    const matchUpdates: any[] = [];
    const computedUpserts: any[] = [];
    let stored = {
      ...existing,
      homeTeam: { name: 'Home' },
      awayTeam: { name: 'Away' },
      computed: {
        baseProbUsed: 40,
        pHomeImplied: 0.4,
        pDrawImplied: 0.3,
        pAwayImplied: 0.3,
        deltaHome: 1,
        deltaAway: -1,
      },
    };

    const prisma: any = {
      match: {
        findUnique: jest.fn().mockResolvedValue(existing),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) => {
        const tx = {
          match: {
            update: jest.fn().mockImplementation(async ({ data }: any) => {
              matchUpdates.push(data);
              stored = {
                ...stored,
                ...data,
                source: existing.source,
                externalFixtureId: existing.externalFixtureId,
                homeTeamId: existing.homeTeamId,
                awayTeamId: existing.awayTeamId,
                date: existing.date,
                marketType: existing.marketType,
              };
              return stored;
            }),
            findUniqueOrThrow: jest.fn().mockImplementation(async () => stored),
          },
          matchComputed: {
            upsert: jest.fn().mockImplementation(async (args: any) => {
              computedUpserts.push(args);
              stored = {
                ...stored,
                computed: {
                  ...args.update,
                },
              };
              return {};
            }),
          },
        };
        return fn(tx);
      }),
      matchUpdates,
      computedUpserts,
    };
    return prisma;
  }

  it('updates odds and recalculates MatchComputed', async () => {
    const existing = existingMatch();
    const prisma = makePrisma(existing);
    const service = new MatchService(prisma);

    const res = await service.update({
      id: 'm1',
      kHome: 2.1,
      kDraw: 3.2,
      kAway: 3.5,
      total: 5.5,
    });

    expect(prisma.matchUpdates[0]).toEqual({
      kHome: 2.1,
      kDraw: 3.2,
      kAway: 3.5,
      total: 5.5,
    });
    expect(prisma.matchUpdates[0].homeTeamId).toBeUndefined();
    expect(prisma.matchUpdates[0].source).toBeUndefined();
    expect(prisma.matchUpdates[0].externalFixtureId).toBeUndefined();
    expect(prisma.computedUpserts).toHaveLength(1);
    expect(res.kHome).toBe(2.1);
    expect(res.computed?.pHomeImplied).toBeCloseTo(1 / 2.1, 5);
  });

  it('derby match keeps derby calculation path', async () => {
    const existing = existingMatch({
      season: {
        id: 'season1',
        flipCoef,
        baseCoefHomeEqual,
        league: { sport: { key: SportKey.FOOTBALL } },
        derbyMatches: [{ homeTeamId: 'teamA', awayTeamId: 'teamB' }],
      },
    });
    const prisma = makePrisma(existing);
    const service = new MatchService(prisma);

    await service.update({
      id: 'm1',
      kHome: 1.925,
      kDraw: 3.33,
      kAway: 3.86,
      total: 2.5,
    });

    const upd = prisma.computedUpserts[0].update;
    const sqrtFlip = Math.sqrt(flipCoef);
    const kAdj = (1.925 - 1) / sqrtFlip + 1;
    expect(upd.pHomeImplied).toBeCloseTo(1 / kAdj, 8);
  });

  it('total-only change leaves derived strength values unchanged', async () => {
    const existing = existingMatch({ kHome: 2.0, kDraw: 3.5, kAway: 3.8, total: 4.5 });
    const prisma = makePrisma(existing);
    const service = new MatchService(prisma);

    const before = await service.update({
      id: 'm1',
      kHome: 2.0,
      kDraw: 3.5,
      kAway: 3.8,
      total: 4.5,
    });
    const after = await service.update({
      id: 'm1',
      kHome: 2.0,
      kDraw: 3.5,
      kAway: 3.8,
      total: 6.5,
    });

    expect(prisma.matchUpdates[1].total).toBe(6.5);
    expect(after.computed!.deltaHome).toBeCloseTo(before.computed!.deltaHome, 10);
    expect(after.computed!.deltaAway).toBeCloseTo(before.computed!.deltaAway, 10);
    expect(after.computed!.pHomeImplied).toBeCloseTo(before.computed!.pHomeImplied, 10);
  });

  it('preserves ODDSPAPI source and externalFixtureId', async () => {
    const existing = existingMatch();
    const prisma = makePrisma(existing);
    const service = new MatchService(prisma);

    const res = await service.update({
      id: 'm1',
      kHome: 2.2,
      kDraw: 3.3,
      kAway: 3.4,
      total: 5.0,
    });

    expect(prisma.matchUpdates[0].source).toBeUndefined();
    expect(prisma.matchUpdates[0].externalFixtureId).toBeUndefined();
    expect(res.source).toBe(ExternalDataProvider.ODDSPAPI);
    expect(res.externalFixtureId).toBe('fx-keep');
  });

  it('does not create StrengthSnapshot', async () => {
    const existing = existingMatch();
    const prisma = makePrisma(existing);
    prisma.strengthSnapshot = { create: jest.fn() };
    const service = new MatchService(prisma);

    await service.update({
      id: 'm1',
      kHome: 2.0,
      kDraw: 3.5,
      kAway: 3.8,
      total: 5.5,
    });

    expect(prisma.strengthSnapshot.create).not.toHaveBeenCalled();
  });

  it('rejects invalid odds', async () => {
    const prisma = makePrisma(existingMatch());
    const service = new MatchService(prisma);

    await expect(
      service.update({ id: 'm1', kHome: 1, kDraw: 3.2, kAway: 3.5, total: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid total', async () => {
    const prisma = makePrisma(existingMatch());
    const service = new MatchService(prisma);

    await expect(
      service.update({ id: 'm1', kHome: 2.0, kDraw: 3.2, kAway: 3.5, total: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.update({ id: 'm1', kHome: 2.0, kDraw: 3.2, kAway: 3.5, total: -1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows clearing total with null', async () => {
    const prisma = makePrisma(existingMatch());
    const service = new MatchService(prisma);

    await service.update({
      id: 'm1',
      kHome: 2.0,
      kDraw: 3.2,
      kAway: 3.5,
      total: null,
    });
    expect(prisma.matchUpdates[0].total).toBeNull();
  });
});
