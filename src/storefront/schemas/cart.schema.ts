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
    // Final sales-tax MONEY amount per unit, in the source currency. Set by the
    // admin editing the calculated tax amount in the price queue. When > 0 it
    // overrides the percentage-derived tax (price + taxAmount is what gets
    // converted to BDT), so an admin can hand-tune the exact tax charged.
    taxAmount: { type: Number, default: null },
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
    guestToken: { type: String },
    // Which storefront basket this document is. A customer has at most one of
    // each: 'cart' holds ready-stock catalogue products (ordinary ecommerce,
    // invisible to the admin price-request queue) and 'quote' holds
    // customer-supplied outside_order items awaiting an admin final price.
    // Keeping them as separate documents is what lets a customer hold a cart
    // AND a quote at the same time.
    kind: {
      type: String,
      enum: ['cart', 'quote'],
      default: 'cart',
    },
    guestContact: { type: String },
    guestEmail: { type: String },
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
    discount: { type: Number, default: 0 }, // money taken off by a coupon, BDT
    couponCode: { type: String }, // set while a coupon is applied
    totalPrice: { type: Number, default: 0 },
    updatedBy: { type: String },
    // Last customer SMS outcome for the price queue (PRICE_UPDATED / cancel /
    // hold). SUCCESS | FAILED | null (never sent). Shown in the admin cart
    // modal so a failed SMS can be re-sent manually.
    smsStatus: { type: String, default: null },
    smsAt: { type: Date, default: null },
  },
  { timestamps: true },
);
CartSchema.index({ userId: 1, kind: 1 });
// One basket per kind per guest.
//
// `sparse` is NOT enough here: a sparse index only skips documents where the
// field is ABSENT, and a guest cart folded into a user account used to leave an
// explicit `guestToken: null` behind. Every one of those then collided on
// { guestToken: null, kind: 'cart' }. A partial index on the string type
// excludes both the absent and the null case, so uniqueness is enforced only
// between real guest tokens.
CartSchema.index(
  { guestToken: 1, kind: 1 },
  {
    unique: true,
    partialFilterExpression: { guestToken: { $type: 'string' } },
  },
);
CartSchema.index({ kind: 1, isRequested: 1 });

export default CartSchema;
