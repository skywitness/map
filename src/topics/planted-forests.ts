import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ClassGridOverlayDef, TopicDefinition } from './types';

/**
 * 人工林（pipeline/topics/planted_forests.py）：各國的人工林面積與占森林的比例（FAOSTAT 土地利用），
 * 加上 WRI SDPT v2.0 的全球人工林與樹作物範圍（0.1° 的類別網格）。台灣用農業部第四次森林資源調查的林型分布圖補。
 * 使用者 2026-10-30 決定：國家層級用 FAOSTAT（台灣用林業保育署的資料補），再加全球的範圍圖（SDPT，台灣被標成中國，
 * 改用林型分布圖）。
 */

const RANGE: ClassGridOverlayDef = {
  kind: 'classGrid',
  id: 'planted',
  label: { zh: '人工林與樹作物（約 10 km 網格）', en: 'Planted forests and tree crops (about 10 km grid)' },
  file: () => 'grid/planted.png',
  classes: [
    { value: 1, color: MAP_TOKENS.categorical[3], short: { zh: '人工林', en: 'Planted forest' }, label: { zh: '人工林（用材、防護）為主', en: 'Mostly planted forest (timber, protection)' }, group: 0 },
    { value: 2, color: MAP_TOKENS.categorical[2], short: { zh: '樹作物', en: 'Tree crops' }, label: { zh: '樹作物（油棕、橡膠、果樹…）為主', en: 'Mostly tree crops (oil palm, rubber, orchards…)' }, group: 0 },
  ],
  groups: [{ zh: '約 2020 年（SDPT v2.0）', en: 'Around 2020 (SDPT v2.0)' }],
  opacity: 0.85,
};

