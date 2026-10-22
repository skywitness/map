#!/usr/bin/env node
/**
 * 模擬 GitHub Pages 的靜態伺服器，給載入速度量測用（DESIGN.md 第 13 節）：
 * 網站在 /map/ 子路徑、文字檔 gzip、Cache-Control: max-age=600、弱 ETag 與 304。
 *
 *   node scripts/serve-pages.mjs [目錄=dist] [port=4173] [cache-control=max-age=600]
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';

const [root = 'dist', portArg = '4173', cacheControl = 'max-age=600'] = process.argv.slice(2);
const BASE = '/map/';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const COMPRESS = /\.(html|js|mjs|css|json|webmanifest|svg)$/;
const gzipped = new Map();

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/map') {
      res.writeHead(301, { Location: BASE + url.search });
      return res.end();
    }
    if (!url.pathname.startsWith(BASE)) {
      res.writeHead(404);
      return res.end();
    }
    let rel = decodeURIComponent(url.pathname.slice(BASE.length));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.join(root, rel);
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      res.writeHead(404);
      return res.end();
    }
    const ext = path.extname(file);
    const etag = `W/"${stat.mtimeMs.toString(16)}-${stat.size.toString(16)}"`;
    const headers = {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': cacheControl,
      'Last-Modified': stat.mtime.toUTCString(),
      ETag: etag,
      'Access-Control-Allow-Origin': '*',
      Vary: 'Accept-Encoding',
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      return res.end();
    }
    let body = fs.readFileSync(file);
    if (COMPRESS.test(ext) && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
      const key = file + etag;
      if (!gzipped.has(key)) gzipped.set(key, zlib.gzipSync(body));
      body = gzipped.get(key);
      headers['Content-Encoding'] = 'gzip';
    }
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    res.end(body);
  })
  .listen(Number(portArg), () => console.log(`http://localhost:${portArg}${BASE}（${root}，${cacheControl}）`));
