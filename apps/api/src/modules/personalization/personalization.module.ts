import { Module } from '@nestjs/common';
import { PersonalizationService } from './personalization.service';

// AiService comes from the global AiModule (libs/ai) — no import needed here.
@Module({
  providers: [PersonalizationService],
  exports: [PersonalizationService],
})
export class PersonalizationModule {}
