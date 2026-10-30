import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { PointRecord, TopicDefinition } from './types';

/**
 * 臭氧洞（pipeline/topics/ozone_hole.py）：NASA Ozone Watch 每年臭氧洞面積最大那一天的 220 DU 等值線。
 * 使用者 2026-10-30 決定「一年一張」：畫南極 9–10 月最大的臭氧洞範圍，不做每天的全球動畫。
 * 面積與最低值用 Ozone Watch 的年表（1979 年起，1995 年沒有資料），國家的值只有南極洲。
 */

export const FIRST_YEAR = 1979;
export const LAST_YEAR = 2025;

const SATELLITES: Record<string, string> = {
  nimbus7: 'Nimbus-7 TOMS',
  meteor3: 'Meteor-3 TOMS',
  eptoms: 'Earth Probe TOMS',
  omi: 'Aura OMI',
  omps: 'Suomi NPP OMPS',
  omps_n20: 'NOAA-20 OMPS',
};

/** 月日（917）寫成「9 月 17 日」／「17 Sep」 */
function monthDay(v: unknown): string {
  if (typeof v !== 'number') return '';
  const m = Math.floor(v / 100);
  const d = v % 100;
  const en = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
  return tr({ zh: `${m} 月 ${d} 日`, en: `${d} ${en}` });
}

const millionKm2 = (v: number) => tr({ zh: `${fixed(v, 1)} 百萬 km²`, en: `${fixed(v, 1)} million km²` });

function holeTooltip(p: PointRecord) {
  const extra = [
    typeof p.min === 'number' ? tr({ zh: `這一季最低 ${fixed(p.min, 0)} DU（${monthDay(p.md)}）`, en: `Season low ${fixed(p.min, 0)} DU (${monthDay(p.md)})` }) : '',
    tr({ zh: `衛星：${SATELLITES[String(p.sat)] ?? String(p.sat)}`, en: `Satellite: ${SATELLITES[String(p.sat)] ?? String(p.sat)}` }),
  ].filter(Boolean);
  return {
    title: tr({ zh: `${String(p.year)} 年的臭氧洞`, en: `Ozone hole, ${String(p.year)}` }),
    detail: tr({
      zh: `最大的一天 ${monthDay(p.d)}：${millionKm2(Number(p.area))}`,
      en: `Largest on ${monthDay(p.d)}: ${millionKm2(Number(p.area))}`,
    }),
    extra,
  };
}

const ONLY_ANTARCTICA = { zh: '臭氧洞在南極上空（國家的值只有南極洲）', en: 'The ozone hole is over Antarctica (only Antarctica has a value)' };

