import { Module } from '@nestjs/common';
import { StorefrontProductController } from './storefront-product.controller';
import { StorefrontProductService } from './storefront-product.service';
import { StorefrontCategoryController } from './storefront-category.controller';
import { StorefrontCategoryService } from './storefront-category.service';
import { StorefrontBrandController } from './storefront-brand.controller';
import { StorefrontBrandService } from './storefront-brand.service';
import { DatabaseSchemasModule } from 'src/database/schemas.module';

@Module({
  imports: [DatabaseSchemasModule],
  controllers: [
    StorefrontProductController,
    StorefrontCategoryController,
    StorefrontBrandController,
  ],
  providers: [
    StorefrontProductService,
    StorefrontCategoryService,
    StorefrontBrandService,
  ],
  exports: [StorefrontProductService, StorefrontCategoryService, StorefrontBrandService],
})
export class StorefrontCatalogModule {}
