import { IsNumber, IsOptional, IsString } from 'class-validator';

export class EditCustomerDto {
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  @IsOptional()
  @IsString()
  emailAddress?: string;

  @IsOptional()
  @IsString()
  shippingAddress?: string;

  @IsOptional()
  @IsString()
  districtName?: string;

  @IsOptional()
  @IsNumber()
  totalAdvance?: number;

  @IsOptional()
  @IsNumber()
  grandTotal?: number;

  @IsOptional()
  @IsString()
  sourceOfOrder?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  customerDateOfBirth?: Date | string;

  @IsOptional()
  customerJoiningDate?: Date | string;

  @IsOptional()
  orderDate?: Date | string;
}
