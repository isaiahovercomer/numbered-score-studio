// 一字一音診斷（lyrics-diagnose.js）測試。歌詞一律為自擬示意文字。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {listAttacks, diagnoseLyrics, formatDiagnosis, explainLyricError} from './lyrics-diagnose.js';
import {wordBlob} from './word-export.js';
import {musicXml} from './musicxml.js';

const base = (bars, extra = {}) => ({
  title: 't',
  key: 'G',
  bpm: 90,
  meter: [4, 4],
  lyrics: '',
  chords: {},
  warnings: [],
  sections: {verse: bars},
  form: [{section: 'verse'}],
  ...extra
});
const bars2s = [
  {
    chord: 'G',
    notes: [
      [67, 1],
      [69, 1],
      [71, 2]
    ]
  },
  {
    chord: 'C',
    notes: [
      [72, 1],
      [71, 1],
      [69, 2]
    ]
  }
]; // 2 小節、6 個起音

const T2_LYRICS = '一、\n耶穌愛\n我們啊\n\n二、\n祂愛我\n們啊';
const T2_SHORT = '第 2 節少 1 字：歌詞到第 5 個起音就用完了，從主歌第 2 小節第 3 拍起的 1 個起音沒有字。';
const T4_SCORE = () =>
  base(
    [
      {
        notes: [
          [67, 3],
          [69, 1]
        ]
      },
      {
        notes: [
          [69, 2],
          [71, 2]
        ],
        tieFrom: [0]
      }
    ],
    {lyrics: '甲乙丙丁'}
  );
const T6_SCORE = () =>
  base(bars2s, {
    sections: {verse: bars2s, chorus: [{notes: [[67, 4]]}]},
    form: [{section: 'verse'}, {section: 'chorus'}],
    lyrics: '一、\n甲乙丙丁戊己\n\n二、\n甲乙丙丁戊己庚'
  });
const cycle = (n, syl = '甲乙丙丁戊己庚辛') => Array.from({length: n}, (_, i) => syl[i % syl.length]).join('');

test('T1 兩節都對', () => {
  const r = diagnoseLyrics(base(bars2s, {lyrics: '一、\n耶穌愛我們啊\n\n二、\n祂愛我們也啊'}));
  assert.equal(r.ok, true);
  assert.equal(r.attacks, 6);
  assert.deepEqual(r.verses, [
    {index: 1, count: 6, diff: 0, status: 'ok'},
    {index: 2, count: 6, diff: 0, status: 'ok'}
  ]);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.hints, []);
  assert.equal(formatDiagnosis(r), '');
});

test('T2 第 2 節少 1 字', () => {
  const r = diagnoseLyrics(base(bars2s, {lyrics: T2_LYRICS}));
  assert.equal(r.problems[0].kind, 'short');
  assert.equal(r.problems[0].firstMissing, 5);
  assert.equal(r.problems[0].message, T2_SHORT);
  assert.equal(r.problems[1].kind, 'line');
  assert.equal(r.problems[1].line, 2);
  assert.equal(r.problems[1].message, '第 2 節第 2 行 2 字，第 1 節同一行 3 字（差 -1 字）。');
  assert.deepEqual(r.hints, []);
});

test('T3 第 2 節多 2 字', () => {
  const r = diagnoseLyrics(base(bars2s, {lyrics: '一、\n耶穌愛\n我們啊\n\n二、\n祂愛我\n們也啊啊啊'}));
  assert.equal(r.problems[0].kind, 'long');
  assert.equal(r.problems[0].extraFrom, 6);
  assert.equal(
    r.problems[0].message,
    '第 2 節多 2 字：全曲只有 6 個起音，從第 7 個字「啊」起的 2 個字沒有音可放（最後一個起音在主歌第 2 小節第 3 拍）。'
  );
  assert.equal(r.problems[1].message, '第 2 節第 2 行 5 字，第 1 節同一行 3 字（差 2 字）。');
});

test('T4 延音提示', () => {
  const r = diagnoseLyrics(T4_SCORE());
  assert.equal(r.attacks, 3);
  assert.equal(r.tieContinuations, 1);
  assert.equal(
    r.problems[0].message,
    '第 1 節多 1 字：全曲只有 3 個起音，從第 4 個字「丁」起的 1 個字沒有音可放（最後一個起音在主歌第 2 小節第 3 拍）。'
  );
  assert.equal(r.hints[0], '字數等於「起音 3＋延音連結 1」：延音連結後的音不另配字，是否把延音也配了字？');
});

