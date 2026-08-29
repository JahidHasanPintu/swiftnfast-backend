import * as mongoose from 'mongoose';

export const PaymentMethodSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    type: {
      type: String,
      enum: ['bkash', 'nagad', 'rocket', 'card', 'bank'],
      required: true,
    },
    accountNumber: { type: String },
    accountName: { type: String, required: true },
    // Card-specific fields
    last4: { type: String },
    brand: { type: String },
    expiry: { type: String },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'pfu2_payment_methods' },
);

PaymentMethodSchema.index({ userId: 1 });

export default PaymentMethodSchema;
