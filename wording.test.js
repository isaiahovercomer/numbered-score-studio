// 官方用字自動替換：資料表一致性、誤改防護、只改輸出不改原稿、逐字對位不變、版式預設值。
import test from 'node:test';
import assert from 'node:assert/strict';
import {fromTranscription} from './score-bridge.js';
import {wordBlob, wordingChanges, resolveOptions, parseVerses, layout, PRESETS} from './word-export.js';
import {applyWording, applyWordingToLyrics, applyWordingToScore, describeChanges, wordingHints} from './wording.js';
import {AUTO_RULES, PENDING, SOURCES} from './wording-rules.js';

const len = s => [...s].length;
const fix = s => applyWording(s).text;

test('規則表：欄位完整、編號唯一、前後等長（逐字對位不變）、來源都登記過', () => {
  const ids = new Set();
  for (const r of AUTO_RULES) {
    assert.ok(r.id && !ids.has(r.id), `重複或缺少 id：${r.id}`); ids.add(r.id);
    assert.ok(r.from && r.to && r.from !== r.to, r.id);
    assert.equal(len(r.from), len(r.to), `${r.id} 前後必須等長`);
    assert.ok(['高', '中'].includes(r.conf), `${r.id} 信心度`);
    assert.ok(Array.isArray(r.pdf) && Array.isArray(r.web) && r.pdf.length === 2 && r.web.length === 2, `${r.id} 需附 PDF／網頁出現次數`);
    assert.ok(r.src.length > 0 && r.src.every(k => SOURCES[k]), `${r.id} 需附已登記的來源`);
    assert.ok(!r.to.includes(r.from), `${r.id} 替換後不得再含原詞（避免連鎖／重複替換）`);
  }
  for (const p of PENDING) assert.ok(p.id && p.match.length && p.message && p.basis);
});

test('冪等：官方原本就正確的寫法不變，重複套用結果相同', () => {
  const official = '在基督裏，我們喫神的話；甚麼是豫備的召會？纔能維持，能彀，餧養，咒詛，歎息，惟有祂，奧祕，眾聖徒，因着召會，為着祂。';
  assert.equal(fix(official), official);
  const messy = '在基督裡吃什麼，預備教會，能夠唯有因著祂';
  assert.equal(fix(fix(messy)), fix(messy));
});

test('官方用字對照：裏、喫、甚麼、豫、召會、纔、彀、餧、咒詛、歎、惟、祕、眾、着', () => {
  const cases = [
    ['在基督裡', '在基督裏'], ['裡面', '裏面'], ['那裡', '那裏'],
    ['因著召會', '因着召會'], ['為著主', '為着主'],
    ['吃飯', '喫飯'], ['吃了祂', '喫了祂'], ['吃驚', '喫驚'],
    ['什麼', '甚麼'], ['什麽', '甚麼'],
    ['預備', '豫備'], ['預定', '豫定'], ['預言', '豫言'], ['預表', '豫表'], ['預先', '豫先'], ['預防', '豫防'], ['預告', '豫告'], ['預知', '豫知'], ['預約', '豫約'],
    ['教會', '召會'], ['地方教會', '地方召會'],
    ['你才能來', '你纔能來'], ['我們就夠了', '我們就彀了'], ['已夠', '已彀'], ['足夠', '足彀'], ['預嘗', '豫嘗'], ['你是屬天嗎', '你是屬天麼'], ['做事', '作事'], ['做主', '作主'],
    ['這樣才是', '這樣纔是'], ['我們才有', '我們纔有'], ['才可以', '纔可以'], ['你才會', '你纔會'],
    ['能夠', '能彀'], ['不夠', '不彀'], ['夠了', '彀了'], ['夠資格', '彀資格'],
    ['餵養', '餧養'], ['詛咒', '咒詛'], ['嘆息', '歎息'],
    ['唯一', '惟一'], ['唯有', '惟有'], ['唯獨', '惟獨'], ['唯恐', '惟恐'],
    ['奧秘', '奧祕'], ['秘訣', '祕訣'], ['衆聖徒', '眾聖徒']
  ];
  for (const [from, to] of cases) assert.equal(fix(from), to, `${from} → ${to}`);
});

test('誤改防護：既／即 完全不動（既然、即使、立即、即是、既是…本來就正確）', () => {
  for (const s of ['即使', '既然', '立即', '即是', '既是', '既然如此', '即使召會帶給我難處', '既往不咎', '即時', '卽使']) assert.equal(fix(s), s, s);
  assert.ok(!AUTO_RULES.some(r => /[既即]/.test(r.from)), '規則表不得含「既」「即」');
});

