import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Route Nest's logs through pino (structured, request-scoped).
  app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService);
  const prefix = config.get<string>('API_PREFIX', 'api');
  const port = Number(config.get<string>('API_PORT', '3000'));

  app.setGlobalPrefix(prefix);
  app.enableCors();
  app.enableShutdownHooks();

  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/${prefix}`, 'Bootstrap');
}

void bootstrap();
