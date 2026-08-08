import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { StorefrontProductService } from './storefront-product.service';

@Public()
@Controller('api/v1/products')
export class StorefrontProductController {
  constructor(private readonly productService: StorefrontProductService) {}

  @Get()
  async findAll(@Query() query: Record<string, any>) {
    const result = await this.productService.findAll(query);
    return {
      success: true,
      message: 'Products retrieved successfully',
      data: result.products,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  @Get('search')
  async search(@Query('q') q?: string) {
    if (!q || String(q).length < 2) {
      return { success: false, message: 'Search query `q` is required', data: [] };
    }
    const data = await this.productService.search(q);
    return { success: true, message: 'Search results', data };
  }

  @Get('brands')
  async brands(@Query('category') category?: string) {
    const data = await this.productService.findUniqueBrands(category);
    return { success: true, message: 'Unique brands retrieved successfully', data };
  }

  @Get('slug/:slug')
  async bySlug(@Param('slug') slug: string) {
    const data = await this.productService.findBySlug(slug);
    return { success: true, message: 'Product retrieved successfully', data };
  }

  @Get(':id')
  async byId(@Param('id') id: string) {
    const data = await this.productService.findById(id);
    return { success: true, message: 'Product retrieved successfully', data };
  }
}
