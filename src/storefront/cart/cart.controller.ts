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
import { resolveCartItemScenario } from '../notifications/notification.config';

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

  /**
   * Which basket a customer-facing endpoint addresses. `?kind=quote` reads the
   * pre-order quote; anything else (including no param) is the ordinary cart.
   */
  private kind(query: any): 'cart' | 'quote' {
    return String(query?.kind || '').toLowerCase() === 'quote'
      ? 'quote'
      : 'cart';
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

  @Patch('cart/:id/item-status')
  @UseGuards(JwtAuthGuard)
  async updateItemStatus(@Param('id') id: string, @Body() body: any) {
    const data = await this.cartService.setItemStatus(id, body);

    // Customer-facing alert when an admin holds / cancels / reopens a line of
    // a requested cart. Email + SMS are both toggled in NOTIFICATION_CONFIG.
    const status = String(body.status || 'PENDING')
      .trim()
      .toUpperCase();
    const previous = String(data.previousAdminStatus ?? '')
      .trim()
      .toUpperCase();
    // A reopen only counts as news if the item was actually held/cancelled,
    // so setting PENDING on a fresh item does not spam the customer.
    const statusChanged =
      status === 'PENDING'
        ? previous === 'HOLD' || previous === 'CANCELLED'
        : previous !== status;
    const scenario = resolveCartItemScenario(status);

    if (scenario && statusChanged) {
      const item = (data.items || []).find(
        (i: any) =>
          String(i.productId) === String(body.productId) &&
          (i.type || 'product') === (body.type || 'product'),
      );
      const reason = String(body.reason || item?.adminReason || '').trim();
      const customerEmail = data.user?.email;
      const customerPhone = data.user?.phone || data.guestContact;
      const productName =
        item?.product?.name || item?.name || 'An item in your request';

      if (customerEmail || customerPhone) {
        // Fire-and-forget: notify() never throws and already logs failures.
        this.notificationService.notify(scenario, {
          customerName: data.user?.name || data.guestContact || 'Customer',
          customerEmail,
          customerPhone,
          cartId: id,
          productName,
          itemStatus: status,
          reason,
          reasonText: reason ? ` Reason: ${reason}` : '',
          kind: data.kind,
        });
      }
    }

    return {
      success: true,
      message: 'Cart item status updated successfully',
      data,
    };
  }

  // ---- Customer-facing cart (storefront token / guest token) --------------

  @Get('mycart')
  @UseGuards(StorefrontOptionalAuthGuard)
  async myCart(@Req() req: StorefrontRequest, @Query() query: any) {
    const data = await this.cartService.getMyCart(
      this.identity(req),
      this.kind(query),
    );
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
    const data = await this.cartService.getMyCart({
      userId: req.user!.userId,
    });
    return { success: true, message: 'Cart merged successfully', data };
  }

  // ---- Coupons ------------------------------------------------------------

  /**
   * Validate a code against this basket's real server-side totals and, if it is
   * good, store the resulting discount on the basket.
   *
   * The `cart/` prefix is required: the controller is mounted at `api/v1`, so
   * `:id/coupon` would register at `api/v1/:id/coupon` instead.
   */
  @Post('cart/:id/coupon')
  @UseGuards(StorefrontOptionalAuthGuard)
  async applyCoupon(
    @Req() req: StorefrontRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const result = await this.cartService.applyCoupon(id, body?.code);
    return { success: true, message: 'Coupon applied', ...result };
  }

  @Delete('cart/:id/coupon')
  @UseGuards(StorefrontOptionalAuthGuard)
  async removeCoupon(@Param('id') id: string) {
    const data = await this.cartService.removeCoupon(id);
    return { success: true, message: 'Coupon removed', data };
  }

  // singular `/cart/*` aliases matching the pfu2 contract exactly (§4)
  @Get('cart/mycart')
  @UseGuards(StorefrontOptionalAuthGuard)
  async myCartAlias(@Req() req: StorefrontRequest, @Query() query: any) {
    return this.myCart(req, query);
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
  async clearUser(
    @Param('userId') userId: string,
    @Query() query: any,
  ) {
    const data = await this.cartService.clearUserCart(
      userId,
      this.kind(query),
    );
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
