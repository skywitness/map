/// <reference lib="webworker" />
/**
 * Service worker（vite-plugin-pwa 的 injectManifest 模式，用 Workbox 模組組裝）。
 *
 * - App shell（index.html、JS、CSS、圖示）預先快取：第二次開啟不必等網路，離線也能開。
 * - 資料 JSON：stale-while-revalidate，先給快取、背景更新。快取名稱含資料版本
 *   （建置時 public/data 內容的雜湊，見 vite.config.ts），部署了新資料就換一個新快取，舊的在啟用時刪掉。
 * - 底圖（OpenFreeMap）：樣式、字型、圖磚在執行時快取（只存使用者看過的，有數量與天數上限，
 *   不主動下載整個區域，符合 OpenFreeMap 的使用條款）。
 * - 人口密度的 1 km 網格圖磚：看過的才快取，有數量上限。
 *
 * 新版部署後：新的 service worker 裝好就直接接手（skipWaiting + clientsClaim），
 * 這次開著的頁面繼續用舊版，下次開啟就是新版。舊頁面如果要載入已經不存在的舊 chunk，
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
const BASEMAP = 'https://tiles.openfreemap.org';
const DAY = 24 * 60 * 60;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// 直接開任何畫面（?topic=…&country=…）都用預先快取的 index.html；直接開資料檔、圖磚的網址則照常回傳檔案
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/\/data\//, /\/tiles\//] }));

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

// 舊版資料的快取在新版啟用時刪掉
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('data-') && k !== DATA_CACHE).map((k) => caches.delete(k)))),
  );
});
