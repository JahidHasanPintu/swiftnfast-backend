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
}

export interface Cart {
  userId?: any;
  guestToken?: string;
  guestContact?: string;
  isRequested?: boolean;
  isRead?: boolean;
  requestedAt?: Date;
  items: CartItem[];
  itemPrice?: number;
  tax?: number;
  pfu2Charge?: number;
  discount?: number;
  totalPrice?: number;
  shippingAddress?: any;
  billingAddress?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CartDocument = Cart & Document;
