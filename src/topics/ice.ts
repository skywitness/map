import { tr } from '../i18n/lang';
import { dataUrl } from '../lib/data';
import { fixed } from '../lib/format';
import { classAt, loadClassGrid, type ClassGrid } from '../map/classGridData';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, PointRecord, TopicDefinition } from './types';

/**
 * 冰河、海冰與海平面（pipeline/topics/ice.py）：WGMS 的冰河年質量變化（各國冰河平均變薄多少、少了多少質量）、
 * NSIDC 北極 9 月與南極 2 月的海冰邊緣（1979 年起一年一條線）、NOAA STAR 衛星測高的海平面上升速度（0.5° 網格）。
 */

const n1 = (v: number) => fixed(v, 1);

/** 冰河的國家：panel.json 的 glaciers 也是這幾國（有 RGI 冰河的國家與地區） */
const NO_GLACIER = { zh: '沒有冰河（RGI 冰河目錄裡沒有）', en: 'No glaciers (none in the Randolph Glacier Inventory)' };

/** 海冰邊緣的年代（ice-edges.json 的 types）：越近越深，1981–2010 年的中位數是虛線 */
const SEQ = MAP_TOKENS.sequential;
export const DECADES = [
  { value: 0, color: SEQ[1], label: { zh: '1979–1989 年', en: '1979–1989' } },
  { value: 1, color: SEQ[2], label: { zh: '1990 年代', en: '1990s' } },
  { value: 2, color: SEQ[3], label: { zh: '2000 年代', en: '2000s' } },
  { value: 3, color: SEQ[5], label: { zh: '2010 年代', en: '2010s' } },
  { value: 4, color: SEQ[6], label: { zh: '2020 年代', en: '2020s' } },
];
const MEDIAN = 5;

/** 海平面上升速度的分級（grid/sea-level.png 的代碼，pipeline 的 SEA_LEVEL_BINS）：下降是青綠，上升是橘色，越快越深 */
export const SEA_LEVEL_CLASSES = [
  { value: 1, color: MAP_TOKENS.diverging[5], short: '< 0', label: { zh: '下降', en: 'Falling' } },
  { value: 2, color: SEQ[0], short: '0–2', label: { zh: '每年上升 0–2 mm', en: 'Rising 0–2 mm a year' } },
  { value: 3, color: SEQ[1], short: '2–3', label: { zh: '每年上升 2–3 mm', en: 'Rising 2–3 mm a year' } },
  { value: 4, color: SEQ[2], short: '3–4', label: { zh: '每年上升 3–4 mm', en: 'Rising 3–4 mm a year' } },
  { value: 5, color: SEQ[3], short: '4–5', label: { zh: '每年上升 4–5 mm', en: 'Rising 4–5 mm a year' } },
  { value: 6, color: SEQ[4], short: '5–6', label: { zh: '每年上升 5–6 mm', en: 'Rising 5–6 mm a year' } },
  { value: 7, color: SEQ[6], short: '≥ 6', label: { zh: '每年上升 6 mm 以上', en: 'Rising 6 mm a year or more' } },
];

export function hemisphereName(h: string | number | null): string {
  return h === 'S' ? tr({ zh: '南極', en: 'Antarctic' }) : tr({ zh: '北極', en: 'Arctic' });
}

export function iceMonth(h: string | number | null): string {
  return h === 'S' ? tr({ zh: '2 月', en: 'February' }) : tr({ zh: '9 月', en: 'September' });
}

/** 海冰範圍（百萬 km²） */
export function extentText(v: number): string {
  return tr({ zh: `${fixed(v, 2)} 百萬 km²`, en: `${fixed(v, 2)} million km²` });
}

// 游標下那一格的海平面速度：跟地圖同一張網格（loadClassGrid 同一個網址只讀一次）
let seaLevelGrid: ClassGrid | null = null;
let seaLevelLoading = false;
function seaLevelAt(lon: number, lat: number): number {
  if (!seaLevelGrid && !seaLevelLoading) {
    seaLevelLoading = true;
    loadClassGrid(dataUrl('topics/ice/grid/sea-level.png')).then(
      (g) => (seaLevelGrid = g),
      () => (seaLevelLoading = false),
    );
  }
  return seaLevelGrid ? classAt(seaLevelGrid, lon, lat) : 0;
}

