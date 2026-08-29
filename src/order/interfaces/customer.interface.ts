import { Document } from 'mongoose';

export interface CustomerDocument extends Document {
  // Order-related fields
  customerId?: string;
  orderId?: string;
  customerName: string;
  contactNumber: string;
  emailAddress?: string;
  shippingAddress?: string;
  districtName?: string;
  totalAdvance?: number;
  grandTotal?: number;
  sourceOfOrder?: string;
  customerDateOfBirth?: Date;
  customerJoiningDate?: Date;
  orderDate?: Date;
  createdBy?: string;

  // Profile fields
  phone?: string;
  address?: string;
  dateOfBirth?: Date;

  // Auth fields
  password?: string;
  role: 'superAdmin' | 'admin' | 'user';
  isVerified: boolean;
  isDeleted: boolean;
  needsPasswordChange: boolean;
  passwordChangedAt?: Date;
  otp?: string;
  otpExpiry?: Date;
  otpVerified: boolean;
  resetToken?: string;
  resetTokenExpiry?: Date;
  status?: 'active' | 'inactive' | 'blocked';

  createdAt?: Date;
  updatedAt?: Date;
}

export default CustomerDocument;
