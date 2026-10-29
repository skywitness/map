#!/usr/bin/env node
/**
 * 每個主題的分享預覽圖（t/<主題>/index.html 的 og:image，vite.config.ts 的 topicPages）：1200×630 的卡片，
 * 跟網站的預覽圖（og-image.mjs）同一種深藍底，左邊是分類（代表色的圖示）、主題名稱與指標，右邊是主題總覽的縮圖
 * （public/thumbs/<主題>.webp，scripts/topic-thumbs.mjs），存成 public/og/<主題>.jpg。
 *
 *   node scripts/og-topics.mjs [主題 id …，預設全部]
 *
 * 不用開發伺服器（卡片自己排）。需要 puppeteer-core 與 Chrome（跟 check-en-ui.mjs 一樣：PUPPETEER_CORE、CHROME_PATH）。
 * 中文字型：設 OG_FONT_DIR=<@fontsource/noto-sans-tc 的資料夾>（npm i @fontsource/noto-sans-tc 到任何地方）就用思源黑體，
 * 沒設時用系統字型（Windows 的微軟正黑體）。新增主題、主題名稱或指標改了、縮圖重做之後重跑。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'public/og');
const only = process.argv.slice(2);
const FONT_DIR = process.env.OG_FONT_DIR;

function loadPuppeteer() {
  const require = createRequire(import.meta.url);
  const paths = process.env.PUPPETEER_CORE ? [process.env.PUPPETEER_CORE] : undefined;
  const mod = require(require.resolve('puppeteer-core', paths && { paths }));
  return mod.launch ? mod : mod.default;
}

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error('找不到 Chrome，請設定 CHROME_PATH');
  return found;
}

// ── 主題、分類、圖示與顏色（都從原始碼讀，跟網站一致）──
const catalog = [...readFileSync(join(ROOT, 'src/topics/catalog.gen.ts'), 'utf8').matchAll(/^ {4}"[\w-]+": (\{.*\}),$/gm)].map((m) =>
  JSON.parse(m[1]),
);
const registry = readFileSync(join(ROOT, 'src/topics/registry.ts'), 'utf8');
const groups = [...registry.matchAll(/\{ id: '([\w-]+)', label: \{ zh: '([^']+)'.*?topics: \[([^\]]*)\]/g)].map((m) => ({
  id: m[1],
  label: m[2],
  topics: [...m[3].matchAll(/'([\w-]+)'/g)].map((t) => t[1]),
}));
const groupOf = new Map(groups.flatMap((g) => g.topics.map((t) => [t, g])));
const iconsOf = (file) =>
  Object.fromEntries([...readFileSync(join(ROOT, file), 'utf8').matchAll(/^ {2}"([\w-]+)": ("[^\n]*"), \/\/ /gm)].map((m) => [m[1], JSON.parse(m[2])]));
const topicIcons = iconsOf('src/topics/icons.gen.ts');
const groupIcons = iconsOf('src/topics/groupIcons.gen.ts');
const tokens = readFileSync(join(ROOT, 'src/theme/tokens.ts'), 'utf8');
const lightColors = /light: \{ society: '([^']+)', economy: '([^']+)', global: '([^']+)', energy: '([^']+)', tech: '([^']+)', geo: '([^']+)' \}/.exec(tokens);
if (!lightColors) throw new Error('tokens.ts 裡找不到 CATEGORY_COLORS 的淺色');
const COLORS = Object.fromEntries(['society', 'economy', 'global', 'energy', 'tech', 'geo'].map((k, i) => [k, lightColors[i + 1]]));

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function card(topic) {
  const group = groupOf.get(topic.id);
  const color = group ? COLORS[group.id] : '#52514e';
  const icon = topic.id === 'map' ? groupIcons.map : topicIcons[topic.id];
  const labels = topic.pure ? [] : topic.indicators.map((i) => i.label.zh);
  const shown = labels.slice(0, 5);
  // 括號裡的補充（「國家小檔案（首都、元首…）」）下面的指標已經列了，卡片上不寫；字級依長度，一行放得下就一行
  const title = topic.title.zh.replace(/（[^）]*）$/, '');
  const size = title.length <= 8 ? 62 : title.length <= 10 ? Math.floor(490 / title.length) : 46;
  const fontLinks = FONT_DIR ? '<link rel="stylesheet" href="/font/500.css"><link rel="stylesheet" href="/font/700.css">' : '';
  return `<!doctype html><html><head><meta charset="utf-8">${fontLinks}<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; position: relative; color: #f0efec;
    font-family: 'Noto Sans TC', 'Microsoft JhengHei', 'Segoe UI', sans-serif;
    /* 跟網站的預覽圖、地圖的太空一樣（src/theme/tokens.ts 的 SPACE_GRADIENT） */
    background: radial-gradient(circle at 76% 46%, #1d3157 0, #0c1830 45%, #050a14 100%); }
  .bar { position: absolute; left: 0; top: 0; width: 100%; height: 10px; background: ${color}; }
  .text { position: absolute; left: 68px; top: 92px; width: 500px; }
  .group { display: flex; align-items: center; gap: 14px; font-size: 26px; font-weight: 500; color: #c3c2b7; }
  .icon { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: ${color};
    box-shadow: 0 0 0 3px rgba(255,255,255,0.12); }
  h1 { margin-top: 30px; font-size: ${size}px; font-weight: 700; line-height: 1.2; letter-spacing: 1px; }
  .inds { display: flex; flex-wrap: wrap; margin-top: 26px; font-size: 25px; line-height: 1.55; color: #d6d4cc; font-weight: 500; }
  .inds span { white-space: nowrap; }
  /* 分隔點接在前一項後面，換行時新的一行不會以「・」開頭 */
  .inds span:not(:last-child)::after { content: '・'; color: #898781; }
  .map { position: absolute; right: 52px; top: 132px; width: 560px; height: 327px; border-radius: 18px; overflow: hidden;
    border: 1px solid rgba(255,255,255,0.16); box-shadow: 0 18px 50px rgba(0,0,0,0.45); background: #9ebdff; }
  .map img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .brand { position: absolute; left: 68px; bottom: 54px; display: flex; align-items: baseline; gap: 14px; }
  .brand b { font-size: 30px; font-weight: 700; }
  .brand span { font-size: 22px; color: #9ebdff; font-weight: 500; }
  .url { position: absolute; right: 52px; bottom: 58px; font-size: 22px; color: #c3c2b7; }
  .credit { position: absolute; left: 68px; bottom: 20px; font-size: 14px; color: #898781; }
</style></head><body>
  <div class="bar"></div>
  <div class="text">
    <div class="group">
      <span class="icon"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${icon}"/></svg></span>
      ${escape(group ? group.label : '地圖')}
    </div>
    <h1>${escape(title)}</h1>
    ${shown.length ? `<div class="inds">${shown.map((l) => `<span>${escape(l)}</span>`).join('')}${labels.length > shown.length ? '<span>…</span>' : ''}</div>` : ''}
  </div>
  <div class="map"><img src="/thumb/${topic.id}.webp"></div>
  <div class="brand"><b>世界資料地圖</b><span>World Data Map</span></div>
  <div class="url">skywitness.github.io/map</div>
  <div class="credit">地圖：主題的預設指標 · 底圖 © OpenStreetMap contributors · OpenMapTiles · OpenFreeMap · 國界 Natural Earth</div>
</body></html>`;
}

// ── 小小的伺服器：卡片、縮圖、字型（setContent 的頁面不能讀本機檔案）──
const TYPES = { '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.html': 'text/html; charset=utf-8' };
const pages = new Map();
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = null;
  if (url.pathname.startsWith('/card/')) {
    const html = pages.get(url.pathname.slice(6));
    if (html) {
      res.writeHead(200, { 'content-type': TYPES['.html'] });
      res.end(html);
      return;
    }
  } else if (url.pathname.startsWith('/thumb/')) file = join(ROOT, 'public/thumbs', normalize(url.pathname.slice(7)));
  else if (url.pathname.startsWith('/font/') && FONT_DIR) file = join(FONT_DIR, normalize(url.pathname.slice(6)));
  if (file && existsSync(file)) {
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
    return;
  }
  res.writeHead(404);
  res.end();
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

mkdirSync(OUT_DIR, { recursive: true });
const browser = await loadPuppeteer().launch({
  executablePath: chromePath(),
  headless: true,
  args: process.getuid?.() === 0 ? ['--no-sandbox'] : [],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });
  const topics = only.length ? catalog.filter((t) => only.includes(t.id)) : catalog;
  for (const topic of topics) {
    if (!existsSync(join(ROOT, `public/thumbs/${topic.id}.webp`))) {
      console.log(`${topic.id}：沒有縮圖，跳過（先跑 topic-thumbs.mjs）`);
      continue;
    }
    pages.set(topic.id, card(topic));
    await page.goto(`http://127.0.0.1:${port}/card/${topic.id}`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 84 });
    writeFileSync(join(OUT_DIR, `${topic.id}.jpg`), jpg);
    console.log(`${topic.id}\t${Math.round(jpg.length / 1024)} KB`);
  }
} finally {
  await browser.close();
  server.close();
}
