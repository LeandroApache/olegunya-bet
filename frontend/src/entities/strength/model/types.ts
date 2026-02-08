export type StrengthValue = {
    teamId: string;
    teamName: string;
    strength: number;
};

export type StrengthSnapshot = {
    id: string;
    seasonId: string;
    fromDate?: string | null;
    toDate?: string | null;
    weightMode: string;
    halfLifeDays?: number | null;
    createdAt: string;
    values: StrengthValue[];
};

export type OddsFromStrength = {
    coefficient: number;
    teamName: string;
    isHomeTeam: boolean;
    delta: number;
    impliedProbability: number;
};
