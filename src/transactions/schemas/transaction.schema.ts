import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TransactionDocument = Transaction & Document;

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
  TRANSFER = 'transfer',
  BALANCE_ADJUSTMENT = 'balance_adjustment',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ required: true, enum: TransactionType })
  type: TransactionType;

  @Prop({ required: true, min: 0.01 })
  amount: number;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Account' })
  accountId: Types.ObjectId;

  // Only for transfers
  @Prop({ type: Types.ObjectId, ref: 'Account', default: null })
  toAccountId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  category: string; // e.g. "Sales", "Salary", "Utilities", "Rent"

  @Prop({ trim: true })
  subCategory?: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ required: true, default: () => new Date() })
  date: Date;

  @Prop({ enum: TransactionStatus, default: TransactionStatus.COMPLETED })
  status: TransactionStatus;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ trim: true })
  reference?: string; // Invoice no, check no, etc.

  // For balance adjustments: store the difference
  @Prop({ default: null })
  adjustmentNote?: string;

  // Snapshot of balance after this transaction
  @Prop({ default: 0 })
  balanceAfter: number;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

TransactionSchema.set('toJSON', { virtuals: true });
TransactionSchema.set('toObject', { virtuals: true });

// Indexes for fast querying
TransactionSchema.index({ accountId: 1, date: -1 });
TransactionSchema.index({ type: 1, date: -1 });
TransactionSchema.index({ date: -1 });
TransactionSchema.index({ category: 1 });
TransactionSchema.index({ tags: 1 });