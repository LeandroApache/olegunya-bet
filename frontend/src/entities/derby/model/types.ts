export type DerbyType = 'DERBY';

export type SeasonDerbyMatch = {
    id: string;
    seasonId: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeamName: string;
    awayTeamName: string;
    type: DerbyType;
};

