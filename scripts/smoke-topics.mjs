#!/usr/bin/env node
/**
 * 冒煙測試：用無頭 Chrome 把每個主題打開一次（預設指標、地圖），有頁面錯誤或主控台錯誤就失敗。
 * GitHub Actions 的「檢查」每次推送都跑（.github/workflows/check.yml）；本機：
 *
 *   npm run build && npm run smoke                 用 serve-pages.mjs 開 dist（模擬 GitHub Pages）
 *   npm run smoke -- http://localhost:5173/        量已經開著的網址（開發伺服器）
 *   SMOKE_TOPICS=fertility,trade npm run smoke     只開這幾個主題
 *
 * 主題清單讀 src/topics/catalog.gen.ts。底圖、地形圖磚等外部服務的網路錯誤不算（離線、對方暫時連不上）。
 * 需要 puppeteer-core（不在 package.json）：npm i --no-save puppeteer-core；Chrome 路徑可用 CHROME_PATH 指定。
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const given = process.argv.slice(2).find((a) => /^https?:/.test(a));
const only = (process.env.SMOKE_TOPICS ?? '').split(',').filter(Boolean);
/** 每個主題最多等多久地圖畫出資料（performance.mark('map-data')）；畫不出資料的主題（貿易要先點國家）等到這時候 */
const SETTLE_MS = Number(process.env.SMOKE_SETTLE_MS ?? 8000);

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

/** 主題目錄（catalog.gen.ts）裡的主題 id，順序跟頂列選單一樣 */
function topicIds() {
  const source = readFileSync(`${ROOT}src/topics/catalog.gen.ts`, 'utf8');
  return [...source.matchAll(/^ {4}"([\w-]+)": \{/gm)].map((m) => m[1]);
}

/** 沒給網址時用 serve-pages.mjs 開 dist，等它印出網址 */
function serveDist() {
  if (!existsSync(`${ROOT}dist/index.html`)) throw new Error('沒有 dist：先跑 npm run build');
  const port = 4300 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, [`${ROOT}scripts/serve-pages.mjs`, `${ROOT}dist`, String(port)], { stdio: 'ignore' });
  return { url: `http://localhost:${port}/map/`, stop: () => child.kill() };
}

const server = given ? null : serveDist();
const base = given ?? server.url;
const puppeteer = loadPuppeteer();
const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: 'new',
  // 用 root 跑（容器裡）時 Chrome 不開沙箱就不肯啟動
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,800', ...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])],
});
const problems = [];
let current = '';
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('pageerror', (e) => problems.push(`${current}：頁面錯誤 ${String(e.message ?? e).slice(0, 300)}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // 外部服務（底圖、地形圖磚）的網路錯誤不算
    if (/Failed to load resource|net::ERR|AJAXError|ERR_INTERNET_DISCONNECTED/.test(text)) return;
    problems.push(`${current}：主控台錯誤 ${text.slice(0, 300)}`);
  });
  // 等伺服器起來
  for (let i = 0; i < 50; i++) {
    const ok = await fetch(base).then((r) => r.ok, () => false);
    if (ok) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  const ids = only.length ? only : topicIds();
  for (const id of ids) {
    current = id;
    const started = Date.now();
    await page.goto(`${base}?topic=${id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page
      .waitForFunction(() => performance.getEntriesByName('map-data').length > 0, { timeout: SETTLE_MS, polling: 200 })
      .catch(() => {});
    // 畫出資料之後再留一點時間給延後的工作（1:50m 國界、預先下載其他指標）
    await new Promise((r) => setTimeout(r, 1500));
    const title = await page.$eval('.topic-current, .topic-pure', (el) => el.textContent?.trim()).catch(() => '');
    console.log(`${id}（${title || '?'}）${Date.now() - started} ms`);
  }
} finally {
  await browser.close();
  server?.stop();
}

if (problems.length) {
  console.log(`\n${problems.length} 個錯誤：`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log('\n每個主題都打開了，沒有錯誤。');
