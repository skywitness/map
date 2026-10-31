import { tr } from '../i18n/lang';
import { fetchJson } from '../lib/data';
import { fixed, formatLargeNumber } from '../lib/format';
import { magneticField, type WmmFile } from '../lib/wmm';
import { MAP_TOKENS } from '../theme/tokens';
import { formatLatLon } from './antipodes';
import type { ColorClasses, IndicatorDef, LinesOverlayDef, PointerInfo, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 北磁極的漂移與磁偏角（pipeline/topics/magnetic.py）：NOAA NCEI 的磁極位置（1590–2025 年每年一點，北、南磁極）
 * 與 World Magnetic Model 2025 的磁偏角（等偏角線、磁極附近的不可靠區、各國首都的值）。滑到地圖上任一點時在瀏覽器算
 * 那裡的磁偏角（src/lib/wmm.ts）。DESIGN.md 第 8 節第 101 點。
 * 2026-10-31（第十四批 256）：歷史的磁偏角用 IGRF-14（CC BY 4.0），1900–2020 年每 5 年一格（使用者決定不內插），2025 年照舊用 WMM2025；
 * 等偏角線、不可靠區跟著時間軸換，滑到任一點時用那一年的係數（igrf.json）。
 */

const YEAR = 2025;
const WMM_PATH = 'topics/magnetic/wmm.json';
const IGRF_PATH = 'topics/magnetic/igrf.json';
/** IGRF-14 的第一年；之後每 5 年一格 */
const FIRST = 1900;
/** 那一年用的模型名稱 */
const modelName = (year: number) => (year >= YEAR ? 'World Magnetic Model 2025' : 'IGRF-14');
/** WMM 的 blackout zone 與 caution zone（水平分量，nT） */
const BLACKOUT_NT = 2000;
const CAUTION_NT = 6000;

/** 磁偏角：東為正。「5.0°W」「12.3°E」「0.0°」 */
export function formatDeclination(v: number, digits = 1): string {
  const r = Number(v.toFixed(digits));
  const abs = fixed(Math.abs(r), digits);
  if (r === 0) return `${abs}°`;
  return tr(r > 0 ? { zh: `偏東 ${abs}°`, en: `${abs}° E` } : { zh: `偏西 ${abs}°`, en: `${abs}° W` });
}
const declinationTick = (v: number) => (v === 0 ? '0°' : tr(v > 0 ? { zh: `東 ${v}°`, en: `${v}°E` } : { zh: `西 ${-v}°`, en: `${-v}°W` }));
const km = (v: number) => tr({ zh: `${formatLargeNumber(v)} 公里`, en: `${formatLargeNumber(v)} km` });

// ── 疊加圖層 ─────────────────────────────────────────────

/** 磁極的年份：越近越深（同一組分級，北、南磁極共用，圖例只列在第一個圖層下面） */
const POLE_YEARS: ColorClasses = {
  field: 'y',
  title: { zh: '年份', en: 'Year' },
  thresholds: [1700, 1800, 1900, 1950, 2000],
  classes: [
    { color: MAP_TOKENS.sequential[1], label: '1590–1699' },
    { color: MAP_TOKENS.sequential[2], label: '1700–1799' },
    { color: MAP_TOKENS.sequential[3], label: '1800–1899' },
    { color: MAP_TOKENS.sequential[4], label: '1900–1949' },
    { color: MAP_TOKENS.sequential[5], label: '1950–1999' },
    { color: MAP_TOKENS.sequential[6], label: '2000–2025' },
  ],
};

function poleTooltip(which: 'north' | 'south') {
  return (p: PointRecord) => ({
    title: tr(
      which === 'north'
        ? { zh: `北磁極（${p.y} 年）`, en: `North magnetic pole (${p.y})` }
        : { zh: `南磁極（${p.y} 年）`, en: `South magnetic pole (${p.y})` },
    ),
    detail: formatLatLon(p.lon as number, p.lat as number),
    extra: [tr({ zh: '模型算出的磁傾角 90° 的點', en: 'Modelled point where the field is vertical (dip pole)' })],
  });
}

const POLE_BASE = { kind: 'points', radius: 3, color: POLE_YEARS, sortField: 'y', timeField: 'y' } as const;
const NORTH: PointsOverlayDef = {
  ...POLE_BASE,
  id: 'north',
  file: 'north.json',
  label: { zh: '北磁極的位置', en: 'North magnetic pole' },
  tooltip: poleTooltip('north'),
};
const SOUTH: PointsOverlayDef = {
  ...POLE_BASE,
  id: 'south',
  file: 'south.json',
  label: { zh: '南磁極的位置', en: 'South magnetic pole' },
  tooltip: poleTooltip('south'),
};

/** 等偏角線的分類（pipeline 的 line_code()）：西偏青綠、東偏橘（跟首都的磁偏角同一組發散色），零偏角深灰 */
const ISOGONIC: LinesOverlayDef = {
  kind: 'lines',
  id: 'isogonic',
  file: 'isogonic.json',
  label: { zh: '等偏角線', en: 'Lines of equal declination' },
  indicators: ['declination'],
  // 每 5 年一份（pipeline 的紀錄 y），依時間軸那一年
  timeField: 'y',
  width: 1.1,
  casing: true,
  color: {
    title: { zh: '磁偏角', en: 'Declination' },
    classes: [
      { value: 1, color: MAP_TOKENS.diverging[6], label: { zh: '偏西 20° 以上', en: '20° W or more' } },
      { value: 2, color: MAP_TOKENS.diverging[5], label: { zh: '偏西 20° 以內', en: 'Under 20° W' } },
      { value: 3, color: MAP_TOKENS.inkSecondary, label: { zh: '0°（指南針指向真北）', en: '0° (compass points to true north)' } },
      { value: 4, color: MAP_TOKENS.diverging[1], label: { zh: '偏東 20° 以內', en: 'Under 20° E' } },
      { value: 5, color: MAP_TOKENS.diverging[0], label: { zh: '偏東 20° 以上', en: '20° E or more' } },
    ],
  },
  lineLabel: (p) => (p.d === 0 ? '0°' : declinationTick(p.d as number)),
  tooltip: (p) => ({
    title: tr({ zh: `磁偏角 ${formatDeclination(p.d as number, 0)}`, en: `Declination ${formatDeclination(p.d as number, 0)}` }),
    detail: tr({ zh: `${p.y} 年，${modelName(Number(p.y))}`, en: `${p.y}, ${modelName(Number(p.y))}` }),
  }),
};

/** 磁極附近指南針不可靠的範圍（水平分量 < 2,000 nT，WMM 的 blackout zone） */
const BLACKOUT: LinesOverlayDef = {
  kind: 'lines',
  id: 'blackout',
  file: 'blackout.json',
  label: { zh: '指南針不可靠的範圍', en: 'Compass unreliable' },
  indicators: ['declination'],
  timeField: 'y',
  width: 0.8,
  color: {
    classes: [
      {
        value: 1,
        color: MAP_TOKENS.inkMuted,
        label: { zh: '水平分量小於 2,000 nT（WMM 的 blackout zone）', en: 'Horizontal field under 2,000 nT (WMM blackout zone)' },
        area: 'land',
      },
    ],
  },
  fill: { field: 'f', value: 1, opacity: 0.35, darkOpacity: 0.45, holeField: 'hole' },
};

// ── 滑到地圖上任一點 ─────────────────────────────────────────

let wmm: WmmFile | null = null;
let wmmLoading = false;
/** 係數檔第一次滑到地圖時才下載（2 KB），下載完之前回傳 null（下一次滑動就有） */
function wmmFile(): WmmFile | null {
  if (!wmm && !wmmLoading) {
    wmmLoading = true;
    fetchJson<WmmFile>(WMM_PATH)
      .then((d) => (wmm = d))
      .catch(() => (wmmLoading = false));
  }
  return wmm;
}

/** IGRF-14 各年份的係數（pipeline 的 igrf.json：{年份: [[n, m, g, h], …]}），換成 WmmFile 的格式（年變率 0） */
interface IgrfFile {
  model: string;
  epochs: Record<string, [number, number, number, number][]>;
}
let igrf: Map<number, WmmFile> | null = null;
let igrfLoading = false;
function igrfFile(year: number): WmmFile | null {
  if (!igrf && !igrfLoading) {
    igrfLoading = true;
    fetchJson<IgrfFile>(IGRF_PATH)
      .then((d) => {
        igrf = new Map(
          Object.entries(d.epochs).map(([y, coef]) => [Number(y), { model: d.model, epoch: Number(y), coef: coef.map(([n, m, g, h]) => [n, m, g, h, 0, 0]) }]),
        );
      })
      .catch(() => (igrfLoading = false));
  }
  return igrf?.get(year) ?? null;
}

function pointer([lon, lat]: [number, number], { iso3, year }: { iso3: string | null; year: number }): PointerInfo | null {
  // 時間軸那一年（每 5 年一格）：2025 年起用 WMM2025，之前用 IGRF-14 那一年的係數
  const epoch = Math.max(FIRST, Math.min(YEAR, Math.floor(year / 5) * 5));
  const file = epoch >= YEAR ? wmmFile() : igrfFile(epoch);
  if (!file) return null;
  const f = magneticField(file, lat, lon, 0, epoch);
  const lines = [tr({ zh: `這裡的磁偏角：${formatDeclination(f.declination)}（${epoch} 年）`, en: `Declination here: ${formatDeclination(f.declination)} (${epoch})` })];
  if (f.horizontal < BLACKOUT_NT) {
    lines.push(tr({ zh: '磁極附近，指南針不可靠', en: 'Near the magnetic pole: compass unreliable' }));
  } else if (f.horizontal < CAUTION_NT) {
    lines.push(tr({ zh: '接近磁極，指南針容易受干擾', en: 'Close to the magnetic pole: compass easily disturbed' }));
  }
  if (iso3) return { lines };
  return { title: formatLatLon(lon, lat), lines };
}

// ── 指標 ─────────────────────────────────────────────

const POLES_ID = 'poles';
const DISTANCE_DESC = {
  zh: '首都到那一年北磁極的大圓距離。北磁極 1590 年在加拿大北極群島，1990 年代起加速往西伯利亞移動，所以歐洲與亞洲的首都越來越近、北美洲的越來越遠。',
  en: 'Great-circle distance from the capital to the north magnetic pole in that year. The pole sat in the Canadian Arctic in 1590 and has sped towards Siberia since the 1990s, so capitals in Europe and Asia are getting closer and those in North America farther away.',
};

const indicators: IndicatorDef[] = [
  {
    id: POLES_ID,
    label: { zh: '磁極的軌跡', en: 'Pole paths' },
    description: {
      zh: '北磁極與南磁極（磁傾角 90°、指南針直立的點）1590 年起每年的位置，拖動時間軸看它們怎麼移動。北磁極 1590 年在加拿大北極群島（北緯 73.9°），2025 年在北冰洋中央（北緯 85.8°、東經 138.1°），正往西伯利亞移動。',
      en: 'Yearly positions since 1590 of the north and south magnetic poles (where the field is vertical). Drag the timeline to watch them move. The north pole was in the Canadian Arctic in 1590 (73.9°N) and in the middle of the Arctic Ocean in 2025 (85.8°N, 138.1°E), heading towards Siberia.',
    },
    unit: { zh: '公里', en: 'km' },
    file: 'distance.json',
    layer: { kind: 'none' },
    format: km,
    overlayTime: 'cumulative',
    unranked: true,
  },
  {
    id: 'declination',
    label: { zh: '首都的磁偏角', en: 'Declination at the capital' },
    description: {
      zh: '那一年在首都，指南針的北比真北（地理的北）偏東或偏西幾度：1900–2020 年每 5 年用國際地磁參考場 IGRF-14，2025 年用 World Magnetic Model 2025。地圖上的線是等偏角線，滑到任一點看那裡的磁偏角。拖動時間軸看磁偏角怎麼變：台北 1900 年偏西約 1°、2025 年偏西約 5°；倫敦 1900 年偏西約 17°，2020 年前後轉成偏東。',
      en: 'How many degrees a compass’s north points east or west of true (geographic) north at the capital in the selected year: every 5 years from 1900 to 2020 from the International Geomagnetic Reference Field (IGRF-14), and 2025 from the World Magnetic Model 2025. The lines join places with equal declination; hover anywhere to see the value there. Drag the timeline to watch it change: Taipei went from about 1° west in 1900 to about 5° west in 2025, and London from about 17° west in 1900 to slightly east around 2020.',
    },
    unit: '°',
    file: 'declination.json',
    layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-20, -10, -2, 2, 10, 20], reverse: true } },
    overlayTime: 'year',
    format: (v) => formatDeclination(v),
    formatTick: declinationTick,
    unranked: true,
  },
  {
    id: 'distance',
    label: { zh: '首都離北磁極', en: 'Distance to the north magnetic pole' },
    description: DISTANCE_DESC,
    unit: { zh: '公里', en: 'km' },
    file: 'distance.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2000, 4000, 6000, 8000, 10000, 12000] } },
    format: km,
    formatTick: (v) => formatLargeNumber(v),
    overlayTime: 'cumulative',
    unranked: true,
    chartZoom: true,
  },
];

