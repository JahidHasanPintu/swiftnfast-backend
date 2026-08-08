import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UploadedFile,
} from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { StorefrontOptionalAuthGuard, StorefrontAuthGuard } from '../auth/storefront-auth.guards';
import { StorefrontRequest } from '../auth/storefront-request.interface';
import { CartService } from './cart.service';

@Public()
@Controller('api/v1')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  private identity(req: StorefrontRequest) {
    return { userId: req.user?.userId, guestToken: req.guestToken };
  }

  @Get('mycart')
  @UseGuards(StorefrontOptionalAuthGuard)
  async myCart(@Req() req: StorefrontRequest) {
    const data = await this.cartService.getMyCart(this.identity(req));
    return { success: true, data };
  }

  @Post('mycart/add-item')
  @UseGuards(StorefrontOptionalAuthGuard)
  async addItem(@Req() req: StorefrontRequest, @Body() body: any) {
    const data = await this.cartService.addItem(this.identity(req), body);
    return { success: true, message: 'Item added to cart', data };
  }

  @Post('mycart/merge')
  @UseGuards(StorefrontAuthGuard)
  async merge(@Req() req: StorefrontRequest) {
    await this.cartService.mergeGuestToUser(req.user!.userId, req.guestToken);
    const data = await this.cartService.getMyCart({ userId: req.user!.userId });
    return { success: true, message: 'Cart merged successfully', data };
  }

  @Get('carts/requested')
  @UseGuards(StorefrontAuthGuard)
  async requested(@Query() query: any) {
    const result = await this.cartService.getRequestedCarts(query);
    return {
      success: true,
      data: result.carts,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
      },
    };
  }

  @Get('carts/requested-cart-count')
  @UseGuards(StorefrontAuthGuard)
  async requestedCount() {
    const data = await this.cartService.getRequestedCartCount();
    return { success: true, data };
  }

  @Get('carts/:id')
  @UseGuards(StorefrontOptionalAuthGuard)
  async getById(@Param('id') id: string) {
    const data = await this.cartService.getById(id);
    return { success: true, data };
  }

  @Patch('carts/:id/update-item')
  @UseGuards(StorefrontOptionalAuthGuard)
  async updateItem(@Param('id') id: string, @Body() body: any) {
    const data = await this.cartService.updateItem(id, body);
    return { success: true, message: 'Cart item updated', data };
  }

  @Patch('carts/:id/update-quantity')
  @UseGuards(StorefrontOptionalAuthGuard)
  async updateQuantity(@Param('id') id: string, @Body() body: any) {
    const data = await this.cartService.updateQuantity(id, body);
    return { success: true, message: 'Quantity updated', data };
  }

  @Patch('carts/:id/upload-ss-image')
  @UseGuards(StorefrontOptionalAuthGuard)
  async uploadSsImage(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file: any,
  ) {
    const filename = file?.filename || file?.originalname || body?.ssImageUrl;
    const data = await this.cartService.uploadSsImage(id, body, filename);
    return { success: true, message: 'Screenshot uploaded', data };
  }

  @Patch('carts/:id/request-price')
  @UseGuards(StorefrontOptionalAuthGuard)
  async requestPrice(@Param('id') id: string, @Body() body: any) {
    const data = await this.cartService.requestPrice(id, body);
    return { success: true, message: 'Price request submitted', data };
  }

  @Delete('carts/:id/remove-item/:productType/:productId')
  @UseGuards(StorefrontOptionalAuthGuard)
  async removeItem(
    @Param('id') id: string,
    @Param('productType') productType: string,
    @Param('productId') productId: string,
  ) {
    const data = await this.cartService.removeItem(id, productType, productId);
    return { success: true, message: 'Item removed from cart', data };
  }

  @Delete('carts/:id/clear')
  @UseGuards(StorefrontOptionalAuthGuard)
  async clear(@Param('id') id: string) {
    const data = await this.cartService.clearCart(id);
    return { success: true, message: 'Cart cleared', data };
  }

  @Delete('carts/user/:userId/clear')
  @UseGuards(StorefrontAuthGuard)
  async clearUser(@Param('userId') userId: string) {
    const data = await this.cartService.clearUserCart(userId);
    return { success: true, message: 'User cart cleared', data };
  }

  @Delete('carts/:id')
  @UseGuards(StorefrontAuthGuard)
  async delete(@Param('id') id: string) {
    await this.cartService.delete(id);
    return { success: true, message: 'Cart deleted' };
  }
}
