// 歌詞「內文整句」排法（lyricLayout:'inline'）測試：標楷體 14 pt、每節一行、以定位點對準音符。歌詞一律為自擬示意文字。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {wordBlob, resolveOptions, layout} from './word-export.js';
import {lyricParagraph} from './word-docx.js';
import {readZip} from './test-helpers.js';

const ex = () => JSON.parse(fs.readFileSync(new URL('./example.json', import.meta.url), 'utf8'));
const syl = '甲乙丙丁戊己庚辛壬癸';
const lyr = (n, v) =>
  Array.from(
    {length: v},
    (_, k) => `${k + 1}、\n` + Array.from({length: n}, (_, i) => syl[(i + k) % 10]).join('')
  ).join('\n\n');
const exL = (v = 2) => ({...ex(), lyrics: lyr(76, v)});
const edge = () => ({
  title: 't',
  key: 'G',
  bpm: 90,
  meter: [4, 4],
  chords: {},
  warnings: [],
  sections: {
    verse: [
      {
        notes: [
          [null, 1],
          [67, 1],
          [69, 2]
        ]
      },
      {
        notes: [
          [69, 2],
          [71, 1],
          [72, 1]
        ],
        tieFrom: [0]
      }
    ]
  },
  form: [{section: 'verse'}],
  lyrics: '一、\n甲乙ab\n\n二、\n「丙」丁1天'
});
const bytes = async (s, o) => new Uint8Array(await wordBlob(s, o).arrayBuffer());
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const docXml = async (s, o) => readZip(await bytes(s, o))['word/document.xml'];
// 主體段落（不含文字方塊內的段落）：以深度計數切出 body 第一層的 <w:p>。
const topParas = xml => {
  const body = xml.match(/<w:body>(.*)<w:sectPr>/s)[1],
    out = [];
  let depth = 0,
    start = 0;
  for (const m of body.matchAll(/<w:p>|<w:p |<\/w:p>/g)) {
    if (m[0] !== '</w:p>') {
      if (depth++ === 0) start = m.index;
    } else if (--depth === 0) out.push(body.slice(start, m.index + 6));
  }
  return out;
};
const isLyric = p => p.startsWith('<w:p><w:pPr><w:keepNext/><w:tabs>') || /^<w:p><w:pPr><w:tabs>.*autoSpaceDE/.test(p);
const tabsOf = p => [...p.match(/<w:tabs>(.*?)<\/w:tabs>/)[1].matchAll(/w:pos="(\d+)"/g)].map(m => +m[1]);
const textsOf = p => [...p.matchAll(/<w:t xml:space="preserve">(.*?)<\/w:t>/g)].map(m => m[1]);
const lineSum = p =>
  [...p.matchAll(/w:line="(\d+)"/g)].slice(0, 1).reduce((a, m) => a + +m[1], 0) +
  +(p.match(/<w:pPr>.*?w:after="(\d+)"/)?.[1] ?? 0);
// 附錄 A（00-順序與相依.md）在 main 2bfb49d 的雜湊：boxes 與純譜必須逐位元不變。
const HASH = {
  'lsm:lyrics2': '78a1613d943f0d0ed5a88fd505b3b3317f9c4746f5271d2c164ee8567f1293d6',
  'classic:lyrics2': '3b8c59c2687362e3adba1d68ebeff17a8cc7006607b543e27407d8b290910871',
  'lsm:plain': '07237078e6e818a6a224a71de3dcdf024f074be07ca4b0bace629064728ed635',
  'classic:plain': 'bea1d5a58fb94f66508655691118ac54a6f169616d9299685be3101e35ac1c14'
};

test('T1 選項：inline 時歌詞改標楷體 14 pt，標題字型不變', () => {
  const l = resolveOptions({lyricLayout: 'inline'}),
    c = resolveOptions({preset: 'classic', lyricLayout: 'inline'});
  for (const r of [l, c]) {
    assert.equal(r.lyricFont, '標楷體');
    assert.equal(r.lyricPt, 14);
    assert.equal(r.lyricLine, 20);
  }
  assert.equal(l.lyricAscii, 'Times New Roman');
  assert.equal(c.lyricAscii, '標楷體');
  assert.equal(l.textFont, '新細明體');
  assert.equal(c.textFont, '標楷體');
});

