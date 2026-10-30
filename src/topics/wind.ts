import { tr } from '../i18n/lang';
import { dataUrl, fetchJson } from '../lib/data';
import { fixed } from '../lib/format';
import { classAt, loadClassGrid, type ClassGrid } from '../map/classGridData';
import { decodeWindField, windAt, type WindField, type WindFieldFile } from '../map/windField';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, TopicDefinition } from './types';

/**
 * 風與季風（pipeline/topics/wind.py）：NCEP/NCAR 再分析離地 10 公尺的風，1991–2020 年每個月的長期平均。
 * 時間軸是 1–12 月（年份欄位就是月份）。地圖上是風的粒子（src/map/windLayer.ts，順著 u、v 的月平均移動）
 * 加上風速分級的底色（類別網格，每天風速的月平均）。
 */

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** 「1 月」「January」 */
export function monthName(m: number): string {
  return tr({ zh: `${m} 月`, en: MONTHS_EN[m - 1] ?? String(m) });
}

/** 16 方位（風從哪裡吹來，0 = 北，順時針），pipeline 的 compass() 同一個順序 */
const COMPASS = [
  { zh: '北', en: 'N' },
  { zh: '北北東', en: 'NNE' },
  { zh: '東北', en: 'NE' },
  { zh: '東北東', en: 'ENE' },
  { zh: '東', en: 'E' },
  { zh: '東南東', en: 'ESE' },
  { zh: '東南', en: 'SE' },
  { zh: '南南東', en: 'SSE' },
  { zh: '南', en: 'S' },
  { zh: '南南西', en: 'SSW' },
  { zh: '西南', en: 'SW' },
  { zh: '西南西', en: 'WSW' },
  { zh: '西', en: 'W' },
  { zh: '西北西', en: 'WNW' },
  { zh: '西北', en: 'NW' },
  { zh: '北北西', en: 'NNW' },
];

/** 「東北風」「NE wind」 */
export function windName(dir: number): string {
  const c = COMPASS[((dir % 16) + 16) % 16];
  return tr({ zh: `${c.zh}風`, en: `${c.en} wind` });
}

/** u、v（m/s）→ 風從哪個方位吹來（16 方位） */
export function compassOf(u: number, v: number): number {
  const deg = ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360;
  return Math.round(deg / 22.5) % 16;
}

/** 風速的分級（grid/<月>.png 的代碼，pipeline 的 SPEED_BINS）：越快越深 */
const SEQ = MAP_TOKENS.sequential;
export const SPEED_CLASSES = [
  { value: 1, color: SEQ[0], short: '< 2', label: { zh: '每秒 2 公尺以下', en: 'Under 2 m/s' } },
  { value: 2, color: SEQ[1], short: '2–4', label: { zh: '每秒 2–4 公尺', en: '2–4 m/s' } },
  { value: 3, color: SEQ[2], short: '4–6', label: { zh: '每秒 4–6 公尺', en: '4–6 m/s' } },
  { value: 4, color: SEQ[3], short: '6–8', label: { zh: '每秒 6–8 公尺', en: '6–8 m/s' } },
  { value: 5, color: SEQ[4], short: '8–10', label: { zh: '每秒 8–10 公尺', en: '8–10 m/s' } },
  { value: 6, color: SEQ[5], short: '≥ 10', label: { zh: '每秒 10 公尺以上', en: '10 m/s or more' } },
];

// ── 游標下的風：跟地圖用同一份風場與風速網格（fetchJson、loadClassGrid 同一個網址只讀一次） ──────────
let current: { month: number; field: WindField | null; grid: ClassGrid | null } = { month: 0, field: null, grid: null };

/** 地圖換月份時記下目前的風場與網格（pointer 拿不到時間軸的年份，跟著 overlay 的 file() 走） */
function remember(month: number) {
  if (current.month === month) return;
  current = { month, field: null, grid: null };
  fetchJson<WindFieldFile>(`topics/wind/field/${month}.json`).then(
    (file) => {
      if (current.month === month) current = { ...current, field: decodeWindField(file) };
    },
    () => {},
  );
  loadClassGrid(dataUrl(`topics/wind/grid/${month}.png`)).then(
    (grid) => {
      if (current.month === month) current = { ...current, grid };
    },
    () => {},
  );
}

const MONTH_AXIS = {
  label: { zh: '月份', en: 'Month' },
  year: monthName,
  tick: (m: number) => tr({ zh: `${m} 月`, en: MONTHS_EN[m - 1]?.slice(0, 3) ?? String(m) }),
};

const speedText = (v: number) => tr({ zh: `每秒 ${fixed(v, 1)} 公尺`, en: `${fixed(v, 1)} m/s` });

