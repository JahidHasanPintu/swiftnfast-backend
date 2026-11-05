import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('settings')
  async getSettings() {
    const data = await this.analyticsService.getConfig();
    return { success: true, message: 'Analytics config retrieved', data };
  }

  @Put('settings')
  async updateSettings(@Body() body: Record<string, any>) {
    const data = await this.analyticsService.updateConfig(body);
    return { success: true, message: 'Analytics config saved', data };
  }

  @Patch('settings')
  async patchSettings(@Body() body: Record<string, any>) {
    const data = await this.analyticsService.updateConfig(body);
    return { success: true, message: 'Analytics config saved', data };
  }
}