export const magnetic: TopicDefinition = {
  id: 'magnetic',
  title: { zh: '北磁極的漂移與磁偏角', en: 'Magnetic poles and declination' },
  shortTitle: { zh: '磁極與磁偏角', en: 'Magnetic poles' },
  defaultIndicator: POLES_ID,
  defaultYear: YEAR,
  sources: [
    {
      name: { zh: 'NOAA NCEI，Wandering of the Geomagnetic Poles（磁極位置 1590–2025）', en: 'NOAA NCEI, Wandering of the Geomagnetic Poles (pole positions 1590–2025)' },
      url: 'https://www.ncei.noaa.gov/products/wandering-geomagnetic-poles',
      license: { zh: '美國政府資料（可自由使用）', en: 'US Government data (free to use)' },
    },
    {
      name: 'NOAA NCEI Geomagnetic Modeling Team; British Geological Survey. 2024: World Magnetic Model 2025',
      url: 'https://doi.org/10.25921/aqfd-sd83',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: 'Alken, P. et al. (2024). International Geomagnetic Reference Field: the fourteenth generation (IGRF-14) coefficients, IAGA',
      url: 'https://doi.org/10.5281/zenodo.14012302',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Wikidata（首都）', en: 'Wikidata (capitals)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
  ],
  note: {
    zh: '磁極是磁傾角 90°（磁力線垂直地面、指南針的針會直立）的點，跟地磁的偶極軸（地磁北極）不同。1590–2025 年的位置是 NOAA NCEI 用地磁模型算的（1890 年以前用 gufm1、之後用 IGRF），不是每年的實測；實地找到北磁極的紀錄從 1831 年（James Clark Ross）開始。2025 年的磁偏角用 World Magnetic Model 2025（NOAA NCEI 與英國地質調查所）在 2025 年 1 月 1 日、海平面的值；1900–2020 年用國際地磁參考場 IGRF-14（IAGA，每 5 年一組係數，1945 年起是定案的 DGRF），每 5 年一格、不內插。IGRF-14 的 2025 年跟 WMM2025 在台北只差 0.001°。磁極附近水平分量小於 2,000 nT 的地方（WMM 的 blackout zone）指南針不可靠，地圖上畫成灰色的範圍、不畫等偏角線。首都是國家小檔案的 Wikidata 首都。',
    en: 'A magnetic (dip) pole is where the field is vertical, so a compass needle would stand on end; it differs from the geomagnetic pole of the dipole axis. Positions for 1590–2025 are computed by NOAA NCEI from geomagnetic models (gufm1 before 1890, IGRF after), not measured every year; the north magnetic pole was first located on the ground in 1831 (James Clark Ross). Declination for 2025 is from the World Magnetic Model 2025 (NOAA NCEI and the British Geological Survey) at sea level on 1 January 2025; 1900–2020 use the International Geomagnetic Reference Field IGRF-14 (IAGA; one set of coefficients every 5 years, definitive DGRF from 1945), shown every 5 years without interpolation. IGRF-14 for 2025 differs from WMM2025 by 0.001° in Taipei. Near the poles, where the horizontal field is under 2,000 nT (the WMM blackout zone), compasses are unreliable: these areas are shaded grey and have no lines. Capitals are the Wikidata capitals from the country profiles.',
  },
  overlays: [BLACKOUT, ISOGONIC, NORTH, SOUTH],
  indicators,
  pointer,
};
