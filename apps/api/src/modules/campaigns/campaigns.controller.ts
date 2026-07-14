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
  AttachLeadsSchema,
  CampaignStepSchema,
  CreateCampaignSchema,
  UpdateCampaignStepSchema,
  UpdateCampaignSchema,
  type AttachLeadsDto,
  type CampaignStepDto,
  type CreateCampaignDto,
  type UpdateCampaignStepDto,
  type UpdateCampaignDto,
} from './dto/campaign.dto';
import { CampaignsService } from './campaigns.service';
import { CampaignSenderService } from './campaign-sender.service';

@Controller('campaigns')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly sender: CampaignSenderService,
  ) {}

  @Get()
  list(@WorkspaceId() workspaceId: string): Promise<unknown> {
    return this.campaigns.list(workspaceId);
  }

  @Post()
  create(
    @WorkspaceId() workspaceId: string,
    @Body(new ZodValidationPipe(CreateCampaignSchema)) dto: CreateCampaignDto,
  ): Promise<unknown> {
    return this.campaigns.create(workspaceId, dto);
  }

  @Get(':id')
  get(@WorkspaceId() workspaceId: string, @Param('id', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.campaigns.get(workspaceId, id);
  }

  @Patch(':id')
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateCampaignSchema)) dto: UpdateCampaignDto,
  ): Promise<unknown> {
    return this.campaigns.update(workspaceId, id, dto);
  }

  @Get(':id/steps')
  steps(@WorkspaceId() workspaceId: string, @Param('id', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.campaigns.listSteps(workspaceId, id);
  }

  @Post(':id/steps')
  addStep(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CampaignStepSchema)) dto: CampaignStepDto,
  ): Promise<unknown> {
    return this.campaigns.addStep(workspaceId, id, dto);
  }

  @Patch(':id/steps/:stepId')
  updateStep(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body(new ZodValidationPipe(UpdateCampaignStepSchema)) dto: UpdateCampaignStepDto,
  ): Promise<unknown> {
    return this.campaigns.updateStep(workspaceId, id, stepId, dto);
  }

  @Delete(':id/steps/:stepId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteStep(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
  ): Promise<void> {
    await this.campaigns.deleteStep(workspaceId, id, stepId);
  }

  @Post(':id/leads')
  attachLeads(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AttachLeadsSchema)) dto: AttachLeadsDto,
  ): Promise<unknown> {
    return this.campaigns.attachLeads(workspaceId, id, dto);
  }

  @Get(':id/leads')
  leads(@WorkspaceId() workspaceId: string, @Param('id', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.campaigns.listCampaignLeads(workspaceId, id);
  }

  @Post(':id/launch')
  launch(@WorkspaceId() workspaceId: string, @Param('id', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.campaigns.launch(workspaceId, id);
  }

  @Post(':id/pause')
  pause(@WorkspaceId() workspaceId: string, @Param('id', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.campaigns.pause(workspaceId, id);
  }

  @Post(':id/resume')
  resume(@WorkspaceId() workspaceId: string, @Param('id', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.campaigns.resume(workspaceId, id);
  }

  @Post(':id/stop')
  stop(@WorkspaceId() workspaceId: string, @Param('id', ParseUUIDPipe) id: string): Promise<unknown> {
    return this.campaigns.stop(workspaceId, id);
  }

  @Post('due-sends/plan')
  planDueSends(@WorkspaceId() workspaceId: string): Promise<unknown> {
    return this.campaigns.planDueSends(workspaceId);
  }

  /** Send all currently-due campaign emails inline (no queue / Redis-free). */
  @Post('due-sends/run')
  runDueSends(@WorkspaceId() workspaceId: string): Promise<unknown> {
    return this.sender.processDue(workspaceId);
  }
}
