"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSeasonMutation, seasonsQuery } from "@/entities/season";

export default function LeaguePage() {
    const params = useParams<{ leagueId: string }>();
    const leagueId = params.leagueId;
    const qc = useQueryClient();

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

    return (
        <div className="min-h-screen p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="text-xl font-semibold">Seasons</div>
                <Link href="/" className="text-sm underline">
                    Back
                </Link>
            </div>

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

                <div className="space-y-2">
                    {seasonsQ.data?.map((s) => (
                        <Link
                            key={s.id}
                            href={`/season/${s.id}`}
                            className="block rounded-xl border p-3 hover:bg-accent transition"
                        >
                            <div className="font-medium">{s.name}</div>
                            <div className="text-sm text-muted-foreground">
                                base={s.baseCoefHomeEqual} • flip={s.flipCoef}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
