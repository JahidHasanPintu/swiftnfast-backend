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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from 'src/common/decorators/public.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { StorageService } from 'src/storage/storage.service';
import {
  StorefrontOptionalAuthGuard,
  StorefrontAuthGuard,
} from '../auth/storefront-auth.guards';
import { StorefrontRequest } from '../auth/storefront-request.interface';
import { CartService } from './cart.service';
import { MailService } from '../mail/mail.service';
import { EventsGateway } from '../../common/gateways/events.gateway';
import { NotificationService } from '../notifications/notification.service';

@Public()
@Controller('api/v1')
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly storageService: StorageService,
    private readonly mailService: MailService,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationService: NotificationService,
  ) {}

  private identity(req: StorefrontRequest) {
    return { userId: req.user?.userId, guestToken: req.guestToken };
  }

  // NOTE: static path segments are declared before `:param` routes so
  // Express resolves them correctly (e.g. /cart/requested vs /cart/:id).

  // ---- Admin price-request queue (SwiftNFast admin JWT) -------------------

  @Get('cart/requested')
  @UseGuards(JwtAuthGuard)
  async requested(@Query() query: any) {
    const result = await this.cartService.getRequestedCarts(query);
    return {
      success: true,
      message: 'Carts retrieved successfully',
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

  @Get('cart/requested-cart-count')
  @UseGuards(JwtAuthGuard)
  async requestedCount() {
    const data = await this.cartService.getRequestedCartCount();
    return {
      success: true,
      message: 'Requested cart and order count retrieved successfully',
      data,
    };
  }

  @Get('cart/unread-count')
  @UseGuards(JwtAuthGuard)
  async unreadPriceRequestCount() {
    const count = await this.cartService.getUnreadPriceRequestCount();
    return { success: true, data: { count } };
  }

  @Patch('cart/:id/update-item')
  @UseGuards(JwtAuthGuard)
  async updateItem(@Param('id') id: string, @Body() body: any) {
    const data = await this.cartService.updateItem(id, body);

    // Send email + SMS notification if cart is now ready to order
    if (data.readyToOrder && data.user) {
      const customerName = data.user.name || 'Customer';
      this.notificationService.notify('PRICE_UPDATED', {
        customerName,
        customerEmail: data.user.email,
        customerPhone: data.user.phone || data.user.contactNumber,
        cartId: id,
      });
    }

    return { success: true, message: 'Cart item updated successfully', data };
  }

  @Patch('cart/:id/upload-ss-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('screenshot'))
  async uploadSsImage(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file: any,
  ) {
    let stored: string | undefined = body?.ssImageUrl;
    if (file?.buffer) {
      const optimized = await this.storageService.optimizeImage(
        file.buffer,
        600,
      );
      const result: any = await this.storageService.uploadFile(
        optimized,
        'screenshots',
      );
      stored = result.secure_url || result.url || file.originalname;
    }
    const data = await this.cartService.uploadSsImage(id, body, stored);
    return {
      success: true,
      message: 'Product price screenshot updated successfully',
      data,
    };
  }

  // ---- Customer-facing cart (storefront token / guest token) --------------

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

  // singular `/cart/*` aliases matching the pfu2 contract exactly (§4)
  @Get('cart/mycart')
  @UseGuards(StorefrontOptionalAuthGuard)
  async myCartAlias(@Req() req: StorefrontRequest) {
    return this.myCart(req);
  }

  @Post('cart/add-item')
  @UseGuards(StorefrontOptionalAuthGuard)
  async addItemAlias(@Req() req: StorefrontRequest, @Body() body: any) {
    return this.addItem(req, body);
  }

  @Post('cart/merge')
  @UseGuards(StorefrontAuthGuard)
  async mergeAlias(@Req() req: StorefrontRequest) {
    return this.merge(req);
  }

  @Delete('cart/user/:userId/clear')
  @UseGuards(StorefrontAuthGuard)
  async clearUser(@Param('userId') userId: string) {
    const data = await this.cartService.clearUserCart(userId);
    return { success: true, message: 'Cart cleared successfully', data };
  }

  @Get('cart/:id')
  @UseGuards(StorefrontOptionalAuthGuard)
  async getById(@Param('id') id: string) {
    const data = await this.cartService.getById(id);
    return { success: true, data };
  }

  @Patch('cart/:id/update-quantity')
  @UseGuards(StorefrontOptionalAuthGuard)
  async updateQuantity(@Param('id') id: string, @Body() body: any) {
    const data = await this.cartService.updateQuantity(id, body);
    return { success: true, message: 'Quantity updated', data };
  }

  @Patch('cart/:id/request-price')
  @UseGuards(StorefrontOptionalAuthGuard)
  async requestPrice(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: StorefrontRequest,
  ) {
    const data = await this.cartService.requestPrice(id, body);
    // Send price request notification to admin (non-blocking)
    const customerName = req.user?.userId || body.guestContact || 'Guest';
    this.mailService.sendPriceRequestEmail(customerName, id).catch(() => {});

    // Emit real-time notification to admin
    this.eventsGateway.notifyNewPriceRequest({
      cartId: id,
      customerName,
    });

    return { success: true, message: 'Price Request Submitted', data };
  }

  @Delete('cart/:id/remove-item/:productType/:productId')
  @UseGuards(StorefrontOptionalAuthGuard)
  async removeItem(
    @Param('id') id: string,
    @Param('productType') productType: string,
    @Param('productId') productId: string,
  ) {
    const data = await this.cartService.removeItem(id, productType, productId);
    return { success: true, message: 'Item removed from cart', data };
  }

  @Delete('cart/:id/clear')
  @UseGuards(StorefrontOptionalAuthGuard)
  async clear(@Param('id') id: string) {
    const data = await this.cartService.clearCart(id);
    return { success: true, message: 'Cart cleared successfully', data };
  }

  @Delete('cart/:id')
  @UseGuards(StorefrontAuthGuard)
  async delete(@Param('id') id: string) {
    await this.cartService.delete(id);
    return { success: true, message: 'Cart deleted' };
  }
}
