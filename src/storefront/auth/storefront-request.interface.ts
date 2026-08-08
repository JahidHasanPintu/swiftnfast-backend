import { Request } from 'express';

export interface StorefrontUser {
  userId: string;
  email: string;
  role?: string;
}

export interface StorefrontRequest extends Request {
  user?: StorefrontUser;
  guestToken?: string;
}
