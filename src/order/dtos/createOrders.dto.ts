import { Type } from 'class-transformer';
import { IsString, IsNumber, IsDate, IsOptional } from 'class-validator';

export class CreateOrderDto {
    @IsString()
    productUrl: string;

    @IsNumber()
    quantity: number;

    @IsOptional()
    couponCode: string;

    @IsString()
    prodDesc: string;


    @IsOptional()
    color: string;


    @IsOptional()
    size: string;

    @IsString()
    origin: string;

    @IsNumber()
    uniPrice: number;

    @IsNumber()
    totalPrice: number;

    @IsOptional()
    @IsNumber()
    advancePayment: number;

    @IsNumber()
    remainingAmount: number;

    orderId?: string; // The order ID will be generated on the backend
    isPurchased?: boolean;

    @IsOptional()
    orderItemIndex: number;

    customerName?: string;
    contactNo?: string;
    grandTotal?: number;


    @IsOptional()
    createdBy: string;

    @IsOptional()
    orderNotes: string

    @IsOptional()
    websiteUrl: string




}

