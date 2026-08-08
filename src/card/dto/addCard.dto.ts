import { Type } from 'class-transformer';
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateCardBeneficiaryDto {
  @IsNumber()
  cardNumber: number;

  @IsString()
  cardHolderName: string;

  @IsOptional()
  @IsNumber()
  exchangeRateUsd: number;

  @IsOptional()
  @IsNumber()
  exchangeRateGbp: number;

  @IsOptional()
  @IsNumber()
  exchangeRateDirham: number;

  @IsString()
  cardType: string;
}
