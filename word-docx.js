// DOCX 底層：XML 跳脫、文字／圖形錨點與未壓縮 ZIP 封裝。只負責產生 OOXML 片段，不含版面計算。
const enc = new TextEncoder();
// 先移除 XML 1.0 不允許的控制字元（從 PDF 或網頁貼上時常夾帶 \u000B、\u000C 等），否則 Word 會判定檔案毀損。
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;
const esc = s =>
  String(s)
    .replace(XML_INVALID, '')
    .replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'})[c]);
export function run(text, font, size, color = '000000', sub = false, ascii = font, italic = false) {
  return `<w:r><w:rPr><w:rFonts w:ascii="${ascii}" w:hAnsi="${ascii}" w:eastAsia="${font}"/>${italic ? '<w:i/>' : ''}<w:color w:val="${color}"/><w:sz w:val="${size * 2}"/>${sub ? `<w:vertAlign w:val="${sub === 'super' ? 'superscript' : 'subscript'}"/>` : ''}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}
// 內文歌詞段落：每項一個左定位點（twip，相對左邊界）＋ Tab ＋文字。pPr 子元素須依 OOXML 順序。
// items = [{pos, text}]（pos 單位 pt，由小到大）；last = 本列最後一節（不加 keepNext、加段後距 after）。
export function lyricParagraph(items, {last = false, after = 0, font, size, ascii, line}) {
  if (items.length > 64) throw Error('一行歌詞超過 64 個定位點，Word 無法開啟；請把版面改窄或分行。');
  const tabs = items.map(it => `<w:tab w:val="left" w:pos="${Math.round(it.pos * 20)}"/>`).join('');
  const pPr =
    `<w:pPr>${last ? '' : '<w:keepNext/>'}<w:tabs>${tabs}</w:tabs>` +
    '<w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/><w:snapToGrid w:val="0"/>' +
    `<w:spacing w:before="0" w:after="${last ? after : 0}" w:line="${Math.round(line * 20)}" w:lineRule="exact"/>` +
    '<w:ind w:left="0" w:right="0" w:firstLine="0"/><w:jc w:val="left"/></w:pPr>';
  const runs = items.map(it => '<w:r><w:tab/></w:r>' + run(it.text, font, size, '000000', false, ascii)).join('');
  return `<w:p>${pPr}${runs}</w:p>`;
}
let shapeId = 0;
export const resetShapeIds = () => {
  shapeId = 0;
};
const emu = v => Math.round(v * 12700);
function anchor(x, y, w, h, inner) {
  return (
    `<w:r><w:drawing>` +
    `<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${++shapeId}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">` +
    `<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>${emu(x)}</wp:posOffset>` +
    `</wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${emu(y)}</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="${emu(w)}" cy="${emu(h)}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>` +
    `<wp:docPr id="${shapeId}" name="Score ${shapeId}"/><wp:cNvGraphicFramePr/><a:graphic>` +
    `<a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp>` +
    `<wps:cNvSpPr txBox="1"/>${inner}</wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`
  );
}
export function box(text, x, y, w, h, font, size, color = '000000', chord = false, ascii = font) {
  const content = chord
    ? text
        .split(/(\d+|[\u266F\u266D])/) // 和弦數字原生下標；♯／♭（只在 lsm 出現）原生上標
        .filter(Boolean)
        .map(t => run(t, font, size, color, /^\d+$/.test(t) || (/^[\u266F\u266D]$/.test(t) && 'super')))
        .join('')
    : run(text, font, size, color, false, ascii);
  return anchor(
    x,
    y,
    w,
    h,
    `<wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></wps:spPr><wps:txbx><w:txbxContent><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${Math.round(h * 20)}" w:lineRule="exact"/><w:jc w:val="${chord ? 'center' : 'left'}"/></w:pPr>${content}</w:p></w:txbxContent></wps:txbx><wps:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></wps:bodyPr>`
  );
}
export function tie(x, y, width) {
  if (width < 2) return '';
  const w = emu(width),
    h = emu(5),
    edge = Math.min(emu(7), w / 3);
  return anchor(
    x,
    y,
    width,
    5,
    `<wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="${w}" h="${h}" fill="none"><a:moveTo><a:pt x="0" y="${h}"/></a:moveTo><a:cubicBezTo><a:pt x="0" y="0"/><a:pt x="${edge}" y="0"/><a:pt x="${edge}" y="0"/></a:cubicBezTo><a:lnTo><a:pt x="${w - edge}" y="0"/></a:lnTo><a:cubicBezTo><a:pt x="${w - edge}" y="0"/><a:pt x="${w}" y="0"/><a:pt x="${w}" y="${h}"/></a:cubicBezTo></a:path></a:pathLst></a:custGeom><a:noFill/><a:ln w="6350"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></wps:spPr><wps:bodyPr/>`
  );
}
export function zipStore(files) {
  const chunks = [],
    central = [];
  let offset = 0;
  const u16 = n => [n & 255, (n >>> 8) & 255],
    u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const crc = data => {
    let c = 0xffffffff;
    for (const b of data) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  for (const [name, text] of Object.entries(files)) {
    const n = enc.encode(name),
      b = enc.encode(text),
      c = crc(b);
    const header = new Uint8Array([
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(33),
      ...u32(c),
      ...u32(b.length),
      ...u32(b.length),
      ...u16(n.length),
      ...u16(0),
      ...n
    ]);
    chunks.push(header, b);
    central.push(
      new Uint8Array([
        ...u32(0x02014b50),
        ...u16(20),
        ...u16(20),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(33),
        ...u32(c),
        ...u32(b.length),
        ...u32(b.length),
        ...u16(n.length),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(0),
        ...u32(offset),
        ...n
      ])
    );
    offset += header.length + b.length;
  }
  const size = central.reduce((n, c) => n + c.length, 0);
  return new Blob(
    [
      ...chunks,
      ...central,
      new Uint8Array([
        ...u32(0x06054b50),
        ...u16(0),
        ...u16(0),
        ...u16(central.length),
        ...u16(central.length),
        ...u32(size),
        ...u32(offset),
        ...u16(0)
      ])
    ],
    {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
  );
}
// 末頁版權行：置於最後一個段落內、相對頁面底部定位（官方約距底 25.5 pt），因此只出現在最後一頁，且不產生多餘空白頁。
export function copyrightAnchor(text, o) {
  const w = 360,
    h = 14;
  shapeId++;
  return (
    `<w:r><w:drawing>` +
    `<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${shapeId}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">` +
    `<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:align>center</wp:align></wp:positionH>` +
    `<wp:positionV relativeFrom="page"><wp:posOffset>${emu(o.pageH - 36.5)}</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="${emu(w)}" cy="${emu(h)}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>` +
    `<wp:docPr id="${shapeId}" name="Copyright ${shapeId}"/><wp:cNvGraphicFramePr/><a:graphic>` +
    `<a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp>` +
    `<wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></wps:spPr><wps:txbx>` +
    `<w:txbxContent><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${h * 20}" w:lineRule="exact"/>` +
    `<w:jc w:val="center"/>` +
    `</w:pPr>${run(text, o.textFont, 10, '000000', false, 'New Century Schoolbook', true)}</w:p></w:txbxContent>` +
    `</wps:txbx><wps:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></wps:bodyPr></wps:wsp>` +
    `</a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`
  );
}
