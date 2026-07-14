import { Module } from '@nestjs/common';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

// Relies on the globally-registered JwtModule (AuthModule) for JwtService.
@Module({
  controllers: [LeadsController],
  providers: [LeadsService, JwtAuthGuard, WorkspaceGuard],
})
export class LeadsModule {}
