import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 國家公園（pipeline/topics/national_parks.py）：Wikidata 的國家公園的點，依設立年份累積出現；各國陸域保護區占國土的比例
 * （世界銀行 WDI，UNEP-WCMC 的轉載）。使用者 2026-10-29 決定：新主題（地理），範圍的面不做。
 */

/** IUCN 保護區類別（pipeline 的 IUCN_II_CODE、IUCN_OTHER、IUCN_NONE） */
export const IUCN: { value: number; label: Text }[] = [
  { value: 1, label: { zh: 'IUCN 第 II 類（國家公園）', en: 'IUCN category II (national park)' } },
  { value: 2, label: { zh: 'IUCN 其他類別', en: 'Other IUCN category' } },
  { value: 3, label: { zh: '沒有標 IUCN 類別', en: 'No IUCN category given' } },
];
const IUCN_COLORS: ColorClasses = {
  field: 'c',
  title: { zh: 'IUCN 保護區類別', en: 'IUCN category' },
  thresholds: [2, 3],
  classes: [
    { color: MAP_TOKENS.categorical[3], label: IUCN[0].label },
    { color: MAP_TOKENS.categorical[2], label: IUCN[1].label },
    { color: MAP_TOKENS.categorical[1], label: IUCN[2].label },
  ],
};

export const iucnLabel = (c: unknown) => tr(IUCN.find((x) => x.value === c)?.label ?? '');

export function parkName(p: PointRecord, lang = getLang()): string {
  if (lang === 'zh' && typeof p.zh === 'string') return p.zh;
  return String(p.en ?? p.zh ?? '');
}

/** 設立年份與面積 */
export function parkFacts(p: PointRecord): string {
  const parts: string[] = [];
  parts.push(typeof p.y === 'number' ? tr({ zh: `${p.y} 年設立`, en: `established ${p.y}` }) : tr({ zh: '設立年份不詳', en: 'year unknown' }));
  if (typeof p.a === 'number') parts.push(`${fixed(p.a, 0)} km²`);
  return parts.join(' · ');
}

function parksLayer(id: string, file: string, label: Text, dated: boolean): PointsOverlayDef {
  return {
    kind: 'points',
    id,
    file,
    label,
    // 年份不詳的不隨時間軸出現，一直畫會讓早年看起來國家公園很多，預設關閉
    hidden: !dated,
    radius: { field: 'sl', stops: [[0, 2.2], [10, 3], [30, 4.2], [80, 6]] },
    color: IUCN_COLORS,
    sortField: 'sl',
    ...(dated ? { timeField: 'y' } : {}),
    tooltip: (p, ctx) => {
      const name = parkName(p);
      return {
        title: name,
        detail: [typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null, parkFacts(p)].filter(Boolean).join(' · '),
        extra: [iucnLabel(p.c)],
        properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
      };
    },
  };
}

