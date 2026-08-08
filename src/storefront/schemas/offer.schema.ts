import * as mongoose from 'mongoose';

export const OfferSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    title: { type: String, required: true },
    discountDetails: { type: String, required: true },
    image: { type: String },
    isWiderImage: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  },
  { timestamps: true },
);

export default OfferSchema;
