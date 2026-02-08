import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchInput, UpdateMatchInput } from './dto/match.inputs';
import { MatchComputedGql, MatchGql, MarketTypeGql, MatchesPageGql } from './dto/match.types';

type ImpliedProbs = { pHomeImplied: number; pDrawImplied: number; pAwayImplied: number };

@Injectable()
export class MatchService {
    constructor(private readonly prisma: PrismaService) { }

    // ====== "Dirty" implied probabilities (with margin) ======
    private computeImpliedProbsFromOdds(kHome: number, kDraw: number, kAway: number): ImpliedProbs {
        if (!isFinite(kHome) || !isFinite(kDraw) || !isFinite(kAway)) {
            throw new BadRequestException('Invalid odds');
        }
        if (kHome <= 1 || kDraw <= 1 || kAway <= 1) {
            throw new BadRequestException('Odds must be > 1');
        }

        const pHome = 1 / kHome;
        const pDraw = 1 / kDraw;
        const pAway = 1 / kAway;

        if (!isFinite(pHome) || !isFinite(pDraw) || !isFinite(pAway)) {
            throw new BadRequestException('Invalid odds');
        }

        return { pHomeImplied: pHome, pDrawImplied: pDraw, pAwayImplied: pAway };
    }

    // ====== Flip helpers (your formula) ======
    private flipFromOdds(k: number): number {
        // kFlip = 1 / (k - 1)
        if (!isFinite(k) || k <= 1) throw new BadRequestException('Odds must be > 1 for flip');
        return 1 / (k - 1);
    }

    private oddsFromFlip(kFlip: number): number {
        // k = 1 / kFlip + 1
        if (!isFinite(kFlip) || kFlip <= 0) throw new BadRequestException('Invalid flip value');
        return 1 / kFlip + 1;
    }

    /**
     * If kHome > kAway (home underdog) we map away odds to home-scale using flipCoef:
     * flipAway = 1/(kAway-1)
     * flipAsHome = flipAway * flipCoef
     * kHomeEffective = 1/flipAsHome + 1
     *
     * Otherwise kHomeEffective = kHome.
     */
    private computeEffectiveHomeOddsDirty(kHome: number, kAway: number, flipCoef: number): number {
        if (!isFinite(kHome) || !isFinite(kAway)) throw new BadRequestException('Invalid odds');
        if (kHome <= 1 || kAway <= 1) throw new BadRequestException('Odds must be > 1');

        // если хозяева фаворит или равны — не трогаем
        if (kHome <= kAway) return kHome;

        if (!isFinite(flipCoef) || flipCoef <= 0) {
            throw new BadRequestException('Season.flipCoef must be > 0');
        }

        const flipAway = this.flipFromOdds(kAway);
        const flipAsHome = flipAway * flipCoef;

        const kHomeEffective = this.oddsFromFlip(flipAsHome);
        if (!isFinite(kHomeEffective) || kHomeEffective <= 1) {
            throw new BadRequestException('Invalid effective home odds');
        }
        return kHomeEffective;
    }

    // ====== Delta (dirty variant A) ======
    private computeDeltaDirty(
        baseCoefHomeEqual: number,
        pHomeImplied: number,
        pAwayImplied: number,
        flipCoef: number,
        kHome: number,
        kAway: number,
    ) {
        if (!isFinite(baseCoefHomeEqual) || baseCoefHomeEqual <= 1) {
            throw new BadRequestException('Season.baseCoefHomeEqual must be > 1');
        }
        if (!isFinite(pHomeImplied) || pHomeImplied <= 0) {
            throw new BadRequestException('Invalid implied probability for home');
        }
        if (!isFinite(pAwayImplied) || pAwayImplied <= 0) {
            throw new BadRequestException('Invalid implied probability for away');
        }

        // Если выездная команда - фаворит (kAway < kHome), вычисляем дельту относительно выездной команды
        if (kAway < kHome) {
            // Вычисляем базовый коэффициент для выездной команды через flipCoef
            const flipHome = this.flipFromOdds(baseCoefHomeEqual);
            const flipAwayBase = flipHome / flipCoef;
            const baseCoefAwayEqual = this.oddsFromFlip(flipAwayBase);

            const baseProbUsed = (1 / baseCoefAwayEqual) * 100; // % для выездной команды
            const pAwayPercent = pAwayImplied * 100;

            const deltaAway = pAwayPercent - baseProbUsed;
            const deltaHome = -deltaAway;

            return { baseProbUsed, deltaHome, deltaAway };
        }

        // Если домашняя команда - фаворит или равны, вычисляем дельту относительно домашней команды
        const baseProbUsed = (1 / baseCoefHomeEqual) * 100; // %
        const pHomePercent = pHomeImplied * 100;

        const deltaHome = pHomePercent - baseProbUsed;
        const deltaAway = -deltaHome;

        return { baseProbUsed, deltaHome, deltaAway };
    }

