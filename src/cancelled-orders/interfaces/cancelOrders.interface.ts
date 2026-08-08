import { Document } from 'mongoose';

export interface CancelledOrderDocument extends Document {
  customerId: string;
  orderId: string;
  customerName: string;
  productDesc: string;
  cancellationReason: string;
  date: Date;
}
