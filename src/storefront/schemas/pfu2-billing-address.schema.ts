import * as mongoose from 'mongoose';

export const Pfu2BillingAddressSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pfu2User',
      required: true,
    },
  },
  { timestamps: true, collection: 'pfu2_billing_addresses' },
);
Pfu2BillingAddressSchema.index({ userId: 1 });

export default Pfu2BillingAddressSchema;
