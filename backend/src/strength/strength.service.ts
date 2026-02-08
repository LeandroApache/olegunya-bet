import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalculateOddsFromStrengthInput, CreateStrengthSnapshotInput } from './dto/strength.inputs';
import { OddsFromStrengthGql, StrengthSnapshotGql, StrengthValueGql } from './dto/strength.types';

type TeamRow = { id: string; name: string };
type MatchRow = { date: Date; homeTeamId: string; awayTeamId: string; deltaHome: number };

@Injectable()
export class StrengthService {
    constructor(private readonly prisma: PrismaService) { }

    private expDecayWeight(matchDate: Date, now: Date, halfLifeDays: number): number {
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysAgo = Math.max(0, (now.getTime() - matchDate.getTime()) / msPerDay);
        return Math.exp(-daysAgo / halfLifeDays);
    }

    // Gaussian elimination (partial pivoting)
    private solveLinearSystem(M: number[][], y: number[]): number[] {
        const n = y.length;
        const A = M.map((row, i) => [...row, y[i]]);

        for (let col = 0; col < n; col++) {
            // pivot
            let pivotRow = col;
            let pivotVal = Math.abs(A[col][col]);
            for (let r = col + 1; r < n; r++) {
                const v = Math.abs(A[r][col]);
                if (v > pivotVal) {
                    pivotVal = v;
                    pivotRow = r;
                }
            }
            if (!isFinite(pivotVal) || pivotVal < 1e-12) {
                throw new BadRequestException('Not enough information to solve strengths (singular matrix)');
            }
            if (pivotRow !== col) {
                const tmp = A[col];
                A[col] = A[pivotRow];
                A[pivotRow] = tmp;
            }

            const pivot = A[col][col];
            for (let c = col; c <= n; c++) A[col][c] /= pivot;

            for (let r = 0; r < n; r++) {
                if (r === col) continue;
                const factor = A[r][col];
                if (factor === 0) continue;
                for (let c = col; c <= n; c++) {
                    A[r][c] -= factor * A[col][c];
                }
            }
        }

        return A.map((row) => row[n]);
    }

