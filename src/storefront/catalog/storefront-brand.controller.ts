import { Controller, Get, Param } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { StorefrontBrandService } from './storefront-brand.service';

@Public()
@Controller('api/v1/brands')
export class StorefrontBrandController {
  constructor(private readonly brandService: StorefrontBrandService) {}

  @Get()
  async findAll() {
    const data = await this.brandService.findAll();
    return { success: true, message: 'Brands retrieved successfully', data };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const data = await this.brandService.findById(id);
    return { success: true, message: 'Brand retrieved successfully', data };
  }
}
