import { useCallback, useEffect, useRef, useState } from 'react';
import { langParam, URL_PARAM } from '../i18n/lang';
import { boxFromLegacyRaw, type Box } from '../map/boxEstimate';
import { formatTimeParam, parseTimeParam } from './clock';
import { setHistoryUrl } from './history';

/** 畫面狀態全部放在網址參數，任何畫面都能直接複製網址分享。 */
export interface ViewState {
  topic: string | null;
  indicator: string | null;
  year: number | null;
  country: string | null;
  view: 'map' | 'table';
  /** 子項目，例如農產品代碼 */
  item: string | null;
  /** 框選範圍（經緯度 [西, 南, 東, 北]） */
  box: Box | null;
  /** 3D 立體地圖（3d=1） */
  threeD: boolean;
  /**
   * 地圖改用網格（grid=1）或國家平均（grid=0），只對有網格的指標有作用；null 是沒指定，用指標的預設
   * （GridSpec.defaultOn，例如夜間燈光預設是網格，人口密度預設是國家平均）
   */
  grid: boolean | null;
  /** 側欄折線圖與數值卡片一起比較的國家（cmp=JPN,KOR，最多 COMPARE_MAX 個） */
  compare: string[];
  /**
   * 時刻主題（晝夜與季節）選的那一刻（UTC 毫秒，網址 time=2026-06-21T0400Z）；null 是「現在」，每分鐘更新、不寫網址。
   * 播放時的每一格不寫網址，停下來才寫（App.tsx）
   */
  time: number | null;
}

export const COMPARE_MAX = 3;

/** 目前網址的畫面狀態（App 啟動時也用它提早發出第一個畫面的資料請求） */
export function read(): ViewState {
  const p = new URLSearchParams(window.location.search);
  const year = Number(p.get('year'));
  return {
    topic: p.get('topic'),
    indicator: p.get('ind'),
    year: Number.isFinite(year) && year > 0 ? year : null,
    country: p.get('country'),
    view: p.get('view') === 'table' ? 'table' : 'map',
    item: p.get('item'),
    // bbox= 是經緯度；舊版網址的 box= 是 Equal Earth 投影座標，換算過來
    box: parseBox(p.get('bbox')) ?? legacyBox(p.get('box')),
    threeD: p.get('3d') === '1',
    grid: p.get('grid') === '1' ? true : p.get('grid') === '0' ? false : null,
    compare: [...new Set((p.get('cmp') ?? '').split(',').filter((c) => /^_?[A-Z]{3}$/.test(c)))].slice(0, COMPARE_MAX),
    time: parseTimeParam(p.get('time')),
  };
}

function parseNumbers(text: string | null): Box | null {
  const nums = text?.split(',').map(Number);
  return nums && nums.length === 4 && nums.every(Number.isFinite) ? (nums as Box) : null;
}

function parseBox(text: string | null): Box | null {
  const b = parseNumbers(text);
  return b && b[1] < b[3] && Math.abs(b[0]) <= 180 && Math.abs(b[2]) <= 180 ? b : null;
}

function legacyBox(text: string | null): Box | null {
  const b = parseNumbers(text);
  return b && b[0] < b[2] && b[1] < b[3] ? boxFromLegacyRaw(b) : null;
}

/**
 * 這些變了才在瀏覽紀錄留一筆，瀏覽器的「上一頁」回得到前一個主題、指標、國家（原本一律改寫目前這一筆，
 * 上一頁會直接離開網站）。年份、時刻、框選、3D、網格只改寫目前這一筆：拖時間軸、播放不會塞滿紀錄。
 */
const HISTORY_KEYS = ['topic', 'indicator', 'item', 'country', 'view'] as const;

/**
 * 只改寫目前這一筆的變動（拖時間軸、播放）最多每 REPLACE_INTERVAL_MS 寫一次網址，停下來時寫最後的狀態。
 * Safari 規定 10 秒內最多改 100 次網址（見 history.ts），原本每換一年就寫一次，手機上左右拖幾次時間軸
 * 就超過，丟出的錯誤讓整個畫面不見、只剩背景色。寫入失敗時過 RETRY_MS 再補寫。
 */
