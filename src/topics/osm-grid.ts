import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { PointsOverlayDef } from './types';

/**
 * OSM 的 0.1° 網格點圖層（2026-11-08，製作手冊第二十七批 644、645；pipeline/topics/osm_density.py 的 grid）：
 * 點太多（觀景點 26 萬、公共藝術 37 萬、考古遺址 23 萬）時在 QLever 端依代表點分格計數，一格一個點，
 * 同第 438 點的獵人高台（hunting-fishing.ts）。
 */
const S = MAP_TOKENS.sequential;

export function osmGrid(id: string, file: string, label: Text, indicators: string[], what: { zh: string; en: string }): PointsOverlayDef {
  return {
    kind: 'points',
    id,
    file,
    label,
    indicators,
    radius: { field: 'n', stops: [[1, 1.6], [10, 2.2], [100, 3], [400, 3.6]] },
    color: {
      field: 'n',
      title: { zh: '一格幾處', en: 'Per cell' },
      thresholds: [5, 25, 100, 250],
      classes: [
        { color: S[1], label: '1–4' },
        { color: S[2], label: '5–24' },
        { color: S[4], label: '25–99' },
        { color: S[5], label: '100–249' },
        { color: S[6], label: { zh: '250 處以上', en: '250+' } },
      ],
    },
    sortField: 'n',
    tooltip: (p) => ({
      title: tr({ zh: `${fixed(Number(p.n), 0)} 處${what.zh}`, en: `${fixed(Number(p.n), 0)} ${what.en}` }),
      detail: tr({ zh: '經緯度 0.1° 的格子（約 10 公里，OpenStreetMap）', en: 'A 0.1° grid cell (about 10 km, OpenStreetMap)' }),
    }),
  };
}
