export function rrf(
  lists: Array<Array<{ id: string; score?: number }>>,
  k = 60,
): Array<{ id: string; score: number }> {
  const map = new Map<string, number>();
  for (let i = 0; i < lists.length; i++) {
    const list = lists[i];
    for (let r = 0; r < list.length; r++) {
      const item = list[r];
      const s = (map.get(item.id) || 0) + 1 / (k + (r + 1));
      map.set(item.id, s);
    }
  }
  const res = Array.from(map.entries()).map(([id, score]) => ({ id, score }));
  return res.sort((a, b) => b.score - a.score);
}
