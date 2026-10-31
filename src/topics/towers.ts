import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, SourceDef } from './types';

/**
 * 摩天大樓的擴充：電視塔與觀景塔（2026-10-31，製作手冊第十批 183；pipeline/topics/towers.py，DESIGN.md 第 8 節第 265 點）。
 * Wikidata 150 m 以上的電視塔、觀景塔與電信塔，拉線式的天線桅杆不算；左邊的清單依高度。
 */

const TYPES: { value: number; label: Text; color: string }[] = [
  { value: 1, label: { zh: '電視塔', en: 'TV tower' }, color: MAP_TOKENS.categorical[7] },
  { value: 2, label: { zh: '觀景塔', en: 'Observation tower' }, color: MAP_TOKENS.categorical[0] },
  { value: 3, label: { zh: '電信塔、地標塔', en: 'Communication or landmark tower' }, color: MAP_TOKENS.categorical[4] },
];
const typeLabel = (t: unknown) => tr(TYPES.find((x) => x.value === t)?.label ?? '');

function towerName(p: PointRecord): { title: string; proper?: string } {
  const zh = typeof p.zh === 'string' && p.zh ? p.zh : null;
  const en = String(p.en ?? '');
  return getLang() === 'zh' && zh ? { title: zh, proper: en } : { title: en };
}

const metres = (v: number) => tr({ zh: `${fixed(v, v % 1 ? 1 : 0)} 公尺`, en: `${fixed(v, v % 1 ? 1 : 0)} m` });

function facts(p: PointRecord, countryName: (iso3: string) => string): string[] {
  return [
    [typeLabel(p.t), metres(Number(p.h)), typeof p.y === 'number' ? tr({ zh: `${p.y} 年啟用`, en: `opened ${p.y}` }) : null].filter(Boolean).join(' · '),
    [typeof p.iso3 === 'string' ? countryName(p.iso3) : null, typeof p.d === 'number' ? tr({ zh: `${Number(p.d) - 1} 年拆除`, en: `demolished ${Number(p.d) - 1}` }) : null]
      .filter(Boolean)
      .join(' · '),
  ].filter(Boolean);
}

const INDICATORS = ['towers'];

const TOWERS: PointsOverlayDef = {
  kind: 'points',
  id: 'towers',
  file: 'towers.json',
  label: { zh: '150 m 以上的電視塔與觀景塔', en: 'TV and observation towers 150 m+' },
  indicators: INDICATORS,
  radius: { field: 'h', stops: [[150, 2.5], [250, 4], [400, 6], [634, 9]] },
  color: { field: 't', title: { zh: '類型', en: 'Type' }, thresholds: [1.5, 2.5], classes: TYPES.map(({ label, color }) => ({ label, color })) },
  sortField: 'h',
  timeField: 'y',
  endField: 'd',
  sizeLegend: { title: { zh: '高度', en: 'Height' }, values: [200, 400, 600], format: metres },
  tooltip: (p, { countryName }) => {
    const { title, proper } = towerName(p);
    return { title, extra: facts(p, countryName), properNoun: proper };
  },
};

/** 左邊的清單：依高度，點了移過去 */
const LIST: ListPanelDef = {
  label: { zh: '電視塔與觀景塔（依高度）', en: 'Towers by height' },
  indicators: INDICATORS,
  file: 'towers.json',
  rows: (points, { countryName, year }) =>
    [...points]
      .sort((a, b) => Number(b.h) - Number(a.h))
      .map((p, i): ListRow => {
        const { title, proper } = towerName(p);
        const notYet = typeof p.y === 'number' && p.y > year;
        const gone = typeof p.d === 'number' && p.d <= year;
        return {
          key: `${p.en}-${i}`,
          title: `${i + 1}. ${title}`,
          lines: facts(p, countryName),
          properNoun: proper,
          // 時間軸那一年還沒蓋好或已經拆除的淡一點
          muted: notYet || gone,
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 13 },
        };
      }),
};

export const towersExtra: { sources: SourceDef[]; overlays: PointsOverlayDef[]; indicators: IndicatorDef[]; listPanel: ListPanelDef } = {
  sources: [
    { name: { zh: 'Wikidata（150 m 以上的電視塔、觀景塔、電信塔）', en: 'Wikidata (TV, observation and communication towers 150 m+)' }, url: 'https://www.wikidata.org/wiki/Q11166728', license: 'CC0' },
  ],
  overlays: [TOWERS],
  listPanel: LIST,
  indicators: [
    {
      id: 'towers',
      label: { zh: '電視塔與觀景塔', en: 'TV and observation towers' },
      description: {
        zh: 'Wikidata 收錄、150 m 以上的電視塔、觀景塔與電信塔（不是給人住、辦公的樓，摩天大樓的指標不算它們），依啟用年份出現，國家的值是那一年有幾座。東京晴空塔 634 m 最高，其次廣州塔 600 m、CN 塔 553.3 m、莫斯科奧斯坦金諾塔 540.1 m、上海東方明珠 468 m。拉線式的天線桅杆（美國的電視桅杆多半比這些塔高）不算；高度是 Wikidata 寫的（多半含天線）。德國、中國各 12 座最多；台灣沒有 150 m 以上的塔。左邊的清單依高度排，那一年還沒蓋好的淡一點。',
        en: 'TV, observation and communication towers of 150 m or more in Wikidata (structures not made for living or working in, so not counted as skyscrapers), shown from their opening year; a country’s value is how many stand that year. Tokyo Skytree is the tallest at 634 m, followed by the Canton Tower (600 m), the CN Tower (553.3 m), Moscow’s Ostankino Tower (540.1 m) and Shanghai’s Oriental Pearl Tower (468 m). Guyed antenna masts (many in the US are taller than these towers) are excluded; heights are as given in Wikidata (mostly including antennas). Germany and China have the most with 12 each; Taiwan has no tower of 150 m or more. The list on the left is sorted by height, with towers not yet built in the selected year greyed out.',
      },
      unit: { zh: '座', en: 'towers' },
      file: 'towers-count.json',
      layer: { kind: 'bubble', legendValues: [1, 5, 10] },
      overlayTime: 'cumulative',
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 座`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'tower' : 'towers'}` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
  ],
};
