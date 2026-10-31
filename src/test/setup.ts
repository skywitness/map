/**
 * 單元測試在 Node 跑（vitest.config.ts）：介面語言（i18n/lang.ts）一匯入就讀網址與 localStorage，
 * 網址解析（url-state.ts）讀 window.location。給一個最小的 window、localStorage、history；
 * 要測別的網址時改 window.location（setLocation）
 */
const store = new Map<string, string>();
const fakeHistory = { replaceState() {}, pushState() {}, state: null };

export function setLocation(href: string): void {
  (globalThis as unknown as { window: { location: URL } }).window.location = new URL(href);
}

Object.assign(globalThis, {
  window: { location: new URL('http://localhost/map/'), history: fakeHistory, addEventListener() {}, removeEventListener() {} },
  history: fakeHistory,
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
  },
});
