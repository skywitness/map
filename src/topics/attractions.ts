import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 景點地圖（pipeline/topics/attractions.py）：世界的博物館、動物園與水族館、主題樂園與雲霄飛車，每一處一個點，三個圖層。
 * 使用者 2026-10-29 決定：三類合成一個主題、用圖層切換；只畫點，不做各國的數量（數量反映 Wikidata 的收錄程度）；
 * 台灣的博物館用文化部的開放資料補，台灣缺的動物園、水族館手工補；已拆除、停業的不畫。
 */

export interface LayerKinds {
  id: 'museums' | 'zoos' | 'parks';
  label: Text;
  kinds: { value: number; label: Text; color: string }[];
}

const C = MAP_TOKENS.categorical;
/** 三個圖層一起畫，8 類各用一個類別色（任兩色都分得開） */
export const LAYERS: LayerKinds[] = [
  {
    id: 'museums',
    label: { zh: '博物館', en: 'Museums' },
    kinds: [
      { value: 1, label: { zh: '美術館', en: 'Art museum' }, color: C[7] },
      { value: 2, label: { zh: '自然與科學', en: 'Nature and science' }, color: C[0] },
      { value: 3, label: { zh: '歷史與文化', en: 'History and culture' }, color: C[2] },
      { value: 4, label: { zh: '其他博物館', en: 'Other museum' }, color: C[1] },
    ],
  },
  {
    id: 'zoos',
    label: { zh: '動物園與水族館', en: 'Zoos and aquariums' },
    kinds: [
      { value: 1, label: { zh: '動物園', en: 'Zoo' }, color: C[3] },
      { value: 2, label: { zh: '水族館', en: 'Aquarium' }, color: C[6] },
    ],
  },
  {
    id: 'parks',
    label: { zh: '主題樂園與雲霄飛車', en: 'Theme parks and roller coasters' },
    kinds: [
      { value: 1, label: { zh: '主題樂園、遊樂園', en: 'Theme or amusement park' }, color: C[5] },
      { value: 2, label: { zh: '雲霄飛車', en: 'Roller coaster' }, color: C[4] },
    ],
  },
];

export const kindLabel = (layer: LayerKinds, t: unknown) => tr(layer.kinds.find((k) => k.value === t)?.label ?? '');

/** 名稱：中文介面用中文名稱（Wikidata 的台灣用字、文化部），沒有的用英文 */
export function placeName(p: PointRecord, lang = getLang()): string {
  if (lang === 'zh' && typeof p.zh === 'string') return p.zh;
  return typeof p.en === 'string' ? p.en : typeof p.zh === 'string' ? p.zh : '';
}

export const articlesText = (n: number) =>
  tr({ zh: `${fixed(n, 0)} 種語言的維基百科有條目`, en: `Wikipedia articles in ${fixed(n, 0)} ${n === 1 ? 'language' : 'languages'}` });

function overlay(layer: LayerKinds, minValue: [number, number][]): PointsOverlayDef {
  const color: ColorClasses = {
    field: 't',
    title: { zh: '類型', en: 'Type' },
    thresholds: layer.kinds.slice(1).map((k) => k.value),
    classes: layer.kinds.map((k) => ({ color: k.color, label: k.label })),
  };
  return {
    kind: 'points',
    id: layer.id,
    file: `${layer.id}.json`,
    label: layer.label,
    radius: { field: 'sl', stops: [[0, 1.8], [10, 2.6], [40, 3.8], [100, 5.2]] },
    color,
    sortField: 'sl',
    minValue: { field: 'sl', stops: minValue },
    tooltip: (p, ctx) => {
      const country = typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null;
      const sl = Number(p.sl);
      const extra = [sl > 0 ? articlesText(sl) : p.moc === 1 ? tr({ zh: '文化部的博物館名錄', en: 'From Taiwan’s Ministry of Culture museum list' }) : null];
      const name = placeName(p);
      return {
        title: name,
        detail: [kindLabel(layer, p.t), country].filter(Boolean).join(' · '),
        extra: extra.filter((x): x is string => Boolean(x)),
        properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
      };
    },
  };
}

