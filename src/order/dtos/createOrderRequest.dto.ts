import { IsOptional, ValidateNested } from 'class-validator';
import { CreateCustomerDto } from './createCustomer.dto';
import { CreateOrderDto } from './createOrders.dto';
import { CreatePaymentDto } from './createPayment.dto';
import { Type } from 'class-transformer';

export class CreateOrderRequestDto {
  @ValidateNested()
  @Type(() => CreateCustomerDto)
  customerInfo: CreateCustomerDto;

  @ValidateNested()
  @Type(() => CreateOrderDto)
  orders: CreateOrderDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePaymentDto)
  payments: CreatePaymentDto;
}
