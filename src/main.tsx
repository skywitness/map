import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './lib/serviceWorker';
// MapLibre 的 CSS 放在首頁、排在 styles.css 前面：styles.css 有些規則要蓋過它（例如 .map-canvas 的定位）。
// 如果跟著地圖程式的 chunk 晚載入，它會反過來蓋掉 styles.css，地圖容器變成 0 高度
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker：離線也能開、再次開啟直接從快取載入
registerServiceWorker();
reloadOnStaleChunk();

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
