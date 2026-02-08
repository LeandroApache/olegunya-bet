export enum SportKey {
    FOOTBALL = 'FOOTBALL',
    HOCKEY = 'HOCKEY',
}

export interface Sport {
    id: string;
    key: SportKey;
    name: string;
}