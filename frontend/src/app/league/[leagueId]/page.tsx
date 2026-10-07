"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSeasonMutation, deleteSeasonMutation, seasonsQuery } from "@/entities/season";
import { deleteLeagueMutation, leagueQuery } from "@/entities/league";

export default function LeaguePage() {
    const params = useParams<{ leagueId: string }>();
    const leagueId = params.leagueId;
    const router = useRouter();
    const qc = useQueryClient();

    const leagueQ = useQuery({
        queryKey: ["league", leagueId],
        queryFn: () => leagueQuery(leagueId),
    });

    const seasonsQ = useQuery({
        queryKey: ["seasons", leagueId],
        queryFn: () => seasonsQuery(leagueId),
    });

    const [name, setName] = useState("2025/26");
    const [baseCoefHomeEqual, setBaseCoefHomeEqual] = useState("2.40");
    const [flipCoef, setFlipCoef] = useState("1.00");

    const createM = useMutation({
        mutationFn: async () => {
            const base = Number(baseCoefHomeEqual);
            const flip = Number(flipCoef);
            if (!name.trim()) throw new Error("Season name required");
            if (!isFinite(base) || base <= 1) throw new Error("baseCoefHomeEqual must be > 1");
            if (!isFinite(flip) || flip <= 0) throw new Error("flipCoef must be > 0");

            return createSeasonMutation({
                leagueId,
                name: name.trim(),
                baseCoefHomeEqual: base,
                flipCoef: flip,
            });
        },
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ["seasons", leagueId] });
        },
    });

    const deleteSeasonM = useMutation({
        mutationFn: async (id: string) => deleteSeasonMutation(id),
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ["seasons", leagueId] });
        },
    });

    const deleteLeagueM = useMutation({
        mutationFn: async () => deleteLeagueMutation(leagueId),
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ["leagues"] });
            router.push("/");
        },
    });

    const requestDeleteSeason = (seasonName: string, seasonId: string) => {
        const ok = window.confirm(
            `Delete season "${seasonName}"?\n\nAll teams, matches, mappings and strength snapshots in this season will be permanently deleted.`,
        );
        if (!ok) return;
        deleteSeasonM.mutate(seasonId);
    };

    const requestDeleteLeague = () => {
        const leagueName = leagueQ.data?.name ?? "this league";
        const ok = window.confirm(
            `Delete league "${leagueName}"?\n\nAll seasons inside it (and their matches/teams) will be permanently deleted.`,
        );
        if (!ok) return;
        deleteLeagueM.mutate();
    };

    return (
        <div className="min-h-screen p-6 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-xl font-semibold">
                        {leagueQ.data?.name ? `League · ${leagueQ.data.name}` : "Seasons"}
                    </div>
                    {leagueQ.data && (
                        <div className="text-sm text-muted-foreground mt-0.5">
                            {leagueQ.data.country ?? "—"} · {leagueQ.data.sportKey}
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/">Back</Link>
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={requestDeleteLeague}
                        disabled={deleteLeagueM.isPending || leagueQ.isLoading}
                    >
                        {deleteLeagueM.isPending ? "Deleting…" : "Delete league"}
                    </Button>
                </div>
            </div>

            {deleteLeagueM.isError && (
                <div className="text-sm text-red-600">
                    {(deleteLeagueM.error as any)?.response?.errors?.[0]?.message ??
                        (deleteLeagueM.error as any)?.message ??
                        "Failed to delete league"}
                </div>
            )}

            <div className="rounded-2xl border p-4 space-y-3">
                <div className="text-sm font-medium">Create season</div>

                <div className="grid gap-3 md:grid-cols-4">
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="2025/26" />
                    <Input
                        value={baseCoefHomeEqual}
                        onChange={(e) => setBaseCoefHomeEqual(e.target.value)}
                        placeholder="baseCoefHomeEqual"
                    />
                    <Input
                        value={flipCoef}
                        onChange={(e) => setFlipCoef(e.target.value)}
                        placeholder="flipCoef"
                    />
                    <Button onClick={() => createM.mutate()} disabled={createM.isPending}>
                        {createM.isPending ? "Creating…" : "Create"}
                    </Button>
                </div>

                {createM.isError && (
                    <div className="text-sm text-red-600">
                        {(createM.error as any)?.response?.errors?.[0]?.message ??
                            (createM.error as any)?.message ??
                            "Create failed"}
                    </div>
                )}
            </div>

            <div className="rounded-2xl border p-4 space-y-3">
                <div className="text-sm font-medium">All seasons</div>

                {seasonsQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
                {seasonsQ.isError && (
                    <div className="text-sm text-red-600">
                        {(seasonsQ.error as any)?.response?.errors?.[0]?.message ?? "Failed"}
                    </div>
                )}
                {deleteSeasonM.isError && (
                    <div className="text-sm text-red-600">
                        {(deleteSeasonM.error as any)?.response?.errors?.[0]?.message ??
                            (deleteSeasonM.error as any)?.message ??
                            "Failed to delete season"}
                    </div>
                )}

                <div className="space-y-2">
                    {seasonsQ.data?.map((s) => (
                        <div
                            key={s.id}
                            className="rounded-xl border p-3 flex flex-wrap items-start justify-between gap-3"
                        >
                            <Link href={`/season/${s.id}`} className="min-w-0 hover:underline">
                                <div className="font-medium">{s.name}</div>
                                <div className="text-sm text-muted-foreground">
                                    base={s.baseCoefHomeEqual} • flip={s.flipCoef}
                                </div>
                            </Link>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => requestDeleteSeason(s.name, s.id)}
                                disabled={deleteSeasonM.isPending}
                            >
                                Delete
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