export const nationalParks: TopicDefinition = {
  id: 'national-parks',
  title: { zh: '國家公園', en: 'National parks' },
  shortTitle: { zh: '國家公園', en: 'National parks' },
  defaultIndicator: 'parks-map',
  defaultYear: 2026,
  sources: [
    { name: { zh: 'Wikidata（國家公園的位置、設立年份、面積、IUCN 類別、名稱）', en: 'Wikidata (locations, years established, areas, IUCN categories, names)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    {
      name: { zh: 'World Bank, WDI（陸域保護區占國土，UNEP-WCMC 的 WDPA 與 WD-OECM）', en: 'World Bank, WDI (terrestrial protected areas, from UNEP-WCMC’s WDPA and WD-OECM)' },
      url: 'https://data.worldbank.org/indicator/ER.LND.PTLD.ZS',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh:
      '點是 Wikidata 收錄、有座標、沒有廢止的國家公園（含各國自己的子類別），依設立年份（成立時間）累積出現；1872 年黃石國家公園以前的年份是古蹟本身的年代，不是設立年份，跟沒有年份的一起放在「設立年份不詳」的圖層（約 400 處，預設關閉，打開後不隨時間軸變）。國家依座標判斷。' +
      '各國叫「國家公園」的意思不同：IUCN 第 II 類才是以保護生態為主的國家公園，英國的國家公園有城鎮住人（第 V 類），顏色依 Wikidata 標的 IUCN 類別。' +
      '陸域保護區占國土是世界銀行轉載 UNEP-WCMC 的資料（所有保護區，不只國家公園），沒有台灣。保護區的範圍（Protected Planet 的 WDPA）不准轉載，所以只畫點。台灣 9 座國家公園都有，壽山國家自然公園不是這一類。',
    en:
      'Dots are national parks in Wikidata (including each country’s own subclasses) with coordinates and no end date, appearing in the year they were established; years before Yellowstone (1872) are the age of a site itself, not of the park, and such parks go with those without a year into the “year unknown” layer (about 400, off by default and not tied to the timeline). Countries are assigned by location. ' +
      '“National park” means different things in different countries: IUCN category II parks are run mainly to protect ecosystems, while the UK’s national parks include towns (category V); colours follow the IUCN category in Wikidata. ' +
      'Terrestrial protected areas as a share of land come from UNEP-WCMC via the World Bank (all protected areas, not only national parks) and do not include Taiwan. The boundaries of protected areas (Protected Planet’s WDPA) may not be redistributed, so only dots are drawn. All 9 of Taiwan’s national parks are included.',
  },
  panelExtra: () => import('./panels/NationalParksPanel'),
  overlays: [
    parksLayer('parks', 'parks.json', { zh: '國家公園（依設立年份）', en: 'National parks (by year established)' }, true),
    parksLayer('parks-undated', 'parks-undated.json', { zh: '設立年份不詳的國家公園（預設關閉）', en: 'National parks, year unknown (off by default)' }, false),
  ],
  indicators: [
    {
      id: 'parks-map',
      label: { zh: '國家公園地圖', en: 'National parks map' },
      description: {
        zh: '世界的國家公園，依設立的年份一個一個出現：1872 年美國的黃石是第一個，接著是澳洲、加拿大、紐西蘭，1960、70 年代非洲與亞洲大量設立。台灣的第一座是 1984 年的墾丁。拖動時間軸或按播放；滑過看設立年份與面積，點國家列出它的國家公園。',
        en: 'National parks around the world, appearing in the year each was established: Yellowstone in the US was the first in 1872, followed by Australia, Canada and New Zealand, with many in Africa and Asia in the 1960s and 70s. Taiwan’s first was Kenting in 1984. Drag the timeline or press play; hover for the year and area, and select a country for its list.',
      },
      unit: '',
      file: 'parks-map.json',
      layer: { kind: 'none' },
      overlayTime: 'cumulative',
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      missing: { zh: '國家不上色，看地圖上的點', en: 'Countries are not coloured; see the dots on the map' },
    },
    {
      id: 'protected-land',
      label: { zh: '陸域保護區占國土', en: 'Protected land' },
      description: {
        zh: '陸地上的保護區（國家公園、自然保留區等，含其他有效保育措施）占國土的比例。塞席爾 68%、委內瑞拉 57%、不丹 52%，德國 39%、日本 30%、美國 13%；世界 2025 年 16.5%。沒有台灣的資料。',
        en: 'Protected areas on land (national parks, nature reserves and other effective area-based conservation measures) as a share of land area. Seychelles 68%, Venezuela 57%, Bhutan 52%, Germany 39%, Japan 30%, the US 13%; 16.5% worldwide in 2025. Taiwan is not included.',
      },
      unit: '%',
      file: 'protected-land.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 17, 25, 35, 50] } },
      overlayTime: 'cumulative',
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${fixed(v, 0)}%`,
      compareWorld: true,
    },
  ],
};
