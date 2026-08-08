import * as mongoose from 'mongoose';

export const CartItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.Mixed },
    name: { type: String },
    image: { type: String },
    quantity: { type: Number, required: true },
    price: { type: mongoose.Schema.Types.Mixed },
    type: { type: String, enum: ['product', 'outside_order'], default: 'product' },
    ssImageUrl: { type: String },
    isPriceUpdated: { type: Boolean },
    priceManuallyUpdated: { type: Boolean, default: false },
    finalPrice: { type: mongoose.Schema.Types.Mixed },
    productUrl: { type: String },
    productSourcedFrom: { type: String },
    color: { type: String },
    size: { type: String },
    notes: { type: String },
    approximatePrice: { type: Number },
    totalEstimatedPrice: { type: Number },
    status: { type: String },
  },
  { _id: false },
);

export const CartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pfu2User' },
    guestToken: { type: String, unique: true, sparse: true },
    guestContact: { type: String },
    isRequested: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
    items: { type: [CartItemSchema], default: [] },
    itemPrice: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    pfu2Charge: { type: Number, default: 1000 },
    discount: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
  },
  { timestamps: true },
);
CartSchema.index({ userId: 1 });
CartSchema.index({ guestToken: 1 });
CartSchema.index({ isRequested: 1 });

export default CartSchema;
