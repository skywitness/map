import { useSyncExternalStore } from 'react';
import { URL_PARAM } from '../i18n/lang';
import { setHistoryUrl } from './history';

/**
 * 收藏的畫面（2026-10-30）：把目前的網址（主題、指標、年份、國家、框選…）取個名字存在這台裝置的 localStorage，
 * 之後一鍵回來；跟「最近看過的主題」分開（那個只記主題、自動記）。不送到任何地方
 */
export interface SavedView {
  id: string;
  name: string;
  /** 網址的路徑與參數（不含語言、嵌入模式：打開時照目前的語言） */
  href: string;
  savedAt: number;
}

const KEY = 'savedViews';
const MAX = 50;
const listeners = new Set<() => void>();
let cache: SavedView[] | null = null;

function load(): SavedView[] {
  if (cache) return cache;
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedView[];
    cache = Array.isArray(list) ? list.filter((v) => typeof v?.href === 'string' && typeof v?.name === 'string') : [];
  } catch {
    cache = [];
  }
  return cache;
}

function save(list: SavedView[]): void {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 無痕模式等存不了：這次的分頁裡照樣看得到
  }
  listeners.forEach((listener) => listener());
}

/** 收藏用的網址：拿掉語言與嵌入模式，只留路徑與參數 */
export function viewHref(href: string): string {
  const url = new URL(href, window.location.href);
  url.searchParams.delete(URL_PARAM);
  url.searchParams.delete('embed');
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ''}`;
}

export function addSavedView(name: string, href: string): void {
  const clean = viewHref(href);
  // 同一個畫面只留一筆（改名字）；新的排在最前面
  const rest = load().filter((v) => v.href !== clean);
  save([{ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, href: clean, savedAt: Date.now() }, ...rest].slice(0, MAX));
}

export function removeSavedView(id: string): void {
  save(load().filter((v) => v.id !== id));
}

/** 在網頁裡打開收藏的畫面（url-state 聽 popstate）；改網址失敗時整頁換過去。保留目前的語言 */
export function openSavedView(view: SavedView, lang: string | null): void {
  const url = new URL(view.href, window.location.href);
  if (lang) url.searchParams.set(URL_PARAM, lang);
  const href = `${url.pathname}${url.search}`;
  if (!setHistoryUrl(href, true)) {
    window.location.assign(href);
    return;
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  // 別的分頁改了也跟著更新
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

export function useSavedViews(): SavedView[] {
  return useSyncExternalStore(subscribe, load, load);
}
