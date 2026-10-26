import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { FlowLabels, FlowLayer, IndicatorDef, Text, TopicDefinition } from './types';

/**
 * 移民與難民：移民存量（UN DESA）與難民（UNHCR）。
 * 流向圖沿用貿易主題的 flow 圖層，文字換成移民的（labels），流向檔的數值單位是人（scale 1）。
 */

const PEOPLE = { zh: '人', en: 'people' };
const people = (v: number) => `${formatLargeNumber(v)} ${tr(PEOPLE)}`;

const MIGRANT_LABELS: Record<'export' | 'import', FlowLabels> = {
  import: {
    partners: { zh: '移民來源', en: "immigrants' countries of origin" },
    main: { zh: '主要移民來源', en: 'Main countries of origin of immigrants' },
    verb: (origin, partner) => tr({ zh: `從${partner}移居${origin}的人`, en: `Migrants from ${partner} living in ${origin}` }),
  },
  export: {
    partners: { zh: '僑民去向', en: "emigrants' destinations" },
    main: { zh: '主要僑民去向', en: 'Main destinations of emigrants' },
    verb: (origin, partner) => tr({ zh: `從${origin}移居${partner}的人`, en: `Migrants from ${origin} living in ${partner}` }),
  },
};

const REFUGEE_LABELS: Record<'export' | 'import', FlowLabels> = {
  import: {
    partners: { zh: '難民來源', en: 'refugee origins' },
    main: { zh: '收容的難民來自', en: 'Refugees hosted, by country of origin' },
    verb: (origin, partner) => tr({ zh: `${origin}收容來自${partner}的難民`, en: `Refugees from ${partner} hosted in ${origin}` }),
  },
  export: {
    partners: { zh: '難民去向', en: 'refugee destinations' },
    main: { zh: '難民逃往', en: 'Refugees from this country, by host country' },
    verb: (origin, partner) => tr({ zh: `${origin}的難民在${partner}`, en: `Refugees from ${origin} in ${partner}` }),
  },
};

function flowIndicator(id: string, label: Text, description: Text, file: string, layer: Omit<FlowLayer, 'kind'>): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: PEOPLE,
    file,
    layer: { kind: 'flow', ...layer },
    format: people,
    formatTick: formatLargeTick,
    shareOfWorld: true,
  };
}

