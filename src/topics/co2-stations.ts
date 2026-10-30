import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, PointRecord, TopicDefinition } from './types';

/**
 * 全球二氧化碳觀測站（pipeline/topics/co2_stations.py）：NOAA GML 合作採樣網每週瓶採樣的月平均 CO2。
 * 使用者 2026-10-30 決定用每週採樣的月平均（不用茂納羅亞的連續觀測），點站看濃度曲線；台灣有鹿林山。
 * 點的顏色是時間軸那一年的年平均（12 個月裡有 9 個月以上才算），沒有年平均的年份不畫。
 */

export const FIRST_YEAR = 1968;
export const LAST_YEAR = 2025;
const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);

const ppm = (v: number) => `${fixed(v, 1)} ppm`;

const THRESHOLDS = [330, 350, 370, 390, 410, 425];
const CO2_COLORS: ColorClasses = {
  field: 'v',
  title: { zh: '年平均濃度', en: 'Annual mean' },
  thresholds: THRESHOLDS,
  classes: MAP_TOKENS.sequential.map((color, i) => ({
    color,
    label:
      i === 0
        ? `< ${THRESHOLDS[0]} ppm`
        : i === THRESHOLDS.length
          ? `≥ ${THRESHOLDS[i - 1]} ppm`
          : `${THRESHOLDS[i - 1]}–${THRESHOLDS[i]} ppm`,
  })),
};

export function siteName(p: PointRecord, lang = getLang()): string {
  if (lang === 'zh' && typeof p.zh === 'string') return p.zh;
  return String(p.en ?? p.zh ?? '');
}

/** 年月（200608）寫成 2006/8 */
const ym = (v: unknown) => (typeof v === 'number' ? `${Math.floor(v / 100)}/${v % 100}` : '');

/** 採樣期間與海拔 */
export function siteFacts(p: PointRecord): string {
  const parts: string[] = [];
  const end = typeof p.l === 'number' && p.l >= LAST_YEAR * 100 ? tr({ zh: '至今', en: 'present' }) : ym(p.l);
  parts.push(tr({ zh: `採樣 ${ym(p.f)}–${end}`, en: `sampled ${ym(p.f)}–${end}` }));
  if (typeof p.h === 'number') parts.push(tr({ zh: `海拔 ${fixed(p.h, 0)} m`, en: `${fixed(p.h, 0)} m above sea level` }));
  return parts.join(' · ');
}

const stationsText = (v: number) => tr({ zh: `${fixed(v, 0)} 站`, en: `${fixed(v, 0)} ${v === 1 ? 'station' : 'stations'}` });

