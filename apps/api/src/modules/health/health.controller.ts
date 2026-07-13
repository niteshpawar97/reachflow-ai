import { Body, Controller, Get, Post, UsePipes } from '@nestjs/common';
import { PrismaService } from '@reachflow/database';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

// Demonstrates Zod-backed validation → standard 422 on bad input.
const EchoSchema = z.object({
  message: z.string().min(1, 'message is required'),
  count: z.number().int().positive().max(100).optional(),
});
type EchoDto = z.infer<typeof EchoSchema>;

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{
    status: string;
    service: string;
    db: 'up' | 'down';
    timestamp: string;
    uptime: number;
  }> {
    let db: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }

    return {
      status: db === 'up' ? 'ok' : 'degraded',
      service: 'reachflow-api',
      db,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Post('echo')
  @UsePipes(new ZodValidationPipe(EchoSchema))
  echo(@Body() body: EchoDto): { echoed: EchoDto } {
    return { echoed: body };
  }
}
