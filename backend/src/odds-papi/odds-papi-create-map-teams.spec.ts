import { uniqueParticipantsFromFixtures } from './odds-papi-participants';
import { OddsPapiService } from './odds-papi.service';
import { SportKey } from '../../generated/prisma';
import { BadRequestException } from '@nestjs/common';

describe('uniqueParticipantsFromFixtures', () => {
  it('dedupes participants across fixtures by id', () => {
    const rows = uniqueParticipantsFromFixtures([
      {
        participant1Id: 1,
        participant2Id: 2,
        participant1Name: 'A',
        participant2Name: 'B',
      },
      {
        participant1Id: 2,
        participant2Id: 3,
        participant1Name: 'B',
        participant2Name: 'C',
      },
      {
        participant1Id: 1,
        participant2Id: 3,
        participant1Name: 'A again',
        participant2Name: 'C',
      },
    ]);
    expect(rows.map((r) => r.externalParticipantId).sort()).toEqual(['1', '2', '3']);
    expect(rows.find((r) => r.externalParticipantId === '1')?.externalName).toBe('A');
  });
});

describe('OddsPapiService.createAndMapTeams', () => {
  const seasonId = 'season1';
  const from = '2026-09-07T00:00:00.000Z';
  const to = '2026-10-07T23:59:59.999Z';

  function fixtures3() {
    return [
      {
        fixtureId: 'f1',
        participant1Id: 10,
        participant2Id: 20,
        participant1Name: 'Team Alpha',
        participant2Name: 'Team Beta',
        startTime: from,
        statusId: 2,
        hasOdds: false,
        sportId: 10,
        tournamentId: 210,
      },
      {
        fixtureId: 'f2',
        participant1Id: 10,
        participant2Id: 30,
        participant1Name: 'Team Alpha',
        participant2Name: 'Team Gamma',
        startTime: from,
        statusId: 2,
        hasOdds: false,
        sportId: 10,
        tournamentId: 210,
      },
    ];
  }

  function basePrisma(opts: {
    existingTeams?: { id: string }[];
    existingMappings?: { externalParticipantId: string; teamId: string }[];
  }) {
    const existingTeams = opts.existingTeams ?? [];
    const existingMappings = opts.existingMappings ?? [];
    const createdTeams: any[] = [];
    const createdMaps: any[] = [];

    const tx = {
      team: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const row = { id: `t-${createdTeams.length + 1}`, ...data };
          createdTeams.push(row);
          return row;
        }),
      },
      externalTeamMapping: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const row = { id: `m-${createdMaps.length + 1}`, ...data };
          createdMaps.push(row);
          return row;
        }),
      },
    };

    const prisma: any = {
      season: {
        findUnique: jest.fn().mockResolvedValue({
          id: seasonId,
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
        findMany: jest.fn().mockResolvedValue(
          existingMappings.map((m) => ({
            externalParticipantId: m.externalParticipantId,
            teamId: m.teamId,
          })),
        ),
      },
      team: {
        findMany: jest.fn().mockResolvedValue(existingTeams),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)),
      _tx: tx,
      _createdTeams: createdTeams,
      _createdMaps: createdMaps,
    };
    return prisma;
  }

  it('empty season: creates one Team+mapping per unique participant', async () => {
    const prisma = basePrisma({});
    const client = {
      getFixtures: jest.fn().mockResolvedValue(fixtures3()),
    };
    const service = new OddsPapiService(prisma, client as any, {} as any);

    const result = await service.createAndMapTeams({ seasonId, from, to });

    expect(result).toEqual({
      participantsFound: 3,
      teamsCreated: 3,
      mappingsCreated: 3,
      alreadyMapped: 0,
      failed: 0,
    });
    expect(prisma._tx.team.create).toHaveBeenCalledTimes(3);
    expect(prisma._tx.externalTeamMapping.create).toHaveBeenCalledTimes(3);
    expect(client.getFixtures).toHaveBeenCalledTimes(1);
  });

  it('idempotent: second run creates nothing', async () => {
    const prisma = basePrisma({
      existingTeams: [{ id: 't1' }, { id: 't2' }, { id: 't3' }],
      existingMappings: [
        { externalParticipantId: '10', teamId: 't1' },
        { externalParticipantId: '20', teamId: 't2' },
        { externalParticipantId: '30', teamId: 't3' },
      ],
    });
    const client = {
      getFixtures: jest.fn().mockResolvedValue(fixtures3()),
    };
    const service = new OddsPapiService(prisma, client as any, {} as any);

    const result = await service.createAndMapTeams({ seasonId, from, to });

    expect(result).toEqual({
      participantsFound: 3,
      teamsCreated: 0,
      mappingsCreated: 0,
      alreadyMapped: 3,
      failed: 0,
    });
    expect(prisma._tx.team.create).not.toHaveBeenCalled();
  });

  it('duplicate participant across fixtures creates one Team only', async () => {
    const prisma = basePrisma({});
    const client = {
      getFixtures: jest.fn().mockResolvedValue(fixtures3()),
    };
    const service = new OddsPapiService(prisma, client as any, {} as any);
    await service.createAndMapTeams({ seasonId, from, to });

    const names = prisma._createdTeams.map((t: any) => t.name).sort();
    expect(names).toEqual(['Team Alpha', 'Team Beta', 'Team Gamma']);
  });

  it('skips already-mapped participant without recreating Team', async () => {
    const prisma = basePrisma({
      existingTeams: [{ id: 't1' }],
      existingMappings: [{ externalParticipantId: '10', teamId: 't1' }],
    });
    const client = {
      getFixtures: jest.fn().mockResolvedValue(fixtures3()),
    };
    const service = new OddsPapiService(prisma, client as any, {} as any);

    const result = await service.createAndMapTeams({ seasonId, from, to });
    expect(result.alreadyMapped).toBe(1);
    expect(result.teamsCreated).toBe(2);
    expect(result.mappingsCreated).toBe(2);
  });

  it('transaction: mapping failure rolls back (no orphan commit)', async () => {
    const prisma = basePrisma({});
    prisma.$transaction = jest.fn().mockImplementation(async (fn: any) => {
      const tx = {
        team: {
          create: jest.fn().mockResolvedValue({ id: 'orphan' }),
        },
        externalTeamMapping: {
          create: jest.fn().mockRejectedValue(new Error('mapping boom')),
        },
      };
      return fn(tx);
    });
    const client = {
      getFixtures: jest.fn().mockResolvedValue(fixtures3()),
    };
    const service = new OddsPapiService(prisma, client as any, {} as any);

    await expect(
      service.createAndMapTeams({ seasonId, from, to }),
    ).rejects.toThrow('mapping boom');
    // Interactive transaction rejects → caller sees failure; prisma.$transaction
    // would roll back in real DB. We assert the operation does not return success.
  });

  it('blocks bulk create when season has unmapped internal teams', async () => {
    const prisma = basePrisma({
      existingTeams: [{ id: 'manual1' }],
      existingMappings: [],
    });
    const client = {
      getFixtures: jest.fn().mockResolvedValue(fixtures3()),
    };
    const service = new OddsPapiService(prisma, client as any, {} as any);

    await expect(
      service.createAndMapTeams({ seasonId, from, to }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(client.getFixtures).not.toHaveBeenCalled();
  });
});
