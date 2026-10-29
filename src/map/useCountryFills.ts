/**
 * 地圖上國家的顏色（WorldMap.tsx，2026-10-29 拆出來）：面量圖、類別圖的顏色放在 feature-state，換年份時漸變；圖例強調某一類時其他國家淡化。
 */
import { useEffect, useRef } from 'react';
import { bisectRight } from 'd3-array';
import { Map as MaplibreMap } from 'maplibre-gl';
import type { Indicator } from '../topics/types';
import type { CountryFeature } from './geometry';
import { categoryScale } from './categories';
import { choroplethScale } from './scales';
import {
  FILL_FADE_MIN_MS,
  FILL_FADE_MS,
  FILL_FADE_SHARE,
  NO_DATA,
  REDUCED_MOTION,
  classHeight,
  mixColor,
} from './worldMapLayers';
import type { RefObject } from 'react';

/** WorldMap 的地圖狀態，抽出去的 effect 都要：地圖建好、資料圖層加上了才動作；換底圖時 revision 加一，圖層要重新加上 */
export interface MapContext {
  mapRef: RefObject<MaplibreMap | null>;
  installedRef: RefObject<boolean>;
  ready: boolean;
  revision: number;
}

export function useCountryFills(
  { mapRef, installedRef, ready, revision }: MapContext,
  {
    countries,
    shapeless,
    values,
    colorScale,
    categories,
    indicator,
    flagsOn,
    highlightCategory,
  }: {
    countries: CountryFeature[];
    shapeless: [string, [number, number]][];
    values: Map<string, number>;
    colorScale: ReturnType<typeof choroplethScale> | null;
    categories: ReturnType<typeof categoryScale> | null;
    indicator: Indicator;
    flagsOn: boolean;
    highlightCategory: number | null;
  },
): void {
  // 面量圖、類別圖的顏色（與面量圖的 3D 高度）放在 feature-state，換年份時只改狀態，不重送幾何。
  // 顏色換年份、換指標時漸變（FILL_FADE_MS）：feature-state 的改變 MapLibre 不會自己做過渡，所以逐格算中間色
  const fillShownRef = useRef(new Map<string, string>());
  const fillFrameRef = useRef(0);
  const fillRevisionRef = useRef(-1);
  /** 上一次顏色改變的時間（performance.now()） */
  const fillChangedRef = useRef(-Infinity);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    // 國旗地圖：國家本身不上色（data-fill 透明，見 3D 的 effect），on 讓國界照常畫在國旗上
    const on = indicator.layer.kind === 'choropleth' || indicator.layer.kind === 'categorical' || flagsOn;
    const thresholds = colorScale?.domain() ?? [];
    const colorOf = (v: number | undefined) =>
      // 類別圖裡不屬於任何一類（也沒有「其他」）的代碼當成無資料
      v === undefined ? null : colorScale ? colorScale(v) : (categories?.color(v) ?? null);
    /** iso3 → 要畫的顏色；shapeless 的國家只有 tiny 的圓點 */
    const target = new Map<string, string>();
    for (const c of countries) {
      const v = values.get(c.iso3);
      const color = colorOf(v);
      // 類別沒有高低，3D 時不拉高（只傾斜地圖），高度只給面量圖
      const h = on && v !== undefined && colorScale ? classHeight(thresholds, v) : 0;
      map.setFeatureState({ source: 'countries', id: c.iso3 }, { on, h });
      map.setFeatureState({ source: 'tiny-columns', id: c.iso3 }, { on, h });
      map.setFeatureState({ source: 'tiny', id: c.iso3 }, { on: on && color !== null });
      target.set(c.iso3, on && color !== null ? color : NO_DATA);
    }
    const shapelessIds = new Set<string>();
    for (const [iso3] of shapeless) {
      const color = colorOf(values.get(iso3));
      map.setFeatureState({ source: 'tiny', id: iso3 }, { on: on && color !== null });
      target.set(iso3, color ?? NO_DATA);
      shapelessIds.add(iso3);
    }
    const paint = (iso3: string, fill: string) => {
      if (!shapelessIds.has(iso3)) {
        map.setFeatureState({ source: 'countries', id: iso3 }, { fill });
        map.setFeatureState({ source: 'tiny-columns', id: iso3 }, { fill });
      }
      map.setFeatureState({ source: 'tiny', id: iso3 }, { fill });
    };

    const shown = fillShownRef.current;
    const now = performance.now();
    // 漸變的時間：單獨一次變化（點時間軸、換指標）是 FILL_FADE_MS；播放時連續變化，只用間隔的 FILL_FADE_SHARE，
    // 下一年來之前就變完，顏色不會落後（2026-10-29 以前播放時不漸變，一格一格跳）
    const duration = Math.min(FILL_FADE_MS, (now - fillChangedRef.current) * FILL_FADE_SHARE);
    // 換底圖後 feature-state 都清掉了，第一次畫、拖時間軸（間隔太短）、使用者要求減少動態效果時直接換
    const fade =
      revision === fillRevisionRef.current &&
      shown.size > 0 &&
      duration >= FILL_FADE_MIN_MS * FILL_FADE_SHARE &&
      !matchMedia(REDUCED_MOTION).matches;
    fillRevisionRef.current = revision;
    fillChangedRef.current = now;
    if (!fade) {
      for (const [iso3, fill] of target) {
        paint(iso3, fill);
        shown.set(iso3, fill);
      }
      return;
    }
    const changes = [...target].flatMap(([iso3, to]) => {
      const from = shown.get(iso3) ?? to;
      return from === to ? [] : [{ iso3, from, to }];
    });
    if (!changes.length) return;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - (1 - k) ** 3;
      for (const { iso3, from, to } of changes) {
        const fill = k === 1 ? to : mixColor(from, to, eased);
        paint(iso3, fill);
        shown.set(iso3, fill);
      }
      if (k < 1) fillFrameRef.current = requestAnimationFrame(step);
    };
    fillFrameRef.current = requestAnimationFrame(step);
    // 漸變到一半又換年份：從畫面上現在的中間色接著變（shown 已經記下）
    return () => cancelAnimationFrame(fillFrameRef.current);
  }, [revision, countries, shapeless, values, colorScale, categories, indicator.layer.kind, flagsOn]);

  // 強調圖例上的某一類（類別圖）或某一級（面量圖，d3 的 scaleThreshold 也是用 bisectRight 分級），其他國家淡化
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const thresholds = colorScale?.domain();
    const classOf = (v: number) => (categories ? categories.index(v) : thresholds ? bisectRight(thresholds, v) : null);
    const dimOf = (v: number | undefined) =>
      highlightCategory !== null && (categories !== null || colorScale !== null) && (v === undefined || classOf(v) !== highlightCategory);
    for (const c of countries) {
      const dim = dimOf(values.get(c.iso3));
      map.setFeatureState({ source: 'countries', id: c.iso3 }, { dim });
      map.setFeatureState({ source: 'tiny', id: c.iso3 }, { dim });
    }
    for (const [iso3] of shapeless) {
      map.setFeatureState({ source: 'tiny', id: iso3 }, { dim: dimOf(values.get(iso3)) });
    }
  }, [revision, countries, shapeless, values, categories, colorScale, highlightCategory]);
}
