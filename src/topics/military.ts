import { tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, usd } from '../lib/format';
import type { FlowLabels, IndicatorDef, TopicDefinition } from './types';

const PEOPLE = { zh: '人', en: 'people' };

/**
 * 海外軍事基地（pipeline/topics/overseas_bases.py，DESIGN.md 第 8 節第 146 點）：英文維基百科的列表，
 * 只畫國家層級的流向（派駐國→駐在國），一組一條線、線一樣粗（FlowLayer.presence），不畫每個基地的點。
 */
const BASES_YEAR = 2026;
const COUNTRIES_UNIT = { zh: '國', en: 'countries' };
const countriesText = (v: number) => tr({ zh: `${fixed(v, 0)} 國`, en: `${fixed(v, 0)} ${v === 1 ? 'country' : 'countries'}` });

export const BASES_LABELS: Record<'export' | 'import', FlowLabels> = {
  export: {
    partners: { zh: '有軍事基地的國家', en: 'countries where it has military bases' },
    main: { zh: '在這些國家有軍事基地', en: 'Countries where it has military bases' },
    verb: (origin, partner) => tr({ zh: `${origin}在${partner}有軍事基地`, en: `${origin} has military bases in ${partner}` }),
  },
  import: {
    partners: { zh: '在這裡有軍事基地的國家', en: 'countries with military bases here' },
    main: { zh: '在這裡有軍事基地的國家', en: 'Countries with military bases here' },
    verb: (origin, partner) => tr({ zh: `${partner}在${origin}有軍事基地`, en: `${partner} has military bases in ${origin}` }),
  },
};

const BASES_NOTE = {
  zh: '依英文維基百科「List of countries with overseas military bases」（2026 年 10 月 23 日的版本）：只列了 18 個派駐國，各國的表寫法不同，長期駐軍、輪駐、租用的港口與機場、訓練設施都算，其他國家的海外據點可能漏列。',
  en: 'Based on the English Wikipedia “List of countries with overseas military bases” (revision of 23 October 2026), which covers only 18 countries with bases abroad, each listed differently: permanent garrisons, rotations, leased ports and airfields and training facilities all count, and other countries’ facilities abroad may be missing.',
};

function basesIndicator(id: string, label: Text, description: { zh: string; en: string }, direction: 'export' | 'import'): IndicatorDef {
  return {
    id,
    label,
    description: { zh: `${description.zh}${BASES_NOTE.zh}`, en: `${description.en} ${BASES_NOTE.en}` },
    unit: COUNTRIES_UNIT,
    file: `${id}.json`,
    layer: {
      kind: 'flow',
      file: 'bases-flows.json',
      direction,
      labels: BASES_LABELS,
      presence: { zh: '有軍事基地', en: 'Military bases' },
      legendKey: { zh: '由派駐國（淺）到駐在國（深）', en: 'From the country with the bases (light) to the host (dark)' },
    },
    format: countriesText,
    formatTick: (v) => fixed(v, 0),
    integer: true,
    defaultYear: BASES_YEAR,
    // 沒有值是列表上沒有（列表只有 18 個派駐國，不一定真的沒有）
    missing: { zh: '列表上沒有', en: 'None listed' },
  };
}

