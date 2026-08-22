import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AdminCatalogService } from './admin-catalog.service';

/**
 * pfu2 admin CRUD surface (merge plan §5), served under /api/v1 and guarded
 * by the SwiftNFast admin JWT (global guard — no @Public() here).
 * Response envelopes mirror pfu2-backend-v2 exactly.
 */
@UseGuards(JwtAuthGuard)
@Controller('api/v1')
export class AdminCatalogController {
  constructor(private readonly adminCatalogService: AdminCatalogService) {}

  // =========================================================================
  // Categories
  // =========================================================================

  @Post('categories')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'image', maxCount: 1 },
      { name: 'bannerImage', maxCount: 1 },
    ]),
  )
  async createCategory(
    @Body() body: any,
    @UploadedFiles() files: Record<string, any[]>,
  ) {
    const data = await this.adminCatalogService.createCategory(body, files);
    return {
      success: true,
      message: 'Category created successfully',
      data,
    };
  }

  @Patch('categories/:id')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'image', maxCount: 1 },
      { name: 'bannerImage', maxCount: 1 },
    ]),
  )
  async updateCategory(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() files: Record<string, any[]>,
  ) {
    const data = await this.adminCatalogService.updateCategory(id, body, files);
    return {
      success: true,
      message: 'Category updated successfully',
      data,
    };
  }

  @Delete('categories/:id')
  async removeCategory(@Param('id') id: string) {
    return this.adminCatalogService.removeCategory(id);
  }

  // =========================================================================
  // Brands
  // =========================================================================

  @Post('brands')
  @UseInterceptors(FileInterceptor('image'))
  async createBrand(@Body() body: any, @UploadedFile() file: any) {
    const data = await this.adminCatalogService.createBrand(body, file);
    return {
      success: true,
      message: 'Brand created successfully',
      data,
    };
  }

  @Patch('brands/:id')
  @UseInterceptors(FileInterceptor('image'))
  async updateBrand(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file: any,
  ) {
    const data = await this.adminCatalogService.updateBrand(id, body, file);
    return {
      success: true,
      message: 'Brand updated successfully',
      data,
    };
  }

  @Delete('brands/:id')
  async removeBrand(@Param('id') id: string) {
    return this.adminCatalogService.removeBrand(id);
  }

  // =========================================================================
  // Products
  // =========================================================================

  @Post('products')
  @UseInterceptors(FilesInterceptor('images'))
  async createProduct(@Body() body: any, @UploadedFiles() files: any[]) {
    const data = await this.adminCatalogService.createProduct(body, files);
    return {
      success: true,
      message: 'Product created successfully',
      data,
    };
  }

  @Patch('products/:id')
  @UseInterceptors(FilesInterceptor('images'))
  async updateProduct(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() files: any[],
  ) {
    const data = await this.adminCatalogService.updateProduct(id, body, files);
    return {
      success: true,
      message: 'Product updated successfully',
      data,
    };
  }

  @Delete('products/:id')
  async removeProduct(@Param('id') id: string) {
    return this.adminCatalogService.removeProduct(id);
  }

  // =========================================================================
  // Offers
  // =========================================================================

  @Post('offers')
  @UseInterceptors(FileInterceptor('image'))
  async createOffer(@Body() body: any, @UploadedFile() file: any) {
    const data = await this.adminCatalogService.createOffer(body, file);
    return {
      success: true,
      message: 'Offer created successfully',
      data,
    };
  }

  @Patch('offers/:id')
  @UseInterceptors(FileInterceptor('image'))
  async updateOffer(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file: any,
  ) {
    const data = await this.adminCatalogService.updateOffer(id, body, file);
    return {
      success: true,
      message: 'Offer updated successfully',
      data,
    };
  }

  @Delete('offers/:id')
  async removeOffer(@Param('id') id: string) {
    return this.adminCatalogService.removeOffer(id);
  }

  // =========================================================================
  // Shopping partners
  // =========================================================================

  @Post('partners')
  @UseInterceptors(FileInterceptor('image'))
  async createPartner(@Body() body: any, @UploadedFile() file: any) {
    const data = await this.adminCatalogService.createPartner(body, file);
    return {
      success: true,
      message: 'Partners created successfully',
      data,
    };
  }

  @Patch('partners/:id')
  @UseInterceptors(FileInterceptor('image'))
  async updatePartner(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file: any,
  ) {
    const data = await this.adminCatalogService.updatePartner(id, body, file);
    return {
      success: true,
      message: 'Partners updated successfully',
      data,
    };
  }

  @Delete('partners/:id')
  async removePartner(@Param('id') id: string) {
    return this.adminCatalogService.removePartner(id);
  }

  // =========================================================================
  // Banner
  // =========================================================================

  @Post('banner')
  @UseInterceptors(FileInterceptor('image'))
  async createBanner(@Body() body: any, @UploadedFile() file: any) {
    const data = await this.adminCatalogService.createBanner(body, file);
    return {
      success: true,
      message: 'Banner created successfully',
      data,
    };
  }

  @Patch('banner/:id/order')
  async updateBannerOrder(
    @Param('id') id: string,
    @Body() body: { direction?: string },
  ) {
    return this.adminCatalogService.updateBannerOrder(id, body.direction || '');
  }

  @Patch('banner/:id')
  @UseInterceptors(FileInterceptor('image'))
  async updateBanner(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file: any,
  ) {
    const data = await this.adminCatalogService.updateBanner(id, body, file);
    return {
      success: true,
      message: 'Banner updated successfully',
      data,
    };
  }

  @Delete('banner/:id')
  async removeBanner(@Param('id') id: string) {
    return this.adminCatalogService.removeBanner(id);
  }

  // =========================================================================
  // FAQs
  // =========================================================================

  @Post('faqs/reorder')
  async reorderFaqs(@Body() body: { faqs?: { id: string; order: number }[] }) {
    return this.adminCatalogService.reorderFaqs(body.faqs || []);
  }

  @Post('faqs')
  async createFaq(@Body() body: any) {
    const data = await this.adminCatalogService.createFaq(body);
    return { success: true, message: 'FAQ created', data };
  }

  @Put('faqs/:id')
  async updateFaq(@Param('id') id: string, @Body() body: any) {
    const data = await this.adminCatalogService.updateFaq(id, body);
    return { success: true, message: 'FAQ updated', data };
  }

  @Patch('faqs/:id/order')
  async updateFaqOrder(
    @Param('id') id: string,
    @Body() body: { direction?: string },
  ) {
    return this.adminCatalogService.updateFaqOrder(id, body.direction || '');
  }

  @Delete('faqs/:id')
  async removeFaq(@Param('id') id: string) {
    return this.adminCatalogService.removeFaq(id);
  }

  // =========================================================================
  // Settings
  // =========================================================================

  /** Upsert by key — mirrors the legacy non-enveloped response. */
  @Patch('settings')
  async upsertSetting(@Res() res: Response, @Body() body: any) {
    try {
      const { created, setting } = await this.adminCatalogService.upsertSetting(
        body,
      );
      if (created) {
        return res.status(201).json({
          message: 'Setting created successfully',
          setting,
        });
      }
      return res.status(200).json({
        message: 'Setting updated successfully',
        setting,
      });
    } catch (error: any) {
      const status = error?.status ? Number(error.status) : 500;
      return res.status(status === 400 ? 400 : 500).json({
        message: error?.message || 'Internal server error',
      });
    }
  }

  @Delete('settings/:key')
  async removeSetting(@Param('key') key: string) {
    return this.adminCatalogService.removeSetting(key);
  }
}
