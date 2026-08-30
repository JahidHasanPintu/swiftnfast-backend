import * as mongoose from 'mongoose';

export const SmsLogSchema = new mongoose.Schema(
  {
    to: { type: String, required: true, index: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'PENDING'],
      default: 'PENDING',
      index: true,
    },
    provider: { type: String, default: 'bulksmsbd' },
    responseCode: { type: String },
    responseBody: { type: String },
    purpose: { type: String, index: true }, // 'OTP' | 'ORDER_STATUS' | 'MARKETING' | 'MANUAL'
  },
  { timestamps: true },
);

SmsLogSchema.index({ to: 1, status: 1 });
SmsLogSchema.index({ purpose: 1, createdAt: -1 });

export default SmsLogSchema;
