// 鎖定 Word 排版規格。前半（classic）鎖定使用者原有偏好（見 NOTATION_RULES.md）；歌詞英數改 Times New Roman 為刻意變更；
// 後半（lsm）鎖定水流職事站官方標語歌頁規格（recovery-format-guide.md A.10、B26ANCC01zht p.2 實測）。
import test from 'node:test';
import assert from 'node:assert/strict';
import {fromTranscription} from './score-bridge.js';
import {readZip} from './test-helpers.js';
import {wordBlob, layout, verseMark, keyName, wordingHints, resolveOptions, parseVerses} from './word-export.js';
const CLASSIC = {preset: 'classic'};
// 舊版逐字方塊排法（2026-10-19 起預設改為 inline 內文整句）：以下鎖定 boxes 的測試明確指定。
const BOXES = {lyricLayout: 'boxes'};

const data = {
  title: '版面測試',
  target_key: 'C',
  bpm_estimate: 120,
  pickup_beats: 0,
  notes: [
    {q: 0, duration: 8, midi: 60},
    {q: 8, duration: 8, midi: 62}
  ],
  chords: [
    {q: 0, text: 'C7'},
    {q: 8, text: 'Gm7'}
  ]
};
function makeScore() {
  const s = fromTranscription(data);
  s.lyrics = '一、\n甲乙\n\n二、\n丙丁';
  return s;
}
async function docBytes(s, opts) {
  return new Uint8Array(await wordBlob(s, opts).arrayBuffer());
}

// 取得每個文字 run 的字型、字級（pt）、顏色、是否下標與文字。
function runs(xml) {
  return [
    ...xml.matchAll(
      /<w:r><w:rPr><w:rFonts w:ascii="([^"]*)"[^>]*?w:eastAsia="([^"]*)"\/><w:color w:val="([0-9A-F]{6})"\/><w:sz w:val="(\d+)"\/>(<w:vertAlign w:val="subscript"\/>)?<\/w:rPr><w:t xml:space="preserve">([^<]*)<\/w:t><\/w:r>/g
    )
  ].map(m => ({font: m[1], ea: m[2], color: m[3], pt: Number(m[4]) / 2, sub: Boolean(m[5]), text: m[6]}));
}

