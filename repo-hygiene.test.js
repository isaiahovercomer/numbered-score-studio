// 守住使用者的儲存庫規則：金鑰、私人 01SMN 字型、音檔、歌詞不得進 repo。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const SKIP_DIRS = new Set(['.git', 'node_modules', '.wrangler']);
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out); else out.push(path.relative(root, full));
  }
  return out;
}
const files = walk(root);

test('儲存庫不含字型檔（私人 01SMN 不得公開散布）', () => {
  const fonts = files.filter(f => /\.(ttf|otf|ttc|woff2?|eot)$/i.test(f) || /01SMN/i.test(path.basename(f)));
  assert.deepEqual(fonts, []);
});

test('儲存庫只允許既有音色 MP3，不得夾帶私人錄音、MIDI 或歌詞檔', () => {
  const samples = JSON.parse(fs.readFileSync(path.join(root, 'samples.json'), 'utf8'));
  const allowed = new Set();
  for (const inst of Object.values(samples)) for (const s of inst.samples) allowed.add(path.basename(s.url));
  const audio = files.filter(f => /\.(mp3|wav|m4a|aac|flac|ogg|mid|midi)$/i.test(f));
  assert.deepEqual(audio.filter(f => !allowed.has(f)), [], '發現未登記於 samples.json 的音檔');
  assert.deepEqual(files.filter(f => /(lyrics?|歌詞).*\.(txt|docx?)$/i.test(f)), []);
  assert.deepEqual(files.filter(f => /\.docx$/i.test(f)), [], '匯出的 DOCX 不應提交');
});

test('文字檔中沒有 API 金鑰或私密設定的樣式', () => {
  const textFiles = files.filter(f => /\.(js|json|html|css|md|toml|txt|yml)$/i.test(f) && f !== 'lame.min.js');
  const patterns = [/sk-[A-Za-z0-9_-]{20,}/, /ghp_[A-Za-z0-9]{30,}/, /gho_[A-Za-z0-9]{30,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /OPENAI_API_KEY\s*=\s*["']?\S{8,}/];
  for (const f of textFiles) {
    const text = fs.readFileSync(path.join(root, f), 'utf8');
    for (const p of patterns) assert.doesNotMatch(text, p, `${f} 疑似含有秘密`);
  }
});

test('config.json 只含公開的後端網址，不含任何金鑰欄位', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
  assert.deepEqual(Object.keys(config), ['recognitionEndpoint']);
  assert.match(config.recognitionEndpoint, /^https:\/\//);
});

test('.gitignore 排除環境變數檔與私人字型／音檔／匯出檔', () => {
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split('\n').map(l => l.trim());
  for (const rule of ['.env', '.env.*', '.dev.vars', 'node_modules/', '*.ttf', '*.otf', '*.docx', 'private/']) {
    assert.ok(ignore.includes(rule), `.gitignore 缺少 ${rule}`);
  }
});
