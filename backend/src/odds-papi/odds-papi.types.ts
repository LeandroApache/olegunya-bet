/** OddsPapi v4 shared types + base URL. */

export const ODDSPAPI_BASE_URL = 'https://api.oddspapi.io/v4';

export type OddsPapiTournament = {
  tournamentId: number;
  tournamentSlug: string;
  tournamentName: string;
  categorySlug: string;
  categoryName: string;
  futureFixtures?: number;
  upcomingFixtures?: number;
  liveFixtures?: number;
};

export type OddsPapiFixture = {
  fixtureId: string;
  participant1Id: number;
  participant2Id: number;
  sportId: number;
  tournamentId: number;
  seasonId?: number | null;
  statusId: number;
  hasOdds: boolean;
  startTime: string;
  trueStartTime?: string | null;
  trueEndTime?: string | null;
  statusName?: string;
  participant1Name: string;
  participant2Name: string;
  tournamentName?: string;
  categoryName?: string;
};

export type OddsPapiOddsSnapshot = {
  createdAt: string;
  price: number;
  limit?: number | null;
  active?: boolean;
};

export type OddsPapiHistoricalOddsResponse = {
  fixtureId: string;
  bookmakers: Record<
    string,
    {
      markets: Record<
        string,
        {
          outcomes: Record<
            string,
            {
              players: Record<string, OddsPapiOddsSnapshot[]>;
            }
          >;
        }
      >;
    }
  >;
};

export type OddsPapiMarketDefinition = {
  marketId: number;
  marketLength: number;
  marketName: string;
  playerProp: boolean;
  sportId: number;
  handicap: number;
  period: string;
  marketType: string;
  outcomes: Array<{ outcomeId: number; outcomeName: string }>;
};

export type ClosingOneXTwo = {
  kHome: number;
  kDraw: number;
  kAway: number;
};

export type TotalLineCandidate = {
  marketId: string;
  line: number;
  overOdds: number;
  underOdds: number;
  distanceFromEven: number;
};
