import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CountrySearch } from './controls/CountrySearch';
import { useHotkeys } from './controls/hotkeys';
import { ClampedText } from './controls/ClampedText';
import type { PaletteAction } from './controls/CommandPalette';
import { SavedViews } from './controls/SavedViews';
import { ShareMenu } from './controls/ShareMenu';
import { StatusCard } from './controls/StatusCard';
import { TimeSlider } from './controls/TimeSlider';
import { localize, setLang, tr, useLang, useT } from './i18n';
import { countryName, registerPlaces, type CountryTable } from './lib/countries';
import { buildSearchIndex } from './lib/countrySearch';
import { rememberTopic } from './lib/recentTopics';
import { useLayoutPrefs } from './lib/layoutPrefs';
import { openSavedView, useSavedViews } from './lib/savedViews';
import { langParam } from './i18n/lang';
import { useUI } from './lib/strings';
import type { TopicTarget } from './lib/topicSearch';
import { clockAt, dateInputValue, floorMinute, formatClock, formatDay, formatMoment, formatTimeParam } from './lib/clock';
import { indicatorCsv } from './lib/csv';
import { derivedData } from './lib/derive';
import { useLive } from './lib/live';
import { fetchJson, prefetchJson, useJson } from './lib/data';
import { downloadBlob, safeFilename } from './lib/download';
import { formatPercent } from './lib/format';
import { useOnline } from './lib/useOnline';
import { NARROW_QUERY, useMediaQuery } from './lib/useMediaQuery';
import { recolourText, usePalette } from './map/palettes';
import { currentHref, read as readUrlState, takeRedirectLayer, useUrlState } from './lib/url-state';
import type { Box } from './map/boxEstimate';
import { fetchGridMeta, gridEpoch, gridLabels, useGridMeta, type GridLayer } from './map/densityGrid';
import { countryLocator, type CountryFeature } from './map/geometry';
import { BASEMAP_ATTRIBUTION, defaultBasemap, getBasemap, readStoredBasemap, storeBasemap } from './map/basemaps';
import { flowText, useFlowSelection } from './map/flows';
import { DEFAULT_LAYERS, type LayerVisibility, type OverlayLayer } from './map/overlayData';
import { buildPlaceIndex, searchPlaces as findPlaces, type PlaceEntry, type PlaceLayer } from './lib/placeSearch';
import type { PlaceOption } from './controls/CommandPaletteDialog';
import { clearRoutes, importRouteFiles, routesToGeoJson, usePersonalRoutes, type PersonalRoute } from './lib/personalRoutes';
import type { PersonalMenu } from './map/BasemapMenu';
import { PERSONAL_ID, personalDecoded, personalOverlay } from './app/personalOverlay';
import { loadBaseStyle } from './map/style';
import type { MapView, WorldMapHandle } from './map/WorldMap';
import { CloseIcon } from './map/MapIcons';
import { BoxResult } from './panels/BoxResult';
import { coreBox } from './lib/coreBox';
import { ListSide } from './panels/ListSide';
import { PanelSheet } from './panels/PanelSheet';
import { PanelSkeleton } from './panels/Skeleton';
import { latestAt, maxAcrossYears, ranking, rowRanks } from './panels/stats';
import { Sparkline } from './map/Sparkline';
import { loadedTopic, loadTopic } from './topics';
import { SHARED_LAYERS } from './topics/shared-layers';
import {
  dataFolder,
  dimensionOf,
  forItem,
  indicatorPath,
  missingReason,
  overlayEpoch,
  resolveAlias,
  resolveItem,
  sameTimeAxis,
  usesDimension,
  yearBin,
  type ClockAt,
  type Indicator,
  type IndicatorData,
  type ListRow,
  type MapMark,
  type PointRecord,
  type TopicDefinition,
} from './topics/types';
import { initialThemeMode, useTheme } from './theme/useTheme';
import {
  GEO_COARSE,
  useBoxEstimate,
  useCountryFeatures,
  useFitMap,
  useFlagSpecs,
  useNow,
  useTopicReady,
} from './app/hooks';
import { canAnalyse, groupOptions, pickYear } from './app/options';
import { useOverlays, useSharedOverlays } from './app/overlays';
import { worldTrend } from './app/trend';
import { MapFallback } from './app/GlobePlaceholder';
import { TopBar } from './app/TopBar';
import { Footer } from './app/Footer';

// 國家側欄（含圖表）點國家時才載入，地圖可以先出來（2026-10-29 以前側欄的 ECharts 壓縮後約 180 KB）
const CountryPanel = lazy(() => import('./panels/CountryPanel').then((m) => ({ default: m.CountryPanel })));
// 排名表、時刻主題的時間軸（晝夜與季節，連同太陽位置的計算）也是用到才下載（2026-10-30）
const RankingTable = lazy(() => import('./panels/RankingTable').then((m) => ({ default: m.RankingTable })));
const MomentControl = lazy(() => import('./controls/MomentControl').then((m) => ({ default: m.MomentControl })));
const RouteProfilePanel = lazy(() => import('./charts/RouteProfilePanel').then((m) => ({ default: m.RouteProfilePanel })));
// 分析檢視（src/analysis/）：切到分析才下載
const AnalysisView = lazy(() => import('./analysis/AnalysisView'));

// MapLibre（約 1 MB）放在自己的 chunk。首頁程式一跑起來就同時開始下載地圖程式和底圖樣式，
// 資料 JSON 也在這時發出請求，不必等 MapLibre 下載、解析完
const worldMapModule = import('./map/WorldMap');
const WorldMap = lazy(() => worldMapModule.then((m) => ({ default: m.WorldMap })));
// 失敗時 WorldMap 會重抓並顯示錯誤
loadBaseStyle(getBasemap(readStoredBasemap() ?? defaultBasemap(initialThemeMode() === 'dark')).url).catch(() => {});

// 第一個畫面要用的檔案，程式一載入就發出請求：不等 React 第一次 render，也不等 MapLibre 解析完。
// 之後 useJson 拿到的是同一個請求（fetchJson 有快取）
for (const path of ['countries.json', GEO_COARSE]) fetchJson(path).catch(() => {});
// 指標檔要等主題的定義（人口以外的主題各自一個 chunk，index.html 已經先預載）才知道是哪一個
loadTopic(readUrlState().topic)
  .then((definition) => {
    const path = initialIndicatorPath(definition);
    if (path) fetchJson(path).catch(() => {});
  })
  .catch(() => {});

function initialIndicatorPath(definition: TopicDefinition): string | null {
  const url = readUrlState();
  // 舊網址的指標 id（indicatorAliases）先換成現在的指標與子項目
  const state = resolveAlias(definition, url);
  // 檔名跟語言無關，用哪個語言解析都一樣
  const topic = localize(definition, 'zh');
  if (topic.pure) return null;
  const chosen =
    topic.indicators.find((i) => i.id === state.indicator) ?? topic.indicators.find((i) => i.id === topic.defaultIndicator)!;
  // 指標可以有自己的子項目（dimensionOf）；網格的資料夾可能跟著子項目換（forItem），跟 App 裡用同一個解析
  const item = resolveItem(dimensionOf(topic, chosen), state.item, state.country);
  const indicator = forItem(chosen, item);
  // 網址指定網格時，圖磚的 meta.json 也一起提早請求
  if (indicator.grid && (indicator.grid.only || (state.grid ?? indicator.grid.defaultOn)) && state.view === 'map') {
    fetchGridMeta(indicator.grid.dir).catch(() => {});
  }
  return indicatorPath(topic, indicator, item);
}

