import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { SearchOrdersService } from './search-orders.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
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
