import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getOverview(startDate, endDate);
  }

  @Get('revenue-chart')
  async getRevenueChart(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy: 'day' | 'week' | 'month' = 'day',
  ) {
    return this.dashboardService.getRevenueChart(startDate, endDate, groupBy);
  }

  @Get('order-status-chart')
  async getOrderStatusChart(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getOrderStatusChart(startDate, endDate);
  }

  @Get('top-products')
  async getTopProducts(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit) || 10;
    return this.dashboardService.getTopProducts(
      startDate,
      endDate,
      parsedLimit,
    );
  }

  @Get('top-customers')
  async getTopCustomers(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit) || 10;
    return this.dashboardService.getTopCustomers(
      startDate,
      endDate,
      parsedLimit,
    );
  }

  @Get('sales-by-country')
  async getSalesByCountry(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getSalesByCountry(startDate, endDate);
  }

  @Get('recent-orders')
  async getRecentOrders(@Query('limit') limit = 10) {
    return this.dashboardService.getRecentOrders(limit);
  }

  @Get('profit-analysis')
  async getProfitAnalysis(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getProfitAnalysis(startDate, endDate);
  }
}
