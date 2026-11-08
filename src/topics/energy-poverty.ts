import { fixed } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

/**
 * 能源貧窮（2026-11-07，製作手冊第二十五批 525；pipeline/topics/energy_poverty.py）：Eurostat EU-SILC 的「家裡冬天不夠暖」
 * 與「欠繳水電瓦斯帳單」，2003–2025，子項目是貧窮狀態。側欄畫這一國全部、貧窮線以下、以上三條線
 * （panels/EnergyPovertyPanel.tsx）。
 */
export const GROUPS = [
  { id: 'all', label: { zh: '全部人口', en: 'Everyone' } },
  { id: 'poor', label: { zh: '貧窮線以下（所得中位數的 60%）', en: 'Below the poverty line (60% of median income)' } },
  { id: 'non-poor', label: { zh: '貧窮線以上', en: 'Above the poverty line' } },
];

/** 節能改造（第二十七批 628）的子項目：全部與自住／租屋、獨棟／公寓、貧窮或社會排除風險的拆解 */
export const RETROFIT_GROUPS = [
  { id: 'all', label: { zh: '全部人口', en: 'Everyone' } },
  { id: 'owners', label: { zh: '住自己的房子', en: 'Owners' } },
  { id: 'renters', label: { zh: '租屋', en: 'Renters' } },
  { id: 'houses', label: { zh: '住獨棟或連棟住宅', en: 'Living in houses' } },
  { id: 'flats', label: { zh: '住公寓', en: 'Living in flats' } },
  { id: 'at-risk', label: { zh: '有貧窮或社會排除風險', en: 'At risk of poverty or social exclusion' } },
  { id: 'not-at-risk', label: { zh: '沒有貧窮或社會排除風險', en: 'Not at risk of poverty or social exclusion' } },
];

const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;
const common: Pick<IndicatorDef, 'unit' | 'dimension' | 'format' | 'formatTick' | 'lowerIsBetter' | 'defaultYear' | 'noValue'> = {
  unit: '%',
  dimension: { label: { zh: '族群', en: 'Group' }, options: GROUPS, defaultOption: 'all' },
  format: pct,
  formatTick: pctTick,
  lowerIsBetter: true,
  defaultYear: 2025,
  noValue: {
    TWN: { zh: '沒有：台灣沒有官方的能源貧窮統計', en: 'None: Taiwan has no official energy poverty statistics' },
  },
};