test('[classic] DOCX 是完整可開啟的 OOXML 封包（CRC 正確、必要部件齊全）', async () => {
  const files = readZip(await docBytes(makeScore(), CLASSIC));
  assert.deepEqual(Object.keys(files).sort(), ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']);
  assert.match(files['_rels/.rels'], /Target="word\/document\.xml"/);
  assert.match(files['[Content_Types].xml'], /wordprocessingml\.document\.main\+xml/);
  assert.match(files['word/document.xml'], /^<\?xml[^>]*\?><w:document /);
});

test('[classic] 頁面為 A4 直式（11906×16838 twips），且不強制橫向', async () => {
  const xml = readZip(await docBytes(makeScore(), CLASSIC))['word/document.xml'];
  assert.match(xml, /<w:pgSz w:w="11906" w:h="16838"\/>/);
  assert.doesNotMatch(xml, /w:orient="landscape"/);
});

test('[classic] 標題標楷體 22pt 置中；簡譜 01SMN 14pt；歌詞標楷體 13.5pt', async () => {
  const xml = readZip(await docBytes(makeScore(), {...CLASSIC, ...BOXES}))['word/document.xml'];
  const all = runs(xml);
  assert.ok(all.length > 0);
  const title = all.find(r => r.text === '版面測試');
  assert.deepEqual([title.font, title.pt], ['標楷體', 22]);
  assert.match(xml, /<w:jc w:val="center"\/>[^]*?版面測試/);
  const score = all.filter(r => r.font === '01SMN');
  assert.ok(score.length > 0);
  assert.ok(score.every(r => r.pt === 14 && r.color === '000000'));
  for (const ch of ['甲', '乙', '丙', '丁']) {
    const r = all.find(x => x.text === ch);
    // 中文字型標楷體；英數字型 Times New Roman（2026-10-25 Isaiah 決定：歌詞英數兩種版式都用 Times New Roman）。
    assert.deepEqual([r.ea, r.font, r.pt], ['標楷體', 'Times New Roman', 13.5], `歌詞「${ch}」字型或字級不符`);
  }
});

test('[classic] 和弦為 Times New Roman 深紅 #9C2323，只有和弦數字使用原生下標', async () => {
  const all = runs(readZip(await docBytes(makeScore(), CLASSIC))['word/document.xml']);
  const chord = all.filter(r => r.ea === 'Times New Roman');
  assert.deepEqual(
    chord.map(r => [r.text, r.sub]),
    [
      ['C', false],
      ['7', true],
      ['Gm', false],
      ['7', true]
    ]
  );
  assert.ok(chord.every(r => r.color === '9C2323' && r.pt === 10));
  // 簡譜音符的數字絕不可下標。
  assert.ok(all.filter(r => r.font === '01SMN').every(r => !r.sub));
  // 和弦以外的文字顏色不可被染成深紅。
  assert.ok(all.filter(r => r.ea !== 'Times New Roman').every(r => r.color === '000000'));
});

test('[classic] 節次「一、二、」只在各節第一個字前出現一次，且歌詞逐字保留', async () => {
  const all = runs(readZip(await docBytes(makeScore(), {...CLASSIC, ...BOXES}))['word/document.xml']);
  const lyricText = all.filter(r => r.ea === '標楷體' && r.pt === 13.5).map(r => r.text);
  assert.equal(lyricText.filter(t => t === '一、').length, 1);
  assert.equal(lyricText.filter(t => t === '二、').length, 1);
  assert.deepEqual(lyricText.filter(t => /\p{Script=Han}/u.test(t) && !t.endsWith('、')).sort(), [
    '丁',
    '丙',
    '乙',
    '甲'
  ]);
});

test('[classic] 排版寬度不超出 A4 可用寬度（538.6 pt），各行共同左緣', () => {
  const {systems, offset} = layout(makeScore(), CLASSIC);
  assert.ok(offset >= 32, '左側需保留節次標籤空間');
  for (const row of systems) {
    const last = row.at(-1);
    assert.ok(offset + last.x + last.width <= 538.6 + 14, '行寬超出頁面');
  }
  assert.equal(systems[0][0].x, 0, '各行應有共同左緣');
});

test('標題含特殊字元時 XML 已跳脫，封包仍可解析', async () => {
  const s = makeScore();
  s.title = 'A&B <"x"> \'y\'';
  const xml = readZip(await docBytes(s, CLASSIC))['word/document.xml'];
  assert.match(xml, /A&amp;B &lt;&quot;x&quot;&gt; &apos;y&apos;/);
  assert.doesNotMatch(xml, /A&B/);
});

// ───────────────────────── lsm（官方標語歌）規格 ─────────────────────────
// 取得每個文字 run 的 ascii／eastAsia 字型、字級、顏色、斜體與文字（含非 rPr 順序固定的情形）。
function runs2(xml) {
  return [
    ...xml.matchAll(
      /<w:r><w:rPr><w:rFonts w:ascii="([^"]*)" w:hAnsi="[^"]*" w:eastAsia="([^"]*)"\/>(<w:i\/>)?<w:color w:val="([0-9A-F]{6})"\/><w:sz w:val="(\d+)"\/>(<w:vertAlign w:val="subscript"\/>)?<\/w:rPr><w:t xml:space="preserve">([^<]*)<\/w:t><\/w:r>/g
    )
  ].map(m => ({
    ascii: m[1],
    ea: m[2],
    italic: Boolean(m[3]),
    color: m[4],
    pt: Number(m[5]) / 2,
    sub: Boolean(m[6]),
    text: m[7]
  }));
}
const lsmXml = async (s = makeScore(), opts) => readZip(await docBytes(s, opts))['word/document.xml'];

test('[lsm] 預設即官方版式：US Letter 612×792、直式、邊界 32.5 pt（左右）、無頁首頁尾與頁碼', async () => {
  const files = readZip(await docBytes(makeScore()));
  const xml = files['word/document.xml'];
  assert.match(xml, /<w:pgSz w:w="12240" w:h="15840"\/>/);
  assert.doesNotMatch(xml, /w:orient="landscape"/);
  assert.match(xml, /w:left="650"/);
  assert.match(xml, /w:right="650"/); // 650 twips = 32.5 pt
  assert.match(xml, /w:header="0" w:footer="0"/);
  assert.deepEqual(
    Object.keys(files).sort(),
    ['[Content_Types].xml', '_rels/.rels', 'word/document.xml'],
    '不應有 header／footer 部件'
  );
  assert.doesNotMatch(xml, /PAGE|w:fldChar|w:fldSimple|headerReference|footerReference/, '官方沒有頁碼');
});

