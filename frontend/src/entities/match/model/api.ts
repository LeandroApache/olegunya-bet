import { gqlClient } from "@/shared/api/graphqlClient";
import { Match, MarketType, MatchesPage } from "./types";

export const matchesQuery = async (seasonId: string): Promise<Match[]> => {
    const query = /* GraphQL */ `
    query Matches($seasonId: ID!) {
      matches(seasonId: $seasonId) {
        id
        seasonId
        tourId
        date
        marketType
        homeTeamId
        awayTeamId
        homeTeamName
        awayTeamName
        kHome
        kDraw
        kAway
        total
        computed {
          baseProbUsed
          pHomeImplied
          pDrawImplied
          pAwayImplied
          deltaHome
          deltaAway
        }
        createdAt
        updatedAt
      }
    }
  `;
    const res = await gqlClient().request<{ matches: Match[] }>(query, { seasonId });
    return res.matches;
};

export const matchesPaginatedQuery = async (
    seasonId: string,
    page: number = 1,
    pageSize: number = 20,
): Promise<MatchesPage> => {
    const query = /* GraphQL */ `
    query MatchesPaginated($seasonId: ID!, $page: Int, $pageSize: Int) {
      matchesPaginated(seasonId: $seasonId, page: $page, pageSize: $pageSize) {
        matches {
          id
          seasonId
          tourId
          date
          marketType
          homeTeamId
          awayTeamId
          homeTeamName
          awayTeamName
          kHome
          kDraw
          kAway
          total
          computed {
            baseProbUsed
            pHomeImplied
            pDrawImplied
            pAwayImplied
            deltaHome
            deltaAway
          }
          createdAt
          updatedAt
        }
        totalCount
        page
        pageSize
        totalPages
      }
    }
  `;
    const res = await gqlClient().request<{ matchesPaginated: MatchesPage }>(query, {
        seasonId,
        page,
        pageSize,
    });
    return res.matchesPaginated;
};

export const matchQuery = async (id: string): Promise<Match> => {
    const query = /* GraphQL */ `
    query Match($id: ID!) {
      match(id: $id) {
        id
        seasonId
        tourId
        date
        marketType
        homeTeamId
        awayTeamId
        homeTeamName
        awayTeamName
        kHome
        kDraw
        kAway
        total
        computed {
          baseProbUsed
          pHomeImplied
          pDrawImplied
          pAwayImplied
          deltaHome
          deltaAway
        }
        createdAt
        updatedAt
      }
    }
  `;
    const res = await gqlClient().request<{ match: Match }>(query, { id });
    return res.match;
};

export const createMatchMutation = async (input: {
    seasonId: string;
    tourId?: string;
    date: string;
    marketType?: MarketType;
    homeTeamId: string;
    awayTeamId: string;
    kHome: number;
    kDraw: number;
    kAway: number;
    total?: number;
}): Promise<Match> => {
    const query = /* GraphQL */ `
    mutation CreateMatch($input: CreateMatchInput!) {
      createMatch(input: $input) {
        id
        seasonId
        tourId
        date
        marketType
        homeTeamId
        awayTeamId
        homeTeamName
        awayTeamName
        kHome
        kDraw
        kAway
        total
        computed {
          baseProbUsed
          pHomeImplied
          pDrawImplied
          pAwayImplied
          deltaHome
          deltaAway
        }
        createdAt
        updatedAt
      }
    }
  `;
    const res = await gqlClient().request<{ createMatch: Match }>(query, { input });
    return res.createMatch;
};

export const updateMatchMutation = async (input: {
    id: string;
    tourId?: string | null;
    date?: string;
    homeTeamId?: string;
    awayTeamId?: string;
    kHome?: number;
    kDraw?: number;
    kAway?: number;
    total?: number | null;
}): Promise<Match> => {
    const query = /* GraphQL */ `
    mutation UpdateMatch($input: UpdateMatchInput!) {
      updateMatch(input: $input) {
        id
        seasonId
        tourId
        date
        marketType
        homeTeamId
        awayTeamId
        homeTeamName
        awayTeamName
        kHome
        kDraw
        kAway
        total
        computed {
          baseProbUsed
          pHomeImplied
          pDrawImplied
          pAwayImplied
          deltaHome
          deltaAway
        }
        createdAt
        updatedAt
      }
    }
  `;
    const res = await gqlClient().request<{ updateMatch: Match }>(query, { input });
    return res.updateMatch;
};

export const deleteMatchMutation = async (id: string): Promise<boolean> => {
    const query = /* GraphQL */ `
    mutation DeleteMatch($id: ID!) {
      deleteMatch(id: $id)
    }
  `;
    const res = await gqlClient().request<{ deleteMatch: boolean }>(query, { id });
    return res.deleteMatch;
};
