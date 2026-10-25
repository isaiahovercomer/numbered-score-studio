// 輸出位元組比對：固定的樂譜與選項產生的 DOCX，其 SHA-256 必須與 golden-docx.json 完全相同。
// 目的：重構（拆檔、重新排版程式碼）時保證輸出一個位元組都沒變。
// 若是「刻意」改變排版或用字規則，請執行 `UPDATE_GOLDEN=1 npm test` 重新產生 golden-docx.json，並在 PR 說明為何輸出改變。
// 測試資料全是合成的，不含任何真實歌詞。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fromTranscription} from './score-bridge.js';
import {wordBlob, layout} from './word-export.js';

const GOLDEN = new URL('./golden-docx.json', import.meta.url);
const lyricsFor = (s, verses = 1, extra = '') => {
  const {count} = layout(s);
  return Array.from({length: verses}, (_, v) => `${v + 1}、\n` + Array.from({length: count}, (_, i) => '甲乙丙丁戊己庚辛壬癸'[(i + v) % 10]).join('') + extra).join('\n\n');
};

function tiedScore() {
  const s = fromTranscription({
    title: '合成測試 & <tie>', target_key: 'G', bpm_estimate: 96, pickup_beats: 1,
    notes: [{q: 0, duration: 4, midi: 67}, {q: 4, duration: 24, midi: 71}, {q: 28, duration: 4, midi: null}, {q: 32, duration: 8, midi: 62},
      {q: 40, duration: 4, midi: 64}, {q: 44, duration: 4, midi: 66}, {q: 48, duration: 16, midi: 67}, {q: 64, duration: 2, midi: 55}, {q: 66, duration: 2, midi: 79}],
    chords: [{q: 0, text: 'G'}, {q: 20, text: 'Em7'}, {q: 36, text: 'C/E'}, {q: 52, text: 'D7'}]
  });
  s.lyrics = lyricsFor(s, 2);
  return s;
}
function longScore() {
  const notes = [];
  for (let i = 0; i < 120; i++) notes.push({q: i * 4, duration: 4, midi: 60 + [0, 2, 4, 5, 7, 9, 11][i % 7]});
  const s = fromTranscription({title: '長譜', target_key: 'C', bpm_estimate: 100, pickup_beats: 0, notes, chords: [{q: 0, text: 'C'}, {q: 64, text: 'F'}, {q: 128, text: 'G7'}]});
  s.lyrics = lyricsFor(s, 3);
  return s;
}
function exampleScore() {
  const s = JSON.parse(fs.readFileSync(new URL('./example.json', import.meta.url), 'utf8'));
  s.lyrics = lyricsFor(s, 1);
  return s;
}
function wordingScore() {
  const s = fromTranscription({title: '預備裡面', target_key: 'Bb', bpm_estimate: 80, pickup_beats: 0,
    notes: Array.from({length: 12}, (_, i) => ({q: i * 4, duration: 4, midi: 58 + (i % 5)})), chords: [{q: 0, text: 'Bb'}, {q: 24, text: 'F7'}]});
  s.lyrics = '一、\n因著吃裡面預備好了什麼嗎？\n\n二、\n他做才能教會衆啟示足夠的';
  return s;
}
function referenceScore() {
  const s = fromTranscription({title: '參考資料', target_key: 'C', bpm_estimate: 90, pickup_beats: 0,
    notes: [{q: 0, duration: 8, midi: 60}, {q: 8, duration: 8, midi: 62}, {q: 16, duration: 8, midi: 64}, {q: 24, duration: 8, midi: 65}], chords: [{q: 0, text: 'C'}, {q: 16, text: 'G'}]});
  s.lyrics = '一、\n預備好教';
  s.notationLayout = {fingerprint: JSON.stringify([s.sections, s.key, s.lyrics]),
    systems: [{raw: '1/2/', note_q: [0, 8], lyrics: [{syllables: ['預', '備']}]}, {raw: '3/4/', note_q: [16, 24], lyrics: [{syllables: ['好', '教']}]}]};
  return s;
}