test('[lsm] 可選 A4（paper:"a4"），邊界仍為 32.5 pt', async () => {
  const xml = await lsmXml(makeScore(), {paper: 'a4'});
  assert.match(xml, /<w:pgSz w:w="11906" w:h="16838"\/>/);
  assert.match(xml, /w:left="650"/);
});

test('[lsm] 標題明體 14 pt 置中；歌詞明體 12 pt；阿拉伯數字 Times New Roman', async () => {
  const all = runs2(await lsmXml(makeScore(), BOXES));
  const title = all.find(r => r.text === '版面測試');
  assert.deepEqual([title.ea, title.ascii, title.pt], ['新細明體', 'Times New Roman', 14]);
  for (const ch of ['甲', '乙', '丙', '丁']) {
    const r = all.find(x => x.text === ch);
    assert.deepEqual([r.ea, r.ascii, r.pt], ['新細明體', 'Times New Roman', 12], `歌詞「${ch}」`);
  }
  assert.ok(!all.some(r => r.ea === '標楷體'), 'lsm 版式不使用標楷體');
});

test('[lsm] 調號靠左、拍號靠右（同一行、右對齊定位點）：「D大調」…「4/4」，預設不含速度', async () => {
  const s = makeScore();
  s.key = 'D';
  const xml = await lsmXml(s);
  assert.match(
    xml,
    /<w:tab w:val="right" w:pos="\d+"\/>[^]*?D大調<\/w:t><\/w:r><w:r><w:tab\/><\/w:r>[^]*?>4\/4<\/w:t>/
  );
  assert.doesNotMatch(xml, /♩/);
  assert.doesNotMatch(xml, /1=D/);
  const m = runs2(xml).find(r => r.text === '4/4');
  assert.deepEqual([m.ascii, m.ea, m.pt], ['Times New Roman', '新細明體', 10]);
  assert.match(await lsmXml(s, {tempo: true}), />4\/4　♩ = 120<\/w:t>/);
});

test('keyName：降記號寫「降B大調」', () => {
  assert.equal(keyName('D'), 'D大調');
  assert.equal(keyName('Bb'), '降B大調');
  assert.equal(keyName('Db'), '降D大調');
});

test('[lsm] 節次為 ①②（緊貼第一字）；可改回「一、二、」；超過 20 節仍有符號', async () => {
  const all = runs2(await lsmXml(makeScore(), BOXES));
  const lyric = all.filter(r => r.pt === 12).map(r => r.text);
  assert.equal(lyric.filter(t => t === '①').length, 1);
  assert.equal(lyric.filter(t => t === '②').length, 1);
  assert.ok(!lyric.includes('一、'));
  const classic = runs2(await lsmXml(makeScore(), {verseMarks: 'chinese', ...BOXES})).map(r => r.text);
  assert.ok(classic.includes('一、') && classic.includes('二、') && !classic.includes('①'));
  assert.deepEqual(
    [0, 1, 2, 3, 19, 20, 34, 35, 49].map(i => verseMark(i)),
    ['①', '②', '③', '④', '⑳', '㉑', '㉟', '㊱', '㊿']
  );
  assert.equal(verseMark(50), '51、');
  assert.equal(verseMark(0, 'chinese'), '一、');
});

test('parseVerses 也接受官方 ①② 節次標記（單獨一行或行首），不當成歌詞', () => {
  assert.deepEqual(parseVerses('①\n甲乙\n\n②丙丁'), [
    ['甲', '乙'],
    ['丙', '丁']
  ]);
});

test('[lsm] 和弦仍為 Times New Roman 10 pt 深紅 #9C2323、數字原生下標（官方量測不到，維持現狀）', async () => {
  const all = runs2(await lsmXml());
  const chord = all.filter(r => r.color === '9C2323');
  assert.deepEqual(
    chord.map(r => [r.text, r.sub]),
    [
      ['C', false],
      ['7', true],
      ['Gm', false],
      ['7', true]
    ]
  );
  assert.ok(chord.every(r => r.ascii === 'Times New Roman' && r.ea === 'Times New Roman' && r.pt === 10));
  const score = all.filter(r => r.ea === '01SMN');
  assert.ok(score.length > 0 && score.every(r => r.pt === 14 && !r.sub));
});

