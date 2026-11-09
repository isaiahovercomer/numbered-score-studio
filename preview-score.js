// 座標單位為 pt；讀取匯出器實際產生的 Word 段落、定位點和浮動方塊。
import {resolveOptions, wordDocumentXml} from './word-export.js';
const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const children = (el, name) => [...el.children].filter(n => n.localName === name);
const descendants = (el, name) => [...el.getElementsByTagNameNS('*', name)];
const first = (el, name) => descendants(el, name)[0];
const attr = (el, name) => el?.getAttributeNS(word, name);
const twip = (el, name) => Number(attr(el, name)) / 20;
const runs = el => children(el, 'r').filter(r => children(r, 't').length).map(r => ({
  text: children(r, 't')[0].textContent, size: Number(attr(first(r, 'sz'), 'val')) / 2 || 12,
  color: '#' + (attr(first(r, 'color'), 'val') || '000000'), font: attr(first(r, 'rFonts'), 'eastAsia'),
  shift: attr(first(r, 'vertAlign'), 'val')
}));
function readShape(anchor) {
  const offset = name => Number(first(first(anchor, name), 'posOffset').textContent) / 12700;
  const x = offset('positionH'), y = offset('positionV'), extent = first(anchor, 'extent');
  const w = Number(extent.getAttribute('cx')) / 12700, h = Number(extent.getAttribute('cy')) / 12700;
  const p = first(anchor, 'p');
  return {x, y, w, h, runs: p ? runs(p) : [], tie: !p, center: p && attr(first(p, 'jc'), 'val') === 'center'};
}
function paragraph(p, o) {
  const pr = children(p, 'pPr')[0], sp = first(pr, 'spacing'), tabs = descendants(pr, 'tab');
  const shapes = descendants(p, 'anchor').map(readShape), texts = runs(p);
  const line = twip(sp, 'line') || (texts[0]?.size || 12) * 1.25;
  const align = attr(first(pr, 'jc'), 'val');
  const chunks = texts.map((run, i) => {
    const tab = tabs[i], rightTab = attr(tabs[0], 'val') === 'right';
    let x = twip(first(pr, 'ind'), 'left'), anchor = 'start';
    if (rightTab && i > 0) { x = twip(tabs[0], 'pos'); anchor = 'end'; }
    else if (tab && !rightTab) x = twip(tab, 'pos');
    else if (align === 'center') { x = o.usable / 2; anchor = 'middle'; }
    else if (align === 'right') { x = o.usable; anchor = 'end'; }
    return {x, anchor, run};
  });
  return {shapes, chunks, line, after: twip(sp, 'after'), keep: !!first(pr, 'keepNext')};
}
function wrapTitle(p, width) {
  const c = p.chunks[0];
  if (p.chunks.length !== 1 || c.anchor !== 'middle' || p.shapes.length) return [p];
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = c.run.size + 'px "' + c.run.font + '", serif';
  const lines = [];
  let line = '';
  for (const char of c.run.text) {
    if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = ''; }
    line += char;
  }
  lines.push(line);
  return lines.map((text, i) => ({...p, after: i === lines.length - 1 ? p.after : 0,
    chunks: [{...c, run: {...c.run, text}}]}));
}
export function previewPages(score, options) {
  const o = resolveOptions(options);
  let warnings = [];
  const source = wordDocumentXml(score, options, info => { warnings = info.warnings; });
  const xml = new DOMParser().parseFromString(source, 'text/xml');
  if (first(xml, 'parsererror')) throw Error('無法讀取詞譜排版資料。');
  const rows = [];
  let group = [];
  for (const p of children(first(xml, 'body'), 'p')) {
    const part = paragraph(p, o);
    group.push(...wrapTitle(part, o.usable));
    if (!part.keep) { rows.push(group); group = []; }
  }
  if (group.length) rows.push(group);
  const top = o.marginTop / 20, bottom = o.pageH - o.marginBottom / 20;
  const pages = [[]];
  let y = top;
  for (const row of rows) {
    let height = 0, ink = 0;
    for (const p of row) {
      ink = Math.max(ink, height + Math.max(p.line, ...p.shapes.map(s => s.y + s.h)));
      height += p.line + p.after;
    }
    if (y > top && y + Math.max(height, ink) > bottom) { pages.push([]); y = top; }
    // 超過整頁的單行歌詞仍逐頁切片顯示，保留全部內容。
    const size = Math.max(height, ink);
    let consumed = 0;
    while (true) {
      pages.at(-1).push({row, y: y - consumed});
      const available = bottom - y;
      if (size - consumed <= available) { y += Math.max(0, Math.min(available, height - consumed)); break; }
      consumed += available;
      pages.push([]); y = top;
    }
  }
  return {pages, o, warnings};
}
