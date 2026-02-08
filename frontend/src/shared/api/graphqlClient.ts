import { GraphQLClient } from "graphql-request";
import { getAccessToken } from "./authHeaders";

export const gqlClient = () => {
    const token = getAccessToken();
    return new GraphQLClient(process.env.NEXT_PUBLIC_API_URL!, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
};
