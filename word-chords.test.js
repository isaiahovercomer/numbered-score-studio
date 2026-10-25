// 和弦錯開回歸：所有資料皆為合成譜，直接檢查 DOCX 中實際繪製的可見範圍。
import test from 'node:test';
import assert from 'node:assert/strict';
import {fromTranscription} from './score-bridge.js';
import {wordBlob, layout, chordLabel} from './word-export.js';
import {readZip} from './test-helpers.js';

const afm = {
  A: 722, B: 667, C: 667, D: 722, E: 611, F: 556, G: 722,
  m: 778, a: 444, j: 278, d: 500, i: 278, s: 389, u: 500, g: 500, b: 500, '/': 278, '+': 564, '#': 500
};
// 獨立計算測試預期值，避免定位與驗證共用同一個字寬錯誤。
const visibleWidth = label => [...label].reduce((n, c) =>
  n + (/\d|[♯♭]/.test(c) ? 500 * 0.65 : (afm[c] ?? 600)), 0) / 100;
const score = (reference = false) => fromTranscription({
  title: '合成和弦測試', target_key: 'C', bpm_estimate: 100,
  notes: reference ? [{q: 0, duration: 8, midi: 60}, {q: 8, duration: 8, midi: 62}]
    : [{q: 0, duration: 16, midi: 60}],
  chords: (reference ? ['F#maj7/C#', 'Bbmaj7/F'] : ['C', 'Gm7/Bb', 'Bbmaj7/F', 'Ebsus4/Bb'])
    .map((text, i) => ({q: i * (reference ? 8 : 4), text})),
  ...(reference ? {systems: [{raw: '12', note_q: [0, 8], lyrics: []}]} : {})
});
async function chordBoxes(s, preset) {
  const xml = readZip(new Uint8Array(await wordBlob(s, {preset}).arrayBuffer()))['word/document.xml'];
  return [...xml.matchAll(/<wp:anchor\b[^]*?<\/wp:anchor>/g)].map(m => m[0])
    .filter(a => a.includes('w:val="9C2323"'))
    .map(a => {
      assert.match(a, /relativeFrom="paragraph"><wp:posOffset>0<\/wp:posOffset>/);
      const x = Number(a.match(/relativeFrom="column"><wp:posOffset>(-?\d+)/)[1]) / 12700;
      const w = Number(a.match(/<wp:extent cx="(\d+)"/)[1]) / 12700;
      const label = [...a.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join('');
      return {label, cx: x + w / 2, w};
    });
}
function separated(items, centers = items.map(c => c.cx)) {
  for (let i = 1; i < items.length; i++) {
    const gap = centers[i] - visibleWidth(items[i].label) / 2
      - centers[i - 1] - visibleWidth(items[i - 1].label) / 2;
    assert.ok(gap >= 1.95, `第 ${i + 1} 個和弦間距 ${gap} pt，應至少 2 pt`);
  }
}
for (const preset of ['lsm', 'classic']) {
  test(`C5 ${preset}：全音符內四個一拍和弦不重疊`, async () => {
    const s = score(), boxes = await chordBoxes(s, preset);
    assert.equal(boxes.length, 4);
    assert.deepEqual(boxes.map(c => c.label),
      ['C', 'Gm7/Bb', 'Bbmaj7/F', 'Ebsus4/Bb'].map(c => chordLabel(c, preset === 'lsm' ? 'symbol' : 'ascii')));
    separated(boxes);
  });
  test(`C6 ${preset}：原稿相鄰長和弦不重疊`, async () => {
    const boxes = await chordBoxes(score(true), preset);
    assert.equal(boxes.length, 2);
    separated(boxes);
  });
}

const helpers = () => import('./word-chords.js');
test('C1 兩個重疊：左邊優先、右邊恰好留 2 pt，且不修改輸入', async () => {
  const {staggerChords} = await helpers();
  const items = [{cx: 30, label: 'Bbmaj7/F'}, {cx: 35, label: 'Ebsus4/Bb'}];
  const original = structuredClone(items), out = staggerChords(items);
  assert.equal(out[0], 30);
  assert.ok(Math.abs(out[1] - out[0] - visibleWidth(items[0].label) / 2
    - visibleWidth(items[1].label) / 2 - 2) < 0.05);
  assert.deepEqual(items, original);
});
test('C2 連鎖四個和弦只往右移，保持順序', async () => {
  const {staggerChords} = await helpers();
  const items = ['C', 'Gm7/Bb', 'Bbmaj7/F', 'Ebsus4/Bb'].map((label, i) => ({cx: 40 + i, label}));
  const out = staggerChords(items);
  separated(items, out);
  out.forEach((cx, i) => assert.ok(cx >= items[i].cx));
});
test('C3 不重疊的中心逐值不變，空陣列與單一和弦也適用', async () => {
  const {staggerChords} = await helpers();
  const items = [{cx: 30.123456789, label: 'C'}, {cx: 150.987654321, label: 'Gm7'}];
  assert.deepEqual(staggerChords(items), items.map(c => c.cx));
  assert.deepEqual(staggerChords([]), []);
  assert.deepEqual(staggerChords(items.slice(0, 1)), [items[0].cx]);
});
test('C4 行尾回推只影響碰撞的和弦，可見右緣不超界', async () => {
  const {staggerChords} = await helpers();
  const items = [{cx: 10, label: 'C'}, {cx: 96, label: 'Bbmaj7/F'}, {cx: 99, label: 'Ebsus4/Bb'}];
  const out = staggerChords(items, {right: 100});
  assert.equal(out[0], 10);
  separated(items, out);
  out.forEach((cx, i) => assert.ok(cx + visibleWidth(items[i].label) / 2 <= 100.000001));
  assert.ok(Math.abs(out[2] + visibleWidth(items[2].label) / 2 - 100) < 0.000001);
});
test('C7 使用顯示字量寬，數字及符號為 0.65 倍，未知字為 600', async () => {
  const {chordTextWidth} = await helpers();
  for (const label of ['F♯m7', 'F#m7', 'B♭maj7/F', 'C13+', '未知']) {
    assert.equal(chordTextWidth(label), visibleWidth(label));
    assert.equal(chordTextWidth(label, 20), visibleWidth(label) * 2);
  }
  assert.notEqual(chordTextWidth('F♯m7'), chordTextWidth('F#m7'));
});
test('未排序輸入回傳原索引順序，同位置依原出現順序，支援自訂間距', async () => {
  const {staggerChords} = await helpers();
  const items = [{cx: 50, label: 'C'}, {cx: 20, label: 'C'}, {cx: 20, label: 'C'}];
  const out = staggerChords(items, {gap: 3});
  assert.equal(out[1], 20);
  assert.ok(Math.abs(out[2] - out[1] - visibleWidth('C') - 3) < 0.000001);
  assert.equal(out[0], 50);
});
test('整行過密保留正向結果，不回推到負座標', async () => {
  const {staggerChords} = await helpers();
  const items = [{cx: 10, label: 'Bbmaj7/F'}, {cx: 11, label: 'Ebsus4/Bb'}];
  assert.deepEqual(staggerChords(items, {right: 30}), staggerChords(items));
});
for (const reference of [false, true]) {
  test(`過密${reference ? '原稿' : '自動'}行回傳警告，仍可匯出且不刪和弦`, async () => {
    const s = score(reference);
    const texts = Array(20).fill('Ebsus4/Bb');
    s.sections.verse[0].chordChanges = texts.map((text, i) => ({beat: i / 5, text}));
    if (reference) s.notationLayout.fingerprint = JSON.stringify([s.sections, s.key, s.lyrics]);
    assert.deepEqual(layout(s).warnings, ['和弦過密：第 1 行']);
    assert.equal((await chordBoxes(s, 'lsm')).length, texts.length);
  });
}
test('一般譜回傳空警告，失效的原稿資料不參與警告', () => {
  const s = score(true);
  s.notationLayout.fingerprint = '失效';
  assert.deepEqual(layout(s).warnings, []);
});