test('T2 不合法的歌詞排法', () => {
  assert.throws(() => resolveOptions({lyricLayout: 'x'}), {message: '歌詞排法只支援逐字方塊或內文整句。'});
});

test('T3 boxes 與 main 逐位元相同', async () => {
  assert.equal(sha(await bytes(exL(), {lyricLayout: 'boxes'})), HASH['lsm:lyrics2']);
  assert.equal(sha(await bytes(exL(), {preset: 'classic', lyricLayout: 'boxes'})), HASH['classic:lyrics2']);
});

test('T4 純譜（無歌詞）在 inline 下逐位元不變', async () => {
  assert.equal(sha(await bytes(ex(), {lyricLayout: 'inline'})), HASH['lsm:plain']);
  assert.equal(sha(await bytes(ex(), {preset: 'classic', lyricLayout: 'inline'})), HASH['classic:plain']);
});

test('T5 定位點（lsm）', async () => {
  assert.equal(layout(edge(), {lyricLayout: 'inline'}).offset, 195.5);
  const lp = topParas(await docXml(edge(), {lyricLayout: 'inline'})).filter(isLyric);
  assert.deepEqual(tabsOf(lp[0]), [3970, 4290, 5230, 6690, 7070]);
  assert.deepEqual(textsOf(lp[0]), ['①', '甲', '乙', 'a', 'b']);
  assert.deepEqual(tabsOf(lp[1]), [3970, 4290, 5230, 6690, 7070]);
  assert.deepEqual(textsOf(lp[1]), ['②', '「丙」', '丁', '1', '天']);
});

test('T6 定位點（classic）', async () => {
  const o = {preset: 'classic', lyricLayout: 'inline'};
  assert.ok(Math.abs(layout(edge(), o).offset - 191.3) < 0.01);
  const lp = topParas(await docXml(edge(), o)).filter(isLyric);
  assert.deepEqual(tabsOf(lp[0]), [3566, 4206, 5146, 6606, 6986]);
  assert.deepEqual(textsOf(lp[0]), ['一、', '甲', '乙', 'a', 'b']);
});

test('T7 段落結構：每列譜行段落＋兩個歌詞段落', async () => {
  const ps = topParas(await docXml(exL(), {lyricLayout: 'inline'})).slice(2); // 去掉標題與調號列
  assert.equal(ps.length, 18);
  for (let r = 0; r < 6; r++) {
    const [score, v1, v2] = ps.slice(r * 3, r * 3 + 3);
    assert.match(score, /^<w:p><w:pPr><w:keepNext\/><w:spacing [^>]*w:line="760" w:lineRule="exact"/);
    assert.match(v1, /^<w:p><w:pPr><w:keepNext\/><w:tabs>/);
    assert.match(v1, /w:after="0" w:line="400"/);
    assert.doesNotMatch(v2, /<w:keepNext\/>/);
    assert.match(v2, /w:after="100" w:line="400"/);
    for (const v of [v1, v2]) assert.doesNotMatch(v, /wp:anchor/);
  }
});

test('T8 歌詞段落 pPr 子元素依 OOXML 順序', async () => {
  const lp = topParas(await docXml(exL(), {lyricLayout: 'inline'})).filter(isLyric);
  for (const p of lp) {
    const pPr = p.match(/<w:pPr>(.*?)<\/w:pPr>/)[1].replace(/<w:tabs>.*?<\/w:tabs>/, '<w:tabs/>');
    const names = [...pPr.matchAll(/<w:(\w+)/g)].map(m => m[1]);
    const want = ['keepNext', 'tabs', 'autoSpaceDE', 'autoSpaceDN', 'snapToGrid', 'spacing', 'ind', 'jc'];
    assert.deepEqual(names, p.includes('<w:keepNext/>') ? want : want.slice(1));
  }
});

