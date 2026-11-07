import { fixed } from '../lib/format';
import type { DimensionDef, TopicDefinition } from './types';

/**
 * 營建成本、地價與房屋稅（新主題，2026-11-07，製作手冊第二十五批 472，候選 1123、1124；經濟的「不動產」）：
 * Eurostat 新建住宅的營建價格與成本指數（2021＝100，名目與扣掉一般物價）、OECD 地方政府的經常性財產稅
 * （占 GDP、每人 PPP 美元），台灣用財政部的房屋稅加地價稅；側欄有台灣的稅目與內政部的公告地價（pipeline/topics/property_costs.py）
 */
const index = (v: number) => fixed(v, 1);
const tick = (v: number) => fixed(v, 0);
const pct = (v: number) => `${fixed(v, 2)}%`;
const pctTick = (v: number) => `${v}%`;
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

const KIND: DimensionDef = {
  label: { zh: '看', en: 'Show' },
  options: [
    { id: 'price', label: { zh: '建商的售價（含利潤）', en: 'Output prices (incl. profit)' } },
    { id: 'cost', label: { zh: '工料成本', en: 'Input costs' } },
  ],
  defaultOption: 'price',
};

export const propertyCosts: TopicDefinition = {
  id: 'property-costs',
  title: { zh: '營建成本、地價與房屋稅', en: 'Construction costs, land and property taxes' },
  shortTitle: { zh: '營建與房屋稅', en: 'Building & property tax' },
  defaultIndicator: 'construction',
  defaultYear: 2025,
  sources: [
    {
      name: {
        zh: 'Eurostat：Construction producer prices or costs, new residential buildings - annual data（sts_copi_a）',
        en: 'Eurostat: Construction producer prices or costs, new residential buildings - annual data (sts_copi_a)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/sts_copi_a/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'World Bank, World Development Indicators（消費者物價指數 FP.CPI.TOTL）', en: 'World Bank, World Development Indicators (consumer price index, FP.CPI.TOTL)' },
      url: 'https://data.worldbank.org/indicator/FP.CPI.TOTL',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'OECD：Subnational government recurrent property tax revenue（DSD_DASHBOARD@PROP_TAX_REV）',
        en: 'OECD: Subnational government recurrent property tax revenue (DSD_DASHBOARD@PROP_TAX_REV)',
      },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_DASHBOARD%40PROP_TAX_REV&df[ag]=OECD.CFE.RDG',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '財政部 全國賦稅收入實徵淨額日曆年別－按稅目別分（i0421）', en: 'Ministry of Finance (Taiwan), net tax revenue by tax, calendar years (i0421)' },
      url: 'https://web02.mof.gov.tw/njswww/WebMain.aspx?sys=100&funid=defjspf2',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '行政院主計總處 國內各業生產（名目 GDP）', en: 'DGBAS (Taiwan), GDP by industry (nominal)' },
      url: 'https://nstatdb.dgbas.gov.tw/dgbasall/webMain.aspx?k=dgmain',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '內政部 歷年土地筆數面積公告地價統計（data.gov.tw 25074）', en: 'Ministry of the Interior (Taiwan), land parcels, area and announced land value (data.gov.tw 25074)' },
      url: 'https://data.gov.tw/dataset/25074',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh: '營建價格指數只能看漲幅、不能比水準：土耳其 618.9 是 2021 年以來的高通膨，不是土耳其蓋房子最貴，所以另外給「扣掉一般物價」的版本（除以世界銀行的消費者物價指數，都換成 2021＝100）。「建商的售價」是新建住宅（不含集體住宅）的營建產出價格、含建商的利潤；「工料成本」只算材料與工資，兩者國家數不同（36 國與 25 國），分成兩個子項目；兩者都不含土地，而土地往往才是房價上漲的主因。英國照網站的規則不收。財產稅用 OECD 的地方政府資料：只有地方政府（聯邦制的國家含州政府）收的經常性財產稅，**沒有中央政府收的部分**，也不含土地增值稅、契稅這類交易稅與遺產稅；台灣用財政部的房屋稅加地價稅（都是地方稅）除以主計總處的名目 GDP，土地增值稅、契稅與房地合一稅寫在側欄。台灣的營造工程物價指數沒有找到可以直接下載的開放資料，營建價格的地圖台灣留空。側欄的公告地價是內政部 2026 年 1 月 1 日的縣市總額：公告地價是課地價稅的基礎、遠低於成交的市價，而且總額含山坡地與農地，除以面積的平均會被大面積的山區拉低（新北市含整片山區），只能看各縣市的大概。',
    en: 'Construction price indices show changes, not levels: Turkey’s 618.9 reflects high inflation since 2021, not the most expensive construction, which is why there is also a version relative to consumer prices (divided by the World Bank consumer price index, both rebased to 2021 = 100). Output prices are construction output prices for new residential buildings (excluding residences for communities), including the builder’s profit; input costs cover only materials and labour. They cover different countries (36 and 25) and are shown as separate options; neither includes land, which is often what drives house prices up. The UK is excluded under the site’s rules. Property taxes come from the OECD’s subnational government data: only recurrent property taxes collected by local governments (and state governments in federal countries), **not those collected by central governments**, and no transaction taxes such as land value increment or deed taxes, nor inheritance taxes. Taiwan’s figure is house tax plus land value tax (both local taxes) divided by nominal GDP from DGBAS; land value increment tax, deed tax and the consolidated housing and land income tax are listed in the side panel. No downloadable open data was found for Taiwan’s construction cost index, so Taiwan is blank on the construction maps. The announced land values in the side panel are the Ministry of the Interior’s county totals at 1 January 2026: announced values are the base for land value tax and sit far below market prices, and the totals include hillside and farmland, so dividing by area is pulled down by large mountainous areas (New Taipei includes a whole mountain range) and gives only a rough comparison.',
  },
  panelExtra: () => import('./panels/PropertyCostsPanel'),
  indicators: [
    {
      id: 'construction',
      label: { zh: '新建住宅的營建價格（2021＝100）', en: 'New housing construction prices (2021 = 100)' },
      description: { zh: '新建住宅的營建價格指數，2021 年＝100，看的是 2021 年以來漲了多少，不是哪裡蓋房子比較貴。2025 年土耳其 618.9 最高，那是高通膨造成的（扣掉一般物價只有 109.2）；蒙特內哥羅 217.4、保加利亞 209.4、烏克蘭 171.8、匈牙利 159.1、羅馬尼亞 150.9；德國 133.9；法國 112.4、芬蘭 111.5、瑞士 111.1、義大利 110.7 漲得最少。子項目「工料成本」只算材料與工資、不含建商的利潤（25 國）。台灣沒有。', en: 'Construction price index for new housing, 2021 = 100: it shows how much prices have risen since 2021, not where building costs the most. In 2025 Turkey was highest at 618.9 because of high inflation (only 109.2 relative to consumer prices); Montenegro 217.4, Bulgaria 209.4, Ukraine 171.8, Hungary 159.1, Romania 150.9; Germany 133.9; France (112.4), Finland (111.5), Switzerland (111.1) and Italy (110.7) rose least. The input costs option covers only materials and labour, without the builder’s profit (25 countries). Taiwan is not covered.' },
      unit: '2021=100',
      file: 'construction/{item}.json',
      dimension: KIND,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [105, 110, 120, 130, 150, 200] } },
      format: index,
      formatTick: tick,
      defaultYear: 2025,
    },
    {
      id: 'construction-real',
      label: { zh: '扣掉一般物價的營建價格（2021＝100）', en: 'Construction prices relative to consumer prices (2021 = 100)' },
      description: { zh: '營建價格指數除以消費者物價指數（都換成 2021＝100）：高於 100 是蓋房子比一般物價漲得多。2025 年蒙特內哥羅 165.0、保加利亞 154.9 最高，克羅埃西亞 117.5、盧森堡 113.4、德國 113.2、土耳其 109.2；法國 98.9、義大利 94.5、捷克與北馬其頓 92.9、愛沙尼亞 90.6 比一般物價漲得少。', en: 'Construction price index divided by the consumer price index (both 2021 = 100): above 100 means building costs rose faster than prices in general. In 2025 Montenegro (165.0) and Bulgaria (154.9) were highest, followed by Croatia (117.5), Luxembourg (113.4), Germany (113.2) and Turkey (109.2); France (98.9), Italy (94.5), Czechia and North Macedonia (92.9) and Estonia (90.6) rose less than consumer prices.' },
      unit: '2021=100',
      file: 'construction-real/{item}.json',
      dimension: KIND,
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [90, 95, 99, 101, 105, 120] } },
      format: index,
      formatTick: tick,
      defaultYear: 2025,
    },
    {
      id: 'property-tax',
      label: { zh: '地方政府的房屋稅、地價稅占 GDP', en: 'Recurrent property taxes (subnational), % of GDP' },
      description: { zh: '地方政府（聯邦制的國家含州政府）收的經常性財產稅（房屋稅、地價稅這類每年課的稅，不含買賣時的交易稅與遺產稅）占 GDP。2024 年加拿大 2.76%、美國 2.57%、紐西蘭 2.15%、法國 2.07%、冰島 2.00%、日本 1.82% 最高；台灣的房屋稅加地價稅 0.74%，在希臘 0.78% 與哥倫比亞 0.73% 之間；德國 0.37%，愛沙尼亞 0.15%、土耳其 0.10%、盧森堡 0.05% 最低。2000 年加拿大 3.55%、法國 3.06%，台灣 0.97%。', en: 'Recurrent property taxes (annual taxes on land and buildings, excluding transaction and inheritance taxes) collected by local governments, and by state governments in federal countries, as a share of GDP. In 2024 Canada (2.76%), the US (2.57%), New Zealand (2.15%), France (2.07%), Iceland (2.00%) and Japan (1.82%) were highest; Taiwan’s house and land value taxes came to 0.74%, between Greece (0.78%) and Colombia (0.73%); Germany was at 0.37%, and Estonia (0.15%), Turkey (0.10%) and Luxembourg (0.05%) were lowest. In 2000 Canada was at 3.55%, France 3.06% and Taiwan 0.97%.' },
      unit: '%',
      file: 'property-tax.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.25, 0.5, 0.75, 1, 1.5, 2] } },
      format: pct,
      formatTick: pctTick,
      defaultYear: 2024,
    },
    {
      id: 'property-tax-pc',
      label: { zh: '每人一年的房屋稅、地價稅（PPP 美元）', en: 'Recurrent property taxes per person (PPP dollars)' },
      description: { zh: '同樣的稅換成每人多少購買力平價美元。2024 年美國 2,212、加拿大 1,805、冰島 1,672、瑞士 1,583、法國 1,299 最高；日本 987、南韓 412、德國 277；墨西哥 51、土耳其 42 最低。台灣沒有（世界銀行沒有台灣的購買力平價）。', en: 'The same taxes in purchasing-power-parity dollars per person. In 2024 the US (2,212), Canada (1,805), Iceland (1,672), Switzerland (1,583) and France (1,299) were highest; Japan 987, South Korea 412, Germany 277; Mexico (51) and Turkey (42) were lowest. Taiwan is not shown (the World Bank has no PPP conversion factor for Taiwan).' },
      unit: { zh: 'PPP 美元', en: 'PPP dollars' },
      file: 'property-tax-pc.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 200, 400, 700, 1000, 1500] } },
      format: (v) => fixed(v, 0),
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2024,
    },
  ],
};
