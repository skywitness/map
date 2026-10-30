/**
 * 疊加圖層的資料（2026-10-30 從 Overlays.tsx 拆出來）：圖層開關的狀態、鐵路、點、線的解碼。
 * 首頁的程式（App、app/overlays.ts）與主題的側欄只要這些，不必連圖層的圖例、開關元件一起下載
 */
import type { ClassGrid } from './classGridData';
import type { ClassGridOverlay, LinesData, LinesOverlay, LiveGridOverlay, MoonOverlay, NightOverlay, PointRecord, PointsData, PointsOverlay, RailwaysData, WindOverlay } from '../topics/types';
import type { WindField } from './windField';

export interface LayerVisibility {
  railways: boolean;
  largeAirports: boolean;
  mediumAirports: boolean;
  /** 地形陰影（有地形圖層的主題才有） */
  hillshade: boolean;
  /** 一般疊加圖層（主題 overlays 裡 kind 為 points、lines 的），key 是 overlay 的 id；沒有記錄的看 overlay 的 hidden */
  extra: Record<string, boolean>;
}

// 中型機場有兩千多座，世界全圖時會蓋住鐵路，預設關閉
export const DEFAULT_LAYERS: LayerVisibility = {
  railways: true,
  largeAirports: true,
  mediumAirports: false,
  hillshade: true,
  extra: {},
};

/** 把差分編碼的鐵路還原成經緯度 MultiLineString */
export function decodeRailways(data: RailwaysData): GeoJSON.MultiLineString {
  return { type: 'MultiLineString', coordinates: decodeLines(data).lines };
}

/**
 * 一般線圖層還原後的資料：經緯度的線，types 是每條線的分類代碼，records 是每條線的紀錄（tooltip、時間篩選用），
 * vertexTypes 是每條線每個頂點的代碼（颱風每個時間點的強度）
 */
export interface DecodedLines {
  lines: [number, number][][];
  types: number[] | null;
  records: PointRecord[] | null;
  vertexTypes: number[][] | null;
  /** concatLines() 接起來的原本那幾份（主檔、分區）：地圖上主檔與分區畫在不同的 source，換分區時主檔不必重送 */
  parts?: DecodedLines[];
}

/** 每條線第一個點是量化後的絕對座標，之後是差分；乘上 quantum 得到經緯度（鐵路與一般線圖層同一種格式） */
export function decodeLines(data: LinesData | RailwaysData): DecodedLines {
  const q = data.quantum;
  const lines = data.lines.map((flat) => {
    const line: [number, number][] = [];
    let x = 0;
    let y = 0;
    for (let i = 0; i < flat.length; i += 2) {
      x += flat[i];
      y += flat[i + 1];
      line.push([x * q, y * q]);
    }
    return line;
  });
  let records = 'records' in data && data.records ? decodePoints(data.records) : null;
  // 共用的資料（同一個河流系統的名稱、流入的海…）併進每條線的紀錄
  if (records && 'groups' in data && data.groups) {
    const { field, records: shared } = data.groups;
    const groups = new Map(decodePoints(shared).map((g) => [g[field], g]));
    records = records.map((r) => {
      const g = groups.get(r[field]);
      return g ? { ...g, ...r } : r;
    });
  }
  return {
    lines,
    types: 'types' in data && data.types ? data.types : null,
    records,
    // 一個字元一個頂點，36 進位（pipeline 的 VERTEX_CODES）
    vertexTypes:
      'vertexTypes' in data && data.vertexTypes ? data.vertexTypes.map((s) => Array.from(s, (c) => parseInt(c, 36))) : null,
  };
}

/** 好幾份還原後的線接成一份（線圖層的主檔加上放大後下載的分區）；紀錄、分類沒有的那份補 null */
export function concatLines(parts: DecodedLines[]): DecodedLines {
  if (parts.length === 1) return parts[0];
  const all = <T,>(pick: (p: DecodedLines) => T[] | null, fill: T) =>
    parts.some((p) => pick(p)) ? parts.flatMap((p) => pick(p) ?? p.lines.map(() => fill)) : null;
  return {
    lines: parts.flatMap((p) => p.lines),
    types: all((p) => p.types, 0),
    records: all<PointRecord>((p) => p.records, {}),
    vertexTypes: all<number[]>((p) => p.vertexTypes, []),
    parts,
  };
}

/** 一般點圖層的資料檔（pipeline 的 common.points_file()）還原成一個點一筆的紀錄 */
export function decodePoints(data: PointsData): PointRecord[] {
  const n = data.columns[0]?.length ?? 0;
  const records: PointRecord[] = Array.from({ length: n }, () => ({}));
  const table = data.strings?.table;
  const stringFields = new Set(data.strings?.fields ?? []);
  data.fields.forEach((field, f) => {
    const column = data.columns[f];
    const scale = data.scale[field];
    const delta = data.delta.includes(field);
    // 字串表的欄位：存的是索引，0 是沒有值
    if (table && stringFields.has(field)) {
      for (let i = 0; i < n; i++) {
        const v = column[i];
        records[i][field] = typeof v === 'number' && v > 0 ? (table[v] ?? null) : null;
      }
      return;
    }
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const v = column[i];
      if (v === null || scale === undefined || typeof v === 'string') {
        records[i][field] = v;
        continue;
      }
      acc = delta ? acc + v : v;
      // 乘上量化單位後再依它的小數位數四捨五入，0.1 × 3 才不會變成 0.30000000000000004
      records[i][field] = roundTo(acc * scale, scale);
    }
  });
  return records;
}

function roundTo(value: number, scale: number): number {
  if (scale >= 1) return value;
  const digits = Math.ceil(-Math.log10(scale) - 1e-9);
  return Number(value.toFixed(digits));
}

/** 一般疊加圖層目前的狀態：解析過的設定、有沒有打開、資料（還沒下載或關著沒下載時是 null） */
export type OverlayLayer =
  | { kind: 'points'; def: PointsOverlay; visible: boolean; points: PointRecord[] | null }
  | { kind: 'lines'; def: LinesOverlay; visible: boolean; lines: DecodedLines | null }
  /** 晝夜（時刻主題）：沒有資料檔，依時刻畫（nightLayer.ts） */
  | { kind: 'night'; def: NightOverlay; visible: boolean }
  /** 月亮（晝夜與季節）：看得到月亮的半個地球與月下點，依時刻畫（nightLayer.ts） */
  | { kind: 'moon'; def: MoonOverlay; visible: boolean }
  /** 即時網格（此刻的極光）：值由主題的即時資料算（liveGridLayer.ts）；還沒讀到是 null */
  | { kind: 'liveGrid'; def: LiveGridOverlay; visible: boolean; values: Float32Array | null }
  /** 類別網格（氣候分區）：依年份與子項目的 PNG（classGridLayer.ts）；還沒讀到是 null */
  | { kind: 'classGrid'; def: ClassGridOverlay; visible: boolean; grid: ClassGrid | null }
  /** 風的粒子（風與季風）：依月份的風場（windLayer.ts）；還沒讀到是 null */
  | { kind: 'wind'; def: WindOverlay; visible: boolean; field: WindField | null };

export function overlayVisible(layers: LayerVisibility, def: { id: string; hidden?: boolean }): boolean {
  return layers.extra[def.id] ?? !def.hidden;
}
