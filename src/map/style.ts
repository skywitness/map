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

/**
 * 國名改用網站自己的名稱（跟側欄、tooltip 一樣，例如「台灣」，OpenStreetMap 的繁中名稱是「臺灣」）：
 * 底圖的國名有 iso_a2 欄位，其他地名照 LABELS。names 是 [iso2, 名稱] 的清單
 */
export function labelField(lang: Lang, names: [string, string][] = []): ExpressionSpecification {
  if (!names.length) return LABELS[lang];
  return ['match', ['coalesce', ['get', 'iso_a2'], ''], ...names.flat(), LABELS[lang]] as unknown as ExpressionSpecification;
}

/** 底圖裡顯示地名的文字圖層（道路編號、門牌號碼不算） */
export function isNameLayer(layer: LayerSpecification): boolean {
  if (layer.type !== 'symbol') return false;
  const field = layer.layout?.['text-field'];
  return Boolean(field && JSON.stringify(field).includes('name'));
}

export type Projection = 'globe' | 'mercator';

/**
 * 世界視角（縮放 WORLD_TILES_UNTIL 以下）的底圖改用 OpenFreeMap 的 0–1 級向量圖磚。
 * 2 級的圖磚一張約 600 KB（gzip 後），95% 是各國的州、省地名（每個地名 83 種語言），地球儀一開就要 9 張（約 4.7 MB）；
 * 0–1 級只有國名、海名與國界，4 張共約 450 KB，深色底圖也不會擠滿各省的名稱。
 * 底圖每個用到向量圖磚、這個縮放以下會畫的圖層都複製一份（id 加 WORLD_SUFFIX）改用 0–1 級的 source，原本的圖層從這裡開始。
 * 陸地改用我們的國界畫（WorldMap 的 base-land、base-lakes，到 LAND_UNTIL），水域不複製：0–1 級的海岸線約是
 * Natural Earth 1:110m，我們的國界是 1:50m。彩色地形例外：它的陰影點陣圖的海是不透明的白色（60% 不透明度），
 * 要靠上面的水域蓋住，否則海變成一片淡白
 */
export const WORLD_TILES_UNTIL = 3;
export const WORLD_SUFFIX = '--world';
/** 縮放這麼多以下，底色是海、陸地是我們的國界（base-land）：放大跨過 WORLD_TILES_UNTIL、新的圖磚還沒到時也不會露出一片底色 */
export const LAND_UNTIL = 4.5;

/** 底圖的陸地與海的顏色（splitWorldZoom 記在樣式的 metadata）；沒有改寫過的樣式回傳 null */
export function worldColors(style: StyleSpecification): { land: string; sea: string } | null {
  const meta = style.metadata as { worldColors?: { land: string; sea: string } } | undefined;
  return meta?.worldColors ?? null;
}

function splitWorldZoom(style: StyleSpecification): void {
  // 陸地是背景色，海是水域的填色；依縮放變化的（不是單純的顏色）就不改寫，照原本的圖磚
  const background = style.layers.find((l) => l.type === 'background');
  const water = style.layers.find((l) => l.type === 'fill' && l['source-layer'] === 'water');
  const land = background?.type === 'background' ? background.paint?.['background-color'] : undefined;
  const sea = water?.type === 'fill' ? water.paint?.['fill-color'] : undefined;
  if (typeof land !== 'string' || typeof sea !== 'string') return;
  const colors = { land, sea };
  style.metadata = { ...(style.metadata as object | undefined), worldColors: colors };
  const vector = new Set(Object.keys(style.sources).filter((id) => style.sources[id].type === 'vector'));
  const raster = style.layers.some((l) => l.type === 'raster');
  for (const id of vector) style.sources[id + WORLD_SUFFIX] = { ...style.sources[id], maxzoom: 1 } as typeof style.sources[string];
  const layers: LayerSpecification[] = [];
  for (const layer of style.layers) {
    const source = 'source' in layer ? layer.source : undefined;
    if (layer.type === 'background') {
      layers.push({ ...layer, paint: { ...layer.paint, 'background-color': ['step', ['zoom'], colors.sea, LAND_UNTIL, colors.land] } });
      continue;
    }
    if (!source || !vector.has(source) || (layer.minzoom ?? 0) >= WORLD_TILES_UNTIL) {
      layers.push(layer);
      continue;
    }
    const water = 'source-layer' in layer && layer['source-layer'] === 'water';
    // 原本在 WORLD_TILES_UNTIL 之前就結束的圖層（例如洲名）整個改用 0–1 級的圖磚
    if ((layer.maxzoom ?? 24) > WORLD_TILES_UNTIL) layers.push({ ...layer, minzoom: WORLD_TILES_UNTIL } as LayerSpecification);
    if (!water || raster) {
      layers.push({
        ...layer,
        id: layer.id + WORLD_SUFFIX,
        source: source + WORLD_SUFFIX,
        maxzoom: Math.min(layer.maxzoom ?? 24, WORLD_TILES_UNTIL),
      } as LayerSpecification);
    }
  }
  style.layers = layers;
}

const cache = new Map<string, Promise<StyleSpecification>>();

/**
 * 下載底圖樣式，改成目前語言的地名、指定的投影、深藍夜空的大氣層。
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
    splitWorldZoom(style);
    for (const layer of style.layers) {
      if (isNameLayer(layer) && layer.type === 'symbol') layer.layout = { ...layer.layout, 'text-field': LABELS[lang] };
    }
    style.projection = { type: projection };
    // 深藍夜空（背景本身是 CSS 的漸層，tokens.ts 的 SPACE_GRADIENT），地球邊緣一圈淡藍色大氣層
    style.sky = {
      'sky-color': '#0c1830',
      'horizon-color': '#6fa3e0',
      'fog-color': '#6fa3e0',
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
    };
    return style;
  });
}
