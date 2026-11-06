import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { PointRecord, PointsOverlayDef } from './types';

/**
 * 隕石撞擊坑（特殊地形主題）與海溝（海洋與漁業主題）的點圖層（2026-11-06，參考 tectonicplatemap.org，使用者選「板7」；
 * pipeline/topics/craters_trenches.py，Wikidata CC0）
 */

const nameOf = (p: PointRecord) => String((getLang() === 'zh' ? p.zh || p.en : p.en || p.zh) ?? '');

/** 「約 6,600 萬年前」「約 20 億年前」 */
function ageText(ma: number): string {
  const years = ma * 1e6;
  if (years >= 1e8) return tr({ zh: `約 ${fixed(years / 1e8, 1)} 億年前`, en: ma >= 1000 ? `about ${fixed(ma / 1000, 1)} billion years ago` : `about ${fixed(ma, 0)} million years ago` });
  if (years >= 1e4) return tr({ zh: `約 ${fixed(years / 1e4, 0)} 萬年前`, en: `about ${fixed(ma, ma < 10 ? 1 : 0)} million years ago` });
  return tr({ zh: `約 ${fixed(years, 0)} 年前`, en: `about ${fixed(years, 0)} years ago` });
}

export const CRATERS: PointsOverlayDef = {
  kind: 'points',
  id: 'craters',
  file: 'craters.json',
  label: { zh: '隕石撞擊坑（Wikidata）', en: 'Impact craters (Wikidata)' },
  radius: { field: 'dkm', stops: [[0, 2.5], [10, 3.5], [50, 6], [200, 10]] },
  color: MAP_TOKENS.hues.violet,
  look: 'hollow',
  sortField: 'dkm',
  tooltip: (p, ctx) => {
    const parts: string[] = [];
    if (typeof p.dkm === 'number') parts.push(tr({ zh: `直徑 ${fixed(p.dkm, p.dkm < 10 ? 1 : 0)} 公里`, en: `${fixed(p.dkm, p.dkm < 10 ? 1 : 0)} km across` }));
    if (typeof p.ma === 'number') parts.push(ageText(p.ma));
    if (typeof p.iso3 === 'string') parts.push(ctx.countryName(p.iso3));
    const name = nameOf(p);
    return {
      title: name,
      detail: parts.join(' · ') || undefined,
      properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
    };
  },
};

export const TRENCHES: PointsOverlayDef = {
  kind: 'points',
  id: 'trenches',
  file: 'trenches.json',
  label: { zh: '海溝（Wikidata）', en: 'Ocean trenches (Wikidata)' },
  radius: { field: 'depth', stops: [[0, 2.5], [6000, 3.5], [10000, 5.5]] },
  color: MAP_TOKENS.inkSecondary,
  sortField: 'depth',
  pointLabel: nameOf,
  tooltip: (p) => {
    const parts: string[] = [];
    if (typeof p.depth === 'number') parts.push(tr({ zh: `最深 ${fixed(p.depth, 0)} 公尺`, en: `Deepest ${fixed(p.depth, 0)} m` }));
    if (typeof p.km === 'number') parts.push(tr({ zh: `長 ${fixed(p.km, 0)} 公里`, en: `${fixed(p.km, 0)} km long` }));
    const name = nameOf(p);
    return {
      title: name,
      detail: parts.join(' · ') || undefined,
      properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
    };
  },
};