test('T9 歌詞字型：標楷體 14 pt；英數 lsm 為 Times New Roman、classic 為標楷體', async () => {
  for (const [o, ascii] of [
    [{lyricLayout: 'inline'}, 'Times New Roman'],
    [{preset: 'classic', lyricLayout: 'inline'}, '標楷體']
  ]) {
    const lp = topParas(await docXml(exL(), o)).filter(isLyric);
    for (const p of lp)
      for (const m of p.matchAll(/<w:rFonts ([^>]*)\/><w:color w:val="000000"\/><w:sz w:val="(\d+)"/g)) {
        assert.match(m[1], new RegExp(`w:ascii="${ascii}"`));
        assert.match(m[1], /w:eastAsia="標楷體"/);
        assert.equal(m[2], '28');
      }
  }
});

test('T10 每個字到下一個定位點至少留 5 pt（不會跳格）', async () => {
  for (const o of [{lyricLayout: 'inline'}, {preset: 'classic', lyricLayout: 'inline'}])
    for (const p of topParas(await docXml(exL(), o)).filter(isLyric)) {
      const pos = tabsOf(p).map(t => t / 20),
        texts = textsOf(p);
      // 第一列的節次標記（①／一、）寬度另由 16／32 pt 的間距保證，不在此檢查。
      for (let k = /^(①|②|一、|二、)$/.test(texts[0]) ? 1 : 0; k + 1 < pos.length; k++)
        assert.ok(pos[k + 1] - pos[k] >= [...texts[k]].length * 14 + 5 - 0.05, `${texts[k]} @${pos[k]}`);
    }
});

test('T11 形狀數：inline 移除歌詞與節次方塊', async () => {
  const count = xml => (xml.match(/<wps:wsp>/g) || []).length;
  for (const preset of ['lsm', 'classic']) {
    assert.equal(count(await docXml(exL(), {preset, lyricLayout: 'boxes'})), 302);
    assert.equal(count(await docXml(exL(), {preset, lyricLayout: 'inline'})), 148);
  }
});

test('T12 和弦、音符、連結線、版權行、sectPr 在兩種排法逐字相同', async () => {
  const shapes = xml =>
    [...xml.matchAll(/<w:drawing>.*?<\/w:drawing>/gs)]
      .map(m =>
        m[0]
          .replace(/ id="\d+"/g, ' id="0"')
          .replace(/ name="[^"]*"/g, ' name=""')
          .replace(/ relativeHeight="\d+"/g, ' relativeHeight="0"')
      )
      // 去掉 boxes 的歌詞與節次方塊（段落定位、歌詞字型）；版權行以頁面定位，保留比對。
      .filter(d => !(/relativeFrom="paragraph"/.test(d) && /w:eastAsia="(新細明體|標楷體)"/.test(d)));
  for (const extra of [{}, {copyright: '© 2026 Test'}, {paper: 'a4'}, {preset: 'classic'}]) {
    const a = await docXml(exL(), {...extra, lyricLayout: 'boxes'}),
      b = await docXml(exL(), {...extra, lyricLayout: 'inline'});
    assert.deepEqual(shapes(b), shapes(a));
    assert.equal(b.match(/<w:sectPr>.*<\/w:sectPr>/s)[0], a.match(/<w:sectPr>.*<\/w:sectPr>/s)[0]);
  }
});

test('T13 系統間距：lsm 63／83、classic 73／93 pt', async () => {
  for (const [preset, one, two] of [
    ['lsm', 63, 83],
    ['classic', 73, 93]
  ])
    for (const [v, want] of [
      [1, one],
      [2, two]
    ]) {
      const ps = topParas(await docXml(exL(v), {preset, lyricLayout: 'inline'})).slice(2, 2 + 1 + v);
      assert.equal(ps.reduce((a, p) => a + lineSum(p), 0) / 20, want, `${preset} ${v} 節`);
    }
});

