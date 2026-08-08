import { Document } from 'mongoose';

export interface ProductDocument extends Document {
  name: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  color?: string;
  size?: string;
  categoryId?: string;
  brand?: string;
  gender?: string;
  stock: number;
  price: number;
  discountPrice?: number;
  tax: number;
  pfuCharge: number;
  images: any;
  isLimitedTimeOffer: boolean;
  isFeaturedDailyDeal: boolean;
  isTrending: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
