import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {musicXml, musicXmlBlob, xmlText, MUSICXML_MIME} from './musicxml.js';
import {midiBytes} from './music.js';
import {writtenEvents} from './score-bridge.js';

const base = (key, bars, extra = {}) => ({title: 't', key, bpm: 90, meter: [4, 4], lyrics: '', chords: {}, warnings: [], sections: {verse: bars}, form: [{section: 'verse'}], ...extra});
const pitches = xml => [...xml.matchAll(/<step>(\w)<\/step>\s*(?:<alter>(-?\d)<\/alter>\s*)?<octave>(\d)<\/octave>/g)].map(m => m[1] + (m[2] ? (m[2] === '1' ? '#' : 'b') : '') + m[3]);
const flat = xml => xml.replace(/>\s+</g, '><');
const count = (xml, re) => (xml.match(re) || []).length;
// 20 行內的標籤配對檢查：忽略 XML 宣告、DOCTYPE、自閉合標籤，其餘必須嚴格配對。
function balanced(xml) {
  const stack = [];
  for (const m of xml.replace(/<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>/g, '').matchAll(/<(\/?)([\w-]+)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) { if (stack.pop() !== m[2]) return false; } else stack.push(m[2]);
  }
  return stack.length === 0;
}
const lyricScore = (second = '祂愛我們也啊') => base('G', [
  {chord: 'G', notes: [[67, 1], [69, 1], [71, 2]], beats: 4},
  {chord: 'C', notes: [[72, 1], [71, 1], [69, 2]], beats: 4}], {lyrics: `一、\n耶穌愛我們啊\n\n二、\n${second}`});

