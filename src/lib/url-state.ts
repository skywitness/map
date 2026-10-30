import { useCallback, useEffect, useRef, useState } from 'react';
import { langParam, URL_PARAM } from '../i18n/lang';
import { boxFromLegacyRaw, type Box } from '../map/boxEstimate';
import { formatTimeParam, parseTimeParam } from './clock';
import { setHistoryUrl } from './history';
import { redirectTopic } from '../topics/redirects';

/** 畫面狀態全部放在網址參數，任何畫面都能直接複製網址分享。 */
export interface ViewState {
  topic: string | null;
  indicator: string | null;
  year: number | null;
  country: string | null;
  view: 'map' | 'table' | 'analysis';
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
  /** 嵌入模式（embed=1，2026-10-29）：放在別的網頁的 iframe 裡，只留地圖、指標、時間軸與資料來源 */
  embed: boolean;
  /** 在地圖上標數值（vals=1，2026-10-30） */
  labels: boolean;
  /** 分析檢視（view=analysis，2026-10-30）的設定，見 AnalysisState */
  analysis: AnalysisState;
}

/**
 * 分析檢視（src/analysis/）的設定，都寫在網址裡：
 * an=change|filter|multiples|swipe 分頁；back=10 變化跟幾年前比、chm=diff|pct 差值或成長率；
 * flt=tfr:lt:1.5,aged-65:gt:20 篩選條件（指標:lt 或 gt:數值）；mul=years|inds 並排的是年份或指標；
 * swp=y:1990 或 swp=i:aged-65 拉簾左邊放的年份或指標（右邊是目前的）
 */
export interface AnalysisState {
  tab: 'change' | 'filter' | 'multiples' | 'swipe';
  back: number;
  changeMode: 'diff' | 'pct' | null;
  filters: { indicator: string; op: 'lt' | 'gt'; value: number }[];
  multiples: 'years' | 'inds';
  swipe: { kind: 'year'; year: number } | { kind: 'ind'; indicator: string } | null;
}

const ANALYSIS_TABS = ['change', 'filter', 'multiples', 'swipe'] as const;

function readAnalysis(p: URLSearchParams): AnalysisState {
  const tab = ANALYSIS_TABS.find((t) => t === p.get('an')) ?? 'change';
  const back = Number(p.get('back'));
  const chm = p.get('chm');
  const filters = (p.get('flt') ?? '')
    .split(',')
    .map((part) => /^([\w-]+):(lt|gt):(-?[\d.]+(?:e-?\d+)?)$/.exec(part))
    .flatMap((m) => (m && Number.isFinite(Number(m[3])) ? [{ indicator: m[1], op: m[2] as 'lt' | 'gt', value: Number(m[3]) }] : []))
    .slice(0, 3);
  const swp = /^(y|i):(-?[\w-]+)$/.exec(p.get('swp') ?? '');
  const swipe =
    swp?.[1] === 'y' && Number.isInteger(Number(swp[2]))
      ? { kind: 'year' as const, year: Number(swp[2]) }
      : swp?.[1] === 'i'
        ? { kind: 'ind' as const, indicator: swp[2] }
        : null;
  return {
    tab,
    back: Number.isInteger(back) && back > 0 ? back : 10,
    changeMode: chm === 'diff' || chm === 'pct' ? chm : null,
    filters,
    multiples: p.get('mul') === 'inds' ? 'inds' : 'years',
    swipe,
  };
}

function writeAnalysis(p: URLSearchParams, a: AnalysisState): void {
  if (a.tab !== 'change') p.set('an', a.tab);
  if (a.back !== 10) p.set('back', String(a.back));
  if (a.changeMode) p.set('chm', a.changeMode);
  if (a.filters.length) p.set('flt', a.filters.map((f) => `${f.indicator}:${f.op}:${f.value}`).join(','));
  if (a.multiples !== 'years') p.set('mul', a.multiples);
  if (a.swipe) p.set('swp', a.swipe.kind === 'year' ? `y:${a.swipe.year}` : `i:${a.swipe.indicator}`);
}

export const COMPARE_MAX = 3;

/**
 * 每個主題自己的網址 t/<主題>/（2026-10-29 起，分享出去的預覽、搜尋引擎看得出是哪個主題；建置時每個主題有一份
 * 自己的 index.html，vite.config.ts 的 topicPages）。舊的 ?topic= 照樣讀得懂，寫回網址時換成新的。
 */
const TOPIC_PATH = /\/t\/([\w-]+)\/?$/;

