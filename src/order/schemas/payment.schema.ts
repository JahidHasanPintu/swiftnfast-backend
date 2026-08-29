import * as mongoose from 'mongoose';

export const PaymentSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true }, // Order ID
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    }, // Reference to Customer ObjectId
    cashPayment: { type: Number, default: 0 },
    mfsPayment: {
      selectedMFS: { type: String },
      mfsTrxId: { type: String },
      mfsAmount: { type: Number },
    },
    bankPayment: {
      selectedBank: { type: String },
      bankTrxId: { type: String },
      bankAmount: { type: Number },
    },
  },
  { timestamps: true },
);
// Add the necessary indexes
PaymentSchema.index({ orderId: 1 }); // Index on orderId
PaymentSchema.index({ customerId: 1 }); // Index on customerId for faster lookups
export default PaymentSchema;
