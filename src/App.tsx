import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Topology } from 'topojson-specification';
import { CountrySearch } from './controls/CountrySearch';
import { useHotkeys } from './controls/hotkeys';
import { ShareMenu } from './controls/ShareMenu';
import { ShortcutHelp } from './controls/ShortcutHelp';
import { TimeSlider } from './controls/TimeSlider';
import { TopicNav } from './controls/TopicNav';
import { LangSwitch } from './controls/LangSwitch';
import { localize, tr, useLang, useT } from './i18n';
import { countryName, type CountryTable } from './lib/countries';
import { buildSearchIndex } from './lib/countrySearch';
import { indicatorCsv } from './lib/csv';
import { fetchJson, prefetchJson, useJson, useJsonMany } from './lib/data';
import { downloadBlob, safeFilename } from './lib/download';
import { formatPercent } from './lib/format';
import { useOnline } from './lib/useOnline';
import { read as readUrlState, useUrlState } from './lib/url-state';
import {
  buildGridIndex,
  gridInBox,
  landAreaInBox,
  type Box,
  type PopulationGrid,
} from './map/boxEstimate';
import { toCountryFeatures, type CountryFeature } from './map/geometry';
import { BASEMAP_ATTRIBUTION, BASEMAPS, getBasemap, readStoredBasemap, storeBasemap } from './map/basemaps';
import { flowText, useFlowSelection } from './map/flows';
import { decodeRailways, DEFAULT_LAYERS, type LayerVisibility } from './map/Overlays';
import { loadBaseStyle } from './map/style';
import type { WorldMapHandle } from './map/WorldMap';
import { BoxResult, type BoxContribution } from './panels/BoxResult';
import { PanelSheet } from './panels/PanelSheet';
import { RankingTable } from './panels/RankingTable';
import { latestAt, maxAcrossYears } from './panels/stats';
import { getTopic } from './topics';
import {
  forItem,
  indicatorPath,
  usesDimension,
  type AirportsData,
  type IndicatorData,
  type RailwaysData,
  type Topic,
} from './topics/types';
import { useTheme } from './theme/useTheme';

// 側欄的 ECharts 佔了大部分 JS，點國家時才載入，地圖可以先出來
const CountryPanel = lazy(() => import('./panels/CountryPanel').then((m) => ({ default: m.CountryPanel })));

// MapLibre（約 1 MB）放在自己的 chunk。首頁程式一跑起來就同時開始下載地圖程式和底圖樣式，
// 資料 JSON 也在這時發出請求，不必等 MapLibre 下載、解析完
const worldMapModule = import('./map/WorldMap');
const WorldMap = lazy(() => worldMapModule.then((m) => ({ default: m.WorldMap })));
loadBaseStyle(getBasemap(readStoredBasemap()).url).catch(() => {}); // 失敗時 WorldMap 會重抓並顯示錯誤

/**
 * 國界：先用 1:110m（gzip 後約 35 KB，解析也快）畫出第一個畫面，地圖畫出資料之後再換成
 * 1:50m（約 230 KB，含新加坡、巴林等小國，放大後也比較精細）。再次造訪時兩個都在快取裡，
 * 一樣先畫粗的：手機上解析 1:50m 要好幾百毫秒，放到第一個畫面之後。
 */
const GEO_COARSE = 'geo/countries-110m.json';
const GEO_DETAILED = 'geo/countries-50m.json';

// 第一個畫面要用的檔案，程式一載入就發出請求：不等 React 第一次 render，也不等 MapLibre 解析完。
// 之後 useJson 拿到的是同一個請求（fetchJson 有快取）
for (const path of ['countries.json', GEO_COARSE, initialIndicatorPath()]) {
  if (path) fetchJson(path).catch(() => {});
}

function initialIndicatorPath(): string | null {
  const state = readUrlState();
  // 檔名跟語言無關，用哪個語言解析都一樣
  const topic = localize(getTopic(state.topic), 'zh');
  if (topic.pure) return null;
  const indicator =
    topic.indicators.find((i) => i.id === state.indicator) ??
    topic.indicators.find((i) => i.id === topic.defaultIndicator)!;
  const item = topic.dimension?.options.find((o) => o.id === state.item)?.id ?? null;
  return indicatorPath(topic, indicator, item);
}

