import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

function resolvePrismaClientPath(): string {
  const candidates = [
    // После nest build + copy:prisma: dist/prisma → dist/generated/prisma
    join(__dirname, '..', 'generated', 'prisma'),
    // Корень сервиса после prisma generate
    join(process.cwd(), 'generated', 'prisma'),
    join(process.cwd(), 'dist', 'generated', 'prisma'),
  ];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.js')) || existsSync(`${candidate}.js`)) {
      return candidate;
    }
  }

  throw new Error(
    `Prisma Client not found. Tried:\n${candidates.map((c) => `- ${c}`).join('\n')}\n` +
      `Run: npx prisma generate --schema=./prisma/schema.prisma`,
  );
}

const { PrismaClient } = require(resolvePrismaClientPath());

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
