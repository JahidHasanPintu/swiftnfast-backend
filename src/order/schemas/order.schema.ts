import * as mongoose from 'mongoose';

export const OrderSchema = new mongoose.Schema(
  {
    orderId: { type: String }, 
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }, 
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }, 
    customerName: { type: String },
    contactNo: { type: String },
    orderDate: { type: Date },
    isPurchased: { type: Boolean, default: false },
    orderItemIndex: { type: Number },
    grandTotal: { type: Number },
    productUrl: { type: String, required: true },
    quantity: { type: Number, required: true },
    couponCode: { type: String },
    prodDesc: { type: String, required: true }, // Product Description
    color: { type: String },
    size: { type: String },
    origin: { type: String, required: true }, // Origin
    uniPrice: { type: Number, required: true }, // Unit Price
    totalPrice: { type: Number, required: true }, // Total Price
    advancePayment: { type: Number }, // Advance
    remainingAmount: { type: Number, required: true }, // Remaining Amount
    orderNotes: { type: String }, // Order Notes
    websiteUrl: { type: String }, // Website
    status: {
      type: String,
      enum: ['Purchased', 'Pending', 'Cancelled', 'Ready To Deliver', 'Shipped', 'Delivered'],
      default: 'Pending',
    },
    createdBy: { type: String },
  },
  {
    timestamps: true, // This option will add createdAt and updatedAt fields
  },
);
// Add the necessary indexes
OrderSchema.index({ orderId: 1 });  // Index on orderId
OrderSchema.index({ customerId: 1 });  // Index on customerId for faster lookups
OrderSchema.index({ orderDate: -1 });  // Index on orderDate for faster sorting

export default OrderSchema;
export const Order = mongoose.model('Order', OrderSchema);