export const attractions: TopicDefinition = {
  id: 'attractions',
  title: { zh: '景點地圖', en: 'Attractions' },
  shortTitle: { zh: '景點地圖', en: 'Attractions' },
  defaultIndicator: 'attractions',
  defaultYear: 2026,
  sources: [
    { name: { zh: 'Wikidata（博物館、動物園、水族館、樂園、雲霄飛車的類別、位置、名稱與維基百科條目數）', en: 'Wikidata (types, locations, names and Wikipedia article counts)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    {
      name: { zh: '文化部「博物館」開放資料（台灣）', en: 'Taiwan Ministry of Culture museum open data' },
      url: 'https://data.gov.tw/dataset/6242',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh:
      '點是 Wikidata 收錄、有座標、沒有標關閉或拆除日期的博物館（含美術館、科學館、故居、紀念館等子類別）、動物園、水族館、主題樂園與遊樂園、雲霄飛車；同時是水族館與博物館的（例如海生館）算水族館，遊客中心、遺產鐵道不算博物館。' +
      '國家依座標判斷。縮小時只畫有名的：依有幾種語言的維基百科有條目，放大才畫全部；顏色依類型，一處屬於好幾型的依美術館、自然與科學、歷史與文化的順序取第一個。' +
      'Wikidata 的收錄各國差很多（德國、巴西、義大利大量匯入），所以不算各國的數量，只畫點。台灣用文化部的博物館開放資料補上 Wikidata 沒有的；台灣缺的動物園、水族館手工補（資料檔寫出處）。',
    en:
      'Dots are museums (including art galleries, science centres, house museums and memorials), zoos, aquariums, theme and amusement parks and roller coasters in Wikidata with coordinates and no closing or demolition date; places that are both an aquarium and a museum count as aquariums, and visitor centres and heritage railways are not counted as museums. ' +
      'Countries are assigned by location. Zoomed out, only well-known places are drawn, by the number of Wikipedia language editions with an article; zoom in to see all. Colours show the type; a place of several types takes the first of art, nature and science, and history and culture. ' +
      'Wikidata’s coverage differs a lot between countries (Germany, Brazil and Italy were imported in bulk), so countries are not counted, only drawn. Taiwan’s museums are supplemented from the Ministry of Culture’s open data, and missing Taiwanese zoos and aquariums were added by hand (sources in the data file).',
  },
  panelExtra: () => import('./panels/AttractionsPanel'),
  overlays: [
    overlay(LAYERS[0], [[0, 40], [3, 20], [5, 8], [7, 0]]),
    overlay(LAYERS[1], [[0, 15], [3, 5], [5, 0]]),
    overlay(LAYERS[2], [[0, 15], [3, 5], [5, 0]]),
  ],
  indicators: [
    {
      id: 'attractions',
      label: { zh: '博物館、動物園、樂園', en: 'Museums, zoos and parks' },
      description: {
        zh: '世界的博物館、動物園與水族館、主題樂園與雲霄飛車，每一處一個點，左下角的圖層可以分開開關。縮小時只畫有名的（有幾種語言的維基百科有條目），放大才畫全部；滑過看名稱與類型，點國家看那國最有名的幾處。',
        en: 'Museums, zoos and aquariums, and theme parks and roller coasters around the world, one dot each, with a layer switch for each group at bottom left. Zoomed out, only well-known places are drawn (by the number of Wikipedia language editions with an article); zoom in to see all. Hover for names and types; select a country for its best-known places.',
      },
      unit: '',
      file: 'attractions.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      missing: { zh: '國家不上色，看地圖上的點', en: 'Countries are not coloured; see the dots on the map' },
    },
  ],
};
