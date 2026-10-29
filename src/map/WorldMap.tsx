/**
 * 地圖引擎：MapLibre GL（WebGL 向量地圖），底圖用 OpenFreeMap 的 Liberty 樣式
 * （低縮放是 Natural Earth II 彩色地形，放大後是 OpenStreetMap 細節），預設地球儀。
 *
 * 資料圖層插在底圖的道路、國界之上、文字標籤之下，地名永遠看得到：
 * - 面量圖、類別圖：國界多邊形，顏色放在 feature-state，換年份時不必重送幾何
 * - 比例圓、小國圓點、鐵路、機場、框選範圍
 * - 一般的點、線疊加圖層（overlayLayers.ts：地震、火山、板塊邊界、駐外館處…），樣式寫在主題裡
 * - 3D 模式（fill-extrusion）：面量圖把國家依色階分級拉高，比例圓改成高度與數值成正比的柱子
 * - 地形（海拔主題，terrain.ts）：高程圖磚的分層設色與陰影，3D 時改成真的立體地形
 * - 1 km 網格（densityGrid.ts）：點陣圖磚取代國家的顏色，國界、hover、點選照舊用國家的形狀
 * 國家用 ISO alpha-3 當 feature id（promoteId）。
 */
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import {
  addProtocol,
  Map as MaplibreMap,
  type ExpressionSpecification,
  type GeoJSONSource,
  type LayerSpecification,
  type MapSourceDataEvent,
} from 'maplibre-gl';
import { geoArea, geoDistance } from 'd3-geo';
import { tr, useLang, useT } from '../i18n';
import { StatusCard } from '../controls/StatusCard';
import type { AirportsData, Indicator, MapMark, PointerInfo } from '../topics/types';
import { MAP_TOKENS, type Tokens } from '../theme/tokens';
import { noteMapRequest } from '../lib/serviceWorker';
import { fetchJson } from '../lib/data';
import { countryName, type CountryTable } from '../lib/countries';
import { BASEMAP_COUNTRY_BORDER, type Basemap } from './basemaps';
import { useHotkeys } from '../controls/hotkeys';
import { boxPolygon, type Box } from './boxEstimate';
import { FLOW_PRESENCE_WIDTH, flowColors, flowText, flowWidth, greatCircle, type FlowSelection } from './flows';
import { focusBounds } from './focus';
import { unwrapAntimeridian, type CountryFeature } from './geometry';
import { canvasToPng, captureMap, composeMapImage, type ImageLegend, type MapImageContent } from './exportImage';
import {
  BubbleLegend,
  bubbleLegendModel,
  CategoricalLegend,
  categoricalLegendModel,
  ChoroplethLegend,
  choroplethLegendModel,
  ColumnLegend,
  columnLegendModel,
  FlowLegend,
  flowLegendModel,
  ReliefLegend,
} from './Legend';
import {
  DEFAULT_LAYERS,
  exportLayerKeys,
  LAYER_KEYS,
  LayerControls,
  layerKeyColor,
  type LayerVisibility,
  type OverlayLayer,
} from './Overlays';
import { applyTimeFilters, highlightLine, labelFont, syncOverlays, type OverlayDataCache } from './overlayLayers';
import { syncLiveGrid } from './liveGridLayer';
import { syncClassGrid } from './classGridLayer';
import { syncWind } from './windLayer';
import { CLASS_GRID_OPACITY } from './Overlays';
import { syncMoon, syncNight } from './nightLayer';
import { categoryScale } from './categories';
import { BUBBLE_MIN_RADIUS, bubbleScale, choroplethScale, gridScale } from './scales';
import { isNameLayer, LAND_UNTIL, labelField, loadBaseStyle, WORLD_SUFFIX, WORLD_TILES_UNTIL, worldColors, type Projection } from './style';
import { GRID_PROTOCOL, gridLabels, loadGridTile, type GridLayer } from './densityGrid';
import { FLAG_PROTOCOL, loadFlagTile, type FlagSpec } from './flagTiles';
import { demSource, RELIEF_COLOR, reliefLegendModel, RELIEF_TITLE, terrainExaggeration } from './terrain';
import { useElementSize } from './useElementSize';
import { BasemapMenu } from './BasemapMenu';
import { Extremes } from './Extremes';
import { RegionMenu } from './RegionMenu';
import { MoreMenu, type MoreMenuItem } from './MoreMenu';
import { NARROW_QUERY, useMediaQuery } from '../lib/useMediaQuery';
import { useMapTokens } from './palettes';
import { ExitFullscreenIcon, FlatIcon, FullscreenIcon, GlobeIcon, MinusIcon, PlusIcon, ResetIcon } from './MapIcons';
import {
  BARE_SEA,
  CALM_SEA,
  COLUMN_RADIUS_KM,
  DARK_SKY,
  DETAIL_ZOOM,
  EARTH_RADIUS_KM,
  EMPTY,
  EXTREMES_MIN_WIDTH,
  FLAG_LEGEND_NOTE,
  FLOW_TINT_OPACITY,
  GRID_LAYER,
  HALO_WIDTH,
  INITIAL_CENTER,
  LIGHT_SKY,
  LIMB_DEGREES,
  LIMB_MAX_ZOOM,
  LIMB_MIN_SHIFT,
  MARKS_SOURCE,
  MAX_ZOOM,
  NO_OVERLAYS,
  NO_PLACES,
  PITCH_3D,
  POINTER_SOURCE,
  REDUCED_MOTION,
  RELIEF_WATER_WORLD,
  SEA_PLACEHOLDER_MAX_MS,
  SELECTED_MARK_KM2,
  SELECT_PULSE_MS,
  SELECT_SOURCES,
  SHAPELESS,
  SPACE_BACKGROUND,
  SPACE_BACKGROUND_LIGHT,
  TINY_COLUMN_RADIUS_KM,
  TINY_KM2,
  circlePolygon,
  dataFillOpacity,
  dataLayers,
  fillOpacity,
  fitGlobeZoom,
  flowGradient,
  haloWidth,
  markLayers,
  markRadius,
  sphericalCap,
} from './worldMapLayers';
import { MapTooltip, MarkTooltip, PointerLines } from './MapTooltip';
import { bindMapEvents, type MapHover } from './mapEvents';
import { useCountryFills } from './useCountryFills';
import { useRasterLayers } from './useRasterLayers';

// 1 km 網格的圖磚經過這個協定載入：沒有內容的圖磚（海洋、無人區）不發出請求
addProtocol(GRID_PROTOCOL, loadGridTile);
// 國旗地圖的圖磚在瀏覽器裡畫（flagTiles.ts）
addProtocol(FLAG_PROTOCOL, loadFlagTile);

interface WorldMapProps {
  countries: CountryFeature[];
  /** 國家對照表（countries.json）：底圖的國名改用網站自己的名稱（style.ts 的 labelField） */
  countryTable?: CountryTable | null;
  /** 有傳才在寬螢幕的圖例上面列出數值最高、最低的國家（Extremes），點了選取並飛過去 */
  onPickCountry?: (iso3: string) => void;
  indicator: Indicator;
  /** 圖例標題，例如「稻米產量」 */
  legendTitle: string;
  /** 目前年份的數值，只放有資料的國家 */
  values: Map<string, number>;
  /** 比例圓用：所有年份中的最大值 */
  bubbleMax: number;
  /** 介面的配色（圖例、tooltip）；地圖上的資料色固定用淺色版，因為底圖一直是明亮的 */
  tokens: Tokens;
  selected: string | null;
  onSelect: (iso3: string | null) => void;
  renderTooltip: (iso3: string) => ReactNode;
  ariaLabel: string;
  /** 新資料載入中，先調淡舊畫面 */
  dimmed?: boolean;
  /** 框選範圍（經緯度）；有傳 onBoxChange 才會出現框選工具 */
  box?: Box | null;
  onBoxChange?: (box: Box | null) => void;
  boxToolLabel?: string;
  /** 疊在地圖右上角的內容，例如框選結果 */
  overlay?: ReactNode;
  /** 疊加圖層：鐵路（經緯度 MultiLineString）與機場 */
  railways?: GeoJSON.MultiLineString | null;
  airports?: AirportsData | null;
  layers?: LayerVisibility;
  onLayersChange?: (layers: LayerVisibility) => void;
  renderAirportTooltip?: (index: number) => ReactNode;
  /** 一般的點、線疊加圖層（主題 overlays 裡 kind 為 points、lines 的），順序就是畫的順序（後面的在上面） */
  overlays?: OverlayLayer[];
  /** 目前的年份：有年份欄位的疊加點依它與指標的 overlayTime 篩選 */
  year?: number;
  /** 時刻主題的這一刻（UTC 毫秒）：晝夜圖層（kind 'night'）依它畫夜半邊與太陽直射點；其他主題是 null */
  time?: number | null;
  /** 滑到一般點圖層的點上時的 tooltip（overlay 的 id、資料的第幾筆） */
  renderPointTooltip?: (overlay: string, index: number) => ReactNode;
  /** 主題自訂的地點（TopicDefinition.places）：跟沒有形狀的國家一樣畫小圓點與比例圓 */
  places?: [string, [number, number]][];
  /** 底圖樣式（陸地、海洋的配色） */
  basemap: Basemap;
  /** 有傳才在右上角的按鈕列放「底圖」選單 */
  onBasemapChange?: (id: string) => void;
  /** 點選國家時把地圖縮放到整個國家（純地圖頁用） */
  fitOnSelect?: boolean;
  /** 資料第一次畫到地圖上（不上色的指標：國界第一次畫上）時呼叫一次 */
  onFirstData?: () => void;
  /** 流向圖（indicator.layer.kind 為 'flow'）：選取國家的主要夥伴，畫成大圓弧線 */
  flows?: FlowSelection | null;
  /** 3D 立體地圖；有傳 onThreeDChange 才會出現 3D 按鈕 */
  threeD?: boolean;
  onThreeDChange?: (on: boolean) => void;
  /** key 改變時把地圖移到這個國家（從搜尋選國家時用） */
  focus?: { iso3: string; key: number } | null;
  /** 地形圖層（主題的 terrain）：kind 為 'terrain' 的指標畫分層設色，面量圖上疊地形陰影，3D 改成立體地形 */
  terrain?: boolean;
  /** 只留海的底圖（主題的 bareMap，板塊漂移）：今天的陸地、地名、國界與國家的 hover、點選都拿掉 */
  bareMap?: boolean;
  /** 1 km 網格（指標有 grid、使用者切到網格時）：取代面量圖的國家顏色 */
  grid?: GridLayer | null;
  /** 切到網格但 meta.json 載入失敗：照常畫國家平均，上方提示 */
  gridFailed?: boolean;
  /** 國旗地圖（indicator.layer.kind 為 'flags'）：每個國家的國旗；載入前是 null */
  flags?: Map<string, FlagSpec> | null;
  /**
   * 地圖停下來（moveend）時回報縮放與畫面範圍 [西, 南, 東, 北]；線圖層的 detail 依它下載放大後的分區。
   * 有傳才監聽
   */
  onViewChange?: (view: MapView) => void;
  /** 放大超過全球視角時呼叫一次（App 才載入 1:50m 的國界，全球視角的 1:110m 已經含小國） */
  onDetailNeeded?: () => void;
  /** 地圖外面（主題的側欄）要標出的一組線，跟滑過時一樣；null 時取消 */
  lineHighlight?: { overlay: string; group: number } | null;
  /** key 改變時把地圖移到這個範圍 [西, 南, 東, 北]（主題的側欄點某條河） */
  focusBox?: { box: [number, number, number, number]; key: number } | null;
  /**
   * 滑到地圖上任何一點（含海上）時的資訊（主題的 pointer，2026-10-28 起，地球的另一邊）：在國家上時幾行接在國家的
   * tooltip 下面，海上時自己是一個 tooltip（title 加幾行）；mark 是跟著游標動的小記號（游標的對蹠點）
   */
  pointer?: (lngLat: [number, number], iso3: string | null) => PointerInfo | null;
  /** 主題側欄放的標記（首都與它的對蹠點）：圓點加名稱，點一下移到 link 那一個（不會改變選取的國家） */
  marks?: MapMark[] | null;
  ref?: Ref<WorldMapHandle>;
}

