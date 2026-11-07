import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ItemFormat, PointsOverlayDef, Text, TopicDefinition } from './types';

/**
 * 歐洲的工業污染排放設施（E-PRTR）（新主題，2026-11-07，製作手冊第二十五批 488，候選 1151；環境的「污染」）：
 * EEA 工業申報資料 ver. 16.0（pipeline/topics/industrial_releases.py）。國家是申報設施排到空氣的總量（比例圓），
 * 設施點依 E-PRTR 部門上色、大小是排放量；側欄 panels/IndustrialReleasesPanel.tsx 是這一國排放最多的設施
 */
type Bi = { zh: string; en: string };
export const POLLUTANTS: { id: string; label: Text; unit: Bi; stops: [number, number][]; legend: number[] }[] = [
  {
    id: 'sox',
    label: { zh: '硫氧化物（SOx）', en: 'Sulphur oxides (SOx)' },
    unit: { zh: '公噸', en: 't' },
    stops: [[10, 1.4], [1000, 3], [10000, 6], [100000, 12]],
    legend: [1e3, 1e4, 1e5],
  },
  {
    id: 'nox',
    label: { zh: '氮氧化物（NOx）', en: 'Nitrogen oxides (NOx)' },
    unit: { zh: '公噸', en: 't' },
    stops: [[10, 1.4], [1000, 3], [5000, 6], [25000, 11]],
    legend: [1e3, 5e3, 2e4],
  },
  {
    id: 'pm10',
    label: { zh: '懸浮微粒（PM10）', en: 'Particulate matter (PM10)' },
    unit: { zh: '公噸', en: 't' },
    stops: [[5, 1.4], [100, 3], [500, 6], [2500, 11]],
    legend: [100, 500, 2000],
  },
  {
    id: 'hg',
    label: { zh: '汞', en: 'Mercury' },
    unit: { zh: '公斤', en: 'kg' },
    stops: [[1, 1.4], [20, 3], [200, 6], [1300, 11]],
    legend: [20, 200, 1000],
  },
];
const amount = (v: number, unit: Bi) =>
  tr({ zh: `${v < 10 ? fixed(v, 1) : formatLargeNumber(v)} ${unit.zh}`, en: `${v < 10 ? fixed(v, 1) : formatLargeNumber(v)} ${unit.en}` });
const ITEM_FORMATS: Record<string, ItemFormat> = Object.fromEntries(
  POLLUTANTS.map((p) => [p.id, { unit: p.unit, format: (v: number) => amount(v, p.unit), formatTick: formatLargeTick }]),
);
// E-PRTR 的部門 1–9 併成 6 類（造紙、畜牧、食品與其他併在一起）
export const SECTORS: Text[] = [
  { zh: '能源（發電、煉油等）', en: 'Energy (power, refining, etc.)' },
  { zh: '金屬（鋼鐵、冶煉）', en: 'Metals (steel, smelting)' },
  { zh: '礦物（水泥、玻璃、陶瓷）', en: 'Minerals (cement, glass, ceramics)' },
  { zh: '化學', en: 'Chemicals' },
  { zh: '廢棄物與污水', en: 'Waste and wastewater' },
  { zh: '其他（造紙、畜牧、食品等）', en: 'Other (paper, livestock, food, etc.)' },
];
export const sectorIndex = (s: number) => Math.min(Math.max(s, 1), 6) - 1;
const SECTOR_COLORS = [MAP_TOKENS.categorical[5], MAP_TOKENS.categorical[1], MAP_TOKENS.categorical[2], MAP_TOKENS.categorical[6], MAP_TOKENS.categorical[0], MAP_TOKENS.categorical[3]];
const POLLUTANT_DIM = {
  label: { zh: '污染物', en: 'Pollutant' },
  options: POLLUTANTS.map(({ id, label }) => ({ id, label })),
  defaultOption: 'sox',
};
const MISSING = {
  zh: '沒有資料（不在 E-PRTR 的申報範圍，或這一年沒有申報）',
  en: 'No data (outside E-PRTR reporting, or not reported this year)',
};