test('T5 無歌詞', () => {
  const r = diagnoseLyrics(base(bars2s));
  assert.equal(r.ok, true);
  assert.equal(r.hasLyrics, false);
  assert.deepEqual(r.verses, []);
  assert.deepEqual(r.problems, []);
});

test('T6 兩個段落', () => {
  const r = diagnoseLyrics(T6_SCORE());
  assert.equal(r.attacks, 7);
  assert.equal(
    r.problems[0].message,
    '第 1 節少 1 字：歌詞到第 6 個起音就用完了，從副歌第 1 小節第 1 拍（全曲第 3 小節）起的 1 個起音沒有字。'
  );
  assert.equal(r.problems[1].message, '第 1 節第 1 行 6 字，第 2 節同一行 7 字（差 -1 字）。');
});

test('T7 每節同差：以第 1 節為參照、提示樂譜可能有誤', () => {
  const r = diagnoseLyrics(base(bars2s, {lyrics: '一、\n耶穌愛\n我們\n\n二、\n祂愛我\n們啊'}));
  assert.deepEqual(
    r.problems.map(p => [p.kind, p.verse]),
    [
      ['short', 1],
      ['short', 2]
    ]
  );
  assert.equal(r.problems[1].message, T2_SHORT);
  assert.equal(r.problems[0].message, T2_SHORT.replace('第 2 節', '第 1 節'));
  assert.deepEqual(r.hints, [
    '每一節都少 1 字：較可能是樂譜起音數有誤（例如漏標延音連結、多切了音），而不是歌詞打錯。'
  ]);
});

test('T8 只有標點的節', () => {
  const r = diagnoseLyrics(base(bars2s, {lyrics: '一、\n。。。'}));
  assert.deepEqual(r.verses[0], {index: 1, count: 0, diff: -6, status: 'short'});
  assert.equal(r.problems[0].message, '第 1 節沒有可對位的字（只有標點或節標）。');
});

test('T9 全休止', () => {
  const r = diagnoseLyrics(base([{notes: [[null, 4]]}], {lyrics: '甲'}));
  assert.equal(r.attacks, 0);
  assert.equal(r.rests, 1);
  assert.equal(r.problems[0].message, '全曲沒有起音（只有休止），但第 1 節有 1 字。');
});

test('T10 listAttacks 欄位', () => {
  assert.deepEqual(
    listAttacks(base(bars2s)).attacks.map(a => [a.index, a.bar, a.sectionBar, a.beat]),
    [
      [0, 1, 1, 0],
      [1, 1, 1, 1],
      [2, 1, 1, 2],
      [3, 2, 2, 0],
      [4, 2, 2, 1],
      [5, 2, 2, 2]
    ]
  );
});

test('T11 explainLyricError：Word 匯出錯誤原文不變、後接診斷', () => {
  const s = base(bars2s, {lyrics: T2_LYRICS});
  let e;
  try {
    wordBlob(s);
  } catch (err) {
    e = err;
  }
  assert.ok(e);
  assert.equal(
    e.message,
    '歌詞需逐字對位：本譜有 6 個起音，目前各節為 6、5 字。請以空行分節，或先清空歌詞匯出純譜。英語及一字多音請匯入已對位的技能 JSON。'
  );
  assert.equal(explainLyricError(e, s), e.message + ' ' + T2_SHORT);
});

test('T11b explainLyricError：MusicXML 匯出錯誤', () => {
  const s = base(bars2s, {lyrics: T2_LYRICS});
  let e;
  try {
    musicXml(s);
  } catch (err) {
    e = err;
  }
  assert.ok(e);
  const out = explainLyricError(e, s);
  assert.ok(
    out.startsWith('歌詞需逐字對位：本譜有 6 個起音，目前各節為 6、5 字。請以空行分節，或先清空歌詞匯出純譜。')
  );
  assert.ok(out.endsWith(' ' + T2_SHORT));
  assert.equal(out, e.message + ' ' + T2_SHORT);
});

test('T11c explainLyricError：其他錯誤原樣、診斷丟錯回原訊息', () => {
  const s = base(bars2s, {lyrics: T2_LYRICS});
  assert.equal(explainLyricError(new Error('x'), s), 'x');
  assert.equal(explainLyricError(new Error('歌詞需逐字對位：假'), {bad: 1}), '歌詞需逐字對位：假');
});

test('T12 不改輸入', () => {
  for (const s of [base(bars2s, {lyrics: T2_LYRICS}), T4_SCORE(), T6_SCORE()]) {
    const before = structuredClone(s);
    diagnoseLyrics(s);
    listAttacks(s);
    assert.deepEqual(s, before);
  }
});

