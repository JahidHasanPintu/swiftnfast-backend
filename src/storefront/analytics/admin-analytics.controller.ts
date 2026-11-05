import {
  Body,
  Controller,
  Get,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { GaReportService } from './ga-report.service';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/admin/analytics')
export class AdminAnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly gaReportService: GaReportService,
  ) {}

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

  @Get('overview')
  async getOverview(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('days') days?: string,
  ) {
    const data = await this.gaReportService.getOverview({
      startDate,
      endDate,
      days: days ? Number(days) : undefined,
    });
    return { success: true, message: 'Analytics overview retrieved', data };
  }
}
