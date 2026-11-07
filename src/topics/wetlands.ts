import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 內陸水域與濕地（新主題，2026-11-07，製作手冊第二十七批 549，候選 1236；pipeline/topics/wetlands.py）。
 * GLWD v2（Lehner 等 2025）15 角秒的濕地面積比例與主要類別，各國的濕地占比、以哪一組濕地為主、各組占比，側欄是 33 類的面積。
 */

/** 33 類（GLWD_Legend_v2_0.csv；中文照本機 session 的翻譯，map-plan 的 data/glwd/README.md） */
export const GLWD_CLASSES: Record<number, Text> = {
  1: { zh: '淡水湖', en: 'Freshwater lake' },
  2: { zh: '鹹水湖', en: 'Saline lake' },
  3: { zh: '水庫', en: 'Reservoir' },
  4: { zh: '大河', en: 'Large river' },
  5: { zh: '大河的河口段', en: 'Large estuarine river' },
  6: { zh: '其他永久水體', en: 'Other permanent waterbody' },
  7: { zh: '小溪流', en: 'Small streams' },
  8: { zh: '湖濱濕地，有林', en: 'Lacustrine, forested' },
  9: { zh: '湖濱濕地，無林', en: 'Lacustrine, non-forested' },
  10: { zh: '河濱，經常淹水，有林', en: 'Riverine, regularly flooded, forested' },
  11: { zh: '河濱，經常淹水，無林', en: 'Riverine, regularly flooded, non-forested' },
  12: { zh: '河濱，季節性淹水，有林', en: 'Riverine, seasonally flooded, forested' },
  13: { zh: '河濱，季節性淹水，無林', en: 'Riverine, seasonally flooded, non-forested' },
  14: { zh: '河濱，季節性積水飽和，有林', en: 'Riverine, seasonally saturated, forested' },
  15: { zh: '河濱，季節性積水飽和，無林', en: 'Riverine, seasonally saturated, non-forested' },
  16: { zh: '沼澤，經常淹水，有林', en: 'Palustrine, regularly flooded, forested' },
  17: { zh: '沼澤，經常淹水，無林', en: 'Palustrine, regularly flooded, non-forested' },
  18: { zh: '沼澤，季節性積水飽和，有林', en: 'Palustrine, seasonally saturated, forested' },
  19: { zh: '沼澤，季節性積水飽和，無林', en: 'Palustrine, seasonally saturated, non-forested' },
  20: { zh: '短暫性濕地，有林', en: 'Ephemeral, forested' },
  21: { zh: '短暫性濕地，無林', en: 'Ephemeral, non-forested' },
  22: { zh: '北極與寒帶泥炭地，有林', en: 'Arctic/boreal peatland, forested' },
  23: { zh: '北極與寒帶泥炭地，無林', en: 'Arctic/boreal peatland, non-forested' },
  24: { zh: '溫帶泥炭地，有林', en: 'Temperate peatland, forested' },
  25: { zh: '溫帶泥炭地，無林', en: 'Temperate peatland, non-forested' },
  26: { zh: '熱帶與亞熱帶泥炭地，有林', en: 'Tropical/subtropical peatland, forested' },
  27: { zh: '熱帶與亞熱帶泥炭地，無林', en: 'Tropical/subtropical peatland, non-forested' },
  28: { zh: '紅樹林', en: 'Mangrove' },
  29: { zh: '鹽沼', en: 'Saltmarsh' },
  30: { zh: '大河三角洲', en: 'Large river delta' },
  31: { zh: '其他海岸濕地', en: 'Other coastal wetland' },
  32: { zh: '鹽灘、鹹水與半鹹水濕地', en: 'Salt pan, saline/brackish wetland' },
  33: { zh: '水稻田', en: 'Rice paddies' },
};

