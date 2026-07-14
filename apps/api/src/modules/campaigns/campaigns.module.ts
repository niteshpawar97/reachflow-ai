import { Module } from '@nestjs/common';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MailboxModule } from '../mailbox/mailbox.module';
import { PersonalizationModule } from '../personalization/personalization.module';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignSenderService } from './campaign-sender.service';

@Module({
  imports: [MailboxModule, PersonalizationModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignSenderService, JwtAuthGuard, WorkspaceGuard],
  exports: [CampaignSenderService],
})
export class CampaignsModule {}
