import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { OffersService } from './offers.service';

@Public()
@Controller('api/v1/offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  async findAll(@Query() query: Record<string, any>) {
    const result = await this.offersService.findAll(query);
    return {
      success: true,
      data: result.offers,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  @Get('name/:name')
  async findByName(@Param('name') name: string) {
    const data = await this.offersService.findByName(name);
    return { success: true, data };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const data = await this.offersService.findById(id);
    return { success: true, data };
  }
}
