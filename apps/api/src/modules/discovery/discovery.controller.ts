import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { WorkspaceId } from '../../common/workspace-context.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  DiscoveryImportSchema,
  DiscoverySearchSchema,
  type DiscoveryImportDto,
  type DiscoverySearchDto,
} from './dto/discovery.dto';
import {
  BusinessDiscoveryService,
  DISCOVERY_CATEGORIES,
  type DiscoveredBusiness,
} from './business-discovery.service';
import { GoogleMapsDiscoveryService } from './google-maps-discovery.service';

@Controller('discovery')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class DiscoveryController {
  constructor(
    private readonly discovery: BusinessDiscoveryService,
    private readonly googleMaps: GoogleMapsDiscoveryService,
  ) {}

  @Get('categories')
  categories(): { categories: string[] } {
    return { categories: DISCOVERY_CATEGORIES };
  }

  @Get('detect-location')
  detectLocation() {
    return this.discovery.detectLocation();
  }

  @Post('search')
  search(
    @WorkspaceId() _workspaceId: string,
    @Body(new ZodValidationPipe(DiscoverySearchSchema)) dto: DiscoverySearchDto,
  ): Promise<unknown> {
    return dto.source === 'GOOGLE_MAPS'
      ? this.googleMaps.discover(dto.category, dto.location, dto.limit)
      : this.discovery.discover(dto.category, dto.location, dto.limit);
  }

  @Post('import')
  import(
    @WorkspaceId() workspaceId: string,
    @Body(new ZodValidationPipe(DiscoveryImportSchema)) dto: DiscoveryImportDto,
  ): Promise<unknown> {
    return this.discovery.importAsLeads(workspaceId, dto.businesses as DiscoveredBusiness[]);
  }
}
