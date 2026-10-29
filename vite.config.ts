/// <reference types="node" />
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * 首頁 HTML 加上地圖程式（MapLibre）chunk 與它的 CSS 的預載：跟首頁程式同時下載，
 * 不必等首頁程式下載、跑起來才發出請求（手機 3G 上約快 1.5 秒）
 */
function preloadMapChunk(): Plugin {
  return {
    name: 'preload-map-chunk',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const chunk = Object.values(ctx.bundle ?? {}).find(
          (c) => c.type === 'chunk' && /[\\/]src[\\/]map[\\/]WorldMap\.tsx$/.test(c.facadeModuleId ?? ''),
        );
        if (!chunk || chunk.type !== 'chunk') return [];
        const css = [...(chunk.viteMetadata?.importedCss ?? [])].map((file) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'style', crossorigin: true, href: `${BASE}${file}` },
          injectTo: 'head' as const,
        }));
        return [
          { tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `${BASE}${chunk.fileName}` }, injectTo: 'head' },
          ...css,
        ];
      },
    },
  };
}

/**
 * 網址指定的主題（人口以外的主題各自一個 chunk，src/topics/registry.ts）也跟首頁程式同時下載：
 * 首頁 HTML 加一小段程式，依網址的主題（t/<主題>/ 或舊的 ?topic=）插入那個 chunk 的 modulepreload，不必等首頁程式跑起來才發出請求
 */
function preloadTopicChunk(): Plugin {
  return {
    name: 'preload-topic-chunk',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        // registry.ts 的 TOPIC_MODULES：主題 id → 檔名（多半一樣，台灣外交的檔名是 diplomacy）
        const registry = readFileSync('src/topics/registry.ts', 'utf8');
        const ids = new Map([...registry.matchAll(/^\s*'?([\w-]+)'?: \(\) => import\('\.\/([\w-]+)'\)/gm)].map((m) => [m[2], m[1]]));
        const chunks: Record<string, string> = {};
        for (const c of Object.values(ctx.bundle ?? {})) {
          const file = c.type === 'chunk' ? /[\\/]src[\\/]topics[\\/]([\w-]+)\.ts$/.exec(c.facadeModuleId ?? '')?.[1] : undefined;
          const id = file && ids.get(file);
          if (id && c.type === 'chunk') chunks[id] = `${BASE}${c.fileName}`;
        }
        if (Object.keys(chunks).length !== ids.size) {
          this.warn(`preload-topic-chunk：${ids.size} 個主題只找到 ${Object.keys(chunks).length} 個 chunk`);
        }
        const script =
          `(function(){var c=${JSON.stringify(chunks)};var t=new URLSearchParams(location.search).get('topic')||(location.pathname.match(/\\/t\\/([\\w-]+)\\/?$/)||[])[1];` +
          `if(!t||!c[t])return;var l=document.createElement('link');l.rel='modulepreload';l.crossOrigin='';` +
          `l.href=c[t];document.head.appendChild(l)})()`;
        return [{ tag: 'script', children: script, injectTo: 'head' }];
      },
    },
  };
}

/** 正式網站的網址：分享預覽（og:url、og:image）、canonical、sitemap 都要寫完整網址 */
const SITE = 'https://skywitness.github.io/map/';
/** 建置後網站在網域底下的路徑（GitHub Pages 的專案網站），跟 SITE 一致 */
const BASE = new URL(SITE).pathname;

const escapeAttr = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 主題目錄（scripts/topic-catalog.mjs 產生的 catalog.gen.ts）：每一行一個主題的 JSON */
function readCatalog(): { id: string; title: { zh: string }; pure?: boolean; indicators: { label: { zh: string } }[] }[] {
  const source = readFileSync('src/topics/catalog.gen.ts', 'utf8');
  return [...source.matchAll(/^ {4}"[\w-]+": (\{.*\}),$/gm)].map((m) => JSON.parse(m[1]));
}

