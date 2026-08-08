import { Type } from 'class-transformer';
import { IsString, IsNumber, IsDate, IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class SearchCustomerDto {

    @IsOptional()
    @IsString()
    keyword: string;

}
