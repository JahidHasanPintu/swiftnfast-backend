import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AccountDocument = Account & Document;

export enum AccountType {
  CASH = 'cash',
  BANK = 'bank',
  MOBILE_BANKING = 'mobile_banking',
  OTHER = 'other',
}

export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Schema({ timestamps: true })
export class Account {
  @Prop({ required: true, trim: true })
  name: string; // e.g. "Cash", "Dutch Bangla Bank", "Bkash", "Rocket"

  @Prop({ required: true, enum: AccountType, default: AccountType.CASH })
  type: AccountType;

  @Prop({ default: 0, min: 0 })
  openingBalance: number;

  @Prop({ default: 0 })
  currentBalance: number;

  @Prop({ trim: true })
  accountNumber?: string; // Bank account / mobile number

  @Prop({ trim: true })
  bankName?: string; // For bank accounts

  @Prop({ trim: true })
  branchName?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ enum: AccountStatus, default: AccountStatus.ACTIVE })
  status: AccountStatus;

  @Prop({ default: false })
  isDefault: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const AccountSchema = SchemaFactory.createForClass(Account);

// Virtual id
AccountSchema.set('toJSON', { virtuals: true });
AccountSchema.set('toObject', { virtuals: true });
