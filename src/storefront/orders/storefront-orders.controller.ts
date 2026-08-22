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
  StorefrontAuthGuard,
  StorefrontOptionalAuthGuard,
} from '../auth/storefront-auth.guards';
import { StorefrontRequest } from '../auth/storefront-request.interface';
import { StorefrontOrdersService } from './storefront-orders.service';

@Public()
@Controller('api/v1')
export class StorefrontOrdersController {
  constructor(
    private readonly ordersService: StorefrontOrdersService,
    private readonly storageService: StorageService,
  ) {}

  // ---- Pre-stock orders --------------------------------------------------
  @Post('orders')
  @UseGuards(StorefrontOptionalAuthGuard)
  async create(@Req() req: StorefrontRequest, @Body() body: any) {
    const order = await this.ordersService.createPreStockOrder({
      userId: req.user?.userId,
      ...body,
    });
    return {
      success: true,
      message: 'Order created successfully',
      data: order,
    };
  }

  @Get('orders/me')
  @UseGuards(StorefrontAuthGuard)
  async myOrders(@Req() req: StorefrontRequest, @Query() query: any) {
    const result = await this.ordersService.getMyOrders(
      req.user!.userId,
      query,
    );
    return {
      success: true,
      message: 'User orders retrieved successfully',
      data: result.orders,
      meta: {
        total: result.total,
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 10,
        totalPages: Math.ceil(result.total / (Number(query.limit) || 10)),
        hasNextPage:
          (Number(query.page) || 1) * (Number(query.limit) || 10) <
          result.total,
      },
    };
  }

  // Admin listing (SwiftNFast admin JWT): filters status/userId/paymentMethod/
  // paymentStatus/orderNumber/orderType/startDate/endDate + sort=field:ASC|DESC
  @Get('orders')
  @UseGuards(JwtAuthGuard)
  async findAll(@Query() query: any) {
    const result = await this.ordersService.findAll(query);
    return {
      success: true,
      message: 'Orders retrieved successfully',
      data: result.orders,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
        hasNextPage: result.page * result.limit < result.total,
      },
    };
  }

  @Get('orders/number/:orderNumber')
  @UseGuards(StorefrontOptionalAuthGuard)
  async findByOrderNumber(@Param('orderNumber') orderNumber: string) {
    const data = await this.ordersService.findByOrderNumber(orderNumber);
    return { success: true, message: 'Order retrieved successfully', data };
  }

  @Get('orders/:id')
  @UseGuards(StorefrontOptionalAuthGuard)
  async findOne(@Param('id') id: string) {
    const data = await this.ordersService.findOne(id);
    return { success: true, message: 'Order retrieved successfully', data };
  }

  // ---- Admin mutations (SwiftNFast admin JWT) ------------------------------

  @Patch('orders/:id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() body: any) {
    const data = await this.ordersService.update(id, body);
    return { success: true, message: 'Order updated successfully', data };
  }

  @Patch('orders/:id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(@Param('id') id: string, @Body() body: any) {
    const data = await this.ordersService.updateStatus(id, body.status);
    return {
      success: true,
      message: `Order status updated to ${body.status}`,
      data,
    };
  }

  @Patch('orders/:id/order-item-status')
  @UseGuards(JwtAuthGuard)
  async updateLineItemStatus(@Param('id') id: string, @Body() body: any) {
    const data = await this.ordersService.updateLineItemStatus(id, body);
    return {
      success: true,
      message: 'Product purchase status updated successfully',
      data,
    };
  }

  @Patch('orders/:id/upload-prod-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('screenshot'))
  async uploadProductImage(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file: any,
  ) {
    let stored: string | undefined;
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
    const data = await this.ordersService.uploadProductImage(id, body, stored);
    return {
      success: true,
      message: 'Product purchase image updated successfully',
      data,
    };
  }

  @Delete('orders/:id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }

  @Patch('orders/:id/cancel')
  @UseGuards(StorefrontOptionalAuthGuard)
  async cancel(@Param('id') id: string) {
    const data = await this.ordersService.cancelOrder(id);
    return { success: true, message: 'Order cancelled successfully', data };
  }

  // ---- Outside (URL import) orders ---------------------------------------
  @Post('outside-orders/calculate-price')
  async calculatePrice(@Body() body: any) {
    const data = this.ordersService.calculatePrice(body);
    return { success: true, data };
  }

  @Post('outside-orders')
  @UseGuards(StorefrontOptionalAuthGuard)
  async createOutside(@Req() req: StorefrontRequest, @Body() body: any) {
    const data = await this.ordersService.createOutsideOrder({
      userId: req.user?.userId,
      ...body,
    });
    return {
      success: true,
      message: 'Outside order created successfully',
      data,
    };
  }

  @Get('outside-orders')
  @UseGuards(StorefrontOptionalAuthGuard)
  async listOutside(@Query() query: any) {
    const result = await this.ordersService.findAll({
      ...query,
      orderType: 'import',
    });
    return {
      success: true,
      data: result.orders,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
        hasNextPage: result.page * result.limit < result.total,
      },
    };
  }

  @Get('outside-orders/:id')
  @UseGuards(StorefrontOptionalAuthGuard)
  async findOutside(@Param('id') id: string) {
    const data = await this.ordersService.findOne(id);
    return { success: true, data };
  }

  @Patch('outside-orders/:id/status')
  @UseGuards(StorefrontAuthGuard)
  async updateOutsideStatus(@Param('id') id: string, @Body() body: any) {
    const data = await this.ordersService.updateStatus(id, body.status);
    return { success: true, message: 'Status updated successfully', data };
  }

  @Patch('outside-orders/:id/cancel')
  @UseGuards(StorefrontAuthGuard)
  async cancelOutside(@Param('id') id: string) {
    const data = await this.ordersService.cancelOrder(id);
    return {
      success: true,
      message: 'Outside order cancelled successfully',
      data,
    };
  }
}
