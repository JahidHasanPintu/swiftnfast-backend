import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsDate,
  IsEmail,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  customerId: string;

  @IsString()
  customerName: string;

  @IsString()
  @IsNotEmpty()
  contactNumber: string;

  @IsOptional()
  emailAddress: string;

  @IsString()
  shippingAddress: string;

  @IsNumber()
  grandTotal: number;

  @IsOptional()
  @IsNumber()
  totalAdvance: number;

  @IsString()
  sourceOfOrder: string;

  @IsString()
  districtName: string;

  @Type(() => Date) // Use the @Type() decorator to specify expected type
  @IsOptional()
  @IsDate() // Use the @IsDate() decorator for validation
  customerJoiningDate: string;

  @Type(() => Date) // Use the @Type() decorator to specify expected type
  @IsOptional()
  @IsDate() // Use the @IsDate() decorator for validation
  customerDateOfBirth: string;

  @Type(() => Date) // Use the @Type() decorator to specify expected type
  @IsDate() // Use the @IsDate() decorator for validation
  orderDate: string;

  orderId?: string; // The order ID will be generated on the backend

  @IsOptional()
  createdBy: string;
}
