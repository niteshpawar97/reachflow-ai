import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  // Standalone application context: no HTTP server, hosts BullMQ processors + scheduler.
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: false,
  });
  await app.init();

  Logger.log('Worker started — no queues registered yet (Milestone 10).', 'Worker');

  const shutdown = async (signal: string): Promise<void> => {
    Logger.log(`Received ${signal}, shutting down worker...`, 'Worker');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void bootstrap();
