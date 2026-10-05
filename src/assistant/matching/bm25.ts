export interface BM25Doc {
  id: string;
  text: string;
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
}

export function bm25Score(
  query: string,
  docs: BM25Doc[],
  opts: { k1?: number; b?: number } = {},
): Array<{ id: string; score: number }> {
  const k1 = opts.k1 ?? 1.5;
  const b = opts.b ?? 0.75;
  const qTokens = Array.from(new Set(tokenize(query)));
  if (!qTokens.length) return docs.map((d) => ({ id: d.id, score: 0 }));
  const N = docs.length;
  const avgLen = docs.reduce((s, d) => s + tokenize(d.text).length, 0) / (N || 1);
  const df: Record<string, number> = {};
  const docsTokens: Array<string[]> = docs.map((d) => tokenize(d.text));
  for (let i = 0; i < docsTokens.length; i++) {
    const set = new Set(docsTokens[i]);
    for (const t of set) df[t] = (df[t] || 0) + 1;
  }
  const results: Array<{ id: string; score: number }> = [];
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    const dtoks = docsTokens[i];
    const dl = dtoks.length || 0;
    let s = 0;
    const freq: Record<string, number> = {};
    for (const t of dtoks) freq[t] = (freq[t] || 0) + 1;
    for (const qt of qTokens) {
      const f = freq[qt] || 0;
      if (f === 0) continue;
      const idf = Math.log((N - (df[qt] || 0) + 0.5) / ((df[qt] || 0) + 0.5) + 1);
      const denom = f + k1 * (1 - b + b * (dl / (avgLen || 1)));
      s += idf * ((f * (k1 + 1)) / (denom || 1));
    }
    results.push({ id: d.id, score: s });
  }
  return results.sort((a, b) => b.score - a.score);
}
