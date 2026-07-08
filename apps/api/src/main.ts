import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // WEB_ORIGIN admite una lista separada por comas (producción + previews, etc.).
  const origins = (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim());
  app.enableCors({ origin: origins, credentials: true });
  // Valida y recorta todo DTO entrante (whitelist) — base de la "Definición de Hecho"
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
  console.log(`API en http://localhost:${process.env.PORT ?? 3000}/api`);
}
bootstrap();