/**
 * 每個主題自己的網址 t/<主題>/（2026-10-29）：爬蟲（LINE、Facebook、Google）不跑 JavaScript，GitHub Pages 每個網址又只能回傳
 * 一個檔案，所以建置時把首頁的 HTML 複製一份到 t/<主題>/index.html，換掉標題、說明與分享預覽（og:*，預覽圖是
 * scripts/og-topics.mjs 產生的 public/og/<主題>.jpg），加上 canonical；網站根目錄另外產生 sitemap.xml。
 * 建置用絕對路徑（base 是 /map/），這份 HTML 放在 t/<主題>/ 底下照樣抓得到 assets、data
 */
function topicPages(): Plugin {
  return {
    name: 'topic-pages',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') {
        this.warn('topic-pages：找不到 index.html');
        return;
      }
      const html = String(index.source);
      const topics = readCatalog();
      const setMeta = (doc: string, attr: 'name' | 'property', key: string, value: string) => {
        const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`);
        if (!re.test(doc)) throw new Error(`topic-pages：index.html 沒有 <meta ${attr}="${key}">`);
        return doc.replace(re, `$1${escapeAttr(value)}$2`);
      };
      // 首頁本身也加 canonical
      index.source = html.replace('</title>', `</title>\n    <link rel="canonical" href="${SITE}" />`);
      const today = new Date().toISOString().slice(0, 10);
      const urls = [SITE];
      for (const topic of topics) {
        const url = `${SITE}t/${topic.id}/`;
        const title = topic.title.zh;
        const labels = topic.indicators.map((i) => i.label.zh);
        const description = topic.pure
          ? '用地球儀看世界地圖，可以換底圖、搜尋國家；網站另有近百個主題的各國資料。'
          : `${title}：${labels.slice(0, 4).join('、')}${labels.length > 4 ? '等' : ''}。互動世界地圖，拖時間軸看歷年變化，還有排名表與各國比較。`;
        const image = existsSync(`public/og/${topic.id}.jpg`) ? `${SITE}og/${topic.id}.jpg` : `${SITE}og-image.jpg`;
        let page = html.replace(
          /<title>[^<]*<\/title>/,
          `<title>${escapeAttr(title)} · 世界資料地圖</title>\n    <link rel="canonical" href="${url}" />`,
        );
        page = setMeta(page, 'name', 'description', description);
        page = setMeta(page, 'property', 'og:title', `${title} · 世界資料地圖`);
        page = setMeta(page, 'property', 'og:description', description);
        page = setMeta(page, 'property', 'og:url', url);
        page = setMeta(page, 'property', 'og:image', image);
        page = setMeta(page, 'property', 'og:image:alt', `${title}：世界資料地圖的主題`);
        this.emitFile({ type: 'asset', fileName: `t/${topic.id}/index.html`, source: page });
        urls.push(url);
      }
      const sitemap =
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
        '\n</urlset>\n';
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap });
    },
  };
}

/**
 * 第一個畫面要用的 JS、CSS：首頁程式、地圖程式與它們直接 import 的 chunk。service worker 安裝時只預先快取這些，
 * 其他（各主題、側欄、圖表）在預先快取清單裡標成 LAZY_REVISION，由 sw.ts 另外處理（網路不受限時照樣在背景全部下載）
 */
const coreAssets = new Set<string>();
const LAZY_REVISION = 'lazy';
function collectCoreAssets(): Plugin {
  return {
    name: 'collect-core-assets',
    apply: 'build',
    generateBundle(_options, bundle) {
      coreAssets.clear();
      const chunks = new Map(Object.values(bundle).flatMap((c) => (c.type === 'chunk' ? [[c.fileName, c] as const] : [])));
      const visit = (fileName: string) => {
        const chunk = chunks.get(fileName);
        if (!chunk || coreAssets.has(fileName)) return;
        coreAssets.add(fileName);
        for (const css of chunk.viteMetadata?.importedCss ?? []) coreAssets.add(css);
        for (const dep of chunk.imports) visit(dep);
      };
      for (const chunk of chunks.values()) {
        if (chunk.isEntry || /[\\/]src[\\/]map[\\/]WorldMap\.tsx$/.test(chunk.facadeModuleId ?? '')) visit(chunk.fileName);
      }
    },
  };
}

/** public/data 全部內容的雜湊：service worker 的資料快取用它命名，資料一更新就換新快取 */
function dataVersion(dir = 'public/data'): string {
  const hash = createHash('sha256');
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(d, entry.name);
      if (entry.isDirectory()) walk(path);
      else hash.update(relative(dir, path)).update(readFileSync(path));
    }
  };
  walk(dir);
  return hash.digest('hex').slice(0, 12);
}

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    preloadMapChunk(),
    preloadTopicChunk(),
    topicPages(),
    collectCoreAssets(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // 自己在 main.tsx 註冊（地圖畫好、頁面載入完才註冊，不跟首次載入搶頻寬）
      injectRegister: false,
      injectManifest: {
        // app shell：首頁、所有 JS/CSS（含點國家才用到的側欄）、圖示（manifest 裡的會自動加入）、國名對照表。
        // 資料 JSON 不預先下載，看過的才快取
        globPatterns: [
          'index.html',
          'assets/*.{js,css}',
          'icons/icon.svg',
          'icons/apple-touch-icon-180.png',
          'data/countries.json',
        ],
        // 第一個畫面用不到的 JS、CSS 標成 LAZY_REVISION（collectCoreAssets），sw.ts 不在安裝時一定下載
        manifestTransforms: [
          (entries) => ({
            manifest: entries.map((e) =>
              coreAssets.size && /^assets\/.+\.(js|css)$/.test(e.url) && !coreAssets.has(e.url) ? { ...e, revision: LAZY_REVISION } : e,
            ),
            warnings: coreAssets.size ? [] : ['collect-core-assets：沒有找到首頁程式，全部當成要預先快取'],
          }),
        ],
      },
      manifest: {
        name: '世界資料地圖',
        short_name: '世界資料地圖',
        description: '用世界地圖瀏覽各國人口、經濟、能源、產業與農業資料',
        lang: 'zh-Hant-TW',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#2a78d6',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  define: {
    // 開發模式不註冊 service worker，不必每次啟動都算雜湊
    __DATA_VERSION__: JSON.stringify(command === 'build' ? dataVersion() : 'dev'),
  },
  // 建置時用 GitHub Pages 的子路徑 /map/（絕對路徑）：每個主題有自己的網址 t/<主題>/（topicPages），相對路徑在那底下會錯。
  // 2026-10-29 以前是相對路徑 './'。開發伺服器照舊在根目錄
  base: command === 'build' ? BASE : '/',
  server: {
    // 網格圖磚（public/tiles，人口 6 萬張、暖化 2.4 萬張）不監看：產生圖磚時每一張都會觸發一次檔案事件，
    // 開發伺服器會整個停住不回應。代價是 Vite 只在啟動時列出 public/ 的檔案，重新產生圖磚後要重開開發伺服器
    // .claude/worktrees 是平行開發用的整份副本（幾十個，各有 public/data 與連到 node_modules 的 junction），
    // 監看、掃描進去會讓主目錄的開發伺服器第一頁 30 秒還載入不完
    watch: { ignored: ['**/public/tiles/**', '**/.claude/**'] },
  },
  // 相依套件預先打包只從首頁找入口；預設的 **/*.html 會掃到 .claude/worktrees 裡每一份的 index.html
  optimizeDeps: { entries: ['index.html'] },
  build: {
    // 地圖引擎 MapLibre 自己一個 chunk（約 1 MB，gzip 後約 310 KB），跟首頁程式、資料平行下載
    // （2026-10-29 以前側欄的 ECharts 另外一個約 540 KB 的 chunk，換成自己畫的 SVG 圖表，charts/Chart.tsx）
    chunkSizeWarningLimit: 1500,
  },
}));
