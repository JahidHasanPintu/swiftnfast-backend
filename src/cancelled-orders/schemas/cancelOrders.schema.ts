import * as mongoose from 'mongoose';

export const CancelledOrderSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true },
    orderId: { type: String, required: true },
    customerName: { type: String, required: true },
    productDesc: { type: String, required: true },
    cancellationReason: { type: String, required: true },
    date: { type: Date, required: true },
  },
  { timestamps: true, collection: 'cancelled-orders' },
);

export default CancelledOrderSchema;
