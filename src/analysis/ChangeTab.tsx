import { useMemo } from 'react';
import { tr, useLang } from '../i18n';
import { countryName, type CountryTable } from '../lib/countries';
import { fixed, formatPercent } from '../lib/format';
import type { AnalysisState } from '../lib/url-state';
import type { MapTokens } from '../theme/tokens';
import type { Indicator, IndicatorData } from '../topics/types';
import { StepLegend, Tooltip, useHover, valuesNear, yearLabel } from './common';
import { changeThresholds, classOf } from './scales';
import type { WorldShapes } from './shapes';
import { SvgWorld } from './SvgWorld';
import { TEXT } from './text';

const BACKS = [1, 5, 10, 20, 30, 50, 100];

/**
 * 變化地圖（2026-10-30）：每個國家跟幾年前比，差多少（比率、平均）或成長率（總量）。
 * 發散色：增加的是色階的右臂（預設偏綠）、減少的是左臂（偏橘），中間那一級是「變化不大」；
 * 門檻依這一次各國變化的大小取（scales.ts 的 changeThresholds），旁邊列出增加、減少最多的五國
 */
export function ChangeTab({
  shapes,
  indicator,
  data,
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
  data: IndicatorData;
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
  // 總量（比例圓）預設看成長率，比率、平均預設看差多少
  const mode = state.changeMode ?? (indicator.layer.kind === 'bubble' ? 'pct' : 'diff');
  const percentUnit = tr(indicator.unit, lang).includes('%');
  const first = data.years[0];
  const backs = BACKS.filter((n) => year - n >= first);
  const back = backs.includes(state.back) ? state.back : (backs.filter((n) => n <= state.back).pop() ?? backs[0]);

  const result = useMemo(() => {
    if (back === undefined) return null;
    const now = valuesNear(data, year);
    const past = valuesNear(data, year - back);
    if (past.year >= now.year) return null;
    const change = new Map<string, number>();
    for (const [iso3, v] of now.values) {
      const before = past.values.get(iso3);
      if (before === undefined) continue;
      if (mode === 'pct') {
        if (before > 0) change.set(iso3, ((v - before) / before) * 100);
      } else change.set(iso3, v - before);
    }
    const thresholds = changeThresholds([...change.values()]);
    const sorted = [...change].sort((a, b) => b[1] - a[1]);
    return { now, past, change, thresholds, up: sorted.slice(0, 5).filter(([, d]) => d > 0), down: sorted.slice(-5).reverse().filter(([, d]) => d < 0) };
  }, [data, year, back, mode]);

  /** 變化的寫法：成長率寫百分比、單位是 % 的寫「個百分點」，其他照指標的格式，前面加正負號 */
  const formatChange = (d: number) => {
    const size = Math.abs(d);
    const text =
      mode === 'pct'
        ? T.pctUnit(fixed(size, size < 10 ? 1 : 0))
        : percentUnit
          ? T.points(fixed(size, 1))
          : indicator.format(size);
    return `${d > 0 ? '+' : d < 0 ? '−' : ''}${text}`;
  };
  const tick = (d: number) => {
    const size = Math.abs(d);
    const text = mode === 'pct' ? formatPercent(size, size < 1 ? 1 : 0) : (indicator.formatTick ?? indicator.format)(size);
    return `${d > 0 ? '+' : '−'}${text}`;
  };

  const controls = (
    <div className="analysis-controls">
      <label className="select-field">
        <span>{T.backLabel}</span>
        <select value={back ?? ''} onChange={(e) => onChange({ back: Number(e.target.value) })} disabled={!backs.length}>
          {backs.map((n) => (
            <option key={n} value={n}>
              {T.backOption(n)}
            </option>
          ))}
        </select>
      </label>
      <div className="segmented" role="radiogroup" aria-label={T.modeLabel}>
        {(['diff', 'pct'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className={`segment${mode === m ? ' is-active' : ''}`}
            onClick={() => onChange({ changeMode: m })}
          >
            {m === 'diff' ? T.modeDiff : T.modePct}
          </button>
        ))}
      </div>
      {result && <span className="analysis-span">{T.compared(yearLabel(indicator, result.past.year), yearLabel(indicator, result.now.year))}</span>}
    </div>
  );

  if (!result) {
    return (
      <>
        {controls}
        <p className="analysis-note">{T.noPast}</p>
      </>
    );
  }
  const colors = tokens.diverging;
  const fill = (iso3: string) => {
    const d = result.change.get(iso3);
    return d === undefined ? null : colors[classOf(result.thresholds, d)];
  };
  const pick = (list: [string, number][], title: string) => (
    <div className="analysis-extremes">
      <div className="analysis-legend-title">{title}</div>
      {list.map(([iso3, d]) => (
        <button key={iso3} type="button" className={iso3 === selected ? 'is-selected' : undefined} onClick={() => onSelect(iso3)}>
          <span>{countryName(iso3, countries, lang)}</span>
          <span className="num">{formatChange(d)}</span>
        </button>
      ))}
    </div>
  );
  const from = yearLabel(indicator, result.past.year);
  const to = yearLabel(indicator, result.now.year);
  return (
    <>
      {controls}
      <div className="analysis-figure" ref={box}>
        <SvgWorld
          shapes={shapes}
          fill={fill}
          selected={selected}
          onHover={onHover}
          onSelect={onSelect}
          ariaLabel={T.changeAria(indicator.label, from, to)}
        />
        <Tooltip
          hover={hover}
          width={width}
          countries={countries}
          lines={(iso3) => {
            const before = result.past.values.get(iso3);
            const after = result.now.values.get(iso3);
            const d = result.change.get(iso3);
            return [
              T.pair(from, before !== undefined ? indicator.format(before, result.past.year) : T.noData),
              T.pair(to, after !== undefined ? indicator.format(after, result.now.year) : T.noData),
              ...(d !== undefined ? [<strong key="d">{formatChange(d)}</strong>] : []),
            ];
          }}
        />
      </div>
      <div className="analysis-aside">
        <StepLegend
          title={T.pair(indicator.label, T.compared(from, to))}
          colors={colors}
          ticks={result.thresholds.map(tick)}
        />
        <div className="analysis-flat-note">
          {T.flatRange(tick(result.thresholds[2]), tick(result.thresholds[3]))}
        </div>
        {pick(result.up, T.up)}
        {pick(result.down, T.down)}
      </div>
    </>
  );
}
