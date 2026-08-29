import * as mongoose from 'mongoose';

export const Pfu2ShippingAddressSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    shippingAddress: { type: String, required: true },
    district: { type: String },
    isDefault: { type: Boolean, default: false },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
  },
  { timestamps: true, collection: 'pfu2_shipping_addresses' },
);
Pfu2ShippingAddressSchema.index({ userId: 1 });

export default Pfu2ShippingAddressSchema;
