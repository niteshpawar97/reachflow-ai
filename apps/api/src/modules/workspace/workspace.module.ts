import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';

// Relies on the globally-registered JwtModule (see AuthModule) for JwtService.
@Module({
  controllers: [WorkspaceController],
  providers: [WorkspaceService, JwtAuthGuard],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
