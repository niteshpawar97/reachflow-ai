import { Module } from '@nestjs/common';
import { SuppressionController } from './suppression.controller';
import { SuppressionService } from './suppression.service';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Relies on the globally-registered JwtModule (AuthModule) for JwtService.
@Module({
  controllers: [SuppressionController],
  providers: [SuppressionService, JwtAuthGuard, WorkspaceGuard],
  exports: [SuppressionService],
})
export class SuppressionModule {}
