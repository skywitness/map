/**
 * 底圖樣式的下載與改寫。跟 WorldMap 分開放，才不會把 MapLibre 拉進首頁的 bundle：
 * App 一啟動就先抓樣式，跟 MapLibre 的 chunk、資料 JSON 平行下載。
 */
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { Lang } from '../i18n/lang';

/** 有些地名寫成「肯亞;肯尼亞」「巴布亞新幾內亞 / 巴布亞紐幾內亞」，只取第一個 */
function firstName(expr: ExpressionSpecification, separator: string): ExpressionSpecification {
  return ['case', ['in', separator, expr], ['slice', expr, 0, ['index-of', separator, expr]], expr];
}

// 底圖地名跟著介面語言：中文用繁體中文名稱，英文用英文名稱，都沒有的才用當地原文
const ZH_HANT: ExpressionSpecification = ['to-string', ['get', 'name:zh-Hant']];
export const LABELS: Record<Lang, ExpressionSpecification> = {
  zh: [
    'case',
    ['has', 'name:zh-Hant'],
    firstName(firstName(firstName(ZH_HANT, ';'), ' / '), '/'),
    ['coalesce', ['get', 'name:zh'], ['get', 'name']],
  ],
  en: ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']],
};

/** 底圖裡顯示地名的文字圖層（道路編號、門牌號碼不算） */
export function isNameLayer(layer: LayerSpecification): boolean {
  if (layer.type !== 'symbol') return false;
  const field = layer.layout?.['text-field'];
  return Boolean(field && JSON.stringify(field).includes('name'));
}

export type Projection = 'globe' | 'mercator';

const cache = new Map<string, Promise<StyleSpecification>>();

/**
 * 下載底圖樣式，改成目前語言的地名、指定的投影、黑色太空背景。
 * 同一個網址只下載一次（App 啟動時先抓），每次呼叫都在複本上改寫（MapLibre 可能會改動樣式物件）。
 */
export function loadBaseStyle(url: string, projection: Projection = 'globe', lang: Lang = 'zh'): Promise<StyleSpecification> {
  let promise = cache.get(url);
  if (!promise) {
    promise = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`basemap style HTTP ${res.status}`);
      return res.json() as Promise<StyleSpecification>;
    });
    promise.catch(() => cache.delete(url)); // 失敗不快取，下次重試
    cache.set(url, promise);
  }
  return promise.then((raw) => {
    const style = structuredClone(raw);
    for (const layer of style.layers) {
      if (isNameLayer(layer) && layer.type === 'symbol') layer.layout = { ...layer.layout, 'text-field': LABELS[lang] };
    }
    style.projection = { type: projection };
    // 黑色太空背景，地球邊緣一圈淡藍色大氣層
    style.sky = {
      'sky-color': '#000000',
      'horizon-color': '#3a6ea5',
      'fog-color': '#3a6ea5',
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 5, 0.8, 7, 0],
    };
    return style;
  });
}
