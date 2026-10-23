#!/usr/bin/env node
/**
 * 載入速度量測（DESIGN.md 第 13 節）：用無頭 Chrome 量首次載入與再次載入，桌機與節流的手機（Fast 3G、CPU 4 倍慢）。
 *
 *   npm run measure:load -- <網址> [--runs 3] [--profile desktop|mobile|both] [--offline]
 *
 * 例：先 npm run build，再 node scripts/serve-pages.mjs（模擬 GitHub Pages），
 *     npm run measure:load -- http://localhost:4173/map/；或直接量正式網站 https://skywitness.github.io/map/
 *
 * - 地圖出現資料：WorldMap 第一次把資料畫上地圖時留下的 performance.mark('map-data')；
 *   --mark map-grid 改量人口密度的 1 km 網格第一次畫好（網址要帶 topic=population&ind=density&grid=1）
 * - 傳輸量：頁面的請求（CDP Network.loadingFinished 的 encodedDataLength 加總，含底圖圖磚）。
 *   service worker 背景的下載（預先快取、資料向伺服器確認）不算在內。
 * - --offline：再多一次「離線開啟」（只把頁面設成離線，service worker 從快取回應）
 *
 * 注意（這些都會讓數字亂跳）：
 * - 上一頁關掉後要隔幾秒再開下一次（--gap，預設 8 秒），否則新頁面會被舊頁面的收尾（WebGL、worker）拖慢幾十秒。
 * - 不要用 CDP 接管 service worker 的 target，再次載入偶爾會卡住。
 * - SwiftShader 用 CPU 繪圖，同一台機器跑別的工作時，前後兩次可以差到兩倍：多跑幾輪取中位數。
 *
 * 需要 puppeteer-core（不在 package.json）：npm i --no-save puppeteer-core，或 PUPPETEER_CORE=<含 node_modules/puppeteer-core 的資料夾>；
 * Chrome 路徑可用 CHROME_PATH 指定。
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const url = args.find((a) => /^https?:/.test(a));
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
if (!url) {
  console.error('用法：npm run measure:load -- <網址> [--runs 3] [--profile desktop|mobile|both] [--offline] [--gap 8000] [--mark map-data]');
  process.exit(1);
}
const runs = Number(opt('runs', 3));
const profileArg = opt('profile', 'both');
const profiles = profileArg === 'both' ? ['desktop', 'mobile'] : [profileArg];
const gap = Number(opt('gap', 8000));
const mark = opt('mark', 'map-data');
const markLabel = mark === 'map-data' ? '地圖出現資料' : mark;
const baseLabel = (ms) => (mark === 'map-data' ? '' : `（地圖出現資料 ${ms} ms）`);
const phases = ['first', 'repeat', ...(args.includes('--offline') ? ['offline'] : [])];

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

const puppeteer = loadPuppeteer();
const FAST_3G = puppeteer.PredefinedNetworkConditions['Fast 3G'];
const PROFILES = {
  desktop: { viewport: { width: 1366, height: 900, deviceScaleFactor: 1 }, network: null, cpu: 1 },
  mobile: {
    viewport: { width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    network: FAST_3G,
    cpu: 4,
  },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

async function measurePhase(context, profile, phase) {
  const page = await context.newPage();
  await page.setViewport(profile.viewport);
  const session = await page.createCDPSession();
  await session.send('Network.enable');
  const traffic = [];
  const urls = new Map();
  session.on('Network.responseReceived', (e) => urls.set(e.requestId, { url: e.response.url, sw: e.response.fromServiceWorker }));
  session.on('Network.loadingFinished', (e) => traffic.push({ ...(urls.get(e.requestId) ?? {}), bytes: e.encodedDataLength }));
  if (phase === 'offline') {
    await session.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  } else if (profile.network) {
    await page.emulateNetworkConditions(profile.network);
  }
  if (profile.cpu > 1) await session.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
  await page.evaluateOnNewDocument(() => {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction((name) => performance.getEntriesByName(name).length > 0, { timeout: 180000, polling: 100 }, mark);
  const kbAtMap = Math.round(traffic.reduce((s, r) => s + r.bytes, 0) / 1024);
  // 等網路安靜 3 秒（底圖圖磚還會陸續下載）
  for (let last = -1, quiet = 0; quiet < 3000; ) {
    await sleep(500);
    quiet = traffic.length === last ? quiet + 500 : 0;
    last = traffic.length;
  }
  const m = await page.evaluate((name) => ({
    mapData: Math.round(performance.getEntriesByName(name)[0].startTime),
    // --mark 量別的 mark 時，也記下國界與資料第一次畫上的時間，對照用
    base: Math.round(performance.getEntriesByName('map-data')[0]?.startTime ?? 0),
    lcp: Math.round(window.__lcp ?? 0),
    controlled: Boolean(navigator.serviceWorker?.controller),
  }), mark);
  if (phase === 'first') {
    // 有 service worker 的版本：等它接手（沒有的話幾秒後放棄），下一次才會從它的快取載入
    await page
      .waitForFunction(() => Boolean(navigator.serviceWorker?.controller), { timeout: 30000 })
      .then(() => sleep(5000))
      .catch(() => {});
  }
  await page.close();
  await sleep(gap);
  const largest = [...traffic]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5)
    .map((r) => `${(r.url ?? '?').replace(/^https?:\/\/[^/]+/, '').slice(0, 60)} ${Math.round(r.bytes / 1024)}K`);
  return { ...m, kbAtMap, kbTotal: Math.round(traffic.reduce((s, r) => s + r.bytes, 0) / 1024), requests: traffic.length, largest };
}

const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run'],
});
const results = [];
for (const profileName of profiles) {
  for (let run = 0; run < runs; run++) {
    const context = await browser.createBrowserContext();
    for (const phase of phases) {
      const r = await measurePhase(context, PROFILES[profileName], phase);
      results.push({ profile: profileName, phase, ...r });
      console.log(
        `${profileName} #${run + 1} ${phase}: ${markLabel} ${r.mapData} ms${baseLabel(r.base)}，LCP ${r.lcp} ms，` +
          `到出現資料 ${r.kbAtMap} KB，全部 ${r.kbTotal} KB（${r.requests} 個請求）`,
      );
    }
    await context.close();
  }
}
await browser.close();

console.log('\n中位數：');
for (const profileName of profiles) {
  for (const phase of phases) {
    const rs = results.filter((r) => r.profile === profileName && r.phase === phase);
    console.log(
      `${profileName} ${phase}: ${markLabel} ${median(rs.map((r) => r.mapData))} ms${baseLabel(median(rs.map((r) => r.base)))}，` +
        `LCP ${median(rs.map((r) => r.lcp))} ms，` +
        `到出現資料 ${median(rs.map((r) => r.kbAtMap))} KB，全部 ${median(rs.map((r) => r.kbTotal))} KB`,
    );
    if (phase === 'first') console.log(`  最大的請求：${rs[0].largest.join('、')}`);
  }
}
