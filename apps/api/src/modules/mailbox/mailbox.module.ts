import { Module } from '@nestjs/common';
import { MailboxController } from './mailbox.controller';
import { MailboxService } from './mailbox.service';
import { MailSenderService } from './mail-sender.service';
import { DomainAuthService } from './domain-auth.service';
import { MailboxHealthService } from './mailbox-health.service';
import { WarmupService } from './warmup.service';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Relies on the globally-registered JwtModule (AuthModule) for JwtService.
@Module({
  controllers: [MailboxController],
  providers: [
    MailboxService,
    MailSenderService,
    DomainAuthService,
    MailboxHealthService,
    WarmupService,
    JwtAuthGuard,
    WorkspaceGuard,
  ],
  exports: [MailboxService, MailSenderService, MailboxHealthService],
})
export class MailboxModule {}
