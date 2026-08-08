import * as mongoose from 'mongoose';

export const PartnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    logo: { type: String },
    website: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'shopping_partners' },
);
PartnerSchema.index({ name: 1 }, { unique: true });

export default PartnerSchema;
