import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsDateString, IsOptional, IsString, Min } from 'class-validator';
import { ExternalDataProviderGql } from '../../match/dto/match.types';
import { MatchGql } from '../../match/dto/match.types';

@InputType()
export class UpsertExternalLeagueMappingInput {
  @Field(() => ID)
  leagueId: string;

  @Field()
  @IsString()
  externalTournamentId: string;

  @Field({ nullable: true })
  @IsOptional()
  externalName?: string;
}

@InputType()
export class UpsertExternalTeamMappingInput {
  @Field(() => ID)
  seasonId: string;

  @Field(() => ID)
  teamId: string;

  @Field()
  @IsString()
  externalParticipantId: string;

  @Field({ nullable: true })
  @IsOptional()
  externalName?: string;
}

@InputType()
export class ImportOddsPapiFixturesInput {
  @Field(() => ID)
  seasonId: string;

  @Field()
  @IsDateString()
  from: string;

  @Field()
  @IsDateString()
  to: string;

  @Field(() => Int, { nullable: true, defaultValue: 2 })
  @IsOptional()
  @Min(0)
  statusId?: number;
}

@ObjectType()
export class ExternalLeagueMappingGql {
  @Field(() => ID)
  id: string;

  @Field(() => ExternalDataProviderGql)
  provider: ExternalDataProviderGql;

  @Field()
  externalTournamentId: string;

  @Field({ nullable: true })
  externalName?: string | null;

  @Field(() => ID)
  leagueId: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class ExternalTeamMappingGql {
  @Field(() => ID)
  id: string;

  @Field(() => ExternalDataProviderGql)
  provider: ExternalDataProviderGql;

  @Field()
  externalParticipantId: string;

  @Field({ nullable: true })
  externalName?: string | null;

  @Field(() => ID)
  seasonId: string;

  @Field(() => ID)
  teamId: string;

  @Field()
  teamName: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class OddsPapiTournamentGql {
  @Field(() => Int)
  tournamentId: number;

  @Field()
  tournamentSlug: string;

  @Field()
  tournamentName: string;

  @Field()
  categorySlug: string;

  @Field()
  categoryName: string;
}

@ObjectType()
export class OddsPapiFixturePreviewGql {
  @Field()
  fixtureId: string;

  @Field(() => Int)
  participant1Id: number;

  @Field(() => Int)
  participant2Id: number;

  @Field()
  participant1Name: string;

  @Field()
  participant2Name: string;

  @Field()
  startTime: string;

  @Field(() => Int)
  statusId: number;

  @Field()
  hasOdds: boolean;

  @Field()
  homeMapped: boolean;

  @Field()
  awayMapped: boolean;

  @Field(() => ID, { nullable: true })
  homeTeamId?: string | null;

  @Field(() => ID, { nullable: true })
  awayTeamId?: string | null;
}

@ObjectType()
export class OddsPapiImportSkipGql {
  @Field()
  fixtureId: string;

  @Field()
  reason: string;

  @Field({ nullable: true })
  participant1Name?: string | null;

  @Field({ nullable: true })
  participant2Name?: string | null;
}

@ObjectType()
export class OddsPapiImportResultGql {
  /** Fixtures returned by OddsPapi for the request window. */
  @Field(() => Int)
  fixturesFound: number;

  /** Newly created Match rows. */
  @Field(() => Int)
  imported: number;

  /** Fixtures already present by (source, externalFixtureId) — skipped without historical-odds call. */
  @Field(() => Int)
  alreadyImported: number;

  /** Missing ExternalTeamMapping for one or both participants. */
  @Field(() => Int)
  unmapped: number;

  /** Could not resolve Pinnacle closing 1X2. */
  @Field(() => Int)
  missingOdds: number;

  /** Other failures (API/persist). */
  @Field(() => Int)
  failed: number;

  /** Imported (created) matches where total remained null. */
  @Field(() => Int)
  importedWithoutTotal: number;

  /** @deprecated alias of fixturesFound */
  @Field(() => Int)
  scanned: number;

  /** @deprecated alias of imported */
  @Field(() => Int)
  created: number;

  /** Always 0 in Phase 1 (idempotent skip, no silent refresh). */
  @Field(() => Int)
  updated: number;

  /** unmapped + missingOdds + failed */
  @Field(() => Int)
  skipped: number;

  @Field(() => [MatchGql])
  matches: MatchGql[];

  @Field(() => [OddsPapiImportSkipGql])
  skips: OddsPapiImportSkipGql[];
}
