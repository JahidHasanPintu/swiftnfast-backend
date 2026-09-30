import * as mongoose from 'mongoose';

export const CartItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.Mixed },
    name: { type: String },
    image: { type: String },
    quantity: { type: Number, required: true },
    price: { type: mongoose.Schema.Types.Mixed },
    type: {
      type: String,
      enum: ['product', 'outside_order'],
      default: 'product',
    },
    ssImageUrl: { type: String },
    isPriceUpdated: { type: Boolean },
    priceManuallyUpdated: { type: Boolean, default: false },
    finalPrice: { type: mongoose.Schema.Types.Mixed },
    productUrl: { type: String },
    productSourcedFrom: { type: String },
    color: { type: String },
    size: { type: String },
    notes: { type: String },
    promoCode: { type: String },
    category: { type: String },
    variant: { type: String },
    approximatePrice: { type: Number },
    totalEstimatedPrice: { type: Number },
    status: { type: String },
    adminStatus: {
      type: String,
      enum: ['PENDING', 'HOLD', 'CANCELLED'],
      default: 'PENDING',
    },
    adminReason: { type: String },
    // USA sales tax RATE as a percentage (e.g. 10 = 10%). Null/undefined means
    // the DEFAULT_USA_TAX_PCT default applies. Not a money amount.
    usaSalesTax: { type: Number, default: null },
    // Shipping cost in the source currency. Converted to BDT, never taxed.
    shippingCost: { type: Number, default: 0 },
    // --- Persisted money breakdown (per unit, BDT) ---------------------
    // Stamped by the cart service on every write from pricing.util.ts so the
    // customer summary can show price / tax / shipping per item without
    // re-deriving them. `default: null` is deliberate: null/absent means "not
    // yet stamped", which breakdownBdt() treats as "compute it live", so carts
    // written before these fields existed keep pricing correctly.
    priceBdt: { type: Number, default: null }, // tax INCLUDED, shipping EXCLUDED
    taxBdt: { type: Number, default: null }, // tax portion of priceBdt
    shippingBdt: { type: Number, default: null }, // converted, never taxed
  },
  { _id: false },
);

export const CartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    guestToken: { type: String, unique: true, sparse: true },
    guestContact: { type: String },
    isRequested: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
    requestedAt: { type: Date },
    items: { type: [CartItemSchema], default: [] },
    itemPrice: { type: Number, default: 0 }, // tax-inclusive product price, BDT
    tax: { type: Number, default: 0 }, // tax portion of itemPrice, BDT
    // Converted-but-untaxed shipping, BDT. Kept separate so the summary can
    // show product price / tax / shipping as three distinct lines.
    shippingBdt: { type: Number, default: 0 },
    pfu2Charge: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
    updatedBy: { type: String },
  },
  { timestamps: true },
);
CartSchema.index({ userId: 1 });
CartSchema.index({ guestToken: 1 });
CartSchema.index({ isRequested: 1 });

export default CartSchema;
