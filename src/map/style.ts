/**
 * 底圖樣式的下載與改寫。跟 WorldMap 分開放，才不會把 MapLibre 拉進首頁的 bundle：
 * App 一啟動就先抓樣式，跟 MapLibre 的 chunk、資料 JSON 平行下載。
 */
import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl';

/** 有些地名寫成「肯亞;肯尼亞」「巴布亞新幾內亞 / 巴布亞紐幾內亞」，只取第一個 */
function firstName(expr: ExpressionSpecification, separator: string): ExpressionSpecification {
  return ['case', ['in', separator, expr], ['slice', expr, 0, ['index-of', separator, expr]], expr];
}

// 底圖地名改成繁體中文，沒有中文名稱的才用原文
const ZH_HANT: ExpressionSpecification = ['to-string', ['get', 'name:zh-Hant']];
const ZH_NAME: ExpressionSpecification = [
  'case',
  ['has', 'name:zh-Hant'],
  firstName(firstName(firstName(ZH_HANT, ';'), ' / '), '/'),
  ['coalesce', ['get', 'name:zh'], ['get', 'name']],
];

/** 改成中文地名、地球儀投影、黑色太空背景 */
function patchStyle(style: StyleSpecification): StyleSpecification {
  for (const layer of style.layers) {
    if (layer.type !== 'symbol') continue;
    const field = layer.layout?.['text-field'];
    if (field && JSON.stringify(field).includes('name')) layer.layout = { ...layer.layout, 'text-field': ZH_NAME };
  }
  style.projection = { type: 'globe' };
  // 黑色太空背景，地球邊緣一圈淡藍色大氣層
  style.sky = {
    'sky-color': '#000000',
    'horizon-color': '#3a6ea5',
    'fog-color': '#3a6ea5',
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 5, 0.8, 7, 0],
  };
  return style;
}

const cache = new Map<string, Promise<StyleSpecification>>();

/** 下載底圖樣式；同一個網址只抓一次，每次拿到的是複本（MapLibre 可能會改動樣式物件） */
export function loadBaseStyle(url: string): Promise<StyleSpecification> {
  let promise = cache.get(url);
  if (!promise) {
    promise = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`底圖樣式 HTTP ${res.status}`);
      return res.json().then(patchStyle);
    });
    promise.catch(() => cache.delete(url)); // 失敗不快取，下次重試
    cache.set(url, promise);
  }
  return promise.then((style) => structuredClone(style));
}
