// 簡譜記號與歌詞解析：調號名稱、節次標記、01SMN 字元對應、歌詞分節與逐字對位。
import {KEYS} from './music.js';
const scale = [0, 2, 4, 5, 7, 9, 11];
const CN_MARKS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
// ①～⑳（U+2460）、㉑～㉟（U+3251）、㊱～㊿（U+32B1）；超過 50 節退回「51、」。
export function verseMark(i, style = 'circled') {
  const n = i + 1;
  if (style === 'circled') {
    if (n <= 20) return String.fromCodePoint(0x2460 + i);
    if (n <= 35) return String.fromCodePoint(0x3251 + n - 21);
    if (n <= 50) return String.fromCodePoint(0x32b1 + n - 36);
  }
  return (CN_MARKS[i] || n) + '、';
}
// 官方調號寫法：「D大調」；降記號寫「降B大調」（官方樣本只有 D 大調，降調寫法為依華語慣例推定）。
export function keyName(key) {
  return (key.endsWith('b') ? '降' : '') + key[0] + '大調';
}
export function token(midi, q, key) {
  const dotted = [3, 6].includes(q),
    base = dotted ? q / 1.5 : q;
  if (midi === null) return {1: ';', 2: 'p', 3: 'po', 4: '`', 6: '`.', 8: '``', 12: '```', 16: '````'}[q];
  let rel = midi - 60 - KEYS[key],
    oct = Math.floor(rel / 12),
    pc = ((rel % 12) + 12) % 12,
    degree = scale.indexOf(pc),
    acc = '';
  if (degree < 0) {
    const next = scale.find(v => v > pc) ?? 12;
    degree = scale.indexOf(next);
    if (next === 12) {
      degree = 0;
      oct++;
    }
    acc = ':';
  }
  if (oct < -1 || oct > 1) throw Error('Word 字型版暫限中音及高低各一個八度；請先移調或校正音高。');
  let ch = base >= 4 ? String(degree + 1) : (base === 2 ? 'qwertyu' : 'asdfghj')[degree];
  if (oct > 0) ch = base >= 4 ? '!@#$%^&'[degree] : ch.toUpperCase();
  return (
    acc +
    ch +
    (oct < 0 ? (base >= 4 ? '8' : base === 2 ? 'i' : 'k') : '') +
    (dotted ? (base === 2 ? 'o' : '.') : '') +
    (base >= 4 ? '/'.repeat(Math.floor(base / 4) - 1) : '')
  );
}
export function parseVerses(text) {
  if (!text?.trim()) return [];
  const lines = text.replace(/\r/g, '').split('\n');
  const verses = [];
  let current = [];
  const flush = () => {
    if (current.length) {
      verses.push(current);
      current = [];
    }
  };
  for (const line of lines) {
    const s = line.trim();
    if (!s) {
      flush();
      continue;
    }
    if (/^([一二三四五六七八九十\d]+[、.．]|[\u2460-\u2473\u3251-\u325f\u32b1-\u32bf])$/.test(s)) {
      flush();
      continue;
    }
    current.push(s.replace(/^([一二三四五六七八九十\d]+[、.．]\s*|[\u2460-\u2473\u3251-\u325f\u32b1-\u32bf]\s*)/, ''));
  }
  flush();
  return verses.map(lines => {
    const syllables = [];
    let prefix = '';
    for (const line of lines) {
      for (const c of line) {
        if (/\p{Script=Han}|[a-zA-Z0-9]/u.test(c)) {
          syllables.push(prefix + c);
          prefix = '';
        } else if (!syllables.length || '「『“'.includes(c)) {
          prefix += c;
        } else syllables[syllables.length - 1] += c;
      }
    }
    if (prefix && syllables.length) syllables[syllables.length - 1] += prefix;
    return syllables;
  });
}
