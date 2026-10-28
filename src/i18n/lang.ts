/**
 * 介面語言的狀態：預設繁體中文，可切換英文。
 * 語言記在網址（lang=en，中文是預設所以不寫）與 localStorage；切換時不必重新整理，
 * 用 useLang() 的元件會重新繪製，格式化函式（lib/format.ts）也是在呼叫當下讀目前的語言。
 */
import { setHistoryUrl } from '../lib/history';

export type Lang = 'zh' | 'en';

export const DEFAULT_LANG: Lang = 'zh';

/**
 * 雙語文字。主題設定（src/topics/*.ts）裡所有給人看的文字都用這個型別：
 * `label: { zh: '總人口', en: 'Total population' }`。
 * 兩種語言寫法相同的（TWh、IMF、OurAirports）可以直接寫字串。
 */
export type Text = string | { zh: string; en: string };

/** Intl（數字、排序）用的 locale */
export const LOCALES: Record<Lang, string> = { zh: 'zh-TW', en: 'en-US' };

/** <html lang> 的值 */
export const HTML_LANG: Record<Lang, string> = { zh: 'zh-Hant-TW', en: 'en' };

const STORAGE_KEY = 'lang';
export const URL_PARAM = 'lang';

function parse(value: string | null): Lang | null {
  if (value === 'en') return 'en';
  if (value === 'zh' || value === 'zh-TW' || value === 'zh-Hant') return 'zh';
  return null;
}

function readInitial(): Lang {
  const fromUrl = parse(new URLSearchParams(window.location.search).get(URL_PARAM));
  if (fromUrl) return fromUrl;
  try {
    return parse(localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

function store(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // 無痕模式等情況存不了，只影響這次瀏覽
  }
}

let current: Lang = readInitial();
// 網址指定的語言也當成使用者的偏好，重新整理（網址的 lang 參數被拿掉時）才不會跳回另一種語言
store(current);

const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function subscribeLang(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  store(lang);
  const p = new URLSearchParams(window.location.search);
  if (lang === DEFAULT_LANG) p.delete(URL_PARAM);
  else p.set(URL_PARAM, lang);
  const query = p.toString();
  setHistoryUrl(`${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`, false);
  listeners.forEach((listener) => listener());
}

/** 網址上要寫的 lang 參數；中文是預設，回傳 null */
export function langParam(): string | null {
  return current === DEFAULT_LANG ? null : current;
}

/** 取雙語文字的其中一種語言 */
export function tr(text: Text, lang: Lang = current): string {
  return typeof text === 'string' ? text : text[lang];
}

/** 把設定物件裡所有的 Text 換成字串，函式、數字、字面型別（例如 kind: 'bubble'）原樣保留 */
export type Localized<T> = T extends string
  ? T
  : T extends { zh: string; en: string }
    ? string
    : T extends (...args: never[]) => unknown
      ? T
      : T extends object
        ? { [K in keyof T]: Localized<T[K]> }
        : T;

function isText(value: unknown): value is { zh: string; en: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 2 && typeof v.zh === 'string' && typeof v.en === 'string';
}

function resolve(value: unknown, lang: Lang): unknown {
  if (isText(value)) return value[lang];
  if (Array.isArray(value)) return value.map((v) => resolve(v, lang));
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, lang)]));
  }
  return value;
}

const cache = new WeakMap<object, Partial<Record<Lang, unknown>>>();

/**
 * 依語言解析整個設定物件（例如一個主題），結果會快取：
 * 同一個物件、同一種語言永遠拿到同一份，React 的 useMemo 依賴才穩定；換語言就是新的物件，畫面跟著更新。
 */
export function localize<T extends object>(value: T, lang: Lang): Localized<T> {
  let entry = cache.get(value);
  if (!entry) {
    entry = {};
    cache.set(value, entry);
  }
  return (entry[lang] ??= resolve(value, lang)) as Localized<T>;
}
