import { Controller, Get, Query } from '@nestjs/common';
import { SearchOrdersService } from './search-orders.service';

@Controller('search-orders')
export class SearchOrdersController {
    constructor(private readonly searchOrderService: SearchOrdersService) { }



    @Get('search')
    async searchOrders(
        @Query('query') query: string,
        @Query('page') page: number = 1,
        @Query('pageSize') pageSize: number = 10,
    ) {
        return this.searchOrderService.searchOrders(query, page, pageSize);
    }


}
