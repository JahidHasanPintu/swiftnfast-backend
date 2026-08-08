import * as mongoose from 'mongoose';

export const OrderSchema = new mongoose.Schema(
  {
    orderId: { type: String },
    orderNumber: { type: String },
    orderType: {
      type: String,
      enum: ['import', 'prestock'],
      default: 'import',
    },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String },
    contactNo: { type: String },
    orderDate: { type: Date },
    isPurchased: { type: Boolean, default: false },
    orderItemIndex: { type: Number },
    grandTotal: { type: Number },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productUrl: { type: String },
    productSourcedFrom: { type: String },
    quantity: { type: Number },
    couponCode: { type: String },
    prodDesc: { type: String },
    color: { type: String },
    size: { type: String },
    origin: { type: String },
    uniPrice: { type: Number },
    totalPrice: { type: Number },
    advancePayment: { type: Number },
    remainingAmount: { type: Number },
    orderNotes: { type: String },
    websiteUrl: { type: String },
    approximatePrice: { type: Number },
    weightCharge: { type: Number },
    totalEstimatedPrice: { type: Number },
    ssImageUrl: { type: String },
    // Pre-stock fields (pfu2 legacy cart-based order)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pfu2User' },
    isGuest: { type: Boolean, default: false },
    guestEmail: { type: String },
    guestContact: { type: String },
    items: { type: mongoose.Schema.Types.Mixed },
    itemPrice: { type: Number },
    tax: { type: Number },
    pfu2Charge: { type: Number },
    discount: { type: Number },
    shippingAddress: { type: mongoose.Schema.Types.Mixed },
    billingAddress: { type: mongoose.Schema.Types.Mixed },
    paymentMethod: { type: String },
    isRead: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        'Purchased',
        'Pending',
        'Cancelled',
        'Ready To Deliver',
        'Shipped',
        'Delivered',
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
      default: 'Pending',
    },
    createdBy: { type: String },
  },
  {
    timestamps: true,
  },
);
OrderSchema.index({ orderId: 1 });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ orderType: 1 });
OrderSchema.index({ customerId: 1 });
OrderSchema.index({ userId: 1 });
OrderSchema.index({ orderDate: -1 });

export default OrderSchema;
