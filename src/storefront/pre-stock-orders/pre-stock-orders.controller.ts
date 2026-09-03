import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { StorageService } from 'src/storage/storage.service';
import { PreStockOrdersService } from './pre-stock-orders.service';

@Controller('api/v1/prestock-orders')
export class PreStockOrdersController {
  constructor(
    private readonly ordersService: PreStockOrdersService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() body: any) {
    const order = await this.ordersService.createOrder(body);
    return { success: true, message: 'Pre-stock order created', data: order };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query() query: any) {
    const result = await this.ordersService.findAll(query);
    return {
      success: true,
      data: result.orders,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  @Get('pending-count')
  @UseGuards(JwtAuthGuard)
  async getPendingCount() {
    const count = await this.ordersService.getPendingCount();
    return { success: true, data: { count } };
  }

  @Get('number/:orderNumber')
  async findByOrderNumber(@Param('orderNumber') orderNumber: string) {
    const data = await this.ordersService.findByOrderNumber(orderNumber);
    return { success: true, data };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    const data = await this.ordersService.findOne(id);
    return { success: true, data };
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(@Param('id') id: string, @Body() body: any) {
    const data = await this.ordersService.updateStatus(id, body.status);
    return { success: true, message: `Status updated to ${body.status}`, data };
  }

  @Patch(':id/order-item-status')
  @UseGuards(JwtAuthGuard)
  async updateItemStatus(@Param('id') id: string, @Body() body: any) {
    const data = await this.ordersService.updateItemStatus(
      id,
      body.productId,
      body.status,
    );
    return { success: true, message: 'Item status updated', data };
  }

  @Patch(':id/upload-prod-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('screenshot'))
  async uploadProductImage(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file: any,
  ) {
    let stored: string | undefined;
    if (file?.buffer) {
      const optimized = await this.storageService.optimizeImage(file.buffer, 600);
      const result: any = await this.storageService.uploadFile(optimized, 'screenshots');
      stored = result.secure_url || result.url || file.originalname;
    }
    const data = await this.ordersService.uploadProductImage(
      id,
      body.productId,
      stored,
    );
    return { success: true, message: 'Image uploaded', data };
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancel(@Param('id') id: string) {
    const data = await this.ordersService.cancelOrder(id);
    return { success: true, message: 'Order cancelled', data };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    return this.ordersService.deleteOrder(id);
  }
}
