import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { WorkspaceId } from '../../common/workspace-context.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddSuppressionSchema, type AddSuppressionDto } from './dto/suppression.dto';
import { SuppressionService } from './suppression.service';

@Controller('suppressions')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class SuppressionController {
  constructor(private readonly suppressions: SuppressionService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string): Promise<unknown> {
    return this.suppressions.list(workspaceId);
  }

  @Post()
  add(
    @WorkspaceId() workspaceId: string,
    @Body(new ZodValidationPipe(AddSuppressionSchema)) dto: AddSuppressionDto,
  ): Promise<void> {
    return this.suppressions.addManual(workspaceId, dto.email, dto.note);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.suppressions.remove(workspaceId, id);
  }
}
