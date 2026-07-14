import { Module } from '@nestjs/common';
import { MailboxController } from './mailbox.controller';
import { MailboxService } from './mailbox.service';
import { MailSenderService } from './mail-sender.service';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Relies on the globally-registered JwtModule (AuthModule) for JwtService.
@Module({
  controllers: [MailboxController],
  providers: [MailboxService, MailSenderService, JwtAuthGuard, WorkspaceGuard],
  exports: [MailboxService, MailSenderService],
})
export class MailboxModule {}
