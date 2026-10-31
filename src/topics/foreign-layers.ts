import { tr, type Text } from '../i18n/lang';
import { TOPIC_MODULES, topicOf } from './registry';
import { dataFolder, type OverlayDef, type TopicDefinition } from './types';

/**
 * 別的主題的圖層（2026-10-31，使用者選的第四輪 一、4）：圖層選單的「更多主題的圖層…」可以把任何主題的點、線圖層
 * 疊到目前的主題上（例如人口密度疊地震、航海日誌疊颱風路徑）。跟共用疊加圖層（shared-layers.ts）一樣，
 * 定義與資料檔都是原本那個主題的，加上時才載入那個主題的定義；圖層的 key 是 `<主題>/<圖層 id>`。
 *
 * 可以選的圖層與名稱寫在 foreignLayers.gen.ts（scripts/topic-catalog.mjs 產生，選單打開時才下載），選單不必載入全部主題。
 */

/** 可以疊到別的主題上的一個圖層（foreignLayers.gen.ts 的一列） */
export interface ForeignLayerEntry {
  id: string;
  label: Text;
  kind: 'points' | 'lines';
}

export interface ForeignTopicEntry {
  topic: string;
  layers: ForeignLayerEntry[];
}

/** `<主題>/<圖層 id>`：共用疊加圖層的 id 沒有斜線 */
export const isForeignKey = (id: string) => id.includes('/');
export const foreignKey = (topic: string, layer: string) => `${topic}/${layer}`;
/** key 的主題 id */
export const foreignTopic = (key: string) => key.slice(0, key.indexOf('/'));

/**
 * 這個主題可以疊到別的主題上的點、線圖層：
 * - 不收即時資料算的點（fromLive）、使用者匯入的線（local）：別的主題沒有那份即時資料、沒有匯入的路線
 * - 不收檔名依子項目或年份換的（`{item}`、`{year}`）：別的主題的子項目、時間軸對不上
 * - 不收借用別的主題資料的（topic 是另一個主題）：原本那個主題已經列了
 */
export function shareableOverlays(topic: TopicDefinition): ForeignLayerEntry[] {
  const folder = dataFolder(topic);
  return (topic.overlays ?? []).flatMap((o) => {
    if ((o.kind !== 'points' && o.kind !== 'lines') || o.shareable === false) return [];
    if ((o.kind === 'points' && o.fromLive) || (o.kind === 'lines' && o.local)) return [];
    if (o.file.includes('{item}') || o.file.includes('{year}')) return [];
    if (o.topic && o.topic !== folder) return [];
    return [{ id: o.id, label: o.label, kind: o.kind }];
  });
}

/** 加到別的主題上的圖層 id（跟那個主題自己的圖層、共用疊加圖層分開） */
export const foreignLayerId = (key: string) => `x-${key.replace('/', '-')}`;

/**
 * 別的主題的圖層的定義：所有指標、所有子項目都畫，預設打開；名稱前面加上主題名稱（圖例、圖層開關分得出是哪個主題的）。
 * 跟時間軸的方式用原本那個主題裡畫這個圖層的指標（圖層的 indicators 第一個，沒有就是預設指標）的 overlayTime；
 * 只畫那一年（或那一年起 n 年）的圖層，時間軸超出資料的年份時畫最接近的一年（timeRange 'data'），不會整層空白。
 */
export async function loadForeignLayer(key: string): Promise<OverlayDef[]> {
  const topicId = foreignTopic(key);
  const layerId = key.slice(topicId.length + 1);
  const load = TOPIC_MODULES[topicId];
  if (!load) return [];
  const topic = topicOf(await load(), topicId);
  const def = topic.overlays?.find((o) => o.id === layerId);
  if (!def || (def.kind !== 'points' && def.kind !== 'lines')) return [];
  const indicator = topic.indicators.find((i) => i.id === (def.indicators?.[0] ?? topic.defaultIndicator));
  // 年份欄位不是西元年的（節慶的月份）：不跟時間軸，全部畫
  const untimed = def.shareable === 'untimed';
  // 原本的指標沒寫是只畫那一年（applyTimeFilters 的預設）；要寫出來，不然會用目前主題的指標的方式
  const overlayTime = def.overlayTime ?? indicator?.overlayTime ?? 'year';
  const label: Text = {
    zh: `${tr(topic.title, 'zh')}：${tr(def.label, 'zh')}`,
    en: `${tr(topic.title, 'en')}: ${tr(def.label, 'en')}`,
  };
  return [
    {
      ...def,
      id: foreignLayerId(key),
      topic: def.topic ?? dataFolder(topic),
      label,
      indicators: undefined,
      items: undefined,
      hidden: undefined,
      overlayTime,
      timeRange: def.timeRange ?? (def.timeField && overlayTime !== 'cumulative' ? 'data' : undefined),
      ...(untimed ? { timeField: undefined, endField: undefined, timeRange: undefined } : {}),
      // 換一期時地圖移過去（奧運場館框住那一屆）是那個主題自己的瀏覽方式，疊在別的主題上不動地圖
      ...(def.kind === 'points' ? { fitOnEpoch: undefined } : {}),
    } as OverlayDef,
  ];
}
