import { gqlClient } from "@/shared/api/graphqlClient";
import { Team } from "./types";

export const teamsQuery = async (seasonId: string): Promise<Team[]> => {
    const query = /* GraphQL */ `
    query Teams($seasonId: ID!) {
      teams(seasonId: $seasonId) {
        id
        seasonId
        seasonName
        name
        aliases
        createdAt
        updatedAt
      }
    }
  `;
    const res = await gqlClient().request<{ teams: Team[] }>(query, { seasonId });
    return res.teams;
};

export const teamQuery = async (id: string): Promise<Team> => {
    const query = /* GraphQL */ `
    query Team($id: ID!) {
      team(id: $id) {
        id
        seasonId
        seasonName
        name
        aliases
        createdAt
        updatedAt
      }
    }
  `;
    const res = await gqlClient().request<{ team: Team }>(query, { id });
    return res.team;
};

export const findTeamQuery = async (seasonId: string, query: string): Promise<Team | null> => {
    const gqlQuery = /* GraphQL */ `
    query FindTeam($seasonId: ID!, $query: String!) {
      findTeam(seasonId: $seasonId, query: $query) {
        id
        seasonId
        seasonName
        name
        aliases
        createdAt
        updatedAt
      }
    }
  `;
    const res = await gqlClient().request<{ findTeam: Team | null }>(gqlQuery, { seasonId, query });
    return res.findTeam;
};

export const createTeamMutation = async (input: {
    seasonId: string;
    name: string;
    aliases?: string[];
}): Promise<Team> => {
    const query = /* GraphQL */ `
    mutation CreateTeam($input: CreateTeamInput!) {
      createTeam(input: $input) {
        id
        seasonId
        seasonName
        name
        aliases
        createdAt
        updatedAt
      }
    }
  `;
    const res = await gqlClient().request<{ createTeam: Team }>(query, { input });
    return res.createTeam;
};

export const updateTeamMutation = async (input: {
    id: string;
    name?: string;
    aliases?: string[];
}): Promise<Team> => {
    const query = /* GraphQL */ `
    mutation UpdateTeam($input: UpdateTeamInput!) {
      updateTeam(input: $input) {
        id
        seasonId
        seasonName
        name
        aliases
        createdAt
        updatedAt
      }
    }
  `;
    const res = await gqlClient().request<{ updateTeam: Team }>(query, { input });
    return res.updateTeam;
};

export const deleteTeamMutation = async (id: string): Promise<boolean> => {
    const query = /* GraphQL */ `
    mutation DeleteTeam($id: ID!) {
      deleteTeam(id: $id)
    }
  `;
    const res = await gqlClient().request<{ deleteTeam: boolean }>(query, { id });
    return res.deleteTeam;
};
