import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { WorkspaceId } from '../../common/workspace-context.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SendReplySchema, type SendReplyDto } from './dto/inbox.dto';
import { InboxService } from './inbox.service';
import { ImapSyncService } from './imap-sync.service';

@Controller('inbox')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class InboxController {
  constructor(
    private readonly inbox: InboxService,
    private readonly imapSync: ImapSyncService,
  ) {}

  @Get('threads')
  listThreads(@WorkspaceId() workspaceId: string): Promise<unknown> {
    return this.inbox.listThreads(workspaceId);
  }

  @Get('unmatched')
  listUnmatched(@WorkspaceId() workspaceId: string): Promise<unknown> {
    return this.inbox.listUnmatched(workspaceId);
  }

  @Get('threads/:campaignLeadId')
  getThread(
    @WorkspaceId() workspaceId: string,
    @Param('campaignLeadId', ParseUUIDPipe) campaignLeadId: string,
  ): Promise<unknown> {
    return this.inbox.getThread(workspaceId, campaignLeadId);
  }

  @Post('threads/:campaignLeadId/reply')
  sendReply(
    @WorkspaceId() workspaceId: string,
    @Param('campaignLeadId', ParseUUIDPipe) campaignLeadId: string,
    @Body(new ZodValidationPipe(SendReplySchema)) dto: SendReplyDto,
  ): Promise<unknown> {
    return this.inbox.sendReply(workspaceId, campaignLeadId, dto.body);
  }

  @Post('messages/:id/suggest-reply')
  suggestReply(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.inbox.suggestReply(workspaceId, id);
  }

  @Post('sync/:mailboxId')
  sync(
    @WorkspaceId() workspaceId: string,
    @Param('mailboxId', ParseUUIDPipe) mailboxId: string,
  ): Promise<unknown> {
    return this.imapSync.syncMailbox(workspaceId, mailboxId);
  }
}
