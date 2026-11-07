import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 氣候資金：綠色氣候基金撥給誰（新主題，2026-11-07，製作手冊第二十五批 481，候選 1140；環境的「碳與氣候政策」）：
 * Green Climate Fund 公開 API 的 393 個計畫，各國分到的核定金額依核定年累計（pipeline/topics/climate_finance.py）。
 * 只准非商業使用，轉載要附「First published by the Green Climate Fund」與可以點的 https://greenclimate.fund 連結
 */
const USD = { zh: '美元', en: 'US$' };
const usd = (v: number) => tr({ zh: formatLargeNumber(v) + ' 美元', en: 'US$' + formatLargeNumber(v) });

export const climateFinance: TopicDefinition = {
  id: 'climate-finance',
  title: { zh: '氣候資金：綠色氣候基金撥給誰', en: 'Climate finance: where the Green Climate Fund goes' },
  shortTitle: { zh: '氣候資金', en: 'Climate finance' },
  defaultIndicator: 'approved',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: 'Green Climate Fund 公開 API（v1/projects）——First published by the Green Climate Fund',
        en: 'Green Climate Fund open API (v1/projects) — First published by the Green Climate Fund',
      },
      url: 'https://greenclimate.fund',
      license: { zh: '只准非商業使用，要附署名句與連結', en: 'Non-commercial use only, with the attribution statement and link' },
    },
  ],
  note: {
    zh: '綠色氣候基金（GCF）是聯合國氣候公約下最大的多邊氣候基金，由已開發國家出資，補助開發中國家減碳（減緩）與適應氣候變遷（調適）。這裡是 2015 年 11 月第一批到 2026 年 10 月董事會核定的 393 個計畫；多國計畫用各國分到的金額。「核定」不等於已經撥款（側欄列各計畫的狀態），而且 GCF 只是氣候資金的一部分（還有調適基金、全球環境基金、各國的雙邊援助與開發銀行），不能當成這一國拿到的全部氣候資金。時間軸是核定年，2026 年只到 10 月。First published by the Green Climate Fund（https://greenclimate.fund），只准非商業使用。台灣不是氣候公約的締約方，不是受援國也不是出資國。',
    en: 'The Green Climate Fund (GCF) is the largest multilateral climate fund under the UN climate convention, financed by developed countries to help developing countries cut emissions (mitigation) and adapt to climate change (adaptation). Shown are the 393 projects approved by its Board from the first batch in November 2015 to October 2026; multi-country projects use each country’s share. Approval is not disbursement (the side panel gives each project’s status), and the GCF is only part of climate finance (alongside the Adaptation Fund, the Global Environment Facility, bilateral aid and development banks), so this is not all the climate finance a country receives. The time slider uses the approval year; 2026 runs to October. First published by the Green Climate Fund (https://greenclimate.fund); non-commercial use only. Taiwan is not a party to the convention and neither receives nor contributes.',
  },
  panelExtra: () => import('./panels/ClimateFinancePanel'),
  indicators: [
    {
      id: 'approved',
      label: { zh: '綠色氣候基金核定的金額（累計）', en: 'Green Climate Fund approvals (cumulative)' },
      description: { zh: '到這一年為止，綠色氣候基金核定給這一國的金額（美元，依核定年累計；多國計畫用這一國分到的部分）。到 2026 年 10 月 138 國、合計 232.4 億美元：巴西 12.58 億（23 件）、印度 11.06 億、印尼 6.34 億、南非 5.88 億、肯亞 5.19 億、蒙古 4.99 億、孟加拉 4.89 億、約旦 4.66 億、衣索比亞 4.60 億、奈及利亞 4.37 億。子項目看用途：調適南非 3.09 億、坦尚尼亞 2.73 億、巴基斯坦 2.26 億最多，減緩巴西 6.79 億、印度 6.42 億最多。', en: 'Green Climate Fund money approved for the country up to the selected year (US dollars, cumulative by approval year; multi-country projects count the country’s share). By October 2026, 138 countries had been approved US$23.24 billion in all: Brazil US$1.26 billion (23 projects), India 1.11 billion, Indonesia 634 million, South Africa 588 million, Kenya 519 million, Mongolia 499 million, Bangladesh 489 million, Jordan 466 million, Ethiopia 460 million and Nigeria 437 million. The options split by theme: South Africa (US$309 million), Tanzania (273 million) and Pakistan (226 million) lead on adaptation; Brazil (679 million) and India (642 million) on mitigation.' },
      unit: USD,
      file: 'approved/{item}.json',
      dimension: {
        label: { zh: '用途', en: 'Theme' },
        options: [
          { id: 'all', label: { zh: '全部', en: 'All' } },
          { id: 'adaptation', label: { zh: '調適（適應氣候變遷）', en: 'Adaptation' } },
          { id: 'mitigation', label: { zh: '減緩（減少排放）', en: 'Mitigation' } },
          { id: 'crosscutting', label: { zh: '跨領域（兩者都有）', en: 'Cross-cutting' } },
        ],
        defaultOption: 'all',
      },
      layer: { kind: 'bubble', legendValues: [5e7, 2e8, 1e9] },
      format: usd,
      formatTick: (v) => formatLargeTick(v),
      missing: { zh: '沒有綠色氣候基金的計畫', en: 'No Green Climate Fund projects' },
    },
    {
      id: 'projects',
      label: { zh: '計畫數（累計）', en: 'Projects (cumulative)' },
      description: { zh: '到這一年為止，有這一國參與的綠色氣候基金計畫數（多國計畫每國各算一件）。到 2026 年 10 月肯亞 29 件最多，印尼、象牙海岸、巴西 23 件，烏干達、奈及利亞 22 件，厄瓜多 21 件。', en: 'Number of Green Climate Fund projects involving the country up to the selected year (a multi-country project counts once for each country). By October 2026 Kenya had the most, 29, followed by Indonesia, Côte d’Ivoire and Brazil (23), Uganda and Nigeria (22) and Ecuador (21).' },
      unit: { zh: '件', en: 'projects' },
      file: 'projects.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 4, 7, 10, 15, 20] } },
      format: (v) => tr({ zh: fixed(v, 0) + ' 件', en: fixed(v, 0) + (v === 1 ? ' project' : ' projects') }),
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '沒有綠色氣候基金的計畫', en: 'No Green Climate Fund projects' },
    },
  ],
};
