import { Document, ObjectId } from 'mongoose';
import CustomerDocument from './customer.interface';

export interface OrderDocument extends Document {
  customerId: ObjectId;
  orderId: string; // Add this line for the orderId field

  customer?: CustomerDocument;

  orderDate: Date;
  productUrl: string;
  quantity: number;
  couponCode: string;
  prodDesc: string;
  color: string;
  size: string;
  origin: string;
  uniPrice: number;
  totalPrice: number;
  advancePayment: number;
  remainingAmount: number;
  isPurchased: boolean;
  orderItemIndex: number;
  customerName: string;
  contactNo: string;
  grandTotal: number;
  createdBy: string;
  orderNotes: string;
  websiteUrl: string;
}