/** 網站的根目錄（/map/）：在 t/<主題>/ 底下時去掉這一段 */
export function siteRoot(): string {
  return window.location.pathname.replace(TOPIC_PATH, '/').replace(/index\.html$/, '');
}

/** 主題的網址路徑（不含參數） */
export function topicPath(topic: string | null): string {
  return topic ? `${siteRoot()}t/${topic}/` : siteRoot();
}

/** 舊網址轉到合併後的主題時要一起打開的疊加圖層（topics/redirects.ts 的 layer），App 打開那個主題時取走 */
let redirectLayer: { topic: string; layer: string } | null = null;

/** 取走舊網址轉址時要打開的圖層（只取一次；主題不同時不給） */
export function takeRedirectLayer(topic: string): string | null {
  const pending = redirectLayer;
  if (!pending || pending.topic !== topic) return null;
  redirectLayer = null;
  return pending.layer;
}

/** 目前網址的畫面狀態（App 啟動時也用它提早發出第一個畫面的資料請求） */
export function read(): ViewState {
  const p = new URLSearchParams(window.location.search);
  // 年份可以是負的（西元前、百萬年前）或 0（板塊漂移的「今天」）；沒寫或寫錯是 null
  const rawYear = p.get('year')?.trim();
  const year = rawYear ? Number(rawYear) : NaN;
  // ?topic= 優先（主題之間的連結、舊的網址），再來是路徑
  const rawTopic = p.get('topic') ?? window.location.pathname.match(TOPIC_PATH)?.[1] ?? null;
  // 合併掉的舊主題（或搬到別的主題的指標）轉到現在的主題與指標；寫回網址時就是新的寫法（topics/redirects.ts）
  const moved = redirectTopic(rawTopic, p.get('ind'), p.get('item'));
  if (moved?.layer) redirectLayer = { topic: moved.topic, layer: moved.layer };
  return {
    topic: moved?.topic ?? rawTopic,
    indicator: moved ? moved.indicator : p.get('ind'),
    year: Number.isInteger(year) ? year : null,
    country: p.get('country'),
    view: p.get('view') === 'table' ? 'table' : p.get('view') === 'analysis' ? 'analysis' : 'map',
    item: moved ? moved.item : p.get('item'),
    // bbox= 是經緯度；舊版網址的 box= 是 Equal Earth 投影座標，換算過來
    box: parseBox(p.get('bbox')) ?? legacyBox(p.get('box')),
    threeD: p.get('3d') === '1',
    grid: p.get('grid') === '1' ? true : p.get('grid') === '0' ? false : null,
    compare: [...new Set((p.get('cmp') ?? '').split(',').filter((c) => /^_?[A-Z]{3}$/.test(c)))].slice(0, COMPARE_MAX),
    time: parseTimeParam(p.get('time')),
    embed: p.get('embed') === '1',
    labels: p.get('vals') === '1',
    analysis: readAnalysis(p),
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

/** 目前畫面的網址，加上或拿掉嵌入模式（分享選單的嵌入程式碼、嵌入模式裡「在世界資料地圖開啟」） */
export function hrefWithEmbed(embed: boolean): string {
  const url = new URL(currentHref());
  if (embed) url.searchParams.set('embed', '1');
  else url.searchParams.delete('embed');
  return url.href;
}

function buildUrl(state: ViewState): string {
  const p = new URLSearchParams();
  if (state.indicator) p.set('ind', state.indicator);
  if (state.item) p.set('item', state.item);
  if (state.year !== null) p.set('year', String(state.year));
  if (state.country) p.set('country', state.country);
  if (state.view !== 'map') p.set('view', state.view);
  if (state.box) p.set('bbox', state.box.map((v) => v.toFixed(3)).join(','));
  if (state.threeD) p.set('3d', '1');
  if (state.grid !== null) p.set('grid', state.grid ? '1' : '0');
  if (state.compare.length) p.set('cmp', state.compare.join(','));
  if (state.time !== null) p.set('time', formatTimeParam(state.time));
  if (state.labels) p.set('vals', '1');
  // 分析的設定只在分析檢視時寫（換回地圖時網址保持乾淨；設定照樣留在狀態裡，切回來還在）
  if (state.view === 'analysis') writeAnalysis(p, state.analysis);
  if (state.embed) p.set('embed', '1');
  // 介面語言由 i18n 管理（切換時它自己改網址），這裡重寫網址時要保留
  const lang = langParam();
  if (lang) p.set(URL_PARAM, lang);
  const query = p.toString();
  return `${topicPath(state.topic)}${query ? `?${query}` : ''}${window.location.hash}`;
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
