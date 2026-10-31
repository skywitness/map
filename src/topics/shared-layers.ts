import type { Text } from '../i18n/lang';
import { MAP_TOKENS } from '../theme/tokens';
import { foreignTopic, isForeignKey, loadForeignLayer } from './foreign-layers';
import { TOPIC_MODULES, topicOf } from './registry';
import type { LinesOverlayDef, OverlayDef } from './types';

/**
 * 共用疊加圖層（2026-10-30，製作手冊第七批 126）：任何主題都能從地圖右上角的「圖層」選單打開幾個常用的圖層
 * （地震與火山、板塊邊界、發電廠、海底電纜、颱風路徑、鐵路、城市、季風）。圖層的定義與資料檔都是原本那個主題的
 * （打開時才下載那個主題的定義，`topic` 指到它的資料夾，不複製資料檔）；這裡只改 id、名稱（寫明是哪一年）與跟時間軸的方式。
 */

export interface SharedLayer {
  id: string;
  /** 選單上的名稱 */
  label: Text;
  /** 資料屬於哪個主題；在那個主題裡不列（它自己就有） */
  topic: string;
  /** 加上的疊加圖層 id，與同一份資料在別的主題裡的 id：主題自己已經有其中一個時不列（發電量主題本來就有運轉中的電廠） */
  ids: string[];
  /** 圖層的定義（第一次打開才載入） */
  load: () => Promise<OverlayDef[]>;
  /**
   * 這一項已經包含的別的主題的圖層（`<主題>/<圖層 id>`，foreign-layers.ts）：「更多主題的圖層…」不再列
   * （scripts/topic-catalog.mjs 檢查它們存在）
   */
  covers?: string[];
  /** 同一組只能開一個（季風的 1 月、7 月：風的粒子一次只畫一層），勾另一個時這個關掉 */
  group?: string;
}

/**
 * 今天的板塊邊界（PB2002，地震與火山主題的 plates.json）：顏色淡一點，疊在別的資料上當對照。
 * 板塊漂移主題的「今天的板塊邊界（對照）」也用這一個（plates.ts）
 */
export const PLATES_TODAY: LinesOverlayDef = {
  kind: 'lines',
  id: 'plates-today',
  topic: 'earthquakes',
  file: 'plates.json',
  label: { zh: '今天的板塊邊界（PB2002）', en: 'Today’s plate boundaries (PB2002)' },
  width: 1,
  color: {
    title: { zh: '邊界的種類', en: 'Boundary type' },
    classes: [
      { value: 1, color: MAP_TOKENS.inkSecondary, label: { zh: '聚合（隱沒帶、碰撞）', en: 'Convergent (subduction, collision)' } },
      { value: 2, color: MAP_TOKENS.inkSecondary, dash: true, label: { zh: '張裂（中洋脊、裂谷）', en: 'Divergent (ridges, rifts)' } },
      { value: 3, color: MAP_TOKENS.inkMuted, label: { zh: '轉形斷層', en: 'Transform faults' } },
    ],
  },
};

/** 原本那個主題的圖層，依 id 取出來，換成共用的寫法（所有指標、所有子項目都畫，資料在原本的主題） */
function from(topic: string, pick: Record<string, Partial<OverlayDef>>): () => Promise<OverlayDef[]> {
  return async () => {
    const definition = topicOf(await TOPIC_MODULES[topic](), topic);
    return Object.entries(pick).map(([id, change]) => {
      const def = definition.overlays?.find((o) => o.id === id);
      if (!def) throw new Error(`shared-layers: topic ${topic} has no overlay ${id}`);
      return { ...def, topic, indicators: undefined, items: undefined, hidden: undefined, ...change } as OverlayDef;
    });
  };
}

