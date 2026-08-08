import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { PartnersService } from './partners.service';

@Public()
@Controller('api/v1/partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  async findAll(@Query() query: Record<string, any>) {
    const result = await this.partnersService.findAll(query);
    return {
      success: true,
      message: 'Partners retrieved successfully',
      data: result.partners,
      meta: {
        page: result.page,
        limit: result.limit,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      },
    };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const data = await this.partnersService.findById(id);
    return { success: true, message: 'Partners retrieved successfully', data };
  }
}
