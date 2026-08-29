import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { StorefrontAuthGuard } from '../auth/storefront-auth.guards';
import { StorefrontRequest } from '../auth/storefront-request.interface';
import { PaymentMethodService } from './payment-method.service';

@Public()
@UseGuards(StorefrontAuthGuard)
@Controller('api/v1/payment-methods')
export class PaymentMethodController {
  constructor(private readonly service: PaymentMethodService) {}

  @Get()
  async getAll(@Req() req: StorefrontRequest) {
    const data = await this.service.getAll(req.user?.userId);
    return { success: true, data };
  }

  @Post()
  async create(@Req() req: StorefrontRequest, @Body() body: any) {
    const data = await this.service.create(req.user?.userId, body);
    return { success: true, message: 'Payment method added', data };
  }

  @Put(':id')
  async update(
    @Req() req: StorefrontRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const data = await this.service.update(req.user?.userId, id, body);
    return { success: true, message: 'Payment method updated', data };
  }

  @Delete(':id')
  async delete(@Req() req: StorefrontRequest, @Param('id') id: string) {
    await this.service.delete(req.user?.userId, id);
    return { success: true, message: 'Payment method deleted' };
  }
}
