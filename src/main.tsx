import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { registerServiceWorker, updateForUnknownTopic } from './lib/serviceWorker';
import { readLocalRegistry } from './lib/localRegistry';
import { isAboutPage, isMinePage, read as readUrlState } from './lib/url-state';
import { loadTopic, topicIdOf } from './topics';
// MapLibre 的 CSS 放在首頁、排在 styles.css 前面：styles.css 有些規則要蓋過它（例如 .map-canvas 的定位）。
// 如果跟著地圖程式的 chunk 晚載入，它會反過來蓋掉 styles.css，地圖容器變成 0 高度
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';

const about = isAboutPage();
const mine = isMinePage();
// 網址的主題（人口以外的各自一個 chunk，index.html 已經先預載）下載完才畫第一個畫面；
// 失敗的話照樣畫，App 改開預設的主題
const urlState = about || mine ? null : readUrlState();
const urlTopic = urlState?.topic ?? null;
// 本機匯入（DESIGN.md 第 11 節）：這個瀏覽器匯入過資料才載入 topics/localTopics.ts，接上匯入的指標、圖層與新主題；嵌入模式不接
const localReady =
  urlState && !urlState.embed && readLocalRegistry().length
    ? import('./topics/localTopics').then((m) => m.installLocal()).catch(() => {})
    : Promise.resolve();
if (mine) {
  // 本機匯入頁 mine/（製作手冊第十三批 209）：不載入地圖，自己一個 chunk
  void import('./personal/MinePage').then(({ default: MinePage }) =>
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <ErrorBoundary>
          <MinePage />
        </ErrorBoundary>
      </StrictMode>,
    ),
  );
} else if (about) {
  // 關於頁 about/（製作手冊第十五批 262）：不載入地圖與主題，關於頁自己一個 chunk
  void import('./about/AboutPage').then(({ default: AboutPage }) =>
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <ErrorBoundary>
          <AboutPage />
        </ErrorBoundary>
      </StrictMode>,
    ),
  );
} else {
  localReady
    .then(() => loadTopic(urlTopic))
    .catch(() => {})
    .finally(() =>
      createRoot(document.getElementById('root')!).render(
        <StrictMode>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </StrictMode>,
      ),
    );
}

// Service worker：離線也能開、再次開啟直接從快取載入
registerServiceWorker();
reloadOnStaleChunk();
// 網址的主題這一版不認得（部署後才加的主題、用了快取裡的舊版首頁）：新版接手時重新整理一次
void localReady.then(() => {
  if (urlTopic && topicIdOf(urlTopic) !== urlTopic) updateForUnknownTopic(urlTopic);
});

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
