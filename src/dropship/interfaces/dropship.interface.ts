import { Document, Types } from 'mongoose';

export interface DropShipDocument extends Document {
  dropshipId: string;
  customerId: Types.ObjectId;
  customerName: string;
  contactNo: string;
  orderDate: Date;
  productDescription: string;
  productUrl: string;
  quantity: number;
  color: string;
  size: string;
  productWeight: number;
  weightChargePerKg: number;
  productWeightCharge: number;
  remainingDue: number;
  orderNotes: string;
  status: string;
  deliveryMethod: string;
  shipmentId: Types.ObjectId;
  actualWeightChargePerKg: number;
  weightChargeProfit: number;
  profitRecorded: boolean;
  deliveryDate: Date;
  createdBy: string;
}
