import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

process.on('uncaughtException', (err) => {
  console.error('[bootstrap] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[bootstrap] unhandledRejection:', reason);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // До Nest guards: Railway healthcheck не должен упираться в JWT.
  const http = app.getHttpAdapter().getInstance();
  http.get('/health', (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) => {
    res.status(200).json({ ok: true });
  });

  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const listenPort = Number.isFinite(port) ? port : 3000;

  // Railway проксирует на $PORT; bind на 0.0.0.0 обязателен в контейнере.
  await app.listen(listenPort, '0.0.0.0');
  console.log(`[bootstrap] listening on 0.0.0.0:${listenPort}`);

  // Если процесс умрёт — в логах перестанет появляться heartbeat.
  setInterval(() => {
    console.log(`[bootstrap] heartbeat pid=${process.pid} uptime=${Math.floor(process.uptime())}s`);
  }, 30000).unref();
}

bootstrap().catch((err) => {
  console.error('[bootstrap] failed to start:', err);
  process.exit(1);
});
