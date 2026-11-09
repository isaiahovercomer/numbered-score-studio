import {widths} from './font-metrics.js';
const groups = ['1234567', '!@#$%^&', 'qwertyu', 'QWERTYU', 'asdfghj', 'ASDFGHJ'];
// 無本機 01SMN 時，以數字、八度點、減時線和延音線描繪；不散布字型檔。
export function drawNotes(raw, x, y, draw) {
  let last = x, tieStart = null, accidental = false, unknown = false;
  const pitchY = y + 15;
  for (const c of raw) {
    const group = groups.findIndex(s => s.includes(c));
    const width = (widths[c] ?? 1) * 14;
    if (group >= 0 || ['`', 'p', ';'].includes(c)) {
      const degree = group < 0 ? 0 : groups[group].indexOf(c) + 1;
      const lines = group < 0 ? ['`', 'p', ';'].indexOf(c) : Math.floor(group / 2);
      draw.text(x, pitchY, String(degree), 13);
      if (accidental) draw.text(x - 5, pitchY - 4, '♭', 9);
      accidental = false;
      for (let i = 0; i < lines; i++) draw.line(x, pitchY + 1.5 + 2 * i, x + Math.max(7, width - 3));
      if (group >= 0 && group % 2) draw.dot(x + 3.5, pitchY - 12);
      last = x;
    } else if ('8ik'.includes(c)) draw.dot(last + 3.5, pitchY + (c === 'k' ? 7 : c === 'i' ? 5 : 3));
    else if (c === ':') accidental = true;
    else if (c === '.' || c === 'o') draw.dot(x + 2, pitchY - 4);
    else if (c === '/') draw.line(x + 2, pitchY - 4, x + 11);
    else if (c === '\\' || c === '|') draw.vertical(x + 3, y + 3, pitchY + 2);
    else if (c === '9') tieStart = last + 4;
    else if (c === '0' && tieStart !== null) {
      draw.tie(tieStart, y - 2, Math.max(4, x + 4 - tieStart)); tieStart = null;
    }
    else if (!' =0'.includes(c)) unknown = true;
    x += width;
  }
  if (tieStart !== null) draw.tie(tieStart, y - 2, Math.max(4, x - tieStart));
  return unknown;
}
