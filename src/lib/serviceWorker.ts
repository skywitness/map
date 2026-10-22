/**
 * Service worker 的註冊（src/sw.ts，快取策略見 DESIGN.md 第 13 節）。
 *
 * 第一次造訪時，service worker 要等地圖畫出資料才註冊、裝好，在那之前（以及還在下載中）的資料、底圖
 * 不會經過它，也就不在快取裡。它接手後，把這些網址交給它補存（Workbox 的 CACHE_URLS 訊息），
 * 看過一次就能離線開啟。
 * - 頁面自己下載的（資料 JSON、底圖樣式）：Resource Timing 的 workerStart 為 0 表示沒經過 service worker。
 * - MapLibre 的 worker 下載的（向量圖磚）：頁面的 Resource Timing 看不到，而且這些 worker 在 service worker
 *   接手前就建立了，整個頁面期間都不會經過它，所以由 WorldMap 的 transformRequest 呼叫 noteMapRequest 記下來。
 */

const MAX_URLS = 1000;
const FLUSH_DELAY_MS = 2000;
/** 這次開啟時還沒有 service worker（第一次造訪）；有的話所有請求本來就會經過它，不必補存 */
const startedUncontrolled = import.meta.env.PROD && 'serviceWorker' in navigator && !navigator.serviceWorker.controller;
const pending = new Set<string>();
const sent = new Set<string>();
let flushTimer = 0;

function shouldCache(url: string): boolean {
  try {
    const u = new URL(url, window.location.href);
    return (u.origin === window.location.origin && u.pathname.includes('/data/')) || u.hostname === 'tiles.openfreemap.org';
  } catch {
    return false;
  }
}

function queue(url: string): void {
  if (!startedUncontrolled || pending.has(url) || sent.has(url) || pending.size + sent.size >= MAX_URLS) return;
  if (!shouldCache(url)) return;
  pending.add(url);
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer || !navigator.serviceWorker.controller) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = 0;
    const controller = navigator.serviceWorker.controller;
    if (!controller || pending.size === 0) return;
    const urls = [...pending];
    pending.clear();
    for (const url of urls) sent.add(url);
    controller.postMessage({ type: 'CACHE_URLS', payload: { urlsToCache: urls } });
  }, FLUSH_DELAY_MS);
}

/** 記下地圖的請求（圖磚、字型、圖示集）；第一次造訪時才有作用 */
export function noteMapRequest(url: string): void {
  queue(url);
}

/** 只在正式版註冊（開發模式改了程式要馬上看到）。等地圖第一次畫出資料（或頁面載入完 10 秒）才註冊，預先快取的下載不跟第一次載入搶頻寬 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;

  if (startedUncontrolled) {
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
          if (entry.workerStart === 0) queue(entry.name);
        }
      }).observe({ type: 'resource', buffered: true });
    } catch {
      // 不支援就只補存地圖記下的請求
    }
    sw.addEventListener('controllerchange', scheduleFlush, { once: true });
  }

  let done = false;
  let observer: PerformanceObserver | undefined;
  const register = () => {
    if (done) return;
    done = true;
    observer?.disconnect();
    sw.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  };
  try {
    observer = new PerformanceObserver((list) => {
      if (list.getEntriesByName('map-data').length) register();
    });
    observer.observe({ type: 'mark' });
  } catch {
    // 不支援就靠下面的計時器
  }
  const afterLoad = () => window.setTimeout(register, 10_000);
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });
}
