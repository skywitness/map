/**
 * 流向圖：點選國家後畫出它與主要夥伴之間的大圓弧線（LayerSpec 的 kind: 'flow'）。
 * 資料讀取與換算放在這裡，地圖引擎（WorldMap）只負責畫，側欄也共用同一份資料。
 */
import { useMemo } from 'react';
import { geoDistance, geoInterpolate } from 'd3-geo';
import { useJson } from '../lib/data';
import { MAP_TOKENS } from '../theme/tokens';
import { flowPath, type FlowDirection, type FlowFile, type IndicatorDef, type TopicDefinition } from '../topics/types';

/** 流向檔的金額單位是千美元 */
const UNIT_SCALE = 1000;

export interface FlowLink {
  /** 夥伴國 */
  iso3: string;
  /** 美元 */
  value: number;
  /** 占該國對所有夥伴總額的比例（0–1） */
  share: number;
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
}

export function flowSelection(file: FlowFile, origin: string, direction: FlowDirection): FlowSelection {
  const entry = file[direction][origin];
  const [total, partners] = entry ?? [0, []];
  return {
    origin,
    direction,
    year: file.year,
    total: total * UNIT_SCALE,
    links: partners.map(([iso3, v]) => ({ iso3, value: v * UNIT_SCALE, share: total > 0 ? v / total : 0 })),
  };
}

/**
 * 流向圖指標：選了國家才載入當年的流向檔。
 * 拖動時間軸時先保留上一年的弧線，新的一年載入後再換；換商品時舊資料不能用，先不畫。
 */
export function useFlowSelection(
  topic: TopicDefinition,
  indicator: IndicatorDef,
  item: string | null,
  year: number,
  selected: string | null,
): FlowSelection | null {
  const path = selected ? flowPath(topic, indicator, item, year) : null;
  const { data } = useJson<FlowFile>(path);
  const layer = indicator.layer;
  return useMemo(() => {
    if (!data || !selected || layer.kind !== 'flow') return null;
    if (item !== null && data.item !== item) return null;
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

export const FLOW_TEXT: Record<FlowDirection, { partners: string; verb: (origin: string, partner: string) => string }> = {
  export: { partners: '出口對象', verb: (origin, partner) => `${origin}出口到${partner}` },
  import: { partners: '進口來源', verb: (origin, partner) => `${origin}從${partner}進口` },
};
