import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true, // Разрешить все origin в development
    credentials: true,
  });

  await app.listen(3000);
}
bootstrap();
