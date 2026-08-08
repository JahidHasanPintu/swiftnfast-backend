import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { StorefrontJwtService } from './storefront-jwt.service';
import { StorefrontRequest } from './storefront-request.interface';

function extractToken(req: any): string | undefined {
  const header = req.headers?.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : undefined;
}

/**
 * Optional storefront auth: verifies the Bearer token (if present) and attaches
 * `req.user = { userId, email, role }`; never throws. Also reads `x-guest-token`.
 */
@Injectable()
export class StorefrontOptionalAuthGuard implements CanActivate {
  constructor(protected readonly jwtService: StorefrontJwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req: StorefrontRequest = context.switchToHttp().getRequest();
    const token = extractToken(req);
    const payload = this.jwtService.tryVerify(token);
    if (payload) {
      req.user = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      };
    }
    req.guestToken = req.headers?.['x-guest-token'] as string | undefined;
    return true;
  }
}

/**
 * Required storefront auth: 401 unless a valid storefront Bearer token is present.
 */
@Injectable()
export class StorefrontAuthGuard extends StorefrontOptionalAuthGuard {
  canActivate(context: ExecutionContext): boolean {
    const req: StorefrontRequest = context.switchToHttp().getRequest();
    const token = extractToken(req);
    const payload = this.jwtService.tryVerify(token);
    if (!payload) {
      throw new UnauthorizedException('You are not authorized!');
    }
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
    req.guestToken = req.headers?.['x-guest-token'] as string | undefined;
    return true;
  }
}
