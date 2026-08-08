import { Type } from 'class-transformer';
import { IsString, IsNumber, IsDate } from 'class-validator';

export class CancelledOrdersDto {
  @IsString()
  customerId: string;

  @IsString()
  orderId: string;

  @IsString()
  customerName: string;

  @IsString()
  productDesc: string;

  @IsString()
  cancellationReason: string;

  @Type(() => Date) // Use the @Type() decorator to specify expected type
  @IsDate() // Use the @IsDate() decorator for validation
  date: Date;
}
