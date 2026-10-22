import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import type { Topology } from 'topojson-specification';
import { CountrySearch } from './controls/CountrySearch';
import { useHotkeys } from './controls/hotkeys';
import { ShareMenu } from './controls/ShareMenu';
import { ShortcutHelp } from './controls/ShortcutHelp';
import { TimeSlider } from './controls/TimeSlider';
import { zhName, type CountryTable } from './lib/countries';
import { buildSearchIndex } from './lib/countrySearch';
import { indicatorCsv } from './lib/csv';
import { useJson, useJsonMany } from './lib/data';
import { downloadBlob, safeFilename } from './lib/download';
import { useUrlState } from './lib/url-state';
import {
  buildGridIndex,
  gridInBox,
  landAreaInBox,
  type Box,
  type PopulationGrid,
} from './map/boxEstimate';
import { toCountryFeatures } from './map/geometry';
import { BASEMAP_ATTRIBUTION, BASEMAPS, getBasemap, readStoredBasemap, storeBasemap } from './map/basemaps';
import { decodeRailways, DEFAULT_LAYERS, type LayerVisibility } from './map/Overlays';
import { WorldMap, type WorldMapHandle } from './map/WorldMap';
import { BoxResult, type BoxContribution } from './panels/BoxResult';
import { PanelSheet } from './panels/PanelSheet';
import { RankingTable } from './panels/RankingTable';
import { maxAcrossYears, valuesAt } from './panels/stats';
import { getTopic, TOPICS } from './topics';
import {
  indicatorPath,
  usesDimension,
  type AirportsData,
  type IndicatorData,
  type RailwaysData,
  type TopicDefinition,
} from './topics/types';
import { useTheme } from './theme/useTheme';

// 側欄的 ECharts 佔了大部分 JS，點國家時才載入，地圖可以先出來
const CountryPanel = lazy(() => import('./panels/CountryPanel').then((m) => ({ default: m.CountryPanel })));

/** 指標超過這個數量就改用下拉選單 */
const MAX_SEGMENTS = 5;

const DISCLAIMER = '國界與名稱僅為資料呈現，不代表任何政治立場。';

interface Manifest {
  generatedAt: string;
}

