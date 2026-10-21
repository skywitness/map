import { lazy, Suspense, useCallback, useMemo } from 'react';
import type { Topology } from 'topojson-specification';
import { TimeSlider } from './controls/TimeSlider';
import { zhName, type CountryTable } from './lib/countries';
import { useJson } from './lib/data';
import { useUrlState } from './lib/url-state';
import { toCountryFeatures } from './map/geometry';
import { WorldMap } from './map/WorldMap';
import { RankingTable } from './panels/RankingTable';
import { maxAcrossYears, valuesAt } from './panels/stats';
import { getTopic, PLANNED_TOPICS, TOPICS } from './topics';
import type { IndicatorData } from './topics/types';
import { useTheme } from './theme/useTheme';

// 側欄的 ECharts 佔了大部分 JS，點國家時才載入，地圖可以先出來
const CountryPanel = lazy(() => import('./panels/CountryPanel').then((m) => ({ default: m.CountryPanel })));

interface Manifest {
  generatedAt: string;
  source: string;
}

export function App() {
  const { tokens, toggle: toggleTheme } = useTheme();
  const [state, update] = useUrlState();

  const topic = getTopic(state.topic);
  const indicator =
    topic.indicators.find((i) => i.id === state.indicator) ??
    topic.indicators.find((i) => i.id === topic.defaultIndicator)!;

  const geo = useJson<Topology>('geo/countries-50m.json');
  const countries = useJson<CountryTable>('countries.json').data;
  const manifest = useJson<Manifest>(`topics/${topic.id}/manifest.json`).data;
  const { data, loading, error } = useJson<IndicatorData>(`topics/${topic.id}/${indicator.file}`);

  const features = useMemo(() => (geo.data ? toCountryFeatures(geo.data) : null), [geo.data]);

  const years = data?.years ?? [topic.defaultYear];
  const year = state.year && years.includes(state.year) ? state.year : topic.defaultYear;
  const yearIndex = data ? data.years.indexOf(year) : -1;
  const values = useMemo(() => (data ? valuesAt(data, yearIndex) : new Map<string, number>()), [data, yearIndex]);
  const bubbleMax = useMemo(() => (data ? maxAcrossYears(data) : 1), [data]);
  const world = data?.aggregates?.WLD?.[yearIndex] ?? null;

  const setYear = useCallback((y: number) => update({ year: y }), [update]);
  const selectCountry = useCallback((iso3: string | null) => update({ country: iso3 }), [update]);

  const searchOptions = useMemo(
    () =>
      data
        ? Object.keys(data.values)
            .map((iso3) => ({ iso3, name: zhName(iso3, countries) }))
            .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant-TW'))
        : [],
    [data, countries],
  );

  const renderTooltip = (iso3: string) => {
    const v = values.get(iso3);
    const projected = data?.projectionFrom !== undefined && year >= data.projectionFrom;
    return (
      <>
        <div className="tt-value">{v !== undefined ? indicator.format(v) : '無資料'}</div>
        <div className="tt-label">
          {zhName(iso3, countries)} · {year}
          {projected && ' 推估值'}
        </div>
      </>
    );
  };

  const projected = data?.projectionFrom !== undefined && year >= data.projectionFrom;

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">世界資料地圖</h1>
        <nav className="topics" aria-label="主題">
          {TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`topic${t.id === topic.id ? ' is-active' : ''}`}
              aria-current={t.id === topic.id ? 'page' : undefined}
              onClick={() => update({ topic: t.id, indicator: null })}
            >
              {t.shortTitle}
            </button>
          ))}
          {PLANNED_TOPICS.map((title) => (
            <button key={title} type="button" className="topic" disabled title="規劃中">
              {title}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="icon-button theme-toggle"
          onClick={toggleTheme}
          aria-label={tokens.mode === 'dark' ? '切換為淺色' : '切換為深色'}
          title={tokens.mode === 'dark' ? '切換為淺色' : '切換為深色'}
        >
          {tokens.mode === 'dark' ? '☀' : '☾'}
        </button>
      </header>

      <div className="controls">
        <div className="indicator-picker" role="radiogroup" aria-label="指標">
          {topic.indicators.map((ind) => (
            <button
              key={ind.id}
              type="button"
              role="radio"
              aria-checked={ind.id === indicator.id}
              className={`segment${ind.id === indicator.id ? ' is-active' : ''}`}
              onClick={() => update({ indicator: ind.id })}
            >
              {ind.label}
            </button>
          ))}
        </div>
        <div className="controls-right">
          <input
            className="search"
            type="search"
            list="country-options"
            placeholder="搜尋國家"
            aria-label="搜尋國家"
            onChange={(e) => {
              const match = searchOptions.find((o) => o.name === e.target.value || o.iso3 === e.target.value.toUpperCase());
              if (match) {
                selectCountry(match.iso3);
                e.target.value = '';
              }
            }}
          />
          <datalist id="country-options">
            {searchOptions.map((o) => (
              <option key={o.iso3} value={o.name} />
            ))}
          </datalist>
          <div className="view-toggle" role="radiogroup" aria-label="檢視方式">
            {(['map', 'table'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={state.view === v}
                className={`segment${state.view === v ? ' is-active' : ''}`}
                onClick={() => update({ view: v })}
              >
                {v === 'map' ? '地圖' : '排名表'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="indicator-desc">{indicator.description}</p>

      <main className={`stage${state.country ? ' has-panel' : ''}`}>
        <div className="stage-main">
          {error && <p className="error">資料載入失敗：{error.message}</p>}
          {state.view === 'map' ? (
            features && data ? (
              <WorldMap
                countries={features}
                indicator={indicator}
                values={values}
                bubbleMax={bubbleMax}
                tokens={tokens}
                selected={state.country}
                onSelect={selectCountry}
                renderTooltip={renderTooltip}
                ariaLabel={`世界地圖：${year} 年各國${indicator.label}${projected ? '（推估值）' : ''}`}
                dimmed={loading}
              />
            ) : (
              <p className="loading">地圖載入中…</p>
            )
          ) : (
            <RankingTable
              indicator={indicator}
              values={values}
              world={world}
              year={year}
              countries={countries}
              selected={state.country}
              onSelect={selectCountry}
            />
          )}
        </div>
        {state.country && (
          <Suspense fallback={<aside className="panel" aria-busy="true" />}>
            <CountryPanel
              topic={topic}
              indicator={indicator}
              iso3={state.country}
              year={year}
              countries={countries}
              tokens={tokens}
              onClose={() => selectCountry(null)}
              onIndicatorChange={(id) => update({ indicator: id })}
            />
          </Suspense>
        )}
      </main>

      <TimeSlider years={years} year={year} projectionFrom={data?.projectionFrom} onChange={setYear} />

      <footer className="footer">
        資料來源：
        {topic.sources.map((s) => (
          <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
            {s.name}
          </a>
        ))}
        （{topic.sources.map((s) => s.license).join('、')}）· 國界：
        <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">
          Natural Earth
        </a>
        （公有領域）
        {manifest && <> · 資料產生於 {manifest.generatedAt.slice(0, 10)}</>}
        <span className="footer-note">國界與名稱僅為資料呈現，不代表任何政治立場。</span>
      </footer>
    </div>
  );
}
