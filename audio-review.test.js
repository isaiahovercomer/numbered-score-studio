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
