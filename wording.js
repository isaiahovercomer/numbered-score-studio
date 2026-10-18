// 官方用字套用器。規則資料在 wording-rules.js；這裡只負責「不改原稿、只改輸出」的替換與回報。
import {AUTO_RULES, PENDING} from './wording-rules.js';

// 預設規則＝不含爭議項（見 wording-rules.js 的 dispute）。
const CORE_RULES = AUTO_RULES.filter(r => !r.dispute);
const startsAt = (text, s, i) => i >= 0 && text.startsWith(s, i);
const endsAt = (text, s, end) => end - s.length >= 0 && text.slice(end - s.length, end) === s;

function replaceRule(text, r) {
  let out = '', last = 0, i = 0, n = 0;
  while ((i = text.indexOf(r.from, i)) !== -1) {
    const end = i + r.from.length;
    const blocked = (r.notBefore || []).some(s => endsAt(text, s, i)) || (r.notAfter || []).some(s => startsAt(text, s, end));
    if (blocked) { i += 1; continue; }
    out += text.slice(last, i) + r.to; last = end; i = end; n++;
  }
  return {text: out + text.slice(last), n};
}

// 對單一字串套用規則；回傳新字串與替換清單（原字串不被修改）。
export function applyWording(text, rules = CORE_RULES) {
  let cur = String(text ?? ''); const changes = [];
  for (const r of rules) { const res = replaceRule(cur, r); if (res.n) { cur = res.text; changes.push({id: r.id, from: r.from, to: r.to, count: res.n}); } }
  return {text: cur, changes};
}

export function mergeChanges(lists) {
  const m = new Map();
  for (const c of lists.flat()) { const k = c.id; m.set(k, m.has(k) ? {...m.get(k), count: m.get(k).count + c.count} : {...c}); }
  return [...m.values()];
}

const MARKER_LINE = /^([一二三四五六七八九十\d]+[、.．]|[\u2460-\u2473\u3251-\u325f\u32b1-\u32bf])$/;
// 歌詞：同一段落內的換行不應阻斷詞組（如「預／備」折兩行），所以同一段合併後替換、再依原行長切回。
// 因為每條規則前後等長，切回後每一行字數不變，逐字對位不受影響。
export function applyWordingToLyrics(lyrics, rules = CORE_RULES) {
  if (!lyrics) return {text: lyrics ?? '', changes: []};
  const lines = String(lyrics).split('\n'), result = [], all = [];
  let block = [];
  const flush = () => {
    if (!block.length) return;
    const parts = block.map(l => l.replace(/\r$/, '')), joined = parts.join(''), res = applyWording(joined, rules);
    all.push(res.changes);
    if (res.text.length !== joined.length) throw Error('用字規則必須一對一等長。');
    let p = 0;
    for (const [k, l] of block.entries()) { const len = parts[k].length; result.push(res.text.slice(p, p + len) + (l.endsWith('\r') ? '\r' : '')); p += len; }
    block = [];
  };
  for (const line of lines) {
    const t = line.trim();
    if (!t || MARKER_LINE.test(t)) { flush(); result.push(line); } else block.push(line);
  }
  flush();
  return {text: result.join('\n'), changes: mergeChanges(all)};
}

// 技能參考資料 notationLayout 的歌詞音節（逐節）：同樣以串接後替換、再依各音節長度切回。
function applySyllables(syllables, rules) {
  const joined = syllables.join(''), res = applyWording(joined, rules);
  let p = 0;
  return {syllables: syllables.map(s => { const len = s.length, t = res.text.slice(p, p + len); p += len; return t; }), changes: res.changes};
}

// 對整份樂譜的「輸出內容」（標題、歌詞、參考資料音節）套用用字；原 score 不被修改。
export function applyWordingToScore(score, rules = CORE_RULES) {
  const lists = [], out = {...score};
  const t = applyWording(score.title ?? '', rules); out.title = score.title === undefined ? score.title : t.text; lists.push(t.changes);
  const l = applyWordingToLyrics(score.lyrics, rules); out.lyrics = score.lyrics === undefined ? score.lyrics : l.text; lists.push(l.changes);
  const ref = score.notationLayout;
  if (ref && ref.fingerprint === JSON.stringify([score.sections, score.key, score.lyrics])) {
    const systems = ref.systems.map(s => ({...s, lyrics: (s.lyrics || []).map(v => ({...v}))}));
    const verses = Math.max(0, ...systems.map(s => s.lyrics.length));
    for (let vi = 0; vi < verses; vi++) {
      const refs = systems.filter(s => s.lyrics[vi]?.syllables);
      const flat = refs.flatMap(s => s.lyrics[vi].syllables), res = applySyllables(flat, rules);
      let p = 0;
      for (const s of refs) { const n = s.lyrics[vi].syllables.length; s.lyrics[vi].syllables = res.syllables.slice(p, p + n); p += n; }
      lists.push(res.changes);
    }
    out.notationLayout = {...ref, systems, fingerprint: JSON.stringify([out.sections, out.key, out.lyrics])};
  }
  return {score: out, changes: mergeChanges(lists)};
}

export function describeChanges(changes, limit = 8) {
  const items = changes.map(c => `${c.from}→${c.to}${c.count > 1 ? '×' + c.count : ''}`);
  return items.length > limit ? items.slice(0, limit).join('、') + `…等 ${items.length} 項` : items.join('、');
}

// 提醒：applied=false（未套用自動替換）時，連同可自動替換的項目一併提示；applied=true 時只提示「待確認」項目。
// 爭議項（dispute）只有在 applied 且 dispute 都為 true 時才會被替換，否則以 hint 說明為何不替換。
export function wordingHints(text = '', {applied = false, dispute = false} = {}) {
  const hints = [];
  for (const r of AUTO_RULES) {
    const active = applied && (!r.dispute || dispute);
    if (active) continue;
    if (applyWording(text, [r]).changes.length) hints.push(r.dispute && applied ? `「${r.from}」：${r.hint}` : `「${r.from}」官方寫「${r.to}」`);
  }
  for (const p of PENDING) if (!p.silent && p.match.some(m => text.includes(m))) hints.push(p.message);
  return hints;
}

// 依選項取得實際套用的規則：wording 關閉＝無；爭議項需 dispute 開啟才套用。
export function activeRules({wording = true, wordingDispute = false} = {}) {
  return wording ? AUTO_RULES.filter(r => !r.dispute || wordingDispute) : [];
}