test('[lsm] 末頁版權行：預設不加；指定文字時為相對頁面底部定位、置中、斜體 10 pt，且不新增段落', async () => {
  assert.doesNotMatch(await lsmXml(), /Copyright|Living Stream/);
  const text = '© 2026 Living Stream Ministry';
  const base = await lsmXml();
  const xml = await lsmXml(makeScore(), {copyright: text});
  const c = runs2(xml).find(r => r.text === text);
  assert.deepEqual([c.italic, c.pt, c.ascii], [true, 10, 'New Century Schoolbook']);
  assert.match(
    xml,
    /<wp:positionH relativeFrom="page"><wp:align>center<\/wp:align><\/wp:positionH><wp:positionV relativeFrom="page">/
  );
  assert.equal(
    (xml.match(/<w:p>/g) || []).length - (base.match(/<w:p>/g) || []).length,
    1,
    '只多一個文字方塊內的段落，不多出頁面段落'
  );
  assert.ok(
    xml.lastIndexOf('Living Stream') > xml.lastIndexOf('<w:p><w:pPr><w:spacing w:line'),
    '版權行附在最後一個系統段落'
  );
  assert.match(xml, new RegExp(`<wp:posOffset>${Math.round((792 - 36.5) * 12700)}<\\/wp:posOffset>`));
});

test('[lsm] 版權行含 $&、$$、$` 等字元時原樣輸出，不會被當成取代樣式（Bugbot 回歸）', async () => {
  const text = "A$&B$$C$`D$'E";
  const base = await lsmXml();
  const xml = await lsmXml(makeScore(), {copyright: text});
  assert.ok(xml.includes('A$&amp;B$$C$`D$&apos;E'), '版權文字逐字保留（僅經 XML 跳脫）');
  assert.equal((xml.match(/<\/w:p>/g) || []).length - (base.match(/<\/w:p>/g) || []).length, 1, '不得多出 </w:p>');
});

