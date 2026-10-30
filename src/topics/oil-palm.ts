import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ClassGridOverlayDef, TopicDefinition } from './types';

/**
 * 油棕園（pipeline/topics/oil_palm.py）：Descals 等的全球油棕園範圍（10 m，2021 年）與種植年份（30 m，1990–2021），
 * 重新取樣成約 7 km 的類別網格（只有熱帶 BOUNDS 的範圍）。
 * 使用者 2026-10-30 決定：做 2021 年的範圍，再加種植年份，播放 1990–2021 年的擴張。
 */

const LAST = 2021;
/** grid/*.png 涵蓋的範圍，同 pipeline 的 BOUNDS */
const BOUNDS: [number, number, number, number] = [-96, -19.5, 160, 20.5];

const SEQ = MAP_TOKENS.sequential;
/** 種植年份的分期（圖例的分組）：越近越深 */
const PERIODS = [
  { from: 1989, to: 1989, color: SEQ[1], label: { zh: '1990 年以前', en: 'Before 1990' } },
  { from: 1990, to: 1999, color: SEQ[2], label: { zh: '1990 年代', en: '1990s' } },
  { from: 2000, to: 2009, color: SEQ[4], label: { zh: '2000 年代', en: '2000s' } },
  { from: 2010, to: 2015, color: SEQ[5], label: { zh: '2010–2015 年', en: '2010–2015' } },
  { from: 2016, to: 2021, color: MAP_TOKENS.categorical[6], label: { zh: '2016–2021 年', en: '2016–2021' } },
];

/** 代碼 = 種植年份的中位數 − 1988（1 是 1990 年以前、2 是 1990 年 … 33 是 2021 年） */
const PLANTING: ClassGridOverlayDef = {
  kind: 'classGrid',
  id: 'planting',
  label: { zh: '油棕園（約 7 km 網格，依種植年份）', en: 'Oil palm (about 7 km grid, by planting year)' },
  file: () => 'grid/planting.png',
  bounds: BOUNDS,
  upTo: (year) => Math.max(1, Math.min(LAST, year) - 1988),
  // 圖例依分期一列、每一年一個小色塊（同一期同一色）
  classes: Array.from({ length: LAST - 1988 }, (_, i) => {
    const year = 1989 + i;
    const g = PERIODS.findIndex((p) => year >= p.from && year <= p.to);
    return {
      value: i + 1,
      color: PERIODS[g].color,
      short: year === 1989 ? '<1990' : `’${String(year).slice(2)}`,
      label: year === 1989 ? PERIODS[0].label : { zh: `${year} 年種的`, en: `planted in ${year}` },
      group: g,
    };
  }),
  groups: PERIODS.map((p) => p.label),
  opacity: 0.9,
  indicators: ['area'],
};

const TYPE: ClassGridOverlayDef = {
  kind: 'classGrid',
  id: 'type',
  label: { zh: '油棕園（約 7 km 網格，2021 年）', en: 'Oil palm (about 7 km grid, 2021)' },
  file: () => 'grid/type.png',
  bounds: BOUNDS,
  classes: [
    { value: 1, color: MAP_TOKENS.categorical[6], short: { zh: '工業', en: 'Industrial' }, label: { zh: '工業油棕園為主', en: 'Mostly industrial' }, group: 0 },
    { value: 2, color: MAP_TOKENS.categorical[2], short: { zh: '小農', en: 'Smallholder' }, label: { zh: '小農油棕園為主', en: 'Mostly smallholder' }, group: 0 },
  ],
  groups: [{ zh: '2021 年', en: '2021' }],
  opacity: 0.9,
  indicators: ['smallholder'],
};

const NO_PALM = { zh: '沒有油棕園', en: 'No oil palm plantations' };