test('T13 行數不同', () => {
  const r = diagnoseLyrics(base(bars2s, {lyrics: '一、\n耶穌愛\n。\n我們啊\n\n二、\n祂愛我\n們啊'}));
  assert.equal(r.problems[0].message, T2_SHORT);
  assert.equal(r.problems[1].kind, 'lines');
  assert.equal(r.problems[1].message, '第 2 節有 2 行，第 1 節有 3 行，行數不同，請先對齊分行。');
});

test('T14 小數拍', () => {
  const r = diagnoseLyrics(
    base(
      [
        {
          notes: [
            [67, 2.5],
            [69, 1.5]
          ]
        }
      ],
      {lyrics: '甲'}
    )
  );
  assert.equal(
    r.problems[0].message,
    '第 1 節少 1 字：歌詞到第 1 個起音就用完了，從主歌第 1 小節第 3.5 拍起的 1 個起音沒有字。'
  );
});

test('T15 example.json', () => {
  const ex = JSON.parse(fs.readFileSync(new URL('./example.json', import.meta.url), 'utf8'));
  const {attacks} = listAttacks(ex);
  assert.equal(attacks.length, 76);
  const last = attacks.at(-1);
  assert.deepEqual([last.section, last.sectionBar, last.bar, last.beat], ['chorus', 16, 32, 0]);
  assert.equal(diagnoseLyrics({...ex, lyrics: cycle(76)}).ok, true);
  assert.equal(
    diagnoseLyrics({...ex, lyrics: cycle(75)}).problems[0].message,
    '第 1 節少 1 字：歌詞到第 75 個起音就用完了，從副歌第 16 小節第 1 拍（全曲第 32 小節）起的 1 個起音沒有字。'
  );
});

test('T16 效能：384 小節、1536 起音', () => {
  const bars = () =>
    Array.from({length: 128}, () => ({
      notes: [
        [60, 1],
        [62, 1],
        [64, 1],
        [65, 1]
      ]
    }));
  const s = base([], {
    bpm: 200,
    sections: {verse: bars(), chorus: bars(), bridge: bars()},
    form: [{section: 'verse'}, {section: 'chorus'}, {section: 'bridge'}],
    lyrics: '一、\n' + cycle(1535) + '\n\n二、\n' + cycle(1536)
  });
  const t0 = performance.now();
  const r = diagnoseLyrics(s);
  const ms = performance.now() - t0;
  // 目標 < 50 ms；放寬到 200 ms 以免 CI 機器抖動造成誤判。
  assert.ok(ms < 200, `diagnoseLyrics 耗時 ${ms.toFixed(1)} ms`);
  assert.match(r.problems[0].message, /第 128 小節第 4 拍（全曲第 384 小節）/);
});

test('T17 分行不可靠時降級為只報總差', () => {
  const parse = t => (t.includes('\n') ? [[...'甲乙丙丁戊己'], [...'甲乙丙丁']] : [[...t]]);
  const r = diagnoseLyrics(base(bars2s, {lyrics: T2_LYRICS}), {parse});
  assert.deepEqual(
    r.problems.map(p => [p.kind, p.message]),
    [['short', '第 2 節少 2 字：歌詞到第 4 個起音就用完了，從主歌第 2 小節第 2 拍起的 2 個起音沒有字。']]
  );
});

test('T18 formatDiagnosis 截斷', () => {
  const lyrics = Array.from({length: 7}, () => '甲乙丙').join('\n\n');
  const r = diagnoseLyrics(base(bars2s, {lyrics}));
  assert.equal(r.problems.length, 7);
  const lines = formatDiagnosis(r).split('\n');
  assert.equal(lines.length, 7);
  lines.slice(0, 5).forEach((l, i) => assert.ok(l.startsWith(`第 ${i + 1} 節少 3 字：`), l));
  assert.equal(lines[5], '…另有 2 則');
  assert.ok(lines[6].startsWith('每一節都少 3 字：'), lines[6]);
});

test('T19 CRLF 與 LF 結果相同', () => {
  const lf = diagnoseLyrics(base(bars2s, {lyrics: T2_LYRICS}));
  const crlf = diagnoseLyrics(base(bars2s, {lyrics: T2_LYRICS.replace(/\n/g, '\r\n')}));
  assert.deepEqual(crlf, lf);
});

test('T20 不合法樂譜原樣丟出 validateScore 錯誤', () => {
  assert.throws(() => diagnoseLyrics(base([{notes: [[60, 3]]}], {lyrics: '甲'})), {
    message: 'verse 第 1 小節應為 4 拍，目前 3 拍。'
  });
});
