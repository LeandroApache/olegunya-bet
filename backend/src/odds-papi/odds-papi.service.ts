import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ExternalDataProvider, SportKey } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { MatchService } from '../match/match.service';
import { ExternalDataProviderGql } from '../match/dto/match.types';
import {
  closingCutoffIso,
  extractPinnacleClosingOneXTwo,
} from './odds-papi-closing';
import { listMatchTotalsMarkets } from './odds-papi-market-filter';
import {
  OddsPapiClient,
  OddsPapiHistoricalOddsNotFoundError,
} from './odds-papi.client';
import {
  getOddsPapiSportConfig,
  ODDSPAPI_BOOKMAKER_PINNACLE,
  ODDSPAPI_STATUS_FINISHED,
} from './odds-papi.sport-config';
import { selectMainTotalLine } from './odds-papi-total-selector';
import {
  ExternalLeagueMappingGql,
  ExternalTeamMappingGql,
  CreateAndMapOddsPapiTeamsInput,
  ImportOddsPapiFixturesInput,
  OddsPapiCreateAndMapTeamsResultGql,
  OddsPapiFixturePreviewGql,
  OddsPapiImportResultGql,
  OddsPapiImportSkipGql,
  OddsPapiTournamentGql,
  UpsertExternalLeagueMappingInput,
  UpsertExternalTeamMappingInput,
} from './dto/odds-papi.dto';
import { uniqueParticipantsFromFixtures } from './odds-papi-participants';

