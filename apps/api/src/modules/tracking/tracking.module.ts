import { Module } from '@nestjs/common';
import { PrismaModule } from '@reachflow/database';
import { SuppressionModule } from '../suppression/suppression.module';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

@Module({
  imports: [PrismaModule, SuppressionModule],
  controllers: [TrackingController],
  providers: [TrackingService],
})
export class TrackingModule {}