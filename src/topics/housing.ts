import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { housePricesPart } from './house-prices';
import type { TopicDefinition } from './types';

const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;
const PEOPLE = { zh: '人', en: 'people' };
const OECD_TERMS = { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

/**
 * 住宅與房價：住宅類型、自有率、家戶人數、擁擠、居住負擔、貧民窟（pipeline/topics/housing.py），
 * 2026-10-30（第七批 119）起加上「房價與居住負擔」的 5 個指標（house-prices.ts 的 housePricesPart，pipeline/topics/house_prices.py）。
 * 舊網址 t/house-prices/ 轉到這裡（redirects.ts）
 */
export const housing: TopicDefinition = {
  id: 'housing',
  title: { zh: '住宅與房價', en: 'Housing and house prices' },
  shortTitle: { zh: '住宅與房價', en: 'Housing' },
  defaultIndicator: 'apartment-share',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'Eurostat, EU-SILC 住宅統計（ilc_lvho01、ilc_lvho02、ilc_lvph01、ilc_lvho05a、ilc_lvho07a）',
        en: 'Eurostat, EU-SILC housing statistics (ilc_lvho01, ilc_lvho02, ilc_lvph01, ilc_lvho05a, ilc_lvho07a)',
      },
      url: 'https://ec.europa.eu/eurostat/web/income-and-living-conditions/database',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'OECD Affordable Housing Database（HM1.5 住宅類型、HM1.3 住宅權屬）',
        en: 'OECD Affordable Housing Database (HM1.5 dwelling types, HM1.3 housing tenures)',
      },
      url: 'https://oe.cd/ahd',
      license: OECD_TERMS,
    },
    {
      name: 'United Nations, Database on Household Size and Composition 2022',
      url: 'https://www.un.org/development/desa/pd/data/household-size-and-composition',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: 'World Bank, World Development Indicators（UN-Habitat 貧民窟人口估計）',
        en: 'World Bank, World Development Indicators (UN-Habitat slum population estimates)',
      },
      url: 'https://data.worldbank.org/indicator/EN.POP.SLUM.UR.ZS',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '內政部不動產資訊平台 房屋稅籍住宅類數量依總樓層區分',
        en: 'Ministry of the Interior (Taiwan), real estate information platform: dwellings on the property tax register by number of floors',
      },
      url: 'https://pip.moi.gov.tw/Publicize/Info/E4040',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '主計總處 家庭收支調查', en: 'DGBAS (Taiwan), Survey of Family Income and Expenditure' },
      url: 'https://www.stat.gov.tw/News.aspx?n=3908&sms=11530',
      license: OPEN_DATA_TW,
    },
    ...housePricesPart.sources,
  ],
  note: {
    zh:
      '住宅類型、居住擁擠率、住房負擔過重率沒有全球的開放資料，只有歐洲（Eurostat）與部分 OECD 國家，其他地區是灰色。' +
      '各國的普查、調查年份不同，地圖用每個國家幾年內最近一年的資料，滑到國家上可以看到資料年份。' +
      '歐洲的數字以人計算，歐洲以外的 OECD 國家多半以戶計算；台灣的住宅類型依建築樓層推算，定義見台灣側欄的附註。' +
      '房價：' +
      housePricesPart.note.zh,
    en:
      'There is no open global data on dwelling types, overcrowding or housing cost overburden, only for Europe (Eurostat) ' +
      'and some other OECD countries, so the rest of the world is grey. Censuses and surveys are held in different years, ' +
      "so the map shows each country's latest data within a few years; hover over a country to see the data year. " +
      'European figures are shares of people, while other OECD countries are mostly counted by household; ' +
      "Taiwan's dwelling types are estimated from building heights, see the notes in Taiwan's panel. " +
      'House prices: ' +
      housePricesPart.note.en,
  },
  panelExtra: () => import('./panels/HousingTopicPanel'),
  indicators: [
    {
      id: 'apartment-share',
      label: { zh: '公寓住戶比例', en: 'Living in apartments' },
      description: {
        zh: '住在公寓、大樓（集合住宅）的比例；其餘住在獨棟、雙併或連棟的透天住宅。50% 以上（青綠色）表示多數人住公寓，以下（橘色）表示多數人住透天。',
        en: 'Share living in apartments (flats in multi-unit buildings); the rest live in detached, semi-detached or terraced houses. Above 50% (teal), most people live in apartments; below (orange), most live in houses.',
      },
      unit: '%',
      file: 'apartment-share.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [20, 35, 45, 55, 65, 80] } },
      format: pct,
      formatTick: pctTick,
    },
    {
      id: 'home-ownership',
      label: { zh: '自有住宅率', en: 'Home ownership' },
      description: {
        zh: '住在自己（或同住家人）擁有的住宅裡的比例，含還在繳房貸的；其餘是租屋、配住或借住。',
        en: 'Share living in a home owned by themselves or a household member, including those still paying a mortgage; the rest rent, live in employer-provided housing or live rent-free.',
      },
      unit: '%',
      file: 'home-ownership.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [50, 60, 70, 80, 90] } },
      format: pct,
      formatTick: pctTick,
    },
    {
      id: 'household-size',
      label: { zh: '平均每戶人數', en: 'Average household size' },
      description: {
        zh: '平均一戶住幾個人。來自各國的普查與家戶調查，很多國家十年才一次。',
        en: 'Average number of people living in one household, from national censuses and household surveys; many countries measure it only once a decade.',
      },
      unit: PEOPLE,
      file: 'household-size.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2.25, 2.5, 3, 4, 5, 6] } },
      format: (v) => `${fixed(v, 2)} ${tr(PEOPLE)}`,
      formatTick: (v) => fixed(v, v % 1 ? 2 : 0),
    },
    {
      id: 'overcrowding',
      label: { zh: '居住擁擠率', en: 'Overcrowding' },
      description: {
        zh: '住在過度擁擠住宅的人口比例：房間數少於歐盟的標準（每戶一間客廳，每對伴侶、每位成年人與每兩名同性別的兒童各一間）。只有歐洲的資料。',
        en: 'Share of people living in an overcrowded home, with fewer rooms than the EU standard (one common room per household, plus one room per couple, per single adult and per two children of the same sex). Europe only.',
      },
      unit: '%',
      file: 'overcrowding.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 25, 35, 50] } },
      format: pct,
      formatTick: pctTick,
    },
    {
      id: 'cost-overburden',
      label: { zh: '住房負擔過重率', en: 'Housing cost overburden' },
      description: {
        zh: '居住成本（房租、房貸利息、水電、維修）超過可支配所得 40% 的人口比例，扣掉住宅補貼。只有歐洲的資料。',
        en: 'Share of people whose housing costs (rent, mortgage interest, utilities and repairs, net of housing allowances) exceed 40% of disposable income. Europe only.',
      },
      unit: '%',
      file: 'cost-overburden.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [4, 6, 8, 10, 15, 20] } },
      format: pct,
      formatTick: pctTick,
    },
    {
      id: 'slums',
      label: { zh: '都市貧民窟人口比例', en: 'Urban population in slums' },
      description: {
        zh: '都市人口中住在貧民窟、非正式聚落或不適當住宅的比例：缺乏乾淨用水、衛生設施、足夠空間、耐久建材或居住保障其中一項以上。UN-Habitat 每兩年估計一次，沒有台灣。',
        en: 'Share of the urban population living in slums, informal settlements or inadequate housing: lacking at least one of safe water, sanitation, sufficient living space, durable housing or secure tenure. Estimated by UN-Habitat every two years; Taiwan is not included.',
      },
      unit: '%',
      file: 'slums.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 10, 20, 35, 50, 70] } },
      format: pct,
      formatTick: pctTick,
    },
    // 房價的資料到 2025 年（住宅的到 2024 年）
    ...housePricesPart.indicators.map((i) => ({ ...i, defaultYear: 2025 })),
  ],
};