@Injectable()
export class OddsPapiService {
  private readonly logger = new Logger(OddsPapiService.name);
  private provider = ExternalDataProvider.ODDSPAPI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: OddsPapiClient,
    private readonly matches: MatchService,
  ) {}

  // ─── League mapping ───────────────────────────────────────────────

  async upsertLeagueMapping(
    input: UpsertExternalLeagueMappingInput,
  ): Promise<ExternalLeagueMappingGql> {
    const league = await this.prisma.league.findUnique({
      where: { id: input.leagueId },
      select: { id: true },
    });
    if (!league) throw new NotFoundException('League not found');

    const externalTournamentId = String(input.externalTournamentId).trim();
    if (!externalTournamentId) {
      throw new BadRequestException('externalTournamentId is required');
    }

    try {
      const row = await this.prisma.externalLeagueMapping.upsert({
        where: {
          provider_leagueId: {
            provider: this.provider,
            leagueId: league.id,
          },
        },
        create: {
          provider: this.provider,
          leagueId: league.id,
          externalTournamentId,
          externalName: input.externalName?.trim() || null,
        },
        update: {
          externalTournamentId,
          externalName: input.externalName?.trim() || null,
        },
      });
      return this.mapLeague(row);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(
          'This OddsPapi tournament is already mapped to another league',
        );
      }
      throw e;
    }
  }

  async leagueMappings(leagueId: string): Promise<ExternalLeagueMappingGql[]> {
    const rows = await this.prisma.externalLeagueMapping.findMany({
      where: { leagueId, provider: this.provider },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.mapLeague(r));
  }

  async deleteLeagueMapping(id: string): Promise<boolean> {
    try {
      await this.prisma.externalLeagueMapping.delete({ where: { id } });
      return true;
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException('Mapping not found');
      throw e;
    }
  }

  // ─── Team mapping ─────────────────────────────────────────────────

  async upsertTeamMapping(
    input: UpsertExternalTeamMappingInput,
  ): Promise<ExternalTeamMappingGql> {
    const team = await this.prisma.team.findUnique({
      where: { id: input.teamId },
      select: { id: true, seasonId: true, name: true },
    });
    if (!team) throw new NotFoundException('Team not found');
    if (team.seasonId !== input.seasonId) {
      throw new BadRequestException('teamId does not belong to seasonId');
    }

    const externalParticipantId = String(input.externalParticipantId).trim();
    if (!externalParticipantId) {
      throw new BadRequestException('externalParticipantId is required');
    }

    try {
      const row = await this.prisma.externalTeamMapping.upsert({
        where: {
          provider_teamId: {
            provider: this.provider,
            teamId: team.id,
          },
        },
        create: {
          provider: this.provider,
          seasonId: input.seasonId,
          teamId: team.id,
          externalParticipantId,
          externalName: input.externalName?.trim() || null,
        },
        update: {
          externalParticipantId,
          externalName: input.externalName?.trim() || null,
          seasonId: input.seasonId,
        },
        include: { team: true },
      });
      return this.mapTeam(row);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(
          'This OddsPapi participant is already mapped to another team in this season',
        );
      }
      throw e;
    }
  }

  async teamMappings(seasonId: string): Promise<ExternalTeamMappingGql[]> {
    const rows = await this.prisma.externalTeamMapping.findMany({
      where: { seasonId, provider: this.provider },
      include: { team: true },
      orderBy: { team: { name: 'asc' } },
    });
    return rows.map((r) => this.mapTeam(r));
  }

  async deleteTeamMapping(id: string): Promise<boolean> {
    try {
      await this.prisma.externalTeamMapping.delete({ where: { id } });
      return true;
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException('Mapping not found');
      throw e;
    }
  }

  // ─── OddsPapi browse / import ─────────────────────────────────────

  async listTournaments(sportKey: SportKey): Promise<OddsPapiTournamentGql[]> {
    const sportId = getOddsPapiSportConfig(sportKey).oddsPapiSportId;
    const rows = await this.client.getTournaments(sportId);
    return rows.map((t) => ({
      tournamentId: t.tournamentId,
      tournamentSlug: t.tournamentSlug,
      tournamentName: t.tournamentName,
      categorySlug: t.categorySlug,
      categoryName: t.categoryName,
    }));
  }

  async previewFixtures(
    input: ImportOddsPapiFixturesInput,
  ): Promise<OddsPapiFixturePreviewGql[]> {
    const ctx = await this.loadImportContext(input.seasonId);
    const fixtures = await this.fetchFinishedFixtures(
      ctx.externalTournamentId,
      input.from,
      input.to,
      input.statusId,
    );

    return fixtures.map((f) => {
      const home = ctx.teamByParticipant.get(String(f.participant1Id));
      const away = ctx.teamByParticipant.get(String(f.participant2Id));
      return {
        fixtureId: f.fixtureId,
        participant1Id: f.participant1Id,
        participant2Id: f.participant2Id,
        participant1Name: f.participant1Name,
        participant2Name: f.participant2Name,
        startTime: f.startTime,
        statusId: f.statusId,
        hasOdds: f.hasOdds,
        homeMapped: !!home,
        awayMapped: !!away,
        homeTeamId: home?.teamId ?? null,
        awayTeamId: away?.teamId ?? null,
      };
    });
  }

  /**
   * Create internal Teams + ExternalTeamMapping from OddsPapi participants
   * discovered in the finished-fixture window (same discovery as preview).
   * Safe for empty seasons and interrupted OddsPapi onboarding; blocked when
   * the season already has internal teams that are not OddsPapi-mapped.
   */
  async createAndMapTeams(
    input: CreateAndMapOddsPapiTeamsInput,
  ): Promise<OddsPapiCreateAndMapTeamsResultGql> {
    const ctx = await this.loadImportContext(input.seasonId);

    const existingTeams = await this.prisma.team.findMany({
      where: { seasonId: input.seasonId },
      select: { id: true },
    });
    const mappedTeamIds = new Set(
      [...ctx.teamByParticipant.values()].map((m) => m.teamId),
    );
    const hasUnmappedInternalTeams = existingTeams.some(
      (t) => !mappedTeamIds.has(t.id),
    );
    if (existingTeams.length > 0 && hasUnmappedInternalTeams) {
      throw new BadRequestException(
        'Season already has internal teams without OddsPapi mappings. Use manual team mapping instead of bulk create.',
      );
    }

    const fixtures = await this.fetchFinishedFixtures(
      ctx.externalTournamentId,
      input.from,
      input.to,
      input.statusId,
    );
    const participants = uniqueParticipantsFromFixtures(fixtures);

    let teamsCreated = 0;
    let mappingsCreated = 0;
    let alreadyMapped = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const p of participants) {
        if (ctx.teamByParticipant.has(p.externalParticipantId)) {
          alreadyMapped += 1;
          continue;
        }

        const name = this.cleanTeamName(p.externalName);
        if (!name) {
          throw new BadRequestException(
            `OddsPapi participant ${p.externalParticipantId} has an empty name`,
          );
        }

        const team = await tx.team.create({
          data: {
            seasonId: input.seasonId,
            name,
            aliases: [],
          },
        });
        teamsCreated += 1;

        await tx.externalTeamMapping.create({
          data: {
            provider: this.provider,
            seasonId: input.seasonId,
            teamId: team.id,
            externalParticipantId: p.externalParticipantId,
            externalName: p.externalName || null,
          },
        });
        mappingsCreated += 1;

        // Keep in-memory set so duplicate participant rows in the same batch stay unique.
        ctx.teamByParticipant.set(p.externalParticipantId, { teamId: team.id });
      }
    });

    return {
      participantsFound: participants.length,
      teamsCreated,
      mappingsCreated,
      alreadyMapped,
      failed: 0,
    };
  }

  async importFixtures(
    input: ImportOddsPapiFixturesInput,
  ): Promise<OddsPapiImportResultGql> {
    const ctx = await this.loadImportContext(input.seasonId);
    const sportCfg = getOddsPapiSportConfig(ctx.sportKey);
    const fixtures = await this.fetchFinishedFixtures(
      ctx.externalTournamentId,
      input.from,
      input.to,
      input.statusId,
    );

    const existing = await this.prisma.match.findMany({
      where: {
        source: this.provider,
        externalFixtureId: { in: fixtures.map((f) => f.fixtureId) },
      },
      select: { externalFixtureId: true },
    });
    const already = new Set(
      existing.map((m) => m.externalFixtureId).filter((id): id is string => !!id),
    );

    // One catalog fetch for the whole import (cached thereafter).
    const totalsMarkets = listMatchTotalsMarkets(
      await this.client.getMarkets(sportCfg.oddsPapiSportId),
      sportCfg.oddsPapiSportId,
    );

    const result: OddsPapiImportResultGql = {
      fixturesFound: fixtures.length,
      imported: 0,
      alreadyImported: 0,
      unmapped: 0,
      missingOdds: 0,
      failed: 0,
      importedWithoutTotal: 0,
      scanned: fixtures.length,
      created: 0,
      updated: 0,
      skipped: 0,
      matches: [],
      skips: [],
    };

    const pushSkip = (
      fixtureId: string,
      reason: string,
      names?: { p1?: string; p2?: string },
    ) => {
      result.skips.push({
        fixtureId,
        reason,
        participant1Name: names?.p1 ?? null,
        participant2Name: names?.p2 ?? null,
      } satisfies OddsPapiImportSkipGql);
      result.skipped += 1;
    };

    this.logger.log(
      `OddsPapi import season=${input.seasonId}: ${fixtures.length} finished fixture(s)`,
    );

    let oddsFetchIndex = 0;
    for (const f of fixtures) {
      const names = { p1: f.participant1Name, p2: f.participant2Name };

      if (already.has(f.fixtureId)) {
        result.alreadyImported += 1;
        continue;
      }

      const home = ctx.teamByParticipant.get(String(f.participant1Id));
      const away = ctx.teamByParticipant.get(String(f.participant2Id));
      if (!home || !away) {
        result.unmapped += 1;
        pushSkip(
          f.fixtureId,
          !home && !away
            ? `UNMAPPED_PARTICIPANTS:${f.participant1Id},${f.participant2Id}`
            : !home
              ? `UNMAPPED_HOME:${f.participant1Id}`
              : `UNMAPPED_AWAY:${f.participant2Id}`,
          names,
        );
        continue;
      }

      oddsFetchIndex += 1;
      this.logger.log(
        `OddsPapi import historical-odds ${oddsFetchIndex}: ${f.participant1Name} vs ${f.participant2Name} (${f.fixtureId})`,
      );

      let hist;
      try {
        hist = await this.client.getHistoricalOdds(
          f.fixtureId,
          ODDSPAPI_BOOKMAKER_PINNACLE,
        );
      } catch (e: any) {
        // Expected: OddsPapi has no historical board for this fixture.
        if (e instanceof OddsPapiHistoricalOddsNotFoundError) {
          result.missingOdds += 1;
          pushSkip(f.fixtureId, 'MISSING_PINNACLE_1X2', names);
          continue;
        }
        result.failed += 1;
        pushSkip(f.fixtureId, `HISTORICAL_ODDS_ERROR:${e?.message ?? 'unknown'}`, names);
        continue;
      }

      const cutoff = closingCutoffIso(f.trueStartTime, f.startTime);
      const closing = extractPinnacleClosingOneXTwo(hist, cutoff, sportCfg.oneXTwo);
      if (!closing) {
        result.missingOdds += 1;
        pushSkip(f.fixtureId, 'MISSING_PINNACLE_1X2', names);
        continue;
      }

      const totalCandidate = selectMainTotalLine(totalsMarkets, hist, cutoff);
      const total = totalCandidate?.line ?? null;

      try {
        const { match, created } = await this.matches.upsertImportedMatch({
          seasonId: input.seasonId,
          date: cutoff,
          homeTeamId: home.teamId,
          awayTeamId: away.teamId,
          kHome: closing.kHome,
          kDraw: closing.kDraw,
          kAway: closing.kAway,
          total,
          source: ExternalDataProvider.ODDSPAPI,
          externalFixtureId: f.fixtureId,
        });

        if (created) {
          result.imported += 1;
          result.created += 1;
          if (total == null) result.importedWithoutTotal += 1;
          already.add(f.fixtureId);
        } else {
          // Should be rare because we pre-skip; still count as alreadyImported.
          result.alreadyImported += 1;
        }
        result.matches.push(match);
      } catch (e: any) {
        result.failed += 1;
        pushSkip(f.fixtureId, `PERSIST_ERROR:${e?.message ?? 'unknown'}`, names);
      }
    }

    this.logger.log(
      `OddsPapi import done season=${input.seasonId}: found=${result.fixturesFound} imported=${result.imported} already=${result.alreadyImported} missingOdds=${result.missingOdds} unmapped=${result.unmapped} failed=${result.failed}`,
    );

    return result;
  }

  // ─── helpers ──────────────────────────────────────────────────────

  private cleanTeamName(s: string): string {
    return s.trim().replace(/\s+/g, ' ');
  }

  private async loadImportContext(seasonId: string) {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        league: { include: { sport: true } },
      },
    });
    if (!season) throw new NotFoundException('Season not found');

    const leagueMap = await this.prisma.externalLeagueMapping.findUnique({
      where: {
        provider_leagueId: {
          provider: this.provider,
          leagueId: season.leagueId,
        },
      },
    });
    if (!leagueMap) {
      throw new BadRequestException(
        'League is not mapped to an OddsPapi tournament. Create ExternalLeagueMapping first.',
      );
    }

    const teamMaps = await this.prisma.externalTeamMapping.findMany({
      where: { seasonId, provider: this.provider },
      select: { externalParticipantId: true, teamId: true },
    });
    const teamByParticipant = new Map<string, { teamId: string }>(
      teamMaps.map((m) => [m.externalParticipantId, { teamId: m.teamId }]),
    );

    return {
      season,
      sportKey: season.league.sport.key as SportKey,
      externalTournamentId: Number(leagueMap.externalTournamentId),
      teamByParticipant,
    };
  }

  private async fetchFinishedFixtures(
    tournamentId: number,
    from: string,
    to: string,
    statusId?: number,
  ) {
    if (!isFinite(tournamentId)) {
      throw new BadRequestException('Invalid externalTournamentId mapping');
    }
    return this.client.getFixtures({
      tournamentId,
      from,
      to,
      statusId: statusId ?? ODDSPAPI_STATUS_FINISHED,
    });
  }

  private mapLeague(row: any): ExternalLeagueMappingGql {
    return {
      id: row.id,
      provider: row.provider as ExternalDataProviderGql,
      externalTournamentId: row.externalTournamentId,
      externalName: row.externalName,
      leagueId: row.leagueId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapTeam(row: any): ExternalTeamMappingGql {
    return {
      id: row.id,
      provider: row.provider as ExternalDataProviderGql,
      externalParticipantId: row.externalParticipantId,
      externalName: row.externalName,
      seasonId: row.seasonId,
      teamId: row.teamId,
      teamName: row.team.name,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