test('T1 結構：檔頭、divisions、調號、拍號、速度、標籤配對', () => {
  const x = musicXml(base('G', [{chord: 'G', notes: [[67, 1], [69, 1], [71, 2]], beats: 4}]));
  assert.ok(x.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.match(x, /<!DOCTYPE score-partwise PUBLIC "-\/\/Recordare\/\/DTD MusicXML 4\.0 Partwise\/\/EN"/);
  assert.match(x, /<score-partwise version="4\.0">/);
  const f = flat(x);
  for (const piece of ['<divisions>4</divisions>', '<fifths>1</fifths>', '<beats>4</beats><beat-type>4</beat-type>', '<per-minute>90</per-minute>', '<sound tempo="90"/>', '<mode>major</mode>', '<part-name>旋律</part-name>']) assert.ok(f.includes(piece), piece);
  assert.ok(balanced(x));
});

test('T2 降記號調音高拼法：Db 大調 Db Eb F Gb', () => {
  assert.deepEqual(pitches(musicXml(base('Db', [{notes: [[61, 1], [63, 1], [65, 1], [66, 1]]}]))), ['Db4', 'Eb4', 'F4', 'Gb4']);
});

test('T3 Gb 大調的 Cb：Gb4 Cb5 C5 Bb4', () => {
  const x = musicXml(base('Gb', [{notes: [[66, 1], [71, 1], [72, 1], [70, 1]]}]));
  assert.deepEqual(pitches(x), ['Gb4', 'Cb5', 'C5', 'Bb4']);
  assert.ok(flat(x).includes('<step>C</step><alter>-1</alter><octave>5</octave>'));
});

test('T4 調外音：升記號調用升、降記號調用降', () => {
  assert.deepEqual(pitches(musicXml(base('C', [{notes: [[61, 1], [63, 1], [66, 1], [68, 1]]}]))), ['C#4', 'D#4', 'F#4', 'G#4']);
  assert.deepEqual(pitches(musicXml(base('A', [{notes: [[69, 1], [73, 1], [68, 1], [71, 1]]}]))), ['A4', 'C#5', 'G#4', 'B4']);
  assert.deepEqual(pitches(musicXml(base('F', [{notes: [[61, 1], [63, 1], [65, 2]]}]))), ['Db4', 'Eb4', 'F4']);
});

test('T5 非標準時值拆音：音用 tie 連結，休止不加 tie', () => {
  const x = flat(musicXml(base('C', [{notes: [[60, 1.25], [null, 2.75]]}])));
  const tokens = x.match(/<duration>\d+<\/duration>|<type>\w+<\/type>|<dot\/>|<tie [^>]*>|<rest\/>/g).join(' ');
  assert.equal(tokens, '<duration>4</duration> <tie type="start"/> <type>quarter</type> <duration>1</duration> <tie type="stop"/> <type>16th</type> <rest/> <duration>8</duration> <type>half</type> <rest/> <duration>3</duration> <type>eighth</type> <dot/>');
});

test('T6 跨小節延音：tie 與 tied 成對', () => {
  const x = flat(musicXml(base('C', [{notes: [[60, 3], [62, 1]]}, {notes: [[62, 4]], tieFrom: [0]}])));
  assert.equal(count(x, /<tie type="start"\/>/g), 1);
  assert.equal(count(x, /<tie type="stop"\/>/g), 1);
  assert.equal(count(x, /<tied type="start"\/>/g), 1);
  assert.equal(count(x, /<tied type="stop"\/>/g), 1);
  const [m1, m2] = x.split('<measure ').slice(1);
  assert.ok(m1.includes('<tie type="start"/>') && !m1.includes('<tie type="stop"/>'));
  assert.ok(m2.includes('<tie type="stop"/>') && !m2.includes('<tie type="start"/>'));
});

test('T6b 一個音既被延續又延續下一個：同時有 stop 與 start', () => {
  const x = flat(musicXml(base('C', [{notes: [[60, 2], [62, 2]]}, {notes: [[62, 2], [62, 2]], tieFrom: [0, 1]}])));
  assert.equal(count(x, /<tie type="start"\/>/g), 2);
  assert.equal(count(x, /<tie type="stop"\/>/g), 2);
  assert.ok(x.includes('<tie type="stop"/><tie type="start"/>'));
});

test('T7 弱起小節：number=0 implicit，之後從 1 起算；整拍起頭則從 1 起算', () => {
  const x = musicXml(base('C', [{notes: [[67, 1]], beats: 1}, {notes: [[60, 4]]}, {notes: [[62, 4]]}]));
  assert.deepEqual(x.match(/<measure[^>]*>/g), ['<measure number="0" implicit="yes">', '<measure number="1">', '<measure number="2">']);
  assert.deepEqual(musicXml(base('C', [{notes: [[60, 4]]}, {notes: [[62, 4]]}])).match(/<measure[^>]*>/g), ['<measure number="1">', '<measure number="2">']);
});

test('T8 非整格拍數丟錯', () => {
  assert.throws(() => musicXml(base('C', [{notes: [[60, 0.3], [62, 3.7]]}])), {message: 'MusicXML 暫支援十六分音符格線，請修正非整格拍數。'});
});

test('T9 多節歌詞逐字對位，每節一個 lyric', () => {
  const x = flat(musicXml(lyricScore()));
  const notes = x.split('<note>').slice(1);
  assert.equal(notes.length, 6);
  assert.ok(notes[0].includes('<lyric number="1"><syllabic>single</syllabic><text>耶</text></lyric><lyric number="2"><syllabic>single</syllabic><text>祂</text></lyric>'));
  assert.ok(notes[5].includes('<lyric number="1"><syllabic>single</syllabic><text>啊</text></lyric><lyric number="2"><syllabic>single</syllabic><text>啊</text></lyric>'));
  assert.equal(count(x, /<lyric /g), 12);
  assert.equal(count(x, /<syllabic>single<\/syllabic>/g), 12);
});

test('T9b 延續音與休止不放歌詞；拆音只放在第一個片段；標點附著', () => {
  const s = base('C', [{notes: [[60, 1.25], [null, 1], [62, 1.75]]}, {notes: [[62, 4]], tieFrom: [0]}], {lyrics: '「你好」'});
  assert.throws(() => musicXml({...s, lyrics: '「你好吧」'}), /本譜有 2 個起音，目前各節為 3 字/);
  const x = flat(musicXml({...s, lyrics: '「你好」'}));
  assert.equal(count(x, /<lyric /g), 2);
  assert.ok(x.includes('<text>「你</text>') && x.includes('<text>好」</text>'));
  assert.equal(count(x, /<note>/g), 2 + 1 + 2 + 1);
  assert.ok(x.split('<note>')[2].indexOf('<lyric') === -1, '拆出的第二片段不放歌詞');
});

test('T10 歌詞字數不符：訊息與 Word 同款', () => {
  assert.throws(() => musicXml(lyricScore('祂愛我們啊')), {message: '歌詞需逐字對位：本譜有 6 個起音，目前各節為 6、5 字。請以空行分節，或先清空歌詞匯出純譜。'});
  assert.doesNotThrow(() => musicXml(lyricScore('祂愛我們啊'), {lyrics: false}));
});

test('T11 無歌詞：完全不輸出 lyric', () => {
  assert.equal(count(musicXml(lyricScore()), /<lyric /g), 12);
  assert.equal(count(musicXml(base('G', [{notes: [[67, 4]]}], {lyrics: '  \n'})), /<lyric/g), 0);
});

test('T12 和弦拍點在音符中間：harmony 在該音之前、offset 正確、音符不被切斷', () => {
  const s = base('G', [{chord: 'G', notes: [[67, 1], [69, 1], [71, 2]], beats: 4},
    {chordChanges: [{beat: 0, text: 'C'}, {beat: 2.5, text: 'D7/F#'}], notes: [[72, 1], [71, 1], [69, 2]], beats: 4}]);
  const x = flat(musicXml(s));
  const bar2 = x.split('<measure ')[2];
  const harmonies = bar2.match(/<harmony>.*?<\/harmony>/g);
  assert.equal(harmonies.length, 2);
  assert.equal(harmonies[1], '<harmony><root><root-step>D</root-step></root><kind text="7">dominant</kind><bass><bass-step>F</bass-step><bass-alter>1</bass-alter></bass><offset>2</offset></harmony>');
  const notes = bar2.split('<note>').slice(1);
  assert.equal(notes.length, 3);
  assert.ok(bar2.indexOf(harmonies[1]) > bar2.indexOf('<note>') && bar2.indexOf(harmonies[1]) < bar2.lastIndexOf('<note>'));
  assert.ok(notes[2].startsWith('<pitch>') && notes[2].includes('<duration>8</duration>'));
  assert.ok(harmonies[0].includes('<kind>major</kind>'));
  const secondEnd = bar2.indexOf('</note>', bar2.indexOf('</note>') + 1);
  assert.ok(bar2.indexOf(harmonies[1]) > secondEnd, '第二個 harmony 在第二音結束之後');
  assert.ok(bar2.indexOf(harmonies[1]) < bar2.indexOf(notes[2]));
});

test('T12b 和弦 kind 對照與升降根音', () => {
  const kinds = {Bbm: ['minor', 'm'], G7: ['dominant', '7'], Cm7: ['minor-seventh', 'm7'], Fmaj7: ['major-seventh', 'maj7'], Bdim: ['diminished', 'dim'], Dsus4: ['suspended-fourth', 'sus4'], Asus2: ['suspended-second', 'sus2'], Eaug: ['augmented', 'aug']};
  for (const [symbol, [kind, text]] of Object.entries(kinds)) {
    const x = flat(musicXml(base('C', [{chord: symbol, notes: [[60, 4]]}])));
    assert.ok(x.includes(`<kind text="${text}">${kind}</kind>`), symbol);
  }
  assert.ok(flat(musicXml(base('C', [{chord: 'F#m', notes: [[60, 4]]}]))).includes('<root><root-step>F</root-step><root-alter>1</root-alter></root>'));
  assert.ok(flat(musicXml(base('C', [{chord: 'Bb', notes: [[60, 4]]}]))).includes('<root-alter>-1</root-alter>'));
});

test('和弦拍點取整不得誤報超出小節：beat 3.9（4/4）仍輸出 harmony，且 offset 不超出最後一音', () => {
  const s = base('C', [{chordChanges: [{beat: 0, text: 'C'}, {beat: 3.9, text: 'G7'}], notes: [[60, 2], [62, 2]]}]);
  assert.doesNotThrow(() => musicXml(s));
  const x = flat(musicXml(s));
  const harmonies = x.match(/<harmony>.*?<\/harmony>/g);
  assert.equal(harmonies.length, 2);
  assert.ok(harmonies[1].endsWith('<offset>7</offset></harmony>'), '夾回小節最後一個十六分格（第二音起點 8 ＋ 7 ＝ 15）');
  assert.ok(x.indexOf(harmonies[1]) > x.indexOf('</note>'), '位於第二音之前、第一音之後');
  assert.ok(x.indexOf(harmonies[1]) < x.lastIndexOf('<note>'));
  // 與 Word 匯出的判斷一致：Word 接受的拍點，MusicXML 也接受
  const edge = base('C', [{chord: 'C', chordChanges: [{beat: 3.99, text: 'F'}], notes: [[60, 1], [62, 3]]}]);
  assert.doesNotThrow(() => writtenEvents(edge));
  assert.doesNotThrow(() => musicXml(edge));
  // 真正超出仍要報錯（含 Word 同樣拒絕的 beat=小節長度、負數、NaN）
  for (const beat of [4, 4.01, -0.1, NaN]) {
    const bad = base('C', [{chordChanges: [{beat, text: 'C'}], notes: [[60, 4]]}]);
    assert.throws(() => musicXml(bad), {message: '和弦拍點超出小節。'}, `beat=${beat}`);
    assert.throws(() => writtenEvents(bad), {message: '和弦拍點超出小節。'});
  }
});

test('T13 不支援的和弦丟錯，訊息同 chordVoicing；拍點超出小節也丟錯', () => {
  assert.throws(() => musicXml(base('C', [{chord: 'C9', notes: [[60, 4]]}])), /不支援和絃「C9」/);
  assert.throws(() => musicXml(base('C', [{chordChanges: [{beat: 4, text: 'C'}], notes: [[60, 4]]}])), {message: '和弦拍點超出小節。'});
});

test('T14 XML 安全：非法控制字元、孤立代理字元移除，特殊符號跳脫', () => {
  const x = musicXml(base('C', [{notes: [[60, 2], [62, 2]]}], {title: 'a\u0001b&c<d', lyrics: '你\u000B好\ud800'}));
  assert.ok(x.includes('<work-title>ab&amp;c&lt;d</work-title>'));
  assert.doesNotMatch(x, /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/);
  assert.doesNotMatch(x, /[\ud800-\udfff]/);
  assert.equal(xmlText('a"b'), 'a&quot;b');
  assert.equal(xmlText('😀\udc00x'), '😀x');
  assert.ok(balanced(x));
});

test('T14b 標題空白時用「簡譜」', () => {
  assert.ok(musicXml(base('C', [{notes: [[60, 4]]}], {title: '  '})).includes('<work-title>簡譜</work-title>'));
});

test('T15 example.json：32 小節、84 音符（8 休止）、32 和弦、無歌詞', () => {
  const x = musicXml(JSON.parse(fs.readFileSync(new URL('./example.json', import.meta.url), 'utf8')));
  assert.equal(count(x, /<measure /g), 32);
  assert.equal(count(x, /<note>/g), 84);
  assert.equal(count(x, /<rest\/>/g), 8);
  assert.equal(count(x, /<harmony>/g), 32);
  assert.equal(count(x, /<lyric/g), 0);
  assert.ok(x.includes('<fifths>-1</fifths>') && x.includes('<per-minute>88</per-minute>') && x.includes('<work-title>信的路程</work-title>'));
  for (const m of x.split('<measure ').slice(1)) assert.equal([...m.matchAll(/<duration>(\d+)<\/duration>/g)].reduce((a, v) => a + Number(v[1]), 0), 12);
  assert.ok(balanced(x));
});

test('T16 決定性：同輸入兩次輸出完全相同', () => {
  const s = lyricScore();
  assert.equal(musicXml(s), musicXml(s));
  assert.equal(musicXml(structuredClone(s)), musicXml(s));
});

test('T17 不修改輸入', () => {
  const s = lyricScore(), before = structuredClone(s);
  musicXml(s);
  assert.deepEqual(s, before);
});

test('T18 既有輸出不變：呼叫前後 midiBytes 相同', () => {
  const s = JSON.parse(fs.readFileSync(new URL('./example.json', import.meta.url), 'utf8'));
  const before = Buffer.from(midiBytes(s, 'melody'));
  musicXml(s);
  assert.ok(before.equals(Buffer.from(midiBytes(s, 'melody'))));
});

test('延音與前音不符時丟錯（與 Word 匯出一致）', () => {
  assert.throws(() => musicXml(base('C', [{notes: [[60, 2], [62, 2]], tieFrom: [1]}])), {message: '連結延音與前音不符，請重新校對。'});
  assert.throws(() => musicXml(base('C', [{notes: [[60, 4]], tieFrom: [0]}])), {message: '連結延音與前音不符，請重新校對。'});
});

test('6/8 拍號與弱起判斷', () => {
  const x = musicXml(base('D', [{notes: [[62, 1.5]], beats: 1.5}, {notes: [[62, 1.5], [64, 1.5]]}], {meter: [6, 8]}));
  assert.ok(flat(x).includes('<beats>6</beats><beat-type>8</beat-type>'));
  assert.deepEqual(x.match(/<measure[^>]*>/g), ['<measure number="0" implicit="yes">', '<measure number="1">']);
});

test('輸出維持使用者原文，不套用官方用字替換', () => {
  const x = musicXml(base('C', [{notes: [[60, 2], [62, 2]]}], {title: '吃裡', lyrics: '吃裡'}));
  assert.ok(x.includes('<work-title>吃裡</work-title>') && x.includes('<text>吃</text>') && x.includes('<text>裡</text>'));
});

test('musicXmlBlob：MIME 與內容', async () => {
  const b = musicXmlBlob(base('C', [{notes: [[60, 4]]}]));
  assert.equal(b.type, MUSICXML_MIME);
  assert.equal(MUSICXML_MIME, 'application/vnd.recordare.musicxml+xml');
  assert.ok((await b.text()).startsWith('<?xml'));
});

test('不合法的樂譜原樣丟出 validateScore 的錯誤', () => {
  assert.throws(() => musicXml({}), {message: '樂譜缺少 sections 或 form。'});
});

test('黃金檔：T9 示意樂譜的完整輸出', () => {
  const golden = fs.readFileSync(new URL('./fixtures/musicxml-demo.musicxml', import.meta.url), 'utf8');
  assert.equal(musicXml(lyricScore()), golden);
});
