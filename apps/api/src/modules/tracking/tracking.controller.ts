import { Controller, Get, HttpCode, HttpStatus, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { TrackingService } from './tracking.service';

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64',
);

@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Get('open/:token.gif')
  @HttpCode(HttpStatus.OK)
  async open(@Param('token') token: string, @Res({ passthrough: true }) res: Response): Promise<Buffer> {
    await this.tracking.recordOpen(token);
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return TRANSPARENT_GIF;
  }

  @Get('click/:token')
  async click(
    @Param('token') token: string,
    @Query('u') target: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    await this.tracking.recordClick(token);

    if (!target || !/^https?:\/\//i.test(target)) {
      res.status(HttpStatus.NO_CONTENT).end();
      return;
    }

    res.redirect(HttpStatus.FOUND, target);
  }
}