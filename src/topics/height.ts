import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, ScaleSpec, TopicDefinition } from './types';

/**
 * 平均身高（pipeline/topics/height.py）：NCD-RisC 的成人身高（1896–1996 年出生的人在 18 歲時，eLife 2016）
 * 與 19 歲的身高（1985–2019 年每年，Lancet 2020）。成人的時間軸是出生年，19 歲的是量測的年份（指標的 timeAxis）。
 */

const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };
/** 論文是 CC BY 4.0；網站的下載檔沒有另外標示授權（DESIGN.md 第 8 節第 71 點） */
const NCD_LICENSE = {
  zh: '論文 CC BY 4.0，資料檔未另外標示授權',
  en: 'paper CC BY 4.0; the data files carry no separate licence',
};
const CM = { zh: '公分', en: 'cm' };

const cm = (v: number) => tr({ zh: `${fixed(v, 1)} 公分`, en: `${fixed(v, 1)} cm` });
const cmTick = (v: number) => fixed(v, 0);
/** 先四捨五入到 0.1 再決定正負號，−0.04 不會寫成「−0.0」 */
function signed(v: number, digits: number): string {
  const r = Number(v.toFixed(digits));
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${fixed(Math.abs(r), digits)}`;
}
const change = (v: number) => tr({ zh: `${signed(v, 1)} 公分`, en: `${signed(v, 1)} cm` });

/** 成人身高的年份是出生年：1996 = 1996 年出生的人在 18 歲（2014 年）時的身高 */
const BORN: NonNullable<IndicatorDef['timeAxis']> = {
  label: { zh: '出生年', en: 'Birth year' },
  year: (y) => tr({ zh: `${y} 年出生`, en: `${y} birth cohort` }),
};
/** 19 歲的身高是量測的那一年；寫出來，換指標時看得出時間軸的意思變了 */
const MEASURED: NonNullable<IndicatorDef['timeAxis']> = {
  label: { zh: '年份', en: 'Year' },
  year: (y) => tr({ zh: `${y} 年`, en: String(y) }),
};

/**
 * 男女各一組門檻（每 4 公分一級，男性比女性高 12 公分，約是世界平均的男女差距），兩張地圖的深淺看得出同樣的國家排序；
 * 同一組門檻的話，女性的地圖大多在淺的那幾級。19 歲的身高用同一組，可以跟成人身高對照。
 */
const MEN_SCALE: ScaleSpec = { type: 'sequential', thresholds: [156, 160, 164, 168, 172, 176] };
const WOMEN_SCALE: ScaleSpec = { type: 'sequential', thresholds: [144, 148, 152, 156, 160, 164] };
/** 比 1896 年出生的高多少：±2 公分以內算幾乎沒變（中性灰），男女同一組 */
const CHANGE_SCALE: ScaleSpec = { type: 'diverging', thresholds: [-12, -6, -2, 2, 6, 12] };

/** 兩次估計的說明，19 歲的指標與側欄都用 */
export const TWO_ESTIMATES = {
  zh: '19 歲的身高是 NCD-RisC 2020 年的另一次估計（用了更多 2010 年代的調查），跟成人身高（2016 年的估計）同一批人的數字可能差好幾公分，兩者不能直接相減。',
  en: 'Heights at 19 come from a separate, later NCD-RisC estimate (2020, with more surveys from the 2010s); for the same people they can differ from the adult heights (the 2016 estimate) by several centimetres, so do not subtract one from the other.',
};

export const height: TopicDefinition = {
  id: 'height',
  title: { zh: '各國平均身高', en: 'Average height by country' },
  shortTitle: { zh: '平均身高', en: 'Height' },
  defaultIndicator: 'men',
  defaultYear: 1996,
  sources: [
    {
      name: {
        zh: 'NCD Risk Factor Collaboration (NCD-RisC), A century of trends in adult human height（eLife 2016）',
        en: 'NCD Risk Factor Collaboration (NCD-RisC), A century of trends in adult human height (eLife 2016)',
      },
      url: 'https://www.ncdrisc.org/archives.html',
      license: NCD_LICENSE,
    },
    {
      name: {
        zh: 'NCD-RisC, Height and body-mass index trajectories of school-aged children and adolescents from 1985 to 2019（Lancet 2020，19 歲的身高）',
        en: 'NCD-RisC, Height and body-mass index trajectories of school-aged children and adolescents from 1985 to 2019 (Lancet 2020; heights at 19)',
      },
      url: 'https://www.ncdrisc.org/data-downloads-height.html',
      license: NCD_LICENSE,
    },
    {
      name: { zh: 'UN World Population Prospects 2024（世界平均的權重）', en: 'UN World Population Prospects 2024 (weights for the world average)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: '衛生福利部國民健康署，國民營養健康狀況變遷調查 2013–2016、2017–2020 年成果報告（台灣的對照）',
        en: 'Health Promotion Administration (Taiwan), Nutrition and Health Survey in Taiwan 2013–2016 and 2017–2020 (comparison for Taiwan)',
      },
      url: 'https://www.hpa.gov.tw/Pages/List.aspx?nodeid=3998',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh: '成人身高是 NCD-RisC 依各國 1,472 份實際量測身高的調查建模估計的，時間軸是出生年：1996 年出生的人在 18 歲（2014 年）時的平均身高，95% 不確定區間在側欄。世界平均是用 WPP 那一年出生的人 18 歲時（1932 年以前出生的用 1950 年）15–19 歲的人口加權 200 國（同樣的算法套在 19 歲的身高上，跟 NCD-RisC 公布的全球值差 0.2 公分以內）。19 歲的身高是 NCD-RisC 2020 年的另一次估計，時間軸是量測的年份。NCD-RisC 的論文是 CC BY 4.0，網站上的資料檔沒有另外標示授權。南蘇丹、科索沃沒有單獨的估計。',
    en: 'Adult heights are NCD-RisC model estimates based on 1,472 population-based surveys that measured height, and the time axis is the year of birth: 1996 means the mean height at age 18 (in 2014) of people born in 1996; 95% uncertainty intervals are in the side panel. The world average weights the 200 countries by WPP population aged 15–19 in the year each cohort turned 18 (1950 for those born before 1932); the same method applied to heights at 19 comes within 0.2 cm of NCD-RisC’s global figures. Heights at 19 are a separate, later NCD-RisC estimate (2020) by year of measurement. The NCD-RisC papers are CC BY 4.0; the data files on its website carry no separate licence. South Sudan and Kosovo have no separate estimates.',
  },
  noValue: {
    SSD: { zh: 'NCD-RisC 沒有單獨估計南蘇丹', en: 'NCD-RisC has no separate estimate for South Sudan' },
    XKX: { zh: 'NCD-RisC 沒有單獨估計科索沃', en: 'NCD-RisC has no separate estimate for Kosovo' },
  },
  panelExtra: () => import('./panels/HeightPanel'),
  indicators: [
    {
      id: 'men',
      label: { zh: '男性平均身高', en: 'Height, men' },
      description: {
        zh: '男性在 18 歲時的平均身高，依出生年：1996 年出生的是 2014 年 18 歲時的身高。跟女性各用一組門檻，男性的高 12 公分。',
        en: 'Mean height of men at age 18, by year of birth: 1996 is the height in 2014 of men born in 1996. Men’s classes are 12 cm above women’s.',
      },
      unit: CM,
      file: 'men.json',
      layer: { kind: 'choropleth', scale: MEN_SCALE },
      format: cm,
      formatTick: cmTick,
      compareWorld: true,
      chartZoom: true,
      timeAxis: BORN,
    },
    {
      id: 'women',
      label: { zh: '女性平均身高', en: 'Height, women' },
      description: {
        zh: '女性在 18 歲時的平均身高，依出生年：1996 年出生的是 2014 年 18 歲時的身高。跟男性各用一組門檻，女性的低 12 公分。',
        en: 'Mean height of women at age 18, by year of birth: 1996 is the height in 2014 of women born in 1996. Women’s classes are 12 cm below men’s.',
      },
      unit: CM,
      file: 'women.json',
      layer: { kind: 'choropleth', scale: WOMEN_SCALE },
      format: cm,
      formatTick: cmTick,
      compareWorld: true,
      chartZoom: true,
      timeAxis: BORN,
    },
    {
      id: 'men-change',
      label: { zh: '男性比 1896 年長高', en: 'Change since 1896, men' },
      description: {
        zh: '這一年出生的男性比 1896 年出生的高多少公分（都是 18 歲時）。±2 公分以內算幾乎沒有變化；把時間軸拉到 1996 年就是整整一百年的變化。',
        en: 'How much taller men born in this year are than men born in 1896 (both at age 18). Within ±2 cm counts as little change; at 1996 it is the change over a full century.',
      },
      unit: CM,
      file: 'men-change.json',
      layer: { kind: 'choropleth', scale: CHANGE_SCALE },
      format: change,
      formatTick: (v) => signed(v, 0),
      compareWorld: true,
      chartZoom: true,
      timeAxis: BORN,
    },
    {
      id: 'women-change',
      label: { zh: '女性比 1896 年長高', en: 'Change since 1896, women' },
      description: {
        zh: '這一年出生的女性比 1896 年出生的高多少公分（都是 18 歲時）。跟男性同一組門檻；一百年長最多的是南韓女性（20.1 公分）。',
        en: 'How much taller women born in this year are than women born in 1896 (both at age 18), on the same classes as for men; South Korean women gained the most over the century (20.1 cm).',
      },
      unit: CM,
      file: 'women-change.json',
      layer: { kind: 'choropleth', scale: CHANGE_SCALE },
      format: change,
      formatTick: (v) => signed(v, 0),
      compareWorld: true,
      chartZoom: true,
      timeAxis: BORN,
    },
    {
      id: 'gap',
      label: { zh: '男女身高差距', en: 'Gap, men − women' },
      description: {
        zh: '同一年出生的男性比女性高多少公分（18 歲時）。差距沒有好壞，排名表只依數值排列。',
        en: 'How much taller men are than women born in the same year (at age 18). The gap is neither good nor bad, so the table is sorted by value without ranks.',
      },
      unit: CM,
      file: 'gap.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [8, 10, 11, 12, 13, 14] } },
      format: cm,
      formatTick: cmTick,
      compareWorld: true,
      chartZoom: true,
      unranked: true,
      timeAxis: BORN,
    },
    {
      id: 'men-19',
      label: { zh: '19 歲男性身高', en: 'Height at 19, men' },
      description: {
        zh: '19 歲男性的平均身高，依量測的年份（1985–2019 年）。跟成人身高同一組門檻；是 NCD-RisC 2020 年的另一次估計，跟成人身高不能直接相減。',
        en: 'Mean height of 19-year-old men by year of measurement (1985–2019), on the same classes as adult men. A separate NCD-RisC estimate (2020), not to be subtracted from the adult heights.',
      },
      unit: CM,
      file: 'men-19.json',
      layer: { kind: 'choropleth', scale: MEN_SCALE },
      format: cm,
      formatTick: cmTick,
      compareWorld: true,
      chartZoom: true,
      timeAxis: MEASURED,
      defaultYear: 2019,
    },
    {
      id: 'women-19',
      label: { zh: '19 歲女性身高', en: 'Height at 19, women' },
      description: {
        zh: '19 歲女性的平均身高，依量測的年份（1985–2019 年）。跟成人身高同一組門檻；是 NCD-RisC 2020 年的另一次估計，跟成人身高不能直接相減。',
        en: 'Mean height of 19-year-old women by year of measurement (1985–2019), on the same classes as adult women. A separate NCD-RisC estimate (2020), not to be subtracted from the adult heights.',
      },
      unit: CM,
      file: 'women-19.json',
      layer: { kind: 'choropleth', scale: WOMEN_SCALE },
      format: cm,
      formatTick: cmTick,
      compareWorld: true,
      chartZoom: true,
      timeAxis: MEASURED,
      defaultYear: 2019,
    },
  ],
};
