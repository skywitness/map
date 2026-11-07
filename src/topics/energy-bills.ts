import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicPart } from './parts';

/**
 * 電價與油價的擴充：電費與瓦斯費帳單的組成、能源的通膨（2026-11-07，製作手冊第二十七批 607，候選 1336、1368；
 * pipeline/topics/energy_bills.py，資料在 public/data/topics/energy-prices/）：Eurostat 的帳單組成（只有歐洲，英國不收）
 * 與 OECD 消費者物價的能源類年增率；側欄 panels/EnergyBillPanel.tsx 是帳單的四個組成。
 */
const pct = (v: number) => `${fixed(v, 1)}%`;
const signedPct = (v: number) => `${v > 0 ? '+' : ''}${fixed(v, 1)}%`;

export const energyBillsPart: TopicPart = {
  name: { zh: '帳單的組成與能源的通膨', en: 'Bill components and energy inflation' },
  sources: [
    {
      name: {
        zh: 'Eurostat：家庭電價與天然氣價格的組成（nrg_pc_204_c、nrg_pc_202_c）',
        en: 'Eurostat: components of household electricity and gas prices (nrg_pc_204_c, nrg_pc_202_c)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_204_c/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'OECD：消費者物價指數，能源類（COICOP 2018）', en: 'OECD: consumer price indices, energy (COICOP 2018)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_PRICES_COICOP2018%40DF_PRICES_C2018_N_CP045_0722&df[ag]=OECD.SDD.TPS',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '帳單的組成只有歐洲（Eurostat，英國照網站的規則不收）：家庭用電一年 2,500–4,999 度、天然氣一年 20–199 GJ 的級距，帳單＝能源與供應＋網路費＋稅費（不含加值稅，可以是負的，例如荷蘭的退稅）＋加值稅。台灣的電價沒有拆成這幾項，不在圖上。能源的通膨是 OECD 消費者物價指數的能源類（家用的電、瓦斯、燃料與車用燃料）一年漲了多少，只有 31 國，沒有美國、南韓與台灣；各國籃子的組成不同。',
    en: 'Bill components cover Europe only (Eurostat; the UK is excluded under the site’s rules): households using 2,500–4,999 kWh of electricity or 20–199 GJ of gas a year, with the bill = energy and supply + network charges + taxes and levies (excluding VAT, and possibly negative, as with the Netherlands’ tax refund) + VAT. Taiwan’s electricity prices are not broken down this way and are not shown. Energy inflation is the annual change in the energy component of OECD consumer price indices (household electricity, gas and other fuels plus motor fuel), for 31 countries only, without the US, South Korea or Taiwan; basket contents differ between countries.',
  },
  panelExtra: () => import('./panels/EnergyBillPanel'),
  indicators: [
    {
      id: 'bill-tax-share',
      label: { zh: '稅占電費、瓦斯費的比例', en: 'Taxes as a share of energy bills' },
      description: {
        zh: '家庭的電費、瓦斯費裡稅費加上加值稅占多少（子項目：電、天然氣）。2025 年電費：丹麥 57.3%、波蘭 52.0%、瑞典 45.7%、斯洛伐克 42.1%、芬蘭 42.0%、德國 41.5%；荷蘭有退稅，只有 10.1%，愛爾蘭 4.3%、盧森堡 1.0%、摩爾多瓦 0.1%。瓦斯費：荷蘭 60.1%、丹麥 57.0%、瑞典 46.4%，克羅埃西亞 9.3% 最低。點國家看帳單的四個組成。',
        en: 'Taxes and levies plus VAT as a share of household electricity and gas bills (sub-items: electricity, gas). Electricity in 2025: Denmark 57.3%, Poland 52.0%, Sweden 45.7%, Slovakia 42.1%, Finland 42.0% and Germany 41.5%; the Netherlands, with its tax refund, only 10.1%, Ireland 4.3%, Luxembourg 1.0% and Moldova 0.1%. Gas: the Netherlands 60.1%, Denmark 57.0% and Sweden 46.4%, with Croatia lowest at 9.3%. Click a country for the four components of the bill.',
      },
      unit: '%',
      file: 'bill-tax-share/{item}.json',
      dimension: {
        label: { zh: '帳單', en: 'Bill' },
        options: [
          { id: 'electricity', label: { zh: '電費', en: 'Electricity' } },
          { id: 'gas', label: { zh: '瓦斯費（天然氣）', en: 'Gas' } },
        ],
        defaultOption: 'electricity',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 30, 40, 50] } },
      format: pct,
      formatTick: (v) => `${fixed(v, 0)}%`,
      defaultYear: 'latest',
      missing: { zh: '只有歐洲（Eurostat）', en: 'Europe only (Eurostat)' },
    },
    {
      id: 'energy-inflation',
      label: { zh: '能源的通膨（一年漲多少）', en: 'Energy inflation (annual change)' },
      description: {
        zh: '消費者物價指數的能源類一年漲了多少。2022 年能源危機：土耳其 126.8%、荷蘭 70.6%、愛沙尼亞 63.5%、立陶宛 56.2%、比利時 52.3%、義大利 50.8%，日本 17.1%、墨西哥 5.3% 漲得少；2023 年回落，荷蘭 −23.7%、比利時 −21.6%、西班牙 −16.3%。土耳其的物價整體都漲得很快，要跟一般物價一起看。',
        en: 'Annual change in the energy component of consumer price indices. In the 2022 energy crisis: Türkiye 126.8%, the Netherlands 70.6%, Estonia 63.5%, Lithuania 56.2%, Belgium 52.3% and Italy 50.8%, with smaller rises in Japan (17.1%) and Mexico (5.3%); prices fell back in 2023, the Netherlands −23.7%, Belgium −21.6% and Spain −16.3%. Prices of everything rise fast in Türkiye, so read its figures alongside general inflation.',
      },
      unit: '%',
      file: 'energy-inflation.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-30, -10, -2, 2, 10, 30], reverse: true } },
      format: signedPct,
      formatTick: (v) => `${v > 0 ? '+' : ''}${fixed(v, 0)}%`,
      defaultYear: 2022,
      missing: { zh: '不在 OECD 的這個資料集裡', en: 'Not in this OECD dataset' },
    },
  ],
};

export const BILL_PARTS = [
  { id: 'NRG_SUP', label: { zh: '能源與供應', en: 'Energy and supply' } },
  { id: 'NETC', label: { zh: '網路費', en: 'Network charges' } },
  { id: 'TAX_FEE_LEV_CHRG', label: { zh: '稅費（不含加值稅）', en: 'Taxes and levies (excl. VAT)' } },
  { id: 'VAT', label: { zh: '加值稅', en: 'VAT' } },
] as const;
export const eurPerKwh = (v: number) => tr({ zh: `${fixed(v, 4)} 歐元/度`, en: `€${fixed(v, 4)}/kWh` });
