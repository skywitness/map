import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 相對路徑，方便部署到 GitHub Pages 的子路徑
  base: './',
  build: {
    // 主程式含 MapLibre（約 1 MB，gzip 後約 380 KB），地圖是首頁內容，不能延後載入；
    // ECharts 單獨一個 chunk 約 540 KB，點國家時才載入
    chunkSizeWarningLimit: 1500,
  },
});
