"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { seasonQuery } from "@/entities/season";
import { leagueQuery } from "@/entities/league";
import type { Team } from "@/entities/team";
import type { SportKey } from "@/entities/sport/model/types";

import {
    createAndMapOddsPapiTeamsMutation,
    deleteExternalLeagueMappingMutation,
    deleteExternalTeamMappingMutation,
    externalLeagueMappingsQuery,
    externalTeamMappingsQuery,
    importOddsPapiFixturesMutation,
    oddsPapiTournamentsQuery,
    previewOddsPapiFixturesQuery,
    upsertExternalLeagueMappingMutation,
    upsertExternalTeamMappingMutation,
    type ExternalTeamMapping,
    type OddsPapiCreateAndMapTeamsResult,
    type OddsPapiFixturePreview,
    type OddsPapiImportResult,
    type OddsPapiParticipantOption,
    type OddsPapiTournament,
} from "../model";

function toLocalDateInputValue(d = new Date()) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgoLocal(days: number) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return toLocalDateInputValue(d);
}

function localDateToIsoStart(dateStr: string) {
    return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}

function localDateToIsoEnd(dateStr: string) {
    return new Date(`${dateStr}T23:59:59.999Z`).toISOString();
}

function gqlErrorMessage(err: unknown, fallback: string) {
    const e = err as { response?: { errors?: { message?: string }[] }; message?: string };
    return e?.response?.errors?.[0]?.message ?? e?.message ?? fallback;
}

