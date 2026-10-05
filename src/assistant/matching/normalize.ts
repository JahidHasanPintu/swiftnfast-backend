const BENGALI_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export function normalizeBanglaDigits(text: string): string {
  return text.replace(/[০-৯]/g, (d) => BENGALI_DIGITS[d] || d);
}

export function normalizeText(text: string): string {
  if (!text) return '';
  let t = text.toLowerCase();
  t = normalizeBanglaDigits(t);
  t = t.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

export function expandSynonyms(text: string, synonyms: Record<string, string[]>): string {
  const tokens = text.split(/\s+/);
  const extra: string[] = [];
  for (const tok of tokens) {
    const s = synonyms[tok];
    if (s && s.length) extra.push(...s);
  }
  if (extra.length) return text + ' ' + extra.join(' ');
  return text;
}
