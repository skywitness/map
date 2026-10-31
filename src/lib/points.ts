/**
 * 側欄、清單要完整的點（2026-10-31）：分層的點檔（PointsOverlayDef.more，例如 cities.json + cities-more.json）
 * 兩個檔都到了才回傳、接在一起（順序跟地圖一樣：重要的在前）；layered 是 false 時照舊只讀一個檔
 */
import { useMemo } from 'react';
import { decodePoints } from '../map/overlayData';
import { moreFile, type PointRecord, type PointsData } from '../topics/types';
import { useJson } from './data';

export function useAllPoints(path: string | null, layered: boolean): { points: PointRecord[] | null; error: Error | null } {
  const base = useJson<PointsData>(path);
  const rest = useJson<PointsData>(path && layered ? moreFile(path) : null);
  const ready = base.data && !base.loading && (!layered || (rest.data && !rest.loading));
  const points = useMemo(
    () => (ready ? decodePoints(base.data!).concat(layered ? decodePoints(rest.data!) : []) : null),
    [ready, base.data, rest.data, layered],
  );
  return { points, error: base.error ?? (layered ? rest.error : null) };
}
