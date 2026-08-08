import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsArray,
  IsDateString,
  IsMongoId,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TransactionType } from '../schemas/transaction.schema';

export class CreateIncomeDto {
  @ApiProperty({ example: '664f1a2b3c4d5e6f7a8b9c0d' })
  @IsMongoId()
  accountId: string;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'Sales Revenue' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({ example: 'Product Sales' })
  @IsOptional()
  @IsString()
  subCategory?: string;

  @ApiProperty({ example: 'Monthly sales collection from store' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: '2024-06-15' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: ['invoice', 'retail'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'INV-2024-001' })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class CreateExpenseDto {
  @ApiProperty({ example: '664f1a2b3c4d5e6f7a8b9c0d' })
  @IsMongoId()
  accountId: string;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'Utilities' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({ example: 'Electricity Bill' })
  @IsOptional()
  @IsString()
  subCategory?: string;

  @ApiProperty({ example: 'Office electricity bill for June 2024' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: '2024-06-15' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: ['utility', 'monthly'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'BILL-2024-06' })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class CreateTransferDto {
  @ApiProperty({ example: '664f1a2b3c4d5e6f7a8b9c0d' })
  @IsMongoId()
  fromAccountId: string;

  @ApiProperty({ example: '664f1a2b3c4d5e6f7a8b9c1e' })
  @IsMongoId()
  toAccountId: string;

  @ApiProperty({ example: 10000 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'Transfer from cash to bank' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: '2024-06-15' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: 'TRF-001' })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class UpdateTransactionDto {
  @ApiPropertyOptional({ example: 16000 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ example: 'Sales Revenue' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2024-06-15' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;
}

// ─── Filter / Query DTOs ───────────────────────────────────────────────────────

export type DatePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'this_year'
  | 'custom';

export class TransactionFilterDto {
  @ApiPropertyOptional({
    enum: ['today', 'this_week', 'this_month', 'this_year', 'custom'],
  })
  @IsOptional()
  @IsString()
  preset?: DatePreset;

  @ApiPropertyOptional({ example: '2024-06-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-06-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ example: '664f1a2b3c4d5e6f7a8b9c0d' })
  @IsOptional()
  @IsMongoId()
  accountId?: string;

  @ApiPropertyOptional({ example: 'Sales Revenue' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'invoice' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'date', default: 'date' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'date';

  @ApiPropertyOptional({ example: 'desc', default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class AnalyticsFilterDto {
  @ApiPropertyOptional({
    enum: ['today', 'this_week', 'this_month', 'this_year', 'custom'],
  })
  @IsOptional()
  @IsString()
  preset?: DatePreset;

  @ApiPropertyOptional({ example: '2024-06-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-06-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: '664f1a2b3c4d5e6f7a8b9c0d' })
  @IsOptional()
  @IsMongoId()
  accountId?: string;
}