function facilityOverlay(p: (typeof POLLUTANTS)[number]): PointsOverlayDef {
  return {
    kind: 'points',
    id: 'eprtr-' + p.id,
    file: `facilities-${p.id}.json`,
    label: { zh: '申報的工業設施', en: 'Reporting industrial facilities' },
    indicators: ['facilities'],
    items: [p.id],
    timeField: 'y',
    radius: { field: 'v', stops: p.stops },
    color: {
      field: 's',
      title: { zh: '部門', en: 'Sector' },
      thresholds: [2, 3, 4, 5, 6],
      classes: SECTORS.map((label, i) => ({ color: SECTOR_COLORS[i], label })),
    },
    sortField: 'v',
    sizeLegend: { title: { zh: `一年排放（${p.unit.zh}）`, en: `Annual release (${p.unit.en})` }, values: p.legend, format: (v) => formatLargeNumber(v) },
    tooltip: (r, { countryName }) => ({
      title: typeof r.n === 'string' && r.n ? r.n : tr({ zh: '工業設施', en: 'Industrial facility' }),
      detail: `${tr(p.label)} ${amount(Number(r.v), p.unit)}`,
      extra: [
        tr(SECTORS[sectorIndex(Number(r.s))]),
        ...(typeof r.iso3 === 'string' && r.iso3 ? [countryName(r.iso3)] : []),
      ],
    }),
  };
}

