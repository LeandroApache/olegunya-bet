import { Sport } from "./types";
import { gqlClient } from "@/shared/api/graphqlClient";

export const sportsQuery = async (): Promise<Sport[]> => {
    const query = /* GraphQL */ `
      query Sports {
        sports {
          id
          key
          name
        }
      }
    `;
    const res = await gqlClient().request<{ sports: Sport[] }>(query);
    return res.sports;
};