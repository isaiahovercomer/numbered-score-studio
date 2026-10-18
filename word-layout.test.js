// 鎖定使用者已確認的 Word 排版偏好（見 NOTATION_RULES.md）。
// 這些測試只讀取現有輸出，不改變任何排版或輸出行為。
import test from 'node:test';
import assert from 'node:assert/strict';
import {fromTranscription} from './score-bridge.js';
import {wordBlob,layout} from './word-export.js';

const data = {
  title: '版面測試', target_key: 'C', bpm_estimate: 120, pickup_beats: 0,
  notes: [{q: 0, duration: 8, midi: 60}, {q: 8, duration: 8, midi: 62}],
  chords: [{q: 0, text: 'C7'}, {q: 8, text: 'Gm7'}]
};
function makeScore() {
  const s = fromTranscription(data);
  s.lyrics = '一、\n甲乙\n\n二、\n丙丁';
  return s;
}
async function docBytes(s) { return new Uint8Array(await wordBlob(s).arrayBuffer()); }

// 最小 ZIP 讀取器：wordBlob 只使用「儲存（不壓縮）」模式。
function readZip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const crc32 = (u8) => {
    let c = 0xffffffff;
    for (const b of u8) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); }
    return (c ^ 0xffffffff) >>> 0;
  };
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  assert.notEqual(eocd, -1, '找不到 ZIP 結尾記錄');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const files = {};
  for (let n = 0; n < count; n++) {
    assert.equal(v.getUint32(p, true), 0x02014b50, '中央目錄簽章錯誤');
    const method = v.getUint16(p + 10, true), crc = v.getUint32(p + 16, true);
    const size = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true), extra = v.getUint16(p + 30, true), comment = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    assert.equal(v.getUint32(local, true), 0x04034b50, '本機檔頭簽章錯誤');
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const body = bytes.subarray(start, start + size);
    assert.equal(method, 0);
    assert.equal(crc32(body), crc, `${name} CRC 不符`);
    files[name] = new TextDecoder().decode(body);
    p += 46 + nameLen + extra + comment;
  }
  return files;
}
// 取得每個文字 run 的字型、字級（pt）、顏色、是否下標與文字。
function runs(xml) {
  return [...xml.matchAll(/<w:r><w:rPr><w:rFonts w:ascii="([^"]*)"[^>]*\/><w:color w:val="([0-9A-F]{6})"\/><w:sz w:val="(\d+)"\/>(<w:vertAlign w:val="subscript"\/>)?<\/w:rPr><w:t xml:space="preserve">([^<]*)<\/w:t><\/w:r>/g)]
    .map(m => ({font: m[1], color: m[2], pt: Number(m[3]) / 2, sub: Boolean(m[4]), text: m[5]}));
}

test('DOCX 是完整可開啟的 OOXML 封包（CRC 正確、必要部件齊全）', async () => {
  const files = readZip(await docBytes(makeScore()));
  assert.deepEqual(Object.keys(files).sort(), ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']);
  assert.match(files['_rels/.rels'], /Target="word\/document\.xml"/);
  assert.match(files['[Content_Types].xml'], /wordprocessingml\.document\.main\+xml/);
  assert.match(files['word/document.xml'], /^<\?xml[^>]*\?><w:document /);
});

test('頁面為 A4 直式（11906×16838 twips），且不強制橫向', async () => {
  const xml = readZip(await docBytes(makeScore()))['word/document.xml'];
  assert.match(xml, /<w:pgSz w:w="11906" w:h="16838"\/>/);
  assert.doesNotMatch(xml, /w:orient="landscape"/);
});

test('標題標楷體 22pt 置中；簡譜 01SMN 14pt；歌詞標楷體 13.5pt', async () => {
  const xml = readZip(await docBytes(makeScore()))['word/document.xml'];
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
    assert.deepEqual([r.font, r.pt], ['標楷體', 13.5], `歌詞「${ch}」字型或字級不符`);
  }
});

test('和弦為 Times New Roman 深紅 #9C2323，只有和弦數字使用原生下標', async () => {
  const all = runs(readZip(await docBytes(makeScore()))['word/document.xml']);
  const chord = all.filter(r => r.font === 'Times New Roman');
  assert.deepEqual(chord.map(r => [r.text, r.sub]), [['C', false], ['7', true], ['Gm', false], ['7', true]]);
  assert.ok(chord.every(r => r.color === '9C2323' && r.pt === 10));
  // 簡譜音符的數字絕不可下標。
  assert.ok(all.filter(r => r.font === '01SMN').every(r => !r.sub));
  // 和弦以外的文字顏色不可被染成深紅。
  assert.ok(all.filter(r => r.font !== 'Times New Roman').every(r => r.color === '000000'));
});

test('節次「一、二、」只在各節第一個字前出現一次，且歌詞逐字保留', async () => {
  const all = runs(readZip(await docBytes(makeScore()))['word/document.xml']);
  const lyricText = all.filter(r => r.font === '標楷體' && r.pt === 13.5).map(r => r.text);
  assert.equal(lyricText.filter(t => t === '一、').length, 1);
  assert.equal(lyricText.filter(t => t === '二、').length, 1);
  assert.deepEqual(lyricText.filter(t => /\p{Script=Han}/u.test(t) && !t.endsWith('、')).sort(), ['丁', '丙', '乙', '甲']);
});

test('排版寬度不超出 A4 可用寬度（538.6 pt），各行共同左緣', () => {
  const {systems, offset} = layout(makeScore());
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
  const xml = readZip(await docBytes(s))['word/document.xml'];
  assert.match(xml, /A&amp;B &lt;&quot;x&quot;&gt; &apos;y&apos;/);
  assert.doesNotMatch(xml, /A&B/);
});
