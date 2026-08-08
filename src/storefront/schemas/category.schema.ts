import * as mongoose from 'mongoose';

export const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    image: { type: String },
    bannerImage: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
CategorySchema.index({ name: 1 }, { unique: true });

export default CategorySchema;
