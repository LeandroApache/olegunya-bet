import { Injectable, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

// Prisma client из твоего generated (через абсолютный путь — стабильно)
const { PrismaClient } = require(`${process.cwd()}/generated/prisma`);

// Driver adapter для Postgres
const { PrismaPg } = require('@prisma/adapter-pg');

function needsRailwaySsl(connectionString?: string): boolean {
  if (!connectionString) return false;
  try {
    const host = new URL(connectionString).hostname.toLowerCase();
    return host.endsWith('.rlwy.net') || host.endsWith('.railway.app');
  } catch {
    return connectionString.includes('rlwy.net');
  }
}

function pgConnectionString(connectionString: string): string {
  try {
    const u = new URL(connectionString);
    if (needsRailwaySsl(connectionString)) {
      // Иначе sslmode=require в новых pg = verify-full и ломает Railway proxy.
      u.searchParams.delete('sslmode');
      u.searchParams.delete('uselibpqcompat');
    }
    return u.toString();
  } catch {
    return connectionString;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }

    const pool = new Pool({
      connectionString: pgConnectionString(connectionString),
      ssl: needsRailwaySsl(connectionString)
        ? { rejectUnauthorized: false }
        : undefined,
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
