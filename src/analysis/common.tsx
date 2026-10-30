import { useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { tr, useLang } from '../i18n';
import { countryName, type CountryTable } from '../lib/countries';
import { useJsonMany } from '../lib/data';
import { categoryScale } from '../map/categories';
import { choroplethColors } from '../map/categories';
import { NO_DATA_SWATCH } from '../map/worldMapLayers';
import { latestAt } from '../panels/stats';
import { MAP_TOKENS, type MapTokens } from '../theme/tokens';
import { indicatorPath, type Indicator, type IndicatorData, type Topic } from '../topics/types';
import { bubbleRadius } from './scales';
import { TEXT } from './text';

/** 分析用得到的指標（App 決定要不要列出「分析」也用同一個判斷） */
export { canAnalyse as analysable } from '../app/options';

/** 連續的數值（可以算變化、設門檻）：面量圖、比例圓 */
export const numeric = (ind: Indicator) => ind.layer.kind === 'choropleth' || ind.layer.kind === 'bubble';

/** 同一個主題其他指標的資料檔（篩選、並排、對照用）；目前的指標用 App 已經載入的那一份 */
export function useIndicatorFiles(
  topic: Topic,
  indicators: Indicator[],
  item: string | null,
  current: { indicator: Indicator; data: IndicatorData | null },
): Map<string, IndicatorData | null> {
  const others = indicators.filter((i) => i.id !== current.indicator.id);
  const paths = useMemo(() => others.map((i) => indicatorPath(topic, i, item)), [topic, item, others.map((i) => i.id).join('|')]);
  const files = useJsonMany<IndicatorData>(paths);
  return useMemo(() => {
    const out = new Map<string, IndicatorData | null>([[current.indicator.id, current.data]]);
    others.forEach((ind, i) => out.set(ind.id, files[i] ?? null));
    return out;
    // others 由 paths 決定
  }, [files, current.indicator.id, current.data, paths]);
}

/** 某一年各國的值：那一年沒有資料的指標用最接近、不晚於那一年的年份（沒有更早的就用最早的） */
export function valuesNear(data: IndicatorData, year: number): { year: number; values: Map<string, number> } {
  const years = data.years;
  let index = -1;
  for (let i = 0; i < years.length; i++) if (years[i] <= year) index = i;
  if (index < 0) index = 0;
  return { year: years[index], values: latestAt(data, index).values };
}

/** 年份的寫法：指標有自己的時間軸（月份、出生年）時照它 */
export const yearLabel = (ind: Indicator, year: number) => (ind.timeAxis ? ind.timeAxis.year(year) : String(year));

/** 比例圓：各國的圓，最大的圓是所有年份的最大值（跟主地圖一樣，換年份時大小可以比） */
export function bubblesFor(values: Map<string, number>, max: number, largest?: number) {
  return [...values]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([iso3, v]) => ({ iso3, r: bubbleRadius(v, max, largest), color: MAP_TOKENS.accent }));
}

/** 所有年份裡最大的值（比例圓的尺度） */
export function maxValue(data: IndicatorData | null): number {
  let max = 0;
  if (data) for (const series of Object.values(data.values)) for (const v of series) if (v != null && v > max) max = v;
  return max;
}

/** 一排色塊加刻度（面量圖、變化） */
export function StepLegend({ title, colors, ticks, noData = true }: { title?: ReactNode; colors: string[]; ticks: string[]; noData?: boolean }) {
  const T = TEXT[useLang()];
  return (
    <div className="analysis-legend">
      {title && <div className="analysis-legend-title">{title}</div>}
      <div className="analysis-steps">
        {colors.map((c, i) => (
          <span key={i} className="analysis-step" style={{ background: c }}>
            {i > 0 && <span className="analysis-tick">{ticks[i - 1]}</span>}
          </span>
        ))}
      </div>
      {noData && (
        <div className="analysis-legend-row">
          <span className="swatch-nodata" style={{ background: NO_DATA_SWATCH }} />
          {T.noData}
        </div>
      )}
    </div>
  );
}

