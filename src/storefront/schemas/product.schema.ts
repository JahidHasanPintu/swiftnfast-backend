import * as mongoose from 'mongoose';

export const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    shortDescription: { type: String },
    description: { type: String },
    color: { type: String },
    size: { type: String },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    brand: { type: String },
    gender: { type: String },
    model: { type: String },
    stock: { type: Number, default: 0 },
    price: { type: Number, required: true },
    discountPrice: { type: Number },
    tax: { type: Number, default: 0 },
    pfuCharge: { type: Number, default: 0 },
    images: { type: [String], default: [] },
    isLimitedTimeOffer: { type: Boolean, default: true },
    isFeaturedDailyDeal: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
  },
  { timestamps: true },
);
ProductSchema.index({ name: 1 });
ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ categoryId: 1 });

export default ProductSchema;
