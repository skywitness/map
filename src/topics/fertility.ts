import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

const PER_WOMAN = { zh: '每位婦女生育數', en: 'births per woman' };
const BIRTHS = { zh: '人', en: 'births' };
const PER_100_WORKING = { zh: '65 歲以上／每百位 15–64 歲', en: 'aged 65+ per 100 aged 15–64' };
const YOUNG_PER_100 = { zh: '0–14 歲／每百位 15–64 歲', en: 'aged 0–14 per 100 aged 15–64' };
const DEPENDENTS_PER_100 = { zh: '0–14 歲加 65 歲以上／每百位 15–64 歲', en: 'aged 0–14 and 65+ per 100 aged 15–64' };
/** 人口金字塔的形狀（pipeline/topics/fertility.py 的 YOUNG、MIDDLE、AGED；門檻使用者 2026-10-29 決定） */
const SHAPES = [
  { value: 1, label: { zh: '年輕型（0–14 歲 30% 以上）', en: 'Young (30%+ aged 0–14)' } },
  { value: 2, label: { zh: '壯年型', en: 'Middle' } },
  { value: 3, label: { zh: '高齡型（65 歲以上 20% 以上）', en: 'Aged (20%+ aged 65+)' } },
];
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

export const fertility: TopicDefinition = {
  id: 'fertility',
  title: { zh: '各國生育率與高齡化', en: 'Fertility and ageing by country' },
  shortTitle: { zh: '生育與高齡', en: 'Fertility' },
  defaultIndicator: 'tfr',
  defaultYear: 2023,
  sources: [
    {
      name: {
        zh: 'United Nations, World Population Prospects 2024（中推估）',
        en: 'United Nations, World Population Prospects 2024 (medium variant)',
      },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: { zh: '內政部戶政司人口統計（台灣的附註）', en: 'Ministry of the Interior (Taiwan), population statistics (notes on Taiwan)' },
      url: 'https://www.ris.gov.tw/app/portal/346',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: '國家發展委員會，中華民國人口推估（2026 至 2075 年）（台灣的附註）',
        en: 'National Development Council (Taiwan), population projections 2026–2075 (notes on Taiwan)',
      },
      url: 'https://pop-proj.ndc.gov.tw/',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh: '所有國家都是聯合國 WPP 2024 用同一套方法的估計，2024 年起是推估（中推估）。台灣也用 WPP：2023 年以前跟內政部的統計很接近（總生育率 0.87 對 0.865），但 2025 年台灣實際的總生育率掉到 0.695、出生 107,812 人，WPP 的推估是 0.86、12.5 萬人；國發會 2026 年的人口推估也比 WPP 悲觀（2075 年 65 歲以上占 52.9%，WPP 是 43%）。點台灣可以看到對照。',
    en: "Every country is a UN WPP 2024 estimate made with the same method; from 2024 the figures are projections (medium variant). Taiwan uses WPP too: up to 2023 it is close to the Ministry of the Interior's statistics (a fertility rate of 0.87 against 0.865), but in 2025 Taiwan's actual fertility rate fell to 0.695 with 107,812 births, while WPP projected 0.86 and 125,000. The National Development Council's 2026 projections are also gloomier than WPP's (52.9% aged 65+ in 2075, against 43%). Select Taiwan for the comparison.",
  },
  panelExtra: () => import('./panels/FertilityPanel'),
  indicators: [
    {
      id: 'tfr',
      label: { zh: '總生育率', en: 'Fertility rate' },
      description: {
        zh: '照當年各年齡婦女的生育率，一位婦女一生平均會生幾個孩子。約 2.1 是「替代水準」：長期低於它又沒有移民，人口就會減少。中間灰色那一級（1.9–2.3）接近替代水準，越橘越低、越綠越高。',
        en: "Total fertility rate: the number of children a woman would have over her lifetime at that year's fertility rates for each age. About 2.1 is replacement level: below it, without migration, a population shrinks in the long run. The grey middle class (1.9–2.3) is close to replacement; deeper orange is lower, deeper green higher.",
      },
      unit: PER_WOMAN,
      file: 'tfr.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [1, 1.5, 1.9, 2.3, 3.5, 5] } },
      format: (v) => tr({ zh: `${fixed(v, 2)} 人`, en: `${fixed(v, 2)} per woman` }),
      formatTick: (v) => fixed(v, v % 1 === 0 ? 0 : 1),
      compareWorld: true,
    },
    {
      id: 'aged-65',
      label: { zh: '65 歲以上人口比例', en: 'Population aged 65+' },
      description: {
        zh: '65 歲以上人口占總人口的比例。常用的分法：超過 7% 是高齡化社會、14% 是高齡社會、20% 是超高齡社會，圖例的門檻也用這幾個數字。',
        en: "People aged 65 and over as a share of the population. By the usual definitions a society is 'ageing' above 7%, 'aged' above 14% and 'super-aged' above 20%; the legend uses the same thresholds.",
      },
      unit: '%',
      file: 'aged-65.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 7, 10, 14, 20, 30] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'old-age-dependency',
      label: { zh: '扶老比', en: 'Old-age dependency ratio' },
      description: {
        zh: '每 100 位 15–64 歲（青壯年、工作年齡）的人，對應幾位 65 歲以上的人。25 是每 4 位青壯年對 1 位老人，50 是 2 對 1，100 是 1 對 1。',
        en: 'People aged 65 and over per 100 people of working age (15–64). 25 means four working-age people for every older person, 50 means two, 100 means one.',
      },
      unit: PER_100_WORKING,
      file: 'old-age-dependency.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 15, 20, 30, 40, 60] } },
      format: (v) => fixed(v, 1),
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'pyramid-shape',
      label: { zh: '人口金字塔的形狀', en: 'Population pyramid shape' },
      description: {
        zh: '依兒童與老人的比例把人口金字塔分成三型：0–14 歲占總人口 30% 以上是底寬的「年輕型」，65 歲以上占 20% 以上是上寬下窄的「高齡型」，其他是「壯年型」。門檻是這個網站自訂的，沒有國際通用的定義。點國家看完整的人口金字塔；拖動時間軸看各國從年輕型走向高齡型。',
        en: 'Population pyramids grouped by the share of children and older people: “young” (a wide base) where 30% or more are aged 0–14, “aged” (top-heavy) where 20% or more are 65 and over, and “middle” otherwise. The thresholds are this site’s own; there is no international definition. Select a country for its full pyramid, and drag the timeline to watch countries move from young to aged.',
      },
      unit: '',
      file: 'pyramid-shape.json',
      layer: { kind: 'categorical', categories: SHAPES },
      format: (v) => tr(SHAPES.find((c) => c.value === v)?.label ?? ''),
      unranked: true,
      rankingBars: false,
      panelChart: false,
    },
    {
      id: 'mac',
      label: { zh: '母親的平均生育年齡', en: 'Mean age of childbearing' },
      description: {
        zh: '母親生小孩時的平均年齡，所有胎次一起平均（不是第一胎）。生得多的國家第三、四胎生到很晚，平均反而高（尼日約 29 歲，跟美國差不多），所以不能直接讀成「晚生」；要比晚婚晚生，看「婚姻與家庭」的女性初婚年齡。',
        en: 'The average age of mothers at childbirth, across all births (not just the first). Where women have many children, later births raise the average (about 29 in Niger, close to the US), so a high value does not simply mean late motherhood; for that, compare the age at first marriage for women in the Marriage and family topic.',
      },
      unit: { zh: '歲', en: 'years' },
      file: 'mac.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [27, 28, 29, 30, 31, 32] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 歲`, en: `${fixed(v, 1)} years` }),
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'dependency',
      label: { zh: '總撫養比', en: 'Total dependency ratio' },
      description: {
        zh: '每 100 位 15–64 歲的人，對應幾位 0–14 歲的兒童加 65 歲以上的老人。年輕的國家（兒童多）與高齡的國家（老人多）都高，中間低，不是越高越糟：台灣 2023 年 43，推估 2050 年將近 90。梵蒂岡、摩納哥的人口結構特殊。',
        en: 'Children aged 0–14 plus people aged 65 and over per 100 people aged 15–64. It is high both in young countries (many children) and in aged ones (many older people) and low in between, so higher is not simply worse: Taiwan was at 43 in 2023 and is projected near 90 by 2050. Vatican City and Monaco have unusual populations.',
      },
      unit: DEPENDENTS_PER_100,
      file: 'dependency.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [40, 50, 60, 70, 80, 90] } },
      format: (v) => fixed(v, 1),
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
      unranked: true,
    },
    {
      id: 'youth-dependency',
      label: { zh: '扶幼比', en: 'Youth dependency ratio' },
      description: {
        zh: '每 100 位 15–64 歲的人，對應幾位 0–14 歲的兒童。加上扶老比就是總撫養比。',
        en: 'Children aged 0–14 per 100 people aged 15–64. Added to the old-age dependency ratio, it gives the total dependency ratio.',
      },
      unit: YOUNG_PER_100,
      file: 'youth-dependency.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 30, 40, 60, 80, 90] } },
      format: (v) => fixed(v, 1),
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'births',
      label: { zh: '出生數', en: 'Births' },
      description: {
        zh: '一年出生的嬰兒數（活產）。圓的面積與出生數成正比。',
        en: 'Live births in a year. Circle area is proportional to the number of births.',
      },
      // 英文的單位不寫 births，否則圖例是「Births (births)」
      unit: { zh: '人', en: 'live births' },
      file: 'births.json',
      layer: { kind: 'bubble', legendValues: [1e5, 1e6, 1e7] },
      // 中文的 formatLargeNumber 把萬取整數（13 萬），一百萬以下直接寫完整數字
      format: (v) => `${v < 1e6 ? fixed(v, 0) : formatLargeNumber(v)} ${tr(BIRTHS)}`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
  ],
};
