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
  featuredImage?: string;
  variationAttributes?: {
    id: string;
    name: string;
    values: string[];
  }[];
  variations?: {
    id: string;
    name?: string;
    attributes?: Record<string, string>;
    price?: number;
    discountPrice?: number;
    stock?: number;
    sku?: string;
  }[];
  isLimitedTimeOffer: boolean;
  isFeaturedDailyDeal: boolean;
  isTrending: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
