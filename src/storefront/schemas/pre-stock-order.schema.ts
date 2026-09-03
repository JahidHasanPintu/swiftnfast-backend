import * as mongoose from 'mongoose';

const PreStockOrderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
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
  },
  { _id: true },
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
    grandTotal: { type: Number, default: 0 },

    shippingAddress: { type: mongoose.Schema.Types.Mixed },
    billingAddress: { type: mongoose.Schema.Types.Mixed },

    paymentMethod: { type: String, default: 'bkash' },
    advancePayment: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },

    mfsPayment: {
      selectedMFS: { type: String },
      mfsTrxId: { type: String },
      mfsAmount: { type: Number },
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
