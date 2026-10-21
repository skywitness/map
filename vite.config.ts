import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 相對路徑，方便部署到 GitHub Pages 的子路徑
  base: './',
  build: {
    // ECharts 單獨一個 chunk 約 540 KB（gzip 後約 180 KB），點國家時才載入
    chunkSizeWarningLimit: 600,
  },
});
