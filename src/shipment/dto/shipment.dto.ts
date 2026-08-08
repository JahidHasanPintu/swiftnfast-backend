import {
  IsString,
  IsMongoId,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShipmentStatus } from '../schemas/shipment.schema';

export class CreateShipmentDto {
  @ApiProperty({ example: 'USA-JUN-2024-01' })
  @IsString()
  @IsNotEmpty()
  shipmentName: string;

  @ApiProperty({
    example: '6a11b3a76ffaf4661b1d356d',
    description: 'ShippingAddress _id',
  })
  @IsMongoId()
  shippingAddressId: string;

  @ApiProperty({ example: '2024-06-20' })
  @IsDateString()
  shipmentDate: string;

  @ApiPropertyOptional({ example: '2024-07-05' })
  @IsOptional()
  @IsDateString()
  expectedArrivalDate?: string;

  @ApiPropertyOptional({ example: 'EK-583' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({ example: 'Emirates' })
  @IsOptional()
  @IsString()
  airline?: string;

  @ApiPropertyOptional({ example: 'EK583' })
  @IsOptional()
  @IsString()
  flightNumber?: string;

  @ApiPropertyOptional({ example: 'Dhaka' })
  @IsOptional()
  @IsString()
  portOfEntry?: string;

  @ApiPropertyOptional({ example: 'June batch from Shameem warehouse' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateShipmentDto extends PartialType(CreateShipmentDto) {
  @ApiPropertyOptional({ enum: ShipmentStatus })
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @ApiPropertyOptional({ example: '2024-07-03' })
  @IsOptional()
  @IsDateString()
  actualArrivalDate?: string;

  @ApiPropertyOptional({
    example: 2500,
    description: 'Other miscellaneous expenses (BDT)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  otherExpenses?: number;

  @ApiPropertyOptional({ example: 'Customs brokerage fee' })
  @IsOptional()
  @IsString()
  otherExpensesNote?: string;

  @ApiPropertyOptional({
    example: 1200,
    description: 'Customs duty paid (BDT)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  customsDuty?: number;
}

/**
 * Called when we know the total shipping cost — this is the key business event.
 * It triggers:
 *   1. Updates totalShippingCost on the shipment
 *   2. Calculates actualWeightChargePerKg (real cost/kg)
 *   3. Updates actualWeightChargePerKg on every linked purchase
 *   4. Creates an expense transaction in the Accounts module
 *   5. Recalculates weightChargeProfit
 */
export class SetShippingCostDto {
  @ApiProperty({
    example: 35000,
    description: 'Total amount paid to agent for this shipment (BDT)',
  })
  @IsNumber()
  @Min(0.01)
  totalShippingCost: number;

  @ApiProperty({
    example: '664f1a2b3c4d5e6f7a8b9c0d',
    description: 'Account ID to debit for shipping cost (from Accounts module)',
  })
  @IsMongoId()
  accountId: string;

  @ApiPropertyOptional({ example: 'Paid via Bkash to Shameem' })
  @IsOptional()
  @IsString()
  paymentNote?: string;
}

/**
 * Links a purchase item to this shipment.
 * Sent when filling in weight details from the shipment update screen.
 */
export class LinkPurchaseToShipmentDto {
  @ApiProperty({ example: 'ORD-1605269710' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  orderItemIndex: number;

  @ApiPropertyOptional({
    example: 1.2,
    description: 'Product weight in kg (updates productWeight on purchase)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  productWeight?: number;

  @ApiPropertyOptional({
    example: 200,
    description: 'Weight charge per kg we charge the customer (BDT)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightChargePerKg?: number;
}

export class BulkLinkPurchasesDto {
  @ApiProperty({ type: [LinkPurchaseToShipmentDto] })
  purchases: LinkPurchaseToShipmentDto[];
}
