import * as mongoose from 'mongoose';

export const Pfu2PaymentSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.Mixed, default: null },
    method: {
      type: String,
      enum: ['bkash', 'rocket', 'nagad', 'card', 'visa', 'bank-transfer'],
      required: true,
    },
    phoneNumber: { type: String, required: true },
    paymentId: { type: String },
    transactionId: { type: String },
    transactionStatus: { type: String },
    statusMessage: { type: String },
    statusCode: { type: String },
    amount: { type: String },
    rawResponse: { type: mongoose.Schema.Types.Mixed },
    screenshotUrl: { type: String },
    paymentStatus: {
      type: String,
      enum: ['paid', 'pending', 'failed'],
      default: 'pending',
    },
    paymentSource: { type: String },
  },
  { timestamps: true, collection: 'payments' },
);
Pfu2PaymentSchema.index({ paymentId: 1 });
Pfu2PaymentSchema.index({ orderId: 1 });

export default Pfu2PaymentSchema;
