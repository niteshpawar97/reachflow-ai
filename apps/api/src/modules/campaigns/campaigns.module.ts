import { Module } from '@nestjs/common';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MailboxModule } from '../mailbox/mailbox.module';
import { PersonalizationModule } from '../personalization/personalization.module';
import { SuppressionModule } from '../suppression/suppression.module';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignSenderService } from './campaign-sender.service';
import { CampaignAutoSendService } from './campaign-auto-send.service';

@Module({
  imports: [MailboxModule, PersonalizationModule, SuppressionModule],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    CampaignSenderService,
    CampaignAutoSendService,
    JwtAuthGuard,
    WorkspaceGuard,
  ],
  exports: [CampaignSenderService],
})
export class CampaignsModule {}
