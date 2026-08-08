import { PartialType } from '@nestjs/mapped-types';
import { CreateDropShipDto } from './create-dropship.dto';
import { IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateDropShipDto extends PartialType(CreateDropShipDto) {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  deliveryMethod?: string;

  @IsOptional()
  @IsNumber()
  actualWeightChargePerKg?: number;

  @IsOptional()
  @IsNumber()
  weightChargeProfit?: number;

  @IsOptional()
  deliveryDate?: string;
}