function formatPreviewDate(iso: string) {
    const d = new Date(iso);
    if (!isFinite(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function previewStatus(f: OddsPapiFixturePreview): {
    label: string;
    tone: "ready" | "warn" | "muted";
} {
    if (!f.homeMapped || !f.awayMapped) {
        return { label: "Unmapped team", tone: "warn" };
    }
    // Finished fixtures typically have hasOdds=false even when historical odds exist.
    // Import still resolves odds via /historical-odds; do not flag them as Missing odds here.
    return { label: "Ready", tone: "ready" };
}

function skipReasonLabel(reason: string): string {
    if (reason === "MISSING_PINNACLE_1X2") return "Missing Pinnacle 1X2";
    if (reason.startsWith("UNMAPPED_")) return "Unmapped team";
    if (reason.startsWith("HISTORICAL_ODDS_ERROR")) return "Historical odds error";
    if (reason.startsWith("PERSIST_ERROR")) return "Persist error";
    return reason;
}

function collectParticipantsFromPreview(
    fixtures: OddsPapiFixturePreview[],
): OddsPapiParticipantOption[] {
    const map = new Map<string, string>();
    for (const f of fixtures) {
        map.set(String(f.participant1Id), f.participant1Name);
        map.set(String(f.participant2Id), f.participant2Name);
    }
    return [...map.entries()]
        .map(([externalParticipantId, name]) => ({ externalParticipantId, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

type Props = {
    seasonId: string;
    teams: Team[];
};

export function OddsPapiImportSection({ seasonId, teams }: Props) {
    const qc = useQueryClient();

    const [manageOpen, setManageOpen] = useState(false);
    const [teamMappingsOpen, setTeamMappingsOpen] = useState(false);
    const [skipsOpen, setSkipsOpen] = useState(false);

    const [tournamentFilter, setTournamentFilter] = useState("");
    const [selectedTournamentId, setSelectedTournamentId] = useState<string | undefined>();

    const [fromDate, setFromDate] = useState(() => daysAgoLocal(30));
    const [toDate, setToDate] = useState(() => toLocalDateInputValue());

    const [preview, setPreview] = useState<OddsPapiFixturePreview[] | null>(null);
    const [importResult, setImportResult] = useState<OddsPapiImportResult | null>(null);
    const [createMapResult, setCreateMapResult] =
        useState<OddsPapiCreateAndMapTeamsResult | null>(null);

    /** Pending participant pick per internal teamId */
    const [pendingPick, setPendingPick] = useState<Record<string, string>>({});

    const seasonQ = useQuery({
        queryKey: ["season", seasonId],
        queryFn: () => seasonQuery(seasonId),
    });

    const leagueId = seasonQ.data?.leagueId;

    const leagueQ = useQuery({
        queryKey: ["league", leagueId],
        queryFn: () => leagueQuery(leagueId!),
        enabled: !!leagueId,
    });

    const sportKey = leagueQ.data?.sportKey as SportKey | undefined;

    const leagueMappingsQ = useQuery({
        queryKey: ["externalLeagueMappings", leagueId],
        queryFn: () => externalLeagueMappingsQuery(leagueId!),
        enabled: !!leagueId,
    });

    const teamMappingsQ = useQuery({
        queryKey: ["externalTeamMappings", seasonId],
        queryFn: () => externalTeamMappingsQuery(seasonId),
    });

    const tournamentsQ = useQuery({
        queryKey: ["oddsPapiTournaments", sportKey],
        queryFn: () => oddsPapiTournamentsQuery(sportKey!),
        enabled: !!sportKey && manageOpen,
    });

    const leagueMapping = leagueMappingsQ.data?.[0] ?? null;

    const mappingByTeamId = useMemo(() => {
        const map = new Map<string, ExternalTeamMapping>();
        for (const m of teamMappingsQ.data ?? []) {
            map.set(m.teamId, m);
        }
        return map;
    }, [teamMappingsQ.data]);

    const mappedCount = useMemo(() => {
        let n = 0;
        for (const t of teams) {
            if (mappingByTeamId.has(t.id)) n += 1;
        }
        return n;
    }, [teams, mappingByTeamId]);

    const totalTeams = teams.length;
    const unmappedCount = Math.max(0, totalTeams - mappedCount);
    const allMapped = totalTeams > 0 && mappedCount === totalTeams;

    const filteredTournaments = useMemo(() => {
        const list = tournamentsQ.data ?? [];
        const q = tournamentFilter.trim().toLowerCase();
        if (!q) return list;
        return list.filter((t) => {
            const hay = `${t.tournamentName} ${t.categoryName} ${t.tournamentId}`.toLowerCase();
            return hay.includes(q);
        });
    }, [tournamentsQ.data, tournamentFilter]);

    const selectedTournament: OddsPapiTournament | undefined = useMemo(() => {
        if (!selectedTournamentId) return undefined;
        return (tournamentsQ.data ?? []).find(
            (t) => String(t.tournamentId) === selectedTournamentId,
        );
    }, [selectedTournamentId, tournamentsQ.data]);

    const participantOptions = useMemo(() => {
        const fromPreview = collectParticipantsFromPreview(preview ?? []);
        const map = new Map<string, string>();
        for (const p of fromPreview) {
            map.set(p.externalParticipantId, p.name);
        }
        for (const m of teamMappingsQ.data ?? []) {
            if (!map.has(m.externalParticipantId)) {
                map.set(
                    m.externalParticipantId,
                    m.externalName?.trim() || m.externalParticipantId,
                );
            }
        }
        return [...map.entries()]
            .map(([externalParticipantId, name]) => ({ externalParticipantId, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [preview, teamMappingsQ.data]);

    /** Participants already mapped to another team — exclude from other selects. */
    const takenParticipantIds = useMemo(() => {
        const set = new Set<string>();
        for (const m of teamMappingsQ.data ?? []) {
            set.add(m.externalParticipantId);
        }
        return set;
    }, [teamMappingsQ.data]);

    const uniquePreviewParticipants = useMemo(
        () => collectParticipantsFromPreview(preview ?? []),
        [preview],
    );

    const unmappedPreviewParticipants = useMemo(
        () =>
            uniquePreviewParticipants.filter(
                (p) => !takenParticipantIds.has(p.externalParticipantId),
            ),
        [uniquePreviewParticipants, takenParticipantIds],
    );

    /** Bulk onboarding: empty season, or interrupted OddsPapi onboarding (all existing teams mapped). */
    const canBulkCreateTeams = useMemo(() => {
        if (!preview || unmappedPreviewParticipants.length === 0) return false;
        if (teams.length === 0) return true;
        const mappedTeamIds = new Set(
            (teamMappingsQ.data ?? []).map((m) => m.teamId),
        );
        return teams.every((t) => mappedTeamIds.has(t.id));
    }, [preview, unmappedPreviewParticipants.length, teams, teamMappingsQ.data]);

    const upsertLeagueM = useMutation({
        mutationFn: async () => {
            if (!leagueId) throw new Error("League not loaded");
            if (!selectedTournament) throw new Error("Select a tournament");
            return upsertExternalLeagueMappingMutation({
                leagueId,
                externalTournamentId: String(selectedTournament.tournamentId),
                externalName: selectedTournament.tournamentName,
            });
        },
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ["externalLeagueMappings", leagueId] });
            setSelectedTournamentId(undefined);
            setTournamentFilter("");
        },
    });

    const deleteLeagueM = useMutation({
        mutationFn: async (id: string) => deleteExternalLeagueMappingMutation(id),
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ["externalLeagueMappings", leagueId] });
            setPreview(null);
            setImportResult(null);
        },
    });

    const upsertTeamM = useMutation({
        mutationFn: async (args: {
            teamId: string;
            externalParticipantId: string;
            externalName?: string;
        }) =>
            upsertExternalTeamMappingMutation({
                seasonId,
                teamId: args.teamId,
                externalParticipantId: args.externalParticipantId,
                externalName: args.externalName,
            }),
        onSuccess: async (_data, vars) => {
            setPendingPick((prev) => {
                const next = { ...prev };
                delete next[vars.teamId];
                return next;
            });
            await qc.invalidateQueries({ queryKey: ["externalTeamMappings", seasonId] });
            if (preview) {
                try {
                    const refreshed = await previewOddsPapiFixturesQuery(importInput);
                    setPreview(refreshed);
                } catch {
                    setPreview(null);
                }
            }
        },
    });

    const deleteTeamM = useMutation({
        mutationFn: async (id: string) => deleteExternalTeamMappingMutation(id),
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ["externalTeamMappings", seasonId] });
            if (preview) {
                try {
                    const refreshed = await previewOddsPapiFixturesQuery(importInput);
                    setPreview(refreshed);
                } catch {
                    setPreview(null);
                }
            }
        },
    });

    const importInput = useMemo(
        () => ({
            seasonId,
            from: localDateToIsoStart(fromDate),
            to: localDateToIsoEnd(toDate),
        }),
        [seasonId, fromDate, toDate],
    );

    const previewM = useMutation({
        mutationFn: async () => previewOddsPapiFixturesQuery(importInput),
        onSuccess: (data) => {
            setPreview(data);
            setImportResult(null);
            setCreateMapResult(null);
        },
    });

    const createAndMapM = useMutation({
        mutationFn: async () => createAndMapOddsPapiTeamsMutation(importInput),
        onSuccess: async (data) => {
            setCreateMapResult(data);
            await Promise.all([
                qc.invalidateQueries({ queryKey: ["teams", seasonId] }),
                qc.invalidateQueries({ queryKey: ["externalTeamMappings", seasonId] }),
            ]);
            try {
                const refreshed = await previewOddsPapiFixturesQuery(importInput);
                setPreview(refreshed);
            } catch {
                setPreview(null);
            }
        },
    });

    const importM = useMutation({
        mutationFn: async () => importOddsPapiFixturesMutation(importInput),
        onMutate: () => {
            setImportResult(null);
        },
        onSuccess: async (data) => {
            setImportResult(data);
            setSkipsOpen(data.skips.length > 0);
            await Promise.all([
                qc.invalidateQueries({ queryKey: ["matches", seasonId] }),
                qc.invalidateQueries({ queryKey: ["allMatches", seasonId] }),
                qc.invalidateQueries({ queryKey: ["externalTeamMappings", seasonId] }),
            ]);
            // Refresh preview mapping flags after import
            setPreview(null);
        },
    });

    const sortedTeams = useMemo(
        () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
        [teams],
    );

    const loadingMeta = seasonQ.isLoading || leagueQ.isLoading || leagueMappingsQ.isLoading;

    return (
        <div className="rounded-2xl border p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-medium">OddsPapi Import</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        Preferred way to load finished matches. Manual entry stays available below.
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="xs"
                    className="gap-1"
                    onClick={() => setManageOpen((v) => !v)}
                >
                    {manageOpen ? (
                        <>
                            <ChevronUpIcon className="size-4" />
                            Hide
                        </>
                    ) : (
                        <>
                            <ChevronDownIcon className="size-4" />
                            Manage mappings
                        </>
                    )}
                </Button>
            </div>

            {loadingMeta && (
                <div className="text-sm text-muted-foreground">Loading OddsPapi setup…</div>
            )}
            {(seasonQ.isError || leagueQ.isError || leagueMappingsQ.isError) && (
                <div className="text-sm text-red-600">
                    {gqlErrorMessage(
                        seasonQ.error ?? leagueQ.error ?? leagueMappingsQ.error,
                        "Failed to load OddsPapi setup",
                    )}
                </div>
            )}

            {/* Summary */}
            {!loadingMeta && (
                <div className="grid gap-3 md:grid-cols-3 text-sm">
                    <div className="rounded-xl border p-3 space-y-1">
                        <div className="text-xs text-muted-foreground">Tournament</div>
                        {leagueMapping ? (
                            <>
                                <div className="font-medium">
                                    {leagueMapping.externalName ??
                                        `Tournament ${leagueMapping.externalTournamentId}`}
                                </div>
                                <div className="text-xs text-green-700">✓ Connected</div>
                                <div className="text-xs text-muted-foreground">
                                    ID: {leagueMapping.externalTournamentId}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="font-medium text-muted-foreground">Not connected</div>
                                <div className="text-xs text-muted-foreground">
                                    Map a tournament to continue
                                </div>
                            </>
                        )}
                    </div>

                    <div className="rounded-xl border p-3 space-y-1">
                        <div className="text-xs text-muted-foreground">Teams</div>
                        <div className="font-medium">
                            {mappedCount} / {totalTeams} mapped
                        </div>
                        {allMapped ? (
                            <div className="text-xs text-green-700">✓ Ready to import</div>
                        ) : (
                            <div className="text-xs text-muted-foreground">
                                {unmappedCount} team{unmappedCount === 1 ? "" : "s"} require mapping
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border p-3 space-y-2">
                        <div className="text-xs text-muted-foreground">Matches</div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!leagueMapping || previewM.isPending || importM.isPending}
                                onClick={() => previewM.mutate()}
                            >
                                {previewM.isPending ? "Loading…" : "Preview fixtures"}
                            </Button>
                            <Button
                                size="sm"
                                disabled={!leagueMapping || importM.isPending || previewM.isPending}
                                onClick={() => importM.mutate()}
                            >
                                {importM.isPending ? "Importing…" : "Import matches"}
                            </Button>
                        </div>
                        {importM.isPending && (
                            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                                Importing… OddsPapi allows ~1 historical-odds call every 5s.
                                Large date ranges can take several minutes. Keep this tab open.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Date range */}
            {leagueMapping && (
                <div className="grid gap-3 md:grid-cols-2 max-w-lg">
                    <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">From</div>
                        <Input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            disabled={importM.isPending}
                        />
                    </div>
                    <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">To</div>
                        <Input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            disabled={importM.isPending}
                        />
                    </div>
                </div>
            )}

            {previewM.isError && (
                <div className="text-sm text-red-600 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    {gqlErrorMessage(previewM.error, "Preview failed")}
                </div>
            )}
            {importM.isError && (
                <div className="text-sm text-red-600 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    {gqlErrorMessage(importM.error, "Import failed")}
                </div>
            )}
            {importResult && (
                <div className="space-y-3 rounded-xl border border-green-200 bg-green-50/40 p-3">
                    <div className="text-sm font-medium text-green-700">
                        ✓ Import complete
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 text-sm">
                        <Stat label="Fixtures found" value={importResult.fixturesFound} />
                        <Stat label="Imported" value={importResult.imported} />
                        <Stat
                            label="Already imported"
                            value={importResult.alreadyImported}
                        />
                        <Stat label="Unmapped" value={importResult.unmapped} />
                        <Stat
                            label="Missing Pinnacle odds"
                            value={importResult.missingOdds}
                        />
                        <Stat
                            label="Imported without total"
                            value={importResult.importedWithoutTotal}
                        />
                        <Stat label="Failed" value={importResult.failed} />
                    </div>

                    {importResult.imported > 0 && (
                        <div className="text-sm text-muted-foreground">
                            {importResult.imported} match
                            {importResult.imported === 1 ? "" : "es"} imported. Recalculate
                            strength to include them in the current strength snapshot.
                        </div>
                    )}

                    {importResult.skips.length > 0 && (
                        <div className="space-y-2">
                            <Button
                                variant="ghost"
                                size="xs"
                                className="gap-1 px-0"
                                onClick={() => setSkipsOpen((v) => !v)}
                            >
                                {skipsOpen ? (
                                    <ChevronUpIcon className="size-4" />
                                ) : (
                                    <ChevronDownIcon className="size-4" />
                                )}
                                Skipped fixtures ({importResult.skips.length})
                            </Button>
                            {skipsOpen && (
                                <div className="space-y-2">
                                    {importResult.skips.map((s) => (
                                        <div
                                            key={`${s.fixtureId}-${s.reason}`}
                                            className="rounded-lg border bg-background p-2 text-sm"
                                        >
                                            <div className="font-medium">
                                                {s.participant1Name ?? "?"} –{" "}
                                                {s.participant2Name ?? "?"}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {skipReasonLabel(s.reason)}
                                            </div>
                                            <div className="text-xs font-mono text-muted-foreground mt-0.5">
                                                {s.reason}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Manage mappings panel */}
            {manageOpen && (
                <div className="space-y-4 rounded-xl border p-3">
                    <div className="text-sm font-medium">Tournament mapping</div>

                    {leagueMapping ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                            <div>
                                <div className="font-medium">
                                    {leagueMapping.externalName ??
                                        `Tournament ${leagueMapping.externalTournamentId}`}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Sport: {sportKey ?? "—"} · Tournament ID:{" "}
                                    {leagueMapping.externalTournamentId}
                                </div>
                                <div className="text-xs text-green-700 mt-1">✓ Connected</div>
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => deleteLeagueM.mutate(leagueMapping.id)}
                                disabled={deleteLeagueM.isPending}
                            >
                                {deleteLeagueM.isPending ? "Removing…" : "Disconnect"}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="text-xs text-muted-foreground">
                                Search and select an OddsPapi tournament for{" "}
                                {leagueQ.data?.name ?? "this league"} ({sportKey ?? "…"}).
                            </div>
                            <Input
                                placeholder="Filter tournaments…"
                                value={tournamentFilter}
                                onChange={(e) => setTournamentFilter(e.target.value)}
                            />
                            {tournamentsQ.isLoading && (
                                <div className="text-sm text-muted-foreground">
                                    Loading tournaments…
                                </div>
                            )}
                            {tournamentsQ.isError && (
                                <div className="text-sm text-red-600">
                                    {gqlErrorMessage(
                                        tournamentsQ.error,
                                        "Failed to load tournaments",
                                    )}
                                </div>
                            )}
                            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                                <Select
                                    value={selectedTournamentId}
                                    onValueChange={setSelectedTournamentId}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="OddsPapi tournament" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredTournaments.slice(0, 200).map((t) => (
                                            <SelectItem
                                                key={t.tournamentId}
                                                value={String(t.tournamentId)}
                                            >
                                                {t.tournamentName} ({t.categoryName}) · {t.tournamentId}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={() => upsertLeagueM.mutate()}
                                    disabled={
                                        !selectedTournament || upsertLeagueM.isPending
                                    }
                                >
                                    {upsertLeagueM.isPending ? "Connecting…" : "Connect"}
                                </Button>
                            </div>
                            {selectedTournament && (
                                <div className="text-xs text-muted-foreground">
                                    Sport: {sportKey} · Tournament ID:{" "}
                                    {selectedTournament.tournamentId}
                                </div>
                            )}
                            {filteredTournaments.length > 200 && (
                                <div className="text-xs text-muted-foreground">
                                    Showing first 200 matches — refine the filter.
                                </div>
                            )}
                            {upsertLeagueM.isError && (
                                <div className="text-sm text-red-600">
                                    {gqlErrorMessage(
                                        upsertLeagueM.error,
                                        "Failed to connect tournament",
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="border-t pt-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-baseline gap-2">
                                <div className="text-sm font-medium">Team mappings</div>
                                <div className="text-xs text-muted-foreground">
                                    {mappedCount} / {totalTeams} mapped
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="xs"
                                className="gap-1"
                                onClick={() => setTeamMappingsOpen((v) => !v)}
                            >
                                {teamMappingsOpen ? (
                                    <>
                                        Hide
                                        <ChevronUpIcon className="size-4" />
                                    </>
                                ) : (
                                    <>
                                        Show
                                        <ChevronDownIcon className="size-4" />
                                    </>
                                )}
                            </Button>
                        </div>

                        {teamMappingsOpen && !leagueMapping && (
                            <div className="text-sm text-muted-foreground">
                                Connect a tournament first, then preview fixtures to discover
                                OddsPapi teams for mapping.
                            </div>
                        )}

                        {teamMappingsOpen &&
                            leagueMapping &&
                            participantOptions.length === 0 && (
                            <div className="text-sm text-muted-foreground">
                                Preview fixtures in the date range above to load OddsPapi
                                participants for mapping. Names are labels only — the saved
                                mapping uses external participant IDs.
                            </div>
                        )}

                        {teamMappingsOpen && leagueMapping && (
                            <div className="space-y-2">
                                {sortedTeams.map((team) => {
                                    const mapping = mappingByTeamId.get(team.id);
                                    const pick = pendingPick[team.id];

                                    if (mapping) {
                                        return (
                                            <div
                                                key={team.id}
                                                className="rounded-xl border p-3 flex flex-wrap items-start justify-between gap-3"
                                            >
                                                <div className="space-y-0.5 text-sm">
                                                    <div>
                                                        <span className="text-xs text-muted-foreground">
                                                            Internal:{" "}
                                                        </span>
                                                        <span className="font-medium">
                                                            {team.name}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-muted-foreground">
                                                            OddsPapi:{" "}
                                                        </span>
                                                        {mapping.externalName ?? "—"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        External ID:{" "}
                                                        {mapping.externalParticipantId}
                                                    </div>
                                                    <div className="text-xs text-green-700">
                                                        ✓ Mapped
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={deleteTeamM.isPending}
                                                    onClick={() =>
                                                        deleteTeamM.mutate(mapping.id)
                                                    }
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        );
                                    }

                                    const available = participantOptions.filter(
                                        (p) =>
                                            !takenParticipantIds.has(p.externalParticipantId) ||
                                            p.externalParticipantId === pick,
                                    );

                                    return (
                                        <div
                                            key={team.id}
                                            className="rounded-xl border p-3 space-y-2"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="font-medium text-sm">
                                                    {team.name}
                                                </div>
                                                <div className="text-xs text-amber-700">
                                                    Needs mapping
                                                </div>
                                            </div>
                                            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                                                <Select
                                                    value={pick}
                                                    onValueChange={(v) =>
                                                        setPendingPick((prev) => ({
                                                            ...prev,
                                                            [team.id]: v,
                                                        }))
                                                    }
                                                    disabled={available.length === 0}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select OddsPapi team" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {available.map((p) => (
                                                            <SelectItem
                                                                key={p.externalParticipantId}
                                                                value={p.externalParticipantId}
                                                            >
                                                                {p.name} · {p.externalParticipantId}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    size="sm"
                                                    disabled={
                                                        !pick || upsertTeamM.isPending
                                                    }
                                                    onClick={() => {
                                                        if (!pick) return;
                                                        const opt = participantOptions.find(
                                                            (p) =>
                                                                p.externalParticipantId ===
                                                                pick,
                                                        );
                                                        upsertTeamM.mutate({
                                                            teamId: team.id,
                                                            externalParticipantId: pick,
                                                            externalName: opt?.name,
                                                        });
                                                    }}
                                                >
                                                    {upsertTeamM.isPending
                                                        ? "Saving…"
                                                        : "Confirm"}
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {teamMappingsOpen && upsertTeamM.isError && (
                            <div className="text-sm text-red-600">
                                {gqlErrorMessage(
                                    upsertTeamM.error,
                                    "Failed to save team mapping",
                                )}
                            </div>
                        )}
                        {teamMappingsOpen && deleteTeamM.isError && (
                            <div className="text-sm text-red-600">
                                {gqlErrorMessage(
                                    deleteTeamM.error,
                                    "Failed to remove team mapping",
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Bulk team onboarding for new / OddsPapi-only seasons */}
            {canBulkCreateTeams && (
                <div className="rounded-xl border p-3 space-y-3">
                    <div className="text-sm font-medium">Team setup</div>
                    <div className="text-sm text-muted-foreground">
                        {uniquePreviewParticipants.length} team
                        {uniquePreviewParticipants.length === 1 ? "" : "s"} found in
                        OddsPapi
                        {unmappedPreviewParticipants.length !==
                        uniquePreviewParticipants.length
                            ? ` (${unmappedPreviewParticipants.length} still unmapped)`
                            : ""}
                        .
                        {teams.length === 0
                            ? " This season has no teams yet."
                            : " Existing teams are already OddsPapi-mapped; remaining participants can be created."}
                    </div>
                    <Button
                        disabled={createAndMapM.isPending || previewM.isPending}
                        onClick={() => {
                            const n = unmappedPreviewParticipants.length;
                            const ok = window.confirm(
                                `Create ${n} team${n === 1 ? "" : "s"} from OddsPapi and map them to this season?`,
                            );
                            if (!ok) return;
                            createAndMapM.mutate();
                        }}
                    >
                        {createAndMapM.isPending
                            ? "Creating…"
                            : `Create & map ${unmappedPreviewParticipants.length} team${
                                  unmappedPreviewParticipants.length === 1 ? "" : "s"
                              }`}
                    </Button>
                    {createAndMapM.isError && (
                        <div className="text-sm text-red-600">
                            {gqlErrorMessage(
                                createAndMapM.error,
                                "Create & map teams failed",
                            )}
                        </div>
                    )}
                    {createMapResult && (
                        <div className="text-sm text-muted-foreground">
                            Created {createMapResult.teamsCreated} team
                            {createMapResult.teamsCreated === 1 ? "" : "s"}, mapped{" "}
                            {createMapResult.mappingsCreated}, already mapped{" "}
                            {createMapResult.alreadyMapped} (of{" "}
                            {createMapResult.participantsFound} participants).
                        </div>
                    )}
                </div>
            )}

            {/* Preview table */}
            {preview && (
                <div className="space-y-2">
                    <div className="text-sm font-medium">
                        Fixture preview ({preview.length})
                    </div>
                    {preview.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                            No finished fixtures in this date range.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-xs text-muted-foreground">
                                        <th className="p-2 font-medium">Date</th>
                                        <th className="p-2 font-medium">Home</th>
                                        <th className="p-2 font-medium">Away</th>
                                        <th className="p-2 font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.map((f) => {
                                        const status = previewStatus(f);
                                        return (
                                            <tr key={f.fixtureId} className="border-b last:border-0">
                                                <td className="p-2 whitespace-nowrap">
                                                    {formatPreviewDate(f.startTime)}
                                                </td>
                                                <td className="p-2">
                                                    <div>{f.participant1Name}</div>
                                                    {!f.homeMapped && (
                                                        <div className="text-xs text-amber-700">
                                                            unmapped
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-2">
                                                    <div>{f.participant2Name}</div>
                                                    {!f.awayMapped && (
                                                        <div className="text-xs text-amber-700">
                                                            unmapped
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-2">
                                                    <span
                                                        className={
                                                            status.tone === "ready"
                                                                ? "text-green-700"
                                                                : status.tone === "warn"
                                                                  ? "text-amber-700"
                                                                  : "text-muted-foreground"
                                                        }
                                                    >
                                                        {status.label}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border px-3 py-2 flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="font-medium tabular-nums">{value}</span>
        </div>
    );
}
