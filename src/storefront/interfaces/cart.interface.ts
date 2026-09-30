import { Document } from 'mongoose';

export interface CartItem {
  productId?: any;
  name?: string;
  image?: string;
  quantity: number;
  price?: any;
  type?: 'product' | 'outside_order';
  ssImageUrl?: string;
  isPriceUpdated?: boolean;
  priceManuallyUpdated?: boolean;
  finalPrice?: any;
  productUrl?: string;
  productSourcedFrom?: string;
  color?: string;
  size?: string;
  notes?: string;
  promoCode?: string;
  category?: string;
  variant?: string;
  approximatePrice?: number;
  totalEstimatedPrice?: number;
  status?: string;
  adminStatus?: 'PENDING' | 'HOLD' | 'CANCELLED';
  adminReason?: string;
  /** USA sales tax RATE as a percentage (e.g. 10 = 10%). Not money. */
  usaSalesTax?: number | null;
  shippingCost?: number;
  /**
   * Per-unit BDT breakdown stamped on every cart write from pricing.util.ts
   * (ceil entered price -> tax -> FX -> ceil BDT). Null/absent means "not yet
   * stamped", which breakdownBdt() reads as "compute it live", so carts written
   * before these fields existed keep pricing correctly without a migration.
   */
  priceBdt?: number | null; // tax INCLUDED, shipping EXCLUDED
  taxBdt?: number | null; // tax portion of priceBdt
  shippingBdt?: number | null; // converted, never taxed
}

export interface Cart {
  userId?: any;
  guestToken?: string;
  guestContact?: string;
  isRequested?: boolean;
  isRead?: boolean;
  requestedAt?: Date;
  items: CartItem[];
  itemPrice?: number; // tax-inclusive product price, BDT
  tax?: number; // tax portion of itemPrice, BDT
  /** Converted-but-untaxed shipping total, BDT. */
  shippingBdt?: number;
  pfu2Charge?: number;
  discount?: number;
  totalPrice?: number;
  updatedBy?: string;
  shippingAddress?: any;
  billingAddress?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CartDocument = Cart & Document;
