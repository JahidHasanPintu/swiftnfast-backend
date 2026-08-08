import * as mongoose from 'mongoose';

export enum ShipmentStatus {
  PENDING = 'pending', // agent collecting orders
  IN_TRANSIT = 'in_transit', // shipped from origin, in air/sea
  ARRIVED = 'arrived', // landed in Bangladesh
  CUSTOMS = 'customs', // in customs clearance
  DELIVERED = 'delivered', // all products delivered to customers
  CANCELLED = 'cancelled',
}

export const ShipmentSchema = new mongoose.Schema(
  {
    // ── Identity ────────────────────────────────────────────────────────────────
    shipmentName: { type: String, required: true, trim: true },
    // e.g. "USA-JUN-2024-01", "UK-MAY-2024-02"

    // ── Agent / Warehouse link ───────────────────────────────────────────────────
    shippingAddressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'shipping-address',
      required: true,
    },
    // Denormalized for fast reads & historical accuracy
    agentName: { type: String, required: true }, // e.g. "Shameem"
    origin: { type: String, required: true }, // e.g. "United States"
    country: { type: String, required: true }, // e.g. "USA"

    // ── Dates ───────────────────────────────────────────────────────────────────
    shipmentDate: { type: Date, required: true }, // date we send from origin / agent ships
    expectedArrivalDate: { type: Date },
    actualArrivalDate: { type: Date },

    // ── Status ──────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: Object.values(ShipmentStatus),
      default: ShipmentStatus.PENDING,
    },

    // ── Weight & Products ───────────────────────────────────────────────────────
    totalProducts: { type: Number, default: 0 }, // count of purchase items linked
    totalWeightKg: { type: Number, default: 0 }, // sum of productWeight across purchases

    // ── Cost Tracking (Profit Source 1) ─────────────────────────────────────────
    totalShippingCost: { type: Number, default: 0 },
    // What we ACTUALLY paid the agent for shipping this entire shipment (BDT)

    actualWeightChargePerKg: { type: Number, default: 0 },
    // = totalShippingCost / totalWeightKg  (auto-calculated on save)
    // This is our REAL cost per kg

    customerWeightChargeTotal: { type: Number, default: 0 },
    // = sum of all productWeightCharge from linked purchases
    // What we collected from customers for weight

    weightChargeProfit: { type: Number, default: 0 },
    // = customerWeightChargeTotal - totalShippingCost  (Profit Source 1)

    // ── Currency Profit (Profit Source 2) ───────────────────────────────────────
    totalGrossProfit: { type: Number, default: 0 },
    // = sum of grossProfit from all linked & delivered purchases (exchange spread)

    // ── Combined ────────────────────────────────────────────────────────────────
    totalNetProfit: { type: Number, default: 0 },
    // = weightChargeProfit + totalGrossProfit

    // ── Other Costs ─────────────────────────────────────────────────────────────
    customsDuty: { type: Number, default: 0 }, // customs charges if any
    otherExpenses: { type: Number, default: 0 }, // warehouse, handling, misc
    otherExpensesNote: { type: String },

    // ── Tracking & Logistics ────────────────────────────────────────────────────
    trackingNumber: { type: String }, // courier tracking ID
    airline: { type: String }, // e.g. "Emirates", "Qatar Airways"
    flightNumber: { type: String },
    portOfEntry: { type: String, default: 'Dhaka' }, // e.g. "Chittagong", "Dhaka"

    // ── Finance Link ────────────────────────────────────────────────────────────
    shippingExpenseTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    // Auto-created expense transaction when totalShippingCost is set

    // ── Notes ───────────────────────────────────────────────────────────────────
    notes: { type: String },
  },
  { timestamps: true },
);

// Auto-calculate derived fields before save
ShipmentSchema.pre('save', function (next) {
  if (this.totalShippingCost > 0 && this.totalWeightKg > 0) {
    this.actualWeightChargePerKg = parseFloat(
      (this.totalShippingCost / this.totalWeightKg).toFixed(2),
    );
  }
  this.weightChargeProfit = parseFloat(
    (
      this.customerWeightChargeTotal -
      this.totalShippingCost -
      this.customsDuty -
      this.otherExpenses
    ).toFixed(2),
  );
  this.totalNetProfit = parseFloat(
    (this.weightChargeProfit + this.totalGrossProfit).toFixed(2),
  );
  next();
});

// Indexes
ShipmentSchema.index({ status: 1 });
ShipmentSchema.index({ shipmentDate: -1 });
ShipmentSchema.index({ shippingAddressId: 1 });
ShipmentSchema.index({ country: 1 });

export default ShipmentSchema;
