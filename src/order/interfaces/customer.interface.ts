import { Document } from 'mongoose';

export interface CustomerDocument extends Document {
  customerId: string;
  orderId: string;
  customerName: string;
  contactNumber: string;
  emailAddress: string;
  shippingAddress: string;
  districtName: string;
  totalAdvance: number;
  grandTotal: number;
  sourceOfOrder: string;
  customerDateOfBirth: Date;
  customerJoiningDate: Date;
  orderDate: Date;
  createdBy: string;
}


export default CustomerDocument;
