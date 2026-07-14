import {
  Body,
  Controller,
  Get,
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
  AddActivitySchema,
  CreateDealSchema,
  UpdateDealSchema,
  UpdateStageSchema,
  type AddActivityDto,
  type CreateDealDto,
  type UpdateDealDto,
  type UpdateStageDto,
} from './dto/deal.dto';
import { DealsService } from './deals.service';

@Controller('deals')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string): Promise<unknown> {
    return this.deals.list(workspaceId);
  }

  @Get(':id')
  get(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.deals.get(workspaceId, id);
  }

  @Post()
  create(
    @WorkspaceId() workspaceId: string,
    @Body(new ZodValidationPipe(CreateDealSchema)) dto: CreateDealDto,
  ): Promise<unknown> {
    return this.deals.create(workspaceId, dto);
  }

  @Patch(':id')
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateDealSchema)) dto: UpdateDealDto,
  ): Promise<unknown> {
    return this.deals.update(workspaceId, id, dto);
  }

  @Patch(':id/stage')
  updateStage(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateStageSchema)) dto: UpdateStageDto,
  ): Promise<unknown> {
    return this.deals.updateStage(workspaceId, id, dto.stage);
  }

  @Post(':id/activities')
  addActivity(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AddActivitySchema)) dto: AddActivityDto,
  ): Promise<unknown> {
    return this.deals.addActivity(workspaceId, id, dto.type, dto.body);
  }

  @Post('from-reply/:campaignLeadId')
  convertReplyToDeal(
    @WorkspaceId() workspaceId: string,
    @Param('campaignLeadId', ParseUUIDPipe) campaignLeadId: string,
  ): Promise<unknown> {
    return this.deals.convertReplyToDeal(workspaceId, campaignLeadId);
  }
}
