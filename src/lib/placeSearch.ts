/**
 * 指令面板搜尋目前主題地圖上的點（2026-10-31，使用者選的第四輪 一、2）：賽道、博物館、火山、港口…
 * 名稱用點的 tooltip 的標題，第二行是圖層名稱與 tooltip 的說明；比對與計分跟國家搜尋一樣
 * （countrySearch.ts 的 normalize、makeKey、scoreKey）。索引第一次搜尋時才建（App.tsx 的 searchPlaces）
 */
import { tr, type Text } from '../i18n/lang';
import type { PointRecord } from '../topics/types';
import { makeKey, normalize, scoreKey, type SearchKey } from './countrySearch';

/** 建索引要的點圖層（overlayData.ts 的 OverlayLayer 裡 kind 'points' 的那些） */
export interface PlaceLayer {
  id: string;
  label: Text;
  points: PointRecord[];
  tooltip: (p: PointRecord) => { title: string; detail?: string };
}

export interface PlaceEntry {
  overlay: string;
  index: number;
  name: string;
  /** 圖層名稱與 tooltip 的說明（例如「賽道 · Spa · 比利時」） */
  meta: string;
  lng: number;
  lat: number;
  key: SearchKey;
}

export function buildPlaceIndex(layers: PlaceLayer[]): PlaceEntry[] {
  const out: PlaceEntry[] = [];
  for (const layer of layers) {
    const label = tr(layer.label);
    layer.points.forEach((p, index) => {
      if (typeof p.lon !== 'number' || typeof p.lat !== 'number') return;
      const tip = layer.tooltip(p);
      const key = tip.title ? makeKey(tip.title, 2) : null;
      if (!key) return;
      out.push({
        overlay: layer.id,
        index,
        name: tip.title,
        meta: [label, tip.detail].filter(Boolean).join(' · '),
        lng: p.lon,
        lat: p.lat,
        key,
      });
    });
  }
  return out;
}

/** 分數最高的幾個；名稱相符的結果有了，拼錯容忍找到的就不列（跟國家搜尋一樣） */
export function searchPlaces(index: PlaceEntry[], query: string, limit = 6): { entry: PlaceEntry; score: number }[] {
  const q = normalize(query).replace(/ /g, '');
  if (!q) return [];
  const hits: { entry: PlaceEntry; score: number }[] = [];
  for (const entry of index) {
    const score = scoreKey(q, entry.key);
    if (score > 0) hits.push({ entry, score });
  }
  hits.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
  const strong = hits.length > 0 && hits[0].score >= 500;
  return (strong ? hits.filter((h) => h.score >= 250) : hits).slice(0, limit);
}