const NO_FEATURES: CountryFeature[] = [];

/** 排名表跟幾年前比 */
const CHANGE_YEARS = 10;

/** 指標超過這個數量就改用下拉選單 */
const MAX_SEGMENTS = 5;

interface Manifest {
  generatedAt: string;
}

export function App() {
  const { tokens, toggle: toggleTheme } = useTheme();
  const [liveUrlState, update] = useUrlState();
  const urlState = useTopicReady(liveUrlState);
  // 第一個畫面時網址的主題下載失敗（main.tsx 不擋）就開預設的主題
  const definition = loadedTopic(urlState.topic) ?? loadedTopic(null)!;
  // 舊網址的指標 id（例如氣候主題的 co2-per-capita）換成現在的指標與子項目，網址也改寫成新的
  const state = resolveAlias(definition, urlState);
  useEffect(() => {
    // 正在下載別的主題時（urlState 是舊的）不改網址
    if (state !== urlState && urlState === liveUrlState) update({ indicator: state.indicator, item: state.item }, { replace: true });
  }, [state, urlState, liveUrlState, update]);
  // 版面：時間軸、資料來源與說明可以分別關掉（頂列的「版面」選單）；嵌入模式不管這個設定，照樣都顯示
  const [layout, setLayout] = useLayoutPrefs();
  const showTime = state.embed || layout.time;
  const showSources = state.embed || layout.sources;
  const lang = useLang();
  const t = useT();
  const online = useOnline();
  // 手機：三個以上的指標改用下拉選單（按鈕會換成兩三行，把地圖往下擠）
  const narrow = useMediaQuery(NARROW_QUERY);
  const appRef = useRef<HTMLDivElement>(null);
  useFitMap(appRef);

  // 主題設定裡的雙語文字依目前語言解析成字串（有快取，同一語言拿到同一個物件）
  // 共用疊加圖層（topics/shared-layers.ts）：圖層選單打開的接在主題自己的疊加圖層後面（主題自己就有的不重複）
  const [sharedOn, setSharedOn] = useState<string[]>([]);
  // 沒選國家時的側欄（主題的 worldPanel）：關掉的主題記在這裡，這次不再出現
  const [worldClosed, setWorldClosed] = useState<string | null>(null);
  const sharedDefs = useSharedOverlays(sharedOn);
  // 我的路線（TopicDefinition.personalRoutes，lib/personalRoutes.ts）：使用者在這個瀏覽器匯入的路線，有路線時多一個線圖層
  const personalCfg = definition.personalRoutes;
  const { routes: personalRoutes, error: personalError } = usePersonalRoutes(personalCfg ? definition.id : null);
  const personalDef = useMemo(() => (personalCfg && personalRoutes.length ? personalOverlay(personalCfg) : null), [personalCfg, personalRoutes.length]);
  const shown = useMemo(() => {
    const own = definition.overlays ?? [];
    const extra = sharedDefs.filter((d) => !own.some((o) => o.id === d.id) && ('topic' in d ? d.topic : undefined) !== definition.id);
    if (personalDef) extra.push(personalDef);
    return extra.length ? { ...definition, overlays: [...own, ...extra] } : definition;
  }, [definition, sharedDefs, personalDef]);
  const sharedChoices = useMemo(
    () =>
      SHARED_LAYERS.filter((l) => l.topic !== definition.id && !definition.overlays?.some((o) => l.ids.includes(o.id))).map((l) => ({
        id: l.id,
        label: tr(l.label, lang),
        checked: sharedOn.includes(l.id),
      })),
    [definition, sharedOn, lang],
  );
  const toggleShared = useCallback((id: string) => setSharedOn((on) => (on.includes(id) ? on.filter((x) => x !== id) : [...on, id])), []);
  const personalMenu = useMemo<PersonalMenu | undefined>(
    () =>
      personalCfg
        ? {
            count: personalRoutes.length,
            unavailable: personalError,
            onImport: (files) => importRouteFiles(files, definition.id),
            onExport: () =>
              downloadBlob(new Blob([routesToGeoJson(personalRoutes)], { type: 'application/geo+json' }), `my-routes-${definition.id}.geojson`),
            onClear: () => clearRoutes(definition.id),
          }
        : undefined,
    [personalCfg, personalRoutes, personalError, definition.id],
  );
  const topic = localize(shown, lang);
  // 主題自訂地點（奧運的歷史隊伍等）的名稱，排名表、tooltip、側欄的 countryName() 才查得到
  registerPlaces(definition.places);
  const placeAnchors = useMemo<[string, [number, number]][]>(
    () => (topic.places ?? []).map((p) => [p.id, [p.lon, p.lat]]),
    [topic],
  );
  // 純地圖頁：不載入統計資料，也沒有指標、時間軸、資料側欄與排名表
  const pure = Boolean(topic.pure);
  const chosenIndicator =
    topic.indicators.find((i) => i.id === state.indicator) ?? topic.indicators.find((i) => i.id === topic.defaultIndicator)!;
  // 分析檢視只給面量圖、比例圓、類別圖的指標（app/options.ts 的 canAnalyse）；其他指標退回地圖
  const view = pure ? 'map' : state.view === 'analysis' && !canAnalyse(chosenIndicator) ? 'map' : state.view;
  // 子項目的選擇器：指標自己有的話用指標的（國旗的「顏色」與「圖案」），否則用主題的
  const dimension = dimensionOf(topic, chosenIndicator);
  const item = resolveItem(dimension, state.item, state.country);
  // 子項目有自己的分級門檻時（itemScales），換成那一組
  const indicator = forItem(chosenIndicator, item);
  // 我的路線的線：選了某個子項目時只畫它的（TopicDefinition.personalRoutes.forItem，賽車選了某個賽事只畫那個賽事的）
  const personalShows = useCallback(
    (r: PersonalRoute) => !personalCfg?.forItem || personalCfg.forItem(r.series, item),
    [personalCfg, item],
  );
  const personalLines = useMemo(
    () =>
      personalCfg && personalRoutes.length ? new Map([[PERSONAL_ID, personalDecoded(personalRoutes, personalCfg, personalShows)]]) : undefined,
    [personalCfg, personalRoutes, personalShows],
  );

  const countries = useJson<CountryTable>('countries.json').data;
  const manifest = useJson<Manifest>(pure ? null : `topics/${dataFolder(topic)}/manifest.json`).data;
  const source = useJson<IndicatorData>(pure ? null : indicatorPath(topic, indicator, item));
  const { loading } = source;

  // 時刻主題（晝夜與季節）：這一刻是網址的 time、播放中的那一格，或現在（每分鐘更新）
  const clock = Boolean(topic.clock) && !pure;
  const now = useNow(clock && state.time === null);
  const [playTime, setPlayTime] = useState<number | null>(null);
  useEffect(() => setPlayTime(null), [topic.id]);
  const shownTime = playTime ?? state.time ?? now;
  // 即時資料（TopicDefinition.live，此刻的極光）：瀏覽器直接讀外部網址，定時重讀；資料的時刻當成「這一刻」
  const liveDef = pure ? undefined : topic.live;
  const live = useLive(liveDef);
  const liveTime = liveDef && live.data ? liveDef.time(live.data) : null;
  const at = useMemo<ClockAt | null>(
    () => (clock ? clockAt(shownTime) : liveTime !== null ? clockAt(liveTime) : null),
    [clock, shownTime, liveTime],
  );
  // 在瀏覽器裡算的指標（IndicatorDef.derive）：材料是資料檔，依這一刻算出各國的值；其他指標原樣
  // 載入中 source.data 還是上一個檔（換主題時是別的主題的），在瀏覽器裡算的指標要等自己的檔。
  // 載入失敗時也不畫上一個檔（2026-10-29 以前離線換主題，地圖與最高、最低照畫上一個主題的數字、套上新指標的單位）
  const sourceData = (indicator.derive && source.loading) || source.error ? null : source.data;
  // 即時主題的指標要等即時資料（null 是還沒讀到）
  const liveData = liveDef ? live.data : undefined;
  // 即時資料讀不到、手上也沒有上一份時才算載入失敗（有上一份就照舊畫，下一輪再試）
  const error = source.error ?? (liveDef && !live.data ? live.error : null);
  const data = useMemo(() => derivedData(indicator, sourceData, at, liveData), [indicator, sourceData, at, liveData]);
  // 沒自己選過底圖時跟著介面深淺色換（深色用深藍）；選過的照舊，切換深淺色也不變
  const [basemapId, setBasemapId] = useState(readStoredBasemap);
  const basemap = getBasemap(basemapId ?? defaultBasemap(tokens.mode === 'dark'));
  const chooseBasemap = (id: string) => {
    setBasemapId(id);
    storeBasemap(id);
  };

  // 地圖第一次畫出資料之後才做的事（精細國界、預先下載），不跟第一個畫面搶頻寬與 CPU
  const [mapShown, setMapShown] = useState(false);
  const onMapShown = useCallback(() => setMapShown(true), []);
  // 1:50m 的國界放大才要（WorldMap 的 onDetailNeeded）；排名表、全球視角用 1:110m（已經含小國）就夠。
  // 有 pointer 的主題（地球的另一邊等）要判斷游標在哪一國，海岸附近 1:110m 太粗，地圖畫出資料後就載入
  const [detailWanted, setDetailWanted] = useState(false);
  const wantDetail = useCallback(() => setDetailWanted(true), []);
  const features = useCountryFeatures(detailWanted || (mapShown && Boolean(topic.pointer)));
  const firstPaint = Boolean(features && (data || pure));

  // 閒置時預先下載同主題的其他指標，換指標、開側欄時不用等。2026-10-31 收斂（首頁原本多下載約 190 KB）：
  // 閒置時只下載前後兩個指標；滑到指標按鈕時下載那一個（prefetchIndicator）；第一次在地圖上滑到國家
  // （多半接著點國家，側欄的數值卡片要用到全部指標）才下載其餘的
  const [hoveredTopic, setHoveredTopic] = useState<string | null>(null);
  const onCountryHover = useCallback(() => setHoveredTopic(topic.id), [topic.id]);
  const indicatorIndex = topic.indicators.findIndex((i) => i.id === indicator.id);
  const neighbours = useMemo(() => {
    if (pure) return [];
    const all = hoveredTopic === topic.id;
    return topic.indicators
      .filter((_, i) => all || Math.abs(i - indicatorIndex) === 1)
      .map((i) => indicatorPath(topic, i, item));
  }, [topic, item, pure, hoveredTopic, indicatorIndex]);
  const prefetchIndicator = (ind: Indicator) => {
    if (!pure) fetchJson(indicatorPath(topic, ind, item), 'low').catch(() => {});
  };
  const settled = mapShown || (view !== 'map' && Boolean(data));
  useEffect(() => {
    if (settled) return prefetchJson(neighbours);
  }, [settled, neighbours]);

  // 指標可以有自己的預設年份（平均身高：出生年的指標預設 1996、19 歲的身高預設 2019）
  const defaultYear = indicator.defaultYear ?? topic.defaultYear;
  const years = data?.years ?? [defaultYear];
  // 時刻主題的「年份」是那一刻的日期（YYYYMMDD），算出來的資料只有這一筆
  const year = at ? at.day : pickYear(years, state.year, defaultYear, yearBin(indicator));
  // 沒選國家時的側欄（主題的 worldPanel，2026-10-31 起）：每個主題的元件各自動態載入
  const worldLoad = topic.worldPanel?.load;
  // 主題側欄區塊的樣式在 panels.css（跟著國家側欄載入）；沒選國家時的側欄也要一起載入
  const WorldPanel = useMemo(
    () => (worldLoad ? lazy(() => Promise.all([worldLoad(), import('./panels/panels.css')]).then(([m]) => m)) : null),
    [worldLoad],
  );
  const showWorld = Boolean(WorldPanel) && !state.country && !pure && worldClosed !== topic.id;
  const yearIndex = data ? (at ? 0 : data.years.indexOf(year)) : -1;
  // 年份零散的指標（latestWithin）會用之前最近一年的值，valueYears 記下那些國家實際的資料年份
  const { values, years: valueYears } = useMemo(
    () => (data && !pure ? latestAt(data, yearIndex) : { values: new Map<string, number>(), years: new Map<string, number>() }),
    [data, yearIndex, pure],
  );
  // 排名表的「比 10 年前」：那一年也有資料時才有（時刻主題、不隨時間變化的資料沒有）
  const previous = useMemo(() => {
    if (!data || pure || at || yearIndex < 0) return null;
    const index = data.years.indexOf(year - CHANGE_YEARS);
    return index < 0 ? null : { year: year - CHANGE_YEARS, values: latestAt(data, index).values };
  }, [data, pure, at, yearIndex, year]);
  const bubbleMax = useMemo(() => (data ? maxAcrossYears(data) : 1), [data]);
  // 時間軸背後的走勢：世界的總量、平均或各國中位數。載入中（data 是上一個指標的檔）照畫上一個指標的，跟地圖一樣
  const freshTrend = useMemo(() => worldTrend(indicator, data), [indicator, data]);
  const trendShot = useRef(freshTrend);
  if (!loading) trendShot.current = freshTrend;
  const trend = trendShot.current;
  const world = data?.aggregates?.WLD?.[yearIndex] ?? null;

  const setYear = useCallback((y: number) => update({ year: y }), [update]);
  const [playing, setPlaying] = useState(false);
  // 換到年份意思不同的指標（出生年 ↔ 量測的年份，指標的 timeAxis）時，年份回到那個指標的預設，
  // 不沿用原本的數字（1996 年出生 ≠ 1996 年量的 19 歲）
  const chooseIndicator = (id: string) => {
    const next = topic.indicators.find((i) => i.id === id);
    update(next && !sameTimeAxis(next, indicator) ? { indicator: id, year: null } : { indicator: id });
  };
  // 子項目是國家的主題（護照）：選到國家時子項目跟著換；取消選取時留在原本的子項目，地圖不會跳回預設
  const follows = dimension?.followsSelection ? dimension : undefined;
  // 取消選取時比較的國家一起清掉；選到正在比較的國家時，把它從比較裡拿掉
  const compare = state.compare;
  const selectCountry = useCallback(
    (iso3: string | null) => {
      const nextCompare = iso3 ? compare.filter((c) => c !== iso3) : [];
      if (!follows) return update({ country: iso3, compare: nextCompare });
      const next = iso3 && follows.options.some((o) => o.id === iso3) ? iso3 : item;
      update({ country: iso3, item: next, compare: nextCompare });
    },
    [update, follows, item, compare],
  );
  const setBox = useCallback((box: Box | null) => update({ box }), [update]);
  const setThreeD = useCallback((threeD: boolean) => update({ threeD }), [update]);

  const boxResult = useBoxEstimate(topic, item, state.box, features, year);
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  // 舊網址轉到合併後的主題，要一起打開某個圖層（唐人街併進移民與難民）：打開那個主題時打開一次
  useEffect(() => {
    const layer = takeRedirectLayer(topic.id);
    if (layer) setLayers((l) => ({ ...l, extra: { ...l.extra, [layer]: true } }));
  }, [topic.id]);
  // 線圖層放大後的分區依畫面範圍下載（只有有 detail 的主題才監聽地圖的移動）
  const [mapView, setMapView] = useState<MapView | null>(null);
  // 地圖的縮放與範圍：線圖層的分區（detail）、大型點檔的其餘的點（more）放大才下載
  const wantsView = !pure && Boolean(topic.overlays?.some((o) => (o.kind === 'lines' && o.detail) || (o.kind === 'points' && o.more)));
  const { railways, airports, overlays } = useOverlays(topic, indicator, item, year, layers, pure, wantsView ? mapView : null, liveData, personalLines);
  // 主題側欄要在地圖上標出的一組線（滑到某條河、地球的另一邊選取國家的形狀）、放的標記（首都與它的對蹠點）、
  // 要移過去的範圍。標出的線與標記記下是哪個主題、哪個國家的，換國家、換主題就不畫（側欄關掉時滑鼠不一定移開過）；
  // 不用 effect 清掉：子元件的 effect 先跑，側欄一打開就標出的會被父元件換國家的 effect 清掉（2026-10-28 改）
  const panelKey = `${topic.id}:${state.country ?? ''}`;
  const [lineHighlight, setLineHighlight] = useState<{ key: string; overlay: string; group: number } | null>(null);
  const [focusBox, setFocusBox] = useState<{ box: [number, number, number, number]; key: number; maxZoom?: number; bottom?: number } | null>(null);
  const highlightLine = useCallback(
    (overlay: string, group: number | null) => setLineHighlight(group === null ? null : { key: panelKey, overlay, group }),
    [panelKey],
  );
  const shownHighlight = lineHighlight && lineHighlight.key === panelKey ? lineHighlight : null;
  // maxZoom：清單側欄點一個點（賽道、城鎮）時放大到看得清楚，預設最多 8 級（WorldMap）
  // bottom：地圖下緣被蓋住的高度（我的路線的高度剖面），框的時候讓開
  const moveToBox = useCallback(
    (box: [number, number, number, number], maxZoom?: number, bottom?: number) =>
      setFocusBox((f) => ({ box, key: (f?.key ?? 0) + 1, maxZoom, bottom })),
    [],
  );
  // 主題（或指標）的資料集中在一個地方（南極、北極航道）時，換過來就移過去；選了國家時照舊框住那個國家
  const topicFocus = indicator.focus ?? topic.focus;
  useEffect(() => {
    // 主題的 focus 可以依年份給（板塊漂移：那個年代的大陸在哪裡），只在換過來時看一次
    if (topicFocus && !state.country) moveToBox(typeof topicFocus === 'function' ? topicFocus(year) : topicFocus);
  }, [topic.id, indicator.focus]);
  const [marks, setMarksState] = useState<{ key: string; marks: MapMark[] } | null>(null);
  const setMarks = useCallback((list: MapMark[] | null) => setMarksState(list ? { key: panelKey, marks: list } : null), [panelKey]);
  const panelMarks = marks && marks.key === panelKey ? marks.marks : null;
  // 我的路線：點地圖上的一條路線選取它（地圖移過去、標出那一條、下緣打開高度剖面），滑過剖面時地圖上放一個點
  const [routePick, setRoutePick] = useState<{ topic: string; g: number } | null>(null);
  const picked = routePick && routePick.topic === definition.id ? personalRoutes[routePick.g] : undefined;
  // 換到別的賽事、選取的路線沒畫出來時，高度剖面也不顯示
  const pickedRoute = picked && personalShows(picked) ? picked : null;
  const [routeMark, setRouteMark] = useState<MapMark | null>(null);
  const onRouteHover = useCallback(
    (at: { lon: number; lat: number } | null) => setRouteMark(at ? { lon: at.lon, lat: at.lat, label: '', kind: 'here' } : null),
    [],
  );
  const shownMarks = useMemo(() => (routeMark && pickedRoute ? [...(panelMarks ?? []), routeMark] : panelMarks), [panelMarks, routeMark, pickedRoute]);
  const onLineClick = useCallback(
    (overlay: string, group: number) => {
      if (overlay !== PERSONAL_ID) return false;
      const route = personalRoutes[group];
      if (!route) return false;
      setRoutePick({ topic: definition.id, g: group });
      highlightLine(PERSONAL_ID, group);
      let box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const line of route.lines)
        for (const [x, y] of line) box = [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)];
      moveToBox(box, 14, 190);
      return true;
    },
    [personalRoutes, definition.id, highlightLine, moveToBox],
  );
  const closeRoute = useCallback(() => {
    setRoutePick(null);
    setRouteMark(null);
    highlightLine(PERSONAL_ID, null);
  }, [highlightLine]);
  // 主題的清單側欄（賽車的賽程，TopicDefinition.listPanel）：點一列移過去、標出來，需要時換年份
  // 同一個指標有幾個清單時（景點的博物館、主題樂園人次）清單上面一排分頁切換，換主題或指標時回到第一個
  const listDefs =
    !pure && !state.embed && view === 'map'
      ? [topic.listPanel ?? []].flat().filter((l) => !l.indicators || l.indicators.includes(indicator.id))
      : [];
  const [listTab, setListTab] = useState(0);
  useEffect(() => setListTab(0), [topic.id, indicator.id]);
  const listDef = listDefs[Math.min(listTab, listDefs.length - 1)] ?? null;
  const listCountryName = useCallback((iso3: string) => countryName(iso3, countries), [countries]);
  // 點圖層的 fitOnEpoch（奧運場館）：換到另一期（另一屆）時框住這一期的點
  const fitLayer = overlays.find((o) => o.kind === 'points' && o.visible && o.def.fitOnEpoch && o.def.epochs && o.def.minValue);
  const fitEpoch = fitLayer && fitLayer.kind === 'points' ? overlayEpoch(fitLayer.def, year) : null;
  const fitPoints = fitLayer && fitLayer.kind === 'points' ? fitLayer.points : null;
  useEffect(() => {
    if (!fitLayer || fitLayer.kind !== 'points' || !fitPoints || fitEpoch === null) return;
    const { epochs, minValue, fitOnEpoch } = fitLayer.def;
    if (!epochs || !minValue || !fitOnEpoch) return;
    const box = coreBox(
      fitPoints.filter((p) => epochs.values(p, fitEpoch)[minValue.field] != null).map((p) => [Number(p.lon), Number(p.lat)] as [number, number]),
      fitOnEpoch.core,
    );
    if (box) moveToBox(box, fitOnEpoch.maxZoom);
    // 只在換期、換圖層、資料剛下載完時移動（選國家、滑地圖不動）
  }, [fitLayer?.def.id, fitEpoch, fitPoints]);
  // 讀線的清單（第十二批 188）：點了的那一組線一直標著，滑過別的列時暫時換成那一組，離開清單時回到點了的
  const [listLine, setListLine] = useState<{ topic: string; overlay: string; group: number } | null>(null);
  const hoverListRow = useCallback(
    (row: ListRow | null) => {
      const line = row?.line ?? (listLine && listLine.topic === topic.id ? listLine : null);
      if (line) highlightLine(line.overlay, line.group);
      else if (row === null) setLineHighlight((h) => (h && h.overlay !== PERSONAL_ID ? null : h));
    },
    [listLine, topic.id, highlightLine],
  );
  const pickListRow = (row: ListRow) => {
    if (row.line) {
      setListLine({ topic: topic.id, ...row.line });
      highlightLine(row.line.overlay, row.line.group);
    }
    if ('box' in row.target) moveToBox(row.target.box);
    else {
      // 點：框一個約 2 km 的範圍，放大到 zoom（預設 11 級，看得到賽道或城鎮）
      const { lon, lat, zoom = 11 } = row.target;
      const d = 0.01;
      moveToBox([lon - d, lat - d, lon + d, lat + d], zoom);
    }
    const at = row.mark ?? ('box' in row.target ? null : row.target);
    setMarks(at ? [{ lon: at.lon, lat: at.lat, label: row.title, kind: 'here' }] : null);
    if (row.year != null && !timeless) setYear(row.year);
  };
  // 滑到地圖上任何一點時主題給的資訊（地球的另一邊：游標的對蹠點在哪一國或哪一片海）
  const topicPointer = topic.pointer;
  const indicatorId = indicator.id;
  const pointer = useMemo(() => {
    if (!topicPointer || !features) return undefined;
    const countryAt = countryLocator(features);
    return (lngLat: [number, number], iso3: string | null) =>
      topicPointer(lngLat, { iso3, countryAt, countryName: (c) => countryName(c, countries), indicator: indicatorId, year, at });
  }, [topicPointer, features, countries, indicatorId, year, at]);
  const flows = useFlowSelection(topic, indicator, item, year, pure ? null : state.country);
  const flagSpecs = useFlagSpecs(topic, indicator, !pure && view === 'map');

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
  // 搜尋框裡選到主題、指標或子項目（「房價」「鋰」）：換過去，選取的國家留著
  const selectTopic = (target: TopicTarget) =>
    update({
      topic: target.topic,
      indicator: target.indicator,
      item: target.item,
      grid: null,
      // 時刻主題選的那一刻只留在同一個主題
      ...(target.topic !== topic.id ? { time: null } : {}),
    });
  useHotkeys({
    Escape: () => {
      if (state.country) selectCountry(null);
      else if (state.box) setBox(null);
    },
  });

  // 最近看過的主題（主題總覽、指令面板列出）
  useEffect(() => rememberTopic(topic.id), [topic.id]);
  // 主題總覽（TopicNav 裡的對話框）：指令面板的「看全部主題」也會打開
  const [overviewOpen, setOverviewOpen] = useState(false);
  // 指令面板（Ctrl+K）的指令，依目前的狀態列出
  const UI = useUI();
  const savedViews = useSavedViews();
  const paletteActions = useMemo<PaletteAction[]>(() => {
    const A = UI.palette.actions;
    return [
      { id: 'overview', label: A.overview, run: () => setOverviewOpen(true) },
      ...(pure
        ? []
        : (['map', 'table', ...(canAnalyse(indicator) ? (['analysis'] as const) : [])] as const)
            .filter((v) => v !== view)
            .map((v) => ({ id: `view-${v}`, label: A[v], run: () => update({ view: v }) }))),
      { id: 'theme', label: tokens.mode === 'dark' ? t.switchToLight : t.switchToDark, run: toggleTheme },
      { id: 'lang', label: lang === 'zh' ? A.english : A.chinese, run: () => setLang(lang === 'zh' ? 'en' : 'zh') },
      ...(state.country && !pure ? [{ id: 'clear', label: A.clear, run: () => selectCountry(null) }] : []),
      ...(view === 'map' && !pure
        ? [{ id: 'values', label: state.labels ? t.valueLabelsOff : t.valueLabels, run: () => update({ labels: !state.labels }) }]
        : []),
      ...savedViews.map((v) => ({ id: `saved-${v.id}`, label: A.openSaved(v.name), run: () => openSavedView(v, langParam()) })),
      { id: 'layout-time', label: layout.time ? t.hideTime : t.showTime, run: () => setLayout({ time: !layout.time }) },
      { id: 'layout-sources', label: layout.sources ? t.hideSources : t.showSources, run: () => setLayout({ sources: !layout.sources }) },
    ];
  }, [UI, pure, view, indicator, update, tokens.mode, t, toggleTheme, lang, state.country, selectCountry, state.labels, savedViews, layout, setLayout]);

  const projected = data?.projectionFrom !== undefined && year >= data.projectionFrom;
  const itemLabel = dimension?.options.find((o) => o.id === item)?.label;
  const indicatorTitle = itemLabel && usesDimension(indicator) ? t.itemIndicator(itemLabel, indicator.label) : indicator.label;
  // 換指標、子項目、主題時新的資料檔還沒到：地圖照畫上一個指標（舊的數字、色階與圖例），到了再一起漸變過去
  // （2026-10-30；原本是上一個檔的數字套上新指標的色階，顏色錯一下再跳到新的）
  const mapShot = useRef({ indicator, values, bubbleMax, title: indicatorTitle });
  if (!loading) mapShot.current = { indicator, values, bubbleMax, title: indicatorTitle };
  const onMap = mapShot.current;

  // 網格（人口密度的 1 km 網格、暖化的 0.5° 網格）：只影響地圖；圖磚的 meta.json 載入後才畫，失敗時照常畫國家平均
  const gridSpec = pure ? undefined : indicator.grid;
  const G = gridLabels(gridSpec ?? { dir: '' }, lang);
  // 網址沒指定時用指標的預設（夜間燈光預設是網格）；只有網格的（航運密度）一律是網格
  const gridOnly = Boolean(gridSpec?.only);
  const gridOn = gridOnly || (state.grid ?? Boolean(gridSpec?.defaultOn));
  const gridWanted = Boolean(gridSpec && gridOn && view === 'map');
  const gridMeta = useGridMeta(gridWanted && gridSpec ? gridSpec.dir : null);
  const grid = useMemo<GridLayer | null>(
    () =>
      gridSpec && gridWanted && gridMeta.data
        ? { dir: gridSpec.dir, spec: gridSpec, meta: gridMeta.data, epoch: gridEpoch(gridMeta.data.epochs, year) }
        : null,
    [gridSpec, gridWanted, gridMeta.data, year],
  );
  const mapTitle = grid ? G.title(indicatorTitle) : indicatorTitle;
  // 分頁標題跟著指標與選取的國家（2026-10-29），書籤、瀏覽紀錄、分頁列才分得出來：「總生育率 · 台灣 · 世界資料地圖」
  const selectedName = state.country && !pure ? countryName(state.country, countries) : null;
  const pageTitle = [pure ? topic.title : mapTitle, selectedName, t.pageTitle].filter(Boolean).join(' · ');
  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);
  // 正負變化的說明寫了顏色（「橘色為衰退、綠色為成長」），使用者換了發散色就跟著換（palettes.ts）
  const palette = usePalette();
  const layer = indicator.layer;
  const diverging = (layer.kind === 'choropleth' && layer.scale.type === 'diverging') || (layer.kind === 'categorical' && layer.diverging);
  const indicatorText = diverging ? recolourText(indicator.description, lang, palette.diverging) : indicator.description;
  const description = grid ? (gridOnly ? G.subtitle : G.subtitle + G.hoverHint) : indicatorText;

  /* ── 分享：圖片、CSV、連結 ───────────── */
  const mapHandle = useRef<WorldMapHandle>(null);

  // 指令面板搜尋這個主題地圖上的點（2026-10-31，lib/placeSearch.ts）：只在地圖檢視、只收開著的點圖層；
  // 索引第一次搜尋時才建，圖層或語言變了重建。選了地圖飛過去、打開那一點的小卡片（WorldMap 的 showPlace）
  const placeIndexRef = useRef<{ overlays: OverlayLayer[]; lang: string; index: PlaceEntry[] } | null>(null);
  const searchPlacesFor = useCallback(
    (query: string, limit: number): PlaceOption[] => {
      if (view !== 'map') return [];
      let cached = placeIndexRef.current;
      if (!cached || cached.overlays !== overlays || cached.lang !== lang) {
        const ctx = { countryName: (iso3: string) => countryName(iso3, countries), year, item };
        const layers: PlaceLayer[] = overlays.flatMap((o) =>
          o.kind === 'points' && o.visible && o.points && o.def.tooltip
            ? [{ id: o.def.id, label: o.def.label, points: o.points, tooltip: (p: PointRecord) => o.def.tooltip!(p, ctx) }]
            : [],
        );
        cached = { overlays, lang, index: buildPlaceIndex(layers) };
        placeIndexRef.current = cached;
      }
      return findPlaces(cached.index, query, limit).map(({ entry, score }) => ({
        key: `${entry.overlay}/${entry.index}`,
        name: entry.name,
        meta: entry.meta,
        score,
        run: () => mapHandle.current?.showPlace({ lng: entry.lng, lat: entry.lat, point: { overlay: entry.overlay, index: entry.index } }),
      }));
    },
    [view, overlays, lang, countries, year, item],
  );
  const searchPlaces = pure ? undefined : searchPlacesFor;
  // 流向圖畫的是選取國家的夥伴，標題要寫出是哪個國家
  const flowTitle = flows ? t.flowTitle(countryName(flows.origin, countries), indicatorTitle) : mapTitle;
  // 不隨時間變化的資料（海拔），或時刻主題裡不隨時刻變的指標（晝長年較差）：標題、檔名、tooltip、排名表都不寫年份
  const per = at ? indicator.derive?.per : undefined;
  const timeless = Boolean(topic.timeless || indicator.timeless) || per === 'fixed';
  // 指標的 timeAxis 改寫了年份的意思（「1996 年出生」）：標題、tooltip、排名表用它；
  // 時刻主題寫那一刻（「6月21日 14:05」），只跟日期有關的指標只寫日期
  const yearText =
    at && per !== 'fixed' ? (per === 'minute' ? formatMoment(at.time) : formatDay(at.day)) : indicator.timeAxis?.year(year);
  // 檔名、CSV 欄名裡的時間：時刻主題寫 2026-06-21（跟著時刻變的指標加上時間），其他是年份
  const whenLabel = at ? `${dateInputValue(at.time)}${per === 'minute' ? ` ${formatClock(at.time)}` : ''}` : String(year);
  const fileWhen = at ? (per === 'minute' ? formatTimeParam(at.time) : dateInputValue(at.time)) : String(year);
  const viewTitle = pure
    ? topic.title
    : `${topic.title} · ${flowTitle}${timeless ? '' : ` · ${yearText ?? t.yearValue(year, projected)}`}`;
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
    credits.push(currentHref());
    const blob = await mapHandle.current.exportImage({
      title: viewTitle,
      subtitle: pure ? undefined : grid ? G.subtitle : indicatorText,
      credits,
    });
    downloadBlob(blob, `${fileBase}${pure || timeless ? '' : `_${fileWhen}`}.png`);
  };

  const downloadCsv = (single: boolean) => {
    if (!data) return;
    const text = indicatorCsv(data, {
      unit: indicator.unit,
      countries,
      year: single ? year : undefined,
      label: indicator.layer.kind === 'categorical' ? indicator.format : undefined,
      ascending: indicator.lowerIsBetter,
      // 時刻主題的欄名寫日期（或日期加時間），不寫 YYYYMMDD 的整數
      yearLabel: at ? () => whenLabel : undefined,
    });
    const range = at ? fileWhen : single ? year : `${data.years[0]}-${data.years[data.years.length - 1]}`;
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

  // 一般點圖層（地震、火山、駐外館處…）與有 tooltip 的線（海底電纜）的 tooltip 由主題設定決定內容
  const renderPointTooltip = (overlayId: string, index: number) => {
    const o = overlays.find((x) => x.def.id === overlayId);
    if (!o || o.kind === 'night' || o.kind === 'moon' || o.kind === 'liveGrid' || o.kind === 'classGrid' || o.kind === 'wind') return null;
    const p = o.kind === 'points' ? o.points?.[index] : o.lines?.records?.[index];
    const tooltip = o.def.tooltip;
    if (!p || !tooltip) return null;
    const tip = tooltip(p, { countryName: (iso3) => countryName(iso3, countries), year, item });
    return (
      <>
        <div className="tt-value">{tip.title}</div>
        {tip.detail && <div className="tt-label">{tip.detail}</div>}
        {tip.extra?.map((line) => (
          <div key={line} className="tt-label">
            {line}
          </div>
        ))}
        {tip.properNoun && (
          <div className="tt-label" translate="no">
            {tip.properNoun}
          </div>
        )}
      </>
    );
  };

  // tooltip 的名次：跟側欄的數值卡片一樣（同分同名次、總數是有資料的國家數；類別、不排名的指標、計數類的 0 不排）
  const rankable = !pure && (indicator.layer.kind === 'choropleth' || indicator.layer.kind === 'bubble') && !indicator.unranked;
  const ranks = useMemo(() => {
    if (!rankable) return null;
    const rows = ranking(values, indicator.lowerIsBetter);
    const order = rowRanks(rows);
    return new Map(rows.map(([iso3], i) => [iso3, order[i]]));
  }, [rankable, values, indicator.lowerIsBetter]);

  const renderTooltip = (iso3: string) => {
    if (pure) return <div className="tt-value">{countryName(iso3, countries)}</div>;
    // 流向圖：滑到夥伴國上顯示雙邊金額與占比
    const link = flows?.links.find((l) => l.iso3 === iso3);
    // 只有有沒有的流向圖（海外軍事基地）：只寫「美國在日本有軍事基地」
    if (flows && link && indicator.layer.kind === 'flow' && indicator.layer.presence) {
      return (
        <>
          <div className="tt-value">
            {flowText(indicator.layer, lang)[flows.direction].verb(countryName(flows.origin, countries), countryName(iso3, countries))}
          </div>
          {flows.notes?.[iso3] && <div className="tt-hint">{flows.notes[iso3][lang === 'en' ? 1 : 0]}</div>}
        </>
      );
    }
    if (flows && link) {
      return (
        <>
          <div className="tt-value">{indicator.format(link.value)}</div>
          <div className="tt-label">
            {flowText(indicator.layer, lang)[flows.direction].verb(countryName(flows.origin, countries), countryName(iso3, countries))} ·{' '}
            {t.flowShare(formatPercent(link.share * 100, link.share < 0.1 ? 1 : 0))} ·{' '}
            {indicator.timeAxis?.year(flows.year) ?? flows.year}
            {link.estimated && ` · ${t.flowEstimated}`}
          </div>
        </>
      );
    }
    const v = values.get(iso3);
    const valueYear = valueYears.get(iso3);
    const hint = (lang === 'en' ? data?.hintsEn : data?.hints)?.[iso3];
    const rank = v !== undefined && !(indicator.layer.kind === 'bubble' && v === 0) ? ranks?.get(iso3) : undefined;
    // 歷年小折線：面量圖、比例圓，有好幾年的資料時（網格的 tooltip 是國家平均，也畫）
    const series = rankable && !timeless && data && data.years.length >= 3 ? data.values[iso3] : undefined;
    return (
      <>
        <div className="tt-value">
          {v !== undefined ? indicator.format(v, valueYear ?? year) : (missingReason(topic, indicator, item, iso3, data, lang) ?? t.noData)}
          {rank !== undefined && <span className="tt-rank">{t.rank(rank, values.size)}</span>}
        </div>
        <div className="tt-label">
          {countryName(iso3, countries)}
          {!timeless && ` · ${valueYear !== undefined ? t.dataYear(valueYear) : (yearText ?? year)}`}
          {projected && t.tooltipProjected}
          {grid && !gridOnly && ` · ${G.tooltip}`}
        </div>
        {series && <Sparkline years={data!.years} series={series} year={valueYear ?? year} projectionFrom={data!.projectionFrom} />}
        {hint && !grid && <div className="tt-label tt-hint">{hint}</div>}
        {/* 主題自己加的幾行（晝夜與季節：以首都計算的日出、日落），滑過時才算 */}
        {topic.tooltipLines?.(iso3, { indicator: indicator.id, at, item, source: sourceData, countryName: (c) => countryName(c, countries), year }).map((line, i) => (
          <div key={i} className={`tt-label tt-hint${i > 0 ? ' is-next' : ''}`}>
            {line}
          </div>
        ))}
      </>
    );
  };

  return (
    <div className={`app${state.embed ? ' is-embed' : ''}${showSources ? '' : ' is-no-footer'}`} ref={appRef}>
      <TopBar
        topic={topic}
        embed={state.embed}
        online={online}
        onSelectTopic={(id) => update({ topic: id, indicator: null, item: null, grid: null, time: null })}
        onSelectTarget={selectTopic}
        overviewOpen={overviewOpen}
        onOverviewChange={setOverviewOpen}
        searchIndex={searchIndex}
        onSelectCountry={selectFromSearch}
        paletteActions={paletteActions}
        searchPlaces={searchPlaces}
        themeMode={tokens.mode}
        onToggleTheme={toggleTheme}
        layout={layout}
        onLayoutChange={setLayout}
      />

      {/* 控制列、說明、地圖、時間軸都在 <main> 裡（axe 的 region：內容都要在某個 landmark 裡，2026-10-29）；
          display: contents，版面照舊由 .app 排 */}
      <main className="app-main">
        <div className="controls">
          <div className="controls-left">
            {pure && <h2 className="page-title">{topic.title}</h2>}
            {!pure && dimension && usesDimension(indicator) && (
              <label className="select-field">
                <span>{dimension.label}</span>
                <select value={item ?? ''} onChange={(e) => update({ item: e.target.value })}>
                  {groupOptions(dimension.options, dimension.followsSelection ? lang : null).map(([group, options]) =>
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
            {pure ? null : topic.indicators.length > MAX_SEGMENTS || (narrow && topic.indicators.length > 2) ? (
              <label className="select-field is-indicator">
                <span>{t.indicator}</span>
                <select value={indicator.id} onChange={(e) => chooseIndicator(e.target.value)}>
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
                    onClick={() => chooseIndicator(ind.id)}
                    onPointerEnter={() => prefetchIndicator(ind)}
                    onFocus={() => prefetchIndicator(ind)}
                  >
                    {ind.label}
                  </button>
                ))}
              </div>
            )}
            {gridSpec && !gridOnly && view === 'map' && (
              <div className="grid-toggle" role="radiogroup" aria-label={G.mode}>
                {[false, true].map((on) => (
                  <button
                    key={String(on)}
                    type="button"
                    role="radio"
                    aria-checked={gridOn === on}
                    className={`segment${gridOn === on ? ' is-active' : ''}`}
                    onClick={() => update({ grid: on })}
                  >
                    {on ? G.name : G.countryAverage}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="controls-right">
            <CountrySearch
              compact={narrow}
              index={searchIndex}
              onSelect={selectFromSearch}
              onSelectTopic={selectTopic}
              valueOf={
                pure
                  ? undefined
                  : (iso3) => {
                      const v = values.get(iso3);
                      return v !== undefined ? indicator.format(v, valueYears.get(iso3) ?? year) : null;
                    }
              }
            />
            {!pure && (
              <div className="view-toggle" role="radiogroup" aria-label={t.viewMode}>
                {(canAnalyse(indicator) ? (['map', 'table', 'analysis'] as const) : (['map', 'table'] as const)).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={view === v}
                    className={`segment${view === v ? ' is-active' : ''}`}
                    onClick={() => update({ view: v })}
                  >
                    {v === 'map' ? t.viewMap : v === 'table' ? t.viewTable : t.viewAnalysis}
                  </button>
                ))}
              </div>
            )}
            <SavedViews />
            <ShareMenu
              shareTitle={t.shareTitle(viewTitle)}
              onDownloadImage={view === 'map' ? downloadImage : undefined}
              csv={
                data && !pure
                  ? { year: timeless || at ? null : year, onDownloadYear: () => downloadCsv(true), onDownloadAll: () => downloadCsv(false) }
                  : undefined
              }
            />
          </div>
        </div>
        <ClampedText key={description} text={description} className="indicator-desc" />

        <div
          className={`stage${(state.country || showWorld) && !pure ? ' has-panel' : ''}${pure ? ' is-pure' : ''}${listDef ? ` has-list${layout.list ? '' : ' list-closed'}` : ''}`}
        >
          {listDef && (
            <ListSide
              def={listDef}
              tabs={listDefs.length > 1 ? listDefs.map((d) => d.tabLabel ?? d.label) : undefined}
              tab={listTab}
              onTabChange={setListTab}
              topicId={dataFolder(topic)}
              item={item}
              year={year}
              country={state.country}
              countryName={listCountryName}
              sort={state.listSort}
              onSortChange={(id) => update({ listSort: id })}
              open={layout.list}
              onOpenChange={(open) => setLayout({ list: open })}
              onPick={pickListRow}
              onHover={hoverListRow}
              live={liveData}
            />
          )}
          <div className="stage-main">
            {error && (
              // 離線而這個主題還沒存到裝置（service worker 只快取看過的資料）跟一般的失敗分開說
              <StatusCard
                overlay
                kind={online ? 'error' : 'offline'}
                title={online ? t.dataFailedTitle : t.offlineNotSavedTitle}
                detail={online ? t.loadFailed(error.message) : t.offlineNotSavedHint}
                action={{ label: t.retry, onClick: () => location.reload() }}
              />
            )}
            {/* 播放歷年變化時地圖左上角疊大大的年份（看地圖、錄影時一眼知道是哪一年），停下後淡出；
                版面關掉了時間軸時一直顯示（小一號），才知道看的是哪一年 */}
            {view === 'map' && !pure && (!timeless || at) && (
              // 有框選結果時它在左上角（或右上角），年份改放中間；時刻主題寫日期與時間（播放一天時時間在變）
              <div
                className={`map-year${playing || !showTime ? ' is-on' : ''}${!showTime && !playing ? ' is-pinned' : ''}${boxResult ? ' is-center' : ''}${at ? ' is-moment' : ''}`}
                aria-hidden="true"
              >
                {/* 每換一年新的數字從下面滾上來（styles.css 的 .year-roll） */}
                <span key={at ? at.time : year} className="year-roll">
                  {at ? formatMoment(at.time) : (yearText ?? year)}
                </span>
                {projected && <span className="map-year-tag">{indicator.projectionLabel?.tag ?? t.projected}</span>}
              </div>
            )}
            {view === 'map' ? (
              // 地圖不等資料：底圖先出來，國界與資料到了再畫上去
              <Suspense fallback={<MapFallback dark={basemap.dark} text={t.loadingMap} />}>
                {!firstPaint && !error && <p className="map-status">{t.loadingData}</p>}
                <WorldMap
                  handleRef={mapHandle}
                  countries={features ?? NO_FEATURES}
                  countryTable={countries}
                  onPickCountry={pure ? undefined : selectFromSearch}
                  places={placeAnchors}
                  indicator={onMap.indicator}
                  legendTitle={onMap.title}
                  values={onMap.values}
                  bubbleMax={onMap.bubbleMax}
                  tokens={tokens}
                  selected={state.country}
                  onSelect={selectCountry}
                  renderTooltip={renderTooltip}
                  onCountryHover={onCountryHover}
                  ariaLabel={
                    pure
                      ? t.worldMapAria
                      : yearText
                        ? t.mapAria(null, t.withYear(mapTitle, yearText), projected)
                        : t.mapAria(timeless ? null : year, mapTitle, projected)
                  }
                  basemap={basemap}
                  onBasemapChange={chooseBasemap}
                  sharedLayers={pure ? undefined : sharedChoices}
                  onSharedToggle={toggleShared}
                  personal={pure ? undefined : personalMenu}
                  fitOnSelect={pure}
                  onFirstData={onMapShown}
                  onDetailNeeded={wantDetail}
                  threeD={state.threeD}
                  onThreeDChange={setThreeD}
                  valueLabels={state.labels}
                  onValueLabelsChange={(on) => update({ labels: on })}
                  terrain={topic.terrain}
                  bareMap={topic.bareMap}
                  focus={focusRequest}
                  grid={grid}
                  gridFailed={gridWanted && gridMeta.error !== null}
                  dimmed={loading && data !== null}
                  box={topic.boxEstimate ? state.box : null}
                  onBoxChange={topic.boxEstimate ? setBox : undefined}
                  boxToolLabel={topic.boxEstimate && t.boxToolFor(topic.boxEstimate.label)}
                  railways={railways}
                  airports={airports}
                  layers={layers}
                  onLayersChange={setLayers}
                  renderAirportTooltip={renderAirportTooltip}
                  overlays={overlays}
                  year={year}
                  time={at?.time ?? null}
                  renderPointTooltip={renderPointTooltip}
                  flows={flows}
                  flags={flagSpecs}
                  onViewChange={wantsView ? setMapView : undefined}
                  lineHighlight={shownHighlight}
                  focusBox={focusBox}
                  pointer={pure ? undefined : pointer}
                  marks={shownMarks}
                  onLineClick={personalCfg ? onLineClick : undefined}
                  bottom={
                    pickedRoute && (
                      <Suspense fallback={null}>
                        <RouteProfilePanel route={pickedRoute} onHover={onRouteHover} onClose={closeRoute} />
                      </Suspense>
                    )
                  }
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
            ) : view === 'analysis' ? (
              // 分析（變化、篩選、並排、對照）：自己的 chunk，切過來才下載
              <Suspense fallback={<p className="loading">{t.loadingMap}</p>}>
                <AnalysisView
                  topic={topic}
                  indicator={indicator}
                  item={item}
                  data={loading ? null : data}
                  year={year}
                  countries={countries}
                  selected={state.country}
                  onSelect={selectCountry}
                  state={state.analysis}
                  onChange={(patch) => update({ analysis: { ...state.analysis, ...patch } })}
                />
              </Suspense>
            ) : (
              <Suspense fallback={<p className="loading">{t.loadingData}</p>}>
                <RankingTable
                  indicator={indicator}
                  title={indicatorTitle}
                  values={values}
                  valueYears={valueYears}
                  latestWithin={data?.latestWithin}
                  world={world}
                  previous={timeless ? null : previous}
                  year={timeless ? null : year}
                  yearText={timeless ? undefined : yearText}
                  countries={countries}
                  selected={state.country}
                  onSelect={selectCountry}
                  icon={topic.rowIcon}
                />
              </Suspense>
            )}
          </div>
          {showWorld && WorldPanel && topic.worldPanel && (
            <PanelSheet onClose={() => setWorldClosed(topic.id)}>
              <aside className="panel" aria-label={topic.worldPanel.title}>
                <header className="panel-header">
                  <div>
                    <h2>{topic.worldPanel.title}</h2>
                  </div>
                  <button type="button" className="icon-button" onClick={() => setWorldClosed(topic.id)} aria-label={t.close}>
                    <CloseIcon />
                  </button>
                </header>
                <Suspense fallback={<PanelSkeleton />}>
                  <WorldPanel topic={topic} indicator={indicator} year={year} tokens={tokens} />
                </Suspense>
              </aside>
            </PanelSheet>
          )}
          {state.country && !pure && (
            <PanelSheet onClose={() => selectCountry(null)}>
              <Suspense
                fallback={
                  <aside className="panel" aria-busy="true">
                    <PanelSkeleton />
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
                  onIndicatorChange={chooseIndicator}
                  compare={compare}
                  onCompareChange={(list) => update({ compare: list })}
                  highlightLine={highlightLine}
                  focusBox={moveToBox}
                  selectYear={timeless || at ? undefined : setYear}
                  setMarks={setMarks}
                  at={at}
                  live={liveData}
                />
              </Suspense>
            </PanelSheet>
          )}
        </div>

        {clock ? (
          <Suspense fallback={<div className="time-slider" hidden={!showTime} />}>
            <MomentControl
              hidden={!showTime}
              time={shownTime}
              live={state.time === null}
              onChange={(ms) => update({ time: floorMinute(ms) })}
              onPreview={setPlayTime}
              onLive={() => update({ time: null })}
              onPlayingChange={setPlaying}
            />
          </Suspense>
        ) : (
          !pure &&
          !timeless &&
          !liveDef && (
            <TimeSlider
              years={years}
              year={year}
              projectionFrom={data?.projectionFrom}
              projectionLabel={indicator.projectionLabel}
              estimatesBefore={data?.estimatesBefore}
              axis={indicator.timeAxis}
              onChange={setYear}
              trend={trend}
              onPlayingChange={setPlaying}
              hidden={!showTime}
            />
          )
        )}

      </main>

      {showSources && <Footer topic={topic} generatedAt={manifest?.generatedAt ?? null} />}
    </div>
  );
}