export const SHARED_LAYERS: SharedLayer[] = [
  {
    id: 'quakes',
    label: { zh: '地震與火山', en: 'Earthquakes and volcanoes' },
    topic: 'earthquakes',
    ids: ['shared-volcanoes', 'shared-quakes'],
    covers: ['earthquakes/volcanoes', 'earthquakes/quakes'],
    load: from('earthquakes', {
      volcanoes: { id: 'shared-volcanoes' },
      quakes: {
        id: 'shared-quakes',
        label: { zh: '規模 6 以上地震（1900 年起，累積到時間軸那一年）', en: 'M6+ earthquakes (since 1900, up to the year shown)' },
        overlayTime: 'cumulative',
      },
    }),
  },
  {
    id: 'plates',
    label: { zh: '板塊邊界', en: 'Plate boundaries' },
    topic: 'earthquakes',
    ids: ['plates-today'],
    covers: ['earthquakes/plates'],
    load: async () => [PLATES_TODAY],
  },
  {
    id: 'power-plants',
    label: { zh: '發電廠', en: 'Power plants' },
    topic: 'power-plants',
    ids: ['shared-plants', 'plants-operating'],
    covers: ['power-plants/plants-operating'],
    load: from('power-plants', {
      'plants-operating': {
        id: 'shared-plants',
        label: { zh: '運轉中的電廠（20 MW 以上，GEM 2026 年 9 月版的現況）', en: 'Operating power plants (20 MW+, GEM September 2026)' },
      },
    }),
  },
  {
    id: 'cables',
    label: { zh: '海底電纜', en: 'Submarine cables' },
    topic: 'submarine-cables',
    ids: ['shared-cables'],
    covers: ['submarine-cables/cables'],
    load: from('submarine-cables', {
      cables: {
        id: 'shared-cables',
        label: { zh: '海底電纜（到時間軸那一年啟用的，之後的年份含規劃中）', en: 'Submarine cables (in service by the year shown; later years include planned)' },
        overlayTime: 'cumulative',
      },
    }),
  },
  {
    id: 'typhoons',
    label: { zh: '颱風路徑', en: 'Cyclone tracks' },
    topic: 'typhoons',
    ids: ['shared-tracks'],
    covers: ['typhoons/tracks'],
    load: from('typhoons', {
      tracks: {
        id: 'shared-tracks',
        label: { zh: '颱風與颶風路徑（時間軸那一年，1950–2026 年以外畫最接近的一年）', en: 'Cyclone tracks (the year shown; outside 1950–2026 the nearest year)' },
        overlayTime: 'year',
        timeRange: [1950, 2026],
      },
    }),
  },
  {
    id: 'railways',
    label: { zh: '鐵路', en: 'Railways' },
    topic: 'transport',
    ids: ['railways'],
    // 鐵路是舊的寫法（app/overlays.ts 依 id 認得 railways）：Natural Earth 現在的路網，不跟時間軸
    load: async () => [{ id: 'railways', file: 'railways.json', topic: 'transport' }],
  },
  {
    id: 'cities',
    label: { zh: '城市', en: 'Cities' },
    topic: 'cities',
    ids: ['shared-cities'],
    covers: ['cities/cities'],
    load: from('cities', {
      cities: {
        id: 'shared-cities',
        label: { zh: '城市（時間軸那一年最接近的一期，1950–2100 每 5 年）', en: 'Cities (the nearest period to the year shown, every 5 years 1950–2100)' },
      },
    }),
  },
  // 季風（2026-10-31，第四輪 一、4 的「航海日誌疊季風」）：風與季風主題的風的粒子，月份固定（別的主題的時間軸是年份，不是月份）。
  // 風的粒子一次只畫一層，1 月、7 月同一組
  ...([1, 7] as const).map(
    (month): SharedLayer => ({
      id: `wind-${month}`,
      label: month === 1 ? { zh: '1 月的風（冬季季風）', en: 'January winds (winter monsoon)' } : { zh: '7 月的風（夏季季風）', en: 'July winds (summer monsoon)' },
      topic: 'wind',
      ids: [`shared-wind-${month}`],
      group: 'wind',
      load: from('wind', {
        wind: {
          id: `shared-wind-${month}`,
          label:
            month === 1
              ? { zh: '1 月的風（1991–2020 年平均，冬季季風）', en: 'January winds (1991–2020 average, winter monsoon)' }
              : { zh: '7 月的風（1991–2020 年平均，夏季季風）', en: 'July winds (1991–2020 average, summer monsoon)' },
          file: () => `field/${month}.json`,
        },
      }),
    }),
  ),
];

/** 共用疊加圖層或別的主題的圖層（`<主題>/<圖層 id>`）的資料屬於哪個主題：在那個主題裡不畫（它自己就有） */
export function sharedSourceTopic(id: string): string | undefined {
  return isForeignKey(id) ? foreignTopic(id) : SHARED_LAYERS.find((l) => l.id === id)?.topic;
}

const loaded = new Map<string, Promise<OverlayDef[]>>();

/** 共用圖層、別的主題的圖層的定義（同一個只載入一次，失敗的下次重試） */
export function loadSharedLayer(id: string): Promise<OverlayDef[]> {
  let promise = loaded.get(id);
  if (!promise) {
    const layer = SHARED_LAYERS.find((l) => l.id === id);
    promise = (isForeignKey(id) ? loadForeignLayer(id) : layer ? layer.load() : Promise.resolve([])).then((list) =>
      // 標成從圖層選單加上的（圖層開關的分級說明預設收起，Overlays.tsx 的 LayerControls）；鐵路是舊的寫法，沒有分級說明
      list.map((d) => (d.kind === undefined ? d : { ...d, added: true })),
    );
    promise.catch(() => loaded.delete(id));
    loaded.set(id, promise);
  }
  return promise;
}
