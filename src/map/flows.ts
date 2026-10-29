/**
 * 流向圖：點選國家後畫出它與主要夥伴之間的大圓弧線（LayerSpec 的 kind: 'flow'）。
 * 資料讀取與換算放在這裡，地圖引擎（WorldMap）只負責畫，側欄也共用同一份資料。
 */
import { useMemo } from 'react';
import { geoDistance, geoInterpolate } from 'd3-geo';
import { defineMessages, getLang, type Lang, type Localized } from '../i18n';
import { useJson } from '../lib/data';
import { MAP_TOKENS } from '../theme/tokens';
import {
  flowPath,
  type FlowDirection,
  type FlowFile,
  type FlowLayer,
  type Indicator,
  type LayerSpec,
  type Topic,
} from '../topics/types';

/** 流向檔沒寫 scale 時（舊的貿易檔）：金額單位是千美元 */
const DEFAULT_SCALE = 1000;

export interface FlowLink {
  /** 夥伴國 */
  iso3: string;
  /** 美元 */
  value: number;
  /** 占該國對所有夥伴總額的比例（0–1） */
  share: number;
  /** 數量是估算的（流向檔標了估算） */
  estimated?: boolean;
}

/** 一個國家某年的出口對象或進口來源 */
export interface FlowSelection {
  /** 點選的國家 */
  origin: string;
  direction: FlowDirection;
  year: number;
  /** 對所有夥伴的總額（美元），含沒列出的小夥伴 */
  total: number;
  /** 前幾大夥伴，由大到小 */
  links: FlowLink[];
  /** 個別夥伴的說明（流向檔的 notes）：夥伴 → [中文, 英文] */
  notes?: Record<string, [string, string]>;
}

/** direction 為 'larger' 時，取選取國家總額比較大的那個方向（一樣大或都沒有時用 'import'） */
export function flowSelection(file: FlowFile, origin: string, direction: FlowLayer['direction']): FlowSelection {
  const resolved: FlowDirection =
    direction !== 'larger'
      ? direction
      : (file.export[origin]?.[0] ?? 0) > (file.import[origin]?.[0] ?? 0)
        ? 'export'
        : 'import';
  const [total, partners] = file[resolved][origin] ?? [0, []];
  const scale = file.scale ?? DEFAULT_SCALE;
  const notes: Record<string, [string, string]> = {};
  if (file.notes) {
    for (const [iso3] of partners) {
      const note = file.notes[resolved === 'export' ? `${origin}>${iso3}` : `${iso3}>${origin}`];
      if (note) notes[iso3] = note;
    }
  }
  return {
    origin,
    direction: resolved,
    year: file.year,
    total: total * scale,
    links: partners.map(([iso3, v, est]) => ({
      iso3,
      value: v * scale,
      share: total > 0 ? v / total : 0,
      ...(est ? { estimated: true } : {}),
    })),
    ...(Object.keys(notes).length ? { notes } : {}),
  };
}

/**
 * 流向圖指標：選了國家才載入當年的流向檔。
 * 拖動時間軸時先保留上一年的弧線，新的一年載入後再換；換商品時舊資料不能用，先不畫。
 */
export function useFlowSelection(
  topic: Topic,
  indicator: Indicator,
  item: string | null,
  year: number,
  selected: string | null,
): FlowSelection | null {
  const path = selected ? flowPath(topic, indicator, item, year) : null;
  const { data } = useJson<FlowFile>(path);
  const layer = indicator.layer;
  return useMemo(() => {
    if (!data || !selected || layer.kind !== 'flow') return null;
    // 流向檔跟著子項目換（貿易的商品）時，換商品後舊的檔不能用；流向檔不分子項目的（塑膠污染的子項目是排放形式，
    // 只用在排放的指標）不比對
    if (item !== null && layer.file.includes('{item}') && data.item !== item) return null;
    return flowSelection(data, selected, layer.direction);
  }, [data, selected, layer, item]);
}

/**
 * 兩點之間的大圓弧線（地球上的最短路徑），每 2° 一個點。
 * 經度展開成連續的（可以超過 ±180°），跨過 180° 經線的弧線（日本—美國、紐西蘭—智利）
 * 在平面地圖上才不會從地圖一端拉到另一端。
 */
