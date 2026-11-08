import { getLang, tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, SourceDef } from './types';

/**
 * 景點地圖的擴充（2026-11-07，製作手冊第二十四批 432；pipeline/topics/attractions_visitors.py）：
 * 水上樂園的人次（英文維基轉載 TEA／AECOM）、台灣觀光遊憩據點的人次（觀光署 8116）、OSM 的水上樂園。
 */

const C = MAP_TOKENS.categorical;
const visitorsText = (v: number) => tr({ zh: `${formatLargeNumber(v)} 人次`, en: `${formatLargeNumber(v)} visitors` });
const WATER_YEARS = Array.from({ length: 16 }, (_, i) => 2009 + i);
const TW_YEARS = Array.from({ length: 13 }, (_, i) => 2012 + i);
const clampYear = (years: number[], y: number) => Math.max(years[0], Math.min(years[years.length - 1], y));

function parkName(p: PointRecord): { title: string; proper?: string } {
  const zh = typeof p.zh === 'string' && p.zh ? p.zh : null;
  const en = typeof p.en === 'string' ? p.en : '';
  return getLang() === 'zh' && zh ? { title: zh, proper: en } : { title: en || zh || '' };
}

// ── 水上樂園（2026-11-08 製作手冊第二十七批 636 搬到「水上樂園」主題 water-parks.ts，資料照舊在景點地圖的資料夾） ──
export const WATER_VISITORS: PointsOverlayDef = {
  kind: 'points',
  id: 'water-park-visitors',
  file: 'water-park-visitors.json',
  label: { zh: '最多人造訪的水上樂園（一年人次）', en: 'Most-visited water parks (visitors a year)' },
  indicators: ['visitors'],
  epochs: { years: WATER_YEARS, values: (p, y) => ({ vv: typeof p[`v${y}`] === 'number' ? (p[`v${y}`] as number) : null }) },
  radius: { field: 'vv', stops: [[4e5, 2.5], [1e6, 4], [2e6, 6], [3e6, 7.5]] },
  color: C[1],
  minValue: { field: 'vv', stops: [[0, 0]] },
  sortField: 'vv',
  tooltip: (p, { countryName, year }) => {
    const { title, proper } = parkName(p);
    const y = clampYear(WATER_YEARS, year ?? 2024);
    const v = p[`v${y}`];
    return {
      title,
      detail: [tr({ zh: '水上樂園', en: 'Water park' }), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
      extra: typeof v === 'number' ? [tr({ zh: `${y} 年 ${visitorsText(v)}`, en: `${visitorsText(v)} in ${y}` })] : [],
      properNoun: proper,
    };
  },
};

export const WATER_LIST: ListPanelDef = {
  label: { zh: '最多人造訪的水上樂園', en: 'Most-visited water parks' },
  tabLabel: { zh: '水上樂園', en: 'Water parks' },
  indicators: ['visitors'],
  file: 'water-park-visitors.json',
  countryField: 'iso3',
  rows: (points, { countryName, year }) => {
    const y = clampYear(WATER_YEARS, year);
    return points
      .filter((p) => typeof p[`v${y}`] === 'number')
      .sort((a, b) => Number(b[`v${y}`]) - Number(a[`v${y}`]))
      .map((p, i): ListRow => {
        const { title, proper } = parkName(p);
        return {
          key: `wp-${i}-${p.en}`,
          title: `${i + 1}. ${title}`,
          properNoun: proper,
          lines: [typeof p.iso3 === 'string' ? countryName(p.iso3) : '', tr({ zh: `${y} 年 ${visitorsText(Number(p[`v${y}`]))}`, en: `${visitorsText(Number(p[`v${y}`]))} in ${y}` })].filter(Boolean),
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 14 },
        };
      });
  },
};

