import { gqlClient } from "@/shared/api/graphqlClient";
import type { SportKey } from "@/entities/sport/model/types";
import { League } from "./types";


export const leaguesQuery = async (sportKey?: SportKey): Promise<League[]> => {
    const query = /* GraphQL */ `
    query Leagues($sportKey: SportKey) {
      leagues(sportKey: $sportKey) {
        id
        name
        country
        sportKey
      }
    }
  `;
    const res = await gqlClient().request<{ leagues: League[] }>(query, { sportKey });
    return res.leagues;
};

export const leagueQuery = async (id: string): Promise<League> => {
    const query = /* GraphQL */ `
    query League($id: ID!) {
      league(id: $id) {
        id
        name
        country
        sportKey
      }
    }
  `;
    const res = await gqlClient().request<{ league: League }>(query, { id });
    return res.league;
};

export const createLeagueMutation = async (input: {
    sportKey: SportKey;
    name: string;
    country?: string | null;
}): Promise<League> => {
    const query = /* GraphQL */ `
    mutation CreateLeague($input: CreateLeagueInput!) {
      createLeague(input: $input) {
        id
        name
        country
        sportKey
      }
    }
  `;
    const res = await gqlClient().request<{ createLeague: League }>(query, { input });
    return res.createLeague;
};

export const deleteLeagueMutation = async (id: string): Promise<boolean> => {
    const query = /* GraphQL */ `
    mutation DeleteLeague($id: ID!) {
      deleteLeague(id: $id)
    }
  `;
    const res = await gqlClient().request<{ deleteLeague: boolean }>(query, { id });
    return res.deleteLeague;
};
