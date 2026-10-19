// Word 版式選項：紙張、版式預設（lsm 官方／classic 原版）與選項解析。純資料與驗證，不產生任何 XML。
// ── 版式選項 ───────────────────────────────────────────────────────────────
// lsm：依水流職事站官方標語歌頁（B26ANCC01zht p.2）實測；classic：本專案原有版式（A4、標楷體 22pt、一、二、三、）。
// 兩者皆可個別覆寫 paper／verseMarks／tempo／copyright／wording／lyricLayout（boxes 逐字方塊、inline 內文整句）。官方量測不到的項目（01SMN 14pt、和弦字型字級顏色、音符間距）兩版共用現狀。
export const PAPERS = {letter: {w: 12240, h: 15840, name: 'Letter'}, a4: {w: 11906, h: 16838, name: 'A4'}};
export const PRESETS = {
  lsm: {
    paper: 'letter',
    verseMarks: 'circled',
    tempo: false,
    keyStyle: 'lsm',
    titleFont: '新細明體',
    titlePt: 14,
    textFont: '新細明體',
    textAscii: 'Times New Roman',
    lyricPt: 12,
    metaPt: 10,
    marginLR: 650,
    marginTop: 1140,
    marginBottom: 650,
    rowBase: 34,
    copyright: '',
    wording: true,
    lyricLayout: 'inline'
  },
  classic: {
    paper: 'a4',
    verseMarks: 'chinese',
    tempo: true,
    keyStyle: 'classic',
    titleFont: '標楷體',
    titlePt: 22,
    textFont: '標楷體',
    textAscii: undefined,
    lyricPt: 13.5,
    metaPt: 11,
    marginLR: 567,
    marginTop: 567,
    marginBottom: 567,
    rowBase: 44,
    copyright: '',
    wording: false,
    lyricLayout: 'inline'
  }
};
export const DEFAULT_PRESET = 'lsm';
export function resolveOptions(o = {}) {
  const base = PRESETS[o.preset] || PRESETS[DEFAULT_PRESET],
    r = {...base};
  for (const k of ['paper', 'verseMarks', 'tempo', 'copyright', 'wording', 'lyricLayout'])
    if (o[k] !== undefined && o[k] !== null) r[k] = o[k];
  if (!PAPERS[r.paper]) throw Error('紙張只支援 Letter 或 A4。');
  if (!['circled', 'chinese'].includes(r.verseMarks)) throw Error('節次樣式只支援圈圈數字或中文數字。');
  r.copyright = String(r.copyright || '')
    .trim()
    .slice(0, 120);
  if (!['boxes', 'inline'].includes(r.lyricLayout)) throw Error('歌詞排法只支援逐字方塊或內文整句。');
  if (r.lyricLayout === 'inline') {
    // 內文整句：歌詞一律標楷體 14 pt；lsm 的英數仍用 Times New Roman（AGENTS.md §7），classic 用標楷體。標題、調號列不變。
    r.lyricFont = '標楷體';
    r.lyricPt = 14;
    r.lyricAscii = r.keyStyle === 'lsm' ? 'Times New Roman' : '標楷體';
    r.lyricLine = 20;
  }
  r.tempo = Boolean(r.tempo);
  r.wording = Boolean(r.wording);
  r.preset = PRESETS[o.preset] ? o.preset : DEFAULT_PRESET;
  const page = PAPERS[r.paper];
  r.pageW = page.w / 20;
  r.pageH = page.h / 20;
  r.usable = r.pageW - (2 * r.marginLR) / 20;
  r.wrapMax = r.usable - 68.6;
  r.classic = r.keyStyle === 'classic';
  return r;
}