// ── 台灣的觀光遊憩據點 ──
/** 據點的類型（pipeline 的 TYPES） */
const SITE_TYPES: { value: number; label: Text; color: string }[] = [
  { value: 0, label: { zh: '類型不詳（2024 年才列入，觀光署的類型欄錯置）', en: 'Type unknown (added in 2024; the type column is misaligned)' }, color: '#9a968c' },
  { value: 1, label: { zh: '國家公園', en: 'National park' }, color: C[3] },
  { value: 2, label: { zh: '國家級風景特定區', en: 'National scenic area' }, color: C[0] },
  { value: 3, label: { zh: '直轄市、縣市級風景特定區', en: 'Municipal or county scenic area' }, color: C[4] },
  { value: 4, label: { zh: '森林遊樂區', en: 'Forest recreation area' }, color: '#2f6b3a' },
  { value: 5, label: { zh: '博物館', en: 'Museum' }, color: C[1] },
  { value: 6, label: { zh: '宗教場所', en: 'Religious site' }, color: C[2] },
  { value: 7, label: { zh: '觀光地區', en: 'Tourist area' }, color: C[5] },
  { value: 8, label: { zh: '休閒農業區、休閒農場', en: 'Leisure farm' }, color: C[7] },
  { value: 9, label: { zh: '其他（老街、夜市、商圈、樂園…）', en: 'Other (old streets, night markets, malls, parks…)' }, color: C[6] },
];
const siteType = (p: PointRecord) => tr(SITE_TYPES.find((t) => t.value === p.k)?.label ?? SITE_TYPES[0].label);
const peak = (m: unknown) =>
  typeof m === 'number' ? tr({ zh: `最多人是 ${m} 月`, en: `busiest month: ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}` }) : null;

const TW_SITES: PointsOverlayDef = {
  kind: 'points',
  id: 'taiwan-sites',
  file: 'taiwan-sites.json',
  label: { zh: '台灣的觀光遊憩據點（一年人次）', en: 'Taiwan’s tourist sites (visitors a year)' },
  indicators: ['taiwan-sites'],
  epochs: { years: TW_YEARS, values: (p, y) => ({ vv: typeof p[`v${y}`] === 'number' ? (p[`v${y}`] as number) : null }) },
  radius: { field: 'vv', stops: [[5e4, 2.5], [1e6, 5], [5e6, 9], [1.5e7, 13]] },
  color: { field: 'k', title: { zh: '類型', en: 'Type' }, thresholds: SITE_TYPES.slice(1).map((t) => t.value), classes: SITE_TYPES },
  minValue: { field: 'vv', stops: [[0, 0]] },
  sortField: 'vv',
  tooltip: (p, { year }) => {
    const y = clampYear(TW_YEARS, year ?? 2024);
    const v = p[`v${y}`];
    return {
      title: String(p.zh ?? ''),
      detail: [siteType(p), String(p.city ?? '')].filter(Boolean).join(' · '),
      extra: [typeof v === 'number' ? tr({ zh: `${y} 年 ${visitorsText(v)}`, en: `${visitorsText(v)} in ${y}` }) : null, peak(p[`p${y}`])].filter((x): x is string => Boolean(x)),
    };
  },
};

const TW_LIST: ListPanelDef = {
  label: { zh: '台灣的觀光遊憩據點', en: 'Taiwan’s tourist sites' },
  indicators: ['taiwan-sites'],
  file: 'taiwan-sites.json',
  rows: (points, { year }) => {
    const y = clampYear(TW_YEARS, year);
    return points
      .filter((p) => typeof p[`v${y}`] === 'number')
      .sort((a, b) => Number(b[`v${y}`]) - Number(a[`v${y}`]))
      .map((p, i): ListRow => ({
        key: `tw-${i}-${p.zh}`,
        title: `${i + 1}. ${String(p.zh ?? '')}`,
        lines: [[siteType(p), String(p.city ?? '')].filter(Boolean).join(' · '), [visitorsText(Number(p[`v${y}`])), peak(p[`p${y}`])].filter(Boolean).join(tr({ zh: '，', en: ', ' }))],
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 13 },
      }));
  },
};