test('[css] 深色「帶走你的作品」面板內的 Word 版式選單有淺色文字與分隔線（Bugbot 回歸）', async () => {
  const fs = await import('node:fs');
  const css = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8');
  assert.match(css, /\.mix-panel \.word-options summary[^{]*\{[^}]*color:#e5efdf/);
  assert.match(css, /\.mix-panel \.word-options label[^{]*\{[^}]*color:#e5efdf/);
});

test('[lsm] 每行系統間距：單節歌詞≈58 pt（官方 57～58 pt）；每多一節 +19 pt', async () => {
  const one = makeScore();
  one.lyrics = '甲乙';
  const xml1 = await lsmXml(one, BOXES);
  assert.match(xml1, /<w:spacing w:line="1060" w:lineRule="exact" w:after="100"\/>/); // 53 pt + 5 pt = 58 pt
  assert.match(await lsmXml(makeScore(), BOXES), /w:line="1440"/); // 兩節：72 pt
  assert.match(await lsmXml(makeScore(), {...CLASSIC, ...BOXES}), /w:line="1640"/); // 原版式不變：44+2×19=82 pt
});

test('[lsm] 排版寬度不超出 Letter 可用寬度（612−65＝547 pt）', () => {
  const {systems, offset, options} = layout(makeScore());
  assert.equal(options.usable, 547);
  for (const row of systems) {
    const l = row.at(-1);
    assert.ok(offset + l.x + l.width <= 547 + 14);
  }
});

test('resolveOptions：未知版式回到官方預設；非法紙張、節次樣式會明確報錯', () => {
  assert.equal(resolveOptions({preset: 'x'}).paper, 'letter');
  assert.equal(resolveOptions({preset: 'classic'}).paper, 'a4');
  assert.equal(resolveOptions({preset: 'classic', paper: 'letter'}).paper, 'letter');
  assert.throws(() => resolveOptions({paper: 'b5'}), /紙張/);
  assert.throws(() => resolveOptions({verseMarks: 'x'}), /節次/);
  assert.equal(resolveOptions({copyright: '  hi  '}).copyright, 'hi');
});

test('wordingHints：只提醒、不改寫；官方用字（裏、甚麼、豫、召會、着、祂）', () => {
  assert.deepEqual(wordingHints('在基督裏'), []);
  const hints = wordingHints('裡面 什麼 預備 教會 跟著 他');
  assert.equal(hints.length, 6);
  assert.ok(
    hints.some(h => h.includes('裏')) && hints.some(h => h.includes('祂')) && hints.some(h => h.includes('着'))
  );
});

test('[lsm] 技能參考資料（notationLayout）路徑同樣套用官方標題列、節次與版權行；classic 維持原樣', async () => {
  const s = makeScore();
  s.lyrics = '甲乙';
  s.notationLayout = {
    fingerprint: JSON.stringify([s.sections, s.key, s.lyrics]),
    systems: [{raw: '1/2/', note_q: [0, 8], lyrics: [{syllables: ['甲', '乙']}]}]
  };
  const lsm = await lsmXml(s, {copyright: '© 2026 Living Stream Ministry', ...BOXES});
  assert.match(lsm, /C大調/);
  assert.match(lsm, /①/);
  assert.doesNotMatch(lsm, /一、/);
  assert.match(lsm, /Living Stream/);
  assert.match(lsm, /w:line="1100"/); // 參考路徑列高＝一般路徑 +2 pt：(34+2)+19 = 55 pt
  const classic = await lsmXml(s, {...CLASSIC, ...BOXES});
  assert.match(classic, /1=C　4\/4　♩ = 120/);
  assert.match(classic, /一、/);
});

// 和弦 run：[文字, 'sub'|'super'|'']
const CHORD_RUN = new RegExp(
  '<w:color w:val="9C2323"/><w:sz w:val="20"/>(?:<w:vertAlign w:val="(sub|super)script"/>)?' +
    '</w:rPr><w:t xml:space="preserve">([^<]*)<',
  'g'
);
const chordRuns3 = xml =>
  [...xml.matchAll(CHORD_RUN)].map(m => [m[2], m[1] || '']);

test('[lsm] 技能參考資料（notationLayout）路徑的和弦同樣顯示 ♯／♭', async () => {
  const s = fromTranscription({...data, chords: [{q: 0, text: 'F#m'}, {q: 8, text: 'Bb'}]});
  s.lyrics = '甲乙';
  s.notationLayout = {
    fingerprint: JSON.stringify([s.sections, s.key, s.lyrics]),
    systems: [{raw: '1/2/', note_q: [0, 8], lyrics: [{syllables: ['甲', '乙']}]}]
  };
  assert.deepEqual(chordRuns3(await lsmXml(s)), [
    ['F', ''],
    ['\u266F', 'super'],
    ['m', ''],
    ['B', ''],
    ['\u266D', 'super']
  ]);
  assert.deepEqual(chordRuns3(await lsmXml(s, CLASSIC)), [
    ['F#m', ''],
    ['Bb', '']
  ]);
});

test('[lsm] 和弦升降記號為 ♯／♭ 原生上標（根音與斜線低音），數字仍原生下標，品質字母不變；classic 維持 #／b', async () => {
  const s = fromTranscription({
    ...data,
    notes: [
      {q: 0, duration: 4, midi: 60},
      {q: 4, duration: 4, midi: 62},
      {q: 8, duration: 4, midi: 64},
      {q: 12, duration: 4, midi: 65}
    ],
    chords: [
      {q: 0, text: 'F#m'},
      {q: 4, text: 'Bb'},
      {q: 8, text: 'C#m7/G#'},
      {q: 12, text: 'Dm'}
    ]
  });
  assert.deepEqual(chordRuns3(await lsmXml(s)), [
    ['F', ''],
    ['\u266F', 'super'],
    ['m', ''],
    ['B', ''],
    ['\u266D', 'super'],
    ['C', ''],
    ['\u266F', 'super'],
    ['m', ''],
    ['7', 'sub'],
    ['/G', ''],
    ['\u266F', 'super'],
    ['Dm', '']
  ]);
  const s2 = fromTranscription({...data, chords: [{q: 0, text: 'A7'}, {q: 8, text: 'Bm7'}]});
  assert.deepEqual(chordRuns3(await lsmXml(s2)), [
    ['A', ''],
    ['7', 'sub'],
    ['Bm', ''],
    ['7', 'sub']
  ]);
  const classic = await lsmXml(s, CLASSIC);
  assert.doesNotMatch(classic, /superscript/);
  assert.deepEqual(chordRuns3(classic), [
    ['F#m', ''],
    ['Bb', ''],
    ['C#m', ''],
    ['7', 'sub'],
    ['/G#', ''],
    ['Dm', '']
  ]);
});
