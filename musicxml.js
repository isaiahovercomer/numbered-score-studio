// MusicXML 4.0（score-partwise，單一旋律聲部）匯出。純函式、零依賴、輸出具決定性。
// 只讀取樂譜，不就地修改；不套用官方用字替換（維持使用者原文）。
import {KEYS, validateScore} from './music.js';
import {parseVerses} from './word-export.js';

export const MUSICXML_MIME = 'application/vnd.recordare.musicxml+xml';
const DIVISIONS = 4; // 每四分音符 4 個單位，即十六分音符格線
const FIFTHS = {C: 0, Db: -5, D: 2, Eb: -3, E: 4, F: -1, Gb: -6, G: 1, Ab: -4, A: 3, Bb: -2, B: 5};
// 各大調 1~7 級的拼法（含 Gb 大調的 Cb、B 大調的 A#）。
const SCALE = {
  C: 'C D E F G A B', Db: 'Db Eb F Gb Ab Bb C', D: 'D E F# G A B C#', Eb: 'Eb F G Ab Bb C D',
  E: 'E F# G# A B C# D#', F: 'F G A Bb C D E', Gb: 'Gb Ab Bb Cb Db Eb F', G: 'G A B C D E F#',
  Ab: 'Ab Bb C Db Eb F G', A: 'A B C# D E F# G#', Bb: 'Bb C D Eb F G A', B: 'B C# D# E F# G# A#',
};
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const SHARP_NAMES = 'C C# D D# E F F# G G# A A# B'.split(' ');
const FLAT_NAMES = 'C Db D Eb E F Gb G Ab A Bb B'.split(' ');
// 可直接表示的時值（單位：division）→ [type, 是否附點]
const TYPES = {16: ['whole', 0], 12: ['half', 1], 8: ['half', 0], 6: ['quarter', 1], 4: ['quarter', 0], 3: ['eighth', 1], 2: ['eighth', 0], 1: ['16th', 0]};
const SPLIT_ORDER = [16, 12, 8, 6, 4, 3, 2, 1];
const KINDS = {'': ['major', ''], m: ['minor', 'm'], 7: ['dominant', '7'], m7: ['minor-seventh', 'm7'], maj7: ['major-seventh', 'maj7'], dim: ['diminished', 'dim'], sus4: ['suspended-fourth', 'sus4'], sus2: ['suspended-second', 'sus2'], aug: ['augmented', 'aug']};
const CHORD_RE = /^([A-G])([b#]?)(maj7|m7|m|7|dim|sus4|sus2|aug)?(?:\/([A-G])([b#]?))?$/;
// XML 1.0 不合法字元（含孤立代理字元）一律移除，避免從 PDF／網頁貼上的控制字元造成壞檔。
const ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function xmlText(value) {
  return String(value ?? '').replace(ILLEGAL, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 極簡元素樹：[tag, attrs, ...children]；字串子節點為文字，null／false 略過。
const el = (tag, attrs, ...children) => [tag, attrs || {}, ...children.filter(c => c !== null && c !== undefined && c !== false && c !== '')];
function render(node, depth = 0) {
  const [tag, attrs, ...kids] = node, pad = '  '.repeat(depth);
  const open = tag + Object.entries(attrs).map(([k, v]) => ` ${k}="${xmlText(v)}"`).join('');
  if (!kids.length) return `${pad}<${open}/>`;
  if (kids.every(k => typeof k === 'string' || typeof k === 'number')) return `${pad}<${open}>${kids.map(k => typeof k === 'number' ? k : xmlText(k)).join('')}</${tag}>`;
  return [`${pad}<${open}>`, ...kids.map(k => render(k, depth + 1)), `${pad}</${tag}>`].join('\n');
}

function spell(midi, key) {
  const rel = (((midi - KEYS[key]) % 12) + 12) % 12, degree = MAJOR_STEPS.indexOf(rel);
  const name = degree >= 0 ? SCALE[key].split(' ')[degree] : (FIFTHS[key] >= 0 ? SHARP_NAMES : FLAT_NAMES)[midi % 12];
  const alter = name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0;
  return {step: name[0], alter, octave: Math.floor((midi - alter) / 12) - 1};
}
const alterOf = c => c === '#' ? 1 : c === 'b' ? -1 : 0;

function harmony(symbol, offset) {
  const m = String(symbol).match(CHORD_RE);
  if (!m) throw Error(`不支援和絃「${symbol}」。可用 F、Bb、Dm、G7、Gm7、C/E 等。`);
  const [kind, text] = KINDS[m[3] || ''];
  return el('harmony', null,
    el('root', null, el('root-step', null, m[1]), m[2] && el('root-alter', null, String(alterOf(m[2])))),
    el('kind', text ? {text} : null, kind),
    m[4] && el('bass', null, el('bass-step', null, m[4]), m[5] && el('bass-alter', null, String(alterOf(m[5])))),
    offset ? el('offset', null, String(offset)) : null);
}

function splitDuration(units) {
  const pieces = [];
  for (let left = units; left > 0;) { const v = SPLIT_ORDER.find(x => x <= left); pieces.push(v); left -= v; }
  return pieces;
}

export function musicXml(score, opts = {}) {
  validateScore(score);
  const bars = Object.values(score.sections).flat();
  // 線性音符序列：延音（tieFrom）可跨小節，語意與 Word 匯出的 writtenEvents 相同。
  const flat = [];
  bars.forEach((bar, bi) => {
    let at = 0;
    bar.notes.forEach(([midi, beats], i) => {
      const units = Math.round(beats * DIVISIONS);
      if (Math.abs(beats * DIVISIONS - units) > 1e-7) throw Error('MusicXML 暫支援十六分音符格線，請修正非整格拍數。');
      const tieIn = Boolean(bar.tieFrom?.includes(i)) && midi !== null;
      if (tieIn) { const prev = flat.at(-1); if (!prev || prev.midi !== midi) throw Error('連結延音與前音不符，請重新校對。'); }
      flat.push({bi, i, midi, units, start: at, tieIn, tieOut: false});
      at += units;
    });
  });
  flat.forEach((n, k) => { n.tieOut = Boolean(flat[k + 1]?.tieIn); });

  const attackCount = flat.filter(n => n.midi !== null && !n.tieIn).length;
  const verses = opts.lyrics === false ? [] : parseVerses(score.lyrics);
  if (verses.some(v => v.length !== attackCount)) throw Error(`歌詞需逐字對位：本譜有 ${attackCount} 個起音，目前各節為 ${verses.map(v => v.length).join('、')} 字。請以空行分節，或先清空歌詞匯出純譜。`);

  const fullUnits = score.meter[0] * DIVISIONS * 4 / score.meter[1];
  const firstUnits = flat.filter(n => n.bi === 0).reduce((a, n) => a + n.units, 0);
  const pickup = firstUnits < fullUnits - 1e-7;
  let attack = 0, cursor = 0;
  const measures = bars.map((bar, bi) => {
    const own = [];
    while (flat[cursor]?.bi === bi) own.push(flat[cursor++]);
    const length = own.reduce((a, n) => a + n.units, 0);
    const changes = (bar.chordChanges?.length ? bar.chordChanges : (bar.chord ? [{beat: 0, text: bar.chord}] : []))
      .map(c => ({q: Math.round(c.beat * DIVISIONS), text: c.text}));
    for (const c of changes) harmony(c.text, 0); // 先驗證和弦符號
    if (changes.some(c => !Number.isFinite(c.q) || c.q < 0 || c.q >= length)) throw Error('和弦拍點超出小節。');
    const used = new Set(), content = [];
    if (bi === 0) {
      content.push(el('attributes', null,
        el('divisions', null, String(DIVISIONS)),
        el('key', null, el('fifths', null, String(FIFTHS[score.key])), el('mode', null, 'major')),
        el('time', null, el('beats', null, String(score.meter[0])), el('beat-type', null, String(score.meter[1]))),
        el('clef', null, el('sign', null, 'G'), el('line', null, '2'))));
      content.push(el('direction', {placement: 'above'},
        el('direction-type', null, el('metronome', null, el('beat-unit', null, 'quarter'), el('per-minute', null, String(score.bpm)))),
        el('sound', {tempo: score.bpm})));
    }
    for (const n of own) {
      changes.forEach((c, ci) => {
        if (!used.has(ci) && c.q >= n.start && c.q < n.start + n.units) { used.add(ci); content.push(harmony(c.text, c.q - n.start)); }
      });
      const index = n.midi !== null && !n.tieIn ? attack++ : -1, pieces = splitDuration(n.units);
      pieces.forEach((units, k) => {
        const [type, dot] = TYPES[units], sounding = n.midi !== null;
        const stop = sounding && (k > 0 || n.tieIn), start = sounding && (k < pieces.length - 1 || n.tieOut);
        let pitch = el('rest', null);
        if (sounding) { const p = spell(n.midi, score.key); pitch = el('pitch', null, el('step', null, p.step), p.alter ? el('alter', null, String(p.alter)) : null, el('octave', null, String(p.octave))); }
        content.push(el('note', null, pitch, el('duration', null, String(units)),
          stop && el('tie', {type: 'stop'}), start && el('tie', {type: 'start'}),
          el('voice', null, '1'), el('type', null, type), dot ? el('dot', null) : null,
          (stop || start) && el('notations', null, stop && el('tied', {type: 'stop'}), start && el('tied', {type: 'start'})),
          ...(index >= 0 && k === 0 ? verses.map((v, vi) => el('lyric', {number: vi + 1}, el('syllabic', null, 'single'), el('text', null, v[index]))) : [])));
      });
    }
    const attrs = pickup && bi === 0 ? {number: 0, implicit: 'yes'} : {number: pickup ? bi : bi + 1};
    return el('measure', attrs, ...content);
  });

  const title = String(score.title ?? '').trim() || '簡譜';
  const root = el('score-partwise', {version: '4.0'},
    el('work', null, el('work-title', null, title)),
    el('identification', null, el('encoding', null, el('software', null, 'numbered-score-studio'))),
    el('part-list', null, el('score-part', {id: 'P1'}, el('part-name', null, '旋律'))),
    el('part', {id: 'P1'}, ...measures));
  return '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n' + render(root) + '\n';
}

export function musicXmlBlob(score, opts) {
  return new Blob([musicXml(score, opts)], {type: MUSICXML_MIME});
}
