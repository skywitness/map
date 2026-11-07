import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { ScaleSpec, TopicDefinition } from './types';

/**
 * 多少人住在吵的地方：歐盟環境噪音指令（新主題，2026-11-07，製作手冊第二十五批 485，候選 1148；環境的「污染」）：
 * EEA 彙整的 END 2022 年那一輪（資料年 2021），pipeline/topics/noise.py。側欄 panels/NoisePanel.tsx 是都會區排名
 */
const SOURCE_DIM = {
  label: { zh: '音源', en: 'Source' },
  options: [
    { id: 'road', label: { zh: '道路', en: 'Roads' } },
    { id: 'rail', label: { zh: '鐵路', en: 'Railways' } },
    { id: 'air', label: { zh: '機場', en: 'Airports' } },
    { id: 'industry', label: { zh: '工業', en: 'Industry' } },
  ],
  defaultOption: 'road',
};
const MISSING = {
  zh: '沒有資料（不在歐盟環境噪音指令的範圍，或這一輪沒有提報）',
  en: 'No data (outside the Environmental Noise Directive, or not reported in this round)',
};
const SMALL: ScaleSpec = { type: 'sequential', thresholds: [0.5, 1, 2, 5, 10, 20] };
const SHARE_SCALES: Record<string, ScaleSpec> = {
  road: { type: 'sequential', thresholds: [20, 30, 40, 50, 60, 70] },
  rail: SMALL,
  air: SMALL,
  industry: SMALL,
};
const NIGHT_SCALES: Record<string, ScaleSpec> = {
  road: { type: 'sequential', thresholds: [10, 20, 30, 40, 50, 60] },
  rail: SMALL,
  air: SMALL,
  industry: SMALL,
};

