import { Module } from '@nestjs/common';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WebsiteAnalyzerModule } from '../website-analyzer/website-analyzer.module';
import { LeadScoringModule } from '../lead-scoring/lead-scoring.module';
import { EmailVerificationModule } from '../email-verification/email-verification.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

// Relies on the globally-registered JwtModule (AuthModule) for JwtService.
@Module({
  imports: [WebsiteAnalyzerModule, LeadScoringModule, EmailVerificationModule],
  controllers: [LeadsController],
  providers: [LeadsService, JwtAuthGuard, WorkspaceGuard],
})
export class LeadsModule {}
