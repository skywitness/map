import { getLang, tr } from '../i18n/lang';
import { fetchJson } from '../lib/data';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, IndicatorData, PointRecord, TopicDefinition } from './types';

/**
 * 從台北看世界（pipeline/topics/taipei_view.py）：各國首都離台北多遠、大圓航線一開始朝哪個方向，
 * 地球儀上畫距離圈與大圓航線，側欄是以台北為中心的方位等距圓盤（TaipeiViewPanel）。主地圖不換投影（使用者決定）。
 */

export const TAIPEI: [number, number] = [121.5625, 25.0375];

/** 八方位（pipeline 的 octant：1 北、2 東北…8 西北） */
export const DIRECTIONS: CategoryDef[] = [
  { value: 1, label: { zh: '北', en: 'North' } },
  { value: 2, label: { zh: '東北', en: 'Northeast' } },
  { value: 3, label: { zh: '東', en: 'East' } },
  { value: 4, label: { zh: '東南', en: 'Southeast' } },
  { value: 5, label: { zh: '南', en: 'South' } },
  { value: 6, label: { zh: '西南', en: 'Southwest' } },
  { value: 7, label: { zh: '西', en: 'West' } },
  { value: 8, label: { zh: '西北', en: 'Northwest' } },
];

export const kmText = (v: number) => tr({ zh: `${fixed(v, 0)} 公里`, en: `${fixed(v, 0)} km` });
const hoursText = (v: number) => tr({ zh: `約 ${fixed(v, 1)} 小時`, en: `about ${fixed(v, 1)} h` });

/** 方位角 → 「北偏東 16°」／「N 16° E」（0° 是正北、90° 是正東） */
export function bearingText(deg: number): string {
  const d = Math.round(deg) % 360;
  if (d === 0) return tr({ zh: '正北', en: 'Due north' });
  if (d === 90) return tr({ zh: '正東', en: 'Due east' });
  if (d === 180) return tr({ zh: '正南', en: 'Due south' });
  if (d === 270) return tr({ zh: '正西', en: 'Due west' });
  const [ns, angle, ew] = d < 90 ? ['N', d, 'E'] : d < 180 ? ['S', 180 - d, 'E'] : d < 270 ? ['S', d - 180, 'W'] : ['N', 360 - d, 'W'];
  const zh = { N: '北', S: '南', E: '東', W: '西' } as const;
  return tr({ zh: `${zh[ns as 'N' | 'S']}偏${zh[ew as 'E' | 'W']} ${angle}°`, en: `${ns} ${angle}° ${ew}` });
}

/** tooltip 另外一行要用到另一個指標檔：第一次用到時下載，下載完之後才有 */
const files = new Map<string, IndicatorData | null>();
function lazy(path: string): IndicatorData | null {
  if (!files.has(path)) {
    files.set(path, null);
    fetchJson<IndicatorData>(path)
      .then((d) => files.set(path, d))
      .catch(() => files.delete(path));
  }
  return files.get(path) ?? null;
}
const valueOf = (d: IndicatorData | null, iso3: string) => (d ? (d.values[iso3]?.[0] ?? null) : null);

function routeTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const iso3 = String(p.iso3 ?? '');
  return {
    title: tr({ zh: `台北 → ${ctx.countryName(iso3)}`, en: `Taipei → ${ctx.countryName(iso3)}` }),
    detail: typeof p.d === 'number' ? kmText(p.d) : undefined,
    extra: typeof p.b === 'number' ? [tr({ zh: `一開始朝${bearingText(p.b)}`, en: `Sets off ${bearingText(p.b)}` })] : undefined,
  };
}

