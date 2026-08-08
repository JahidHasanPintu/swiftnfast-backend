import { createHash } from 'crypto';

/** pfu2-style password hashing is NOT used by the storefront (OTP auth). */

/** Normalize a phone number to its digits (for lookups/dedup). */
export function digitsOnly(raw?: string | null): string {
  return raw ? raw.replace(/\D/g, '') : '';
}

/** pfu2 `generateOrderNumber`: ORD-{ts}-{3-digit random}. */
export function generateOrderNumber(): string {
  const random = Math.floor(100 + Math.random() * 900);
  return `ORD-${Date.now()}-${random}`;
}

/** Deterministic id for anonymous outside-order customers. */
export function outsideCustomerKey(id: number | string): string {
  return `OUT-${id}`;
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