const NO_FEATURES: CountryFeature[] = [];

/** 指標超過這個數量就改用下拉選單 */
const MAX_SEGMENTS = 5;

interface Manifest {
  generatedAt: string;
}

export function App() {
  const { tokens, toggle: toggleTheme } = useTheme();
  const [state, update] = useUrlState();
  const lang = useLang();
  const t = useT();
  const online = useOnline();

  // 主題設定裡的雙語文字依目前語言解析成字串（有快取，同一語言拿到同一個物件）
  const topic = localize(getTopic(state.topic), lang);
  // 純地圖頁：不載入統計資料，也沒有指標、時間軸、資料側欄與排名表
  const pure = Boolean(topic.pure);
  const view = pure ? 'map' : state.view;
  const item = topic.dimension
    ? (topic.dimension.options.find((o) => o.id === state.item)?.id ?? topic.dimension.defaultOption)
    : null;
  // 子項目有自己的分級門檻時（itemScales），換成那一組
  const indicator = forItem(
    topic.indicators.find((i) => i.id === state.indicator) ??
      topic.indicators.find((i) => i.id === topic.defaultIndicator)!,
    item,
  );

  const countries = useJson<CountryTable>('countries.json').data;
  const manifest = useJson<Manifest>(pure ? null : `topics/${topic.id}/manifest.json`).data;
  const { data, loading, error } = useJson<IndicatorData>(pure ? null : indicatorPath(topic, indicator, item));
  const [basemapId, setBasemapId] = useState(readStoredBasemap);
  const basemap = getBasemap(basemapId);
  const chooseBasemap = (id: string) => {
    setBasemapId(id);
    storeBasemap(id);
  };

  // 地圖第一次畫出資料之後才做的事（精細國界、預先下載），不跟第一個畫面搶頻寬與 CPU
  const [mapShown, setMapShown] = useState(false);
  const onMapShown = useCallback(() => setMapShown(true), []);
  const features = useCountryFeatures(mapShown);
  const firstPaint = Boolean(features && (data || pure));

  // 閒置時預先下載同主題的其他指標，換指標、開側欄時不用等
  const neighbours = useMemo(
    () => (pure ? [] : topic.indicators.map((i) => indicatorPath(topic, i, item))),
    [topic, item, pure],
  );
  const settled = mapShown || (view !== 'map' && Boolean(data));
  useEffect(() => {
    if (settled) return prefetchJson(neighbours);
  }, [settled, neighbours]);

  const years = data?.years ?? [topic.defaultYear];
  const year = pickYear(years, state.year, topic.defaultYear);
  const yearIndex = data ? data.years.indexOf(year) : -1;
  // 年份零散的指標（latestWithin）會用之前最近一年的值，valueYears 記下那些國家實際的資料年份
  const { values, years: valueYears } = useMemo(
    () => (data && !pure ? latestAt(data, yearIndex) : { values: new Map<string, number>(), years: new Map<string, number>() }),
    [data, yearIndex, pure],
  );
  const bubbleMax = useMemo(() => (data ? maxAcrossYears(data) : 1), [data]);
  const world = data?.aggregates?.WLD?.[yearIndex] ?? null;

  const setYear = useCallback((y: number) => update({ year: y }), [update]);
  const selectCountry = useCallback((iso3: string | null) => update({ country: iso3 }), [update]);
  const setBox = useCallback((box: Box | null) => update({ box }), [update]);
  const setThreeD = useCallback((threeD: boolean) => update({ threeD }), [update]);

  const boxResult = useBoxEstimate(topic, item, state.box, features, year);
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const { railways, airports } = useOverlays(topic);
  const flows = useFlowSelection(topic, indicator, item, year, pure ? null : state.country);

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
  const indicatorTitle = itemLabel && usesDimension(indicator) ? t.itemIndicator(itemLabel, indicator.label) : indicator.label;

  /* ── 分享：圖片、CSV、連結 ───────────── */
  const mapHandle = useRef<WorldMapHandle>(null);
  // 流向圖畫的是選取國家的夥伴，標題要寫出是哪個國家
  const flowTitle = flows ? t.flowTitle(countryName(flows.origin, countries), indicatorTitle) : indicatorTitle;
  // 不隨時間變化的資料（海拔）：標題、檔名、tooltip、排名表都不寫年份，也沒有時間軸
  const timeless = Boolean(topic.timeless);
  const viewTitle = pure
    ? topic.title
    : `${topic.title} · ${flowTitle}${timeless ? '' : ` · ${t.yearValue(year, projected)}`}`;
  const fileBase = safeFilename(pure ? topic.title : `${t.brand}_${topic.shortTitle}_${indicatorTitle}`);

  const downloadImage = async () => {
    if (!mapHandle.current) throw new Error('The map has not loaded yet');
    // 純地圖頁的國界是底圖本身的，資料主題另外畫 Natural Earth 的國界
    const credits = pure
      ? [t.basemapCredit(BASEMAP_ATTRIBUTION), t.disclaimer]
      : [
          `${t.sources}${topic.sources.map((s) => `${s.name}${t.sourceLicense(s.license)}`).join(t.listSeparator)}`,
          t.basemapCredit(BASEMAP_ATTRIBUTION),
          t.bordersCredit,
        ];
    credits.push(window.location.href);
    const blob = await mapHandle.current.exportImage({
      title: viewTitle,
      subtitle: pure ? undefined : indicator.description,
      credits,
    });
    downloadBlob(blob, `${fileBase}${pure || timeless ? '' : `_${year}`}.png`);
  };

  const downloadCsv = (single: boolean) => {
    if (!data) return;
    const text = indicatorCsv(data, {
      unit: indicator.unit,
      countries,
      year: single ? year : undefined,
      label: indicator.layer.kind === 'categorical' ? indicator.format : undefined,
    });
    const range = single ? year : `${data.years[0]}-${data.years[data.years.length - 1]}`;
    downloadBlob(new Blob([text], { type: 'text/csv;charset=utf-8' }), `${fileBase}${timeless ? '' : `_${range}`}.csv`);
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
          {[city, countryName(iso3, countries)].filter(Boolean).join(' · ')} · {type === 1 ? t.largeAirport : t.mediumAirport}
        </div>
      </>
    );
  };

  const renderTooltip = (iso3: string) => {
    if (pure) return <div className="tt-value">{countryName(iso3, countries)}</div>;
    // 流向圖：滑到夥伴國上顯示雙邊金額與占比
    const link = flows?.links.find((l) => l.iso3 === iso3);
    if (flows && link) {
      return (
        <>
          <div className="tt-value">{indicator.format(link.value)}</div>
          <div className="tt-label">
            {flowText(lang)[flows.direction].verb(countryName(flows.origin, countries), countryName(iso3, countries))} ·{' '}
            {t.flowShare(formatPercent(link.share * 100, link.share < 0.1 ? 1 : 0))} · {flows.year}
          </div>
        </>
      );
    }
    const v = values.get(iso3);
    const valueYear = valueYears.get(iso3);
    return (
      <>
        <div className="tt-value">{v !== undefined ? indicator.format(v) : t.noData}</div>
        <div className="tt-label">
          {countryName(iso3, countries)}
          {!timeless && ` · ${valueYear !== undefined ? t.dataYear(valueYear) : year}`}
          {projected && t.tooltipProjected}
        </div>
      </>
    );
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">{t.brand}</h1>
        {!online && (
          <span className="offline-badge" role="status" title={t.offlineHint}>
            {t.offline}
          </span>
        )}
        <TopicNav current={topic} onSelect={(id) => update({ topic: id, indicator: null, item: null })} />
        <LangSwitch />
        <ShortcutHelp />
        <button
          type="button"
          className="icon-button theme-toggle"
          onClick={toggleTheme}
          aria-label={tokens.mode === 'dark' ? t.switchToLight : t.switchToDark}
          title={tokens.mode === 'dark' ? t.switchToLight : t.switchToDark}
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
              <span>{t.indicator}</span>
              <select value={indicator.id} onChange={(e) => update({ indicator: e.target.value })}>
                {topic.indicators.map((ind) => (
                  <option key={ind.id} value={ind.id}>
                    {ind.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="indicator-picker" role="radiogroup" aria-label={t.indicator}>
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
            <span>{t.basemap}</span>
            <select value={basemap.id} onChange={(e) => chooseBasemap(e.target.value)} aria-label={t.basemapStyle}>
              {BASEMAPS.map((b) => (
                <option key={b.id} value={b.id}>
                  {tr(b.label, lang)}
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
            <div className="view-toggle" role="radiogroup" aria-label={t.viewMode}>
              {(['map', 'table'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={view === v}
                  className={`segment${view === v ? ' is-active' : ''}`}
                  onClick={() => update({ view: v })}
                >
                  {v === 'map' ? t.viewMap : t.viewTable}
                </button>
              ))}
            </div>
          )}
          <ShareMenu
            shareTitle={t.shareTitle(viewTitle)}
            onDownloadImage={view === 'map' ? downloadImage : undefined}
            csv={
              data && !pure
                ? { year: timeless ? null : year, onDownloadYear: () => downloadCsv(true), onDownloadAll: () => downloadCsv(false) }
                : undefined
            }
          />
        </div>
      </div>
      <p className="indicator-desc">{indicator.description}</p>

      <main className={`stage${state.country && !pure ? ' has-panel' : ''}${pure ? ' is-pure' : ''}`}>
        <div className="stage-main">
          {error && <p className="error">{t.loadFailed(error.message)}</p>}
          {view === 'map' ? (
            // 地圖不等資料：底圖先出來，國界與資料到了再畫上去
            <Suspense fallback={<p className="loading">{t.loadingMap}</p>}>
              {!firstPaint && !error && <p className="map-status">{t.loadingData}</p>}
              <WorldMap
                ref={mapHandle}
                countries={features ?? NO_FEATURES}
                indicator={indicator}
                legendTitle={indicatorTitle}
                values={values}
                bubbleMax={bubbleMax}
                tokens={tokens}
                selected={state.country}
                onSelect={selectCountry}
                renderTooltip={renderTooltip}
                ariaLabel={pure ? t.worldMapAria : t.mapAria(timeless ? null : year, indicatorTitle, projected)}
                basemap={basemap}
                fitOnSelect={pure}
                onFirstData={onMapShown}
                threeD={state.threeD}
                onThreeDChange={setThreeD}
                terrain={topic.terrain}
                focus={focusRequest}
                dimmed={loading && data !== null}
                box={topic.boxEstimate ? state.box : null}
                onBoxChange={topic.boxEstimate ? setBox : undefined}
                boxToolLabel={topic.boxEstimate && t.boxToolFor(topic.boxEstimate.label)}
                railways={railways}
                airports={airports}
                layers={layers}
                onLayersChange={setLayers}
                renderAirportTooltip={renderAirportTooltip}
                flows={flows}
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
            </Suspense>
          ) : (
            <RankingTable
              indicator={indicator}
              title={indicatorTitle}
              values={values}
              valueYears={valueYears}
              latestWithin={data?.latestWithin}
              world={world}
              year={timeless ? null : year}
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
                  <p className="empty">{t.loading}</p>
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

      {!pure && !timeless && (
        <TimeSlider years={years} year={year} projectionFrom={data?.projectionFrom} onChange={setYear} />
      )}

      <footer className="footer">
        {t.sources}
        {topic.sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 && t.listSeparator}
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.name}
            </a>
            {t.sourceLicense(s.license)}
          </span>
        ))}
        {t.borders}
        <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">
          Natural Earth
        </a>
        {t.publicDomain}
        {manifest && t.generatedAt(manifest.generatedAt.slice(0, 10))}
        {topic.note && <span className="footer-note">{topic.note}</span>}
        <span className="footer-note">{t.disclaimer}</span>
      </footer>
    </div>
  );
}

/** 國界的幾何（先粗後細，見上面 GEO_COARSE）。mapShown：地圖畫出第一個畫面之後才載入 1:50m，不跟它搶頻寬與 CPU */
function useCountryFeatures(mapShown: boolean): CountryFeature[] | null {
  const coarse = useJson<Topology>(GEO_COARSE);
  const detailed = useJson<Topology>(mapShown || coarse.error ? GEO_DETAILED : null).data;
  const topo = detailed ?? coarse.data;
  return useMemo(() => (topo ? toCountryFeatures(topo) : null), [topo]);
}

/** 主題的疊加圖層（鐵路、機場），只在該主題載入 */
function useOverlays(topic: Topic) {
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
  topic: Topic,
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
