import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

const pct = (v: number) => `${fixed(v, 1)}%`;
const OECD_TERMS = { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' };
const GOV = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

export const gender: TopicDefinition = {
  id: 'gender',
  title: { zh: '性別平等', en: 'Gender equality' },
  shortTitle: { zh: '性別平等', en: 'Gender' },
  defaultIndicator: 'gii',
  defaultYear: 2023,
  sources: [
    {
      name: { zh: 'World Bank, WDI（ILO 模型估計、IPU 國會女性比例、UNESCO 的 STEM 畢業生）', en: 'World Bank, WDI (ILO modelled estimates, IPU, UNESCO STEM graduates)' },
      url: 'https://data.worldbank.org/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'OECD, 性別薪資差距', en: 'OECD, Gender wage gap' },
      url: 'https://www.oecd.org/en/data/indicators/gender-wage-gap.html',
      license: OECD_TERMS,
    },
    {
      name: { zh: 'UNDP, 人類發展報告（性別不平等指數）', en: 'UNDP, Human Development Report (Gender Inequality Index)' },
      url: 'https://hdr.undp.org/data-center/documentation-and-downloads',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: { zh: '主計總處（人力資源調查、受僱員工薪資調查）', en: 'DGBAS (Taiwan), Manpower Survey and Earnings Survey' },
      url: 'https://nstatdb.dgbas.gov.tw/dgbasall/webMain.aspx?k=dgmain',
      license: GOV,
    },
    {
      name: { zh: '行政院性別平等處《性別圖像》、中央選舉委員會', en: 'Gender Equality Committee of the Executive Yuan; Central Election Commission (Taiwan)' },
      url: 'https://gec.ey.gov.tw/',
      license: GOV,
    },
    {
      name: { zh: 'UNESCO 統計研究所（UIS），女性研究人員比例', en: 'UNESCO Institute for Statistics (UIS), female researchers' },
      url: 'https://databrowser.uis.unesco.org/',
      license: { zh: 'CC BY-SA 4.0（這個指標的資料檔也用 CC BY-SA 4.0）', en: 'CC BY-SA 4.0 (this indicator’s data file is shared under CC BY-SA 4.0 too)' },
    },
    {
      name: { zh: '國家科學及技術委員會，全國各研發執行部門研發人力統計（台灣的女性研究人員）', en: 'National Science and Technology Council (Taiwan), R&D personnel statistics' },
      url: 'https://data.gov.tw/dataset/7563',
      license: GOV,
    },
  ],
  note: {
    zh:
      '性別不平等指數（GII）結合生育健康（孕產婦死亡率、青少女生育率）、賦權（國會議員、中等以上教育的男女比例）與勞動市場（男女勞參率）。' +
      '薪資差距是男女薪資差距占男性薪資的比例：OECD 是全職受僱者的中位數，只有約 45 國；台灣是勞動部方法的平均時薪差距，口徑不同。台灣不在 ILO、IPU、OECD、UNDP、UNESCO 的資料裡，四個指標與女性研究人員改用台灣官方的統計；STEM 畢業生沒有可比的台灣資料，留白。',
    en:
      'The Gender Inequality Index (GII) combines reproductive health (maternal mortality, adolescent births), empowerment (seats in parliament, secondary education by sex) and the labour market (participation by sex). ' +
      "The pay gap is the difference between men's and women's earnings as a share of men's: the OECD uses median earnings of full-time employees and covers only about 45 countries; Taiwan's figure is the hourly-mean gap used by the Ministry of Labor, a different measure. Taiwan is not in the ILO, IPU, OECD, UNDP or UNESCO data, so four indicators and female researchers use Taiwan's official statistics; there is no comparable figure for STEM graduates, which is left blank.",
  },
  indicators: [
    {
      id: 'gii',
      label: { zh: '性別不平等指數（GII）', en: 'Gender Inequality Index (GII)' },
      description: {
        zh: 'UNDP 的性別不平等指數，0 是完全平等、1 是極不平等；北歐約 0.01，顏色越深越不平等。',
        en: "UNDP's Gender Inequality Index: 0 is complete equality and 1 extreme inequality; the Nordic countries score about 0.01. Darker means more unequal.",
      },
      unit: '',
      file: 'gii.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.05, 0.1, 0.2, 0.3, 0.4, 0.5] } },
      format: (v) => fixed(v, 3),
      formatTick: (v) => fixed(v, 2),
      compareWorld: true,
      lowerIsBetter: true,
    },
    {
      id: 'female-lfp',
      label: { zh: '女性勞動參與率', en: 'Female labour force participation' },
      description: {
        zh: '15 歲以上女性中，有工作或正在找工作的比例。',
        en: 'Share of women aged 15 and over who are working or looking for work.',
      },
      unit: '%',
      file: 'female-lfp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [30, 40, 50, 55, 60, 70] } },
      format: pct,
      formatTick: (v) => `${fixed(v, 0)}%`,
      compareWorld: true,
    },
    {
      id: 'parliament',
      label: { zh: '女性國會議員比例', en: 'Women in parliament' },
      description: {
        zh: '國會（兩院制取下議院）議員中女性的比例。台灣是立法院。',
        en: "Share of seats in parliament (the lower house where there are two) held by women. For Taiwan, the Legislative Yuan.",
      },
      unit: '%',
      file: 'parliament.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 25, 30, 40, 50] } },
      format: pct,
      formatTick: (v) => `${fixed(v, 0)}%`,
      compareWorld: true,
    },
    {
      id: 'pay-gap',
      label: { zh: '性別薪資差距', en: 'Gender pay gap' },
      description: {
        zh: '男性與女性薪資的差距占男性薪資的比例（OECD：全職受僱者的中位數）。只有約 45 國有資料。',
        en: "The difference between men's and women's earnings as a share of men's (OECD: median earnings of full-time employees). Only about 45 countries have data.",
      },
      unit: '%',
      file: 'pay-gap.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 25, 30] } },
      format: pct,
      formatTick: (v) => `${fixed(v, 0)}%`,
    },
    {
      id: 'stem-graduates',
      label: { zh: 'STEM 畢業生的女性比例', en: 'Women among STEM graduates' },
      description: {
        zh: '大學與專科理、工、資訊、數學（STEM）領域的畢業生中女性的比例，各國 5 年內最近一年。南韓、德國不到三成，美國約 38%，北非、中東與中亞不少國家超過一半。台灣沒有可比的資料：教育部的畢業生統計有男女，但科系分類沒有對到國際的 ISCED-F，算不出同一口徑的 STEM。',
        en: 'Share of women among tertiary graduates in science, technology, engineering and mathematics (STEM), the latest year within five years. It is under 30% in South Korea and Germany and about 38% in the US, while many countries in North Africa, the Middle East and Central Asia exceed half. There is no comparable figure for Taiwan: its graduate statistics by sex use a field classification not mapped to the international ISCED-F.',
      },
      unit: '%',
      file: 'stem-graduates.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 25, 30, 35, 40, 50] } },
      format: pct,
      formatTick: (v) => `${fixed(v, 0)}%`,
      noValue: {
        TWN: {
          zh: '沒有可比的資料',
          en: 'No comparable data',
        },
      },
    },
    {
      id: 'women-researchers',
      label: { zh: '女性研究人員比例', en: 'Women researchers' },
      description: {
        zh: '研究人員中女性的比例（人數，不是全時約當），各國 5 年內最近一年。日本約 18%、南韓 24%、德國 30%，中亞與高加索超過六成；美國、中國、印度沒有資料。台灣 2024 年 23.9%（國科會）。',
        en: 'Share of women among researchers (headcount, not full-time equivalent), the latest year within five years. About 18% in Japan, 24% in South Korea and 30% in Germany, and over 60% in parts of Central Asia and the Caucasus; there are no data for the US, China or India. Taiwan: 23.9% in 2024 (National Science and Technology Council).',
      },
      unit: '%',
      file: 'women-researchers.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 25, 30, 35, 40, 50] } },
      format: pct,
      formatTick: (v) => `${fixed(v, 0)}%`,
    },
  ],
};