const REPLACE_INTERVAL_MS = 300;
const RETRY_MS = 2000;

/** 最新的畫面狀態，包含還沒寫進網址的（被節流的那一段） */
let latest: ViewState | null = null;

/** 目前畫面的網址：分享連結、匯出圖片要用這個，不要讀 window.location（可能還差最後一次改寫） */
export function currentHref(): string {
  return latest ? new URL(buildUrl(latest), window.location.href).href : window.location.href;
}

function buildUrl(state: ViewState): string {
  const p = new URLSearchParams();
  if (state.topic) p.set('topic', state.topic);
  if (state.indicator) p.set('ind', state.indicator);
  if (state.item) p.set('item', state.item);
  if (state.year) p.set('year', String(state.year));
  if (state.country) p.set('country', state.country);
  if (state.view !== 'map') p.set('view', state.view);
  if (state.box) p.set('bbox', state.box.map((v) => v.toFixed(3)).join(','));
  if (state.threeD) p.set('3d', '1');
  if (state.grid !== null) p.set('grid', state.grid ? '1' : '0');
  if (state.compare.length) p.set('cmp', state.compare.join(','));
  if (state.time !== null) p.set('time', formatTimeParam(state.time));
  // 介面語言由 i18n 管理（切換時它自己改網址），這裡重寫網址時要保留
  const lang = langParam();
  if (lang) p.set(URL_PARAM, lang);
  const query = p.toString();
  return `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
}

export type UpdateUrlState = (patch: Partial<ViewState>, options?: { replace?: boolean }) => void;

export function useUrlState(): [ViewState, UpdateUrlState] {
  const [state, setState] = useState<ViewState>(read);
  // 上一筆寫進網址的狀態（第一次是 null：打開頁面時只改寫，不多一筆）
  const written = useRef<ViewState | null>(null);
  // 這次的變動只改寫目前這一筆：上一頁、下一頁讀回來的狀態，還有程式自己補正的（舊網址的指標 id）
  const replaceNext = useRef(false);
  // 等著寫進網址的計時器（節流或失敗重試），與上一次寫入的時間
  const timer = useRef<number | undefined>(undefined);
  const lastWrite = useRef(-Infinity);

  useEffect(() => {
    const onPop = () => {
      // 還沒寫的改寫是離開的那一筆的，不能寫到上一頁回來的這一筆
      window.clearTimeout(timer.current);
      timer.current = undefined;
      replaceNext.current = true;
      setState(read());
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    const before = written.current;
    written.current = state;
    const push = before !== null && !replaceNext.current && HISTORY_KEYS.some((k) => before[k] !== state[k]);
    replaceNext.current = false;
    latest = state;
    // 寫入的是當下最新的狀態：等待中又改了好幾次也只寫最後一次
    const flush = (asPush: boolean) => {
      window.clearTimeout(timer.current);
      timer.current = undefined;
      lastWrite.current = performance.now();
      if (latest && !setHistoryUrl(buildUrl(latest), asPush)) timer.current = window.setTimeout(() => flush(false), RETRY_MS);
    };
    if (push) {
      // 目前這一筆還有沒寫的改寫（例如剛拖完年份就換主題）：先補寫，上一頁回來才是離開時的年份
      if (timer.current !== undefined && before) setHistoryUrl(buildUrl(before), false);
      flush(true);
    } else if (timer.current === undefined) {
      const wait = lastWrite.current + REPLACE_INTERVAL_MS - performance.now();
      if (wait <= 0) flush(false);
      else timer.current = window.setTimeout(() => flush(false), wait);
    }
  }, [state]);

  const update = useCallback<UpdateUrlState>((patch, options) => {
    if (options?.replace) replaceNext.current = true;
    setState((s) => ({ ...s, ...patch }));
  }, []);
  return [state, update];
}
