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
import { WorkspaceRole } from '@reachflow/database';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Roles } from '../../common/roles.decorator';
import { WorkspaceGuard, type WorkspaceContext } from '../../common/workspace.guard';
import { WorkspaceCtx } from '../../common/workspace-context.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard, type AuthUser } from '../auth/guards/jwt-auth.guard';
import {
  CreateWorkspaceSchema,
  UpdateSettingsSchema,
  UpdateWorkspaceSchema,
  type CreateWorkspaceDto,
  type UpdateSettingsDto,
  type UpdateWorkspaceDto,
} from './dto/workspace.dto';
import { WorkspaceService } from './workspace.service';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaces: WorkspaceService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateWorkspaceSchema)) dto: CreateWorkspaceDto,
  ): Promise<unknown> {
    return this.workspaces.create(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<unknown> {
    return this.workspaces.listForUser(user.userId);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.workspaces.getForUser(user.userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateWorkspaceSchema)) dto: UpdateWorkspaceDto,
  ): Promise<unknown> {
    return this.workspaces.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.workspaces.softDelete(user.userId, id);
  }

  @Get(':id/settings')
  getSettings(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.workspaces.getSettings(user.userId, id);
  }

  @Patch(':id/settings')
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateSettingsSchema)) dto: UpdateSettingsDto,
  ): Promise<unknown> {
    return this.workspaces.updateSettings(user.userId, id, dto);
  }

  @Get(':id/members')
  members(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.workspaces.listMembers(user.userId, id);
  }

  // Demonstrates the reusable tenant-scoping stack (WorkspaceGuard resolves +
  // verifies membership -> req.workspace) plus @Roles RBAC. Future workspace-
  // scoped modules (leads, campaigns, ...) reuse this exact pattern.
  @Get(':id/context')
  @UseGuards(WorkspaceGuard)
  @Roles(WorkspaceRole.ADMIN)
  context(
    @Param('id', ParseUUIDPipe) _id: string,
    @WorkspaceCtx() ctx: WorkspaceContext | undefined,
  ): WorkspaceContext | undefined {
    return ctx;
  }
}
