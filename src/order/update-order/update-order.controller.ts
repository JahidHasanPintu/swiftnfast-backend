import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CreateOrderRequestDto } from '../dtos/createOrderRequest.dto';
import { UpdateOrderService } from './update-order.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('update-order')
export class UpdateOrderController {
  constructor(private readonly updateOrderService: UpdateOrderService) {}

  @Put(':orderId')
  @HttpCode(HttpStatus.OK)
  async updateOrderAndPayments(
    @Param('orderId') orderId: string,
    @Body() updateDto: CreateOrderRequestDto,
  ) {
    return this.updateOrderService.updateOrderAndPayments(orderId, updateDto);
  }
}
