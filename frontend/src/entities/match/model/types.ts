export enum MarketType {
    MATCH_1X2_REGULAR_TIME = 'MATCH_1X2_REGULAR_TIME',
}

export type MatchComputed = {
    baseProbUsed: number;
    pHomeImplied: number;
    pDrawImplied: number;
    pAwayImplied: number;
    deltaHome: number;
    deltaAway: number;
};

export type Match = {
    id: string;
    seasonId: string;
    tourId?: string | null;
    date: string;
    marketType: MarketType;
    homeTeamId: string;
    awayTeamId: string;
    homeTeamName: string;
    awayTeamName: string;
    kHome: number;
    kDraw: number;
    kAway: number;
    total?: number | null;
    computed?: MatchComputed | null;
    createdAt: string;
    updatedAt: string;
};

export type MatchesPage = {
    matches: Match[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
};
