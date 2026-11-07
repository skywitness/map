import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 零售業的規模與電子商務（新主題，2026-11-07，製作手冊第二十五批 473，候選 1132、1133；經濟的「消費與零售」）：
 * Eurostat 企業的電子商務營業額占比（全部行業、零售業）與零售業的結構統計（每人營業額、每萬人家數、每家人數），
 * 台灣用主計總處 2021 年工商普查（pipeline/topics/retail.py）
 */
const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };
const EUROPE_ONLY = { zh: '沒有資料（只有歐洲國家與台灣）', en: 'No data (European countries and Taiwan only)' };

export const retail: TopicDefinition = {
  id: 'retail',
  title: { zh: '零售業的規模與電子商務', en: 'Retail trade and e-commerce' },
  shortTitle: { zh: '零售與電商', en: 'Retail & e-commerce' },
  defaultIndicator: 'ecommerce',
  defaultYear: 2025,
  sources: [
    {
      name: { zh: 'Eurostat：Value of e-commerce sales by NACE Rev. 2 activity（isoc_ec_evaln2）', en: 'Eurostat: Value of e-commerce sales by NACE Rev. 2 activity (isoc_ec_evaln2)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/isoc_ec_evaln2/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'Eurostat：Enterprises by detailed NACE Rev. 2 activity and special aggregates（sbs_ovw_act，G47 零售業）',
        en: 'Eurostat: Enterprises by detailed NACE Rev. 2 activity and special aggregates (sbs_ovw_act, G47 retail trade)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/sbs_ovw_act/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'World Bank, World Development Indicators（人口 SP.POP.TOTL）', en: 'World Bank, World Development Indicators (population, SP.POP.TOTL)' },
      url: 'https://data.worldbank.org/indicator/SP.POP.TOTL',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '行政院主計總處 110 年工商及服務業普查：批發及零售業、住宿及餐飲業企業單位經營概況－按細行業別分（data.gov.tw 111892）',
        en: 'DGBAS (Taiwan), 2021 Industry, Commerce and Service Census: wholesale, retail, accommodation and food service enterprises by detailed industry (data.gov.tw 111892)',
      },
      url: 'https://data.gov.tw/dataset/111892',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '內政部戶政司 村里戶數、人口數（ODRP019，2021 年底）', en: 'Department of Household Registration (Taiwan), population by village (ODRP019, end of 2021)' },
      url: 'https://www.ris.gov.tw/app/portal/346',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh: '電子商務占比只算 10 人以上的企業（不含金融業），小店與個人賣家不在裡面；營業額記在企業所在的國家，愛爾蘭、盧森堡有很多跨國企業的歐洲總部，所以特別高；2020、2021 年的跳升多半是疫情。零售業的規模用 Eurostat 2021 年改版後的企業結構統計（sbs_ovw_act，不要跟 2020 年以前的舊表接），零售業是 NACE 的 G47：不含汽機車（G45）、批發（G46）與餐飲；營業額記在企業所在的國家，觀光客、跨境來買的人與網路零售商的總部都會把每人營業額拉高，人口用世界銀行的資料。英國照網站的規則不收。台灣用主計總處 2021 年工商普查的「零售業」扣掉「汽機車及其零配件、用品零售業」（台灣的行業標準把汽機車放在零售業），營業收入用 Eurostat 2021 年的歐元兌新台幣年平均匯率（33.111）換算，人口是戶政司 2021 年底的戶籍人口；台灣沒有企業的電子商務占比（經濟部的網路銷售統計從這裡連不上），側欄另寫普查裡「電子購物及郵購業」占零售營業額的比例，口徑跟 Eurostat 的電子商務占比不同。',
    en: 'E-commerce shares cover enterprises with 10 or more persons employed (excluding finance), so small shops and individual sellers are not included; turnover is recorded where the enterprise is based, and Ireland and Luxembourg host many multinationals’ European headquarters, which is why they rank high; the jumps in 2020 and 2021 mostly reflect the pandemic. Retail size uses Eurostat’s structural business statistics as revised in 2021 (sbs_ovw_act, not to be joined to the pre-2021 tables); retail trade is NACE G47, excluding motor vehicles (G45), wholesale (G46) and food service. Turnover is recorded where the enterprise is based, so tourists, cross-border shoppers and online retailers’ headquarters push per-person turnover up; population comes from the World Bank. The UK is excluded under the site’s rules. Taiwan uses retail trade from DGBAS’s 2021 Industry, Commerce and Service Census minus the sale of motor vehicles, parts and accessories (Taiwan’s classification puts it under retail), with revenue converted at Eurostat’s 2021 average euro rate (NT$33.111) and population from the household register at the end of 2021. Taiwan has no business e-commerce share (the Ministry of Economic Affairs’ online sales statistics could not be reached); the side panel gives the share of “electronic shopping and mail-order houses” in retail revenue from the census, which is a different measure from Eurostat’s e-commerce share.',
  },
  panelExtra: () => import('./panels/RetailPanel'),
  indicators: [
    {
      id: 'ecommerce',
      label: { zh: '電子商務占企業營業額', en: 'E-commerce share of business turnover' },
      description: { zh: '10 人以上的企業透過網站、App 或 EDI 接單的營業額，占全部營業額的比例（不含金融業）。2025 年愛爾蘭 38.3%、丹麥 33.3%、芬蘭 30.1%、比利時 29.5%、斯洛伐克 27.4% 最高；德國 19.1%、法國 14.3%；希臘 9.5%、保加利亞 7.6% 最低。子項目「零售業」只看零售業：2025 年荷蘭 32.9%、捷克 30.4% 最高，盧森堡 1.4% 最低。台灣沒有這個統計；2021 年工商普查的「電子購物及郵購業」占零售業營業額 12.8%（見側欄，口徑不同）。', en: 'Turnover that enterprises with 10 or more persons employed receive through websites, apps or EDI, as a share of total turnover (excluding finance). In 2025 Ireland (38.3%), Denmark (33.3%), Finland (30.1%), Belgium (29.5%) and Slovakia (27.4%) were highest; Germany was at 19.1% and France 14.3%; Greece (9.5%) and Bulgaria (7.6%) were lowest. The retail trade option covers retailers only: in 2025 the Netherlands (32.9%) and Czechia (30.4%) were highest and Luxembourg (1.4%) lowest. Taiwan has no such statistic; in the 2021 census, electronic shopping and mail-order houses accounted for 12.8% of retail revenue (see the side panel; a different measure).' },
      unit: '%',
      file: 'ecommerce/{item}.json',
      dimension: {
        label: { zh: '行業', en: 'Industry' },
        options: [
          { id: 'all', label: { zh: '全部行業', en: 'All industries' } },
          { id: 'retail', label: { zh: '零售業', en: 'Retail trade' } },
        ],
        defaultOption: 'all',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 14, 18, 22, 26, 30] } },
      format: pct,
      formatTick: pctTick,
      missing: EUROPE_ONLY,
      defaultYear: 2025,
    },
    {
      id: 'retail-sales',
      label: { zh: '每人一年的零售營業額', en: 'Retail turnover per person' },
      description: { zh: '零售業（不含汽機車）一年的營業額除以人口。2024 年愛爾蘭 18,558 歐元、盧森堡 16,226 最高，瑞士 12,734、冰島 12,497、奧地利 10,126；德國 9,672、法國 8,573、義大利 7,351；保加利亞 4,593、羅馬尼亞 4,258、烏克蘭 916 最低。台灣 2021 年工商普查約 4,046 歐元（零售業扣掉汽機車的營業收入 3.13 兆元），在 2021 年的希臘 4,292 與匈牙利 3,773 之間。營業額記在企業所在的國家，觀光客、跨境購物與網路零售商的總部都會把數字拉高。', en: 'Annual retail turnover (excluding motor vehicles) divided by population. In 2024 Ireland (€18,558) and Luxembourg (€16,226) were highest, followed by Switzerland (€12,734), Iceland (€12,497) and Austria (€10,126); Germany €9,672, France €8,573, Italy €7,351; Bulgaria (€4,593), Romania (€4,258) and Ukraine (€916) were lowest. Taiwan’s 2021 census gives about €4,046 (NT$3.13 trillion of retail revenue excluding motor vehicles), between Greece (€4,292) and Hungary (€3,773) in 2021. Turnover is recorded where the enterprise is based, so tourism, cross-border shopping and online retailers’ headquarters push the figure up.' },
      unit: { zh: '歐元', en: 'euros' },
      file: 'retail-sales.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [3000, 4500, 6000, 7500, 9000, 12000] } },
      format: (v) => fixed(v, 0),
      formatTick: (v) => fixed(v, 0),
      missing: EUROPE_ONLY,
      defaultYear: 2024,
    },
    {
      id: 'retail-firms',
      label: { zh: '每萬人有幾家零售企業', en: 'Retail enterprises per 10,000 people' },
      description: { zh: '每萬人有幾家零售企業（不含汽機車），看零售業是小店多還是大型連鎖多。2024 年保加利亞 143.8、烏克蘭 137.0、希臘 129.8、葡萄牙與立陶宛 115.7 最多；義大利 86.8、法國 68.4；德國 35.9、丹麥 28.3、瑞士 15.9 最少。台灣 2021 年 123.4 家，在 2021 年的希臘 132.7 與葡萄牙 120.1 之間。', en: 'Retail enterprises (excluding motor vehicles) per 10,000 people, a sign of whether retail is dominated by small shops or large chains. In 2024 Bulgaria (143.8), Ukraine (137.0), Greece (129.8), Portugal and Lithuania (115.7) had the most; Italy 86.8, France 68.4; Germany (35.9), Denmark (28.3) and Switzerland (15.9) had the fewest. Taiwan had 123.4 in 2021, between Greece (132.7) and Portugal (120.1) that year.' },
      unit: { zh: '家', en: 'enterprises' },
      file: 'retail-firms.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [30, 45, 60, 80, 100, 120] } },
      format: (v) => fixed(v, 1),
      formatTick: (v) => fixed(v, 0),
      missing: EUROPE_ONLY,
      defaultYear: 2024,
    },
    {
      id: 'retail-size',
      label: { zh: '零售企業平均幾個人', en: 'Persons employed per retail enterprise' },
      description: { zh: '零售企業平均有幾個人（含老闆與沒領薪水的家人），越小表示越多家庭式的小店。2024 年瑞士 21.8、丹麥 15.0、德國 12.1、愛爾蘭 10.4 最大；法國 4.5、義大利 3.7、希臘 3.6；捷克 3.0、烏克蘭 2.5 最小。台灣 2021 年 3.1 人，比 2021 年的歐洲國家都小，只大於阿爾巴尼亞 2.3。', en: 'Average number of persons employed per retail enterprise (including owners and unpaid family workers); smaller means more family-run shops. In 2024 Switzerland (21.8), Denmark (15.0), Germany (12.1) and Ireland (10.4) were largest; France 4.5, Italy 3.7, Greece 3.6; Czechia (3.0) and Ukraine (2.5) were smallest. Taiwan averaged 3.1 in 2021, smaller than every European country that year except Albania (2.3).' },
      unit: { zh: '人', en: 'persons' },
      file: 'retail-size.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [3.5, 4, 5, 6, 8, 12] } },
      format: (v) => fixed(v, 1),
      formatTick: (v) => fixed(v, 0),
      missing: EUROPE_ONLY,
      defaultYear: 2024,
    },
  ],
};
