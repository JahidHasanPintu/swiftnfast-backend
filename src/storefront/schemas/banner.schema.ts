import * as mongoose from 'mongoose';

export const BannerSchema = new mongoose.Schema(
  {
    topText: { type: String, required: true },
    bottomText: { type: String, required: true },
    bannerImage: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);
BannerSchema.index({ order: 1 });

export default BannerSchema;
