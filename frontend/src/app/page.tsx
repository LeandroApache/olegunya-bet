"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { sportsQuery, type SportKey } from "@/entities/sport";
import { createLeagueMutation, leaguesQuery, type League } from "@/entities/league";
import { useAuth } from "@/entities/auth";

export default function HomePage() {
  const qc = useQueryClient();
  const { logout } = useAuth();

  // 1) sports
  const sportsQ = useQuery({
    queryKey: ["sports"],
    queryFn: sportsQuery,
  });

  const [sportKey, setSportKey] = useState<SportKey | undefined>(undefined);

  // select default sport when loaded
  const selectedSport = useMemo(() => {
    if (!sportsQ.data?.length) return null;
    const found = sportKey ? sportsQ.data.find((s) => s.key === sportKey) : null;
    return found ?? sportsQ.data[0];
  }, [sportsQ.data, sportKey]);

  // keep local state in sync with default
  const effectiveSportKey = selectedSport?.key;

  // 2) leagues
  const leaguesQ = useQuery({
    queryKey: ["leagues", effectiveSportKey],
    queryFn: () => leaguesQuery(effectiveSportKey),
    enabled: !!effectiveSportKey,
  });

  // create form state
  const [leagueName, setLeagueName] = useState("");
  const [country, setCountry] = useState("");

  const createM = useMutation({
    mutationFn: async () => {
      if (!selectedSport) throw new Error("Select sport first");
      if (!leagueName.trim()) throw new Error("League name is required");

      return createLeagueMutation({
        sportKey: selectedSport.key,
        name: leagueName.trim(),
        country: country.trim() ? country.trim() : null,
      });
    },
    onSuccess: async () => {
      setLeagueName("");
      setCountry("");
      await qc.invalidateQueries({ queryKey: ["leagues", effectiveSportKey] });
    },
  });

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold">Leagues</div>
        <Button variant="outline" onClick={logout}>
          Logout
        </Button>
      </div>

      {/* Sport selector */}
      <div className="rounded-2xl border p-4 space-y-3">
        <div className="text-sm font-medium">Sport</div>

        {sportsQ.isLoading && <div className="text-sm text-muted-foreground">Loading sports…</div>}

        {sportsQ.isError && (
          <div className="text-sm text-red-600">
            {(sportsQ.error as any)?.response?.errors?.[0]?.message ?? "Failed to load sports"}
          </div>
        )}

        {sportsQ.data?.length ? (
          <Select
            value={effectiveSportKey}
            onValueChange={(v) => setSportKey(v as SportKey)}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Select sport" />
            </SelectTrigger>
            <SelectContent>
              {sportsQ.data.map((s) => (
                <SelectItem key={s.id} value={s.key}>
                  {s.name} ({s.key})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {/* Create league */}
      <div className="rounded-2xl border p-4 space-y-3">
        <div className="text-sm font-medium">Create league</div>

        <div className="grid gap-3 md:grid-cols-3">
          <Input
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
            placeholder="League name"
          />
          <Input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country (optional)"
          />
          <Button
            onClick={() => createM.mutate()}
            disabled={createM.isPending || !selectedSport}
          >
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

      {/* Leagues list */}
      <div className="rounded-2xl border p-4 space-y-3">
        <div className="text-sm font-medium">
          Leagues {effectiveSportKey ? `(${effectiveSportKey})` : ""}
        </div>

        {leaguesQ.isLoading && <div className="text-sm text-muted-foreground">Loading leagues…</div>}

        {leaguesQ.isError && (
          <div className="text-sm text-red-600">
            {(leaguesQ.error as any)?.response?.errors?.[0]?.message ?? "Failed to load leagues"}
          </div>
        )}

        {!leaguesQ.isLoading && leaguesQ.data?.length === 0 && (
          <div className="text-sm text-muted-foreground">No leagues yet.</div>
        )}

        <div className="space-y-2">
          {leaguesQ.data?.map((l: League) => (
            <Link
              key={l.id}
              href={`/league/${l.id}`}
              className="block rounded-xl border p-3 hover:bg-accent transition"
            >
              <div className="font-medium">{l.name}</div>
              <div className="text-sm text-muted-foreground">
                {l.country ?? "—"} • {l.id}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