function edgeTooltip(p: PointRecord) {
  const hemi = hemisphereName(p.h);
  const month = iceMonth(p.h);
  if (p.m) {
    return {
      title: tr({ zh: `${hemi} ${month}的中位數邊緣`, en: `${hemi} ${month} median edge` }),
      detail: tr({ zh: '1981–2010 年的中位數（比較的基準）', en: 'Median for 1981–2010 (the reference)' }),
    };
  }
  return {
    title: tr({ zh: `${p.y} 年 ${month}${hemi}的海冰邊緣`, en: `${hemi} sea-ice edge, ${month} ${p.y}` }),
    detail:
      typeof p.e === 'number'
        ? tr({ zh: `月平均海冰範圍 ${extentText(p.e)}`, en: `Monthly mean extent ${extentText(p.e)}` })
        : undefined,
  };
}

const GLACIER_NOTE = {
  zh: '依冰河的面積加權，1976 年起累計到時間軸那一年（WGMS 的水文年：北半球 10 月起、南半球 4 月起）。',
  en: 'Area-weighted, accumulated from 1976 to the selected year (WGMS hydrological years: from October in the Northern Hemisphere, April in the Southern).',
};

const indicators: IndicatorDef[] = [
  {
    id: 'glacier-thinning',
    label: { zh: '冰河變薄了多少', en: 'Glacier thinning' },
    description: {
      zh: `國內的冰河 1976 年起平均變薄了多少（公尺水當量：少掉的冰換成水的厚度）。${GLACIER_NOTE.zh}`,
      en: `How much the country's glaciers have thinned on average since 1976, in metres of water equivalent (the lost ice as a depth of water). ${GLACIER_NOTE.en}`,
    },
    unit: { zh: '公尺水當量', en: 'm w.e.' },
    file: 'glacier-thinning.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 30, 40] } },
    format: (v) =>
      v >= 0
        ? tr({ zh: `變薄 ${n1(v)} 公尺水當量`, en: `${n1(v)} m w.e. thinner` })
        : tr({ zh: `變厚 ${n1(-v)} 公尺水當量`, en: `${n1(-v)} m w.e. thicker` }),
    formatTick: (v) => fixed(v, 0),
    missing: NO_GLACIER,
  },
  {
    id: 'glacier-gt',
    label: { zh: '冰河少了多少冰', en: 'Glacier ice lost' },
    description: {
      zh: `國內的冰河 1976 年起總共少了多少冰（十億公噸，Gt；1 Gt 的水約是 40 萬座標準泳池）。冰河多的國家（加拿大、美國阿拉斯加、格陵蘭周邊）最多。${GLACIER_NOTE.zh}`,
      en: `How much ice the country's glaciers have lost in total since 1976, in gigatonnes (Gt). Countries with the most glacier ice (Canada, Alaska in the United States, the glaciers around Greenland) lose the most. ${GLACIER_NOTE.en}`,
    },
    unit: 'Gt',
    file: 'glacier-gt.json',
    layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
    format: (v) => tr({ zh: `少了 ${fixed(v, v < 10 ? 1 : 0)} Gt`, en: `${fixed(v, v < 10 ? 1 : 0)} Gt lost` }),
    formatTick: (v) => fixed(v, 0),
    missing: NO_GLACIER,
  },
  {
    id: 'sea-ice',
    label: { zh: '海冰邊緣', en: 'Sea-ice edge' },
    description: {
      zh: '北極每年 9 月、南極每年 2 月（各自海冰最少的月份）的海冰邊緣（海面至少 15% 有冰的範圍），1979 年起累積到時間軸那一年，一年一條線，越近的顏色越深；虛線是 1981–2010 年的中位數。滑到線上看那一年的海冰範圍；國家不上色。',
      en: 'The sea-ice edge (where at least 15% of the sea is ice-covered) each September in the Arctic and each February in the Antarctic, the months of least ice, one line per year from 1979 to the selected year, darker for recent years; the dashed line is the 1981–2010 median. Hover over a line for that year’s extent; countries are not coloured.',
    },
    unit: '',
    file: 'sea-ice.json',
    layer: { kind: 'none' },
    overlayTime: 'cumulative',
    unranked: true,
    rankingBars: false,
    panelChart: false,
    format: (v) => fixed(v, 0),
    missing: { zh: '海冰不屬於任何國家，看地圖上的線', en: 'Sea ice belongs to no country; see the lines on the map' },
  },
  {
    id: 'sea-level',
    label: { zh: '海平面上升速度', en: 'Sea-level rise' },
    description: {
      zh: '1993–2025 年衛星測高量到的海平面上升速度（mm/年，0.5° 網格）。國家不上色，滑到國家上看沿海（離國界 200 公里以內的海）的平均；滑到海上看那一格。各地的速度不一樣：洋流、風、海水變暖膨脹的程度不同，西太平洋熱帶一帶最快。',
      en: 'The rate of sea-level rise measured by satellite altimetry, 1993–2025 (mm a year, 0.5° grid). Countries are not coloured; hover over one for the average of its coastal waters (within 200 km), or over the sea for that cell. Rates differ from place to place with currents, winds and how much the water has warmed; they are fastest in the tropical western Pacific.',
    },
    unit: { zh: 'mm/年', en: 'mm/yr' },
    file: 'sea-level.json',
    layer: { kind: 'none' },
    format: (v) => tr({ zh: `沿海每年上升 ${fixed(v, 2)} mm`, en: `Coastal rise ${fixed(v, 2)} mm a year` }),
    formatTick: (v) => fixed(v, 1),
    panelChart: false,
    missing: { zh: '內陸國，沒有沿海的海', en: 'Landlocked: no coastal waters' },
  },
];

