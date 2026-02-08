import { gqlClient } from "@/shared/api/graphqlClient";
import { OddsFromStrength, StrengthSnapshot } from "./types";

export const strengthSnapshotQuery = async (id: string): Promise<StrengthSnapshot> => {
    const query = /* GraphQL */ `
    query StrengthSnapshot($id: ID!) {
      strengthSnapshot(id: $id) {
        id
        seasonId
        fromDate
        toDate
        weightMode
        halfLifeDays
        createdAt
        values {
          teamId
          teamName
          strength
        }
      }
    }
  `;
    const res = await gqlClient().request<{ strengthSnapshot: StrengthSnapshot }>(query, { id });
    return res.strengthSnapshot;
};

export const createStrengthSnapshotMutation = async (input: {
    seasonId: string;
    fromDate?: string;
    toDate?: string;
    halfLifeDays?: number;
}): Promise<StrengthSnapshot> => {
    const query = /* GraphQL */ `
    mutation CreateStrengthSnapshot($input: CreateStrengthSnapshotInput!) {
      createStrengthSnapshot(input: $input) {
        id
        seasonId
        fromDate
        toDate
        weightMode
        halfLifeDays
        createdAt
        values {
          teamId
          teamName
          strength
        }
      }
    }
  `;
    const res = await gqlClient().request<{ createStrengthSnapshot: StrengthSnapshot }>(query, { input });
    return res.createStrengthSnapshot;
};

export const calculateOddsFromStrengthQuery = async (input: {
    snapshotId: string;
    homeTeamId: string;
    awayTeamId: string;
}): Promise<OddsFromStrength> => {
    const query = /* GraphQL */ `
    query CalculateOddsFromStrength($input: CalculateOddsFromStrengthInput!) {
      calculateOddsFromStrength(input: $input) {
        coefficient
        teamName
        isHomeTeam
        delta
        impliedProbability
      }
    }
  `;
    const res = await gqlClient().request<{ calculateOddsFromStrength: OddsFromStrength }>(query, { input });
    return res.calculateOddsFromStrength;
};
