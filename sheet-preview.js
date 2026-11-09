import {previewPages} from './preview-score.js';
import {drawNotes} from './preview-notes.js';
const ns = 'http://www.w3.org/2000/svg';
function node(tag, attrs = {}, parent) {
  const el = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent?.append(el);
  return el;
}
let localFont;
function loadNotation() {
  if (!localFont) localFont = (async () => {
    try {
      const font = new FontFace('Preview01SMN', 'local("01SMN"), local("01smn")');
      document.fonts.add(await font.load());
      return true;
    } catch { return false; }
  })();
  return localFont;
}
function paint(svg, group, font) {
  let y = group.y, unknown = false;
  const draw = {
    text(x, y, value, size) { node('text', {x, y, 'font-size': size}, svg).textContent = value; },
    line(x, y, end) { node('line', {x1: x, y1: y, x2: end, y2: y, stroke: '#111', 'stroke-width': .8}, svg); },
    vertical(x, y, end) { node('line', {x1: x, y1: y, x2: x, y2: end, stroke: '#111'}, svg); },
    dot(x, y) { node('circle', {cx: x, cy: y, r: 1.1}, svg); },
    tie(x, y, w) {
      const e = Math.min(7, w / 3);
      const d = `M ${x} ${y + 5} C ${x} ${y} ${x + e} ${y} ${x + e} ${y}
          H ${x + w - e} C ${x + w - e} ${y} ${x + w} ${y} ${x + w} ${y + 5}`;
      node('path', {d, fill: 'none', stroke: '#111', 'stroke-width': .5}, svg);
    }
  };
  function textRuns(runs, x, baseline, anchor = 'start') {
    const t = node('text', {x, y: baseline, 'text-anchor': anchor, 'xml:space': 'preserve'}, svg);
    for (const r of runs) {
      const shift = r.shift === 'subscript' ? 'sub' : r.shift === 'superscript' ? 'super' : 'baseline';
      node('tspan', {'font-size': r.size * (r.shift ? .65 : 1), 'baseline-shift': shift,
        fill: r.color, 'font-family': r.font + ', serif'}, t).textContent = r.text;
    }
  }
  for (const p of group.row) {
    for (const s of p.shapes) {
      if (s.tie) { draw.tie(s.x, y + s.y, s.w); continue; }
      const r = s.runs[0];
      if (r?.font === '01SMN') {
        if (font) node('text', {x: s.x, y: y + s.y + 15, 'font-family': 'Preview01SMN',
          'font-size': 14, 'xml:space': 'preserve'}, svg).textContent = r.text;
        else unknown = drawNotes(r.text, s.x, y + s.y, draw) || unknown;
      } else if (r) textRuns(s.runs, s.x + (s.center ? s.w / 2 : 0), y + s.y + r.size,
        s.center ? 'middle' : 'start');
    }
    for (const {x, anchor, run} of p.chunks) textRuns([run], x, y + run.size, anchor);
    y += p.line + p.after;
  }
  return unknown;
}
export function connectSheetPreview({getScore, options, download, report}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'sheet-dialog';
  dialog.setAttribute('aria-labelledby', 'sheetTitle');
  dialog.innerHTML = `<header><div><h2 id="sheetTitle">詞譜列印預覽</h2>
    <p id="sheetPages" role="status"></p></div><button id="sheetClose" type="button">關閉</button></header>
    <div class="sheet-stage" tabindex="0" aria-label="詞譜紙張"></div>
    <p class="sheet-info" id="sheetInfo"></p>
    <footer><button id="sheetPrev" type="button">上一頁</button><button id="sheetNext" type="button">下一頁</button>
    <button id="sheetZoom" type="button" aria-pressed="false">放大</button>
    <button id="sheetWord" type="button">下載 Word</button></footer>`;
  document.body.append(dialog);
  const el = id => dialog.querySelector('#' + id);
  const stage = dialog.querySelector('.sheet-stage');
  let model, index, enlarged, font = false, revision = 0;
  function render() {
    const {pages, o, warnings} = model, top = o.marginTop / 20, h = o.pageH - top - o.marginBottom / 20;
    const svg = node('svg', {viewBox: `0 0 ${o.pageW} ${o.pageH}`, role: 'img',
      'aria-label': '詞譜預覽，第 ' + (index + 1) + ' 頁'});
    if (enlarged) svg.style.width = o.pageW * 96 / 72 + 'px';
    const ink = node('svg', {x: o.marginLR / 20, y: top, width: o.usable, height: h,
      viewBox: `0 ${top} ${o.usable} ${h}`, overflow: 'hidden'}, svg);
    const unknown = pages[index].map(g => paint(ink, g, font)).some(Boolean);
    stage.replaceChildren(svg);
    stage.scrollTop = stage.scrollLeft = 0;
    el('sheetPages').textContent = `${o.paper.toUpperCase()} · 第 ${index + 1} / ${pages.length} 頁（預估）`;
    el('sheetInfo').textContent = [
      font ? '使用本機 01SMN。' : '未使用本機 01SMN，數字、附點與減時線以圖形代示。',
      '實際分頁以 Word 為準。', unknown ? '此頁含無法代示的原稿符號，請在 Word 核對。' : '', ...warnings
    ].filter(Boolean).join(' ');
    el('sheetPrev').disabled = index === 0;
    el('sheetNext').disabled = index === pages.length - 1;
    el('sheetZoom').textContent = enlarged ? '適合頁寬' : '放大';
    el('sheetZoom').setAttribute('aria-pressed', String(enlarged));
  }
  const trigger = document.getElementById('sheetPreview');
  trigger.onclick = () => {
    let score;
    try {
      score = getScore(); model = previewPages(score, options()); index = 0; enlarged = false;
      const token = ++revision;
      render(); dialog.showModal();
      loadNotation().then(loaded => {
        if (loaded && !font && dialog.open && token === revision) { font = true; render(); }
      });
    } catch (e) { report(e, score); }
  };
  el('sheetClose').onclick = () => dialog.close();
  el('sheetPrev').onclick = () => { if (index > 0) { index--; render(); } };
  el('sheetNext').onclick = () => { if (index < model.pages.length - 1) { index++; render(); } };
  el('sheetZoom').onclick = () => { enlarged = !enlarged; render(); };
  el('sheetWord').onclick = download;
  dialog.addEventListener('close', () => {
    revision++; model = null; stage.replaceChildren(); trigger.focus({preventScroll: true});
  });
}
