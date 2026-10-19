// score-edit.js（從 app.js 抽出的純函式）的特徵測試：期望值取自拆檔前的行為（UI 快照比對相同）。
import test from 'node:test';
import assert from 'node:assert/strict';
import {transposeScore, buildForm} from './score-edit.js';

test('transposeScore：C→G 取最短距離（下行 5 半音），音符、和弦名稱與和弦音高一起移動', () => {
  const s = {
    key: 'C',
    sections: {
      verse: [{chord: 'C', chordChanges: [{beat: 0, text: 'C'}, {beat: 2, text: 'G7'}], notes: [[60, 2], [null, 1], [67, 1]]}],
      chorus: [{chord: 'Am', notes: [[69, 4]]}]
    },
    chords: {C: {bass: 48, tones: [52, 55, 60]}, G7: {bass: 43, tones: [53, 59, 62]}, Am: {bass: 45, tones: [52, 57, 60]}}
  };
  transposeScore(s, 'G');
  assert.equal(s.key, 'G');
  assert.deepEqual(s.sections.verse[0].notes, [[55, 2], [null, 1], [62, 1]], '休止符（null）不移動');
  assert.deepEqual(s.sections.verse[0].chordChanges.map(c => c.text), ['G', 'D7']);
  assert.equal(s.sections.verse[0].chord, 'G');
  assert.equal(s.sections.chorus[0].chord, 'Em');
  assert.deepEqual(s.chords.G, {bass: 43, tones: [47, 50, 55]});
  assert.deepEqual(Object.keys(s.chords).sort(), ['D7', 'Em', 'G']);
});

test('transposeScore：沒有 chords 欄位也不會出錯；升記號和弦名稱改為對應的調內寫法', () => {
  const t = {key: 'C', sections: {v: [{chord: 'F#', notes: [[60, 4]]}]}};
  transposeScore(t, 'F');
  assert.deepEqual(t.sections.v[0].notes, [[65, 4]]);
  assert.equal(t.sections.v[0].chord, 'B');
  assert.deepEqual(t.chords, {});
});

test('buildForm：遍數與強度規則（首遍 0.85、第三遍 0.8、其餘 1；副歌或偶數遍加弦樂；長笛自第二遍起）', () => {
  const form = buildForm({verse: [], chorus: []}, 3, false);
  assert.deepEqual(form.map(f => [f.section, f.intensity, f.strings, f.flute]), [
    ['verse', 0.85, false, false], ['chorus', 0.85, true, true],
    ['verse', 1, true, true], ['chorus', 1, true, true],
    ['verse', 0.8, false, true], ['chorus', 0.8, true, true]
  ]);
});

test('buildForm：最後再奏一次副歌；沒有 chorus 時重複最後一段；不修改傳入的 sections', () => {
  const sections = {verse: [], bridge: []};
  const form = buildForm(sections, 1, true);
  assert.deepEqual(form.at(-1), {section: 'bridge', intensity: 1.1, strings: true, flute: true});
  assert.deepEqual(buildForm({verse: [], chorus: []}, 1, true).at(-1).section, 'chorus');
  assert.deepEqual(Object.keys(sections), ['verse', 'bridge']);
});
