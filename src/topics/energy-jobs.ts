import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { DimensionDef, TopicDefinition } from './types';

/**
 * 能源與礦業的就業：電力燃氣業與採礦業（新主題，2026-11-08，製作手冊第二十七批 627，候選 1367；能源・能源的使用與政策）：
 * ILOSTAT 的就業人數依行業（ISIC 第 4 版 B、D 大類），台灣用主計總處人力資源調查（pipeline/topics/energy_jobs.py）。
 */
const INDUSTRIES: DimensionDef = {
  label: { zh: '行業', en: 'Industry' },
  options: [
    { id: 'both', label: { zh: '兩者合計', en: 'Both' } },
    { id: 'electricity', label: { zh: '電力、燃氣、蒸汽及空調供應業', en: 'Electricity, gas, steam and air conditioning supply' } },
    { id: 'mining', label: { zh: '礦業及土石採取業（含金屬、砂石）', en: 'Mining and quarrying (incl. metals, sand and gravel)' } },
  ],
  defaultOption: 'both',
};
const workers = (v: number) =>
  tr({
    zh: v >= 10 ? `${fixed(v / 10, v >= 1000 ? 0 : 1)} 萬人` : `${fixed(v * 1000, 0)} 人`,
    en: v >= 1000 ? `${fixed(v / 1000, 2)} million` : `${fixed(v, 1)} thousand`,
  });

export const energyJobs: TopicDefinition = {
  id: 'energy-jobs',
  title: { zh: '能源與礦業的就業：電力燃氣業與採礦業', en: 'Jobs in energy and mining: utilities and mining' },
  shortTitle: { zh: '能源與礦業的就業', en: 'Energy and mining jobs' },
  defaultIndicator: 'share',
  defaultYear: 2024,
  sources: [
    {
      name: { zh: '國際勞工組織 ILOSTAT：就業人數依經濟活動（DF_EMP_TEMP_SEX_ECO_NB）', en: 'ILOSTAT: employment by economic activity (DF_EMP_TEMP_SEX_ECO_NB)' },
      url: 'https://ilostat.ilo.org/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '行政院主計總處：人力資源調查，就業者按行業分（台灣，2017 年起）', en: 'DGBAS (Taiwan): Manpower Survey, employment by industry (from 2017)' },
      url: 'https://nstatdb.dgbas.gov.tw/dgbasall/webMain.aspx?k=dgmain',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, Taiwan, v1' },
    },
  ],
  note: {
    zh: '兩個行業是國際行業分類（ISIC 第 4 版）的 D 大類（電力、燃氣、蒸汽及空調供應）與 B 大類（礦業及土石採取，含金屬礦、砂石，不只煤與油氣），不是「化石燃料就業」；再生能源設備的製造與安裝算在製造業、營造業，不在這裡。資料是各國勞動力調查，年份不一（各國用 5 年內最近的一年）。台灣 2017 年起用主計總處的人力資源調查，之前接 ILO 的值（也是同一個調查）。',
    en: 'The two industries are ISIC Rev. 4 sections D (electricity, gas, steam and air conditioning supply) and B (mining and quarrying, including metal ores, sand and gravel, not only coal, oil and gas), so this is not “fossil fuel employment”; making and installing renewable energy equipment counts under manufacturing and construction. Data come from national labour force surveys in different years (each country’s latest within 5 years). Taiwan uses the DGBAS Manpower Survey from 2017 and ILO figures from the same survey before that.',
  },
  indicators: [
    {
      id: 'share',
      label: { zh: '電力燃氣業與採礦業占總就業', en: 'Utilities and mining as a share of employment' },
      description: {
        zh: '兩個行業的就業人數占總就業的 %（子項目可以分開看）。2024 年諾魯 10.53% 最高，蒙古 7.32%（電力燃氣 2.3 萬人、採礦 7.7 萬）、蓋亞那 6.30%、辛巴威 5.36%（採礦 25.9 萬）、俄羅斯 4.75%（175.5 萬＋172.6 萬）、白俄羅斯 3.89%、智利 3.62%（5.1 萬＋28.6 萬）、澳洲 2.81%、挪威 2.63%；美國 1.15%（144.9 萬＋40.1 萬）、德國 1.15%、法國 0.96%、印度 0.56%、韓國 0.35%、台灣 0.33%（3.4 萬＋4 千）。',
        en: 'Employment in the two industries as a share of total employment (sub-items separate them). In 2024 Nauru was highest at 10.53%, then Mongolia 7.32% (utilities 23,000, mining 77,300), Guyana 6.30%, Zimbabwe 5.36% (mining 259,100), Russia 4.75% (1.75 million + 1.73 million), Belarus 3.89%, Chile 3.62% (50,700 + 286,400), Australia 2.81% and Norway 2.63%; the US 1.15% (1.45 million + 0.40 million), Germany 1.15%, France 0.96%, India 0.56%, South Korea 0.35% and Taiwan 0.33% (34,000 + 4,000).',
      },
      unit: '%',
      file: 'share/{item}.json',
      dimension: INDUSTRIES,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 1.5, 2.5, 4] } },
      format: (v) => `${fixed(v, 2)}%`,
      formatTick: (v) => `${fixed(v, v < 1 ? 1 : 0)}%`,
      missing: { zh: 'ILO 近 5 年沒有資料', en: 'No ILO data in the last 5 years' },
    },
    {
      id: 'workers',
      label: { zh: '電力燃氣業與採礦業的就業人數', en: 'Workers in utilities and mining' },
      description: {
        zh: '兩個行業的就業人數（子項目可以分開看）。2024 年俄羅斯 348 萬人最多，印度 271 萬（電力燃氣 142.4 萬、採礦 128.6 萬）、印尼 207 萬（採礦 171.7 萬）、美國 185 萬、巴西 84.2 萬、墨西哥 58.9 萬、德國 49.1 萬、澳洲 40.5 萬。ILO 沒有中國的資料。',
        en: 'Number of workers in the two industries (sub-items separate them). In 2024 Russia had the most, 3.48 million, then India 2.71 million (utilities 1.42 million, mining 1.29 million), Indonesia 2.07 million (mining 1.72 million), the US 1.85 million, Brazil 842,000, Mexico 589,000, Germany 491,000 and Australia 405,000. ILO has no data for China.',
      },
      unit: { zh: '千人', en: 'thousand' },
      file: 'workers/{item}.json',
      dimension: INDUSTRIES,
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: workers,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: 'ILO 近 5 年沒有資料', en: 'No ILO data in the last 5 years' },
    },
  ],
};
