// 由 wording-rules.js 產生 NOTATION_RULES.md 的「官方用字」章節：node gen-wording-doc.mjs
import {readFileSync, writeFileSync} from 'node:fs';
import {AUTO_RULES, PENDING, SOURCES} from './wording-rules.js';
const nm = {pdf: '綱目PDF', web: '網頁經文', guide: '指南', twgbr: '福音書房官網', about: '簡說', hehe: '和合本1919', intro: '恢復本簡介', hymnal: 'hymnal.net詩歌', ft: '北投詩歌PDF'};
const row = r => {
  const g = []; if (r.notBefore) g.push('前不接：' + r.notBefore.join('、')); if (r.notAfter) g.push('後不接：' + r.notAfter.join('、'));
  return `| ${r.from} | ${r.to} | ${r.conf} | ${r.pdf.join('／')} | ${r.web.join('／')} | ${r.hn.join('／')} | ${r.ft.join('／')} | ${r.src.map(k => nm[k]).join('、')} | ${[r.note, g.length ? '（' + g.join('；') + '）' : ''].filter(Boolean).join(' ')} |\n`;
};
const head = '| 原稿 | 輸出 | 信心 | 綱目PDF | 網頁經文 | 詩歌hn | 詩歌北投PDF | 依據 | 備註 |\n|---|---|---|---|---|---|---|---|---|\n';
let o = '## 官方用字\n\n### 官方用字自動替換（`wording-rules.js`；lsm 版式預設開啟、classic 預設關閉）\n\n';
o += '匯出 Word 時才套用，**只影響輸出的標題、歌詞**；編輯器裡的稿、JSON、MIDI、MP3 都不動。所有規則前後等長，逐字對位（字數＝起音數）不受影響。狀態列會列出替換了哪些詞。介面有「匯出時套用官方用字」開關，API 為 `wordBlob(score,{wording:true|false})`。\n\n';
o += '以**詞組**為單位替換，不做單字全域替換；只有「衆」這種官方來源中完全不出現原字的異體字，以及「吃」「做」（各來源 0 次，並排除口吃、做作等）才以單字處理。括號內為不替換的前後文。四個數字欄皆為「原字／官方字」的原始字串出現次數（未扣除排除情形）。\n\n';
o += '**衝突原則（Isaiah 指示）：詩歌用字與新約經文衝突時，詩歌輸出以詩歌來源為準（故舊字不替換）；唯一例外是 Isaiah 明確決定依官方 PDF 的 裡→裏、因著→因着、為著→為着（見下）。**\n\n' + head + AUTO_RULES.map(row).join('');
o += '\n### 使用者決定：依官方 PDF（詩歌多寫原字）\n\n「裡→裏」「因著→因着」「為著→為着」：官方綱目 PDF 寫「裏」「着」，詩歌（hymnal.net、北投）多寫「裡」「著」（hn 裡 1134／裏 263、著 1106／着 2）。Isaiah 決定**依官方 PDF 為準、預設替換**（lsm 版式；classic 版式整體用字替換預設關閉），因此已不再有「詩歌爭議」項，也沒有爭議用字開關。若日後改變心意，把這三條規則從 `wording-rules.js` 移除即可。\n';
o += '\n### 待確認／不替換（只提醒，或僅記錄依據）\n\n| 項目 | 說明 | 觀察 |\n|---|---|---|\n';
for (const p of PENDING) o += `| ${p.match.join('、')} | ${p.message}${p.silent ? '（僅記錄，不提醒）' : ''} | ${p.basis} |\n`;
o += '\n### 「既／即」不在規則表\n\n官方來源中的「既然、即使、立即、即是」等本來就是這樣寫（綱目 PDF 即使 1；網頁經文 既然 30、即使 14、立即 17；詩歌 hn 既 106／即 68，既然 7、即使 16），沒有異體字，**不可替換**。測試有專門的誤改防護案例。\n\n### 用字來源\n\n';
for (const [k, v] of Object.entries(SOURCES)) o += `- **${nm[k]}**：${v.name}｜${v.url}${v.files ? '｜' + v.files : ''}${v.note ? '｜' + v.note : ''}\n`;
o += '\n統計方法：綱目 PDF 以 `pdftotext` 取文字層（去除折行空白，約 1.4 萬字）；網頁取 `https://line.twgbr.org/recoveryversion/bible/40.html` 至 `66.html`（新約 27 卷，約 34.6 萬字）；詩歌取 hymnal.net 的 `/zh/hymn/ch/1–780` 與 `/zh/hymn/ts/1–513` 歌詞區塊，以及北投 `flowingstream.org/hymns/` 各首詩歌 PDF 抽樣 291 首（PDF 排版為逐字空格，統計前去除空白）。**只保存次數，不保存任何歌詞全文。** 北投網站的 HTML 歌詞與 hymnal.net 高度一致，因此詩歌欄以 hymnal.net 為準。\n\n詩歌觀察：詩歌內部對「裡／裏」並不一致（hymnal.net 大本＋補充本 裡 1134／裏 263；補充本單獨 538／212；北投 PDF 抽樣 143／87），無法歸一；因此「裡→裏」列為爭議項。「著」詩歌近乎一律（hn 著 1106／着 2）。「做」在全部來源 0 次，「作」逾 2200 次。\n';
const doc = readFileSync(new URL('./NOTATION_RULES.md', import.meta.url), 'utf8');
const i = doc.indexOf('## 官方用字');
writeFileSync(new URL('./NOTATION_RULES.md', import.meta.url), (i < 0 ? doc.trimEnd() + '\n\n' : doc.slice(0, i)) + o);
