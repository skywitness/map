import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useLang } from '../i18n';
import type { CountryTable } from '../lib/countries';
import type { AnalysisState } from '../lib/url-state';
import type { MapTokens } from '../theme/tokens';
import type { Indicator, IndicatorData } from '../topics/types';
import { bubblesFor, IndicatorLegend, maxValue, Tooltip, useHover, valuesNear, yearLabel } from './common';
import { indicatorColor } from './scales';
import type { WorldShapes } from './shapes';
import { SvgWorld } from './SvgWorld';
import { TEXT } from './text';

interface Side {
  indicator: Indicator;
  label: string;
  values: Map<string, number>;
  max: number;
}

/**
 * 前後對照的拉簾（2026-10-30）：兩張一樣大的地圖疊在一起，中間一條分隔線，左邊露出「另一個年份（或指標）」、
 * 右邊是目前的年份與指標。拖分隔線（或點了之後用 ← →）改變左右的比例。
 * 右邊那張用 clip-path 切掉左邊，滑鼠事件照樣落在看得到的那一張上
 */
export function SwipeTab({
  shapes,
  indicator,
  options,
  files,
  year,
  countries,
  tokens,
  selected,
  onSelect,
  state,
  onChange,
  width,
}: {
  shapes: WorldShapes;
  indicator: Indicator;
  options: Indicator[];
  files: Map<string, IndicatorData | null>;
  year: number;
  countries: CountryTable | null;
  tokens: MapTokens;
  selected: string | null;
  onSelect: (iso3: string) => void;
  state: AnalysisState;
  onChange: (patch: Partial<AnalysisState>) => void;
  width: number;
}) {
  const lang = useLang();
  const T = TEXT[lang];
  const { box, hover, onHover } = useHover();
  const [split, setSplit] = useState(0.5);
  const dragging = useRef(false);
  const data = files.get(indicator.id) ?? null;
  const others = options.filter((o) => o.id !== indicator.id);
  const years = data?.years ?? [];
  // 預設：有好幾年時左邊放約 20 年前（沒有就第一年），只有一年時左邊放另一個指標
  const fallbackYear = years.filter((y) => y <= year - 20).pop() ?? years[0];
  const asked = state.swipe;
  const swipe =
    asked?.kind === 'ind' && others.some((o) => o.id === asked.indicator)
      ? asked
      : asked?.kind === 'year' && years.includes(asked.year)
        ? asked
        : years.length > 1
          ? { kind: 'year' as const, year: fallbackYear }
          : others[0]
            ? { kind: 'ind' as const, indicator: others[0].id }
            : null;

  const sides = useMemo(() => {
    if (!data || !swipe) return null;
    const now = valuesNear(data, year);
    const right: Side = { indicator, label: T.withYear(indicator.label, yearLabel(indicator, now.year)), values: now.values, max: maxValue(data) };
    let left: Side;
    if (swipe.kind === 'year') {
      const before = valuesNear(data, swipe.year);
      left = { indicator, label: T.withYear(indicator.label, yearLabel(indicator, before.year)), values: before.values, max: right.max };
    } else {
      const ind = others.find((o) => o.id === swipe.indicator)!;
      const file = files.get(ind.id);
      if (!file) return null;
      const at = valuesNear(file, year);
      left = { indicator: ind, label: T.withYear(ind.label, yearLabel(ind, at.year)), values: at.values, max: maxValue(file) };
    }
    return { left, right };
  }, [data, swipe?.kind, swipe?.kind === 'year' ? swipe.year : swipe?.indicator, year, files, indicator]);

  const move = (e: PointerEvent) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    setSplit(Math.min(0.98, Math.max(0.02, (e.clientX - rect.left) / rect.width)));
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.2 : 0.05;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      setSplit((s) => Math.min(0.98, Math.max(0.02, s + (e.key === 'ArrowLeft' ? -step : step))));
    }
  };

  const controls = (
    <div className="analysis-controls">
      <span className="analysis-label">{T.swipeLabel}</span>
      {years.length > 1 && (
        <label className="select-field">
          <span>{T.swipeYear}</span>
          <select
            value={swipe?.kind === 'year' ? swipe.year : ''}
            onChange={(e) => onChange({ swipe: { kind: 'year', year: Number(e.target.value) } })}
          >
            {swipe?.kind !== 'year' && <option value="">—</option>}
            {years.map((y) => (
              <option key={y} value={y}>
                {yearLabel(indicator, y)}
              </option>
            ))}
          </select>
        </label>
      )}
      {others.length > 0 && (
        <label className="select-field">
          <span>{T.swipeIndicator}</span>
          <select
            value={swipe?.kind === 'ind' ? swipe.indicator : ''}
            onChange={(e) => onChange({ swipe: { kind: 'ind', indicator: e.target.value } })}
          >
            {swipe?.kind !== 'ind' && <option value="">—</option>}
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
  if (!sides) return controls;

  const render = (side: Side, className: string, style?: CSSProperties) => {
    const color = indicatorColor(side.indicator, tokens);
    return (
      <SvgWorld
        shapes={shapes}
        className={className}
        style={style}
        fill={(iso3) => {
          if (!color) return undefined;
          const v = side.values.get(iso3);
          return v === undefined ? null : (color(v) ?? null);
        }}
        bubbles={color ? undefined : bubblesFor(side.values, side.max)}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
        ariaLabel={side.label}
      />
    );
  };
  const pct = `${(split * 100).toFixed(1)}%`;
  return (
    <>
      {controls}
      <div
        className="analysis-swipe"
        ref={box}
        aria-label={T.swipeAria(sides.left.label, sides.right.label)}
        role="group"
        onPointerMove={(e) => dragging.current && move(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        {render(sides.left, 'is-left')}
        {render(sides.right, 'is-right', { clipPath: `inset(0 0 0 ${pct})` })}
        <span className="analysis-swipe-label is-left">{sides.left.label}</span>
        <span className="analysis-swipe-label is-right">{sides.right.label}</span>
        <div
          className="analysis-swipe-handle"
          style={{ left: pct }}
          role="slider"
          tabIndex={0}
          aria-label={T.swipeHandle}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(split * 100)}
          onPointerDown={(e) => {
            dragging.current = true;
            (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId);
            e.preventDefault();
          }}
          onKeyDown={onKey}
        >
          <span aria-hidden="true">‹ ›</span>
        </div>
        <Tooltip
          hover={hover}
          width={width}
          countries={countries}
          lines={(iso3) =>
            [sides.left, sides.right].map((s, i) => {
              const v = s.values.get(iso3);
              return T.pair(`${i ? T.right : T.left} ${s.label}`, v !== undefined ? s.indicator.format(v) : T.noData);
            })
          }
        />
      </div>
      <div className="analysis-aside is-pair">
        {sides.left.indicator === sides.right.indicator ? (
          // 兩邊同一個指標（不同年份）：同一個圖例
          <IndicatorLegend indicator={sides.right.indicator} tokens={tokens} max={sides.right.max} />
        ) : (
          <>
            <IndicatorLegend indicator={sides.left.indicator} tokens={tokens} max={sides.left.max} title={T.pair(T.left, sides.left.label)} />
            <IndicatorLegend indicator={sides.right.indicator} tokens={tokens} max={sides.right.max} title={T.pair(T.right, sides.right.label)} />
          </>
        )}
      </div>
    </>
  );
}