test('誤改防護：吃（口吃、小吃、吃吃、吃力、吃虧、吃苦、吃香、吃醋、吃重、吃緊、吃素、吃得消）不動', () => {
  for (const s of ['口吃', '小吃', '吃吃地笑', '吃力', '吃虧', '吃苦', '吃香', '吃醋', '吃重', '吃緊', '吃素', '吃得消', '吃不消']) assert.equal(fix(s), s, s);
});

test('誤改防護：才（人才、天才、口才、剛才、方才、才能（才幹義）、才華）不動；「才」單字不全域替換', () => {
  for (const s of ['人才是', '天才有', '口才好', '剛才是', '方才有', '他有才能', '才華洋溢', '才', '多才多藝', '英才有']) assert.equal(fix(s), s, s);
  assert.ok(!AUTO_RULES.some(r => r.from === '才'));
});

test('誤改防護：著名、著作、顯著、因著名、其他「著」、唯美、唯物、其他宗派教會、預期預算 不動', () => {
  for (const s of ['著名', '著作', '顯著', '因著名而', '為著作權', '跟著祂', '藉著祂', '唯美', '唯物', '唯我獨尊', '天主教會', '羅馬教會', '基督教會', '預期', '預算', '預計', '他', '他們', '嗎哪', '做作', '有才能', '不靠才能站住', '倚靠才能，乃是', '才能、勢力', '他有才能的人', '軟弱', '大衛', '啟示', '啓示']) assert.equal(fix(s), s, s);
});

test('回報：列出替換了哪些詞、各幾次；describeChanges 摘要', () => {
  const r = applyWording('吃飯吃飯，什麼預備');
  assert.deepEqual(r.changes.map(c => [c.from, c.to, c.count]), [['吃', '喫', 2], ['什麼', '甚麼', 1], ['預備', '豫備', 1]]);
  assert.equal(describeChanges(r.changes), '吃→喫×2、什麼→甚麼、預備→豫備');
  assert.match(describeChanges(AUTO_RULES.map(x => ({from: x.from, to: x.to, count: 1})), 3), /…等 \d+ 項$/);
  assert.deepEqual(applyWording('在基督裏').changes, []);
});

test('歌詞：同段落換行不阻斷詞組；節標行不被合併；每行字數不變；CRLF 保留', () => {
  const lyrics = '①在基督吃我們預\n備好了\n\n②什麼是\r\n教會的生活\n三、\n唯有\n祂';
  const {text, changes} = applyWordingToLyrics(lyrics);
  assert.equal(text, '①在基督喫我們豫\n備好了\n\n②甚麼是\r\n召會的生活\n三、\n惟有\n祂');
  assert.deepEqual(text.split('\n').map(l => len(l)), lyrics.split('\n').map(l => len(l)));
  assert.ok(changes.length >= 5);
  // 節標行（三、）隔開，不會讓「…教會的生活」與「唯有」誤連成詞
  const cross = applyWordingToLyrics('預\n三、\n備');
  assert.equal(cross.text, '預\n三、\n備');
});

test('歌詞逐字對位：替換前後各節字數相同', () => {
  const lyrics = '在基督吃預備\n教會能夠\n\n什麼是唯一';
  const before = parseVerses(lyrics).map(v => v.length), after = parseVerses(applyWordingToLyrics(lyrics).text).map(v => v.length);
  assert.deepEqual(after, before);
});

function makeScore(lyrics) {
  const s = fromTranscription({title: '在基督吃', target_key: 'C', bpm_estimate: 120, pickup_beats: 0,
    notes: [{q: 0, duration: 8, midi: 60}, {q: 8, duration: 8, midi: 62}], chords: [{q: 0, text: 'C'}]});
  s.lyrics = lyrics;
  return s;
}
const bytesOf = async (s, o) => Buffer.from(await wordBlob(s, o).arrayBuffer());
const has = (buf, text) => buf.includes(Buffer.from(text, 'utf8'));

test('只改輸出、不改原稿：applyWordingToScore 回傳新物件，原 score 完全未變', () => {
  const s = makeScore('吃預');
  const snapshot = structuredClone(s);
  const {score, changes} = applyWordingToScore(s);
  assert.deepEqual(s, snapshot);
  assert.equal(s.title, '在基督吃'); assert.equal(s.lyrics, '吃預');
  assert.equal(score.title, '在基督喫'); assert.equal(score.lyrics, '喫預'); // 單獨的「預」不是詞組，不替換
  
  assert.ok(changes.length >= 1);
});

