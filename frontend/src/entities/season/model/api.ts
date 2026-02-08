import { gqlClient } from "@/shared/api/graphqlClient";
import { Season } from "./types";

export const seasonsQuery = async (leagueId: string): Promise<Season[]> => {
    const query = /* GraphQL */ `
    query Seasons($leagueId: ID!) {
      seasons(leagueId: $leagueId) {
        id
        leagueId
        name
        baseCoefHomeEqual
        flipCoef
      }
    }
  `;
    const res = await gqlClient().request<{ seasons: Season[] }>(query, { leagueId });
    return res.seasons;
};

export const createSeasonMutation = async (input: {
    leagueId: string;
    name: string;
    baseCoefHomeEqual: number;
    flipCoef: number;
}): Promise<Season> => {
    const query = /* GraphQL */ `
    mutation CreateSeason($input: CreateSeasonInput!) {
      createSeason(input: $input) {
        id
        leagueId
        name
        baseCoefHomeEqual
        flipCoef
      }
    }
  `;
    const res = await gqlClient().request<{ createSeason: Season }>(query, { input });
    return res.createSeason;
};