const SCENARIOS = {
  'tied lsm': () => [tiedScore(), {}],
  'tied classic': () => [tiedScore(), {preset: 'classic'}],
  'tied lsm a4 chinese marks tempo': () => [tiedScore(), {paper: 'a4', verseMarks: 'chinese', tempo: true}],
  'tied lsm copyright': () => [tiedScore(), {copyright: '© 測試 <&>'}],
  'long lsm': () => [longScore(), {}],
  'long classic': () => [longScore(), {preset: 'classic'}],
  'example lsm': () => [exampleScore(), {}],
  'example classic': () => [exampleScore(), {preset: 'classic'}],
  'wording lsm (auto replace on)': () => [wordingScore(), {}],
  'wording lsm (auto replace off)': () => [wordingScore(), {wording: false}],
  'wording classic (default off)': () => [wordingScore(), {preset: 'classic'}],
  'wording classic (on)': () => [wordingScore(), {preset: 'classic', wording: true}],
  'reference lsm': () => [referenceScore(), {}],
  'reference classic': () => [referenceScore(), {preset: 'classic'}],
  'no lyrics lsm': () => { const s = tiedScore(); s.lyrics = ''; return [s, {}]; },
  'no lyrics classic': () => { const s = tiedScore(); s.lyrics = ''; return [s, {preset: 'classic'}]; }
};

async function hashAll() {
  const out = {};
  for (const [name, make] of Object.entries(SCENARIOS)) {
    const [score, options] = make();
    const bytes = Buffer.from(await wordBlob(score, options).arrayBuffer());
    out[name] = crypto.createHash('sha256').update(bytes).digest('hex');
  }
  return out;
}

test('DOCX 輸出位元組與 golden 完全相同（重構不得改變輸出）', async () => {
  const actual = await hashAll();
  if (process.env.UPDATE_GOLDEN === '1') { fs.writeFileSync(GOLDEN, JSON.stringify(actual, null, 2) + '\n'); return; }
  const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  assert.deepEqual(Object.keys(actual), Object.keys(golden), '情境清單與 golden 不一致；刻意變更請用 UPDATE_GOLDEN=1 更新');
  for (const name of Object.keys(golden)) assert.equal(actual[name], golden[name], `「${name}」的輸出位元組改變了`);
});

// A4 改版前的 Letter 位元組；固定舊值，不隨 UPDATE_GOLDEN 更新。
const OLD_LETTER = {
  'tied lsm': 'ae50d91ee1697ae3e1f8166a0c0f0b488ae771294691d6514f678904e8c19b9d',
  'tied lsm copyright': 'ccdd95a00d95b10bbd0d4abf4166d5bae7829296449728f75d148e38030c9179',
  'long lsm': '5c2396473f8ada0fa4445d8844ecdd60b494a23e34f9b3281fc398fe5fcd2cf4',
  'example lsm': 'fcca5d54499ee19803b9e116fc26fb47638b69f42435b51ee3b7cdeb3a03a919',
  'wording lsm (auto replace on)': '6c168c90bf758af4eb2d3d6e6d79510fbff676c46ec22a7967e88aad7a95665a',
  'wording lsm (auto replace off)': 'b2c4222077cfaa7d45d8e24c4cb0ec73e34ba72ff4f219f05f9057342a5716a3',
  'reference lsm': 'dc78663679307f4948ebed2b0800a03d307c6b10eaee4e6d2facc4087c9d8ae2',
  'no lyrics lsm': '34d5da6efcee056846df947c062864dbc94dcb47d4b0d7eb6eb330a46ac67058'
};

test('lsm 指定 Letter 的八種情境保持改版前輸出', async () => {
  for (const [name, expected] of Object.entries(OLD_LETTER)) {
    const [score, options] = SCENARIOS[name]();
    const bytes = Buffer.from(await wordBlob(score, {...options, paper: 'letter'}).arrayBuffer());
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expected, name);
  }
});
