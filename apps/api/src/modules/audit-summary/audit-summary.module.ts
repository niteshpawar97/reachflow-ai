import { Module } from '@nestjs/common';
import { AuditSummaryService } from './audit-summary.service';

// AiService comes from the global AiModule (libs/ai) — no import needed here.
@Module({
  providers: [AuditSummaryService],
  exports: [AuditSummaryService],
})
export class AuditSummaryModule {}
