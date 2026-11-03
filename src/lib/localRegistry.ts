import type { Text } from '../i18n/lang';

/**
 * 本機匯入（製作手冊第十三批 209，DESIGN.md 第 11 節「本機匯入」）的來源清單：匯入時（lib/localData.ts）寫進 IndexedDB，
 * 同時把清單（about.json 與匯入時算好的門檻、類別、年份範圍，不含資料本身）抄一份在 localStorage，
 * 網站一打開就能同步讀到、決定要不要載入 topics/localTopics.ts。沒有匯入過的瀏覽器只多讀一個 localStorage 的鍵。
 */

/** 網站裡本機匯入的指標、圖層、主題的 id 都以這個開頭（網址不記，url-state.ts） */
export const LOCAL_PREFIX = 'local-';
export const isLocalId = (id: string | null | undefined): boolean => Boolean(id?.startsWith(LOCAL_PREFIX));

const STORAGE_KEY = 'world-map-local-sources';

export interface LocalField {
  field: string;
  label: Text;
  unit?: Text;
  decimals?: number;
  /** 值是年份：不加千分位 */
  year?: boolean;
}

export type LocalColor =
  | { field: string; categories: { value: string; label: Text }[] }
  | { field: string; scale?: number[] | 'auto'; diverging?: boolean; reverse?: boolean };

export interface LocalTime {
  field: string;
  mode?: 'year' | 'cumulative' | number;
  end?: string;
}

export interface LocalList {
  label: Text;
  sorts?: { field: string; label: Text; order?: 'asc' | 'desc' }[];
  group?: string;
}

export interface LocalTableSpec {
  file: string;
  id?: string;
  label: Text;
  description?: Text;
  unit?: Text;
  decimals?: number;
  map?: 'choropleth' | 'bubble' | 'categorical';
  scale?: number[] | 'auto';
  diverging?: boolean;
  reverse?: boolean;
  categories?: { value: string; label: Text }[];
  ordinal?: boolean;
  latestWithin?: number;
  lowerIsBetter?: boolean;
  unranked?: boolean;
  integer?: boolean;
  shareOfWorld?: boolean;
}

export interface LocalPointSpec {
  file: string;
  id?: string;
  label: Text;
  description?: Text;
  name?: string;
  country?: string;
  fields?: LocalField[];
  size?: { field: string };
  color?: LocalColor;
  time?: LocalTime;
  list?: LocalList;
  series?: { file: string; key: string; label: Text; unit?: Text; decimals?: number };
  labels?: boolean;
  hidden?: boolean;
}

export type LocalShapeSpec = Omit<LocalPointSpec, 'size' | 'series' | 'country'>;

export interface LocalFlowWords {
  partners: Text;
  main: Text;
  verb: Text;
}

export interface LocalFlowSpec {
  file: string;
  id?: string;
  label: Text;
  description?: Text;
  unit?: Text;
  decimals?: number;
  direction?: 'export' | 'import' | 'larger';
  presence?: boolean;
  words?: { export?: LocalFlowWords; import?: LocalFlowWords };
  types?: { value: string; label: Text }[];
}

export interface LocalAbout {
  format: 1;
  title: Text;
  source: { name: string; page?: string; terms?: Text; files?: string[]; downloaded?: string; notice?: Text };
  topic?: string;
  newTopic?: {
    id: string;
    title: Text;
    shortTitle?: Text;
    description?: Text;
    group?: string;
    defaultYear?: number;
    focus?: [number, number, number, number];
  };
  tables?: LocalTableSpec[];
  points?: LocalPointSpec[];
  flows?: LocalFlowSpec[];
  shapes?: LocalShapeSpec[];
}

/** 匯入時依資料算好的東西（網站一打開就要用、不想先讀整份資料的） */
export type LocalDerived =
  | {
      kind: 'table';
      monthly: boolean;
      years: [number, number];
      taiwan: boolean;
      countries: number;
      rows: number;
      /** 面量圖的門檻（scale 是 auto 時依資料算的） */
      thresholds?: number[];
      /** 類別圖：代碼 → 原本的文字（依 about 的 categories 排，沒列的接在後面） */
      categories?: string[];
      labels: boolean;
    }
  | { kind: 'flow'; years: [number, number]; taiwan: boolean; countries: number; rows: number }
  | {
      kind: 'points' | 'shapes';
      count: number;
      years?: [number, number];
      /** color 依數值分級時的門檻 */
      thresholds?: number[];
      /** color 依類別時：代碼 → 文字 */
      categories?: string[];
      /** size 欄位的最大值 */
      sizeMax?: number;
      polygons?: boolean;
    };

export interface LocalSourceMeta {
  /** 資料夾名稱（製作手冊的代號，例如 p01-un-tourism） */
  id: string;
  importedAt: number;
  about: LocalAbout;
  /** key 是各檔的 id（tables、points、flows、shapes 的 id） */
  derived: Record<string, LocalDerived>;
  files: { name: string; bytes: number }[];
  warnings: string[];
}

/** localStorage 裡的清單；讀不到（私密瀏覽、封鎖網站資料、格式不對）就是空的 */
export function readLocalRegistry(): LocalSourceMeta[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(list) ? (list as LocalSourceMeta[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalRegistry(list: LocalSourceMeta[]): boolean {
  try {
    if (list.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    else window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** 網站裡的 id：local-<來源>-<檔的 id> */
export const localEntryId = (source: string, entry: string): string => `${LOCAL_PREFIX}${source}-${entry}`;
/** 檔的 id：about 裡寫的，沒寫用檔名去掉副檔名 */
export const entryId = (spec: { id?: string; file: string }): string => spec.id ?? spec.file.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-');
