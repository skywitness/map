/**
 * 多語系：介面文字字典（zh.ts、en.ts）＋ 目前語言（lang.ts）。
 * 元件裡用 `const t = useT()` 取字典，`t.noData`、`t.rank(3, 200)`；
 * 主題設定裡的雙語文字（Text）用 localize() 或 tr() 取出目前語言的字串。
 */
import { useSyncExternalStore } from 'react';
import { en } from './en';
import { getLang, HTML_LANG, subscribeLang, type Lang } from './lang';
import { zh, type Messages } from './zh';

export * from './lang';
export type { Messages };

const MESSAGES: Record<Lang, Messages> = { zh, en };

/** 目前語言的字典（不在元件裡、但會在畫面更新時重新呼叫的程式用，例如圖表 option） */
export function messages(lang: Lang = getLang()): Messages {
  return MESSAGES[lang];
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, getLang);
}

export function useT(): Messages {
  return MESSAGES[useLang()];
}

/**
 * 主題外掛、側欄元件自己的文字表：`const TEXT = defineMessages({ zh: {...}, en: {...} })`，
 * 再用 `TEXT[useLang()]`。en 的鍵與參數必須跟 zh 一樣。
 */
export function defineMessages<T>(table: { zh: T; en: NoInfer<T> }): Record<Lang, T> {
  return table;
}

/** <html lang>、分頁標題、頁面說明跟著語言 */
function applyDocument(): void {
  const lang = getLang();
  document.documentElement.lang = HTML_LANG[lang];
  document.title = MESSAGES[lang].pageTitle;
  document.querySelector('meta[name="description"]')?.setAttribute('content', MESSAGES[lang].pageDescription);
}

applyDocument();
subscribeLang(applyDocument);