export const industrialReleases: TopicDefinition = {
  id: 'industrial-releases',
  title: { zh: '歐洲的工業污染排放設施', en: 'Europe’s industrial polluters' },
  shortTitle: { zh: '工業污染排放', en: 'Industrial releases' },
  defaultIndicator: 'national',
  defaultYear: 2022,
  focus: [-25, 34, 45, 71],
  sources: [
    {
      name: {
        zh: 'EEA：Industrial Reporting under the IED and E-PRTR（ver. 16.0，2026 年 2 月）',
        en: 'EEA: Industrial Reporting under the IED and E-PRTR (ver. 16.0, February 2026)',
      },
      url: 'https://www.eea.europa.eu/en/datahub/datahubitem-view/9405f714-8015-4b5b-a63c-280b82861b3d',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '歐盟的污染物排放與轉移登錄（E-PRTR，規則 166/2006）與工業排放指令（2010/75/EU）要求超過門檻的大型工業設施逐年申報排到空氣、水與土壤的污染物；這裡用歐洲環境署（EEA）彙整的 ver. 16.0（2026 年 2 月），2007–2024 年排到空氣的四種污染物。只有超過申報門檻的設施才在裡面，小工廠、交通與住家的排放不算（各國的總排放見「空氣品質」的排放量）。各國申報完整度不同：2022 年有 27–29 國，2023、2024 年只有 23 國（捷克、斯洛伐克、挪威、瑞士等還沒有），最近兩年的合計會偏低；英國 2020 年脫歐後不在。戴奧辛沒有收：2024 年一座焚化廠申報的量是 2007 年全歐合計的 7 倍多，明顯是申報的問題。',
    en: 'The EU Pollutant Release and Transfer Register (E-PRTR, Regulation 166/2006) and the Industrial Emissions Directive (2010/75/EU) require large industrial facilities above set thresholds to report their annual releases to air, water and soil; this uses the European Environment Agency’s compilation, ver. 16.0 (February 2026), for four pollutants released to air in 2007–2024. Only facilities above the reporting thresholds are included; small plants, transport and households are not (see emissions under Air quality for national totals). Reporting completeness varies: 27–29 countries reported for 2022 but only 23 for 2023 and 2024 (Czechia, Slovakia, Norway, Switzerland and others are missing), so totals for the last two years are too low; the UK is absent from 2020 after leaving the EU. Dioxins are left out: one incinerator’s reported release for 2024 was more than seven times the European total for 2007, clearly a reporting error.',
  },
  panelExtra: () => import('./panels/IndustrialReleasesPanel'),
  overlays: POLLUTANTS.map(facilityOverlay),
  indicators: [
    {
      id: 'national',
      label: { zh: '工業設施排到空氣的污染物', en: 'Industrial releases to air' },
      description: {
        zh: '申報設施一年排到空氣的污染物合計，2022 年。硫氧化物 27 國約 101 萬公噸（2007 年 30 國 560 萬）：塞爾維亞 31.0 萬最多，德國 14.3 萬、波蘭 13.2 萬；單一設施以塞爾維亞的尼古拉特斯拉 A 電廠 10.7 萬公噸最多。氮氧化物 29 國約 111 萬公噸：德國 22.4 萬、波蘭 14.0 萬、西班牙 13.0 萬，最大的是波蘭的貝爾哈圖夫燃煤電廠 2.66 萬。PM10 約 4.67 萬公噸：德國 7,709、塞爾維亞 6,686、波蘭 6,066。汞約 16.3 公噸：德國 4,018 公斤、波蘭 2,692、捷克 2,081，最大的是保加利亞的馬里查東 2 號電廠 1,314 公斤。',
        en: 'Total releases to air from reporting facilities, 2022. Sulphur oxides: about 1.01 million tonnes across 27 countries (5.60 million across 30 in 2007), led by Serbia (310,000), Germany (143,000) and Poland (132,000); the largest single facility is Serbia’s Nikola Tesla A power plant (107,000 t). Nitrogen oxides: about 1.11 million tonnes across 29 countries, led by Germany (224,000), Poland (140,000) and Spain (130,000); the largest is Poland’s Bełchatów coal plant (26,600 t). PM10: about 46,700 tonnes, led by Germany (7,709), Serbia (6,686) and Poland (6,066). Mercury: about 16.3 tonnes, led by Germany (4,018 kg), Poland (2,692) and Czechia (2,081); the largest is Bulgaria’s Maritsa East 2 power station (1,314 kg).',
      },
      unit: { zh: '公噸', en: 'tonnes' },
      file: 'national/{item}.json',
      dimension: POLLUTANT_DIM,
      layer: { kind: 'bubble', legendValues: [1e3, 1e4, 1e5] },
      itemFormats: ITEM_FORMATS,
      format: (v) => amount(v, { zh: '公噸', en: 't' }),
      formatTick: formatLargeTick,
      missing: MISSING,
    },
    {
      id: 'facilities',
      label: { zh: '每一座申報設施', en: 'Each reporting facility' },
      description: {
        zh: '超過申報門檻的工業設施，點的大小是那一年排到空氣的量，顏色是部門（E-PRTR 的 9 個部門併成 6 類）。2022 年申報硫氧化物的 843 座、氮氧化物 1,988 座、PM10 346 座、汞 326 座；硫氧化物、氮氧化物與汞最大的幾座幾乎都是燃煤電廠，PM10 還有鋼鐵廠。拉動時間軸可以看到 2007 年以來燃煤電廠一座座變小或消失。',
        en: 'Industrial facilities above the reporting thresholds; dot size is that year’s release to air and colour is the sector (the nine E-PRTR sectors grouped into six). In 2022, 843 facilities reported sulphur oxides, 1,988 nitrogen oxides, 346 PM10 and 326 mercury; the largest sources of sulphur oxides, nitrogen oxides and mercury are almost all coal power plants, with steelworks also prominent for PM10. Move the time slider to see coal plants shrink or disappear since 2007.',
      },
      unit: '',
      file: 'facilities/{item}.json',
      dimension: POLLUTANT_DIM,
      layer: { kind: 'none' },
      // 換到這個指標時移到歐洲（國家不上色，地圖不移過去會停在原來的地方）
      focus: [-25, 34, 45, 71],
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      missing: { zh: '國家不上色，只畫設施的點', en: 'Countries are not coloured; facilities only' },
    },
  ],
};