export function greatCircle(from: [number, number], to: [number, number]): [number, number][] {
  const interpolate = geoInterpolate(from, to);
  const steps = Math.max(2, Math.ceil(geoDistance(from, to) / (Math.PI / 90)));
  const points: [number, number][] = [];
  let offset = 0;
  let prev = from[0];
  for (let i = 0; i <= steps; i++) {
    const [lon, lat] = interpolate(i / steps);
    if (i > 0) {
      if (lon + offset - prev > 180) offset -= 360;
      else if (prev - (lon + offset) > 180) offset += 360;
    }
    prev = lon + offset;
    points.push([prev, lat]);
  }
  return points;
}

export const FLOW_MIN_WIDTH = 1;
export const FLOW_MAX_WIDTH = 12;
/** 只有有沒有的流向圖（FlowLayer.presence）的線寬 */
export const FLOW_PRESENCE_WIDTH = 2.5;

/** 線寬與金額成正比（以這個國家最大的夥伴為最粗），太細的至少 1 px 才看得到 */
export function flowWidth(value: number, max: number): number {
  return max > 0 ? Math.max(FLOW_MIN_WIDTH, (value / max) * FLOW_MAX_WIDTH) : FLOW_MIN_WIDTH;
}

/** 圖例的線寬刻度：最大夥伴的 1/10、1/2 與全部，各自往下取到 1、2、5 × 10ⁿ */
export function flowLegendValues(max: number): number[] {
  const niceFloor = (v: number) => {
    const exp = 10 ** Math.floor(Math.log10(v));
    const m = v / exp;
    return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * exp;
  };
  return [...new Set([0.1, 0.5, 1].map((f) => max * f).filter((v) => v > 0).map(niceFloor))];
}

/**
 * 弧線顏色：出口青綠、進口橘色，跟農產品貿易收支的「淨出口綠、淨進口橘」一致。
 * 弧線由淺到深漸層，淺的一端是出口國、深的一端是進口國；tint 是夥伴國的底色，
 * mid 給圖例的線寬樣本用（圖例底色跟著介面深淺色切換，中間色在兩種底色上都看得到）。
 */
export function flowColors(direction: FlowDirection): { start: string; mid: string; end: string; tint: string } {
  const d = MAP_TOKENS.diverging;
  return direction === 'export'
    ? { start: d[4], mid: d[5], end: d[6], tint: d[4] }
    : { start: d[2], mid: d[1], end: d[0], tint: d[2] };
}

const FLOW_TEXT = defineMessages({
  zh: {
    export: { partners: '出口對象', main: '主要出口對象', verb: (origin: string, partner: string) => `${origin}出口到${partner}` },
    import: { partners: '進口來源', main: '主要進口來源', verb: (origin: string, partner: string) => `${origin}從${partner}進口` },
    /** 還沒選國家時的提示 */
    pick: (partners: string) => `點選國家，查看它的${partners}`,
    noData: (year: number, partners: string) => `這個國家沒有 ${year} 年的${partners}資料`,
    /** 圖例上漸層樣本的說明 */
    legendKey: '由出口國（淺）到進口國（深）',
  },
  en: {
    export: { partners: 'export destinations', main: 'Main export destinations', verb: (origin, partner) => `${origin} exports to ${partner}` },
    import: { partners: 'import sources', main: 'Main import sources', verb: (origin, partner) => `${origin} imports from ${partner}` },
    pick: (partners) => `Click a country to see its ${partners}`,
    noData: (year, partners) => `No ${year} data on this country's ${partners}`,
    legendKey: 'From exporter (light) to importer (dark)',
  },
});

/**
 * 流向圖的文字（出口對象、進口來源…），預設用目前的介面語言。
 * 指標的流向圖層有自己的 labels、pickPartners、legendKey 時用它的（例如移民的「移民來源／僑民去向」），沒有的用貿易的。
 */
export function flowText(layer?: Localized<LayerSpec> | null, lang: Lang = getLang()) {
  const base = FLOW_TEXT[lang];
  const own = layer?.kind === 'flow' ? layer : null;
  const labels = { export: own?.labels?.export ?? base.export, import: own?.labels?.import ?? base.import };
  const fixed = own && own.direction !== 'larger' ? own.direction : 'export';
  return {
    ...base,
    ...labels,
    legendKey: own?.legendKey ?? base.legendKey,
    /** 還沒選國家時提示裡的夥伴稱呼 */
    pickPartners: own?.pickPartners ?? labels[fixed].partners,
  };
}
