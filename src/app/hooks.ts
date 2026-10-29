/**
 * App 用的小 hook（App.tsx，2026-10-29 拆出來）：網址的主題下載完才換、現在時刻、窄螢幕的地圖高度、國界幾何、國旗、框選估算。
 */
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type RefObject } from 'react';
import type { Topology } from 'topojson-specification';
import { floorMinute } from '../lib/clock';
import { useJson } from '../lib/data';
import type { ViewState } from '../lib/url-state';
import {
  buildGridIndex,
  gridInBox,
  landAreaInBox,
  type Box,
  type PopulationGrid,
} from '../map/boxEstimate';
import { toCountryFeatures, type CountryFeature } from '../map/geometry';
import type { BoxContribution } from '../panels/BoxResult';
import { loadedTopic, loadTopic } from '../topics';
import { indicatorPath, type Indicator, type IndicatorData, type Topic } from '../topics/types';
import { flagAspect, flagUrl, type FlagsFile } from '../topics/flagImages';
import type { FlagSpec } from '../map/flagTiles';

/**
 * 國界：全球視角用 1:110m（gzip 後約 45 KB，解析也快，補上了新加坡、巴林等 1:110m 原本沒有的小國），
 * 放大超過全球視角才換成 1:50m（約 230 KB，放大後比較精細；2026-10-29 以前是地圖畫出資料之後一定載入）。
 */
export const GEO_COARSE = 'geo/countries-110m.json';
const GEO_DETAILED = 'geo/countries-50m.json';

/**
 * 網址換到還沒下載定義的主題時（選單、搜尋、上一頁），先照舊顯示目前的主題，定義下載完再換過去
 * （一個主題 3–15 KB；選單滑過就預先下載）。第一個畫面在 main.tsx 等網址的主題下載完才畫
 */
export function useTopicReady(live: ViewState): ViewState {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const ready = loadedTopic(live.topic) !== null;
  const shown = useRef(live);
  if (ready) shown.current = live;
  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    // 下載失敗（離線又沒有快取）時留在目前的主題
    loadTopic(live.topic).then(
      () => !cancelled && rerender(),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [ready, live.topic]);
  return shown.current;
}

/**
 * 現在（捨去到分鐘）：active 時每到整分鐘更新一次（時刻主題沒有指定時間時，晝夜界線跟著現在走）。
 * 分頁在背景時不計時，回到分頁馬上更新。不寫網址
 */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => floorMinute(Date.now()));
  useEffect(() => {
    if (!active) return;
    let timer: number | undefined;
    const tick = () => {
      setNow(floorMinute(Date.now()));
      window.clearTimeout(timer);
      // 下一個整分鐘（多等 50 ms，確定已經過了）
      timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    const onVisibility = () => {
      if (document.hidden) {
        window.clearTimeout(timer);
        timer = undefined;
      } else tick();
    };
    if (!document.hidden) tick();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active]);
  return now;
}

/**
 * 窄螢幕整頁捲動（styles.css 的 @media (max-width: 900px)）：地圖的高度讓時間軸也留在第一個畫面裡。
 * 地圖上面的頂列、控制列、說明的高度會變（換行、展開說明），所以量出地圖的位置與時間軸的高度，
 * 寫進 CSS 變數 --map-top、--time-h（地圖的高度在 CSS 裡用 100svh 算，捲動時網址列縮放不會讓地圖跳動）
 */
export function useFitMap(appRef: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const app = appRef.current;
    if (!app) return;
    const measure = () => {
      const map = app.querySelector('.stage-main');
      if (!map) return;
      const top = map.getBoundingClientRect().top + window.scrollY;
      const time = app.querySelector<HTMLElement>('.time-slider')?.offsetHeight ?? 0;
      app.style.setProperty('--map-top', `${Math.round(top)}px`);
      app.style.setProperty('--time-h', `${time}px`);
    };
    measure();
    // .app 的高度變了（上面的東西換行、展開，或時間軸出現、消失）就重新量；地圖跟著調整後高度不變，不會一直觸發
    const observer = new ResizeObserver(measure);
    observer.observe(app);
    return () => observer.disconnect();
  }, [appRef]);
}

/**
 * 國界的幾何（先粗後細，見上面 GEO_COARSE）：1:50m 放大超過全球視角才載入（detailWanted），全球視角的 1:110m
 * 已經補上 1:110m 原本沒有的 63 個小國（build_geo.py 的 add_missing_to_coarse），不必每次都多下載 227 KB
 */
