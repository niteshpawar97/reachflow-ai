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
  ListLeadsQuerySchema,
  UpdateLeadSchema,
  type CreateLeadDto,
  type ListLeadsQuery,
  type UpdateLeadDto,
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
