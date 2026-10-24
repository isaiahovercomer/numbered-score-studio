import test from 'node:test';
import assert from 'node:assert/strict';
import * as audio from './audio-analysis.js';
import * as music from './music.js';
import {fromTranscription} from './score-bridge.js';

const score = (bars, meter = [4, 4], count = 1) => ({
  key: 'C', bpm: 200, meter,
  sections: {verse: Array.from({length: bars}, () => ({
    notes: Array.from({length: count}, () => [60, meter[0] / count])
  }))},
  form: [{section: 'verse'}]
});
const transcription = (count, duration = 4, midi = 60) => ({
  bpm_estimate: 200,
  notes: Array.from({length: count}, (_, i) => ({q: i * duration, duration, midi}))
});

test('U1：錄音與樂譜上限集中定義', () => {
  assert.deepEqual(audio.AUDIO_LIMITS, {seconds: 600, bytes: 125829120});
  assert.deepEqual(music.SCORE_LIMITS, {seconds: 780, bars: 1024, notes: 12000, sectionBars: 1024});
});
test('U2：檔案大小包含邊界並提供剪短提示', () => {
  assert.equal(audio.audioLimitError({bytes: 125829120}), '');
  assert.equal(audio.audioLimitError({bytes: 125829121}), '檔案超過 120 MB，請剪短錄音，或改用 MP3／M4A。');
});
test('U3：錄音秒數包含邊界並顯示目前長度', () => {
  assert.equal(audio.audioLimitError({seconds: 600}), '');
  assert.equal(audio.audioLimitError({seconds: 600.01}),
    '錄音超過 10 分鐘（目前 10 分 1 秒），請剪短錄音後再試。');
});
test('U4：回歸：200 BPM、150 小節的錄音可轉譜', () => {
  const s = fromTranscription(transcription(600));
  assert.equal(music.validateScore(s).bars, 150);
});
test('U5：完整 600 秒合成八分音符錄音可分析並轉譜', () => {
  const sr = 8000, samples = new Float32Array(600 * sr);
  for (let i = 0; i < samples.length; i++) {
    const t = i / sr, local = t % .15, m = 60 + (Math.floor(t / .15) % 5) * 2;
    samples[i] = .4 * Math.sin(2 * Math.PI * 440 * 2 ** ((m - 69) / 12) * local) * Math.exp(-local * 25);
  }
  const result = audio.analyzeMelody(samples, sr, {bpm: 200});
  const stats = music.validateScore(fromTranscription(result));
  assert.ok(stats.bars > 128 && stats.bars <= 501);
});
test('U6：旋律與和弦分析都拒絕 601 秒', () => {
  const samples = new Float32Array(601 * 8000);
  for (const analyze of [audio.analyzeMelody, audio.estimateChords]) {
    assert.throws(() => analyze(samples, 8000), /10 分鐘.*請剪短錄音/);
  }
});
test('U7：200 BPM、650 小節可輸出，651 小節超過秒數上限', () => {
  assert.equal(music.validateScore(score(650)).seconds, 782);
  assert.throws(() => music.validateScore(score(651)), /單次輸出上限/);
});
test('U8：總小節與音符數包含邊界', () => {
  assert.equal(music.validateScore(score(1024, [2, 4])).bars, 1024);
  const s = score(512, [2, 4]);
  s.form.push({section: 'verse'});
  assert.equal(music.validateScore(s).bars, 1024);
  s.sections.extra = [{notes: [[60, 2]]}];
  s.form.push({section: 'extra'});
  assert.throws(() => music.validateScore(s), /單次輸出上限/);
  const dense = score(600, [4, 4], 20);
  assert.equal(music.validateScore(dense).notes, 12000);
  dense.sections.verse[0].notes.splice(0, 1, [60, .1], [60, .1]);
  assert.throws(() => music.validateScore(dense), /單次輸出上限/);
});
test('U9：單段允許 1024 小節但拒絕 1025 小節', () => {
  assert.equal(music.validateScore(score(1024, [2, 4])).bars, 1024);
  assert.throws(() => music.validateScore(score(1025, [2, 4])), /樂譜段落格式不正確/);
});
test('U10：12000 筆通過筆數檢查但超過總長，12001 筆直接拒絕', () => {
  // 12000 筆最短十六分音符在 200 BPM 需要 900 秒，包含休止符亦同。
  // 暫以可明確區分的錯誤驗證筆數檢查接受邊界，並拒絕下一筆。
  assert.throws(() => fromTranscription(transcription(12000, 1, null)), /單次輸出上限/);
  assert.throws(() => fromTranscription(transcription(12001, 1, null)), /缺少有效的音符資料/);
});
test('U11：兩秒靜音仍明確報錯（Worker 另由既有測試覆蓋）', () => {
  assert.throws(() => audio.analyzeMelody(new Float32Array(16000), 8000), /穩定單音/);
});
