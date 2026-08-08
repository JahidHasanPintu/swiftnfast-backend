import * as mongoose from 'mongoose';

export const ShippingAddressSchema = new mongoose.Schema(
  {
    source: { type: String, required: true },
    address: { type: String, required: true },
    origin: { type: String, required: true },
    weightCharge: { type: String, required: true },
  },
  { timestamps: true },
);

export default ShippingAddressSchema;
