// 煙霧測試用的極簡靜態伺服器（只用 Node 內建模組，不增加依賴）。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8'};

export function startServer(port = 0) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(root, '.' + rel);
    // 只服務專案目錄內的檔案，且不提供私人資料夾與隱藏檔。
    if (!file.startsWith(root + path.sep) || /(^|[\\/])(private|\.[^\\/]+)([\\/]|$)/.test(path.relative(root, file))) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream'}).end(data);
    });
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve({server, url: `http://127.0.0.1:${server.address().port}/`})));
}