test('技能參考資料 notationLayout：音節同步替換，指紋隨之更新，原資料不變', () => {
  const s = makeScore('預備好');
  s.notationLayout = {fingerprint: JSON.stringify([s.sections, s.key, s.lyrics]), systems: [{raw: '1/2/', note_q: [0, 8], lyrics: [{syllables: ['預', '備', '好']}]}]};
  const snapshot = structuredClone(s);
  const {score} = applyWordingToScore(s);
  assert.deepEqual(s, snapshot);
  assert.deepEqual(score.notationLayout.systems[0].lyrics[0].syllables, ['豫', '備', '好']);
  assert.equal(score.notationLayout.fingerprint, JSON.stringify([score.sections, score.key, score.lyrics]));
});

test('版式預設：lsm 預設開啟官方用字；classic 預設關閉；可個別覆寫', () => {
  assert.equal(PRESETS.lsm.wording, true);
  assert.equal(PRESETS.classic.wording, false);
  assert.equal(resolveOptions({}).wording, true);
  assert.equal(resolveOptions({preset: 'classic'}).wording, false);
  assert.equal(resolveOptions({preset: 'classic', wording: true}).wording, true);
  assert.equal(resolveOptions({preset: 'lsm', wording: false}).wording, false);
});

test('Word 輸出：lsm 預設把標題與歌詞改成官方用字；關閉開關或 classic 預設則保持原樣', async () => {
  // 兩個起音：兩字歌詞
  const s = makeScore('吃預');
  const lsm = await bytesOf(s, {preset: 'lsm'});
  assert.ok(has(lsm, '在基督喫') && has(lsm, '>喫<') && has(lsm, '>預<'));
  assert.ok(!has(lsm, '在基督吃') && !has(lsm, '>吃<'));
  const off = await bytesOf(s, {preset: 'lsm', wording: false});
  assert.ok(has(off, '在基督吃') && has(off, '>吃<'));
  const classic = await bytesOf(s, {preset: 'classic'});
  assert.ok(has(classic, '在基督吃') && has(classic, '>吃<') && !has(classic, '喫'));
  const classicOn = await bytesOf(s, {preset: 'classic', wording: true});
  assert.ok(has(classicOn, '在基督喫') && has(classicOn, '>喫<'));
  assert.equal(s.lyrics, '吃預');
});

test('Word 輸出：歌詞字數受規則影響前後一致（不會因替換而報字數不符）', async () => {
  const s = makeScore('預備');
  const buf = await bytesOf(s, {});
  assert.ok(has(buf, '>豫<') && has(buf, '>備<'));
  assert.equal(layout(s, {}).count, 2);
});

test('wordingChanges：回傳實際替換清單；開關關閉時為空', () => {
  const s = makeScore('吃預');
  s.title = '甚麼是教會';
  assert.deepEqual(wordingChanges(s, {}).map(c => c.from).sort(), ['吃', '教會']);
  assert.deepEqual(wordingChanges(s, {wording: false}), []);
  assert.deepEqual(wordingChanges(s, {preset: 'classic'}), []);
});

test('提醒：套用後只剩「待確認」項目；未套用時連同可自動替換項目一起提醒', () => {
  const text = '裡面 什麼 預備 教會 跟著 他 才能 做 預算 因著';
  const off = wordingHints(text), on = wordingHints(text, {applied: true});
  assert.ok(off.some(h => h.includes('裡') && h.includes('裏')) && off.some(h => h.includes('預備')));
  assert.ok(!on.some(h => h.startsWith('「預備」') || h.startsWith('「什麼」')));
  // 套用後：待確認項（他、著、預的其他詞）仍提醒；裡、因著已自動替換，不再提醒
  assert.ok(!on.some(h => h.startsWith('「裡」') || h.startsWith('「因著」')));
  assert.ok(on.some(h => h.includes('祂')) && on.some(h => h.includes('預')) && !on.some(h => h.includes('纔能') || h.includes('做→')));
  assert.deepEqual(wordingHints('在基督裏，我們喫祂', {applied: true}), []);
});

test('文件同步：NOTATION_RULES.md 列出每一條自動替換規則與每一個待確認項目', async () => {
  const {readFileSync} = await import('node:fs');
  const doc = readFileSync(new URL('./NOTATION_RULES.md', import.meta.url), 'utf8');
  for (const r of AUTO_RULES) assert.ok(doc.includes(`| ${r.from} | ${r.to} |`), `NOTATION_RULES.md 缺少：${r.from}→${r.to}`);
  for (const p of PENDING) assert.ok(doc.includes(p.message), `NOTATION_RULES.md 缺少待確認：${p.id}`);
  assert.match(doc, /「既／即」不在規則表/);
});

