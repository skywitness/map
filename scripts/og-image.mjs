#!/usr/bin/env node
/**
 * 分享預覽圖（index.html 的 og:image）：用無頭 Chrome 從網站截一顆地球（人均 GDP，預設視角亞洲在中間），
 * 排成 1200×630 的卡片，存成 public/og-image.jpg。
 *
 *   node scripts/og-image.mjs [網址，預設 http://localhost:5173/]
 *
 * 先開開發伺服器（npm run dev）或用正式網站的網址。需要 puppeteer-core 與系統的 Chrome（跟 check-en-ui.mjs 一樣：
 * PUPPETEER_CORE=<含 node_modules/puppeteer-core 的資料夾>、CHROME_PATH=<chrome 執行檔>）。
 * 卡片上的中文用系統字型（Windows 的微軟正黑體），所以在 Windows 上產生。
 */
import { existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] ?? 'http://localhost:5173/';
const OUT = fileURLToPath(new URL('../public/og-image.jpg', import.meta.url));

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
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error('找不到 Chrome，請設定 CHROME_PATH');
  return found;
}

const CARD = (globe) => `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; position: relative; color: #f0efec;
    font-family: 'Microsoft JhengHei', 'Noto Sans TC', 'Segoe UI', sans-serif;
    /* 跟地圖的太空一樣（src/theme/tokens.ts 的 SPACE_GRADIENT） */
    background: radial-gradient(circle at 74% 50%, #0b1220 0, #04070d 55%, #000 100%); }
  .globe { position: absolute; right: -150px; top: 50%; width: 760px; transform: translateY(-50%);
    -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 62%, transparent 72%); }
  .text { position: absolute; left: 72px; top: 160px; width: 620px; }
  h1 { font-size: 76px; font-weight: 700; letter-spacing: 2px; }
  .en { margin-top: 6px; font-size: 30px; font-weight: 600; color: #9ebdff; letter-spacing: 1px; }
  .sub { margin-top: 36px; font-size: 30px; line-height: 1.5; color: #d6d4cc; }
  .groups { margin-top: 30px; display: flex; gap: 8px; }
  .groups span { padding: 5px 13px; border-radius: 999px; background: rgba(255,255,255,0.1); font-size: 20px; white-space: nowrap; }
  .credit { position: absolute; left: 72px; bottom: 26px; font-size: 15px; color: #898781; }
</style></head><body>
  <img class="globe" src="${globe}">
  <div class="text">
    <h1>世界資料地圖</h1>
    <div class="en">World Data Map</div>
    <div class="sub">用地球儀瀏覽各國資料<br>近 80 個主題，可以拖時間軸看變化</div>
    <div class="groups"><span>社會</span><span>經濟</span><span>國際</span><span>能源</span><span>科技與交通</span><span>地理</span></div>
  </div>
  <div class="credit">圖：人均 GDP（IMF）· 底圖 © OpenStreetMap contributors · OpenMapTiles · OpenFreeMap · 國界 Natural Earth</div>
</body></html>`;

const browser = await loadPuppeteer().launch({
  executablePath: chromePath(),
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  // 1. 地球：把按鈕、圖例、版權標示藏起來（版權寫在卡片上）
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 1180 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.goto(`${base}?topic=income`, { waitUntil: 'networkidle2', timeout: 120_000 });
  await new Promise((r) => setTimeout(r, 6000));
  await page.addStyleTag({ content: '.map-zoom, .map-legend, .maplibregl-ctrl, .map-status { display: none !important; }' });
  await new Promise((r) => setTimeout(r, 500));
  const globe = await (await page.$('.map-canvas')).screenshot({ type: 'png' });
  await page.close();

  // 2. 卡片
  const card = await browser.newPage();
  await card.setViewport({ width: 1200, height: 630 });
  await card.setContent(CARD(`data:image/png;base64,${Buffer.from(globe).toString('base64')}`));
  await new Promise((r) => setTimeout(r, 500));
  const jpg = await card.screenshot({ type: 'jpeg', quality: 86 });
  writeFileSync(OUT, jpg);
  console.log(`已寫入 ${OUT}（${Math.round(jpg.length / 1024)} KB）`);
} finally {
  await browser.close();
}
