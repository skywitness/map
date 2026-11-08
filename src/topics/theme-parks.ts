import { getLang, tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { parksOverlay } from './attractions';
import { PARK_LIST, PARK_VISITORS } from './attractions-extra';
import type { PointsOverlayDef, TopicDefinition } from './types';

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
  ],
  note: {
    zh: '樂園的點是 Wikidata 的主題樂園、遊樂園與雲霄飛車（景點地圖的同一份），各國收錄程度差很多，只畫點、不算各國數量。各國的座數改用 OpenStreetMap 的 tourism=theme_park：OSM 標得很寬（伊朗、俄羅斯多半是城市裡的小遊樂場），也在量 OSM 畫得多完整，所以不能當「主題樂園排名」，每百萬人只替 OSM 覆蓋良好的國家上色。開園年份是 Wikidata 的創立時間（P571），只有約三成的樂園有，有時是公司成立年。人次是 TEA／AECOM 的估計（英文維基轉載），台灣是觀光署的數字。台灣的票價是觀光署資料裡的最後一次更新（多半是 2018 年），不是現價。',
    en: 'Park dots are Wikidata theme parks, amusement parks and roller coasters (the same data as Attractions); Wikidata coverage varies widely by country, so parks are drawn but not counted there. Country counts use OpenStreetMap’s tourism=theme_park, which is applied loosely (most in Iran and Russia are small urban fairgrounds) and also measures how completely OSM is mapped, so it is not a ranking of theme parks; parks per million people are shown only for countries well covered by OSM. Opening years are Wikidata inception dates (P571), available for only about 30% of parks and sometimes the company’s founding year. Attendance is TEA/AECOM estimates as reproduced on English Wikipedia, and Tourism Administration figures for Taiwan. Taiwan ticket prices are the last update in the Tourism Administration data (mostly 2018), not current prices.',
  },
  panelExtra: () => import('./panels/ThemeParksPanel'),
  overlays: [parksOverlay(['parks']), { ...PARK_VISITORS }, OPENED],
  listPanel: [PARK_LIST],
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
  ],
};
