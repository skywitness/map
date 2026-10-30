import { tr } from '../i18n/lang';
import { fetchJson } from '../lib/data';
import { fixed } from '../lib/format';
import { decodeLines } from '../map/overlayData';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, LinesData, PointRecord, TopicDefinition } from './types';

/**
 * 板塊漂移（pipeline/topics/plates.py）：Merdith 等 2021 的全板塊重建模型，用 pyGPlates 把今天的國界帶回
 * 0–250 百萬年前（每 5 百萬年），加上那時的板塊邊界。時間軸的年份是負的百萬年（−250 … 0）。
 * 底圖只留海的顏色（bareMap）：今天的陸地、地名、國界在過去的位置上沒有意義。國家不能點，滑到陸地上時
 * 由 pointer 判斷游標在哪一國過去的位置上（讀同一個時間點的 countries/<年份>.json，fetchJson 有快取）。
 */

/** 「2 億年前」「5,500 萬年前」「現在」；英文「200 million years ago」 */
export function maText(y: number): string {
  const ma = -y;
  if (ma === 0) return tr({ zh: '現在', en: 'Today' });
  // 中文：1 億以上寫「1.5 億年前」，以下寫「5,500 萬年前」
  const zh = ma >= 100 ? `${fixed(ma / 100, ma % 100 === 0 ? 0 : 2).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')} 億年前` : `${fixed(ma * 100, 0)} 萬年前`;
  return tr({ zh, en: `${ma} million years ago` });
}

/** 時間軸刻度：「250 Ma」「今天」 */
function maTick(y: number): string {
  if (y === 0) return tr({ zh: '今天', en: 'Today' });
  return tr({ zh: `${-y} 百萬年前`, en: `${-y} Ma` });
}

/** 今天所在的大洲（pipeline 的 CONTINENTS，countries/<年份>.json 的 types） */
const CONTINENTS = [
  { value: 0, label: { zh: '亞洲', en: 'Asia' } },
  { value: 1, label: { zh: '歐洲', en: 'Europe' } },
  { value: 2, label: { zh: '非洲', en: 'Africa' } },
  { value: 3, label: { zh: '北美洲', en: 'North America' } },
  { value: 4, label: { zh: '南美洲', en: 'South America' } },
  { value: 5, label: { zh: '大洋洲', en: 'Oceania' } },
  { value: 6, label: { zh: '南極洲', en: 'Antarctica' } },
];

/** 板塊邊界的種類（pipeline 的 BOUNDARY_TYPES） */
const BOUNDARIES = [
  { value: 0, color: '#c0392b', label: { zh: '隱沒帶', en: 'Subduction zone' } },
  { value: 1, color: '#e6a100', label: { zh: '中洋脊、張裂', en: 'Mid-ocean ridge or rift' } },
  { value: 2, color: '#7b3294', label: { zh: '轉形斷層', en: 'Transform fault' } },
  { value: 3, color: MAP_TOKENS.inkMuted, dash: true, label: { zh: '其他邊界', en: 'Other boundary' } },
];

export function latText(v: number): string {
  const abs = fixed(Math.abs(v), 0);
  if (Math.abs(v) < 0.5) return tr({ zh: '赤道', en: 'the equator' });
  return v > 0 ? tr({ zh: `北緯 ${abs}°`, en: `${abs}°N` }) : tr({ zh: `南緯 ${abs}°`, en: `${abs}°S` });
}

function countryTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string; year: number }) {
  return {
    title: tr({ zh: `今天的${ctx.countryName(String(p.c))}`, en: `Today’s ${ctx.countryName(String(p.c))}` }),
    detail: maText(ctx.year),
  };
}

// ── 游標下是哪一國：那個時間點的國界（每一塊一個封閉的環，紀錄的 c 是國家） ──────────
interface Shapes {
  rings: [number, number][][];
  codes: string[];
  boxes: [number, number, number, number][];
}
const shapes = new Map<number, Shapes | null>();

function shapesAt(year: number): Shapes | null {
  if (!shapes.has(year)) {
    shapes.set(year, null);
    fetchJson<LinesData>(`topics/plates/countries/${year}.json`).then(
      (data) => {
        const { lines, records } = decodeLines(data);
        const boxes = lines.map((ring) => {
          const xs = ring.map((p) => p[0]);
          const ys = ring.map((p) => p[1]);
          return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number];
        });
        shapes.set(year, { rings: lines, codes: (records ?? []).map((r) => String(r.c)), boxes });
      },
      () => shapes.delete(year),
    );
  }
  return shapes.get(year) ?? null;
}

