import * as mongoose from 'mongoose';

export const BrandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    logo: { type: String },
    website: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
BrandSchema.index({ name: 1 }, { unique: true });

export default BrandSchema;