export function App() {
  const { tokens, toggle: toggleTheme } = useTheme();
  const [state, update] = useUrlState();

  const topic = getTopic(state.topic);
  // 純地圖頁：不載入統計資料，也沒有指標、時間軸、資料側欄與排名表
  const pure = Boolean(topic.pure);
  const view = pure ? 'map' : state.view;
  const indicator =
    topic.indicators.find((i) => i.id === state.indicator) ??
    topic.indicators.find((i) => i.id === topic.defaultIndicator)!;
  const item = topic.dimension
    ? (topic.dimension.options.find((o) => o.id === state.item)?.id ?? topic.dimension.defaultOption)
    : null;

  const geo = useJson<Topology>('geo/countries-50m.json');
  const countries = useJson<CountryTable>('countries.json').data;
  const manifest = useJson<Manifest>(pure ? null : `topics/${topic.id}/manifest.json`).data;
  const { data, loading, error } = useJson<IndicatorData>(pure ? null : indicatorPath(topic, indicator, item));
  const [basemapId, setBasemapId] = useState(readStoredBasemap);
  const basemap = getBasemap(basemapId);
  const chooseBasemap = (id: string) => {
    setBasemapId(id);
    storeBasemap(id);
  };

  const features = useMemo(() => (geo.data ? toCountryFeatures(geo.data) : null), [geo.data]);

  const years = data?.years ?? [topic.defaultYear];
  const year = pickYear(years, state.year, topic.defaultYear);
  const yearIndex = data ? data.years.indexOf(year) : -1;
  const values = useMemo(
    () => (data && !pure ? valuesAt(data, yearIndex) : new Map<string, number>()),
    [data, yearIndex, pure],
  );
  const bubbleMax = useMemo(() => (data ? maxAcrossYears(data) : 1), [data]);
  const world = data?.aggregates?.WLD?.[yearIndex] ?? null;

  const setYear = useCallback((y: number) => update({ year: y }), [update]);
  const selectCountry = useCallback((iso3: string | null) => update({ country: iso3 }), [update]);
  const setBox = useCallback((box: Box | null) => update({ box }), [update]);

  const boxResult = useBoxEstimate(topic, item, state.box, features, year);
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const { railways, airports } = useOverlays(topic);

  // 搜尋範圍：地圖上有形狀的國家，加上有資料但地圖上沒有形狀的（吐瓦魯、直布羅陀）
  const searchIndex = useMemo(() => {
    const shapes = (features ?? []).map((f) => f.iso3).filter((c) => !c.startsWith('_'));
    return buildSearchIndex([...shapes, ...(pure ? [] : Object.keys(data?.values ?? {}))], countries);
  }, [data, countries, pure, features]);
  // 從搜尋選國家時，地圖一定飛過去（點地圖、點排名表則不必）
  const [focusRequest, setFocusRequest] = useState<{ iso3: string; key: number } | null>(null);
  const selectFromSearch = (iso3: string) => {
    selectCountry(iso3);
    setFocusRequest({ iso3, key: Date.now() });
  };
  useHotkeys({
    Escape: () => {
      if (state.country) selectCountry(null);
      else if (state.box) setBox(null);
    },
  });

  const projected = data?.projectionFrom !== undefined && year >= data.projectionFrom;
  const itemLabel = topic.dimension?.options.find((o) => o.id === item)?.label;
  const indicatorTitle = itemLabel && usesDimension(indicator) ? `${itemLabel}${indicator.label}` : indicator.label;

  /* ── 分享：圖片、CSV、連結 ───────────── */
  const mapHandle = useRef<WorldMapHandle>(null);
  const viewTitle = pure
    ? topic.title
    : `${topic.title} · ${indicatorTitle} · ${year} 年${projected ? '（推估值）' : ''}`;
  const fileBase = safeFilename(pure ? '世界地圖' : `世界資料地圖_${topic.shortTitle}_${indicatorTitle}`);

  const downloadImage = async () => {
    if (!mapHandle.current) throw new Error('地圖還沒載入');
    // 純地圖頁的國界是底圖本身的，資料主題另外畫 Natural Earth 的國界
    const credits = pure
      ? [`底圖：${BASEMAP_ATTRIBUTION}`, DISCLAIMER]
      : [
          `資料來源：${topic.sources.map((s) => `${s.name}（${s.license}）`).join('、')}`,
          `底圖：${BASEMAP_ATTRIBUTION}`,
          `國界：Natural Earth（公有領域）。${DISCLAIMER}`,
        ];
    credits.push(window.location.href);
    const blob = await mapHandle.current.exportImage({
      title: viewTitle,
      subtitle: pure ? undefined : indicator.description,
      credits,
    });
    downloadBlob(blob, `${fileBase}${pure ? '' : `_${year}`}.png`);
  };

  const downloadCsv = (single: boolean) => {
    if (!data) return;
    const text = indicatorCsv(data, { unit: indicator.unit, countries, year: single ? year : undefined });
    const range = single ? year : `${data.years[0]}-${data.years[data.years.length - 1]}`;
    downloadBlob(new Blob([text], { type: 'text/csv;charset=utf-8' }), `${fileBase}_${range}.csv`);
  };

  const renderAirportTooltip = (index: number) => {
    const row = airports?.rows[index];
    if (!row) return null;
    const [, , type, name, iata, city, iso3] = row;
    return (
      <>
        <div className="tt-value">
          {name}
          {iata && ` (${iata})`}
        </div>
        <div className="tt-label">
          {[city, zhName(iso3, countries)].filter(Boolean).join(' · ')} · {type === 1 ? '大型機場' : '中型機場'}
        </div>
      </>
    );
  };

  const renderTooltip = (iso3: string) => {
    if (pure) return <div className="tt-value">{zhName(iso3, countries)}</div>;
    const v = values.get(iso3);
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
              onClick={() => update({ topic: t.id, indicator: null, item: null })}
            >
              {t.shortTitle}
            </button>
          ))}
        </nav>
        <ShortcutHelp />
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
        <div className="controls-left">
          {pure && <h2 className="page-title">{topic.title}</h2>}
          {!pure && topic.dimension && usesDimension(indicator) && (
            <label className="select-field">
              <span>{topic.dimension.label}</span>
              <select value={item ?? ''} onChange={(e) => update({ item: e.target.value })}>
                {groupOptions(topic.dimension.options).map(([group, options]) =>
                  group ? (
                    <optgroup key={group} label={group}>
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))
                  ),
                )}
              </select>
            </label>
          )}
          {pure ? null : topic.indicators.length > MAX_SEGMENTS ? (
            <label className="select-field">
              <span>指標</span>
              <select value={indicator.id} onChange={(e) => update({ indicator: e.target.value })}>
                {topic.indicators.map((ind) => (
                  <option key={ind.id} value={ind.id}>
                    {ind.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
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
          )}
        </div>
        <div className="controls-right">
          <label className="select-field">
            <span>底圖</span>
            <select value={basemap.id} onChange={(e) => chooseBasemap(e.target.value)} aria-label="底圖配色">
              {BASEMAPS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <CountrySearch
            index={searchIndex}
            onSelect={selectFromSearch}
            valueOf={
              pure
                ? undefined
                : (iso3) => {
                    const v = values.get(iso3);
                    return v !== undefined ? indicator.format(v) : null;
                  }
            }
          />
          {!pure && (
            <div className="view-toggle" role="radiogroup" aria-label="檢視方式">
              {(['map', 'table'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={view === v}
                  className={`segment${view === v ? ' is-active' : ''}`}
                  onClick={() => update({ view: v })}
                >
                  {v === 'map' ? '地圖' : '排名表'}
                </button>
              ))}
            </div>
          )}
          <ShareMenu
            shareTitle={`${viewTitle}｜世界資料地圖`}
            onDownloadImage={view === 'map' ? downloadImage : undefined}
            csv={
              data && !pure
                ? { year, onDownloadYear: () => downloadCsv(true), onDownloadAll: () => downloadCsv(false) }
                : undefined
            }
          />
        </div>
      </div>
      <p className="indicator-desc">{indicator.description}</p>

      <main className={`stage${state.country && !pure ? ' has-panel' : ''}${pure ? ' is-pure' : ''}`}>
        <div className="stage-main">
          {error && <p className="error">資料載入失敗：{error.message}</p>}
          {view === 'map' ? (
            features && (data || pure) ? (
              <WorldMap
                ref={mapHandle}
                countries={features}
                indicator={indicator}
                legendTitle={indicatorTitle}
                values={values}
                bubbleMax={bubbleMax}
                tokens={tokens}
                selected={state.country}
                onSelect={selectCountry}
                renderTooltip={renderTooltip}
                ariaLabel={pure ? '世界地圖' : `世界地圖：${year} 年各國${indicatorTitle}${projected ? '（推估值）' : ''}`}
                basemap={basemap}
                fitOnSelect={pure}
                focus={focusRequest}
                dimmed={loading}
                box={topic.boxEstimate ? state.box : null}
                onBoxChange={topic.boxEstimate ? setBox : undefined}
                boxToolLabel={topic.boxEstimate && `框選範圍，估算${topic.boxEstimate.label}`}
                railways={railways}
                airports={airports}
                layers={layers}
                onLayersChange={setLayers}
                renderAirportTooltip={renderAirportTooltip}
                overlay={
                  boxResult && (
                    <BoxResult
                      label={boxResult.label}
                      unit={boxResult.unit}
                      year={year}
                      total={boxResult.total}
                      landKm2={boxResult.landKm2}
                      contributions={boxResult.contributions}
                      grid={boxResult.grid}
                      countries={countries}
                      onClear={() => setBox(null)}
                    />
                  )
                }
              />
            ) : (
              <p className="loading">地圖載入中…</p>
            )
          ) : (
            <RankingTable
              indicator={indicator}
              title={indicatorTitle}
              values={values}
              world={world}
              year={year}
              countries={countries}
              selected={state.country}
              onSelect={selectCountry}
            />
          )}
        </div>
        {state.country && !pure && (
          <PanelSheet onClose={() => selectCountry(null)}>
            <Suspense
              fallback={
                <aside className="panel" aria-busy="true">
                  <p className="empty">載入中…</p>
                </aside>
              }
            >
              <CountryPanel
                topic={topic}
                indicator={indicator}
                item={item}
                itemLabel={itemLabel ?? null}
                iso3={state.country}
                year={year}
                countries={countries}
                tokens={tokens}
                onClose={() => selectCountry(null)}
                onIndicatorChange={(id) => update({ indicator: id })}
              />
            </Suspense>
          </PanelSheet>
        )}
      </main>

      {!pure && <TimeSlider years={years} year={year} projectionFrom={data?.projectionFrom} onChange={setYear} />}

      <footer className="footer">
        資料來源：
        {topic.sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 && '、'}
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.name}
            </a>
            （{s.license}）
          </span>
        ))}
        · 國界：
        <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">
          Natural Earth
        </a>
        （公有領域）
        {manifest && <> · 資料產生於 {manifest.generatedAt.slice(0, 10)}</>}
        {topic.note && <span className="footer-note">{topic.note}</span>}
        <span className="footer-note">國界與名稱僅為資料呈現，不代表任何政治立場。</span>
      </footer>
    </div>
  );
}

