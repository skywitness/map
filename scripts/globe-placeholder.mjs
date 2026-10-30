#!/usr/bin/env node
/**
 * 地圖程式還沒載好前先顯示的地球圖（2026-10-30，src/app/GlobePlaceholder.tsx）：開網站的純地圖頁（t/map/），
 * 初始視角（亞洲在中間）的地球儀截圖，地球外面透明，裁成正方形存成 WebP：
 *   public/globe/light.webp（彩色地形）、public/globe/dark.webp（深藍，深色介面沒選過底圖時的預設）
 *
 *   npm run build && node scripts/serve-pages.mjs dist 4173 &
 *   node scripts/globe-placeholder.mjs http://localhost:4173/map/
 *
 * 換了預設底圖、初始視角（worldMapLayers.ts 的 INITIAL_CENTER、fitGlobeZoom）或國界、地名的畫法後重跑。
 * 印出地球直徑佔地圖高度的比例，跟 styles.css 的 .globe-placeholder 的高度對一下。
 * 需要 puppeteer-core 與 Chrome（跟 check-en-ui.mjs 一樣：PUPPETEER_CORE、CHROME_PATH）。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'public/globe');
const base = process.argv[2];
if (!base) throw new Error('用法：node scripts/globe-placeholder.mjs <網站的網址，例如 http://localhost:4173/map/>');

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

/** 截圖時藏起來的東西：地圖上的按鈕、圖例、版權標示、提示 */
const HIDE = `
  .map-zoom, .map-legend, .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-bottom-left, .map-status, .map-hint,
  .map-year, .globe-placeholder { display: none !important; }
  html, body, #root, .app, .stage, .stage-main, .map, .map-canvas { background: transparent !important; }
`;

mkdirSync(OUT_DIR, { recursive: true });
const browser = await loadPuppeteer().launch({
  executablePath: chromePath(),
  headless: true,
  args: ['--use-angle=swiftshader', ...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])],
});
try {
  for (const [name, basemap, theme] of [
    ['light', 'terrain', 'light'],
    ['dark', 'fiord', 'dark'],
  ]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(
      (b, t) => {
        localStorage.setItem('basemap', b);
        localStorage.setItem('theme', t);
        localStorage.setItem('lang', 'zh');
      },
      basemap,
      theme,
    );
    await page.goto(new URL('t/map/', base).href, { waitUntil: 'networkidle0', timeout: 90_000 });
    await page.addStyleTag({ content: HIDE });
    await new Promise((r) => setTimeout(r, 4000));
    const rect = await page.$eval('.map-canvas', (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    const shot = await page.screenshot({ type: 'png', omitBackground: true, clip: rect, encoding: 'base64' });
    // 在頁面裡找出不透明的範圍（地球），裁成正方形轉成 WebP
    const result = await page.evaluate(async (png) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          // 不透明的才算地球（大氣層的光暈、外框的細線是半透明的）
          if (data[(y * c.width + x) * 4 + 3] > 200) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      const size = Math.max(x1 - x0, y1 - y0) + 1;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const out = document.createElement('canvas');
      // 存成 640px：手機、桌機的地球直徑大多在 300–800px 之間
      out.width = out.height = 640;
      out.getContext('2d').drawImage(c, cx - size / 2, cy - size / 2, size, size, 0, 0, 640, 640);
      return {
        url: out.toDataURL('image/webp', 0.8),
        ratio: size / img.height,
        offset: (cy - img.height / 2) / img.height,
      };
    }, shot);
    const bytes = Buffer.from(result.url.split(',')[1], 'base64');
    writeFileSync(join(OUT_DIR, `${name}.webp`), bytes);
    console.log(`${name}\t${Math.round(bytes.length / 1024)} KB\t直徑 / 地圖高度 ${result.ratio.toFixed(3)}\t中心偏移 ${result.offset.toFixed(3)}`);
    await page.close();
  }
} finally {
  await browser.close();
}
