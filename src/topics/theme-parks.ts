import { getLang, tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { parksOverlay } from './attractions';
import { PARK_LIST, PARK_VISITORS } from './attractions-extra';
import { BRAND_INDICATOR, BRAND_LIST, BRAND_OVERLAYS, BRAND_SOURCES } from './park-brands';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 樂園（新主題，2026-11-08，製作手冊第二十七批 630，候選 1371、1387、1383、1381、1382；使用者 2026-11-07 指定從「景點地圖」獨立）：
 * 樂園的點與 TEA 的人次沿用景點地圖的資料（../attractions/，attractions.ts 的 parksOverlay、attractions-extra.ts 的 PARK_VISITORS
 * 與 PARK_LIST）；新加 OSM 的各國座數與密度、Wikidata 的開園年份、台灣的票價與月別人次（pipeline/topics/theme_parks.py，
 * 側欄 panels/ThemeParksPanel.tsx）。
 */
const OPENED: PointsOverlayDef = {
  kind: 'points',
  id: 'theme-parks-opened',
  file: 'opened.json',
  label: { zh: '有開園年份的樂園（依年份出現）', en: 'Parks with an opening year (appearing by year)' },
  indicators: ['first-park'],
  radius: 2.6,
  color: MAP_TOKENS.categorical[5],
  timeField: 'year',
  tooltip: (p, ctx) => {
    const zh = typeof p.zh === 'string' && p.zh ? p.zh : null;
    const en = typeof p.en === 'string' && p.en ? p.en : null;
    const title = (getLang() === 'zh' ? zh ?? en : en ?? zh) ?? '';
    return {
      title,
      detail: [typeof p.year === 'number' ? tr({ zh: `${p.year} 年開園`, en: `opened ${p.year}` }) : null, typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null]
        .filter(Boolean)
        .join(' · '),
      properNoun: getLang() === 'zh' && zh && en && en !== zh ? en : undefined,
    };
  },
};
const empty = { zh: '這個指標只有點，國家不上色', en: 'This indicator shows points only' };

/** 樂園的面積與園內的雲霄飛車（第二十七批 634，OSM 畫成面的 tourism=theme_park，1 公頃以上） */
const C = MAP_TOKENS.categorical;
const parkName = (p: PointRecord) => {
  const zh = typeof p.zh === 'string' && p.zh ? p.zh : null;
  const name = typeof p.name === 'string' && p.name ? p.name : null;
  return (getLang() === 'zh' ? zh ?? name : name ?? zh) ?? tr({ zh: '（沒有名稱）', en: '(unnamed)' });
};
const areaText = (ha: unknown) =>
  typeof ha === 'number' ? tr({ zh: `${fixed(ha, ha < 10 ? 1 : 0)} 公頃`, en: `${fixed(ha, ha < 10 ? 1 : 0)} ha` }) : '';
const coasterText = (n: unknown) =>
  typeof n === 'number' && n > 0 ? tr({ zh: `園內 ${n} 座雲霄飛車`, en: n === 1 ? '1 roller coaster' : `${n} roller coasters` }) : tr({ zh: '園內沒有標雲霄飛車', en: 'no roller coaster mapped' });
const AREA: PointsOverlayDef = {
  kind: 'points',
  id: 'park-area',
  file: 'park-area.json',
  label: { zh: 'OSM 畫成面的樂園', en: 'Parks mapped as areas in OSM' },
  indicators: ['park-size'],
  radius: { field: 'ha', stops: [[1, 1.8], [10, 2.8], [50, 4.5], [200, 7], [1000, 10]] },
  color: {
    field: 'rc',
    title: { zh: '園內的雲霄飛車', en: 'Roller coasters inside' },
    thresholds: [0.5, 1.5, 4.5, 9.5],
    classes: [
      { color: MAP_TOKENS.categoricalOther, label: { zh: '沒有', en: 'None' } },
      { color: C[0], label: { zh: '1 座', en: '1' } },
      { color: C[1], label: { zh: '2–4 座', en: '2–4' } },
      { color: C[2], label: { zh: '5–9 座', en: '5–9' } },
      { color: C[3], label: { zh: '10 座以上', en: '10 or more' } },
    ],
  },
  sortField: 'rc',
  tooltip: (p, ctx) => ({
    title: parkName(p),
    detail: [areaText(p.ha), coasterText(p.rc), typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null].filter(Boolean).join(' · '),
  }),
};
/** 左邊的清單：這一國的樂園，依園內雲霄飛車多寡、再依面積（沒選國家時只列有雲霄飛車的） */
const AREA_LIST: ListPanelDef = {
  label: { zh: '樂園的大小', en: 'Park sizes' },
  tabLabel: { zh: '大小', en: 'Size' },
  indicators: ['park-size'],
  file: 'park-area.json',
  countryField: 'iso3',
  empty: { zh: '這裡沒有 OSM 畫成面的樂園', en: 'No parks mapped as areas here' },
  rows: (points, { countryName }) => {
    const n = (v: unknown) => (typeof v === 'number' ? v : 0);
    const list = points.length > 800 ? points.filter((p) => n(p.rc) > 0) : points;
    return [...list]
      .sort((a, b) => n(b.rc) - n(a.rc) || n(b.ha) - n(a.ha))
      .map((p, i): ListRow => ({
        key: `${p.osm}-${i}`,
        title: parkName(p),
        lines: [[areaText(p.ha), coasterText(p.rc)].join(' · '), typeof p.iso3 === 'string' ? countryName(p.iso3) : ''],
        target: { lon: p.lon as number, lat: p.lat as number, zoom: 14 },
        link: typeof p.osm === 'string' ? { href: `https://www.openstreetmap.org/${p.osm[0] === 'w' ? 'way' : 'relation'}/${p.osm.slice(1)}`, label: 'OpenStreetMap' } : undefined,
      }));
  },
};

/** 已關閉的樂園（第二十七批 634，英文維基「List of defunct amusement parks」） */
const DEFUNCT: PointsOverlayDef = {
  kind: 'points',
  id: 'defunct-parks',
  file: 'defunct.json',
  label: { zh: '已關閉的樂園', en: 'Defunct parks' },
  indicators: ['defunct'],
  radius: 3.5,
  color: {
    field: 'c',
    title: { zh: '關園的年代', en: 'Closed' },
    thresholds: [1, 1950, 1990, 2010],
    classes: [
      { color: MAP_TOKENS.categoricalOther, label: { zh: '年份不詳', en: 'Year unknown' } },
      { color: C[4], label: { zh: '1950 年以前', en: 'Before 1950' } },
      { color: C[5], label: { zh: '1950–1989', en: '1950–1989' } },
      { color: C[6], label: { zh: '1990–2009', en: '1990–2009' } },
      { color: C[7], label: { zh: '2010 年以後', en: '2010 or later' } },
    ],
  },
  tooltip: (p, ctx) => {
    const o = typeof p.o === 'number' ? p.o : null;
    const c = typeof p.c === 'number' && p.c > 0 ? p.c : null;
    const years = o || c ? `${o ?? '?'}–${c ?? '?'}` : null;
    return {
      title: parkName(p),
      detail: [
        years ? tr({ zh: `${years} 年`, en: years }) : null,
        p.ct === 1 ? tr({ zh: '位置是城市', en: 'city location' }) : null,
        typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      properNoun: getLang() === 'zh' && typeof p.zh === 'string' && p.zh ? String(p.name) : undefined,
    };
  },
};

/** 單一樂園 2024 年人次 ÷ 2019 年（第二十七批 631）：發散色，100% 附近是中間的淡色 */
const D = MAP_TOKENS.diverging;
const RECOVERY: PointsOverlayDef = {
  kind: 'points',
  id: 'park-recovery',
  file: 'park-recovery.json',
  label: { zh: '樂園人次恢復到 2019 年的多少', en: 'Park attendance recovery against 2019' },
  indicators: ['recovery'],
  radius: { field: 'v2024', stops: [[1e5, 2.5], [1e6, 4], [5e6, 6.5], [18e6, 10]] },
  color: {
    field: 'r',
    title: { zh: '2024 年 ÷ 2019 年', en: '2024 vs 2019' },
    thresholds: [80, 95, 105, 120],
    classes: [
      { color: D[0], label: { zh: '不到 80%', en: 'Under 80%' } },
      { color: D[1], label: { zh: '80–95%', en: '80–95%' } },
      { color: D[3], label: { zh: '95–105%（差不多）', en: '95–105% (about the same)' } },
      { color: D[5], label: { zh: '105–120%', en: '105–120%' } },
      { color: D[6], label: { zh: '120% 以上', en: '120% or more' } },
    ],
  },
  sortField: 'v2024',
  tooltip: (p, ctx) => {
    const zh = typeof p.zh === 'string' && p.zh ? p.zh : null;
    const en = typeof p.en === 'string' && p.en ? p.en : null;
    const title = (getLang() === 'zh' ? zh ?? en : en ?? zh) ?? '';
    const n = (v: unknown) => (typeof v === 'number' ? fixed(v, 0) : '');
    return {
      title: `${title} · ${typeof p.r === 'number' ? `${fixed(p.r, 0)}%` : ''}`,
      detail: [
        tr({ zh: `2019 年 ${n(p.v2019)}、2024 年 ${n(p.v2024)} 人次`, en: `${n(p.v2019)} in 2019, ${n(p.v2024)} in 2024` }),
        typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      properNoun: getLang() === 'zh' && zh && en && en !== zh ? en : undefined,
      extra: p.src === 2 ? [tr({ zh: '觀光署的數字', en: 'Tourism Administration figure' })] : [],
    };
  },
};

export const themeParks: TopicDefinition = {
  id: 'theme-parks',
  title: { zh: '樂園：主題樂園與遊樂園', en: 'Theme and amusement parks' },
  shortTitle: { zh: '樂園', en: 'Theme parks' },
  defaultIndicator: 'parks',
  defaultYear: 2024,
  sources: [
    { name: { zh: 'Wikidata（樂園的位置、類別與開園年份）', en: 'Wikidata (park locations, types and opening years)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    { name: { zh: 'OpenStreetMap（tourism=theme_park，經 QLever 查詢）', en: 'OpenStreetMap (tourism=theme_park, via QLever)' }, url: 'https://www.openstreetmap.org/copyright', license: 'ODbL 1.0' },
    { name: { zh: '英文維基百科「List of amusement park rankings」（TEA／AECOM 的人次）', en: 'English Wikipedia, “List of amusement park rankings” (TEA/AECOM attendance)' }, url: 'https://en.wikipedia.org/wiki/List_of_amusement_park_rankings', license: 'CC BY-SA 4.0' },
    {
      name: { zh: '交通部觀光署：民營遊樂園基本資料（data.gov.tw 38257）、主要觀光遊憩據點遊客人數月別統計（data.gov.tw 8116）', en: 'Tourism Administration (Taiwan): private amusement parks (data.gov.tw 38257) and monthly visitors to major attractions (data.gov.tw 8116)' },
      url: 'https://data.gov.tw/dataset/38257',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, Taiwan, v1' },
    },
    ...BRAND_SOURCES,
    {
      name: { zh: '英文維基百科「List of defunct amusement parks」（已關閉的樂園）', en: 'English Wikipedia, “List of defunct amusement parks”' },
      url: 'https://en.wikipedia.org/wiki/List_of_defunct_amusement_parks?oldid=1374461581',
      license: 'CC BY-SA 4.0',
    },
  ],
  note: {
    zh: '樂園的點是 Wikidata 的主題樂園、遊樂園與雲霄飛車（景點地圖的同一份），各國收錄程度差很多，只畫點、不算各國數量。各國的座數改用 OpenStreetMap 的 tourism=theme_park：OSM 標得很寬（伊朗、俄羅斯多半是城市裡的小遊樂場），也在量 OSM 畫得多完整，所以不能當「主題樂園排名」，每百萬人只替 OSM 覆蓋良好的國家上色。開園年份是 Wikidata 的創立時間（P571），只有約三成的樂園有，有時是公司成立年。人次是 TEA／AECOM 的估計（英文維基轉載），台灣是觀光署的數字。台灣的票價是觀光署資料裡的最後一次更新（多半是 2018 年），不是現價。',
    en: 'Park dots are Wikidata theme parks, amusement parks and roller coasters (the same data as Attractions); Wikidata coverage varies widely by country, so parks are drawn but not counted there. Country counts use OpenStreetMap’s tourism=theme_park, which is applied loosely (most in Iran and Russia are small urban fairgrounds) and also measures how completely OSM is mapped, so it is not a ranking of theme parks; parks per million people are shown only for countries well covered by OSM. Opening years are Wikidata inception dates (P571), available for only about 30% of parks and sometimes the company’s founding year. Attendance is TEA/AECOM estimates as reproduced on English Wikipedia, and Tourism Administration figures for Taiwan. Taiwan ticket prices are the last update in the Tourism Administration data (mostly 2018), not current prices.',
  },
  panelExtra: () => import('./panels/ThemeParksPanel'),
  overlays: [parksOverlay(['parks']), { ...PARK_VISITORS }, OPENED, RECOVERY, ...BRAND_OVERLAYS, AREA, DEFUNCT],
  listPanel: [PARK_LIST, BRAND_LIST, AREA_LIST],
  indicators: [
    {
      id: 'parks',
      label: { zh: '世界的主題樂園與遊樂園', en: 'Theme and amusement parks of the world' },
      description: {
        zh: 'Wikidata 上有座標、沒有關閉的主題樂園與遊樂園（橙色）與雲霄飛車（黃色），每一處一個點；縮小時只畫有名的（有幾種語言的維基百科有條目），放大才畫全部。各國數量看「OpenStreetMap 上的樂園」，人次看「最多人造訪的主題樂園」。',
        en: 'Theme and amusement parks (orange) and roller coasters (yellow) in Wikidata with coordinates and not closed, one dot each; zoomed out, only well-known ones (with Wikipedia articles in several languages) are drawn. See “Parks on OpenStreetMap” for counts by country and “Most-visited theme parks” for attendance.',
      },
      unit: '',
      file: '../attractions/attractions.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      timeless: true,
      missing: empty,
    },
    {
      id: 'visitors',
      label: { zh: '最多人造訪的主題樂園', en: 'Most-visited theme parks' },
      description: {
        zh: '英文維基轉載 TEA／AECOM 的全世界前 25 與各區前 20 主題樂園（2009–2024 年，拖時間軸看 2020 年疫情的斷崖），點的大小是一年的人次：2024 年魔法王國 1,784 萬人次第一，加州迪士尼樂園 1,734 萬、日本環球影城 1,600 萬。台灣的樂園沒有進亞太前 20，綠色的點是觀光署的人次（2024 年麗寶樂園渡假村 563 萬、義大世界 479 萬含購物中心與飯店，跟 TEA 的估計不能直接比）。左邊的清單依人次排。',
        en: 'TEA/AECOM’s worldwide top 25 and regional top 20 theme parks as reproduced on English Wikipedia (2009–2024; drag the time slider to see the 2020 pandemic drop), sized by visitors a year: Magic Kingdom led 2024 with 17.84 million, ahead of Disneyland (17.34 million) and Universal Studios Japan (16.0 million). No Taiwanese park makes the Asia-Pacific top 20; green dots show Tourism Administration counts (in 2024 Lihpao Land 5.63 million and E-DA World 4.79 million, both including malls and hotels and not directly comparable with TEA). The list on the left ranks parks by visitors.',
      },
      unit: '',
      file: '../attractions/visitors.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      defaultYear: 2024,
      missing: empty,
    },
    {
      id: 'osm-count',
      label: { zh: 'OpenStreetMap 上的樂園', en: 'Parks on OpenStreetMap' },
      description: {
        zh: 'OpenStreetMap 標成 tourism=theme_park 的地方有幾處（158 國、11,158 處）：中國 1,609、俄羅斯 1,022、美國 880、伊朗 593、法國 521、德國 500、日本 403、波蘭 386、巴西 310、南韓 302、義大利 298；台灣 95。OSM 的這個標籤用得很寬，伊朗、俄羅斯多半是城市裡的小型遊樂場，不是主題樂園，而且也在量 OSM 畫得多完整，不能當排名。',
        en: 'Places tagged tourism=theme_park on OpenStreetMap (11,158 in 158 countries): China 1,609, Russia 1,022, the US 880, Iran 593, France 521, Germany 500, Japan 403, Poland 386, Brazil 310, South Korea 302 and Italy 298; Taiwan 95. The tag is used loosely (most in Iran and Russia are small urban fairgrounds, not theme parks) and also reflects how completely OSM is mapped, so this is not a ranking.',
      },
      unit: { zh: '處', en: 'places' },
      file: 'osm-count.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 處`, en: `${fixed(v, 0)} places` }),
      formatTick: formatLargeTick,
      integer: true,
      timeless: true,
      shareOfWorld: true,
      missing: { zh: 'OSM 上沒有', en: 'None on OSM' },
    },
    {
      id: 'osm-per-million',
      label: { zh: '每百萬人有幾處樂園（OSM）', en: 'Parks per million people (OSM)' },
      description: {
        zh: 'OpenStreetMap 的 tourism=theme_park 每百萬人幾處，只替 OSM 覆蓋良好的 93 國上色（用餐飲店對照住宿餐飲業的就業人數判斷，同其他 OSM 密度圖）。奧地利 11.5、丹麥 10.9、愛沙尼亞 10.3、波蘭 10.0、拉脫維亞 9.6、捷克 9.4、法國 7.8；德國 5.9、南韓 5.8、荷蘭 4.1、台灣 4.1、日本 3.3、英國 2.8、美國 2.6。數字跟各國怎麼標「樂園」有關，只看大概。',
        en: 'OpenStreetMap tourism=theme_park places per million people, shown only for the 93 countries OSM covers well (judged by food outlets against hospitality employment, as in other OSM density maps). Austria 11.5, Denmark 10.9, Estonia 10.3, Poland 10.0, Latvia 9.6, Czechia 9.4 and France 7.8; Germany 5.9, South Korea 5.8, the Netherlands 4.1, Taiwan 4.1, Japan 3.3, the UK 2.8 and the US 2.6. The figures depend on how each country tags parks, so treat them as rough.',
      },
      unit: { zh: '處/百萬人', en: 'per million' },
      file: 'osm-per-million.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 3, 5, 7, 9] } },
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, 1)} 處`, en: `${fixed(v, 1)} per million` }),
      formatTick: (v) => fixed(v, 0),
      timeless: true,
      missing: { zh: 'OSM 在這裡畫得不完整，不畫', en: 'OSM coverage incomplete here, not shown' },
    },
    {
      id: 'first-park',
      label: { zh: '最早的樂園是哪一年開的', en: 'Year the first park opened' },
      description: {
        zh: '這一國有開園年份的樂園裡最早的一座（Wikidata 的創立時間，630 座、67 國，只有約三成的樂園有年份）；拉時間軸看樂園一座一座出現（1850 年以前的 6 座在 1850 年就畫）。丹麥的 Dyrehavsbakken 1583 年最早，哥本哈根的蒂沃利 1843 年；美國 1870 年（雪松點）、日本 1910 年（枚方公園）、南韓 1965 年、台灣 1967 年（古奇峰育樂園）。1980 年代開的最多（111 座）。年份有時是公司成立年，沒有逐一核對。',
        en: 'The earliest park with an opening year in each country (Wikidata inception dates: 630 parks in 67 countries, only about 30% of parks have one); move the time slider to watch parks appear (the 6 opened before 1850 are drawn from 1850). Dyrehavsbakken in Denmark is the oldest (1583), then Tivoli in Copenhagen (1843); the US from 1870 (Cedar Point), Japan 1910 (Hirakata Park), South Korea 1965 and Taiwan 1967 (Guqifeng). Most opened in the 1980s (111). The year is sometimes the company’s founding year and has not been checked one by one.',
      },
      unit: { zh: '年', en: '' },
      file: 'first-park.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1900, 1950, 1970, 1990, 2010] } },
      format: (v) => tr({ zh: `${v} 年`, en: String(v) }),
      formatTick: (v) => String(v),
      unranked: true,
      lowerIsBetter: true,
      rankingBars: false,
      overlayTime: 'cumulative',
      defaultYear: 2026,
      missing: { zh: 'Wikidata 沒有有開園年份的樂園', en: 'No park with an opening year in Wikidata' },
    },
    // 2026-11-08（製作手冊第二十七批 631）集團的人次、單一樂園的恢復率
    {
      id: 'groups',
      label: { zh: '樂園集團的人次（依總部國家）', en: 'Theme park groups’ attendance (by headquarters)' },
      description: {
        zh: '前 10 大樂園集團的年人次，依總部所在的國家加總（百萬人次；TEA／AECOM 的數字經英文維基轉載，2009–2019 與 2022–2024 年）；點國家看這國的集團。2024 年迪士尼 1.452 億人次、華強方特 8,717 萬（2012 年只有 919 萬）、默林 6,280 萬、環球 5,898 萬、Six Flags 5,030 萬、華僑城 4,110 萬、長隆 3,937 萬、United Parks 2,295 萬、海昌 2,259 萬、Parques Reunidos 1,940 萬。名單每年不同：Six Flags Entertainment 是 2024 年 Cedar Fair 與舊 Six Flags 合併成的，表上只有 2023、2024 年；集團人次含水上樂園與其他設施。',
        en: 'Annual attendance of the top 10 theme park groups, summed by headquarters country (millions; TEA/AECOM figures as reproduced on English Wikipedia, 2009–2019 and 2022–2024); select a country for its groups. In 2024 Disney had 145.2 million visitors, Fantawild 87.2 million (only 9.2 million in 2012), Merlin 62.8 million, Universal 59.0 million, Six Flags 50.3 million, OCT 41.1 million, Chimelong 39.4 million, United Parks 22.9 million, Haichang 22.6 million and Parques Reunidos 19.4 million. The list changes from year to year: Six Flags Entertainment was formed by the 2024 merger of Cedar Fair and the old Six Flags and appears only for 2023 and 2024; group totals include water parks and other attractions.',
      },
      unit: { zh: '百萬人次', en: 'million visitors' },
      file: 'group-visitors.json',
      layer: { kind: 'bubble', legendValues: [20, 100, 250] },
      format: (v) => tr({ zh: `${fixed(v, 1)} 百萬人次`, en: `${fixed(v, 1)} million` }),
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2024,
      missing: { zh: '沒有總部在這裡的前 10 大集團', en: 'No top-10 group headquartered here' },
    },
    {
      id: 'recovery',
      label: { zh: '樂園人次恢復到疫情前多少', en: 'Theme park attendance recovery since the pandemic' },
      description: {
        zh: '單一樂園 2024 年的人次 ÷ 2019 年（TEA 排行榜上兩年都有的 58 座，含台灣觀光署的 5 座）；顏色是恢復率、大小是 2024 年人次。中位數 95%，低於 100% 的 33 座：香港迪士尼 139%、上海迪士尼 131%、法國 Parc Astérix 122% 最高；迪士尼動物王國 63%、阿根廷 Parque de la Costa 66% 最低。台灣：麗寶 110%、劍湖山 85%、小人國 84%、六福村 82%、九族 71%。集團層級：華強方特 173%、環球 115%、長隆 106%、United Parks 101%、默林 94%、迪士尼 93%、Parques Reunidos 87%、華僑城 76%。恢復率混著新開園與擴建，不等於觀光的復甦。',
        en: 'Each park’s 2024 attendance divided by 2019 (the 58 parks with both years in the TEA rankings, including 5 in Taiwan from the Tourism Administration); colour shows recovery and size 2024 attendance. The median is 95%, with 33 below 100%: Hong Kong Disneyland (139%), Shanghai Disneyland (131%) and Parc Astérix in France (122%) are highest, and Disney’s Animal Kingdom (63%) and Parque de la Costa in Argentina (66%) lowest. Taiwan: Lihpao 110%, Janfusun 85%, Window on China 84%, Leofoo 82% and Formosan Aboriginal Culture Village 71%. For groups: Fantawild 173%, Universal 115%, Chimelong 106%, United Parks 101%, Merlin 94%, Disney 93%, Parques Reunidos 87% and OCT 76%. Recovery mixes in new openings and expansions, so it is not the same as a tourism recovery.',
      },
      unit: '',
      file: '../attractions/visitors.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      timeless: true,
      missing: empty,
    },
    // 2026-11-08（製作手冊第二十七批 632）樂園品牌的據點
    BRAND_INDICATOR,
    // 2026-11-08（製作手冊第二十七批 634）樂園的面積與園內雲霄飛車、已關閉的樂園
    {
      id: 'park-size',
      label: { zh: '樂園有多大、園內有幾座雲霄飛車', en: 'Park size and roller coasters inside' },
      description: {
        zh: 'OpenStreetMap 上畫成面的樂園（tourism=theme_park，1 公頃以上，137 國 5,143 座）：點的大小是面積，顏色是園內有名稱的雲霄飛車有幾座（落在樂園的面裡的 attraction=roller_coaster，依名稱算）。有雲霄飛車的 447 座、共 1,445 座；最多的是德國 Europa-Park 27 座、波蘭 Energylandia 22 座、美國 Cedar Point 19 座。台灣：六福村 42.4 公頃 4 座，劍湖山 43.1 公頃、遠雄海洋公園 13.7 公頃、臺北兒童新樂園 3.8 公頃各 1 座。OSM 的邊界畫法不一致（迪士尼世界 7,420 公頃是整個度假區，有的只畫核心區），面積不能拿來排名；同一座雲霄飛車的不同部分取了不同名稱時會多算。左邊的清單列這一國的樂園。',
        en: 'Parks mapped as areas in OpenStreetMap (tourism=theme_park, 1 hectare or more; 5,143 in 137 countries): dot size shows area and colour the number of named roller coasters inside (attraction=roller_coaster features within the park area, counted by name). 447 parks have roller coasters, 1,445 in all; Europa-Park in Germany has the most (27), followed by Energylandia in Poland (22) and Cedar Point in the US (19). Taiwan: Leofoo Village (42.4 ha) has 4, and Janfusun Fancyworld (43.1 ha), Farglory Ocean Park (13.7 ha) and Taipei Children’s Amusement Park (3.8 ha) 1 each. OSM boundaries are drawn inconsistently (Walt Disney World’s 7,420 ha is the whole resort, while some parks only include the core), so areas cannot be ranked; a coaster whose parts carry different names is counted more than once. The list on the left shows a country’s parks.',
      },
      unit: '',
      file: '../attractions/visitors.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      timeless: true,
      missing: empty,
    },
    {
      id: 'defunct',
      label: { zh: '已關閉的樂園', en: 'Defunct amusement parks' },
      description: {
        zh: '英文維基「List of defunct amusement parks」列的已關閉、拆除或廢棄的樂園，依國家加總（327 座、53 國；美國另有一份獨立的清單，這裡沒收）。澳洲 63 座最多，日本、英國各 30 座，加拿大 29 座；有關園年份的 252 座裡，2000 年代關了 71 座、2010 年代 51 座、1990 年代 50 座。台灣 6 座，包括 2015 年關閉的八仙樂園（Formosa Fun Coast）。點的顏色是關園的年代，位置是樂園在 Wikidata 的座標，沒有的用城市。清單多寡反映維基編者的關注，不是各國實際關了多少座。',
        en: 'Closed, demolished or abandoned amusement parks listed in the English Wikipedia “List of defunct amusement parks”, counted by country (327 parks in 53 countries; the US has a separate list that is not included). Australia has the most (63), followed by Japan and the UK (30 each) and Canada (29); of the 252 with a closing year, 71 closed in the 2000s, 51 in the 2010s and 50 in the 1990s. Taiwan has 6, including Formosa Fun Coast, closed in 2015. Dot colour shows when the park closed; locations are the park’s Wikidata coordinates, or the city’s when there are none. The list reflects what Wikipedia editors have recorded, not how many parks actually closed in each country.',
      },
      unit: { zh: '座', en: 'parks' },
      file: 'defunct-count.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 50] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 座`, en: v === 1 ? '1 park' : `${fixed(v, 0)} parks` }),
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '清單上沒有這國已關閉的樂園', en: 'No defunct park listed here' },
      noValue: { USA: { zh: '美國另有獨立的清單，這裡沒收', en: 'The US has a separate list, not included here' } },
    },
  ],
};