export function useCountryFeatures(detailWanted: boolean): CountryFeature[] | null {
  const coarse = useJson<Topology>(GEO_COARSE);
  const detailed = useJson<Topology>(detailWanted || coarse.error ? GEO_DETAILED : null).data;
  const topo = detailed ?? coarse.data;
  return useMemo(() => (topo ? toCountryFeatures(topo) : null), [topo]);
}

/**
 * 國旗地圖（kind 'flags'）的國旗：地圖上要用到時才載入國旗檔，換成 flagTiles.ts 用的格式（完整網址、寬 ÷ 高、重點）
 */
export function useFlagSpecs(topic: Topic, indicator: Indicator, active: boolean): Map<string, FlagSpec> | null {
  const layer = indicator.layer;
  const path = active && layer.kind === 'flags' ? `topics/${topic.id}/${layer.file}` : null;
  const { data } = useJson<FlagsFile>(path);
  return useMemo(
    () =>
      data
        ? new Map(
            Object.entries(data.units).map(([iso3, e]) => [
              iso3,
              { url: new URL(flagUrl(e), document.baseURI).href, aspect: flagAspect(e), fx: e.fx ?? 0.5, fy: e.fy ?? 0.5 },
            ]),
          )
        : null,
    [data],
  );
}

/**
 * 框選估算：網格決定國內怎麼分布，選定年份的國家總量決定水準。
 * 某國的框內估計 = 框內網格人數 ÷ 該國網格總人數 × 該國當年總量。
 */
export function useBoxEstimate(
  topic: Topic,
  item: string | null,
  box: Box | null,
  features: ReturnType<typeof toCountryFeatures> | null,
  year: number,
) {
  const spec = topic.boxEstimate;
  const indicator = spec ? topic.indicators.find((i) => i.id === spec.indicator) : undefined;
  const active = Boolean(spec && indicator && box && features);
  const { data } = useJson<IndicatorData>(active && indicator ? indicatorPath(topic, indicator, item) : null);
  const grid = useJson<PopulationGrid>(active && spec ? `topics/${topic.id}/${spec.grid}` : null).data;

  const landKm2 = useMemo(
    () => (active && features && box ? landAreaInBox(features, box) : null),
    [active, features, box],
  );
  const gridIndex = useMemo(() => (grid ? buildGridIndex(grid) : null), [grid]);
  const inBox = useMemo(
    () => (active && gridIndex && box ? gridInBox(gridIndex, box) : null),
    [active, gridIndex, box],
  );

  return useMemo(() => {
    if (!spec || !indicator || landKm2 === null) return null;
    const yearIndex = data ? data.years.indexOf(year) : -1;
    let total: number | null = null;
    const contributions: BoxContribution[] = [];
    if (data && yearIndex >= 0 && gridIndex && inBox) {
      // 沒有國家總量的區域（南極洲、地圖上沒有國界的小島）改用世界總量的變化來縮放
      const world = data.aggregates?.WLD;
      const worldNow = world?.[yearIndex];
      const worldAtEpoch = world?.[data.years.indexOf(gridIndex.epoch)];
      const worldScale = worldNow && worldAtEpoch ? worldNow / worldAtEpoch : 1;
      total = 0;
      for (let c = 0; c < gridIndex.countries.length; c++) {
        const gridValue = inBox.byCountry[c];
        if (gridValue <= 0) continue;
        const iso3 = gridIndex.countries[c];
        const share = gridValue / gridIndex.totals[c];
        const level = data.values[iso3]?.[yearIndex];
        const value = level != null ? share * level : gridValue * worldScale;
        total += value;
        if (value >= 0.5) contributions.push({ iso3, share, value }); // 框邊只擦到一點點的國家不列出
      }
      if (inBox.unassigned > 0) {
        const value = inBox.unassigned * worldScale;
        total += value;
        if (value >= 0.5) contributions.push({ iso3: null, share: null, value });
      }
      contributions.sort((a, b) => b.value - a.value);
    }
    return {
      label: spec.label,
      unit: indicator.unit,
      total,
      landKm2,
      contributions,
      grid: gridIndex && { epoch: gridIndex.epoch, cellSize: gridIndex.cellSize },
    };
  }, [spec, indicator, landKm2, gridIndex, inBox, data, year]);
}
