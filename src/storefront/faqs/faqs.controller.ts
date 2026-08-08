import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { FaqsService } from './faqs.service';

@Public()
@Controller('api/v1/faqs')
export class FaqsController {
  constructor(private readonly faqsService: FaqsService) {}

  @Get()
  async findAll(@Query() query: Record<string, any>) {
    const result = await this.faqsService.findAll(query);
    return {
      success: true,
      faqs: result.faqs,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
    };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const data = await this.faqsService.findById(id);
    return { success: true, data };
  }
}
