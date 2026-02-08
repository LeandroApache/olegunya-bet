import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SportKey } from '../../generated/prisma';
import { CreateLeagueInput, UpdateLeagueInput } from './dto/league.inputs';
import { LeagueGql } from './dto/league.types';

@Injectable()
export class LeagueService {
    constructor(private readonly prisma: PrismaService) { }

    private sportNameByKey(key: SportKey): string {
        switch (key) {
            case SportKey.FOOTBALL:
                return 'Football';
            case SportKey.HOCKEY:
                return 'Hockey';
            default:
                return String(key);
        }
    }

    private mapToGql(row: any): LeagueGql {
        return {
            id: row.id,
            sportKey: row.sport.key,
            name: row.name,
            country: row.country,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    async create(input: CreateLeagueInput): Promise<LeagueGql> {
        const name = input.name.trim();

        // Sport rows создаём/находим автоматически (seed не нужен)
        const sport = await this.prisma.sport.upsert({
            where: { key: input.sportKey as any },
            update: {},
            create: {
                key: input.sportKey as any,
                name: this.sportNameByKey(input.sportKey),
            },
            select: { id: true, key: true },
        });

        try {
            const league = await this.prisma.league.create({
                data: {
                    sportId: sport.id,
                    name,
                    country: input.country?.trim() || null,
                },
                include: { sport: true },
            });

            return this.mapToGql(league);
        } catch (e: any) {
            // unique(sportId, name)
            if (e?.code === 'P2002') {
                throw new ConflictException('League with referencing sport already exists');
            }
            throw e;
        }
    }

    async findAll(sportKey?: SportKey): Promise<LeagueGql[]> {
        const rows = await this.prisma.league.findMany({
            where: sportKey
                ? {
                    sport: { key: sportKey as any },
                }
                : undefined,
            include: { sport: true },
            orderBy: [{ createdAt: 'desc' }],
        });

        return rows.map((r) => this.mapToGql(r));
    }

    async findById(id: string): Promise<LeagueGql> {
        const row = await this.prisma.league.findUnique({
            where: { id },
            include: { sport: true },
        });

        if (!row) throw new NotFoundException('League not found');
        return this.mapToGql(row);
    }

    async update(input: UpdateLeagueInput): Promise<LeagueGql> {
        // проверим что лига существует
        await this.findById(input.id);

        let sportId: string | undefined;

        if (input.sportKey) {
            const sport = await this.prisma.sport.upsert({
                where: { key: input.sportKey as any },
                update: {},
                create: {
                    key: input.sportKey as any,
                    name: this.sportNameByKey(input.sportKey),
                },
                select: { id: true },
            });
            sportId = sport.id;
        }

        try {
            const updated = await this.prisma.league.update({
                where: { id: input.id },
                data: {
                    sportId,
                    name: input.name !== undefined ? input.name.trim() : undefined,
                    country: input.country !== undefined ? (input.country?.trim() || null) : undefined,
                },
                include: { sport: true },
            });

            return this.mapToGql(updated);
        } catch (e: any) {
            if (e?.code === 'P2002') {
                throw new ConflictException('League with referencing sport already exists');
            }
            // иногда update кидает P2025 если запись исчезла между запросами
            if (e?.code === 'P2025') {
                throw new NotFoundException('League not found');
            }
            throw e;
        }
    }

    async remove(id: string): Promise<boolean> {
        try {
            await this.prisma.league.delete({ where: { id } });
            return true;
        } catch (e: any) {
            if (e?.code === 'P2025') {
                throw new NotFoundException('League not found');
            }
            throw e;
        }
    }
}
