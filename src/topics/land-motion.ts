import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, PointsOverlayDef, SourceDef } from './types';

/**
 * 國土一年升降幾公釐（2026-11-08，製作手冊第二十七批 547，候選 1234；pipeline/topics/land_motion.py）：
 * Nevada Geodetic Laboratory 的 MIDAS 速度場（IGS20），各國是境內 GNSS 測站垂直速度的中位數，加上測站的點。
 */

const MM_YR = { zh: '公釐／年', en: 'mm/yr' };
/** 帶正負號、用真正的減號：+0.55、−24.2 */
const signedMm = (v: number) => {
  const digits = Math.abs(v) < 1 && v !== 0 ? 2 : 1;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${fixed(Math.abs(v), digits)}`;
};
const mmText = (v: number) => tr({ zh: `${signedMm(v)} 公釐／年`, en: `${signedMm(v)} mm/yr` });

/** 測站的分級（公釐／年）：7 級，負的（下沉）橘、正的（上升）青綠，跟面量圖的發散色同一組 */
const STATION_T = [-10, -3, -1, 1, 3, 10];

export const LAND_MOTION_SOURCES: SourceDef[] = [
  {
    name: {
      zh: 'Nevada Geodetic Laboratory 的 MIDAS GNSS 速度場（IGS20，Nevada Bureau of Mines and Geology, University of Nevada, Reno；Blewitt, Hammond & Kreemer 2018, Eos 99；MIDAS：Blewitt et al. 2016, JGR 121）',
      en: 'Nevada Geodetic Laboratory MIDAS GNSS velocity field (IGS20; Nevada Bureau of Mines and Geology, University of Nevada, Reno; Blewitt, Hammond & Kreemer 2018, Eos 99; MIDAS: Blewitt et al. 2016, JGR 121)',
    },
    url: 'https://geodesy.unr.edu/gps_timeseries/IGS20/midas/',
    license: {
      zh: 'CC BY 4.0（NBMG 的資料政策；本站取各國測站的中位數；各測站的資料引用見 NGL 的測站頁）',
      en: 'CC BY 4.0 (NBMG data policy; country medians computed by this site; per-station citations are on the NGL station pages)',
    },
  },
];

export const LAND_MOTION_INDICATOR: IndicatorDef = {
  id: 'land-motion',
  label: { zh: '國土一年升降幾公釐', en: 'How fast the land rises or sinks' },
  description: {
    zh: '全球 GNSS（GPS 等衛星定位）連續站測到的地面每年上升或下沉幾公釐，各國取境內測站的中位數（Nevada Geodetic Laboratory 的 MIDAS 速度場，IGS20 框架，2026 年 11 月的版本；只用觀測至少 3 年、垂直速度誤差 2 公釐以內的 17,537 站，境內至少 3 站的 131 國上色）。冰期結束後地殼還在回彈、冰帽還在變薄的北方上升最快：冰島 +11.6、格陵蘭 +6.3、瑞典 +6.1、芬蘭 +5.8、挪威 +4.4；下沉最多的是越南 −4.8（河內的站 −29.9）、安哥拉 −4.2、孟加拉 −4.2（吉大港的站 −32.0）、伊拉克 −4.0。單一測站以墨西哥城的 MMX1 每年 −264.9 公釐最快（抽地下水）。台灣 127 站的中位數 +0.55，雲林的 HUWE 站 −24.2（地層下陷）。測站集中在都市與板塊邊界，中位數不等於全國的平均；測站少的國家要小心看（盧安達 7 站的中位數 +6.1）。滑過國家看測站數與上升、下沉最快的站。',
    en: 'How many millimetres a year the ground rises or sinks, as measured by continuous GNSS (GPS and similar) stations; each country shows the median of the stations within it (Nevada Geodetic Laboratory MIDAS velocity field, IGS20 frame, November 2026 release; only the 17,537 stations with at least 3 years of data and a vertical uncertainty of 2 mm or less are used, and the 131 countries with at least 3 stations are coloured). The north, where the crust is still rebounding from the last ice age and ice caps are thinning, rises fastest: Iceland +11.6, Greenland +6.3, Sweden +6.1, Finland +5.8, Norway +4.4. Vietnam sinks most at −4.8 (a Hanoi station −29.9), then Angola −4.2, Bangladesh −4.2 (a Chittagong station −32.0) and Iraq −4.0. The fastest single station is MMX1 in Mexico City at −264.9 mm a year (groundwater pumping). Taiwan’s 127 stations have a median of +0.55, with HUWE in Yunlin at −24.2 (land subsidence). Stations cluster in cities and along plate boundaries, so the median is not a national average; read countries with few stations with care (Rwanda’s 7 stations give +6.1). Hover for the number of stations and the fastest rising and sinking ones.',
  },
  unit: MM_YR,
  file: 'land-motion.json',
  layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-3, -1, -0.3, 0.3, 1, 3] } },
  format: mmText,
  formatTick: (v) => signedMm(v),
};

export const LAND_MOTION_STATIONS: PointsOverlayDef = {
  kind: 'points',
  id: 'land-motion-stations',
  file: 'land-motion-stations.json',
  label: { zh: 'GNSS 測站的垂直速度', en: 'Vertical velocity of GNSS stations' },
  indicators: ['land-motion'],
  radius: 2.5,
  color: {
    field: 'v',
    title: { zh: '公釐／年（負的是下沉）', en: 'mm/yr (negative is sinking)' },
    thresholds: STATION_T,
    classes: MAP_TOKENS.diverging.map((color, i) => ({
      color,
      label:
        i === 0
          ? `< −${Math.abs(STATION_T[0])}`
          : i === STATION_T.length
            ? `≥ +${STATION_T[i - 1]}`
            : `${signedMm(STATION_T[i - 1])} – ${signedMm(STATION_T[i])}`,
    })),
  },
  tooltip: (p, { countryName }) => {
    const v = typeof p.v === 'number' ? p.v : null;
    const y0 = typeof p.y0 === 'number' ? p.y0 : null;
    const y1 = typeof p.y1 === 'number' ? p.y1 : null;
    const span = y0 !== null && y1 !== null ? tr({ zh: `觀測 ${fixed(y0, 1)}–${fixed(y1, 1)} 年`, en: `Observed ${fixed(y0, 1)}–${fixed(y1, 1)}` }) : '';
    return {
      title: tr({ zh: `GNSS 測站 ${String(p.s ?? '')}`, en: `GNSS station ${String(p.s ?? '')}` }),
      detail: v === null ? undefined : `${mmText(v)}${v < 0 ? tr({ zh: '（下沉）', en: ' (sinking)' }) : v > 0 ? tr({ zh: '（上升）', en: ' (rising)' }) : ''}`,
      extra: [span, typeof p.iso3 === 'string' ? countryName(p.iso3) : ''].filter(Boolean),
    };
  },
};
