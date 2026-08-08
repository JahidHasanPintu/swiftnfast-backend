import { IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MfsPayment {
    @IsString()
    @IsOptional() // Make these properties optional
    selectedMFS?: string;

    @IsString()
    @IsOptional()
    mfsTrxId?: string;

    @IsNumber()
    @IsOptional()
    mfsAmount?: number;
}

class BankPayment {
    @IsString()
    @IsOptional()
    selectedBank?: string;

    @IsString()
    @IsOptional()
    bankTrxId?: string;

    @IsNumber()
    @IsOptional()
    bankAmount?: number;
}

export class CreatePaymentDto {
    @IsInt()
    @IsOptional()
    cashPayment?: number;

    @ValidateNested()
    @Type(() => MfsPayment)
    @IsOptional()
    mfsPayment?: MfsPayment;

    @ValidateNested()
    @Type(() => BankPayment)
    @IsOptional()
    bankPayment?: BankPayment;

    orderId?: string; // The order ID will be generated on the backend


}
