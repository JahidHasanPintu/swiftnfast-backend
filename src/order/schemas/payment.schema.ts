import * as mongoose from 'mongoose';

export const PaymentSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true }, // Order ID
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: false,
    }, // Reference to Customer ObjectId (optional for guest/website orders)
    // Gateway-facing fields. These are written by the storefront order flows
    // (bkash / eps / coupon) and read back when grouping line items into
    // orders for the customer's account pages. Without them Mongoose's strict
    // mode silently drops every write, so `paymentStatus` would always read
    // back as undefined and orders would look permanently unpaid.
    method: { type: String, default: '' }, // bkash | eps | cash | coupon
    phoneNumber: { type: String, default: '' },
    transactionStatus: { type: String, default: 'pending' },
    statusMessage: { type: String, default: '' },
    amount: { type: String, default: '' }, // kept as string: written as String(total)
    paymentStatus: {
      type: String,
      enum: ['paid', 'pending', 'failed', 'partial'],
      default: 'pending',
    },
    paymentSource: { type: String, default: '' }, // prestock | import
    cashPayment: { type: Number, default: 0 },
    mfsPayment: {
      selectedMFS: { type: String },
      mfsTrxId: { type: String },
      mfsAmount: { type: Number },
    },
    bankPayment: {
      selectedBank: { type: String },
      bankTrxId: { type: String },
      bankAmount: { type: Number },
    },
  },
  { timestamps: true },
);
// Add the necessary indexes
PaymentSchema.index({ orderId: 1 }); // Index on orderId
PaymentSchema.index({ customerId: 1 }); // Index on customerId for faster lookups
export default PaymentSchema;