test('使用者決定依官方 PDF：裡→裏、因著→因着、為著→為着 預設即替換（雖然詩歌多寫「裡」「著」），classic 仍預設關閉', async () => {
  const ids = ['li', 'yin-zhe', 'wei-zhe'];
  for (const id of ids) {
    const r = AUTO_RULES.find(x => x.id === id);
    assert.ok(r && !('dispute' in r), `${id} 不得再標為爭議`);
    assert.ok(r.hn[0] > r.hn[1], `${id} 應如實列出詩歌證據（詩歌多寫原字）`);
    assert.match(r.note, /依使用者決定以官方 PDF 為準/);
  }
  assert.equal(fix('在基督裡，因著祂，為著祂'), '在基督裏，因着祂，為着祂');
  const s = makeScore('裡預');
  s.title = '基督';
  assert.ok(has(await bytesOf(s, {}), '>裏<') && !has(await bytesOf(s, {}), '>裡<'));
  assert.ok(has(await bytesOf(s, {preset: 'classic'}), '>裡<'));
  assert.deepEqual(wordingChanges(s, {}).map(c => c.from), ['裡']);
  assert.deepEqual(wordingChanges(s, {preset: 'classic'}), []);
  // 已無爭議項，因此沒有「爭議用字」選項
  assert.equal(resolveOptions({}).wordingDispute, undefined);
  assert.ok(!AUTO_RULES.some(r => 'dispute' in r));
});

test('詩歌證據：每條規則都附 hymnal.net（hn）與北投 PDF（ft）的出現次數；詩歌不用的舊字不在自動規則裡', () => {
  for (const r of AUTO_RULES) {
    assert.ok(Array.isArray(r.hn) && r.hn.length === 2 && Array.isArray(r.ft) && r.ft.length === 2, `${r.id} 缺 hn／ft`);
  }
  // 詩歌多半不用的和合本舊字：輭、躭、譭、羣、大衞、啓示、着都不得被自動替換
  for (const s of ['軟弱', '耽延', '毀謗', '群眾', '大衛', '燈台', '啟示', '啓示', '跟著祂', '藉著祂']) assert.equal(fix(s), s, s);
  assert.ok(!AUTO_RULES.some(r => /[輭躭譭羣衞]/.test(r.to)));
});

// ── Bugbot 審查回歸（PR #4）────────────────────────────────────────────────
test('回歸：才能→纔能 排除人才、天才、口才、剛才等詞（人才能興起、天才能做不可改動）', () => {
  for (const s of ['人才能興起', '天才能做', '口才能', '剛才能', '方才能', '奇才能', '英才能', '秀才能', '鬼才能', '全才能', '庸才能', '奴才能', '蠢才能', '賢才能', '通才能', '適才能', '文才能', '多才能'])
    assert.ok(fix(s).includes('才能') && !fix(s).includes('纔'), `${s} 不可變成纔能`);
  assert.equal(fix('人才能興起'), '人才能興起');
  assert.equal(fix('天才能做').slice(0, 3), '天才能'); // 「做→作」是另一條規則，與「才能」無關
  // 才幹義不改
  for (const s of ['有才能', '無才能', '不是才能、勢力', '不靠才能站住', '倚靠才能，乃是靠主', '他的才能與恩賜', '才能和智慧']) assert.equal(fix(s), s, s);
  // 「方始可以」義才改（官方 hn 纔能 61／才能 3、經文 7、綱目 1）
  assert.equal(fix('我們才能得救'), '我們纔能得救');
  assert.equal(fix('然後，才能進入'), '然後，纔能進入');
  assert.equal(fix('成長才能成熟'), '成長纔能成熟');
  // 沒被改的「才能」會留下待確認提示；改掉的不再提示
  assert.ok(wordingHints('人才能興起', {applied: true}).some(h => h.includes('才能')));
  assert.ok(!wordingHints('我們才能得救', {applied: true}).some(h => h.includes('才能')));
  const r = AUTO_RULES.find(x => x.id === 'cai-neng');
  for (const g of ['人', '天', '口', '剛', '方', '奇', '英', '秀', '鬼']) assert.ok(r.notBefore.includes(g), `cai-neng 缺少排除：${g}`);
});

