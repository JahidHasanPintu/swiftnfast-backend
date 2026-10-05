export function isSensitive(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  const patterns = [
    /\bpassword\b/,
    /\bpin\b/,
    /\botp\b/,
    /\bcvv\b/,
    /\bcard\b/,
    /\baccount\b/,
    /\bpassword\b|\bপাসওয়ার্ড\b|\bপিন\b|\bওটিপি\b/,
  ];
  for (const p of patterns) if (p.test(t)) return true;
  return false;
}
