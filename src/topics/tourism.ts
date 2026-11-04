import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, usd } from '../lib/format';
import type { FlowLabels, TopicDefinition } from './types';
import { COVID } from './events';
import { MONTHS, monthLabel } from './months';

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

export const tourism: TopicDefinition = {
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
        zh: '旅宿業住宿夜數最多的月份（Eurostat，歐洲 38 國）。27 國是 8 月；北歐五國、愛沙尼亞、拉脫維亞、捷克、比利時、瑞士是 7 月。滑過國家看第二旺與最淡的月份。拉時間軸看 2020、2021 年疫情怎麼打亂季節。台灣的月別資料還在整理。',
        en: 'The month with the most nights at tourist accommodation (Eurostat, 38 European countries). 27 countries peak in August; the five Nordic countries, Estonia, Latvia, Czechia, Belgium and Switzerland peak in July. Hover to see the second-busiest and quietest months. Drag the timeline to see how the pandemic upset the seasons in 2020 and 2021. Taiwan’s monthly data has not been added yet.',
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
        zh: '最旺的那個月占全年住宿夜數的比例，越高表示旅客越集中在旺季（12 個月平均是 8.3%）。2024 年克羅埃西亞 8 月占 29.0% 最集中，保加利亞、阿爾巴尼亞、希臘、蒙特內哥羅都超過兩成；德國 12.3%、馬爾他 11.7%、科索沃 10.7% 最平均。',
        en: 'The busiest month’s share of the year’s accommodation nights; higher means visitors are more concentrated in high season (an even spread would be 8.3%). In 2024 Croatia is most seasonal with 29.0% in August, and Bulgaria, Albania, Greece and Montenegro all exceed 20%; Germany 12.3%, Malta 11.7% and Kosovo 10.7% are most even.',
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
  ],
};
