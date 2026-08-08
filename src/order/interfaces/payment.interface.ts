import { Document, ObjectId } from 'mongoose';

export interface PaymentDocument extends Document {
  orderId: string;
  customerId: ObjectId;
  cashPayment: number;
  mfsPayment: {
    selectedMFS: string;
    mfsTrxId: string;
    mfsAmount: number;
  };
  bankPayment: {
    selectedBank: string;
    bankTrxId: string;
    bankAmount: number;
  };
}