export const ice: TopicDefinition = {
  id: 'ice',
  title: { zh: '冰河、海冰與海平面', en: 'Glaciers, sea ice and sea level' },
  shortTitle: { zh: '冰河與海平面', en: 'Ice & sea level' },
  defaultIndicator: 'glacier-thinning',
  defaultYear: 2025,
  sources: [
    {
      name: {
        zh: 'WGMS（2026）冰河年質量變化 AMCE（Dussaillant 等 2025）',
        en: 'WGMS (2026) Annual mass-change estimates for the world’s glaciers (AMCE; Dussaillant et al. 2025)',
      },
      url: 'https://doi.org/10.5904/wgms-amce-2026-02-10',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'NSIDC 海冰指數第 4 版（G02135）', en: 'NSIDC Sea Ice Index, Version 4 (G02135)' },
      url: 'https://nsidc.org/data/g02135/versions/4',
      license: { zh: '美國政府著作', en: 'US Government work' },
    },
    {
      name: {
        zh: 'NOAA STAR 衛星測高的海平面趨勢（Altimetry data are provided by NOAA Laboratory for Satellite Altimetry）',
        en: 'NOAA STAR sea-level trends (Altimetry data are provided by NOAA Laboratory for Satellite Altimetry)',
      },
      url: 'https://www.star.nesdis.noaa.gov/socd/lsa/SeaLevelRise/',
      license: { zh: '美國政府著作', en: 'US Government work' },
    },
  ],
  note: {
    zh: '冰河是 WGMS（世界冰河監測服務）2026 年 2 月的 AMCE：全世界約 21 萬條冰河（RGI 6.0 的輪廓）1976–2025 年每年的質量變化，由衛星與航測的多年高程變化，配上實地量測的逐年變化推算（Dussaillant 等 2025）；格陵蘭與南極的冰蓋本體不算冰河，只有周邊的冰河。每條冰河依中心點歸到國家（Natural Earth 1:10m），國家的值依面積加權；冰河少的國家（例如赤道附近的高山）誤差大。台灣沒有冰河（雪山、南湖大山的圈谷是冰河期留下的地形）。海冰是 NSIDC 海冰指數第 4 版的月平均範圍與邊緣（衛星被動微波，海面至少 15% 有冰算在範圍內），北極 9 月與南極 2 月各自是一年裡最少的月份；1981–2010 年的中位數邊緣當比較的基準。海平面是 NOAA STAR 的衛星測高（TOPEX、Jason-1/2/3、Sentinel-6MF）1993–2025 年的線性趨勢，0.5° 網格，NOAA 標示為實驗性產品；沿海的平均是離國界 200 公里以內的格子依緯度加權，內陸國不算。全球海洋格子的平均約 3.2 mm/年。衛星測高量的是海面高度，不含地層下陷：台灣西南沿海的地層下陷讓陸地看到的海平面上升比這個快。',
    en: 'Glaciers come from the WGMS (World Glacier Monitoring Service) AMCE of February 2026: yearly mass change of some 210,000 glaciers worldwide (RGI 6.0 outlines) for 1976–2025, combining multi-year elevation changes from satellites and aerial surveys with year-to-year field measurements (Dussaillant et al. 2025). The Greenland and Antarctic ice sheets themselves are not glaciers; only the glaciers around them are included. Each glacier is assigned to a country by its centre point (Natural Earth 1:10m) and country values are area-weighted; countries with few glaciers (such as tropical mountains) are less certain. Taiwan has no glaciers (the cirques on Xueshan and Nanhu Mountain are relics of the ice age). Sea ice is the monthly mean extent and edge from the NSIDC Sea Ice Index, Version 4 (passive microwave satellites; the extent counts sea at least 15% covered by ice); September in the Arctic and February in the Antarctic are each the month of least ice, and the 1981–2010 median edge is the reference. Sea level is the linear trend for 1993–2025 from NOAA STAR satellite altimetry (TOPEX, Jason-1/2/3, Sentinel-6MF) on a 0.5° grid, labelled experimental by NOAA; coastal averages use cells within 200 km of the country, weighted by latitude, and exclude landlocked countries. The average over all ocean cells is about 3.2 mm a year. Altimetry measures the height of the sea surface and does not include land subsidence: along Taiwan’s south-western coast, subsidence makes the sea rise faster relative to the land.',
  },
  panelExtra: () => import('./panels/IcePanel'),
  pointer: ([lon, lat], { indicator }) => {
    if (indicator !== 'sea-level') return null;
    const c = SEA_LEVEL_CLASSES.find((k) => k.value === seaLevelAt(lon, lat));
    if (!c) return null;
    const line = tr({ zh: `這一格：${c.label.zh}`, en: `This cell: ${c.label.en}` });
    return { title: tr({ zh: '海平面（1993–2025）', en: 'Sea level (1993–2025)' }), lines: [line] };
  },
  overlays: [
    {
      kind: 'lines',
      id: 'ice-edges',
      file: 'ice-edges.json',
      label: { zh: '海冰邊緣', en: 'Sea-ice edge' },
      width: 1.4,
      color: {
        title: { zh: '年代', en: 'Decade' },
        classes: [
          ...[...DECADES].reverse(),
          {
            value: MEDIAN,
            color: MAP_TOKENS.ink,
            dash: true,
            label: { zh: '1981–2010 年的中位數', en: '1981–2010 median' },
          },
        ],
      },
      timeField: 'y',
      sortByType: true,
      casing: true,
      tooltip: edgeTooltip,
      indicators: ['sea-ice'],
    },
    {
      kind: 'classGrid',
      id: 'sea-level',
      label: { zh: '海平面上升速度（0.5° 網格）', en: 'Sea-level rise (0.5° grid)' },
      file: () => 'grid/sea-level.png',
      classes: SEA_LEVEL_CLASSES.map((c) => ({ ...c, group: 0 })),
      groups: [{ zh: 'mm/年，1993–2025', en: 'mm a year, 1993–2025' }],
      opacity: 0.85,
      indicators: ['sea-level'],
    },
  ],
  indicators,
};