export const noise: TopicDefinition = {
  id: 'noise',
  title: { zh: '多少人住在吵的地方', en: 'Living with noise' },
  shortTitle: { zh: '環境噪音', en: 'Noise' },
  defaultIndicator: 'aggl-share',
  defaultYear: 2021,
  focus: [-25, 34, 35, 71],
  sources: [
    {
      name: {
        zh: 'EEA：Noise data reported under Environmental Noise Directive (END)（2022 年那一輪的彙整表）',
        en: 'EEA: Noise data reported under the Environmental Noise Directive (END) (summary of the 2022 round)',
      },
      url: 'https://www.eea.europa.eu/en/datahub/datahubitem-view/c952f520-8d71-42c9-b74c-b7eb002f939b',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '歐盟《環境噪音指令》（2002/49/EC）要求會員國每 5 年提報一次策略噪音地圖：10 萬人以上的都會區，以及都會區以外的主要道路（一年 300 萬輛車次以上）、主要鐵路（一年 3 萬列次以上）與主要機場（一年 5 萬架次以上），算出住在各噪音等級的人數。這裡是 2022 年提報的那一輪（資料年 2021），由歐洲環境署（EEA）的主題中心彙整，32 個 EEA 會員國裡有 24 國有資料；希臘、冰島、列支敦斯登、土耳其沒有提供，保加利亞、匈牙利、斯洛伐克、斯洛維尼亞沒有提報，英國 2020 年脫歐，不在這一輪。Lden 是日夜加權的全日等效音量，傍晚加 5 dB、夜間加 10 dB；Lnight 是夜間（預設晚上 11 點到早上 7 點）。指令要求提報 Lden 55 dB、Lnight 50 dB 以上的人數，更低的等級大多沒有資料。有些國家只有部分都會區提報（西班牙 63 個裡 19 個、羅馬尼亞 25 個裡 6 個、法國 49 個裡 34 個），比例只算有報的都會區。台灣不在這份資料裡。',
    en: 'The EU Environmental Noise Directive (2002/49/EC) requires member states to report strategic noise maps every five years for agglomerations of over 100,000 people and, outside them, for major roads (over 3 million vehicles a year), major railways (over 30,000 trains a year) and major airports (over 50,000 movements a year), counting how many people live at each noise level. This is the round reported in 2022 (data year 2021), compiled by the European Environment Agency’s topic centre; 24 of the 32 EEA member countries have data. Greece, Iceland, Liechtenstein and Turkey provided no information, Bulgaria, Hungary, Slovakia and Slovenia did not report, and the UK is not in this round after leaving the EU. Lden is the day-evening-night level, with 5 dB added in the evening and 10 dB at night; Lnight covers the night (11 pm to 7 am by default). The directive requires reporting from Lden 55 dB and Lnight 50 dB up; lower bands are mostly missing. Some countries reported only some agglomerations (Spain 19 of 63, Romania 6 of 25, France 34 of 49), and shares count only those that reported. Taiwan is not covered.',
  },
  panelExtra: () => import('./panels/NoisePanel'),
  indicators: [
    {
      id: 'aggl-share',
      label: { zh: '都會區居民暴露在 Lden 55 dB 以上的比例', en: 'Agglomeration residents exposed to Lden 55 dB or more' },
      description: {
        zh: '10 萬人以上都會區的居民裡，住處的噪音（日夜加權 Lden）在 55 dB 以上的比例（只算有提報的都會區），2021 年。道路：盧森堡 80.1%、賽普勒斯 75.2%、羅馬尼亞 74.6%、法國 69.0%、奧地利 57.5%、捷克 57.3%、西班牙 56.4%、克羅埃西亞 55.5%；義大利 43.7%、德國 40.7%、荷蘭 37.5%、瑞士 32.9%、波蘭 31.3%、挪威 28.9%；最低的是馬爾他 13.5%、愛沙尼亞 18.7%。鐵路：奧地利 16.2%、瑞典 11.4%、德國 9.9%、義大利 8.4%。機場：盧森堡 33.3%（機場就在市區旁），其他國家都不到 5%。',
        en: 'Share of residents of agglomerations over 100,000 people whose homes are exposed to day-evening-night noise (Lden) of 55 dB or more (only agglomerations that reported), 2021. Roads: Luxembourg 80.1%, Cyprus 75.2%, Romania 74.6%, France 69.0%, Austria 57.5%, Czechia 57.3%, Spain 56.4%, Croatia 55.5%; Italy 43.7%, Germany 40.7%, the Netherlands 37.5%, Switzerland 32.9%, Poland 31.3%, Norway 28.9%; lowest are Malta 13.5% and Estonia 18.7%. Railways: Austria 16.2%, Sweden 11.4%, Germany 9.9%, Italy 8.4%. Airports: Luxembourg 33.3% (the airport is next to the city); everywhere else is under 5%.',
      },
      unit: '%',
      file: 'aggl-share/{item}.json',
      dimension: SOURCE_DIM,
      layer: { kind: 'choropleth', scale: SHARE_SCALES.road, itemScales: SHARE_SCALES },
      format: (v) => fixed(v, 1) + '%',
      formatTick: (v) => v + '%',
      missing: MISSING,
    },
    {
      id: 'night-share',
      label: { zh: '都會區居民夜間暴露在 Lnight 50 dB 以上的比例', en: 'Agglomeration residents exposed to Lnight 50 dB or more' },
      description: {
        zh: '都會區居民裡，夜間（預設晚上 11 點到早上 7 點）噪音 Lnight 在 50 dB 以上、會影響睡眠的比例，2021 年。道路：羅馬尼亞 60.7%、盧森堡 57.8%、賽普勒斯 53.5%、克羅埃西亞 41.5%、法國 40.3%、西班牙 34.2%、奧地利 34.2%；義大利 32.6%、比利時 32.3%、德國 29.4%、荷蘭 21.4%、瑞士 15.3%；愛沙尼亞 7.0% 最低。鐵路：奧地利 11.7%、瑞典 8.1%、德國 7.4%。',
        en: 'Share of agglomeration residents exposed at night (11 pm to 7 am by default) to noise of Lnight 50 dB or more, enough to disturb sleep, 2021. Roads: Romania 60.7%, Luxembourg 57.8%, Cyprus 53.5%, Croatia 41.5%, France 40.3%, Spain 34.2%, Austria 34.2%; Italy 32.6%, Belgium 32.3%, Germany 29.4%, the Netherlands 21.4%, Switzerland 15.3%; Estonia is lowest at 7.0%. Railways: Austria 11.7%, Sweden 8.1%, Germany 7.4%.',
      },
      unit: '%',
      file: 'night-share/{item}.json',
      dimension: SOURCE_DIM,
      layer: { kind: 'choropleth', scale: NIGHT_SCALES.road, itemScales: NIGHT_SCALES },
      format: (v) => fixed(v, 1) + '%',
      formatTick: (v) => v + '%',
      missing: MISSING,
    },
    {
      id: 'exposed',
      label: { zh: '暴露在 Lden 55 dB 以上的人數', en: 'People exposed to Lden 55 dB or more' },
      description: {
        zh: '都會區裡，加上都會區以外的主要道路、主要鐵路與主要機場周邊，住處 Lden 在 55 dB 以上的人數（工業只有都會區），2021 年。道路 24 國合計約 7,645 萬人：法國 1,899 萬、德國 1,727 萬、義大利 756 萬、西班牙 498 萬、波蘭 455 萬；其中都會區以外的主要道路德國 688 萬、法國 502 萬。鐵路約 1,508 萬人，義大利 500 萬、德國 377 萬、法國 218 萬；機場約 236 萬人，德國 85.3 萬、法國 54.7 萬；工業約 52.9 萬人。只有部分都會區提報的國家（西班牙、羅馬尼亞、法國等）會偏低。',
        en: 'People whose homes are exposed to Lden of 55 dB or more in agglomerations plus around major roads, railways and airports outside them (industry is counted in agglomerations only), 2021. Roads total about 76.5 million across 24 countries: France 19.0 million, Germany 17.3 million, Italy 7.56 million, Spain 4.98 million, Poland 4.55 million; major roads outside agglomerations alone account for 6.88 million in Germany and 5.02 million in France. Railways about 15.1 million (Italy 5.00 million, Germany 3.77 million, France 2.18 million); airports about 2.36 million (Germany 853,000, France 547,000); industry about 529,000. Countries where only some agglomerations reported (Spain, Romania, France and others) are undercounted.',
      },
      unit: { zh: '人', en: 'people' },
      file: 'exposed/{item}.json',
      dimension: SOURCE_DIM,
      layer: { kind: 'bubble', legendValues: [1e5, 1e6, 1e7] },
      format: (v) => tr({ zh: formatLargeNumber(v) + ' 人', en: formatLargeNumber(v) + ' people' }),
      formatTick: (v) => formatLargeTick(v),
      missing: MISSING,
    },
  ],
};