    private buildAndSolve(teams: TeamRow[], matches: MatchRow[], halfLifeDays?: number | null): number[] {
        const n = teams.length;
        if (n < 2) throw new BadRequestException('Season must have at least 2 teams');
        if (matches.length === 0) throw new BadRequestException('No matches to calculate strengths');

        const idToIdx = new Map<string, number>();
        teams.forEach((t, i) => idToIdx.set(t.id, i));

        // Normal equations: M = A^T W A, y = A^T W b
        const M: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
        const y: number[] = Array(n).fill(0);

        const now = new Date();

        for (const m of matches) {
            const hi = idToIdx.get(m.homeTeamId);
            const ai = idToIdx.get(m.awayTeamId);
            if (hi === undefined || ai === undefined) continue;

            const w = halfLifeDays ? this.expDecayWeight(m.date, now, halfLifeDays) : 1;
            const ww = Math.max(w, 1e-12);

            // a = e_hi - e_ai
            M[hi][hi] += ww;
            M[ai][ai] += ww;
            M[hi][ai] -= ww;
            M[ai][hi] -= ww;

            y[hi] += ww * m.deltaHome;
            y[ai] -= ww * m.deltaHome;
        }

        // Fix gauge: enforce sum(S)=0 with strong penalty (lambda * 1*1^T)
        const lambda = 1e6;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                M[i][j] += lambda;
            }
        }

        const x = this.solveLinearSystem(M, y);

        // final normalize
        const mean = x.reduce((s, v) => s + v, 0) / x.length;
        return x.map((v) => v - mean);
    }

    async createSnapshot(input: CreateStrengthSnapshotInput): Promise<StrengthSnapshotGql> {
        const season = await this.prisma.season.findUnique({
            where: { id: input.seasonId },
            select: { id: true },
        });
        if (!season) throw new NotFoundException('Season not found');

        const fromDate = input.fromDate ? new Date(input.fromDate) : null;
        const toDateForDb = input.toDate ? new Date(input.toDate) : null;
        const toDateForQuery = input.toDate ? new Date(input.toDate) : new Date();
        if (fromDate && fromDate > toDateForQuery) {
            throw new BadRequestException('fromDate must be <= toDate');
        }

        const teams = await this.prisma.team.findMany({
            where: { seasonId: input.seasonId },
            select: { id: true, name: true },
            orderBy: [{ name: 'asc' }],
        });

        const matchesRaw = await this.prisma.match.findMany({
            where: {
                seasonId: input.seasonId,
                date: { gte: fromDate ?? undefined, lte: toDateForQuery },
                computed: { isNot: null },
            },
            select: {
                date: true,
                homeTeamId: true,
                awayTeamId: true,
                computed: { select: { deltaHome: true } },
            },
            orderBy: [{ date: 'asc' }],
        });

        const matches: MatchRow[] = matchesRaw.map((m) => ({
            date: m.date,
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            deltaHome: m.computed!.deltaHome,
        }));

        const strengths = this.buildAndSolve(teams, matches, input.halfLifeDays ?? null);

        const created = await this.prisma.$transaction(async (tx) => {
            const snapshot = await tx.strengthSnapshot.create({
                data: {
                    seasonId: input.seasonId,
                    fromDate,
                    toDate: toDateForDb,
                    weightMode: input.halfLifeDays ? 'exp_decay' : 'none',
                    halfLifeDays: input.halfLifeDays ?? null,
                },
            });

            await tx.strengthValue.createMany({
                data: teams.map((t, idx) => ({
                    snapshotId: snapshot.id,
                    teamId: t.id,
                    strength: strengths[idx],
                })),
            });

            const full = await tx.strengthSnapshot.findUniqueOrThrow({
                where: { id: snapshot.id },
                include: { values: { include: { team: true } } },
            });

            return full;
        });

        const values: StrengthValueGql[] = created.values
            .map((v) => ({ teamId: v.teamId, teamName: v.team.name, strength: v.strength }))
            .sort((a, b) => b.strength - a.strength);

        return {
            id: created.id,
            seasonId: created.seasonId,
            fromDate: created.fromDate,
            toDate: created.toDate,
            weightMode: created.weightMode,
            halfLifeDays: created.halfLifeDays,
            createdAt: created.createdAt,
            values,
        };
    }

    async getSnapshot(id: string): Promise<StrengthSnapshotGql> {
        const snap = await this.prisma.strengthSnapshot.findUnique({
            where: { id },
            include: { values: { include: { team: true } } },
        });
        if (!snap) throw new NotFoundException('StrengthSnapshot not found');

        const values: StrengthValueGql[] = snap.values
            .map((v) => ({ teamId: v.teamId, teamName: v.team.name, strength: v.strength }))
            .sort((a, b) => b.strength - a.strength);

        return {
            id: snap.id,
            seasonId: snap.seasonId,
            fromDate: snap.fromDate,
            toDate: snap.toDate,
            weightMode: snap.weightMode,
            halfLifeDays: snap.halfLifeDays,
            createdAt: snap.createdAt,
            values,
        };
    }

    async calculateOddsFromStrength(input: CalculateOddsFromStrengthInput): Promise<OddsFromStrengthGql> {
        if (input.homeTeamId === input.awayTeamId) {
            throw new BadRequestException('homeTeamId and awayTeamId must be different');
        }

        // Get snapshot with values
        const snapshot = await this.prisma.strengthSnapshot.findUnique({
            where: { id: input.snapshotId },
            include: {
                season: {
                    select: { id: true, baseCoefHomeEqual: true, flipCoef: true },
                },
                values: {
                    include: { team: true },
                },
            },
        });

        if (!snapshot) throw new NotFoundException('StrengthSnapshot not found');

        // Find strengths for both teams
        const homeStrength = snapshot.values.find((v) => v.teamId === input.homeTeamId);
        const awayStrength = snapshot.values.find((v) => v.teamId === input.awayTeamId);

        if (!homeStrength) throw new NotFoundException('Home team not found in snapshot');
        if (!awayStrength) throw new NotFoundException('Away team not found in snapshot');

        const S_home = homeStrength.strength;
        const S_away = awayStrength.strength;

        // deltaHome = S_home - S_away (in %)
        const deltaHome = S_home - S_away;
        const deltaAway = -deltaHome;

        // Base probability for home team (in %)
        const baseProbUsed = (1 / snapshot.season.baseCoefHomeEqual) * 100;

        // If away team is favorite (S_away > S_home, i.e., deltaHome < 0)
        if (deltaHome < 0) {
            // Calculate base coefficient for away team using flipCoef
            const flipHome = 1 / (snapshot.season.baseCoefHomeEqual - 1);
            const flipAwayBase = flipHome / snapshot.season.flipCoef;
            const baseCoefAwayEqual = 1 / flipAwayBase + 1;

            const baseProbAwayUsed = (1 / baseCoefAwayEqual) * 100;
            const pAwayImplied = baseProbAwayUsed + deltaAway; // in %
            const pAwayImpliedDecimal = pAwayImplied / 100;

            if (pAwayImpliedDecimal <= 0 || pAwayImpliedDecimal >= 1) {
                throw new BadRequestException('Invalid implied probability calculated');
            }

            const kAway = 1 / pAwayImpliedDecimal;

            return {
                coefficient: kAway,
                teamName: awayStrength.team.name,
                isHomeTeam: false,
                delta: deltaAway,
                impliedProbability: pAwayImpliedDecimal,
            };
        }

        // Home team is favorite or equal
        const pHomeImplied = baseProbUsed + deltaHome; // in %
        const pHomeImpliedDecimal = pHomeImplied / 100;

        if (pHomeImpliedDecimal <= 0 || pHomeImpliedDecimal >= 1) {
            throw new BadRequestException('Invalid implied probability calculated');
        }

        const kHome = 1 / pHomeImpliedDecimal;

        return {
            coefficient: kHome,
            teamName: homeStrength.team.name,
            isHomeTeam: true,
            delta: deltaHome,
            impliedProbability: pHomeImpliedDecimal,
        };
    }
}
