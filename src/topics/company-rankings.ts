import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicPart } from './parts';

/**
 * 世界最大的企業、最有價值的品牌、獨角獸新創（2026-11-07，製作手冊第二十五批 465，合併候選 1111、1117、1118；
 * pipeline/topics/company_rankings.py，資料在 companies/）。企業與品牌主題（companies.ts）用 withParts 接上。
 * 上游的 Forbes、Fortune、Kantar、Brand Finance、CB Insights 都不准轉載，只用英文維基的轉引表（CC BY-SA 4.0）
 */
const count = (unit: { zh: string; en: [string, string] }) => (v: number) =>
  tr({ zh: `${fixed(v, 0)} ${unit.zh}`, en: `${fixed(v, 0)} ${v === 1 ? unit.en[0] : unit.en[1]}` });
const COMPANIES = count({ zh: '家', en: ['company', 'companies'] });
const BRANDS = count({ zh: '個', en: ['brand', 'brands'] });
const WIKI = 'https://en.wikipedia.org/wiki/';

export const companyRankingsPart: TopicPart = {
  name: { zh: '最大的企業、最有價值的品牌與獨角獸', en: 'Largest companies, most valuable brands and unicorns' },
  sources: [
    {
      name: { zh: '英文維基百科「Forbes Global 2000」（轉引 Forbes，2026 年 11 月 5 日的版本）', en: 'Wikipedia, “Forbes Global 2000” (citing Forbes; revision of 5 November 2026)' },
      url: `${WIKI}Forbes_Global_2000?oldid=1383885674`,
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '英文維基百科「List of largest companies by revenue」（轉引 Fortune Global 500 與各公司年報）', en: 'Wikipedia, “List of largest companies by revenue” (citing Fortune Global 500 and annual reports)' },
      url: `${WIKI}List_of_largest_companies_by_revenue?oldid=1383411664`,
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '英文維基百科「List of most valuable brands」（轉引 Kantar BrandZ、Brand Finance）', en: 'Wikipedia, “List of most valuable brands” (citing Kantar BrandZ and Brand Finance)' },
      url: `${WIKI}List_of_most_valuable_brands?oldid=1378647641`,
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '英文維基百科「List of unicorn startup companies」（轉引 CB Insights）', en: 'Wikipedia, “List of unicorn startup companies” (citing CB Insights)' },
      url: `${WIKI}List_of_unicorn_startup_companies?oldid=1383886104`,
      license: 'CC BY-SA 4.0',
    },
  ],
  note: {
    zh: '四份名單都只用英文維基百科的轉引表（Forbes、Fortune、Kantar、Brand Finance、CB Insights 的條款都不准轉載），資料檔依 CC BY-SA 4.0 分享，都是單一時間的快照。「國籍」是總部或註冊地，不是生產的地方（開曼群島的 Nubank 其實在巴西營運，愛爾蘭有好幾家是稅務移籍）；Forbes 只收上市公司，Vitol、Cargill 這類大型私人企業不在名單上。Forbes 依營收、獲利、資產、市值綜合排名，跟只看營收的前 50 大不同；三家品牌估值的方法完全不同，金額不能互相比較，Interbrand 的表沒有國家欄，沒有放。獨角獸是估值 10 億美元以上的未上市新創，維基的國家表把已上市或被併購的前獨角獸也算進去；人口不到 50 萬的國家（開曼、百慕達、冰島等）一家就變成每百萬人好幾家，每百萬人那一項不畫。台灣有 44 家 Forbes 2000 大公司（世界第 10），卻只有台積電一個品牌進 Brand Finance 前 50、沒有品牌進 Kantar 前 100，獨角獸只有 2 家：大公司多、品牌與新創少。',
    en: 'All four lists come from tables in English Wikipedia articles (the terms of Forbes, Fortune, Kantar, Brand Finance and CB Insights do not allow republishing); the data files are shared under CC BY-SA 4.0, and each is a single snapshot. “Nationality” is where the headquarters or registration is, not where things are made (Nubank, listed under the Cayman Islands, operates in Brazil; several Irish entries are tax inversions). Forbes covers listed companies only, so large private firms such as Vitol and Cargill are absent. Forbes ranks on a mix of revenue, profit, assets and market value, unlike the top 50 by revenue alone. The two brand rankings value brands in entirely different ways, so amounts cannot be compared; Interbrand’s table has no country column and is not used. Unicorns are unlisted start-ups valued at US$1 billion or more; Wikipedia’s country table also counts former unicorns that have since listed or been acquired. In countries with fewer than 500,000 people (the Cayman Islands, Bermuda, Iceland and others) one unicorn means several per million, so the per-million figure is not shown. Taiwan has 44 Forbes 2000 companies (10th in the world) but only one brand, TSMC, in Brand Finance’s top 50, none in Kantar’s top 100, and only 2 unicorns: many big companies, few brands and start-ups.',
  },
  indicators: [
    {
      id: 'forbes-2000',
      label: { zh: 'Forbes 全球 2000 大企業', en: 'Forbes Global 2000 companies' },
      description: {
        zh: '2026 年 Forbes 全球 2000 大上市公司（依營收、獲利、資產、市值綜合排名）總部在這一國的家數，滑過看最高名次的公司。美國 593 家（摩根大通）、中國大陸 300（中國工商銀行）、日本 179（豐田）、英國 67（殼牌）、南韓 66（三星電子）、印度與加拿大各 64、德國 49、法國 45、台灣 44（台積電）排第 10，比瑞士 42、香港 40 多。維基的國家表共 58 個國家與地區、1,958 家。',
        en: 'How many of the 2026 Forbes Global 2000 listed companies (ranked on a mix of revenue, profit, assets and market value) are headquartered in each country; hover to see the highest-ranked one. The US has 593 (JPMorgan Chase), mainland China 300 (ICBC), Japan 179 (Toyota), the UK 67 (Shell), South Korea 66 (Samsung Electronics), India and Canada 64 each, Germany 49, France 45 and Taiwan 44 (TSMC), 10th, ahead of Switzerland (42) and Hong Kong (40). Wikipedia’s country table covers 58 countries and territories and 1,958 companies.',
      },
      unit: { zh: '家', en: 'companies' },
      file: 'forbes-2000.json',
      timeless: true,
      layer: { kind: 'bubble', legendValues: [10, 100, 500] },
      format: COMPANIES,
      formatTick: (v) => fixed(v, 0),
      integer: true,
      shareOfWorld: true,
    },
    {
      id: 'largest-50',
      label: { zh: '營收最大的 50 家企業', en: 'The 50 largest companies by revenue' },
      description: {
        zh: '營收最大的 50 家企業（多半是 2024 或 2025 會計年度）總部在哪裡，滑過看公司、營收、是不是國營。美國 23 家（亞馬遜 7,160 億美元、沃爾瑪 7,130 億美元最大）、中國大陸 11 家（國家電網、中國石油、中國石化等大多國營）、德國 4 家，南韓、英國、瑞士各 2 家，台灣 1 家（鴻海，第 36）。',
        en: 'Where the 50 companies with the largest revenue (mostly fiscal 2024 or 2025) are headquartered; hover to see the companies, their revenue and whether they are state-owned. The US has 23 (Amazon at US$716 billion and Walmart at US$713 billion are the largest), mainland China 11 (State Grid, CNPC, Sinopec and others, mostly state-owned), Germany 4, South Korea, the UK and Switzerland 2 each, and Taiwan 1 (Foxconn, 36th).',
      },
      unit: { zh: '家', en: 'companies' },
      file: 'largest-50.json',
      timeless: true,
      layer: { kind: 'bubble', legendValues: [1, 5, 20] },
      format: COMPANIES,
      formatTick: (v) => fixed(v, 0),
      integer: true,
    },
    {
      id: 'top-brands',
      label: { zh: '最有價值的品牌', en: 'Most valuable brands' },
      description: {
        zh: '品牌估值榜上有幾個品牌屬於這一國，滑過看是哪些。Kantar BrandZ 2026 年前 100 名：美國 62 個（Google、Apple、Microsoft 前三）、中國大陸 13 個（騰訊第 8、阿里巴巴、TikTok、茅台、華為）、法國與德國各 4 個、日本與印度各 3 個，台灣沒有。Brand Finance 2026 年前 50 名：美國 27、中國大陸 11、德國 5，台灣有台積電（第 47）。',
        en: 'How many brands from each country are on a brand valuation ranking; hover to see which. In Kantar BrandZ’s 2026 top 100, the US has 62 (Google, Apple and Microsoft are the top three), mainland China 13 (Tencent 8th, Alibaba, TikTok, Moutai, Huawei), France and Germany 4 each, and Japan and India 3 each; Taiwan has none. In Brand Finance’s 2026 top 50, the US has 27, mainland China 11 and Germany 5, and Taiwan has TSMC (47th).',
      },
      unit: { zh: '個', en: 'brands' },
      file: 'top-brands/{item}.json',
      timeless: true,
      dimension: {
        label: { zh: '排行榜', en: 'Ranking' },
        options: [
          { id: 'kantar', label: { zh: 'Kantar BrandZ 前 100（2026）', en: 'Kantar BrandZ top 100 (2026)' } },
          { id: 'brand-finance', label: { zh: 'Brand Finance 前 50（2026）', en: 'Brand Finance top 50 (2026)' } },
        ],
        defaultOption: 'kantar',
      },
      layer: { kind: 'bubble', legendValues: [1, 10, 50] },
      format: BRANDS,
      formatTick: (v) => fixed(v, 0),
      integer: true,
    },
    {
      id: 'unicorns',
      label: { zh: '獨角獸新創', en: 'Unicorn start-ups' },
      description: {
        zh: '估值 10 億美元以上的未上市新創有幾家（維基的國家表，截至 2026 年 3 月，含已上市或被併購的前獨角獸），可以換成每百萬人。美國 1,126 家、中國大陸 279、印度 131、英國 94、德國 47、以色列 42、新加坡與南韓各 33、法國 31、加拿大 30，日本 11、台灣 2。每百萬人：盧森堡 5.95、新加坡 5.46、以色列 4.20、愛沙尼亞 3.50、美國 3.31 最高，南韓 0.64、中國大陸 0.20，台灣與日本 0.09。',
        en: 'How many unlisted start-ups valued at US$1 billion or more each country has (Wikipedia’s country table as of March 2026, including former unicorns that have listed or been acquired); switch to per million people. The US has 1,126, mainland China 279, India 131, the UK 94, Germany 47, Israel 42, Singapore and South Korea 33 each, France 31 and Canada 30; Japan 11 and Taiwan 2. Per million people, Luxembourg (5.95), Singapore (5.46), Israel (4.20), Estonia (3.50) and the US (3.31) lead; South Korea 0.64, mainland China 0.20, Taiwan and Japan 0.09.',
      },
      unit: { zh: '家', en: 'companies' },
      file: 'unicorns/{item}.json',
      timeless: true,
      dimension: {
        label: { zh: '看', en: 'Show' },
        options: [
          { id: 'count', label: { zh: '家數', en: 'Number' } },
          { id: 'per-million', label: { zh: '每百萬人', en: 'Per million people' } },
        ],
        defaultOption: 'count',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [2, 5, 10, 30, 100, 500] },
        itemScales: { 'per-million': { type: 'sequential', thresholds: [0.1, 0.25, 0.5, 1, 2, 4] } },
      },
      itemFormats: {
        'per-million': {
          unit: { zh: '家/百萬人', en: 'per million people' },
          format: (v) => tr({ zh: `每百萬人 ${fixed(v, 2)} 家`, en: `${fixed(v, 2)} per million people` }),
          formatTick: (v) => `${v}`,
        },
      },
      format: COMPANIES,
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
