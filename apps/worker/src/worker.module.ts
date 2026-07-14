import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@reachflow/database';
import { DueSendSchedulerService } from './due-send-scheduler.service';
import { QueuedCampaignSendWorkerService } from './queued-campaign-send-worker.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    PrismaModule,
  ],
  providers: [DueSendSchedulerService, QueuedCampaignSendWorkerService],
})
export class WorkerModule {}
