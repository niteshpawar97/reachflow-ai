import { Module } from '@nestjs/common';
import { LeadScoringService } from './lead-scoring.service';

@Module({
  providers: [LeadScoringService],
  exports: [LeadScoringService],
})
export class LeadScoringModule {}
