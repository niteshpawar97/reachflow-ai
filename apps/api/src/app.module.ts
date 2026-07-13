import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { PrismaModule } from '@reachflow/database';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        genReqId: (req: IncomingMessage, res: ServerResponse): string => {
          const incoming = req.headers['x-request-id'];
          const id = (Array.isArray(incoming) ? incoming[0] : incoming) ?? randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
      },
    }),
    PrismaModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