/** OSM 的水上樂園（每十萬人），2026-11-08 搬到「水上樂園」主題 */
export const WATER_PARKS_PER_100K: IndicatorDef = {
      id: 'water-parks',
      label: { zh: '水上樂園（OpenStreetMap）', en: 'Water parks (OpenStreetMap)' },
      description: {
        zh: 'OpenStreetMap 上標成水上樂園的地方，全世界 13,330 處、171 個國家或地區：德國 3,159 處最多，美國 1,511、奧地利 640、巴西 526、法國 470、墨西哥 431；台灣 22 處。每十萬人奧地利 7.0 處最多，阿魯巴 4.6、德國 3.8、匈牙利 2.4、捷克 2.0；台灣 0.095。各國把什麼標成水上樂園不太一樣（室內的滑水道泳池、戶外的大型樂園都有），只能看大概；只替 OSM 覆蓋良好的國家上色。',
        en: 'Places tagged as water parks on OpenStreetMap: 13,330 in 171 countries and territories. Germany has the most at 3,159, followed by the US 1,511, Austria 640, Brazil 526, France 470 and Mexico 431; Taiwan has 22. Per 100,000 people Austria leads with 7.0, then Aruba 4.6, Germany 3.8, Hungary 2.4 and Czechia 2.0; Taiwan 0.095. What gets tagged as a water park varies (from indoor pools with slides to large outdoor parks), so treat comparisons as approximate; only countries where OSM is reasonably complete are shaded.',
      },
      unit: { zh: '處／十萬人', en: 'per 100,000 people' },
      file: 'water-parks.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.25, 0.5, 1, 2, 4] } },
      format: (v) => tr({ zh: `每十萬人 ${fixed(v, v < 1 ? 2 : 1)} 處`, en: `${fixed(v, v < 1 ? 2 : 1)} per 100,000` }),
      formatTick: (v) => fixed(v, v < 1 ? 2 : 0),
      panelChart: false,
    };

export const attractionsVisitors: { sources: SourceDef[]; overlays: PointsOverlayDef[]; indicators: IndicatorDef[]; listPanel: ListPanelDef[] } = {
  sources: [
    {
      name: { zh: '交通部觀光署 景點－觀光資訊資料庫（台灣據點的座標）', en: 'Taiwan Tourism Administration attraction database (site coordinates)' },
      url: 'https://data.gov.tw/dataset/7777',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  overlays: [TW_SITES],
  listPanel: [TW_LIST],
  indicators: [
    {
      id: 'taiwan-sites',
      label: { zh: '台灣觀光遊憩據點的人次', en: 'Visitors to Taiwan’s tourist sites' },
      description: {
        zh: '交通部觀光署統計的國內主要觀光遊憩據點一年的遊客人次（2012–2024，點的大小是人次、顏色是類型），拖時間軸看各年，滑過看最多人的月份。2024 年 368 處：鹿港老街及周邊地區 1,730 萬人次最多，嘉義文化路夜市 1,598 萬、台南安平 1,450 萬、台北 101 1,275 萬、桃園老街溪沿岸步道 1,053 萬、北港朝天宮 987 萬、松山文創園區 981 萬、林口三井 Outlet 977 萬。全部據點合計 2012 年 2.41 億人次、2019 年 3.33 億、2021 年 1.70 億、2024 年 5.49 億；統計的據點從 2012 年 287 處增加到 2024 年 368 處，跨年比較要小心。地圖畫了 2024 年還在統計裡、找得到位置的 325 處，40 處（觀音蓮花園休閒農業區、臺八線沿線景觀區等）沒有畫。觀光署 2024 年的類型欄錯置（名稱重新排序後類型沒有跟著動），所以類型用每個據點之前最後一年的，2024 年才列入的 26 處類型不詳（灰色）。左邊的清單依人次列出。',
        en: 'Annual visitors to Taiwan’s major tourist sites counted by the Tourism Administration (2012–2024; dots sized by visitors and coloured by type). Drag the time slider for each year and hover for the busiest month. In 2024, among 368 sites, Lukang Old Street and surroundings led with 17.3 million visits, followed by Chiayi’s Wenhua Road night market 16.0 million, Anping in Tainan 14.5 million, Taipei 101 12.7 million, Taoyuan’s Laojie River walkway 10.5 million, Beigang Chaotian Temple 9.9 million, Songshan Cultural and Creative Park 9.8 million and Mitsui Outlet Park Linkou 9.8 million. All sites together counted 241 million visits in 2012, 333 million in 2019, 170 million in 2021 and 549 million in 2024, but the number of sites grew from 287 to 368, so compare years with care. The map shows the 325 sites still counted in 2024 that could be located; 40 (such as the Guanyin lotus leisure farm area and the Provincial Highway 8 scenic corridor) are not drawn. The Tourism Administration’s 2024 type column is misaligned (types did not move when names were re-sorted), so each site keeps its type from the last earlier year; the 26 sites first listed in 2024 have no known type (grey). The list on the left ranks them by visitors.',
      },
      unit: '',
      file: 'taiwan-sites-map.json',
      layer: { kind: 'none' },
      shade: 'land',
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      defaultYear: 2024,
      missing: { zh: '國家不上色，看地圖上的點', en: 'Countries are not coloured; see the dots on the map' },
    },
  ],
};

