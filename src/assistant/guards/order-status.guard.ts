export function isOrderStatusQuery(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  if (/\border\b|\bঅর্ডার\b/.test(t) && /\bmy\b|\bamar\b|\bআমার\b/.test(t)) return true;
  if (/\d{6,}/.test(t)) return true;
  return false;
}