    private map(row: any): MatchGql {
        return {
            id: row.id,
            seasonId: row.seasonId,
            tourId: row.tourId,
            date: row.date,
            marketType: row.marketType,
            homeTeamId: row.homeTeamId,
            awayTeamId: row.awayTeamId,
            homeTeamName: row.homeTeam.name,
            awayTeamName: row.awayTeam.name,
            kHome: row.kHome,
            kDraw: row.kDraw,
            kAway: row.kAway,
            total: row.total,
            computed: row.computed
                ? ({
                    baseProbUsed: row.computed.baseProbUsed,
                    // renamed fields
                    pHomeImplied: row.computed.pHomeImplied,
                    pDrawImplied: row.computed.pDrawImplied,
                    pAwayImplied: row.computed.pAwayImplied,
                    deltaHome: row.computed.deltaHome,
                    deltaAway: row.computed.deltaAway,
                } satisfies MatchComputedGql)
                : null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    async create(input: CreateMatchInput): Promise<MatchGql> {
        if (input.homeTeamId === input.awayTeamId) {
            throw new BadRequestException('homeTeamId and awayTeamId must be different');
        }

        const season = await this.prisma.season.findUnique({
            where: { id: input.seasonId },
            select: { id: true, baseCoefHomeEqual: true, flipCoef: true },
        });
        if (!season) throw new NotFoundException('Season not found');

        // Teams must belong to this season
        const [homeTeam, awayTeam] = await Promise.all([
            this.prisma.team.findUnique({
                where: { id: input.homeTeamId },
                select: { id: true, seasonId: true },
            }),
            this.prisma.team.findUnique({
                where: { id: input.awayTeamId },
                select: { id: true, seasonId: true },
            }),
        ]);

        if (!homeTeam || !awayTeam) throw new NotFoundException('Team not found');
        if (homeTeam.seasonId !== season.id || awayTeam.seasonId !== season.id) {
            throw new BadRequestException('Teams must belong to the same season as match');
        }

        // ===== Variant A + flip correction =====
        const kHomeEffective = this.computeEffectiveHomeOddsDirty(
            input.kHome,
            input.kAway,
            season.flipCoef,
        );

        const implied = this.computeImpliedProbsFromOdds(kHomeEffective, input.kDraw, input.kAway);
        const { baseProbUsed, deltaHome, deltaAway } = this.computeDeltaDirty(
            season.baseCoefHomeEqual,
            implied.pHomeImplied,
            implied.pAwayImplied,
            season.flipCoef,
            input.kHome,
            input.kAway,
        );

        const date = new Date(input.date);
        const marketType = (input.marketType ?? MarketTypeGql.MATCH_1X2_REGULAR_TIME) as any;

        try {
            const created = await this.prisma.$transaction(async (tx) => {
                const match = await tx.match.create({
                    data: {
                        seasonId: season.id,
                        tourId: input.tourId ?? null,
                        date,
                        marketType,
                        homeTeamId: input.homeTeamId,
                        awayTeamId: input.awayTeamId,
                        kHome: input.kHome,
                        kDraw: input.kDraw,
                        kAway: input.kAway,
                        total: input.total ?? null,
                    },
                });

                await tx.matchComputed.upsert({
                    where: { matchId: match.id },
                    create: {
                        matchId: match.id,
                        baseProbUsed,
                        pHomeImplied: implied.pHomeImplied,
                        pDrawImplied: implied.pDrawImplied,
                        pAwayImplied: implied.pAwayImplied,
                        deltaHome,
                        deltaAway,
                    },
                    update: {
                        baseProbUsed,
                        pHomeImplied: implied.pHomeImplied,
                        pDrawImplied: implied.pDrawImplied,
                        pAwayImplied: implied.pAwayImplied,
                        deltaHome,
                        deltaAway,
                    },
                });

                return tx.match.findUniqueOrThrow({
                    where: { id: match.id },
                    include: { homeTeam: true, awayTeam: true, computed: true },
                });
            });

            return this.map(created);
        } catch (e: any) {
            if (e?.code === 'P2002') {
                throw new ConflictException('Match already exists (same season/date/teams/marketType)');
            }
            throw e;
        }
    }

    async findAllBySeason(seasonId: string): Promise<MatchGql[]> {
        const season = await this.prisma.season.findUnique({
            where: { id: seasonId },
            select: { id: true },
        });
        if (!season) throw new NotFoundException('Season not found');

        const rows = await this.prisma.match.findMany({
            where: { seasonId },
            include: { homeTeam: true, awayTeam: true, computed: true },
            orderBy: [{ date: 'desc' }],
        });

        return rows.map((r) => this.map(r));
    }

    async findAllBySeasonPaginated(
        seasonId: string,
        page: number = 1,
        pageSize: number = 20,
    ): Promise<MatchesPageGql> {
        const season = await this.prisma.season.findUnique({
            where: { id: seasonId },
            select: { id: true },
        });
        if (!season) throw new NotFoundException('Season not found');

        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        const skip = (page - 1) * pageSize;

        const [rows, totalCount] = await Promise.all([
            this.prisma.match.findMany({
                where: { seasonId },
                include: { homeTeam: true, awayTeam: true, computed: true },
                orderBy: [{ date: 'desc' }],
                skip,
                take: pageSize,
            }),
            this.prisma.match.count({
                where: { seasonId },
            }),
        ]);

        const totalPages = Math.ceil(totalCount / pageSize);

        return {
            matches: rows.map((r) => this.map(r)),
            totalCount,
            page,
            pageSize,
            totalPages,
        };
    }

    async findById(id: string): Promise<MatchGql> {
        const row = await this.prisma.match.findUnique({
            where: { id },
            include: { homeTeam: true, awayTeam: true, computed: true },
        });
        if (!row) throw new NotFoundException('Match not found');
        return this.map(row);
    }

    async update(input: UpdateMatchInput): Promise<MatchGql> {
        const existing = await this.prisma.match.findUnique({
            where: { id: input.id },
            include: { season: true },
        });
        if (!existing) throw new NotFoundException('Match not found');

        const homeTeamId = input.homeTeamId ?? existing.homeTeamId;
        const awayTeamId = input.awayTeamId ?? existing.awayTeamId;
        if (homeTeamId === awayTeamId) {
            throw new BadRequestException('homeTeamId and awayTeamId must be different');
        }

        // Ensure teams exist & belong to this season
        const [homeTeam, awayTeam] = await Promise.all([
            this.prisma.team.findUnique({
                where: { id: homeTeamId },
                select: { id: true, seasonId: true },
            }),
            this.prisma.team.findUnique({
                where: { id: awayTeamId },
                select: { id: true, seasonId: true },
            }),
        ]);
        if (!homeTeam || !awayTeam) throw new NotFoundException('Team not found');
        if (homeTeam.seasonId !== existing.seasonId || awayTeam.seasonId !== existing.seasonId) {
            throw new BadRequestException('Teams must belong to the same season as match');
        }

        const kHome = input.kHome ?? existing.kHome;
        const kDraw = input.kDraw ?? existing.kDraw;
        const kAway = input.kAway ?? existing.kAway;

        // ===== Variant A + flip correction =====
        const kHomeEffective = this.computeEffectiveHomeOddsDirty(
            kHome,
            kAway,
            existing.season.flipCoef,
        );

        const implied = this.computeImpliedProbsFromOdds(kHomeEffective, kDraw, kAway);
        const { baseProbUsed, deltaHome, deltaAway } = this.computeDeltaDirty(
            existing.season.baseCoefHomeEqual,
            implied.pHomeImplied,
            implied.pAwayImplied,
            existing.season.flipCoef,
            kHome,
            kAway,
        );

        try {
            const updated = await this.prisma.$transaction(async (tx) => {
                await tx.match.update({
                    where: { id: input.id },
                    data: {
                        tourId: input.tourId !== undefined ? input.tourId : undefined,
                        date: input.date !== undefined ? new Date(input.date) : undefined,
                        homeTeamId: input.homeTeamId !== undefined ? input.homeTeamId : undefined,
                        awayTeamId: input.awayTeamId !== undefined ? input.awayTeamId : undefined,
                        kHome: input.kHome !== undefined ? input.kHome : undefined,
                        kDraw: input.kDraw !== undefined ? input.kDraw : undefined,
                        kAway: input.kAway !== undefined ? input.kAway : undefined,
                        total: input.total !== undefined ? input.total : undefined,
                    },
                });

                await tx.matchComputed.upsert({
                    where: { matchId: input.id },
                    create: {
                        matchId: input.id,
                        baseProbUsed,
                        pHomeImplied: implied.pHomeImplied,
                        pDrawImplied: implied.pDrawImplied,
                        pAwayImplied: implied.pAwayImplied,
                        deltaHome,
                        deltaAway,
                    },
                    update: {
                        baseProbUsed,
                        pHomeImplied: implied.pHomeImplied,
                        pDrawImplied: implied.pDrawImplied,
                        pAwayImplied: implied.pAwayImplied,
                        deltaHome,
                        deltaAway,
                    },
                });

                return tx.match.findUniqueOrThrow({
                    where: { id: input.id },
                    include: { homeTeam: true, awayTeam: true, computed: true },
                });
            });

            return this.map(updated);
        } catch (e: any) {
            if (e?.code === 'P2002') {
                throw new ConflictException('Match already exists (same season/date/teams/marketType)');
            }
            if (e?.code === 'P2025') throw new NotFoundException('Match not found');
            throw e;
        }
    }

    async remove(id: string): Promise<boolean> {
        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.matchComputed.deleteMany({ where: { matchId: id } });
                await tx.match.delete({ where: { id } });
            });
            return true;
        } catch (e: any) {
            if (e?.code === 'P2025') throw new NotFoundException('Match not found');
            throw e;
        }
    }
}
