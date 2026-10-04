import * as mongoose from 'mongoose';

export enum CouponType {
  /** A fixed amount off the order total, in BDT. */
  FLAT = 'flat',
  /** A percentage off the order total. `value` is 0-100. */
  PERCENTAGE = 'percentage',
}

/**
 * A discount voucher a customer enters at checkout.
 *
 * `type` decides how `value` is read:
 *   flat       -> value is BDT off the order total
 *   percentage -> value is 0-100 percent off the eligible subtotal, capped by
 *                 `maxDiscount` when the admin sets one
 *
 * A 100% (or larger-than-total) coupon produces a zero payable amount. Those
 * orders skip the payment gateway entirely and are recorded as already paid.
 */
export const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: Object.values(CouponType),
      default: CouponType.PERCENTAGE,
    },
    value: { type: Number, required: true, min: 0 },
    /** Percentage coupons only: ceiling on how much can be taken off. */
    maxDiscount: { type: Number, default: 0, min: 0 },
    /** Order must reach this subtotal (BDT) before the coupon is accepted. */
    minOrderValue: { type: Number, default: 0, min: 0 },

    /** null/unset means it never expires. */
    expiryDate: { type: Date, default: null },
    maxUse: { type: Number, required: true, default: 0, min: 0 }, // 0 = unlimited
    usedCount: { type: Number, default: 0, min: 0 },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CouponSchema.index({ code: 1 }, { unique: true });
CouponSchema.index({ isActive: 1, expiryDate: 1 });