export const military: TopicDefinition = {
  id: 'military',
  title: { zh: '各國軍費與兵力', en: 'Military spending and armed forces' },
  shortTitle: { zh: '軍事', en: 'Military' },
  defaultIndicator: 'spending',
  defaultYear: 2025,
  sources: [
    {
      name: 'Information from the Stockholm International Peace Research Institute (SIPRI), Military Expenditure Database',
      url: 'https://doi.org/10.55163/CQGC9685',
      license: {
        zh: '依 SIPRI 條款非商業使用，只收錄 2011–2025 年',
        en: 'non-commercial use under SIPRI terms; 2011–2025 only',
      },
    },
    {
      name: {
        zh: 'World Bank, World Development Indicators（IISS The Military Balance 兵力資料）',
        en: 'World Bank, World Development Indicators (armed forces data from IISS, The Military Balance)',
      },
      url: 'https://data.worldbank.org/',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '海外軍事基地：英文維基百科「List of countries with overseas military bases」（2026-10-23 的版本）',
        en: 'Overseas military bases: English Wikipedia, “List of countries with overseas military bases” (revision of 2026-10-23)',
      },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1381583292',
      license: { zh: 'CC BY-SA 4.0（資料檔也是）', en: 'CC BY-SA 4.0 (so are the data files)' },
    },
  ],
  note: {
    zh: 'SIPRI 資料不是開放授權，依其使用條款只供非商業使用，且只轉載少於資料集 10% 的範圍（軍費與占 GDP 兩項、2011–2025 年）。軍費以當年匯率換算成美元，含國防部以外的軍事相關支出（例如軍人退休金、準軍事部隊）。兵力資料只到 2020 年，不含台灣。海外軍事基地依英文維基百科的列表，只看國家，不分基地的大小與駐軍人數；有爭議的地方（克里米亞、南千島群島、北賽普勒斯…）照列表畫，側欄與 tooltip 寫明。台灣沒有海外軍事基地，列表上也沒有駐在台灣的外國基地。',
    en: 'SIPRI data is not openly licensed: under its terms it is for non-commercial use only, and less than 10% of the dataset is reproduced here (spending and share of GDP, 2011–2025). Spending is converted to US dollars at current exchange rates and includes military spending outside the defence ministry (such as military pensions and paramilitary forces). Armed forces data ends in 2020 and does not include Taiwan. Overseas military bases follow the English Wikipedia list and count countries only, not the size of bases or troop numbers; disputed places (Crimea, the southern Kuril Islands, Northern Cyprus and others) are drawn as the list has them, with a note in the side panel and tooltip. Taiwan has no overseas bases, and the list shows no foreign bases in Taiwan.',
  },
  indicators: [
    {
      id: 'spending',
      label: { zh: '軍費', en: 'Military spending' },
      description: {
        zh: '一年的軍事支出，以當年匯率換算成美元。圓的面積與軍費成正比。',
        en: 'Military spending in a year, in US dollars at current exchange rates. Circle area is proportional to spending.',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'spending.json',
      layer: { kind: 'bubble', legendValues: [1e9, 1e10, 1e11] },
      format: (v) => usd(formatLargeNumber(v)),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'spending-gdp',
      label: { zh: '軍費占 GDP', en: 'Military spending, % of GDP' },
      description: {
        zh: '軍事支出占國內生產毛額的比例，可以看出國防負擔的輕重。',
        en: 'Military spending as a share of gross domestic product, a measure of the defence burden.',
      },
      unit: '%',
      file: 'spending-gdp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 1.5, 2, 3, 4, 6] } },
      format: (v) => `${fixed(v, 2)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'armed-forces',
      label: { zh: '兵力', en: 'Armed forces' },
      description: {
        zh: '現役軍人加上準軍事部隊（例如邊防、憲兵）的人數，不含後備軍人。圓的面積與人數成正比。到 2020 年。',
        en: 'Active-duty military plus paramilitary forces (such as border guards and gendarmerie), excluding reserves. Circle area is proportional to personnel. Up to 2020.',
      },
      unit: PEOPLE,
      file: 'armed-forces.json',
      layer: { kind: 'bubble', legendValues: [1e4, 1e5, 1e6] },
      format: (v) => `${formatLargeNumber(v)} ${tr(PEOPLE)}`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'armed-forces-labor',
      label: { zh: '兵力占勞動力', en: 'Armed forces, % of labour force' },
      description: {
        zh: '軍人與準軍事人員占全國勞動力（有工作或在找工作的人）的比例。到 2020 年。',
        en: 'Military and paramilitary personnel as a share of the labour force (people working or looking for work). Up to 2020.',
      },
      unit: '%',
      file: 'armed-forces-labor.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.25, 0.5, 1, 1.5, 2.5, 4] } },
      format: (v) => `${fixed(v, 2)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    basesIndicator(
      'bases-abroad',
      { zh: '海外軍事基地', en: 'Overseas military bases' },
      {
        zh: '在幾個國家有軍事基地。點一個國家，畫出它在哪些國家有基地（一國一條線，不分基地的大小與駐軍人數）。美國在 49 個國家與地區有基地，俄羅斯 16、英國 13、土耳其 11。',
        en: 'The number of countries where a country has military bases. Click a country to draw the countries where it has bases (one line per country, whatever the size of the bases or the number of troops). The United States has bases in 49 countries and territories, Russia in 16, the UK in 13 and Turkey in 11.',
      },
      'export',
    ),
    basesIndicator(
      'foreign-bases',
      { zh: '外國的軍事基地', en: 'Foreign military bases' },
      {
        zh: '有幾個國家在這裡有軍事基地。點一個國家，畫出在這裡有基地的國家。吉布地最多，美國、法國、中國、義大利、日本都在那裡設了基地。',
        en: 'The number of countries with military bases here. Click a country to draw the countries that have bases in it. Djibouti has the most: the United States, France, China, Italy and Japan all have bases there.',
      },
      'import',
    ),
  ],
  panelExtra: () => import('./panels/MilitaryPanel'),
};
