import { Document } from 'mongoose';

export interface PurchaseDocument extends Document {
  customerId: string;
  destination: string;
  cardType: string;
  selling: string;
  currencyAmount: string;
  buyingUP: string;
  buyingBDT: string;
  advance: string;
  grossProfit: string;
  purchaseDate: Date;
  note: string;
  confirmationMail: string;

  // need this just because show some extra info

  orderId: string;
  customerName: string;
  prodDesc: string;
  size: string;
  color: string;
  quantity: number;
  country: string;
  orderDate: Date;

  trackId: string;

  orderItemIndex: number;
  cardUsed: string;
  websiteUrl: string;

  // shipment extra information

  productWeight: number;
  weightChargePerKg: number;
  productWeightCharge: number;
  remaniningDue: number;
  shipmentId?: any;
}