export const oilPalm: TopicDefinition = {
  id: 'oil-palm',
  title: { zh: '油棕園', en: 'Oil palm plantations' },
  shortTitle: { zh: '油棕園', en: 'Oil palm' },
  defaultIndicator: 'area',
  defaultYear: LAST,
  sources: [
    {
      name: {
        zh: 'Descals 等，Global oil palm extent and planting year from 1990 to 2021（v1.2，Zenodo 13379129）',
        en: 'Descals et al., Global oil palm extent and planting year from 1990 to 2021 (v1.2, Zenodo 13379129)',
      },
      url: 'https://doi.org/10.5281/zenodo.13379129',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh:
      '油棕園是 Descals 等用 Sentinel-1、Sentinel-2 衛星影像判釋的 2021 年全球範圍（10 m，分工業與小農），與用 Landsat 判釋的種植年份（30 m，1990–2021 年）。地圖重新取樣成約 7 km（0.0625°）的網格：油棕園占一格 3% 以上才畫，顏色是這一格的油棕園有一半種下去的年份（種植年份的中位數），播放時間軸看 1990 年起一格一格出現；1990 年以前種的另外一色。' +
      '國家的面積：2021 年是範圍圖的面積，之前的年份是 2021 年的面積乘上那一年以前種下的比例（種植年份圖），也就是 2021 年還在的油棕園當年已經種下的部分，後來砍掉或改種別的不算。' +
      '衛星只抓得到林冠已經閉合的成熟油棕（種下去約 3 年以上），新種的看不到；種植年份圖的解析度跟範圍圖不同、像素不一一對應。小農的比例是 2021 年範圍圖裡小農油棕園的面積占比。FAOSTAT 的收穫面積（例如 2024 年印尼 1,432 萬公頃）跟這裡的衛星面積算法不同，數字不一樣。台灣沒有油棕園。',
    en:
      'Oil palm is the 2021 global extent mapped by Descals et al. from Sentinel-1 and Sentinel-2 imagery (10 m, industrial and smallholder) and the planting year mapped from Landsat (30 m, 1990–2021). The map resamples them to a grid of about 7 km (0.0625°): cells at least 3% oil palm are drawn, coloured by the year by which half of the cell’s oil palm had been planted (the median planting year); play the time slider to watch cells appear from 1990. Palms planted before 1990 have their own colour. ' +
      'Country areas: 2021 is the area of the extent map; earlier years are the 2021 area times the share planted by then (from the planting-year map), i.e. the part of today’s plantations already planted, not counting plantations later cleared or converted. ' +
      'Satellites only detect mature palms with closed canopies (about three years after planting), so new plantings are missed, and the planting-year map has a different resolution from the extent map. The smallholder share is the share of 2021 oil palm area run by smallholders. FAOSTAT’s harvested area (14.32 million ha in Indonesia in 2024, for example) is measured differently and does not match these satellite areas. Taiwan has no oil palm plantations.',
  },
  noValue: { TWN: { zh: '台灣沒有油棕園', en: 'Taiwan has no oil palm plantations' } },
  focus: [90, -12, 130, 12],
  overlays: [PLANTING, TYPE],
  indicators: [
    {
      id: 'area',
      label: { zh: '油棕園的面積', en: 'Oil palm area' },
      description: {
        zh: '衛星看到的油棕園面積（萬公頃，圓點的大小），網格的顏色是種下去的年代。印尼、馬來西亞占全世界的大部分；按播放看 1990 年起婆羅洲、蘇門答臘的油棕園怎麼擴張（只算 2021 年還在的油棕園）。',
        en: 'Oil palm area seen by satellite (circle size, in 10,000 ha), with the grid coloured by when it was planted. Indonesia and Malaysia account for most of the world’s total; press play to watch plantations spread across Borneo and Sumatra from 1990 (counting only plantations still standing in 2021).',
      },
      unit: { zh: '萬公頃', en: '10,000 ha' },
      file: 'area.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: (v) => tr({ zh: `${fixed(v, v < 10 ? 1 : 0)} 萬公頃`, en: `${fixed(v * 10, 0)} thousand ha` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
      missing: NO_PALM,
    },
    {
      id: 'smallholder',
      label: { zh: '小農的比例', en: 'Smallholder share' },
      description: {
        zh: '2021 年的油棕園裡，小農（家庭經營的小塊油棕園）占的面積比例；其他是企業的工業油棕園。泰國、奈及利亞這類以小農為主，馬來西亞、印尼的工業油棕園比較多。網格依那一格是工業還是小農多上色。',
        en: 'Share of 2021 oil palm area run by smallholders (small family plots) rather than industrial estates. Smallholders dominate in places such as Thailand and Nigeria, while Malaysia and Indonesia have more industrial plantations. The grid shows whether industrial or smallholder plantations dominate each cell.',
      },
      unit: '%',
      file: 'smallholder.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 40, 60, 80] } },
      format: (v) => `${fixed(v, 0)}%`,
      formatTick: (v) => `${v}%`,
      missing: NO_PALM,
    },
  ],
};
