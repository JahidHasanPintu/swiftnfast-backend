import { Controller, Get, Query } from '@nestjs/common';
import { SearchPurchaseService } from './search-purchase.service';

@Controller('search-purchase')
export class SearchPurchaseController {
  constructor(private readonly searchPurchaseService: SearchPurchaseService) {}

  @Get('search')
  async getAllPurchases(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 10,
    @Query('searchTerm') searchTerm?: string,
  ) {
    return this.searchPurchaseService.searchPurchase(
      page,
      pageSize,
      searchTerm,
    );
  }
}
