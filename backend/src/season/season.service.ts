import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeasonInput, UpdateSeasonInput } from './dto/season.inputs';
import { SeasonGql } from './dto/season.types';

@Injectable()
export class SeasonService {
    constructor(private readonly prisma: PrismaService) { }

    private mapToGql(row: any): SeasonGql {
        return {
            id: row.id,
            leagueId: row.leagueId,
            leagueName: row.league.name,
            name: row.name,
            baseCoefHomeEqual: row.baseCoefHomeEqual,
            flipCoef: row.flipCoef,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    async create(input: CreateSeasonInput): Promise<SeasonGql> {
        const league = await this.prisma.league.findUnique({
            where: { id: input.leagueId },
            select: { id: true, name: true },
        });

        if (!league) throw new NotFoundException('League not found');

        try {
            const season = await this.prisma.season.create({
                data: {
                    leagueId: league.id,
                    name: input.name.trim(),
                    baseCoefHomeEqual: input.baseCoefHomeEqual,
                    flipCoef: input.flipCoef,
                },
                include: { league: true },
            });

            return this.mapToGql(season);
        } catch (e: any) {
            // unique(leagueId, name)
            if (e?.code === 'P2002') {
                throw new ConflictException('Season with this name already exists in this league');
            }
            throw e;
        }
    }

    async findAll(leagueId: string): Promise<SeasonGql[]> {
        // полезно сразу валидировать leagueId, чтобы не было “пусто из-за опечатки”
        const league = await this.prisma.league.findUnique({
            where: { id: leagueId },
            select: { id: true },
        });
        if (!league) throw new NotFoundException('League not found');

        const rows = await this.prisma.season.findMany({
            where: { leagueId },
            include: { league: true },
            orderBy: [{ createdAt: 'desc' }],
        });

        return rows.map((r) => this.mapToGql(r));
    }

    async findById(id: string): Promise<SeasonGql> {
        const row = await this.prisma.season.findUnique({
            where: { id },
            include: { league: true },
        });

        if (!row) throw new NotFoundException('Season not found');
        return this.mapToGql(row);
    }

    async update(input: UpdateSeasonInput): Promise<SeasonGql> {
        // убедимся что сезон существует
        await this.findById(input.id);

        try {
            const updated = await this.prisma.season.update({
                where: { id: input.id },
                data: {
                    name: input.name !== undefined ? input.name.trim() : undefined,
                    baseCoefHomeEqual:
                        input.baseCoefHomeEqual !== undefined ? input.baseCoefHomeEqual : undefined,
                    flipCoef: input.flipCoef !== undefined ? input.flipCoef : undefined,
                },
                include: { league: true },
            });

            return this.mapToGql(updated);
        } catch (e: any) {
            if (e?.code === 'P2002') {
                throw new ConflictException('Season with this name already exists in this league');
            }
            if (e?.code === 'P2025') {
                throw new NotFoundException('Season not found');
            }
            throw e;
        }
    }

    async remove(id: string): Promise<boolean> {
        try {
            await this.prisma.season.delete({ where: { id } });
            return true;
        } catch (e: any) {
            if (e?.code === 'P2025') {
                throw new NotFoundException('Season not found');
            }
            throw e;
        }
    }
}
