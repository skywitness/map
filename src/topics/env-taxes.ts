import { fixed } from '../lib/format';
import type { ScaleSpec, TopicDefinition } from './types';

/**
 * 環境稅收與環保支出（新主題，2026-11-07，製作手冊第二十五批 500＋501，候選 1169、1170；環境的新小類「環境治理」）：
 * OECD 的環境相關稅收（全球）與 Eurostat 的全國環境保護支出（歐洲），pipeline/topics/env_taxes.py。
 * 側欄 panels/EnvTaxesPanel.tsx 是環保支出依用途的分解
 */
const pct = (v: number) => fixed(v, 2) + '%';
const TAX_SCALE: ScaleSpec = { type: 'sequential', thresholds: [0.01, 0.5, 1, 1.5, 2, 2.5] };
const PART_SCALE: ScaleSpec = { type: 'sequential', thresholds: [0.01, 0.1, 0.25, 0.5, 1, 1.5] };

export const envTaxes: TopicDefinition = {
  id: 'env-taxes',
  title: { zh: '環境稅收與環保支出', en: 'Environmental taxes and spending' },
  shortTitle: { zh: '環境稅收', en: 'Environmental taxes' },
  defaultIndicator: 'tax-gdp',
  defaultYear: 2023,
  sources: [
    {
      name: { zh: 'OECD：Environmentally related tax revenue（DF_ERTR）', en: 'OECD: Environmentally related tax revenue (DF_ERTR)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_ERTR%40DF_ERTR&df[ag]=OECD.ENV.EPI',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Eurostat：National expenditure on environmental protection（env_epea_neep）', en: 'Eurostat: National expenditure on environmental protection (env_epea_neep)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/env_epea_neep/default/table',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '環境相關稅收是以對環境有害的東西（汽柴油、電力、車輛、污染物、資源）為稅基的稅，OECD 依各國申報整理。幾乎全是能源（燃料、電力）與車輛的稅（各國中位數合計約 99%，能源稅約占三分之二），所以占 GDP 高不代表環境政策比較好，主要反映燃料稅收的多寡；0 的國家（汶萊、柬埔寨、緬甸等）多半是沒有申報，不一定沒有環境稅。全國環境保護支出是政府、企業與家戶花在污染防治、廢棄物與污水處理、生物多樣性等的錢（Eurostat，只有歐洲），含企業自己的污染防治投資，製造業多的國家會偏高。台灣不在這兩份資料裡；英國照網站的規則不收 Eurostat 的資料。',
    en: 'Environmentally related taxes are levied on tax bases harmful to the environment (motor fuels, electricity, vehicles, pollutants, resources), compiled by the OECD from national reports. They are almost entirely taxes on energy (fuels, electricity) and vehicles (about 99% at the median country, with energy alone about two-thirds), so a high share of GDP does not mean better environmental policy – it mainly reflects fuel-tax revenue; zeros (Brunei, Cambodia, Myanmar and others) are mostly unreported rather than a true absence of such taxes. National expenditure on environmental protection is what governments, businesses and households spend on pollution control, waste and wastewater management, biodiversity and so on (Eurostat, Europe only); it includes companies’ own pollution-control investment, so manufacturing-heavy countries score higher. Taiwan is not in either dataset; the UK is excluded from Eurostat data under the site’s rules.',
  },
  panelExtra: () => import('./panels/EnvTaxesPanel'),
  indicators: [
    {
      id: 'tax-gdp',
      label: { zh: '環境相關稅收占 GDP', en: 'Environmentally related tax revenue, % of GDP' },
      description: {
        zh: '環境相關稅收占 GDP 的比例（OECD），2023 年。塞席爾 3.49%、斯洛維尼亞 2.98%、希臘 2.96%、克羅埃西亞 2.93%、保加利亞 2.84%、土耳其 2.55%、義大利 2.51%、荷蘭 2.44%、愛沙尼亞 2.40%、拉脫維亞 2.39%；丹麥 2.34%、法國 2.11%、英國 1.96%、德國 1.61%、南韓 1.38%、日本 1.11%、愛爾蘭 0.88%。1995 年起：丹麥 4.33% → 2.34%、愛爾蘭 2.95% → 0.88%；愛沙尼亞 0.85% → 2.40%、拉脫維亞 1.05% → 2.39%。子項目可以看能源、運輸、污染、資源四種稅基。',
        en: 'Environmentally related tax revenue as a share of GDP (OECD), 2023. Seychelles 3.49%, Slovenia 2.98%, Greece 2.96%, Croatia 2.93%, Bulgaria 2.84%, Turkey 2.55%, Italy 2.51%, the Netherlands 2.44%, Estonia 2.40%, Latvia 2.39%; Denmark 2.34%, France 2.11%, the UK 1.96%, Germany 1.61%, South Korea 1.38%, Japan 1.11%, Ireland 0.88%. Since 1995: Denmark 4.33% → 2.34%, Ireland 2.95% → 0.88%; Estonia 0.85% → 2.40%, Latvia 1.05% → 2.39%. Sub-items show the four tax bases: energy, transport, pollution and resources.',
      },
      unit: '%',
      file: 'tax-gdp/{item}.json',
      dimension: {
        label: { zh: '稅基', en: 'Tax base' },
        options: [
          { id: 'all', label: { zh: '全部', en: 'All tax bases' } },
          { id: 'energy', label: { zh: '能源（燃料、電力）', en: 'Energy (fuels, electricity)' } },
          { id: 'transport', label: { zh: '運輸（車輛）', en: 'Transport (vehicles)' } },
          { id: 'pollution', label: { zh: '污染', en: 'Pollution' } },
          { id: 'resources', label: { zh: '資源', en: 'Resources' } },
        ],
        defaultOption: 'all',
      },
      layer: {
        kind: 'choropleth',
        scale: TAX_SCALE,
        itemScales: { all: TAX_SCALE, energy: TAX_SCALE, transport: PART_SCALE, pollution: PART_SCALE, resources: PART_SCALE },
      },
      format: pct,
      formatTick: (v) => v + '%',
    },
    {
      id: 'tax-share',
      label: { zh: '環境相關稅收占總稅收', en: 'Environmentally related tax revenue, % of total tax' },
      description: {
        zh: '環境相關稅收占全部稅收的比例（OECD），2023 年。羅馬尼亞 28.7%、烏干達 14.6%、肯亞 14.0%、索馬利亞 13.7%、塞席爾 12.0%、多明尼加 11.6%、土耳其 11.2%；其他歐盟國家多在 3–10%（盧森堡 3.1%、瑞典 3.9%、德國 4.3%、法國 4.8%、荷蘭 6.2%、希臘 7.6%、保加利亞 9.5%）。',
        en: 'Environmentally related tax revenue as a share of total tax revenue (OECD), 2023. Romania 28.7%, Uganda 14.6%, Kenya 14.0%, Somalia 13.7%, Seychelles 12.0%, the Dominican Republic 11.6%, Turkey 11.2%; other EU countries are mostly at 3–10% (Luxembourg 3.1%, Sweden 3.9%, Germany 4.3%, France 4.8%, the Netherlands 6.2%, Greece 7.6%, Bulgaria 9.5%).',
      },
      unit: '%',
      file: 'tax-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.01, 2, 4, 6, 8, 11] } },
      format: pct,
      formatTick: (v) => v + '%',
    },
    {
      id: 'expenditure',
      label: { zh: '全國環境保護支出占 GDP', en: 'National environmental protection expenditure, % of GDP' },
      description: {
        zh: '政府、企業與家戶一年花在環境保護的錢占 GDP（Eurostat，只有歐洲），2023 年。比利時與奧地利 3.0%、羅馬尼亞 2.9%、瑞典與波蘭 2.8%、捷克 2.7%、斯洛維尼亞 2.6%、荷蘭與義大利 2.5%；德國與法國 2.0%；最低的愛爾蘭 0.6%、挪威、盧森堡、波士尼亞 1.0%。歐盟 27 國合計 3,688.52 億歐元，最大宗是廢棄物管理 1,666.02 億與污水管理 1,075.46 億。',
        en: 'Spending on environmental protection by government, businesses and households as a share of GDP (Eurostat, Europe only), 2023. Belgium and Austria 3.0%, Romania 2.9%, Sweden and Poland 2.8%, Czechia 2.7%, Slovenia 2.6%, the Netherlands and Italy 2.5%; Germany and France 2.0%; lowest are Ireland (0.6%) and Norway, Luxembourg and Bosnia and Herzegovina (1.0%). The EU-27 total was €368.9 billion, mostly waste management (€166.6 billion) and wastewater management (€107.5 billion).',
      },
      unit: '%',
      file: 'expenditure.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 1.5, 2, 2.5, 3] } },
      format: (v) => fixed(v, 1) + '%',
      formatTick: (v) => v + '%',
      missing: { zh: '沒有資料（只有歐洲國家）', en: 'No data (European countries only)' },
    },
  ],
};