test('回歸：嗎→麼 只換明確的句末語氣詞；是什麼嗎、這嗎、那嗎、嗎哪不可誤改', () => {
  assert.equal(fix('你愛我嗎？'), '你愛我麼？');
  assert.equal(fix('是屬天的嗎，還是屬地的嗎？'), '是屬天的麼，還是屬地的麼？');
  assert.equal(fix('你愛我嗎'), '你愛我麼'); // 全文結尾
  // 什麼→甚麼 之後不得變成「甚麼麼」；這嗎／那嗎／怎嗎／哪嗎不得變成「這麼」「那麼」
  assert.equal(fix('是什麼嗎？'), '是甚麼嗎？');
  assert.ok(!fix('是什麼嗎').includes('甚麼麼') && !fix('是甚麼嗎').includes('甚麼麼'));
  for (const s of ['這嗎？', '那嗎？', '怎嗎？', '哪嗎？', '多嗎？', '嗎哪', '嗎哪，從天降下', '你吃嗎我說']) assert.ok(!fix(s).includes('這麼') && !fix(s).includes('那麼') && !fix(s).includes('嗎→'), s);
  assert.equal(fix('這嗎？'), '這嗎？');
  assert.equal(fix('那嗎'), '那嗎');
  assert.equal(fix('嗎哪，從天降下'), '嗎哪，從天降下');
  assert.equal(fix('你愛我嗎是的'), '你愛我嗎是的'); // 後面不是標點，不確定 → 不改，改為提示
  assert.ok(wordingHints('是什麼嗎？', {applied: true}).some(h => h.includes('嗎')));
  assert.ok(!wordingHints('你愛我嗎？', {applied: true}).some(h => h.includes('嗎')));
});

test('回歸（Bugbot）：歌詞行尾沒有標點的「嗎」——輸出不改、提示仍會出現，兩者一致', () => {
  const lyrics = '一、\n你愛我嗎\n我愛祢\n你愛我嗎？\n我愛祢';
  const out = applyWordingToLyrics(lyrics);
  assert.equal(out.text, lyrics.replace('嗎？', '麼？'), '只有後接「？」的嗎被換成麼；行尾無標點者保留');
  assert.deepEqual(out.changes.map(c => [c.from, c.count]), [['嗎', 1]]);
  assert.ok(wordingHints('你愛我嗎\n我愛祢', {applied: true}).some(h => h.includes('嗎')), '行尾無標點的嗎要提示待確認');
  assert.ok(!wordingHints('你愛我嗎？\n我愛祢', {applied: true}).some(h => h.includes('嗎')), '已替換的嗎不再提示');
  assert.ok(!wordingHints('標題\n\n你愛我嗎？\n我愛祢', {applied: true}).some(h => h.includes('嗎')));
});

test('回歸：notationLayout 匯入的譜，替換次數不重複計算（標題＋歌詞各算一次；音節只是同一段歌詞）', () => {
  const s = makeScore('預備好');
  s.title = '預備';
  s.notationLayout = {fingerprint: JSON.stringify([s.sections, s.key, s.lyrics]), systems: [{raw: '1/2/3/', note_q: [0, 8, 16], lyrics: [{syllables: ['預', '備', '好']}]}]};
  const withRef = applyWordingToScore(s).changes;
  const noRef = applyWordingToScore({...s, notationLayout: undefined}).changes;
  assert.deepEqual(withRef, noRef, '有無 notationLayout 的回報必須相同');
  assert.deepEqual(withRef.map(c => [c.from, c.count]), [['預備', 2]]); // 標題 1＋歌詞 1
  assert.deepEqual(wordingChanges(s, {}).map(c => [c.from, c.count]), [['預備', 2]]);
  assert.match(describeChanges(withRef), /預備→豫備×2/);
  // 兩節歌詞、兩個系統：每節各算一次，不因音節再加倍
  const s2 = makeScore('預備\n\n預備');
  s2.title = '甲';
  s2.notationLayout = {fingerprint: JSON.stringify([s2.sections, s2.key, s2.lyrics]), systems: [{raw: '1/2/', note_q: [0, 8], lyrics: [{syllables: ['預', '備']}, {syllables: ['預', '備']}]}]};
  assert.deepEqual(applyWordingToScore(s2).changes.map(c => [c.from, c.count]), [['預備', 2]]);
  // 音節確實被替換
  assert.deepEqual(applyWordingToScore(s2).score.notationLayout.systems[0].lyrics[1].syllables, ['豫', '備']);
});

test('回歸：已自動替換的因著、為著不再列為待確認的「著」；仍留著的「著」才提示', () => {
  const only = wordingHints('因著祂，為著祂', {applied: true});
  assert.deepEqual(only, [], '因著、為著已替換，不應再出現待確認');
  const mixed = wordingHints('因著祂，跟著祂', {applied: true});
  assert.equal(mixed.length, 1);
  assert.ok(mixed[0].includes('著'));
  // 未套用時仍提醒可自動替換的項目與「著」
  const off = wordingHints('因著祂', {applied: false});
  assert.ok(off.some(h => h.includes('因着')) && off.some(h => h.includes('著')));
});
