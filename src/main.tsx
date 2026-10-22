import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
reloadOnStaleChunk();

/**
 * Service worker（src/sw.ts）：離線也能開、再次開啟直接從快取載入。只在正式版註冊（開發模式改了程式要馬上看到）。
 * 等地圖第一次畫出資料（或頁面載入完 10 秒）才註冊，預先快取的下載不跟第一次載入搶頻寬。
 */
function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  let done = false;
  const register = () => {
    if (done) return;
    done = true;
    observer?.disconnect();
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  };
  let observer: PerformanceObserver | undefined;
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

/**
 * 部署新版後，開著的舊頁面要載入的舊 chunk（例如點國家才載入的圖表）已經不在伺服器上：
 * 重新整理一次換成新版。用 sessionStorage 記住，避免一直重新整理。
 */
function reloadOnStaleChunk() {
  const KEY = 'reloaded-for-new-version';
  window.addEventListener('vite:preloadError', (event) => {
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, '1');
    } catch {
      return;
    }
    event.preventDefault();
    window.location.reload();
  });
  // 正常跑了一陣子就清掉，之後再部署新版時還能再重新整理一次
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // 無痕模式等情況存不了
    }
  }, 30_000);
}
