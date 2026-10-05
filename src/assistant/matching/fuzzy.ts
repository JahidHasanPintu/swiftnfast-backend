export function trigram(s: string): string[] {
  const t = s.toLowerCase();
  if (t.length < 3) return [t];
  const res: string[] = [];
  for (let i = 0; i <= t.length - 3; i++) res.push(t.slice(i, i + 3));
  return res;
}

export function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const ta = trigram(a);
  const tb = trigram(b);
  if (!ta.length || !tb.length) return 0;
  const setB = new Set(tb);
  let inter = 0;
  for (const x of ta) if (setB.has(x)) inter++;
  const union = ta.length + tb.length - inter;
  return union === 0 ? 0 : inter / union;
}
