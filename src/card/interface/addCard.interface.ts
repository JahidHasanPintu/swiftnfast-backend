import { Document } from 'mongoose';

export interface CardBeneFiciaryDocument extends Document {
    cardNumber: number;
    cardHolderName: string;
    exchangeRateUsd?: number; // Optional
    exchangeRateGbp?: number; // Optional
    exchangeRateDirham?: number; // Optional
    cardType: string;
}
