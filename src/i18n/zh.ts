/**
 * 介面文字（繁體中文，預設語言）。英文版在 en.ts，型別由這份決定：少一個鍵或參數不同都會編譯失敗。
 * 主題專用的文字不放這裡，寫在各主題的設定檔與側欄元件裡（見 DESIGN.md §4）。
 */
import { fixed } from '../lib/format';

export const zh = {
  pageTitle: '世界資料地圖',
  pageDescription: '用世界地圖瀏覽各國人口、經濟、能源、產業與農業資料',
  brand: '世界資料地圖',
  topicsNav: '主題',
  language: '語言',
  switchToLight: '切換為淺色',
  switchToDark: '切換為深色',

  indicator: '指標',
  basemap: '底圖',
  basemapStyle: '底圖配色',
  searchCountry: '搜尋國家',
  viewMode: '檢視方式',
  viewMap: '地圖',
  viewTable: '排名表',
  loadFailed: (message: string) => `資料載入失敗：${message}`,
  loadingMap: '地圖載入中…',
  loading: '載入中…',
  noData: '無資料',
  projected: '推估值',
  estimated: '估計值',
  world: '世界',
  close: '關閉',

  /** 「稻米」＋「產量」→「稻米產量」 */
  itemIndicator: (item: string, indicator: string) => `${item}${indicator}`,
  /** 年份的寫法：2023 年 */
  year: (year: number) => `${year} 年`,
  worldMapAria: '世界地圖',
  mapAria: (year: number, title: string, projected: boolean) =>
    `世界地圖：${year} 年各國${title}${projected ? '（推估值）' : ''}`,
  tooltipProjected: ' 推估值',
  largeAirport: '大型機場',
  mediumAirport: '中型機場',

  sources: '資料來源：',
  listSeparator: '、',
  sourceLicense: (license: string) => `（${license}）`,
  borders: ' · 國界：',
  publicDomain: '（公有領域）',
  generatedAt: (date: string) => ` · 資料產生於 ${date}`,
  disclaimer: '國界與名稱僅為資料呈現，不代表任何政治立場。',
  // 匯出圖片底下的來源標示、分享面板的標題
  basemapCredit: (attribution: string) => `底圖：${attribution}`,
  bordersCredit: '國界：Natural Earth（公有領域）。國界與名稱僅為資料呈現，不代表任何政治立場。',
  shareTitle: (view: string) => `${view}｜世界資料地圖`,

  // 時間軸
  singleSnapshot: '這項資料只有單一時間點，沒有歷年變化',
  play: '播放',
  playTitle: '播放歷年變化',
  pause: '暫停',
  yearSlider: '年份',
  yearValue: (year: number, projected: boolean) => `${year} 年${projected ? '（推估值）' : ''}`,
  projectionFrom: (year: number) => `${year} 起為推估`,

  // 地圖控制
  mapControls: '地圖控制',
  zoomIn: '放大',
  zoomOut: '縮小',
  resetView: '回到全球',
  toFlat: '切換成平面地圖',
  toGlobe: '切換成地球儀',
  flatShort: '平面',
  globeShort: '球',
  fullscreen: '全螢幕',
  exitFullscreen: '離開全螢幕',
  boxTool: '框選',
  boxToolFor: (label: string) => `框選範圍，估算${label}`,
  boxToolActive: '在地圖上拖曳畫框（Esc 取消）',
  boxHint: '在地圖上拖曳畫出範圍（Esc 取消）',
  basemapFailed: '底圖載入失敗，請檢查網路連線後重新整理。',
  // 3D
  threeD: '3D 立體地圖',
  threeDEnter: '3D 立體地圖：用高度呈現數值。3D 時改用平面地圖：地球儀上的立體圖形無法點選（MapLibre 5 的限制）',
  threeDLeave: '離開 3D，回到平面上色',
  globeIn3d: '3D 時改用平面地圖：地球儀上的立體圖形無法點選（MapLibre 5 的限制）',
  boxIn3d: '3D 模式不能框選（地圖可以旋轉、傾斜），請先關閉 3D',
  compass: '朝北並回到預設傾角',
  compassTitle: '朝北並回到預設傾角（右鍵或 Ctrl＋拖曳可旋轉、傾斜）',
  threeDHintTouch: '雙指轉動可旋轉、雙指上下滑動可傾斜',
  threeDHintMouse: '右鍵或 Ctrl＋拖曳可旋轉、傾斜',
  threeDHintGlobe: '；3D 時改用平面地圖：地球儀上的立體圖形無法點選（MapLibre 5 的限制）',
  unitSuffix: (unit: string) => `（${unit}）`,
  layers: '圖層',

  // 框選結果
  boxAria: (label: string) => `框選範圍內的${label}`,
  boxTitle: (label: string) => `框選範圍內${label}（估算）`,
  boxClear: '清除框選',
  boxEmpty: (label: string) => `框內沒有${label}資料（海洋或無人區）`,
  boxLand: (year: number, area: string) => `${year} 年 · 陸地面積 ${area}`,
  boxDensity: (density: string, unit: string) => ` · 平均每 km² ${density} ${unit}`,
  boxUnassigned: '地圖上沒有國界的小島',
  boxShare: (label: string, share: string) => `占該國${label} ${share}`,
  boxShareTiny: '不到 0.1%',
  boxOthers: (n: number, allCountries: boolean) => `其他 ${n} ${allCountries ? '國' : '處'}`,
  boxNote: (epoch: number, cellSize: number, label: string) =>
    `依 GHS-POP ${epoch} 年約 1 km 網格的${label}分布（彙整成 ${cellSize}° 網格）估算，` +
    `再把各國調整到該年的總${label}。國內分布固定用 ${epoch} 年，年份離得越遠越不準。`,
  /** 面積：1 萬 km² 以上用「萬」 */
  area: (km2: number) =>
    km2 >= 1e4 ? `${fixed(km2 / 1e4, km2 >= 1e6 ? 0 : 1)} 萬 km²` : `${fixed(km2, 0)} km²`,

  // 國家側欄
  panelAria: (name: string) => `${name}的資料`,
  rank: (rank: number, total: number) => `第 ${rank} / ${total} 名`,
  shareOfWorld: (share: string) => ` · 占全球 ${share}`,
  shownYear: (year: number) => `（${year} 年）`,
  overTime: (label: string) => `${label}的變化`,
  lineChartAria: (name: string, label: string) => `${name}歷年${label}折線圖`,
  singleSnapshotPanel: '這項資料只有單一時間點，沒有歷年變化。',
  noCountryData: '這個國家沒有這項資料。',
  dashedProjection: (year: number) => `虛線為 ${year} 年起的推估值。`,
  note: (note: string) => `附註：${note}`,
  yearMissing: (year: number) => `（${year} 年無資料，顯示最近一年）`,

  // 排名表
  rankingCaption: (year: number, title: string, count: number) => `${year} 年各國${title}排名（${count} 個國家/地區）`,
  rankCol: '名次',
  countryCol: '國家/地區',
  shareCol: '占全球',

  // 圖表
  chartTotal: '合計',
};

export type Messages = typeof zh;
