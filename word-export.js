import {validateScore} from './music.js';
import {writtenEvents} from './score-bridge.js';
import {widths} from './font-metrics.js';
import {applyWordingToScore, wordingHints} from './wording.js';
import {PAPERS, resolveOptions} from './word-options.js';
import {verseMark, keyName, token, parseVerses, chordLabel} from './word-notation.js';
import {chordTextWidth, staggerChords} from './word-chords.js';
import {run, box, tie, zipStore, copyrightAnchor, resetShapeIds, lyricParagraph} from './word-docx.js';
// 公開 API 維持不變：其他檔案仍從 word-export.js 匯入這些名稱。
export {PAPERS, PRESETS, DEFAULT_PRESET, resolveOptions} from './word-options.js';
export {verseMark, keyName, token, parseVerses, chordLabel} from './word-notation.js';
export {wordingHints, applyWording, applyWordingToScore, describeChanges} from './wording.js';
const advance = raw => [...raw].reduce((n, c) => n + (widths[c] ?? 1), 0) * 14;
export function layout(s, options) {
  const o = resolveOptions(options);
  validateScore(s);
  const {events, changes} = writtenEvents(s),
    verses = parseVerses(s.lyrics);
  const count = events.filter(e => e.midi !== null).length;
  if (verses.some(v => v.length !== count))
    throw Error(
      `歌詞需逐字對位：本譜有 ${count} 個起音，目前各節為 ${verses.map(v => v.length).join('、')} 字。請以空行分節，或先清空歌詞匯出純譜。英語及一字多音請匯入已對位的技能 JSON。`
    );
  const pieces = [];
  let attack = 0;
  const beats = (s.meter[0] * 4) / s.meter[1];
  let barEnd = (Object.values(s.sections)[0][0].beats ?? beats) * 4;
  const barEnds = [];
  let bq = 0;
  for (const bs of Object.values(s.sections))
    for (const b of bs) {
      bq += b.notes.reduce((n, x) => n + x[1] * 4, 0);
      barEnds.push(bq);
    }
  for (const e of events) {
    let at = e.q,
      left = e.duration,
      part = 0;
    while (left) {
      barEnd = barEnds.find(v => v > at) ?? at + left;
      const cap = Math.min(left, barEnd - at);
      const duration = [16, 12, 8, 6, 4, 3, 2, 1].find(v => v <= cap);
      const text = token(e.midi, duration, s.key);
      const lyrics = e.midi !== null && part === 0 ? verses.map(v => v[attack]) : [];
      const inside = changes.filter(c => c.q >= at && c.q < at + duration);
      let width = Math.max(advance(text), ...lyrics.map(t => [...t].length * o.lyricPt + 2), 16);
      if (inside.length) width = Math.max(width, ...inside.map(c => c.text.length * 6 + 10), inside.length * 34);
      pieces.push({
        text,
        q: at,
        duration,
        midi: e.midi,
        lyrics,
        tied: e.midi !== null && part > 0,
        tieNext: e.midi !== null && left > duration,
        endBar: at + duration === barEnd,
        width,
        chords: inside
      });
      left -= duration;
      at += duration;
      part++;
    }
    if (e.midi !== null) attack++;
  }
  const systems = [];
  let row = [],
    x = 0;
  for (const p of pieces) {
    const w = p.width + (p.endBar ? 14 : 3);
    if (x + w > o.wrapMax && row.length) {
      systems.push(row);
      row = [];
      x = 0;
    }
    p.x = x;
    row.push(p);
    x += w;
  }
  if (row.length) systems.push(row);
  const maxWidth = Math.max(...systems.map(r => r.at(-1).x + r.at(-1).width + 14)),
    offset = (o.usable - maxWidth - 32) / 2 + 32;
  const reference = referenceRows(s, o);
  const chordRows = reference
    ? reference.systems.map(r => r.chordItems)
    : systems.map(r => rowChords(r, offset, o));
  const warnings = chordRows.flatMap((items, i) => {
    const total = items.reduce((n, c) => n + chordTextWidth(c.label), 0) + Math.max(0, items.length - 1) * 2;
    return total > o.usable ? [`和弦過密：第 ${i + 1} 行`] : [];
  });
  return {systems, verses, offset, count, options: o, warnings};
}
// 預先掃描整行，但繪製時維持原來的方塊輸出順序與寬度。
function rowChords(row, offset, o) {
  return row.flatMap(p => p.chords.map(c => ({
    cx: offset + p.x + 7 + ((c.q - p.q) / p.duration) * p.width,
    label: chordLabel(c.text, o.chordAccidentals)
  })));
}
// 標題區：classic 為原版（標題置中、「1=C　4/4　♩ = 88」靠右）；lsm 為官方（標題置中；左「D大調」、右「4/4」）。
function headerXml(s, o, ref) {
  const title = s.title || '簡譜';
  if (o.classic) {
    const para = (text, size, align) =>
        `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="0" w:after="80"/></w:pPr>${run(text, '標楷體', size)}</w:p>`,
      meta = `1=${s.key}　${s.meter.join('/')}　♩ = ${s.bpm}`;
    return ref
      ? `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="80"/></w:pPr>${run(s.title, '標楷體', 22)}</w:p><w:p><w:pPr><w:jc w:val="right"/></w:pPr>${run(meta, '標楷體', 11)}</w:p>`
      : para(title, 22, 'center') + para(meta, 11, 'right');
  }
  const f = o.textFont,
    a = o.textAscii,
    right = `${s.meter.join('/')}${o.tempo ? `　♩ = ${s.bpm}` : ''}`;
  return (
    `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="100" w:line="340" w:lineRule="exact"/></w:pPr>${run(title, o.titleFont, o.titlePt, '000000', false, a)}</w:p>` +
    `<w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="${Math.round((o.usable - 14) * 20)}"/></w:tabs><w:spacing w:before="0" w:after="100" w:line="280" w:lineRule="exact"/><w:ind w:left="500"/></w:pPr>${run(keyName(s.key), f, o.metaPt, '000000', false, a)}<w:r><w:tab/></w:r>${run(right, f, o.metaPt, '000000', false, a)}</w:p>`
  );
}
// 節次標記方塊：圈圈數字緊貼第一字左側；中文數字沿用原位置（左移 32 pt、寬 30 pt）。
function markBox(vi, x, y, o) {
  return o.verseMarks === 'circled'
    ? box(verseMark(vi, 'circled'), x - 16, y, 16, 19, o.textFont, o.lyricPt, '000000', false, o.textAscii)
    : box(verseMark(vi, 'chinese'), x - 32, y, 30, 19, o.textFont, o.lyricPt, '000000', false, o.textAscii);
}
// 譜行方塊：音符、小節線、和弦、連結線（boxes 與 inline 共用）。extra(p, i, x) 讓 boxes 在音符與和弦之間插入歌詞方塊，維持原輸出順序。
function rowShapes(row, offset, o, extra = () => '') {
  let shapes = '',
    tieStart = null,
    chordIndex = 0;
  const placed = staggerChords(rowChords(row, offset, o), {right: o.usable});
  for (const [i, p] of row.entries()) {
    const x = offset + p.x;
    shapes += box(p.text, x, 12, Math.max(p.width, advance(p.text)) + 2, 25, '01SMN', 14);
    if (p.endBar) shapes += box('\\', x + p.width, 12, 14, 25, '01SMN', 14);
    shapes += extra(p, i, x);
    for (const c of p.chords) {
      const cx = placed[chordIndex++],
        w = Math.max(20, c.text.length * 6 + 4);
      const label = chordLabel(c.text, o.chordAccidentals);
      shapes += box(label, cx - w / 2, 0, w, 13, 'Times New Roman', 10, '9C2323', true);
    }
    if (p.tied && tieStart === null) tieStart = offset;
    if (p.tied && !p.tieNext && tieStart !== null) {
      shapes += tie(tieStart, 9, x + 7 - tieStart);
      tieStart = null;
    }
    if (p.tieNext && !p.tied) tieStart = x + 7;
    if (i === row.length - 1 && tieStart !== null) {
      shapes += tie(tieStart, 9, x + p.width + 7 - tieStart);
      tieStart = null;
    }
  }
  return shapes;
}
// 內文整句：譜行段落（只放浮動方塊，固定行高）＋每節一個歌詞內文段落（標楷體、定位點對準音符），以 keepNext 串成一組。
// items = [{pos, texts:[各節音節]}]；mark(vi) 為真的節在第一個有字的音左側放節次標記 16（①）或 32 pt（一、）。
function inlineRow(shapes, items, nVerses, mark, scorePt, o) {
  const sp = `<w:spacing w:before="0" w:after="0" w:line="${scorePt * 20}" w:lineRule="exact"/>`;
  let xml = `<w:p><w:pPr><w:keepNext/>${sp}</w:pPr>${shapes}</w:p>`;
  for (let vi = 0; vi < nVerses; vi++) {
    const line = items.map(it => ({pos: it.pos, text: it.texts[vi]}));
    if (mark(vi) && line.length)
      line.unshift({pos: line[0].pos - (o.verseMarks === 'circled' ? 16 : 32), text: verseMark(vi, o.verseMarks)});
    xml += lyricParagraph(line, {
      last: vi === nVerses - 1,
      after: (o.rowBase - 29) * 20,
      font: o.lyricFont,
      size: o.lyricPt,
      ascii: o.lyricAscii,
      line: o.lyricLine
    });
  }
  return xml;
}
// 官方用字：只影響輸出（標題、歌詞、技能參考資料音節），呼叫端的原稿 score 不會被修改；前後等長，逐字對位不變。
export function wordingChanges(s, options) {
  return resolveOptions(options).wording ? applyWordingToScore(s).changes : [];
}
export function wordBlob(s0, options) {
  resetShapeIds();
  const s = resolveOptions(options).wording ? applyWordingToScore(s0).score : s0;
  const {systems, verses, offset, options: o} = layout(s, options);
  let body = headerXml(s, o, false);
  const reference = referenceBody(s, o);
  // 節次標記放在全曲第一個有字的列（通常是第一列；前奏整列休止時往後移），永遠不會消失。
  const markRow = systems.findIndex(row => row.some(p => p.lyrics.length));
  if (reference) body = reference;
  else
    for (const [ri, row] of systems.entries()) {
      if (o.lyricLayout === 'inline' && verses.length) {
        const items = row.filter(p => p.lyrics.length).map(p => ({pos: offset + p.x, texts: p.lyrics}));
        body += inlineRow(rowShapes(row, offset, o), items, verses.length, () => ri === markRow, 38, o);
        continue;
      }
      const height = o.rowBase + verses.length * 19;
      // 節次標記放在第一個有字的音旁邊（曲子以休止符開頭時不會消失；與內文整句一致）。
      const markAt = ri === markRow ? row.findIndex(p => p.lyrics.length) : -1;
      const lyricShapes = (p, i, x) => {
        let out = '';
        for (const [vi, t] of p.lyrics.entries()) {
          out += box(
            t,
            x,
            38 + vi * 19,
            Math.max(p.width, [...t].length * o.lyricPt + 2),
            19,
            o.textFont,
            o.lyricPt,
            '000000',
            false,
            o.lyricAscii
          );
          if (i === markAt) out += markBox(vi, x, 38 + vi * 19, o);
        }
        return out;
      };
      const shapes = rowShapes(row, offset, o, lyricShapes);
      body += `<w:p><w:pPr><w:spacing w:line="${height * 20}" w:lineRule="exact" w:after="100"/><w:keepLines/></w:pPr>${shapes}</w:p>`;
    }
  // Review status is shown in the site; avoid a trailing paragraph forcing a blank second page.
  if (o.copyright) body = body.replace(/<\/w:p>$/, () => copyrightAnchor(o.copyright, o) + '</w:p>');

  const xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">` +
    `<w:body>${body}<w:sectPr><w:pgSz w:w="${PAPERS[o.paper].w}" w:h="${PAPERS[o.paper].h}"/>` +
    `<w:pgMar w:top="${o.marginTop}" w:right="${o.marginLR}" w:bottom="${o.marginBottom}" w:left="${o.marginLR}" w:header="0" w:footer="0"/>` +
    `</w:sectPr></w:body></w:document>`;
  return zipStore({
    '[Content_Types].xml':
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': xml
  });
}
function referenceRows(s, o) {
  const ref = s.notationLayout;
  if (!ref || ref.fingerprint !== JSON.stringify([s.sections, s.key, s.lyrics])) return null;
  const metrics = raw => {
    let x = 0,
      tied = false;
    const p = [];
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (c === '0') tied = true;
      if ('1234567qwertyuasdfghjQWERTYUASDFGHJ!@#$%^&`p;'.includes(c)) {
        p.push({x, attack: !tied && !'`p;'.includes(c), index: i});
        tied = false;
      }
      x += (widths[c] ?? 0) * 14;
    }
    return p;
  };
  const systems = ref.systems.map(r => ({
    ...r,
    raw: r.raw
      .replace(/9=0/g, '90')
      .replace(/([1-7])([/]+)9=\\0/g, (_, n, d) => n + '9' + [...d].map(() => '=/').join('') + '=\\0')
  }));
  const maxWidth = Math.max(...systems.map(r => advance(r.raw))),
    off = (o.usable - maxWidth - 32) / 2 + 32;
  const {changes} = writtenEvents(s);
  for (const [ri, r] of systems.entries()) {
    const positions = metrics(r.raw);
    r.positions = positions;
    const end = systems[ri + 1]?.note_q[0] ?? Infinity;
    r.chordItems = changes.filter(c => c.q >= r.note_q[0] && c.q < end).map(c => {
      let i = r.note_q.findIndex(q => q === c.q),
        x;
      if (i >= 0) x = positions[i].x;
      else {
        i = r.note_q.findLastIndex(q => q < c.q);
        if (i < 0) throw Error('和弦位置無效。');
        const next = r.note_q[i + 1] ?? c.q + 1;
        x =
          positions[i].x +
          ((c.q - r.note_q[i]) / (next - r.note_q[i])) *
            ((positions[i + 1]?.x ?? positions[i].x + 14) - positions[i].x);
      }
      return {cx: off + x + 7, label: chordLabel(c.text, o.chordAccidentals), text: c.text};
    });
  }
  return {systems, off};
}
function referenceBody(s, o) {
  const ref = referenceRows(s, o);
  if (!ref) return null;
  const {systems, off} = ref;
  // 每節的節次標記放在該節第一個有字的列；該節完全沒有歌詞才省略。
  const markRow = vi => systems.findIndex(r => r.lyrics[vi]?.syllables.length);
  let body = headerXml(s, o, true);
  for (const [ri, r] of systems.entries()) {
    const positions = r.positions,
      attacks = positions.filter(p => p.attack);
    let shapes = box(r.raw, off, 12, advance(r.raw) + 3, 28, '01SMN', 14);
    const inline = o.lyricLayout === 'inline' && r.lyrics.length;
    for (const [vi, v] of r.lyrics.entries()) {
      if (inline) {
        if (v.syllables.some((_, i) => !attacks[i])) throw Error('原稿詞音位置不完整，請重新校對。');
        continue;
      }
      for (const [i, t] of v.syllables.entries()) {
        if (!attacks[i]) throw Error('原稿詞音位置不完整，請重新校對。');
        shapes += box(
          t,
          off + attacks[i].x,
          40 + vi * 19,
          Math.max(16, [...t].length * o.lyricPt + 2),
          19,
          o.textFont,
          o.lyricPt,
          '000000',
          false,
          o.lyricAscii
        );
      }
      if (ri === markRow(vi)) shapes += markBox(vi, off, 40 + vi * 19, o);
    }
    const placed = staggerChords(r.chordItems, {right: o.usable});
    for (const [i, c] of r.chordItems.entries()) {
      const w = Math.max(20, c.text.length * 6 + 4);
      shapes += box(c.label, placed[i] - w / 2, 0, w, 13, 'Times New Roman', 10, '9C2323', true);
    }
    if (inline) {
      const n = Math.max(...r.lyrics.map(v => v.syllables.length)),
        items = Array.from({length: n}, (_, i) => ({
          pos: off + attacks[i].x,
          texts: r.lyrics.map(v => v.syllables[i] ?? '')
        }));
      body += inlineRow(shapes, items, r.lyrics.length, vi => ri === markRow(vi), 40, o);
      continue;
    }
    body += `<w:p><w:pPr><w:spacing w:line="${(o.rowBase + 2 + r.lyrics.length * 19) * 20}" w:lineRule="exact" w:after="100"/><w:keepLines/></w:pPr>${shapes}</w:p>`;
  }
  return body;
}
