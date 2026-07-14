import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { WorkspaceId } from '../../common/workspace-context.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateMailboxSchema,
  TestSendSchema,
  UpdateMailboxSchema,
  type CreateMailboxDto,
  type TestSendDto,
  type UpdateMailboxDto,
} from './dto/mailbox.dto';
import { MailboxService } from './mailbox.service';
import { MailSenderService } from './mail-sender.service';
import { DomainAuthService, type DomainAuthReport } from './domain-auth.service';
import { MailboxHealthService } from './mailbox-health.service';

// Workspace-scoped via the X-Workspace-Id header (resolved by WorkspaceGuard).
@Controller('mailboxes')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class MailboxController {
  constructor(
    private readonly mailboxes: MailboxService,
    private readonly sender: MailSenderService,
    private readonly domainAuth: DomainAuthService,
    private readonly health: MailboxHealthService,
  ) {}

  @Post(':id/domain-auth/check')
  checkDomainAuth(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DomainAuthReport> {
    return this.domainAuth.check(workspaceId, id);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reactivate(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.mailboxes.get(workspaceId, id); // 404s if not in this workspace
    await this.health.reactivate(id);
  }

  @Post(':id/test')
  test(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(TestSendSchema)) dto: TestSendDto,
  ): Promise<unknown> {
    return this.sender.sendTest(workspaceId, id, dto.to);
  }

  @Post()
  create(
    @WorkspaceId() workspaceId: string,
    @Body(new ZodValidationPipe(CreateMailboxSchema)) dto: CreateMailboxDto,
  ): Promise<unknown> {
    return this.mailboxes.create(workspaceId, dto);
  }

  @Get()
  list(@WorkspaceId() workspaceId: string): Promise<unknown> {
    return this.mailboxes.list(workspaceId);
  }

  @Get(':id')
  get(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.mailboxes.get(workspaceId, id);
  }

  @Patch(':id')
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateMailboxSchema)) dto: UpdateMailboxDto,
  ): Promise<unknown> {
    return this.mailboxes.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.mailboxes.remove(workspaceId, id);
  }
}