function inside(ring: [number, number][], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** 游標下是哪一國過去的位置（環的經度展開過，可以超過 ±180°：游標的經度也試 ±360°） */
function countryThen(year: number, lon: number, lat: number): string | null {
  const s = shapesAt(year);
  if (!s) return null;
  for (let k = 0; k < s.rings.length; k++) {
    const [w, south, e, n] = s.boxes[k];
    if (lat < south || lat > n) continue;
    for (const x of [lon, lon + 360, lon - 360]) {
      if (x >= w && x <= e && inside(s.rings[k], x, lat)) return s.codes[k];
    }
  }
  return null;
}

/**
 * 打開時地圖對著的地方（TopicDefinition.focus，2026-10-30 起）：每 500 萬年陸地（countries/<年份>.json 的面）
 * 依面積加權的重心 [經度, 緯度]，2026-10-30 從資料檔算的；2 億年前的盤古大陸在東經 16°、北緯 23° 附近
 */
const LAND_CENTRE: Record<number, [number, number]> = {
  [-250]: [20, 1], [-245]: [20, 3], [-240]: [21, 7], [-235]: [20, 9], [-230]: [19, 11], [-225]: [18, 15],
  [-220]: [17, 18], [-215]: [17, 20], [-210]: [16, 21], [-205]: [16, 21], [-200]: [16, 23], [-195]: [17, 22],
  [-190]: [18, 27], [-185]: [19, 25], [-180]: [20, 27], [-175]: [21, 26], [-170]: [23, 26], [-165]: [23, 23],
  [-160]: [25, 23], [-155]: [26, 19], [-150]: [27, 17], [-145]: [27, 19], [-140]: [28, 21], [-135]: [28, 23],
  [-130]: [27, 24], [-125]: [28, 25], [-120]: [27, 26], [-115]: [27, 27], [-110]: [27, 27], [-105]: [25, 28],
  [-100]: [25, 28], [-95]: [24, 28], [-90]: [23, 28], [-85]: [23, 28], [-80]: [22, 28], [-75]: [22, 28],
  [-70]: [22, 29], [-65]: [22, 30], [-60]: [21, 31], [-55]: [20, 32], [-50]: [20, 34], [-45]: [20, 35],
  [-40]: [20, 36], [-35]: [20, 39], [-30]: [19, 42], [-25]: [19, 44], [-20]: [20, 45], [-15]: [21, 47],
  [-10]: [22, 48], [-5]: [23, 51], [0]: [25, 54],
};

/** 那個年代的陸地重心前後各 50°（地球儀上就是轉到那一面） */
function landFocus(year: number): [number, number, number, number] {
  const [lon, lat] = LAND_CENTRE[Math.max(-250, Math.min(0, Math.round(year / 5) * 5))] ?? LAND_CENTRE[-200];
  return [lon - 50, Math.max(-85, lat - 50), lon + 50, Math.min(85, lat + 50)];
}

const AXIS = { label: { zh: '時間', en: 'Time' }, year: maText, tick: maTick };

const indicators: IndicatorDef[] = [
  {
    id: 'paleolat',
    label: { zh: '那時在哪個緯度', en: 'Latitude then' },
    description: {
      zh: '把今天的國界跟著板塊帶回過去（Merdith 等 2021 的板塊重建模型），每 500 萬年一格，顏色是今天所在的大洲；線是那時的板塊邊界。2 億多年前大部分的陸地連成盤古大陸。滑到陸地上看是今天的哪一國；搜尋國家看它的國土那時在哪個緯度。',
      en: 'Today’s borders carried back through time on their plates (the Merdith et al. 2021 plate reconstruction), every 5 million years, coloured by today’s continent; lines are the plate boundaries of the time. Over 200 million years ago most land was joined in Pangaea. Hover over land to see which country it is today; search for a country to see the latitude of its territory through time.',
    },
    unit: '°',
    file: 'paleolat.json',
    layer: { kind: 'none' },
    unranked: true,
    rankingBars: false,
    format: (v) => latText(v),
    formatTick: (v) => fixed(v, 0),
    timeAxis: AXIS,
  },
];

export const plates: TopicDefinition = {
  id: 'plates',
  title: { zh: '板塊漂移', en: 'Continental drift' },
  shortTitle: { zh: '板塊漂移', en: 'Drift' },
  defaultIndicator: 'paleolat',
  defaultYear: -200,
  bareMap: true,
  focus: landFocus,
  sources: [
    {
      name: {
        zh: 'Merdith 等 2021，10 億年來的全板塊重建模型 v1.2.4（Earth-Science Reviews；Zenodo）',
        en: 'Merdith et al. 2021, full-plate reconstruction model since 1 Ga, v1.2.4 (Earth-Science Reviews; Zenodo)',
      },
      url: 'https://doi.org/10.5281/zenodo.13635864',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '今天的板塊邊界：PB2002（Bird 2003；Hugo Ahlenius、Nordpil 整理；地震與火山主題的檔）',
        en: 'Today’s plate boundaries: PB2002 (Bird 2003; compiled by Hugo Ahlenius, Nordpil; the Earthquakes topic’s file)',
      },
      url: 'https://github.com/fraxen/tectonicplates',
      license: 'ODC-By 1.0',
    },
  ],
  note: {
    zh: '板塊的位置來自 Merdith 等 2021 年的全板塊重建模型（v1.2.4），用 pyGPlates 計算：今天的國界（Natural Earth 1:50m，簡化到約 40 公里）先依模型的靜態多邊形切到各塊板塊上，再跟著板塊轉回過去，同一國的各塊轉回去後合併。那塊地殼還沒形成的年代不畫。國界是今天的，過去當然沒有這些國家；陸地的形狀也是今天的海岸線，不是當時的海岸（那時的海平面、被擠壓或拉開的地殼都不同）。緯度依古地磁定出比較可靠，經度是模型推算的參考框架。國家的緯度是國土各塊依面積加權的重心。板塊邊界是模型解出的那時的邊界（隱沒帶、中洋脊與張裂、轉形斷層）；圖層裡可以另外打開今天的板塊邊界（PB2002，地震與火山主題的同一份）對照，它是今天的位置，不跟著時間移動。打開時地圖轉到那個年代陸地的重心。',
    en: 'Plate positions come from the full-plate reconstruction model of Merdith et al. (2021), v1.2.4, computed with pyGPlates: today’s borders (Natural Earth 1:50m, simplified to about 40 km) are first split onto plates using the model’s static polygons, then rotated back with their plates, and each country’s pieces are merged again. Crust that did not yet exist is not drawn. The borders are today’s, and these countries of course did not exist; the shapes are today’s coastlines, not those of the time (sea levels and stretched or compressed crust were different). Latitudes are better constrained (by palaeomagnetism) than longitudes, which depend on the model’s reference frame. A country’s latitude is the area-weighted centroid of its pieces. Plate boundaries are those resolved by the model for that time (subduction zones, mid-ocean ridges and rifts, transform faults); today’s boundaries (PB2002, the same file as in Earthquakes) can be switched on in the layers for comparison and stay in today’s positions. The map opens centred on the land of the chosen time.',
  },
  pointer: ([lon, lat], { year, countryName }) => {
    const code = countryThen(year, lon, lat);
    if (!code) return null;
    return {
      title: tr({ zh: `今天的${countryName(code)}`, en: `Today’s ${countryName(code)}` }),
      lines: [
        maText(year),
        year === 0
          ? tr({ zh: `在${latText(lat)}附近`, en: `Near ${latText(lat)}` })
          : tr({ zh: `那時在${latText(lat)}附近`, en: `Then near ${latText(lat)}` }),
      ],
    };
  },
  overlays: [
    {
      kind: 'lines',
      id: 'drift-countries',
      file: 'countries/{year}.json',
      label: { zh: '今天的國界', en: 'Today’s borders' },
      width: 0.7,
      color: {
        title: { zh: '今天所在的大洲', en: 'Continent today' },
        classes: CONTINENTS.map((c) => ({ ...c, color: MAP_TOKENS.categorical[c.value], area: 'land' as const })),
      },
      fill: { field: 'f', value: 1, opacity: 0.8, darkOpacity: 0.8 },
      tooltip: countryTooltip,
    },
    {
      kind: 'lines',
      id: 'plate-boundaries',
      file: 'boundaries/{year}.json',
      label: { zh: '那時的板塊邊界', en: 'Plate boundaries then' },
      width: 1.3,
      color: { title: { zh: '邊界的種類', en: 'Boundary type' }, classes: BOUNDARIES },
    },
    {
      // 今天的板塊邊界（對照，預設關掉）：直接讀地震與火山主題的 plates.json，不複製（共用疊加圖層做好後改接過去）
      kind: 'lines',
      id: 'plates-today',
      topic: 'earthquakes',
      file: 'plates.json',
      label: { zh: '今天的板塊邊界（對照）', en: 'Today’s plate boundaries (for comparison)' },
      width: 1,
      hidden: true,
      color: {
        title: { zh: '今天的邊界（PB2002）', en: 'Boundaries today (PB2002)' },
        classes: [
          { value: 1, color: MAP_TOKENS.inkSecondary, label: { zh: '聚合（隱沒帶、碰撞）', en: 'Convergent (subduction, collision)' } },
          { value: 2, color: MAP_TOKENS.inkSecondary, dash: true, label: { zh: '張裂（中洋脊、裂谷）', en: 'Divergent (ridges, rifts)' } },
          { value: 3, color: MAP_TOKENS.inkMuted, label: { zh: '轉形斷層', en: 'Transform faults' } },
        ],
      },
    },
  ],
  indicators,
};
