import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { PointRecord, TopicDefinition } from './types';

/**
 * 高壓直流輸電（HVDC）與跨國電力聯網（新主題，2026-11-07，製作手冊第二十七批 609，候選 1338；能源・電力）：
 * 英文維基「List of HVDC projects」固定版本，pipeline/topics/hvdc.py。兩端都有座標的點對點線畫成直線（不是實際路徑），
 * 背對背式畫成點；國家的合計用清單裡的全部專案。
 */
const n0 = (v: number) => fixed(v, 0);
const mw = (v: number) => tr({ zh: `${n0(v)} MW`, en: `${n0(v)} MW` });
const VOLTAGE = [
  { value: 1, color: MAP_TOKENS.categorical[0], label: { zh: '500 kV 以下', en: 'Below 500 kV' } },
  { value: 2, color: MAP_TOKENS.categorical[1], label: { zh: '500–799 kV', en: '500–799 kV' } },
  { value: 3, color: MAP_TOKENS.categorical[2], label: { zh: '800 kV 以上（特高壓）', en: '800 kV and above (UHV)' } },
];

function tooltip(p: PointRecord, { countryName }: { countryName: (iso3: string) => string }) {
  const parts = [
    typeof p.mw === 'number' ? mw(p.mw) : null,
    typeof p.kv === 'number' ? `${n0(p.kv)} kV` : null,
    typeof p.len === 'number' && p.len ? tr({ zh: `${n0(p.len)} 公里`, en: `${n0(p.len)} km` }) : null,
    typeof p.year === 'number' ? tr({ zh: `${p.year} 年啟用`, en: `in service ${p.year}` }) : null,
    [p.c1, p.c2].filter((c, i, a): c is string => typeof c === 'string' && c !== '' && a.indexOf(c) === i).map(countryName).join('–') || null,
  ];
  return { title: String(p.name ?? ''), properNoun: String(p.name ?? ''), detail: parts.filter(Boolean).join(' · ') };
}

export const hvdc: TopicDefinition = {
  id: 'hvdc',
  title: { zh: '高壓直流輸電（HVDC）與跨國電力聯網', en: 'High-voltage direct current (HVDC) links' },
  shortTitle: { zh: '高壓直流輸電', en: 'HVDC links' },
  defaultIndicator: 'hvdc-capacity',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: '英文維基百科「List of HVDC projects」（revid 1378703816）', en: 'English Wikipedia, “List of HVDC projects” (revision 1378703816)' },
      url: 'https://en.wikipedia.org/w/index.php?title=List_of_HVDC_projects&oldid=1378703816',
      license: 'CC BY-SA 4.0',
    },
  ],
  note: {
    zh: '高壓直流輸電用直流把大量電力送到很遠的地方，或用海底電纜連起兩國的電網；背對背式只有一座換流站，把兩個頻率或相位不同步的交流電網接在一起。資料是英文維基的專案清單（固定版本），只用名稱、換流站、長度、電壓、功率與啟用年份這些事實；清單不完整，數字只是清單裡有的。線是兩座換流站之間的直線，不是實際的路徑；兩端都有座標的才畫（166 條點對點裡 115 條）。只算 2026 年以前啟用的，備註寫停用、拆除的不算；另有 32 個規劃或興建中的專案。台灣沒有高壓直流線（台灣是獨立電網）。',
    en: 'HVDC links carry large amounts of power over long distances in direct current or join two countries’ grids with submarine cables; back-to-back stations have a single converter station joining two AC grids that are not synchronised. Data come from English Wikipedia’s list of projects (a fixed revision), using only facts such as names, converter stations, length, voltage, power and year; the list is incomplete, so figures cover only the projects listed. Lines are straight between the two converter stations, not actual routes, and are drawn only where both ends have coordinates (115 of 166 point-to-point links). Only links in service by 2026 are counted, excluding those noted as decommissioned; 32 further projects are planned or under construction. Taiwan has no HVDC links (its grid is isolated).',
  },
  overlays: [
    {
      kind: 'lines',
      id: 'hvdc-lines',
      file: 'lines.json',
      label: { zh: '高壓直流輸電線（兩端連成直線）', en: 'HVDC links (straight between stations)' },
      width: { field: 'mw', stops: [[100, 1], [1000, 2], [3000, 3.5], [8000, 6]] },
      timeField: 'year',
      color: { title: { zh: '電壓', en: 'Voltage' }, classes: VOLTAGE },
      tooltip,
      sizeLegend: { title: { zh: '輸送功率', en: 'Power' }, values: [500, 2000, 8000], format: mw },
    },
    {
      kind: 'points',
      id: 'hvdc-b2b',
      file: 'back-to-back.json',
      label: { zh: '背對背式換流站', en: 'Back-to-back converter stations' },
      radius: { field: 'mw', stops: [[50, 2], [500, 3.5], [3000, 6]] },
      color: MAP_TOKENS.hues.red,
      timeField: 'year',
      tooltip,
    },
  ],
  indicators: [
    {
      id: 'hvdc-capacity',
      label: { zh: '高壓直流輸電的輸送功率', en: 'HVDC transmission capacity' },
      description: {
        zh: '這一國高壓直流輸電專案的輸送功率合計（跨國的線兩端國家各算一次），依啟用年份累計。2026 年中國 173,842 MW 遠遠最多（長距離的特高壓線，例如 2017 年的錫林浩特—泰州 10,000 MW），印度 24,604、巴西 24,254（伊泰普與馬德拉河的水力送到東南部）、英國 20,940（跟歐陸、愛爾蘭的海纜與蘇格蘭的海底線）、美國 16,346、德國 14,140、加拿大 13,008、俄羅斯 7,469。點線看名稱、功率、電壓與年份。',
        en: 'Total power rating of HVDC projects in a country (cross-border links count for both ends), accumulated by year in service. In 2026 China leads by far with 173,842 MW (long-distance UHV lines such as the 10,000 MW Xilin Hot–Taizhou link of 2017), followed by India 24,604, Brazil 24,254 (bringing Itaipu and Madeira River hydropower to the south-east), the UK 20,940 (submarine links to the continent and Ireland, and around Scotland), the US 16,346, Germany 14,140, Canada 13,008 and Russia 7,469. Hover a line for its name, power, voltage and year.',
      },
      unit: 'MW',
      file: 'capacity.json',
      layer: { kind: 'bubble', legendValues: [1000, 10000, 100000] },
      format: mw,
      formatTick: formatLargeTick,
      shareOfWorld: true,
      overlayTime: 'cumulative',
      missing: { zh: '清單裡沒有高壓直流輸電', en: 'No HVDC links in the list' },
    },
  ],
};
