import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 沒人住的房子與買賣量（新主題，2026-11-07，製作手冊第二十五批 471，候選 1122、1135；經濟的「不動產」）：
 * Eurostat 2011、2021 年普查的「無人經常居住的住宅」比例與住宅買賣件數，台灣用主計總處 2020 年普查與實價登錄
 * （pipeline/topics/housing_market.py）。指標名稱照手冊寫「無人經常居住」，不寫「空屋率」：度假屋、第二住宅、
 * 整修中的房子都算在裡面
 */
const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;
const signed = (v: number) => `${v > 0 ? '+' : ''}${fixed(v, 1)}%`;
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };
const EUROPE_ONLY = { zh: '沒有資料（只有歐洲國家與台灣）', en: 'No data (European countries and Taiwan only)' };

export const housingMarket: TopicDefinition = {
  id: 'housing-market',
  title: { zh: '沒人住的房子與買賣量', en: 'Unoccupied dwellings and home sales' },
  shortTitle: { zh: '空置與買賣', en: 'Vacancy & sales' },
  defaultIndicator: 'unoccupied',
  defaultYear: 2021,
  sources: [
    {
      name: {
        zh: 'Eurostat 2011、2021 年人口及住宅普查：Conventional dwellings by occupancy status, type of building and NUTS 3 region（cens_11dwob_r3、cens_21dwob_r3）',
        en: 'Eurostat 2011 and 2021 population and housing censuses: Conventional dwellings by occupancy status, type of building and NUTS 3 region (cens_11dwob_r3, cens_21dwob_r3)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/cens_21dwob_r3/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Eurostat：House sales - number and index（prc_hpi_hsna）', en: 'Eurostat: House sales - number and index (prc_hpi_hsna)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/prc_hpi_hsna/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '行政院主計總處 2020 年人口及住宅普查：住宅使用情形（data.gov.tw 162051）', en: 'DGBAS (Taiwan), 2020 Population and Housing Census: dwelling use (data.gov.tw 162051)' },
      url: 'https://data.gov.tw/dataset/162051',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '內政部 不動產成交案件實際資訊（實價登錄，2021–2026 年各季的買賣）', en: 'Ministry of the Interior (Taiwan), actual price register (sales, quarterly releases 2021–2026)' },
      url: 'https://plvr.land.moi.gov.tw/DownloadOpenData',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh: '「無人經常居住」不等於「空屋」：歐洲普查的 DW_NOC 包括度假屋、第二住宅、季節性出租、整修中與真正空著的房子，所以海岸觀光國家特別高；北歐與荷蘭用登記資料推估，認定方式也不同。台灣是主計總處 2020 年普查的「無人經常居住」（偶爾自住、自住以外用途、目前沒有使用三類合計），放在 2021 年那一格；另一個常見的數字是內政部的「低度使用（用電）住宅」，口徑不同，不能互相替代。2011 年瑞士全部是「不明」、波蘭只有 2.5%（2021 年 18.0%，兩次普查的做法不同），這兩國 2011 年不收；英國照網站的規則不收。住宅買賣是 Eurostat 各國統計局報的件數（各國的資料來源不同，有的只有中古屋），每千宅的分母用普查的住宅數，2011 與 2021 年之間線性內插、2021 年以後用 2021 年。台灣用內政部實價登錄的成屋買賣（住宅大樓、華廈、公寓、透天厝、套房），依公開的季別算年（大致是申報登記的時候；預售屋完工過戶的那一筆寫的是當初簽約的日期，依交易日期算最近一年會算少），預售屋的合約不算，分母是 2020 年普查的 8,993,149 宅。',
    en: '“Not usually occupied” is not the same as “vacant”: the DW_NOC category in European censuses includes holiday homes, second homes, seasonal lets, dwellings under renovation and genuinely empty ones, which is why coastal tourist countries rank high; the Nordic countries and the Netherlands estimate it from registers, with their own definitions. Taiwan uses the 2020 census figure for dwellings not usually occupied (used occasionally by the owner, used for other purposes, or not in use at present) and is shown in the 2021 slot; the Ministry of the Interior’s count of low-electricity-use dwellings is a different measure and cannot be substituted. For 2011, Switzerland reported every dwelling as unknown and Poland only 2.5% (18.0% in 2021, with a different census method), so neither is shown for that year; the UK is excluded under the site’s rules. Home sales are the counts national statistical offices report to Eurostat (sources differ by country, and some cover existing dwellings only); the denominator is the census dwelling stock, interpolated linearly between 2011 and 2021 and held at the 2021 level afterwards. Taiwan counts existing-home sales of apartments, residential towers, townhouses and studios from the Ministry of the Interior’s actual price register, assigned to the year of the quarterly release (roughly when the transfer was registered: the record for a pre-sale flat that is handed over carries its original contract date, so counting by transaction date undercounts the latest year); pre-sale contracts are excluded, and the denominator is the 8,993,149 dwellings in the 2020 census.',
  },
  panelExtra: () => import('./panels/HousingMarketPanel'),
  indicators: [
    {
      id: 'unoccupied',
      label: { zh: '無人經常居住的住宅比例', en: 'Dwellings not usually occupied' },
      description: { zh: '2021 年歐洲人口及住宅普查裡，沒有人經常居住的住宅占全部住宅的比例（度假屋、第二住宅、整修中與真正空著的都算）。克羅埃西亞 40.1%、保加利亞 38.9%、希臘 34.5%、葡萄牙 30.6%、西班牙 30.4% 最高，大多是海岸的度假屋；義大利 27.2%、法國 17.9%；德國 7.7%、挪威 6.9%、盧森堡 5.8%、荷蘭 4.1% 最低。台灣 2020 年普查 23.3%（2,097,262 宅），在拉脫維亞 23.8% 與斯洛伐克 21.1% 之間；其中「目前沒有使用」13.1%，其他是偶爾自住或當辦公室、倉庫。拖時間軸看 2011 年：希臘 35.3%、葡萄牙 31.9% 最高，兩次普查的做法不一定相同，看變化要小心。', en: 'Share of dwellings with no usual residents in the 2021 European population and housing censuses (holiday homes, second homes, dwellings under renovation and genuinely empty ones all count). Croatia (40.1%), Bulgaria (38.9%), Greece (34.5%), Portugal (30.6%) and Spain (30.4%) are highest, mostly because of coastal holiday homes; Italy is at 27.2% and France 17.9%; Germany (7.7%), Norway (6.9%), Luxembourg (5.8%) and the Netherlands (4.1%) are lowest. Taiwan’s 2020 census found 23.3% (2,097,262 dwellings), between Latvia (23.8%) and Slovakia (21.1%); 13.1% were not in use at all, the rest used occasionally by the owner or as offices or storage. Drag the time slider to 2011, when Greece (35.3%) and Portugal (31.9%) were highest; census methods are not always the same between rounds, so read changes with care.' },
      unit: '%',
      file: 'unoccupied.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [8, 12, 16, 20, 25, 30] } },
      format: pct,
      formatTick: pctTick,
      missing: EUROPE_ONLY,
      defaultYear: 2021,
    },
    {
      id: 'sales-rate',
      label: { zh: '一年賣掉幾間住宅（每千宅）', en: 'Home sales per 1,000 dwellings' },
      description: { zh: '一年住宅買賣的件數除以住宅總數（每千宅），看房市的熱度、不受國家大小影響。2025 年挪威 49.5 最高，荷蘭 33.9、匈牙利 33.0、立陶宛 32.2、丹麥 28.9、法國 27.6、比利時 26.3；台灣 26.1（234,610 筆）；克羅埃西亞 7.4、奧地利 11.2、斯洛維尼亞 12.7 最低。Eurostat 只有 14 國有件數，德國、義大利、西班牙都沒有。台灣 2024 年 34.8 是 2021 年以來最高，2025 年少了四分之一。', en: 'Home sales in a year divided by the total number of dwellings (per 1,000), a gauge of how active the housing market is regardless of country size. In 2025 Norway was highest at 49.5, followed by the Netherlands (33.9), Hungary (33.0), Lithuania (32.2), Denmark (28.9), France (27.6) and Belgium (26.3); Taiwan was at 26.1 (234,610 sales); Croatia (7.4), Austria (11.2) and Slovenia (12.7) were lowest. Eurostat has counts for only 14 countries, not including Germany, Italy or Spain. Taiwan’s 34.8 in 2024 was the highest since 2021, and sales fell by a quarter in 2025.' },
      unit: { zh: '件／千宅', en: 'per 1,000 dwellings' },
      file: 'sales-rate.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 15, 20, 25, 30, 40] } },
      format: (v) => fixed(v, 1),
      formatTick: (v) => fixed(v, 0),
      missing: EUROPE_ONLY,
      defaultYear: 2025,
    },
    {
      id: 'sales-change',
      label: { zh: '住宅買賣件數比前一年', en: 'Change in home sales' },
      description: { zh: '住宅買賣件數比前一年增減。2025 年斯洛維尼亞 +29.9%、立陶宛 +22.8%、奧地利 +22.3%、比利時 +20.2%、盧森堡 +18.6% 增加最多；2023 年多數國家大減（盧森堡 −43.3%、匈牙利 −31.4%、奧地利 −27.2%）。台灣 2024 年 +18.9%、2025 年 −25.0%，是 2025 年 21 個地區裡唯一減少超過 5% 的。', en: 'Change in the number of home sales from the year before. In 2025 the biggest rises were in Slovenia (+29.9%), Lithuania (+22.8%), Austria (+22.3%), Belgium (+20.2%) and Luxembourg (+18.6%); in 2023 most countries saw steep falls (Luxembourg −43.3%, Hungary −31.4%, Austria −27.2%). Taiwan rose 18.9% in 2024 and fell 25.0% in 2025, the only one of 21 places to drop by more than 5% that year.' },
      unit: '%',
      file: 'sales-change.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-20, -10, -2, 2, 10, 20] } },
      format: signed,
      formatTick: pctTick,
      missing: EUROPE_ONLY,
      defaultYear: 2025,
    },
  ],
};
