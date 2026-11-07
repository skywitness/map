import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { metroSpeedPart } from './metro-speed';
import { withParts } from './parts';
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

const MISSING_OECD: Text = { zh: '沒有資料（只有 OECD 寬頻資料庫的 44 國，沒有台灣）', en: 'No data (only the 44 countries in the OECD broadband database; Taiwan is not included)' };

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
  // 2026-11-07（製作手冊第二十五批 504）OECD 寬頻資料庫：pipeline/topics/broadband_oecd.py，年值（等於第 4 季），沒有子項目「網路」
  {
    id: 'fixed-tech',
    label: { zh: '固網寬頻用哪一種技術', en: 'Fixed broadband by technology' },
    description: {
      zh: '固網寬頻用戶裡用這種技術接進來的比例（OECD 寬頻資料庫，每年年底；OECD 自己算的比例）。2025 年光纖：冰島 95.7%、南韓 91.6%、西班牙 91.1%、羅馬尼亞 87.0%、芬蘭 85.4%、法國 82.2%、日本 79.2%，OECD 合計 50.7%；最低比利時 13.9%、奧地利 16.4%、德國 16.5%、希臘 24.2%、捷克 25.3%、美國 29.7%。德國的 DSL 還占 58.6%（希臘 74.1%），美國以 Cable 為主（53.6%），捷克的固定無線接取占 37.7%。西班牙 2009 年的光纖只有 0.3%，2020 年 73.1%。',
      en: 'Share of fixed broadband subscriptions using each technology (OECD broadband database, end of each year; shares as calculated by the OECD). Fibre in 2025: Iceland 95.7%, South Korea 91.6%, Spain 91.1%, Romania 87.0%, Finland 85.4%, France 82.2%, Japan 79.2%, OECD total 50.7%; lowest Belgium 13.9%, Austria 16.4%, Germany 16.5%, Greece 24.2%, Czechia 25.3%, the US 29.7%. DSL still accounts for 58.6% in Germany (74.1% in Greece), the US relies mostly on cable (53.6%), and fixed wireless access is 37.7% in Czechia. Spain’s fibre share was only 0.3% in 2009 and 73.1% in 2020.',
    },
    unit: '%',
    file: 'oecd/fixed-tech/{item}.json',
    dimension: {
      label: { zh: '技術', en: 'Technology' },
      options: [
        { id: 'fibre', label: { zh: '光纖', en: 'Fibre' } },
        { id: 'cable', label: { zh: 'Cable（有線電視網路）', en: 'Cable' } },
        { id: 'dsl', label: { zh: 'DSL（電話線）', en: 'DSL' } },
        { id: 'fwa', label: { zh: '固定無線接取', en: 'Fixed wireless access' } },
        { id: 'satellite', label: { zh: '衛星', en: 'Satellite' } },
      ],
      defaultOption: 'fibre',
    },
    layer: {
      kind: 'choropleth',
      scale: sequential([10, 20, 40, 60, 80, 90]),
      itemScales: { fwa: sequential([1, 2, 5, 10, 20, 30]), satellite: sequential([0.1, 0.25, 0.5, 1, 2, 5]) },
    },
    format: (v) => fixed(v, 1) + '%',
    formatTick: (v) => v + '%',
    missing: MISSING_OECD,
  },
  {
    id: 'fiveg',
    label: { zh: '5G 用戶（每百人）', en: '5G subscriptions per 100 people' },
    description: {
      zh: '每百人有幾個 5G 行動寬頻用戶（OECD 寬頻資料庫，每年年底；一人可以有好幾個門號，所以會超過 100）。這是真的辦了 5G 的人，跟「網路普及」主題的 5G 人口涵蓋率（訊號蓋到幾成人口）不同。2025 年：丹麥 125.8、美國 103.7、日本 102.4、瑞典 81.1、南韓 76.3、匈牙利 73.5、德國 68.9、法國 47.7；墨西哥 15.1、澳洲 12.2（2024）。OECD 合計 7.59 億戶，美國 3.55 億、日本 1.26 億。只有 30 國有值。',
      en: '5G mobile broadband subscriptions per 100 people (OECD broadband database, end of each year; one person can have several subscriptions, so the figure can exceed 100). This counts people who actually subscribe to 5G, unlike 5G population coverage in the Internet access topic (how much of the population the signal reaches). 2025: Denmark 125.8, the US 103.7, Japan 102.4, Sweden 81.1, South Korea 76.3, Hungary 73.5, Germany 68.9, France 47.7; Mexico 15.1, Australia 12.2 (2024). The OECD total is 759 million, including 355 million in the US and 126 million in Japan. Only 30 countries have data.',
    },
    unit: { zh: '每百人', en: 'per 100 people' },
    file: 'oecd/5g.json',
    layer: { kind: 'choropleth', scale: sequential([10, 25, 40, 55, 70, 100]) },
    format: (v) => fixed(v, 1),
    formatTick: (v) => fixed(v, 0),
    missing: MISSING_OECD,
  },
  {
    id: 'mobile-data',
    label: { zh: '每個行動寬頻用戶每月用掉幾 GB', en: 'Mobile data per subscription per month' },
    description: {
      zh: '每個行動寬頻用戶平均每月用掉的數據量（OECD 寬頻資料庫，年底；OECD 的英文單位代碼寫 gigabits，法文說明寫 gigaoctets，OECD 的發布都寫 GB，這裡用 GB）。2025 年：拉脫維亞 66.3 GB、立陶宛 54.0、芬蘭 48.8、愛沙尼亞 41.3、奧地利 39.8、丹麥 33.7；美國 19.9、南韓 19.7、法國 18.9、日本 12.5、德國 12.0、英國 12.3，OECD 平均 17.0；最低巴西 4.4、墨西哥 6.0。',
      en: 'Average mobile data used per mobile broadband subscription per month (OECD broadband database, end of year; the OECD’s English unit code says gigabits and the French description says gigaoctets, and OECD releases quote GB, so GB is used here). 2025: Latvia 66.3 GB, Lithuania 54.0, Finland 48.8, Estonia 41.3, Austria 39.8, Denmark 33.7; the US 19.9, South Korea 19.7, France 18.9, Japan 12.5, Germany 12.0, the UK 12.3, OECD average 17.0; lowest Brazil 4.4 and Mexico 6.0.',
    },
    unit: 'GB',
    file: 'oecd/mobile-data.json',
    layer: { kind: 'choropleth', scale: sequential([5, 10, 15, 20, 30, 45]) },
    format: (v) => fixed(v, 1) + ' GB',
    formatTick: (v) => fixed(v, 0),
    missing: MISSING_OECD,
  },
  {
    id: 'gigabit-plans',
    label: { zh: '1 Gbps 以上的固網方案占比', en: 'Fixed broadband plans of 1 Gbps or more' },
    description: {
      zh: '業者宣傳的固網寬頻方案裡，下載速率 1 Gbps 以上的方案占幾成（OECD 寬頻資料庫，是方案數不是用戶數）。2025 年：以色列 75.0%、法國 71.0%、日本 60.6%、冰島 54.9%、斯洛維尼亞 50.4%；美國 30.0%、南韓 16.3%、德國 7.6%，OECD 23.1%；奧地利、希臘、土耳其、哥斯大黎加是 0。',
      en: 'Share of advertised fixed broadband plans with download speeds of 1 Gbps or more (OECD broadband database; counts plans, not subscribers). 2025: Israel 75.0%, France 71.0%, Japan 60.6%, Iceland 54.9%, Slovenia 50.4%; the US 30.0%, South Korea 16.3%, Germany 7.6%, OECD 23.1%; Austria, Greece, Türkiye and Costa Rica 0.',
    },
    unit: '%',
    file: 'oecd/gigabit-plans.json',
    layer: { kind: 'choropleth', scale: sequential([1, 5, 10, 20, 40, 60]) },
    format: (v) => fixed(v, 1) + '%',
    formatTick: (v) => v + '%',
    missing: MISSING_OECD,
  },
  {
    id: 'telecom-per-capita',
    label: { zh: '電信業的投資與營收（每人）', en: 'Telecom investment and revenue per person' },
    description: {
      zh: '電信業者一年的投資或營收除以人口（OECD 寬頻資料庫的百萬美元 PPP，人口用聯合國 WPP 2024），各國最新在 2022–2025 年。投資：瑞士 341 美元、比利時 325、澳洲 302（2024）、德國 256、美國 236（2023）、法國 228、英國 199（2024）、南韓 143、日本 113（2024）；巴西 30、墨西哥 36。營收：美國 1,905 美元（2023）、瑞士 1,841、南韓 1,761（2024）、日本 1,389（2024）、德國 773；巴西 187。OECD 合計 2023 年投資 5,295 億、營收 3.06 兆美元 PPP（2024 年以後還有國家沒報，OECD 的合計偏低）。',
      en: 'Annual telecom operator investment or revenue divided by population (OECD broadband database in million US dollars PPP; population from UN WPP 2024); each country’s latest year is 2022–2025. Investment: Switzerland $341, Belgium 325, Australia 302 (2024), Germany 256, the US 236 (2023), France 228, the UK 199 (2024), South Korea 143, Japan 113 (2024); Brazil 30, Mexico 36. Revenue: the US $1,905 (2023), Switzerland 1,841, South Korea 1,761 (2024), Japan 1,389 (2024), Germany 773; Brazil 187. OECD totals in 2023: investment $529.5 billion and revenue $3.06 trillion PPP (some countries have not yet reported for 2024 onwards, so later OECD totals are too low).',
    },
    unit: { zh: '美元（PPP）', en: 'USD (PPP)' },
    file: 'oecd/telecom/{item}.json',
    dimension: {
      label: { zh: '項目', en: 'Measure' },
      options: [
        { id: 'investment', label: { zh: '投資', en: 'Investment' } },
        { id: 'revenue', label: { zh: '營收', en: 'Revenue' } },
      ],
      defaultOption: 'investment',
    },
    layer: {
      kind: 'choropleth',
      scale: sequential([50, 100, 150, 200, 250, 300]),
      itemScales: { revenue: sequential([300, 500, 700, 900, 1200, 1500]) },
    },
    format: (v) => tr({ zh: `${fixed(v, 0)} 美元`, en: `$${fixed(v, 0)}` }),
    formatTick: (v) => fixed(v, 0),
    missing: MISSING_OECD,
  },
];

export const internetSpeed: TopicDefinition = withParts({
  id: 'internet-speed',
  title: { zh: '網路速度', en: 'Internet speed' },
  shortTitle: { zh: '網速', en: 'Net speed' },
  defaultIndicator: 'download',
  defaultYear: 2026,
  // 頁尾的來源與說明要短：完整的引用在 manifest.json 與 DESIGN.md 第 8 節第 79 點
  sources: [
    {
      name: { zh: 'OECD Broadband and telecom databases（光纖、5G、數據量、電信投資與營收、1 Gbps 方案）', en: 'OECD Broadband and telecom databases (fibre, 5G, data usage, telecom investment and revenue, 1 Gbps plans)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_BB_DATABASE%40DF_BB_TEL_DATABASE&df[ag]=OECD.STI.DEP',
      license: { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' },
    },
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
  // 2026-11-07 起包一層：選 OECD 寬頻資料庫的指標時先畫固網技術的折線
  panelExtra: () => import('./panels/BroadbandPanel'),
  indicators,
}, metroSpeedPart);
