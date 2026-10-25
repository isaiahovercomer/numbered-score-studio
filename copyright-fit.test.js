// 版權行自動縮字：只用合成文字，短文字鎖定改動前的 XML 位元組。
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as docx from './word-docx.js';
import {wordBlob} from './word-export.js';
import {fromTranscription} from './score-bridge.js';
import {readZip} from './test-helpers.js';
import {resolveOptions} from './word-options.js';

const score = fromTranscription({
  title: '合成版權測試',
  target_key: 'C',
  bpm_estimate: 88,
  notes: [{q: 0, duration: 4, midi: 60}],
  chords: []
});

const short = ['© 2026 Living Stream Ministry', '© 測試 <&>', '$& <>&\'"'];
const hashes = {
  lsm: [
    '351aab9f83f6cd7d2a277816bd5c03794a6b2bfa0bb96723cbc13d1eaeb225b5',
    'd6a748360ecb051802405e72b0947476a1bab445e8372ceb2fc100cd46d3535e',
    'de207654621bb15223454a3c52e856e7c263af82a73f91790e14000dd1a7a531'
  ],
  classic: [
    '33d16493698bb8332f24b1b95c7b26f0e3ead3a6b3f3586f7c340e37cfa687e5',
    'f94cb922a2cda0c0bed8438940f2d5b1976335d6b00829b3c0cf2e4c73be5ede',
    '737af78d3b69c3df71676c454b27440307eecba40b3b54c215a771d325d4ff3c'
  ]
};
for (const preset of ['lsm', 'classic']) {
  test(`R1／R7 ${preset} 短版權與特殊字元位元組不變`, () => {
    short.forEach((text, i) => {
      docx.resetShapeIds();
      const xml = docx.copyrightAnchor(text, resolveOptions({preset, paper: preset === 'lsm' ? 'letter' : 'a4'}));
      assert.equal(createHash('sha256').update(xml).digest('hex'), hashes[preset][i]);
    });
  });
  for (const paper of ['letter', 'a4']) {
    const o = resolveOptions({preset, paper});
    for (const [name, text] of [
      ['R2', '甲'.repeat(45)],
      ['R3', '乙'.repeat(70)],
      ['R4', '丙'.repeat(120)],
      ['R5', 'Copyright 2026 synthetic testing '.repeat(4).slice(0, 120)]
    ]) {
      test(`${name}／R6 ${preset} ${paper} 長版權的字級、尺寸與定位`, async () => {
        const bytes = new Uint8Array(await wordBlob(score, {preset, paper, copyright: text}).arrayBuffer());
        const document = readZip(bytes)['word/document.xml'];
        const xml = [...document.matchAll(/<wp:anchor[^]*?<\/wp:anchor>/g)]
          .map(m => m[0])
          .find(anchor => anchor.includes('name="Copyright'));
        assert.ok(xml, 'DOCX 應含版權錨點');
        // 先從實際 XML 驗證缺少的行為，確保修改前不是只因 API 尚未存在而失敗。
        assert.ok(xml.includes(`<wp:extent cx="${Math.round(o.usable * 12700)}"`));
        const fit = docx.copyrightFit(text, o);
        assert.equal(fit.w, o.usable);
        assert.ok(fit.pt >= 7 && fit.pt <= 10 && Number.isInteger(fit.pt * 2));
        assert.equal(fit.h, Math.ceil(fit.pt * 1.4));
        if (name === 'R2') assert.equal(fit.pt, 10);
        if (name === 'R3') assert.ok(fit.pt < 10);
        if (name === 'R4') assert.deepEqual([fit.pt, fit.lines], [7, 2]);
        if (fit.lines === 1) {
          assert.ok(docx.copyrightWidth(text, fit.pt) <= o.usable);
          if (fit.pt < 10) assert.ok(docx.copyrightWidth(text, fit.pt + 0.5) > o.usable);
        } else {
          assert.equal(fit.pt, 7);
          assert.ok(docx.copyrightWidth(text, 7) > o.usable);
          assert.ok(docx.copyrightWidth(text, 7) <= o.usable * 2);
        }
        const y = Math.round((o.pageH - 36.5 - (fit.lines - 1) * fit.h) * 12700);
        assert.ok(xml.includes(`<wp:posOffset>${y}</wp:posOffset>`));
        assert.ok(xml.includes(`cy="${fit.h * fit.lines * 12700}"`));
        assert.ok(xml.includes(`w:line="${fit.h * 20}"`));
        assert.ok(xml.includes(`w:sz w:val="${fit.pt * 2}"`));
        assert.ok(xml.includes(`wrap="${fit.lines === 2 ? 'square' : 'none'}"`));
        assert.ok(xml.includes(text));
      });
    }
  }
}

test('估寬使用 NCS Italic ASCII、全形、漢字、© 與未知字及安全係數', () => {
  assert.equal(docx.copyrightWidth('甲，Ａ😀', 10), 42);
  assert.ok(Math.abs(docx.copyrightWidth('©', 10) - 7.8435) < 1e-9);
  assert.ok(Math.abs(docx.copyrightWidth('Wi', 10) - (0.926 + 0.333) * 10 * 1.05) < 1e-9);
});

test('R7 長版權縮字與分行仍保留 $& 與 XML 特殊字元', () => {
  const text = '甲'.repeat(110) + '$& <>&\'"';
  const xml = docx.copyrightAnchor(text, resolveOptions());
  assert.ok(xml.includes('wrap="square"'));
  assert.ok(xml.includes('甲'.repeat(110) + '$&amp; &lt;&gt;&amp;&apos;&quot;'));
});
