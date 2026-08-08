import { BadRequestException, HttpException } from '@nestjs/common';

/**
 * pfu2 response envelope helper. Mirrors `utils/sendResponse.js`:
 * `{ success, message, meta, data }` — `meta` and `data` are omitted
 * from the JSON when `undefined`.
 */
export interface Envelope {
  success: boolean;
  message?: string;
  meta?: any;
  data?: any;
}

export function sendResponse(
  payload: Envelope,
  statusCode = 200,
): Envelope {
  if (statusCode >= 400) {
    throw new HttpException(payload, statusCode);
  }
  return payload;
}

export function sendError(message: string, statusCode = 400): never {
  throw new HttpException({ success: false, message }, statusCode);
}

export function sendBadRequest(message: string): never {
  throw new BadRequestException({ success: false, message });
}
