import { useMemo, useState } from 'react';
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

const PANELS = 4;

/** 從第一年到目前的年份平均取 4 個（資料的年份裡最接近的），最後一個是目前的年份 */
function spreadYears(years: number[], year: number): number[] {
  const upto = years.filter((y) => y <= year);
  if (upto.length <= PANELS) return upto.length ? upto : years.slice(0, PANELS);
  const first = upto[0];
  const picks = Array.from({ length: PANELS }, (_, i) => {
    const target = first + ((year - first) * i) / (PANELS - 1);
    return upto.reduce((best, y) => (Math.abs(y - target) < Math.abs(best - target) ? y : best), upto[0]);
  });
  return [...new Set(picks)];
}

/**
 * 小地圖並排（2026-10-30）：同一個指標的 4 個年份（從第一年到目前的年份平均取），共用一個圖例；
 * 或同一年的幾個指標（最多 4 個，目前的指標排第一），各自的圖例。滑到一國時每張小地圖都框起來，tooltip 列出每張的值
 */
export function MultiplesTab({
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
  const [hovered, setHovered] = useState<string | null>(null);
  const data = files.get(indicator.id) ?? null;
  const byIndicators = state.multiples === 'inds' && options.length > 1;

  const panels = useMemo(() => {
    if (byIndicators) {
      const list = [indicator, ...options.filter((o) => o.id !== indicator.id)].slice(0, PANELS);
      return list.flatMap((ind) => {
        const file = files.get(ind.id);
        if (!file) return [];
        const at = valuesNear(file, year);
        return [{ key: ind.id, indicator: ind, label: T.withYear(ind.label, yearLabel(ind, at.year)), values: at.values, max: maxValue(file) }];
      });
    }
    if (!data) return [];
    const max = maxValue(data);
    return spreadYears(data.years, year).map((y) => ({ key: String(y), indicator, label: yearLabel(indicator, y), values: valuesNear(data, y).values, max }));
  }, [byIndicators, indicator, options, files, data, year]);

  const hoverAll = (iso3: string | null, e?: Parameters<typeof onHover>[1]) => {
    setHovered(iso3);
    onHover(iso3, e);
  };

  return (
    <>
      {options.length > 1 && (
        <div className="analysis-controls">
          <span className="analysis-label">{T.multiplesLabel}</span>
          <div className="segmented" role="radiogroup" aria-label={T.multiplesLabel}>
            {(['years', 'inds'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={state.multiples === m}
                className={`segment${state.multiples === m ? ' is-active' : ''}`}
                onClick={() => onChange({ multiples: m })}
              >
                {m === 'years' ? T.byYears : T.byIndicators}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="analysis-multiples" ref={box}>
        {panels.map((p) => {
          const color = indicatorColor(p.indicator, tokens);
          return (
            <figure key={p.key} className="analysis-panel">
              <figcaption>{p.label}</figcaption>
              <SvgWorld
                shapes={shapes}
                fill={(iso3) => {
                  if (!color) return undefined;
                  const v = p.values.get(iso3);
                  return v === undefined ? null : (color(v) ?? null);
                }}
                bubbles={color ? undefined : bubblesFor(p.values, p.max, 20)}
                selected={selected}
                hovered={hovered}
                onHover={hoverAll}
                onSelect={onSelect}
                ariaLabel={T.multiplesAria(p.indicator.label, p.label)}
              />
              {byIndicators && <IndicatorLegend indicator={p.indicator} tokens={tokens} max={p.max} />}
            </figure>
          );
        })}
        <Tooltip
          hover={hover}
          width={width}
          countries={countries}
          lines={(iso3) =>
            panels.map((p) => {
              const v = p.values.get(iso3);
              return T.pair(p.label, v !== undefined ? p.indicator.format(v) : T.noData);
            })
          }
        />
      </div>
      {!byIndicators && panels[0] && (
        <div className="analysis-aside">
          <IndicatorLegend indicator={indicator} tokens={tokens} max={panels[0].max} />
        </div>
      )}
    </>
  );
}
