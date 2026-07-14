import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Relies on the globally-registered JwtModule (AuthModule) for JwtService.
@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, JwtAuthGuard, WorkspaceGuard],
})
export class AnalyticsModule {}
