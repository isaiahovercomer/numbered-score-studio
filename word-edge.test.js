// Word 輸出的高風險邊界情況：特殊字元、空輸入、多節、超出一頁、和弦靠近。
// 這裡只鎖定「不得壞檔、不得吃字、錯誤要看得懂」；不改變任何排版規則。
import test from 'node:test';
import assert from 'node:assert/strict';
import {fromTranscription} from './score-bridge.js';
import {wordBlob, layout, chordLabel} from './word-export.js';
import {readZip} from './test-helpers.js';

const PRESETS = [{preset: 'lsm'}, {preset: 'classic'}];
function makeScore(n = 8, {title = '邊界測試', key = 'C', chords = []} = {}) {
  const notes = [];
  for (let i = 0; i < n; i++) notes.push({q: i * 4, duration: 4, midi: 60 + [0, 2, 4, 5, 7, 9, 11][i % 7]});
  const s = fromTranscription({title, target_key: key, bpm_estimate: 100, pickup_beats: 0, notes, chords});
  s.lyrics = '';
  return s;
}
const parts = async (s, opts) => readZip(new Uint8Array(await wordBlob(s, opts).arrayBuffer()));
const docXml = async (s, opts) => (await parts(s, opts))['word/document.xml'];
// XML 1.0 不允許的字元（控制字元、U+FFFE、U+FFFF）。
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/;
const texts = xml => [...xml.matchAll(/<w:t xml:space="preserve">([^<]*)<\/w:t>/g)].map(m => m[1]);

test('控制字元（貼上時常夾帶的 U+000B、U+000C、U+0000）不得進入 XML，否則 Word 會判定檔案毀損', async () => {
  for (const preset of PRESETS) {
    const s = makeScore(8, {title: 'a\u0001b\u0000c\u000bd\u000ce\ufffe'});
    s.lyrics = '一、\n甲乙丙丁戊己庚辛\u0001';
    const files = await parts(s, {...preset, copyright: 'x\u0001y'});
    for (const [name, text] of Object.entries(files))
      assert.doesNotMatch(text, INVALID_XML, `${preset.preset}：${name} 含非法 XML 字元`);
    assert.ok(texts(files['word/document.xml']).includes('abcde'), '合法文字仍保留、只拿掉控制字元');
  }
  // 版權行只在 lsm 版式出現
  assert.ok(texts(await docXml(makeScore(), {preset: 'lsm', copyright: 'x\u0001y'})).includes('xy'));
});

test('特殊字元：& < > " \' 在標題、歌詞、版權行都被跳脫；孤立代理字元不會產生壞檔', async () => {
  const s = makeScore(4, {title: 'A&B <c> "d" \'e\''});
  s.lyrics = '一、\n甲&乙<丙>丁';
  const xml = await docXml(s, {copyright: '<&>'});
  assert.ok(xml.includes('A&amp;B &lt;c&gt; &quot;d&quot; &apos;e&apos;'));
  assert.ok(xml.includes('&lt;&amp;&gt;'));
  assert.doesNotMatch(xml.replace(/&(amp|lt|gt|quot|apos);/g, ''), /[&<](?![\/?wa-z])/, '不得有未跳脫的 & 或 <');
  const lone = await docXml(makeScore(8, {title: 'x\ud800y'}));
  assert.doesNotMatch(lone, INVALID_XML);
});

test('歌詞：表情符號（代理對）與前一字同一音節、CRLF 與 LF 結果相同、拉丁字母各占一個音位', async () => {
  const s = makeScore(4);
  s.lyrics = '一、\n甲😀乙丙丁';
  assert.deepEqual(layout(s).verses, [['甲😀', '乙', '丙', '丁']]);
  const lf = makeScore(4),
    crlf = makeScore(4);
  lf.lyrics = '一、\n甲乙\n丙丁';
  crlf.lyrics = '一、\r\n甲乙\r\n丙丁';
  assert.deepEqual(layout(crlf).verses, layout(lf).verses);
  assert.equal(await docXml(crlf), await docXml(lf));
  const latin = makeScore(4);
  latin.lyrics = '一、\nA甲B乙';
  assert.deepEqual(layout(latin).verses, [['A', '甲', 'B', '乙']]);
});

