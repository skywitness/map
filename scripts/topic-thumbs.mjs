#!/usr/bin/env node
/**
 * 主題總覽（src/controls/TopicsOverview.tsx）與主題選單的縮圖：每個主題的預設指標畫成一張平面世界地圖，
 * 藏起地名、按鈕、圖例與版權標示（版權寫在總覽的頁尾），縮成 480×280 的 WebP 存到 public/thumbs/<主題>.webp，
 * 另外存一張 240×140 的到 public/thumbs/s/（總覽在一般解析度的螢幕上用，srcset）。
 *
 *   npm run dev            （另一個終端機；用開發模式的 window.__map、window.__topics）
 *   node scripts/topic-thumbs.mjs [開發伺服器網址，預設 http://localhost:5173/] [主題 id …，預設全部]
 *
 * 需要 puppeteer-core 與系統的 Chrome（跟 check-en-ui.mjs 一樣：PUPPETEER_CORE、CHROME_PATH）。
 * WebGL 用 SwiftShader 畫，一個主題約 5–10 秒，全部約 10 分鐘，很吃 CPU，不要跟 check:en 同時跑。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const [base = 'http://localhost:5173/', ...only] = process.argv.slice(2);
const OUT_DIR = fileURLToPath(new URL('../public/thumbs/', import.meta.url));
const WIDTH = 480;
const HEIGHT = 280;
/** 小縮圖（public/thumbs/s/）是一半大小 */
const SMALL = 0.5;

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

/** 地圖放大成固定大小、蓋住整頁，其他東西藏起來 */
const ISOLATE = `
  .stage-main { position: fixed !important; inset: 0 auto auto 0 !important; width: ${WIDTH * 2}px !important;
    height: ${HEIGHT * 2}px !important; margin: 0 !important; border: 0 !important; border-radius: 0 !important; z-index: 1000; }
  .map-zoom, .map-legend, .maplibregl-ctrl, .map-status, .map-hint, .map-overlay, .sheet, .panel { display: none !important; }
`;

/**
 * 資料只在一小塊地方的主題（2026-10-30 起，企鵝在哪裡、南極的冰下湖：南極；油棕園：東南亞）：縮圖改看那裡。
 * center 是中心的經緯度，zoom 是比整個世界放大幾級
 */
const VIEWS = {
  penguins: { center: [-5, -66], zoom: 0.7 },
  'oil-palm': { center: [108, 1], zoom: 2.3 },
  'subglacial-lakes': { center: [20, -77], zoom: 0.5 },
};

mkdirSync(`${OUT_DIR}s/`, { recursive: true });
const browser = await loadPuppeteer().launch({
  executablePath: chromePath(),
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  // 底圖固定用彩色地形（瀏覽器設定檔裡記著的底圖不算）
  await page.evaluateOnNewDocument(() => localStorage.setItem('basemap', 'terrain'));
  await page.goto(base, { waitUntil: 'networkidle2', timeout: 120_000 });
  const topics = only.length ? only : await page.evaluate(() => window.__topics);
  for (const id of topics) {
    const started = Date.now();
    await page.goto(`${base}?topic=${id}`, { waitUntil: 'networkidle2', timeout: 120_000 });
    await page.addStyleTag({ content: ISOLATE });
    await page.waitForFunction(() => window.__map?.isStyleLoaded(), { timeout: 60_000 });
    // 換成平面地圖、藏起地名，整個世界放進畫面（麥卡托：寬度剛好是地球一圈）
    await page.evaluate(() => {
      document.querySelector('.map-zoom button[aria-label*="平面"], .map-zoom button[aria-label*="flat"]')?.click();
    });
    await new Promise((r) => setTimeout(r, 1500));
    await page.evaluate((w, view) => {
      const m = window.__map;
      m.resize();
      for (const layer of m.getStyle().layers) {
        // 只藏底圖的地名（openmaptiles，世界視角的是 openmaptiles--world），資料的符號（國旗主題小國的國旗）照畫
        if (layer.type === 'symbol' && layer.source?.startsWith('openmaptiles')) m.setLayoutProperty(layer.id, 'visibility', 'none');
      }
      m.jumpTo({ center: view?.center ?? [12, 18], zoom: Math.log2(w / 512) + (view?.zoom ?? 0), bearing: 0, pitch: 0 });
    }, WIDTH * 2, VIEWS[id]);
    // 圖磚與資料都畫好：等 idle，最多 20 秒
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const m = window.__map;
          const timer = setTimeout(resolve, 20_000);
          m.once('idle', () => {
            clearTimeout(timer);
            resolve();
          });
          m.triggerRepaint();
        }),
    );
    await new Promise((r) => setTimeout(r, 800));
    const png = await (await page.$('.stage-main')).screenshot({ type: 'png' });
    // 縮小成一半與四分之一：在瀏覽器的 canvas 裡畫，輸出 WebP
    const [webp, small] = await page.evaluate(
      async (src, sizes) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        return sizes.map(([w, h, quality]) => {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          return canvas.toDataURL('image/webp', quality);
        });
      },
      `data:image/png;base64,${Buffer.from(png).toString('base64')}`,
      [
        [WIDTH, HEIGHT, 0.78],
        [WIDTH * SMALL, HEIGHT * SMALL, 0.8],
      ],
    );
    const bytes = Buffer.from(webp.split(',')[1], 'base64');
    writeFileSync(`${OUT_DIR}${id}.webp`, bytes);
    writeFileSync(`${OUT_DIR}s/${id}.webp`, Buffer.from(small.split(',')[1], 'base64'));
    console.log(`${id}\t${Math.round(bytes.length / 1024)} KB\t${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
} finally {
  await browser.close();
}
