import { Document } from 'mongoose';

export interface Pfu2UserDocument extends Document {
  name: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  role: 'superAdmin' | 'admin' | 'user';
  status?: 'active' | 'inactive' | 'blocked';
  isDeleted: boolean;
  isVerified: boolean;
  needsPasswordChange: boolean;
  passwordChangedAt?: Date;
  otp?: string;
  otpExpiry?: Date;
  otpVerified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
