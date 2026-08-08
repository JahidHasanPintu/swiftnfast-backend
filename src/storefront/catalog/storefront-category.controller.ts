import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { StorefrontCategoryService } from './storefront-category.service';

@Public()
@Controller('api/v1/categories')
export class StorefrontCategoryController {
  constructor(private readonly categoryService: StorefrontCategoryService) {}

  @Get()
  async findAll(@Query() query: Record<string, any>) {
    const result = await this.categoryService.findAll(query);
    return {
      success: true,
      message: 'Categories retrieved successfully',
      data: result.categories,
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
    const data = await this.categoryService.findById(id);
    return { success: true, message: 'Category retrieved successfully', data };
  }
}
