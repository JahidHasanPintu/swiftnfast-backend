import * as mongoose from 'mongoose';

export const DropShipSchema = new mongoose.Schema(
  {
    dropshipId: { type: String },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String },
    contactNo: { type: String },
    orderDate: { type: Date },
    productDescription: { type: String, required: true },
    productUrl: { type: String },
    quantity: { type: Number, required: true },
    color: { type: String },
    size: { type: String },
    productWeight: { type: Number, required: true },
    weightChargePerKg: { type: Number, required: true },
    productWeightCharge: { type: Number, default: 0 },
    remainingDue: { type: Number, default: 0 },
    orderNotes: { type: String },
    status: {
      type: String,
      enum: [
        'Pending',
        'Ready To Deliver',
        'Shipped',
        'Delivered',
        'Cancelled',
      ],
      default: 'Pending',
    },
    deliveryMethod: {
      type: String,
      enum: ['Office Pickup', 'Pathao'],
      default: 'Office Pickup',
    },
    shipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipment',
      default: null,
    },
    actualWeightChargePerKg: { type: Number, default: 0 },
    weightChargeProfit: { type: Number, default: 0 },
    profitRecorded: { type: Boolean, default: false },
    deliveryDate: { type: Date },
    createdBy: { type: String },
  },
  { timestamps: true },
);

DropShipSchema.index({ dropshipId: 1 });
DropShipSchema.index({ customerId: 1 });
DropShipSchema.index({ status: 1 });
DropShipSchema.index({ shipmentId: 1 });

export default DropShipSchema;
