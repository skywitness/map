import { useEffect, useMemo, useState } from 'react';
import { tr, useLang } from '../i18n';
import { countryName, type CountryTable } from '../lib/countries';
import type { AnalysisState } from '../lib/url-state';
import { MAP_TOKENS } from '../theme/tokens';
import type { Indicator, IndicatorData } from '../topics/types';
import { NO_DATA_SWATCH } from '../map/worldMapLayers';
import { Tooltip, useHover, valuesNear, yearLabel } from './common';
import type { WorldShapes } from './shapes';
import { SvgWorld } from './SvgWorld';
import { TEXT } from './text';

type Condition = AnalysisState['filters'][number];

/** 不符合的國家：很淡的灰（比無資料的灰淺，看得出差別） */
const OTHER = '#e4e1d9';

/** 1、2、2.5、5 × 10ⁿ 的兩位有效數字，當預設門檻（中位數） */
const round2 = (v: number) => Number(v.toPrecision(2));

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * 多條件篩選（2026-10-30）：最多三個條件（同一個主題的指標、高於或低於、門檻），都符合的國家在地圖上亮起來，
 * 下面列出來；缺其中某個指標資料的國家畫斜線。條件寫在網址（flt=），還沒設時先用目前的指標高於各國中位數
 */
export function FilterTab({
  shapes,
  indicator,
  options,
  files,
  year,
  countries,
  selected,
  onSelect,
  state,
  onChange,
  width,
}: {
  shapes: WorldShapes;
  indicator: Indicator;
  /** 可以當條件的指標（連續的數值） */
  options: Indicator[];
  files: Map<string, IndicatorData | null>;
  year: number;
  countries: CountryTable | null;
  selected: string | null;
  onSelect: (iso3: string) => void;
  state: AnalysisState;
  onChange: (patch: Partial<AnalysisState>) => void;
  width: number;
}) {
  const lang = useLang();
  const T = TEXT[lang];
  const { box, hover, onHover } = useHover();
  const byId = new Map(options.map((o) => [o.id, o]));

  // 每個指標在這一年（沒有就用最接近、不晚於的那一年）的值
  const at = useMemo(() => {
    const out = new Map<string, { year: number; values: Map<string, number> }>();
    for (const [id, file] of files) if (file && byId.has(id)) out.set(id, valuesNear(file, year));
    return out;
  }, [files, year, options]);

  const fallback: Condition[] = useMemo(() => {
    const first = byId.has(indicator.id) ? indicator.id : options[0]?.id;
    const values = first ? at.get(first)?.values : undefined;
    return first && values?.size ? [{ indicator: first, op: 'gt', value: round2(median([...values.values()])) }] : [];
  }, [at, indicator.id, options]);
  const conditions = (state.filters.length ? state.filters : fallback).filter((c) => byId.has(c.indicator));
  const setConditions = (list: Condition[]) => onChange({ filters: list });

  const result = useMemo(() => {
    const match: [string, number][] = [];
    const missing = new Set<string>();
    const all = new Set<string>();
    for (const c of conditions) for (const iso3 of at.get(c.indicator)?.values.keys() ?? []) all.add(iso3);
    for (const iso3 of all) {
      let ok = true;
      for (const c of conditions) {
        const v = at.get(c.indicator)?.values.get(iso3);
        if (v === undefined) {
          missing.add(iso3);
          ok = false;
          break;
        }
        if (c.op === 'gt' ? !(v > c.value) : !(v < c.value)) ok = false;
      }
      if (ok && conditions.length) match.push([iso3, at.get(conditions[0].indicator)!.values.get(iso3)!]);
    }
    // 依第一個條件的指標排：高於的由大到小、低於的由小到大
    match.sort((a, b) => (conditions[0]?.op === 'lt' ? a[1] - b[1] : b[1] - a[1]));
    return { match, missing, matched: new Set(match.map(([iso3]) => iso3)) };
  }, [conditions, at]);

  const fill = (iso3: string) => (result.matched.has(iso3) ? MAP_TOKENS.accent : result.missing.has(iso3) ? null : at.size ? OTHER : undefined);
  const update = (i: number, patch: Partial<Condition>) => setConditions(conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <>
      <div className="analysis-conditions">
        <div className="analysis-legend-title">{T.conditions}</div>
        {conditions.map((c, i) => {
          const ind = byId.get(c.indicator)!;
          const data = at.get(c.indicator);
          const values = data ? [...data.values.values()] : [];
          return (
            <div key={i} className="analysis-condition">
              <select aria-label={T.conditionIndicator} value={c.indicator} onChange={(e) => update(i, { indicator: e.target.value })}>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select aria-label={T.conditionOp} value={c.op} onChange={(e) => update(i, { op: e.target.value as Condition['op'] })}>
                <option value="gt">{T.above}</option>
                <option value="lt">{T.below}</option>
              </select>
              <NumberField label={T.conditionValue} value={c.value} onChange={(value) => update(i, { value })} />
              <span className="analysis-unit">{tr(ind.unit, lang)}</span>
              {conditions.length > 1 && (
                <button type="button" className="analysis-remove" aria-label={T.removeCondition} onClick={() => setConditions(conditions.filter((_, j) => j !== i))}>
                  ×
                </button>
              )}
              {values.length > 0 && (
                <div className="analysis-hint">
                  {T.range(ind.format(Math.min(...values)), ind.format(median(values)), ind.format(Math.max(...values)))}
                  {data && data.year !== year && T.otherYear(yearLabel(ind, data.year))}
                </div>
              )}
            </div>
          );
        })}
        {conditions.length < 3 && options.length > 0 && (
          <button
            type="button"
            className="analysis-add"
            onClick={() => {
              const next = options.find((o) => !conditions.some((c) => c.indicator === o.id)) ?? options[0];
              const values = at.get(next.id)?.values;
              setConditions([...conditions, { indicator: next.id, op: 'gt', value: values?.size ? round2(median([...values.values()])) : 0 }]);
            }}
          >
            + {T.addCondition}
          </button>
        )}
      </div>
      <div className="analysis-figure" ref={box}>
        <SvgWorld shapes={shapes} fill={fill} selected={selected} onHover={onHover} onSelect={onSelect} ariaLabel={T.filterAria(result.match.length)} />
        <Tooltip
          hover={hover}
          width={width}
          countries={countries}
          lines={(iso3) =>
            conditions.map((c) => {
              const ind = byId.get(c.indicator)!;
              const v = at.get(c.indicator)?.values.get(iso3);
              return T.pair(ind.label, v !== undefined ? ind.format(v) : T.noData);
            })
          }
        />
      </div>
      <div className="analysis-aside">
        <div className="analysis-legend">
          <span className="analysis-legend-row">
            <span className="analysis-swatch" style={{ background: MAP_TOKENS.accent }} />
            {T.legendMatch}
          </span>
          <span className="analysis-legend-row">
            <span className="analysis-swatch" style={{ background: OTHER }} />
            {T.legendOther}
          </span>
          <span className="analysis-legend-row">
            <span className="swatch-nodata" style={{ background: NO_DATA_SWATCH }} />
            {T.legendMissing}
          </span>
        </div>
        <div className="analysis-matches">
          <div className="analysis-legend-title">{T.matches(result.match.length)}</div>
          {result.match.length ? (
            <div className="analysis-chips">
              {result.match.map(([iso3]) => (
                <button key={iso3} type="button" className={iso3 === selected ? 'is-selected' : undefined} onClick={() => onSelect(iso3)}>
                  {countryName(iso3, countries, lang)}
                </button>
              ))}
            </div>
          ) : (
            <p className="analysis-note">{T.noMatch}</p>
          )}
          {result.missing.size > 0 && <p className="analysis-hint">{T.insufficient(result.missing.size)}</p>}
        </div>
      </div>
    </>
  );
}

/**
 * 門檻的輸入框：自己留著打到一半的字（「0.」「-」），是合法的數字才寫回去；外面的值換了（換指標）才跟著換
 */
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // 只在外面的值變了時同步
  }, [value]);
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={label}
      value={text}
      step="any"
      onChange={(e) => {
        setText(e.target.value);
        const v = Number(e.target.value);
        if (e.target.value.trim() !== '' && Number.isFinite(v)) onChange(v);
      }}
    />
  );
}
