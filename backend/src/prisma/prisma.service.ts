import { Injectable, OnModuleInit } from '@nestjs/common';

// Prisma client из твоего generated (через абсолютный путь — стабильно)
const { PrismaClient } = require(`${process.cwd()}/generated/prisma`);

// Driver adapter для Postgres
const { PrismaPg } = require('@prisma/adapter-pg');

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
    constructor() {
        const adapter = new PrismaPg({
            connectionString: process.env.DATABASE_URL,
        });

        super({ adapter }); // ✅ вот то, что требует Prisma 7 rust-free client
    }

    async onModuleInit() {
        await this.$connect();
    }
}