/** 7 組（pipeline 的 GROUPS），顏色跟類別圖一樣 */
const C = MAP_TOKENS.categorical;
export const WETLAND_GROUPS: (CategoryDef & { color: string; classes: number[] })[] = [
  { value: 1, label: { zh: '湖泊與水庫', en: 'Lakes and reservoirs' }, color: C[1], classes: [1, 2, 3, 6] },
  { value: 2, label: { zh: '河流', en: 'Rivers' }, color: C[0], classes: [4, 5, 7] },
  { value: 3, label: { zh: '湖濱與河濱濕地', en: 'Lake and river floodplain wetlands' }, color: C[2], classes: [8, 9, 10, 11, 12, 13, 14, 15] },
  { value: 4, label: { zh: '沼澤與短暫性濕地', en: 'Marshes and ephemeral wetlands' }, color: C[4], classes: [16, 17, 18, 19, 20, 21] },
  { value: 5, label: { zh: '泥炭地', en: 'Peatlands' }, color: C[6], classes: [22, 23, 24, 25, 26, 27] },
  { value: 6, label: { zh: '海岸濕地（紅樹林、鹽沼、三角洲）', en: 'Coastal wetlands (mangroves, saltmarsh, deltas)' }, color: C[3], classes: [28, 29, 30, 31, 32] },
  { value: 7, label: { zh: '水稻田', en: 'Rice paddies' }, color: C[5], classes: [33] },
];
export const groupOfClass = (cls: number) => WETLAND_GROUPS.find((g) => g.classes.includes(cls));

const HOW: Text = {
  zh: 'GLWD 第 2 版（Lehner 等 2025）把全世界的湖泊、河流與濕地分成 33 類，15 角秒（約 500 公尺）的網格；每一格有濕地占的面積比例與面積最大的一類。這裡把每格的濕地面積全部算給那一格的主要類別（GLWD 沒有給每格各類的比例），所以各類的面積是近似值。GLWD 的濕地包括湖泊、水庫、河流與水稻田，也包括季節性淹水或積水的地方，比一般說的「濕地」寬；有的是可能的範圍，不一定現在還是濕地（荷蘭排乾的泥炭地、圩田也算）。海岸邊落在國界外的格子歸給最近的國家；南極洲不在 GLWD 裡。',
  en: 'Version 2 of the Global Lakes and Wetlands Database (GLWD; Lehner et al. 2025) maps the world’s lakes, rivers and wetlands in 33 classes on a 15 arc-second (about 500 m) grid, giving each cell its wetland share and its dominant class. Here each cell’s wetland area is credited entirely to its dominant class (GLWD does not give per-class shares by cell), so class areas are approximate. GLWD’s wetlands include lakes, reservoirs, rivers and rice paddies as well as land that floods or stays waterlogged seasonally, a broader definition than the everyday one; some areas are potential extents that may no longer be wet (drained peatlands and polders in the Netherlands count). Coastal cells outside national borders go to the nearest country; Antarctica is not covered.',
};

const pct = (v: number, d = 1) => `${fixed(v, d)}%`;

