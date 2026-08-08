import { Document, Types } from 'mongoose';
import { ShipmentStatus } from './schemas/shipment.schema';

export interface ShipmentDocument extends Document {
  _id: Types.ObjectId;
  shipmentName: string;
  shippingAddressId: Types.ObjectId;
  agentName: string;
  origin: string;
  country: string;
  shipmentDate: Date;
  expectedArrivalDate?: Date;
  actualArrivalDate?: Date;
  status: ShipmentStatus;
  totalProducts: number;
  totalWeightKg: number;
  totalShippingCost: number;
  actualWeightChargePerKg: number;
  customerWeightChargeTotal: number;
  weightChargeProfit: number;
  totalGrossProfit: number;
  totalNetProfit: number;
  customsDuty: number;
  otherExpenses: number;
  otherExpensesNote?: string;
  trackingNumber?: string;
  airline?: string;
  flightNumber?: string;
  portOfEntry: string;
  shippingExpenseTransactionId?: Types.ObjectId;
  notes?: string;
}

export interface PurchaseDocument extends Document {
  _id: Types.ObjectId;
  orderId: string;
  orderItemIndex: number;
  customerId: string;
  shipmentId?: Types.ObjectId;
  productWeight: number;
  weightChargePerKg: number;
  productWeightCharge: number;
  actualWeightChargePerKg: number;
  weightChargeProfit: number;
  grossProfit: string;
  status: string;
  profitRecorded: boolean;
  selling: string;
  customerName: string;
  prodDesc: string;
  country: string;
}

export interface ShippingAddressDocument extends Document {
  _id: Types.ObjectId;
  source: string;
  origin: string;
  weightCharge: string;
}
