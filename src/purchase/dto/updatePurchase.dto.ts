import { Type } from 'class-transformer';
import { IsString, IsNumber, IsOptional, IsMongoId } from 'class-validator';

export class UpdatePurchaseDto {
  @IsOptional()
  @IsString()
  trackId: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowInfinity: false, allowNaN: false },
    { message: 'productWeight must be a valid number' },
  )
  productWeight: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowInfinity: false, allowNaN: false },
    { message: 'weightChargePerKg must be a valid number' },
  )
  weightChargePerKg: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowInfinity: false, allowNaN: false },
    { message: 'productWeightCharge must be a valid number' },
  )
  productWeightCharge: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowInfinity: false, allowNaN: false },
    { message: 'remainingDue must be a valid number' },
  )
  remaniningDue: number;

  @IsOptional()
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  deliveryDate: string;

  // In dto/updatePurchase.dto.ts — add to existing class:
  recipientAddress?: string;
  recipientPhone?: string;
  @IsOptional()
  @IsMongoId()
  shipmentId?: string;
}
