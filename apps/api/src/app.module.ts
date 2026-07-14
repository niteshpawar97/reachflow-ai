import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { PrismaModule } from '@reachflow/database';
import { AiModule } from '@reachflow/ai';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { AuthModule } from './modules/auth/auth.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { HealthModule } from './modules/health/health.module';
import { LeadsModule } from './modules/leads/leads.module';
import { MailboxModule } from './modules/mailbox/mailbox.module';
import { SuppressionModule } from './modules/suppression/suppression.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';

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
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_TTL ?? 60000),
        limit: Number(process.env.RATE_LIMIT_MAX ?? 120),
      },
    ]),
    PrismaModule,
    AiModule,
    HealthModule,
    WorkspaceModule,
    AuthModule,
    CampaignsModule,
    DashboardModule,
    DiscoveryModule,
    LeadsModule,
    MailboxModule,
    SuppressionModule,
    TrackingModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
