import { lazy, Suspense, useMemo, type ComponentType, type LazyExoticComponent } from 'react';
import { EChart } from '../charts/EChart';
import { timeSeriesOption, type TimeSeriesLine } from '../charts/timeSeries';
import { useLang, useT } from '../i18n';
import { countryName, enName, type CountryTable } from '../lib/countries';
import { useJsonMany } from '../lib/data';
import { formatPercent } from '../lib/format';
import {
  indicatorPath,
  usesDimension,
  type Indicator,
  type IndicatorData,
  type PanelExtraProps,
  type Topic,
} from '../topics/types';
import type { Tokens } from '../theme/tokens';
import { rankOf, valuesAt } from './stats';

interface CountryPanelProps {
  topic: Topic;
  indicator: Indicator;
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
function panelExtraFor(topic: Topic) {
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
  const t = useT();
  const lang = useLang();
  const label = (ind: Indicator) => (itemLabel && usesDimension(ind) ? t.itemIndicator(itemLabel, ind.label) : ind.label);
  const Extra = panelExtraFor(topic);
  const allData = useJsonMany<IndicatorData>(files);
  const name = countryName(iso3, countries);

  // 「只畫路網」這類不上色的指標不列成數值卡片
  const stats = topic.indicators.flatMap((ind, i) => (ind.layer.kind === 'none' ? [] : [[ind, i] as const])).map(([ind, i]) => {
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
    if (indicator.compareWorld && world) lines.push({ name: t.world, values: world, color: tokens.context });
    return timeSeriesOption({
      years: activeData.years,
      lines,
      projectionFrom: activeData.projectionFrom,
      year,
      indicator,
      tokens,
    });
  }, [activeData, iso3, name, indicator, year, tokens, t]);

  const projectionFrom = activeData?.projectionFrom;
  // 附註只有中文的話，英文介面不顯示
  const note = lang === 'en' ? activeData?.notesEn?.[iso3] : activeData?.notes?.[iso3];

  return (
    <aside className="panel" aria-label={t.panelAria(name)}>
      <header className="panel-header">
        <div>
          <h2>{name}</h2>
          <p className="panel-sub">
            {lang === 'en' ? iso3 : `${enName(iso3, countries)} · ${iso3}`}
          </p>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label={t.close}>
          ×
        </button>
      </header>

      <p className="panel-year">
        {t.year(year)}
        {projectionFrom !== undefined && year >= projectionFrom && <span className="year-tag is-projected">{t.projected}</span>}
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
            <span className="stat-value">{value != null ? ind.format(value) : t.noData}</span>
            <span className="stat-meta">
              {rank != null && t.rank(rank, total)}
              {share != null && t.shareOfWorld(formatPercent(share, share < 1 ? 2 : 1))}
              {shownYear !== null && shownYear !== year && value != null && t.shownYear(shownYear)}
            </span>
          </button>
        ))}
      </div>

      {activeData?.years.length !== 1 && (
        <section className="panel-chart">
          <h3>{t.overTime(label(indicator))}</h3>
          {option ? (
            <EChart option={option} height={220} ariaLabel={t.lineChartAria(name, label(indicator))} />
          ) : (
            <p className="empty">
              {!activeData ? t.loading : activeData.years.length < 2 ? t.singleSnapshotPanel : t.noCountryData}
            </p>
          )}
          {projectionFrom !== undefined && option && <p className="note">{t.dashedProjection(projectionFrom)}</p>}
          {note && <p className="note">{t.note(note)}</p>}
        </section>
      )}

      {Extra && (
        <Suspense fallback={<p className="empty">{t.loading}</p>}>
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