/** 主題的疊加圖層（鐵路、機場），只在該主題載入 */
function useOverlays(topic: TopicDefinition) {
  const overlays = topic.overlays ?? [];
  const files = useMemo(() => overlays.map((o) => `topics/${topic.id}/${o.file}`), [topic.id, overlays]);
  const loaded = useJsonMany<unknown>(files);
  const railIndex = overlays.findIndex((o) => o.id === 'railways');
  const airportIndex = overlays.findIndex((o) => o.id === 'airports');
  const railData = railIndex >= 0 ? (loaded[railIndex] as RailwaysData | null) : null;
  const railways = useMemo(() => (railData ? decodeRailways(railData) : null), [railData]);
  const airports = airportIndex >= 0 ? (loaded[airportIndex] as AirportsData | null) : null;
  return { railways, airports };
}

/** 網址指定的年份 → 主題預設年份 → 資料中最接近預設年份的一年 */
function pickYear(years: number[], wanted: number | null, fallback: number): number {
  if (wanted && years.includes(wanted)) return wanted;
  if (years.includes(fallback)) return fallback;
  return years.reduce((best, y) => (Math.abs(y - fallback) < Math.abs(best - fallback) ? y : best), years[0]);
}

function groupOptions<T extends { group?: string }>(options: T[]): [string | undefined, T[]][] {
  const groups = new Map<string | undefined, T[]>();
  for (const o of options) {
    const list = groups.get(o.group) ?? [];
    list.push(o);
    groups.set(o.group, list);
  }
  return [...groups];
}

/**
 * 框選估算：網格決定國內怎麼分布，選定年份的國家總量決定水準。
 * 某國的框內估計 = 框內網格人數 ÷ 該國網格總人數 × 該國當年總量。
 */
function useBoxEstimate(
  topic: TopicDefinition,
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
