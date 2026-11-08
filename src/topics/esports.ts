import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, ListPanelDef, ListRow, TopicDefinition } from './types';

/**
 * 電競獎金總額與選手數（2026-11-04，製作手冊第二十一批 348；pipeline/topics/esports.py）：
 * Esports Earnings 國家頁的累計獎金、選手數與賺最多的遊戲（累計到 2026 年 11 月，沒有年份）。
 */

const GAMES: CategoryDef[] = [
  { value: 1, label: 'Dota 2' },
  { value: 2, label: 'Counter-Strike' },
  { value: 3, label: 'Fortnite' },
  { value: 4, label: 'PUBG' },
  { value: 5, label: 'League of Legends' },
  { value: 6, label: 'Rocket League' },
  { value: 7, label: { zh: '手機 MOBA 等（傳說對決、Mobile Legends、Free Fire）', en: 'Mobile games (Arena of Valor, Mobile Legends, Free Fire)' } },
  { value: 8, label: { zh: '其他遊戲', en: 'Other games' } },
];

/**
 * 2026-11-08（製作手冊第二十七批 653，候選 1427、1429、1430）：主題改名「遊戲與電競」、搬到休閒的「遊戲與動漫」；
 * 加遊戲出版的營業額（Eurostat cult_ent_val）、誰在玩（16–24 歲對 65–74 歲）、台灣上市過的遊戲（遊戲軟體分級的統計）。
 */
const TW_GROUPS: Record<string, { zh: string; en: string }> = {
  p: { zh: '依平台', en: 'By platform' },
  r: { zh: '依分級', en: 'By rating' },
  y: { zh: '依上市年份', en: 'By release year' },
};
// 鍵是資料裡的級別
const RATING_EN: Record<string, string> = {
  普: 'General', // i18n-ignore
  護: 'Protected (6+)', // i18n-ignore
  輔12: 'Parental guidance 12+', // i18n-ignore
  輔15: 'Parental guidance 15+', // i18n-ignore
  限: 'Restricted (18+)', // i18n-ignore
};
const TW_RATINGS: ListPanelDef = {
  label: { zh: '台灣上市過的遊戲（遊戲軟體分級）', en: 'Games released in Taiwan (rating records)' },
  tabLabel: { zh: '台灣', en: 'Taiwan' },
  indicators: ['taiwan-ratings'],
  file: 'taiwan-ratings.json',
  rows: (points) =>
    points.map(
      (p, i): ListRow => ({
        key: `twr-${i}`,
        title: p.g === 'r' ? tr({ zh: String(p.name), en: RATING_EN[String(p.name)] ?? String(p.name) }) : String(p.name),
        lines: [tr({ zh: `${fixed(Number(p.n), 0)} 款`, en: `${fixed(Number(p.n), 0)} titles` })],
        group: tr(TW_GROUPS[String(p.g)] ?? { zh: '', en: '' }),
        target: { box: [119.3, 21.8, 122.1, 25.4] },
      }),
    ),
};

const usd = (v: number) =>
  tr({
    zh: v >= 1e8 ? `${fixed(v / 1e8, 2)} 億美元` : `${fixed(v / 1e4, v >= 1e6 ? 0 : 1)} 萬美元`,
    en: v >= 1e6 ? `US$${fixed(v / 1e6, 1)} million` : `US$${fixed(v / 1e3, 0)}k`,
  });

