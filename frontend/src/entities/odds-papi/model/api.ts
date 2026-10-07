import { gqlClient } from "@/shared/api/graphqlClient";
import type { SportKey } from "@/entities/sport/model/types";
import type {
    ExternalLeagueMapping,
    ExternalTeamMapping,
    CreateAndMapOddsPapiTeamsInput,
    ImportOddsPapiFixturesInput,
    OddsPapiCreateAndMapTeamsResult,
    OddsPapiFixturePreview,
    OddsPapiImportResult,
    OddsPapiTournament,
    UpsertExternalLeagueMappingInput,
    UpsertExternalTeamMappingInput,
} from "./types";

export const externalLeagueMappingsQuery = async (
    leagueId: string,
): Promise<ExternalLeagueMapping[]> => {
    const query = /* GraphQL */ `
    query ExternalLeagueMappings($leagueId: ID!) {
      externalLeagueMappings(leagueId: $leagueId) {
        id
        provider
        externalTournamentId
        externalName
        leagueId
        createdAt
        updatedAt
      }
    }
  `;
    const res = await gqlClient().request<{
        externalLeagueMappings: ExternalLeagueMapping[];
    }>(query, { leagueId });
    return res.externalLeagueMappings;
};

export const externalTeamMappingsQuery = async (
    seasonId: string,
): Promise<ExternalTeamMapping[]> => {
    const query = /* GraphQL */ `
    query ExternalTeamMappings($seasonId: ID!) {
      externalTeamMappings(seasonId: $seasonId) {
        id
        provider
        externalParticipantId
        externalName
        seasonId
        teamId
        teamName
        createdAt
        updatedAt
      }
    }
  `;
    const res = await gqlClient().request<{
        externalTeamMappings: ExternalTeamMapping[];
    }>(query, { seasonId });
    return res.externalTeamMappings;
};

export const oddsPapiTournamentsQuery = async (
    sportKey: SportKey,
): Promise<OddsPapiTournament[]> => {
    const query = /* GraphQL */ `
    query OddsPapiTournaments($sportKey: SportKey!) {
      oddsPapiTournaments(sportKey: $sportKey) {
        tournamentId
        tournamentSlug
        tournamentName
        categorySlug
        categoryName
      }
    }
  `;
    const res = await gqlClient().request<{
        oddsPapiTournaments: OddsPapiTournament[];
    }>(query, { sportKey });
    return res.oddsPapiTournaments;
};

export const previewOddsPapiFixturesQuery = async (
    input: ImportOddsPapiFixturesInput,
): Promise<OddsPapiFixturePreview[]> => {
    const query = /* GraphQL */ `
    query PreviewOddsPapiFixtures($input: ImportOddsPapiFixturesInput!) {
      previewOddsPapiFixtures(input: $input) {
        fixtureId
        participant1Id
        participant2Id
        participant1Name
        participant2Name
        startTime
        statusId
        hasOdds
        homeMapped
        awayMapped
        homeTeamId
        awayTeamId
      }
    }
  `;
    const res = await gqlClient().request<{
        previewOddsPapiFixtures: OddsPapiFixturePreview[];
    }>(query, { input });
    return res.previewOddsPapiFixtures;
};

export const upsertExternalLeagueMappingMutation = async (
    input: UpsertExternalLeagueMappingInput,
): Promise<ExternalLeagueMapping> => {
    const query = /* GraphQL */ `
    mutation UpsertExternalLeagueMapping($input: UpsertExternalLeagueMappingInput!) {
      upsertExternalLeagueMapping(input: $input) {
        id
        provider
        externalTournamentId
        externalName
        leagueId
        createdAt
        updatedAt
      }
    }
  `;
    const res = await gqlClient().request<{
        upsertExternalLeagueMapping: ExternalLeagueMapping;
    }>(query, { input });
    return res.upsertExternalLeagueMapping;
};

export const deleteExternalLeagueMappingMutation = async (
    id: string,
): Promise<boolean> => {
    const query = /* GraphQL */ `
    mutation DeleteExternalLeagueMapping($id: ID!) {
      deleteExternalLeagueMapping(id: $id)
    }
  `;
    const res = await gqlClient().request<{ deleteExternalLeagueMapping: boolean }>(
        query,
        { id },
    );
    return res.deleteExternalLeagueMapping;
};

export const upsertExternalTeamMappingMutation = async (
    input: UpsertExternalTeamMappingInput,
): Promise<ExternalTeamMapping> => {
    const query = /* GraphQL */ `
    mutation UpsertExternalTeamMapping($input: UpsertExternalTeamMappingInput!) {
      upsertExternalTeamMapping(input: $input) {
        id
        provider
        externalParticipantId
        externalName
        seasonId
        teamId
        teamName
        createdAt
        updatedAt
      }
    }
  `;
    const res = await gqlClient().request<{
        upsertExternalTeamMapping: ExternalTeamMapping;
    }>(query, { input });
    return res.upsertExternalTeamMapping;
};

export const deleteExternalTeamMappingMutation = async (
    id: string,
): Promise<boolean> => {
    const query = /* GraphQL */ `
    mutation DeleteExternalTeamMapping($id: ID!) {
      deleteExternalTeamMapping(id: $id)
    }
  `;
    const res = await gqlClient().request<{ deleteExternalTeamMapping: boolean }>(
        query,
        { id },
    );
    return res.deleteExternalTeamMapping;
};

export const createAndMapOddsPapiTeamsMutation = async (
    input: CreateAndMapOddsPapiTeamsInput,
): Promise<OddsPapiCreateAndMapTeamsResult> => {
    const query = /* GraphQL */ `
    mutation CreateAndMapOddsPapiTeams($input: CreateAndMapOddsPapiTeamsInput!) {
      createAndMapOddsPapiTeams(input: $input) {
        participantsFound
        teamsCreated
        mappingsCreated
        alreadyMapped
        failed
      }
    }
  `;
    const res = await gqlClient().request<{
        createAndMapOddsPapiTeams: OddsPapiCreateAndMapTeamsResult;
    }>(query, { input });
    return res.createAndMapOddsPapiTeams;
};

export const importOddsPapiFixturesMutation = async (
    input: ImportOddsPapiFixturesInput,
): Promise<OddsPapiImportResult> => {
    const query = /* GraphQL */ `
    mutation ImportOddsPapiFixtures($input: ImportOddsPapiFixturesInput!) {
      importOddsPapiFixtures(input: $input) {
        fixturesFound
        imported
        alreadyImported
        unmapped
        missingOdds
        failed
        importedWithoutTotal
        scanned
        created
        updated
        skipped
        skips {
          fixtureId
          reason
          participant1Name
          participant2Name
        }
      }
    }
  `;
    const res = await gqlClient().request<{
        importOddsPapiFixtures: OddsPapiImportResult;
    }>(query, { input });
    return res.importOddsPapiFixtures;
};
