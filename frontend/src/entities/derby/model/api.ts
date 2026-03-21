import { gqlClient } from "@/shared/api/graphqlClient";
import { SeasonDerbyMatch } from "./types";

export const seasonDerbyMatchesQuery = async (seasonId: string): Promise<SeasonDerbyMatch[]> => {
    const query = /* GraphQL */ `
    query SeasonDerbyMatches($seasonId: ID!) {
      seasonDerbyMatches(seasonId: $seasonId) {
        id
        seasonId
        homeTeamId
        awayTeamId
        homeTeamName
        awayTeamName
        type
      }
    }
  `;
    const res = await gqlClient().request<{ seasonDerbyMatches: SeasonDerbyMatch[] }>(query, { seasonId });
    return res.seasonDerbyMatches;
};

export const createSeasonDerbyMatchMutation = async (input: {
    seasonId: string;
    homeTeamId: string;
    awayTeamId: string;
    type: 'DERBY';
}): Promise<SeasonDerbyMatch> => {
    const query = /* GraphQL */ `
    mutation CreateSeasonDerbyMatch($input: CreateSeasonDerbyMatchInput!) {
      createSeasonDerbyMatch(input: $input) {
        id
        seasonId
        homeTeamId
        awayTeamId
        homeTeamName
        awayTeamName
        type
      }
    }
  `;
    const res = await gqlClient().request<{ createSeasonDerbyMatch: SeasonDerbyMatch }>(query, { input });
    return res.createSeasonDerbyMatch;
};

export const deleteSeasonDerbyMatchMutation = async (id: string): Promise<boolean> => {
    const query = /* GraphQL */ `
    mutation DeleteSeasonDerbyMatch($id: ID!) {
      deleteSeasonDerbyMatch(id: $id)
    }
  `;
    const res = await gqlClient().request<{ deleteSeasonDerbyMatch: boolean }>(query, { id });
    return res.deleteSeasonDerbyMatch;
};