export const energyPoverty: TopicDefinition = {
  id: 'energy-poverty',
  title: { zh: '能源貧窮：付不出帳單、家裡不夠暖', en: 'Energy poverty: unpaid bills and cold homes' },
  shortTitle: { zh: '能源貧窮', en: 'Energy poverty' },
  defaultIndicator: 'cold-home',
  defaultYear: 2025,
  sources: [
    {
      name: {
        zh: 'Eurostat：EU-SILC 家裡沒辦法保持足夠溫暖的人口（sdg_07_60）、欠繳水電瓦斯帳單的人口（ilc_mdes07）',
        en: 'Eurostat, EU-SILC: population unable to keep home adequately warm (sdg_07_60) and in arrears on utility bills (ilc_mdes07)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/sdg_07_60/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Eurostat：EU-SILC 過去五年住的房子做過節能改善的人口（ilc_enevh_01）', en: 'Eurostat, EU-SILC: persons living in dwellings with energy efficiency improvements in the last five years (ilc_enevh_01)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/ilc_enevh_01/default/table',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '歐盟所得與生活條件調查（EU-SILC）的問卷，2003–2025，歐洲 34 國左右（英國與科索沃的 Eurostat 資料只准非商業使用，不收）；2025 年目前 31 國，其他國家顯示 2024 年。「不夠暖」是受訪者的自評，跟房屋隔熱也有關，不只是付不起；2022 年能源危機時多數國家明顯跳高。貧窮線是所得中位數的 60%。',
    en: 'Questions in the EU Statistics on Income and Living Conditions (EU-SILC), 2003–2025, about 34 European countries (Eurostat data for the UK and Kosovo are for non-commercial use only and are left out); 31 countries so far for 2025, with 2024 shown for the rest. “Unable to keep the home warm” is self-reported and reflects insulation as well as affordability; most countries jumped during the 2022 energy crisis. The poverty line is 60% of median income.',
  },
  panelExtra: () => import('./panels/EnergyPovertyPanel'),
  indicators: [
    {
      ...common,
      id: 'cold-home',
      label: { zh: '家裡冬天不夠暖的人口比例', en: 'Unable to keep the home adequately warm' },
      description: {
        zh: '自己說沒辦法讓家裡保持足夠溫暖的人口比例。2025 年：阿爾巴尼亞 33.6%（北馬其頓只有 2024 年的 27.0%）、土耳其 19.5%、希臘 18.1%、立陶宛 16.7%、保加利亞 16.1%、西班牙 15.9% 最高；挪威 1.7%、芬蘭 2.6%、愛沙尼亞 3.1%、波蘭 3.2% 最低（2024 年瑞士 0.7%）。能源危機：德國從 2021 年的 3.3% 升到 2023 年的 8.2%，法國 6.0% 到 12.1%，西班牙 14.2% 到 20.8%。貧窮線以下的差很多：2024 年希臘 43.6%（貧窮線以上 13.0%）。',
        en: 'Share of people who say they cannot keep their home adequately warm. In 2025 Albania (33.6%; North Macedonia has only 2024, 27.0%), Türkiye (19.5%), Greece (18.1%), Lithuania (16.7%), Bulgaria (16.1%) and Spain (15.9%) were highest; Norway (1.7%), Finland (2.6%), Estonia (3.1%) and Poland (3.2%) lowest (Switzerland 0.7% in 2024). The energy crisis lifted Germany from 3.3% in 2021 to 8.2% in 2023, France from 6.0% to 12.1% and Spain from 14.2% to 20.8%. It is much higher below the poverty line: 43.6% in Greece in 2024 (13.0% above it).',
      },
      file: 'cold-home/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [3, 5, 8, 12, 18, 25] } },
    },
    {
      ...common,
      id: 'arrears',
      label: { zh: '欠繳水電瓦斯帳單的人口比例', en: 'In arrears on utility bills' },
      description: {
        zh: '過去 12 個月曾經因為付不出錢而遲繳水電瓦斯帳單的人口比例。2025 年：希臘 31.9%（北馬其頓、蒙特內哥羅只有 2024 年的 22.2%、21.5%）、羅馬尼亞 17.7%、土耳其 17.6%、塞爾維亞 17.3%、保加利亞 17.2% 最高；荷蘭 2.2%、捷克 2.4%、波蘭 2.6% 最低。希臘 2022 年 34.1%；2024 年貧窮線以下的希臘人 65.6% 欠過帳單（貧窮線以上 23.9%）。',
        en: 'Share of people who fell behind on utility bills for lack of money in the past 12 months. In 2025 Greece (31.9%; North Macedonia and Montenegro have only 2024, 22.2% and 21.5%), Romania (17.7%), Türkiye (17.6%), Serbia (17.3%) and Bulgaria (17.2%) were highest; the Netherlands (2.2%), Czechia (2.4%) and Poland (2.6%) lowest. Greece reached 34.1% in 2022; in 2024, 65.6% of Greeks below the poverty line were in arrears (23.9% above it).',
      },
      file: 'arrears/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [3, 5, 8, 12, 18, 25] } },
    },
    // 2026-11-08（製作手冊第二十七批 628）：有沒有去改善（結果之外的行動）
    {
      id: 'retrofit',
      label: { zh: '過去五年家裡做過節能改造的人口比例', en: 'Living in a home with energy efficiency improvements in the last five years' },
      description: {
        zh: '住的房子在過去五年做過節能改善（換窗、加保溫、換鍋爐等，受訪者自己認定）的人口比例（EU-SILC，只有 2023 與 2025 兩期；子項目是族群）。2025 年荷蘭 60.5% 最高，丹麥 34.0%、法國 33.3%、斯洛維尼亞 33.3%、葡萄牙 32.8%、奧地利 31.5%、瑞典 31.5%；義大利只有 2.6%、土耳其 3.8%、馬爾他 7.8%、希臘 9.5%、挪威 14.3%。自住的比租屋的高（荷蘭 69.7% 比 39.9%），有貧窮風險的比較低（荷蘭 45.3%）。各國差到二十幾倍，可能有問卷執行的差異。',
        en: 'Share of people whose home had energy efficiency improvements in the last five years (new windows, insulation, a new boiler and so on, as reported by respondents; EU-SILC, only 2023 and 2025; sub-items are groups). In 2025 the Netherlands was highest at 60.5%, then Denmark 34.0%, France 33.3%, Slovenia 33.3%, Portugal 32.8%, Austria 31.5% and Sweden 31.5%; Italy had only 2.6%, Türkiye 3.8%, Malta 7.8%, Greece 9.5% and Norway 14.3%. Owners report more than renters (69.7% vs 39.9% in the Netherlands) and people at risk of poverty less (45.3% in the Netherlands). Countries differ more than twentyfold, which may partly reflect how the survey was carried out.',
      },
      unit: '%',
      file: 'retrofit/{item}.json',
      dimension: { label: { zh: '族群', en: 'Group' }, options: RETROFIT_GROUPS, defaultOption: 'all' },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 25, 30, 40] } },
      format: pct,
      formatTick: pctTick,
      defaultYear: 2025,
      noValue: {
        TWN: { zh: '沒有：台灣沒有對應的調查', en: 'None: Taiwan has no comparable survey' },
      },
    },
  ],
};
