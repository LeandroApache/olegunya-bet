export type ExternalDataProvider = "ODDSPAPI";

export type ExternalLeagueMapping = {
    id: string;
    provider: ExternalDataProvider;
    externalTournamentId: string;
    externalName?: string | null;
    leagueId: string;
    createdAt: string;
    updatedAt: string;
};

export type ExternalTeamMapping = {
    id: string;
    provider: ExternalDataProvider;
    externalParticipantId: string;
    externalName?: string | null;
    seasonId: string;
    teamId: string;
    teamName: string;
    createdAt: string;
    updatedAt: string;
};

export type OddsPapiTournament = {
    tournamentId: number;
    tournamentSlug: string;
    tournamentName: string;
    categorySlug: string;
    categoryName: string;
};

export type OddsPapiFixturePreview = {
    fixtureId: string;
    participant1Id: number;
    participant2Id: number;
    participant1Name: string;
    participant2Name: string;
    startTime: string;
    statusId: number;
    hasOdds: boolean;
    homeMapped: boolean;
    awayMapped: boolean;
    homeTeamId?: string | null;
    awayTeamId?: string | null;
};

export type OddsPapiImportSkip = {
    fixtureId: string;
    reason: string;
    participant1Name?: string | null;
    participant2Name?: string | null;
};

export type OddsPapiImportResult = {
    fixturesFound: number;
    imported: number;
    alreadyImported: number;
    unmapped: number;
    missingOdds: number;
    failed: number;
    importedWithoutTotal: number;
    scanned: number;
    created: number;
    updated: number;
    skipped: number;
    skips: OddsPapiImportSkip[];
};

export type ImportOddsPapiFixturesInput = {
    seasonId: string;
    from: string;
    to: string;
    statusId?: number;
};

export type CreateAndMapOddsPapiTeamsInput = {
    seasonId: string;
    from: string;
    to: string;
    statusId?: number;
};

export type OddsPapiCreateAndMapTeamsResult = {
    participantsFound: number;
    teamsCreated: number;
    mappingsCreated: number;
    alreadyMapped: number;
    failed: number;
};

export type UpsertExternalLeagueMappingInput = {
    leagueId: string;
    externalTournamentId: string;
    externalName?: string;
};

export type UpsertExternalTeamMappingInput = {
    seasonId: string;
    teamId: string;
    externalParticipantId: string;
    externalName?: string;
};

/** Participant seen in preview / existing mapping — labels only; id is authoritative. */
export type OddsPapiParticipantOption = {
    externalParticipantId: string;
    name: string;
};
