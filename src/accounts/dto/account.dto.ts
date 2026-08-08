import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AccountType } from '../schemas/account.schema';

export class CreateAccountDto {
  @ApiProperty({ example: 'Dutch Bangla Bank' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.BANK })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  openingBalance?: number;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'Dutch Bangla Bank Ltd.' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: 'Motijheel Branch' })
  @IsOptional()
  @IsString()
  branchName?: string;

  @ApiPropertyOptional({ example: 'Main operating account' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAccountDto extends PartialType(CreateAccountDto) {}

export class AdjustBalanceDto {
  @ApiProperty({ example: 75000, description: 'New balance amount to set' })
  @IsNumber()
  @Min(0)
  newBalance: number;

  @ApiProperty({ example: 'Cash count discrepancy correction' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}