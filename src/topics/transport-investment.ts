import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 交通基礎建設的投資與養護：錢花在鐵路還是公路（新主題，2026-11-07，製作手冊第二十七批 584，候選 1303；
 * 交通的新小類「交通政策與投資」）：OECD／ITF 的 DF_INFRINV，pipeline/topics/transport_investment.py。
 * 地圖是當年價格的歐元；側欄 panels/TransportInvestmentPanel.tsx 是各運具的投資與養護（2015 年價格）。
 */
const eur = (v: number) => tr({ zh: `${formatLargeNumber(v)} 歐元`, en: `€${formatLargeNumber(v)}` });
const pct = (digits: number) => (v: number) => `${fixed(v, digits)}%`;
const NOTE = {
  zh: '各國最近一年不一樣（最多往前找 5 年）；ITF 沒有台灣。',
  en: 'The latest year differs between countries (up to 5 years back); the ITF has no data for Taiwan.',
};

export const transportInvestment: TopicDefinition = {
  id: 'transport-investment',
  title: { zh: '交通基礎建設的投資與養護', en: 'Transport infrastructure investment' },
  shortTitle: { zh: '交通建設投資', en: 'Infrastructure investment' },
  defaultIndicator: 'inland-investment',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'OECD／國際運輸論壇（ITF）：Transport infrastructure investment and maintenance spending（DF_INFRINV）',
        en: 'OECD / International Transport Forum: Transport infrastructure investment and maintenance spending (DF_INFRINV)',
      },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_INFRINV%40DF_INFRINV&df[ag]=OECD.ITF',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '世界銀行：GDP（本國幣，NY.GDP.MKTP.CN）', en: 'World Bank: GDP (current local currency, NY.GDP.MKTP.CN)' },
      url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.CN',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: 'ITF 每年向會員國調查政府與公共部門花在交通基礎建設的錢：投資是新建、擴建與大修，養護是維持既有設施運作的支出；52 國、1995 年起（烏茲別克的金額差了好幾個數量級，不收）。各國申報的範圍差很多：有的含地方政府、公營事業或民間的投資，有的只有中央政府，所以國與國之間只能看大概，同一國歷年的變化比較可靠。地圖用當年價格換成歐元，會受匯率影響；占 GDP 用本國幣相除，側欄用 ITF 換算的 2015 年價格。中國只有公路與鐵路。台灣不在 ITF 的資料裡。',
    en: 'Each year the ITF surveys member countries on what governments and the public sector spend on transport infrastructure: investment covers new construction, extensions and major renewals, maintenance the spending that keeps existing networks running; 52 countries since 1995 (Uzbekistan’s amounts are off by orders of magnitude and are left out). What countries report varies a lot – some include local government, public enterprises or private investment, others only central government – so compare countries loosely; changes within a country over time are more reliable. The map converts current prices to euros, so exchange rates matter; the share of GDP uses national currency, and the side panel uses the ITF’s 2015 prices. China reports only road and rail. Taiwan is not in the ITF data.',
  },
  panelExtra: () => import('./panels/TransportInvestmentPanel'),
  indicators: [
    {
      id: 'inland-investment',
      label: { zh: '內陸交通基礎建設投資', en: 'Inland transport infrastructure investment' },
      description: {
        zh: `公路、鐵路與內河航道的基礎建設投資（ITF，當年價格換成歐元）。中國 2024 年 4,585 億歐元（公路 3,447 億、鐵路 1,138 億）遠遠最多，美國 1,002 億（2021 年）、日本 387 億（2022 年）、德國 348 億、澳洲 323 億、法國 262 億、義大利 122 億（2023 年）、西班牙 102 億、瑞士 100 億（2023 年）。${NOTE.zh}點國家看各運具（含港口與機場）的投資與養護。`,
        en: `Infrastructure investment in roads, rail and inland waterways (ITF, current prices converted to euros). China is far ahead at €458.5B in 2024 (roads €344.7B, rail €113.8B), followed by the US €100.2B (2021), Japan €38.67B (2022), Germany €34.79B, Australia €32.31B, France €26.17B, Italy €12.22B (2023), Spain €10.20B and Switzerland €10.01B (2023). ${NOTE.en} Click a country for investment and maintenance by mode, including ports and airports.`,
      },
      defaultYear: 'latest',
      unit: { zh: '歐元', en: 'EUR' },
      file: 'inland-investment.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: eur,
      formatTick: formatLargeTick,
    },
    {
      id: 'rail-share',
      label: { zh: '鐵路占公路加鐵路投資的比例', en: 'Rail’s share of road and rail investment' },
      description: {
        zh: `鐵路的投資占「公路＋鐵路」投資的幾 %（ITF），超過 50% 就是錢花在鐵路比公路多。愛沙尼亞 70.2%、比利時 59.6%、義大利 59.3%（2023 年）、英國 58.0%（2019 年）、匈牙利 56.7%、法國 52.4% 超過一半；西班牙 47.9%、瑞士 42.1%（2023 年）、德國 40.4%、日本 31.7%（2022 年）、中國 24.8%；美國只有 8.7%（2021 年）、希臘 8.8%、加拿大 15.3%（2019 年）、波蘭 17.3%。${NOTE.zh}`,
        en: `Rail investment as a share of road plus rail investment (ITF); above 50% means more went to rail than to roads. Estonia 70.2%, Belgium 59.6%, Italy 59.3% (2023), the UK 58.0% (2019), Hungary 56.7% and France 52.4% are above half; Spain 47.9%, Switzerland 42.1% (2023), Germany 40.4%, Japan 31.7% (2022) and China 24.8%; the US only 8.7% (2021), Greece 8.8%, Canada 15.3% (2019) and Poland 17.3%. ${NOTE.en}`,
      },
      defaultYear: 'latest',
      unit: '%',
      file: 'rail-share.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [10, 25, 40, 50, 60, 75] } },
      format: pct(1),
      unranked: true,
    },
    {
      id: 'investment-gdp',
      label: { zh: '內陸交通投資占 GDP', en: 'Inland transport investment, % of GDP' },
      description: {
        zh: `公路、鐵路與內河航道的投資占 GDP（ITF 的本國幣金額 ÷ 世界銀行的本國幣 GDP，不受匯率影響）。亞塞拜然 3.92%、喬治亞 3.07%（2019 年）、中國 2.54%、塞爾維亞 2.37%、澳洲 1.90%、北馬其頓 1.74% 最高，正在大量修路的國家比較高；南韓 1.25%（2019 年）、瑞士 1.17%（2023 年）、挪威 1.16%（2023 年）、日本 0.93%（2022 年）、法國 0.90%、德國 0.80%、義大利 0.57%（2023 年）；愛爾蘭 0.18%、墨西哥 0.32%、比利時 0.40%、美國 0.50%（2021 年）最低。${NOTE.zh}`,
        en: `Investment in roads, rail and inland waterways as a share of GDP (ITF amounts in national currency divided by World Bank GDP in national currency, so exchange rates do not matter). Azerbaijan 3.92%, Georgia 3.07% (2019), China 2.54%, Serbia 2.37%, Australia 1.90% and North Macedonia 1.74% are highest – countries in the middle of big road-building programmes; South Korea 1.25% (2019), Switzerland 1.17% (2023), Norway 1.16% (2023), Japan 0.93% (2022), France 0.90%, Germany 0.80% and Italy 0.57% (2023); Ireland 0.18%, Mexico 0.32%, Belgium 0.40% and the US 0.50% (2021) are lowest. ${NOTE.en}`,
      },
      defaultYear: 'latest',
      unit: '%',
      file: 'investment-gdp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.4, 0.6, 0.8, 1, 1.5, 2] } },
      format: pct(2),
    },
    {
      id: 'road-maintenance',
      label: { zh: '公路養護支出', en: 'Road maintenance spending' },
      description: {
        zh: `花在維持既有公路的錢（ITF，當年價格換成歐元），44 國。美國 521 億歐元（2021 年）、日本 199 億（2022 年）最多，義大利 85.13 億（2023 年）、英國 76.72 億、荷蘭 33.61 億、法國 33.34 億、瑞士 30.55 億（2023 年）。哪些算養護、哪些算投資（例如路面重鋪）各國分法不同；德國、西班牙、中國、澳洲沒有這一項。${NOTE.zh}`,
        en: `Spending to keep existing roads running (ITF, current prices converted to euros), 44 countries. The US (€52.07B, 2021) and Japan (€19.92B, 2022) spend the most, followed by Italy €8.51B (2023), the UK €7.67B, the Netherlands €3.36B, France €3.33B and Switzerland €3.06B (2023). Countries draw the line between maintenance and investment (resurfacing, for example) differently; Germany, Spain, China and Australia have no figures for this. ${NOTE.en}`,
      },
      defaultYear: 'latest',
      unit: { zh: '歐元', en: 'EUR' },
      file: 'road-maintenance.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: eur,
      formatTick: formatLargeTick,
    },
  ],
};
