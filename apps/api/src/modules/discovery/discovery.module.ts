import { Module } from '@nestjs/common';
import { BusinessDiscoveryService } from './business-discovery.service';
import { DiscoveryController } from './discovery.controller';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Relies on the globally-registered JwtModule (AuthModule) for JwtService.
@Module({
  controllers: [DiscoveryController],
  providers: [BusinessDiscoveryService, JwtAuthGuard, WorkspaceGuard],
  exports: [BusinessDiscoveryService],
})
export class DiscoveryModule {}
