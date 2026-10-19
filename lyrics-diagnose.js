import {validateScore} from './music.js';
import {parseVerses} from './word-export.js';

const LABEL = {verse: '主歌', chorus: '副歌'};
const label = n => LABEL[n] || n;
const MARK = /^([一二三四五六七八九十\d]+[、.．]|[\u2460-\u2473\u3251-\u325f\u32b1-\u32bf])$/;

export function listAttacks(score) {
  const attacks = [];
  let bar = 0,
    tieContinuations = 0,
    rests = 0;
  for (const [section, bars] of Object.entries(score.sections))
    bars.forEach((b, bi) => {
      bar++;
      let pos = 0;
      b.notes.forEach(([midi, beats], i) => {
        if (midi === null) rests++;
        else if (b.tieFrom?.includes(i)) tieContinuations++;
        else attacks.push({index: attacks.length, section, sectionBar: bi + 1, bar, beat: pos, midi});
        pos += beats;
      });
    });
  return {attacks, tieContinuations, rests};
}

const beatText = b => `第 ${Number((b + 1).toFixed(2))} 拍`;
const where = (a, global) =>
  `${label(a.section)}第 ${a.sectionBar} 小節${beatText(a.beat)}${global ? `（全曲第 ${a.bar} 小節）` : ''}`;

function verseLines(text, parse) {
  const blocks = [];
  let cur = [];
  for (const raw of String(text || '')
    .replace(/\r/g, '')
    .split('\n')) {
    const s = raw.trim();
    if (!s || MARK.test(s)) {
      if (cur.length) blocks.push(cur);
      cur = [];
      continue;
    }
    cur.push(s);
  }
  if (cur.length) blocks.push(cur);
  return blocks.map(lines => lines.map(l => parse(l)[0]?.length ?? 0));
}

export function diagnoseLyrics(score, {parse = parseVerses} = {}) {
  validateScore(score);
  const {attacks, tieContinuations, rests} = listAttacks(score);
  const N = attacks.length,
    multi = Object.keys(score.sections).length > 1;
  const verses = parse(score.lyrics),
    lines = verseLines(score.lyrics, parse);
  const linesOk =
    lines.length === verses.length && lines.every((l, i) => l.reduce((a, b) => a + b, 0) === verses[i].length);
  const res = {
    ok: true,
    hasLyrics: verses.length > 0,
    attacks: N,
    tieContinuations,
    rests,
    verses: [],
    problems: [],
    hints: []
  };
  const per = [];
  verses.forEach((v, i) => {
    const k = i + 1,
      diff = v.length - N;
    res.verses.push({index: k, count: v.length, diff, status: diff === 0 ? 'ok' : diff < 0 ? 'short' : 'long'});
    per[i] = [];
    if (diff === 0) return;
    res.ok = false;
    if (diff < 0) {
      const d = -diff;
      if (v.length === 0)
        per[i].push({verse: k, kind: 'short', diff, message: `第 ${k} 節沒有可對位的字（只有標點或節標）。`});
      else
        per[i].push({
          verse: k,
          kind: 'short',
          diff,
          firstMissing: attacks[v.length].index,
          message: `第 ${k} 節少 ${d} 字：歌詞到第 ${v.length} 個起音就用完了，從${where(attacks[v.length], multi)}起的 ${d} 個起音沒有字。`
        });
    } else if (N === 0)
      per[i].push({verse: k, kind: 'long', diff, message: `全曲沒有起音（只有休止），但第 ${k} 節有 ${v.length} 字。`});
    else
      per[i].push({
        verse: k,
        kind: 'long',
        diff,
        extraFrom: N,
        message:
          `第 ${k} 節多 ${diff} 字：全曲只有 ${N} 個起音，` +
          `從第 ${N + 1} 個字「${v[N]}」起的 ${diff} 個字沒有音可放（最後一個起音在${where(attacks[N - 1], false)}）。`
      });
  });
  if (linesOk && verses.length > 1) {
    const ref = res.verses.find(x => x.diff === 0) || res.verses[0];
    for (const x of res.verses) {
      if (x.diff === 0 || x.index === ref.index) continue;
      const a = lines[x.index - 1],
        b = lines[ref.index - 1];
      if (a.length === b.length) {
        const j = a.findIndex((n, q) => n !== b[q]);
        if (j >= 0)
          per[x.index - 1].push({
            verse: x.index,
            kind: 'line',
            line: j + 1,
            message: `第 ${x.index} 節第 ${j + 1} 行 ${a[j]} 字，第 ${ref.index} 節同一行 ${b[j]} 字（差 ${a[j] - b[j]} 字）。`
          });
      } else
        per[x.index - 1].push({
          verse: x.index,
          kind: 'lines',
          message: `第 ${x.index} 節有 ${a.length} 行，第 ${ref.index} 節有 ${b.length} 行，行數不同，請先對齊分行。`
        });
    }
  }
  res.problems = per.flat();
  if (!res.ok) {
    const bad = res.verses.filter(x => x.diff !== 0);
    if (tieContinuations && bad.every(x => x.count === N + tieContinuations))
      res.hints.push(
        `字數等於「起音 ${N}＋延音連結 ${tieContinuations}」：延音連結後的音不另配字，是否把延音也配了字？`
      );
    if (bad.length === res.verses.length && bad.length > 1 && new Set(bad.map(x => x.diff)).size === 1)
      res.hints.push(
        `每一節都${bad[0].diff < 0 ? '少' : '多'} ${Math.abs(bad[0].diff)} 字：較可能是樂譜起音數有誤（例如漏標延音連結、多切了音），而不是歌詞打錯。`
      );
  }
  return res;
}

export function formatDiagnosis(r, {max = 5} = {}) {
  if (r.ok) return '';
  const out = r.problems.slice(0, max).map(p => p.message);
  if (r.problems.length > max) out.push(`…另有 ${r.problems.length - max} 則`);
  return [...out, ...r.hints].join('\n');
}

export function explainLyricError(error, score) {
  const msg = String(error?.message ?? error);
  if (!msg.startsWith('歌詞需逐字對位')) return msg;
  try {
    const p = diagnoseLyrics(score).problems[0];
    return p ? `${msg} ${p.message}` : msg;
  } catch {
    return msg;
  }
}
