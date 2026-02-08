import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SportService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll() {
        return this.prisma.sport.findMany({
            orderBy: [{ name: 'asc' }],
        });
    }
}
