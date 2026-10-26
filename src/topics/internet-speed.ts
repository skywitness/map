import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { GridSpec, IndicatorDef, ScaleSpec, Text, TopicDefinition } from './types';

/**
 * 網路速度（pipeline/topics/internet_speed.py、internet_speed_tiles.py）：
 * Speedtest by Ookla 的 Open Data（AWS，CC BY-NC-SA 4.0），每年第 3 季的 z16 圖塊（約 600 m）依位置歸到國家，
 * 地圖上是圖塊平均值依測試次數加權的中位數；子項目是固網／行動網路。
 * 下載速度可以切到約 2 km 網格（最新一季，固網、行動各一組圖磚）。
 * 資料檔是 Ookla 資料的改作，依 CC BY-NC-SA 4.0 提供（頁尾與 DESIGN.md 第 8 節第 12、79 點）。
 */

/** 下載速度的分級門檻（Mbps）：網格圖磚（pipeline/topics/internet_speed_tiles.py 的 THRESHOLDS）要一樣，pipeline 會檢查 */
export const FIXED_DOWNLOAD = [10, 25, 50, 100, 200, 300];
export const MOBILE_DOWNLOAD = [10, 25, 50, 100, 150, 250];
/** 網格裡測試次數不到這個數的格子不上色（internet_speed_tiles.py 的 MIN_TESTS） */
const GRID_MIN_TESTS = 5;
/** 測試次數不到這個數的國家不給速度（pipeline/topics/internet_speed.py 的 MIN_TESTS） */
export const MIN_TESTS = 1000;

const MBPS = 'Mbps';
const MS = { zh: '毫秒', en: 'ms' };

const mbps = (v: number) => `${fixed(v, v < 10 ? 1 : 0)} Mbps`;
const ms = (v: number) => tr({ zh: `${fixed(v, 0)} 毫秒`, en: `${fixed(v, 0)} ms` });

const sequential = (thresholds: number[]): ScaleSpec => ({ type: 'sequential', thresholds });

/** 時間軸的年份是那一年的第 3 季（7–9 月） */
const Q3 = {
  label: { zh: '每年第 3 季', en: 'Q3 of each year' },
  year: (y: number) => tr({ zh: `${y} 年第 3 季`, en: `Q3 ${y}` }),
};

const METHOD: Text = {
  zh: `使用者自己用 Speedtest by Ookla 測的結果（每年第 3 季）：每個約 600 m 見方的圖塊取平均，再依測試次數加權取全國的中位數。固網是經由 Wi-Fi 或有線網路測的，行動網路是經由 4G、5G 測的。一季不到 ${MIN_TESTS.toLocaleString('en-US')} 次測試的國家不給值，測試次數見側欄。`,
  en: `Tests users ran themselves with Speedtest by Ookla (Q3 of each year): each tile about 600 m across is averaged, then the national median is taken with tiles weighted by their number of tests. Fixed means tests over Wi-Fi or a wired connection; mobile means over 4G or 5G. Countries with fewer than ${MIN_TESTS.toLocaleString('en-US')} tests in the quarter get no value; test counts are in the side panel.`,
};

const SPEED_GRID: GridSpec = {
  dir: 'internet-speed-{item}',
  label: { zh: '約 2 km 網格', en: '~2 km grid' },
  subtitle: {
    zh: `每個約 2 km 見方的格子裡所有測試的下載速度中位數（Speedtest by Ookla，2026 年第 3 季）。測試不到 ${GRID_MIN_TESTS} 次的格子不上色；城市測得多、鄉間測得少，看得出城鄉的落差。`,
    en: `Median download speed of all tests in each cell about 2 km across (Speedtest by Ookla, Q3 2026). Cells with fewer than ${GRID_MIN_TESTS} tests are left blank; cities have many tests and the countryside few, which shows the urban–rural gap.`,
  },
  epochNote: (epoch) =>
    tr({
      zh: `${epoch} 年第 3 季（每個年份都顯示這一季）· 縮小時為範圍內所有測試的中位數`,
      en: `Q3 ${epoch} (shown for every year) · median of all tests in range when zoomed out`,
    }),
  empty: { zh: `測試不到 ${GRID_MIN_TESTS} 次（不上色）`, en: `Fewer than ${GRID_MIN_TESTS} tests (not coloured)` },
  // 國家的值是中位數，不是平均
  countryValue: {
    label: { zh: '國家中位數', en: 'Country median' },
    tooltip: { zh: '國家中位數', en: 'country median' },
    hoverHint: { zh: '滑鼠移到國家上會顯示國家的中位數。', en: ' Hover over a country to see its median.' },
  },
};

