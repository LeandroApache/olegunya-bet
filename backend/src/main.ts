import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const corsOrigin = process.env.CORS_ORIGIN
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    // Чтобы preflight точно проходил, по умолчанию разрешаем все origin.
    // При желании домены можно сузить через CORS_ORIGIN (но тогда важно совпадение с фронтом 1:1).
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
}
bootstrap();
