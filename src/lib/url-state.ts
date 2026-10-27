import { useCallback, useEffect, useRef, useState } from 'react';
import { langParam, URL_PARAM } from '../i18n/lang';
import { boxFromLegacyRaw, type Box } from '../map/boxEstimate';

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
 * 上一頁會直接離開網站）。年份、框選、3D、網格只改寫目前這一筆：拖時間軸、播放不會塞滿紀錄。
 */
const HISTORY_KEYS = ['topic', 'indicator', 'item', 'country', 'view'] as const;

function write(state: ViewState, push: boolean): void {
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
  // 介面語言由 i18n 管理（切換時它自己改網址），這裡重寫網址時要保留
  const lang = langParam();
  if (lang) p.set(URL_PARAM, lang);
  const query = p.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  if (push) window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
}

export type UpdateUrlState = (patch: Partial<ViewState>, options?: { replace?: boolean }) => void;

export function useUrlState(): [ViewState, UpdateUrlState] {
  const [state, setState] = useState<ViewState>(read);
  // 上一筆寫進網址的狀態（第一次是 null：打開頁面時只改寫，不多一筆）
  const written = useRef<ViewState | null>(null);
  // 這次的變動只改寫目前這一筆：上一頁、下一頁讀回來的狀態，還有程式自己補正的（舊網址的指標 id）
  const replaceNext = useRef(false);

  useEffect(() => {
    const onPop = () => {
      replaceNext.current = true;
      setState(read());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const before = written.current;
    written.current = state;
    const push = before !== null && !replaceNext.current && HISTORY_KEYS.some((k) => before[k] !== state[k]);
    replaceNext.current = false;
    write(state, push);
  }, [state]);

  const update = useCallback<UpdateUrlState>((patch, options) => {
    if (options?.replace) replaceNext.current = true;
    setState((s) => ({ ...s, ...patch }));
  }, []);
  return [state, update];
}