export const wetlands: TopicDefinition = {
  id: 'wetlands',
  title: { zh: '內陸水域與濕地', en: 'Lakes, rivers and wetlands' },
  shortTitle: { zh: '濕地', en: 'Wetlands' },
  defaultIndicator: 'share',
  defaultYear: 2025,
  timeless: true,
  sources: [
    {
      name: {
        zh: 'GLWD 全球湖泊與濕地資料庫第 2 版（Lehner 等 2025，Earth System Science Data；figshare 28519994）',
        en: 'Global Lakes and Wetlands Database (GLWD) version 2 (Lehner et al. 2025, Earth System Science Data; figshare 28519994)',
      },
      url: 'https://doi.org/10.6084/m9.figshare.28519994.v1',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: 'GLWD 第 2 版合計 1,820 萬 km² 的湖泊、河流與濕地，是南極洲以外陸地的 13.4%（技術文件）；這裡依國界加總是 1,773 萬 km²（13.2%），差的主要是裏海這類離岸很遠、不屬於任何國家的水面。作者另請大家不要把整份資料用原始格式轉載到別的網站，這裡只放各國的統計。',
    en: 'GLWD version 2 totals 18.2 million km² of lakes, rivers and wetlands, 13.4% of the land outside Antarctica (technical documentation); summed by country here it comes to 17.73 million km² (13.2%), the difference being mainly water far from any coast, such as the Caspian Sea, that belongs to no country. The authors ask that the data not be redistributed in whole in its original format on other websites; only country statistics are shown here.',
  },
  panelExtra: () => import('./panels/WetlandsPanel'),
  indicators: [
    {
      id: 'share',
      label: { zh: '濕地合計占陸地的比例', en: 'Wetland share of land' },
      description: {
        zh: `湖泊、河流與各種濕地（GLWD 的 33 類合計）占陸地面積的比例。全世界 13.2%。陸地 1 萬 km² 以上的國家裡，孟加拉 88.2%（水稻田與恆河三角洲）最高，荷蘭 62.7%、巴哈馬 60.0%、斯里蘭卡 42.8%、柬埔寨 38.7%、印度 36.9%、甘比亞 36.8%、泰國 35.9%、芬蘭 34.9%、加拿大 33.9%、比利時 33.5%、越南 33.0%；俄羅斯 18.6%、日本 17.4%、中國大陸 12.7%、美國 11.9%、巴西 10.8%。台灣 21.1%，以水稻田最多（3,226 km²）。點國家看 33 類的面積。${HOW.zh}`,
        en: `Lakes, rivers and all kinds of wetland (GLWD’s 33 classes together) as a share of land area; 13.2% worldwide. Among countries with at least 10,000 km² of land, Bangladesh is highest at 88.2% (rice paddies and the Ganges delta), followed by the Netherlands 62.7%, the Bahamas 60.0%, Sri Lanka 42.8%, Cambodia 38.7%, India 36.9%, the Gambia 36.8%, Thailand 35.9%, Finland 34.9%, Canada 33.9%, Belgium 33.5% and Vietnam 33.0%; Russia 18.6%, Japan 17.4%, mainland China 12.7%, the US 11.9% and Brazil 10.8%. Taiwan is 21.1%, mostly rice paddies (3,226 km²). Select a country for the area of each of the 33 classes. ${HOW.en}`,
      },
      unit: '%',
      file: 'share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 30, 50] } },
      format: (v) => pct(v),
      formatTick: (v) => `${v}%`,
      missing: { zh: 'GLWD 沒有涵蓋或陸地太小', en: 'Not covered by GLWD, or too little land' },
    },
    {
      id: 'main',
      label: { zh: '以哪一種濕地為主', en: 'Main wetland type' },
      description: {
        zh: `這一國面積最大的一組濕地（33 類合成 7 組）。湖濱與河濱濕地（氾濫平原）最常見，90 國（美國、中國大陸、巴西、澳洲、日本、荷蘭等）；湖泊與水庫 70 國（加拿大、挪威、瑞典、哈薩克、蒙古，非洲大湖邊的馬拉威、烏干達、坦尚尼亞，以及許多小島）；海岸濕地 31 國（紅樹林、鹽沼、三角洲與鹽灘，埃及、阿聯、阿曼、利比亞這類沙漠國也在這一組）；泥炭地 20 國（俄羅斯、印尼、剛果民主共和國、芬蘭、英國、愛爾蘭、波蘭等）；水稻田 15 國（孟加拉、印度、越南、菲律賓、南韓、北韓、台灣等）。${HOW.zh}`,
        en: `The largest of seven wetland groups formed from the 33 classes. Lake and river floodplain wetlands are the most common, in 90 countries (the US, mainland China, Brazil, Australia, Japan, the Netherlands and others); lakes and reservoirs lead in 70 (Canada, Norway, Sweden, Kazakhstan, Mongolia, Malawi, Uganda and Tanzania on the African Great Lakes, and many small islands); coastal wetlands in 31 (mangroves, saltmarsh, deltas and salt pans, including desert countries such as Egypt, the UAE, Oman and Libya); peatlands in 20 (Russia, Indonesia, DR Congo, Finland, the UK, Ireland, Poland and others); and rice paddies in 15 (Bangladesh, India, Vietnam, the Philippines, South Korea, North Korea, Taiwan and others). ${HOW.en}`,
      },
      unit: '',
      file: 'main.json',
      layer: { kind: 'categorical', categories: WETLAND_GROUPS },
      format: (v) => tr(WETLAND_GROUPS.find((g) => g.value === v)?.label ?? { zh: '', en: '' }),
      missing: { zh: 'GLWD 沒有涵蓋或陸地太小', en: 'Not covered by GLWD, or too little land' },
    },
    {
      id: 'group',
      // 卡片與圖例的標題是子項目接指標名稱：「泥炭地占陸地的比例」
      label: { zh: '占陸地的比例', en: 'share of land' },
      description: {
        zh: `這一組濕地占陸地面積的比例（子項目切換 7 組）。${HOW.zh}`,
        en: `This group of wetlands as a share of land area (switch between the seven groups). ${HOW.en}`,
      },
      unit: '%',
      file: 'group/{item}.json',
      dimension: {
        label: { zh: '濕地', en: 'Wetland' },
        options: WETLAND_GROUPS.map((g) => ({ id: String(g.value), label: g.label })),
        defaultOption: '5',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 5, 10, 20] } },
      format: (v) => pct(v, v < 1 ? 2 : 1),
      formatTick: (v) => `${v}%`,
      missing: { zh: 'GLWD 沒有涵蓋或陸地太小', en: 'Not covered by GLWD, or too little land' },
    },
  ],
};
