import { defineConfig, env } from "prisma/config";

// На Railway переменные уже в process.env — dotenv не нужен.
// Локально Nest/скрипты читают .env сами через ConfigModule / shell.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
