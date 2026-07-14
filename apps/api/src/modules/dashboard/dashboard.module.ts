import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Relies on the globally-registered JwtModule (AuthModule) for JwtService.
@Module({
  controllers: [DashboardController],
  providers: [DashboardService, JwtAuthGuard, WorkspaceGuard],
})
export class DashboardModule {}