export const plantedForests: TopicDefinition = {
  id: 'planted-forests',
  title: { zh: '人工林', en: 'Planted forests' },
  shortTitle: { zh: '人工林', en: 'Planted forests' },
  defaultIndicator: 'planted-share',
  defaultYear: 2025,
  sources: [
    {
      name: { zh: 'FAOSTAT 土地利用（人工林、森林面積）', en: 'FAOSTAT Land Use (planted forest, forest land)' },
      url: 'https://www.fao.org/faostat/en/#data/RL',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'Richter 等 2024，Spatial Database of Planted Trees（SDPT 2.0），World Resources Institute',
        en: 'Richter et al. 2024, Spatial Database of Planted Trees (SDPT Version 2.0), World Resources Institute',
      },
      url: 'https://data.globalforestwatch.org/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '農業部「第四次森林資源調查全島森林林型分布圖」（台灣）', en: 'Ministry of Agriculture, forest-type map of the fourth national forest inventory (Taiwan)' },
      url: 'https://data.gov.tw/dataset/57873',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh:
      '人工林是種植或播種的森林（FAO 森林資源評估的定義，含用材、防護與經濟林，不含果園），國家的值是 FAOSTAT 土地利用的人工林面積，比例是占全部森林的比例；FAO 依各國每 5 年的報告（1990、2000、2010、2015、2020、2025 年）內插成每年。' +
      '全世界約 3.1 億公頃、占森林的 7.6%（2025 年）；中國 9,260 萬公頃最多，英國、愛爾蘭、波蘭這類老早砍光原生林的歐洲國家比例最高。' +
      'FAOSTAT 沒有台灣，台灣用農業部第四次森林資源調查（2008–2013 年）的林型分布圖：生產性人工林與保護性人工林共 45.8 萬公頃，占林地 218.1 萬公頃的 21.0%，標在 2010 年，之後沒有新的調查，之後的年份也顯示這個值。' +
      '網格是世界資源研究所的人工林空間資料庫（SDPT 2.0，158 國、各國的資料來源與年份不同，約 2020 年）：從 Global Forest Watch 網站的向量圖磚彙整成約 10 km 的格子，人工林與樹作物（油棕、橡膠、果園等）合計占一格 5% 以上才畫，顏色是兩者較多的一種。' +
      'SDPT 把台灣的人工林標成中國，台灣的格子改用林型分布圖（只有人工林、沒有樹作物）。多邊形太密、網站產生不出圖磚的地方沒有畫：瑞典約三成的土地，以及芬蘭、南韓、泰國、印尼、智利、美國等國的幾小塊（各約 80–150 km 見方）。森林不到 5 萬公頃的國家不算比例。',
    en:
      'Planted forests are forests established by planting or seeding (the FAO Forest Resources Assessment definition, including timber, protective and other plantations but not orchards). Country values are FAOSTAT Land Use planted-forest area and its share of all forest; FAO interpolates the countries’ five-yearly reports (1990, 2000, 2010, 2015, 2020, 2025) to every year. ' +
      'The world has some 310 million ha, 7.6% of its forest (2025); China has the most at 92.6 million ha, while European countries that cleared their natural forests long ago, such as the United Kingdom, Ireland and Poland, have the highest shares. ' +
      'FAOSTAT does not cover Taiwan, so the forest-type map of the Ministry of Agriculture’s fourth national forest inventory (2008–2013) is used: production and protection plantations cover 458,000 ha, 21.0% of 2.18 million ha of forest land, shown as 2010; with no later inventory, later years show the same value. ' +
      'The grid comes from the World Resources Institute’s Spatial Database of Planted Trees (SDPT 2.0, 158 countries, sources and years vary by country, around 2020), aggregated from the Global Forest Watch vector tiles to cells of about 10 km: cells at least 5% planted forest plus tree crops (oil palm, rubber, orchards and so on) are drawn, coloured by whichever is larger. ' +
      'SDPT labels Taiwan’s plantations as China; Taiwan’s cells use the forest-type map instead (planted forest only, no tree crops). Places where polygons are too dense for the website to produce tiles are not drawn: about a third of Sweden and a few patches (each about 80–150 km across) in Finland, South Korea, Thailand, Indonesia, Chile, the United States and elsewhere. Countries with under 50,000 ha of forest have no share.',
  },
  overlays: [RANGE],
  indicators: [
    {
      id: 'planted-share',
      label: { zh: '人工林占森林的比例', en: 'Planted share of forest' },
      description: {
        zh: '人工林占全部森林面積的比例；網格是人工林與樹作物的範圍。英國、愛爾蘭、捷克八成以上是人工林、波蘭近八成，中國、日本約四成，巴西、印尼的雨林國家只有幾 %；台灣約兩成（第四次森林資源調查）。',
        en: 'Planted forest as a share of all forest area, with the grid showing where planted forests and tree crops are. Over 80% of the forest in the United Kingdom, Ireland and Czechia is planted and nearly 80% in Poland, about 40% in China and Japan, and only a few per cent in rainforest countries such as Brazil and Indonesia; Taiwan is about a fifth (fourth national forest inventory).',
      },
      unit: '%',
      file: 'planted-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 40, 60] } },
      format: (v) => `${fixed(v, v < 10 ? 1 : 0)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'planted-area',
      label: { zh: '人工林的面積', en: 'Planted forest area' },
      description: {
        zh: '人工林的面積（萬公頃，圓點的大小）。中國最多（2025 年 9,260 萬公頃，1990 年起翻倍），其次是美國、俄羅斯、加拿大、印度。',
        en: 'Planted forest area (circle size, in 10,000 ha). China has by far the most (92.6 million ha in 2025, double its 1990 area), followed by the United States, Russia, Canada and India.',
      },
      unit: { zh: '萬公頃', en: '10,000 ha' },
      file: 'planted-area.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 5000] },
      format: (v) => tr({ zh: `${fixed(v, v < 10 ? 1 : 0)} 萬公頃`, en: `${fixed(v / 100, 2)} million ha` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
  ],
};

