import { lazy, Suspense, useMemo, type ComponentType, type LazyExoticComponent } from 'react';
import { EChart } from '../charts/EChart';
import { timeSeriesOption, type TimeSeriesLine } from '../charts/timeSeries';
import { enName, zhName, type CountryTable } from '../lib/countries';
import { useJsonMany } from '../lib/data';
import { formatPercent } from '../lib/format';
import {
  indicatorPath,
  usesDimension,
  type IndicatorData,
  type IndicatorDef,
  type PanelExtraProps,
  type TopicDefinition,
} from '../topics/types';
import type { Tokens } from '../theme/tokens';
import { rankOf, valuesAt } from './stats';

interface CountryPanelProps {
  topic: TopicDefinition;
  indicator: IndicatorDef;
  item: string | null;
  itemLabel: string | null;
  iso3: string;
  year: number;
  countries: CountryTable | null;
  tokens: Tokens;
  onClose: () => void;
  onIndicatorChange: (id: string) => void;
}

// 每個主題的額外側欄區塊只建立一次 lazy 元件
const extraCache = new Map<string, LazyExoticComponent<ComponentType<PanelExtraProps>>>();
function panelExtraFor(topic: TopicDefinition) {
  if (!topic.panelExtra) return null;
  let component = extraCache.get(topic.id);
  if (!component) {
    component = lazy(topic.panelExtra);
    extraCache.set(topic.id, component);
  }
  return component;
}

export function CountryPanel(props: CountryPanelProps) {
  const { topic, indicator, item, itemLabel, iso3, year, countries, tokens, onClose, onIndicatorChange } = props;
  const files = useMemo(() => topic.indicators.map((i) => indicatorPath(topic, i, item)), [topic, item]);
  const label = (ind: IndicatorDef) => (itemLabel && usesDimension(ind) ? `${itemLabel}${ind.label}` : ind.label);
  const Extra = panelExtraFor(topic);
  const allData = useJsonMany<IndicatorData>(files);
  const name = zhName(iso3, countries);

  const stats = topic.indicators.map((ind, i) => {
    const data = allData[i];
    if (!data) return { ind, value: null, rank: null, total: 0, share: null };
    const yearIndex = data.years.indexOf(year);
    const values = valuesAt(data, yearIndex);
    const value = values.get(iso3) ?? null;
    const world = data.aggregates?.WLD?.[yearIndex] ?? null;
    return {
      ind,
      value,
      rank: rankOf(values, iso3),
      total: values.size,
      share: ind.shareOfWorld && value != null && world ? (value / world) * 100 : null,
    };
  });

  const activeData = allData[topic.indicators.indexOf(indicator)];
  const option = useMemo(() => {
    if (!activeData) return null;
    const own = activeData.values[iso3];
    if (!own) return null;
    const lines: TimeSeriesLine[] = [{ name, values: own, color: tokens.accent }];
    const world = activeData.aggregates?.WLD;
    if (indicator.compareWorld && world) lines.push({ name: '世界', values: world, color: tokens.context });
    return timeSeriesOption({
      years: activeData.years,
      lines,
      projectionFrom: activeData.projectionFrom,
      year,
      indicator,
      tokens,
    });
  }, [activeData, iso3, name, indicator, year, tokens]);

  const projectionFrom = activeData?.projectionFrom;
  const note = activeData?.notes?.[iso3];

  return (
    <aside className="panel" aria-label={`${name}的資料`}>
      <header className="panel-header">
        <div>
          <h2>{name}</h2>
          <p className="panel-sub">
            {enName(iso3, countries)} · {iso3}
          </p>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="關閉">
          ×
        </button>
      </header>

      <p className="panel-year">
        {year} 年{projectionFrom !== undefined && year >= projectionFrom && <span className="year-tag is-projected">推估值</span>}
      </p>

      <div className="stats">
        {stats.map(({ ind, value, rank, total, share }) => (
          <button
            type="button"
            key={ind.id}
            className={`stat${ind.id === indicator.id ? ' is-active' : ''}`}
            onClick={() => onIndicatorChange(ind.id)}
            aria-pressed={ind.id === indicator.id}
          >
            <span className="stat-label">{label(ind)}</span>
            <span className="stat-value">{value != null ? ind.format(value) : '無資料'}</span>
            <span className="stat-meta">
              {rank != null && `第 ${rank} / ${total} 名`}
              {share != null && ` · 占全球 ${formatPercent(share, share < 1 ? 2 : 1)}`}
            </span>
          </button>
        ))}
      </div>

      <section className="panel-chart">
        <h3>{label(indicator)}的變化</h3>
        {option ? (
          <EChart option={option} height={220} ariaLabel={`${name}歷年${label(indicator)}折線圖`} />
        ) : (
          <p className="empty">{activeData ? '這個國家沒有這項資料。' : '載入中…'}</p>
        )}
        {projectionFrom !== undefined && option && <p className="note">虛線為 {projectionFrom} 年起的推估值。</p>}
        {note && <p className="note">附註：{note}</p>}
      </section>

      {Extra && (
        <Suspense fallback={<p className="empty">載入中…</p>}>
          <Extra topic={topic} iso3={iso3} year={year} item={item} countryName={name} tokens={tokens} />
        </Suspense>
      )}
    </aside>
  );
}
