import * as mongoose from 'mongoose';

export const PurchaseSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true },
    destination: { type: String, required: true },
    cardType: { type: String, required: true },
    selling: { type: String, required: true },
    currencyAmount: { type: String, required: true },
    buyingUP: { type: String, required: true },
    buyingBDT: { type: String, required: true },
    advance: { type: String, required: true },
    grossProfit: { type: String, default: '' },
    purchaseDate: { type: Date, required: true },
    note: { type: String },

    orderId: { type: String, required: true },
    customerName: { type: String, required: true },
    prodDesc: { type: String, required: true },
    size: { type: String },
    color: { type: String },
    quantity: { type: Number, required: true },
    country: { type: String, required: true },
    orderDate: { type: Date, required: true },
    orderItemIndex: { type: Number, required: true },
    confirmationImage: { type: String },
    confirmationMail: { type: String },
    cardUsed: { type: String },
    trackId: { type: String },
    websiteUrl: { type: String },

    // ── Weight & Shipping ────────────────────────────────────────────────────────
    productWeight: { type: Number, default: 0 },
    weightChargePerKg: { type: Number, default: 0 }, // what we CHARGE customer per kg
    productWeightCharge: { type: Number, default: 0 }, // = productWeight * weightChargePerKg

    // ─── NEW: Real cost per kg (set when shipment cost is finalized) ─────────────
    actualWeightChargePerKg: { type: Number, default: 0 }, // = shipment.totalShippingCost / totalWeightKg
    weightChargeProfit: { type: Number, default: 0 },
    // = (weightChargePerKg - actualWeightChargePerKg) * productWeight

    // ─── NEW: Shipment link ──────────────────────────────────────────────────────
    shipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipment',
      default: null,
    },

    // ── Financials ───────────────────────────────────────────────────────────────
    remaniningDue: { type: Number, default: 0 },

    // ── Status & Delivery ────────────────────────────────────────────────────────
    status: {
      type: String,
      default: 'Purchased',
      enum: [
        'Pending',
        'Purchased',
        'Ready To Deliver',
        'Shipped',
        'Delivered',
        'Cancelled',
      ],
    },
    deliveryDate: { type: Date },
    deliveryMethod: {
      type: String,
      default: 'Office Pickup',
      enum: ['Office Pickup', 'Pathao'],
    },
    pathaoConsignmentId: { type: String },
    pathaoOrderId: { type: String },
    pathaoStatus: { type: String },
    pathaoCreatedAt: { type: Date },
    recipientAddress: { type: String },
    recipientPhone: { type: String },

    // ─── NEW: Profit tracking flag ───────────────────────────────────────────────
    profitRecorded: { type: Boolean, default: false },
    // Prevents duplicate income transactions when status → Delivered
  },
  { timestamps: true },
);

// Index for shipment lookups
PurchaseSchema.index({ shipmentId: 1 });
PurchaseSchema.index({ orderId: 1, orderItemIndex: 1 }, { unique: true });

export default PurchaseSchema;
