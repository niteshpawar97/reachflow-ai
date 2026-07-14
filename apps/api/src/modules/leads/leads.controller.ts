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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { WorkspaceId } from '../../common/workspace-context.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateLeadSchema,
  BulkEmailSchema,
  ListLeadsQuerySchema,
  UpdateLeadSchema,
  VariantsSchema,
  type CreateLeadDto,
  type BulkEmailDto,
  type ListLeadsQuery,
  type UpdateLeadDto,
  type VariantsDto,
} from './dto/lead.dto';
import { ImportLeadsSchema, type ImportLeadsDto } from './dto/import.dto';
import { LeadsService } from './leads.service';

// Workspace-scoped via the X-Workspace-Id header (resolved by WorkspaceGuard).
@Controller('leads')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  create(
    @WorkspaceId() workspaceId: string,
    @Body(new ZodValidationPipe(CreateLeadSchema)) dto: CreateLeadDto,
  ): Promise<unknown> {
    return this.leads.create(workspaceId, dto);
  }

  @Post('import')
  import(
    @WorkspaceId() workspaceId: string,
    @Body(new ZodValidationPipe(ImportLeadsSchema)) dto: ImportLeadsDto,
  ): Promise<unknown> {
    return this.leads.importCsv(workspaceId, dto.csv, dto.mapping);
  }

  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @Query(new ZodValidationPipe(ListLeadsQuerySchema)) query: ListLeadsQuery,
  ): Promise<unknown> {
    return this.leads.list(workspaceId, query);
  }

  @Get(':id')
  get(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.leads.get(workspaceId, id);
  }

  @Post(':id/audit')
  audit(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.leads.auditLead(workspaceId, id);
  }

  @Get(':id/audit')
  latestAudit(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.leads.getLatestAudit(workspaceId, id);
  }

  @Post(':id/audit/summary')
  summarizeAudit(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.leads.summarizeAudit(workspaceId, id);
  }

  @Post(':id/verify')
  verify(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.leads.verifyLeadEmail(workspaceId, id);
  }

  @Post(':id/email')
  generateEmail(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.leads.generateEmail(workspaceId, id);
  }

  @Post('email/batch')
  generateEmailBatch(
    @WorkspaceId() workspaceId: string,
    @Body(new ZodValidationPipe(BulkEmailSchema)) dto: BulkEmailDto,
  ): Promise<unknown> {
    return this.leads.generateEmailBatch(workspaceId, dto.leadIds);
  }

  @Get(':id/email')
  listEmails(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.leads.listEmails(workspaceId, id);
  }

  @Post(':id/email/followup')
  generateFollowUp(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.leads.generateFollowUp(workspaceId, id);
  }

  @Post(':id/email/variants')
  generateVariants(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(VariantsSchema)) dto: VariantsDto,
  ): Promise<unknown> {
    return this.leads.generateVariants(workspaceId, id, dto.count);
  }

  @Post(':id/email/:emailId/approve')
  approveEmail(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('emailId', ParseUUIDPipe) emailId: string,
  ): Promise<unknown> {
    return this.leads.approveEmail(workspaceId, id, emailId);
  }

  @Post(':id/email/:emailId/reject')
  rejectEmail(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('emailId', ParseUUIDPipe) emailId: string,
  ): Promise<unknown> {
    return this.leads.rejectEmail(workspaceId, id, emailId);
  }

  @Post(':id/score')
  score(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.leads.scoreLead(workspaceId, id);
  }

  @Get(':id/score')
  getScore(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.leads.getScore(workspaceId, id);
  }

  @Patch(':id')
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateLeadSchema)) dto: UpdateLeadDto,
  ): Promise<unknown> {
    return this.leads.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.leads.softDelete(workspaceId, id);
  }
}