test('空輸入：沒有歌詞或只有空白也能匯出純譜；沒有標題時使用「簡譜」', async () => {
  for (const preset of PRESETS) {
    for (const lyrics of ['', '   \n  \n']) {
      const s = makeScore(8);
      s.title = '';
      s.lyrics = lyrics;
      const xml = await docXml(s, preset);
      assert.ok(texts(xml).includes('簡譜'), `${preset.preset}：空標題應顯示「簡譜」`);
      assert.deepEqual(layout(s, preset).verses, []);
    }
  }
});

test('歌詞字數與音位不符時給出清楚的錯誤（含實際字數），不會輸出錯位的歌詞', async () => {
  const short = makeScore(8);
  short.lyrics = '一、\n甲乙';
  assert.throws(() => wordBlob(short), /本譜有 8 個起音，目前各節為 2 字/);
  const long = makeScore(8);
  long.lyrics = '一、\n' + '甲'.repeat(20);
  assert.throws(() => layout(long), /本譜有 8 個起音，目前各節為 20 字/);
  const uneven = makeScore(8);
  uneven.lyrics = '一、\n甲乙丙丁戊己庚辛\n\n二、\n甲乙';
  assert.throws(() => layout(uneven), /8 個起音，目前各節為 8、2 字/);
});

test('多節：12 節各有一個節次標記（①～⑫）且只標在第一個系統；系統高度隨節數增加', async () => {
  const s = makeScore(8);
  s.lyrics = Array.from({length: 12}, (_, i) => `${i + 1}、\n甲乙丙丁戊己庚辛`).join('\n\n');
  const xml = await docXml(s);
  const marks = texts(xml).filter(t => /^[\u2460-\u246b]$/.test(t));
  assert.deepEqual(marks, ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫']);
  const one = makeScore(8);
  one.lyrics = '一、\n甲乙丙丁戊己庚辛';
  const line = x => Number(x.match(/<w:spacing w:line="(\d+)" w:lineRule="exact" w:after="100"\/><w:keepLines\/>/)[1]);
  assert.equal(line(xml) - line(await docXml(one)), 11 * 19 * 20, '每多一節 +19 pt');
});

test('多節：超過 50 節時節次標記退回「51、」寫法而不是壞掉', async () => {
  const s = makeScore(2);
  s.lyrics = Array.from({length: 55}, (_, i) => `${i + 1}、\n甲乙`).join('\n\n');
  const xml = await docXml(s);
  assert.ok(texts(xml).includes('51、'));
  assert.doesNotMatch(xml, INVALID_XML);
});

test('超出一頁：長譜分成多個系統，每個系統都是 keepLines＋固定行高的獨立段落，Word 只會整行換頁', async () => {
  for (const preset of PRESETS) {
    const s = makeScore(300);
    s.lyrics = '一、\n' + '歌'.repeat(300);
    const {systems, options} = layout(s, preset);
    assert.ok(systems.length > 4, '300 個音至少分成多個系統');
    const xml = await docXml(s, preset);
    const rowParagraphs =
      xml.match(/<w:spacing w:line="\d+" w:lineRule="exact" w:after="100"\/><w:keepLines\/>/g) || [];
    assert.equal(rowParagraphs.length, systems.length, `${preset.preset}：每個系統一個 keepLines 段落`);
    const height = Number(rowParagraphs[0].match(/line="(\d+)"/)[1]) / 20;
    assert.equal(height, options.rowBase + 19);
    // 每個系統都不超過可用寬度（換行規則仍有效）
    for (const row of systems) assert.ok(row.at(-1).x + row.at(-1).width <= options.wrapMax + 20, '系統寬度不超過版面');
    assert.doesNotMatch(xml, INVALID_XML);
  }
});

test('和弦靠近：同一個音內的多個和弦一個都不會被丟掉，且依時間排序（目前不做防重疊位移，列為待決）', async () => {
  const s = makeScore(1);
  s.sections.verse[0].notes = [[60, 4]];
  s.sections.verse[0].beats = 4;
  s.sections.verse[0].chordChanges = [
    {beat: 0, text: 'C'},
    {beat: 0.25, text: 'G7'},
    {beat: 0.5, text: 'Am7'}
  ];
  const {systems} = layout(s);
  const chords = systems.flat().flatMap(p => p.chords);
  assert.deepEqual(
    chords.map(c => c.text),
    ['C', 'G7', 'Am7']
  );
  assert.ok(chords.every((c, i) => i === 0 || c.q > chords[i - 1].q));
  const xml = await docXml(s);
  for (const name of ['C', 'G', 'Am']) assert.ok(texts(xml).includes(name), `和弦 ${name} 出現在文件中`);
});

test('降記號調性與極端內容：Bb 大調顯示「降B大調」、300 字標題、無音符歌詞行等都能匯出且 XML 乾淨', async () => {
  const bb = await docXml(makeScore(8, {key: 'Bb'}));
  assert.ok(texts(bb).some(t => t.includes('降B大調')));
  for (const preset of PRESETS) {
    const xml = await docXml(makeScore(8, {title: '長'.repeat(300)}), preset);
    assert.ok(texts(xml).includes('長'.repeat(300)));
    assert.doesNotMatch(xml, INVALID_XML);
  }
  const rests = fromTranscription({title: '休止', target_key: 'C', notes: [{q: 0, duration: 16, midi: null}]});
  rests.lyrics = '';
  assert.doesNotMatch(await docXml(rests), INVALID_XML);
});

test('版權行長度上限 120 字（超過截斷）；兩種版式都可指定，預設不加', async () => {
  const xml = await docXml(makeScore(), {preset: 'lsm', copyright: 'a'.repeat(500)});
  assert.ok(texts(xml).includes('a'.repeat(120)));
  assert.ok(!texts(xml).some(t => t.length > 120));
  assert.ok(texts(await docXml(makeScore(), {preset: 'classic', copyright: 'zzz'})).includes('zzz'));
  for (const preset of PRESETS) assert.ok(!texts(await docXml(makeScore(), preset)).some(t => /©|Copyright/i.test(t)));
});

test('chordLabel：symbol 只換根音與斜線低音的 #／b，品質字母不動；ascii 原樣', () => {
  const cases = {
    'F#m': 'F\u266Fm',
    Bb: 'B\u266D',
    'C#m7/G#': 'C\u266Fm7/G\u266F',
    'Bb/D': 'B\u266D/D',
    Ebmaj7: 'E\u266Dmaj7',
    Abm: 'A\u266Dm',
    Bdim: 'Bdim',
    G7sus4: 'G7sus4',
    Dm: 'Dm',
    Bm7: 'Bm7',
    'Gsus2/B': 'Gsus2/B'
  };
  for (const [from, to] of Object.entries(cases)) {
    assert.equal(chordLabel(from, 'symbol'), to, from);
    assert.equal(chordLabel(from, 'ascii'), from);
    assert.equal([...chordLabel(from, 'symbol')].length, from.length, '一字對一字，寬度不變');
  }
  assert.equal(chordLabel('F#m'), 'F#m');
});

// 回歸：曲子以休止符開頭時，逐字方塊（boxes）的節次標記不可消失；比照內文整句，放在第一個有字的音左側。
const restStart = () => ({
  title: 't',
  key: 'C',
  bpm: 90,
  meter: [4, 4],
  chords: {},
  warnings: [],
  sections: {verse: [{notes: [[null, 1], [60, 1], [62, 1], [64, 1]]}, {notes: [[65, 2], [67, 2]]}]},
  form: [{section: 'verse'}],
  lyrics: '一、\n甲乙丙丁戊\n\n二、\n己庚辛壬癸'
});
// 每個文字方塊的水平位置（EMU）與文字。
const shapesAt = xml =>
  [...xml.matchAll(/<wp:positionH[^>]*><wp:posOffset>(-?\d+)<\/wp:posOffset>.*?<\/wp:anchor>/gs)].map(m => ({
    x: Number(m[1]),
    text: texts(m[0]).join('')
  }));
test('休止符開頭：逐字方塊的節次標記仍出現一次，且緊貼第一個有字的音左側（circled 16 pt、中文 32 pt）', async () => {
  const pt = 12700;
  for (const preset of PRESETS)
    for (const [verseMarks, marks, gap] of [
      ['circled', ['①', '②'], 16],
      ['chinese', ['一、', '二、'], 32]
    ]) {
      const all = shapesAt(await docXml(restStart(), {...preset, verseMarks}));
      for (const [vi, first] of ['甲', '己'].entries()) {
        const lyric = all.filter(s => s.text === first);
        const mark = all.filter(s => s.text === marks[vi]);
        assert.equal(mark.length, 1, `${preset.preset}/${verseMarks}：節次「${marks[vi]}」應出現一次`);
        assert.equal(mark[0].x, lyric[0].x - gap * pt, `${preset.preset}/${verseMarks}：節次位置`);
      }
    }
});

// 回歸（Isaiah：節次標記永遠不可消失）：整個第一列都是休止符（前奏很長）時，標記放在全曲第一個有字的音左側；
// 原稿版面（notationLayout）第一列沒有歌詞時，標記放在該節第一個有字的列。只有該節完全沒有歌詞才省略。
const longRest = () => ({
  ...restStart(),
  sections: {
    verse: [...Array(8)]
      .map(() => ({notes: [[null, 4]]}))
      .concat([{notes: [[60, 1], [62, 1], [64, 1], [65, 1]]}])
  },
  lyrics: '一、\n甲乙丙丁\n\n二、\n己庚辛壬'
});
const refLongRest = () => {
  const s = {...longRest(), sections: {verse: [{notes: [[60, 2], [62, 2]]}, {notes: [[64, 2], [65, 2]]}]}};
  s.notationLayout = {
    fingerprint: JSON.stringify([s.sections, s.key, s.lyrics]),
    systems: [
      {raw: '1/2/', note_q: [0, 8], lyrics: []},
      {raw: '1/2/3/4/', note_q: [16, 20, 24, 28], lyrics: [{syllables: [...'甲乙丙丁']}, {syllables: [...'己庚辛壬']}]}
    ]
  };
  return s;
};
test('第一列全無歌詞：逐字方塊的節次標記放在全曲第一個有字的音左側（含原稿版面）', async () => {
  const pt = 12700;
  for (const preset of PRESETS) assert.equal(layout(longRest(), preset).systems[0].some(p => p.lyrics.length), false);
  for (const [name, score] of [
    ['一般', longRest],
    ['原稿版面', refLongRest]
  ])
    for (const preset of PRESETS)
      for (const [verseMarks, marks, gap] of [
        ['circled', ['①', '②'], 16],
        ['chinese', ['一、', '二、'], 32]
      ]) {
        const all = shapesAt(await docXml(score(), {...preset, verseMarks, lyricLayout: 'boxes'}));
        for (const [vi, first] of ['甲', '己'].entries()) {
          const lyric = all.filter(s => s.text === first);
          const mark = all.filter(s => s.text === marks[vi]);
          const at = `${name}/${preset.preset}/${verseMarks}`;
          assert.equal(mark.length, 1, `${at}：節次「${marks[vi]}」應出現一次`);
          assert.equal(mark[0].x, lyric[0].x - gap * pt, `${at}：節次位置`);
        }
      }
});
