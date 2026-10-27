/// <reference types="node" />
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
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
          attrs: { rel: 'preload', as: 'style', crossorigin: true, href: `./${file}` },
          injectTo: 'head' as const,
        }));
        return [
          { tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `./${chunk.fileName}` }, injectTo: 'head' },
          ...css,
        ];
      },
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
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // 自己在 main.tsx 註冊（地圖畫好、頁面載入完才註冊，不跟首次載入搶頻寬）
      injectRegister: false,
      injectManifest: {
        // app shell：首頁、所有 JS/CSS（含點國家才用到的 ECharts）、圖示（manifest 裡的會自動加入）、國名對照表。
        // 資料 JSON 不預先下載，看過的才快取
        globPatterns: [
          'index.html',
          'assets/*.{js,css}',
          'icons/icon.svg',
          'icons/apple-touch-icon-180.png',
          'data/countries.json',
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
  // 相對路徑，方便部署到 GitHub Pages 的子路徑
  base: './',
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
    // 地圖引擎 MapLibre 自己一個 chunk（約 1 MB，gzip 後約 310 KB），跟首頁程式、資料平行下載；
    // ECharts 單獨一個 chunk 約 540 KB，點國家時才載入
    chunkSizeWarningLimit: 1500,
  },
}));
