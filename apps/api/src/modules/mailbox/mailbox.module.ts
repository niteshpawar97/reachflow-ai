import { Module } from '@nestjs/common';
import { MailboxController } from './mailbox.controller';
import { MailboxService } from './mailbox.service';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Relies on the globally-registered JwtModule (AuthModule) for JwtService.
@Module({
  controllers: [MailboxController],
  providers: [MailboxService, JwtAuthGuard, WorkspaceGuard],
  exports: [MailboxService],
})
export class MailboxModule {}
