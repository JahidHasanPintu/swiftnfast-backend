import { Type } from 'class-transformer';
import { IsString, IsNumber, IsDate, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateDropShipDto {
  @IsString()
  customerId: string;

  @IsString()
  customerName: string;

  @IsString()
  @IsNotEmpty()
  contactNo: string;

  @IsOptional()
  emailAddress: string;

  @IsString()
  shippingAddress: string;

  @IsString()
  districtName: string;

  @IsOptional()
  sourceOfOrder: string;

  @Type(() => Date)
  @IsOptional()
  @IsDate()
  customerDateOfBirth: string;

  @Type(() => Date)
  @IsOptional()
  @IsDate()
  customerJoiningDate: string;

  @Type(() => Date)
  @IsDate()
  orderDate: string;

  @IsString()
  @IsNotEmpty()
  productDescription: string;

  @IsOptional()
  productUrl: string;

  @IsNumber()
  quantity: number;

  @IsOptional()
  color: string;

  @IsOptional()
  size: string;

  @IsNumber()
  productWeight: number;

  @IsNumber()
  weightChargePerKg: number;

  @IsOptional()
  @IsNumber()
  productWeightCharge: number;

  @IsOptional()
  @IsNumber()
  remainingDue: number;

  @IsOptional()
  orderNotes: string;

  @IsOptional()
  createdBy: string;
}
