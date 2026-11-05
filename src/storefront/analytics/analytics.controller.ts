import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { AnalyticsService } from './analytics.service';

/**
 * Public, read-only analytics bootstrap used by the storefront SSR layer.
 * Only enabled providers are returned.
 */
@Public()
@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  async getConfig() {
    const data = await this.analyticsService.getPublicConfig();
    return { success: true, message: 'Analytics config retrieved', data };
  }

  @Get('settings')
  async getSettings() {
    const data = await this.analyticsService.getPublicConfig();
    return { success: true, message: 'Analytics config retrieved', data };
  }
}
