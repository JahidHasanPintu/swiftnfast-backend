import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { SearchOrdersService } from './search-orders.service';

@Controller('search-orders')
export class SearchOrdersController {
  constructor(private readonly searchOrderService: SearchOrdersService) {}

  @Get('search')
  async searchOrders(
    @Query('query') query: string,
    @Query('page', ParseIntPipe) page = 1,
    @Query('pageSize', ParseIntPipe) pageSize = 10,
  ) {
    return this.searchOrderService.searchOrders(query, page, pageSize);
  }
}