export interface MapView {
  zoom: number;
  bounds: [number, number, number, number];
}

export interface WorldMapHandle {
  /** 把目前的地圖畫面加上標題、圖例與來源，輸出成 PNG */
  exportImage: (content: MapImageContent) => Promise<Blob>;
}

export function WorldMap(props: WorldMapProps) {
  const { countries, indicator, values, bubbleMax, tokens, selected, onSelect, renderTooltip, ariaLabel, dimmed } =
    props;
  const countryTable = props.countryTable ?? null;
  const t = useT();
  const lang = useLang();
  const langRef = useRef(lang);
  langRef.current = lang;
  const { box, onBoxChange, boxToolLabel = t.boxTool, overlay, legendTitle } = props;
  const { railways = null, airports = null, layers = DEFAULT_LAYERS, onLayersChange, renderAirportTooltip } = props;
  const { overlays = NO_OVERLAYS, year = 0, renderPointTooltip, places = NO_PLACES, time = null } = props;
  const { basemap, fitOnSelect = false, flows = null, threeD = false, onThreeDChange, focus = null, ref, onFirstData } =
    props;
  const terrain = Boolean(props.terrain);
  const bare = Boolean(props.bareMap);
  const { grid = null, gridFailed = false, flags = null, onBasemapChange } = props;
  const { onViewChange, lineHighlight = null, focusBox = null, pointer, marks = null } = props;
  const flagsOn = indicator.layer.kind === 'flags';
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;
  const threeDRef = useRef(threeD);
  threeDRef.current = threeD;
  /** 目前地圖上實際載入的底圖（切換時比對用） */
  const loadedBasemapRef = useRef<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const size = useElementSize(containerRef);
  // 每次加上資料圖層（建立地圖、切換底圖）就加一；資料相關的 effect 都依它重跑，把資料重新套上
  const [revision, setRevision] = useState(0);
  // 最新的 revision：effect 的 cleanup 用來分辨是換了底圖還是其他依賴變了
  const revisionRef = useRef(revision);
  revisionRef.current = revision;
  const ready = revision > 0;
  /** 資料圖層目前是否在地圖上（切換底圖、等新樣式載入的期間是 false） */
  const installedRef = useRef(false);
  /** 分層設色、地形陰影插在這個圖層前面（底圖的水域，海面才會蓋住海底地形） */
  const reliefBeforeRef = useRef<string | undefined>(undefined);
  /**
   * 底圖本身的點陣圖層（彩色地形的 Natural Earth 陰影）與原本的縮放範圍：地形圖時被分層設色整個蓋住，面量圖時被國家顏色與
   * 我們的地形陰影蓋住，隱藏起來就不必下載（全球視角約 3 MB）
   */
  const baseRastersRef = useRef<{ id: string; minzoom: number; maxzoom: number }[]>([]);
  const [failed, setFailed] = useState(false);
  const [globe, setGlobe] = useState(true);
  // MapLibre 5 在地球儀上查不到立體圖形（queryRenderedFeatures 對 fill-extrusion 用的是平面的矩陣），
  // hover、點國家都會失效，所以 3D 時固定用平面地圖；離開 3D 再回到使用者選的投影。
  // 地形圖層的 3D 是立體地形、沒有立體圖形，地球儀上照樣點得到（5.24 實測），維持使用者選的投影
  const flatIn3d = threeD && !terrain;
  const projection: Projection = globe && !flatIn3d ? 'globe' : 'mercator';
  const projectionRef = useRef(projection);
  projectionRef.current = projection;
  /** 剛進入 3D 時短暫顯示操作提示 */
  const [threeDHint, setThreeDHint] = useState(false);
  const [hover, setHover] = useState<MapHover | null>(null);
  /** 一般點圖層與有 tooltip 的線的 MapLibre 圖層 id（上面的在前），hover 與點選時比國家先查 */
  const pointLayersRef = useRef<string[]>([]);
  /** 目前加粗標出的線（有 tooltip 的線圖層）：滑鼠滑到的，沒有時是側欄要標出的（lineHighlightRef） */
  const lineHoverRef = useRef<{ overlay: string; group: number } | null>(null);
  /** 主題側欄要標出的一組線（lineHighlight prop），滑鼠移開線之後回到它 */
  const lineHighlightRef = useRef<{ overlay: string; group: number } | null>(null);
  /** 線寬依欄位變化的線圖層：圖層 id → 欄位（滑過時取最寬的那條） */
  const lineWidthFieldsRef = useRef(new Map<string, string>());
  lineWidthFieldsRef.current = new Map(
    overlays.flatMap((o): [string, string][] =>
      o.kind === 'lines' && typeof o.def.width !== 'number' ? [[o.def.id, o.def.width.field]] : [],
    ),
  );
  const [boxMode, setBoxMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // iPhone 的 Safari 不能讓一般元素全螢幕（只有影片可以），不放全螢幕鈕
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;
  const narrow = useMediaQuery(NARROW_QUERY);
  const coarse = useMediaQuery('(pointer: coarse)');
  // 框選結果卡片放在框的另一側，才不會蓋住框
  const [overlayOnLeft, setOverlayOnLeft] = useState(false);

  // 地圖事件在建立時綁定一次，最新的 props 放在 ref 裡讀
  const latest = useRef({ onSelect, onBoxChange, boxMode, pointer: Boolean(pointer), marks });
  latest.current = { onSelect, onBoxChange, boxMode, pointer: Boolean(pointer), marks };

  // 分級色、正負色用使用者選的配色（圖例的「配色」，palettes.ts）
  const mapTokens = useMapTokens();
  const colorScale = useMemo(
    () => (indicator.layer.kind === 'choropleth' ? choroplethScale(indicator.layer.scale, mapTokens) : null),
    [indicator, mapTokens],
  );
  const categories = useMemo(
    () => (indicator.layer.kind === 'categorical' ? categoryScale(indicator.layer, mapTokens) : null),
    [indicator, mapTokens],
  );
  // 類別圖的類別、面量圖的分級：圖例滑過（preview）或點選（pinned）的那一類（一級），地圖上其他國家淡化；換指標時清掉
  const [previewCategory, setPreviewCategory] = useState<number | null>(null);
  const [pinnedCategory, setPinnedCategory] = useState<number | null>(null);
  useEffect(() => {
    setPreviewCategory(null);
    setPinnedCategory(null);
  }, [categories, colorScale]);
  const highlightCategory = previewCategory ?? pinnedCategory;
  const radius = useMemo(() => bubbleScale(bubbleMax, size?.width ?? 1000), [bubbleMax, size]);

  const countryCollection = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: countries.map((c) => ({
        type: 'Feature',
        properties: { iso3: c.iso3 },
        geometry: unwrapAntimeridian(c.feature.geometry),
      })),
    }),
    [countries],
  );
  // 地圖上沒有形狀的國家（SHAPELESS）只有圓點；國界還沒載入時不加，第一個畫面不會只剩這幾個點
  const shapeless = useMemo(
    () => (countries.length ? [...SHAPELESS.filter(([iso3]) => !countries.some((c) => c.iso3 === iso3)), ...places] : []),
    [countries, places],
  );
  const anchors = useMemo(
    () => new Map([...shapeless, ...countries.map((c) => [c.iso3, c.anchor] as [string, [number, number]])]),
    [countries, shapeless],
  );
  // 選了要多畫圓圈標記的小國家（含地圖上沒有形狀、只有圓點的）
  const markedCountries = useMemo(
    () =>
      new Set([
        ...countries.filter((c) => geoArea(c.feature) * EARTH_RADIUS_KM ** 2 < SELECTED_MARK_KM2).map((c) => c.iso3),
        ...shapeless.map(([iso3]) => iso3),
      ]),
    [countries, shapeless],
  );
  // 把地圖移到某國時要框住的範圍（主要國土加附近的島，不含遠方屬地）
  const countryBounds = useMemo(() => new Map(countries.map((c) => [c.iso3, focusBounds(c)])), [countries]);
  const tinyCollection = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: [
        ...countries.filter((c) => geoArea(c.feature) * EARTH_RADIUS_KM ** 2 < TINY_KM2).map((c) => [c.iso3, c.anchor] as const),
        ...shapeless,
      ].map(([iso3, anchor]) => ({ type: 'Feature', properties: { iso3 }, geometry: { type: 'Point', coordinates: anchor } })),
    }),
    [countries, shapeless],
  );
  const tinyColumnCollection = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: tinyCollection.features.map((f) => ({
        ...f,
        geometry: circlePolygon((f.geometry as GeoJSON.Point).coordinates as [number, number], TINY_COLUMN_RADIUS_KM),
      })),
    }),
    [tinyCollection],
  );

  /** 換過海的顏色（CALM_SEA）後的背景色；載入時暫時換成海的顏色、之後換回來時用它（installDataLayers） */
  const backgroundPaintRef = useRef<unknown>(null);
  /** 世界視角的湖泊（geo/lakes-110m.json，約 3 KB）；切換底圖時新樣式直接用 */
  const lakesRef = useRef<GeoJSON.FeatureCollection | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchJson<GeoJSON.FeatureCollection>('geo/lakes-110m.json', 'low')
      .then((lakes) => {
        lakesRef.current = lakes;
        if (!cancelled && installedRef.current) (mapRef.current?.getSource('lakes') as GeoJSONSource | undefined)?.setData(lakes);
      })
      .catch(() => {}); // 沒有湖泊只是五大湖等畫成陸地，不影響其他
    return () => {
      cancelled = true;
    };
  }, []);

  /** 每次載入樣式加一；載入時暫時換成海的顏色，用它認出是哪一次（見 installDataLayers） */
  const seaTokenRef = useRef(0);
  const seaTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** 加上資料用的 source 與圖層；建立地圖與切換底圖後都要做 */
  const installDataLayers = (m: MaplibreMap, dark: boolean) => {
    for (const id of ['countries', 'tiny', 'bubbles', 'columns', 'tiny-columns', 'flow-ends']) {
      m.addSource(id, { type: 'geojson', data: EMPTY, promoteId: 'iso3' });
    }
    // lineMetrics：弧線的漸層（line-gradient）要用到沿線的位置
    m.addSource('flows', { type: 'geojson', data: EMPTY, promoteId: 'iso3', lineMetrics: true });
    for (const id of ['railways', 'airports', 'box', 'selected-mark']) m.addSource(id, { type: 'geojson', data: EMPTY });
    m.addSource('lakes', { type: 'geojson', data: lakesRef.current ?? EMPTY });
    // 插在底圖最後一個非文字圖層（道路、國界等）之後：資料蓋在道路上面、文字標籤下面。
    // 不能用「第一個文字圖層」，深色樣式的水域名稱排在很前面，資料會被道路線壓住。
    const styleLayers = m.getStyle().layers;
    const lastShape = styleLayers.reduce((found, l, i) => (l.type === 'symbol' ? found : i), -1);
    const beforeId = styleLayers[lastShape + 1]?.id;
    for (const layer of dataLayers(dark)) m.addLayer(layer, beforeId);
    // 世界視角（style.ts 的 splitWorldZoom）：底色是海，陸地用我們的國界、湖泊用 Natural Earth 1:110m 畫，
    // 插在背景色後面（彩色地形的陰影點陣圖蓋在上面）；放大到 LAND_UNTIL 以上換回底圖圖磚的陸地與水域
    const world = worldColors(m.getStyle());
    if (world) {
      const afterBackground = styleLayers[styleLayers.findIndex((l) => l.type === 'background') + 1]?.id;
      // 不反鋸齒：相鄰的國家各自反鋸齒，交界會透出一條海的顏色
      const land = { 'fill-color': world.land, 'fill-antialias': false };
      m.addLayer({ id: 'base-land', type: 'fill', source: 'countries', maxzoom: LAND_UNTIL, paint: land }, afterBackground);
      m.addLayer({ id: 'base-lakes', type: 'fill', source: 'lakes', maxzoom: LAND_UNTIL, paint: { 'fill-color': world.sea } }, afterBackground);
    }
    // 側欄的標記、游標的對蹠點：畫在最上面（連底圖的地名也蓋過，「台北的對蹠點」才不會被當地的地名壓住）
    for (const id of [MARKS_SOURCE, POINTER_SOURCE]) m.addSource(id, { type: 'geojson', data: EMPTY });
    for (const layer of markLayers(dark, labelFont(m))) m.addLayer(layer);
    baseRastersRef.current = styleLayers
      .filter((l) => l.type === 'raster' && l.layout?.visibility !== 'none')
      .map((l) => ({ id: l.id, minzoom: l.minzoom ?? 0, maxzoom: l.maxzoom ?? 24 }));
    // 地形：分層設色與陰影插在底圖的水域下面（圖磚含海底地形，由海面蓋住）；3D 地形用另一個 source，
    // MapLibre 建議跟陰影分開，畫質比較好。沒有圖層用到時不會下載圖磚
    m.addSource('dem', demSource());
    m.addSource('dem-3d', demSource());
    const water = styleLayers.find((l) => 'source-layer' in l && l['source-layer'] === 'water')?.id ?? beforeId;
    reliefBeforeRef.current = water;
    m.addLayer(
      {
        id: 'relief-color',
        type: 'color-relief',
        source: 'dem',
        layout: { visibility: 'none' },
        paint: { 'color-relief-color': RELIEF_COLOR },
      },
      water,
    );
    m.addLayer(
      {
        id: 'relief-shade',
        type: 'hillshade',
        source: 'dem',
        layout: { visibility: 'none' },
        paint: { 'hillshade-shadow-color': '#3d3526', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#3d3526' },
      },
      water,
    );
    // 面量圖上的陰影疊在國家顏色上面，也會蓋過底圖的海面（看得到海底地形），所以再疊一份底圖的水域蓋回去
    const waterFill = styleLayers.find((l) => l.type === 'fill' && l['source-layer'] === 'water');
    if (waterFill?.type === 'fill') {
      m.addLayer({ ...waterFill, id: 'relief-water', layout: { ...waterFill.layout, visibility: 'none' } }, beforeId);
      // 世界視角沒有畫底圖的水域（陸地用國界畫），陰影的海面改用 0–1 級圖磚的水域蓋（海岸線粗一點沒關係）
      if (world) {
        m.addLayer(
          {
            ...waterFill,
            id: RELIEF_WATER_WORLD,
            source: waterFill.source + WORLD_SUFFIX,
            minzoom: 0,
            maxzoom: WORLD_TILES_UNTIL,
            layout: { ...waterFill.layout, visibility: 'none' },
          },
          beforeId,
        );
      }
    }
    // 底圖圖磚還沒到時，MapLibre 用 background 圖層（陸地的顏色，彩色地形是米白）畫整顆地球：開頁時是一顆白球。
    // 先把它換成海的顏色，圖磚第一次全部到齊（idle）再換回來（樣式的 300 ms 過渡）。
    // 分頁在背景時不會畫、也就不會 idle，最多 10 秒也換回來，陸地不會一直是海的顏色
    const background = styleLayers.find((l) => l.type === 'background');
    const sea = waterFill?.type === 'fill' ? waterFill.paint?.['fill-color'] : undefined;
    if (background && typeof sea === 'string') {
      const land = m.getPaintProperty(background.id, 'background-color');
      const token = ++seaTokenRef.current;
      m.setPaintProperty(background.id, 'background-color', sea);
      const restore = () => {
        clearTimeout(seaTimerRef.current);
        m.off('idle', restore);
        // 圖磚到齊前又換了底圖：新的樣式自己會換回來，不要把舊樣式的陸地顏色套上去
        if (seaTokenRef.current === token && m.getLayer(background.id)) {
          // 海的顏色換過（CALM_SEA）就用換過的
          m.setPaintProperty(background.id, 'background-color', backgroundPaintRef.current ?? land);
        }
      };
      // 地圖拿掉時（換到排名表）由建立地圖的 effect 清掉，不然 10 秒後會對已經拿掉的地圖動手
      clearTimeout(seaTimerRef.current);
      seaTimerRef.current = setTimeout(restore, SEA_PLACEHOLDER_MAX_MS);
      m.once('idle', restore);
    }
    installedRef.current = true;
  };

  /* ── 建立地圖（只做一次） ─────────────── */
  useEffect(() => {
    let cancelled = false;
    let map: MaplibreMap | null = null;
    const initial = basemapRef.current;
    loadBaseStyle(initial.url, projectionRef.current, langRef.current)
      .then((style) => {
        if (cancelled || !mapNodeRef.current) return;
        map = new MaplibreMap({
          container: mapNodeRef.current,
          style,
          center: INITIAL_CENTER,
          zoom: fitGlobeZoom(mapNodeRef.current.clientHeight || 500),
          // 網址帶 3d=1 時直接以傾斜視角開啟，不播放動畫
          pitch: threeDRef.current ? PITCH_3D : 0,
          maxZoom: MAX_ZOOM,
          // 預設的版權標示會依寬度自動收合（地圖窄於 640px 時只顯示 ⓘ）
          localIdeographFontFamily: "'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', sans-serif",
          // 旋轉、傾斜只在 3D 模式開啟（右鍵或 Ctrl＋拖曳；見下面的操作 effect）
          dragRotate: false,
          // 第一次造訪時記下底圖的請求，service worker 接手後補存進快取（離線也能看到底圖）
          transformRequest: (url) => {
            noteMapRequest(url);
            return { url };
          },
        });
        mapRef.current = map;
        const m = map;
        // 開發時方便在瀏覽器主控台檢查地圖狀態
        if (import.meta.env.DEV) (window as unknown as { __map?: MaplibreMap }).__map = m;
        // 樣式一解析完就加上資料圖層，不等 'load'（要等第一個畫面的底圖圖磚全部下載完，手機上要好幾秒）
        m.once('style.load', () => {
          installDataLayers(m, initial.dark);
          loadedBasemapRef.current = initial.id;
          setRevision((r) => r + 1);
        });
        m.once('load', () => {
          // 窄螢幕時版權標示預設是展開的，會蓋住地圖下緣；先收合成 ⓘ 按鈕
          m.getContainer().querySelector('.maplibregl-compact')?.classList.remove('maplibregl-compact-show');
        });
        bindEvents(m);
        // 用滑鼠點地圖時不把焦點留在地圖上，←/→ 才會繼續換年份；用 Tab 移進地圖時方向鍵、+/− 照常平移縮放
        const canvas = m.getCanvas();
        canvas.addEventListener('focus', () => {
          if (!canvas.matches(':focus-visible')) canvas.blur();
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      clearTimeout(seaTimerRef.current);
      installedRef.current = false;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  const hoverIdRef = useRef<string | null>(null);
  const dragRef = useRef<{ start: [number, number]; startPoint: { x: number; y: number } } | null>(null);
  const suppressClickRef = useRef(false);

  const bindEvents = (map: MaplibreMap) =>
    bindMapEvents(map, {
      pointLayersRef,
      lineWidthFieldsRef,
      lineHoverRef,
      lineHighlightRef,
      hoverIdRef,
      dragRef,
      suppressClickRef,
      latest,
      setHover,
      setBoxMode,
    });

  /* ── 切換底圖：換樣式後重新加上資料圖層，revision 加一後下面的 effect 會把資料重新套上 ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || loadedBasemapRef.current === null || loadedBasemapRef.current === basemap.id) return;
    let cancelled = false;
    loadBaseStyle(basemap.url, projectionRef.current, langRef.current).then((style) => {
      if (cancelled) return;
      installedRef.current = false;
      hoverIdRef.current = null;
      lineHoverRef.current = null;
      selectedRef.current = null;
      map.once('style.load', () => {
        if (cancelled) return;
        installDataLayers(map, basemap.dark);
        loadedBasemapRef.current = basemap.id;
        setRevision((r) => r + 1);
      });
      // 3D 地形開著時直接換樣式，MapLibre 會拿舊樣式的地形去畫新樣式而出錯（shaderPreludeCode）；
      // 先拿掉，新樣式載入後 revision 變了，地形的 effect 會重新加上
      if (map.getTerrain()) map.setTerrain(null);
      map.setStyle(style, { diff: false });
    });
    return () => {
      cancelled = true;
    };
  }, [basemap]);

  // 底圖的國名用網站自己的名稱（iso2 → 名稱，style.ts 的 labelField）
  const countryLabels = useMemo(() => {
    if (!countryTable) return [];
    const seen = new Set<string>();
    const out: [string, string][] = [];
    for (const [iso3, ref] of Object.entries(countryTable)) {
      if (!ref.iso2 || seen.has(ref.iso2)) continue;
      seen.add(ref.iso2);
      out.push([ref.iso2, countryName(iso3, countryTable, lang)]);
    }
    return out;
  }, [countryTable, lang]);

  // 切換語言：底圖地名換成另一種語言，不必重新載入樣式
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const field = labelField(lang, countryLabels);
    for (const layer of map.getStyle().layers) {
      if (isNameLayer(layer)) map.setLayoutProperty(layer.id, 'text-field', field);
    }
  }, [revision, lang, countryLabels]);

  // 面量圖、類別圖開著時隱藏底圖的國界（改畫 data-border），其他時候用底圖的國界
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const own = indicator.layer.kind === 'choropleth' || indicator.layer.kind === 'categorical' || flagsOn;
    for (const layer of map.getStyle().layers) {
      if ('source-layer' in layer && layer['source-layer'] === 'boundary' && BASEMAP_COUNTRY_BORDER.test(layer.id)) {
        map.setLayoutProperty(layer.id, 'visibility', own ? 'none' : 'visible');
      }
    }
  }, [revision, indicator.layer.kind, flagsOn]);

  /* ── 資料 → 地圖 ─────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    (map.getSource('countries') as GeoJSONSource).setData(countryCollection);
    (map.getSource('tiny') as GeoJSONSource).setData(tinyCollection);
    (map.getSource('tiny-columns') as GeoJSONSource).setData(tinyColumnCollection);
  }, [revision, countryCollection, tinyCollection, tinyColumnCollection]);

  const mapContext = { mapRef, installedRef, ready, revision };
  useCountryFills(mapContext, { countries, shapeless, values, colorScale, categories, indicator, flagsOn, highlightCategory });
  const { gridUrl, backdrop } = useRasterLayers(mapContext, { grid, flags, flagsOn, countries, tinyCollection });

  // 海的顏色：彩色地形上有資料圖層的主題用 CALM_SEA（水域、湖泊、世界視角的背景、蓋住地形陰影的水域）
  const calmSea = basemap.id === 'terrain' && indicator.layer.kind !== 'none' && indicator.layer.kind !== 'terrain';
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const style = map.getStyle();
    const world = worldColors(style);
    if (!world) return;
    const sea = calmSea ? CALM_SEA : world.sea;
    for (const l of style.layers) {
      const water = l.type === 'fill' && ((l as { 'source-layer'?: string })['source-layer'] === 'water' || l.id === 'base-lakes');
      if (water) map.setPaintProperty(l.id, 'fill-color', sea);
    }
    const background = style.layers.find((l) => l.type === 'background');
    if (background) {
      backgroundPaintRef.current = ['step', ['zoom'], sea, LAND_UNTIL, world.land];
      map.setPaintProperty(background.id, 'background-color', backgroundPaintRef.current);
    }
  }, [revision, calmSea]);

  // 只留海的底圖（bareMap，板塊漂移）：在國家的顏色（data-fill）下面加一層海的顏色的背景，蓋住底圖的陸地、
  // 國界、道路與世界視角的陸地；底圖的文字（向量圖磚的 symbol 圖層）隱藏，記下原本的 visibility，離開時還原
  // （換底圖後是新的樣式，記錄作廢）。國界、國家的 hover 在 3D 那個 effect 拿掉
  const bareHiddenRef = useRef<{ revision: number; layers: Map<string, unknown> }>({ revision: -1, layers: new Map() });
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const style = map.getStyle();
    const hidden = bareHiddenRef.current;
    if (hidden.revision !== revision) bareHiddenRef.current = { revision, layers: new Map() };
    const record = bareHiddenRef.current.layers;
    const has = Boolean(map.getLayer(BARE_SEA));
    if (bare && !has) {
      const sea = worldColors(style)?.sea ?? CALM_SEA;
      map.addLayer({ id: BARE_SEA, type: 'background', paint: { 'background-color': sea } }, 'data-fill');
    } else if (!bare && has) {
      map.removeLayer(BARE_SEA);
    }
    if (bare) {
      for (const l of style.layers) {
        if (l.type !== 'symbol' || !('source' in l) || map.getSource(l.source)?.type !== 'vector') continue;
        if (!record.has(l.id)) record.set(l.id, map.getLayoutProperty(l.id, 'visibility'));
        map.setLayoutProperty(l.id, 'visibility', 'none');
      }
    } else {
      for (const [id, visibility] of record) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility === 'none' ? 'none' : 'visible');
      }
      record.clear();
    }
  }, [revision, bare]);

  // 3D 傾斜時的天空跟著介面深淺色（地球儀外面是 CSS 的背景）
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    map.setSky({ ...map.getSky(), ...(tokens.mode === 'light' ? LIGHT_SKY : DARK_SKY) });
  }, [revision, tokens.mode]);

  // 國界與選取外框的顏色：深色底圖或夜色底上用淺色，其他用深色（跟 dataLayers 一樣）
  const nightLook = basemap.dark || backdrop !== null;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    map.setPaintProperty('data-border', 'line-color', nightLook ? '#f0efec' : '#3d3d3a');
    map.setPaintProperty('data-highlight', 'line-color', nightLook ? '#ffffff' : MAP_TOKENS.ink);
    map.setPaintProperty('data-halo', 'line-color', nightLook ? '#0b0b0b' : '#ffffff');
    map.setPaintProperty('selected-mark', 'circle-stroke-color', nightLook ? '#ffffff' : MAP_TOKENS.ink);
    map.setPaintProperty('selected-mark-halo', 'circle-stroke-color', nightLook ? '#0b0b0b' : '#ffffff');
  }, [revision, nightLook]);

  // 側欄放的標記（首都與它的對蹠點）
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    (map.getSource(MARKS_SOURCE) as GeoJSONSource).setData(
      marks?.length
        ? {
            type: 'FeatureCollection',
            features: marks.map((m, i) => ({
              type: 'Feature',
              properties: { i, label: m.label, kind: m.kind },
              geometry: { type: 'Point', coordinates: [m.lon, m.lat] },
            })),
          }
        : EMPTY,
    );
  }, [revision, marks]);

  // 滑到地圖上任何一點時主題給的資訊（地球的另一邊：游標的對蹠點），跟著游標動的小記號
  const pointerInfo = hover?.lngLat && pointer ? pointer(hover.lngLat, hover.iso3) : null;
  const pointerMark = pointerInfo?.mark ?? null;
  const pointerMarkKey = pointerMark ? pointerMark.join(',') : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    (map.getSource(POINTER_SOURCE) as GeoJSONSource | undefined)?.setData(
      pointerMark ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: pointerMark } } : EMPTY,
    );
    // pointerMark 每次都是新的陣列，依內容（pointerMarkKey）更新就好
  }, [revision, pointerMarkKey]);

  // 地球儀縮小時，底圖的地名只留離畫面中心 LIMB_DEGREES 以內的（見 sphericalCap）；移動結束時更新
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    // 換底圖後是新的樣式：記下地名圖層原本的篩選條件
    const labels = map
      .getStyle()
      .layers.filter(
        (l): l is Extract<LayerSpecification, { type: 'symbol' }> =>
          l.type === 'symbol' && ['place', 'water_name'].includes((l as { 'source-layer'?: string })['source-layer'] ?? ''),
      )
      .map((l) => ({ id: l.id, filter: l.filter }));
    let applied: [number, number] | null = null;
    const restore = () => {
      if (!applied) return;
      for (const l of labels) if (map.getLayer(l.id)) map.setFilter(l.id, l.filter ?? null);
      applied = null;
    };
    const update = () => {
      if (projection !== 'globe' || map.getZoom() >= LIMB_MAX_ZOOM) return restore();
      const c = map.getCenter();
      const center: [number, number] = [c.lng, c.lat];
      if (applied && geoDistance(applied, center) < LIMB_MIN_SHIFT * (Math.PI / 180)) return;
      const within: ExpressionSpecification = ['within', sphericalCap(center, LIMB_DEGREES)];
      for (const l of labels) map.setFilter(l.id, l.filter ? ['all', l.filter as ExpressionSpecification, within] : within);
      applied = center;
    };
    update();
    map.on('moveend', update);
    return () => {
      map.off('moveend', update);
      // 換了底圖（revision 變了）是新的樣式，本來就沒有篩選；只有切換平面、地球儀時要還原。
      // 元件卸載時地圖可能已經 remove()，那時不必還原
      if (revisionRef.current === revision && installedRef.current) restore();
    };
  }, [revision, projection]);

  // 網格第一次畫好：留下 performance mark「map-grid」給載入速度量測用（npm run measure:load -- <網址> --mark map-grid）
  const gridShownRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !gridUrl || gridShownRef.current) return;
    let tileLoaded = false;
    const onData = (e: MapSourceDataEvent) => {
      if (e.sourceId === GRID_LAYER && e.tile) tileLoaded = true;
    };
    const onRender = () => {
      if (!tileLoaded || !map.getSource(GRID_LAYER) || !map.isSourceLoaded(GRID_LAYER)) return;
      map.off('render', onRender);
      gridShownRef.current = true;
      performance.mark('map-grid');
    };
    map.on('sourcedata', onData);
    map.on('render', onRender);
    return () => {
      map.off('sourcedata', onData);
      map.off('render', onRender);
    };
  }, [revision, gridUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const entries =
      indicator.layer.kind === 'bubble' ? [...values].filter(([iso3, v]) => v > 0 && anchors.has(iso3)) : [];
    const features: GeoJSON.Feature[] = entries.map(([iso3, v]) => ({
      type: 'Feature',
      properties: { iso3, r: Math.max(BUBBLE_MIN_RADIUS, radius(v)) },
      geometry: { type: 'Point', coordinates: anchors.get(iso3)! },
    }));
    (map.getSource('bubbles') as GeoJSONSource).setData({ type: 'FeatureCollection', features });
    // 3D 柱子：底面固定，高度與數值成正比（線性，總量才能直接比較）；最高的柱子是所有年份的最大值
    const columns: GeoJSON.Feature[] = entries.map(([iso3, v]) => ({
      type: 'Feature',
      properties: { iso3, h: v / bubbleMax },
      geometry: circlePolygon(anchors.get(iso3)!, COLUMN_RADIUS_KM),
    }));
    (map.getSource('columns') as GeoJSONSource).setData({ type: 'FeatureCollection', features: columns });
  }, [revision, values, radius, anchors, bubbleMax, indicator.layer.kind]);

  // 資料第一次畫到地圖上：通知 App（之後才載入精細國界、預先下載），並留下 performance mark「map-data」
  // 給載入速度量測用（DESIGN.md 第 13 節）。不上色的指標（純地圖、路網）以國界畫上為準
  const shownRef = useRef(false);
  const onFirstDataRef = useRef(onFirstData);
  onFirstDataRef.current = onFirstData;
  useEffect(() => {
    const map = mapRef.current;
    const kind = indicator.layer.kind;
    if (!ready || !map || !installedRef.current || shownRef.current) return;
    if (countries.length === 0 || (values.size === 0 && kind !== 'none')) return;
    const source = kind === 'bubble' ? 'bubbles' : 'countries';
    const onRender = () => {
      if (!map.isSourceLoaded(source)) return;
      map.off('render', onRender);
      shownRef.current = true;
      performance.mark('map-data');
      onFirstDataRef.current?.();
    };
    map.on('render', onRender);
    map.triggerRepaint();
    return () => {
      map.off('render', onRender);
    };
  }, [revision, countries, values, indicator.layer.kind]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    (map.getSource('railways') as GeoJSONSource).setData(
      railways ? { type: 'Feature', properties: {}, geometry: railways } : EMPTY,
    );
  }, [revision, railways]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const features: GeoJSON.Feature[] = (airports?.rows ?? []).map((row, i) => ({
      type: 'Feature',
      properties: { i, type: row[2], iso3: row[6] },
      geometry: { type: 'Point', coordinates: [row[0], row[1]] },
    }));
    (map.getSource('airports') as GeoJSONSource).setData({ type: 'FeatureCollection', features });
  }, [revision, airports]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const show = (id: string, visible: boolean) => map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    show('rail', Boolean(railways) && layers.railways);
    show('airports-large', Boolean(airports) && layers.largeAirports);
    show('airports-medium', Boolean(airports) && layers.mediumAirports);
  }, [revision, railways, airports, layers]);

  /* ── 一般的點、線疊加圖層（overlayLayers.ts） ── */
  const overlaySentRef = useRef<{ revision: number; cache: OverlayDataCache }>({ revision: -1, cache: new Map() });
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    // 換底圖後新樣式沒有這些 source，資料要重送
    if (overlaySentRef.current.revision !== revision) overlaySentRef.current = { revision, cache: new Map() };
    // 換年份時也要同步：有 epochs 的點圖層（城市每 5 年一期的人口）換到另一期要重送資料，其他圖層不會重送
    pointLayersRef.current = syncOverlays(map, overlays, overlaySentRef.current.cache, basemap.dark, year);
    applyTimeFilters(map, overlays, year, indicator.overlayTime);
    // 換底圖後新的圖層一開始沒有標出任何線：重新標出目前要標的那一組
    const shown = lineHoverRef.current ?? lineHighlightRef.current;
    if (shown) highlightLine(map, null, shown);
    lineHoverRef.current = shown;
  }, [revision, overlays, year, indicator.overlayTime]);

  /* ── 晝夜（時刻主題，nightLayer.ts）：換時刻只換太陽的方向與直射點，換底圖後重新加上 ── */
  const night = overlays.find((o) => o.kind === 'night');
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    syncNight(map, night?.def.id ?? null, Boolean(night?.visible), basemap.dark, time);
  }, [revision, night?.def.id, night?.visible, basemap.dark, time]);

  /* ── 月亮（晝夜與季節的「月亮」，nightLayer.ts）：看得到月亮的半個地球與月下點，畫在夜色上面 ── */
  const moon = overlays.find((o) => o.kind === 'moon');
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    syncMoon(map, moon?.def.id ?? null, Boolean(moon?.visible), basemap.dark, time, moon?.def.position ?? null);
  }, [revision, moon?.def.id, moon?.def.position, moon?.visible, basemap.dark, time, night?.visible]);

  /* ── 即時網格（此刻的極光，liveGridLayer.ts）：資料重讀時只換數值；換底圖後重新加上（晝夜之後加，畫在夜色上面） ── */
  const liveGrid = overlays.find((o) => o.kind === 'liveGrid');
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const def = liveGrid?.def;
    syncLiveGrid(map, def?.id ?? null, Boolean(liveGrid?.visible), liveGrid?.values ?? null, {
      color: def ? (basemap.dark ? def.color.dark : def.color.light) : '#000000',
      opacity: def?.opacity ?? [[0, 0]],
    });
  }, [revision, liveGrid?.def, liveGrid?.visible, liveGrid?.values, basemap.dark, night?.visible]);

  /* ── 類別網格（氣候分區，classGridLayer.ts）：換時期只換代碼的貼圖；換底圖後重新加上 ── */
  const classGrid = overlays.find((o) => o.kind === 'classGrid');
  const classColors = useMemo(
    () => new Map((classGrid?.def.classes ?? []).map((c) => [c.value, c.color] as [number, string])),
    [classGrid?.def],
  );
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const def = classGrid?.def;
    syncClassGrid(map, def?.id ?? null, Boolean(classGrid?.visible), classGrid?.grid ?? null, {
      colors: classColors,
      opacity: def?.opacity ?? CLASS_GRID_OPACITY,
      only: null,
    });
  }, [revision, classGrid?.def, classGrid?.visible, classGrid?.grid, classColors]);

  /* ── 風的粒子（風與季風，windLayer.ts）：換月份只換風場；換底圖後重新加上（類別網格之後，畫在風速的底色上面） ── */
  const wind = overlays.find((o) => o.kind === 'wind');
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const def = wind?.def;
    syncWind(map, def?.id ?? null, Boolean(wind?.visible), wind?.field ?? null, {
      color: def ? (basemap.dark ? def.color.dark : def.color.light) : '#000000',
      opacity: 0.7,
    });
  }, [revision, wind?.def, wind?.visible, wind?.field, basemap.dark]);

  /* ── 主題側欄要標出的一組線（例如滑到某條河）：跟滑鼠滑過共用同一層 ── */
  useEffect(() => {
    const map = mapRef.current;
    lineHighlightRef.current = lineHighlight;
    if (!ready || !map || !installedRef.current) return;
    highlightLine(map, lineHoverRef.current, lineHighlight);
    lineHoverRef.current = lineHighlight;
  }, [revision, lineHighlight]);

  /* ── 主題側欄點某條河：把地圖移到它的範圍 ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focusBox) return;
    const [w, s, e, n] = focusBox.box;
    map.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: 48, maxZoom: 8, duration: 900, bearing: map.getBearing() },
    );
    // 只依 key：同一個範圍再點一次也要移過去
  }, [focusBox?.key]);

  /* ── 回報縮放與畫面範圍（線圖層的 detail 依它下載分區） ── */
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;

  // 放大超過全球視角才要 1:50m 的國界：比預設的縮放大 0.5 級、或到 DETAIL_ZOOM（大螢幕的預設就接近 3 級）
  // 地圖的說明寫在 MapLibre 的 canvas 上（它本身是 role="region"、可以用 Tab 移進去平移縮放）。
  // 2026-10-29 以前寫在外框的 role="img" 上，但圖片裡不能有可聚焦的東西（axe 的 nested-interactive）
  useEffect(() => {
    if (ready) mapRef.current?.getCanvas().setAttribute('aria-label', ariaLabel);
  }, [ready, ariaLabel]);

  const onDetailNeededRef = useRef(props.onDetailNeeded);
  onDetailNeededRef.current = props.onDetailNeeded;
  const wantsDetail = Boolean(props.onDetailNeeded);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !wantsDetail) return;
    const check = () => {
      const fit = fitGlobeZoom(map.getContainer().clientHeight);
      if (map.getZoom() < Math.min(DETAIL_ZOOM, fit + 0.5)) return;
      map.off('zoomend', check);
      onDetailNeededRef.current?.();
    };
    check();
    map.on('zoomend', check);
    return () => {
      map.off('zoomend', check);
    };
  }, [ready, wantsDetail]);
  const wantsView = Boolean(onViewChange);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !wantsView) return;
    const report = () => {
      const b = map.getBounds();
      onViewChangeRef.current?.({ zoom: map.getZoom(), bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] });
    };
    report();
    map.on('moveend', report);
    return () => {
      map.off('moveend', report);
    };
  }, [ready, wantsView]);

  /* ── 流向圖：選取國家 ↔ 各夥伴的大圓弧線 ── */
  const flowMax = useMemo(() => (flows ? Math.max(0, ...flows.links.map((l) => l.value)) : 0), [flows]);
  // 只有有沒有的流向圖（海外軍事基地）：線一樣粗
  const presence = indicator.layer.kind === 'flow' && Boolean(indicator.layer.presence);
  const flowData = useMemo(() => {
    const lines: GeoJSON.Feature[] = [];
    const ends: GeoJSON.Feature[] = [];
    const origin = flows ? anchors.get(flows.origin) : undefined;
    if (flows && origin) {
      const color = flowColors(flows.direction).end;
      ends.push({ type: 'Feature', properties: { iso3: flows.origin, origin: true }, geometry: { type: 'Point', coordinates: origin } });
      for (const link of flows.links) {
        const partner = anchors.get(link.iso3);
        if (!partner || link.iso3 === flows.origin) continue; // 地圖上沒有形狀的夥伴（例如吐瓦魯）只列在側欄
        // 弧線一律從出口國畫到進口國，漸層的淺色端才會是出口國
        const [from, to] = flows.direction === 'export' ? [origin, partner] : [partner, origin];
        lines.push({
          type: 'Feature',
          properties: { iso3: link.iso3, w: presence ? FLOW_PRESENCE_WIDTH : flowWidth(link.value, flowMax) },
          geometry: { type: 'LineString', coordinates: greatCircle(from, to) },
        });
        ends.push({ type: 'Feature', properties: { iso3: link.iso3, color }, geometry: { type: 'Point', coordinates: partner } });
      }
    }
    const collection = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features });
    return { lines: collection(lines), ends: collection(ends) };
  }, [flows, anchors, flowMax, presence]);

  // 夥伴國塗上淡底色；換國家、換方向時先清掉上一次的
  const tintedRef = useRef<string[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    (map.getSource('flows') as GeoJSONSource).setData(flowData.lines);
    (map.getSource('flow-ends') as GeoJSONSource).setData(flowData.ends);
    for (const id of tintedRef.current) map.setFeatureState({ source: 'countries', id }, { tint: false });
    const colors = flowColors(flows?.direction ?? 'export');
    const tinted = (flows?.links ?? []).map((l) => l.iso3).filter((iso3) => iso3 !== flows?.origin);
    for (const id of tinted) map.setFeatureState({ source: 'countries', id }, { tint: true, tintColor: colors.tint });
    tintedRef.current = tinted;
    // line-gradient 不能依 feature 變化，換方向時整個換掉
    map.setPaintProperty('flow-lines', 'line-gradient', flowGradient(colors));
  }, [revision, flowData, flows]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    (map.getSource('box') as GeoJSONSource).setData(
      box ? { type: 'Feature', properties: {}, geometry: boxPolygon(box) } : EMPTY,
    );
    if (!box) return;
    const place = () => {
      const [w, s, e, n] = box;
      const center = map.project([w <= e ? (w + e) / 2 : (w + e + 360) / 2, (s + n) / 2]);
      setOverlayOnLeft(center.x > map.getCanvas().clientWidth / 2);
    };
    place();
    map.on('moveend', place);
    return () => {
      map.off('moveend', place);
    };
  }, [revision, box]);

  // 選取的國家加粗外框；不在畫面上時（例如從搜尋或排名表選）把地圖轉過去
  const selectedRef = useRef<string | null>(null);
  const pulseFrameRef = useRef(0);
  useEffect(() => () => cancelAnimationFrame(pulseFrameRef.current), []);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    for (const source of SELECT_SOURCES) {
      if (selectedRef.current) map.setFeatureState({ source, id: selectedRef.current }, { selected: false });
      if (selected) map.setFeatureState({ source, id: selected }, { selected: true });
    }
    // 新選到的國家：外框底下的光暈從寬而淡收到原本的寬度，看得出選到哪裡（2026-10-29）；減少動態效果時直接畫
    if (selected && selected !== selectedRef.current && map.getLayer('data-halo') && !matchMedia(REDUCED_MOTION).matches) {
      cancelAnimationFrame(pulseFrameRef.current);
      const start = performance.now();
      const step = (now: number) => {
        // requestAnimationFrame 的時間是這一格開始的時間，可能比 start（performance.now()）早一點：夾在 0 以上
        const k = Math.min(1, Math.max(0, (now - start) / SELECT_PULSE_MS));
        const eased = 1 - (1 - k) ** 3;
        if (!map.getLayer('data-halo')) return;
        map.setPaintProperty('data-halo', 'line-width', haloWidth(HALO_WIDTH + (1 - eased) * 16));
        map.setPaintProperty('data-halo', 'line-opacity', 0.35 + 0.55 * eased);
        if (k < 1) pulseFrameRef.current = requestAnimationFrame(step);
      };
      pulseFrameRef.current = requestAnimationFrame(step);
    }
    selectedRef.current = selected;
    // 只留海的底圖（板塊漂移）：國家今天的位置在地圖上沒有意義，不移過去
    if (bare) return;
    if (fitOnSelect && selected) {
      const bounds = countryBounds.get(selected);
      // 3D 時保留目前的方位（fitBounds 預設會轉回正北）
      if (bounds) map.fitBounds(bounds, { padding: 48, maxZoom: 8, duration: 900, bearing: map.getBearing() });
      return;
    }
    const anchor = selected ? anchors.get(selected) : undefined;
    if (!anchor) return;
    const center = map.getCenter();
    const p = map.project(anchor);
    const canvas = map.getCanvas();
    const offScreen = p.x < 0 || p.y < 0 || p.x > canvas.clientWidth || p.y > canvas.clientHeight;
    const behindGlobe = projection === 'globe' && geoDistance([center.lng, center.lat], anchor) > Math.PI / 2.4;
    if (offScreen || behindGlobe) map.easeTo({ center: anchor, zoom: Math.max(map.getZoom(), 2.5), duration: 800 });
    // 投影不放進依賴：切換投影、進出 3D 時不要重跑，否則這裡的 easeTo 會打斷傾斜的動畫
  }, [revision, selected, anchors, fitOnSelect, countryBounds, markedCountries, bare]);

  // 選取的小國家畫一個圓圈，大小圈住國名（markRadius）；換語言時國名的長度不同，所以另一個 effect
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const mark = selected && !bare && markedCountries.has(selected) ? anchors.get(selected) : undefined;
    const r = selected ? markRadius(countryName(selected, countryTable, lang)) : 0;
    (map.getSource('selected-mark') as GeoJSONSource).setData(
      mark ? { type: 'Feature', properties: { r }, geometry: { type: 'Point', coordinates: mark } } : EMPTY,
    );
  }, [revision, selected, anchors, markedCountries, countryTable, lang, bare]);

  // 從搜尋選到國家：一定飛過去並框住整個國家，扣掉手機抽屜蓋住的部分
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus || bare) return;
    const bounds = countryBounds.get(focus.iso3);
    if (!bounds) return;
    const rect = map.getContainer().getBoundingClientRect();
    let covered = 0;
    for (const el of document.querySelectorAll('[data-occludes-map]')) {
      covered = Math.max(covered, rect.bottom - el.getBoundingClientRect().top);
    }
    const pad = Math.min(48, rect.width / 8, rect.height / 8);
    const bottom = Math.min(Math.max(pad, covered + pad / 2), rect.height * 0.6);
    map.fitBounds(bounds, {
      padding: { top: pad, left: pad, right: pad + 40, bottom }, // 右邊留給縮放按鈕
      maxZoom: fitOnSelect ? 8 : 5,
      duration: 1200,
      bearing: map.getBearing(), // 3D 時保留目前的方位（fitBounds 預設會轉回正北）
    });
  }, [ready, focus]); // 只在有新的搜尋結果時移動，換底圖、換年份都不動

  useHotkeys(
    {
      '+': () => mapRef.current?.zoomIn(),
      '=': () => mapRef.current?.zoomIn(),
      '-': () => mapRef.current?.zoomOut(),
      _: () => mapRef.current?.zoomOut(),
    },
    ready,
  );

  // 框選模式：拖曳用來畫框，不平移地圖。旋轉、傾斜只在 3D 模式開放
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    if (boxMode) {
      map.dragPan.disable();
      map.touchZoomRotate.disable();
      map.getCanvas().style.cursor = 'crosshair';
      // capture + preventDefault：Esc 只取消框選，不會順便取消選取的國家
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          dragRef.current = null;
          setBoxMode(false);
        }
      };
      window.addEventListener('keydown', onKey, true);
      return () => window.removeEventListener('keydown', onKey, true);
    }
    map.dragPan.enable();
    map.touchZoomRotate.enable();
    map.getCanvas().style.cursor = '';
    if (threeD) {
      // 右鍵或 Ctrl＋拖曳：左右旋轉、上下傾斜；觸控：雙指轉動旋轉、雙指上下滑傾斜；鍵盤：Shift＋方向鍵
      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();
      map.touchPitch.enable();
      map.keyboard.enableRotation();
    } else {
      // 平面上色時沒有回正按鈕，不讓地圖被轉歪或傾斜
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.touchPitch.disable();
      map.keyboard.disableRotation();
    }
  }, [revision, boxMode, threeD]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    map.setProjection({ type: projection });
  }, [revision, projection]);

  // 進出 3D 時傾斜／轉回。只在切換時播放（換底圖不重播）；網址直接帶 3d=1 時，建立地圖時就是傾斜的
  const cameraThreeDRef = useRef(threeD);
  useEffect(() => {
    if (cameraThreeDRef.current === threeD) return;
    cameraThreeDRef.current = threeD;
    mapRef.current?.easeTo(threeD ? { pitch: PITCH_3D, duration: 1000 } : { pitch: 0, bearing: 0, duration: 800 });
  }, [threeD]);

  // 3D：依指標的圖層類型換成立體圖層。面量圖的平面上色、國界、選取外框改由立體圖形的顏色表現；
  // data-fill 留著（透明）當點選的備援。
  // 1 km 網格：國家不上色（data-fill 透明，hover、點選照舊），國界照畫；3D 時網格維持平面、國家不拉高，
  // 只是把地圖傾斜（點陣圖沒辦法依格子拉高，拉高國家平均又會跟網格的顏色對不起來）
  const gridOn = Boolean(gridUrl);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const kind = indicator.layer.kind;
    // 有地形圖層的主題，3D 是真的立體地形（另一個 effect），國家的顏色貼在地形上，不另外拉高
    const extrude = threeD && !terrain;
    const slabs = extrude && kind === 'choropleth' && !gridOn;
    const show = (id: string, visible: boolean) => map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    show('extrude-countries', slabs);
    show('extrude-tiny', slabs);
    show('extrude-columns', extrude && kind === 'bubble');
    show('bubbles', !extrude);
    show('data-tiny', !slabs && !gridOn && !flagsOn && !bare);
    show('data-border', !slabs && !bare);
    show('data-highlight', !slabs && !bare);
    show('data-halo', !slabs && !bare);
    show('data-hover', !slabs && !bare);
    // 只留海的底圖（bareMap）：國家不能 hover、點選（隱藏的圖層 featureAt 會跳過）
    show('data-fill', !bare);
    // 要維持同一種運算式（依縮放與 feature-state）：改成常數 0 的話，舊圖磚在重新排版前遇到 hover
    // 更新 feature-state，MapLibre 會對常數呼叫 evaluate 而丟出 TypeError
    map.setPaintProperty(
      'data-fill',
      'fill-opacity',
      fillOpacity(slabs || gridOn || flagsOn ? 0 : dataFillOpacity(basemap.dark), FLOW_TINT_OPACITY),
    );
    // 平面時鐵路在比例圓下面；3D 時改畫在立體圖形上面，否則會被整片蓋住
    map.moveLayer('rail', extrude ? 'airports-medium' : 'data-tiny');
  }, [revision, threeD, indicator.layer.kind, gridOn, terrain, flagsOn, basemap.dark, bare]);

  // 面量圖、類別圖、國旗把陸地整片蓋住（不透明度 0.82–0.94），世界視角看不到底圖的陰影點陣圖：
  // 縮放 WORLD_TILES_UNTIL 以下不畫，圖磚就不必下載（彩色地形約 3.2 MB）；放大後填色變淡，地形才透得出來。
  // 網格（填色是透明的）、3D 的立體圖形（填色也是透明的）照常畫
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const kind = indicator.layer.kind;
    const covered = flagsOn || ((kind === 'choropleth' || kind === 'categorical') && !gridOn && !(threeD && !terrain));
    for (const { id, minzoom, maxzoom } of baseRastersRef.current) {
      if (map.getLayer(id)) map.setLayerZoomRange(id, covered ? Math.max(minzoom, WORLD_TILES_UNTIL) : minzoom, maxzoom);
    }
  }, [revision, indicator.layer.kind, flagsOn, gridOn, threeD, terrain]);

  // 地形圖層：地形圖（kind 'terrain'）畫分層設色，陰影疊在上面；面量圖只疊陰影，而且移到國家顏色上面，
  // 看得出起伏。陰影可以在左下角關掉
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const reliefMap = terrain && indicator.layer.kind === 'terrain';
    const shade = terrain && layers.hillshade;
    map.setLayoutProperty('relief-color', 'visibility', reliefMap ? 'visible' : 'none');
    map.setLayoutProperty('relief-shade', 'visibility', shade ? 'visible' : 'none');
    for (const { id } of baseRastersRef.current) {
      map.setLayoutProperty(id, 'visibility', reliefMap || shade ? 'none' : 'visible');
    }
    map.moveLayer('relief-shade', reliefMap ? reliefBeforeRef.current : 'data-border');
    for (const id of ['relief-water', RELIEF_WATER_WORLD]) {
      if (!map.getLayer(id)) continue;
      map.setLayoutProperty(id, 'visibility', shade && !reliefMap ? 'visible' : 'none');
      map.moveLayer(id, 'data-border');
    }
    map.setPaintProperty('relief-shade', 'hillshade-exaggeration', reliefMap ? 0.55 : 0.4);
  }, [revision, terrain, indicator.layer.kind, layers.hillshade]);

  // 3D 立體地形（有地形圖層的主題）。全球視角時要放大很多倍才看得出起伏，縮放結束時依縮放級數換倍率；
  // 切換底圖後新樣式沒有地形，revision 變了會重新設定
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    if (!terrain || !threeD) {
      if (map.getTerrain()) map.setTerrain(null);
      return;
    }
    let level = terrainExaggeration(map.getZoom());
    map.setTerrain({ source: 'dem-3d', exaggeration: level });
    const onZoomEnd = () => {
      const next = terrainExaggeration(map.getZoom());
      // 切換底圖、新樣式還沒載入時不能設定地形（新樣式載入後這個 effect 會重跑）
      if (next === level || !installedRef.current) return;
      level = next;
      map.setTerrain({ source: 'dem-3d', exaggeration: next });
    };
    map.on('zoomend', onZoomEnd);
    return () => {
      map.off('zoomend', onZoomEnd);
    };
  }, [revision, terrain, threeD]);

  // 回正按鈕上的指北針跟著地圖旋轉
  const compassRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !threeD) return;
    const update = () => {
      if (compassRef.current) compassRef.current.style.transform = `rotate(${-map.getBearing()}deg)`;
    };
    update();
    map.on('rotate', update);
    return () => {
      map.off('rotate', update);
    };
  }, [ready, threeD]);

  useEffect(() => {
    if (!threeDHint) return;
    const id = setTimeout(() => setThreeDHint(false), 6000);
    return () => clearTimeout(id);
  }, [threeDHint]);

  const toggleThreeD = () => {
    if (!onThreeDChange) return;
    const on = !threeD;
    onThreeDChange(on);
    setThreeDHint(on);
    // 3D 下的框選：地圖可以旋轉、傾斜，拖出來的範圍跟畫面上的矩形對不起來，所以不開放
    if (on) {
      dragRef.current = null;
      setBoxMode(false);
    }
  };

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen?.();
  };

  // 手機上 3D、全螢幕、框選收進「更多」（MoreMenu.tsx），按鈕列剩回到全球、平面／地球儀、底圖、更多。
  // 只有一項時照樣放在按鈕列，不必多點一下
  const moreItems: MoreMenuItem[] = [
    ...(onThreeDChange ? [{ id: '3d', label: t.threeD, checked: threeD, onSelect: toggleThreeD }] : []),
    ...(canFullscreen ? [{ id: 'fullscreen', label: fullscreen ? t.exitFullscreen : t.fullscreen, onSelect: toggleFullscreen }] : []),
    ...(onBoxChange
      ? [{ id: 'box', label: boxToolLabel, checked: boxMode, disabled: threeD, note: t.boxIn3d, onSelect: () => setBoxMode((m) => !m) }]
      : []),
  ];
  const collapseMore = narrow && moreItems.length > 1;

  // 寬螢幕的地圖兩旁有空位（地球儀只佔中間）：圖例上面列出數值最高、最低的國家
  const kind = indicator.layer.kind;
  const showExtremes =
    Boolean(props.onPickCountry) &&
    !narrow &&
    (size?.width ?? 0) >= EXTREMES_MIN_WIDTH &&
    (kind === 'choropleth' || kind === 'bubble') &&
    !indicator.unranked &&
    indicator.rankingBars !== false &&
    !gridOn &&
    values.size >= 10;

  // 網格的圖例：顏色、門檻用 meta.json 的（跟圖磚裡畫的一樣），寫出是哪一期
  const gridLegend = useMemo(() => {
    if (!grid) return null;
    const g = gridLabels(grid.spec, lang);
    const { meta, epoch } = grid;
    const projected = meta.projectionFrom !== undefined && epoch >= meta.projectionFrom;
    return {
      title: g.title(legendTitle),
      // 網格有自己的單位時（航運密度），圖例用它，不用指標的
      indicator: grid.spec.unit ? { ...indicator, unit: grid.spec.unit } : indicator,
      scale: gridScale(meta),
      notes: [g.note(epoch, projected), ...(threeD ? [g.flatIn3d] : [])],
      emptyKey: g.empty(meta),
    };
  }, [grid, lang, legendTitle, threeD, indicator]);

  const hasOverlays = Boolean(railways || airports || terrain || overlays.length);
  const reliefLegend = useMemo(
    () => (terrain && indicator.layer.kind === 'terrain' ? reliefLegendModel(indicator.formatTick ?? indicator.format) : null),
    [terrain, indicator, lang],
  );
  // 流向圖還沒選國家時，提示使用者點一下；選了但那一年沒有資料也要說
  const flowLayer = indicator.layer.kind === 'flow' ? indicator.layer : null;
  const flowHint =
    !flowLayer || boxMode
      ? null
      : !selected
        ? flowText(flowLayer, lang).pick(flowText(flowLayer, lang).pickPartners)
        : flows?.origin === selected && flows.links.length === 0
          ? flowText(flowLayer, lang).noData(flows.year, flowText(flowLayer, lang)[flows.direction].partners)
          : null;

  useImperativeHandle(
    ref,
    () => ({
      exportImage: async (content) => {
        const map = mapRef.current;
        if (!map || !installedRef.current) throw new Error('The map has not finished loading');
        // 圖例跟畫面上的一樣：數值圖例（3D 時是階梯色塊或柱子），加上目前開著的疊加圖層
        const title = legendTitle;
        const unit = indicator.unit;
        const valueLegend: ImageLegend | null = colorScale
          ? {
              kind: 'choropleth',
              title,
              unit,
              model: choroplethLegendModel(indicator, colorScale),
              stepped: threeD && !terrain,
              noDataKey: indicator.missing,
            }
          : reliefLegend
            ? { kind: 'relief', title: tr(RELIEF_TITLE, lang), unit, model: reliefLegend }
            : categories
              ? { kind: 'categorical', title, model: categoricalLegendModel(categories, values) }
          : indicator.layer.kind !== 'bubble'
            ? flowLayer && flows && flowMax > 0
              ? { kind: 'flow', title, unit: presence ? '' : unit, model: flowLegendModel(indicator, flows.direction, flowMax) }
              : null
            : threeD
              ? { kind: 'column', title, unit, model: columnLegendModel(indicator, bubbleMax), color: MAP_TOKENS.accent }
              : { kind: 'bubble', title, unit, model: bubbleLegendModel(indicator, radius) };
        // 網格：網格的分級、哪一期、不上色的格子
        const legend: ImageLegend | null = gridLegend
          ? {
              kind: 'choropleth',
              title: gridLegend.title,
              unit: gridLegend.indicator.unit,
              model: choroplethLegendModel(gridLegend.indicator, gridLegend.scale),
              notes: gridLegend.notes,
              emptyKey: gridLegend.emptyKey,
            }
          : valueLegend;
        const layerKeys = onLayersChange
          ? exportLayerKeys(
              LAYER_KEYS.filter((k) => ({ railways, airports, terrain })[k.source] && layers[k.key]).map((key) => ({
                key,
                color: layerKeyColor(key, tokens),
              })),
              overlays,
              tokens,
              basemapRef.current.dark,
            )
          : [];
        const { canvas, ratio } = await captureMap(map);
        return canvasToPng(composeMapImage(canvas, ratio, { ...content, legend, layerKeys, tokens }));
      },
    }),
    [colorScale, categories, values, radius, indicator, legendTitle, onLayersChange, railways, airports, terrain, layers, overlays, tokens, threeD, bubbleMax, flowLayer, flows, flowMax, gridLegend, reliefLegend, lang],
  );

  return (
    <div
      ref={containerRef}
      className={`map${dimmed ? ' is-dimmed' : ''}${boxMode ? ' is-box-mode' : ''}${fullscreen ? ' is-fullscreen' : ''}`}
    >
      <div
        ref={mapNodeRef}
        className="map-canvas"
        style={{ background: tokens.mode === 'light' ? SPACE_BACKGROUND_LIGHT : SPACE_BACKGROUND }}
      />
      {failed && (
        <StatusCard overlay kind="error" title={t.basemapFailedTitle} detail={t.basemapFailed} action={{ label: t.reload, onClick: () => location.reload() }} />
      )}

      <div className="map-zoom" role="group" aria-label={t.mapControls}>
        {/* 觸控裝置用兩指縮放，不放放大、縮小鈕（鍵盤的 +/− 照樣可以用） */}
        {!coarse && (
          <>
            <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label={t.zoomIn} title={t.zoomIn}>
              <PlusIcon />
            </button>
            <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label={t.zoomOut} title={t.zoomOut}>
              <MinusIcon />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() =>
            mapRef.current?.easeTo({
              center: INITIAL_CENTER,
              zoom: fitGlobeZoom(mapRef.current.getContainer().clientHeight),
              duration: 800,
            })
          }
          aria-label={t.resetView}
          title={t.resetView}
        >
          <ResetIcon />
        </button>
        <RegionMenu
          onGo={(center) =>
            mapRef.current?.easeTo({ center, zoom: fitGlobeZoom(mapRef.current.getContainer().clientHeight), duration: 1000 })
          }
        />
        <button
          type="button"
          onClick={() => !flatIn3d && setGlobe((g) => !g)}
          aria-disabled={flatIn3d}
          aria-label={projection === 'globe' ? t.toFlat : t.toGlobe}
          title={flatIn3d ? t.globeIn3d : projection === 'globe' ? t.toFlat : t.toGlobe}
        >
          {projection === 'globe' ? <FlatIcon /> : <GlobeIcon />}
        </button>
        {!collapseMore && onThreeDChange && (
          <button
            type="button"
            className={`map-text-button map-toggle${threeD ? ' is-active' : ''}`}
            onClick={toggleThreeD}
            aria-pressed={threeD}
            aria-label={t.threeD}
            title={threeD ? t.threeDLeave : t.threeDEnter}
          >
            3D
          </button>
        )}
        {threeD && (
          <button
            type="button"
            className="map-compass"
            onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: PITCH_3D, duration: 600 })}
            aria-label={t.compass}
            title={t.compassTitle}
          >
            <svg ref={compassRef} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M8 1.5 11 8H5Z" fill="#e24a48" />
              <path d="M8 14.5 5 8h6Z" fill="currentColor" opacity="0.5" />
            </svg>
          </button>
        )}
        {!collapseMore && canFullscreen && (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? t.exitFullscreen : t.fullscreen}
            title={fullscreen ? t.exitFullscreen : t.fullscreen}
          >
            {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </button>
        )}
        {onBasemapChange && <BasemapMenu basemap={basemap} onChange={onBasemapChange} />}
        {collapseMore && <MoreMenu items={moreItems} />}
        {!collapseMore && onBoxChange && (
          <button
            type="button"
            className={`box-tool${boxMode ? ' is-active' : ''}`}
            onClick={() => !threeD && setBoxMode((m) => !m)}
            aria-pressed={boxMode}
            aria-disabled={threeD}
            aria-label={boxToolLabel}
            title={threeD ? t.boxIn3d : boxMode ? t.boxToolActive : boxToolLabel}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <rect x="2.5" y="3.5" width="11" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.5 1.5" />
            </svg>
          </button>
        )}
      </div>

      {boxMode && <div className="map-hint">{t.boxHint}</div>}
      {flowHint && !threeDHint && <div className="map-hint">{flowHint}</div>}
      {gridFailed && !boxMode && !threeDHint && <div className="map-hint">{gridLabels(indicator.grid ?? { dir: '' }, lang).failed}</div>}
      {threeDHint && (
        <div className="map-hint is-wrap">
          {matchMedia('(pointer: coarse)').matches ? t.threeDHintTouch : t.threeDHintMouse}
          {globe && !terrain && t.threeDHintGlobe}
        </div>
      )}
      {overlay && <div className={`map-overlay${overlayOnLeft ? '' : ' is-right'}`}>{overlay}</div>}

      <div className="map-legend">
        {showExtremes && (
          <Extremes
            indicator={indicator}
            values={values}
            year={year}
            countryTable={countryTable}
            selected={selected}
            onPick={props.onPickCountry!}
          />
        )}
        {hasOverlays && onLayersChange && (
          <LayerControls
            layers={layers}
            onChange={onLayersChange}
            hasRailways={Boolean(railways)}
            hasAirports={Boolean(airports)}
            hasTerrain={terrain}
            overlays={overlays}
            tokens={tokens}
            darkMap={basemap.dark}
          />
        )}
        {gridLegend ? (
          <ChoroplethLegend
            indicator={gridLegend.indicator}
            title={gridLegend.title}
            scale={gridLegend.scale}
            notes={gridLegend.notes}
            emptyKey={gridLegend.emptyKey}
          />
        ) : colorScale ? (
          <ChoroplethLegend
            indicator={indicator}
            title={legendTitle}
            scale={colorScale}
            stepped={threeD && !terrain}
            paletteKind={indicator.layer.kind === 'choropleth' ? indicator.layer.scale.type : undefined}
            // 3D 的立體圖形沒有淡化，不能點選分級
            classes={
              threeD
                ? undefined
                : { values, highlight: highlightCategory, onPreview: setPreviewCategory, pinned: pinnedCategory, onPin: setPinnedCategory }
            }
          />
        ) : reliefLegend ? (
          <ReliefLegend title={tr(RELIEF_TITLE, lang)} unit={indicator.unit} model={reliefLegend} />
        ) : categories ? (
          <CategoricalLegend
            title={legendTitle}
            scale={categories}
            values={values}
            highlight={highlightCategory}
            onPreview={setPreviewCategory}
            pinned={pinnedCategory}
            onPin={setPinnedCategory}
            paletteKind={
              indicator.layer.kind === 'categorical'
                ? indicator.layer.diverging
                  ? 'diverging'
                  : indicator.layer.ordinal
                    ? 'sequential'
                    : undefined
                : undefined
            }
          />
        ) : indicator.layer.kind === 'bubble' ? (
          threeD ? (
            <ColumnLegend indicator={indicator} title={legendTitle} max={bubbleMax} color={MAP_TOKENS.accent} tokens={tokens} />
          ) : (
            <BubbleLegend indicator={indicator} title={legendTitle} radius={radius} tokens={tokens} />
          )
        ) : flowLayer && flows && flowMax > 0 ? (
          <FlowLegend indicator={indicator} title={legendTitle} direction={flows.direction} max={flowMax} tokens={tokens} />
        ) : flagsOn ? (
          <div className="legend legend-flags">
            <div className="legend-title">{legendTitle}</div>
            <div className="legend-note">{tr(FLAG_LEGEND_NOTE, lang)}</div>
          </div>
        ) : null}
      </div>

      {hover && size && (hover.iso3 || hover.point || hover.airport !== undefined || hover.mark !== undefined || pointerInfo) && (
        <MapTooltip x={hover.x} y={hover.y} width={size.width} height={size.height}>
          {hover.mark !== undefined && marks?.[hover.mark] ? (
            <MarkTooltip marks={marks} index={hover.mark} />
          ) : hover.point && renderPointTooltip ? (
            renderPointTooltip(hover.point.overlay, hover.point.index)
          ) : hover.airport !== undefined && renderAirportTooltip ? (
            renderAirportTooltip(hover.airport)
          ) : (
            <>
              {hover.iso3 && renderTooltip(hover.iso3)}
              {pointerInfo && <PointerLines info={pointerInfo} standalone={!hover.iso3} />}
            </>
          )}
        </MapTooltip>
      )}
    </div>
  );
}
