// Times New Roman AFM 字寬（千分之一 em）；和弦數字下標與升降記號上標均以 0.65 倍估算。
const TNR = {
  A: 722,
  B: 667,
  C: 667,
  D: 722,
  E: 611,
  F: 556,
  G: 722,
  m: 778,
  a: 444,
  j: 278,
  d: 500,
  i: 278,
  s: 389,
  u: 500,
  g: 500,
  b: 500,
  '/': 278,
  '+': 564,
  '#': 500
};
export function chordTextWidth(label, pt = 10) {
  const units = [...label].reduce((n, c) => n + (/\d|[♯♭]/.test(c) ? 500 * 0.65 : (TNR[c] ?? 600)), 0);
  return (units * pt) / 1000;
}
// 每行先由左向右錯開；總寬可容納時才在行尾回推。回傳順序與輸入一致，不修改輸入。
export function staggerChords(items, {gap = 2, right = Infinity} = {}) {
  const sorted = items.map((c, i) => ({...c, i, w: chordTextWidth(c.label)}))
    .sort((a, b) => a.cx - b.cx || a.i - b.i);
  let edge = -Infinity;
  for (const c of sorted) {
    const left = c.cx - c.w / 2;
    if (left < edge + gap) c.cx = edge + gap + c.w / 2;
    edge = c.cx + c.w / 2;
  }
  const total = sorted.reduce((n, c) => n + c.w, 0) + Math.max(0, sorted.length - 1) * gap;
  if (edge > right && total <= right) {
    let limit = right;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const c = sorted[i];
      if (c.cx + c.w / 2 > limit) c.cx = limit - c.w / 2;
      limit = c.cx - c.w / 2 - gap;
    }
  }
  return sorted.sort((a, b) => a.i - b.i).map(c => c.cx);
}
