import * as mongoose from 'mongoose';

export const CardBeneficiarySchema = new mongoose.Schema({
    cardNumber: { type: Number, required: true },
    cardHolderName: { type: String, required: true },
    exchangeRateUsd: { type: Number, required: false },
    exchangeRateGbp: { type: Number, required: false },
    exchangeRateDirham: { type: Number, required: false },
    cardType: { type: String, required: true },
}, { timestamps: true });


// Export the schema

// export default mongoose.model('Customers', CustomerSchema);
export default CardBeneficiarySchema;