export const co2Stations: TopicDefinition = {
  id: 'co2-stations',
  title: { zh: '全球二氧化碳觀測站', en: 'Carbon dioxide monitoring stations' },
  shortTitle: { zh: '二氧化碳觀測站', en: 'CO₂ stations' },
  defaultIndicator: 'stations',
  defaultYear: LAST_YEAR,
  sources: [
    {
      name: {
        zh: 'NOAA GML 合作全球大氣採樣網（瓶採樣的二氧化碳月平均；Lan et al., doi:10.15138/wkgj-f215，2026-07-17 版）',
        en: 'NOAA GML Carbon Cycle Cooperative Global Air Sampling Network (flask CO₂ monthly means; Lan et al., doi:10.15138/wkgj-f215, version 2026-07-17)',
      },
      url: 'https://gml.noaa.gov/ccgg/flask.html',
      license: 'CC0 1.0',
    },
  ],
  note: {
    zh:
      '點是 NOAA 全球監測實驗室（GML）合作採樣網的固定測站：各站大約每週採一次空氣樣本（玻璃瓶），送回美國波德的實驗室量二氧化碳，這裡用 NOAA 算好的月平均。點的顏色是時間軸那一年的年平均（12 個月裡有 9 個月以上的資料才算；月份不齊時會被季節的起伏拉偏），沒有年平均的年份不畫，已經停止的站也會從那一年起消失。' +
      '瓶採樣一週一次，跟茂納羅亞的連續觀測（常引用的「基林曲線」）數字略有不同，2025 年茂納羅亞的瓶採樣是 427.4 ppm。濃度在北半球比南半球高一點、有明顯的季節起伏（北半球春天最高、秋天最低）。' +
      '採樣網另有 22 組在船上沿航線採的樣本（太平洋依緯度帶、南海、德瑞克海峽），沒有固定位置，不畫。站的國家依實際位置（百慕達、關島、格陵蘭等是地圖上自己的形狀，南極的站算南極洲，北大西洋與挪威海的兩艘定點觀測船沒有國家，中途島算美國）。' +
      '台灣有三站：鹿林山（玉山國家公園內的鹿林山大氣背景站，海拔 2,862 m，2006 年 8 月起，NOAA 的合作單位是國立中央大學）、東沙島（2010 年起）與太平島（2019 年起）。' +
      'NOAA 以 CC0 1.0 釋出這些資料，並請引用 Lan et al.。排放量見「溫室氣體排放」主題。',
    en:
      'Dots are the fixed sites of the NOAA Global Monitoring Laboratory (GML) Cooperative Global Air Sampling Network: roughly once a week an air sample is taken in a glass flask at each site and shipped to the lab in Boulder for CO₂ analysis; these are NOAA’s monthly means. A dot’s colour is that year’s annual mean (computed only when 9 or more months have data, since gaps let the seasonal cycle bias the mean); years without an annual mean are not drawn, so stations that stopped disappear from that year on. ' +
      'Weekly flask samples differ slightly from the continuous measurements at Mauna Loa (the often-quoted Keeling curve); the 2025 Mauna Loa flask mean was 427.4 ppm. Concentrations are a little higher in the northern than the southern hemisphere and swing with the seasons (highest in northern spring, lowest in autumn). ' +
      'The network also samples along 22 ship routes (Pacific latitude bands, the South China Sea, the Drake Passage) without fixed positions; they are not shown. A site’s country follows its actual location (Bermuda, Guam, Greenland and the like have their own shapes, Antarctic sites count as Antarctica, the two ocean weather ships in the North Atlantic and the Norwegian Sea have no country, and Midway counts as the United States). ' +
      'Taiwan has three sites: Lulin (the Lulin Atmospheric Background Station in Yushan National Park, 2,862 m, since August 2006, with National Central University as NOAA’s partner), Dongsha Island (since 2010) and Taiping Island (since 2019). ' +
      'NOAA releases the data under CC0 1.0 and asks users to cite Lan et al. For emissions, see Greenhouse gas emissions.',
  },
  panelExtra: () => import('./panels/Co2StationsPanel'),
  overlays: [
    {
      kind: 'points',
      id: 'sites',
      file: 'stations.json',
      label: { zh: '觀測站（年平均濃度）', en: 'Stations (annual mean)' },
      radius: 4.2,
      color: CO2_COLORS,
      sortField: 'v',
      epochs: { years: YEARS, values: (p, year) => ({ v: typeof p[`y${year}`] === 'number' ? (p[`y${year}`] as number) : null }) },
      minValue: { field: 'v', stops: [[0, 0]] },
      tooltip: (p, ctx) => {
        const name = siteName(p);
        const country = typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null;
        const year = ctx.year;
        const v = p[`y${year}`];
        return {
          title: name,
          detail: [typeof v === 'number' ? tr({ zh: `${year} 年平均 ${ppm(v)}`, en: `${ppm(v)} (${year} mean)` }) : null, country]
            .filter(Boolean)
            .join(' · '),
          extra: [siteFacts(p), tr({ zh: `站碼 ${String(p.code)}`, en: `site code ${String(p.code)}` })],
          properNoun: getLang() === 'zh' && typeof p.en === 'string' ? p.en : undefined,
        };
      },
    },
  ],
  indicators: [
    {
      id: 'stations',
      label: { zh: '觀測站的二氧化碳濃度', en: 'CO₂ at monitoring stations' },
      description: {
        zh: '每個點是一個觀測站，顏色是那一年的二氧化碳年平均濃度（ppm），播放時間軸看濃度一年年升高。點一下站看月平均的濃度曲線。國家的值是那一年有在採樣的站數。',
        en: 'Each dot is a monitoring station, coloured by that year’s mean CO₂ concentration (ppm); play the timeline to watch it rise year after year. Click a station for its monthly curve. A country’s value is the number of stations sampling that year.',
      },
      unit: { zh: '站', en: 'stations' },
      file: 'stations-count.json',
      layer: { kind: 'none' },
      format: stationsText,
      formatTick: (v) => fixed(v, 0),
      integer: true,
      panelChart: false,
    },
  ],
};
