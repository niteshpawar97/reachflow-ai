import { Module } from '@nestjs/common';
import { ContactScraperService } from './contact-scraper.service';

@Module({
  providers: [ContactScraperService],
  exports: [ContactScraperService],
})
export class ContactScraperModule {}
