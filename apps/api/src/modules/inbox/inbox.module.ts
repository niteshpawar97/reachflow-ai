import { Module } from '@nestjs/common';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MailboxModule } from '../mailbox/mailbox.module';
import { SuppressionModule } from '../suppression/suppression.module';
import { DealsModule } from '../deals/deals.module';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { ImapSyncService } from './imap-sync.service';
import { InboxAutoSyncService } from './inbox-auto-sync.service';
import { ReplyClassificationService } from './reply-classification.service';

@Module({
  imports: [MailboxModule, SuppressionModule, DealsModule],
  controllers: [InboxController],
  providers: [
    InboxService,
    ImapSyncService,
    InboxAutoSyncService,
    ReplyClassificationService,
    JwtAuthGuard,
    WorkspaceGuard,
  ],
  exports: [ImapSyncService],
})
export class InboxModule {}
