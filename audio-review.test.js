import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLoop} from './audio-review.js';

test('循環區間必須在錄音內且至少半秒', () => {
  assert.deepEqual(validateLoop('1.5', '4', 10), {start: 1.5, end: 4});
  for (const [a, b, d] of [['', 4, 10], [0, '', 10], [-1, 4, 10], [4, 3, 10],
    [0, 11, 10], [0, 0.1, 10], [0, 4, NaN], ['x', 4, 10]]) {
    assert.throws(() => validateLoop(a, b, d));
  }
});

import {connectAudioReview} from './audio-review.js';
function setup() {
  const controls = new Map();
  const panel = {querySelector: id => {
    if (!controls.has(id)) controls.set(id, {value: '1', textContent: '', setAttribute() {}});
    return controls.get(id);
  }};
  panel.style = {};
  const previous = globalThis.document;
  globalThis.document = {createElement: () => panel};
  const player = new EventTarget();
  Object.assign(player, {duration: 1.999, currentTime: 1.999, paused: true, after() {},
    play: () => Promise.resolve(), pause() { this.paused = true; }});
  try { connectAudioReview(player); } finally { globalThis.document = previous; }
  player.dispatchEvent(new Event('loadedmetadata'));
  return {player, panel, el: id => panel.querySelector('#' + id)};
}
test('標記錄音結尾不超出實際長度', () => {
  const {player, el} = setup();
  el('reviewMarkEnd').onclick();
  assert.ok(Number(el('reviewEnd').value) <= player.duration);
});
test('清空來源會隱藏並重設校對面板', () => {
  const {player, panel} = setup();
  assert.equal(panel.hidden, false);
  player.dispatchEvent(new Event('emptied'));
  assert.equal(panel.hidden, true);
});
test('停止後舊播放請求失敗不覆蓋狀態', async () => {
  const {player, el} = setup();
  let reject;
  player.play = () => new Promise((_, r) => { reject = r; });
  const pending = el('reviewLoop').onclick();
  await el('reviewLoop').onclick();
  const status = el('reviewStatus').textContent;
  reject(new DOMException('interrupted', 'AbortError'));
  await pending;
  assert.equal(el('reviewStatus').textContent, status);
});
