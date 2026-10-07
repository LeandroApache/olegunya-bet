import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SportKey } from '../../generated/prisma';
import { OddsPapiService } from './odds-papi.service';
import {
  ExternalLeagueMappingGql,
  ExternalTeamMappingGql,
  CreateAndMapOddsPapiTeamsInput,
  ImportOddsPapiFixturesInput,
  OddsPapiCreateAndMapTeamsResultGql,
  OddsPapiFixturePreviewGql,
  OddsPapiImportResultGql,
  OddsPapiTournamentGql,
  UpsertExternalLeagueMappingInput,
  UpsertExternalTeamMappingInput,
} from './dto/odds-papi.dto';

@Resolver()
export class OddsPapiResolver {
  constructor(private readonly service: OddsPapiService) {}

  @Query(() => [ExternalLeagueMappingGql])
  externalLeagueMappings(@Args('leagueId', { type: () => ID }) leagueId: string) {
    return this.service.leagueMappings(leagueId);
  }

  @Query(() => [ExternalTeamMappingGql])
  externalTeamMappings(@Args('seasonId', { type: () => ID }) seasonId: string) {
    return this.service.teamMappings(seasonId);
  }

  @Query(() => [OddsPapiTournamentGql])
  oddsPapiTournaments(
    @Args('sportKey', { type: () => SportKey }) sportKey: SportKey,
  ) {
    return this.service.listTournaments(sportKey);
  }

  @Query(() => [OddsPapiFixturePreviewGql])
  previewOddsPapiFixtures(@Args('input') input: ImportOddsPapiFixturesInput) {
    return this.service.previewFixtures(input);
  }

  @Mutation(() => ExternalLeagueMappingGql)
  upsertExternalLeagueMapping(@Args('input') input: UpsertExternalLeagueMappingInput) {
    return this.service.upsertLeagueMapping(input);
  }

  @Mutation(() => Boolean)
  deleteExternalLeagueMapping(@Args('id', { type: () => ID }) id: string) {
    return this.service.deleteLeagueMapping(id);
  }

  @Mutation(() => ExternalTeamMappingGql)
  upsertExternalTeamMapping(@Args('input') input: UpsertExternalTeamMappingInput) {
    return this.service.upsertTeamMapping(input);
  }

  @Mutation(() => Boolean)
  deleteExternalTeamMapping(@Args('id', { type: () => ID }) id: string) {
    return this.service.deleteTeamMapping(id);
  }

  @Mutation(() => OddsPapiCreateAndMapTeamsResultGql)
  createAndMapOddsPapiTeams(@Args('input') input: CreateAndMapOddsPapiTeamsInput) {
    return this.service.createAndMapTeams(input);
  }

  @Mutation(() => OddsPapiImportResultGql)
  importOddsPapiFixtures(@Args('input') input: ImportOddsPapiFixturesInput) {
    return this.service.importFixtures(input);
  }
}
