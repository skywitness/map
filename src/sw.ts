/// <reference lib="webworker" />
/**
 * Service worker（vite-plugin-pwa 的 injectManifest 模式，用 Workbox 模組組裝）。
 *
 * - App shell（index.html、第一個畫面要用的 JS 與 CSS、圖示）安裝時預先快取：第二次開啟 JS、CSS 不必等網路，離線也能開。
 *   HTML 先向伺服器拿（才拿得到新版），離線或 3 秒逾時才用快取的 index.html。
 * - 其他 JS、CSS（各主題、側欄、圖表，建置時標成 LAZY，見 vite.config.ts 的 collectCoreAssets）：網路不受限時
 *   安裝時也全部下載（離線也能換主題、開側欄）；開了省流量模式或 2G 網路時只存用到的（約省 1 MB）。
 * - 資料 JSON：stale-while-revalidate，先給快取、背景更新。快取名稱含資料版本
 *   （建置時 public/data 內容的雜湊，見 vite.config.ts），部署了新資料就換一個新快取，舊的在啟用時刪掉。
 * - 底圖（OpenFreeMap）：樣式、字型、圖磚在執行時快取（只存使用者看過的，有數量與天數上限，
 *   不主動下載整個區域，符合 OpenFreeMap 的使用條款）。
 * - 人口密度的 1 km 網格圖磚：看過的才快取，有數量上限。
 *
 * 新版部署後：打開網頁一律先向伺服器拿 HTML，所以一開就是新版；新的 service worker 裝好就直接接手
 * （skipWaiting + clientsClaim）。已經開著的舊頁面繼續用舊版，如果要載入已經不存在的舊 chunk，
 * main.tsx 的 vite:preloadError 會重新整理一次。
 */
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

const DATA_CACHE = `data-${__DATA_VERSION__}`;
/** vite.config.ts 的 LAZY_REVISION */
const LAZY = 'lazy';
const APP_LAZY_CACHE = 'app-lazy';
const BASEMAP = 'https://tiles.openfreemap.org';
const DAY = 24 * 60 * 60;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
// Workbox 建置時把清單填進 self.__WB_MANIFEST（原始碼裡只能出現一次）
const MANIFEST = self.__WB_MANIFEST;
const isLazy = (e: string | { url: string; revision?: string | null }) => typeof e !== 'string' && e.revision === LAZY;
precacheAndRoute(MANIFEST.filter((e) => !isLazy(e)));

// 第一個畫面用不到的 JS、CSS：網址含內容的雜湊，內容不會變，用到的才存（CacheFirst）；
// 網路不受限時安裝時就全部下載。新版啟用時刪掉不在這一版清單裡的
const lazyUrls = new Set(
  MANIFEST.filter(isLazy).map((e) => new URL(typeof e === 'string' ? e : e.url, self.registration.scope).href),
);
registerRoute(({ url }) => lazyUrls.has(url.href), new CacheFirst({ cacheName: APP_LAZY_CACHE }));

/** 開了省流量模式或 2G 網路（只有 Chromium 的 worker 有 navigator.connection；其他瀏覽器照常全部下載） */
function constrained(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return Boolean(connection?.saveData) || /(^|-)2g$/.test(connection?.effectiveType ?? '');
}

self.addEventListener('install', (event) => {
  if (constrained()) return;
  event.waitUntil(
    caches.open(APP_LAZY_CACHE).then(async (cache) => {
      for (const url of lazyUrls) {
        if (!(await cache.match(url))) await cache.add(url).catch(() => {});
      }
    }),
  );
});

// 打開網頁（任何網址，含 t/<主題>/?country=…）：先向伺服器拿最新的 HTML，拿不到（離線、3 秒逾時、404）才用預先快取的
// index.html（assets 是絕對路徑，在 t/<主題>/ 底下照樣抓得到）。原本一律用快取，部署後第一次開還是舊版：新加的主題
// 舊版不認得，網址是 t/f1/ 卻開成預設的人口主題（2026-10-30）。直接開資料檔、圖磚的網址則照常回傳檔案
const appShell = createHandlerBoundToURL('index.html');
const PAGE_TIMEOUT_MS = 3000;
registerRoute(
  new NavigationRoute(
    async (options) => {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), PAGE_TIMEOUT_MS);
      try {
        // no-cache：GitHub Pages 的 max-age=600 會讓瀏覽器快取在部署後 10 分鐘內還給舊的 HTML（沒變只回 304）。
        // manual：伺服器的轉址（t/f1 → t/f1/）原樣交給瀏覽器
        const response = await fetch(options.request.url, { cache: 'no-cache', redirect: 'manual', signal: abort.signal });
        if (response.ok || response.type === 'opaqueredirect') return response;
      } catch {
        // 離線或逾時
      } finally {
        clearTimeout(timer);
      }
      return appShell(options);
    },
    { denylist: [/\/data\//, /\/tiles\//] },
  ),
);

registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/data/') && url.pathname.endsWith('.json'),
  new StaleWhileRevalidate({
    cacheName: DATA_CACHE,
    // 向伺服器確認過才用（沒變只回 304）：GitHub Pages 的 max-age=600 會讓瀏覽器快取在部署後 10 分鐘內
    // 還給舊檔，新的資料快取就會存到舊資料
    fetchOptions: { cache: 'no-cache' },
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 400, purgeOnQuotaError: true }),
    ],
  }),
);

// 底圖樣式、圖磚索引（/planet）、圖示集：會更新，先給快取、背景更新
registerRoute(
  ({ url }) => url.origin === BASEMAP && /^\/(styles|sprites)\/|^\/[a-z_]+$/.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: 'basemap-style',
    plugins: [new CacheableResponsePlugin({ statuses: [200] }), new ExpirationPlugin({ maxEntries: 40 })],
  }),
);

// 字型（地名的拉丁字母；中文用系統字型，不下載）
registerRoute(
  ({ url }) => url.origin === BASEMAP && url.pathname.startsWith('/fonts/'),
  new CacheFirst({
    cacheName: 'basemap-fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * DAY }),
    ],
  }),
);

// 圖磚：網址含版本（planet/<日期>/z/x/y.pbf），內容不會變，直接用快取。上限約 300 張（數十 MB）
registerRoute(
  ({ url }) => url.origin === BASEMAP && /\.(pbf|png|jpg|webp)$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'basemap-tiles',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true }),
    ],
  }),
);

// 海拔主題的地形圖磚（AWS Terrain Tiles，terrarium PNG）：內容不會變，直接用快取。一張約 50–150 KB，
// 上限 200 張（約 20 MB）；只存使用者看過的，不主動下載
registerRoute(
  ({ url }) => url.origin === 'https://s3.amazonaws.com' && url.pathname.startsWith('/elevation-tiles-prod/'),
  new CacheFirst({
    cacheName: 'terrain-tiles',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true }),
    ],
  }),
);

// 世界視角的地形陰影（relief/z/x/y.webp，85 張共約 0.6 MB，style.ts 的 localRelief）：看過的直接用快取
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/relief/') && url.pathname.endsWith('.webp'),
  new CacheFirst({
    cacheName: 'relief-tiles',
    plugins: [new CacheableResponsePlugin({ statuses: [200] }), new ExpirationPlugin({ maxEntries: 100, purgeOnQuotaError: true })],
  }),
);

// 1 km 網格的圖磚（tiles/<資料夾>/<版本>/<年>/z/x/y.png，部署時產生）：網址含版本，內容不會變，直接用快取。
// 512 px 的圖磚平均約 10 KB，上限 800 張約 8–10 MB；只存看過的，不預先下載
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/tiles/') && url.pathname.endsWith('.png'),
  new CacheFirst({
    cacheName: 'grid-tiles',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 800, maxAgeSeconds: 60 * DAY, purgeOnQuotaError: true }),
    ],
  }),
);

// 國旗主題的國旗圖檔（data/topics/flags/svg/<地區>-<雜湊>.svg）：檔名含內容的雜湊，內容不會變，直接用快取。
// 約 230 個、共約 2 MB，另外一個快取（不跟資料 JSON 的 400 個上限搶位置）；只存看過的
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/data/topics/flags/svg/') && url.pathname.endsWith('.svg'),
  new CacheFirst({
    cacheName: 'flag-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 120 * DAY, purgeOnQuotaError: true }),
    ],
  }),
);

// 網格的 meta.json 決定圖磚的版本，部署後要馬上拿到新的（舊版本的圖磚已經不在伺服器上）；離線時用快取
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/tiles/') && url.pathname.endsWith('/meta.json'),
  new NetworkFirst({
    cacheName: 'grid-meta',
    networkTimeoutSeconds: 5,
    plugins: [new CacheableResponsePlugin({ statuses: [200] }), new ExpirationPlugin({ maxEntries: 10 })],
  }),
);

// 舊版資料的快取、舊版的 chunk 在新版啟用時刪掉
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith('data-') && k !== DATA_CACHE).map((k) => caches.delete(k)))),
      caches.open(APP_LAZY_CACHE).then(async (cache) => {
        for (const request of await cache.keys()) if (!lazyUrls.has(request.url)) await cache.delete(request);
      }),
    ]),
  );
});