export const taipeiView: TopicDefinition = {
  id: 'taipei-view',
  title: { zh: '從台北看世界', en: 'The world from Taipei' },
  shortTitle: { zh: '從台北看世界', en: 'From Taipei' },
  defaultIndicator: 'distance',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: 'Wikidata（各國首都的位置，晝夜與季節主題整理的）', en: 'Wikidata (capital locations, as compiled for the Day and night topic)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
  ],
  note: {
    zh:
      '距離是台北（臺北市政府）到各國首都的大圓距離，把地球當成半徑 6,371 公里的球（跟橢球的誤差在 0.5% 以內）。方位是大圓航線一開始的方向，不是地圖上兩點的連線：到華盛頓一開始往北偏東 16°，經過阿拉斯加附近。' +
      '地球儀本身是從太空看的透視圖，離中心越遠越扁；側欄的圓盤是以台北為中心的方位等距投影：從台北往外的直線就是大圓航線，到圓心的距離照比例，最外圈是台北的對蹠點（巴拉圭附近），越外圈形狀越變形。' +
      '對蹠點附近（阿根廷、巴拉圭、烏拉圭）往哪個方向走都差不多遠，方位意義不大（見「地球的另一邊」主題）。',
    en:
      'Distances are great-circle distances from Taipei (Taipei City Hall) to each capital, treating the Earth as a sphere of radius 6,371 km (within 0.5% of the ellipsoid). The bearing is the initial direction of the great-circle route, not of a straight line on the map: to Washington it sets off 16° east of north, passing near Alaska. ' +
      'The globe is a perspective view from space, compressed towards the edges; the disc in the side panel is an azimuthal equidistant projection centred on Taipei, where every straight line from the centre is a great-circle route and distance from the centre is to scale; the outer edge is Taipei’s antipode (near Paraguay), and shapes are increasingly distorted towards it. ' +
      'Near the antipode (Argentina, Paraguay, Uruguay) every direction is about equally far, so the bearing means little (see the Antipodes topic).',
  },
  panelExtra: () => import('./panels/TaipeiViewPanel'),
  overlays: [
    {
      kind: 'lines',
      id: 'circles',
      file: 'circles.json',
      label: { zh: '距離圈（1,000、5,000、10,000…公里）', en: 'Distance rings (1,000, 5,000, 10,000… km)' },
      width: 1,
      color: MAP_TOKENS.inkSecondary,
      lineLabel: (p) => (typeof p.km === 'number' ? kmText(p.km) : ''),
    },
    {
      kind: 'lines',
      id: 'routes',
      file: 'routes.json',
      label: { zh: '到各國首都的大圓航線', en: 'Great-circle routes to capitals' },
      width: 0.6,
      opacity: 0.45,
      color: MAP_TOKENS.categorical[1],
      tooltip: routeTooltip,
    },
    {
      kind: 'points',
      id: 'taipei',
      file: 'taipei.json',
      label: { zh: '台北', en: 'Taipei' },
      radius: 4,
      color: MAP_TOKENS.ink,
      pointLabel: (p) => (getLang() === 'zh' ? String(p.zh ?? '') : String(p.en ?? '')),
      tooltip: () => ({ title: tr({ zh: '台北', en: 'Taipei' }), detail: tr({ zh: '圓盤與距離圈的中心', en: 'Centre of the rings and routes' }) }),
    },
  ],
  indicators: [
    {
      id: 'distance',
      label: { zh: '首都離台北多遠', en: 'Distance from Taipei' },
      description: {
        zh: '台北到各國首都的大圓距離（地球表面的最短距離）。最近的是香港 814、馬尼拉 1,162、首爾 1,484 公里；最遠的亞松森 19,929 公里，快到地球的另一邊（20,015 公里）。點國家看以台北為中心的圓盤圖。',
        en: 'Great-circle distance (the shortest route over the Earth’s surface) from Taipei to each capital. Nearest are Hong Kong (814 km), Manila (1,162 km) and Seoul (1,484 km); farthest is Asunción at 19,929 km, close to the far side of the Earth (20,015 km). Click a country for a map centred on Taipei.',
      },
      unit: 'km',
      file: 'distance.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2000, 5000, 8000, 11000, 14000, 17000] } },
      format: kmText,
      formatTick: (v) => `${fixed(v / 1000, 0)}k`,
      unranked: true,
      lowerIsBetter: true,
      panelChart: false,
    },
    {
      id: 'bearing',
      label: { zh: '在台北的哪個方位', en: 'Direction from Taipei' },
      description: {
        zh: '從台北出發的大圓航線一開始朝哪個方向（八方位）。地圖上看起來在東邊的美國，航線其實一開始往北（北偏東 16°，經過阿拉斯加）；歐洲多在西北，非洲在西南。滑過看準確的角度。',
        en: 'The initial direction of the great-circle route from Taipei (eight compass points). The US looks east on the map, but the route sets off north (16° east of north, passing Alaska); Europe is mostly northwest and Africa southwest. Hover for the exact bearing.',
      },
      unit: '',
      file: 'bearing.json',
      layer: { kind: 'categorical', categories: DIRECTIONS },
      format: (v) => tr(DIRECTIONS.find((d) => d.value === v)?.label ?? ''),
      unranked: true,
      panelChart: false,
    },
    {
      id: 'flight-hours',
      label: { zh: '搭飛機要幾小時（估算）', en: 'Flight time (estimate)' },
      description: {
        zh: '從台北直飛各國首都要幾小時的估算：大圓距離 ÷ 850 公里／小時（客機的巡航速度）＋ 0.5 小時（起飛、爬升、降落）。香港約 1.5 小時、東京 3.0 小時、新加坡 4.3 小時、倫敦 12.0 小時、華盛頓 15.4 小時，最遠的亞松森約 23.9 小時；4 小時內到得了的首都有 17 個、12 小時內 127 個。這只是理論上的直飛時間：多數首都沒有從台北直飛的班機，要轉機；往東順風、往西逆風差 1 小時以上，空域限制也會繞路。用「最長的直飛航線」校正過：新加坡航空紐約–新加坡 15,349 公里實際 18 小時 55 分，公式 18.6 小時；長榮桃園–紐瓦克 12,552 公里實際 14 小時 45 分（往東順風），公式 15.3 小時。',
        en: 'An estimate of the non-stop flight time from Taipei to each capital: great-circle distance ÷ 850 km/h (an airliner’s cruising speed) + 0.5 h (take-off, climb and landing). Hong Kong is about 1.5 hours, Tokyo 3.0, Singapore 4.3, London 12.0 and Washington 15.4, and the farthest, Asunción, about 23.9; 17 capitals are within 4 hours and 127 within 12. These are theoretical non-stop times: most capitals have no direct flight from Taipei, and eastbound flights with tailwinds can be over an hour faster than westbound ones, while airspace restrictions force detours. Checked against the longest non-stop flights: Singapore Airlines’ New York–Singapore (15,349 km) takes 18 h 55 min against 18.6 h by the formula, and EVA Air’s Taoyuan–Newark (12,552 km) 14 h 45 min eastbound against 15.3 h.',
      },
      unit: { zh: '小時', en: 'h' },
      file: 'flight-hours.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 4, 8, 12, 16, 20] } },
      format: hoursText,
      formatTick: (v) => fixed(v, 0),
      unranked: true,
      lowerIsBetter: true,
      panelChart: false,
    },
  ],
  tooltipLines: (iso3, ctx) => {
    if (iso3 === 'TWN') return [];
    const deg = valueOf(lazy('topics/taipei-view/bearing-deg.json'), iso3);
    const km = valueOf(lazy('topics/taipei-view/distance.json'), iso3);
    if (deg === null || km === null) return [];
    if (ctx.indicator === 'distance') return [tr({ zh: `一開始朝${bearingText(deg)}`, en: `Sets off ${bearingText(deg)}` })];
    if (ctx.indicator === 'flight-hours') return [tr({ zh: `大圓距離 ${kmText(km)}`, en: `Great-circle distance ${kmText(km)}` })];
    return [tr({ zh: `${bearingText(deg)}，${kmText(km)}`, en: `${bearingText(deg)}, ${kmText(km)}` })];
  },
};
