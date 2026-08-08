import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsDate,
  IsUrl,
  IsOptional,
  isEmail,
  IsEmail,
} from 'class-validator';

export class CreatePurchaseDto {
  @IsString()
  customerId: number;

  @IsString()
  destination: string;

  @IsString()
  cardType: string;

  @IsString()
  selling: string;

  @IsString()
  currencyAmount: string;

  @IsString()
  buyingUP: string;

  @IsString()
  buyingBDT: number;

  @IsString()
  advance: number;

  @IsString()
  grossProfit: string;

  @Type(() => Date) // Use the @Type() decorator to specify expected type
  @IsDate()
  purchaseDate: Date;

  @IsString()
  note: string;

  // need this just because show some extra info
  @IsString()
  orderId: string;

  @IsString()
  customerName: string;

  @IsString()
  prodDesc: string;

  @IsOptional()
  size: string;

  @IsOptional()
  color: string;

  @IsNumber()
  quantity: number;

  @IsString()
  country: string;

  @Type(() => Date) // Use the @Type() decorator to specify expected type
  @IsDate()
  orderDate: Date;

  @IsString()
  trackId: string;

  @IsEmail()
  confirmationMail: string;

  @IsNumber()
  orderItemIndex: number;

  @IsUrl()
  confirmationImage: number;

  cardUsed: string;

  @IsOptional()
  @IsString()
  websiteUrl: string;




  // shipment extra information ( shipmemnt module)

  @IsOptional()
  @IsNumber()
  productWeight: number;


  @IsOptional()
  @IsNumber()
  weightChargePerKg

  @IsOptional()
  @IsNumber()
  productWeightCharge: number;

  @IsOptional()
  @IsNumber()
  remaniningDue: number;



  


}