export const migration: TopicDefinition = {
  id: 'migration',
  title: { zh: '移民與難民', en: 'Migration and refugees' },
  shortTitle: { zh: '移民', en: 'Migration' },
  defaultIndicator: 'share',
  defaultYear: 2024,
  sources: [
    {
      name: 'UN DESA, International Migrant Stock 2024',
      url: 'https://www.un.org/development/desa/pd/content/international-migrant-stock',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: 'UNHCR Refugee Population Statistics Database',
      url: 'https://www.unhcr.org/refugee-statistics/',
      license: 'CC BY 4.0',
    },
    {
      // UNHCR 的條款要求分享資料時也附上條款的網址
      name: { zh: 'UNHCR 資料集使用條款', en: 'UNHCR Terms of Use for Datasets' },
      url: 'https://www.unhcr.org/terms-use-datasets',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'United Nations, World Population Prospects 2024（人口）', en: 'United Nations, World Population Prospects 2024 (population)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: { zh: '內政部移民署（外僑居留人數）、僑務委員會（海外臺灣僑民人數）', en: 'National Immigration Agency and Overseas Community Affairs Council (Taiwan)' },
      url: 'https://data.gov.tw/dataset/13506',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh:
      '移民指住在出生國以外的人（沒有出生地統計的國家改用國籍，例如台灣、日本、韓國），1990–2020 年每 5 年一筆，加上 2024 年，都是年中的存量，不是當年移入的人數。' +
      '難民是 UNHCR 統計的難民加上「其他需要國際保護的人」（2018 年起，主要是在拉丁美洲的委內瑞拉人），年底的存量；不含 UNRWA 照顧的巴勒斯坦難民（約 600 萬人），也不含尋求庇護者與境內流離失所者。' +
      '流向圖每個國家只列前 15 名。台灣不在 UNHCR 的統計裡。移民與移工匯回母國的錢（僑匯）見「國際援助與僑匯」主題。',
    en:
      'Migrants are people living outside their country of birth (or, where birthplace data are missing, foreign citizens, as in Taiwan, Japan and South Korea), every five years from 1990 to 2020 plus 2024; these are mid-year stocks, not annual arrivals. ' +
      "Refugees are UNHCR's refugees plus other people in need of international protection (from 2018, mostly Venezuelans in Latin America), at year end; Palestine refugees under UNRWA (about 6 million), asylum seekers and internally displaced people are not included. " +
      'Flow maps list each country’s top 15 partners. Taiwan is not in UNHCR’s statistics. For the money migrants send home (remittances), see the Aid topic.',
  },
  panelExtra: () => import('./panels/MigrationPanel'),
  indicators: [
    {
      id: 'share',
      label: { zh: '移民占人口比例', en: 'Migrants as share of population' },
      description: {
        zh: '住在這個國家、但出生在其他國家的人占總人口的比例。波灣國家超過一半是外籍移工。',
        en: 'People living in the country who were born elsewhere, as a share of the population. In the Gulf states more than half are foreign workers.',
      },
      unit: '%',
      file: 'share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2.5, 5, 10, 20, 40] } },
      format: (v) => `${fixed(v, v < 10 ? 1 : 0)}%`,
      formatTick: (v) => `${fixed(v, v < 10 && !Number.isInteger(v) ? 1 : 0)}%`,
      compareWorld: true,
    },
    {
      id: 'immigrants',
      label: { zh: '移民人數', en: 'Immigrants' },
      description: {
        zh: '住在這個國家的國際移民人數。圓的面積與人數成正比。',
        en: 'Number of international migrants living in the country. Circle area is proportional to the number.',
      },
      unit: PEOPLE,
      file: 'immigrants.json',
      layer: { kind: 'bubble', legendValues: [1e6, 1e7, 5e7] },
      format: people,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'emigrants',
      label: { zh: '僑民人數（移居國外的人）', en: 'Emigrants (diaspora)' },
      description: {
        zh: '出生在這個國家、現在住在其他國家的人數（各目的地國統計的合計），不含在海外出生的後代。',
        en: 'People born in the country who now live abroad (summed from the destination countries’ statistics), not counting descendants born abroad.',
      },
      unit: PEOPLE,
      file: 'emigrants.json',
      layer: { kind: 'bubble', legendValues: [1e6, 5e6, 1.5e7] },
      format: people,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    flowIndicator(
      'origins',
      { zh: '流向：移民來源', en: 'Flows: where immigrants come from' },
      {
        zh: '點選國家，弧線連到它的前 15 大移民來源國，線寬與人數成正比。',
        en: "Click a country to draw arcs to its immigrants' top 15 countries of origin; line width is proportional to the number of people.",
      },
      'immigrants.json',
      {
        file: 'flows/migrants/{year}.json',
        direction: 'import',
        labels: MIGRANT_LABELS,
        legendKey: { zh: '由來源國（淺）到移入國（深）', en: 'From origin (light) to destination (dark)' },
      },
    ),
    flowIndicator(
      'destinations',
      { zh: '流向：僑民去向', en: 'Flows: where emigrants live' },
      {
        zh: '點選國家，弧線連到它的僑民最多的 15 個國家，線寬與人數成正比。',
        en: "Click a country to draw arcs to the 15 countries where most of its emigrants live; line width is proportional to the number of people.",
      },
      'emigrants.json',
      {
        file: 'flows/migrants/{year}.json',
        direction: 'export',
        labels: MIGRANT_LABELS,
        legendKey: { zh: '由來源國（淺）到移入國（深）', en: 'From origin (light) to destination (dark)' },
      },
    ),
    {
      id: 'refugees-per-1000',
      label: { zh: '每千人收容的難民', en: 'Refugees hosted per 1,000 people' },
      description: {
        zh: '收容的難民（含其他需要國際保護的人）÷ 總人口 × 1,000。黎巴嫩、約旦收容大量敘利亞難民，哥倫比亞收容委內瑞拉人。',
        en: 'Refugees hosted (including other people in need of international protection) per 1,000 population. Lebanon and Jordan host many Syrians; Colombia hosts Venezuelans.',
      },
      unit: '‰',
      file: 'refugees-per-1000.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.5, 1, 5, 10, 25] } },
      format: (v) => tr({ zh: `每千人 ${fixed(v, v < 10 ? 1 : 0)} 人`, en: `${fixed(v, v < 10 ? 1 : 0)} per 1,000` }),
      formatTick: (v) => fixed(v, v < 1 ? 1 : 0),
      compareWorld: true,
    },
    {
      id: 'refugees-origin',
      label: { zh: '難民人數（依來源國）', en: 'Refugees by country of origin' },
      description: {
        zh: '從這個國家逃到其他國家的難民（含其他需要國際保護的人）。圓的面積與人數成正比。',
        en: 'Refugees (including other people in need of international protection) who fled this country to others. Circle area is proportional to the number.',
      },
      unit: PEOPLE,
      file: 'refugees-origin.json',
      layer: { kind: 'bubble', legendValues: [1e5, 1e6, 5e6] },
      format: people,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    flowIndicator(
      'refugee-flows',
      { zh: '流向：難民', en: 'Flows: refugees' },
      {
        zh: '點選國家畫出難民的流向：收容的難民比外流的多（土耳其、德國）就畫難民來自哪裡，外流的比較多（敘利亞、烏克蘭）就畫逃往哪裡。排名表是收容的難民人數。',
        en: 'Click a country to draw refugee flows: for countries hosting more refugees than they produce (Türkiye, Germany) the arcs show where the refugees come from; otherwise (Syria, Ukraine) where they fled to. The ranking shows refugees hosted.',
      },
      'refugees-hosted.json',
      {
        file: 'flows/refugees/{year}.json',
        direction: 'larger',
        labels: REFUGEE_LABELS,
        pickPartners: { zh: '難民來源或去向', en: 'refugee origins or destinations' },
        legendKey: { zh: '由來源國（淺）到收容國（深）', en: 'From origin (light) to host country (dark)' },
      },
    ),
  ],
};
