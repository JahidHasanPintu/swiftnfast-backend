import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { BannerService } from './banner.service';

@Public()
@Controller('api/v1/banner')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Get()
  async findAll(@Query() query: Record<string, any>) {
    const result = await this.bannerService.findAll(query);
    return {
      success: true,
      message: 'Banners retrieved successfully',
      data: result.banners,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const data = await this.bannerService.findById(id);
    return { success: true, message: 'Banner retrieved successfully', data };
  }
}
