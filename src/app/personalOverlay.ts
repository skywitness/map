import { tr } from '../i18n';
import type { PersonalRoute } from '../lib/personalRoutes';
import type { DecodedLines } from '../map/overlayData';
import type { LinesOverlayDef, PointRecord, TopicDefinition } from '../topics/types';

/** 我的路線的線圖層 id（MapLibre 圖層 `ov-personal-routes`） */
export const PERSONAL_ID = 'personal-routes';

type Config = NonNullable<TopicDefinition['personalRoutes']>;

/**
 * 我的路線（lib/personalRoutes.ts）的線圖層：線由 App 交給 useOverlays（LinesOverlayDef.local），不讀資料檔。
 * 顏色依主題的分類（賽車是賽事的類別），滑過整條路線一起標出（同一個匯入的路線是一組）
 */
export function personalOverlay(cfg: Config): LinesOverlayDef {
  return {
    kind: 'lines',
    local: true,
    id: PERSONAL_ID,
    file: '',
    label: { zh: '我的路線（只存在這個瀏覽器）', en: 'My routes (stored in this browser only)' },
    width: 2.2,
    color: cfg.color,
    keyClasses: false,
    groupField: 'g',
    hoverHalo: true,
    tooltip: (p) => {
      const series = typeof p.series === 'string' ? cfg.seriesLabel?.(p.series) : undefined;
      return {
        title: String(p.name ?? ''),
        detail: [series ? tr(series) : '', typeof p.place === 'string' ? p.place : ''].filter(Boolean).join(' · ') || undefined,
        extra: [tr({ zh: `我的路線：${String(p.source ?? '')}`, en: `My routes: ${String(p.source ?? '')}` })],
      };
    },
  };
}

/** 匯入的路線 → 線圖層的資料：一條路線可以有好幾段，每段一筆紀錄，g 是路線的序號（滑過整條一起標出） */
export function personalDecoded(routes: PersonalRoute[], cfg: Config): DecodedLines {
  const lines: [number, number][][] = [];
  const types: number[] = [];
  const records: PointRecord[] = [];
  routes.forEach((r, g) => {
    const type = cfg.type?.(r.series) ?? 0;
    for (const line of r.lines) {
      lines.push(line);
      types.push(type);
      records.push({ name: r.name, series: r.series ?? null, place: r.place ?? null, source: r.source, g });
    }
  });
  return { lines, types, records, vertexTypes: null };
}
