import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamInput, UpdateTeamInput } from './dto/team.inputs';
import { TeamGql } from './dto/team.types';

@Injectable()
export class TeamService {
    constructor(private readonly prisma: PrismaService) { }

    private cleanText(s: string): string {
        return s.trim().replace(/\s+/g, ' ');
    }

    private cleanAlias(s: string): string {
        // для алиаса достаточно trim + collapse spaces
        return this.cleanText(s);
    }

    private uniq(arr: string[]): string[] {
        const out: string[] = [];
        const seen = new Set<string>();
        for (const x of arr) {
            const k = x.toLowerCase();
            if (!seen.has(k)) {
                seen.add(k);
                out.push(x);
            }
        }
        return out;
    }

    private mapToGql(row: any): TeamGql {
        return {
            id: row.id,
            seasonId: row.seasonId,
            seasonName: row.season.name,
            name: row.name,
            aliases: row.aliases ?? [],
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    async create(input: CreateTeamInput): Promise<TeamGql> {
        const season = await this.prisma.season.findUnique({
            where: { id: input.seasonId },
            select: { id: true, name: true },
        });
        if (!season) throw new NotFoundException('Season not found');

        const name = this.cleanText(input.name);
        const aliases = this.uniq(
            (input.aliases ?? [])
                .map((a) => this.cleanAlias(a))
                .filter((a) => a.length > 0 && a.toLowerCase() !== name.toLowerCase()),
        );

        try {
            const team = await this.prisma.team.create({
                data: {
                    seasonId: season.id,
                    name,
                    aliases,
                },
                include: { season: true },
            });

            return this.mapToGql(team);
        } catch (e: any) {
            // unique(seasonId, name)
            if (e?.code === 'P2002') {
                throw new ConflictException('Team with this name already exists in this season');
            }
            throw e;
        }
    }

    async findAll(seasonId: string): Promise<TeamGql[]> {
        const season = await this.prisma.season.findUnique({
            where: { id: seasonId },
            select: { id: true },
        });
        if (!season) throw new NotFoundException('Season not found');

        const rows = await this.prisma.team.findMany({
            where: { seasonId },
            include: { season: true },
            orderBy: [{ name: 'asc' }],
        });

        return rows.map((r) => this.mapToGql(r));
    }

    async findById(id: string): Promise<TeamGql> {
        const row = await this.prisma.team.findUnique({
            where: { id },
            include: { season: true },
        });
        if (!row) throw new NotFoundException('Team not found');
        return this.mapToGql(row);
    }

    async update(input: UpdateTeamInput): Promise<TeamGql> {
        const existing = await this.prisma.team.findUnique({
            where: { id: input.id },
            include: { season: true },
        });
        if (!existing) throw new NotFoundException('Team not found');

        const name =
            input.name !== undefined ? this.cleanText(input.name) : undefined;

        const aliases =
            input.aliases !== undefined
                ? this.uniq(
                    input.aliases
                        .map((a) => this.cleanAlias(a))
                        .filter((a) => a.length > 0 && (name ? a.toLowerCase() !== name.toLowerCase() : true)),
                )
                : undefined;

        try {
            const updated = await this.prisma.team.update({
                where: { id: input.id },
                data: {
                    name,
                    aliases,
                },
                include: { season: true },
            });

            return this.mapToGql(updated);
        } catch (e: any) {
            if (e?.code === 'P2002') {
                throw new ConflictException('Team with this name already exists in this season');
            }
            if (e?.code === 'P2025') {
                throw new NotFoundException('Team not found');
            }
            throw e;
        }
    }

    async remove(id: string): Promise<boolean> {
        try {
            await this.prisma.team.delete({ where: { id } });
            return true;
        } catch (e: any) {
            if (e?.code === 'P2025') throw new NotFoundException('Team not found');
            throw e;
        }
    }

    // Для будущего ввода матчей: найти команду по name/alias (case-insensitive)
    async findByNameOrAlias(seasonId: string, query: string): Promise<TeamGql | null> {
        const q = this.cleanText(query);
        if (!q) return null;

        const team = await this.prisma.team.findFirst({
            where: {
                seasonId,
                OR: [
                    { name: { equals: q, mode: 'insensitive' } },
                    { aliases: { has: q } },
                ],
            },
            include: { season: true },
        });

        return team ? this.mapToGql(team) : null;
    }
}
