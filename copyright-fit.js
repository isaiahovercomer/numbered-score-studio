// New Century Schoolbook Italic AFM 字寬（千分之一 em）。
// ASCII 32–126；相容字寬來源為 URW C059 Italic AFM，不含任何字型檔。
const ASCII_WIDTHS = [
  278, 333, 400, 556, 556, 833, 852, 278, 333, 333, 500, 606,
  278, 333, 278, 606, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 606, 606, 606, 444, 747, 704, 722, 722,
  778, 722, 667, 778, 833, 407, 611, 741, 667, 944, 815, 778,
  667, 778, 741, 667, 685, 815, 704, 926, 704, 685, 667, 333,
  606, 333, 606, 500, 204, 574, 556, 444, 611, 444, 333, 537,
  611, 333, 315, 556, 333, 889, 611, 500, 574, 556, 444, 444,
  352, 611, 519, 778, 500, 500, 463, 333, 606, 333, 606
];

export function copyrightWidth(text, pt) {
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (
      /\p{Script=Han}/u.test(ch) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0xff00 && code <= 0xffef)
    ) {
      units += 1000;
    } else if (code >= 32 && code <= 126) units += ASCII_WIDTHS[code - 32];
    else units += ch === '©' ? 747 : 1000;
  }
  return (units / 1000) * pt * 1.05;
}

// h 為單行行高；錨點總高度為 h × lines。
export function copyrightFit(text, o) {
  if (copyrightWidth(text, 10) <= 360) return {pt: 10, lines: 1, w: 360, h: 14};
  let pt = 10;
  while (pt > 7 && copyrightWidth(text, pt) > o.usable) pt -= 0.5;
  const lines = copyrightWidth(text, pt) <= o.usable ? 1 : 2;
  return {pt, lines, w: o.usable, h: Math.ceil(pt * 1.4)};
}
