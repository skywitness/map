import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, usd } from '../lib/format';
import type { CategoryDef, FlowLabels, IndicatorDef, Text, TopicDefinition } from './types';
import { COVID } from './events';
import { MONTHS, monthLabel } from './months';
import { topicPart } from './merge';

const ARRIVALS = { zh: '人次', en: 'arrivals' };
const PER_PERSON = { zh: '人次/人', en: 'arrivals per resident' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

/** 旅客的來源與去向（2026-11-04，製作手冊第二十一批 349；pipeline/topics/tourism_flows.py） */
const VISITOR_LABELS: Record<'export' | 'import', FlowLabels> = {
  import: {
    partners: { zh: '旅客來源', en: 'visitor origins' },
    main: { zh: '旅客從哪裡來', en: 'Where visitors come from' },
    verb: (origin, partner) => tr({ zh: `從${partner}來${origin}的旅客`, en: `Visitors from ${partner} to ${origin}` }),
  },
  export: {
    partners: { zh: '旅客來源', en: 'visitor origins' },
    main: { zh: '旅客從哪裡來', en: 'Where visitors come from' },
    verb: (origin, partner) => tr({ zh: `從${origin}去${partner}的旅客`, en: `Visitors from ${origin} to ${partner}` }),
  },
};
const TRIP_LABELS: Record<'export' | 'import', FlowLabels> = {
  import: {
    partners: { zh: '出國目的地', en: 'trip destinations' },
    main: { zh: '出國去哪裡', en: 'Where residents travel abroad' },
    verb: (origin, partner) => tr({ zh: `${partner}的人去${origin}的旅次`, en: `Trips from ${partner} to ${origin}` }),
  },
  export: {
    partners: { zh: '出國目的地', en: 'trip destinations' },
    main: { zh: '出國去哪裡', en: 'Where residents travel abroad' },
    verb: (origin, partner) => tr({ zh: `${origin}的人去${partner}的旅次`, en: `Trips from ${origin} to ${partner}` }),
  },
};
const EUROSTAT = 'CC BY 4.0';

/** 歐洲人怎麼旅遊（2026-11-04，製作手冊第二十一批 352–356；pipeline/topics/tourism_demand.py）：Eurostat 的觀光需求調查 */
const ACCOMMODATION: CategoryDef[] = [
  { value: 1, label: { zh: '旅館', en: 'Hotels' } },
  { value: 2, label: { zh: '租的房子或公寓', en: 'Rented flats or houses' } },
  { value: 3, label: { zh: '營地', en: 'Campsites' } },
  { value: 4, label: { zh: '自有度假住宅', en: 'Own holiday home' } },
  { value: 5, label: { zh: '住親友家', en: 'With friends or relatives' } },
  { value: 6, label: { zh: '其他', en: 'Other' } },
];
const NO_TRIP_REASONS: CategoryDef[] = [
  { value: 1, label: { zh: '錢不夠', en: 'Financial reasons' } },
  { value: 2, label: { zh: '健康', en: 'Health' } },
  { value: 3, label: { zh: '工作或求學沒時間', en: 'No time (work or study)' } },
  { value: 4, label: { zh: '家庭因素', en: 'Family commitments' } },
  { value: 5, label: { zh: '沒興趣', en: 'No interest' } },
  { value: 6, label: { zh: '安全考量', en: 'Safety concerns' } },
];
const labelOf = (categories: CategoryDef[]) => (v: number) => tr(categories.find((c) => c.value === v)?.label ?? '');
const pctIndicator = (id: string, label: Text, description: Text, thresholds: number[]): IndicatorDef => ({
  id,
  label,
  description,
  unit: '%',
  file: `${id}.json`,
  defaultYear: 2025,
  layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
  format: (v) => `${fixed(v, 1)}%`,
  formatTick: (v) => `${v}%`,
});

const tourismOwn: TopicDefinition = {
  id: 'tourism',
  title: { zh: '各國國際觀光', en: 'International tourism by country' },
  shortTitle: { zh: '觀光', en: 'Tourism' },
  defaultIndicator: 'arrivals',
  defaultYear: 2019,
  sources: [
    {
      name: {
        zh: 'World Bank, World Development Indicators（UN Tourism 資料）',
        en: 'World Bank, World Development Indicators (UN Tourism data)',
      },
      url: 'https://data.worldbank.org/',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'World Bank, World Development Indicators（IMF 國際收支：旅行收入）',
        en: 'World Bank, World Development Indicators (IMF balance of payments: travel receipts)',
      },
      url: 'https://data.worldbank.org/indicator/BX.GSR.TRVL.ZS',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '交通部觀光署 來臺旅客人次', en: 'Tourism Administration (Taiwan), visitor arrivals' },
      url: 'https://data.gov.tw/dataset/7322',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: 'Eurostat：旅宿業的到達人次依居住國（tour_occ_arnraw）、居民的旅次依目的地（tour_dem_ttw）',
        en: 'Eurostat: arrivals at tourist accommodation by country of residence (tour_occ_arnraw); trips by destination (tour_dem_ttw)',
      },
      url: 'https://ec.europa.eu/eurostat/web/tourism/database',
      license: EUROSTAT,
    },
    {
      name: { zh: 'Eurostat：旅宿業的月別住宿夜數（tour_occ_nim）', en: 'Eurostat: monthly nights spent at tourist accommodation (tour_occ_nim)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/tour_occ_nim/default/table',
      license: EUROSTAT,
    },
    {
      name: {
        zh: '交通部觀光署：每月「觀光市場概況摘要」的月表 1-2 來臺旅客按居住地（台灣的旺季，2024 年起；年資料 data.gov.tw 15453）',
        en: 'Tourism Administration (Taiwan): monthly market summaries, table 1-2 visitor arrivals by residence (Taiwan’s peak month, from 2024; annual data on data.gov.tw 15453)',
      },
      url: 'https://admin.taiwan.net.tw/businessinfo/News?a=119',
      license: { zh: '政府資料開放授權條款第 1 版（年資料）；月別數字註明觀光署', en: 'Open Government Data License 1.0 (annual data); monthly figures credited to the Tourism Administration' },
    },
    {
      name: {
        zh: 'Eurostat：居民的觀光需求調查（tour_dem_ttac、ttls、npsex、tttr、ttpw、tttot、tntot、tosex、extot）',
        en: 'Eurostat: tourism demand survey of residents (tour_dem_ttac, ttls, npsex, tttr, ttpw, tttot, tntot, tosex, extot)',
      },
      url: 'https://ec.europa.eu/eurostat/web/tourism/database',
      license: EUROSTAT,
    },
    {
      name: { zh: '交通部觀光署：歷年國人旅遊狀況調查（逐筆樣本）、國人出國旅遊重要指標統計表', en: 'Tourism Administration (Taiwan): travel survey microdata; key outbound indicators' },
      url: 'https://data.gov.tw/dataset/94140',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: 'ILOSTAT：依行業的就業人數（住宿及餐飲業）', en: 'ILOSTAT: employment by economic activity (accommodation and food services)' },
      url: 'https://ilostat.ilo.org/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '行政院主計總處 人力資源調查（台灣 2021 年起的住宿及餐飲業就業人數）', en: 'DGBAS Manpower Survey (Taiwan, from 2021)' },
      url: 'https://nstatdb.dgbas.gov.tw/dgbasall/webMain.aspx?sys=100&funid=dgbasall',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: 'World Bank, World Development Indicators（陸地面積）', en: 'World Bank, World Development Indicators (land area)' },
      url: 'https://data.worldbank.org/indicator/AG.LND.TOTL.K2',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '交通部觀光署 觀光統計資料庫：來臺旅客按居住地、國人出國按首站抵達地', en: 'Tourism Administration (Taiwan): arrivals by residence, departures by first destination' },
      url: 'https://stat.taiwan.net.tw/',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '中央銀行 國際收支統計', en: 'Central Bank of the Republic of China (Taiwan), balance of payments' },
      url: 'https://cpx.cbc.gov.tw/',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: 'United Nations, World Population Prospects 2024（旅客與人口比）',
        en: 'United Nations, World Population Prospects 2024 (arrivals per resident)',
      },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh: '國際旅客、觀光收入與觀光收入占出口只到 2020 年：UN Tourism 之後的資料不開放轉載。旅行收入與旅行收入占出口是世界銀行轉載的 IMF 國際收支，到最新一年；IMF 的「旅行」不含國際客運（觀光收入含付給本國航空公司的機票錢），兩者不能直接接起來比。旅客人次有些國家只算過夜旅客、有些含當日來回的旅客，跨國比較時要留意。2020 年起受疫情影響大幅減少。旅客的來源與去向（2026-11 加）：歐洲是 Eurostat 的旅宿業到達人次（一個人住兩家旅館算兩次，跟入境人次不同）與居民一夜以上的出國旅次，只有有名字的 42 個來源國、29 個出發國；台灣是觀光署的來臺旅客（依居住地，港澳合在一起）與國人出國的首站抵達地（轉機的算第一站）。',
    en: 'International arrivals, tourism receipts and their share of exports end in 2020 because later UN Tourism data may not be republished. Travel receipts and their share of exports come from IMF balance-of-payments data republished by the World Bank and run to the latest year; IMF "travel" excludes international passenger transport (tourism receipts include fares paid to national carriers), so the two series cannot be joined directly. Some countries count only overnight visitors and others include same-day visitors, so compare with care. Figures drop sharply from 2020 because of the pandemic. Visitor origins and destinations (added November 2026): for Europe, Eurostat arrivals at tourist accommodation (someone staying at two hotels counts twice, unlike border arrivals) and residents’ trips abroad of one night or more, with only the 42 named source countries and 29 reporting countries; for Taiwan, Tourism Administration arrivals by country of residence (Hong Kong and Macao combined) and the first destination of departures (a connecting stop counts as the destination).',
  },
  indicators: [
    {
      id: 'arrivals',
      label: { zh: '國際旅客', en: 'International arrivals' },
      description: {
        zh: '一年有多少人次的外國旅客入境。圓的面積與人次成正比。',
        en: 'Number of international visitor arrivals in a year. Circle area is proportional to arrivals.',
      },
      unit: ARRIVALS,
      file: 'arrivals.json',
      events: [COVID],
      layer: { kind: 'bubble', legendValues: [1e6, 1e7, 1e8] },
      format: (v) => `${formatLargeNumber(v)} ${tr(ARRIVALS)}`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'receipts',
      label: { zh: '觀光收入', en: 'Tourism receipts' },
      description: {
        zh: '外國旅客在當地的花費，加上付給本國航空、交通業者的國際客運費用，以當年美元計。圓的面積與收入成正比。',
        en: "Spending by international visitors in the country plus international passenger fares paid to the country's carriers, in current US dollars. Circle area is proportional to receipts.",
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'receipts.json',
      events: [COVID],
      layer: { kind: 'bubble', legendValues: [1e9, 1e10, 1e11] },
      format: (v) => usd(formatLargeNumber(v)),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'receipts-exports',
      label: { zh: '觀光收入占出口', en: 'Tourism receipts, % of exports' },
      description: {
        zh: '觀光收入占商品與服務出口總額的比例，可以看出一國經濟有多依賴觀光。',
        en: 'Tourism receipts as a share of total exports of goods and services, a measure of how much an economy depends on tourism.',
      },
      unit: '%',
      file: 'receipts-exports.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 40, 60] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'travel',
      label: { zh: '旅行收入（IMF）', en: 'Travel receipts (IMF)' },
      description: {
        zh: '外國旅客在當地的食宿、交通、購物等花費（國際收支的「旅行」服務出口），以當年美元計，到最新一年。不含國際客運，比觀光收入少一些，兩者不能直接接起來比。圓的面積與收入成正比。',
        en: 'What foreign visitors spend in the country on lodging, food, local transport, shopping and so on ("travel" services exports in the balance of payments), in current US dollars, up to the latest year. It excludes international passenger transport, so it is somewhat lower than tourism receipts and the two cannot be joined directly. Circle area is proportional to receipts.',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'travel.json',
      events: [COVID],
      layer: { kind: 'bubble', legendValues: [1e9, 1e10, 1e11] },
      format: (v) => usd(formatLargeNumber(v)),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'travel-exports',
      label: { zh: '旅行收入占出口（IMF）', en: 'Travel receipts, % of exports (IMF)' },
      description: {
        zh: '旅行收入占商品與服務出口總額的比例，到最新一年。不含國際客運，比「觀光收入占出口」低一些。',
        en: 'Travel receipts as a share of total exports of goods and services, up to the latest year. It excludes international passenger transport, so it is somewhat lower than tourism receipts as a share of exports.',
      },
      unit: '%',
      file: 'travel-exports.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 40, 60] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'arrivals-per-capita',
      label: { zh: '旅客與人口比', en: 'Arrivals per resident' },
      description: {
        zh: '一年的國際旅客人次除以人口。大於 1 表示來訪旅客比當地居民還多。',
        en: 'International arrivals in a year divided by population. Above 1 means more visitors than residents.',
      },
      unit: PER_PERSON,
      file: 'arrivals-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.05, 0.1, 0.25, 0.5, 1, 2] } },
      format: (v) => `${fixed(v, 2)} ${tr(PER_PERSON)}`,
      // 0.05、0.1、0.25、0.5、1、2：小數位數跟著刻度走
      formatTick: (v) => fixed(v, Number.isInteger(v) ? 0 : Number.isInteger(Math.round(v * 1e6) / 1e5) ? 1 : 2),
      compareWorld: true,
    },
    {
      id: 'visitors-from',
      label: { zh: '流向：旅客從哪裡來', en: 'Flows: where visitors come from' },
      description: {
        zh: '點選國家，弧線連到它前 15 大的旅客來源國（歐洲 36 國用旅宿業的到達人次、台灣用來臺旅客人次，依居住地）。2024 年西班牙的國外旅客英國人 1,442 萬人次最多、德國 983 萬、法國 861 萬、美國 512 萬；克羅埃西亞以德國人 307 萬最多；台灣是日本 132 萬、港澳 131 萬、南韓 100 萬、美國 65 萬。顏色是國外客人次。',
        en: 'Click a country to draw arcs to its top 15 source countries of visitors (accommodation arrivals for 36 European countries, border arrivals for Taiwan, by country of residence). In 2024 Spain’s foreign guests were led by the UK with 14.42 million arrivals, then Germany 9.83 million, France 8.61 million and the US 5.12 million; Croatia’s by Germany with 3.07 million; Taiwan’s by Japan 1.32 million, Hong Kong and Macao 1.31 million, South Korea 1.00 million and the US 0.65 million. Colour shows foreign arrivals.',
      },
      unit: ARRIVALS,
      file: 'foreign-arrivals.json',
      layer: {
        kind: 'flow',
        file: 'flows/visitors/{year}.json',
        direction: 'import',
        labels: VISITOR_LABELS,
        pickPartners: { zh: '點選國家（歐洲 36 國或台灣），查看它的旅客從哪裡來', en: 'Click a country (36 in Europe, or Taiwan) to see where its visitors come from' },
        legendKey: { zh: '由來源國（淺）到目的地（深）', en: 'From origin (light) to destination (dark)' },
      },
      format: (v) => `${formatLargeNumber(v)} ${tr(ARRIVALS)}`,
      formatTick: formatLargeTick,
    },
    {
      id: 'trips-to',
      label: { zh: '流向：出國去哪裡', en: 'Flows: where residents travel abroad' },
      description: {
        zh: '點選國家，弧線連到它的居民出國最常去的 15 個國家（歐洲 29 國是一夜以上的出國旅次、台灣是出國的首站抵達地）。2024 年德國人去義大利 1,575 萬趟、奧地利 1,444 萬、西班牙 1,118 萬、法國 863 萬；台灣人的首站是日本 601 萬人次最多，其次中國 277 萬、南韓 143 萬、越南 126 萬。顏色是出國的旅次。',
        en: 'Click a country to draw arcs to the 15 countries its residents visit most (trips abroad of one night or more for 29 European countries; first destination of departures for Taiwan). In 2024 Germans made 15.75 million trips to Italy, 14.44 million to Austria, 11.18 million to Spain and 8.63 million to France; Taiwanese departures went first to Japan (6.01 million), then China 2.77 million, South Korea 1.43 million and Vietnam 1.26 million. Colour shows trips abroad.',
      },
      unit: ARRIVALS,
      file: 'outbound-trips.json',
      layer: {
        kind: 'flow',
        file: 'flows/trips/{year}.json',
        direction: 'export',
        labels: TRIP_LABELS,
        pickPartners: { zh: '點選國家（歐洲 29 國或台灣），查看它的居民出國去哪裡', en: 'Click a country (29 in Europe, or Taiwan) to see where its residents travel' },
        legendKey: { zh: '由出發國（淺）到目的地（深）', en: 'From home country (light) to destination (dark)' },
      },
      format: (v) => `${formatLargeNumber(v)} ${tr(ARRIVALS)}`,
      formatTick: formatLargeTick,
    },
    {
      id: 'foreign-share',
      label: { zh: '國外客占旅宿房客的比例', en: 'Foreign share of accommodation guests' },
      description: {
        zh: '旅館、度假住宿與露營地的到達人次裡，國外客占幾成（Eurostat）。2024 年馬爾他 89.4%、盧森堡 87.0%、克羅埃西亞 85.9%、賽普勒斯 81.5%、希臘 73.7% 最高；德國、波蘭 20.3%、羅馬尼亞 16.7% 最低，國內旅遊為主。',
        en: 'Share of foreign guests among arrivals at hotels, holiday accommodation and campsites (Eurostat). In 2024 Malta 89.4%, Luxembourg 87.0%, Croatia 85.9%, Cyprus 81.5% and Greece 73.7% are highest; Germany and Poland 20.3% and Romania 16.7% lowest, where domestic tourism dominates.',
      },
      unit: '%',
      file: 'foreign-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 30, 40, 50, 60, 75] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'peak-month',
      label: { zh: '旅遊最旺的月份', en: 'Peak tourist month' },
      description: {
        zh: '旅宿業住宿夜數最多的月份（Eurostat，歐洲 38 國）。27 國是 8 月；北歐五國、愛沙尼亞、拉脫維亞、捷克、比利時、瑞士是 7 月。滑過國家看第二旺與最淡的月份。拉時間軸看 2020、2021 年疫情怎麼打亂季節。台灣是交通部觀光署的來臺旅客人次（入境旅客，不含國內旅遊，口徑跟歐洲不同），2024、2025 年都是 12 月最旺。',
        en: 'The month with the most nights at tourist accommodation (Eurostat, 38 European countries). 27 countries peak in August; the five Nordic countries, Estonia, Latvia, Czechia, Belgium and Switzerland peak in July. Hover to see the second-busiest and quietest months. Drag the timeline to see how the pandemic upset the seasons in 2020 and 2021. Taiwan uses Tourism Administration visitor arrivals (inbound only, no domestic tourism, so not the same measure as Europe); December was busiest in both 2024 and 2025.',
      },
      unit: '',
      file: 'peak-month.json',
      defaultYear: 2024,
      layer: { kind: 'categorical', categories: MONTHS.map(({ value, label, color }) => ({ value, label, color })) },
      format: monthLabel,
      unranked: true,
    },
    {
      id: 'peak-share',
      label: { zh: '最旺月占全年住宿夜數', en: 'Peak month’s share of nights' },
      description: {
        zh: '最旺的那個月占全年住宿夜數的比例，越高表示旅客越集中在旺季（12 個月平均是 8.3%）。2024 年克羅埃西亞 8 月占 29.0% 最集中，保加利亞、阿爾巴尼亞、希臘、蒙特內哥羅都超過兩成；德國 12.3%、馬爾他 11.7%、科索沃 10.7% 最平均。台灣（來臺旅客人次）2024 年 12 月占 11.5%。',
        en: 'The busiest month’s share of the year’s accommodation nights; higher means visitors are more concentrated in high season (an even spread would be 8.3%). In 2024 Croatia is most seasonal with 29.0% in August, and Bulgaria, Albania, Greece and Montenegro all exceed 20%; Germany 12.3%, Malta 11.7% and Kosovo 10.7% are most even. Taiwan (visitor arrivals) had 11.5% in December 2024.',
      },
      unit: '%',
      file: 'peak-share.json',
      defaultYear: 2024,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [12, 14, 16, 18, 20, 25] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'nights-per-resident',
      label: { zh: '每個居民一年幾個觀光客夜', en: 'Tourist nights per resident' },
      description: {
        zh: '一年旅宿業的住宿夜數除以人口：平均每個居民一年要「分擔」幾個觀光客夜，過度觀光的一種量法。2024 年克羅埃西亞 24.2、冰島 23.7、馬爾他 21.0 最高，希臘 15.2、奧地利 14.4、賽普勒斯 13.2、西班牙 10.5；羅馬尼亞 1.6、北馬其頓 1.2 最低。台灣沒有可比的住宿夜數。',
        en: 'A year’s nights at tourist accommodation divided by population: how many tourist nights each resident “hosts”, one measure of overtourism. In 2024 Croatia 24.2, Iceland 23.7 and Malta 21.0 are highest, followed by Greece 15.2, Austria 14.4, Cyprus 13.2 and Spain 10.5; Romania 1.6 and North Macedonia 1.2 are lowest. No comparable figure for Taiwan.',
      },
      unit: { zh: '夜／人', en: 'nights per resident' },
      file: 'nights-per-resident.json',
      defaultYear: 2024,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 4, 6, 8, 12, 20] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 夜／人`, en: `${fixed(v, 1)} nights per resident` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'nights-per-km2',
      label: { zh: '每平方公里的觀光客夜', en: 'Tourist nights per km²' },
      description: {
        zh: '一年旅宿業的住宿夜數除以陸地面積，看「擠不擠」：2024 年馬爾他每平方公里 35,921 夜遠高於其他國家，荷蘭 4,317、賽普勒斯 1,938、克羅埃西亞 1,673、奧地利、義大利、瑞士約 1,500；冰島地廣人稀，按人算很高、按面積算很低。',
        en: 'A year’s accommodation nights divided by land area, a measure of crowding: in 2024 Malta has 35,921 nights per km², far above everyone else, followed by the Netherlands 4,317, Cyprus 1,938 and Croatia 1,673, with Austria, Italy and Switzerland around 1,500; sparsely populated Iceland ranks high per resident but low per km².',
      },
      unit: { zh: '夜／平方公里', en: 'nights per km²' },
      file: 'nights-per-km2.json',
      defaultYear: 2024,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 250, 500, 1000, 1500, 3000] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 夜／平方公里`, en: `${fixed(v, 0)} nights per km²` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'main-accommodation',
      label: { zh: '旅遊最常住哪裡', en: 'Most common accommodation' },
      description: {
        zh: '居民一夜以上的旅次（國內加出國）最常用的住宿方式（Eurostat 的旅遊調查）。2025 年多數國家是旅館（德國 46.1%、奧地利 55.9%），西班牙、法國、芬蘭、波蘭、葡萄牙、羅馬尼亞、斯洛維尼亞、拉脫維亞是住親友家最多。台灣的調查有問，但開放資料沒有選項代碼的說明。',
        en: 'The accommodation most used on residents’ overnight trips, domestic and abroad (Eurostat tourism survey). In 2025 hotels lead in most countries (Germany 46.1%, Austria 55.9%), while staying with friends or relatives leads in Spain, France, Finland, Poland, Portugal, Romania, Slovenia and Latvia. Taiwan’s survey asks this, but the open data lacks the code labels.',
      },
      unit: '',
      file: 'main-accommodation.json',
      defaultYear: 2025,
      layer: { kind: 'categorical', categories: ACCOMMODATION },
      format: labelOf(ACCOMMODATION),
      unranked: true,
    },
    pctIndicator(
      'hotel-share',
      { zh: '旅次住旅館的比例', en: 'Share of trips staying in hotels' },
      {
        zh: '一夜以上的旅次裡主要住旅館的比例。2025 年奧地利 55.9% 最高，德國 46.1%、瑞典 42.4%、義大利 39.0%；法國 24.4%、葡萄牙 24.9%、西班牙 28.1% 低，親友家與自有度假住宅多。',
        en: 'Share of overnight trips staying mainly in hotels. In 2025 Austria is highest at 55.9%, Germany 46.1%, Sweden 42.4% and Italy 39.0%; France 24.4%, Portugal 24.9% and Spain 28.1% are low, with more stays with friends, relatives or in own holiday homes.',
      },
      [25, 30, 35, 40, 45, 50],
    ),
    pctIndicator(
      'free-accommodation-share',
      { zh: '不用付錢的住宿', en: 'Non-rented accommodation' },
      {
        zh: '一夜以上的旅次裡住自己的度假屋或親友家（不用付住宿費）的比例。2025 年西班牙 55.0%、法國 53.5%、芬蘭 52.2%（夏季小屋）、羅馬尼亞 51.5% 超過一半；荷蘭 24.9%、奧地利 28.6%、德國 29.3% 最低。',
        en: 'Share of overnight trips staying in one’s own holiday home or with friends or relatives (no accommodation paid). In 2025 Spain 55.0%, France 53.5%, Finland 52.2% (summer cottages) and Romania 51.5% exceed half; the Netherlands 24.9%, Austria 28.6% and Germany 29.3% are lowest.',
      },
      [25, 30, 35, 40, 45, 50],
    ),
    pctIndicator(
      'long-trips-domestic',
      { zh: '國內旅遊 4 夜以上的比例', en: 'Domestic trips of 4+ nights' },
      {
        zh: '國內一夜以上的旅次裡，住 4 夜以上的比例。2025 年義大利 56.1% 最高（夏天到海邊住一兩週），波蘭 40.5%、羅馬尼亞 37.7%、法國 36.9%；荷蘭、芬蘭、瑞典、奧地利、盧森堡在 23–28% 之間，多是週末短程。台灣的國內旅遊多是一日遊，沒有算。',
        en: 'Share of domestic overnight trips lasting 4 nights or more. In 2025 Italy is highest at 56.1%, followed by Poland 40.5%, Romania 37.7% and France 36.9%; the Netherlands, Finland, Sweden, Austria and Luxembourg are between 23% and 28%, mostly short weekend trips. Not computed for Taiwan, where domestic travel is mostly day trips.',
      },
      [25, 30, 35, 40, 50],
    ),
    pctIndicator(
      'long-trips-abroad',
      { zh: '出國 4 夜以上的比例', en: 'Trips abroad of 4+ nights' },
      {
        zh: '出國一夜以上的旅次裡，住 4 夜以上的比例。2025 年羅馬尼亞 91.3% 最高，波蘭 79.4%、德國 77.3%；盧森堡 60.0%、奧地利 62.7% 低（鄰國近，短程多）。台灣 2024 年 82.5%（交通部觀光署國人旅遊狀況調查的出國樣本旅次加權）。',
        en: 'Share of overnight trips abroad lasting 4 nights or more. In 2025 Romania is highest at 91.3%, Poland 79.4% and Germany 77.3%; Luxembourg 60.0% and Austria 62.7% are low (neighbours are close, so short trips are common). Taiwan was 82.5% in 2024 (weighted outbound trips in the Tourism Administration’s travel survey).',
      },
      [60, 65, 70, 75, 80, 85],
    ),
    pctIndicator(
      'no-trip',
      { zh: '一年沒有去旅遊的人', en: 'People who did not travel' },
      {
        zh: '一年都沒有一夜以上個人旅遊的人口比例（Eurostat，2013、2015、2019、2022、2025 年）。2025 年羅馬尼亞 71.7%、保加利亞 70.8%、義大利 59.8%、愛沙尼亞 54.4%、葡萄牙 51.9% 超過一半；瑞典 11.6%、芬蘭 16.7%、盧森堡 17.1%、荷蘭 17.3%、德國 19.7% 最低。台灣的調查沒有問沒去旅遊的人。',
        en: 'Share of people who made no personal overnight trip in the year (Eurostat; 2013, 2015, 2019, 2022 and 2025). In 2025 Romania 71.7%, Bulgaria 70.8%, Italy 59.8%, Estonia 54.4% and Portugal 51.9% exceed half; Sweden 11.6%, Finland 16.7%, Luxembourg 17.1%, the Netherlands 17.3% and Germany 19.7% are lowest. Taiwan’s survey does not ask people who did not travel.',
      },
      [15, 20, 30, 40, 50, 60],
    ),
    {
      id: 'no-trip-reason',
      label: { zh: '沒去旅遊最主要的原因', en: 'Main reason for not travelling' },
      description: {
        zh: '沒有去旅遊的人最常說的原因（「其他」不算）。2025 年多數國家是錢不夠（羅馬尼亞、保加利亞、義大利、西班牙、法國…）；德國、捷克、拉脫維亞是健康，瑞典、芬蘭、荷蘭、丹麥、奧地利、葡萄牙是沒興趣，匈牙利是工作或求學沒時間。',
        en: 'The reason most often given by people who did not travel (“other” excluded). In 2025 money is the main reason in most countries (Romania, Bulgaria, Italy, Spain, France and others); health in Germany, Czechia and Latvia; no interest in Sweden, Finland, the Netherlands, Denmark, Austria and Portugal; and lack of time for work or study in Hungary.',
      },
      unit: '',
      file: 'no-trip-reason.json',
      defaultYear: 2025,
      layer: { kind: 'categorical', categories: NO_TRIP_REASONS },
      format: labelOf(NO_TRIP_REASONS),
      unranked: true,
    },
    pctIndicator(
      'air-share-abroad',
      { zh: '出國搭飛機的比例', en: 'Trips abroad by air' },
      {
        zh: '出國一夜以上的旅次裡主要搭飛機的比例。2025 年賽普勒斯 99.3%、馬爾他 91.1%（島國）、愛爾蘭 82.9%、希臘 78.0% 最高；斯洛維尼亞 15.3%、克羅埃西亞 29.3%、斯洛伐克 35.5%、奧地利 37.1% 低，開車就能出國。台灣 2024 年 95.8%（國人旅遊狀況調查的出國樣本旅次加權）。',
        en: 'Share of overnight trips abroad made mainly by air. In 2025 Cyprus 99.3%, Malta 91.1% (islands), Ireland 82.9% and Greece 78.0% are highest; Slovenia 15.3%, Croatia 29.3%, Slovakia 35.5% and Austria 37.1% are low, as neighbours are a drive away. Taiwan was 95.8% in 2024 (weighted outbound trips in the travel survey).',
      },
      [30, 40, 50, 60, 75, 90],
    ),
    pctIndicator(
      'package-share-abroad',
      { zh: '出國跟團的比例', en: 'Package trips abroad' },
      {
        zh: '出國一夜以上的旅次裡買包套行程（交通加住宿一起訂）的比例，2020 年起。2025 年羅馬尼亞 40.1% 最高，瑞典 25.9%、法國 24.8%、丹麥 21.1%；盧森堡 7.6% 最低。台灣的調查有問，但開放資料沒有選項代碼的說明。',
        en: 'Share of overnight trips abroad booked as package trips (transport and accommodation together), from 2020. In 2025 Romania is highest at 40.1%, Sweden 25.9%, France 24.8% and Denmark 21.1%; Luxembourg is lowest at 7.6%. Taiwan’s survey asks this, but the open data lacks the code labels.',
      },
      [10, 15, 20, 25, 30, 40],
    ),
    pctIndicator(
      'web-booked-abroad',
      { zh: '出國行程在網路上訂的比例', en: 'Trips abroad booked online' },
      {
        zh: '出國一夜以上的旅次裡在網路上訂主要服務的比例（Eurostat 的定義，2020 年起，很多國家沒有回報）。2025 年丹麥 17.7%、法國 15.8%、羅馬尼亞 15.6%、荷蘭 10.5%。',
        en: 'Share of overnight trips abroad with main services booked online (Eurostat definition, from 2020; many countries do not report). In 2025 Denmark 17.7%, France 15.8%, Romania 15.6% and the Netherlands 10.5%.',
      },
      [5, 10, 15, 20, 25],
    ),
    {
      id: 'trips-per-resident',
      label: { zh: '每人一年旅遊幾趟', en: 'Trips per resident' },
      description: {
        zh: '居民一年一夜以上的旅次（國內加出國）除以人口。2025 年瑞典 9.9 趟最多，芬蘭 5.2、盧森堡、愛爾蘭 4.9；德國 3.3、法國 3.5、西班牙 3.0；義大利、希臘、保加利亞只有 0.8 趟。台灣的國內旅遊含一日遊，不能比。',
        en: 'Residents’ overnight trips (domestic and abroad) in a year divided by population. In 2025 Sweden leads with 9.9, Finland 5.2, Luxembourg and Ireland 4.9; Germany 3.3, France 3.5 and Spain 3.0; Italy, Greece and Bulgaria only 0.8. Taiwan’s domestic trips include day trips, so they are not comparable.',
      },
      unit: { zh: '趟／人', en: 'trips per resident' },
      file: 'trips-per-resident.json',
      defaultYear: 2025,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 3, 4, 6] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 趟／人`, en: `${fixed(v, 1)} trips per resident` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'trips-abroad-per-resident',
      label: { zh: '每人一年出國幾趟', en: 'Trips abroad per resident' },
      description: {
        zh: '一年的出國旅次除以人口。2025 年盧森堡 4.6 趟最多，瑞典 3.2、愛爾蘭 2.5；德國 1.3、法國 0.5、西班牙 0.4、義大利 0.2、羅馬尼亞 0.1。台灣用觀光署的出國人次（含一日來回）。',
        en: 'Trips abroad in a year divided by population. In 2025 Luxembourg leads with 4.6, Sweden 3.2 and Ireland 2.5; Germany 1.3, France 0.5, Spain 0.4, Italy 0.2 and Romania 0.1. Taiwan uses the Tourism Administration’s departures (including same-day trips).',
      },
      unit: { zh: '趟／人', en: 'trips per resident' },
      file: 'trips-abroad-per-resident.json',
      defaultYear: 2025,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.25, 0.5, 0.75, 1, 1.5, 2.5] } },
      format: (v) => tr({ zh: `${fixed(v, 2)} 趟／人`, en: `${fixed(v, 2)} trips per resident` }),
      formatTick: (v) => `${v}`,
    },
    pctIndicator(
      'participation',
      { zh: '一年至少旅遊一次的人', en: 'People who travelled' },
      {
        zh: '一年至少有一次一夜以上旅遊的人口比例。2025 年瑞典 88.4%、芬蘭 83.3%、盧森堡 82.9%、荷蘭 82.7% 最高；義大利 40.2%、保加利亞 29.2%、羅馬尼亞 28.3% 最低。台灣的「國人國內旅遊比率」含一日遊，不能比。',
        en: 'Share of people who made at least one overnight trip in the year. In 2025 Sweden 88.4%, Finland 83.3%, Luxembourg 82.9% and the Netherlands 82.7% are highest; Italy 40.2%, Bulgaria 29.2% and Romania 28.3% lowest. Taiwan’s travel rate includes day trips, so it is not comparable.',
      },
      [40, 50, 60, 70, 80],
    ),
    {
      id: 'nights-per-trip-abroad',
      label: { zh: '出國每趟住幾夜', en: 'Nights per trip abroad' },
      description: {
        zh: '出國旅次的平均夜數。2025 年瑞典 9.2、荷蘭 8.8、芬蘭 8.7、德國 8.5 夜最長；克羅埃西亞 4.8、匈牙利、斯洛維尼亞 5.0 夜最短。台灣 2023 年 7.84 夜（2019 年 7.87 夜，觀光署「國人出國旅遊重要指標」，是全部出國人次的平均）。',
        en: 'Average nights per trip abroad. In 2025 Sweden 9.2, the Netherlands 8.8, Finland 8.7 and Germany 8.5 nights are longest; Croatia 4.8, Hungary and Slovenia 5.0 shortest. Taiwan was 7.84 nights in 2023 (7.87 in 2019; Tourism Administration key indicators, averaged over all departures).',
      },
      unit: { zh: '夜', en: 'nights' },
      file: 'nights-per-trip-abroad.json',
      defaultYear: 2025,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 6, 7, 8, 9] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 夜`, en: `${fixed(v, 1)} nights` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'spend-per-trip-abroad',
      label: { zh: '出國每趟花多少', en: 'Spending per trip abroad' },
      description: {
        zh: '出國一夜以上的旅次平均每趟花費（歐元，不含耐久財）。2025 年盧森堡 1,340 歐元最多，奧地利、德國、荷蘭、芬蘭、法國約 1,200；匈牙利、立陶宛、斯洛維尼亞約 525 歐元。台灣的出國花費含國際機票、算法不同，沒有放。',
        en: 'Average spending per overnight trip abroad (euros, excluding durables). In 2025 Luxembourg spends most at €1,340, with Austria, Germany, the Netherlands, Finland and France around €1,200; Hungary, Lithuania and Slovenia around €525. Taiwan’s outbound spending is defined differently and is not shown.',
      },
      unit: { zh: '歐元', en: 'EUR' },
      file: 'spend-per-trip-abroad.json',
      defaultYear: 2025,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [600, 800, 1000, 1200] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 歐元`, en: `€${fixed(v, 0)}` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'hospitality-jobs-share',
      label: { zh: '住宿及餐飲業的就業比例', en: 'Employment in accommodation and food services' },
      description: {
        zh: '住宿及餐飲業（ISIC Rev.4 的 I 類）的就業人數占全部就業的比例（ILOSTAT，2000 年起；最近一年太舊的國家用 5 年內的值）。觀光島國最高：巴哈馬 19.2%、聖露西亞 16.2%、塞席爾 13.1%、巴貝多 12.5%；希臘 9.2%、泰國 8.7%、台灣 7.9%、美國 6.1%、日本 5.9%（2023 年）。住宿及餐飲業不等於觀光業：在地人的外食也在裡面，航空與旅行社不在。',
        en: 'Employment in accommodation and food services (ISIC Rev.4 section I) as a share of total employment (ILOSTAT, from 2000; values up to 5 years old fill in recent gaps). Tourist islands lead: the Bahamas 19.2%, Saint Lucia 16.2%, Seychelles 13.1% and Barbados 12.5%; Greece 9.2%, Thailand 8.7%, Taiwan 7.9%, the US 6.1% and Japan 5.9% (2023). This is not the same as tourism: locals eating out are included, while airlines and travel agencies are not.',
      },
      unit: '%',
      file: 'hospitality-jobs-share.json',
      defaultYear: 2025,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 3, 4, 5, 7, 10] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'hospitality-jobs',
      label: { zh: '住宿及餐飲業的就業人數', en: 'Jobs in accommodation and food services' },
      description: {
        zh: '住宿及餐飲業的就業人數（ILOSTAT；台灣 2021 年起用主計總處的人力資源調查）。圓的面積與人數成正比。',
        en: 'Number of people employed in accommodation and food services (ILOSTAT; Taiwan from 2021 uses the DGBAS Manpower Survey). Circle area is proportional to employment.',
      },
      unit: { zh: '人', en: 'people' },
      file: 'hospitality-jobs.json',
      defaultYear: 2025,
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      format: (v) => tr({ zh: `${formatLargeNumber(v * 1000)} 人`, en: `${formatLargeNumber(v * 1000)} people` }),
    },
  ],
};

/**
 * 2026-11-04 主題整併（整4）：國際觀光原本 30 個指標，其中 15 個是居民的旅遊習慣（Eurostat 的觀光需求調查、觀光署的國人旅遊
 * 狀況調查），拆成「旅遊習慣」主題（travel-habits.ts，放休閒的日常休閒）。資料照舊在 tourism/，舊網址的指標由 redirects.ts
 * 的 INDICATOR_MOVES 轉過去；這兩個調查的資料來源跟著搬
 */
const HABIT_INDICATORS = [
  'main-accommodation',
  'hotel-share',
  'free-accommodation-share',
  'long-trips-domestic',
  'long-trips-abroad',
  'no-trip',
  'no-trip-reason',
  'air-share-abroad',
  'package-share-abroad',
  'web-booked-abroad',
  'trips-per-resident',
  'trips-abroad-per-resident',
  'participation',
  'nights-per-trip-abroad',
  'spend-per-trip-abroad',
];
/** 資料來源的第 6、7 個：Eurostat 的居民觀光需求調查、觀光署的國人旅遊狀況調查 */
const HABIT_SOURCES = [6, 7];

export const tourism: TopicDefinition = {
  ...tourismOwn,
  sources: tourismOwn.sources.filter((_, i) => !HABIT_SOURCES.includes(i)),
  indicators: tourismOwn.indicators.filter((i) => !HABIT_INDICATORS.includes(i.id)),
};

/** 旅遊習慣（travel-habits.ts 的 withParts 接上；不匯出成主題，registry 的 topicOf 才不會拿錯） */
export const travelHabitsPart = topicPart(
  {
    ...tourismOwn,
    sources: tourismOwn.sources.filter((_, i) => HABIT_SOURCES.includes(i)),
    note: {
      zh: '旅遊習慣主要是歐盟各國的居民觀光需求調查（Eurostat），台灣用交通部觀光署的國人旅遊狀況調查；各國調查的問法與年份不同，跨國比較時要留意。',
      en: "Travel habits come mainly from the EU's survey of residents' tourism demand (Eurostat); Taiwan uses the Tourism Administration's survey of domestic travel. Survey questions and years differ between countries, so compare with care.",
    },
  },
  { only: HABIT_INDICATORS, name: { zh: '旅遊習慣', en: 'Travel habits' } },
);