export const esports: TopicDefinition = {
  id: 'esports',
  title: { zh: '遊戲與電競：電競獎金、誰在玩、遊戲產業', en: 'Games and esports: prize money, players and the game industry' },
  shortTitle: { zh: '遊戲與電競', en: 'Games & esports' },
  defaultIndicator: 'prize',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: 'Esports Earnings：Countries（2026 年 11 月 4 日）', en: 'Esports Earnings: Countries (4 November 2026)' },
      url: 'https://www.esportsearnings.com/countries',
      license: { zh: '准許個人與商業使用；Copyright © 2012-2026 Esports Earnings. All Rights Reserved.', en: 'Personal and commercial use permitted; Copyright © 2012-2026 Esports Earnings. All Rights Reserved.' },
    },
    {
      name: { zh: 'Eurostat 上網活動（isoc_ci_ac_i）、網購的商品與服務（isoc_ec_ibgs）', en: 'Eurostat internet activities (isoc_ci_ac_i) and internet purchases (isoc_ec_ibgs)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/isoc_ci_ac_i/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Eurostat 文化部門企業的附加價值與營業額（cult_ent_val，NACE J58.21 遊戲出版）', en: 'Eurostat value added and turnover of cultural enterprises (cult_ent_val, NACE J58.21 game publishing)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/cult_ent_val/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '數位發展部數位產業署「遊戲軟體分級」（data.gov.tw 6400）', en: 'Ministry of Digital Affairs (Taiwan), game software ratings (data.gov.tw 6400)' },
      url: 'https://data.gov.tw/dataset/6400',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    {
      name: { zh: 'UN World Population Prospects 2024（每百萬人用的人口）', en: 'UN World Population Prospects 2024 (population for per-million figures)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh: '依選手的國籍，加總電競選手在國際與各國賽事拿到的獎金（美元）與選手人數，從有紀錄以來累計到 2026 年 11 月。資料是 Esports Earnings 彙整網路上公開的賽事結果，不是官方統計：小語種、地方賽事會漏，選手國籍以選手自報為準，換國籍的可能算錯國家。累計獎金被 Dota 2 的 The International 這類超大獎金賽事拉偏，所以 Dota 2 強國排得前面。每百萬人用聯合國 2026 年的推估人口，人口不到 10 萬的不算。台灣的國名在網站上寫「Taiwan, Republic of China」。',
    en: 'Prize money (US$) won by esports players at international and national events, and the number of players, totalled by player nationality from the start of records to November 2026. Esports Earnings compiles publicly reported results rather than official statistics: events in smaller languages and local tournaments may be missed, nationality is self-reported and players who switch nationality may be miscounted. Huge prize pools such as Dota 2’s The International skew the totals, so strong Dota 2 nations rank high. Per-million figures use UN 2026 population projections and exclude places with fewer than 100,000 people. The site lists Taiwan as “Taiwan, Republic of China”.',
  },
  indicators: [
    {
      id: 'prize',
      label: { zh: '累計獎金', en: 'Total prize money' },
      description: {
        zh: '各國電競選手累計拿到的獎金。中國 3.34 億美元最多（9,448 名選手，主力是 Dota 2），美國 3.06 億（29,902 名選手最多，主力 Fortnite），南韓 1.58 億（主力 League of Legends），俄羅斯 1.03 億；台灣 2,318 萬美元、1,762 名選手（第 20 名，主力 League of Legends）。',
        en: 'Total prize money won by each country’s esports players. China leads with US$333.8 million (9,448 players, mostly Dota 2), the US US$306.1 million (most players at 29,902, mostly Fortnite), South Korea US$157.7 million (mostly League of Legends) and Russia US$102.8 million; Taiwan has US$23.2 million and 1,762 players (20th, mostly League of Legends).',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'prize.json',
      layer: { kind: 'bubble', legendValues: [1e6, 1e7, 1e8] },
      format: usd,
    },
    {
      id: 'prize-per-million',
      label: { zh: '每百萬人的獎金', en: 'Prize money per million people' },
      description: {
        zh: '累計獎金除以人口。丹麥每百萬人 1,096 萬美元最多（Counter-Strike 強國），愛沙尼亞、芬蘭、瑞典也在前面，南韓 306 萬；台灣 101 萬、美國 88 萬、日本 36 萬、中國 24 萬美元。',
        en: 'Total prize money divided by population. Denmark leads with US$11.0 million per million people (a Counter-Strike powerhouse), followed by Estonia, Finland and Sweden; South Korea US$3.06 million, Taiwan US$1.01 million, the US US$0.88 million, Japan US$0.36 million and China US$0.24 million.',
      },
      unit: { zh: '美元／百萬人', en: 'US$ per million people' },
      file: 'prize-per-million.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1e4, 5e4, 1e5, 5e5, 1e6, 3e6] } },
      format: usd,
      formatTick: (v) => (v >= 1e6 ? `${v / 1e6}M` : `${v / 1e3}k`),
    },
    {
      id: 'players',
      label: { zh: '選手人數', en: 'Players' },
      description: {
        zh: '拿過獎金的電競選手人數。美國 29,902 人遠多於其他國家，中國 9,448、南韓 6,005、俄羅斯 5,962；台灣 1,762 人。',
        en: 'Number of esports players who have won prize money. The US has far more than anyone else at 29,902, followed by China 9,448, South Korea 6,005 and Russia 5,962; Taiwan has 1,762.',
      },
      unit: { zh: '人', en: 'players' },
      file: 'players.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 人`, en: fixed(v, 0) }),
    },
    {
      id: 'top-game',
      label: { zh: '賺最多獎金的遊戲', en: 'Top-earning game' },
      description: {
        zh: '每個國家的選手賺最多獎金的遊戲。Dota 2（32 國：中國、俄羅斯、烏克蘭、瑞典、芬蘭、菲律賓、祕魯等）、Fortnite（28 國：美國、加拿大、墨西哥、英國、義大利、荷蘭等）、PUBG（24 國：印度、日本、土耳其、奈及利亞等，多是手機版）、Counter-Strike（19 國：丹麥、法國、波蘭、葡萄牙、南非等）最常見；南韓、台灣是 League of Legends，越南是傳說對決。滑過國家看占比。',
        en: 'The game that earned each country’s players the most prize money. Dota 2 (32 countries, including China, Russia, Ukraine, Sweden, Finland, the Philippines and Peru), Fortnite (28, including the US, Canada, Mexico, the UK, Italy and the Netherlands), PUBG (24, including India, Japan, Türkiye and Nigeria, mostly the mobile version) and Counter-Strike (19, including Denmark, France, Poland, Portugal and South Africa) are most common; South Korea and Taiwan top out in League of Legends and Vietnam in Arena of Valor. Hover for the share.',
      },
      unit: '',
      file: 'top-game.json',
      layer: { kind: 'categorical', categories: GAMES },
      format: (v) => {
        const label = GAMES.find((c) => c.value === v)?.label ?? '';
        return typeof label === 'string' ? label : tr(label);
      },
      unranked: true,
    },
    // 2026-11-06（製作手冊第二十四批 424；pipeline/topics/gaming_eu.py）：一般人玩遊戲的比例，Eurostat，只有歐洲
    {
      id: 'gaming-online',
      label: { zh: '上網玩遊戲的人（歐洲）', en: 'Playing games online (Europe)' },
      description: {
        zh: '16–74 歲的人裡，最近三個月上網玩或下載遊戲的比例（Eurostat，2024 年，歐洲 34 國；分母是全部人口，不是上網的人）。丹麥 51.7% 最高，荷蘭 50.1%、挪威 45.0%、瑞典 44.6%、愛爾蘭 44.4%、芬蘭 43.9%；法國 37.7%、西班牙 34.3%、義大利 29.9%、德國 28.3%；波蘭 16.6%、捷克 16.2%、保加利亞 15.8%、波赫 14.5% 最低。台灣與歐洲以外沒有可比的資料。',
        en: 'Share of people aged 16–74 who played or downloaded games online in the last three months (Eurostat, 2024, 34 European countries; the denominator is the whole population, not internet users). Denmark is highest at 51.7%, then the Netherlands 50.1%, Norway 45.0%, Sweden 44.6%, Ireland 44.4% and Finland 43.9%; France 37.7%, Spain 34.3%, Italy 29.9% and Germany 28.3%; Poland 16.6%, Czechia 16.2%, Bulgaria 15.8% and Bosnia and Herzegovina 14.5% are lowest. Taiwan and countries outside Europe have no comparable data.',
      },
      unit: '%',
      file: 'gaming-online.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 25, 30, 35, 40, 45] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      missing: { zh: '只有歐洲有資料', en: 'Europe only' },
    },
    {
      id: 'gaming-subscriptions',
      label: { zh: '付費訂閱遊戲服務的人（歐洲）', en: 'Paying for game subscriptions (Europe)' },
      description: {
        zh: '16–74 歲的人裡，有付費的遊戲串流或遊戲訂閱服務的比例（Eurostat，2025 年，歐洲 35 國）。荷蘭 12.8% 最高，挪威 12.2%、愛爾蘭 12.0%、丹麥 10.1%、瑞士 9.9%、阿爾巴尼亞 9.5%；羅馬尼亞 2.5%、保加利亞 1.9%、斯洛維尼亞 1.8%、塞爾維亞 1.4% 最低。',
        en: 'Share of people aged 16–74 paying for a game streaming or subscription service (Eurostat, 2025, 35 European countries). The Netherlands is highest at 12.8%, then Norway 12.2%, Ireland 12.0%, Denmark 10.1%, Switzerland 9.9% and Albania 9.5%; Romania 2.5%, Bulgaria 1.9%, Slovenia 1.8% and Serbia 1.4% are lowest.',
      },
      unit: '%',
      file: 'gaming-subscriptions.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 4, 6, 8, 10, 12] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      missing: { zh: '只有歐洲有資料', en: 'Europe only' },
    },
    // 2026-11-08（製作手冊第二十七批 653）
    {
      id: 'gaming-age',
      label: { zh: '誰在玩遊戲：年輕人與長輩（歐洲）', en: 'Who plays games: young and old (Europe)' },
      description: {
        zh: '上網玩或下載遊戲的比例，依年齡分（Eurostat，2024 年，歐洲 35 國；冰島、北馬其頓等幾國是 2020 年）。16–24 歲：希臘 88.0% 最高，賽普勒斯 81.4%、挪威 78.2%、芬蘭 77.3%、丹麥 77.0%；克羅埃西亞 43.2%、保加利亞 44.0% 最低。65–74 歲：荷蘭 37.4% 最高，丹麥 31.3%、比利時 24.6%；保加利亞 1.7%、波赫 1.9%、捷克 2.3% 最低。希臘的年輕人幾乎都玩、長輩幾乎不玩，荷蘭、丹麥兩代的差距最小。',
        en: 'Share of people who played or downloaded games online, by age (Eurostat, 2024, 35 European countries; a few such as Iceland and North Macedonia are 2020). Ages 16–24: Greece is highest at 88.0%, then Cyprus 81.4%, Norway 78.2%, Finland 77.3% and Denmark 77.0%; Croatia 43.2% and Bulgaria 44.0% are lowest. Ages 65–74: the Netherlands is highest at 37.4%, then Denmark 31.3% and Belgium 24.6%; Bulgaria 1.7%, Bosnia and Herzegovina 1.9% and Czechia 2.3% are lowest. Almost all young Greeks play while few older Greeks do; the gap between generations is smallest in the Netherlands and Denmark.',
      },
      unit: '%',
      file: 'gaming-age/{item}.json',
      dimension: {
        label: { zh: '年齡', en: 'Age' },
        options: [
          { id: 'young', label: { zh: '16–24 歲', en: '16–24' } },
          { id: 'old', label: { zh: '65–74 歲', en: '65–74' } },
        ],
        defaultOption: 'young',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [50, 60, 65, 70, 75, 80] },
        itemScales: { old: { type: 'sequential', thresholds: [3, 5, 10, 15, 20, 30] } },
      },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      missing: { zh: '只有歐洲有資料', en: 'Europe only' },
    },
    {
      id: 'game-publishing',
      label: { zh: '遊戲出版的營業額（歐洲）', en: 'Game publishing turnover (Europe)' },
      description: {
        zh: '電腦遊戲出版業（NACE J58.21）企業一年的營業額（Eurostat 文化部門企業統計，2020 年，歐洲 31 國；資料到 2020 年為止）。法國 34.8 億歐元最多，芬蘭 22.1 億、瑞典 21.1 億、賽普勒斯 18.8 億、德國 7.9 億、西班牙 3.9 億、丹麥 3.0 億、波蘭 2.1 億。賽普勒斯排很前面，手冊提醒是公司登記地的效應，不代表當地做遊戲的規模。J58.21 只算遊戲出版，遊戲程式設計算在其他行業，所以會低估；英國照網站的 Eurostat 規則不收，台灣與歐洲以外沒有。',
        en: 'Annual turnover of computer game publishers (NACE J58.21) from Eurostat’s statistics on cultural enterprises (2020, 31 European countries; the series ends in 2020). France has the most (€3.48 billion), followed by Finland (€2.21 billion), Sweden (€2.11 billion), Cyprus (€1.88 billion), Germany (€0.79 billion), Spain (€0.39 billion), Denmark (€0.30 billion) and Poland (€0.21 billion). Cyprus’s high rank reflects where companies are registered rather than how many games are made there. J58.21 covers game publishing only, while game programming falls under other industries, so it understates the sector; the UK is excluded under this site’s Eurostat rule, and Taiwan and countries outside Europe have no data.',
      },
      unit: { zh: '百萬歐元', en: '€ million' },
      file: 'game-publishing.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 3000] },
      format: (v) => tr({ zh: v >= 100 ? `${fixed(v / 100, 1)} 億歐元` : `${fixed(v * 100, 0)} 萬歐元`, en: `€${fixed(v, 1)} million` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: false,
      missing: { zh: '只有歐洲有資料', en: 'Europe only' },
    },
    {
      id: 'taiwan-ratings',
      label: { zh: '台灣上市過的遊戲', en: 'Games released in Taiwan' },
      description: {
        zh: '數位發展部「遊戲軟體分級」的 11,219 筆：平台以手機遊戲 2,632 款最多，PC 單機 1,709、PS3 1,141、PC 線上 943、Xbox 360 900、PS4 777；分級是輔 12 共 3,217、普 2,299、輔 15 共 2,231、限 1,821、護 1,651；上市日期從 1981 年到 2018 年，2013 年 1,416 款最多。2019 年以後幾乎沒有新資料，年份只算到 2018 年。廠商欄是台灣的代理商，不是原開發商。左邊的清單依平台、分級與上市年份統計，國家不上色。',
        en: 'The 11,219 records in Taiwan’s game software ratings (Ministry of Digital Affairs): mobile games are the largest platform (2,632), followed by PC (1,709), PS3 (1,141), online PC (943), Xbox 360 (900) and PS4 (777); ratings are Parental guidance 12+ 3,217, General 2,299, Parental guidance 15+ 2,231, Restricted 1,821 and Protected 1,651; release dates run from 1981 to 2018, peaking in 2013 with 1,416 titles. There are almost no records after 2018, so years stop there. The company field is the Taiwanese distributor, not the original developer. The list on the left counts titles by platform, rating and release year; countries are not coloured.',
      },
      unit: '',
      file: 'taiwan-ratings-map.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      focus: [119.3, 21.8, 122.1, 25.4],
      missing: { zh: '國家不上色，看左邊的台灣清單', en: 'Countries are not coloured; see the Taiwan list on the left' },
    },
  ],
  listPanel: [TW_RATINGS],
};