export const ozoneHole: TopicDefinition = {
  id: 'ozone-hole',
  title: { zh: '南極臭氧洞', en: 'The Antarctic ozone hole' },
  shortTitle: { zh: '臭氧洞', en: 'Ozone hole' },
  defaultIndicator: 'area',
  defaultYear: LAST_YEAR,
  focus: [-180, -90, 180, -40],
  sources: [
    {
      name: {
        zh: 'NASA Ozone Watch（每日 1° 臭氧全量網格：Nimbus-7、Meteor-3、Earth Probe TOMS、Aura OMI、OMPS；每年的臭氧洞面積與最低值）',
        en: 'NASA Ozone Watch (daily 1° total ozone grids from Nimbus-7, Meteor-3 and Earth Probe TOMS, Aura OMI and OMPS; annual ozone hole area and minimum)',
      },
      url: 'https://ozonewatch.gsfc.nasa.gov/',
      license: { zh: 'NASA 公開資料（CC0）', en: 'NASA public data (CC0)' },
    },
  ],
  note: {
    zh:
      '臭氧洞是南極上空臭氧全量低於 220 DU（多布森單位）的範圍：冬天極地平流層雲上的氯、溴化合物在 9 月春天的陽光下大量破壞臭氧，10 月以後漸漸填回來。橘紅色的線是每年臭氧洞面積最大的那一天（Ozone Watch 年表的日期）的 220 DU 等值線，面積與這一季的最低值也取自年表（1979 年起，1995 年沒有衛星資料）。' +
      '線是用那一天的衛星網格畫的：衛星靠反射的陽光量臭氧，極夜的地方與軌道之間的空隙沒有量測（檔案裡是 0），Ozone Watch 的圖用 NASA 的 GEOS 模式補，資料檔沒有補；這裡把空隙依同一條緯線左右內插、極點附近的極夜用北邊的值往南延伸，所以極點附近的線是推的。用這樣補過的網格算的面積跟年表的數字差不到 1 百萬 km²。' +
      '衛星：1979–1992 年 Nimbus-7 TOMS、1993–1994 年 Meteor-3 TOMS、1996–2004 年 Earth Probe TOMS、2005 年起 Aura OMI（OMI 那一天少了一半軌道的 2014、2019 年改用 Suomi NPP 的 OMPS）。地圖在地球儀上看最清楚，平面的麥卡托投影會把南極拉得很大。' +
      '《蒙特婁議定書》（1987）管制氟氯碳化物之後，臭氧洞 2000 年代起不再擴大，預計 2060 年代前後恢復到 1980 年的程度。台灣上空的臭氧全量一年裡大約在 250–290 DU 之間（2025 年 1 月中約 250、7 月中約 290 DU），沒有臭氧洞。資料：NASA Ozone Watch（「Please credit all material to NASA Ozone Watch」），NASA 的資料政策是 CC0。',
    en:
      'The ozone hole is the area over Antarctica where total column ozone falls below 220 Dobson units (DU): chlorine and bromine activated on winter polar stratospheric clouds destroy ozone rapidly when sunlight returns in September, and the hole fills in after October. The orange-red line is the 220 DU contour on the day each year when the hole was largest (the date in Ozone Watch’s annual table); area and the season’s minimum also come from that table (from 1979; no satellite data for 1995). ' +
      'The line is drawn from that day’s satellite grid. The instruments measure reflected sunlight, so there are no measurements in the polar night or in gaps between orbits (zeros in the files); Ozone Watch’s images fill them from NASA’s GEOS model, but its data files do not. Here gaps are interpolated along each latitude circle and polar-night cells near the pole take the value from the next cell north, so the line near the pole is inferred. Areas computed from this filled grid are within 1 million km² of the table. ' +
      'Satellites: Nimbus-7 TOMS 1979–1992, Meteor-3 TOMS 1993–1994, Earth Probe TOMS 1996–2004 and Aura OMI from 2005 (Suomi NPP OMPS for 2014 and 2019, when OMI lacked half its orbits that day). The globe shows it best; the flat Mercator map greatly enlarges Antarctica. ' +
      'Since the Montreal Protocol (1987) phased out CFCs the hole has stopped growing since the 2000s and is expected to return to 1980 levels around the 2060s. Ozone over Taiwan ranges roughly from 250 to 290 DU through the year (about 250 in mid-January and 290 in mid-July 2025); there is no ozone hole there. Data: NASA Ozone Watch (“Please credit all material to NASA Ozone Watch”); NASA’s data policy is CC0.',
  },
  overlays: [
    {
      kind: 'lines',
      id: 'holes',
      file: 'holes.json',
      label: { zh: '臭氧洞最大的一天（220 DU）', en: 'Ozone hole at its largest (220 DU)' },
      width: 2.6,
      timeField: 'year',
      color: MAP_TOKENS.sequential[3],
      casing: true,
      tooltip: (p) => holeTooltip(p),
    },
  ],
  indicators: [
    {
      id: 'area',
      label: { zh: '臭氧洞的最大面積', en: 'Largest ozone hole area' },
      description: {
        zh: '每年 9–10 月臭氧洞（臭氧全量低於 220 DU）面積最大那一天的範圍，橘紅色的線是那一天的邊界。點南極洲看歷年的變化；2000 年 9 月 9 日的 2,990 萬 km² 最大。',
        en: 'The extent of the ozone hole (total ozone below 220 DU) on its largest day each September–October; the orange-red line is that day’s edge. Click Antarctica for the history; the record was 29.9 million km² on 9 September 2000.',
      },
      unit: { zh: '百萬 km²', en: 'million km²' },
      file: 'area.json',
      layer: { kind: 'none' },
      format: millionKm2,
      formatTick: (v) => fixed(v, 0),
      coverage: { countries: ['ATA'], reason: ONLY_ANTARCTICA },
      unranked: true,
    },
    {
      id: 'minimum',
      label: { zh: '一季裡最低的臭氧', en: 'Season’s lowest ozone' },
      description: {
        zh: '每年 9–10 月南極上空臭氧全量的最低值（DU，越低越嚴重）。1994 年 9 月 30 日的 73 DU 最低；線一樣是那一年臭氧洞最大那一天的範圍。',
        en: 'The lowest total ozone over Antarctica each September–October (DU; lower is worse). The record low was 73 DU on 30 September 1994; the line is still that year’s largest extent.',
      },
      unit: 'DU',
      file: 'minimum.json',
      layer: { kind: 'none' },
      format: (v) => `${fixed(v, 0)} DU`,
      formatTick: (v) => fixed(v, 0),
      coverage: { countries: ['ATA'], reason: ONLY_ANTARCTICA },
      unranked: true,
    },
  ],
};
