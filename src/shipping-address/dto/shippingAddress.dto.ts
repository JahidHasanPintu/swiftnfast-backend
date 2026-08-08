import { Type } from 'class-transformer';
import { IsString, IsNumber, IsDate, IsOptional } from 'class-validator';

export class ShippingAddressDto {
    @IsString()
    @IsOptional()
    source: string;

    @IsString()
    @IsOptional()
    address: string;


    @IsString()
    @IsOptional()
    origin: string;

    @IsString()
    @IsOptional()
    weightCharge: string;




}


