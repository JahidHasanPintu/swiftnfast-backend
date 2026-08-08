import * as mongoose from 'mongoose';

export const CustomerSchema = new mongoose.Schema({
  customerId: { type: String, required: true }, // Unique customer identifier (e.g., 'PFU2-2334')
  customerName: { type: String, required: true },
  contactNumber: { type: String, required: true },
  emailAddress: { type: String },
  shippingAddress: { type: String, required: true },
  districtName: { type: String, required: true },
  totalAdvance: { type: Number },
  grandTotal: { type: Number, required: true },
  sourceOfOrder: { type: String, required: true },
  customerDateOfBirth: { type: Date },
  customerJoiningDate: { type: Date },
  orderDate: { type: Date },
  createdBy: { type: String },
}, { timestamps: true });
// Add the necessary indexes
CustomerSchema.index({ customerId: 1 });  // Index on customerId for newer orders
CustomerSchema.index({ orderId: 1 });  // Index on orderId for older orders

export default CustomerSchema;
