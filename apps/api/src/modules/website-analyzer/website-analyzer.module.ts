import { Module } from '@nestjs/common';
import { WebsiteAnalyzerService } from './website-analyzer.service';

@Module({
  providers: [WebsiteAnalyzerService],
  exports: [WebsiteAnalyzerService],
})
export class WebsiteAnalyzerModule {}
