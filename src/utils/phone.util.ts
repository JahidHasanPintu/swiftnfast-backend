/**
 * Normalizes a Bangladeshi phone number to its canonical 11-digit form.
 *
 * Rules:
 *  - Strips everything that is not a digit (+ , spaces, dashes, dots, parens)
 *  - '+8801XXXXXXX' / '8801XXXXXXX' -> '01XXXXXXX' (13 digits -> 11)
 *  - '88' followed by a 10-digit number -> '0' + those 10 digits
 *  - '01XXXXXXX' -> unchanged (11 digits)
 *  - A bare 10-digit local number -> '0' + itself
 *
 * Returns null when the result is not a plausible BD mobile number.
 */
export function normalizePhone(raw?: string): string | null {
  if (!raw || typeof raw !== 'string') return null;

  const digits = raw.replace(/\D/g, '');

  if (digits.length === 13 && digits.startsWith('880')) {
    return `0${digits.slice(3)}`;
  }

  if (digits.length === 12 && digits.startsWith('88')) {
    return `0${digits.slice(2)}`;
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return digits;
  }

  if (digits.length === 10 && digits.startsWith('1')) {
    return `0${digits}`;
  }

  return null;
}