/** 指標自己的圖例：面量圖的分級、類別、比例圓的幾個大小 */
export function IndicatorLegend({ indicator, tokens, max, title }: { indicator: Indicator; tokens: MapTokens; max: number; title?: ReactNode }) {
  const lang = useLang();
  const T = TEXT[lang];
  const layer = indicator.layer;
  const tick = indicator.formatTick ?? ((v: number) => indicator.format(v));
  const heading = title ?? (
    <>
      {indicator.label}
      {indicator.unit && <span className="analysis-legend-unit">{T.unit(tr(indicator.unit, lang))}</span>}
    </>
  );
  if (layer.kind === 'choropleth') {
    return <StepLegend title={heading} colors={choroplethColors(layer.scale, tokens)} ticks={layer.scale.thresholds.map(tick)} />;
  }
  if (layer.kind === 'categorical') {
    const scale = categoryScale(layer, tokens);
    return (
      <div className="analysis-legend">
        <div className="analysis-legend-title">{heading}</div>
        <div className="analysis-cats">
          {layer.categories.map((c, i) => (
            <span key={i} className="analysis-legend-row">
              <span className="analysis-swatch" style={{ background: scale.color(c.value) ?? MAP_TOKENS.noData }} />
              {tr(c.label, lang)}
            </span>
          ))}
          <span className="analysis-legend-row">
            <span className="swatch-nodata" style={{ background: NO_DATA_SWATCH }} />
            {T.noData}
          </span>
        </div>
      </div>
    );
  }
  // 比例圓：最大值、四分之一、二十分之一（取兩位有效數字）
  const sizes = [max, max / 4, max / 20].map((v) => Number(v.toPrecision(2))).filter((v) => v > 0);
  const largest = 26;
  return (
    <div className="analysis-legend">
      <div className="analysis-legend-title">{heading}</div>
      <svg className="analysis-bubbles" viewBox={`0 0 ${largest * 2 + 70} ${largest * 2 + 4}`} aria-hidden="true">
        {sizes.map((v) => {
          const r = bubbleRadius(v, max, largest);
          return (
            <g key={v}>
              <circle cx={largest + 2} cy={largest * 2 + 2 - r} r={r} />
              <line x1={largest + 2} x2={largest * 2 + 10} y1={largest * 2 + 2 - 2 * r} y2={largest * 2 + 2 - 2 * r} />
              <text x={largest * 2 + 12} y={largest * 2 + 2 - 2 * r + 4}>
                {tick(v)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** 滑過的國家與游標位置（相對於外框），給 tooltip 用 */
export function useHover() {
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ iso3: string; x: number; y: number } | null>(null);
  const onHover = (iso3: string | null, e?: PointerEvent) => {
    const rect = box.current?.getBoundingClientRect();
    if (!iso3 || !e || !rect) return setHover(null);
    setHover({ iso3, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  return { box, hover, onHover };
}

/** 跟著游標的小框：國名加幾行數值；靠右邊時放在游標左邊 */
export function Tooltip({
  hover,
  width,
  countries,
  lines,
}: {
  hover: { iso3: string; x: number; y: number } | null;
  width: number;
  countries: CountryTable | null;
  lines: (iso3: string) => ReactNode[];
}) {
  const lang = useLang();
  if (!hover) return null;
  const left = hover.x > width - 220;
  return (
    <div
      className="analysis-tooltip"
      style={{ left: left ? undefined : hover.x + 14, right: left ? width - hover.x + 14 : undefined, top: hover.y + 14 }}
      role="presentation"
    >
      <div className="analysis-tooltip-name">{countryName(hover.iso3, countries, lang)}</div>
      {lines(hover.iso3).map((line, i) => (
        <div key={i} className="analysis-tooltip-line">
          {line}
        </div>
      ))}
    </div>
  );
}
