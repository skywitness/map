import { defineConfig } from 'vitest/config';

/**
 * 單元測試（2026-10-31，npm test；CI 的「單元測試」步驟）：src 底下的 *.test.ts，測純函式（網址解析、資料解碼、
 * 分欄、名次、格式、搜尋…）。不讀 vite.config.ts：那裡的外掛會算整個 public/data 的雜湊、產生主題頁，測試用不到。
 * 別名跟 vite.config.ts 一樣（React 的匯入換成 Preact），有的模組匯入 hooks
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^react$/, replacement: 'preact/compat' },
      { find: /^react-dom$/, replacement: 'preact/compat' },
      { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
    ],
  },
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
  },
});