const indicators: IndicatorDef[] = [
  {
    id: 'download',
    label: { zh: '下載速度', en: 'Download speed' },
    description: {
      zh: `下載速度的中位數（Mbps）。${METHOD.zh}`,
      en: `Median download speed (Mbps). ${METHOD.en}`,
    },
    unit: MBPS,
    file: 'download/{item}.json',
    layer: {
      kind: 'choropleth',
      scale: sequential(FIXED_DOWNLOAD),
      itemScales: { mobile: sequential(MOBILE_DOWNLOAD) },
    },
    format: mbps,
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
    timeAxis: Q3,
    grid: SPEED_GRID,
  },
  {
    id: 'upload',
    label: { zh: '上傳速度', en: 'Upload speed' },
    description: {
      zh: `上傳速度的中位數（Mbps），傳照片、影片、視訊會議時用到。${METHOD.zh}`,
      en: `Median upload speed (Mbps), which matters for sending photos and videos and for video calls. ${METHOD.en}`,
    },
    unit: MBPS,
    file: 'upload/{item}.json',
    layer: {
      kind: 'choropleth',
      scale: sequential([5, 10, 25, 50, 100, 200]),
      itemScales: { mobile: sequential([5, 10, 15, 20, 25, 35]) },
    },
    format: mbps,
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
    timeAxis: Q3,
  },
  {
    id: 'latency',
    label: { zh: '延遲', en: 'Latency' },
    description: {
      zh: `延遲（ping）的中位數（毫秒），越小越好，視訊通話、線上遊戲最受影響；主要看離測速伺服器多遠與網路的品質。${METHOD.zh}`,
      en: `Median latency (ping) in milliseconds; lower is better, and video calls and online games feel it most. It depends mostly on the distance to the test server and network quality. ${METHOD.en}`,
    },
    unit: MS,
    file: 'latency/{item}.json',
    layer: {
      kind: 'choropleth',
      scale: sequential([5, 10, 15, 25, 50, 100]),
      itemScales: { mobile: sequential([20, 25, 30, 40, 60, 100]) },
    },
    format: ms,
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
    lowerIsBetter: true,
    timeAxis: Q3,
  },
];

export const internetSpeed: TopicDefinition = {
  id: 'internet-speed',
  title: { zh: '網路速度', en: 'Internet speed' },
  shortTitle: { zh: '網速', en: 'Net speed' },
  defaultIndicator: 'download',
  defaultYear: 2026,
  // 頁尾的來源與說明要短：完整的引用在 manifest.json 與 DESIGN.md 第 8 節第 79 點
  sources: [
    {
      name: 'Speedtest® by Ookla® Global Fixed and Mobile Network Performance Maps (AWS Open Data)',
      url: 'https://github.com/teamookla/ookla-open-data',
      license: 'CC BY-NC-SA 4.0',
    },
    {
      name: { zh: '數位發展部 行動通訊速率量測（台灣的對照）', en: 'Ministry of Digital Affairs (Taiwan), mobile speed measurement (comparison)' },
      url: 'https://data.gov.tw/dataset/161791',
      license: 'CC0 1.0',
    },
    {
      name: { zh: '國家通訊傳播委員會 4G 上網速率量測（台灣的對照）', en: 'National Communications Commission (Taiwan), 4G speed measurement (comparison)' },
      url: 'https://www.ncc.gov.tw/chinese/news_detail.aspx?site_content_sn=8&sn_f=47460',
      license: { zh: '政府網站資料開放宣告（引用數字）', en: 'Government website open data declaration (figures cited)' },
    },
  ],
  note: {
    zh: 'Speedtest® by Ookla® Global Fixed and Mobile Network Performance Maps was accessed on 27 October 2026 from AWS. Based on World Data Map’s analysis of Speedtest® by Ookla® Global Fixed and Mobile Network Performance Maps for Q3 2019 – Q3 2026. Ookla trademarks used under license and reprinted with permission. 這個主題的資料檔與網格圖磚是 Ookla 資料的改作，依 CC BY-NC-SA 4.0（姓名標示—非商業性—相同方式分享）提供。測試是使用者自己發起的，偏向城市、手機與想確認網速的人，不是隨機抽樣；只收有 GPS 定位的測試。各國的值是圖塊平均依測試次數加權的中位數，不是逐次測試的中位數。台灣的官方量測（NCC、數位發展部）是專業人員在固定地點用測試手機量的，方法不同，寫在台灣的側欄。網路普及見「數位」主題。',
    en: 'Speedtest® by Ookla® Global Fixed and Mobile Network Performance Maps was accessed on 27 October 2026 from AWS. Based on World Data Map’s analysis of Speedtest® by Ookla® Global Fixed and Mobile Network Performance Maps for Q3 2019 – Q3 2026. Ookla trademarks used under license and reprinted with permission. This topic’s data files and grid tiles adapt Ookla’s data and are shared under CC BY-NC-SA 4.0. Users start tests themselves, so results lean towards cities, phones and people checking their connection; this is not a random sample, and only tests with GPS location are included. Country values are tests-weighted medians of tile averages, not medians of individual tests. Taiwan’s official measurements (NCC, Ministry of Digital Affairs) are taken by staff at fixed sites with test phones, a different method; see Taiwan’s side panel. For internet access, see the Digital topic.',
  },
  dimension: {
    label: { zh: '網路', en: 'Network' },
    // 標題是「子項目＋指標」：「固網下載速度」「Fixed-line download speed」（英文用 Fixed-line 而不是 Fixed broadband：選單短一點，英文 1280px 寬時上傳、延遲的控制列才不會剛好卡在換行邊緣）
    options: [
      { id: 'fixed', label: { zh: '固網', en: 'Fixed-line' } },
      { id: 'mobile', label: { zh: '行動網路', en: 'Mobile' } },
    ],
    defaultOption: 'fixed',
  },
  panelExtra: () => import('./panels/InternetSpeedPanel'),
  indicators,
};
