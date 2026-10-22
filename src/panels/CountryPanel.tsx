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
    if (!data) return { ind, value: null, rank: null, total: 0, share: null, shownYear: null };
    // 各指標涵蓋的年份不同（例如數據中心只有單一快照），沒有這一年就改用最接近的一年
    const yearIndex = nearestYearIndex(data.years, year);
    const shownYear = data.years[yearIndex];
    const values = valuesAt(data, yearIndex);
    const value = values.get(iso3) ?? null;
    const world = data.aggregates?.WLD?.[yearIndex] ?? null;
    // 計數類指標（例如模型數）大多數國家是 0，0 的排名沒有意義
    const countZero = ind.layer.kind === 'bubble' && value === 0;
    return {
      ind,
      value,
      rank: countZero ? null : rankOf(values, iso3),
      total: values.size,
      share: ind.shareOfWorld && value != null && world ? (value / world) * 100 : null,
      shownYear,
    };
  });

  const activeData = allData[topic.indicators.indexOf(indicator)];
  const option = useMemo(() => {
    if (!activeData) return null;
    const own = activeData.values[iso3];
    if (!own || activeData.years.length < 2) return null;
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
        {stats.map(({ ind, value, rank, total, share, shownYear }) => (
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
              {shownYear !== null && shownYear !== year && value != null && `（${shownYear} 年）`}
            </span>
          </button>
        ))}
      </div>

      <section className="panel-chart">
        <h3>{label(indicator)}的變化</h3>
        {option ? (
          <EChart option={option} height={220} ariaLabel={`${name}歷年${label(indicator)}折線圖`} />
        ) : (
          <p className="empty">
            {!activeData
              ? '載入中…'
              : activeData.years.length < 2
                ? '這項資料只有單一時間點，沒有歷年變化。'
                : '這個國家沒有這項資料。'}
          </p>
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

function nearestYearIndex(years: number[], year: number): number {
  const exact = years.indexOf(year);
  if (exact >= 0) return exact;
  let best = 0;
  years.forEach((y, i) => {
    if (Math.abs(y - year) < Math.abs(years[best] - year)) best = i;
  });
  return best;
}
