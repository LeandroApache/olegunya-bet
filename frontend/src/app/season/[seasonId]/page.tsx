"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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

import {
    createTeamMutation,
    deleteTeamMutation,
    teamsQuery,
    updateTeamMutation,
    type Team,
} from "@/entities/team";

import {
    createMatchMutation,
    deleteMatchMutation,
    matchesPaginatedQuery,
    matchesQuery,
    type Match,
} from "@/entities/match";
import {
    calculateOddsFromStrengthQuery,
    createStrengthSnapshotMutation,
    type StrengthSnapshot,
} from "@/entities/strength";

function toLocalDateInputValue(d = new Date()) {
    // YYYY-MM-DD
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localDateToIso(dateStr: string) {
    // from "YYYY-MM-DD" -> "YYYY-MM-DDT00:00:00.000Z"
    // Важно: это задаёт "полночь UTC". Для твоей модели это норм.
    return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}

export default function SeasonPage() {
    const params = useParams<{ seasonId: string }>();
    const seasonId = params.seasonId;

    const qc = useQueryClient();

    // ===== TEAMS =====
    const [teamsExpanded, setTeamsExpanded] = useState(false);
    const teamsQ = useQuery({
        queryKey: ["teams", seasonId],
        queryFn: () => teamsQuery(seasonId),
    });

    const [newName, setNewName] = useState("");
    const [newAliases, setNewAliases] = useState("");

    const createTeamM = useMutation({
        mutationFn: async () => {
            const name = newName.trim();
            if (!name) throw new Error("Team name is required");

            const aliases = newAliases
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

            return createTeamMutation({ seasonId, name, aliases });
        },
        onSuccess: async () => {
            setNewName("");
            setNewAliases("");
            await qc.invalidateQueries({ queryKey: ["teams", seasonId] });
        },
    });

    const [editId, setEditId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editAliases, setEditAliases] = useState("");

    const startEdit = (t: Team) => {
        setEditId(t.id);
        setEditName(t.name);
        setEditAliases((t.aliases ?? []).join(", "));
    };

    const cancelEdit = () => {
        setEditId(null);
        setEditName("");
        setEditAliases("");
    };

    const saveTeamM = useMutation({
        mutationFn: async () => {
            if (!editId) throw new Error("No team to edit");
            const name = editName.trim();
            if (!name) throw new Error("Team name is required");

            const aliases = editAliases
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

            return updateTeamMutation({ id: editId, name, aliases });
        },
        onSuccess: async () => {
            cancelEdit();
            await qc.invalidateQueries({ queryKey: ["teams", seasonId] });
        },
    });

    const deleteTeamM = useMutation({
        mutationFn: async (id: string) => deleteTeamMutation(id),
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ["teams", seasonId] });
        },
    });

    const sortedTeams = useMemo(() => {
        const list = teamsQ.data ?? [];
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }, [teamsQ.data]);

    // ===== MATCHES =====
    const [matchesPage, setMatchesPage] = useState(1);
    const matchesPageSize = 10;

    const matchesQ = useQuery({
        queryKey: ["matches", seasonId, matchesPage],
        queryFn: () => matchesPaginatedQuery(seasonId, matchesPage, matchesPageSize),
    });

    // All matches for chess table
    const allMatchesQ = useQuery({
        queryKey: ["allMatches", seasonId],
        queryFn: () => matchesQuery(seasonId),
    });

    // create match form
    const [matchDate, setMatchDate] = useState(toLocalDateInputValue());
    const [homeTeamId, setHomeTeamId] = useState<string | undefined>(undefined);
    const [awayTeamId, setAwayTeamId] = useState<string | undefined>(undefined);

    const [kHome, setKHome] = useState("1.80");
    const [kDraw, setKDraw] = useState("3.50");
    const [kAway, setKAway] = useState("4.50");
    const [total, setTotal] = useState(""); // optional

    // Track last created match
    const [lastCreatedMatch, setLastCreatedMatch] = useState<Match | null>(null);

    const createMatchM = useMutation({
        mutationFn: async () => {
            if (!homeTeamId || !awayTeamId) throw new Error("Select teams");
            if (homeTeamId === awayTeamId) throw new Error("Home and Away must differ");

            const kh = Number(kHome);
            const kd = Number(kDraw);
            const ka = Number(kAway);
            if (!isFinite(kh) || !isFinite(kd) || !isFinite(ka)) throw new Error("Invalid odds");
            if (kh <= 1 || kd <= 1 || ka <= 1) throw new Error("Odds must be > 1");

            const tot = total.trim() ? Number(total) : null;
            if (total.trim() && (!isFinite(tot as number) || (tot as number) <= 0)) {
                throw new Error("Invalid total");
            }

            return createMatchMutation({
                seasonId,
                date: localDateToIso(matchDate),
                homeTeamId,
                awayTeamId,
                kHome: kh,
                kDraw: kd,
                kAway: ka,
                total: tot ?? undefined,
            });
        },
        onSuccess: async (createdMatch) => {
            await qc.invalidateQueries({ queryKey: ["matches", seasonId] });
            await qc.invalidateQueries({ queryKey: ["allMatches", seasonId] });
            // Reset to first page after creating a match
            setMatchesPage(1);
            // Store last created match
            setLastCreatedMatch(createdMatch);
        },
    });

    const deleteMatchM = useMutation({
        mutationFn: async (id: string) => deleteMatchMutation(id),
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ["matches", seasonId] });
            await qc.invalidateQueries({ queryKey: ["allMatches", seasonId] });
            // If we deleted the last item on the page, go to previous page
            if (matchesQ.data && matchesQ.data.matches.length === 1 && matchesPage > 1) {
                setMatchesPage((p) => p - 1);
            }
        },
    });

    const sortedMatches = useMemo(() => {
        const list = matchesQ.data?.matches ?? [];
        // Sort by createdAt descending (newest first) so last added match is always at the top
        return [...list].sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA; // Descending order (newest first)
        });
    }, [matchesQ.data]);

    // ===== STRENGTH =====
    const [fromDate, setFromDate] = useState(""); // YYYY-MM-DD
    const [toDate, setToDate] = useState("");     // YYYY-MM-DD
    const [halfLifeDays, setHalfLifeDays] = useState("30"); // optional

    const [snapshot, setSnapshot] = useState<StrengthSnapshot | null>(null);

    // Odds calculation from strength
    const [oddsHomeTeamId, setOddsHomeTeamId] = useState<string | undefined>(undefined);
    const [oddsAwayTeamId, setOddsAwayTeamId] = useState<string | undefined>(undefined);
    const [calculatedOdds, setCalculatedOdds] = useState<any | null>(null);

    const calculateOddsQ = useQuery({
        queryKey: ["calculateOdds", snapshot?.id, oddsHomeTeamId, oddsAwayTeamId],
        queryFn: () => {
            if (!snapshot || !oddsHomeTeamId || !oddsAwayTeamId) throw new Error("Missing data");
            return calculateOddsFromStrengthQuery({
                snapshotId: snapshot.id,
                homeTeamId: oddsHomeTeamId,
                awayTeamId: oddsAwayTeamId,
            });
        },
        enabled: !!snapshot && !!oddsHomeTeamId && !!oddsAwayTeamId && oddsHomeTeamId !== oddsAwayTeamId,
    });

    const strengthM = useMutation({
        mutationFn: async () => {
            const input: any = { seasonId };

            if (fromDate.trim()) input.fromDate = localDateToIso(fromDate.trim());
            if (toDate.trim()) input.toDate = localDateToIso(toDate.trim());

            if (halfLifeDays.trim()) {
                const h = Number(halfLifeDays);
                if (!isFinite(h) || h <= 0) throw new Error("halfLifeDays must be > 0");
                input.halfLifeDays = h;
            }

            return createStrengthSnapshotMutation(input);
        },
        onSuccess: (snap) => {
            setSnapshot(snap);
            // Reset odds calculation when new snapshot is created
            setOddsHomeTeamId(undefined);
            setOddsAwayTeamId(undefined);
            setCalculatedOdds(null);
        },
    });

    // Update calculated odds when query succeeds
    useEffect(() => {
        if (calculateOddsQ.data) {
            setCalculatedOdds(calculateOddsQ.data);
        }
    }, [calculateOddsQ.data]);

    // Build chess table data: Map of "homeTeamId-awayTeamId" -> total
    const chessTableData = useMemo(() => {
        const map = new Map<string, number>();
        const matches = allMatchesQ.data ?? [];
        for (const match of matches) {
            if (match.total != null) {
                const key = `${match.homeTeamId}-${match.awayTeamId}`;
                map.set(key, match.total);
            }
        }
        return map;
    }, [allMatchesQ.data]);

    // Build strength map: teamId -> strength
    const strengthMap = useMemo(() => {
        const map = new Map<string, number>();
        if (snapshot) {
            for (const value of snapshot.values) {
                map.set(value.teamId, value.strength);
            }
        }
        return map;
    }, [snapshot]);

    // Color palette for different strength ranges (from strongest to weakest)
    // Diverse, highly contrasting colors for better visual distinction
    const rangeColors = [
        'rgba(37, 99, 235, 0.6)',    // синий - strongest (0-5%)
        'rgba(220, 38, 38, 0.6)',    // красный - (5-10%)
        'rgba(147, 51, 234, 0.6)',   // фиолетовый - (10-15%)
        'rgba(234, 88, 12, 0.6)',    // оранжевый - (15-20%)
        'rgba(234, 179, 8, 0.6)',    // желтый - (20-25%)
        'rgba(6, 182, 212, 0.6)',    // циан/бирюзовый - (25-30%)
        'rgba(132, 204, 22, 0.6)',   // лайм/желто-зеленый - (30-35%)
        'rgba(236, 72, 153, 0.6)',   // розовый/фуксия - (35-40%)
    ];

    // Calculate max strength and assign teams to 5% ranges
    const teamStrengthRanges = useMemo(() => {
        if (!snapshot || sortedTeams.length === 0) return new Map<string, number>();

        const ranges = new Map<string, number>();

        // Find maximum strength
        let maxStrength = 0;
        strengthMap.forEach((strength) => {
            if (strength > maxStrength) {
                maxStrength = strength;
            }
        });

        if (maxStrength === 0) return ranges;

        // Assign each team to a range based on how far it is from max strength
        strengthMap.forEach((strength, teamId) => {
            // Calculate how many 5% ranges below max strength
            const diffFromMax = maxStrength - strength;
            const rangeIndex = Math.floor(diffFromMax / 5);

            // Only assign range if within reasonable bounds (first 8 ranges)
            if (rangeIndex < rangeColors.length) {
                ranges.set(teamId, rangeIndex);
            }
        });

        return ranges;
    }, [snapshot, sortedTeams, strengthMap]);

    // Function to get color for a team strength range
    const getRangeColor = (teamId: string): string | null => {
        const rangeIndex = teamStrengthRanges.get(teamId);
        if (rangeIndex === undefined) return null;
        return rangeColors[rangeIndex];
    };

    // Function to calculate cell background color based on strength range
    // Highlights cells only when teams are in the same strength range
    const getCellColorStyle = (rowTeamId: string, colTeamId: string): React.CSSProperties => {
        const rowRange = teamStrengthRanges.get(rowTeamId);
        const colRange = teamStrengthRanges.get(colTeamId);

        // If teams are in the same range, use range color
        if (rowRange !== undefined && rowRange === colRange) {
            const color = rangeColors[rowRange];
            return { backgroundColor: color };
        }

        // Otherwise, no color
        return { backgroundColor: 'transparent' };
    };

    // Function to get header color style
    const getHeaderColorStyle = (teamId: string): React.CSSProperties => {
        const color = getRangeColor(teamId);
        if (color === null) {
            return { backgroundColor: 'transparent' };
        }
        return { backgroundColor: color };
    };


    return (
        <div className="min-h-screen p-6 space-y-6">
            <div className="text-xl font-semibold">Season</div>

            {/* ===== TEAMS ===== */}
            <div className="rounded-2xl border p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                        Teams
                        {!teamsExpanded && teamsQ.data && (
                            <span className="text-muted-foreground ml-2">
                                ({teamsQ.data.length})
                            </span>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setTeamsExpanded(!teamsExpanded)}
                        className="gap-1"
                    >
                        {teamsExpanded ? (
                            <>
                                <ChevronUpIcon className="size-4" />
                                Hide
                            </>
                        ) : (
                            <>
                                <ChevronDownIcon className="size-4" />
                                Show
                            </>
                        )}
                    </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                    <Input
                        placeholder="Team name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                    />
                    <Input
                        placeholder="Aliases (comma separated)"
                        value={newAliases}
                        onChange={(e) => setNewAliases(e.target.value)}
                    />
                    <Button onClick={() => createTeamM.mutate()} disabled={createTeamM.isPending}>
                        {createTeamM.isPending ? "Creating…" : "Add team"}
                    </Button>
                </div>

                {createTeamM.isError && (
                    <div className="text-sm text-red-600">
                        {(createTeamM.error as any)?.response?.errors?.[0]?.message ??
                            (createTeamM.error as any)?.message ??
                            "Create failed"}
                    </div>
                )}

                {teamsQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
                {teamsQ.isError && (
                    <div className="text-sm text-red-600">
                        {(teamsQ.error as any)?.response?.errors?.[0]?.message ?? "Failed to load teams"}
                    </div>
                )}

                {teamsExpanded && (
                    <div className="space-y-2">
                        {sortedTeams.map((t) => {
                            const isEditing = editId === t.id;

                            return (
                                <div key={t.id} className="rounded-xl border p-3 space-y-2">
                                    {!isEditing ? (
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="font-medium">{t.name}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {t.aliases?.length ? t.aliases.join(", ") : "—"}
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <Button variant="outline" onClick={() => startEdit(t)}>
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    onClick={() => deleteTeamM.mutate(t.id)}
                                                    disabled={deleteTeamM.isPending}
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid gap-2 md:grid-cols-2">
                                                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                                                <Input
                                                    value={editAliases}
                                                    onChange={(e) => setEditAliases(e.target.value)}
                                                    placeholder="Aliases (comma separated)"
                                                />
                                            </div>

                                            {saveTeamM.isError && (
                                                <div className="text-sm text-red-600">
                                                    {(saveTeamM.error as any)?.response?.errors?.[0]?.message ??
                                                        (saveTeamM.error as any)?.message ??
                                                        "Update failed"}
                                                </div>
                                            )}

                                            <div className="flex gap-2">
                                                <Button onClick={() => saveTeamM.mutate()} disabled={saveTeamM.isPending}>
                                                    {saveTeamM.isPending ? "Saving…" : "Save"}
                                                </Button>
                                                <Button variant="outline" onClick={cancelEdit}>
                                                    Cancel
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ===== MATCHES ===== */}
            <div className="rounded-2xl border p-4 space-y-4">
                <div className="text-sm font-medium">Matches</div>

                {/* Last created match info */}
                {lastCreatedMatch && (
                    <div className="rounded-xl border p-3 bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Last added match</div>
                        <div className="font-medium">
                            {lastCreatedMatch.homeTeamName} — {lastCreatedMatch.awayTeamName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {new Date(lastCreatedMatch.date).toISOString().slice(0, 10)} • k: {lastCreatedMatch.kHome} / {lastCreatedMatch.kDraw} / {lastCreatedMatch.kAway}
                        </div>
                    </div>
                )}

                {/* Create match */}
                <div className="grid gap-3 md:grid-cols-6">
                    <Input
                        type="date"
                        value={matchDate}
                        onChange={(e) => setMatchDate(e.target.value)}
                    />

                    <Select value={homeTeamId} onValueChange={setHomeTeamId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Home" />
                        </SelectTrigger>
                        <SelectContent>
                            {sortedTeams.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={awayTeamId} onValueChange={setAwayTeamId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Away" />
                        </SelectTrigger>
                        <SelectContent>
                            {sortedTeams.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Input value={kHome} onChange={(e) => setKHome(e.target.value)} placeholder="kHome" />
                    <Input value={kDraw} onChange={(e) => setKDraw(e.target.value)} placeholder="kDraw" />
                    <Input value={kAway} onChange={(e) => setKAway(e.target.value)} placeholder="kAway" />
                </div>

                <div className="grid gap-3 md:grid-cols-6">
                    <div className="md:col-span-2 text-sm text-muted-foreground">
                        total optional (например 2.5)
                    </div>
                    <Input
                        className="md:col-span-2"
                        value={total}
                        onChange={(e) => setTotal(e.target.value)}
                        placeholder="total (optional)"
                    />
                    <Button
                        className="md:col-span-2"
                        onClick={() => createMatchM.mutate()}
                        disabled={createMatchM.isPending || !sortedTeams.length}
                    >
                        {createMatchM.isPending ? "Creating…" : "Add match"}
                    </Button>
                </div>

                {createMatchM.isError && (
                    <div className="text-sm text-red-600">
                        {(createMatchM.error as any)?.response?.errors?.[0]?.message ??
                            (createMatchM.error as any)?.message ??
                            "Create match failed"}
                    </div>
                )}

                {/* List */}
                {matchesQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
                {matchesQ.isError && (
                    <div className="text-sm text-red-600">
                        {(matchesQ.error as any)?.response?.errors?.[0]?.message ?? "Failed to load matches"}
                    </div>
                )}

                <div className="space-y-2">
                    {sortedMatches.map((m: Match) => (
                        <div key={m.id} className="rounded-xl border p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="font-medium">
                                        {m.homeTeamName} — {m.awayTeamName}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {new Date(m.date).toISOString().slice(0, 10)} • k: {m.kHome} / {m.kDraw} / {m.kAway}
                                        {m.total ? ` • total: ${m.total}` : ""}
                                    </div>

                                    {m.computed && (
                                        <div className="text-sm mt-2">
                                            <div className="text-muted-foreground">
                                                implied pHome: {(m.computed.pHomeImplied * 100).toFixed(2)}% • base:{" "}
                                                {m.computed.baseProbUsed.toFixed(2)}%
                                            </div>
                                            <div>
                                                deltaHome: <span className="font-medium">{m.computed.deltaHome.toFixed(3)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <Button
                                    variant="destructive"
                                    onClick={() => deleteMatchM.mutate(m.id)}
                                    disabled={deleteMatchM.isPending}
                                >
                                    Delete
                                </Button>
                            </div>

                            {deleteMatchM.isError && (
                                <div className="text-sm text-red-600 mt-2">
                                    {(deleteMatchM.error as any)?.response?.errors?.[0]?.message ?? "Delete failed"}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Pagination */}
                {matchesQ.data && matchesQ.data.totalPages > 1 && (
                    <div className="flex items-center justify-between gap-4 pt-4 border-t">
                        <div className="text-sm text-muted-foreground">
                            Page {matchesQ.data.page} of {matchesQ.data.totalPages} ({matchesQ.data.totalCount} total)
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setMatchesPage((p) => Math.max(1, p - 1))}
                                disabled={matchesPage === 1 || matchesQ.isLoading}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setMatchesPage((p) => Math.min(matchesQ.data!.totalPages, p + 1))}
                                disabled={matchesPage >= (matchesQ.data?.totalPages ?? 1) || matchesQ.isLoading}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* ===== STRENGTH ===== */}
            <div className="rounded-2xl border p-4 space-y-4">
                <div className="text-sm font-medium">Strength</div>

                <div className="grid gap-3 md:grid-cols-4">
                    <Input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        placeholder="fromDate"
                    />
                    <Input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        placeholder="toDate"
                    />
                    <Input
                        value={halfLifeDays}
                        onChange={(e) => setHalfLifeDays(e.target.value)}
                        placeholder="halfLifeDays (optional)"
                    />
                    <Button onClick={() => strengthM.mutate()} disabled={strengthM.isPending}>
                        {strengthM.isPending ? "Calculating…" : "Calculate"}
                    </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                    Оставь даты пустыми → будет весь сезон. halfLifeDays пустой → без decay.
                </div>

                {strengthM.isError && (
                    <div className="text-sm text-red-600">
                        {(strengthM.error as any)?.response?.errors?.[0]?.message ??
                            (strengthM.error as any)?.message ??
                            "Strength calculation failed"}
                    </div>
                )}

                {snapshot && (
                    <div className="space-y-3">
                        <div className="text-sm text-muted-foreground">
                            snapshot: <span className="font-medium">{snapshot.id}</span> • mode:{" "}
                            <span className="font-medium">{snapshot.weightMode}</span>
                            {snapshot.halfLifeDays ? ` • halfLifeDays: ${snapshot.halfLifeDays}` : ""}
                        </div>

                        <div className="rounded-xl border overflow-hidden">
                            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-sm bg-muted/50">
                                <div className="col-span-1 font-medium">#</div>
                                <div className="col-span-7 font-medium">Team</div>
                                <div className="col-span-4 font-medium text-right">Strength (%)</div>
                            </div>

                            {snapshot.values
                                .slice()
                                .sort((a, b) => b.strength - a.strength)
                                .map((v, idx) => (
                                    <div
                                        key={v.teamId}
                                        className="grid grid-cols-12 gap-2 px-3 py-2 text-sm border-t"
                                    >
                                        <div className="col-span-1 text-muted-foreground">{idx + 1}</div>
                                        <div className="col-span-7">{v.teamName}</div>
                                        <div className="col-span-4 text-right font-medium">
                                            {v.strength.toFixed(3)}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                {/* Calculate Odds from Strength */}
                {snapshot && snapshot.values.length > 0 && (
                    <div className="space-y-3 pt-4 border-t">
                        <div className="text-sm font-medium">Calculate Odds from Strength</div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <Select value={oddsHomeTeamId} onValueChange={setOddsHomeTeamId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Home Team" />
                                </SelectTrigger>
                                <SelectContent>
                                    {snapshot.values.map((v) => (
                                        <SelectItem key={v.teamId} value={v.teamId}>
                                            {v.teamName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={oddsAwayTeamId} onValueChange={setOddsAwayTeamId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Away Team" />
                                </SelectTrigger>
                                <SelectContent>
                                    {snapshot.values.map((v) => (
                                        <SelectItem key={v.teamId} value={v.teamId}>
                                            {v.teamName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {calculateOddsQ.isLoading && (
                            <div className="text-sm text-muted-foreground">Calculating…</div>
                        )}

                        {calculateOddsQ.isError && (
                            <div className="text-sm text-red-600">
                                {(calculateOddsQ.error as any)?.response?.errors?.[0]?.message ??
                                    (calculateOddsQ.error as any)?.message ??
                                    "Calculation failed"}
                            </div>
                        )}

                        {calculatedOdds && (
                            <div className="rounded-xl border p-4 space-y-2">
                                <div className="text-sm font-medium">
                                    Estimated Coefficient: <span className="text-lg">{calculatedOdds.coefficient.toFixed(3)}</span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    For: <span className="font-medium">{calculatedOdds.teamName}</span>{" "}
                                    ({calculatedOdds.isHomeTeam ? "Home" : "Away"})
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    Delta: <span className="font-medium">{calculatedOdds.delta.toFixed(3)}%</span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    Implied Probability:{" "}
                                    <span className="font-medium">{(calculatedOdds.impliedProbability * 100).toFixed(2)}%</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Chess Table with Match Totals */}
                {snapshot && sortedTeams.length > 0 && (
                    <div className="space-y-3 pt-4 border-t">
                        <div className="text-sm font-medium">Match Totals Cross-Table</div>

                        {/* Legend */}
                        <div className="text-xs text-muted-foreground">
                            <div className="mb-2">Цвета обозначают диапазоны силы команд (относительно самой сильной команды):</div>
                            <div className="flex flex-wrap gap-4">
                                {(() => {
                                    const strengths = Array.from(strengthMap.values());
                                    if (strengths.length === 0) return null;

                                    const maxStrength = Math.max(...strengths);

                                    return rangeColors.map((color, index) => {
                                        const rangeStart = maxStrength - (index + 1) * 5;
                                        const rangeEnd = maxStrength - index * 5;

                                        // Only show ranges that are actually used
                                        const hasTeamsInRange = Array.from(teamStrengthRanges.values()).includes(index);
                                        if (!hasTeamsInRange) return null;

                                        return (
                                            <div key={index} className="flex items-center gap-2">
                                                <div
                                                    className="w-4 h-4 rounded"
                                                    style={{ backgroundColor: color }}
                                                ></div>
                                                <span>
                                                    {index === 0
                                                        ? `0-5% (${rangeEnd.toFixed(1)}-${maxStrength.toFixed(1)}%)`
                                                        : `${index * 5}-${(index + 1) * 5}% (${rangeStart.toFixed(1)}-${rangeEnd.toFixed(1)}%)`
                                                    }
                                                </span>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        <div className="rounded-xl border overflow-hidden overflow-x-auto">
                            <div className="min-w-full">
                                {/* Header row */}
                                <div className="grid gap-2 px-3 py-2 text-sm bg-muted/50 sticky top-0 z-10"
                                    style={{ gridTemplateColumns: `120px repeat(${sortedTeams.length}, minmax(80px, 1fr))` }}>
                                    <div className="font-medium">Team</div>
                                    {sortedTeams.map((team) => {
                                        const headerStyle = getHeaderColorStyle(team.id);
                                        return (
                                            <div
                                                key={team.id}
                                                className="font-medium text-center text-xs truncate"
                                                title={team.name}
                                                style={headerStyle}
                                            >
                                                {team.name}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Data rows */}
                                {sortedTeams.map((rowTeam) => (
                                    <div
                                        key={rowTeam.id}
                                        className="grid gap-2 px-3 py-2 text-sm border-t"
                                        style={{ gridTemplateColumns: `120px repeat(${sortedTeams.length}, minmax(80px, 1fr))` }}
                                    >
                                        <div
                                            className="font-medium truncate"
                                            title={rowTeam.name}
                                            style={getHeaderColorStyle(rowTeam.id)}
                                        >
                                            {rowTeam.name}
                                        </div>
                                        {sortedTeams.map((colTeam) => {
                                            const key = `${rowTeam.id}-${colTeam.id}`;
                                            const total = chessTableData.get(key);
                                            const cellStyle = getCellColorStyle(rowTeam.id, colTeam.id);

                                            if (rowTeam.id === colTeam.id) {
                                                return (
                                                    <div key={colTeam.id} className="text-center text-muted-foreground bg-muted/10">
                                                        —
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div
                                                    key={colTeam.id}
                                                    className="text-center"
                                                    style={cellStyle}
                                                >
                                                    {total != null ? (
                                                        <span className="font-medium">{total.toFixed(1)}</span>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>



        </div>
    );
}
