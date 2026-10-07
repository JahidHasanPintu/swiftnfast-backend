import * as mongoose from 'mongoose';

/** Courier hand-off for ONE line, written once Pathao accepts the shipment. */
export const PreStockDeliverySchema = new mongoose.Schema(
  {
    method: { type: String, default: '' },
    pathaoConsignmentId: { type: String, default: '' },
    pathaoOrderId: { type: String, default: '' },
    pathaoStatus: { type: String, default: '' },
    pathaoCreatedAt: { type: Date },
  },
  { _id: false },
);

const PreStockOrderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.Mixed },
    prodDesc: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    uniPrice: { type: Number, required: true, default: 0 },
    totalPrice: { type: Number, required: true, default: 0 },
    advancePayment: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    color: { type: String },
    size: { type: String },
    status: { type: String, default: 'PENDING' },
    productImageUrl: { type: String },
    productSourcedFrom: { type: String },
    orderNotes: { type: String },
    couponCode: { type: String },

    // Snapshot of the catalogue row the customer actually bought, taken when
    // the order is created. The basket only stores `productId`, so without
    // this the admin would see "Product 0" and no picture.
    brand: { type: String },
    productSlug: { type: String },
    productUrl: { type: String },
    productImages: { type: [String], default: [] },
    productShortDescription: { type: String },
    cataloguePrice: { type: Number },
    categoryName: { type: String },

    delivery: { type: PreStockDeliverySchema },
  },
  { _id: true },
);

/** Everything the two gateways reported about the money that was collected. */
export const PreStockPaymentDetailsSchema = new mongoose.Schema(
  {
    /** bkash | eps | coupon | mfs */
    gateway: { type: String, default: '' },
    /** Gateway transaction id (bKash `trxID`, EPS `EPSTransactionId`). */
    transactionId: { type: String, default: '' },
    /** Gateway payment id (bKash `paymentID`, EPS merchant transaction id). */
    paymentId: { type: String, default: '' },
    /** The wallet/bank number the customer paid from, when reported. */
    phoneNumber: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    transactionStatus: { type: String, default: '' },
    statusMessage: { type: String, default: '' },
    paidAt: { type: Date },
  },
  { _id: false },
);

/** Frozen copy of the voucher as it was at checkout. */
export const PreStockCouponSnapshotSchema = new mongoose.Schema(
  {
    code: { type: String, default: '' },
    type: { type: String, default: '' },
    value: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 },
    description: { type: String, default: '' },
    discount: { type: Number, default: 0 },
  },
  { _id: false },
);

export const PreStockOrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Login' },
    isGuest: { type: Boolean, default: false },
    guestEmail: { type: String },
    guestContact: { type: String },

    customerName: { type: String, required: true },
    contactNumber: { type: String },
    emailAddress: { type: String },

    items: [PreStockOrderItemSchema],

    itemPrice: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    pfu2Charge: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    // Copied from the basket at checkout so the whole order can be reported on
    // without having to look back at the per-item value.
    couponCode: { type: String },
    /** Frozen copy of the voucher definition, not just its code. */
    coupon: { type: PreStockCouponSnapshotSchema },
    grandTotal: { type: Number, default: 0 },

    shippingAddress: { type: mongoose.Schema.Types.Mixed },
    billingAddress: { type: mongoose.Schema.Types.Mixed },

    paymentMethod: { type: String, default: 'bkash' },
    paymentDetails: { type: PreStockPaymentDetailsSchema },
    advancePayment: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },

    mfsPayment: {
      selectedMFS: { type: String },
      mfsTrxId: { type: String },
      mfsAmount: { type: Number },
      paymentId: { type: String },
    },

    status: {
      type: String,
      enum: [
        'PENDING',
        'CONFIRMED',
        'PROCESSING',
        'USWAREHOUSE',
        'BDOFFICE',
        'SHIPPED',
        'PARTIAL_DELIVERED',
        'FULL_DELIVERED',
        'CANCELLED',
      ],
      default: 'PENDING',
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'pending', 'failed', 'partial'],
      default: 'pending',
    },
  },
  { timestamps: true, collection: 'prestockorders' },
);

PreStockOrderSchema.index({ orderNumber: 1 });
PreStockOrderSchema.index({ userId: 1 });
PreStockOrderSchema.index({ status: 1 });
PreStockOrderSchema.index({ createdAt: -1 });
