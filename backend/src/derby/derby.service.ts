import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeasonDerbyMatchInput, UpdateSeasonDerbyMatchInput } from './dto/derby.inputs';
import { SeasonDerbyMatchGql } from './dto/derby.types';
import { SportKey } from '../../generated/prisma';

@Injectable()
export class DerbyService {
    constructor(private readonly prisma: PrismaService) { }

    private mapToGql(row: any): SeasonDerbyMatchGql {
        return {
            id: row.id,
            seasonId: row.seasonId,
            homeTeamId: row.homeTeamId,
            awayTeamId: row.awayTeamId,
            homeTeamName: row.homeTeam.name,
            awayTeamName: row.awayTeam.name,
            type: row.type,
        };
    }

    async create(input: CreateSeasonDerbyMatchInput): Promise<SeasonDerbyMatchGql> {
        if (input.homeTeamId === input.awayTeamId) {
            throw new BadRequestException('homeTeamId and awayTeamId must be different');
        }

        const season = await this.prisma.season.findUnique({
            where: { id: input.seasonId },
            include: {
                league: {
                    include: { sport: true },
                },
            },
        });
        if (!season) throw new NotFoundException('Season not found');

        if (season.league.sport.key !== SportKey.FOOTBALL) {
            throw new BadRequestException('Derby matches are only supported for football seasons');
        }

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
            throw new BadRequestException('Teams must belong to the same season');
        }

        try {
            const created = await this.prisma.seasonDerbyMatch.create({
                data: {
                    seasonId: season.id,
                    homeTeamId: input.homeTeamId,
                    awayTeamId: input.awayTeamId,
                    type: input.type as any,
                },
                include: {
                    homeTeam: true,
                    awayTeam: true,
                },
            });

            return this.mapToGql(created);
        } catch (e: any) {
            if (e?.code === 'P2002') {
                throw new ConflictException('Derby match for these teams already exists in this season');
            }
            throw e;
        }
    }

    async findAllBySeason(seasonId: string): Promise<SeasonDerbyMatchGql[]> {
        const season = await this.prisma.season.findUnique({
            where: { id: seasonId },
            include: {
                league: {
                    include: { sport: true },
                },
            },
        });
        if (!season) throw new NotFoundException('Season not found');

        if (season.league.sport.key !== SportKey.FOOTBALL) {
            // для нефутбольных сезонов просто возвращаем пустой список
            return [];
        }

        const rows = await this.prisma.seasonDerbyMatch.findMany({
            where: { seasonId },
            include: {
                homeTeam: true,
                awayTeam: true,
            },
            orderBy: [
                { homeTeam: { name: 'asc' } },
                { awayTeam: { name: 'asc' } },
            ],
        });

        return rows.map((r) => this.mapToGql(r));
    }

    async update(input: UpdateSeasonDerbyMatchInput): Promise<SeasonDerbyMatchGql> {
        const existing = await this.prisma.seasonDerbyMatch.findUnique({
            where: { id: input.id },
            include: {
                season: {
                    include: {
                        league: {
                            include: { sport: true },
                        },
                    },
                },
                homeTeam: true,
                awayTeam: true,
            },
        });
        if (!existing) throw new NotFoundException('SeasonDerbyMatch not found');

        if (existing.season.league.sport.key !== SportKey.FOOTBALL) {
            throw new BadRequestException('Derby matches are only supported for football seasons');
        }

        try {
            const updated = await this.prisma.seasonDerbyMatch.update({
                where: { id: input.id },
                data: {
                    type: input.type !== undefined ? (input.type as any) : undefined,
                },
                include: {
                    homeTeam: true,
                    awayTeam: true,
                },
            });

            return this.mapToGql(updated);
        } catch (e: any) {
            if (e?.code === 'P2002') {
                throw new ConflictException('Derby match for these teams already exists in this season');
            }
            if (e?.code === 'P2025') {
                throw new NotFoundException('SeasonDerbyMatch not found');
            }
            throw e;
        }
    }

    async remove(id: string): Promise<boolean> {
        try {
            await this.prisma.seasonDerbyMatch.delete({ where: { id } });
            return true;
        } catch (e: any) {
            if (e?.code === 'P2025') throw new NotFoundException('SeasonDerbyMatch not found');
            throw e;
        }
    }
}

