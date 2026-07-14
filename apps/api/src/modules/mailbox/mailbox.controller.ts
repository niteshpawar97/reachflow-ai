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
  UpdateMailboxSchema,
  type CreateMailboxDto,
  type UpdateMailboxDto,
} from './dto/mailbox.dto';
import { MailboxService } from './mailbox.service';

// Workspace-scoped via the X-Workspace-Id header (resolved by WorkspaceGuard).
@Controller('mailboxes')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class MailboxController {
  constructor(private readonly mailboxes: MailboxService) {}

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
