// 守住 AGENTS.md 的程式風格規則：依 .prettierrc.json 寬 120，不寫超長單行。
// 行長以 Unicode 字元（code point）計算。新檔與已整理的檔案（例如 musicxml.js）一律不得超過 120 字；
// 尚未整理的舊檔列在 LEGACY，記錄目前的超長行數，只准減少、不准增加（逐步整理時把數字調低或移除該項）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const MAX = JSON.parse(fs.readFileSync(path.join(root, '.prettierrc.json'), 'utf8')).printWidth;
// 第三方壓縮檔，不在風格規則範圍內。
const VENDOR = new Set(['lame.min.js']);
// 2026-10-19 的現況（超過 120 字的行數）。
const LEGACY = {
  'analysis-worker.js': 1,
  'audio-analysis.js': 17,
  'audio.js': 11,
  'e2e/serve.mjs': 3,
  'e2e/smoke.spec.mjs': 5,
  'encode-worker.js': 2,
  'font-metrics.js': 1,
  'gen-wording-doc.mjs': 10,
  'golden-docx.test.js': 7,
  'music.js': 15,
  'music.test.js': 7,
  'musicxml.test.js': 20,
  'repo-hygiene.test.js': 3,
  'score-bridge.js': 8,
  'score-edit.test.js': 2,
  'word-docx.js': 5,
  'word-export.js': 10,
  'word-layout.test.js': 2,
  'wording-rules.js': 57,
  'wording.js': 9,
  'wording.test.js': 14,
  'worker.js': 18,
  'worker.test.js': 6
};

function sourceFiles() {
  let list;
  try {
    list = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '*.js', '*.mjs'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe']
    })
      .toString('utf8')
      .split('\0');
  } catch {
    list = fs.readdirSync(root).filter(f => /\.m?js$/.test(f));
  }
  return list.filter(f => f && !f.startsWith('node_modules/') && fs.existsSync(path.join(root, f)));
}
const longLines = file =>
  fs
    .readFileSync(path.join(root, file), 'utf8')
    .split('\n')
    .map((line, i) => ({line: i + 1, width: [...line].length}))
    .filter(x => x.width > MAX);

test('行寬上限取自 .prettierrc.json（120）', () => {
  assert.equal(MAX, 120);
});

test('musicxml.js 沒有超過 120 字的行', () => {
  assert.deepEqual(longLines('musicxml.js'), []);
});

test('新檔與已整理的檔案沒有超長行；舊檔的超長行數只准減少', () => {
  const files = sourceFiles();
  assert.ok(files.includes('musicxml.js'), '找不到原始碼清單');
  for (const file of files) {
    if (VENDOR.has(file)) continue;
    const found = longLines(file);
    const allowed = LEGACY[file] ?? 0;
    assert.ok(
      found.length <= allowed,
      `${file} 有 ${found.length} 行超過 ${MAX} 字（上限 ${allowed}）：第 ${found.map(x => x.line).join('、')} 行`
    );
  }
});

test('LEGACY 清單不留過時項目（檔案已不存在或已整理完就要移除）', () => {
  const files = new Set(sourceFiles());
  for (const [file, count] of Object.entries(LEGACY)) {
    assert.ok(files.has(file), `LEGACY 列了不存在的檔案：${file}`);
    assert.ok(count > 0 && longLines(file).length > 0, `${file} 已無超長行，請從 LEGACY 移除`);
  }
});
