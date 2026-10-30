/**
 * 介面文字（繁體中文，預設語言）。英文版在 en.ts，型別由這份決定：少一個鍵或參數不同都會編譯失敗。
 * 主題專用的文字不放這裡，寫在各主題的設定檔與側欄元件裡（見 DESIGN.md §4）。
 */
import { fixed } from '../lib/format';

/** 指標名稱接在中文前後時，跟英文、數字之間空一格：「研發經費占 GDP 排名」「各國 GDP 總額」 */
const spaced = (text: string) =>
  text.replace(/([㐀-鿿])([A-Za-z0-9])/g, '$1 $2').replace(/([A-Za-z0-9%])([㐀-鿿])/g, '$1 $2');

export const zh = {
  pageTitle: '世界資料地圖',
  pageDescription: '用世界地圖瀏覽各國人口、經濟、能源、產業與農業資料',
  crashMessage: '網頁出了問題，畫面沒辦法繼續顯示。',
  crashReload: '重新整理',
  brand: '世界資料地圖',
  topicsNav: '主題',
  /** 主題選單裡每個主題下方的說明：列出前幾個指標 */
  topicSummary: (indicators: string[], more: boolean) => `${indicators.join('、')}${more ? '等' : ''}`,
  /** 主題總覽（TopicsOverview.tsx）：每個分類選單最下面的連結與對話框 */
  allTopics: '全部主題',
  /** 圖例的「配色」按鈕（PaletteMenu.tsx） */
  palette: '配色',
  paletteTitle: '換地圖的配色',
  paletteNote: '選擇記在這個瀏覽器。人口密度、夜間燈光等網格圖層的顏色不會換。',
  allTopicsMenu: '看全部主題',
  overviewFilter: '篩選主題、指標或項目',
  overviewMatch: (label: string) => `符合：${label}`,
  overviewNoMatch: '沒有符合的主題',
  overviewRecent: '最近看過',
  /** 嵌入模式（?embed=1）上緣的連結 */
  embedOpen: '在世界資料地圖開啟',
  overviewCredit:
    '縮圖是各主題預設指標的世界地圖（資料出處見各主題的頁尾）；底圖 © OpenStreetMap contributors · OpenMapTiles · OpenFreeMap，國界 Natural Earth。主題圖示 Lucide（ISC 授權）。',
  language: '語言',
  switchToLight: '切換為淺色',
  switchToDark: '切換為深色',

  indicator: '指標',
  basemapStyle: '底圖配色',
  /** 地圖右上角「底圖」按鈕的說明，寫出目前的底圖 */
  basemapCurrent: (name: string) => `底圖配色：${name}`,
  searchCountry: '搜尋國家',
  viewMode: '檢視方式',
  viewMap: '地圖',
  viewTable: '排名表',
  /** 只露兩行的說明（手機上的指標說明、頁尾的主題說明）展開、收起的按鈕 */
  descMore: '更多',
  descLess: '收起',
  loadFailed: (message: string) => `資料載入失敗：${message}`,
  /** 狀態畫面（StatusCard.tsx） */
  dataFailedTitle: '這個主題的資料沒有載入成功',
  offlineNotSavedTitle: '目前離線，這個主題還沒存到這台裝置',
  offlineNotSavedHint: '連上網路後就能看；看過的主題之後離線也能打開。',
  retry: '重試',
  reload: '重新整理',
  basemapFailedTitle: '底圖沒有載入成功',
  loadingMap: '地圖載入中…',
  loadingData: '資料載入中…',
  loading: '載入中…',
  offline: '離線中',
  offlineHint: '沒有網路連線，顯示的是這台裝置上次存下的資料與地圖',
  noData: '無資料',
  projected: '推估值',
  estimated: '估計值',
  world: '世界',
  close: '關閉',

  /** 「稻米」＋「產量」→「稻米產量」 */
  itemIndicator: (item: string, indicator: string) => `${item}${indicator}`,
  /** 年份的寫法：2023 年 */
  year: (year: number) => `${year} 年`,
  /** 指標的 timeAxis 改寫了年份（「1996 年出生」）時，接在標題後面：「男性平均身高（1996 年出生）」 */
  withYear: (title: string, when: string) => spaced(`${title}（${when}）`),
  worldMapAria: '世界地圖',
  /** year 是 null：不隨時間變化的資料（例如海拔） */
  mapAria: (year: number | null, title: string, projected: boolean) =>
    spaced(`世界地圖：${year === null ? '' : `${year} 年`}各國${title}${projected ? '（推估值）' : ''}`),
  tooltipProjected: ' 推估值',
  /** 年份零散的指標用之前最近一年的值時，標出實際的資料年份 */
  dataYear: (year: number) => `${year} 年的資料`,
  latestWithinHint: (within: number) =>
    within === 1
      ? '沒有當年資料的國家，顯示前一年的值，並標出資料年份。'
      : `沒有當年資料的國家，顯示 ${within} 年內最近一年的值，並標出資料年份。`,
  /** 流向圖：「台灣的出口」、tooltip 的「占 12%」 */
  flowTitle: (origin: string, title: string) => `${origin}的${title}`,
  flowShare: (share: string) => `占 ${share}`,
  /** 流向檔標了估算的夥伴（數量依單價估算，石油、天然氣與煤） */
  flowEstimated: '數量是估算的',
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
  savedViews: '收藏的畫面',
  saveView: '收藏目前的畫面，名稱：',
  saveViewSubmit: '收藏',
  savedViewsEmpty: '還沒有收藏。把現在的主題、指標、年份與選的國家存起來，之後點一下就回來。',
  savedViewsNote: '只存在這台裝置的瀏覽器裡。',
  removeSavedView: (name: string) => `刪掉收藏「${name}」`,
  playSettings: '播放設定：速度、循環、播放的年份',
  playSpeed: '速度',
  playLoop: '循環播放',
  playRange: '播放的年份',
  playRangeFrom: '從哪一年開始播',
  playRangeTo: '播到哪一年',
  playRangeAll: '播全部年份',
  yearSlider: '年份',
  yearValue: (year: number, projected: boolean) => `${year} 年${projected ? '（推估值）' : ''}`,
  projectionFrom: (year: number) => `${year} 起為推估`,

  // 時刻的控制（時刻主題：晝夜與季節，MomentControl.tsx）
  playDay: '播放一天（晝夜界線跟著時間移動）',
  playYear: '播放一年（四季的變化）',
  momentMode: '拉桿與播放的範圍',
  modeDay: '一天',
  modeYear: '一年',
  modeDayTitle: '拉桿是這一天的時間',
  modeYearTitle: '拉桿是一年裡的日期（時間不變）',
  timeOfDay: '時間',
  dayOfYear: '日期',
  hourTick: (h: number) => `${h} 時`,
  marchEquinox: '春分',
  juneSolstice: '夏至',
  septemberEquinox: '秋分',
  decemberSolstice: '冬至',
  pickDate: '選擇日期',
  now: '現在',
  nowTitle: '回到現在（每分鐘更新）',

  // 地圖控制
  mapControls: '地圖控制',
  zoomIn: '放大',
  zoomOut: '縮小',
  resetView: '回到全球',
  goToRegion: '轉到某一洲',
  extremesLabel: '數值最高與最低的國家',
  extremesHigh: '最高',
  extremesLow: '最低',
  extremesMost: '最多',
  toFlat: '切換成平面地圖',
  toGlobe: '切換成地球儀',
  fullscreen: '全螢幕',
  moreMapTools: '更多地圖功能',
  exitFullscreen: '離開全螢幕',
  boxTool: '框選',
  // 主題側欄放在地圖上的標記（首都與它的對蹠點）：點一下移到另一個
  markLink: (to: string) => `按一下移到${to}`,
  boxToolFor: (label: string) => `框選範圍，估算${label}`,
  boxToolActive: '在地圖上拖曳畫框（Esc 取消）',
  boxHint: '在地圖上拖曳畫出範圍（Esc 取消）',
  basemapFailed: '請檢查網路連線後重新整理。',
  // 3D
  valueLabels: '在地圖上標數值',
  valueLabelsOff: '拿掉地圖上的數值',
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
  unitSuffix: (unit: string) => (unit ? `（${unit}）` : ''),
  layers: '圖層',
  categoryTitle: (label: string, count: number) => `${label}：${count} 個國家/地區（點一下只突顯這一類，再點一下取消）`,
  // 面量圖的分級（圖例的色塊可以滑過、點選）
  binBelow: (x: string) => `低於 ${x}`,
  binAbove: (x: string) => `${x} 以上`,
  binRange: (from: string, to: string) => `${from}–${to}`,
  binTitle: (label: string, count: number) => `${label}：${count} 個國家/地區（點一下只突顯這一級，再點一下取消）`,
  binStatus: (label: string, count: number) => `${label}：${count} 個國家/地區`,

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
  // 側欄的「比較」（ComparePicker.tsx）
  compareLabel: '比較',
  compareAdd: '加入比較',
  compareAddAria: '加入比較的國家',
  comparePlaceholder: '輸入國名',
  compareRemove: (name: string) => `不再比較${name}`,
  compareNoResults: '找不到有資料的國家',
  shareOfWorld: (share: string) => ` · 占全球 ${share}`,
  shownYear: (year: number) => `（${year} 年）`,
  overTime: (label: string) => spaced(`${label}的變化`),
  lineChartAria: (name: string, label: string) => spaced(`${name}歷年${label}折線圖`),
  singleSnapshotPanel: '這項資料只有單一時間點，沒有歷年變化。',
  noCountryData: '這個國家沒有這項資料。',
  dashedProjection: (year: number) => `虛線為 ${year} 年起的推估值。`,
  methodBreak: (year: number) => `垂直虛線：${year} 年起改用新的統計方法，跟之前的年份不完全可比。`,
  estimatesBefore: (year: number) => `垂直虛線：${year} 年以前多半是估計或內插值。`,
  note: (note: string) => `附註：${note}`,
  yearMissing: (year: number) => `（${year} 年無資料，顯示最近一年）`,
  /** 類別圖（例如首要死因）的歷年變化：「2000–2016 年」 */
  periodRange: (from: number, to: number) => (from === to ? `${from} 年` : `${from}–${to} 年`),

  // 排名表
  rankingCaption: (year: number | null, title: string, count: number) =>
    spaced(`${year === null ? '' : `${year} 年`}各國${title}排名（${count} 個國家/地區）`),
  categoryCaption: (year: number | null, title: string, count: number) =>
    spaced(`${year === null ? '' : `${year} 年`}各國${title}（${count} 個國家/地區，依類別排列）`),
  valueCaption: (year: number | null, title: string, count: number) =>
    spaced(`${year === null ? '' : `${year} 年`}各國${title}（${count} 個國家/地區，依數值排列）`),
  regionFilter: '只看某一洲',
  regionAll: '全部',
  regions: { AS: '亞洲', EU: '歐洲', AF: '非洲', NA: '北美洲', SA: '南美洲', OC: '大洋洲' },
  regionNorthAmericaNote: '含中美洲與加勒比海',
  regionShown: (region: string, count: number, ranked: boolean) =>
    `${region} ${count} 個國家/地區${ranked ? '，名次是全球的名次' : ''}`,
  rankCol: '名次',
  countryCol: '國家/地區',
  shareCol: '占全球',
  dataYearCol: '資料年份',
  changeCol: (year: number) => `比 ${year} 年`,
  changePoints: (x: string) => `${x} 個百分點`,
  increase: '增加',
  decrease: '減少',

  // 圖表
  chartTotal: '合計',
};

export type Messages = typeof zh;