test('T14 一行超過 64 個定位點時明確報錯', () => {
  const items = Array.from({length: 65}, (_, i) => ({pos: i * 8, text: '甲'}));
  const o = {font: '標楷體', size: 14, ascii: '標楷體', line: 20};
  assert.throws(() => lyricParagraph(items, o), {
    message: '一行歌詞超過 64 個定位點，Word 無法開啟；請把版面改窄或分行。'
  });
  assert.doesNotThrow(() => lyricParagraph(items.slice(0, 64), o));
});

test('T15 首音休止：節次標記在第一個有字的音左側', async () => {
  const l = topParas(await docXml(edge(), {lyricLayout: 'inline'})).filter(isLyric)[0];
  const c = topParas(await docXml(edge(), {preset: 'classic', lyricLayout: 'inline'})).filter(isLyric)[0];
  assert.equal(tabsOf(l)[0], 3970);
  assert.equal(tabsOf(l)[1] - tabsOf(l)[0], 320);
  assert.equal(tabsOf(c)[0], 3566);
  assert.equal(tabsOf(c)[1] - tabsOf(c)[0], 640);
});

test('T16 官方用字替換後定位點不變', async () => {
  const s = {...edge(), lyrics: '什麼甲乙'};
  const on = topParas(await docXml(s, {lyricLayout: 'inline', wording: true})).filter(isLyric)[0];
  const off = topParas(await docXml(s, {lyricLayout: 'inline', wording: false})).filter(isLyric)[0];
  assert.deepEqual(textsOf(on).slice(1), ['甚', '麼', '甲', '乙']);
  assert.deepEqual(tabsOf(on), tabsOf(off));
});

test('T17 控制字元不進 XML', async () => {
  const xml = await docXml({...edge(), lyrics: '甲乙\u000Bab'}, {lyricLayout: 'inline'});
  assert.doesNotMatch(xml, /\u000B/);
  assert.deepEqual(textsOf(topParas(xml).filter(isLyric)[0]), ['①', '甲', '乙', 'a', 'b']);
});

test('T18 技能 JSON 原稿版面（notationLayout）也用內文歌詞', async () => {
  const s = {
    ...edge(),
    lyrics: '甲乙',
    sections: {
      verse: [
        {
          notes: [
            [60, 2],
            [62, 2]
          ]
        }
      ]
    }
  };
  s.notationLayout = {
    fingerprint: JSON.stringify([s.sections, s.key, s.lyrics]),
    systems: [{raw: '1/2/', note_q: [0, 8], lyrics: [{syllables: ['甲', '乙']}]}]
  };
  const ps = topParas(await docXml(s, {lyricLayout: 'inline'})).slice(2);
  assert.equal(ps.length, 2);
  assert.match(ps[0], /^<w:p><w:pPr><w:keepNext\/><w:spacing [^>]*w:line="800"/);
  assert.match(ps[0], /01SMN/);
  const tabs = tabsOf(ps[1]);
  assert.deepEqual(textsOf(ps[1]), ['①', '甲', '乙']);
  assert.equal(tabs[0], tabs[1] - 320);
  assert.ok(tabs[2] > tabs[1]);
  assert.doesNotMatch(ps[1], /wp:anchor/);
});

test('T19 字數不符的錯誤與 boxes 相同', () => {
  const s = {...edge(), lyrics: '甲乙a'};
  const msg = o => {
    try {
      wordBlob(s, o);
    } catch (e) {
      return e.message;
    }
  };
  assert.match(msg({lyricLayout: 'inline'}), /^歌詞需逐字對位/);
  assert.equal(msg({lyricLayout: 'inline'}), msg({lyricLayout: 'boxes'}));
});

test('T20 預設排法為 inline（依 Isaiah 2026-10-19 指示）；可用 boxes 改回逐字方塊', async () => {
  for (const preset of ['lsm', 'classic']) {
    assert.equal(resolveOptions({preset}).lyricLayout, 'inline');
    const xml = await docXml(exL(), {preset});
    assert.ok(topParas(xml).filter(isLyric).length > 0, `${preset} 預設應產生內文歌詞段落`);
    assert.equal(xml, await docXml(exL(), {preset, lyricLayout: 'inline'}));
  }
});