const indicators: IndicatorDef[] = [
  {
    id: 'map',
    label: { zh: '風向與風速', en: 'Wind map' },
    description: {
      zh: '1991–2020 年那個月的平均：流動的細線是風往哪裡吹（越快走得越快），底色是平均風速。播放 1–12 月看季風換方向：冬天亞洲吹東北季風，夏天吹西南季風；信風、西風帶整年都在。國家不上色，滑過看國土的平均風速，點國家看每個月的風向。',
      en: 'Averages for the month over 1991–2020: the moving streaks show where the wind blows (faster streaks mean stronger wind) and the background shows the average wind speed. Play January to December to watch the monsoons turn: north-easterlies over Asia in winter, south-westerlies in summer, while the trade winds and westerlies blow all year. Countries are not coloured; hover for the average wind speed over a country’s land and click it for each month’s prevailing wind.',
    },
    unit: 'm/s',
    file: 'speed.json',
    layer: { kind: 'none' },
    unranked: true,
    rankingBars: false,
    format: (v) => tr({ zh: `國土平均風速：每秒 ${fixed(v, 1)} 公尺`, en: `Average wind speed over land: ${fixed(v, 1)} m/s` }),
    formatTick: (v) => fixed(v, Number.isInteger(v) ? 0 : 1),
    timeAxis: MONTH_AXIS,
  },
  {
    id: 'speed',
    label: { zh: '國土的平均風速', en: 'Wind speed over land' },
    description: {
      zh: '1991–2020 年那個月，國土上離地 10 公尺的平均風速（每天的風速的平均；再分析的網格約 200 公里，沿海國家會混到海上的風）。',
      en: 'Average wind speed 10 m above the ground over each country’s land in that month, 1991–2020 (the mean of daily wind speeds; the reanalysis grid is about 200 km, so coastal countries pick up some wind from the sea).',
    },
    unit: 'm/s',
    file: 'speed.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 3, 4, 5, 6, 7] } },
    format: speedText,
    formatTick: (v) => fixed(v, Number.isInteger(v) ? 0 : 1),
    timeAxis: MONTH_AXIS,
  },
];

export const wind: TopicDefinition = {
  id: 'wind',
  title: { zh: '風與季風', en: 'Winds and monsoons' },
  shortTitle: { zh: '風與季風', en: 'Winds' },
  defaultIndicator: 'map',
  defaultYear: 1,
  sources: [
    {
      name: {
        zh: 'NOAA PSL：NCEP/NCAR 再分析，離地 10 公尺的風，1991–2020 年每月長期平均',
        en: 'NOAA PSL: NCEP/NCAR Reanalysis, 10 m winds, monthly long-term means 1991–2020',
      },
      url: 'https://psl.noaa.gov/data/gridded/data.ncep.reanalysis.html',
      license: { zh: '使用限制：無', en: 'Usage restrictions: none' },
    },
  ],
  note: {
    zh: 'NCEP Reanalysis data provided by the NOAA PSL, Boulder, Colorado, USA, from their Web site at https://psl.noaa.gov。資料是 NCEP/NCAR 再分析（把觀測放進天氣模式重算的全球網格，約 1.9° × 1.9°，約 200 公里）離地 10 公尺的風，1991–2020 年每個月的長期平均。細線（粒子）順著風的東西、南北分量的月平均移動：風向常變的地方月平均會互相抵消，細線走得慢；底色與國家的值是每天風速的月平均。網格很粗，台灣這樣的島在模式裡大半是海，山、盆地的風（例如臺北盆地的風比海峽小很多）看不出來，實際的風以中央氣象署的測站為準。國家的值是國土所在的 1° 格子依緯度加權的平均，國土太小、沒有格子的用國家中心附近的一點。這份再分析 2026 年 3 月起停止更新，30 年的平均不受影響。',
    en: 'NCEP Reanalysis data provided by the NOAA PSL, Boulder, Colorado, USA, from their Web site at https://psl.noaa.gov. The data are 10 m winds from the NCEP/NCAR Reanalysis (observations assimilated into a weather model on a global grid of about 1.9° × 1.9°, roughly 200 km), as monthly long-term means for 1991–2020. The streaks (particles) follow the monthly mean east–west and north–south wind components, so where the wind direction varies a lot the means cancel and the streaks move slowly; the background and country values are monthly means of daily wind speed. The grid is coarse: an island like Taiwan is mostly sea in the model, and local winds in mountains and basins are not resolved, so use weather-station records for actual local winds. Country values are latitude-weighted means of the 1° cells over a country’s land; countries too small for a cell use one point near their centre. The reanalysis stopped updating in March 2026, which does not affect the 30-year means.',
  },
  panelExtra: () => import('./panels/WindPanel'),
  pointer: ([lon, lat]) => {
    const { field, grid } = current;
    if (!field) return null;
    const [u, v] = windAt(field, lon, lat);
    const cls = grid ? SPEED_CLASSES.find((c) => c.value === classAt(grid, lon, lat)) : undefined;
    const speed = cls ? tr({ zh: `，平均風速${tr(cls.label)}`, en: `, average speed ${tr(cls.label)}` }) : '';
    return {
      title: tr({ zh: '這裡的風', en: 'Wind here' }),
      lines: [tr({ zh: `這裡：${windName(compassOf(u, v))}${speed}`, en: `Here: ${windName(compassOf(u, v))}${speed}` })],
    };
  },
  overlays: [
    {
      kind: 'classGrid',
      id: 'wind-speed',
      label: { zh: '平均風速', en: 'Average wind speed' },
      file: (month) => {
        remember(month);
        return `grid/${month}.png`;
      },
      classes: SPEED_CLASSES.map((c) => ({ ...c, group: 0 })),
      groups: [{ zh: '每秒幾公尺', en: 'Metres per second' }],
      // 蓋住整個地球（海也有風）：太不透明的話看不出海岸線，太透明的話海上的橘色混了藍色變成紫色
      opacity: 0.65,
      indicators: ['map'],
    },
    {
      kind: 'wind',
      id: 'wind',
      label: { zh: '風往哪裡吹', en: 'Where the wind blows' },
      file: (month) => {
        remember(month);
        return `field/${month}.json`;
      },
      color: { light: '#1c2430', dark: '#f4f6fa' },
      legend: { zh: '細線順著風移動，越快走得越快', en: 'Streaks move with the wind; faster means stronger' },
    },
  ],
  indicators,
};
