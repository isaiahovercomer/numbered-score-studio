// 測試共用：最小 ZIP 讀取器（wordBlob 只使用「儲存（不壓縮）」模式）。
import assert from 'node:assert/strict';

export function readZip(bytes) {
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
