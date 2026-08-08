import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign, verify } from 'jsonwebtoken';

export interface StorefrontJwtPayload {
  email: string;
  userId: string;
  role?: string;
}

@Injectable()
export class StorefrontJwtService {
  constructor(private readonly configService: ConfigService) {}

  /** Storefront tokens are signed with JWT_ACCESS_SECRET (pfu2) or JWT_SECRET fallback. */
  private get secret(): string {
    return (
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'storefront-secret'
    );
  }

  sign(payload: StorefrontJwtPayload): string {
    return sign(payload, this.secret, { expiresIn: '30d' });
  }

  verify(token: string): StorefrontJwtPayload {
    try {
      return verify(token, this.secret) as StorefrontJwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /** Returns the payload or null (no throw) — used by the optional guard. */
  tryVerify(token?: string): StorefrontJwtPayload | null {
    if (!token) return null;
    try {
      return verify(token, this.secret) as StorefrontJwtPayload;
    } catch {
      return null;
    }
  }
}
