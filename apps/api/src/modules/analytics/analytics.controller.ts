import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { WorkspaceId } from '../../common/workspace-context.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(
    @WorkspaceId() workspaceId: string,
    @Query('days') days?: string,
  ): Promise<unknown> {
    const n = Math.min(90, Math.max(7, Number(days) || 30));
    return this.analytics.overview(workspaceId, n);
  }

  @Get('funnel')
  funnel(@WorkspaceId() workspaceId: string): Promise<unknown> {
    return this.analytics.funnel(workspaceId);
  }

  @Get('campaigns')
  campaigns(@WorkspaceId() workspaceId: string): Promise<unknown> {
    return this.analytics.campaignBreakdown(workspaceId);
  }

  @Get('export.csv')
  async export(@WorkspaceId() workspaceId: string, @Res() res: Response): Promise<void> {
    const csv = await this.analytics.exportCsv(workspaceId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="reachflow-campaign-leads.csv"');
    res.status(200).send(csv);
  }
}
