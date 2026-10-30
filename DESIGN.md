# 世界資料地圖：設計文件

用世界地圖呈現「跟國家有關的資料」，主題會陸續加入。這份文件記錄技術選型、架構，以及新增主題的方法。

## 1. 技術選型

| 層面 | 工具 | 為什麼 |
|---|---|---|
| 地圖繪製 | **MapLibre GL JS 5**（WebGL 向量地圖） | 可以一路放大到街道（zoom 18）；地球儀與平面可切換；資料圖層插在底圖文字下面，地名永遠看得到 |
| 底圖 | **OpenFreeMap** 的 5 種樣式（免費、不需金鑰），使用者可切換 | 預設 Liberty：低縮放是 Natural Earth II 彩色地形，放大後是 OpenStreetMap 細節；地名跟著介面語言，中文用 `name:zh-Hant`、英文用 `name:en` |
| 投影 | **地球儀**（預設），可切換成平面（Web Mercator）；3D 模式固定用平面（海拔主題的立體地形除外） | 地球儀沒有高緯度放大的問題；平面方便一次看全世界；3D 的原因見第 5 節 |
| 國界 | **Natural Earth 1:50m**（world-atlas 套件） | 給資料上色、點選、框選用；全球視角畫 1:110m（原本沒有的新加坡、巴林等 63 個小國從 1:50m 補進去，第 13 節），放大才換 1:50m；pipeline 判斷一個點在哪一國另外用 1:10m（第 8 節第 85 點） |
| 側欄圖表 | **自己畫的 SVG**（`src/charts/Chart.tsx`，2026-10-29 起） | 點國家時才載入（gzip 後約 4 KB）；2026-10-29 以前是 ECharts 6（約 187 KB gzip，第 5 節「側欄的圖表」） |
| 色彩與比例尺 | d3-scale | 分級門檻固定寫在主題設定裡 |
| 前端 | Vite + TypeScript，程式照 React 寫，執行時是 **Preact**（`preact/compat`，2026-10-30 起） | 首頁的程式 gzip 後從 141 KB 降到 76 KB（react-dom 約 200 KB 未壓縮）；寫法、型別（`@types/react`）不變，見第 13 節 |
| 介面語言 | 繁體中文（預設）與英文，自己寫的小字典（`src/i18n/`），見第 12 節 | 字串不多，不需要 i18next 之類的套件；型別檢查保證兩種語言的鍵一致 |
| 離線與快取 | **Service worker**（vite-plugin-pwa 的 injectManifest + Workbox 模組，`src/sw.ts`） | 第二次開啟直接從快取載入；看過一次就能離線開啟；可以安裝成 App（見第 13 節） |
| 資料處理 | Python（`pipeline/`），離線執行 | 前端只讀靜態 JSON，不需要後端 |
| 部署 | GitHub Pages（GitHub Actions 自動建置） | 建置用絕對路徑 `base: '/map/'`（每個主題的網址 t/<主題>/，第 13 節） |

**為什麼是 MapLibre 5 而不是 6**：
- MapLibre 6 把 web worker 拆成獨立的 ES module 檔，經過 Vite 打包後 worker 找不到，底圖整個出不來。
- 5.x 把 worker 內嵌在主程式裡，可以直接使用。
- 升級前要先解決 worker 的載入路徑。

**之後可以升級**：省/州/城市層級或大量點資料可以再加 deck.gl。

**一開始用 D3 + Equal Earth**：2026-10-22 改成 MapLibre，因為使用者要能放大到更細，也想要類似 Google 地圖的彩色地球儀。

## 2. 架構

```
原始資料（UN、IMF、World Bank、Eurostat、OECD、Ember、FAOSTAT、Harvard Atlas、主計總處、JRC GHSL、OpenStreetMap（含連鎖品牌與便利商店）、各連鎖品牌公布的店數、Epoch AI、Anthropic、Microsoft、Our World in Data、CEPII BACI、USGS GMTED2010、GMBA 山脈名錄（EarthEnv）、Wikidata、Wikimedia Commons（國旗的 SVG）、Unicode CLDR、Glottolog、UNHCR、Pew、WID、ILO、Penn World Table、CRU TS、WHO、WashU ACAG、FAO AQUASTAT／FRA、IEA、環境部、水利署、林保署、公路局、、USGS 地震目錄、NOAA NCEI、Smithsonian GVP、V-Dem、Nobel Prize API、外交部、領事事務局、國發會、警政署、法務部、BJS（美國司法統計局）、加拿大統計局、澳洲統計局（ABS）、日本法務省、國健署、World Happiness Report、Passport Index、UCDP、Erik Voeten（聯合國大會投票）、各國際組織官網、TeleGeography、USGS Mineral Commodity Summaries、World Bank/IMF QEDS、WFE（世界銀行轉載）、金管會證期局、財政部貿易統計、交通部統計查詢網、IANA tz、NOAA Solar Calculator 的公式（晝夜與季節）、NOAA IBTrACS、中央氣象署颱風資料庫、Global Energy Monitor、能源署、Global Solar Atlas、Global Wind Atlas、GWIS、UNESCO DataHub、GCAT、EOG VIIRS 夜間燈光（Zenodo 轉存）、Natural Earth 第一級行政區、Natural Earth populated places、BIS 住宅價格、內政部不動產資訊平台、GHSL Urban Centre Database、內政部戶政司、OECD PISA、臺灣 PISA 國家研究中心、UN World Marriage Data、UNdata（Demographic Yearbook、逐月出生數）、OECD Family Database、WHO/UNICEF WUENIC、Our World in Data 的 COVID-19 資料、JHU CSSE、The Economist 超額死亡模型、疾管署、NCD-RisC（身高）、OECD Corporate Tax Statistics、OECD Tax Database、OECD Taxing Wages、OECD Consumption Tax Trends、財政部財政資訊中心、賦稅署、World Bank WGI、OECD DAC（DAC1、DAC2A）、AidData（中國的海外貸款）、UNCTAD Data Hub、NGA World Port Index、World Bank/IMF Global Shipping Traffic Density、各港口公布的貨櫃吞吐量、臺灣港務公司、Marine Regions（VLIZ，專屬經濟海域與 IHO 海域）、WWF HydroSHEDS（HydroRIVERS）、Global Dam Watch（figshare）、NASA 日食網站（Fred Espenak 的五千年日食目錄與貝塞爾根數、五千年月食目錄）、FAO FishStat、漁業署、EDGAR（JRC）、CEDS（PNNL）、Speedtest by Ookla（AWS Open Data）、數位發展部的 5G 量測、GitHub Innovation Graph、維基百科…）
   │  pipeline/run.py  下載到 pipeline/.cache/，清理、對齊 ISO 代碼
   ▼
public/data/                              ← 靜態 JSON，會進版本控制
   ├─ geo/countries-50m.json              國界（TopoJSON，id 已換成 ISO alpha-3）
   ├─ geo/countries-110m.json             粗略國界，全球視角用（補上 1:50m 才有的小國，見第 13 節）
   ├─ countries.json                      ISO 對照表（alpha-3 → alpha-2、英文名）
   ├─ regions.json                        洲別（排名表的篩選，Natural Earth 的 CONTINENT）
   └─ topics/<主題>/
        ├─ <指標>.json                    每個指標一個檔，含所有年份
        ├─ <指標>/<子項目>.json           有子項目的指標（例如 production/rice.json）
        ├─ countries/<ISO3>.json          側欄額外區塊用的單一國家明細
        ├─ grid.json                      框選用的網格人口（只有人口主題）
        ├─ profiles.json                  各國的高度分布與最高、最低點（海拔主題）；國家小檔案主題的小檔案（同名、不同內容）
        ├─ flags.json、svg/<地區>-<雜湊>.svg  國旗主題的國旗檔與國旗圖檔（檔名含內容的雜湊，svg/CREDITS.txt 是每個檔的出處與授權）
        ├─ flows/<子項目>/<年>.json       流向圖的雙邊資料（貿易、移民主題，一個子項目、一年一個檔）
        ├─ <疊加圖層>.json                 一般的點、線疊加圖層（地震、火山、板塊邊界、駐外館處、颱風路徑、發電廠、專屬經濟海域的界線、日食路徑、翻到對蹠點的陸地；common.points_file()、lines_file()）
        ├─ seas.json                      地球的另一邊：前端查海名的 0.25° 網格（逐列的連續長度編碼）
        ├─ detail/<分區>.json             線疊加圖層放大後才依畫面下載的分區（河流的小河，10° 一格）
        └─ manifest.json

public/tiles/population-density/          ← 人口密度的 1 km 網格圖磚，不進版本控制，部署時才產生（第 14 節）
   ├─ meta.json                           版本、各期、分級門檻與顏色、哪些圖磚有內容
   └─ <版本>/<年>/<z>/<x>/<y>.png          12 期 × 約 5 千張，共約 585 MB
public/tiles/warming/                     ← 暖化的 0.5° 網格圖磚，同樣部署時才產生（第 14 節）
   └─ <版本>/<年>/<z>/<x>/<y>.png          116 期 × 206 張，共約 20 MB
public/tiles/renewables-solar/、renewables-wind/ ← 太陽能、風能潛力的約 2 km 網格圖磚，同樣部署時才產生（第 14 節）
   └─ <版本>/<期>/<z>/<x>/<y>.png          各一期：428 張 2.3 MB、718 張 6.8 MB
public/tiles/night-lights/                ← 夜間燈光的約 500 m 網格圖磚，同樣部署時才產生（第 14 節）
   └─ <版本>/<年>/<z>/<x>/<y>.png          4 期 × 5,197 張，共 106 MB
public/tiles/ship-density/                ← 航運密度的約 5 km 網格圖磚，同樣部署時才產生（第 14 節）
   └─ <版本>/2021/<z>/<x>/<y>.png          一期，234 張、4.4 MB
public/tiles/internet-speed-fixed/、internet-speed-mobile/ ← 網路速度的約 2 km 網格圖磚，同樣部署時才產生（第 14 節）
   └─ <版本>/2026/<z>/<x>/<y>.png          各一期：425 張 1.9 MB、380 張 1.2 MB
   │
   ▼  fetch
src/
   ├─ topics/          每個主題一個設定檔（TopicDefinition）  ← 新增主題主要改這裡
   │   └─ panels/      主題自訂的側欄區塊（動態載入）
   ├─ app/             App.tsx 用的 hook 與元件（2026-10-29 從 App.tsx 拆出來）：hooks.ts（主題下載、現在時刻、國界幾何、
   │                   國旗、框選估算）、overlays.ts（疊加圖層的資料）、options.ts（年份、子項目選單）、TopBar.tsx、Footer.tsx
   ├─ map/             MapLibre 地圖引擎（WorldMap.tsx，自己一個 chunk）：資料圖層、圖例、tooltip、框選、疊加圖層、匯出圖片、
   │                   地形圖層（terrain.ts）；WorldMap.tsx 的常數與圖層定義在 worldMapLayers.ts、滑鼠與觸控在 mapEvents.ts、
   │                   國家的上色在 useCountryFills.ts、網格／國旗等點陣圖層在 useRasterLayers.ts、tooltip 在 MapTooltip.tsx；
   │                   底圖樣式的下載與改寫在 style.ts（不含 MapLibre，首頁一啟動就先抓）
   ├─ charts/          SVG 圖表（Chart.tsx、spec.ts）、折線／堆疊面積的描述、長條清單
   ├─ analysis/        分析檢視（變化、篩選、並排、對照；平面的 SVG 世界地圖，自己一個 chunk，見第 11 節）
   ├─ panels/          國家側欄、排名表、框選結果
   ├─ controls/        主題分類選單、時間軸、分享選單、國家搜尋、快捷鍵與說明（見第 11 節）
   ├─ theme/           顏色 token（唯一來源）、深淺色切換
   ├─ i18n/            介面語言：字典（zh.ts、en.ts）、useT()、語言狀態與 Text 解析（lang.ts），見第 12 節
   ├─ lib/             資料讀取（含指標檔還原）、國名、國家搜尋比對、網址狀態、數字格式、CSV 與下載、
   │                   介面文字（strings.ts）、連線狀態、service worker 註冊
   └─ sw.ts            service worker（快取策略見第 13 節）

pipeline/
   ├─ run.py           入口：npm run data -- <步驟>
   ├─ common.py        下載快取、輸出 JSON、指標檔格式（含數值壓縮）
   ├─ compact.py       把還沒壓縮的舊指標檔改成差分編碼（npm run data -- compact）
   ├─ build_geo.py     國界與 ISO 對照表
   ├─ geoindex.py      經緯度 → 國家（Natural Earth 1:10m 的國界，代碼跟上面的一樣；見第 8 節第 85 點）
   ├─ sources/         各資料來源的下載與解析（worldbank、imf、faostat、atlas、dgbas、ghsl、epoch、osm…）
   └─ topics/          每個主題一支組裝腳本
```

**所有資料一律用 ISO 3166-1 alpha-3 對應**（`TWN`、`JPN`…）。各來源的代碼在 `pipeline/sources/countries.py` 統一轉換。

畫面狀態都放在網址裡，例如 `?topic=agriculture&ind=self-sufficiency&item=wheat&year=2022&country=TWN`，任何畫面都能直接分享，框選範圍也會記在 `bbox=` 參數，3D 模式是 `3d=1`，地圖上標數值是 `vals=1`，分析檢視是 `view=analysis`（設定見第 11 節「分析檢視」），英文版另有 `lang=en`。

**分享選單**（控制列右邊的「分享」，`src/controls/ShareMenu.tsx`）：
- **下載地圖圖片（PNG）**：只有地圖檢視有。內容是目前的地圖畫面，上面加標題（主題 · 指標 · 年份）與指標說明，左下角是圖例（跟畫面上一樣，含開著的疊加圖層），下面是資料來源、底圖版權（OpenFreeMap © OpenMapTiles © OpenStreetMap contributors）、國界來源與這個畫面的網址。做法見第 10 節。
- **下載 CSV**：目前的指標，可選「選定的年份」或「所有年份」，排名表檢視也有（`src/lib/csv.ts`）。
  - 欄位：ISO3、國名、英文名、單位，接著每年一欄；推估年份的欄名加「（推估）」，有附註的指標最後多一欄「附註」，世界合計放在最後一列。
  - 欄名跟著介面語言：英文版是 ISO3、Country、Unit、年份（推估年份加「(projection)」）、Note（用 `notesEn`），國名只有英文一欄。
  - 單一年份依數值由大到小排（跟排名表一樣），所有年份依國名排。
  - 數值是原始數字（不加千分位、不換算成萬、億），試算表可以直接計算。
  - 開頭有 UTF-8 BOM、換行用 CRLF，Excel 直接開啟中文不會變亂碼。
- **複製連結**：複製網址，按鈕下方顯示「已複製連結」。手機（觸控為主的裝置）而且瀏覽器支援 `navigator.share` 時改成「分享連結…」，打開系統的分享面板；分享失敗時改用複製。
- 純地圖頁沒有 CSV。選單可以用鍵盤操作：↑↓ 移動、Home/End、Esc 關閉並回到按鈕。

## 3. 資料格式

每個指標一個 JSON 檔（由 `pipeline/common.py` 的 `indicator_file()` 產生）：

```json
{
  "indicator": "total",
  "unit": "人",
  "years": [1950, 1951, "…", 2100],
  "projectionFrom": 2024,
  "aggregates": { "WLD": [2493092848, "…"] },
  "values": {
    "TWN": [7596530, "…"],
    "JPN": [86443277, "…"]
  },
  "notes": { "TWN": "…" }
}
```

- `values` 的陣列與 `years` 一一對應，缺值為 `null`。
- `projectionFrom`（選填）：從這一年開始是推估值，時間軸與折線圖會標示成虛線。
- `methodBreak`（選填）：從這一年起換了統計方法，跟之前的年份不完全可比。側欄折線圖在那一年畫一條垂直虛線，圖下加一行說明（例如飲食主題，FAO 糧食平衡表 2010 年起的新方法）。
- `estimatesBefore`（選填，2026-10-28 加）：這一年以前的值多半是估計或內插（Gapminder 1800 年起的長期資料，1950 年以前）。時間軸在那之前的年份標「估計值」（沒有 `projectionFrom` 時才標），側欄折線圖在那一年畫一條垂直虛線、tooltip 的年份後面寫「估計值」，圖下加一行說明（第 8 節第 98 點）。
- `aggregates`（選填）：世界合計，用來算「占全球比例」和畫對照線。
- `notes`（選填）：個別國家的附註，例如改用其他來源補上，會顯示在側欄。
- `notesEn`（選填）：`notes` 的英文版，英文介面用；沒有的話英文介面不顯示附註。
- `noValue`、`noValueEn`（選填，2026-10-28 起）：沒有值的國家為什麼沒有值（「數字不可靠（2019、2023 年）」），取代 tooltip 與側欄的「無資料」（第 4 節）。
- `hints`、`hintsEn`（選填，2026-10-26 起）：tooltip 第三行的短註（細線隔開，`.tt-hint`），滑過地圖就該看到、不必點開側欄的一句話。便利商店與連鎖品牌用它寫 OpenStreetMap 的涵蓋率（「公司公布 7,334 家，OSM 涵蓋率 85%」，低於一半時寫「明顯偏低」）；完整的說明仍放 `notes`。網格模式不顯示。
- `latestWithin`（選填）：普查、調查年份零散的指標（例如住宅主題）。某年沒有資料的國家，改用它 `latestWithin` 年內最近一年的值：
  - 地圖、3D、排名表、側欄數值卡片、單一年份的 CSV 都用 `panels/stats.ts` 的 `latestAt()` 取值，所以結果一致。
  - 實際的資料年份要標出來：tooltip 寫「2023 年的資料」；有國家用之前的年份時，排名表多一欄「資料年份」（寫在數值旁會擠短那一列的長條），表格下方說明規則；側欄卡片寫（2023 年）；CSV 多一欄「資料年份」。
  - `values` 只放實際有的年份，補上的值不會出現在歷年折線圖與「所有年份」的 CSV。折線圖畫出每個資料點，缺值的年份直接連過去（`timeSeriesOption` 的 `sparse`）。
- `years` 不一定連續（例如移民每 5 年一筆、森林只有 FRA 的 1990、2000、2010、2015、2020、2025）。側欄折線圖的 x 軸是類別軸，`timeSeriesOption` 先把年份補成連續的、缺的填 null 再連起來（`consecutiveYears`），10 年的間隔才不會畫得跟 5 年一樣寬。
  - 年份範圍用 `common.latest_year_span()`：依「`latestWithin` 年內有資料的國家數」截頭尾，不是依當年實際有資料的國家數。

**實際存檔時數值會壓縮**（`"encoding": "delta"`，`common.compact_indicator()`）：

```json
{ "indicator": "total", "years": [1950, 1951, 1952, "…"], "encoding": "delta",
  "values": { "TWN": [3, 7597, 266, 286, "…"] } }
```

- 每個序列的第一個數是十進位指數 e，之後是跟前一個非 null 值的差（整數），值 = 累加 × 10^e，`null` 不影響累加。
- 上面的台灣：e = 3，所以是 7,597,000、7,863,000、8,149,000……（原始值 7,596,530、7,862,796、8,148,990）
- 逐年變化通常很小，差分後 gzip 壓得很好：
  - 全部 145 個指標檔 gzip 後從 2.49 MB 變 1.98 MB。
  - 首頁的總人口從 137 KB 變 55 KB。
- 精度：序列最大值保留 5 位有效數字，每個非 0 的值至少保留 4 位（畫面上最多顯示 4 位，例如「2,332 萬」），也不會比原本的小數位數更細。
  - 驗證過全部 122 萬個值：89% 跟原值完全相同，最大相對誤差 0.05%。
  - 只有 6 位數以上、畫面上顯示到個位數的值（例如人均 GDP 超過 10 萬）最後一位會變成 0。
- 前端的 `fetchJson()`（`src/lib/data.ts`）讀取時就還原，主題設定、側欄、排名表看到的都是上面那種一般格式。沒有 `encoding` 的舊檔照樣能讀。
- 各主題用 `indicator_file()` 輸出時會自動壓縮；別的分支產生的舊檔可以用 `npm run data -- compact` 一次轉換（已經壓縮過的會跳過）。

**為什麼不改成每年一個檔**：地圖第一個畫面只需要當年的值，但比例圓的大小要用所有年份的最大值，時間軸也要知道有哪些年份；而同一個國家相鄰年份的值很接近，整條序列放在一起差分最省。現在一個指標一個檔、gzip 後大多只有幾十 KB，再拆開反而多出很多請求。

## 4. 新增一個主題

1. **資料**：在 `pipeline/topics/` 新增 `<主題>.py`，實作 `build()`，資料來源寫在 `pipeline/sources/`，用 `common.indicator_file()` 輸出；然後在 `pipeline/run.py` 的 `STEPS` 註冊。
2. **設定**：在 `src/topics/` 新增 `<主題>.ts`，匯出一個 `TopicDefinition`（指標、圖層類型、分級門檻、格式化函式、資料來源），然後在 `src/topics/registry.ts` 的 `TOPIC_GROUP_SPECS` 裡最接近的一類加上主題的 id（頂列的分類選單，見 §11），`TOPIC_MODULES` 加一行 `<id>: () => import('./<主題>')`，再跑 `npm run catalog` 更新主題目錄（`npm run dev`、`npm run build` 也會先跑）。
   - **每個主題的定義各自一個 chunk**（2026-10-28 改）：原本 `index.ts` 直接 import 全部主題，所有主題的說明、附註、資料來源（約 220 KB，gzip 後）都在首頁的程式裡，畫面上卻一次只用一個。現在首頁只有人口（預設主題）與純地圖，其他主題換過去才下載（一個 2–15 KB）。
   - 頂列選單、主題總覽、主題搜尋只要名稱：`scripts/topic-catalog.mjs` 用 Vite 的 SSR 載入每個主題，產生 `src/topics/catalog.gen.ts`（主題名稱、指標名稱、搜尋用的子項目，gzip 後約 18 KB，`catalog.ts` 的 `summarize`、`searchItems`）。這個檔要跟著主題定義提交（`npm run catalog -- --check` 只比對）。
   - `app/hooks.ts` 的 `useTopicReady`：網址換到還沒下載的主題時（選單、搜尋、上一頁），先照舊顯示目前的主題，下載完才換過去；選單、主題總覽滑到某個主題時就先下載（`prefetchTopic`）。第一個畫面在 `main.tsx` 等網址的主題下載完才畫；`vite.config.ts` 的 `preloadTopicChunk` 在首頁 HTML 加一小段程式，依網址的 `topic` 預載那個 chunk，跟首頁程式同時下載。
3. 執行 `npm run data -- <主題>` 產生資料，`npm run dev` 檢查。
4. **圖示**：在 `scripts/topic-icons.mjs` 的 `TOPIC_ICONS` 加一行（Lucide 的圖示名稱，查 https://lucide.dev/icons/ ，不要跟其他主題、分類重複），跑 `npm run icons` 產生 `src/topics/icons.gen.ts`（主題選單、主題總覽的圖示，§11）。沒有圖示時 `npm run icons -- --check`（CI 的「檢查」也跑）會報錯。
5. **縮圖**：開著開發伺服器跑 `node scripts/topic-thumbs.mjs http://localhost:5173/ <主題 id>`，產生主題總覽用的 `public/thumbs/<主題>.webp` 與 `public/thumbs/s/<主題>.webp`（§11）。沒有縮圖時總覽的卡片是一塊海的藍色。
6. **分享預覽圖**：有縮圖之後跑 `OG_FONT_DIR=<@fontsource/noto-sans-tc 的資料夾> node scripts/og-topics.mjs <主題 id>`，產生 `public/og/<主題>.jpg`（主題網址 `t/<主題>/` 的 og:image，§13）。沒有的話用網站首頁的預覽圖。

年份不必連續（例如移民存量 1990、1995…2020、2024）：時間軸拖到中間沒有資料的年份時顯示最接近的一年，播放與 ←→ 都跳到下一個有資料的年份。

世界銀行等來源的最新一年常常只有少數國家先公布，地圖會幾乎全灰。用 `common.year_span()` 截掉頭尾涵蓋國家太少的年份，每個指標的時間軸範圍可以不同。普查這類隔好幾年才一次的資料，改在指標檔加 `latestWithin`，用 `common.latest_year_span()` 決定範圍（第 3 節）。

`TopicDefinition` 的選填擴充點（`pure: true` 是純地圖頁：不載入統計資料，沒有指標、時間軸、資料側欄與排名表）：

| 欄位 | 用途 | 例子 |
|---|---|---|
| `dimension` | 子項目選擇器；指標的 `file` 含 `{item}` 時才會出現 | 農業的農產品、工業的出口產業 |
| `panelExtra` | 側欄額外區塊，用 `() => import(...)` 動態載入；props 有目前的指標 `indicator`（年份的意思可能跟著指標的 `timeAxis` 變）；`highlightLine(圖層, 組別)` 在地圖上標出線圖層的一組線、`focusBox(範圍)` 移動地圖（2026-10-28 起）；`selectYear(年)` 把時間軸換到那一年（2026-10-28 起，`timeless` 的主題沒有）；`setMarks(標記)` 在地圖上放幾個圓點加名稱（`MapMark`，2026-10-28 起），`link` 連到另一個標記：點一下移過去，選取的國家不變。標出的線與標記 App 記下是哪個主題、哪個國家的（`panelKey`），換國家、換主題就不畫，不用 effect 清掉：子元件的 effect 先跑，側欄一打開就標出的會被父元件換國家的 effect 清掉 | 發電結構、GDP 與就業結構、主要農產品；河流與流域（滑到河名標出整個水系，點一下移過去）；日食路徑（點一次日食：換到那一年、標出路徑、移過去）；地球的另一邊（一打開就標出這一國翻過去的形狀，首都與它的對蹠點兩個標記） |
| `boxEstimate` | 地圖框選，加總框內的網格人口估算總量（要有網格檔，見第 6 節） | 人口 |
| `note` | 頁尾的資料說明 | |
| `overlays` | 疊加在地圖上的點、線圖層，左下角可以開關：鐵路、機場有自己的格式（2026-10-29 起也可以寫 `indicators`，只在這些指標畫：交通的地鐵指標不畫機場，`app/overlays.ts` 的 `useOverlays`）；一般的點（`kind: 'points'`）與線（`kind: 'lines'`）的大小、顏色、tooltip 寫在主題裡 | 交通（鐵路、機場；地鐵站依開通年份累積出現，只在地鐵的兩個指標）；地震與火山（地震、火山、板塊邊界）；台灣的外交（駐外館處）；海底電纜（電纜路線與登陸點）；颱風與颶風（依強度分段上色的路徑）；發電廠地圖（依狀態分成四個圖層）；城市（每 5 年一期的人口跟著時間軸換、縮小時只畫大城市）；海洋與漁業（專屬經濟海域的界線，依 Marine Regions 的界線性質分 5 類、未解決的畫虛線，滑過看兩邊與性質）；河流與流域（HydroRIVERS 的河道依流進的大洋上色、線寬依流量，滑過標出整個水系，放大後依畫面下載分區）；海拔（GMBA 的山脈範圍，`fill.hover` 讓面本身也滑得到，2026-10-29） |
| 指標的 `overlayTime` | 有年份欄位的疊加點（或線）怎麼跟時間軸：`'year'` 只有那一年（預設）、`'cumulative'` 累積到那一年、數字 n 是那一年起的 n 年 | 地震（當年／累積／每十年）；海底電纜（依啟用年份累積）；颱風（當年／每十年） |
| 指標的 `projectionLabel` | 資料檔有 `projectionFrom` 時，時間軸預設把之前的年份標「估計值」、之後標「推估值」；之前是實際數字、之後也不是推估時，換掉之後的稱呼（`tag`）與刻度上的說明（`from(年)`），之前的年份不加標籤 | 海底電纜（明年起「含規劃中」） |
| 指標的 `grid` | 地圖可以從國家平均切到點陣網格（`GridSpec`：`dir` 是 `tiles/` 底下的資料夾；切換鈕名稱 `label`、網格模式的說明 `subtitle`、圖例上每一期的說明 `epochNote(期, 是否推估)`、不上色的格子 `empty` 都可以覆寫，沒寫的用人口密度的文字，見第 14 節），控制列多一個切換。`defaultOn: true` 時預設就是網格（網址沒有 `grid` 參數、從主題選單換過來時；切回國家平均寫 `grid=0`）。`meta.json` 有 `backdrop` 時，網格底下在資料範圍鋪一層第一級的顏色（夜色底）。`only: true`（2026-10-26 起）是只有網格、沒有國家平均可以切換：一律畫網格，控制列沒有切換鈕，tooltip 不寫「國家平均」，指標本身是 `kind: 'none'`、資料檔只給 tooltip 與排名表；`unit` 是網格圖例的單位（沒寫用指標的）。`dir` 可以含 `{item}`（2026-10-27 起）：跟著子項目換資料夾，`forItem()` 跟 `itemScales` 一起解析，App 與第一個畫面的預先下載共用。`countryValue`（2026-10-27 起）換掉切換鈕與 tooltip 的「國家平均」（國家的值是中位數時） | 人口密度的 1 km 網格、暖化的 0.5° 網格、太陽光電與風能潛力的約 2 km 網格、夜間燈光的約 500 m 網格（預設打開、有夜色底）、航運密度的約 5 km 網格（`only`，tooltip 是貨櫃吞吐量）、網路速度的約 2 km 網格（`internet-speed-{item}`，固網、行動各一組；「國家中位數」） |
| `terrain` | 地形圖層（AWS Terrain Tiles）：`kind: 'terrain'` 的指標畫分層設色與陰影，面量圖上疊地形陰影（左下角可以關），3D 改成立體地形（見第 5 節「地形圖層」） | 海拔 |
| `bareMap` | **只留海的底圖**（2026-10-29 起）：今天的陸地、地名、國界在這個主題沒有意義時用。`data-fill` 下面加一層海的顏色的 background 圖層（`bare-sea`），蓋住底圖的陸地、國界、道路與世界視角的陸地；底圖的文字（向量圖磚的 symbol 圖層）隱藏，記下原本的 visibility，離開時還原。國界（`data-border`）、選取外框、國家的 hover 與點選（`data-fill`、`data-tiny` 隱藏，`featureAt` 跳過隱藏的圖層）、選取小國的圓圈、選國家時移過去都拿掉；國家用搜尋選，側欄照常。滑過的資訊由主題的 `pointer` 給 | 板塊漂移 |
| `timeless` | 資料不隨時間變化：沒有時間軸；tooltip、側欄、排名表、標題、圖片與 CSV 檔名都不寫年份，分享選單只有一個「下載 CSV」 | 海拔、太陽能與風能潛力（長期平均） |
| `clock` | **時刻主題**（2026-10-28 起）：時間不是年份，是某一刻（UTC 毫秒）。控制列下面的時間軸換成 `controls/MomentControl.tsx`（播放、一天／一年、拉桿、日期與時間、「現在」，見第 11 節「時刻主題的網址與播放」），網址是 `time=2026-06-21T0400Z`，沒有 `time` 時跟著現在走（`app/hooks.ts` 的 `useNow`，每到整分鐘更新、分頁在背景時不計時）。App 的 `year` 換成那一刻在使用者時區的日期（`ClockAt.day`，YYYYMMDD 的整數），指標的值用 `derive` 在瀏覽器裡算；標題、tooltip、排名表、側欄寫那一刻（`lib/clock.ts` 的 `formatMoment`、`formatDay`），播放時地圖左上角的大字也是。CSV 只有一個「下載 CSV」，欄名與檔名寫日期（`indicatorCsv` 的 `yearLabel`） | 晝夜與季節 |
| `live` | **即時資料**（2026-10-29 起）：`{ url, minutes, time }`，瀏覽器直接讀外部的網址（要允許跨網域讀取；`lib/live.ts` 的 `useLive`），每 `minutes` 分鐘重讀，分頁在背景時不讀、回到前景時已經過期就馬上讀。讀不到時有上一份就照舊畫、下一輪再試，沒有就跟資料檔載入失敗一樣顯示錯誤。資料交給 `derive` 的第三個參數與即時網格圖層（`kind: 'liveGrid'`）；`time(資料)` 是資料的時刻，當成時刻主題的「這一刻」（App 的 `at`：標題寫到分鐘、晝夜圖層依它畫），但不是 `clock`：沒有時間軸，也不能選別的時刻。國家側欄的數值卡片也拿到即時資料（`CountryPanel` 的 `live`） | 此刻的極光（NOAA SWPC 的 OVATION） |
| 指標的 `derive` | 數值在瀏覽器裡算（時刻主題）：`file` 是算的材料（各國首都的經緯度與時區），`derive.values(材料, ClockAt)` 回傳指標檔的格式（`years` 只有一筆）。`per` 是值跟著什麼變：`'minute'`（此刻的太陽高度，標題寫到分鐘）、`'day'`（白天長度，標題寫日期）、`'fixed'`（晝長年較差，標題不寫日期，跟 `timeless` 一樣）。App 與國家側欄都經過 `lib/derive.ts` 的 `derivedData()`：同一個指標、同一份材料、同一個時刻回傳同一個物件（每個指標留最近 4 個時刻），地圖的顏色才不會每一格重算。側欄的數值卡片裡，用同一份材料的 `derive` 指標照常各列一張（一般指標同一個檔只列一張）。2026-10-29 起 `values` 的第三個參數是主題的即時資料（`live`；其他主題是 undefined），快取跟著即時資料的物件（重讀一次就重算），還沒讀到時 `derivedData` 回傳 null | 晝夜與季節的白天長度、晝長年較差、正午太陽高度、時鐘與太陽 |
| `tooltipLines` | tooltip 在國名下面另外加幾行（`.tt-hint`，滑過時才算）：`(iso3, { indicator, at, item, source, countryName, year })`，`source` 是目前指標的資料檔（`derive` 的材料），`countryName` 是目前語言的國名（2026-10-28 起），`year` 是時間軸的年份（2026-10-29 起，各國在讀什麼：那個月讀最多的條目） | 晝夜與季節：「以首都台北計算：日出 05:05、日落 18:46（UTC+8）」「正午太陽高度 88.4°・此刻是白天」；地球的另一邊：「對蹠點落在：巴拉圭 89%、阿根廷 11%」 |
| `pointer` | **滑到地圖上任何一點（含海上）**的資訊（2026-10-28 起）：`(經緯度, { iso3, countryAt, countryName, indicator })` 回傳 `PointerInfo`：`title` 是游標在海上時 tooltip 的第一行，`lines` 接在後面（在國家上時接在國家的 tooltip 下面），`mark` 是跟著游標動的小圈（`pointer-mark` 圖層，平面地圖上看得到，地球儀上通常在背面）。`countryAt` 是 `map/geometry.ts` 的 `countryLocator()`：用地圖的 1:50m 國界在瀏覽器裡判斷任一經緯度在哪一國，不必畫在畫面上（環展開成連續的經度、點試 ±360°，先比範圍再用射線法；南極洲不在地圖的國家裡）。有 pointer 的主題海上也有 tooltip，滑到點、機場、側欄的標記時照舊；地球儀外面（太空）MapLibre 也會給一個經緯度（地球邊緣上的點），投影回畫面跟游標差 4 px 以上的不算（正式站上看到才發現的）。`indicator` 是目前的指標 id（2026-10-29 加：冰河與海平面只在海平面的指標寫游標下那一格）；`year` 是時間軸的年份（2026-10-29 加，板塊漂移：游標下是哪一國過去的位置） | 地球的另一邊：游標的對蹠點在哪一國或哪一片海與它的經緯度；氣候分區、冰河與海平面：游標下那一格的類型或速度 |
| 指標的 `lowerIsBetter` | 數值越小越好：排名表、側欄的名次、單一年份的 CSV 由小排到大，第 1 名是最小的（排名表的長條仍依數值長短） | 性別不平等指數（台灣 2023 年第 13 名，跟性平處公布的一致） |
| `focus` | 換到這個主題時（沒有選國家）地圖移到這個範圍 `[西, 南, 東, 北]`（2026-10-30 起）：跟側欄的 `focusBox` 同一條路（App 的 `moveToBox`）；`WorldMap` 的 focusBox effect 多依 `ready`，第一個畫面還沒好時就要移過去的也會移。資料集中在一個地方、預設以台灣為中心的地球儀看不到時用。主題總覽的縮圖另外在 `scripts/topic-thumbs.mjs` 的 `VIEWS` 寫中心與放大幾級 | 企鵝在哪裡（南極） |
| `places` | 地圖上沒有形狀、也不是 ISO 國家的資料單位（`PlaceDef`：`_` 開頭的 id、名稱、經緯度），跟沒有形狀的國家一樣畫小圓點與比例圓，排名表、tooltip、側欄用它的名稱 | 奧運的蘇聯、東西德、南斯拉夫等歷史隊伍；學生能力（PISA）只有部分地區參加的北京上海江蘇浙江、烏克蘭的部分地區、庫德斯坦地區、杜尚別 |
| 指標的 `unranked` | 數值沒有好壞、名次沒有意義：排名表依數值排列但不寫名次（表名寫「依數值排列」），側欄的數值卡片也不寫名次 | 跟台灣的時差 |
| `dimension.followsSelection` | 子項目就是國家（option 的 id 是 ISO alpha-3）：點地圖、排名表或搜尋選到國家時，子項目跟著換成那個國家（`App.tsx` 的 `selectCountry`），取消選取時留在原本的子項目；網址只有 `country`、沒有 `item` 時（例如從別的主題切過來）也用選到的國家（`resolveItem()`）。子項目選單各組依目前語言的國名排序 | 護照與簽證（點日本，地圖就畫日本護照到各國的簽證待遇） |
| `dimension.selfLabel` | 子項目是國家時，那個國家在自己那份資料裡沒有值：tooltip 與側欄的數值卡片寫這句，不寫「無資料」（不必 `followsSelection`） | 護照與簽證的「本國護照」、聯合國投票「與各國的一致度」的「比較的對象」 |
| `noValue`、指標的 `noValue` | 某些國家沒有值的原因（key 是 ISO alpha-3），取代 tooltip 與側欄的「無資料」。`missingReason()` 依序取指標的、主題的、`selfLabel`、`coverage`。這個國家在這個指標完全沒有值時，側欄的歷年圖表也換成這句；有部分年份的照常畫 | 台灣的外交裡的台灣（觀點）；聯合國投票的台灣（1971 年起不是會員國，1946–1971 年照常畫）；「與美國的一致度」裡的美國；學生能力（PISA）的中國、烏克蘭、伊拉克、塔吉克（只有部分地區參加，畫成點） |
| 指標的 `timeAxis` | 年份不是「那一年的資料」時：`{ label, year(年), tick?(年) }`。`tick`（2026-10-29 起）是時間軸刻度與目前的值的寫法（年份欄位存月份編號時寫「2026/9」、西元前寫「前 3400」），沒寫是數字本身。年份可以是負的（西元前）或 0：網址的 `year` 收任何整數（2026-10-29 起，`url-state.ts`；以前只收正數，`year=-200` 會被丟掉），`pickYear` 也不把 0 當成沒有。`label` 寫在時間軸的年份上面（`.time-axis`），也是拉桿的名稱；`year()` 取代 tooltip、側欄標題、排名表標題（「男性平均身高（1996 年出生）排名」，`t.withYear()`）、匯出圖片標題裡的年份。同一個主題裡 `label` 不同的指標年份的意思不同（`sameTimeAxis()`）：側欄只列 `label` 相同的數值卡片，從選單換到 `label` 不同的指標時網址的 `year` 拿掉、回到那個指標的預設年份 | 平均身高：成人的「出生年」（1996 年出生 = 2014 年 18 歲時的身高）、19 歲的「年份」（量測的年份） |
| 指標的 `defaultYear` | 指標自己的預設年份（網址沒指定年份時），沒寫用主題的 `defaultYear` | 平均身高的 19 歲身高預設 2019（成人預設出生年 1996） |
| 指標的 `chartZoom` | 側欄折線圖的 y 軸不從 0 開始 | 平均身高（都在 140–185 公分，從 0 畫起整條線是平的） |
| 指標的 `integer` | 數值是整數：側欄折線圖的 y 軸只用整數刻度（`spec.ts` 的 `y.integer`），只有 1、2 棟時才不會寫成 0、1、1、2、2 | 摩天大樓的 300 m 以上的大樓數（2026-10-27 起） |
| `indicatorAliases` | 舊網址的指標 id → 現在的指標與子項目（`{ 舊 id: { indicator, item? } }`）：指標改名或併進子項目後，舊的分享連結照樣打開同一份資料，網址也換成新的寫法（`types.ts` 的 `resolveAlias()`，App 與第一個畫面的預先下載共用；沒有對到的 id 原樣回傳同一個物件，App 依這個判斷要不要改寫網址） | 溫室氣體排放：原本只有二氧化碳的 `co2-per-capita`、`co2`，現在是「人均排放」「年排放量」選二氧化碳（資料檔還是 `co2-per-capita.json`、`co2.json`，`{item}-per-capita.json`、`{item}.json`） |
| 指標的 `coverage` | 刻意只收部分國家的指標：`{ countries, reason }`，`countries`（ISO alpha-3）以外的國家沒有值時一律寫 `reason`（`noValue` 要逐一列出國家，這裡只列有收的）；`countries` 裡的國家某一年沒有值時照常寫「無資料」 | 監禁人口率：44 國以外寫「沒有開放授權的資料」（第 8 節第 43 點） |
| 指標的 `dimension` | 指標自己的子項目選擇器，取代主題的 `dimension`（2026-10-27 起）：同一個主題裡不同指標的子項目不同時用。網址的子項目不在這個指標的選項裡時用它的 `defaultOption`（`types.ts` 的 `itemFor()`；`indicatorPath()`、側欄的數值卡片、預先下載都經過它），網址留著原本的子項目，換回原本的指標時還在。側欄卡片的標題用各指標自己的子項目名稱（`itemLabelOf()`） | 國旗的「顏色」（紅、白、藍…）與「圖案」（星星、新月、太陽…） |
| 指標的 `rankingBars: false` | 排名表不畫長條：數值是年份這類，長短沒有意義 | 國旗的採用年份 |
| `rowIcon` | 排名表國名前面的小圖示，`(props: { iso3 }) => ReactNode`（函式型別，`localize()` 會原樣保留；寫成 `ComponentType` 會被 `Localized` 拆壞型別）。元件自己載入需要的資料，放在首頁的 bundle，要小 | 國旗主題的小國旗（`flagImages.tsx` 的 `FlagIcon`） |
| 指標的 `format(值, 年)` | 第二個參數是這個值的年份（2026-10-28 起）：tooltip、搜尋結果、側欄的數值卡片與比較、排名表、側欄折線圖的 tooltip 都傳（tooltip 與排名表用實際的資料年份，`latestWithin` 補上的是那一年）。值的意思跟年份有關的指標才用，其他指標的 format 照舊只看值 | 日食路徑的「下一次日全食」：值是還要幾年（顏色依它分級，所有年份共用門檻），format 寫成「2035 年（8 年後）」 |
| 指標的 `panelChart: false` | 側欄不畫這個指標的歷年圖（2026-10-28 起；附註照樣顯示）：值是代碼、只給 tooltip 與排名表用的不上色指標，畫成折線沒有意義 | 日食路徑的「日食路徑」（那一年經過的類型；主題的側欄區塊列出每一次） |
| 指標檔的 `noValue`、`noValueEn` | 依資料決定的「沒有值的原因」（key 是 ISO alpha-3），pipeline 寫在指標檔裡，取代 tooltip 與側欄數值卡片的「無資料」（2026-10-28 起）：`missingReason()` 多兩個參數（資料檔、語言），排在指標、主題的 `noValue` 與 `selfLabel` 後面；App 的 tooltip 與 `CountryPanel` 傳入那個指標的資料檔。主題裡寫不出來（依子項目、依年份而定）時用 | 飲食的咖啡、茶、可可：拿掉明顯不合理的年份，寫「數字不可靠（2020–2023 年）」（第 8 節第 97 點） |
| 指標的 `missing` | 值是 null 時一律寫這句，取代 tooltip、側欄與圖例灰色那一格（含匯出圖片）的「無資料」（`missingReason()` 排在 `noValue`、`coverage` 之後，2026-10-28 起）。值是算出來的、每個國家都算過，null 有固定意思時用 | 日食路徑的「下一次日全食」：「到 2100 年都沒有日全食經過」 |
| 指標的 `itemFormats` | 各子項目自己的單位與格式 `{ 子項目: { unit, format, formatTick? } }`（2026-10-28 起）：同一個指標在不同子項目的單位不同時用。`forItem()` 依目前的子項目換掉 `unit`、`format`、`formatTick`（跟 `itemScales` 換分級門檻同一個地方、同一份快取），地圖、圖例、tooltip、排名表都拿到換好的指標；側欄的數值卡片與折線圖原本直接用 `topic.indicators`，改成先經過 `forItem(ind, itemFor(...))`（`CountryPanel.tsx` 的 `resolved`）。沒有 itemFormats 的指標 forItem 照舊回傳同一個物件 | 石油、天然氣與煤的產量、消費量（石油千桶/日、天然氣十億立方公尺、煤百萬公噸）、人均消費量、蘊藏量 |

**指標檔的 `estimatesBefore`**（2026-10-28，1800 年起的長期資料加的共用改動）：`types.ts` 的 `IndicatorData`、`TimeSlider.tsx`（`estimatesBefore` prop，App 傳 `data?.estimatesBefore`）、`charts/timeSeries.ts`（沿用 `methodBreakLine()` 畫垂直虛線、tooltip 寫「估計值」）、`CountryPanel.tsx`（圖下的說明 `t.estimatesBefore`）。原本想在折線圖上那一段加底色，但要多載 ECharts 的 MarkAreaComponent（所有折線圖共用的 chunk 會變大），改用已經有的 markLine。格式見第 3 節。

### 雙語文字（英文版介面）

介面有繁體中文（預設）與英文，主題外掛裡所有給人看的文字都要寫兩種語言（做法的全貌見第 12 節）：

- **文字欄位用 `Text`**：`title`、`shortTitle`、指標的 `label`、`description`、`unit`、資料來源的 `name`、`license`、`note`、子項目選項的 `label`、`group`、`boxEstimate.label` 都可以寫成 `{ zh: '總人口', en: 'Total population' }`。兩種語言寫法一樣的（`TWh`、`IMF, World Economic Outlook`、`CC BY 4.0`）直接寫字串。
  - 選這個寫法而不是另外一張英文對照表，是為了讓每個主題自己一個檔就完整：新增或修改指標時，中英文就在同一行，不會漏改另一個檔。
  - App 用 `localize(topic, lang)` 把整個主題解析成 `Topic`（所有 `Text` 換成字串，有快取），地圖、側欄、排名表與主題側欄拿到的都是解析好的字串，不必管語言。
- **`format` / `formatTick` 在呼叫當下讀目前的語言**：
  - 數字用 `lib/format.ts` 的函式（`formatLargeNumber`、`formatLargeTick`、`fixed`、`formatSignedPercent`…），中文自動用萬、億、兆，英文用 K、M、B、T。
  - 單位用 `tr({ zh: '人', en: 'people' })`；美元、國際元用 `usd()`、`intlDollars()`（中文「1.43 兆 美元」、英文「$1.43T」）。
  - 中英文語序不同時整句寫兩份：`format: (v) => tr({ zh: `鐵路 ${km(v)}`, en: `Railways: ${km(v)}` })`。
- **主題側欄**（`panels/*.tsx`）：通用的字（載入中、無資料、「（2022 年無資料，顯示最近一年）」）用 `useT()` 的字典；側欄自己的字用 `defineMessages({ zh: {...}, en: {...} })` 寫在同一個檔，再用 `TEXT[useLang()]`。英文那份少一個鍵、參數不同都會編譯失敗。有 `useMemo` 的地方，依賴要加上 `lang`，換語言時才會重算。
- **資料裡的名稱**：pipeline 產生的文字也要有英文。指標檔的附註寫 `notes`（中文）與 `notesEn`（英文）；品項名稱另外輸出英文檔（例如農業的 `items.en.json`，用 FAOSTAT 本身的英文名稱）。只在前端用到的少量名稱（例如主計總處的 25 個製造業細項）可以在側欄裡放 `{ zh, en }` 對照表。
- **原文專有名詞**（OpenStreetMap 上的營運者名稱等）不翻譯，放在 `translate="no"` 的元素裡（`BarList` 的 `properNouns`）。
- **寫完跑檢查**：`npm run check:i18n` 掃描原始碼裡英文介面會看到的中文（每次都跑，幾秒）；`npm run check:en` 用無頭 Chrome 逐一打開英文版的每個主題與指標，列出畫面上剩下的中文。一律指定要細看的主題（`CHECK_TOPICS=<主題 id> npm run check:en`），完整的只在使用者特別要求時跑（第 12 節「什麼時候跑」）。

圖層的 `legendValues: 'auto'` 會依資料最大值自動挑圖例數值，適合量級差很多的子項目。

面量圖的 `itemScales` 是**各子項目自己的分級門檻**（`{ kind: 'choropleth', scale, itemScales: { eggs: {...}, milk: {...} } }`），沒列的子項目用 `scale`。例如飲食主題的人均供給量：蛋最多 25 公斤、乳品超過 500 公斤，用同一組門檻會有一邊整片同色。門檻仍是寫死的、所有年份共用。App 用 `forItem(indicator, item)`（`src/topics/types.ts`）換成目前子項目的那一組，同一組合回傳同一個物件，地圖、圖例、匯出圖片拿到的都是換好的指標。

圖層的 `kind: 'none'` 表示國家不依數值上色，只畫疊加圖層（例如交通主題的「路網地圖」）；指標資料仍用在 tooltip 與排名表。國家側欄不把它列成數值卡片；它跟某張數值卡片用同一個資料檔時（城市的「城市地圖」與「住在城市的比例」、發電廠地圖與總裝置容量），側欄的折線圖用那張卡片的名稱與格式（「住在城市的比例的變化」，不是「城市地圖的變化」，`CountryPanel.tsx` 的 `chartIndicator`）。

圖層的 `kind: 'categorical'` 是**類別圖**（每個國家屬於一類，沒有大小之分），例如語言主題的「主要官方語言」與「官方地位」：
- 設定：`{ kind: 'categorical', categories: [{ value: 1, label: { zh, en } }, …], other?: Text, ordinal?: boolean }`。
- 類別可以寫自己的顏色（`CategoryDef.color`，2026-10-27 起）：類別本身就是顏色時用（國旗的主要顏色：紅色那一類畫紅色），所有類別都有顏色時不取 `MAP_TOKENS.categorical`。其他類別圖不要用，一般的類別色要跟底圖、彼此分得開。例外是河流與流域的「主要流向」（2026-10-28）：要跟地圖上河流的顏色一致，四個大洋取 `MAP_TOKENS.categorical` 裡河流用的那四色（第 5 節「河流的顏色」），內流區用「其他」色 `categoricalOther`。
- **類別涵蓋一段代碼**（`CategoryDef.max`，2026-10-28 起，法定年齡）：代碼 `value` 到 `max`（含）都算這一類，例如「7–9 歲」；資料檔照樣寫實際的歲數，`format` 寫出實際的值，圖例、排名表、國家數依類別。`categoryScale()` 先找完全相同的代碼，再找範圍。
- **`ordinal` 類別圖裡有自己顏色的類別不占色階**（2026-10-28 起，法定年齡）：「禁止」「沒有規定」這種不在強弱順序上的類別寫 `color`（灰色），循序色只平均分給其他類別。
- 資料檔照舊用 `indicator_file()` 輸出數值，每個國家的值是**類別代碼**（整數）。代碼不在 `categories` 裡的歸到 `other`（有設定的話），否則當成無資料。
- 顏色不寫在主題裡（`src/map/categories.ts` 的 `categoryScale()`；這個檔不依賴 d3，排名表在首頁 chunk 裡也用到它）：
  - 一般類別依序取 `MAP_TOKENS.categorical`（8 色，不循環；超過 8 類要併到「其他」），「其他」是 `MAP_TOKENS.categoricalOther`（淺的中性色，跟無資料的灰色分得開）。配色怎麼選的見第 5 節。
  - `ordinal: true`（類別有強弱，例如官方 > 事實上官方 > 部分地區官方 > 沒有官方地位）改用循序色，第一類最深。
  - `diverging: true`（兩個方向的強弱，例如封閉專制 ↔ 自由民主）改用發散色：類別從一端排到另一端，前一半取橘色、後一半取青綠，越靠兩端越深，奇數類的正中間是中性灰（`divergingColors()`）。一邊最多 3 類。
- `format(代碼)` 回傳類別名稱，tooltip、排名表、側欄的數值卡片、搜尋結果都用它。
- 圖例（`CategoricalLegend`）列出每一類的色塊、名稱與國家數，超過 5 類排成兩欄。滑過或聚焦某一類時，其他國家淡化（feature-state `dim`）；點一下固定（觸控裝置沒有滑過），再點一下取消。匯出圖片的圖例同一個版面（`categoricalLegendModel()`）。
- 排名表：類別沒有名次，改依圖例的類別順序排列（同一類再依名稱、國名），數值欄是色塊加類別名稱；CSV 輸出類別名稱而不是代碼，依國名排。
- 側欄：數值卡片不顯示名次，也不畫折線圖；有多個年份時（例如首要死因）改列出歷年變化，連續相同類別的年份合併成一段（「2000–2003 年 心血管疾病、2004–2023 年 癌症」）。
- 3D：類別沒有高低，不拉高，只傾斜地圖。
- 代碼怎麼編由主題決定。語言主題的「主要官方語言」用語言代碼的 36 進位數（`en` → 527），pipeline 用 `int(code, 36)`、前端用 `v.toString(36)` 換算，不必兩邊各寫一份對照表；「官方地位」是 1–4。疾病主題的「首要死因」用 WHO GHE 的死因代碼（心血管疾病 1100、癌症 610…）。

圖層的 `kind: 'terrain'` 是**地形圖**：國家不上色，畫高程圖磚的分層設色與陰影（主題要設 `terrain`）。指標資料（海拔主題是平均海拔）仍用在 tooltip 與排名表；側欄不列成數值卡片，因為跟「平均海拔」重複。

圖層的 `kind: 'flags'` 是**國旗地圖**（2026-10-27 起，國旗主題）：每個國家塗上自己的國旗，`file` 是國旗檔（`flags.json`），指標檔本身（採用年份）照常給 tooltip 與排名表。畫法見 `src/map/flagTiles.ts` 與第 8 節第 84 點：
- MapLibre 的 `fill-pattern` 只能把一張小圖重複鋪滿（一整片小國旗壁紙），也不能把圖片裁成國界的形狀，所以用自訂協定（`addProtocol`，跟 1 km 網格一樣）在瀏覽器裡畫點陣圖磚：每張圖磚把落在裡面的國家用國界（`Path2D`，Web Mercator 的 0–1 座標）`clip`，再把國旗畫進去；`raster` 圖層插在 `data-fill`（透明，只給 hover、點選）下面，國界與選取外框畫在國旗上面，底圖的國界照面量圖一樣隱藏。
- 國旗畫在哪裡（`setFlagLayout()`，國界或國旗換了才重算，版本號換了圖磚網址也跟著換）：最大那塊陸地加上附近的島（範圍相距不到它大小的 25%）共用一面旗（日本的四個主島、法國本土與科西嘉），遠的島與屬地自己一面（阿拉斯加、夏威夷、法屬圭亞那）。國旗蓋滿那個範圍：國土比國旗瘦長或扁平時最多拉長 25%，其餘裁掉；裁的時候讓國旗的重點（`flags.json` 的 `fx`、`fy`：左上角的方塊 0.25、0.25，旗桿側的三角形 0.22、0.5，沒寫是正中央）盡量落在國土的中央，台灣才會是北半部藍底白日、南半部紅。跨 180° 經線的（俄羅斯、斐濟）在左右各畫一次。
- 國旗的 SVG 先畫成 32–2048 px 寬（取 2 的次方）的點陣圖再貼到圖磚，最近用過的留著、超過 96 MB 丟掉最舊的；圖磚是 256 px 乘裝置像素比（最多 2）、`maxzoom` 9（再放大用 9 級的放大），不透明度隨縮放從 0.96 降到 0.45，放大後看得到道路與地名。協定直接回傳 `ImageBitmap`（MapLibre 5 接受，不必編碼成 PNG）。
- 小國（跟小國圓點同一批，面積不到 6,000 km² 與沒有形狀的）畫成小國旗（`flag-tiny`，symbol 圖層，圖示用 canvas 畫好再 `addImage`，有深色細邊；換底圖後重新加上），縮放 5 以下；滑過、點選跟小國圓點一樣（`HOVER_LAYERS`）。
- 圖例是一張說明卡（國旗依國土的形狀縮放、裁切），匯出圖片照常截地圖畫面（國旗在裡面）；3D 只傾斜。

疊加圖層是 MapLibre 的 GeoJSON 圖層：
- 鐵路在資料管線先用 Douglas–Peucker 簡化到約 1 公里，再量化與差分編碼（約 12.5 萬個頂點、壓縮後約 300 KB）。
- 放大到 9 級以後，底圖本身有更精細的鐵路，簡化過的線會淡出。

**一般的點、線疊加圖層**（`PointsOverlayDef`、`LinesOverlayDef`，地圖上的畫法在 `src/map/overlayLayers.ts`，圖例在 `src/map/Overlays.tsx`）：
- 主題在 `overlays` 寫 `{ kind: 'points', id, file, label, radius, color, … }` 或 `{ kind: 'lines', … }`，地圖引擎不必為新的點資料加程式。鐵路、機場維持原本的寫法。
  - `radius`：固定半徑，或依數值欄位在 `stops` 之間線性內插（地震依規模）；是縮放 2 時的大小，放大時跟著變大，但比地圖放大得慢。
  - `color`：固定色，或依數值欄位分級（`ColorClasses`：門檻、每一級的顏色與名稱，例如震源深度）。顏色取自 `MAP_TOKENS`。
  - `shape: 'triangle'`：三角形圖示（火山）。每種顏色在 canvas 畫一張圖（白色外框直接畫在圖上），用 symbol 圖層；換底圖後圖示跟著樣式一起消失，重新加上。
  - `sortField`：大的畫在上面（`circle-sort-key`）。`timeField` 加上指標的 `overlayTime` 決定時間軸怎麼篩選（`setFilter`，不重送資料）。
  - `endField`（2026-10-27 起，摩天大樓；2026-10-29 起線也可以用，帝國與疆界：那個範圍最後一年的下一年）：結束的年份（拆除、毀損）。`overlayTime: 'cumulative'` 時，篩選多一個條件「沒有這個欄位，或比時間軸的年份晚」，所以舊世界貿易中心畫到 2000 年、2001 年起不見；不必像城市那樣用 `epochs` 每一年重送資料。
  - `tooltip(p, { countryName })` 回傳標題與說明，原文地名放 `properNoun`（`translate="no"`）；`extra` 是說明下面另外幾行（2026-10-26 起，航運與港口的港口寫班輪航運連結指數與公布的吞吐量）。點有 `iso3` 欄位時，滑過會同時標出那個國家，點一下選取它；海上的地震沒有國家，照樣有 tooltip。
  - `indicators`：只在某些指標顯示；`items`：只在某些子項目顯示（`dimension` 的選項 id）。`hidden: true`：預設關閉，第一次打開才下載資料檔（`app/overlays.ts` 的 `useJsonEach` 保留已載入的檔，打開另一個圖層時地圖不會閃一下）。
  - **跟著年份換資料檔**（2026-10-29 起，板塊漂移）：`file` 含 `{year}` 時換成時間軸的年份（`overlayPath()`），例如 `countries/{year}.json`，一個時間點一個檔，只下載看到的；新的檔還沒讀到前照畫上一個年份的（`app/overlays.ts` 的 `lastYearly`），播放時不閃。
  - **跟著子項目換資料檔**（便利商店與連鎖品牌，2026-10-26 起）：`file` 含 `{item}` 時換成目前的子項目（`app/overlays.ts` 的 `overlayPath()`），例如 `points/{item}.json`：一個品牌一個店家檔，只下載選到的品牌；換品牌時是同一個圖層（同一個 `ov-<id>`）換資料，開關狀態不變，新的檔載入前先隱藏。tooltip 的第二個參數多了 `item`（目前的子項目），店家的 tooltip 用它寫品牌名稱。
  - **放大才畫**：`minZoom` 是 MapLibre 圖層的 `minzoom`（所有點一樣，不必像 `minValue` 每個點多一個欄位）。便利商店上萬個點在世界全圖會糊成一片、蓋住面量圖，5 級（大約一個國家的大小）以上才畫。
  - **點沒有國家欄位時**：滑過照樣顯示點的 tooltip；點一下選取點底下的國家（`mapEvents.ts` 的 click 依 `HOVER_LAYERS` 再查一次），不會取消選取。店家很密的地方（臺北、東京）放大後幾乎點哪裡都是店，原本會一直取消選取。店家不存國家欄位，省下每個點 6 個位元組。
  - 線可以依 `types` 分類上色，`dash: true` 的類別畫虛線（`line-dasharray` 不能依資料變化，另外一層 `ov-<id>-dash`）。
  - **線的 tooltip 與時間篩選**（海底電纜，2026-10-23 起）：`LinesData.records` 是每條線一筆紀錄（跟點的 `PointsData` 同一種欄位分開存的格式，`common.lines_file()` 的 `records`、`record_fields`、`record_scale`、`record_delta`），前端 `decodeLines()` 還原。
    - 線圖層有 `tooltip` 時可以滑過：另外一層看不見的寬線 `ov-<id>-hit`（9 px、`line-opacity: 0`；`queryRenderedFeatures` 依線寬判斷，跟不透明度無關）給 hover 查詢，細線也滑得到；點圖層優先。滑過時 `ov-<id>-hover` 把紀錄完全相同的線（同一條電纜被切成的好幾段，`g` 是組別）一起加粗。點一下不會取消選取：點選時略過線的查詢層，選到底下的國家。
    - 標出的那一組畫在另一個小 source `ov-<id>~h`（2026-10-28 起）：`highlightLine()` 把那一組的 features 換進去（`overlayLayers.ts` 的 `groupFeatures()`，依 `g` 建的索引第一次用到時才建），`-hover`、`-hover-halo`、`-hover-fill` 都讀它，不必依組別篩選。原本這幾層跟線讀同一個 source、換組別時 `setFilter`：MapLibre 改任何一層的篩選都會把整個 source 的圖磚（所有圖層）重做一次，放大後河流有三萬多段時代價跟著變大。
    - `timeField`（紀錄裡的欄位）跟點一樣依指標的 `overlayTime` 篩選；線本身有篩選（實線、虛線那兩層）時，時間篩選跟它合併（`['all', 本身, 時間]`），不能直接蓋掉，否則規劃中的電纜會失去虛線、或在啟用以前就出現。
  - **每個頂點一個分類**（颱風路徑，2026-10-23 起）：`LinesData.vertexTypes` 是每條線每個頂點的代碼，一個字元一個頂點（36 進位，`common.lines_file()` 的 `vertex_types`，量化後重疊的頂點連代碼一起拿掉）。
    - 前端 `partFeatures()` 依代碼把一條線切成好幾段，每段的代碼是起點的代碼、相鄰兩段共用交界的頂點；顏色照 `color.classes`（`value` 對應代碼），跟 `types` 一樣。同一條線切出來的段帶同一個 `i`、`g`，滑過時整條路徑一起加粗。
    - 為什麼不用 `line-gradient`：它只能依線的長度比例漸層，不能依資料；每段一個 feature 才能依強度上色、用 `dash` 畫非熱帶的階段。
    - `sortByType: true`：`line-sort-key` 依代碼，強的那段疊在弱的上面（同一個圖層裡排序；虛線那層另外排）。
    - `casing: true`：線下面墊一層細邊 `ov-<id>-casing`（淺色底圖深色 0.28、深色底圖白色 0.4，比線寬 1.4 px）。颱風最淺的兩級（熱帶性低氣壓、熱帶風暴）在藍色的海上、最深的兩級在深色底圖上都不容易看清楚，墊了邊才分得出來。
  - **河流：依欄位的線寬、整個水系一起標出、放大才下載的分區**（河流與流域，2026-10-28 起；沒有用這些欄位的線圖層照舊，海底電纜、颱風、專屬經濟海域、板塊邊界、鐵路的畫面與滑過時的標示截圖看過）：
    - `width: { field, stops }`：線寬依紀錄的數值欄位在 stops 之間線性內插（縮放 2 時的 px，一樣經過 `zoomed()`）；河流依平均流量，stops 依對數間隔取（1、10、100…m³/s），看起來就是依流量的對數變粗。滑過時標出的線是原本的 1.5 倍加 0.8 px（固定線寬的照舊至少 2.4 px）。`sizeLegend`（跟點圖層同名）在圖層開關下面畫幾條線寬與數值。`widthZoom: [[縮放, 倍數], …]` 取代預設的 `zoomed()` 倍數（河流放大到國家的大小時要粗一點，否則跟底圖的道路混在一起）。線寬依欄位變化的圖層，游標附近有好幾條線時取欄位最大的那條（`mapEvents.ts` 的 `featureAt`，大河優先，不是剛好排在前面的小支流）。
    - `groupField`：滑過時一起標出的組別依紀錄的這個欄位（同一個出口的幹流與所有支流），不是「紀錄完全相同」；欄位是數字時就用它當組別編號，主題的側欄也能用同一個編號標出（`PanelExtraProps.highlightLine(圖層 id, 編號)`，App 的 `lineHighlight` 傳給 WorldMap；滑鼠移開地圖上的線以後回到側欄要標的那一組）。`PanelExtraProps.focusBox([西, 南, 東, 北])` 把地圖移到那個範圍。
    - `minValue`：跟點圖層一樣依縮放篩選（`['>=', 欄位, ['step', ['zoom'], …]]`），縮小時只畫大河；標出一組的那幾層也套用（`applyTimeFilters()` 只給它們依縮放的篩選，不給時間篩選），放大前看不到的支流不會跟著亮起來。
    - `fadeOut: [開始, 完全不見]`：放大到那個範圍淡出（`line-opacity` 依縮放內插）。
    - `hoverHalo`：滑過時標出的那一組下面墊一圈光暈 `ov-<id>-hover-halo`（淺色底圖近黑 0.5、深色底圖白色 0.55，比標出的線寬 3 px，`line-blur` 1），同色的鄰近水系才分得開。
    - 分類的 `dark`：深色底圖上改用的顏色（同色相亮一階，河流的紫 → 淡紫）；圖層開關的圖例與匯出圖片的圖例跟著底圖換（`overlayKey()` 的 `darkMap`）。
    - `detail: { minZoom }`：資料檔的 `detail` 列出分區檔（`detail/{tile}.json`）與每一區的實際範圍 `[id, 西, 南, 東, 北]`。WorldMap 在 `moveend` 回報縮放與畫面範圍（`onViewChange`，只有有 detail 的主題才監聽，App 的 `mapView`），縮放到 minZoom 以上時 App 下載跟畫面重疊（外擴 2°、經度左右平移 360° 再比一次）的分區，跟主檔接成同一份資料（`Overlays.tsx` 的 `concatLines()`，tooltip 的索引是接起來以後的順序，`parts` 留著原本的幾份），同一組篩選與 tooltip。
      - 分區畫在另一個 source `ov-<id>~d`（2026-10-28 起；圖層 `ov-<id>~d`、`ov-<id>~d-dash`、`ov-<id>~d-hit`…，在主檔的線下面，查詢時主檔的先查，`lineOverlayAt()` 把兩種查詢層都對回圖層 id），主檔的 source 只在主檔變了才重送（`sendLines()`，每一份的 features 依那一份快取）；地圖上只放跟畫面重疊的分區，下載過的檔留著（`useJsonEach` 的快取），移回去不再下載。GeoJSON source 的 `maxzoom` 是 `fadeOut` 完全不見的那一級（河流 12，不必切到預設的 18 級）。
      - 原本主檔與分區在同一個 source、下載過的分區全部留在地圖上：移動地圖每多一區就把主檔加上所有看過的分區（亞洲 5 級約 3 萬段）重送一次，桌機開發模式每次停 0.2 秒左右（長任務 195–242 ms，一次移動 1–2 次），河流 0.8–1.2 秒後才畫好。改了以後主檔不再重送，分區那個 source 3,000–7,000 段，同樣的移動沒有長任務，0.3–0.8 秒畫好。滑到河上標出水系：一般的水系 25–40 ms → 10–17 ms；亞馬遜河這種七、八千段的大水系 80–120 ms → 130–170 ms（換進 `~h` 的資料要重新切圖磚，比原本只重做篩選慢一點，但只有最大的幾個水系）。
    - 紀錄的字串表（`PointsData.strings`，`common.points_file()` 的 `strings`）：重複很多次的字串欄位（河名）存成表的索引，0 是沒有值。`LinesData.groups`（`common.lines_file()` 的 `groups`）：很多條線共用的資料（水系的名稱、流進的大洋與海、集水面積、長度）每個檔只存一次，`decodeLines()` 依欄位值把那一筆併進每條線的紀錄。
  - **日食：封閉的環畫成面、線的不透明度**（日食路徑，2026-10-28 起；沒有用這些欄位的線圖層照舊，河流、颱風、海底電纜、專屬經濟海域的畫面與滑過的標示截圖看過）：
    - `fill: { field, value, opacity, darkOpacity? }`：紀錄的 `field` 是 `value` 的線是封閉的環（日食的路徑環：北界、終點、南界、起點），`partFeatures()` 把它做成 Polygon。多一層半透明的面 `ov-<id>-fill`（在這個圖層所有的線下面，顏色跟線一樣依分類、深色底圖用 `dark`，`fill-antialias` 關掉），外框由前端從同一個環另外做成 LineString 給線的圖層（界線與終點一起畫，資料檔不必另外存北界、南界的線，少一半），只留地圖畫得到的緯度（±85.05° 以內，`clipLatitude()`）：超出的部分 MapLibre 會壓到 85° 的緯線上，從極點附近經過的路徑（2021-06-10、2094-01-16）原本在極區畫出一整圈。滑過或側欄標出那一組時，另一層 `ov-<id>-hover-fill` 把那一組的面加深（不透明度兩倍、最多 0.6）。
    - 面那兩層的篩選只取多邊形（`geometry-type` 是 Polygon、MultiPolygon；MapLibre 的面圖層遇到 LineString 會把線當成多邊形三角化），線的那幾層反過來只取線（不畫多邊形本身的外框，否則極區那段又畫出來）。標出一組的那幾層（`~h` 的 source）也各自帶這兩個條件。
    - 面本身不給 hover 查詢：路徑裡面還是滑得到國家（滑到路徑的外框、中心線才是路徑的 tooltip，查詢層的 9 px 在全球視角下幾乎蓋滿帶子）。
    - 圖例的符號是帶子（`OverlaySwatch.shape: 'band'`：半透明的長方形、上下兩條邊、中間一條線），畫面與匯出的圖片一樣。
    - `opacity`：線的不透明度，取代預設的 0.8／0.9（日食的「1900–2100 年所有的中心線」0.35）。
    - `onlyTypes`：只畫這幾個分類代碼的線，圖例也只列這幾類（日全食次數只畫日全食與混合食的中心線）；滑過、側欄標出的那幾層不限。
    - `keyClasses: false`（2026-10-29 起，帝國與疆界）：圖例不列顏色的分類（顏色只是讓相鄰的面分得開，沒有意義），開關那一列的符號照常用第一類的顏色。
    - 同一個資料檔可以給好幾個圖層用（`useJsonEach` 依網址快取，只下載一次）：日食的那一年的路徑、所有的中心線、次數指標的累積中心線都讀 `paths.json`，後兩個用 `minValue: { field: 'r', stops: [[0, 1]] }`（所有縮放都只留 r ≥ 1 的中心線）當成固定的篩選，不必新的欄位（`valueFilter()` 只有一個門檻時不用 `step`，MapLibre 的 `step` 至少要一段，原本會報「Expected at least 4 arguments」）。
    - 沒有 tooltip 但有 `groupField` 的線也建立標示的那幾層（不建查詢層，滑不到）：側欄還是能用 `highlightLine` 標出一組（日食次數指標的累積中心線）。
  - **地球的另一邊：面的洞、依分類的不透明度、只給部分分類外框**（2026-10-28 起；沒有用這些欄位的線圖層照舊，日食路徑、河流、海底電纜、颱風的畫面與標示截圖看過）：
    - `fill.holeField`：紀錄的這個欄位是 1 的環是前一個外環的洞，`partFeatures()` 接在前一個多邊形後面（翻過去的陸地裡挖掉的湖、對面是海的那一塊裡挖掉陸地對陸地的島）。pipeline 先用 shapely 的 `orient()` 讓外環逆時針、洞順時針。
    - `fill.outline`：哪些環另外做成外框的線，`false` 都不做、代碼的清單只做這幾類，沒寫是全部（日食）。地球的另一邊的面是陸地切出來的，邊不是海岸線，外框另外畫（翻過去的 topojson arc）；只有側欄標出的那一國（第 5 類）從自己的環做外框。
    - `fill.typeOpacity`：`{ 代碼: [淺色底圖, 深色底圖] }`，`fill-opacity` 用 `match`；滑過、標出的那一組是兩倍（最多 0.6）。
    - 分類的 `area: 'land' | 'sea'`：這一類是面，圖例畫成半透明的色塊（`OverlaySwatch` 的 `fill`），墊在它在地圖上疊著的底色（陸地米白／深藍灰、海 `#9ebdff`／`#38435c`），不透明度跟地圖一樣；`fill.outline` 有寫時（只有部分分類畫外框），線的分類畫成普通的線，不是帶子（帶子是「半透明的環加外框」，日食）。
    - 平常不畫、只在側欄標出時畫的分類：`onlyTypes` 不列它，標出的那幾層（`-hover`、`-hover-fill`、`-hover-halo`）不受 `onlyTypes` 限制（日食已經是這樣）。同一個資料檔給兩個圖層（`flipped` 畫面與線、`flipped-coast` 只畫海岸線），側欄依目前的指標標出其中一個。
  - **側欄的標記與游標的對蹠點**（WorldMap 的 `marks`、`pointer`，2026-10-28 起）：`map-marks` 圓點（這裡實心、對蹠點空心）加名稱、`pointer-mark` 空心圈，紫色（淡紫）。這幾層加在樣式的最上面（連底圖的地名也蓋過，「台北的對蹠點」才不會被當地的地名壓住）；點標記不改選取的國家，`flyTo` 到它 `link` 的那一個。
  - **跟著時間軸變的數值**（城市，2026-10-26 起）：`epochs: { years, values(紀錄, 期) }`。點的數值每一期一個（城市 1975–2030 每 5 年的人口），時間軸的年份換成不晚於它的最近一期（`overlayEpoch()`），`values` 算出那一期的欄位（`{ pop }`）放進 GeoJSON，`radius`、`color`、`sortField`、`minValue` 用這些欄位。值是 null 的欄位不放（那一期還不是城市，`minValue` 的 `has` 篩掉，點就不畫）。換到另一期時才重算、重送資料（`syncOverlays` 的快取記下資料與那一期；WorldMap 換年份時也呼叫它，沒有 epochs 的圖層不會重送）。tooltip 的第二個參數多了 `year`（時間軸的年份）。
    - 為什麼不在 GeoJSON 放所有年份、用運算式挑欄位：`circle-radius`、`circle-sort-key`、filter 都要依年份改寫，改了一樣會讓 worker 重新切圖磚，程式卻多很多；重送資料只在換到另一期時發生（12 期）。
  - **依縮放篩選**（城市，2026-10-26 起）：`minValue: { field, stops: [[縮放級數, 最小值], …] }`，MapLibre 的 filter `['>=', ['get', field], ['step', ['zoom'], …]]`，跟時間篩選合併（`pointFilter()`）。filter 裡的 `['zoom']` 是圖磚的整數級數（GeoJSON 在 worker 依圖磚切），所以門檻在整數級數換。城市：圖磚 0–1 級（世界全圖）200 萬人以上、2 級 100 萬、3 級 30 萬、4 級 10 萬、5 級起全部；1280×800 的地球儀（縮放約 1.7）約畫 70 個、台灣（6.6 級）全部 21 個。
  - **晝夜**（`kind: 'night'`，`NightOverlayDef`，2026-10-28 起，晝夜與季節）：沒有資料檔，依時刻主題的這一刻（WorldMap 的 `time`）畫地球的夜半邊、三層曙暮光與太陽直射點（`src/map/nightLayer.ts`，WebGL 的自訂圖層，見第 8 節第 87 點）。插在 `data-border` 之前：夜色蓋住底圖與國家的顏色，國界、選取外框、其他疊加圖層與地名畫在上面。換時刻只換太陽的方向（uniform）與直射點（一個點的 `setData`），不重送幾何。圖例（`overlayKey`）是五個半透明的色塊（白天、民用、航海、天文曙暮光、夜晚，`OverlaySwatch` 的 `shape: 'fill'`，墊在像地圖陸地的底色上）加太陽直射點，匯出的圖片也一樣；`syncOverlays`、`applyTimeFilters` 不處理它。
  - **即時網格**（`kind: 'liveGrid'`，`LiveGridOverlayDef`，2026-10-29 起，此刻的極光）：沒有資料檔，`values(即時資料)` 回傳經度 −180–180°、緯度 −90–90° 每 1° 一點的值（181 × 361，依緯度、再依經度排），`src/map/liveGridLayer.ts` 用跟晝夜同一種 WebGL 自訂圖層畫（頂點的位置固定，資料更新時只換數值的 buffer；兩極、180° 經線沒有接縫），一個顏色（`color.light`、`color.dark`）、依 `opacity` 的折線（最多 4 點，第一點以下不畫）調不透明度，插在 `data-border` 之前（晝夜之後加，畫在夜色上面）。圖例是 `legend.rows` 的幾個色塊（墊在陸地的底色上）。同一份即時資料、同一個圖層只算一次（`app/overlays.ts` 的 `liveGridValues`）；`syncOverlays`、`applyTimeFilters`、點與線的 tooltip 不處理它。
  - **類別網格**（`kind: 'classGrid'`，`ClassGridOverlayDef`，2026-10-29 起，氣候分區）：經緯度對齊的全球網格，每格一個類別代碼（柯本的 30 類），依代碼上色。資料檔是 pipeline 寫的 8 位元灰階 PNG（不濾波，像素值就是代碼，0 不畫，第一列北緯 90°、第一行西經 180°），`file(年份, 子項目)` 給路徑（依時間軸換時期）。瀏覽器用 `DecompressionStream` 解開 IDAT（`classGridLayer.ts` 的 `loadClassGrid`；不經過 canvas，canvas 可能做色彩轉換讓代碼變掉），同一個網址只讀一次，換時期時新的讀到前照畫舊的（`app/overlays.ts` 的 `useClassGrids`）。地圖上是 WebGL 的自訂圖層（`src/map/classGridLayer.ts`）：跟晝夜、即時網格同一張 1° 頂點網格與投影，但顏色在片段著色器裡用內插的經緯度讀「代碼貼圖」（資料的原始解析度，最近鄰取樣，格子維持方塊；WebGL 2 是 R8、WebGL 1 是 LUMINANCE），再查 256 × 1 的調色盤貼圖；換時期只換代碼貼圖。插在 `data-border` 之前。圖例是分組的小色塊加短名稱（`layout: 'chips'`，滑過看全名）。主題可以用 `classAt(網格, 經度, 緯度)` 查游標下的代碼（`pointer`）。
  - **風的粒子**（`kind: 'wind'`，`WindOverlayDef`，2026-10-29 起，風與季風）：資料檔是 pipeline 內插到經緯度網格的風場（`{ width, height, deg, scale, u, v }`，u、v 是 int8 的 base64，乘 `scale` 是 m/s；第一列北緯 90°、第一行西經 180°），`file(年份, 子項目)` 給路徑，換月份時新的讀到前照畫舊的（`app/overlays.ts` 的 `lastWind`）。地圖上是 WebGL 的自訂圖層（`src/map/windLayer.ts`）：幾千個粒子（畫面每 480 平方像素一個，900–3,500 個）在 CPU 上順著風場移動（雙線性內插，經度方向除以 cos 緯度，速度依縮放換成固定的像素速度），每個粒子留 28 幀的尾巴：buffer 依 [第幾格][第幾個粒子] 排，一幀只寫最新那一格（粒子數 × 3 個數），著色器依「離最新幾格」算透明度；畫成點（GL_POINTS，WebGL 的線寬只有 1 個裝置像素），投影跟晝夜一樣（地球儀背面裁掉）。粒子在畫面上隨機一點出生（隨機的像素換成經緯度，地球儀外面的重抽），活 50–140 幀，跑出畫面、轉到背面的重生；畫面跳一大段（切換投影、縮放差 1 級以上、中心移出半個畫面）整批重撒。動畫會讓 MapLibre 一直重畫、不會 idle（底圖第一次載入的海色要等 idle 才換回陸地），所以等第一次 idle（最多 4 秒）才開始動；系統設定「減少動態效果」時不動，畫成靜止的風向線。插在 `data-border` 之前，類別網格之後加的會插在它前面（風畫在風速的底色上）。圖例是一個點加 `legend` 的說明。主題可以用 `windAt(風場, 經度, 緯度)` 查游標下的風（`pointer`）。
  - **沿線的文字**（`LinesOverlayDef.lineLabel`，2026-10-28 起）：`(紀錄) => 文字`，多一個 symbol 圖層 `ov-<id>-label`（`symbol-placement: 'line'`、每 260px 重複、字型用底圖地名的字型），放大到哪裡都看得到線的名稱（北回歸線穿過台灣，放大到台灣時也看得到）。文字跟著語言：設定換了（換語言）就重送資料。
  - **點旁邊的文字**（`PointsOverlayDef.pointLabel`，2026-10-29 起，各國在讀什麼）：`(紀錄) => 文字`（空字串不寫），多一個 symbol 圖層 `ov-<id>-label`，寫在點的右邊，彼此碰到時只留一個（有 `sortField` 時留數值大的），時間篩選跟點一樣。這個圖層放在整個樣式的最上面：MapLibre 依圖層由上往下排字，放在底圖地名下面時會被國名、城市名擋掉。字型用底圖國名、城市名的字型（`labelFont(map, /place|country|city/)`：有的底圖第一個地名圖層是水域的斜體）。文字跟著語言，換語言就重送資料。
  - **借用別的主題的資料檔**：`topic: 'power-plants'` 時資料檔從 `topics/power-plants/` 讀（`app/overlays.ts` 的 `useOverlays`）。發電量主題用它加一個預設關閉的「運轉中的電廠」圖層（`{ ...OPERATING_PLANTS, topic: 'power-plants', hidden: true }`），第一次打開才下載，跟發電廠地圖主題共用同一個檔與快取。
- **資料格式**：點用 `common.points_file()`（`PointsData`）：欄位分開存，數值量化成整數（經緯度 0.01°），排序過的欄位（年份、經度）存差分；前端 `decodePoints()` 還原。線用 `common.lines_file()`（`LinesData`），跟鐵路同一種差分編碼，跨 180° 經線的線要先把經度展開成連續的。
- **圖層順序**：線插在機場前面、點插在框選範圍前面，都在 3D 立體圖形之上；`overlays` 裡後面的畫在上面。每個圖層一個 source（`ov-<id>`），換底圖後依 `revision` 重新加上、重送資料。
- **圖例**：左下角「圖層」的每個疊加圖層一列（勾選框加符號），打開時下面列出顏色分級與大小（大小的圓點橫排、數值寫在下面）。匯出圖片的圖層卡片用同一份模型（`overlayKey()`、`exportLayerKeys()`）。
  - 同一組分級說明（規模 5–6 與 6 以上共用的震源深度）只列在第一個圖層下面。
  - 手機（768px 以下）上分級說明預設收起，只留圖層開關與「顯示圖例」：地震主題全部展開時圖層卡片占地圖一半的高度。
  - 選單下面的指標說明（`IndicatorDesc.tsx`）在手機上也只露兩行，真的被截掉時右邊才有「更多／收起」，換指標時收回去：英文的說明常常五、六行，學生能力的平均分數在 375px 寬是 100 px 高，收起來 33 px（2026-10-27 加）。
  - 圖層卡片加上數值圖例比地圖高時（地震主題的每十年次數、死亡人數），`.map-legend` 換欄，數值圖例排到右邊；匯出圖片也一樣改成並排（`drawLegends()`），還放不下才整組縮小。
- **每十年一筆的指標**：`overlayTime` 是數字 n 時，指標的年份代表 n 年的區間（1990 = 1990–1999）。時間軸、側欄的數值卡片取「包含這一年」的那一筆（`yearBin()`）：從「當年的地震」的 1999 年換到「每十年的地震次數」會留在 1990 年代，不會跳到最接近的 2000。

圖層的 `kind: 'flow'` 是**流向圖**（`src/map/flows.ts`），例如貿易主題的出口、進口：
- 設定：`{ kind: 'flow', file: 'flows/{item}/{year}.json', direction: 'export' | 'import' }`。指標本身的 `file` 仍是各國總額（tooltip、排名表、側欄的數值卡片與折線圖用），`layer.file` 是雙邊資料。
- 流向檔格式（`FlowFile`）：`{ item, year, unit: "千美元", export: { TWN: [總額, [["CHN", 金額], …]] }, import: {…} }`，夥伴由大到小、只留前 15 名，總額含所有夥伴。一個子項目、一年一個檔，選了國家才載入。
- 地圖：國家不上色；選取國家後，從它到各夥伴畫大圓弧線（`greatCircle()`，每 2° 一點，經度展開成連續的，日本—美國、紐西蘭—智利跨 180° 經線也不會斷開或橫越整張地圖），夥伴國塗淡底色、在中心點畫小圓點。
- 線寬與金額成正比，以這個國家最大的夥伴為 12 px、最細 1 px；圖例列出三種線寬對應的金額。
- 弧線一律從出口國畫到進口國，沿線由淺到深漸層（`line-gradient`，GeoJSON source 要開 `lineMetrics`），所以淺的一端是出口國。
- 沒選國家時地圖上方提示「點選國家，查看它的出口對象」；選了但那一年沒有資料也會提示。
- 滑到夥伴國、弧線或圓點上，tooltip 顯示雙邊金額與占比；點夥伴會改成選取那個國家。
- 側欄的「主要出口對象／進口來源」讀同一個流向檔（`useJson` 有快取，不會重複下載）。
- **其他主題也可以用**（移民與難民，2026-10-23 起）：
  - 文字：`labels: { export: { partners, main, verb }, import: {…} }`、`pickPartners`、`legendKey` 換掉貿易的「出口對象／進口來源」「由出口國（淺）到進口國（深）」（`flowText(layer)`）；沒給就是貿易的。`verb(選取的國家, 夥伴)` 是 tooltip 的那一句，用 `tr()` 寫兩種語言。
  - 單位：流向檔的 `scale` 是「檔案裡的數值 × scale = 指標的單位」，移民是 1（人）；舊的貿易檔沒有這個欄位，當成 1000（千美元）。
  - `direction: 'larger'`：依選取國家兩個方向的總額，畫比較大的那一邊。難民用這個：收容的比外流的多（土耳其、德國）就畫難民來自哪裡，反過來（敘利亞、烏克蘭）畫逃往哪裡，不必多一個指標。`FlowSelection.direction` 是解析後的方向，顏色、圖例、tooltip 都照它。
  - 移民的 export 是「從這國出去」（來源國 → 目的地），import 是「來到這國」；弧線一樣從起點畫到終點。
  - **國際援助與僑匯**（2026-10-26 起）：export 是援助國給哪些國家、import 是受援國從哪些國家收到援助，同一個流向檔（`flows/<年>.json`）、兩個指標各取一個方向。流向檔多了兩個鍵，前端的流向圖不讀、側欄（`AidPanel.tsx`）讀：`unspecified`（援助國沒有分到特定國家的金額）與 `multilateral`（受援國從多邊機構收到的援助，`[合計, [[機構代碼, 金額], …]]`，機構名稱在 `agencies.json`）。多邊機構在地圖上沒有位置，所以只畫國家之間的弧線（第 8 節第 74 點）。
  - **塑膠廢料**（塑膠污染主題，2026-10-27 起）：流向檔的數值是公噸（`scale: 1`）。這個主題有子項目（排放形式），但只用在排放的指標，流向檔不分子項目；`useFlowSelection()` 原本一律比對流向檔的 `item` 與目前的子項目（換商品時舊的檔不能用），現在只在 `layer.file` 含 `{item}` 時比對，否則選了國家也不會畫弧線。
  - **石油、天然氣與煤**（2026-10-28 起）：流向檔的數值是千公噸、3 位有效數字（`scale: 1000`，換回公噸）。夥伴的第三個值是 1 時，這筆數量是估算的（BACI 原始數量的單價明顯不對，改用金額 ÷ 中位數單價，第 8 節第 90 點）：`flowSelection()` 把它放進 `FlowLink.estimated`，tooltip 多寫「數量是估算的」（字典的 `flowEstimated`）；沒有這個值的流向檔照舊。`TradePanel` 的金額格式改用流向圖指標自己的 `format`（貿易、半導體本來就是美元，畫面不變），這個主題的側欄也重用它列出公噸。
- 國家側欄的數值卡片：跟前面的指標用同一個資料檔的不重複列（移民的「流向：移民來源」就是「移民人數」）；折線圖也用那張卡片的名稱與格式（「移民人數的變化」，不是「流向：移民來源的變化」，2026-10-26 起，`CountryPanel.tsx` 的 `chartIndicator`）。
- 圖例的版面由 `flowLegendModel()` 算，畫面上的圖例跟分享選單下載的圖片共用。3D 模式下流向圖沒有立體圖形，只是把地圖傾斜，弧線仍畫在地面上。
- 貿易做成獨立主題（`src/topics/trade.ts`），沒有併進農業：出口、進口兩個指標剛好就是指標按鈕的「出口／進口」切換，商品用子項目選單，不必另做控制項；農業已經有 6 個指標（下拉選單），流向圖「先點國家」的操作方式也跟其他指標不同；全部商品的貿易也不屬於農業。

## 5. 視覺化規則

| 資料性質 | 圖層 | 例子 |
|---|---|---|
| 總量（可加總） | **比例圓**，面積與數值成正比；地圖上的圓至少 3 px（`scales.ts` 的 `BUBBLE_MIN_RADIUS`），圖例照原本的比例畫 | 人口數、發電量、GDP |
| 比率、密度、人均 | **面量圖**，單一色相分級（最多 7 級） | 人口密度、人均 GDP |
| 細到 1 km 的密度 | **網格點陣圖磚**，同一套橘色循序色、固定的對數分級；國界、hover、點選仍用國家 | 人口密度的「1 km 網格」（第 14 節） |
| 有正負的變化 | **面量圖**，橘↔青綠發散色，中間是中性灰 | 人口年增率、經濟成長率、自給率、農產品貿易收支 |
| 有正負、正值是「熱」或「壞」的變化 | **面量圖**，同一組發散色反過來（`{ type: 'diverging', reverse: true }`）：正值橘、負值青綠 | 暖化（近 10 年平均氣溫與 1951–1980 年的差） |
| 中點有意義的比例（一半以上／以下） | **面量圖**，發散色，中性那一級跨過中點 | 公寓住戶比例（50% 以上多數人住公寓、以下多數住透天） |
| 國家之間的流量 | **流向圖**，大圓弧線，線寬與金額（人數）成正比；出口（移出）青綠、進口（移入）橘（跟貿易收支的「淨出口綠、淨進口橘」一致） | 貿易流向、移民來源與去向、難民 |
| 類別（沒有大小之分） | **類別圖**，每類一色，最多 8 類加「其他」；有強弱的類別用循序色，兩個方向的強弱用發散色 | 主要官方語言、官方地位、首要死因、政體分類（專制 ↔ 民主） |
| 個別的事件、地點 | **疊加的點**，大小與顏色依欄位（例如規模、震源深度），可以跟著時間軸篩選；國家的統計另外做成指標 | 地震、火山、駐外館處 |
| 國旗 | **國旗地圖**：每個國家塗上自己的國旗（瀏覽器畫的點陣圖磚，第 4 節的 `kind: 'flags'`） | 國旗主題 |

總量不畫成面量圖，否則俄羅斯、加拿大這類大國會因為面積大而顯得突出。

- **分級門檻固定**：寫在主題設定裡、所有年份共用，拖動時間軸時顏色才能前後比較。比例圓的大小也是用所有年份的最大值來定。
- **顏色只有一個來源**：`src/theme/tokens.ts`。
  - 介面與側欄圖表用藍色系。
  - **地圖上的資料色另外用 `MAP_TOKENS`**：底圖的海是藍色，資料也用藍色的話，淺色的國家會跟海混在一起。
    - 循序色用橘色。
    - 發散色用橘 ↔ 青綠（ColorBrewer BrBG 的配法）。
    - 比例圓用紫色。
    - 這些顏色都跟原本藍色色階同一階的 OKLCH 亮度，只換色相。
    - 這些顏色以明亮的彩色底圖（藍色的海）為準挑。深色介面、使用者沒自己選過底圖時改用深藍底圖（見下面「底圖切換」），資料色不變。
  - 多系列圖表用 8 個類別色，排列順序用配色驗證工具檢查過色盲分辨度（發電結構的能源配色見 `ElectricityPanel.tsx`）。
  - **地圖的類別色**（`MAP_TOKENS.categorical`）另外選：
    - 圖表的類別色只要求「相鄰的系列」分得開，地圖上任兩個國家都可能相鄰，所以要「任兩色」都分得開。圖表那 8 色在這個條件下只有前 3 色過關。
    - 用 dataviz 的配色驗證工具（OKLab ΔE×100，色盲模擬用 Machado 2009）在約 60 個候選色裡搜尋 8 色：紅色盲、綠色盲下任兩色 ΔE ≥ 10.4（目標 8），一般視覺 ≥ 16.2（下限 15），加上「其他」`#ece8df` 也一樣；每色跟藍色的海（`#9ebdff`、`#a0c8f0`、`#b4cfe0`）、無資料的灰色 ΔE ≥ 12，色相至少差 25°。
    - 結果：`#4fc29f` 薄荷綠、`#9085e9` 淡紫、`#eda100` 琥珀、`#4d9221` 綠、`#f0e442` 黃、`#8a2e00` 鏽紅（`ORANGE[600]`）、`#7b3294` 紫、`#e7298a` 洋紅。
    - 為了讓 8 色兩兩分得開，亮度從深到淺都有，不在圖表類別色的亮度帶（OKLCH L 0.43–0.77）裡，驗證工具會標「亮度帶」未過；這是地圖上的填色，不是畫在卡片上的線條，所以接受。最深的鏽紅、紫在深色介面的圖例上對比約 2:1，圖例一定附文字，也有排名表。
    - 深色底圖上國界改成淺色；填色的不透明度從 0.82 改成 0.94（`DATA_FILL_OPACITY_DARK`，2026-10-28）：0.82 會透出深色的陸地，顏色比圖例暗一截。
  - **河流的顏色**（河流與流域，`src/topics/rivers.ts` 的 `OCEAN_COLORS`，2026-10-28）：細線畫在彩色地形（低地綠、乾燥地帶淺褐、山地褐、冰雪白）與深藍底圖上，不像填色有一整片面積，所以兩種底圖各用一組，同一個大洋是同一個色相、都取自 `MAP_TOKENS.categorical` 的固定位置：
    - 淺色底圖：太平洋洋紅 `#e7298a`（categorical[7]）、大西洋紫 `#7b3294`（[6]）、印度洋鏽紅 `#8a2e00`（[5]）、北冰洋綠 `#4d9221`（[3]）；深色底圖（分類的 `dark`）：洋紅不變、淡紫 `#9085e9`（[1]）、琥珀 `#eda100`（[2]）、薄荷綠 `#4fc29f`（[0]）。categorical 前四色（薄荷綠、淡紫、琥珀、綠）在彩色地形的低地綠、山地褐上 ΔE 只有 11–14，細線看不出來；後四色在深藍底圖上對比 1.0–1.9:1。
    - 內流區是中性色的虛線：淺色底圖近黑 `ink`、深色底圖近白（`ON_DARK`）。中灰（`inkMuted`）在綠色盲下跟洋紅只差 0.8、深灰跟鏽紅一般視覺 13.1，都不過；虛線本身就是第二種編碼，一看就跟流進海的不同，也比實線安靜。
    - dataviz 驗證工具（任兩色、OKLab ΔE×100、Machado 2009）：淺色那組加近黑，一般視覺最小 20.3、紅綠色盲 10.4（洋紅—綠），跟彩色地形的五種地面色、海 ≥ 22.7；深色那組加近白，20.8、10.7，跟深藍底圖的陸地與水 ≥ 25。對比低於 3:1 的（淺色底圖上的洋紅 2.0、綠 1.9，深色底圖上的洋紅 1.9）有圖例文字與 tooltip。
    - 國家的「主要流向」類別圖用淺色那組（填色有面積，深色介面一樣），內流區用類別圖的「其他」色，跟河流的顏色對得起來；側欄的流向長條也是。
  - **日食路徑的顏色**（`src/topics/eclipses.ts` 的 `KIND_COLORS`，2026-10-28）：路徑是半透明的帶子（淺色底圖 0.24、深色 0.32）加外框與中心線，畫在海、彩色地形與深藍底圖上，跟河流一樣兩種底圖各一組、同一類同一個色相，直接取河流驗證過的那兩組裡的三色：日全食紫 `#7b3294`（categorical[6]）→ 深色底圖淡紫 `#9085e9`（[1]），日環食鏽紅 `#8a2e00`（[5]）→ 琥珀 `#eda100`（[2]），混合食洋紅 `#e7298a`（[7]，兩種底圖都是）。全食用最深的紫（本影是暗的）、環食用橘色系（「火環」）。線墊一層細邊（`casing`），滑過時多一圈光暈（`hoverHalo`）。側欄的色塊用淺色那組（跟河流一樣）。
    - dataviz 驗證工具（三色任兩色，2026-10-28）：淺色那組在海（`#a0c8f0`）與淺綠的陸地（用 `#d6e3b4` 近似）上一般視覺最小 ΔE 20.3（紫—鏽紅）、色盲 11.1（洋紅—紫，紅色盲），洋紅在海上對比 2.36:1（有圖例與 tooltip，帶子本身也有外框）；深色那組在深藍底圖上 23.1、14.8，對比都 ≥ 3:1，琥珀的亮度 0.764 超出圖表類別色的亮度帶（跟河流一樣是地圖上的線與面，接受）。
  - **地球的另一邊的顏色**（`src/topics/antipodes.ts`，2026-10-28）：翻過去的陸地是中性的「影子」（`MAP_TOKENS.ink`，淺色底圖近黑 0.3、深色底圖換成近白 0.35，跟其他中性線一樣經過 `ON_DARK`），陸地對陸地是琥珀（`categorical[2]`，0.85／0.8），翻過去的海岸線、國界是中性色的線（0.9 px、國界 0.45 px 虛線）；側欄標出的那一國與標記是紫（`[6]`，深色底圖淡紫 `[1]`）。
    - dataviz 驗證工具（OKLab ΔE×100、Machado 2009），用實際疊在底圖上的顏色比（地圖上會相鄰的組合）：淺色底圖影子疊在海上（`#7288b6`）跟海 17.5（色盲 17.2）、跟陸地 29.7，琥珀疊在陸地上（`#eaab1b`）跟淺綠的陸地 16.1（色盲 14.8）、跟米白 19.5，影子跟琥珀 25.9（色盲 23.7）；深色底圖影子（`#787f8e`）跟海 21.3、跟陸地 16.1，琥珀（`#cb9116`）跟陸地 32.1，兩者 19.2（色盲都 ≥ 15.7）。
    - 試過沒有用的：洋紅當陸地對陸地，淺色底圖很好（跟陸地 30.9），但深色底圖的深藍陸地上紅色盲只差 3.6；琥珀 0.35 當影子，跟海只差 12.4（灰灰的、看起來像海）；白色的影子在淺色的海上只差 10–14。
    - 標出那一國的紫只是輔助（淺色底圖疊在影子上色盲 8.8），主要靠 2 px 的外框加一圈光暈（`hoverHalo`）。
  - **使用者可以換分級色與正負色**（`src/map/palettes.ts`、`PaletteMenu.tsx`，2026-10-27 加）：面量圖與有強弱的類別圖（ordinal、diverging）的圖例標題旁有「配色」按鈕，分級（循序）三組：橘（預設）、紫、綠；正負變化（發散）三組：橘 ↔ 青綠（預設）、紫 ↔ 綠、橘 ↔ 紫。選擇記在這個瀏覽器（localStorage 的 `map-palette`），不放進網址（收到連結的人看到自己選的）。用到分級色、發散色的地方都從 `useMapTokens()` 拿：面量圖、有強弱的類別圖（民主與自由、武裝衝突、護照與簽證、婚姻與家庭…）、圖例、匯出的圖片、側欄與排名表的類別色塊。不換的：類別圖的 8 色、流向圖（出口青綠、進口橘）、地震與颱風等疊加圖層、網格圖層（顏色畫在圖磚裡；網格的圖例沒有「配色」按鈕）。
    - 新的配色照預設橘色每一階的 OKLCH 亮度與彩度、只換色相（紫 320°、綠 150°，彩度乘 0.85 才都在 sRGB 裡），dataviz 驗證工具的 `--ordinal` 檢查亮度單調、相鄰差 ≥ 0.06、單一色相都通過（淺端對背景的對比 1.2:1 不到 2:1，預設的橘也一樣；地圖有圖例與排名表）。
    - 用 OKLab 色差（×100，Machado 2009 色盲模擬）比過：跟海、無資料的灰色，一般視覺紫、綠跟預設的橘差不多（7–8）；紅綠色盲下紫的淺階像亮色街道底圖的淺藍海（2.3）、綠的淺階像無資料的灰（2.7），預設的橘是 5–6，所以預設維持橘色。發散色兩臂同一階之間在色盲下：預設的橘 ↔ 青綠 4.5、紫 ↔ 綠 7.4、橘 ↔ 紫 10.2，所以選單上寫「橘 ↔ 紫（色弱最好分辨）」。
    - **指標說明裡的顏色跟著換**（`palettes.ts` 的 `recolourText`，App.tsx 用在發散色的指標說明與匯出圖片的副標題）：二十幾個正負變化的指標說明寫了顏色（「橘色為經濟衰退、綠色為成長」「rose (orange) or fell (teal)」），換了配色會說錯。說明裡的「橘色／越橘」一律指色階起點那一臂、「綠色／青綠（色）／越綠」指終點那一臂（`reverse` 只是把數值對到另一臂），換成目前配色那一臂的名稱（紫、綠；英文大小寫照原樣，「greenhouse」不受影響）。只用在發散色的指標：國旗主題的「橘色」、地震的紫色點不經過這裡。新寫的正負變化說明要照這兩組字寫顏色。藍色系、青綠色系不提供：淺階跟海太接近（青綠在色盲下 0.8）；紅色跟橘色太像，灰階的中間幾階跟無資料的灰一樣，也不提供。
  - **國旗的顏色是例外**（`src/topics/flags.ts` 的 `FLAG_COLOURS`）：國旗主題的「主要顏色」類別圖與側欄的顏色組成長條用字面上的顏色（紅那一類畫國旗紅、白畫白色），紅色那一類畫成薄荷綠反而誤導；「沒有單一的主要顏色」用 `MAP_TOKENS.categorical` 的淡紫（國旗沒有紫色，也跟白色、無資料的灰分得開）。各色的占比（面量圖）照規則用橘色循序色。
- **主題分類的代表色**（`tokens.ts` 的 `CATEGORY_COLORS`，2026-10-29）：只用在頂列、主題選單、主題總覽的圖示（第 11 節），不用在地圖與圖表。依意義指定色相（社會 10°、經濟 70°、國際 255°、能源 145°、科技 295°、地理 175°，OKLCH），淺色亮度 0.45–0.60、深色 0.58–0.67。dataviz 驗證工具（頂列上相鄰的兩類，OKLab ΔE×100、Machado 2009）：淺色紅綠色盲最小 10.8、一般視覺 18.5，深色 9.0、18.3，跟頁面背景的對比都 ≥ 3:1；淺色那組當白色圖示的底時對比 ≥ 4:1。六色任兩色在色盲下分不開（例如國際藍與科技紫，綠色盲 0.3），所以顏色只是輔助，一定跟分類名稱與圖示一起出現；國際與科技的亮度刻意拉開（淺色 0.55 對 0.45）。
- **地球邊緣的地名**（`worldMapLayers.ts` 的 `sphericalCap`，2026-10-28 加）：地球儀縮小（3.5 級以下）時，底圖的地名（`place`、`water_name` 兩個 source-layer 的文字圖層，五種底圖都是）只留離畫面中心 60° 以內的，用 MapLibre 的 `within` 篩選，移動結束（`moveend`）時更新。原本靠近地球邊緣的地方被壓扁，中東、歐洲的國名擠成一團，還會超出地球畫到太空上。
  - 球冠寫成經緯度的多邊形：經度展開成連續的，包含極點時沿著 85° 緯線封起來（`within` 用麥卡托座標算，極點無限遠），再往東、往西各複製一份涵蓋跨過 180° 經線的部分。
  - 中心移動不到 4° 不重新篩選：每次篩選底圖的圖磚都要重新解析一次（全球視角約 13 ms）。平面地圖、3D、放大以後還原原本的篩選；換底圖是新的樣式，本來就沒有篩選。
  - 拖動地球的途中不更新：轉到畫面上的新地方，放開後地名才出來。
  - 沒有照底圖的國名分級（`rank`）藏：台灣是第 2 級，跟蒙古、哈薩克、瑞典同一級，照分級藏會連台灣一起藏起來。
  - 無頭 Chrome（swiftshader）在換中心後偶爾截到只畫了左上角四分之一的畫面，沒有篩選時也一樣，再截一次就正常，不是篩選造成的。
- **時間軸背後的走勢**（2026-10-30，`TimeSlider.tsx` 的 `TrendArea`、`app/trend.ts` 的 `worldTrend`）：拉桿上面淡淡畫一條世界的走勢（13px 高的面積加細線，推估的年份更淡），一眼看出哪幾年變化大。數值用資料檔的世界合計或平均（`aggregates.WLD`），沒有的話用各國的中位數（那一年有資料的國家不到 20 國、或不到最多那一年的一半時不算）。y 用最小到最大（下面多留 15%）：看的是形狀，從 0 起算的話變化小的指標（母親的平均生育年齡 27–29 歲）整條是一塊平的長方形。只畫連續的量（面量圖、比例圓），類別、年份這種數值（`rankingBars: false`）、不到 3 年的不畫；x 跟拉桿的圓鈕對齊（左右縮進 10px）；不能點、螢幕閱讀器不唸。
- **數字滾動**（2026-10-30，`controls/TweenNumber.tsx`）：側欄的數值卡片換年份、換國家時，數字從原本的值滾到新的值（420 ms，中間的值用指標自己的格式，單位、位數不變）；只有連續的量會滾，類別、年份這種數值直接換。時間軸右邊的年份與播放時地圖上的大年份，新的數字從下面滾上來（`.year-roll`）。播放、拖時間軸時跟國家的顏色一樣縮短或直接換；系統設定減少動態效果時都不動。
- **動畫的時間與曲線統一**（2026-10-30，`styles.css` 的 `--ease-out`、`--motion-fast`（0.15 s）、`--motion`（0.26 s））：按鈕、箭頭、淡入淡出用短的，側欄、抽屜、選單的開合用長的，都是同一條先快後慢的曲線。選單、說明、指令面板打開時淡入並往下滑 4px；桌機的國家側欄從右邊滑進來 14px；手機的抽屜照舊是高度的過渡。減少動態效果時都不動。
- **播放時的大年份**（`App.tsx` 的 `.map-year`，2026-10-28 加）：按下播放後地圖左上角疊大大的年份（桌機 44px、手機 30px，推估的年份旁寫「推估值」），停下後約 1 秒淡出（減少動態效果時直接消失）。有框選結果時它在左上角，年份改放中間。時間軸右邊本來就有年份，但播放時眼睛在地圖上。
- **晝夜的夜色**（晝夜與季節，`src/map/nightLayer.ts`，2026-10-28）：夜半邊依太陽高度分五段，一段比一段暗，不是一片黑：白天不畫、民用曙暮光（太陽在地平線下 0.833°–6°）、航海（6°–12°）、天文（12°–18°）、夜晚。淺色底圖用深藍 `#0b1a3a`，四道邊界各加 0.12、0.10、0.10、0.13 的不透明度（夜晚 0.45：國家的顏色還認得出來）；深色底圖用黑色，0.15、0.12、0.12、0.16（夜晚 0.55，深藍底圖本來就暗）。段與段之間柔和地漸變約 1°（縮小時至少一個像素），看得出是一層一層的晨昏，又不會有鋸齒。太陽直射點是琥珀色（`MAP_TOKENS.categorical[2]`）的圓點加白邊與一圈淡淡的光暈，在海上、陸地、夜色上都找得到。赤道、回歸線、極圈是 1.1px 的中性灰細線（深色底圖淺灰），回歸線與極圈是虛線，沿線寫名稱。白天長度的面量圖用發散色、中性一級是 11.5–12.5 小時（`reverse`：白天長的橘、短的青綠），春分、秋分時全世界都是灰色，夏至、冬至南北半球相反，播放一年時最好看。
- **地圖背景**：地球儀外面是深藍夜空（`tokens.ts` 的 `SPACE_GRADIENT`，畫面、匯出圖片、分享預覽圖共用），邊緣有一圈淡藍色大氣層（`style.ts` 的 `sky`）。2026-10-28 從黑色改成深藍：截了三個版本（黑色、深藍、淺色介面用跟頁面同色調的淺灰藍）給使用者選，淺色頁面中間一大塊黑色是整頁最重的東西，深藍輕一點，又保留地球在太空裡的感覺。
  - **淺色介面時改成很淡的灰藍**（`tokens.ts` 的 `SPACE_GRADIENT_LIGHT`，2026-10-28）：深藍夜空在淺色頁面上是一大塊深色框，跟介面不協調。深色介面、匯出圖片、分享預覽圖照用深藍夜空；3D 傾斜時地平線以上的天空也跟著深淺色（`worldMapLayers.ts` 的 `LIGHT_SKY`、`DARK_SKY`）。
- **彩色地形上的海改成低彩度的藍**（`worldMapLayers.ts` 的 `CALM_SEA` `#98b1d6`，2026-10-28）：原本的 `#9ebdff`（OKLCH 彩度 0.10）比資料的顏色還搶眼。有資料圖層的主題換成彩度 0.06 的藍（水域、湖泊、世界視角的背景、蓋住地形陰影的水域一起換），純地圖、地形圖維持原本的海。挑法：同一色相往下降彩度，找最亮、又跟無資料的灰（OKLab ΔE×100 ≥ 10）、類別圖的淡紫（≥ 12）、最淺的分級色與發散色中間那一級（≥ 12）、紅綠色盲模擬下都 ≥ 9 的；彩度 0.03–0.05 的跟無資料的灰太近或太灰。
- **底圖切換**（`src/map/basemaps.ts`）：
  - 可選彩色地形、亮色街道、淺灰、深色、深藍五種，選擇記在瀏覽器的 localStorage。
  - **沒選過時跟著介面深淺色**（2026-10-28 改）：淺色用彩色地形，深色用深藍（`DEFAULT_DARK_BASEMAP`）。原本深色介面也是亮藍的彩色地形，是整頁最刺眼的一塊。截圖比過純黑的「深色」底圖：海跟地球外面的黑色太空分不開，地名的灰字在橘色上讀不到；深藍的海是藍灰色，地名是淺色。選過底圖的照舊，切換深淺色也不變。分享預覽圖（`og-image.mjs`）固定用彩色地形。
  - 切換時用 `setStyle` 換樣式，再重新加上資料圖層。
  - `WorldMap` 的 `revision` 每次加一，資料相關的 effect 依它重跑，把顏色、比例圓等重新套上。
  - 深色底圖上，鐵路、選取外框改用淺色。
- **選取的國家**（2026-10-28 加強）：外框 2.4px（淺色底圖深色、深色底圖白色），底下墊一圈 6.5px 的光暈（`data-halo`，顏色相反），在深色的填色上也看得出來。比 12 萬 km² 小的國家（台灣、南韓、葡萄牙…與沒有形狀的）再畫一個圓圈標記（`selected-mark`，半徑 11px，白色襯底加深色線），放大到 4–5.5 級時淡出：全球視角下台灣只有十來個像素，原本只靠外框幾乎看不到。
  - **新選到時光暈由寬收窄**（2026-10-29，`worldMapLayers.ts` 的 `SELECT_PULSE_MS`）：光暈從 22.5px、0.35 不透明度在 0.45 秒內收到 6.5px、0.9（ease-out），看得出剛選到哪裡；用 `setPaintProperty` 逐格改 `data-halo` 的寬度（運算式照舊只有選取的國家有寬度）。系統設定減少動態效果時直接畫。
- **沒有資料的國家畫斜線**（2026-10-30，`worldMapLayers.ts` 的 `NO_DATA_HATCH`）：原本只是灰色（`#c9c7c0`），在灰階列印、某些色盲下跟最淺的那一級分不清。現在灰底上蓋一層 1px 的斜線（間距 6px、深灰 42%），圖例與匯出圖片的「無資料」色塊畫同樣的斜線（CSS 的 `NO_DATA_SWATCH`、`exportImage.ts`）。斜線只畫在有上色（面量圖、類別圖）而沒資料的國家；國旗、網格、3D 的立體圖形時不畫；強調圖例某一級時跟其他國家一起淡化。
  - **斜線放在另一個 source**（`nodata`，只有沒資料的國家，`useCountryFills.ts` 在那一組國家變了才 `setData`）：一開始在 `countries` 上加一個 `fill-pattern` 的圖層，結果網址有選國家（`?country=TWN`）時整份國界都不畫（`queryRenderedFeatures` 是 0，沒有錯誤訊息；拿掉圖案填色或改用另一個 source 就好，MapLibre 5.24）。
- **滑過的國家微微加亮**（2026-10-29，`data-hover` 圖層）：除了 1.4px 的外框，再蓋一層 16% 的白色（選取中的國家不蓋），深色的填色上也看得出游標在哪一國。跟 `data-halo` 一樣在 3D 的立體圖形、只留海的底圖時隱藏。
- **狀態畫面**（`src/controls/StatusCard.tsx`，2026-10-29）：資料載入失敗、離線而這個主題還沒存到這台裝置、底圖失敗、側欄沒有資料，都用同一個樣子：圓底的線條圖示（Lucide 的 triangle-alert、cloud-off、chart-no-axes-column，`groupIcons.gen.ts` 的 `UI_ICONS`）、一句標題、一句說明、需要時一顆按鈕（重試、重新整理，都是重新載入頁面）。地圖上的蓋在地圖中間（卡片底色、陰影），側欄的是淡底的一般區塊。錯誤是 `role="alert"`，其他是 `role="status"`。
  - 離線時換到還沒看過的主題：資料抓不到，`useOnline()` 是離線，寫「目前離線，這個主題還沒存到這台裝置」與「連上網路後就能看；看過的主題之後離線也能打開」（service worker 只快取看過的資料，第 13 節），不寫技術性的錯誤訊息。
  - **載入失敗時不畫上一個檔**（`App.tsx` 的 `sourceData`）：`useJson` 載入中會先給上一個檔（換主題時不閃白），2026-10-29 以前失敗了也一直給，離線換主題時地圖與「最高／最低」畫的是上一個主題的數字、套上新指標的單位（「印度 1,463,900,000 美元」）。
  - **小國家的圓圈圈住國名**（`worldMapLayers.ts` 的 `markRadius`，2026-10-28）：底圖的國名差不多在同一個位置，原本固定 11px 的圓圈壓在字上（「台灣」約 26px 寬）。半徑依國名的長度（中日文的字約 13px、拉丁字母約 7px），最少 11、最多 22px。
  - 資料圖層插在底圖「最後一個非文字圖層」之後：蓋在道路上面、文字下面。深色樣式的水域名稱排在很前面，不能用「第一個文字圖層」當插入點。
- **國界只留一條**：
  - 底圖的國界來自 OpenStreetMap，跟上色用的 Natural Earth 國界不完全重合，面量圖開著時會出現兩條錯開的線。
  - 所以面量圖開著時隱藏底圖的國界，改畫跟上色同一份幾何的國界（`data-border`）。
  - 比例圓、路網等不上色的指標則用底圖的國界。
- **放大後**：面量圖的不透明度隨縮放降低，讓底圖的道路、地形透出來。
- **比例圓的最小尺寸**（2026-10-27 加）：照比例，台灣 1 位諾貝爾獎得主跟美國幾百位放在一起時半徑不到 1 px，看不到也點不到。地圖上的圓至少 3 px（`BUBBLE_MIN_RADIUS`），只放大最小的那幾個（手機上最大圓 14 px，約最大值的 5% 以下；桌機約 1% 以下），圖例的圓照原本的比例畫。
- **「無資料」跟「0」要分開**：面量圖上無資料的國家畫成灰色（`MAP_TOKENS.noData`），圖例與匯出圖片的「無資料」色塊用同一個顏色。底圖不跟著介面切深淺色，所以深色介面也一樣；原本色塊是介面的格線色加斜線，深色介面下是深灰，跟地圖上的淺灰對不起來（2026-10-27 改）。
  - **面量圖的圖例把「無資料」放在色階左邊**（`Legend.tsx` 的 `inlineNoData`，2026-10-28）：灰色色塊跟色階同高、字跟刻度同一行，圖例少一行（107 → 92px）。名稱長的（日食的「到 2100 年都沒有日全食經過」）與網格的說明照舊另起一行；匯出的圖片照舊。
- **小國**：面積小於 6,000 km² 的國家（新加坡、加勒比海島國）在低縮放時另外畫一個可點擊的圓點。
- **推估值**：時間軸、tooltip、側欄都會標示，折線圖用虛線；時間軸推估的那一段也畫成虛線（2026-10-28，原本只是淺一點的灰）。
- **側欄的圖表**（`src/charts/`，2026-10-28 照 dataviz 的規則整理，2026-10-29 換成自己畫的 SVG）：
  - **為什麼換掉 ECharts**：全站只用到折線（約 30 處）、堆疊面積與兩張並排長條圖，ECharts 壓縮後卻有 187 KB，手機 3G 上第一次點國家要多等約 1 秒。自己畫的 `Chart.tsx` 加 `spec.ts` 壓縮後約 4 KB，字型、顏色（CSS 變數，深淺色跟著換）、虛線、tooltip 都跟網站一致。
  - **描述與畫圖分開**：`timeSeriesOption`、`stackedAreaOption` 與各主題的側欄產生 `ChartSpec`（`spec.ts`：x 是類別軸或數值軸、y 的格式與範圍、系列 line／area／band／bar、參考線 refs、事件標記 events、線尾名稱、tooltip 函式），`<Chart spec height ariaLabel>` 畫成 SVG。主題要微調時改描述本身（`{ ...spec, y: { ...spec.y, zero: false } }`、`refs` 加一條目標線），不必知道畫圖的細節。
  - **畫法**：y 軸範圍包含所有系列、堆疊的總和、色帶與水平參考線，預設包含 0（`y.zero: false` 不必：身高、氣溫、指標的 `chartZoom`），d3-scale 的 `nice()` 取整數刻度（約 4–6 個）；y 刻度文字的寬度用 canvas 量，左邊留剛好的空間。x 刻度依 `showLabel` 挑，放不下就跳過（前一個的右緣之後至少 6 px），貼著左右邊的靠內對齊。推估的部分從推估前一年接著畫虛線；前後都沒有值的孤立點畫成小圓點（ECharts 會整個不見）。
  - **圖例是 HTML**，放不下一列自己換行（ECharts 的圖例不換行，民主、學術論文的英文版原本要手動多留一列的高度，2026-10-29 拿掉）；線是一小段線、虛線系列是虛線、面積與長條是方塊。一條線時不放圖例（標題就是它的名稱）。
  - 歷年折線（`timeSeriesOption`，30 幾個主題的側欄也用它）：2–4 條線時線的尾端也寫名稱（文字色、不用線的顏色，最寬 56px、長的國名截掉；太近時上下推開，至少隔 12 px），有推估時寫在虛線那一段；5 條以上只留圖例。線 2px、格線淡。
  - 堆疊面積（`stackedAreaOption`）：各層之間 1.5px 的背景色分隔線（dataviz 的 2px 間隔，邊緣各吃一半）。
  - **tooltip**：滑過圖時依 x 對齊最近的位置（類別軸）或最近的資料點（數值軸，`tooltipXs`），畫一條指示線（長條圖是整個類別的淡色底），tooltip 放在指示線右邊、放不下放左邊、再不行貼著圖的邊，窄的小圖裡名稱換到下一行（`max-width: min(240px, 100%)`）。觸控：點一下或左右拖，放開手指 tooltip 留著，點圖外面才收（觸控放開時也會觸發 `pointerleave`）；圖上 `touch-action: pan-y`，上下照常捲動側欄。
  - **事件標記**（`events.ts`、指標的 `events`）：在那一年畫一條點線，上緣寫短名稱（名稱外圈描背景色，壓在線上也讀得到；跟前一個重疊時往下一行）。只標影響很大、年份明確的：COVID-19（2020，平均壽命、國際觀光、經濟成長率、失業率）、金融海嘯（2008，經濟成長率、失業率；多數國家的谷底在 2009 年）、1918 流感（1800 年起的平均壽命）、中國的生育政策（1980 一胎化、2016 全面二孩、2021 三孩，只標在中國的總生育率與出生數）。只跟某些國家有關的寫 `countries`。
  - **載入中畫灰色色塊**（`src/panels/Skeleton.tsx`）：側欄的程式還在下載時畫國名、四張數值卡片、一張圖的形狀（`PanelSkeleton`）；指標資料還沒到時，數值卡片原本先寫「無資料」再跳成數字，改成灰色色塊；折線圖、主題自己的側欄區塊也一樣。色塊淡淡地閃，減少動態效果時不閃；螢幕閱讀器讀到「載入中…」。
- **側欄的第一張圖不必捲動**（2026-10-28 改）：年份接在英文名與代碼後面（「Taiwan · TWN · 2023 年」，原本自己一行），數值卡片的上下留白少一點；1440×900 的桌機選了國家時，第一張折線圖連橫軸都看得到（原本橫軸被切掉，要捲動）。
- **比較國家**（`src/panels/ComparePicker.tsx`，2026-10-28 加）：側欄數值卡片下面的「＋ 加入比較」再加最多 3 個國家（`COMPARE_MAX`），記在網址的 `cmp=JPN,KOR`（分享出去看到的一樣；不留瀏覽紀錄）。
  - 折線圖多畫它們的線，顏色照類別色的固定順序：這個國家是第 1 色（藍），比較的國家依加入的順序是橘、綠松、黃（`HUE_ORDER`），世界維持灰色。4 條以內線的尾端寫名稱，5 條只留圖例（側欄圖表的規則）。
  - 數值卡片多列比較的國家：色點、國名（太長截掉）、數值，沒有資料寫「—」；名次、占全球只寫這個國家的。
  - 加國家的輸入框只列目前指標有資料的國家（跟頂列的搜尋同一套比對），是 combobox（↑↓、Enter、Esc；Esc 不會順便取消選取的國家）。
  - 取消選取國家時比較一起清掉；選到正在比較的國家時，把它從比較裡拿掉。主題自己的側欄區塊（`panelExtra`）不受影響。
- **tooltip 的名次與小折線**（`src/map/Sparkline.tsx`，2026-10-28 加）：面量圖、比例圓的 tooltip 在數值旁寫名次（跟側欄的數值卡片同一套：同分同名次、總數是有資料的國家數，類別、`unranked`、計數類的 0 不寫），下面畫這個國家的歷年小折線（132×30，沒有座標軸，兩端寫年份，目前的年份一個點，推估的年份虛線；少於 3 個點不畫）。不必點開側欄就看得到趨勢。
- **數值最高、最低的國家**（`src/map/Extremes.tsx`，2026-10-28 加）：地球儀一次只看得到半個世界，排名靠前的國家常在背面，寬螢幕上地球兩旁又空著。地圖至少 1000px 寬時（`EXTREMES_MIN_WIDTH`），左下角圖例上面列出數值最高、最低各 5 個國家（總量只列最多的 5 個，最少的多半是 0 的小地方），點一下就選取、地圖飛過去（跟從搜尋選到一樣）。類別、沒有名次、數值是年份的指標與網格不列，手機不列。
- **分級圖例可以滑過、點選**（`Legend.tsx` 的 `ClassHighlight`，2026-10-28 加）：原本只有類別圖的圖例可以。面量圖的色塊改成按鈕，滑過或聚焦時只亮那一級的國家（其他淡化，跟類別圖同一個 feature-state `dim`；分級用 `bisectRight`，跟 d3 的 `scaleThreshold` 一樣），點一下固定、再點取消，下面一行寫「1萬–2.5萬：32 個國家/地區」。這一行沒有強調時也留著（空的，固定 15px 高、不撐寬圖例，太長以「…」截掉）：圖例貼著地圖下緣，原本文字出現時圖例變高、色塊被往上推 15px，游標滑出色塊、文字消失、色塊掉回來，一直閃（總生育率的圖例滑過色塊下半部就會）。觸控裝置沒有「滑過」，點了色塊才有字，空著的那一行只是白白多一行，所以 `(hover: none)` 時空的就不佔位置（2026-10-29）。原本色塊上方還有一排每一級國家數的細長條，2026-10-28 拿掉，國家數只寫在色塊的說明與下面那一行。3D（立體圖形沒有淡化）與網格的圖例不能點。
- **表格版**：每張地圖都有「排名表」檢視（同分的國家名次相同、依國名排，跟側欄的名次一致；例如超過 WHO 空氣品質指引值的人口比例有一百多國是 100%，都是第 1 名）；側欄的組成資料用長條清單直接寫出數值與占比，不必靠 hover。
  - **長條用地圖的顏色**（2026-10-28 改）：面量圖是那一級的顏色（`categories.ts` 的 `choroplethColors`、`classIndex`，跟 `choroplethScale` 同一套但不依賴 d3，排名表在首頁的 chunk 裡）、比例圓是地圖上的紫色；原本一律藍色，跟地圖對不起來。最淺的幾級加一圈淡邊，長條高 8px。深色介面時最深的幾級（深褐 #611e00、墨綠 #046041）跟深色卡片只有 1.4–2.3:1，改成一圈淡白的邊（白 35%，跟卡片約 3.8:1），顏色照樣跟地圖一樣（2026-10-30）。
  - **比 10 年前**（2026-10-28 加，`RankingTable.tsx` 的 `previous`，App 的 `CHANGE_YEARS`）：10 年前那一年也有資料時多一欄「比 2013 年」。總量（比例圓）寫增減的百分比（「▼ 11%」），比率寫差多少、用指標自己的格式（「▼ 1.01 人」），單位是 % 的寫「個百分點」（「▼ 2.4 個百分點」，不會跟百分比混淆）。箭頭用中性的文字色（很多指標沒有好壞之分），螢幕閱讀器讀「增加／減少」。類別、沒有名次的、數值是年份的（`rankingBars: false`）、不隨時間變化的指標不寫。
  - **長條緊接在國名後面**（2026-10-28 改）：寬螢幕上國名欄只佔國名的寬度、數值欄 `width: 100%`（表格自動排版原本把多的寬度依內容寬度分給各欄，國名欄分到最多，1440px 寬時長條從畫面中間才開始）。手機照舊（國名可以換行）。
  - 從搜尋選到的國家：原本就會捲到那一列並標亮（`is-selected`）。
  - **洲別篩選**（2026-10-28 加）：表格標題下的「全部、亞洲、歐洲、非洲、北美洲、南美洲、大洋洲」，名次照寫全球的名次，長條以那一洲的最大值為準。洲別是 `public/data/regions.json`（`build_geo.py` 的 `build_regions()`，Natural Earth 1:10m 4.1.0 的 `CONTINENT`，公有領域，跟 `geoindex.py` 判斷位置用的同一份）：北美洲含中美洲與加勒比海（按鈕的說明有寫）；Natural Earth 寫「Seven seas」的島（馬爾地夫、模里西斯、塞席爾…）與沒有自己單位的地方（留尼旺、法屬圭亞那、托克勞…）照聯合國 M49 的地理分區寫在 `REGION_FIXES`；`countries.json` 的國家沒有洲別時 pipeline 會報錯。篩選不記在網址。
  - 名次是 `stats.ts` 的 `rowRanks`（77、77、79），側欄是 `rankOf`。原本排名表用列號，跟別國同值的國家兩邊差 1：台灣最富有 1% 的財富占比跟約旦同為 27.8%（第 77 名）、2025 年通膨率跟菲律賓同為 1.7%（第 139 名）、性別不平等指數（`lowerIsBetter`）跟阿聯同為 0.040（第 13 名，跟性平處公布的一致）。

### 3D 立體地圖

地圖右上角的「3D」按鈕把目前的指標畫成高度（MapLibre 的 `fill-extrusion`），狀態記在網址的 `3d=1`。

| 圖層類型 | 3D 畫法 | 高度 |
|---|---|---|
| 面量圖（比率、密度、人均） | 整個國家拉高，顏色不變 | **依色階分級**：每一級等高，級內再依數值線性內插（頭尾兩級用相鄰一級的寬度往外推） |
| 比例圓（總量） | 在比例圓的位置立一根柱子，底面固定（半徑 90 km） | **與數值成正比**（線性），最高的柱子是所有年份的最大值 |
| 不上色（路網、純地圖） | 只有傾斜與旋轉 | — |

- **為什麼面量圖用分級高度**：
  - 比率類數值偏態很大（人口密度從個位數到上萬），直接用數值當高度，大部分國家會是平的。
  - 跟顏色同一套固定門檻，年份之間可以比較，也適用有正負的發散色（最低一級最矮）。
  - 圖例的色塊畫成階梯，並寫明「每升一級色階加高一階」。
- **為什麼總量用柱子而不是把國家拉高**：國家拉高時體積 = 面積 × 高度，俄羅斯、加拿大會因為面積大而顯得特別多，跟「總量不畫成面量圖」是同一個理由。柱子的底面固定，高度才是唯一的編碼，所以用線性；數值很小的國家仍然有一個看得到的圓盤。
- **小國**：面積小於 6,000 km² 的國家，在 3D 面量圖裡另外畫一根半徑 45 km 的柱子（放大到 5 級以後改用本身的形狀），否則拉高後只剩一條線。
- **高度隨縮放遞減**：放大一級高度減半，柱子在畫面上的高度大致不變；同一個縮放下各國的高度仍然成比例。最高高度在縮放 2 級時是 4,000 km（柱子）與 1,000 km（面量圖最高一級）。
- **3D 時固定用平面地圖**：
  - MapLibre 5.24 的地球儀畫得出 `fill-extrusion`，但 `queryRenderedFeatures` 查立體圖形時用的是平面的矩陣（原始碼註明是暫時的 hack），地球儀上 hover、點國家全部失效（不傾斜也一樣）。
  - 所以 3D 時自動換成平面，「球」按鈕變灰並用 tooltip 說明原因；離開 3D 回到使用者原本選的投影。
- **選取與 hover**：立體圖形不能加外框，改成介面的藍色（選取深藍、hover 淺藍）。不用「同色變淺」，否則在橘色色階上會被看成低一級。
- **圖層順序**：立體圖層排在疊加圖層（鐵路、機場、框選範圍）前面，那些畫在立體圖形上面，才不會被整片蓋住；地名標籤一樣在最上面。平面時鐵路仍然在比例圓下面（用 `moveLayer` 切換）。
- **操作**：
  - 進入 3D 時傾斜到 50°；右鍵或 Ctrl＋拖曳旋轉、傾斜，觸控用雙指，鍵盤用 Shift＋方向鍵。
  - 指北針按鈕把方位轉回正北、傾角回到 50°。
  - 平面上色時關閉旋轉與傾斜（沒有回正按鈕，避免地圖被轉歪）。
  - 3D 時不能框選：地圖可以旋轉、傾斜，拖出來的經緯度範圍跟畫面上的矩形對不起來。
- **匯出圖片**：3D 時圖片就是目前傾斜的畫面，圖例也換成階梯色塊或柱子（`Legend.tsx` 的 `columnLegendModel`、`exportImage.ts` 的 `ImageLegend`）。
- **效能**：
  - 面量圖 3D 是把 1:50m 國界整份拉高（牆面的頂點數約為邊數的 4 倍），柱子只有約 200 個 24 邊形。
  - 無頭 Chrome 用純 CPU 繪圖（swiftshader，等於沒有顯示卡的最差情況）旋轉時：3D 面量圖全球 25 fps、歐洲 17 fps，柱子 17 fps，交通主題加上鐵路 10 fps。有 GPU 的筆電、手機會快很多。
  - 旋轉到新的方位、第一次出現的圖磚要在 worker 裡建立立體網格，那一下會頓一點。

### 地形圖層（海拔主題）

`TopicDefinition.terrain` 打開地形圖層（`src/map/terrain.ts`，WorldMap 的 `terrain` prop）。

- **圖磚**：AWS Terrain Tiles（Mapzen 建立、AWS Open Data 託管）的 terrarium PNG，公開、不需金鑰、可以跨網域讀取（`Access-Control-Allow-Origin: *`），最大 15 級，一張約 50–150 KB。
- **標示**：raster-dem source 帶 `attribution`，地圖右下角自動列出「Terrain Tiles (Mapzen, AWS Open Data: SRTM, GMTED2010, ETOPO1, EU-DEM, ArcticDEM, NED, …)」，連到 [joerd 的標示說明](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)（各資料來源要求標示）。頁尾與匯出圖片的資料來源也有。
- **分層設色**：MapLibre 5.6 起的 `color-relief` 圖層，−500 → 6,000 m 由綠、黃、褐到灰白。這是地形圖慣用的配色（好認出平原與山地），不是單一色相的循序色，所以圖例是連續色條、刻度等距（`reliefLegendModel()`，畫面與匯出圖片共用）。側欄的高度分布長條用同一組顏色（`reliefColor()`），高山的灰白色加一圈細框才看得到。
- **海面不上色**：圖磚含海底地形，分層設色與陰影插在底圖的水域圖層下面，由海面、湖面蓋住；死海、裏海窪地這類低於海平面的陸地照樣上色。
- **面量圖上的陰影**：陰影移到國家顏色上面（`hillshade-exaggeration` 0.4），看得出起伏。陰影也會蓋過海面（看得到海底地形），所以再疊一份底圖的水域（`relief-water`，複製底圖第一個 `source-layer: water` 的填色圖層）蓋回去。左下角「圖層」的「地形陰影」可以關掉（`LayerVisibility.hillshade`）。
- **3D**：有 `terrain` 的主題按 3D 時改用 `map.setTerrain()`（另一個 raster-dem source `dem-3d`，MapLibre 建議跟陰影分開），不畫立體國家與柱子，國家的顏色貼在地形上。
  - 垂直誇張倍率依縮放：`2^(5.5 − 0.55 × 縮放級數)`，限制在 1.5–30 倍。全球視角時山脈只有地球半徑的千分之一，要放大很多倍才看得出；放大到城市時接近實際比例。縮放結束（`zoomend`）時才換，因為 `setTerrain` 每次都重建地形。
  - **地球儀上也可以**：MapLibre 5.24 的地球儀畫得出立體地形，`project`／`unproject` 與 `queryRenderedFeatures` 都考慮了地形（實測玉山座標反算誤差小於 0.01°，點得到台灣），所以地形的 3D 不必換成平面，「球／平面」按鈕照常可用。立體國家（fill-extrusion）在地球儀上查不到的限制不變。主控台會出現一次「calculateFogMatrix is not supported on globe projection」，不影響畫面。
  - **切換底圖前先拿掉地形**：3D 地形開著時直接 `setStyle`，MapLibre 會拿舊樣式的地形去畫新樣式，丟出「Cannot read properties of undefined (reading 'shaderPreludeCode')」。新樣式載入後 `revision` 加一，地形的 effect 重新加上；新樣式還沒載入時縮放結束也不換倍率（`setTerrain` 會丟「Style is not done loading」）。
- **下載量**：source 一直都在，但沒有看得見的圖層或地形用到時不會下載圖磚，其他主題不受影響（實測 0 張）。
  - 地球儀全球視角（1280×800）要 31 張、約 2.5 MB。
  - 地形圖或地形陰影開著時，把彩色地形底圖自己的 Natural Earth 陰影圖層隱藏（`baseRastersRef`，被分層設色或國家顏色加陰影蓋住，看不出差別），同一視角省下 31 張、約 3.2 MB，所以海拔主題的下載量跟其他主題差不多。關掉地形陰影的面量圖再顯示回來。
- **快取**：service worker 的 `terrain-tiles`（cache first，200 張、30 天，見第 13 節）。

## 6. 框選估算

人口主題可以在地圖上畫框，估算框內人口（`src/map/boxEstimate.ts`、`app/hooks.ts` 的 `useBoxEstimate`）：

1. 框存成經緯度範圍 `[西, 南, 東, 北]`，記在網址的 `bbox=`。
   - 跨 180° 經線時西 > 東，計算時拆成兩段。
   - 舊網址的 `box=` 是 Equal Earth 投影座標，讀取時會換算。
2. **網格人口**：`npm run data -- population-grid` 把 JRC GHS-POP R2023A 的 2020 年 30 角秒（約 1 km）網格彙整成 0.1° 網格，寫到 `topics/population/grid.json`（約 7.5 MB，gzip 後約 1.6 MB，第一次框選時才載入）。
   - 每個 1 km 像素先依地圖本身的國界（`geo/countries-50m.json`）歸到國家，所以一個跨國界的網格會拆成好幾筆。
   - 原始檔用逐列區塊讀取（每次 256 列），記憶體固定在幾百 MB 以內，全部約 2 分鐘。
3. **框內加總**：網格是經緯度對齊的，框內人數 = 跟框重疊的比例 × 網格人數。框邊切過的網格依重疊比例計入，拖動時數字才會連續變化。
4. **年份縮放**：網格只決定國內怎麼分布，總量用 WPP：某國的框內人口 = 框內網格人數 ÷ 該國網格總人數 × 該國當年 WPP 人口。所以時間軸仍然有意義，但國內分布固定是 2020 年，離 2020 年越遠越不準。沒有 WPP 資料的區域（南極洲等）用世界總人口的變化縮放。
5. **陸地面積**：國界在經緯度上用 Sutherland–Hodgman 演算法裁切到框內，再算球面面積，用來顯示「平均每 km²」。

框選結果列出框內人口最多的國家，以及各自「占該國人口」的比例。

**國家歸屬的處理**（`pipeline/topics/population_grid.py`）：
- 1:50m 的海岸線比 1 km 網格粗，孟買、香港、里約這類沿海城市有不少像素落在所有國界外（約 1 億人）。這些像素往外找最近的國家，最多約 20 km。
- 1:50m 沒有形狀、離岸更遠的小島（例如澎湖），歸給 0.6° 內最近的國家。再遠的（例如聖安德烈斯島）維持「地圖上沒有國界的小島」，全球約 86 萬人。
- 地圖跟 WPP 劃分不同的地方，改成照 WPP 算，見第 8 節第 13 點。

## 7. 主題現況

| 主題 | 地圖指標 | 側欄額外區塊 | 資料來源 | 年份 |
|---|---|---|---|---|
| 地圖（純地圖） | 不上色，只看底圖；點國家會放大到該國 | — | OpenFreeMap、OpenStreetMap | — |
| 人口 | 總人口、密度（國家平均，或切到 1 km 網格）、年增率、年齡中位數、總人口（1800 年起）；可框選估算 | — | UN WPP 2024；1 km 網格與框選用 JRC GHS-POP R2023A；1800 年起用 Gapminder（CC BY 4.0，第 8 節第 98 點） | 1950–2100（2024 起推估）；1800 年起的 1800–2023（1950 年以前標估計值）；1 km 網格 1975–2030 每 5 年一期（2025 起推估）；框選的網格是 2020 年 |
| 生育率與高齡化 | 總生育率（發散色，中性一級跨過替代水準 2.1）、65 歲以上人口比例、扶老比、人口金字塔的形狀（類別圖：年輕型、壯年型、高齡型）、母親的平均生育年齡、沒有小孩的女性比例（時間軸是出生年）、總撫養比（不寫名次）、扶幼比、出生數（比例圓） | 人口金字塔（男女五歲年齡組，比例尺固定為 1950–2100 年最大的一組，推估年份調淡；沒有小孩的女性比例不畫） | UN WPP 2024（中推估）；台灣也用 WPP，附註對照內政部戶政司與國發會人口推估（2026 至 2075 年）；沒有小孩的女性比例用 Human Fertility Database（HFD Lite，含台灣）與 OECD Family Database SF2.5 | 1950–2100（2024 起推估）；沒有小孩的女性 1935–1981 年出生 |
| 出生的季節 | 出生最多的月份（類別圖，12 個月：四季色系 × 深淺，自己驗證的配色） | 這一年 12 個月每日平均的出生數（長條，顏色同地圖）、比全年平均多幾 %、依登記月份的標註；出生最多的月份的變化 | UNdata 人口統計資料庫表 55；台灣用內政部統計處（按登記月份） | 2000–2025（各國最近的年份不同，地圖用 10 年內最近一年） |
| 婚姻與家庭 | 女性初婚年齡（預設）、男性初婚年齡、15 歲以上有偶比例、30–34 歲未婚比例、粗結婚率、粗離婚率、非婚生子女比例、單人家戶比例、單親家戶比例、三代同堂比例、隔代家戶比例、60 歲以上獨居比例、同性伴侶的法律地位（類別圖：同性婚姻／民事結合等其他全國性的承認／沒有全國性的法律承認，每年年底的狀態）、一夫多妻的法律地位（類別圖：承認／只承認穆斯林的／只依習慣法承認／不承認，只有 2026 年） | 男女初婚年齡的變化、粗結婚率與粗離婚率的變化（各一張折線圖）；台灣另外列近 8 年的結婚、離婚對數與其中的同性伴侶 | UN World Marriage Data 2019、UNdata（Demographic Yearbook 的結婚、離婚對數）、Eurostat、OECD Family Database、聯合國家戶規模資料庫與老人居住安排資料庫（2026 年版）、WPP 2024；台灣用內政部戶政司、內政部統計查詢網與主計總處家庭收支調查（含家庭組織型態）；同性伴侶、一夫多妻依英文維基百科自行整理（CC BY-SA 4.0），一夫多妻的附註摘錄 Pew 的普及程度 | 1970–2025（聯合國的普查、調查多半到 2010 年代，地圖用 10 年內最近一年；粗率與非婚生 5 年內；單親、三代同堂、隔代、老人獨居 15 年內）；同性伴侶 1989–2026；一夫多妻 2026 |
| 城市 | 城市地圖（預設，不上色，畫約 1.1 萬個城市的點：面積與人口成正比，每 5 年一期跟著時間軸換，還不是城市的年份不畫，縮小時只畫大城市）、都市化率（住在城市與城鎮、半密集區的比例）、住在城市的比例、最大城市占全國人口、百萬人口城市數（比例圓）、最大城市的人口（比例圓）、建物面積（比例圓）、人均建物面積、建物面積比 1975 年多幾倍 | 這個國家最大的城市（人口、每 km² 人數、比 10 年前；前 10 個，其餘收起來，最多 60 個）；台灣：UCDB 的城市跟涵蓋它的縣市戶籍人口對照 | JRC GHSL：GHS-UCDB R2024A（Urban Centre Database 2025，城市與多時期的範圍、人口、面積）、GHS-COUNTRY-STATS R2024A（各國依城鄉程度的人口、建物面積），都是 CC BY 4.0；Wikidata（城市的中文名稱，CC0）；台灣對照內政部戶政司的村里人口 | 1975–2030 每 5 年一期（2025、2030 是推估） |
| 人均收入 | 人均 GDP（名目、PPP）、GDP 總額、經濟成長率、人均 GDP（1800 年起，PPP，2021 年國際元） | — | IMF WEO（含台灣），IMF 未涵蓋的 17 個地區用 World Bank 補；1800 年起用 Gapminder（1990 年起同世界銀行，之前主要是 Maddison Project 回推） | 1980–2031（2026 起推估）；1800 年起的 1800–2024（1950 年以前標估計值） |
| 發電量 | 總發電量、人均用電、再生/低碳/燃煤/核能占比、碳排強度 | 發電結構堆疊面積圖＋各能源長條 | Ember | 2000–2025 |
| 產業結構 | 農/工/製造/服務業占 GDP、三業就業占比 | GDP 結構與就業結構對照 | World Bank WDI；台灣用主計總處 | 1960–2025 |
| 工業 | 製造業附加價值、五大類占製造業比重、中高科技占比、粗鋼產量、水泥產量（兩個都是比例圓，各疊 GEM 的鋼鐵廠、水泥廠的點：依狀態上色、大小是年產能，2026-10-30 加）、各產業占出口比重 | 製造業組成、台灣 25 個製造業細項、商品出口結構 | World Bank WDI（UNIDO）、Harvard Atlas、主計總處；粗鋼與水泥用 USGS Minerals Yearbook 2023，廠用 Global Energy Monitor 的 GIST（2026 年 9 月版）與 GCCT（2026 年 7 月版） | 生產面 1963–2025（多數國家到 2022）、出口 1995–2024、粗鋼與水泥 2019–2023 |
| 農業 | 22 種農產品的產量、出口量、進口量、自給率；農業總產值、農產品貿易收支；有機農地的比例、有機農地面積（比例圓） | 主要農產品（產值）、主要進出口品項 | FAOSTAT（QCL、TCL、QV；有機農地用土地利用 RL） | 1961–2024（有機農地 2004–2024） |
| 關鍵礦產 | 19 種礦產（稀土、鋰、鈷、鎳、天然石墨、錳、鎵、鍺、錫、鎢、釩、鈮、銻、黃金、鉑、鈀、銅、鋁土礦、鹽，子項目；黃金、鹽 2026-10-30 加）的產量（比例圓，預設稀土）、占全球產量、蘊藏量（比例圓，鹽沒有）、占全球蘊藏量；出口、進口流向圖（2026-10-30 加，指標自己的子項目：稀土金屬與化合物、永久磁鐵、鈾礦砂與天然鈾，第 8 節第 155 點） | 主要生產的礦產（全球前 5 名而且占 1% 以上，或占 5% 以上，附名次與占比）；流向指標改列主要出口對象與進口來源（重用 TradePanel） | USGS Mineral Commodity Summaries 2020–2026 年版（各章 PDF 的世界產量與蘊藏量表）；貿易用 CEPII BACI HS92（2000–2024） | 產量 2018–2025（2025 年是初估；鍺只到 2020）；蘊藏量 2019–2025；台灣不是生產國（noValue） |
| 便利商店與連鎖品牌 | 品牌（子項目：7-Eleven、全家、Lawson、所有便利商店、麥當勞、星巴克、肯德基、Subway、IKEA、Costco）的每百萬人店數（預設 7-Eleven，各品牌自己的門檻）與店數（比例圓）；放大到 5 級以上畫出選定品牌的每一家店（一個品牌一個檔，選到才下載） | 各品牌在 OSM 上的店數、每百萬人、公司公布的店數與涵蓋率，公司店數的出處；所有便利商店的數量與標示最多的品牌 | OpenStreetMap（Overpass API，ODbL；這個主題的資料檔是衍生資料庫，同樣 ODbL）；人口用 UN WPP 2024 的 2026 年；公司公布的店數（年報、10-K、法說會簡報、官網，`pipeline/sources/chain_official.py`）只寫在附註、tooltip 與側欄 | 2026-10-26 的快照（沒有歷年資料） |
| 最古老的公司 | 1700 年以前成立的公司（比例圓，時間軸是成立年份，累積）；疊 Wikidata 有位置的公司的點 | 這國在這一年以前成立、還在營業的公司（成立年份、產業） | 英文維基百科「List of oldest companies」（CC BY-SA 4.0，資料檔同樣授權）、Wikidata（座標、中文名） | 成立年份 578–1699 |
| 貿易 | 出口、進口流向圖（點選國家畫出前 15 大夥伴的弧線）；全部商品、農產品合計與農業主題的 22 種農產品、二手衣（舊衣 HS 6309，BACI HS92，1995 年起）、25 種商品的流向（汽車、手機、藥品、黃金、鑽石、回收物、化肥等，金額；回收物與化肥另有公噸的「出口（公噸）」「進口（公噸）」）；貿易依存度（商品與服務出口加進口占 GDP，面量圖） | 主要出口對象、主要進口來源（金額與占比） | CEPII BACI（全部商品）、FAOSTAT 詳細貿易矩陣（農產品）、世界銀行 WDI（貿易占 GDP）；台灣的貿易占 GDP 用主計總處國民所得統計自行計算 | 全部商品 2017–2024；農產品 2000–2023；商品 1995–2024（純電車、手機、鋰電池 2017–2024）；貿易依存度 1960–2025（世界合計到 2024） |
| 交通 | 路網地圖（鐵路線＋機場點）、鐵路長度、鐵路密度、主要軌距（類別圖，7 類＋其他）、標準軌的比例、機場數、大型機場數；地鐵站數（比例圓，地鐵站依開通年份累積出現）、第一條高鐵（通車年份）；航空旅客量（比例圓）、每人搭機次數；最繁忙的機場（國家不上色，畫每年旅客量前 50 名的機場，比例圓） | 鐵路長度、機場清單（IATA 代碼）；地鐵指標時改列今年營運中的地鐵站數、各路網的通車年份與站數、高鐵路線與通車年份；軌距指標時改列各種軌距的長度、雙軌距與資料來源 | Natural Earth 1:10m 鐵路、OurAirports；地鐵與高鐵用 Wikidata；軌距用 CIA 世界概況（factbook.json 鏡像），亞美尼亞、南蘇丹用英文維基百科；航空旅客用世界銀行 WDI IS.AIR.PSGR（ICAO）與 UN WPP 2024，台灣附註用民航局的機場旅客；最繁忙的機場用英文維基百科「List of busiest airports by passenger traffic」（固定版本，數字是 ACI 的初步統計） | 鐵路與機場是目前的快照；地鐵站 1863–2026、第一條高鐵 1964–2026；軌距是各國 2008–2023 年的資料（放在 2026 年）；航空旅客 1970–2023；最繁忙的機場 2020–2025 |
| 各國的航空公司 | 營運中的航空公司（比例圓，2026 年是現在營運中的，拖時間軸看每一年營運中的） | 這國在這一年營運中的、已停業的、之後才成立的航空公司：成立與停業年份、IATA／ICAO 代碼、國家航空 | Wikidata | 1909–2026 |
| 觀光鐵道與登山鐵路 | 觀光鐵道地圖（不上色，畫保存鐵路、齒軌鐵路、登山鐵路、森林鐵路的點：依開通年份累積出現，年份不詳的另一個圖層預設關閉）、各國的條數（比例圓，2026 年） | 這國的觀光鐵道與登山鐵路：種類、開通年份 | Wikidata（用 QLever 查詢） | 1820–2026 |
| 最長的直飛航線 | 最長航線前 30 名的條數（比例圓，預設）、在這國起降最長的一條（km）、停飛的前 30 名的條數（比例圓）；地圖上畫現行前 30 名的大圓弧（紅，線寬依距離）與停飛的（灰虛線）、起訖機場 | 在這國起降的航線：名次、航空公司與班號、距離、表定時間、機型、首航日或最後一班 | 英文維基百科「Longest flights」（固定版本，CC BY-SA 4.0）、OurAirports | 2026 年 10 月的現況（沒有時間軸） |
| 纜車與索道 | 纜車地圖（不上色，畫往復式空中纜車、吊廂纜車、纜索鐵道的點：依開通年份累積出現、停用的畫到那一年，年份不詳的另一個圖層預設關閉） | 這國的纜車：種類、開通與停用年份、長度 | Wikidata | 1850–2026 |
| 航運與港口 | 貨櫃吞吐量（TEU，比例圓，預設）、航運連結指數（UNCTAD 的 LSCI，每年各季的平均）、商船隊（船旗國，載重噸，比例圓）、商船隊（船東國，實質船東所在國，比例圓）、造船量（總噸，比例圓）、航運密度（不上色，約 5 km 網格，只有網格）；疊加圖層：World Port Index 的 3,806 個港口（大小是港口大小、顏色是港口類型，縮小時只畫中、大型港口；滑過看港口班輪航運連結指數 PLSCI 與 30 個主要港口自己公布的 2025 年吞吐量）；IMF PortWatch 的 28 個航運咽喉（大小是 2025 年通過的貨船，滑過看各類船與 2019 年）；Wikidata 有英文維基條目的運河與海峽（縮小時只畫條目多的） | 主要港口（大小、PLSCI、公布的吞吐量與出處）、台灣各港的貨櫃裝卸量（2001 年起，堆疊面積）、船旗國的船隊組成（5 種船、堆疊面積＋長條）、這國船東的船掛哪國的旗、掛這國旗的船的船東在哪裡 | UNCTAD Data Hub（CC BY 3.0 IGO）、NGA World Port Index（公有領域）、World Bank/IMF Global Shipping Traffic Density（CC BY 4.0）、各港口公布的吞吐量（引用事實）、臺灣港務公司（政府資料開放平臺 8368）；航運咽喉用 IMF PortWatch（IMF 條款），運河與海峽用 Wikidata | 貨櫃 2010–2024；LSCI 2006–2026（2026 年第 1–3 季）；船旗 1980–2026；船東 2014–2026；造船 2014–2025；PLSCI 2026 年第 3 季；航運密度 2015 年 1 月–2021 年 2 月；航運咽喉 2025 年（2019 年起每天的通過數加總成整年） |
| 大航海時代的航海日誌 | 船數與航線（不上色：那一年每艘船的航線，每天正午的船位連成線，依國籍上色〔英、荷、西、法，其他灰色〕，滑過看船名、公司、航程、日期與船長；國家的值是那一年有航海日誌的船數，只給 tooltip 與側欄） | 那一年本國的船（各航程的出發地、目的地、日期與船長，滑過或點一下在地圖上標出）、經過附近（航線離國界 100 公里以內）的船與上一次、下一次有船經過的年份；台灣的附註 | CLIWOC 2.1（PANGAEA，CC BY 3.0）、Natural Earth 1:50m 國界、Marine Regions 的 IHO 海域（判斷航線有沒有穿過陸地） | 1662–1855（114 個有船位的年份，大部分在 1750–1854） |
| AI | 數據中心數、AI 算力（H100 等效）、重要 AI 模型數、token 用量（OpenRouter）、Claude 使用量占比與人均指數、生成式 AI 使用率 | 數據中心營運者、逐月 token 用量、已知 AI 叢集、近期重要模型、Claude 用途 | OpenStreetMap、Epoch AI、OECD.AI（OpenRouter）、Anthropic Economic Index、Microsoft AI Diffusion | 數據中心為 2026 年快照；算力 2015–2025；模型 2010–2025；token 2025–2026（每月平均）；使用量 2025–2026 |
| 半導體 | 出口占全球比例（預設）、進口占全球比例、出口與進口流向圖（點選國家畫前 15 大夥伴）；5 種商品：積體電路（預設）、分離式半導體、晶片合計、半導體設備、另列的光電元件（太陽能電池、LED）、太陽能模組與太陽能電池（HS 2022，2022 年起） | 主要出口對象、主要進口來源（金額與占比，重用貿易主題的 `TradePanel`） | CEPII BACI（HS 2017 版；太陽能用 HS 2022 版）；台灣的附註對照財政部統計資料庫的進出口貿易統計 | 2017–2024（太陽能 2022–2024） |
| 軍事 | 軍費（美元，比例圓）、軍費占 GDP、兵力（比例圓）、兵力占勞動力、海外軍事基地與外國的軍事基地（流向圖：點國家畫出派駐國→駐在國，一國一條線） | 海外軍事基地的兩個指標：這國在哪些國家有基地、哪些國家在這裡有基地（有爭議的寫明） | SIPRI（2011–2025 年子集，非商業使用）、World Bank WDI（IISS）、英文維基百科「List of countries with overseas military bases」（CC BY-SA 4.0） | 軍費 2011–2025；兵力 1985–2020；基地 2026 |
| 溫室氣體排放（氣候） | 人均排放（預設）、年排放量（比例圓），兩者都有「氣體」子項目：全部溫室氣體（預設）、二氧化碳、甲烷、氧化亞氮、含氟氣體；累積二氧化碳（1750 年起）、人均消費端二氧化碳、每單位 GDP 的二氧化碳、土地利用變化的二氧化碳（人均，發散色，負值是淨吸收） | 各種溫室氣體的堆疊面積圖＋長條；排放來源（依選的氣體：全部溫室氣體是燃煤、天然氣、石油的二氧化碳加上工業製程、化石燃料開採、農業、廢棄物等部門；二氧化碳依燃料；甲烷、氧化亞氮依部門；含氟氣體依種類）；燃料燃燒的二氧化碳用在哪裡（CEDS 的比例：發電、工業、運輸、住商…）；台灣跟環境部國家溫室氣體排放清冊比較（歷年折線、各氣體對照表、森林等吸收） | 二氧化碳：Global Carbon Project（Our World in Data 轉載，CC BY 4.0）；甲烷、氧化亞氮、含氟氣體：EDGAR 2026（JRC，CC BY 4.0）；用途：CEDS v_2025_03_18（PNNL，CC BY 4.0）；人口：UN WPP 2024；台灣：環境部《2026 年中華民國國家溫室氣體排放清冊報告》（政府資料開放授權條款） | 二氧化碳 1850–2024；甲烷、氧化亞氮 1970–2025；含氟氣體與全部溫室氣體 1990–2024；消費端 1990–2023；每單位 GDP 到 2022；土地利用變化 1850–2024 |
| 全球二氧化碳觀測站 | 觀測站的二氧化碳濃度（不上色，畫 NOAA 合作採樣網 73 個固定站的點，顏色是時間軸那一年的年平均濃度；國家的值是那一年有在採樣的站數） | 這個國家的觀測站與每站的月平均濃度曲線 | NOAA GML 合作全球大氣採樣網（瓶採樣的月平均，CC0 1.0） | 1968–2025 |
| 氣溫與降雨 | 年平均氣溫（預設）、年降雨量、一年下雨幾天（CRU TS 的雨日，日雨量 ≥ 0.1 mm；台灣附註列中央氣象署測站）、日照時數（CRU CL v2.0 的 1961–1990 年平均，日照百分比換算成小時）、暖化（近 10 年平均比 1951–1980 年高多少；可以從國家平均切到 0.5° 網格） | 每月氣溫與降雨（1991–2020 年平均與選定年份：氣溫折線、降雨長條，加每月數字表） | CRU TS v4.10（東英吉利大學 CRU、NCAS），日照用 CRU CL v2.0，各國的值依地圖國界自己用面積加權算；台灣用中央氣象署交叉比對（雨日與日照用開放資料 C-B0026-002 的測站逐月資料） | 1901–2025（日照只有 1961–1990 年平均）；暖化 1910–2025；0.5° 網格 1910–2025 每年一期 |
| 空氣品質 | PM2.5 年平均濃度（人口加權，預設）、超過 WHO 指引值（5 μg/m³）的人口比例、戶外空氣污染死亡率、戶外與室內空氣污染死亡率（SDG 3.9.1；兩個死亡率都是年齡標準化） | — | WHO GHO（SDG 11.6.2、SDG 3.9.1）、WashU ACAG SatPM2.5 V6.GL.02；台灣用環境部 PM2.5 手動監測站 | PM2.5 2010–2023（台灣 2015 年起）；超過指引值的比例 1998–2023；死亡率只有 2021 年 |
| 水資源與森林 | 人均可再生淡水資源（預設）、水資源壓力（SDG 6.4.2）、安全管理的飲用水（SDG 6.1.1）、森林覆蓋率、森林面積年變化率（發散色） | — | FAO AQUASTAT（總可再生水資源）÷ UN WPP 2024 人口、World Bank WDI（AQUASTAT 的水資源壓力、WHO/UNICEF JMP）、FAO 全球森林資源評估 FRA 2025；台灣用經濟部水利署、農業部林業及自然保育署 | 人均水資源 1961–2023；水資源壓力 1987–2022（台灣從缺）；飲用水 2000–2024；森林只有 FRA 的報告年 1990、2000、2010、2015、2020、2025（年變化率標在後一年，2000–2025；台灣是 1990、2010 年的調查，之後顯示 2010 年的值） |
| 塑膠污染 | 人均排放（預設）、年排放量（比例圓），兩者都有「排放形式」子項目：全部塑膠、塑膠碎片、露天焚燒的塑膠；人均塑膠垃圾、沒有垃圾收集的人口、河川流入海洋的塑膠（比例圓，加上河口的點）、塑膠廢料出口、進口（流向圖，公噸） | 排放的來源（未收集的垃圾、棄置場、亂丟、回收分選、收集與運輸）與 90% 區間、塑膠垃圾產生量與收集服務；排放最多的河口；塑膠廢料這一年的主要對象與 1995 年起的歷年堆疊面積；台灣另有環境部的一般廢棄物去處（2011–2025）、回收率、回收的塑膠，與財政部 HS 3915 進出口值對照 BACI | Cottom 等人（2024）SPOT 模型（Dryad，CC0 1.0）、Meijer 等人（2021）的河口（figshare，CC BY 4.0）、CEPII BACI HS92 版的 HS 3915（Etalab 2.0）；台灣的官方統計用環境部、財政部（只在附註與側欄） | 排放與收集 2020；河川 2015；貿易 1995–2024 |
| 電子垃圾 | 每人產生的電子垃圾（預設）、電子垃圾產生量（比例圓）、正式回收的比例、正式回收量（比例圓） | — | UNITAR、ITU，Global E-waste Monitor 2024 的附錄表（CC BY-NC-SA 3.0 IGO，資料檔同樣授權） | 2022 年 |
| 電動車 | 電動車新車占比（預設）、電動車保有量（比例圓）、電動車保有量占比、公共充電樁（比例圓）、車樁比（每個公共充電樁對應的電動輕型車）、停售燃油車的年份（循序類別圖：2025 年以前、2030、2040、2050 年代、沒有宣布）與停售的狀態（類別圖：已立法或已實施、政策目標、只簽格拉斯哥宣言；兩個都是 2026 年的快照，2026-10-30 加） | 純電與插電式混合（新車銷售堆疊面積圖、當年新車與年底保有量的組成）、公共充電樁的速度（慢充／快充／超快充與快充占比） | IEA Global EV Data Explorer（Global EV Outlook 2026）；台灣用交通部公路局統計查詢網的小客車領牌與登記數；停售燃油車用英文維基百科「Phase-out of fossil fuel vehicles」的國家表 | 2010–2025（充電樁、車樁比 2012–2025；台灣 2012 年起，充電樁與車樁比從缺） |
| 數位 | 網路使用率、行動電話用戶（每百人）、固網寬頻用戶（每百人） | — | World Bank WDI（ITU）；台灣用數位發展部數位近用調查、NCC 電信統計 | 1990–2024 |
| 網路速度 | 下載速度（預設，可以切到約 2 km 網格）、上傳速度、延遲（`lowerIsBetter`）；子項目「網路」：固網（預設）、行動網路。都是各圖塊平均依測試次數加權的中位數，時間軸的年份是那一年的第 3 季（`timeAxis`） | 固網與行動網路的下載速度歷年變化（虛線是全世界）、選定那一季的下載（中位數與平均）、上傳、延遲、測試次數、有人測的圖塊數，每一項跟全世界對照；台灣另列 NCC 的 4G、數位發展部的 5G 定點量測跟 Ookla 行動網路的對照 | Speedtest® by Ookla® Global Fixed and Mobile Network Performance Maps（AWS Open Data，CC BY-NC-SA 4.0；這個主題的資料檔與網格圖磚是改作，同樣以 CC BY-NC-SA 4.0 提供）；台灣的對照用 NCC 新聞稿（引用數字）、數位發展部「行動通訊速率量測」（政府資料開放平臺 161791，CC0） | 2019–2026 年，每年第 3 季（7–9 月）；網格是 2026 年第 3 季；官方量測 2020–2023 |
| 開發者與開源 | 每千人的開發者（預設）、開發者人數（比例圓）、開發者增加率（比前一年第 1 季）、每個帳號的推送次數（一季）、流向：對外協作（這裡的開發者貢獻給哪些經濟體的專案）、流向：外來協作（哪些經濟體的開發者貢獻給這裡的專案）；6 個指標，下拉選單；時間軸的年份是那一年的第 1 季（`timeAxis`） | 每一季的開發者帳號數與推送次數（地圖只取第 1 季，這裡每一季都畫）、選定那一季的開發者、組織、公開版本庫、推送跟全世界對照、最多人用的程式語言與授權條款（推送的開發者人數與占比）、主要的貢獻對象與外來協作者 | GitHub Innovation Graph（CC0 1.0）；人口用 UN WPP 2024 | 2020–2026 年，每年第 1 季（1–3 月）；側欄每季到 2026 年第 1 季 |
| 學術論文 | 每百萬人論文數（預設）、論文數（比例圓）、國際合著比例、開放取用比例、高被引論文比例（前 10%，到 2024 年，2017 年標 `methodBreak`）、流向：合著國家（點國家畫前 15 名的弧線）；前 5 個有子項目「領域」：全部領域（預設）、理工、生命科學、醫學與健康、人文社會；6 個指標，下拉選單 | 歷年的論文數（核心來源與 OpenAlex 全部來源對照）、選定那一年的論文數、國際合著、開放取用、高被引跟全世界對照、開放取用與國際合著比例的變化（虛線是全世界）、26 個學科的分布與 4 個領域的占比、主要合著國家（讀流向檔） | OpenAlex（CC0 1.0，API 的 group_by）、CWTS 核心來源（CC0 1.0）；人口用 UN WPP 2024；台灣的 SCI 論文對照用科技部《科學技術統計要覽》2019 年版（教育部統計處轉載） | 2000–2025（高被引到 2024） |
| 健康 | 平均壽命、健康平均餘命、不健康的年數（這兩個有兩性／女性／男性的選擇器）、嬰兒死亡率、孕產婦死亡率、五歲以下死亡率、人均醫療支出、醫療支出占 GDP、自付醫療費占比、人均自付醫療費（國際元）、政府與健保支出占比、每千人醫師數（醫病比）、每千人護理人員、每千人病床數、長照機構床數（每千名 65 歲以上）、65 歲以上使用長照的比例、安寧緩和醫療：基層醫療、社區或居家（類別圖：普遍提供／沒有）、基本醫療保障的主要來源（OECD 的四類）、醫療的主要財源（英文維基的五類）、全民健保的開辦年份、平均壽命（1800 年起） | 男女平均壽命對照 | UN WPP 2024、World Bank WDI（WHO）、WHO Global Health Estimates 2021（健康平均餘命與同一次的平均壽命）；台灣壽命與死亡率用內政部簡易生命表，健康平均餘命用衛福部（只有男女分開），醫療支出、醫事人力與病床用衛福部，長照床數用衛福部的護理之家加社家署的老人長期照顧機構，人均自付的購買力平價用 IMF；OECD Health Statistics（長照）、WHO NCD 國家能力調查（安寧緩和醫療）、OECD Health System Characteristics Survey 2023、英文維基百科（健保制度、開辦年份）；1800 年起用 Gapminder（1950 年起主要是 IHME GBD） | 壽命與死亡率 1950–2023（台灣 1992 年起，男女 1970 年起）；1800 年起的 1800–2023（1950 年以前標估計值）；醫療支出 2000–2023；醫師、病床 1960–2022；護理人員 2000–2022；長照床數 1995–2025（台灣 2015 年起）、使用長照 2000–2025；安寧緩和醫療 2015–2021；健保制度 2023（OECD）、2026（維基） |
| 疾病 | 首要死因（類別圖）、死亡最多的癌症（類別圖，子項目兩性／女性／男性）、慢性病過早死亡率（30–70 歲）、癌症死亡率（年齡標準化）、糖尿病盛行率、成人肥胖率、愛滋感染率、結核病發生率、瘧疾發生率、慢性病／傳染病／傷害死亡占比、每百萬人的透析人數（次國家的地區畫成點）、公立醫療能不能洗腎（類別圖） | 死因結構（三大類占比與世界對照） | WHO Global Health Estimates 2023、WHO GHO（NCD-RisC、NCD CCS）、World Bank WDI（UNAIDS、WHO）、USRDS 2025 年報；台灣用衛福部死因統計（ICD-10）與衛生福利統計指標、WPP 年齡別人口 | 死因與過早死亡 2000–2023（台灣 2008 年起）；糖尿病 1990–2022；肥胖 1980–2024；愛滋 1990–2024；結核病、瘧疾 2000–2024；透析 2023（韓國、印尼、蒙特內哥羅 2022）；公立醫療能不能洗腎 2015–2021 |
| 疫苗與防疫 | DTP3 接種率（預設）、麻疹疫苗第一劑、麻疹疫苗第二劑、HPV 疫苗（女孩第一劑）、零劑兒童（沒有打過任何一劑 DTP，比例圓）、COVID-19 確診死亡（累計，每 10 萬人）、完成 COVID-19 基礎劑的人口比例、超額死亡（累計，每 10 萬人，估計；跟確診死亡同一組門檻） | 兒童常規疫苗的接種率（四種疫苗一張折線圖）、COVID-19 的累計確診死亡與超額死亡（每月）、至少一劑與完成基礎劑（每月）；台灣另外列衛福部死因統計的 COVID-19 死亡與疾管署通報的確診死亡 | WHO/UNICEF WUENIC 2025 年版（WHO GHO，1980–1999 年用世界銀行轉載）、WHO 的 HPV 估計、UN WPP 2024（零劑兒童的存活嬰兒）、Our World in Data 的 COVID-19 資料（WHO COVID-19 dashboard 的死亡、OWID 整理的接種）、JHU CSSE、The Economist 的超額死亡模型（MIT）；台灣用疾管署「預防接種統計」的完成率、衛福部死因統計 | DTP3、麻疹第一劑 1980–2025（台灣 2015 年起），麻疹第二劑 2000–2025，HPV 2010–2025，零劑兒童 2000–2025；確診死亡 2020–2025（每年年底），完成基礎劑 2021–2023，超額死亡 2020–2023（側欄到 2024 年 6 月） |
| 平均身高 | 男性平均身高（預設）、女性平均身高（男女各一組門檻，男性的高 12 公分）、男性與女性比 1896 年長高（發散色，±2 公分以內是中性）、男女身高差距（依出生年，1896–1996 年出生的人在 18 歲時）；19 歲男性身高、19 歲女性身高（1985–2019 年，依量測的年份）。時間軸的年份上面寫「出生年」或「年份」 | 男女的平均身高：依出生年與 19 歲兩張折線圖（虛線是世界平均）、選定那一年的 95% 不確定區間；台灣另外列國健署國民營養健康狀況變遷調查各年齡組的實測與 NCD-RisC 對照 | NCD-RisC《A century of trends in adult human height》（eLife 2016）、《Height and body-mass index trajectories of school-aged children and adolescents》（Lancet 2020）；世界平均用 UN WPP 2024 的 15–19 歲人口加權；台灣也在 NCD-RisC 裡，對照國健署 2013–2016、2017–2020 年的成果報告 | 出生年 1896–1996；19 歲 1985–2019 |
| 血型分布 | 最多的血型（類別圖，預設：O、A、B 型；AB 型沒有一國是最多的）、O、A、B、AB 型的比例（Rh 陽性加陰性）、Rh 陰性的比例 | 8 種血型的長條、這一國的數字在維基百科引用的出處（連結），沒有出處的寫「維基百科沒有註明出處」 | 英文維基百科「Blood type distribution by country」第一個表（revid 1378379911，CC BY-SA 4.0，資料檔依同樣的授權分享） | 不分年份（各國資料的年代不同，timeless） |
| 菸酒 | 吸菸率（全部、男性、女性，三個用同一組門檻）、人均飲酒量（純酒精）、主要酒類（類別圖：烈酒、葡萄酒、啤酒、其他）、室內全面禁菸的場所（0–8 類）、電子菸的規範（類別圖：禁止、事實上禁止、要處方或只在藥局、合法） | 各類酒有登記的人均消費量（長條，顏色跟地圖上的類別一樣） | WHO GHO（菸草使用趨勢估計、全球酒精與健康資訊系統 GISAH）、WHO MPOWER（室內禁菸）、英文維基百科「Regulation of electronic cigarettes」；台灣的吸菸率用國健署國人吸菸行為調查，飲酒量從缺，禁菸場所與電子菸依菸害防制法編碼 | 吸菸率 2000、2005、2007、2010、2015、2020、2022–2024 年，2025、2030 年是推估；飲酒量 2000–2024；主要酒類 1961–2024；室內禁菸 2007–2024（每兩年）；電子菸 2026 |
| 教育 | 平均受教育年數、高等教育粗在學率、政府教育支出占 GDP、成人識字率、0–2 歲上托育的比例、學前教育毛入學率、國中教師的法定年薪（購買力平價美元）、小學每班人數、小學生師比、小學一年上課天數、高中讀職業類課程的比例、開學月份（類別圖，12 個月）、義務教育年數、小學入學年齡（類別圖） | — | UNDP 人類發展報告、World Bank WDI（UNESCO）；開學月份、生師比、技職比例用 UIS（CC BY-SA 4.0）；托育用 OECD Family Database PF3.2，教師薪資、每班人數、上課天數用 OECD Education at a Glance；台灣用教育部、內政部，學制依法規 | 受教育年數 1990–2023；在學率 1971–2024；教育支出 1971–2023；識字率 1980–2024（每年只有幾十國）；托育 2005–2025；學前 1990–2024；教師薪資、上課天數只有 2025；每班人數 2013–2025；生師比、技職 2005–2025（後四者與托育、學前用 5 年內最近一年） |
| 學生能力（PISA） | 平均分數（預設數學）、低成就比例（未達第 2 級）、高成就比例（第 5 級以上）、比上一次、跟 2012 年比（兩個都是發散色）、男女差距（男生 − 女生，發散色）；子項目是數學、閱讀、科學；只有部分地區參加的（北京上海江蘇浙江、烏克蘭的部分地區、伊拉克的庫德斯坦地區、塔吉克的杜尚別）畫成點 | 三個科目的歷次分數跟 OECD 23 國平均（各一張小圖）、每一次的分數與名次；台灣另外列臺灣 PISA 國家研究中心公布的名次 | OECD《PISA 2025 Results (Volume I)》附錄 B1 的表（CC BY 4.0）；台灣的分數與名次對照臺灣 PISA 國家研究中心（臺師大）的記者會簡報 | 數學 2003、閱讀 2000、科學 2006 年起的每一次 PISA 到 2025 年；男女差距 2015 年起；只收參加 2025 年的 91 個國家與經濟體 |
| 大學入學考試 | 主要的入學方式（類別圖：全國統一入學考試／高中畢業會考當入學資格／各校申請審查／各校自辦考試，tooltip 與附註寫各國的考試名稱） | — | 依英文維基百科「List of admission tests to colleges and universities」「List of secondary school leaving qualifications」自行整理（CC BY-SA 4.0）；台灣依大考中心改成學測與分科測驗 | 只有 2026 年（timeless） |
| 觀光 | 國際旅客（比例圓）、觀光收入（比例圓）、觀光收入占出口、旅客與人口比 | — | World Bank WDI（UN Tourism）；台灣用交通部觀光署、中央銀行 | 1995–2020 |
| 飲食 | 熱量供給、蛋白質供給、脂肪供給、動物性食物占熱量、主要主食（類別圖：米、小麥、玉米、其他穀物、薯類，依熱量，2026-10-29 加，第 8 節第 110 點）、主要主食占熱量、21 種食物的人均供給量（肉類、牛豬禽肉、水產、乳品、蛋、穀物、米、小麥、玉米、薯類、乾豆類、蔬菜、水果、糖、植物油、酒類；咖啡、茶、可可，2026-10-28 加，咖啡 2010 年起，數字不可靠的年份不畫，第 8 節第 97 點）、營養不足人口比例 | 熱量從哪裡來（9 類食物的堆疊面積圖＋長條）、5 類主食各提供多少熱量（長條，顏色跟主要主食的地圖一樣） | FAOSTAT 糧食平衡表（新版 FBS、舊版 FBSH）與糧食安全指標；台灣也是 FAOSTAT，側欄附上農業部《糧食供需年報》的數字對照 | 1961–2023（2010 年換方法）；營養不足 2001–2024（三年平均） |
| 各國的特色食物 | 子項目是乳酪、麵包、甜點：原產的種類（比例圓，不排名、沒有排名表的長條與折線） | 這國原產的乳酪、麵包、甜點清單（目前選的放最前面，維基百科條目多的排前面） | Wikidata | 不分年份 |
| 語言 | 主要官方語言（類別圖）；30 種語言各自的使用人口比例、使用人數（比例圓）、官方地位（類別圖）；主要語系（類別圖，依使用人口）；語言數（比例圓）；主要語系與語言數疊 Glottolog 每種現存語言的點（依語系上色） | 會說的語言（比例與官方地位）、Glottolog 語言數與瀕危語言數 | Unicode CLDR 49、Glottolog 5.3；台灣用 109 年人口及住宅普查 | 單一快照（標示為 2026 年） |
| 住宅 | 公寓住戶比例（44 國）、自有住宅率（47 國）、平均每戶人數（191 國）、居住擁擠率與住房負擔過重率（37 國，只有歐洲）、都市貧民窟人口比例（194 國） | 住宅類型組成（獨棟、雙併連棟、公寓、其他；台灣依建築樓層） | Eurostat EU-SILC、OECD 可負擔住宅資料庫、UN DESA 家戶規模資料庫、World Bank WDI（UN-Habitat）；台灣用內政部房屋稅籍、主計總處家庭收支調查 | 住宅類型 2004–2025、自有 2005–2025、每戶人數 1991–2025、擁擠與負擔 2004–2025、貧民窟 2000–2022（每兩年）；各國只顯示 3–10 年內最近一年的資料 |
| 海拔 | 地形（分層設色＋陰影，3D 是立體地形）、沙漠高原與平原（地形上疊 Natural Earth 的 175 個沙漠、高原、盆地、平原與窪地，範圍與名稱）、國土在山區的比例、平均海拔、最高點、最低點、低於海平面的土地占比（只畫有的 52 國）、海拔 500／1,000／2,000 公尺以上的土地占比、沿海低地（低於 5 公尺且跟海相連）占比、平均坡度；地形與山區比例兩個指標疊上 GMBA 的 291 個主要山系（範圍與名稱，面也滑得到） | 高度分布長條、最高點與最低點（名稱、位置）、主要山脈（境內面積最大的山系） | USGS GMTED2010、Wikidata；台灣用內政部 100 公尺 DEM 交叉比對；地圖上的地形是 AWS Terrain Tiles；山脈用 GMBA Mountain Inventory v2 | 不隨時間變化（DEM 主要是 2000 年的 SRTM），沒有時間軸 |
| 河流與流域 | 河流地圖（預設，不上色：HydroRIVERS 的河道依最後流進的大洋上色、線寬依平均流量，縮小時只畫大河，放大到 4 級以上依畫面下載分區的小河；滑到河上看名稱、流進的海、流量與集水面積，同一個水系的幹流與支流一起標出；滑到國家看國土流向各大洋的比例）、主要流向（類別圖：太平洋、大西洋、印度洋、北冰洋、內流區）、流向各大洋（面量圖，子項目是四個大洋，不排名）、內流區比例（不排名）、水壩數、水庫總庫容（面量圖；水壩的點：Global Dam Watch 約 4 萬座依庫容畫大小、依完工的年代上色，年份不明的灰色，縮小時只畫大水庫；河流地圖上是預設關閉的圖層） | 國土流向各大洋的 100% 長條、國內流域面積最大的 8 個河流系統（流進的海、全流域面積、河口流量、長度；滑到名稱在地圖上標出整個水系，點一下把地圖移過去） | HydroRIVERS v1.0（WWF HydroSHEDS，HydroSHEDS 授權協議）、Marine Regions 的 IHO Sea Areas v3 與 Global Oceans and Seas v1（CC BY 4.0）、Natural Earth 河流中心線（公有領域）、Wikidata（CC0）；台灣的主要河川依水利署的中央管河川對到河口；水壩：Global Dam Watch v1.0（CC BY 4.0），台灣用水利署的 40 座公告水庫（政府資料開放授權條款）、Wikidata 的座標與水利署網站的完工年份 | 不隨時間變化（流量是 1971–2000 年的長期平均，HydroRIVERS 2019 年發布），沒有時間軸 |
| 晝夜與季節 | 晝夜地圖（預設，不上色：選定那一刻的夜半邊、民用／航海／天文曙暮光、太陽直射點，赤道、回歸線與極圈；國家的值是首都此刻的太陽高度，排名表依它排）、白天長度（發散色，中性一級跨過 12 小時）、晝長年較差（一年中白天最長與最短的差）、正午太陽高度、時鐘與太陽（首都的平均太陽正午比 12:00 早或晚多少，標準時間，發散色）、月亮（不上色：看得到月亮的半個地球與邊界、月下點，國家的值是首都此刻的月亮高度）；都不排名，以首都計算 | 以首都計算（經緯度、時區）、月亮指標另列此刻的月相、亮面、月出月落、月下點與接下來的四個主要月相、選定那一天的日出日落與白天長度、那一年每一天的白天長度（折線，標出選定的那天）、春分夏至秋分冬至（當地日期）的白天長度、國土伸進極圈的國家另列圈內一個城鎮的極晝與極夜期間 | NOAA Solar Calculator 的公式（Meeus《Astronomical Algorithms》，美國政府著作；春分、夏至等用 Meeus 第 27 章）、國家小檔案的 Wikidata 首都（CC0）、IANA 時區資料庫（tzdata 2026e，公有領域）；月亮用 Astronomy Engine 2.1.19（MIT） | 時間是某一刻（`clock`）：預設是現在，可以選 1900–2100 年的任何一天與時間，播放一天或一年 |
| 海洋與漁業 | 專屬經濟海域面積（比例圓，預設；海外領地各自計算，內陸國是 0）、海域是陸地的幾倍（面量圖）、捕撈漁業產量、養殖漁業產量（比例圓）、養殖占漁業產量（發散色，中性一級跨過 50%）、人均漁業產量；疊加圖層：專屬經濟海域的界線（Marine Regions 的界線性質：200 浬外緣、條約或判決、等距中線、共同管理區、未解決的畫虛線，滑過看兩邊與性質）；海鮮出口、海鮮進口（流向圖，HS 第 03 章） | 捕撈與養殖的變化（堆疊面積）、主要的水產種類（FAO 的 ISSCAAP 物種組，捕撈與養殖各一個長條清單）、在哪些 FAO 漁區捕撈、專屬經濟海域的組成（夏威夷、阿拉斯加這類的部分）、依主權國欄位的合計與海外領地、跟其他國家重疊主張或共同管理的海域；台灣另列漁業署《漁業統計年報》各漁業種類的產量跟 FAO 對照；海鮮的指標是貿易主題的主要出口對象、進口來源 | Marine Regions Maritime Boundaries Geodatabase 第 12 版（VLIZ，CC BY 4.0）、FAO FishStat 全球捕撈與養殖產量（CC BY 4.0）、FAOSTAT 土地利用（陸地面積）、UN WPP 2024（人口）；台灣的對照數字用漁業署《漁業統計年報》；海鮮的貿易用 CEPII BACI（HS92 版） | 專屬經濟海域是第 12 版（2023）的單一快照；捕撈與養殖 1950–2024（漁業署的對照到 2025）；海鮮的貿易 1995–2024 |
| 氣候分區（柯本） | 氣候分區地圖（預設，不上色：0.1° 網格的 30 種柯本－蓋格氣候類型，Beck 等人的配色；滑到任一點看那裡的類型，國家的值是面積最大的類型）、主要氣候帶（類別圖：A 熱帶、B 乾燥、C 溫帶、D 冷溫帶、E 極地，面積最大的）、跟 1991–2020 年不同（面量圖：氣候類型改變的面積比例）；子項目是 2041 年以後的排放情境（SSP2-4.5、SSP5-8.5） | 那個時期的氣候類型（面積比例、比 1991–2020 年增減幾個百分點）、6 個時期各氣候帶的面積比例（堆疊長條） | Beck 等人 2023（figshare v2，2026-01，CC BY 4.0）、Natural Earth 1:10m 國界 | 1901–1930、1931–1960、1961–1990、1991–2020 四個歷史時期，2041–2070、2071–2099 兩個推估時期 |
| 冰河、海冰與海平面 | 冰河變薄了多少（面量圖，公尺水當量，1976 年起累計，預設）、冰河少了多少冰（比例圓，Gt）、海冰邊緣（不上色：北極 9 月與南極 2 月的海冰邊緣，1979 年起累積到那一年，一年一條線，依年代上色，虛線是 1981–2010 年的中位數；滑過看那一年的海冰範圍）、海平面上升速度（不上色：1993–2025 年 0.5° 網格依速度分 7 級，滑到海上看那一格；國家的值是沿海 200 公里內的平均，給 tooltip 與排名表） | 冰河數與面積、全世界冰河累計少了多少（Gt、海平面 mm）、那一年北極與南極的海冰範圍（跟 1979 年與最少的一年比）、沿海的海平面速度與全球平均；目前的指標排在最前面 | WGMS AMCE 2026-02-10（CC BY 4.0）、NSIDC 海冰指數第 4 版（美國政府著作）、NOAA STAR 衛星測高（美國政府著作，照要求標示）、Natural Earth 1:10m／1:50m 國界、Marine Regions 的內陸國清單 | 冰河 1976–2025；海冰 1979–2026；海平面 1993–2025 的趨勢（一個時間點） |
| 南極研究站 | 運作中的研究站（比例圓，各國經營、還在運作的站數，兩國合營的兩國都算）；疊加圖層：研究站的點（依狀態上色：運作中、已關閉、不在 COMNAP 名單，大小依維基百科條目數） | 這國經營的研究站：狀態、成立與關閉年份、海拔 | Wikidata；COMNAP Antarctic Facilities（2024 年 11 月版）只用來核對 | 單一快照（2026-10-29 查詢） |
| 企鵝在哪裡 | 企鵝的種類與數量（不上色，國家沒有數值，預設）、普查有多舊；子項目：全部、阿德利、頰帶、巴布亞、皇帝、馬可羅尼、國王企鵝；疊加圖層：繁殖地的點（大小是時間軸那一季以前最近一次普查的數量，顏色是種類或最近一次普查隔了幾年） | — | MAPPPD v5.0（Oceanites，只准非商業） | 1892–2025/26 繁殖季 |
| 板塊漂移 | 那時在哪個緯度（預設，不上色，`bareMap`：底圖只留海；今天的國界跟著板塊帶回 0–250 百萬年前，每 500 萬年一格，依今天所在的大洲上色，加上那時的板塊邊界〔隱沒帶、中洋脊與張裂、轉形斷層〕；滑到陸地上看是今天的哪一國與那時的緯度；國家的值是國土那時的緯度，給 tooltip、排名表與側欄） | 國土的緯度在 2.5 億年來的變化（折線） | Merdith 等 2021 的全板塊模型 v1.2.4（Zenodo，CC BY 4.0），pyGPlates 計算；Natural Earth 1:50m 國界與 1:10m 的大洲 | 2.5 億年前到今天，每 500 萬年（51 個時間點） |
| 地表的岩石種類 | 岩石種類地圖（預設，不上色：GLiM 的 0.5° 網格，每格是面積最多的岩類，14 類依地質圖的慣例上色〔沉積物與沉積岩黃褐、碳酸鹽岩藍、火山岩紅橘、深成岩洋紅與紫、變質岩綠、冰河淡藍灰〕，滑到任一點看那裡的岩類；國家的值是面積最大的岩類）、主要岩類（類別圖，6 類）、碳酸鹽岩的比例、火山岩的比例、未固結沉積物的比例 | 國土的各岩類面積比例（長條，顏色跟地圖一樣） | Hartmann & Moosdorf 2012 GLiM 0.5° 網格版（PANGAEA，CC BY 3.0，第 8 節第 154 點） | — |
| 特殊地形 | 特殊地形地圖（預設，不上色：Wikidata 的綠洲、峽灣、天然拱門與奇岩、環礁與珊瑚島、泥火山、天坑與滲穴、間歇泉七類約 4,300 個點，依類別上色、大小是維基百科條目數，縮小時只畫有英文或中文條目的）、數量（比例圓，指標自己的子項目：七類合計與各類） | 這國的特殊地形（依類別列出，條目多的在前） | Wikidata（CC0，第 8 節第 157 點） | — |
| 填海造陸 | 填海的城市（預設，不上色：人口百萬以上的 135 個沿海城市 2000–2020 年的填海面積，比例圓，灰色小點是可忽略；國家的值是城市合計）、填海面積（各國合計，比例圓）、有填海的城市數（比例圓） | 這國研究涵蓋的沿海城市與填海面積 | Sengupta et al. 2023（Zenodo，CC BY 4.0）、Natural Earth populated places（第 8 節第 159 點） | 2000–2020 |
| 風與季風 | 風向與風速（預設，不上色：細線〔粒子〕順著那個月的平均風移動，底色是平均風速分 6 級的 1° 網格；滑到任一點看那裡的風向與風速等級；國家的值是國土的平均風速，給 tooltip）、國土的平均風速（面量圖）；時間軸是 1–12 月 | 12 個月的平均風向（箭頭）、風向的穩定度與風速，1 月與 7 月的風向相差 90° 以上時寫「冬夏換方向的季風」；國土平均風速的 12 個月折線 | NOAA PSL 的 NCEP/NCAR 再分析（離地 10 m 的風，1991–2020 年每月長期平均；使用限制：無，照要求致謝）、Natural Earth 1:10m 國界 | 1991–2020 年的 12 個月平均（一組） |
| 移民與難民 | 移民占人口比例、移民人數、僑民人數（比例圓）、勞動力裡的外國出生者（5 年內最近一年）、每千人收容的難民、難民人數（依來源國）；流向圖：移民來源、僑民去向、難民（點選國家畫前 15 名的弧線） | 主要移民來源、主要僑民去向、收容的難民來自、難民逃往（長條清單） | UN DESA International Migrant Stock 2024、UNHCR、UN WPP 2024（人口）；台灣用 DESA（依國籍），附註對照移民署外僑居留人數、僑委會海外臺灣僑民人數 | 移民 1990–2020 每 5 年加 2024 年；難民 1990–2025 每年 |
| 唐人街 | 唐人街地圖（不上色，畫唐人街的點，顏色分 Wikidata 與依維基補的；國家的值是收錄的處數，不能比） | — | Wikidata（CC0）；英文維基百科的歐洲、亞洲、非洲、大洋洲、拉丁美洲唐人街條目手工補（CC BY-SA 4.0） | 沒有時間軸（timeless） |
| 國際援助與僑匯 | ODA 占 GNI（援助國，預設；0.7% 以上是最深的兩級）、援助金額（援助國，比例圓）、流向：援助對象（點選援助國畫前 15 個受援國）、收到的援助（比例圓）、收到的援助占 GNI、每人收到的援助、流向：援助來源（點選受援國畫前 15 個援助國）、僑匯收入（比例圓）、僑匯收入占 GDP、僑匯支出（比例圓） | 援助國：主要援助對象與沒有分到特定國家的金額、雙邊與多邊的組成（給聯合國、歐盟、世界銀行、區域開發銀行等的核心捐款，在捐助國境內的難民支出）、ODA 占 GNI 跟 DAC 合計與 0.7% 目標比；受援國：主要援助來源（國家與多邊機構合在一起排）、收到的援助與僑匯收入的變化；其他國家：僑匯收入與支出的變化；台灣另列僑匯的組成（個人移轉、薪資的收入與支出） | OECD DAC 的 DAC1、DAC2A（OECD 的資料條款，可轉載、改作，要註明出處）；世界銀行 WDI 的個人匯款（CC BY 4.0）；台灣的僑匯用中央銀行國際收支、GDP 用主計總處 | ODA 1960–2025（2025 是初步數字，2018 年起是贈與等值）；受援國與流向 1960–2024；僑匯 1976–2025 |
| 中國的海外貸款 | 累計承諾金額（比例圓，預設，2000 年到時間軸那一年，預設 2021）、當年承諾金額（比例圓）、累計承諾金額占 GDP、每人累計承諾金額；子項目：全部、貸款、贈款 | 用途（OECD 部門，跟著子項目與時間軸）、歷年的貸款／贈款／債務重整／類型不明（堆疊）、金額最大的 10 個項目（AidData 的英文原文名稱、年份、金額、部門、狀態）、連到「國際援助與僑匯」 | AidData Global Chinese Development Finance Dataset 3.0（ODC-By 1.0）；GDP 用人均收入主題、人口用人口主題 | 2000–2021（承諾年份） |
| 宗教 | 主要宗教（類別圖，7 類）、主要宗教的人口比例、無宗教信仰比例、宗教多樣性指數（Pew RDI） | — | Pew Research Center Religious Composition 2010–2020（只發布摘錄，見第 8 節第 27 點）；台灣附註用內政部宗教統計 | 2010、2020 |
| 節慶 | 節慶地圖（國家不上色，時間軸是月份：有月份的節慶依月份出現，月份不詳的另一個圖層一直畫；顏色是種類） | 這國的節慶（有月份的依月份在前）：種類、月份、文資局的登錄等級 | Wikidata；台灣用文化部文化資產局的民俗 | 月份 1–12 |
| 貧富差距 | 吉尼係數、所得最高 10% 的份額、所得最低 50% 的份額、極端貧窮人口比例（每天 3 美元） | — | World Bank PIP（WDI）、World Inequality Database；台灣吉尼係數用主計總處家庭收支調查 | 吉尼係數與貧窮 1987–2025（各國 10 年內最近一次調查）；所得份額 1980–2024 |
| 性別平等 | 性別不平等指數（GII）、女性勞動參與率、女性國會議員比例、性別薪資差距（OECD 約 45 國）、STEM 畢業生的女性比例、女性研究人員比例（5 年內最近一年）、有薪產假、有薪陪產假、有薪育嬰假（全家合計，天） | 產假與育嬰假的指標：育嬰假母親、父親、共用各幾天，世界銀行 2026 年版的天數，OECD 的全薪等值週數 | UNDP 人類發展報告、World Bank WDI（ILO、IPU、UNESCO 的 STEM 畢業生）、OECD、UNESCO UIS（女性研究人員，CC BY-SA 4.0）、World Bank Women, Business and the Law（產假與育嬰假）、OECD Family Database PF2.1；台灣用主計總處（人力資源調查、薪資調查）、中選會、性平處、國科會 | GII 1990–2023；勞參率 1990–2025；國會 1997–2025；薪資差距 2002–2025（4 年內最近一年） |
| 治安與司法 | 故意殺人率（全部、女性、男性被害人，三個用同一組門檻）、監禁人口率（只收有開放授權資料的 44 國，其他國家寫「沒有開放授權的資料」）、法治分數（WGI，0–100） | — | World Bank WDI（UNODC 國際殺人統計）、World Bank Worldwide Governance Indicators；台灣的故意殺人率用衛福部死因統計（他殺）÷ WPP 人口，附註對照警政署故意殺人統計；監禁人口率用 Eurostat 監獄統計（歐洲 39 國）、法務部法務統計年報（台灣）、BJS（美國）、加拿大統計局、ABS（澳洲）、日本法務省犯罪白書，都 ÷ WPP 人口 | 故意殺人率 1990–2025（女性、男性 1993 年起；台灣 2008 年起；各國顯示 5 年內最近一年）；監禁人口率 1993–2025（台灣 2015 年起、澳洲 2016 年起、英國到 2017 年；各國顯示 3 年內最近一年）；法治分數 1996–2025（2002 年起每年） |
| 法律與制度 | 死刑（預設，類別圖，發散色：保留／事實上廢除（10 年以上沒有執行）／只廢除普通犯罪／全面廢除）；法定年齡：投票、飲酒、結婚、汽車駕照、刑事責任（類別圖，循序色，每個歲數一類，「禁止」「沒有規定」是灰色；各地不同的 tooltip 標出）；博弈的合法性（類別圖，循序色：賭場合法／只准彩券等特許／全部禁止，「各地不同」是灰色） | — | 依英文維基百科「Capital punishment by country」「Voting age」「Legal drinking age」「Marriageable age」「List of minimum driving ages」「Age of criminal responsibility」與各國條目自行整理（CC BY-SA 4.0）；台灣最後一次執行用法務部新聞稿核對，台灣的法定年齡用全國法規資料庫的法條核對 | 死刑 1950–2026（每年年底的狀態）；法定年齡、博弈只有 2026 年 |
| 幸福感 | 生活評價（Cantril 階梯 0–10 分，近三年平均） | 《世界幸福報告》公布的名次、95% 信賴區間、分數由六個因素解釋的拆解（2019 年起） | World Happiness Report 2026 的 Figure 2.1 資料（Gallup World Poll）；台灣本身就在報告裡 | 2011–2025（2013 年沒有；2025 年是 2023–2025 年的調查，WHR 2026 公布） |
| 薪資與工時 | 平均月薪（美元、購買力平價）、法定最低工資（美元、購買力平價）、每週工時、每年工時 | — | 國際勞工組織 ILOSTAT、Penn World Table 11.0（墨西哥、哥倫比亞的每年工時用 OECD）；台灣用主計總處薪資及生產力統計與人力資源調查、勞動部基本工資／最低工資、中央銀行匯率，購買力平價用 PWT 與 IMF 的消費者物價推算 | 月薪 1993–2025、最低工資 1996–2024、每週工時 2000–2025（各國只顯示 3 或 5 年內最近一年的資料）；每年工時 1970–2023 |
| 就業與失業 | 失業率（預設）、青年失業率（15–24 歲）、非正式就業比例、勞動力參與率 | 男女對照（四個指標的女性與男性數值表、男女失業率折線） | 國際勞工組織 ILOSTAT（ILO 模型估計 2025 年 11 月版；非正式就業用 ILOSTAT 依各國勞動力調查調和的序列）；台灣用主計總處人力資源調查，非正式就業從缺（附註對照人力運用調查的非典型就業） | 失業率、青年失業率 1991–2025，勞參率 1990–2025（2025 年是推估）；非正式就業 2007–2025（各國 5 年內最近一年） |
| 存款與財產 | 平均每人存款、存款占 GDP、每位成年人的平均財富與財富中位數（各有市場匯率與購買力平價兩版）、最富有 10%／1% 的財富占比、家庭儲蓄率（約 35 國）、國民儲蓄率、家庭負債占 GDP（BIS 約 43 個經濟體＋台灣央行） | 財富的平均與中位數（折線對照，附「平均是中位數的幾倍」） | IMF Financial Access Survey、IMF WEO（SDMX API）、World Inequality Database、OECD National Accounts at a Glance；台灣用中央銀行金融統計、主計總處國民所得統計，附註列出國富統計與家庭財富分配統計 | 存款 2004–2025；財富 1995–2024（2025 年價格）；家庭儲蓄率 1995–2024；國民儲蓄率 1980–2031（2026 起推估） |
| 物價與財政 | 通膨率、物價水準（美國 = 100）、政府債務占 GDP、財政收支占 GDP、稅收占 GDP（含社會安全捐）、收入有多少花在吃（食物占個人實際消費，ICP 2017、2021）、占政府支出（子項目「用途」：社會保障、醫療、教育〔預設〕、國防、一般公共服務、經濟事務，IMF COFOG）、占稅收（子項目「稅收類別」：個人所得稅、公司所得稅、社會安全捐、財產稅、商品與勞務稅，OECD）、政府債務（1800–2015 年，IMF HPD；2026-10-30 加這三個） | — | IMF WEO（含台灣；物價水準用 IMF 的 GDP（美元）÷ GDP（購買力平價）算出），IMF 未涵蓋的地區用 World Bank 補；稅收用 OECD 全球稅收統計，OECD 沒有的 57 國用 IMF 世界稅收資料庫（WoRLD）補；台灣稅收用財政部；政府支出的用途用 IMF GFS COFOG（教育、醫療用 WDI 補），稅收的組成用 OECD（PT_OTR_SECTOR），1800 年起的債務用 IMF Historical Public Debt，台灣三項都用財政部補 | 通膨率、物價水準 1980–2031、政府債務 1991–2031、財政收支 1990–2031（2026 起推估）；稅收 1990–2024（台灣 2000 年起，最新一年還沒公布的國家顯示前一年）；政府支出的用途 1993–2025（3 年內最近一年）、稅收的組成 1990–2024、政府債務 1800–2015 |
| 稅率 | 營所稅（公司稅，中央加地方的法定稅率，預設）、所得稅最高稅率（含地方稅）、最高稅率起徵點（平均薪資的幾倍，不排名）、營業稅（VAT／GST 標準稅率，1 月 1 日）、勞動稅負（單身、平均薪資的 tax wedge） | 各項稅率跟 OECD 平均（起徵點是中位數）的表、營所稅、最高所得稅率、VAT、勞動稅負的歷年折線；台灣另外列那一年度的綜合所得稅級距、起徵點的換算與稅率的變化 | OECD Corporate Tax Statistics、OECD Tax Database 表 I.7、OECD Taxing Wages（OECD 資料條款）、OECD《Consumption Tax Trends 2024》附錄表 2.A.1、《Tax Policy Reforms 2025／2026》（CC BY 4.0）；台灣用所得稅法、加值型及非加值型營業稅法、財政部財政資訊中心的綜合所得稅申報核定統計專冊、賦稅署公告、臺北國稅局與主計總處的平均薪資 | 公司稅 2000–2026（146 個轄區加台灣）；所得稅最高稅率、起徵點、勞動稅負 2000–2025（OECD 38 國，前兩個加台灣）；VAT 2005、2008、2011、2014、2017、2020–2026（OECD 37 國加台灣，美國沒有 VAT）；OECD 以外的國家沒有開放資料，留灰色 |
| 外匯存底與外債 | 外匯存底（含黃金，比例圓，預設）、外匯存底可支應進口月數、外債占 GDP、經常帳占 GDP（發散色） | — | World Bank WDI（IMF 國際金融統計、國際債務統計 IDS）、World Bank/IMF 季度外債統計（QEDS）、IMF WEO（經常帳、名目 GDP）、IMF 初級商品價格（金價）；台灣用中央銀行的外匯存底、國際收支與國際投資部位統計，主計總處 GDP | 外匯存底 1960–2025、進口月數 1976–2025（最新一年還沒公布的國家顯示前一年）；外債 2003–2025；經常帳 1980–2031（2026 年起推估）；台灣的外匯存底與進口月數 2003 年起 |
| 股市規模 | 上市公司市值占 GDP（預設）、上市公司市值（美元，比例圓）、上市公司家數（本國公司，比例圓） | — | World Bank WDI（世界交易所聯合會 WFE）；台灣用金管會證期局（上市＋上櫃）、中央銀行年底匯率、主計總處 GDP | 市值與占 GDP 1982–2025、家數 1980–2025（台灣 1998 年起；預設 2024 年，2025 年印度的數字有誤沒收） |
| 房價與居住負擔 | 實質房價 10 年（預設）、實質房價 5 年的漲跌（59 個經濟體）、房價所得比、房價租金比（2015 年 = 100 的指數，41、43 個）、實質房租 5 年的漲跌（43 個）；漲跌與指數都用發散色反過來（漲、高於 100 是橘色）。只能比變化，不能比房價水準 | 實質房價與實質房租（2015 年 = 100）跟 OECD 平均、BIS 各經濟體平均的折線；房價所得比、房價租金比跟 2015 年與跟長期平均比（OECD 約 25 國）；台灣：全國與六都的房價所得比（倍）、房貸負擔率、住宅價格指數 5 年漲跌，全國與臺北市 2002 年起的房價所得比 | OECD Analytical house price indicators（OECD 資料條款）；OECD 沒有的 11 個經濟體用 BIS 住宅價格統計；台灣用內政部不動產資訊平台的住宅價格指數、房價所得比、貸款負擔率與主計總處的消費者物價 | 實質房價 5 年 1975–2025、10 年 1980–2025，房價所得比 1978–2025、房價租金比與實質房租 1970／1975–2025（各國顯示 2 年內最近一年）；台灣的實質房價、房價租金比、實質房租 2013 年起（漲跌 2018、2023 年起），房價所得比的倍數 2002 年第 1 季–2026 年第 1 季 |
| 研發與創新 | 研發經費占 GDP、研發經費總額（購買力平價，比例圓）、每百萬人研究人員（全時約當數）、每百萬人專利申請（本國居民）、專利申請件數（比例圓） | — | World Bank WDI（UNESCO 統計研究所、WIPO）、IMF WEO（購買力平價 GDP）；台灣用國科會全國科技動態調查、主計總處 GDP、智慧局專利統計、WPP 人口 | 研發經費與研究人員 1996–2024（台灣 1999 年起）；專利 1980–2024（台灣 2007 年起）；研發各國顯示 5 年內、專利 3 年內最近一年的資料 |
| 地震與火山 | 歷年地震（累積，預設）、當年的地震（兩個都不上色，畫規模 6 以上的地震點，依時間軸篩選）、每十年的地震次數（比例圓）、地震死亡人數（每十年，比例圓）、全新世火山數（比例圓）；疊加圖層：板塊邊界（聚合、張裂、轉形）、全新世火山（三角形，依 GVP 的構造環境把板塊內部的 149 座畫成青綠色，2026-10-30，第 8 節第 156 點）、規模 5–6 地震（預設關閉）、規模 6 以上地震（大小是規模、顏色是震源深度） | 最大的地震、死亡最多的地震、全新世火山清單（最近噴發的在前） | USGS ComCat、NOAA NCEI 全球重大地震資料庫、Smithsonian GVP Volcanoes of the World、PB2002 板塊邊界（fraxen/tectonicplates） | 地震 1900–2026（規模 5–6 從 1973 年）；每十年的指標 1900–2020 年代（2020 年代只到今年）；火山是 2026 年的快照 |
| 民主與自由 | 政體分類（類別圖，封閉專制 → 自由民主的發散色）、選舉民主指數、自由民主指數、言論自由指數（V-Dem 的 0–1 指數，發散色，中間跨過 0.5） | 三項指數歷年對照、68% 可信區間 | V-Dem Country-Year 資料集 v16（CC BY-SA 4.0） | 1900–2025 |
| 政府治理 | 發聲與課責、政治穩定、政府效能（預設）、法規品質、法治、貪腐控制（WGI 2025 年改版後的 0–100 治理分數；六個面向同一組門檻，也跟治安與司法的法治分數一樣） | 六個面向（選定那一年的分數、90% 信賴區間與世界中位數的點圖，估計值 ± 標準誤與資料來源數的表）、歷年變化（六張小圖：分數、信賴區間色帶、世界中位數） | World Bank Worldwide Governance Indicators 2026 年版（World Bank API 的 source 3，CC BY 4.0）；台灣本身就在 WGI 裡 | 1996、1998、2000 年，2002–2025 年每年 |
| 諾貝爾獎 | 累計得主人數（比例圓）、每千萬人得主數、當年得主人數（比例圓）；全部獎項與 6 個獎項（子項目） | 在這個國家出生的得主名單（中文名、英文原名、年份、獎項、出生地、得獎理由原文）、各獎項人數、在這裡成立的得獎組織 | Nobel Prize API 2.1（Nobel Prize Outreach）、Wikidata（中文名稱）、UN WPP 2024（人均的分母） | 1901–2026（經濟學獎 1969 起）；每千萬人 1950 起 |
| 台灣的外交 | 邦交國（1950–2026 每年年底，類別圖：邦交國／曾經是邦交國／沒有邦交）、駐外館處（類別圖＋館處點，依類型上色）、駐外館處數（比例圓）、國人簽證待遇（發散色類別圖：需事先申請、電子簽證、落地簽證、免簽證需旅行授權、免簽證） | 與中華民國的邦交期間、當地館處（或兼轄館處）、簽證待遇與停留天數（中文介面附領務局說明）、領務局「簽證及入境須知」連結 | 外交部駐外館處通訊錄（data.gov.tw 6119）、領事事務局免簽證名單（data.gov.tw 30749）與國家清單、Natural Earth 城市點；邦交國的日期依外交部公告整理，與維基百科「中華民國外交關係年表」交叉比對 | 邦交國 1950–2026；館處與簽證是 2026 年的快照（簽證名單 2026-10-22 版） |
| 熊貓外交 | 收到大熊貓的次數（比例圓，依開始的年份累積，1941–2026，預設）；疊加圖層：每一次到某個動物園的點（依種類上色：中華民國贈送、贈送、短期出借、長期租借、台灣）、從成都畫過去的弧線，都跟著時間軸累積出現 | 這國每一次收到的熊貓：動物園、種類與年份、熊貓的名字、說明 | 英文維基百科「Panda diplomacy」「List of giant pandas」「Tuan Tuan and Yuan Yuan」的固定版本（手工整理，`pipeline/sources/panda_diplomacy.py`）；動物園的座標與中文名稱用 Wikidata | 1941–2026 |
| 護照與簽證 | 護照的簽證待遇（類別圖，發散色：不准入境、需事先申請簽證、電子簽證 ↔ 落地簽證、免簽證（需旅行授權）、免簽證；兩岸與港澳是「另用通行證」；子項目是 199 本護照，點地圖、排名表或搜尋選到國家就換成那國的護照，預設台灣）、護照實力（免簽證、落地簽證、旅行授權可以去的目的地數）、開放程度（有幾本護照可以這樣入境這國） | 這本護照各類的目的地數（長條與占比）與目的地清單（附免簽證天數，10 個以後收起來）；選單換成別的護照時，先寫那本護照到這國的待遇；台灣另外跟領事事務局的名單逐國比對（一致與不同的目的地表） | Passport Index（Arton Capital，passportindex.org）的資料集 imorte/passport-index-data（MIT，整理自 passportindex.org；前身 ilyankou/passport-index-dataset 已封存）；台灣的比對用領事事務局免簽證名單（data.gov.tw 30749，台灣的外交主題的資料） | 單一快照（2026-02-17 的資料，標示為 2026 年） |
| 武裝衝突 | 戰鬥死亡（以國家為一方的衝突，預設）、非國家衝突死亡、單方面暴力死亡、組織性暴力死亡（三類合計；以上四個是比例圓）、每十萬人死亡（組織性暴力）、以國家為一方的武裝衝突數（面量圖）、衝突強度（類別圖：戰爭／小型衝突／沒有）；疊加圖層：三類事件的點（同一年、同一國、約 10 公里內合計 25 人以上，依時間軸只畫那一年，大小是死亡人數，紅／琥珀／紫） | 三類死亡人數堆疊面積圖＋當年長條、當年所在國是這裡的衝突（UCDP 原文名稱、強度、類型、爭議、雙方）、1946 年起所在國是這裡的衝突清單 | UCDP Georeferenced Event Dataset（GED）Global 26.1、UCDP/PRIO Armed Conflict Dataset 26.1（CC BY 4.0）、UN WPP 2024（人口） | 死亡人數 1989–2025；衝突數與強度 1946–2025 |
| 此刻世界的新聞熱點 | 新聞熱點地圖（預設，不上色：最近 15 分鐘的新聞事件依地點併成點，大小是事件數、顏色是最多的種類，6 類）、事件數（面量圖） | 這國最近 15 分鐘的新聞事件：依地點列出種類與原始新聞的連結（網域與網址裡的標題字，另開分頁） | GDELT 2.0 事件資料庫（瀏覽器每 15 分鐘直接讀，可自由使用、需註明並連結）、GeoNames 的 FIPS 10-4 → ISO 對照（CC BY 4.0） | 只有最新的一批（`live`，沒有時間軸） |
| 國際組織 | 成員身分（類別圖，每年 12 月 31 日的狀態：成員、申請或加入中、夥伴或觀察員、成員（暫停參與），其他是非成員；子項目是 16 個組織，分四類：區域組織（歐盟、東協、非洲聯盟、阿拉伯國家聯盟）、政治與安全（北約、上海合作組織、大英國協）、高峰會論壇（G7、G20、金磚國家）、經濟與貿易（WTO、OECD、APEC、CPTPP、RCEP、OPEC），預設歐盟）、參加幾個組織（面量圖，16 個裡是成員的有幾個） | 這一年在各組織的身分與歷程（加入、申請、夥伴、暫停的每一段與日期）、參加時用的名稱（中華台北、臺澎金馬個別關稅領域、中國香港…）與附註、不是成員的組織；選定組織的說明（「成員」指什麼、從哪一年算、前身）與官網連結 | 各組織官網的成員名單（史實自行整理，`pipeline/sources/igo_members.py`，2026-10-23 查閱），日期與英文維基百科的成員國條目交叉比對 | 各組織成立（或前身）的那一年到今年：阿拉伯國家聯盟 1945、北約 1949、大英國協 1949（倫敦宣言）、歐盟 1958（歐洲經濟共同體）、OPEC 1960、OECD 1961、非洲聯盟 1963（非洲團結組織）、東協 1967、G7 1975、APEC 1989、WTO 1995、G20 1999、上海合作組織 2001、金磚國家 2009、CPTPP 2018（簽署）、RCEP 2020（簽署）；參加幾個組織 1945–2026。今年是資料產生當天（2026-10-23）的狀態 |
| 聯合國投票 | 與美國的一致度（預設）、與中國的一致度（1971 年起）、理想點（Bailey, Strezhnev & Voeten 的一維投票立場，發散色）、與各國的一致度（16 個比較對象：俄羅斯、英國、法國、德國、烏克蘭、日本、南韓、印度、印尼、澳洲、土耳其、伊朗、以色列、埃及、南非、巴西） | 與美國、中國的投票一致度（兩條折線，x 軸只畫這國有投票紀錄的年份）、理想點的 90% 可信區間與參加的表決次數 | Erik Voeten, United Nations General Assembly Ideal Points（Harvard Dataverse 第 39 版，CC0 1.0；方法 Bailey, Strezhnev & Voeten 2017；原始表決 UNGA-DM） | 一致度 1946–2024、理想點 1946–2025（1964 年沒有記名表決）；中國 1971 年起，台灣（中華民國）1946–1971 |
| 海底電纜 | 海底電纜地圖（預設，不上色，畫電纜路線與登陸點，依 RFS 年份累積；營運中洋紅實線、規劃中琥珀虛線）、登陸的電纜數（比例圓）、國際連線數（面量圖）、登陸點數（比例圓） | 在這國登陸的電纜（名稱、啟用年份、長度、登陸點、擁有者；營運中與規劃中分開列）、直接連到的國家（長條，依電纜數） | TeleGeography Submarine Cable Map（CC BY-NC-SA 3.0）；台灣用中央社報導的中華電信、數位發展部數字交叉比對 | 1989–2030（2027 起加上規劃中的電纜，是推估）；2026-10 的快照 |
| 雲端機房的區域 | 雲端區域數（比例圓，三家合計，依開放年份累積）；疊每個區域的點（顏色是業者）與預覽中的區域（灰色） | 這國在這一年開放的區域（業者、代碼、城市、年份、營運者、限制存取）與預覽中的 | AWS、Google Cloud、Microsoft Azure 的區域清單與開放公告（手工整理的事實表） | 2006–2026 |
| 交通安全 | 道路交通死亡率（每 10 萬人，預設）、道路交通死亡人數（比例圓）、行人死亡占比、機車騎士死亡占比、每千人機車數、機車占機動車輛的比例、每千人汽車數（含四輪輕型車）、每千人小客車數（歐洲，Eurostat）、每萬輛機動車死亡數 | 死者是哪一類道路使用者（機車、行人、自行車、汽車、其他；台灣另有不分車種的乘客） | WHO GHO（RS_198 估計死亡率；RS_246、RS_194）、WHO《Global status report on road safety 2023》各國指標、Eurostat road_eqs_carhab、UN WPP 2024；台灣用交通部統計查詢網的 30 日內死亡人數與機動車輛登記數（含機車、小客車） | 死亡率與人數 2000–2023（台灣 2008 年起，附註寫到 2025 年）；占比 2016–2021、每萬輛 2016–2023（各國用 5 年內最近一次調查）；機車、汽車 2020–2021（台灣 2012–2025）；歐洲小客車 1990–2025 |
| 旅行實用 | 跟台灣的時差（標準時間，發散色：比台灣慢橘、快青綠，預設）、行車方向（類別圖）、插頭類型（類別圖，7 類）、電壓與頻率（類別圖，4 類）；生活格式（2026-10-28 加，類別圖）：一週從星期幾開始、週末、12 或 24 小時制、日期寫法（年月日／日月年／月日年）、小數點符號、度量衡、紙張大小、曆法（第 8 節第 94 點） | 跟台灣比：時差與夏令時間、跨時區的範圍、行車方向、插頭能不能直接插、電壓要不要變壓器；一週與週末、時間與日期、數字、度量衡與紙張、曆法 | IANA 時區資料庫（tzdata 2026e）、Natural Earth 首都、Wikidata（行車方向）、英文維基百科「Mains electricity by country」（CC BY-SA 4.0）、Unicode CLDR 49 | 不隨時間變化（2026 年的快照） |
| 國家小檔案 | 政體形式（類別圖，預設：總統制共和國、半總統制共和國、議會制共和國、議會制君主立憲、君主握有實權的君主立憲、絕對君主制、一黨制、其他（軍政府、過渡政府、神權、委員會制）；屬地是淺的中性色）、貨幣（類別圖：歐元、美元、非洲法郎、跟其他國家或地區共用的貨幣、自己的貨幣；滑過看貨幣名稱與代碼）、匯率制度（循序類別圖，IMF 2023 年的事實分類 8 類：沒有自己的法定貨幣 → 自由浮動，滑過看貨幣政策的錨；2026-10-30 加）、陸地鄰國數（面量圖）、內陸國（類別圖：雙重內陸國、內陸國、沿海）；疊加圖層：首都（含行政、立法、司法首都與政府所在地，滑過看角色） | 小檔案：首都與政府所在地（爭議的首都另外說明）、國家元首與政府首長（職稱、起始日期）、政體形式、貨幣（ISO 4217）、人口、陸地面積、陸地鄰國與內陸國、國際電話區號、網域、ISO 3166-1 代碼、國歌、成立時間（Wikidata 只有一個值時）、屬地的主權國、爭議地區的說明；「其他主題」一句話（行車方向與時差、主要官方語言、V-Dem 政體分類、最大城市、最高點、國際組織、跟中華民國的邦交）連到那些主題 | Wikidata（CC0）、Natural Earth 1:50m 國界（鄰國與內陸國自行計算）、FAOSTAT 土地利用（CC BY 4.0）、UN WPP 2024 | 2026 年的快照（Wikidata 2026-10-26 查詢） |
| 颱風與颶風 | 當年的颱風（預設，不上色，畫那一年生成的颱風路徑，依每個時間點的強度分段上色）、每十年的颱風次數（比例圓）、最強的颱風（每十年，循序類別圖：熱帶性低氣壓 → 5 級）；疊加圖層：颱風路徑（薩菲爾－辛普森等級的 7 級橘色循序色，非熱帶階段灰色虛線、強度不明灰色實線，滑過看名稱、巔峰強度、氣壓與日期） | 最強的颱風、最近的颱風（各 10 個：經過時的風速與等級、最近距離、日期、巔峰強度；西北太平洋的颱風附中央氣象署的中文名） | NOAA NCEI IBTrACS v04r01（只用美國機構的 USA_WIND、USA_SSHS）；中文名稱與台灣的侵台對照用中央氣象署颱風資料庫 | 1950–2026（依颱風生成的年份，UTC；2025–2026 是即時資料）；北印度洋、南半球相關的 43 國 1980 年起；每十年的指標 1950–2020 年代（2020 年代只到今年） |
| 發電廠地圖 | 發電廠地圖（預設，20 MW 以上的電廠點：顏色是能源、面積是裝置容量；運轉中預設打開，興建中、規劃中、已退役與封存三個圖層預設關閉）、總裝置容量（比例圓）、各能源裝置容量（比例圓，子項目是 8 種能源加再生能源、化石燃料合計）、占總容量比例（面量圖，各能源各自的門檻）、興建中與規劃中的容量（比例圓）；發電量主題也可以打開運轉中的電廠圖層 | 各能源的運轉中、興建中、規劃中容量（長條）、最大的 10 座運轉中電廠（含主要業主） | Global Energy Monitor Global Integrated Power Tracker（2026 年 9 月版，CC BY 4.0）；台灣附註對照經濟部能源署發電裝置容量 | 2026 年的快照（GEM 2026 年 9 月的狀態） |
| 石油、天然氣與煤 | 子項目是燃料（石油、天然氣、煤，單位各用各的：千桶/日、十億立方公尺、百萬公噸）：產量（預設，比例圓）、消費量（比例圓）、人均消費量、自給率（發散色，中性一級跨過 100%）、蘊藏量（比例圓；原油、天然氣只有 2021 年）、流向：出口對象／進口來源（BACI 的公噸，商品是原油、LNG、管道天然氣、煤）；不分燃料的人均能源消費（GJ/人）與能源消費總量（艾焦耳，比例圓）；疊加 GEM 的天然氣管線、LNG 接收站（只有興建中或規劃中的預設關閉）、油管、油氣田、煤礦（規劃中、已關閉或封存預設關閉），各自只在對應的燃料出現（不分燃料的兩個指標不畫） | 這一年三種燃料的產量、消費量、自給率與天然氣、煤的進出口（表）；初級能源結構（艾焦耳，堆疊面積＋長條）；主要出口對象、進口來源（TradePanel）；GEM 的 LNG 接收站、產量最大的 10 個油氣田、產能最大的 10 座煤礦、管線數；台灣：能源署的進口來源跟 BACI 對照 | EIA International Energy Statistics（2026 年 10 月，公有領域）；CIA World Factbook（2021 年估計，公有領域）；CEPII BACI HS92 V202601（Etalab 2.0）；GEM 的 GGIT、GOIT、GOGET、GCMT（CC BY 4.0）；UN WPP 2024；台灣對照用經濟部能源署（政府資料開放授權條款） | 石油產量 1985–2025、其他 1980–2024；煤蘊藏量 2008–2023；流向 1995–2024（管道天然氣 2000 年起）；GEM 是 2026 年的快照 |
| 太陽能與風能潛力 | 太陽光電潛力（PVOUT，kWh/kWp/日，預設）、風能潛力（離地 100 公尺風功率密度的陸地平均，W/m²）、風最強的 10% 土地、近岸海域（離岸 50 km）的風能；太陽光電與風能潛力可以切到約 2 km 網格（風能含各國專屬經濟海域，台灣海峽整片在最高一級） | — | Global Solar Atlas 2.0（Solargis／世界銀行 ESMAP）、Global Wind Atlas 4.0（丹麥技術大學 DTU／世界銀行 ESMAP，Vortex）；台灣附註對照 GSA 網站摘要與經濟部能源署 | 不隨時間變化（太陽能是各地 1994–2019 年起到 2025 年的長期平均，風能是 2008–2017 年），沒有時間軸 |
| 日食與月食（原名日食路徑） | 日食路徑（預設，不上色：時間軸那一年的日全食、日環食、混合食，路徑是半透明的帶子加外框與中心線，依類型上色；滑過看日期、食甚時中心線上的持續時間與位置、路徑寬度、沙羅週期；國家的值是那一年有沒有路徑經過，排名表列出經過的國家；另有預設關閉的「1900–2100 年所有的中心線」）、日全食次數、日環食次數（比例圓，1900 年累計到時間軸那一年，預設 2100 年；地圖上是到那一年為止的中心線）、下一次日全食（面量圖：從那一年起還要幾年，tooltip 寫哪一年；到 2100 年都沒有的是灰色）；月食（2026-10-28 加）：那一年的月全食（不上色：月全食整個全食都看得到、看得到一部分與月偏食看得到的範圍，半透明的面；tooltip 是首都看不看得到）、月全食次數（首都，累計）、下一次月全食（首都，還要幾年） | 1900–2100 年經過這國陸地的每一次日全食、日環食、混合食（日期、類型、這國境內最長的持續時間，下一次標出來，多的時候先列下一次附近的 12 次），上一次與下一次日全食；點一下時間軸換到那一年、標出路徑、地圖移過去；月食的指標列首都看得到的每一次月食（類型、整個看得到或一部分、食甚的當地時間、全食或偏食多久） | NASA 日食網站（Fred Espenak）：五千年日食目錄（Espenak & Meeus, NASA TP-2006-214141）與每一次日食的貝塞爾根數（路徑表那一組 SEbeselm 有的用它，其餘用五千年日食典的 SEdata），路徑自己算；公有領域，要寫「Eclipse Predictions by Fred Espenak, NASA's GSFC」；NASA 五千年月食目錄（Espenak & Meeus，公有領域，要求標示）；首都用晝夜與季節的 capitals.json | 1900–2100（未來的日食是預報；年份是食甚的 UTC 年份） |
| 地球的另一邊 | 對蹠地圖（預設，不上色：每個國家的陸地翻到地球的另一邊，半透明的影子是對面是海的部分、琥珀色是陸地對陸地，加上翻過來的海岸線與國界；滑到地圖上任何一點，海上也可以，看它的對蹠點在哪一國或哪一片海與經緯度，平面地圖上畫一個小圈）、陸地對陸地的比例（面量圖）、首都的對蹠點離陸地（面量圖，km，不排名；0 是在陸地上）；兩個面量圖只疊翻過來的海岸線 | 國土的對蹠點落在哪些國家與海（100% 長條加清單，前 10 名）、「移到地球另一邊」；首都的對蹠點（在哪一國或哪一片海、離最近的陸地與國界多遠、最近的城鎮）、「移到對蹠點」；一打開就在地圖上標出這一國翻過去的形狀，放首都與它的對蹠點兩個標記（點一下移到另一個） | Natural Earth 1:50m 國界（地圖本身的，翻過去的形狀）與 1:10m 國界、populated places（公有領域）；Marine Regions 的 IHO Sea Areas v3 與 Global Oceans and Seas v1（CC BY 4.0，海的名稱與所屬大洋）；國家小檔案的 Wikidata 首都（CC0） | 不隨時間變化，沒有時間軸 |
| 從台北看世界 | 首都離台北多遠（預設，面量圖）、在台北的哪個方位（類別圖，八方位）；疊加圖層：1,000–20,000 公里的距離圈、到各國首都的大圓航線、台北的點 | 以台北為中心的方位等距圓盤（d3-geo 的 SVG，標出這一國與航線）、距離與一開始的方位 | 晝夜與季節主題的首都檔（Wikidata） | 不隨時間變化 |
| 北磁極的漂移與磁偏角 | 磁極的軌跡（預設，不上色：北、南磁極 1590–2025 年每年一點，依年份上色，跟著時間軸累積）、首都的磁偏角（2025 年，發散色：西偏青綠、東偏橘）、首都離北磁極（每年的大圓距離）；疊加圖層：等偏角線（沿線寫度數）、指南針不可靠的範圍（WMM 的 blackout zone）；滑到任一點看那裡的磁偏角 | — | NOAA NCEI 磁極位置（NP.xy、SP.xy）、World Magnetic Model 2025（NOAA NCEI 與英國 BGS，公有領域）、Wikidata 首都 | 磁極 1590–2025；磁偏角只有 2025 年 |
| 此刻的極光 | 極光預報地圖（預設，不上色：NOAA 的 OVATION 預報看得到極光的機率，綠色越濃越高，加上此刻的晝夜；滑到任一點〔海上也可以〕看那裡的機率）、國土上空的機率（面量圖：國土碰到的 1° 格點中最高的）、首都上空的機率（面量圖） | 預報與觀測的時刻、國土上空最高的機率與位置（移過去）、首都上空的機率、NOAA 的 Kp 指數（最近一筆、過去 24 小時最高）；國土都在南、北緯 35° 以內的國家（台灣）寫明看不到 | NOAA SWPC 的 OVATION 極光預報與行星 K 指數（美國政府著作，瀏覽器即時讀）、Natural Earth 1:10m 國界、國家小檔案的 Wikidata 首都（CC0） | 只有現在（每 5 分鐘重讀），沒有時間軸 |
| 野火 | 燒毀面積占國土比例（預設）、燒毀面積（比例圓） | 燒毀的土地類型（堆疊面積圖＋當年長條）、每月燒毀面積（歷年平均與當年）、台灣：林保署森林火災對照表 | GWIS 全球野火資訊系統（歐盟 JRC、Copernicus）的 MODIS MCD64A1 各國逐月燒毀面積、GWIS Country Profile API（GADM 國土面積）；台灣附註用農業部林業及自然保育署林業保育統計年報 | 2002–2025（林保署對照 2007–2025） |
| 世界遺產 | 世界遺產數（比例圓，依登錄年份累計，預設；子項目：全部、文化、自然、複合）、瀕危世界遺產數（比例圓，目前的快照）、生物圈保護區（國家不上色，只畫點）；疊加圖層：每個遺產一個點（文化琥珀、自然綠、複合紫、瀕危紅），生物圈保護區的點只在它的指標 | 這個國家的世界遺產清單（中文名稱、英文原名、類型、登錄年份、瀕危、跨國）；生物圈保護區指標時改列這一國的保護區；台灣寫明不是締約國、文化部的 18 處「臺灣世界遺產潛力點」 | UNESCO DataHub World Heritage List（CC BY-SA 4.0）、世界遺產中心的締約國清單、Wikidata（中文名稱、生物圈保護區） | 1978–2026（瀕危只有 2026 年） |
| 國家公園 | 國家公園地圖（預設，不上色，畫國家公園的點：依設立年份累積出現、依 IUCN 類別上色，年份不詳的另一個圖層預設關閉）、陸域保護區占國土（面量圖） | 這國的國家公園：設立年份、面積、IUCN 類別 | Wikidata；World Bank WDI 的 ER.LND.PTLD.ZS（UNEP-WCMC） | 點 1872–2026；保護區 2013–2025 |
| 摩天大樓 | 300 m 以上的大樓數（比例圓，預設；150、200 m 以上的 Wikidata 收錄太少，不做國家的指標）、最高建築的高度（面量圖）；疊加圖層：Wikidata 收錄的 150 m 以上的大樓每一棟一個點（大小與顏色是高度，縮小時只畫 300 m、200 m 以上的，拆除的那一年起不畫） | 跟 CTBUH 比的涵蓋率、這一年各高度的棟數（長條）、最高的大樓（前 10 棟，其餘收起來）、這個國家與全世界歷年 150、200、300 m 以上的棟數（折線）、沒有完工年份所以不算的大樓、連到城市主題；台灣寫台北 101、85 大樓的現況 | Wikidata（CC0）；CTBUH Skyscraper Center 的 2025 年底總數只引用來對照；城市名稱補用城市主題的 GHSL UCDB | 1930–2026（每一年還在的） |
| 景點地圖 | 博物館、動物園、樂園（不上色，國家沒有數值）；疊加圖層：博物館（依類型上色：美術館、自然與科學、歷史與文化、其他）、動物園與水族館、主題樂園與雲霄飛車，三個圖層分開開關，縮小時只畫維基百科條目多的 | 這國最有名的博物館、動物園與水族館、樂園與雲霄飛車各 8 處（依有幾種語言的維基百科有條目） | Wikidata；台灣的博物館用文化部「博物館」開放資料（data.gov.tw 6242）補 | 單一快照（2026-10-29 查詢） |
| 國旗 | 國旗（預設，`kind: 'flags'`：每個國家塗上自己的國旗，小國畫成小國旗；tooltip 是採用年份與國旗的通稱）、占國旗面積（子項目「顏色」：紅、白、藍、綠、黃與金色、黑、橘、其他）、主要顏色（類別圖，字面上的顏色；前兩種差不到 2 個百分點的「沒有單一的主要顏色」）、圖案（子項目：星星、新月、太陽、十字、英國國旗、國徽或徽章、動物、直條三色旗、橫條；有／沒有）、旗幟家族（北歐十字、英國國旗、泛非、泛阿拉伯、泛斯拉夫、大哥倫比亞、中美洲聯邦）、採用年份（面量圖）、長寬比（類別圖） | 大的國旗、名稱（通稱與正式名稱）、屬地與爭議地區的說明、採用日期與理由、長寬比、顏色組成長條、圖案、旗幟家族、圖檔的出處與授權、連到國家小檔案；國家小檔案最上面也有國旗 | Wikimedia Commons（SVG，公有領域 228、CC0 5、阿曼政府開放授權 1）、Wikidata（CC0） | 單一快照（2026-10） |
| 夜間燈光 | 平均亮度（預設，nW/cm²/sr；一打開就是約 500 m 網格，網格底下鋪夜色）、燈光總量（比例圓，MW/sr）、人均燈光、有燈光的土地比例、住在沒有燈光地方的人口比例（電力普及的粗略指標）、燈光比 2017 年（發散色） | 燈光總量的變化（跟世界比）、燈光最多的地區（Natural Earth 第一級行政區的燈光總量、占全國、比 2017 年） | EOG Annual VNL V2 average_masked（科羅拉多礦業學院，CC BY 4.0；檔案取自 Hengl 在 Zenodo 的轉存，不必登入）、JRC GHS-POP R2023A、UN WPP 2024、Natural Earth | 2013–2024（2017 年起處理方式不同，methodBreak）；變化 2018–2024；網格 2013、2017、2020、2024 四期 |
| 太空 | 在軌酬載（依擁有國，比例圓，預設）、太空垃圾（在軌的火箭殘骸、碎片與零件，依擁有國，比例圓）、每年入軌發射次數、累計入軌發射次數（依發射業者的國家，比例圓）；疊加圖層：發射場（大小是入軌發射次數，依第一次發射的年份出現） | 目前在軌酬載的主要擁有者（長條）、酬載不多的國家列出每一顆（台灣的福衛系列與立方衛星） | Jonathan McDowell 的 GCAT Release 1.8.8（CC BY 4.0） | 1957–2026（2026 年到 10 月 29 日） |
| 奧運 | 累計獎牌（比例圓，預設）、累計金牌、單屆獎牌、單屆金牌（比例圓）、每千萬人獎牌（單屆，面量圖；指標名稱取短的，中文 1280px 寬時控制列才是一行）；子項目：夏季、冬季；蘇聯、東西德、南斯拉夫等歷史隊伍是主題自訂的地點，畫在當時的首都附近 | 歷屆的金銀銅（表格）、得牌屆數與最多的一屆、相關的歷史隊伍或今天對應的國家 | 英文維基百科各屆的獎牌榜與 All-time Olympic Games medal table（CC BY-SA 4.0）、UN WPP 2024 | 夏季 1896–2024（30 屆）、冬季 1924–2026（25 屆）；每千萬人 1952 年起 |
| 各國在讀什麼 | 讀最多的條目（預設，不上色：那個月每個國家讀最多的維基百科條目，各語言的維基百科合在一起排，名稱寫在地圖上〔點圖層的 `pointLabel`〕；國家的值是第一名的瀏覽次數，給 tooltip）、讀英文維基百科的比例（面量圖）；時間軸是月份 | 那個月的前 10 名（原文標題、中文或英文名稱、哪一種語言的維基百科、瀏覽次數），第一名在最近 24 個月的變化（每個月的第一名，點一下換到那個月） | Wikimedia 基金會的差分隱私每日瀏覽量（country_project_page，CC0）、Wikidata 的中文與英文名稱（CC0）、Natural Earth 1:50m 國界（標籤的位置） | 最近 24 個完整的月份（2024 年 10 月到 2026 年 9 月） |
| 帝國與疆界 | 各時期的疆域（預設，不上色：那一年世界各政體的範圍，Cliopatria，依帝國上色〔10 種顏色只是讓相鄰的分得開，圖例不列，`keyClasses: false`〕、政體名稱寫在地圖上，滑過看名稱與這個範圍的年份；國家的 tooltip 寫今天的國土那時屬於誰）、殖民帝國（類別圖：COLDAT 8 個歐洲殖民國，用平均的起訖年份；只補了台灣：荷蘭、西班牙、日本） | 今天的國土歷代屬於誰（取樣年份連續相同的合成一段，占國土 3% 以上，點一段換到那一年）、殖民時期（各殖民國的平均與最寬的起訖年份、只有部分地區、自己補的） | Cliopatria v0.2.1（Seshat，Zenodo，CC BY 4.0）、COLDAT（Becker，Harvard Dataverse，CC0）、Wikidata 的中文名稱（CC0）、Natural Earth 1:10m／1:50m（台灣的範圍、今天的國土） | 西元前 3400 年到 2024 年：西元前每 100 年、1800 年以前每 50 年、之後每 5 年（加 1625、1640、1670 年）；殖民 1462–2024 年每年 |

## 8. 資料陷阱（重要）

1. **World Bank WDI 沒有台灣**。各主題的補法：
   - 人口：改用 UN WPP。
   - 收入：改用 IMF WEO。
   - 產業結構、工業：改用主計總處總體統計資料庫（`pipeline/sources/dgbas.py`）。它的 API 參數是從網站本身的查詢頁面整理出來的。
   - Ember、FAOSTAT、Harvard Atlas 本身就有台灣。
   - 薪資與工時：ILOSTAT 也沒有台灣（台灣不是 ILO 會員），改用主計總處、勞動部；Penn World Table 本身有台灣。
   - 存款與財產：IMF Financial Access Survey 沒有台灣，存款改用中央銀行；WID 與 IMF WEO 本身有台灣。
   - 物價與財政：IMF WEO 本身有台灣；稅收改用財政部。
   - 稅率：OECD 的公司稅、個人所得稅、VAT 資料都沒有台灣，改用所得稅法、營業稅法與財政部的公告、統計專冊（第 72 點）。
   - 研發與創新：UNESCO、WIPO 沒有台灣，改用國科會、智慧局。
   - 就業與失業：ILO 的模型估計雖然有台灣，但近幾年是推算的，改用主計總處人力資源調查；非正式就業台灣沒有統計（第 54 點）。
   - 外匯存底與外債：WDI、國際債務統計（IDS）、季度外債統計（QEDS）都沒有台灣，改用中央銀行（外匯存底加上黃金的市值、國際收支、國際投資部位；第 55 點）。
   - 國際援助與僑匯：OECD DAC 本身有台灣（「Chinese Taipei」，台灣向 OECD 申報援助）；WDI 的僑匯沒有台灣，改用中央銀行國際收支的個人移轉加薪資（第 74 點）。
   - 中國的海外貸款：台灣不是中國官方開發融資的對象（AidData 0 筆），寫 `noValue`「不是中國官方開發融資的對象」，中國寫「出資國」（第 91 點）。
   - 股市規模：世界銀行轉載的 WFE 資料沒有台灣（世界合計裡卻有），改用金管會證期局的上市＋上櫃（第 56 點）。
   - 半導體：CEPII BACI 有台灣（代碼 490），但台灣沒有自己的申報，數字來自貿易夥伴，附註對照財政部（第 52 點）。關鍵礦產：USGS 的表上沒有台灣，台灣不是這些礦產的生產國（第 53 點）。
2. **FAOSTAT 的「China」(351) 是大陸、港、澳、台的合計**，要排除，否則會重複計算；台灣是 M49 158。
3. **FAOSTAT 品項的單位要對齊**才能算自給率：
   - 稻米：產量是稻穀，貿易是白米當量，產量乘 0.667。
   - 豬肉：貿易用豬肉當量（2073）。
   - 乳品：產量用全部生乳（1780），貿易用生乳當量（1881）。
   - 茶：產量是鮮葉，貿易是成茶，單位不同，所以沒放。
   - QV 的肉類有一般品項和「indigenous」兩種版本，只用後者，否則重複計算。
4. **FAOSTAT 產值**：當期美元（element 57）沒有台灣，所以用 2014–2016 年固定價格的國際元（element 152）。
5. **Harvard Atlas 的出口**：
   - HS 98–99 章是「未分類商品」，台灣有大量出口歸在這裡（2021 年約 860 億美元），所以單獨列出。
   - Dataverse 會擋 Python 預設的 User-Agent，`common.download()` 已經自帶 User-Agent。
6. **UNIDO INDSTAT 拿不到**：網站有 Cloudflare 驗證，程式下載不了。目前改用 World Bank 轉載的 UNIDO 五大類（ISIC Rev.3），2023 年以後涵蓋的國家很少。
7. **Natural Earth / world-atlas 的代碼**：
   - 5 個區域沒有 ISO 代碼，澳洲（036）出現兩次，都在 `build_geo.py` 處理掉了。
   - 如果改用 Natural Earth 原始檔，它的 `ISO_A3` 欄位裡法國、挪威是 `-99`。
8. **地圖上沒有形狀的國家**：
   - 吐瓦魯、托克勞、直布羅陀在 1:50m 圖資裡沒有形狀。地圖用首府的位置畫小國圓點（`worldMapLayers.ts` 的 `SHAPELESS`），比例圓、流向圖的弧線也畫在那裡；否則台灣的邦交國吐瓦魯在地圖上看不到。
   - 法國海外省併在法國的形狀裡。
   - 這些國家在排名表和搜尋裡都還找得到。
9. **AI 資料的限制**：
   - **沒有任何 AI 公司按國家公布 token 用量。**
     - 唯一按國家統計的 token 量，是經濟合作暨發展組織（OECD.AI）網站上的 OpenRouter 資料（`pipeline/sources/oecd_ai.py`）。
       - 網站沒有下載檔，這裡呼叫網頁圖表本身用的 GraphQL API，格式可能會變。
       - 轉載授權未明示（頁尾已標示）。使用者知道授權不明，決定採用。
       - 只代表透過 OpenRouter 這個 API 轉接平台的用量，依請求發出的地點計算，伺服器集中的新加坡、德國會偏高。
       - 原始資料是逐月的，地圖用每年的每月平均（2026 年只有 1–7 月），側欄畫逐月趨勢。
     - 另外用 Anthropic Economic Index（只代表 Claude 的網頁與 App）和 Microsoft AI Diffusion（依遙測資料推估）當參考。
   - **數據中心**：
     - 能轉載的只有 OpenStreetMap 的標示，各國完整度差很多，而且只有現在的快照。
     - PeeringDB 的使用條款禁止公開轉載。
     - IEA 只有美、中兩國的數據中心用電資料。
     - 商業目錄（Data Center Map 等）不可轉載。
   - **算力**：Epoch AI 只收錄公開可查的 AI 叢集，自己估計約占全球 10–20%，叢集算在所在國家，不是擁有者的國家。
   - **Overpass API**：用一次全球查詢取回所有數據中心，國家在本地判斷，不必對公用伺服器發上百次查詢。
10. **交通資料的限制**：
    - 鐵路取自 Natural Earth 1:10m，是製圖用的簡化資料，可能缺少支線，複線可能重複計算。
    - 北美只收主要幹線，美國只算出約 9 萬公里，實際超過 20 萬公里。
    - 鐵路長度用地圖線段計算，每 20 個頂點判斷一次所在國家（`geoindex`，Natural Earth 1:10m），跨國界的線會略有誤差。2026-10-27 以前用 1:50m 判斷：摩納哥的形狀比實際大，法國的 22 公里鐵路算成摩納哥，鐵路密度排第 1（每千平方公里 1,838 公里）；西撒哈拉的 19 公里其實是茅利塔尼亞的鐵礦鐵路（第 85 點）。
    - 鐵路密度的面積是 1:50m 國界算的（`geoindex.land_polygons()`），跨過 ±180° 的俄羅斯、斐濟展開成連續經度再算（2026-10-27 以前俄羅斯少算約 600 萬 km²，見第 79 點）。
    - 機場來自 OurAirports，只取大型機場與有定期航班的中型機場（不含 4 萬多座小型機場、直升機場與純軍用機場）。
    - 機場名稱是英文原名。
    - 地鐵站與高鐵取自 Wikidata，收錄的規則、開通年份的取法與限制見第 95 點。
11. **國名**：介面上的繁中、英文名稱都用瀏覽器內建的 `Intl.DisplayNames`（英文有幾個改成常見寫法，見第 12 節）；`countries.json` 的英文名是 pycountry 的通用名稱（`Taiwan`，不是 `Taiwan, Province of China`），用在搜尋與 CLDR 查不到的區域。FAOSTAT 的品項中文名在 `pipeline/topics/agriculture_names.py`，英文名用 FAOSTAT 本身的名稱（`items.en.json`）。
12. **授權**：
    - WPP 是 CC BY 3.0 IGO。
    - World Bank、Ember、FAOSTAT、JRC GHS-POP 是 CC BY 4.0。飲食主題 2026-10-28 加的咖啡、茶、可可（第 97 點）也是 FAOSTAT 糧食平衡表，同一個授權。
    - Harvard Atlas 是 CC0。
    - WHO 的資料（GHO、Global Health Estimates）是 CC BY 4.0（data.who.int 的條款，另加爭議先調解、再仲裁的條款）。
    - **健康平均餘命**（第 114 點，2026-10-29）：WHO 的 HALE（WHOSIS_000002）與平均壽命（WHOSIS_000001）同上，是 CC BY 4.0；GHO 的 API 壞了，改用 data.who.int 背後的整檔 CSV（同一份資料）。台灣用衛生福利部統計處的分析文章（政府資料開放授權條款），數字是手抄的。
    - **GLOBOCAN（IARC）與 IHME GBD 沒有用**：前者大量轉載要書面授權，後者只限非商業使用（見第 23 點）。
    - Epoch AI 是 CC BY。
    - Our World in Data 整理的資料（碳排來自 Global Carbon Project）是 CC BY 4.0。
    - UNDP 人類發展報告是 CC BY 3.0 IGO。
    - **SIPRI 軍費資料不是開放授權**：只能非商業使用、註明出處，轉載少於整個資料集 10% 才算合理使用（見第 16 點）。
    - CEPII BACI 是 Etalab 2.0（Licence Ouverte，與 CC BY 相容），需註明 CEPII。
    - Eurostat 是 CC BY 4.0（執委會 2011/833/EU 決定）。
    - OECD 的資料適用 OECD 資料條款（可轉載、改作，需註明出處；見下面「OECD 的資料不是 CC BY 4.0」），可負擔住宅資料庫也是；2024 年 7 月起的書面內容才是 CC BY 4.0。
    - UN DESA 家戶規模資料庫（Household Size and Composition 2022）是 CC BY 3.0 IGO，寫在 Excel 檔裡。
    - 內政部不動產資訊平台本身沒有寫授權條款；內政部所屬網站（例如移民署）的「政府網站資料開放宣告」採政府資料開放授權條款，這裡比照標示。
    - Anthropic Economic Index 是 CC BY。
    - Microsoft AI Diffusion 是 MIT。
    - Unicode CLDR 是 Unicode License v3（類似 MIT，需保留版權聲明）；Glottolog 是 CC BY 4.0。旅行實用的生活格式（2026-10-28，第 94 點）也用 CLDR 49，同一個授權，資料來源寫「Unicode CLDR 49」、授權寫 Unicode License v3。
    - OpenStreetMap 是 ODbL，需標示「© OpenStreetMap contributors」。
      - 便利商店與連鎖品牌主題的資料檔（各國店數、每百萬人店數、店家位置、側欄明細）是從 OSM 算出來的衍生資料庫（Derived Database），照 ODbL 第 4.4 條同樣以 ODbL 提供：頁尾的來源寫「OpenStreetMap contributors（ODbL）」連到 https://www.openstreetmap.org/copyright，`manifest.json` 的 `license` 寫 ODbL 1.0，主題說明寫明「這個主題的資料檔是 OpenStreetMap 的衍生資料庫，以 ODbL 提供」。地圖本身（畫出來的圖）是 Produced Work，右下角已有 © OpenStreetMap contributors（第 75 點）。
      - 那個主題的公司公布店數（年報、10-K、法說會簡報、官網）是引用的事實：一國一個數字加日期與出處，寫在附註、tooltip 與側欄，不是轉載誰的資料庫；沒有用 AllThePlaces（爬各公司官網的店家位置）這類從公司網站複製的資料集。
    - OECD.AI 的 OpenRouter 資料未明示授權。
    - Natural Earth（國界、鐵路、河流中心線）與 OurAirports 是公有領域。
    - **NASA 日食網站（eclipse.gsfc.nasa.gov，Fred Espenak）的預報是公有領域，要求標示**（日食路徑主題，第 88 點；2026-10-28 讀過）：
      - NASA Copyright Information（https://eclipse.gsfc.nasa.gov/SEpubs/copyright.html）：「NASA material is not protected by copyright unless noted. If not copyrighted, NASA material may be reproduced and distributed without further permission from NASA.」，並請標示「Eclipse map/figure/table/predictions courtesy of Fred Espenak, NASA/Goddard Space Flight Center, from eclipse.gsfc.nasa.gov.」
      - 貝塞爾根數頁（SEdata、SEbeselm）與路徑表的頁尾：「Permission is freely granted to reproduce this data when accompanied by an acknowledgment: "Eclipse Predictions by Fred Espenak, NASA's GSFC"」；五千年日食目錄的說明頁（SEcatkey.html）寫「"Eclipse Predictions by Fred Espenak and Jean Meeus (NASA's GSFC)"」。
      - 頁尾的來源與主題說明的第一句照寫「Eclipse Predictions by Fred Espenak, NASA’s GSFC」（另寫五千年日食目錄是 Espenak & Meeus），`manifest.json` 的 `credit` 也是。路徑是用他們的根數自己算的，NASA 沒有審查過這裡的計算（說明有寫跟 NASA 路徑表的差距）。
      - **沒有用的**：Xavier Jubier 的 KMZ／Google Maps 路徑（授權不明）；EclipseWise.com（Espenak 自己的網站，同樣准許轉載、要寫「Eclipse Predictions by Fred Espenak, www.EclipseWise.com」，但地圖與圖不能改；NASA 網站已經有需要的根數，又是公有領域，所以用 NASA 的）。
    - **NOAA NCEI 的磁極位置與 World Magnetic Model 2025 可以自由使用**（北磁極的漂移與磁偏角主題，第 101 點；2026-10-28 讀過）：WMM 的頁面寫「The WMM source code is in the public domain and not licensed or under copyright. The information and software may be used freely by the public」，NCEI 地磁頁寫「The information and software may be used freely by the public」；WMM 是 NOAA NCEI 與英國 BGS 共同製作，照 NCEI 的建議引用「NOAA NCEI Geomagnetic Modeling Team; British Geological Survey. 2024: World Magnetic Model 2025」（doi 10.25921/aqfd-sd83），寫在頁尾的來源與 `manifest.json`。**IGRF-14 沒有用**：NCEI 的 IGRF 頁寫的「public domain … may be used freely」是在 Geomag 7.0 軟體的授權底下，係數本身的授權沒寫（待確認），所以第一版不做歷史的磁偏角。
    - **NOAA SWPC 的 OVATION 極光預報與行星 K 指數**（此刻的極光，第 102 點；2026-10-29 讀過）：美國政府（NOAA 太空天氣預報中心）的著作，依 17 U.S.C. § 105 不受著作權保護；SWPC 網站找不到另外的使用條款或免責頁。由使用者的瀏覽器直接向 NOAA 讀取（回應有 `Access-Control-Allow-Origin: *`），網站不轉存；頁尾寫來源。
    - **CLIWOC 2.1 是 CC BY 3.0**（大航海時代的航海日誌，第 103 點；2026-10-29 讀過）：PANGAEA 的資料集頁（doi:10.1594/PANGAEA.743343「CLIWOC Database 2.1 (final release, original IMMA format)」，屬於 doi:10.1594/PANGAEA.611088 的資料集系列）在 License 欄與 JSON-LD 都寫 Creative Commons Attribution 3.0 Unported；下載不必登入（hs.pangaea.de 的 CLIWOC21.zip，29 MB）。頁尾的來源寫資料集與作者（García-Herrera 等 2007），附註寫我們怎麼清理與斷開航線（改作要標明）。航線、側欄的地名與船名是日誌原文的事實，照抄。判斷航線穿過陸地用的 Marine Regions IHO 海域（CC BY 4.0）只用來分類，不輸出形狀（同河流主題）。
    - **Beck 等人 2023 的柯本－蓋格分類圖是 CC BY 4.0**（氣候分區，第 104 點；2026-10-29 讀過）：figshare 的 API（articles/21789074）`license` 是 CC BY 4.0，第 2 版 2026-01-14 發布；說明頁請使用者引用 Beck et al. (2023), Scientific Data 10, 724。下載不必登入（koppen_geiger_tif.zip，130 MB）。作者網站 gloh2o.org 的連結寫 CC BY-NC，以資料實際發布的 figshare 為準（規劃手冊的授權查證同一個結論）。頁尾的來源寫論文與 figshare，附註寫我們用 0.1° 版本與怎麼算國家的面積。30 類的顏色照它的 legend.txt（Beck 的配色）。
    - **冰河、海冰與海平面的三份資料**（第 105 點；2026-10-29 讀過）：WGMS AMCE（wgms-amce-2026-02-10.zip）照 WGMS 的 data policy 等同 CC BY 4.0，引用寫資料集（doi:10.5904/wgms-amce-2026-02-10）與 Dussaillant 等 2025；NSIDC 海冰指數 G02135 第 4 版是 NOAA@NSIDC 的產品（美國政府著作），不必登入，照 NSIDC 的要求引用；NOAA STAR 的海平面網格（slr_map_ref.nc）檔頭要求「Altimetry data are provided by NOAA Laboratory for Satellite Altimetry」，頁尾的來源照寫這句，檔頭也寫它是實驗性產品（附註寫明）。規劃手冊的授權查證（2026-10-28）同一個結論；RGI 冰河輪廓要 Earthdata 登入、PSMSL 潮位站授權待確認，都沒有用。
    - **Wikimedia 的差分隱私瀏覽量與 Wikidata 都是 CC0**（各國在讀什麼，第 106 點；2026-10-29 讀過）：country_project_page 的說明頁（analytics.wikimedia.org/published/datasets/country_project_page/00_README.html）指向 Wikimedia 的資料授權頁（dumps.wikimedia.org/legal.html），那裡寫「All Analytics datasets are available under the Creative Commons Zero (CC0)」；下載不必登入。條目名稱用 Wikidata 的標籤與維基百科的條目名稱（CC0，名稱是事實，不是條目內文）；不轉載條目的內容。頁尾的來源寫兩者。使用者決定熱門條目照原樣列出、不過濾成人或聳動的內容（附註寫明）。
    - **Cliopatria 是 CC BY 4.0，COLDAT 是 CC0**（帝國與疆界，第 107 點；2026-10-29 讀過）：Cliopatria 的 GitHub（Seshat-Global-History-Databank/cliopatria）LICENSE.md 寫 Creative Commons Attribution 4.0 International，Zenodo 的 v0.2.1（records/23128623，2026-10-03，doi:10.5281/zenodo.23128623）`license` 也是 cc-by-4.0；README 請引用 Bennett 等 2025（Scientific Data，doi:10.1038/s41597-025-04516-9）。頁尾的來源寫資料集與論文，附註寫我們怎麼取樣、簡化、修正台灣（改作要標明，改過的範圍 tooltip 也寫）。COLDAT（Becker，Harvard Dataverse doi:10.7910/DVN/T9SDEW）是 CC0 1.0（規劃手冊第十四節的查證）。下載都不必登入。historical-basemaps 是 GPL-3.0，沒有用。
    - **Merdith 等 2021 的板塊模型是 CC BY 4.0，pyGPlates 是 GPL-2.0、只在建置時用**（板塊漂移，第 108 點；2026-10-29 讀過）：Zenodo 的 records/13635864（v1.2.4，「Extending full-plate tectonic models into deep time: Linking the Neoproterozoic and the Phanerozoic」，Merdith、Williams、Collins 等）`license` 是 cc-by-4.0，下載不必登入。頁尾的來源寫模型與版本，附註寫我們怎麼把今天的國界切到板塊上、轉回去（改作要標明）。pyGPlates（pip 的 pygplates 1.0，GPL-2.0）只在 pipeline 裡算重建，網站不帶它，輸出的是模型算出來的座標（不是 pyGPlates 的程式碼）；`pipeline/requirements.txt` 註明。GPlates Web Service 的條款只寫「All rights reserved」，不從瀏覽器呼叫（規劃手冊第十四節）。
    - **NCEP/NCAR 再分析沒有使用限制，要致謝**（風與季風，第 109 點；2026-10-29 讀過）：NOAA PSL 的資料集頁（psl.noaa.gov/data/gridded/data.ncep.reanalysis.html）寫「Usage Restrictions: None」，請使用者寫「NCEP Reanalysis data provided by the NOAA PSL, Boulder, Colorado, USA, from their Web site at https://psl.noaa.gov」；頁尾的來源與附註照寫這句。下載不必登入：downloads.psl.noaa.gov 對這裡的環境回 403，改從同一個單位公開的 THREDDS 伺服器（psl.noaa.gov/thredds/fileServer）下載同樣的檔（沒有改 User-Agent 或繞過驗證）。資料集 2026-03-17 起停止更新，1991–2020 年的平均不受影響。ERA5 要登入 Copernicus 帳號，沒有用。
    - **NASA 五千年月食目錄（LEcat5）同一個網站、同樣的條件**（日食與月食主題的月食，第 99 點；2026-10-28 讀過）：每一頁的 Acknowledgments 寫「Permission is freely granted to reproduce this data when accompanied by an acknowledgment: "Eclipse Predictions by Fred Espenak and Jean Meeus (NASA's GSFC)"」，NASA 的資料不受著作權保護（上面的 Copyright Information）。頁尾的來源與主題說明照寫這句，`manifest.json` 的 `lunarSource` 也是。
    - **HydroRIVERS v1.0 適用 HydroSHEDS 第 1 版的授權協議**（河流與流域主題，第 86 點；2026-10-28 讀過全文）：
      - 協議全文在 HydroSHEDS Technical Documentation v1.4 的附錄 A（https://data.hydrosheds.org/file/technical-documentation/HydroSHEDS_TechDoc_v1_4.pdf ），HydroRIVERS 的技術文件第 4.1 節寫明「covered by the same License Agreement as the HydroSHEDS database」，官方產品頁寫「freely available for scientific, educational and commercial use」。網站的 Terms of Use（https://www.hydrosheds.org/terms-of-use ）只管網站上的文字與圖片（不能改作、不能散布），資料各依產品自己的授權。
      - 第 2.1.1 條准許為了跟衍生作品（Derivative Works）整合而使用、重製、展示；第 2.1.2 條准許把資料「incorporated into any Derivative Works」散布給使用者，條件是使用者的條款「at least as protective of the Licensed Materials as the terms of this License」，而且「In no event shall Licensee license or distribute the Licensed Materials as a stand-alone product」；第 2.1.3 條不准反編譯、還原，要防止未經授權的複製與散布；第 2.2 條與附錄 B 要求一段固定的版權聲明（「must be displayed with, attached to or embodied in (in a reasonably prominent manner) the documentation or metadata」）；第 8.1 條不能用 WWF 的名稱、商標、標誌。
      - **判斷：可以用**。這裡散布的是地圖網站這個衍生作品的一部分：只取流量或集水面積夠大的河道（847.8 萬段裡的約 98 萬段）、相鄰的接成一條、Douglas–Peucker 簡化到約 0.65–1.7 km、量化到 0.005–0.01°，加上自己算的流向、名稱，不是 HydroRIVERS 本身。附錄 B 的聲明（產品名稱填「World Data Map (Rivers and drainage basins)」）原文放在資料夾裡的 `public/data/topics/rivers/HYDROSHEDS-NOTICE.txt` 與 `manifest.json`，主題頁尾的說明開頭寫中文、英文摘要，README 的資料來源也有。給使用者的條款寫在同一個檔與頁尾：照原樣提供、不保證正確，只能搭配這個地圖使用，不得抽出來當獨立的資料集再散布、授權或販售，不得還原成 HydroSHEDS 的原始資料，不得使用 WWF 的名稱或標誌。版本庫本身沒有開放授權條款（根目錄沒有 LICENSE），這些檔不會被當成開放資料轉授權。仍有的風險：靜態網站的 JSON 任何人都下載得到，第 2.1.3 條「防止未經授權的複製」只能靠上面的條款，做不到技術上的保護；WWF 認為不夠時，可以改成只輸出主檔（世界全圖）或換成 Natural Earth 的河流（公有領域，但沒有流量與集水面積、也沒有台灣）。使用者看過這個風險，2026-10-28 決定維持 HydroSHEDS。
      - **轉載的版本標示的授權不一樣**：Stanford 與 NYU 圖書館收藏的 2006、2007 年 HydroSHEDS 河網（例如 purl.stanford.edu/wf122zm7811 的「Africa: River Network, 15s resolution, 2007」）標 CC BY-NC 3.0，說明寫只能非商業使用、沒有作者書面同意不能再散布；UT Austin 的 geodata 目錄也標 CC BY-NC 3.0。那是舊版授權（2022 年以前 HydroSHEDS 只准非商業使用）的轉存，現行的協議（版權年份 2006–2022）准許商業使用與上面的散布方式，這裡照官方的協議。本站非商業，舊的條件也不違反，但「不能再散布」那一條跟現行協議不同，以 hydrosheds.org 現行的為準。
      - 引用：Lehner, B., Grill G. (2013): Global river hydrography and network routing: baseline data and new approaches to study the world's large river systems. Hydrological Processes, 27(15): 2171–2186。
    - Marine Regions 的 IHO Sea Areas 第 3 版（https://doi.org/10.14284/323 ）、Global Oceans and Seas 第 1 版（https://doi.org/10.14284/542 ）是 CC BY 4.0（跟專屬經濟海域同一個網站的條款），河流與流域主題只用來判斷河口流進哪一片海，不輸出海域的形狀。
    - **地球的另一邊**（第 89 點，2026-10-28）：國界與城鎮是 Natural Earth（公有領域）；海的名稱與所屬大洋用上面那兩份 Marine Regions（CC BY 4.0），這個主題輸出一份 0.25° 的海域網格（`public/data/topics/antipodes/seas.json`，每一格是哪一片海，陸地的格子填最近的海），是 IHO 海域的改作，CC BY 4.0 准許改作後再散布，頁尾的來源寫 Marine Regions、版本與 DOI；首都是國家小檔案的 Wikidata 首都（CC0）。台北的對蹠點另外用 OpenStreetMap 的 Nominatim 反查核對過（資料 ODbL），只用來核對、沒有轉載，照 Nominatim 的使用政策只查了兩次、User-Agent 寫專案網址。
    - **AidData 的 Global Chinese Development Finance Dataset 3.0 是 ODC-By 1.0**（中國的海外貸款，第 91 點；2026-10-28 讀過 xlsx 的 License 與 Contents 工作表）：
      - License 工作表：「The original dataset produced by AidData is licensed using the Open Data Commons Attribution License (ODC-By).」「Any use of the dataset and its content must include appropriate attribution to AidData.」以及「you must make clear to others the license of the database and keep intact any notices on the original database」。
      - 照做：頁尾的來源寫「AidData, Global Chinese Development Finance Dataset, Version 3.0」、授權寫 ODC-By 1.0、連到 AidData 的資料集頁；主題說明的最後一句照 Contents 工作表的非學術引用格式寫「AidData. 2023. Global Chinese Development Finance Dataset, Version 3.0. Retrieved from https://www.aiddata.org/data/aiddatas-global-chinese-development-finance-dataset-version-3-0」，`manifest.json` 的 `source` 也寫授權。
      - 下載的 zip 不必填表、不必登入（docs.aiddata.org）。**沒有用的**：Boston University Global Development Policy Center 的中國貸款資料庫沒寫授權（待確認）；AidData 另外的空間資料（Geospatial GCDF 3.0，項目的點、線、面）這次沒有用。
    - **Global Dam Watch database v1.0 是 CC BY 4.0**（河流與流域主題的水壩，第 96 點；2026-10-28 讀過）：figshare 的資料集頁（https://doi.org/10.6084/m9.figshare.25988293.v1 ，2024-07-25 發布）與 figshare API 的 license 欄都是 CC BY 4.0。官網（globaldamwatch.org）下載要填表，figshare 的直連不必填、不必登入。頁尾的來源寫資料庫名稱與 DOI，主題說明寫「Lehner 等人 2024」；figshare 的引用格式：「Lehner, Bernhard; Beames, Penny; Mulligan, Mark; Zarfl, Christiane; De Felice, Luca; van Soesbergen, Arnout; et al. (2024). Global Dam Watch database version 1.0. figshare. Dataset. https://doi.org/10.6084/m9.figshare.25988293.v1」。
    - 台灣的水庫：經濟部水利署「水庫基本資料」（data.gov.tw 32726）的授權欄是政府資料開放授權條款第 1 版；完工年份取自水利署網站的「主要水庫簡介」（https://www.wra.gov.tw/News.aspx?n=3254&sms=9089 ，網站的政府網站資料開放宣告採同一個條款），一座一個網址寫在 `pipeline/sources/wra_reservoirs.py`；座標用 Wikidata（CC0），小池水庫用 OpenStreetMap 的位置（ODbL，一個點的座標，跟底圖一樣標示 © OpenStreetMap contributors）。    - **地球的另一邊**（第 89 點，2026-10-28）：國界與城鎮是 Natural Earth（公有領域）；海的名稱與所屬大洋用上面那兩份 Marine Regions（CC BY 4.0），這個主題輸出一份 0.25° 的海域網格（`public/data/topics/antipodes/seas.json`，每一格是哪一片海，陸地的格子填最近的海），是 IHO 海域的改作，CC BY 4.0 准許改作後再散布，頁尾的來源寫 Marine Regions、版本與 DOI；首都是國家小檔案的 Wikidata 首都（CC0）。台北的對蹠點另外用 OpenStreetMap 的 Nominatim 反查核對過（資料 ODbL），只用來核對、沒有轉載，照 Nominatim 的使用政策只查了兩次、User-Agent 寫專案網址。
    - USGS GMTED2010 是公有領域；Wikidata 是 CC0；地圖上的 AWS Terrain Tiles 依各資料來源標示（見第 5 節「地形圖層」）。
    - **GMBA Mountain Inventory v2**（山脈，第 112 點，2026-10-29）：EarthEnv 的頁面（https://www.earthenv.org/mountains ）寫「This work is licensed under a Creative Commons Attribution 4.0 International License」，引用 Snethlage, M.A. et al. (2022)。頁尾寫「GMBA 山脈名錄 v2」、CC BY 4.0，連到該頁；直接下載 zip，不必登入。中文名稱來自 Wikidata（CC0）、GMBA 的 Name_ZH 與自己翻的。
    - 底圖：OpenFreeMap（免費、不需金鑰）、© OpenMapTiles、資料 © OpenStreetMap contributors（ODbL）。地圖右下角會自動標示。
    - UN DESA International Migrant Stock 2024 是 CC BY 3.0 IGO（寫在 Excel 檔裡）。
    - UNHCR Refugee Population Statistics Database 是 CC BY 4.0，另加 UNHCR 的資料集條款（https://www.unhcr.org/terms-use-datasets）：要用資料庫名稱標示，分享資料時也要附上條款的網址（頁尾多列一項），不能暗示 UNHCR 背書。
    - **Pew Research Center 的宗教組成只能發布摘錄**（見第 27 點）。
    - **World Inequality Database 是 CC BY-NC-SA 4.0**（非商業、相同方式分享）：wid.world 的資料頁與國家頁的授權標章連到 CC BY-NC-SA 4.0，原本寫 CC BY 4.0 的說明文字被註解掉了（例如 https://wid.world/country/taiwan/ 的原始碼，2026 年 10 月查），整包下載的 README 沒有寫授權；Our World in Data 轉載時仍標 CC BY 4.0。本站非商業，照較嚴的 CC BY-NC-SA 4.0 使用與標示，從 WID 算出的資料檔（貧富差距的所得份額、存款與財產的財富指標）也適用同一授權。跟 IHME（要簽非商業使用協議，見第 23 點）不同，這是公開的 CC 授權，別人再利用時條件清楚，所以照用。
    - OECD 的性別薪資差距適用 OECD 資料條款（見下面「OECD 的資料不是 CC BY 4.0」）。
    - ILO 模型估計的勞參率、IPU 的國會女性比例用世界銀行轉載的版本（CC BY 4.0）。
    - 僑務委員會、移民署、中選會、性平處的資料適用政府資料開放授權條款。
    - IMF 資料（WEO、Financial Access Survey、世界稅收資料庫 WoRLD）可以轉載、改作，要註明「Source: International Monetary Fund」，有實質轉換要說明；商業再利用要另外申請（https://www.imf.org/en/About/copyright-and-terms）。
    - 國際勞工組織 ILOSTAT 是 CC BY 4.0（2023 年 5 月 3 日起發布的資料庫與資料集，https://www.ilo.org/rights-and-permissions）。
    - Penn World Table 11.0 是 CC BY 4.0，要引用 Feenstra, Inklaar & Timmer (2015)。
    - OECD 全球稅收統計、家庭儲蓄率適用 OECD 資料條款（見下面「OECD 的資料不是 CC BY 4.0」）。
    - **UNESCO 統計研究所自己的資料庫是 CC BY-SA 4.0**，WIPO 的統計資料庫條款不准轉載資料集，研發與創新主題都用世界銀行以 CC BY 4.0 轉載的部分（見第 33 點）。
    - **開學月份用 UIS 自己的資料（CC BY-SA 4.0）**（學制與開學月份，第 115 點，2026-10-29，使用者決定）：世界銀行沒有轉載這個指標（403），只好用 UIS 的公開 API（不必登入、不必金鑰）。`public/data/topics/education/school-start.json` 是衍生的資料檔，依 CC BY-SA 4.0 分享，檔案的 `license` 欄位與頁尾都寫明；義務教育年數、入學年齡照舊用世界銀行轉載的 CC BY 4.0 版本。台灣的學年、義務教育依法規（法律條文依著作權法第 9 條不是著作權的標的）。
    - **UNU-WIDER 政府收入資料庫（GRD）、UBS Global Wealth Report 沒有用**：前者沒寫資料授權（網站預設 CC BY-NC-SA 3.0 IGO，下載要填表），後者是商業出版品（見第 31、32 點）。
    - 主計總處適用政府資料開放授權條款。
    - 數位發展部、NCC、衛福部、教育部、內政部、中央銀行、交通部觀光署、農業部、勞動部、財政部、國科會、智慧局、金管會的開放資料也適用政府資料開放授權條款。
    - **UN Tourism 的資料庫禁止轉載**，觀光主題只用世界銀行以 CC BY 4.0 轉載的部分（見第 20 點）。
    - CRU TS 是 Open Database License（ODbL）＋ Database Contents License，要標示「Climatic Research Unit, University of East Anglia」，衍生的資料庫要用同樣的授權（https://crudata.uea.ac.uk/cru/data/hrg/ 與 4.10 版資料夾頁面的 License 一節）。這裡的各國平均與暖化網格圖磚是衍生資料庫，所以同樣以 ODbL 提供（跟 OpenStreetMap 的資料一樣）。引用 Harris et al. (2020), Scientific Data 7, 109。
    - 中央氣象署網站適用「政府網站資料開放宣告」（政府資料開放授權條款，註明出處即可利用）。
    - **一年下雨幾天**（第 150 點，2026-10-30）：CRU TS 4.10 的 wet 跟 tmp、pre 同一個資料集、同一個授權（ODbL，各國平均同樣以 ODbL 提供）。台灣附註用中央氣象署開放資料平臺的「過去氣象觀測」逐月資料（S3 公開檔 `Climate/C-B0026-002.zip`，不必登入），政府資料開放授權條款。
    - **日照時數**（第 151 點，2026-10-30）：CRU CL v2.0（`grid_10min_sunp.dat.gz`）。下載頁 https://crudata.uea.ac.uk/cru/data/hrg/tmc/ 本身沒有授權字句，但 CRU 資料頁 https://crudata.uea.ac.uk/cru/data/hrg/ 的「Current CRU-CL datasets」列出 CRU-CL v2.0，同一頁的 License 一節「These datasets are made available under the Open Database License … Please use the attribution Climatic Research Unit, University of East Anglia」：有條件（ODbL，各國平均同樣以 ODbL 提供）。台灣附註同上用中央氣象署 C-B0026-002 的 SunshineDuration。
    - **全球二氧化碳觀測站**（第 152 點，2026-10-30）：NOAA GML 的瓶採樣 CO2（`co2_surface-flask_ccgg_text.zip`，README Version 2026-07-17）：可用。README 第 3 節「These data were produced by NOAA and are not subject to copyright protection in the United States. NOAA waives any potential copyright and related rights in these data worldwide through the Creative Commons Zero 1.0 Universal Public Domain Dedication (CC0 1.0)」；第 2 節請引用（Lan et al., doi:10.15138/wkgj-f215），寫在資料來源。
    - World Bank 氣候知識平台（CCKP）是 CC BY 4.0，只用來比對，沒有轉載。
    - WashU ACAG 的 SatPM2.5（V6.GL.02）是 CC BY 4.0（資料頁標示）。
    - 環境部的開放資料（全國細懸浮微粒手動監測資料、空氣污染物濃度測值）適用政府資料開放授權條款。
    - **世界銀行轉載的 PM2.5（`EN.ATM.PM25.MC.M3`、`.ZS`）沒有用**：WDI 標 CC BY 4.0，但原始資料是 IHME GBD（非商業使用、要登入才能下載）；HEI State of Global Air 也來自 IHME（見第 35 點）。
    - FAO 全球森林資源評估（FRA 2025）是 CC BY 4.0（FRA 平台頁尾、FAO 資料目錄「Global Forest Resources Assessment」）。
    - FAO AQUASTAT 的說明（https://www.fao.org/aquastat/en/databases/maindatabase/metadata/）寫明使用條款依 FAO 統計資料庫的條款，也就是 CC BY 4.0（「除非另外標示」，https://www.fao.org/contact-us/terms/db-terms-of-use/）；世界銀行（`ER.H2O.*`）與 Our World in Data 轉載 AQUASTAT 時也標 CC BY 4.0。但 FAO 資料目錄（data.apps.fao.org/catalog）上「AQUASTAT Dissemination System」（互動查詢網站的設定檔）標的是 CC BY-NC-SA 4.0，兩者不一致。水資源壓力用的是世界銀行轉載的版本（CC BY 4.0）；直接用 AQUASTAT 批次檔的只有各國的總可再生水資源、境內水資源（算人均值與世界值）和世界的水資源壓力。如果要更保守，人均水資源只能換成只有境內的 `ER.H2O.INTR.PC`。
    - WHO/UNICEF JMP 的網站（washdata.org）沒有寫授權條款，所以用世界銀行轉載的版本（`SH.H2O.SMDW.ZS`，CC BY 4.0）。
    - 經濟部水利署網站的「政府網站資料開放宣告」採政府資料開放授權條款第 1 版；農業部林業及自然保育署的「政府網站資料開放宣告」是無償、非專屬、可再授權、註明出處即可利用（跟政府資料開放授權條款相同），這裡比照標示。
    - IEA Global EV Data Explorer 是 CC BY 4.0（資料頁標示；IEA 的 CC 授權附加條款要求註明「IEA 年份, 標題, 網址, Licence: CC BY 4.0」，不得使用 IEA 標誌或暗示 IEA 背書）。同一份資料的 .Stat Suite 下載檔標示 Terms of Use for Non-CC Material，沒有用（見第 37 點）。
    - 交通部公路局統計查詢網適用政府資料開放授權條款（公路局在政府資料開放平臺的統計資料集，例如 data.gov.tw 30202「新車領牌數」，說明欄指向這個查詢網）；交通部網站的新聞稿適用交通部「政府資料開放宣告」（無償、非專屬、註明出處即可利用）。
    - **V-Dem 是 CC BY-SA 4.0（相同方式分享）**：可以商業使用、改作，但改作的成果要用同樣的授權分享（https://www.v-dem.net/data/the-v-dem-dataset/ ，條文 https://creativecommons.org/licenses/by-sa/4.0/）。民主與自由主題的資料檔（`public/data/topics/democracy/`）是改作（取子集、改國家代碼、差分編碼、算世界平均），所以頁尾寫明依 CC BY-SA 4.0 分享，這個主題匯出的地圖圖片與 CSV 也一樣。相同方式分享只管改作的資料本身，不會擴及網站程式碼或其他主題的資料。vdemdata 套件的程式碼是 GPL-3，這裡只用它的資料；「external variables」（`e_` 開頭）來自其他機構、各有授權，沒有用（見第 38 點）。
    - USGS ComCat、NOAA NCEI 全球重大地震資料庫是美國政府資料，公有領域。
    - Smithsonian GVP 的 Volcanoes of the World 是美國政府雇員的職務作品（不受著作權保護）；Smithsonian 網站條款限個人、教育與其他非商業用途、註明出處，商業用途或「publication」要事先書面同意。本站非商業、頁尾註明來源，所以採用；要商業使用或擔心「publication」的解釋，可以改用 NOAA 的火山位置資料庫（也是 GVP 的舊版資料，授權欄「未指定」，沒有確切噴發年份）。見第 39 點。**使用者 2026-10-25 確認：GVP 的火山資料照現在的方式繼續用（非商業、註明出處）**，不換成 NOAA。
    - PB2002 板塊邊界（fraxen/tectonicplates）是 ODC-By 1.0，要註明 Hugo Ahlenius、Nordpil 與 Peter Bird。
    - 外交部駐外館處通訊錄（data.gov.tw 6119）、領事事務局免簽證名單（data.gov.tw 30749）是政府資料開放授權條款第 1 版；領務局的國家清單是網站內容，網站的「政府網站資料開放宣告」採同一個條款。邦交國的建交、斷交日期是史實，表格自己整理，只拿維基百科（CC BY-SA 4.0）交叉比對（見第 41 點）；Wikidata 的 P530 起訖日期大多是空的，ICPSR 的外交承認資料集禁止再散布，都沒有用。
    - Nobel Prize API（api.nobelprize.org）是 CC0（https://www.nobelprize.org/about/terms-of-use-for-api-nobelprize-org-and-data-nobelprize-org/）；條款另外要求不刻意竄改或誤導、不用 Nobel Prize Outreach 的名稱或商標暗示背書（主題名稱「諾貝爾獎」只是描述資料內容，沒有用標誌）。
    - 國家發展委員會的人口推估（data.gov.tw 6101「人口推計」）是政府資料開放授權條款第 1 版；生育率與高齡化主題只在台灣的附註引用幾個數字，沒有轉載資料檔。內政部戶政司的人口統計同樣適用政府資料開放授權條款。
    - **UNODC 資料入口（data.unodc.org）不准轉載**：頁尾的 Terms and Conditions 連到聯合國網站的一般條款（https://www.unodc.org/unodc/legal.html）：只限個人、非商業使用，「without any right to resell or redistribute them or to compile or create derivative works」。原本 dataunodc.un.org 的資料條款允許註明出處後轉載，但舊網址（含條款頁）現在都轉到新網站。故意殺人率用世界銀行以 CC BY 4.0 轉載的版本；監禁人口率、在監人數、未判決比例沒有開放授權的轉載版，所以監禁人口率改用各國、各區域自己的開放資料，只收有開放授權資料的國家（下面幾項，見第 43 點）。
    - **World Prison Brief（ICPR）沒有用**：網站只寫「© World Prison Brief」，要求引用，沒有授權轉載資料（https://www.prisonstudies.org/about-us）。
    - 世界銀行 Worldwide Governance Indicators 是 CC BY 4.0（https://datacatalog.worldbank.org/search/dataset/0038026）。
    - WGI 的整包 Excel（`wgidataset_with_sourcedata-2026.xlsx`）除了彙總的指標，還有各資料來源換算後的值（「EIU mean」等 35 欄）。WGI 的 Usage Advisory（https://www.worldbank.org/en/publication/worldwide-governance-indicators/usage-advisory ，2026-10-26 查）寫 EIU、Gallup World Poll、PRS Group、S&P Global、世界經濟論壇五個來源的換算值只能用在自己的分析、研究或教學，不得轉載。政府治理主題只用彙總的估計值、分數、標準誤、信賴區間與來源數（API 的序列中繼資料標 `License_Type: CC BY-4.0`），沒有用各來源的欄位（第 73 點）。
    - **國際透明組織（Transparency International）的清廉印象指數（CPI）沒有用**：transparency.org 的頁尾寫「Except where otherwise noted, this work is licensed under CC BY-ND 4.0」（CPI 2025 的頁面，2026-10-26 查），不得改作；地圖上色、換算、合併成資料檔都算改作，所以貪腐用 WGI 的貪腐控制（第 73 點）。
    - 內政部警政署、法務部統計處的開放資料採政府資料開放授權條款第 1 版。法務部網站（含法務統計資訊網 rjsd.moj.gov.tw 的年報）的「資料開放宣告」：網站上的資料與素材採政府資料開放授權條款第 1 版（https://www.moj.gov.tw/2807/2817/33911/ ，2026-10-25 查）。
    - **監禁人口率用到的各國來源**（2026-10-25 查）：
      - Eurostat 監獄統計（crim_pris_cap、crim_pris_pop）：CC BY 4.0（同上面的 Eurostat）。資料是 Eurostat 與 UNODC 共同收集的，但 Eurostat 發布的資料集適用 Eurostat 的條款，不是 UNODC 資料入口的條款。
      - 美國司法統計局（BJS）《Correctional Populations in the United States》：聯邦政府機關的職務作品，公有領域（17 U.S.C. § 105），頁尾仍註明來源。
      - 加拿大統計局表 35-10-0154-01、35-10-0155-01：Statistics Canada Open Licence（https://www.statcan.gc.ca/en/terms-conditions/open-licence），可以重製、改作、商業使用；要註明「Adapted from Statistics Canada, Table …」，不得暗示加拿大統計局背書，頁尾照寫。
      - 澳洲統計局（ABS）《Prisoners in Australia, 2025》：CC BY 4.0（© Commonwealth of Australia）。
      - 日本法務省《令和 7 年版 犯罪白書》的 Excel：法務省網站的內容「権利表記の記載がない限り」適用公共データ利用規約（第 1.0 版，PDL1.0，https://www.moj.go.jp/hisho06_00280.html），跟 CC BY 4.0 相容；要寫出處，編輯、加工過的要另外寫明，所以頁尾寫「加工後使用」。
    - **監禁人口率沒有用的來源**：
      - 紐西蘭矯正部（Corrections）的季度監獄統計：網站的著作權頁寫 CC BY-NC-ND 3.0 NZ（禁止改作），不是開放授權；Stats NZ（CC BY 4.0）只有收監、羈押的人次（throughput），沒有在監人數，Aotearoa Data Explorer 的 API 也要申請金鑰。
      - 南韓法務部：e-나라지표「교정시설 수용현황（1일 평균 수용 인원）」有 1996 年起的資料，但頁面沒有공공누리（KOGL，韓國的公共著作授權）標示；《교정통계연보》只寫轉載要註明出處，沒有開放授權；KOSIS 的 API 要申請金鑰。
      - 英國 2018 年以後：Eurostat 只到 2017 年。英格蘭與威爾斯（司法部 MoJ）、蘇格蘭（蘇格蘭政府）、北愛爾蘭（司法部）各自發布，都是 OGL v3，可以用；但要三個來源分別解析，參考日也不同（英格蘭與威爾斯是每月月底的人數，蘇格蘭、北愛爾蘭主要是年度的平均每日人數），這次沒有做（見第 9 節）。
    - **World Happiness Report 沒有正式的開放授權**：報告寫明「This publication may be reproduced using the following reference」（附引用格式），資料分享頁（https://worldhappiness.report/data-sharing/）寫「The data we present in Figure 2.1 are available to download for free」，沒有限制轉載的條款；Our World in Data 也依這個「Data sharing policy」轉載。所以照報告要求的格式引用、只用公開的 Figure 2.1 資料。更多的蓋洛普世界民調資料要訂閱，條款另計，沒有用（見第 44 點）。
    - 國民健康署的「18歲以上人口目前吸菸率-依性別分」（data.gov.tw 14462）採政府資料開放授權條款第 1 版；國健署網站的「政府網站資料開放宣告」相同（菸酒主題用網站上圖 1 的數字補 2018 年以後的年份）。
    - **Passport Index 資料集是 MIT**：imorte/passport-index-data 的 LICENSE（commit 9c59780，「MIT License, Copyright (c) 2019」，沒有寫名字）與 README（「Data scraped from passportindex.org … Licensed under MIT」）；前身 ilyankou/passport-index-dataset 的 LICENSE 是「MIT License, Copyright (c) 2019 Ilya Ilyankou」，README 的理由是 Passport Index 自稱「a free tool, built with publicly available information and with content contributed by fans and government agencies」。資料本身是 Arton Capital 的 passportindex.org 整理的（網站頁尾「© 2026 PASSPORTINDEX.ORG」）；網站的條款頁擋了程式，沒有讀到。簽證規定本身是各國政府公布的事實，本站非商業、頁尾同時註明 GitHub 資料集（MIT）與 passportindex.org，所以採用；要商業使用或擔心網站條款，可以改用各國政府公布的資料自己整理（台灣護照已經有領事事務局的名單）。Henley Passport Index 沒有開放授權的資料，沒有用。（見第 45 點）
    - UCDP（GED Global 26.1、UCDP/PRIO Armed Conflict Dataset 26.1）是 CC BY 4.0：下載頁（https://ucdp.uu.se/downloads/ ，2026-10-23 查）寫「All datasets are free of charge and licensed under CC BY 4.0 — you are free to use and redistribute them provided you cite the relevant publications listed with each dataset.」，所以頁尾列出各資料集要求引用的文獻（Davies, Pettersson & Öberg 2026；Sundberg & Melander 2013；Gleditsch et al. 2002），`manifest.json` 也有完整的引用。見第 46 點。
    - 國際組織的成員名單與加入、退出日期是史實，依各組織官網的成員名單自行整理成表（`pipeline/sources/igo_members.py`），不是轉載資料庫；頁尾的來源連到這個檔（列出每個官網的網址與查閱日期），授權標「史實自行整理」。交叉比對用的英文維基百科成員國條目是 CC BY-SA 4.0，只比對日期，沒有轉載文字，跟台灣的外交主題的邦交國表一樣在資料來源列出。
    - 東協 2026 年 5 月的對外關係名單（PDF）、WTO、北約、APEC、非洲聯盟、大英國協、上合組織的網頁只用來確認成員與日期，沒有轉載。（見第 47 點）
    - Erik Voeten 的聯合國大會投票資料（Harvard Dataverse，United Nations General Assembly Ideal Points 第 39 版）是 CC0 1.0（Dataverse 的 license 欄位），不要求標示；作者請使用者引用 Bailey, Strezhnev & Voeten (2017) 與 Fjelstul, Hug & Kilby (2025)（UNGA-DM），頁尾的來源有列（見第 48 點）。
    - **TeleGeography Submarine Cable Map 是 CC BY-NC-SA 3.0**（姓名標示—非商業性—相同方式分享）：TeleGeography 在 GitHub 的 `telegeography/www.submarinecablemap.com` 儲存庫（2022 年底刪除）README 的「How can I download the dataset?」連到的就是這裡用的 API 檔（`web/public/api/v3/cable/cable-geo.json` 等），「License」一節寫「Our map is made available under the following Creative Commons License: Attribution-NonCommercial-ShareAlike 3.0 Unported (CC BY-NC-SA 3.0)」，LICENSE 檔也是這個授權的條文；2019 年起的 Wayback Machine 存檔都一樣（http://web.archive.org/web/20221110120103/https://github.com/telegeography/www.submarinecablemap.com 、LICENSE：http://web.archive.org/web/20220325100817/https://github.com/telegeography/www.submarinecablemap.com/blob/master/LICENSE ）。TeleGeography 現在的說明頁（https://www2.telegeography.com/cite-telegeography-map ）寫公開的地圖是 CC BY-SA 4.0、「underlying databases」只給付費訂戶，沒有提到 API。使用者原本以為是 CC BY-SA 3.0，但找到的官方依據都是 NC 版或只講地圖，所以照較嚴的 CC BY-NC-SA 3.0 使用與標示（本站非商業，跟 World Inequality Database 一樣）。海底電纜主題的資料檔（`public/data/topics/submarine-cables/`）是改作（換國家代碼、接線、量化、計算各國統計），頁尾寫明依 CC BY-NC-SA 3.0 分享，匯出的地圖圖片與 CSV 也一樣。要商業使用得另外向 TeleGeography 授權。
    - 中央社報導只拿來交叉比對台灣的電纜數（引用事實、註明出處，不轉載內容）。
    - CEPII BACI（Etalab 2.0）也用在半導體主題（HS17 版的 8541、8542、8486 等）。財政部統計資料庫的進出口貿易統計（`web02.mof.gov.tw`，表 i8142、i9203）適用政府資料開放授權條款第 1 版（財政部網站的「政府網站資料開放宣告」）；半導體主題只在台灣的附註引用少量金額，頁尾列出來源。關務署的查詢系統要輸入驗證碼，沒有用。中國海關的 IC 進出口金額只在第 52 點對照（媒體引述），沒有放進網站。
    - CEPII BACI 也用在石油、天然氣與煤（第 90 點，HS92 版的 270900 原油、271111 LNG、271121 管道天然氣、2701 煤的四個六位碼），跟塑膠污染共用同一個 zip。
    - **EIA International Energy Statistics 是公有領域**（石油、天然氣與煤，第 90 點；2026-10-28 讀過）：https://www.eia.gov/about/copyrights_reuse.php 寫「U.S. government publications are in the public domain and are not subject to copyright protection. You may use and/or distribute any of our data, files, databases, reports, graphs, charts, and other information products that are on our website」，要求標示含發布日期（「Source: U.S. Energy Information Administration (Oct 2008)」）；整批下載檔 INTL.zip 每個系列的 `copyright` 欄位也是 "None"。EIA 的標誌不能用，沒有放。頁尾寫「U.S. Energy Information Administration, International Energy Statistics（2026 年 10 月）」、授權「公有領域」。不必 API key、不必登入。
    - **CIA World Factbook 是公有領域**（石油、天然氣與煤的原油、天然氣蘊藏量，第 90 點）：Factbook 是美國政府的出版品；CIA 2026 年 2 月撤掉 Factbook，原本的著作權頁轉到告別文（https://www.cia.gov/stories/story/spotlighting-the-world-factbook-as-we-bid-a-fond-farewell/ ），讀不到 CIA 自己的條款。用 GitHub 的鏡像 factbook/factbook.json（commit 144d697，2026-09-11），README 寫「offers free country profiles in the public domain (that is, no copyright(s), no rights reserved, no license)」，LICENSE.md 是 CC0 1.0。頁尾寫「CIA World Factbook（2021 年估計；factbook/factbook.json 鏡像）」、授權「公有領域」，連到鏡像。OPEC 年度統計公報的條款讀不到，沒有用（使用者 2026-10-28 決定）。
    - **Global Energy Monitor 的四個 tracker（GGIT 天然氣管線與 LNG 接收站、GOIT 油管、GOGET 油氣田、GCMT 煤礦）照發電廠地圖標 CC BY 4.0**（石油、天然氣與煤，第 90 點；**使用者 2026-10-28 決定**）。依據與風險：
      - 2026-10-28 讀 GEM 官網（四個 tracker 頁面、各 tracker 的 download-data 頁、/download-data/），都沒有資料授權的文字，只有網站頁尾「© 2026 Global Energy Monitor All Rights Reserved」與建議引用；GitHub 上 GEM 地圖的版本庫（GlobalEnergyMonitor/interim-maps、maps）沒有 LICENSE 檔。
      - 「All Global Energy Monitor tracker data are freely available under a Creative Commons Attribution 4.0 International Public License unless otherwise noted.」只在搜尋引擎索引的舊版下載頁看得到；發電廠地圖已經照這句話標示（第 59 點）。
      - 資料用 GEM 公開地圖 `config.js` 裡的 GeoJSON（publicgemdata.nyc3.cdn.digitaloceanspaces.com），直接下載、不必填表、不必登入；官網的「Download data」要填表，沒有用。
      - 頁尾每個 tracker 一列，名稱寫建議引用（含月份；GGIT 的管線是 2025 年 11 月版、LNG 接收站是 2026 年 10 月版，兩個都寫），授權寫 CC BY 4.0，連到 tracker 頁面。
      - 2026-10-30 補充（鋼鐵與水泥，第 176 點）：官網「Download data」表單的程式（https://api.globalenergymonitor.org/static/gem-download-form.bundle.js ，58,733 bytes）裡預設的授權文字是「Creative Commons Attribution 4.0 International (CC BY 4.0) — 」加上授權網址（`_licenseText()`），表單寄出的資料也標 CC BY 4.0，跟上面舊版下載頁的那句一致。
      - **GEM 公開說明授權改了的話，這四個圖層、發電廠地圖與工業主題的鋼鐵廠、水泥廠一起重新檢查。**
    - **經濟部能源署的能源供給年資料、原油／液化天然氣／煤炭進口來源年資料**（data.gov.tw 8309、163714、163715、163716）的資料集頁面都寫「政府資料開放授權條款-第1版」。能源署網站從 cloud 下載會拿到 Cloudflare 的驗證頁（HTTP 403），沒有繞過：2026-10-28 由本機 session 用一般的 HTTP GET（User-Agent 寫專案網址）代為下載，放進 skywitness/map-plan 的 `data/moeaea/`（附 SHA-256），pipeline 照常用 `download()`，在 cloud 重跑時把那幾個檔複製到 `pipeline/.cache/moeaea/`。只用在台灣的附註與側欄對照。
    - USGS Mineral Commodity Summaries（各章 PDF 與 ScienceBase 的資料發布）是美國公有領域（https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits ，請註明 USGS；2026 版資料發布的中繼資料標 CC0 1.0），見第 53 點。
    - 就業與失業主題直接用 ILOSTAT 的 ILO 模型估計（ILOEST）與非正式就業比例（`EMP_NIFL_SEX_RT_A`），適用上面 ILOSTAT 的 CC BY 4.0（第 54 點）。
    - World Bank/IMF 季度外債統計（QEDS）是 CC BY 4.0（資料目錄 0037740 的 License 欄「Creative Commons Attribution 4.0」）；WDI 轉載的國際債務統計（`DT.DOD.DECT.CD`）與 IMF 國際金融統計的外匯存底（`FI.RES.TOTL.CD`、`FI.RES.TOTL.MO`），序列中繼資料都標 `License_Type: CC BY-4.0`。IMF 的初級商品價格（PCPS，金價）跟 WEO 一樣依 IMF 的資料條款，註明來源即可轉載、改作。中央銀行的外匯存底（政府資料開放平臺 6025）是政府資料開放授權條款第 1 版；國際收支、國際投資部位與外債統計 PDF 是央行網站內容，央行的政府網站資料開放宣告採同一條款（第 55 點）。
    - **WFE 自己的統計資料庫不准轉載**（https://www.world-exchanges.org/our-work/statistics ：「For reproduction, citation, distribution and transmission of any data please contact the Secretariat」，否則禁止）。世界銀行轉載的 WFE 股市資料（`CM.MKT.LCAP.CD`、`CM.MKT.LCAP.GD.ZS`、`CM.MKT.LDOM.NO`）在 WDI 的序列中繼資料（`/v2/sources/2/series/<代碼>/metadata`）標 `License_Type: CC BY-4.0`（對照：軍費 `MS.MIL.XPND.CD` 標的是「SIPRI terms and conditions」），所以跟 WIPO、UN Tourism 一樣，只用世界銀行以 CC BY 4.0 轉載的部分，來源名稱寫明 WFE（第 56 點）。
    - **證交所、櫃買中心的網站資料沒有用**：兩邊的使用條款都禁止用程式下載、未經書面同意不得重製散布，只有授權給政府資料開放平臺的資料例外（https://www.twse.com.tw/zh/terms/use.html 、https://www.tpex.org.tw/zh-tw/gtsm_disclaimer.html）。台灣的股市數字改用金管會證期局的開放資料（data.gov.tw 103533）與證期局網站的「證券暨期貨市場重要指標」，都適用政府資料開放授權條款第 1 版（第 56 點）。
    - WHO 的道路安全資料：GHO 的 `RS_198`、`RS_246`、`RS_194` 是 CC BY 4.0（data.who.int 的條款，跟其他 GHO 指標一樣）。**《Global status report on road safety 2023》的各國指標檔是 CC BY-NC-SA 3.0 IGO**：檔案的 Notes 寫「Reference: Global status report on road safety 2023: country and territory profiles. Geneva: World Health Organization; 2023 Licence CC-BY-NC-SA 3.0 IGO」（WHO 出版品的授權）。本站非商業，照用（跟 World Inequality Database 一樣），用到它的資料檔（交通安全主題的行人、機車騎士占比，每萬輛機動車死亡數，側欄的組成）依 CC BY-NC-SA 3.0 IGO 分享，頁尾寫明；死亡率與死亡人數只用 GHO（CC BY 4.0）與 WPP。
    - 交通部統計查詢網：交通部的開放資料（data.gov.tw）採政府資料開放授權條款第 1 版；統計查詢網是交通部網站的一部分，適用交通部的「政府網站資料開放宣告」（無償、非專屬、註明出處即可利用），跟電動車主題用的交通部新聞稿一樣。
    - IANA 時區資料庫（tz database）是公有領域；PyPI 的 `tzdata` 套件（Apache 2.0）只是包裝，沒有轉載它的程式。
    - **NOAA Solar Calculator 的公式**（晝夜與季節，第 87 點）：計算器是 NOAA Global Monitoring Laboratory（美國政府）的著作，公式出自 Jean Meeus《Astronomical Algorithms》；公式本身不受著作權保護，`src/lib/solar.ts` 是照公式自己寫的，沒有複製 NOAA 的程式。頁尾、DESIGN.md 寫出處。NOAA 網站 2025 年起註明計算器「不再維護」，公式本身不變。
    - 英文維基百科「Mains electricity by country」是 CC BY-SA 4.0：旅行實用主題的插頭、電壓資料檔（`plugs.json`、`power.json`、`details.json`）是改作（換國家代碼、歸類），依 CC BY-SA 4.0 分享，頁尾寫明並連到固定的版本。行車方向用 Wikidata（CC0），只拿維基百科「Left- and right-hand traffic」核對。
    - 英文維基百科「Blood type distribution by country」是 CC BY-SA 4.0（血型分布主題，第 100 點）：資料檔（`public/data/topics/blood-types/`）是改作（換國家代碼、加總成 ABO 與 Rh 陰性、整理出處），依 CC BY-SA 4.0 分享，頁尾寫明並連到固定的版本，資料夾裡另放 `LICENSE.txt`。各國的數字原本出自各國捐血中心、論文等，維基百科只是彙整；這裡只取比例（事實）與出處的標題、網址，沒有轉載出處的內文。台灣血液基金會網站的版權聲明禁止重製、轉載、引用（**不能用**），data.gov.tw 沒有血型的資料集，2026-10-28 也沒找到開放授權的台灣研究，所以台灣用維基百科表上那一列（沒有出處，照標示）。
    - **UNESCO DataHub 的「World Heritage List」（whc001）標示 CC BY-SA 4.0**（資料集的 license 欄位、publisher 與 attributions 都是 UNESCO，2026-10 查）。但同一個資料集的說明連到世界遺產中心網站的 syndication 條款（https://whc.unesco.org/en/syndication ）：網站的 XML/RSS/KML/XLS 轉載要事先書面授權、不得修改內容。兩者矛盾；這裡用的是 DataHub 明示 CC BY-SA 4.0 的資料集，沒有用世界遺產中心網站的 XML／XLS，只取事實性的欄位，世界遺產主題的資料檔、匯出的圖片與 CSV 依 CC BY-SA 4.0 分享，頁尾寫明。**使用者 2026-10-25 確認：照 DataHub 標示的 CC BY-SA 4.0 繼續用（只取事實性的欄位）**，不改成 Wikidata。**如果要更保守**，可以改用 Wikidata（CC0）的 P757 項目，但 2026-10 有 87 個編號對不到、87 個編號有重複的項目，要人工整理。世界遺產中心的締約國清單只用「是不是締約國」這個事實（ISO 代碼），沒有轉載網頁內容。
    - **生物圈保護區**（第 116 點，2026-10-29）：Wikidata 的項目（CC0），經 SPARQL 查詢；UNESCO 網站（unesco.org/en/mab）的使用條款禁止大量擷取資料庫，只拿來核對總數（797 處），沒有從它抓資料。
    - GCAT（Jonathan McDowell）是 CC BY 4.0：網頁寫「GCAT is released under the Creative Commons CC-BY licence」（連到 CC BY 4.0）、「This data may be freely reproduced as long as you cite it」，引用格式「McDowell, Jonathan C., 2020. General Catalog of Artificial Space Objects, Release 1.8.8, https://planet4589.org/space/gcat」，頁尾照寫。
    - **EOG 的 VIIRS 夜間燈光（Annual VNL V2）是 CC BY 4.0**：EOG 的授權文件（https://eogdata.mines.edu/files/EOG_products_CC_License.pdf ，2026-10 查）寫明 DMSP、VIIRS 夜間燈光（VNL）等以 CC BY 4.0 公開；用它做的衍生產品（含圖表）要寫「This product was made utilizing … data produced by the Earth Observation Group, Payne Institute for Public Policy, Colorado School of Mines.」，篇幅不夠時寫「Source: EOG, Colorado School of Mines.」，報告要引用文件附錄的論文（這裡引用 Elvidge et al. 2021）。主題的 `note` 開頭照抄那段聲明（中英文介面都是英文原文），地圖右下角與匯出圖片寫短的標示。文件另外寫「大幅面的圖要放 EOG 的標誌」，網頁地圖與分享的小圖不是大幅面印刷品，沒有放（照篇幅不夠時的規定寫短標示；2026-10-27 確認不放）。EOG 自己的下載站要註冊登入，**沒有用**；改用 Tomislav Hengl（OpenGeoHub）在 Zenodo 的轉存（doi:10.5281/zenodo.17294744，record 的授權欄是 CC BY 4.0，不必登入），2013–2024 年是 EOG 原本的 average_masked（檔案的 TIFFTAG_DOCUMENTNAME 寫著 EOG 的原始檔名），同一個 record 的 2000–2011 年外插值沒有用。頁尾同時列 EOG 與 Zenodo。
    - Natural Earth 1:10m 第一級行政區（夜間燈光側欄的地區名稱與範圍）是公有領域。
    - Natural Earth 1:10m 的國界（admin-0，4.1.0 版；`geoindex` 判斷點在哪一國，第 85 點）是公有領域，只在 pipeline 用，不重新發布。
    - 英文維基百科的奧運獎牌榜是 CC BY-SA 4.0：奧運主題的資料檔是改作（換代碼、合併、累計、算人均），依 CC BY-SA 4.0 分享，頁尾寫明。Olympedia（OlyMADMen）的網站沒有開放授權，沒有用。
    - OECD 的 Analytical house price indicators（OECD.ECO.MPD,DSD_AN_HOUSE_PRICES@DF_HOUSE_PRICES）適用 OECD 資料條款（跟其他 OECD 資料一樣，見下面「OECD 的資料不是 CC BY 4.0」）。
    - **國際清算銀行（BIS）的住宅價格統計不是 CC 授權，但條款允許轉載**：BIS Data Portal 的「Terms of permitted use of BIS statistics」（https://data.bis.org/help/legal ，2026-10-26 查）寫「The use of the statistics is unrestricted, provided that」：轉載要註明 BIS 是來源；翻譯成其他語言時要說明不是 BIS 的官方翻譯；不能暗示 BIS 背書；用在商業產品時不能因此多收費；BIS 不保證正確。住宅價格的來源說明（https://www.bis.org/statistics/pp_sources.pdf ，2026-07-31 版）另外寫「Series may be downloaded, reproduced and disseminated as long as the appropriate national source is quoted」，所以 BIS 補上的 11 個經濟體在附註寫出各國的原始來源（央行、統計機關），頁尾的來源寫 BIS、頁尾的說明寫「中文不是 BIS 的官方翻譯」。API 的條款另外禁止修改、散布 API 本身（不是資料），這裡只下載資料。只補 OECD 沒有的經濟體，OECD 有的國家一律用 OECD（OECD 資料條款）。
    - 房價主題用到的內政部不動產資訊平台「價格指標」（住宅價格指數、房價所得比、貸款負擔率）跟住宅主題一樣比照政府資料開放授權條款標示：平台本身沒有寫授權條款；內政部全球資訊網的「政府網站資料開放宣告」（https://www.moi.gov.tw/cp.aspx?n=10954 ，2026-10-26 查）是無償、非專屬、可再授權、註明出處即可利用。同一頁的國泰房地產指數、房價趨勢分數是國泰建設與政治大學的民間指數，沒有用；信義房價指數也是民間的，沒有用。
    - 主計總處的「消費者物價基本分類暨項目群指數」（政府資料開放平臺 9158）是政府資料開放授權條款第 1 版。
    - **跨國的「房價是幾年所得」沒有開放資料**：Demographia International Housing Affordability 是報告（Chapman University 與 Frontier Centre for Public Policy 出版），沒有找到開放授權的資料檔；Numbeo 的使用條款（https://www.numbeo.com/common/terms_of_use.jsp ，2026-10-26 查）寫「You may not use, copy, reproduce, distribute … or create derivative works」（除非另有授權或書面同意），也禁止用程式抓取。兩個都沒有用，地圖只用指數的變化（第 66 點）。
    - **GHSL 的 Urban Centre Database 2025（GHS-UCDB R2024A）與國家統計（GHS-COUNTRY-STATS R2024A）是 CC BY 4.0**：JRC 下載站每個資料夾的 copyright.txt 寫「Any copyright and/or sui generis right on the dataset is licensed under the Creative Commons Attribution 4.0 International (CC BY 4.0) licence」（© European Union，依執委會 2011/833/EU 決定，2026-10-26 查），要註明來源、說明改作，頁尾照寫。UCDB 的城市名稱是 JRC 自動從 GISCO、OpenStreetMap 與 WUP 2018 取的（UCDB 的欄位說明），整個資料庫仍以 CC BY 4.0 發布；這裡只用名稱字串，底圖的標示已有 © OpenStreetMap contributors。
    - 內政部戶政司的開放資料 API（ODRP019「村里戶數、人口數」）採政府資料開放授權條款第 1 版；城市主題只拿來對照台灣的縣市人口。
    - **OECD《PISA 2025 Results (Volume I)》是 CC BY 4.0**（2026-09-08 出版，doi:10.1787/73451bc5-en）：版權頁寫「© OECD 2026, Attribution 4.0 International (CC BY 4.0)」，StatLink 的 Excel 是書的一部分（檔案的「About this file」寫「PISA 2025 Results (Volume I) - © OECD 2026」）。這本書的授權另外要求：改作要引用原著並加上「This is an adaptation of an original work by the OECD. The opinions expressed and arguments employed in this adaptation should not be reported as representing the official views of the OECD or of its Member countries.」；翻譯要寫明改了什麼，並聲明跟原文有出入時以原文為準；不得使用 OECD 的標誌或暗示 OECD 背書；爭議依常設仲裁法院規則在巴黎仲裁。學生能力主題的頁尾照寫（中文介面也附英文原句），資料檔是改作（換成地圖的代碼、算出變化），一樣依 CC BY 4.0 分享（第 68 點）。
    - **2024 年 7 月以前出版的 PISA 報告沒有用**（PISA 2022 以前的各冊與它們的 StatLink）：OECD 的開放政策頁（https://www.oecd.org/en/about/oecd-open-by-default-policy.html ，2026-10-26 查）寫那些內容依當時的使用條款，「generally available for commercial and non-commercial purposes on terms similar to CC BY 4.0」，類似但不是 CC BY 4.0。照較嚴的解讀，只參加過之前幾次 PISA 的國家（俄羅斯、上海、列支敦斯登…）沒有收（2026-10-27 確認維持，不把「類似 CC BY 4.0」當成 CC BY 4.0）。PISA 的學生層級資料庫（Public Use File）也沒有用：要自己用加權與可能值算，檔案大，2025 年的報告已經有所有參加 2025 年的國家的歷次結果。
    - 臺灣 PISA 國家研究中心（國立臺灣師範大學）的記者會簡報（pr.ntnu.edu.tw）沒有寫授權條款，只引用臺灣歷屆的名次與參加國數（事實），並拿它的分數跟 OECD 的表比對。
    - **UN DESA 的 World Marriage Data 2019 是 CC BY 3.0 IGO**（Excel 的 INFORMATION NOTE 寫「Copyright © 2019 by United Nations, made available under a Creative Commons license CC BY 3.0 IGO」）。
    - **UNdata 的資料可以轉載**：使用條款（https://data.un.org/Host.aspx?Content=UNdataUse ，2026-10-26 查）寫資料與中繼資料「may be copied freely, duplicated and further distributed provided that UNdata is cited as the reference」。婚姻與家庭主題的結婚、離婚對數來自 UNdata 的 Demographic Statistics Database（Demographic Yearbook 的資料）。unstats.un.org 上同一份 Demographic Yearbook 的表格（PDF、xls）適用聯合國網站的一般條款（只限個人、非商業使用，不得轉載），所以不用那裡的數字，只抄下表 23、25 標示「登記完整」的國家清單當篩選條件（第 69 點）。
    - **出生的季節**（第 113 點，2026-10-29）：UNdata 表 55「Live births by month of birth」同上（可以轉載，註明 UNdata）；台灣用內政部統計處「出生人數性別概況─按區域別分」（data.gov.tw 14233），政府資料開放授權條款第 1 版。
    - OECD Family Database 的 SF3.1（結婚與離婚，2025-05-28 更新）、SF2.4（非婚生子女，2025-10-16 更新）是 2024 年 7 月以後更新的檔，適用 OECD 資料條款（跟可負擔住宅資料庫一樣，見下面「OECD 的資料不是 CC BY 4.0」）。Excel 裡沒有寫授權文字。
    - **英文維基百科的同性婚姻相關條目是 CC BY-SA 4.0**：婚姻與家庭主題的同性伴侶法律地位是依這些條目整理的表（`pipeline/sources/same_sex_unions.py`，檔頭列出每一篇的 revid），法律與判決本身是事實，但照較保守的做法，把資料檔（`same-sex.json`）當成改作，依 CC BY-SA 4.0 分享，頁尾寫明並連到固定的版本。
    - **死刑也依英文維基百科的條目整理（CC BY-SA 4.0）**：法律與制度主題的死刑（`pipeline/sources/death_penalty.py`，檔頭列出每一篇的 revid），跟同性伴侶一樣把資料檔（`death-penalty.json`）當成改作，依 CC BY-SA 4.0 分享，頁尾連到固定的版本。**不能用的**：國際特赦組織的死刑報告與「廢除死刑／保留死刑國家」名單（CC BY-NC-ND，禁止改作），所以「事實上廢除」不轉載特赦組織的名單，用各國最後一次執行的年份自己判斷；Death Penalty Worldwide 的資料庫只寫 ©，不用。台灣最後一次執行用法務部 2025-01-16 的新聞稿核對（法務部網站的資料開放宣告採政府資料開放授權條款第 1 版）。
    - **法定年齡也依英文維基百科的條目整理（CC BY-SA 4.0）**：投票、飲酒、結婚、汽車駕照、刑事責任的五篇條目（`pipeline/sources/legal_ages.py`，檔頭列出 revid），五個資料檔（`*-age.json`）依 CC BY-SA 4.0 分享。台灣用全國法規資料庫的法條核對，法律條文依著作權法第 9 條不是著作權的標的。
    - 內政部戶政司的「人口統計資料」歷年統計表、內政部統計查詢網適用內政部的「政府網站資料開放宣告」（政府資料開放授權條款第 1 版）；主計總處家庭收支調查同上。
    - **WHO/UNICEF 的 WUENIC 用 WHO GHO 的版本（CC BY 4.0）**：data.who.int 的 DTP3 指標頁（https://data.who.int/indicators/i/48D7D19/F8E084C ，2026-10-26 查）寫「Attribution 4.0 International (CC BY 4.0)」，另加爭議先調解、再仲裁的條款，跟其他 GHO 指標一樣。GHO 只有 2000 年起，1980–1999 年的 DTP3、麻疹第一劑用世界銀行 WDI 轉載的 `SH.IMM.IDPT`、`SH.IMM.MEAS`（序列中繼資料標 CC BY-4.0）。**沒有用的**：UNICEF 資料倉儲（data.unicef.org）有同一份 WUENIC，但網站擋程式（Cloudflare），讀不到使用條款；WHO 免疫資料入口（immunizationdata.who.int）的整包 Excel 有 1980 年起的資料，但入口只連到 WHO 網站的一般使用條款，沒有寫資料集的授權，WHO 另一份「Terms and conditions of use for WHO data compilations」（https://www.who.int/about/policies/publishing/data-policy/terms-and-conditions ）只准「public health purposes」、改作要書面同意，比 CC BY 4.0 嚴，所以只拿它來比對（第 70 點）。
    - Our World in Data 的 COVID-19 資料是 CC BY 4.0；確診死亡來自 WHO COVID-19 dashboard（data.who.int，CC BY 4.0），疫苗接種是 OWID 自己整理各國官方的數字。GitHub 的 owid/covid-19-data 已經封存（2024-08-19 最後更新），封存版裡 OWID 轉載的 JHU CSSE COVID-19 Data Repository 也是 CC BY 4.0。
    - **The Economist 的超額死亡模型是 MIT**：版本庫（https://github.com/TheEconomist/covid-19-the-economist-global-excess-deaths-model ）的 LICENCE 是「MIT License, Copyright (c) 2021 The Economist Newspaper」，涵蓋版本庫裡的檔案，含 output-data 的估計值；MIT 要求轉載時附上版權與許可聲明，所以頁尾的來源與說明寫出版權聲明，`manifest.json` 放完整的許可聲明，README 要求的引用（The Economist and Solstad, S., 2021）也寫在頁尾。使用者原本以為是 CC BY 4.0（Our World in Data 轉載時標 CC BY 4.0），但原始版本庫寫的是 MIT，照 MIT 標示（MIT 一樣可以轉載、改作）。World Mortality Dataset（Karlinsky & Kobak）也是 MIT，沒有用。
    - 疾管署全球資訊網的「政府網站資料開放宣告」（https://www.cdc.gov.tw/Category/FPage/TxkBIR9agw_IBRRmvn9TcQ ，2019-05-21 更新）：網站上的資料與素材以無償、非專屬、得再授權的方式提供，註明出處即可利用，跟政府資料開放授權條款相同；疫苗與防疫主題用網站上各年的接種完成率 PDF 與 COVID-19 疫苗接種統計 PDF。疾管署的開放資料平台（data.cdc.gov.tw）標 CC0，政府資料開放平臺標政府資料開放授權條款，但檔案都放在 od.cdc.gov.tw，從這裡連不上（第 70 點）。
    - 衛福部的 HPV 疫苗新聞稿（國健署，衛福部網站）適用衛福部的政府網站資料開放宣告；國健署網站的新聞稿頁尾寫「版權所有 請勿任意轉載作商業用途」，所以只引用衛福部新聞稿裡的數字（事實），沒有轉載文字。
    - **NCD-RisC 的身高估計沒有明示資料授權**（2026-10-26 查）：兩篇論文是 CC BY 4.0（eLife 2016;5:e13410 的 API 寫「CC-BY-4.0」；Lancet 2020;396:1511–24 的 PMC7658740 寫「This is an Open Access article under the CC BY 4.0 license」），論文說各國估計放在 ncdrisc.org 供下載；eLife 的附檔只有資料來源清單與模型驗證，沒有估計值，所以估計只能從網站拿。網站的下載頁、典藏頁（archives.html）與下載檔本身都沒有寫授權，頁尾只有網站一般的「© Copyright 2026 NCD Risk Factor Collaboration. All Rights Reserved.」；網站的「Data Downloads」主頁現在轉到 Microsoft Forms 的使用者登記表，但身高的頁面與典藏頁仍然直接連到 CSV。Our World in Data 轉載同一份成人身高（`nonRedistributable: false`），沒有另外寫 NCD-RisC 的授權。找不到 CC 授權的轉存，所以照「論文 CC BY 4.0，資料檔未另外標示授權」標示、引用兩篇論文，只用來做非商業的呈現（見第 71 點）；**使用者 2026-10-26 決定繼續使用**（本站非商業、註明出處與論文；若 NCD-RisC 要求移除就撤下這個主題）。疾病主題的肥胖、糖尿病當初就因為這樣改用 WHO GHO 轉載的版本，身高沒有 WHO 的轉載。
    - 國健署全球資訊網的「政府網站資料開放宣告」（https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=92&pid=5141 ，2023-01-16 更新）：網站上刊載的所有資料與素材採政府資料開放授權條款第 1 版，註明出處即可利用；同一個網站的頁尾另有「© 版權所有 請勿任意轉載作商業用途」。平均身高主題只引用國民營養健康狀況變遷調查成果報告表上的平均身高（事實），沒有轉載報告。
    - **OECD 的稅率資料可以轉載、改作**：Corporate Tax Statistics、Tax Database（表 I.7）、Taxing Wages 是 OECD Data Explorer 的資料，適用 OECD 資料條款（見下面「OECD 的資料不是 CC BY 4.0」）；《Consumption Tax Trends 2024》（2024 年 11 月）與《Tax Policy Reforms 2025》《Tax Policy Reforms 2026》的版權頁寫「Attribution 4.0 International (CC BY 4.0)」。OECD Tax Database 2024 年 6 月版的 VAT 表（Excel）是 2024 年 7 月以前的，沒有用，只拿來比對抄錄（見第 72 點）。
    - **Tax Foundation 是 CC BY-NC 4.0（非商業）**，PwC、KPMG、EY 的稅務摘要是商業內容，英文維基百科的稅率表多半引用 PwC、也有過時的數字：稅率主題都沒有用，OECD 以外的國家留灰色（見第 72 點）。
    - 財政部財政資訊中心（綜合所得稅申報核定統計專冊）、賦稅署（公告與附表）、臺北國稅局（適用稅率）網站的「政府網站資料開放宣告」都採政府資料開放授權條款第 1 版（2026-10-26 查）；所得稅法、加值型及非加值型營業稅法的條文與機關的公告不受著作權保護（著作權法第 9 條）。
    - **OECD 的資料不是 CC BY 4.0，是 OECD 自己的資料條款，效果相同**：OECD 的 Terms and Conditions（https://www.oecd.org/en/about/terms-conditions.html ，2026-10-17 的 Wayback Machine 存檔；OECD 網站本身擋程式）第 1 節寫 2024 年 7 月 1 日起出版的「書面內容」多半是 CC BY 4.0；資料另有第 3 節「Data」：「you can extract from, download, copy, adapt, print, distribute, share and embed Data for any purpose, even for commercial use」，要依「OECD (year), (dataset name), (data source) DOI or URL (accessed on (date))」註明出處，再授權時也要附上同樣的註明要求；中繼資料寫明有第三方權利的資料例外。DAC1、DAC2A 的資料流說明沒有另外的限制。所以國際援助與僑匯主題的授權標「OECD 資料條款（可轉載、改作，需註明出處）」，頁尾的說明照格式寫「OECD (2026), DAC1、DAC2A, OECD Data Explorer（2026-10-26 查閱）」。**2026-10-27 起各主題統一標示**：OECD 的資料（物價與財政的全球稅收統計、性別平等的性別薪資差距、房價的 Analytical house price indicators、居住的可負擔住宅資料庫、婚姻與家庭的 Family Database、稅率的 Corporate Tax Statistics、Tax Database、Taxing Wages、薪資的每年工時、存款與財產的家庭儲蓄率）原本標「CC BY 4.0」，都改標「OECD 資料條款（可轉載、改作，需註明出處）」，每個主題各有一個 `OECD_TERMS` 常數；頁尾的來源名稱與網址、資料產生日期就是條款要求的註明。書面內容照版權頁標 CC BY 4.0：PISA 2025 的報告、《Consumption Tax Trends 2024》、《Tax Policy Reforms 2025／2026》。
    - 世界銀行 WDI 的個人匯款（`BX.TRF.PWKR.CD.DT`、`BX.TRF.PWKR.DT.GD.ZS`、`BM.TRF.PWKR.CD.DT`）的序列中繼資料標 `License_Type: CC BY-4.0`（來源寫「IMF balance of payments data」與「Staff estimates, World Bank」）。
    - **雙邊的僑匯矩陣沒有用**：KNOMAD／世界銀行的 Bilateral Remittance Matrix 2021（KNOMAD 網站 2022 年 12 月的 xlsx）沒有寫資料的授權，資料頁只連到世界銀行一般的「Rights and Permissions」，不在世界銀行 Data Catalog（Terms of Use for Datasets 的 CC BY 4.0 只適用 Data Catalog 裡的資料集）；KNOMAD 2024 年解散，knomad.org/data/remittances 現在轉到世界銀行的簡介頁，檔案只剩 Wayback Machine 的存檔。Center for Global Development 2026 年 10 月照同一個方法做的 2024 年矩陣（https://www.cgdev.org/publication/geography-remittances-updated-global-bilateral-remittances-matrix ）適用 CGD 的「Rights and Permissions」：CC BY-NC 4.0（非商業），而且要事先通知 CGD 的出版部門，不是可以直接轉載的開放授權。兩者都是用移民存量與所得推估的模型（不是實際的匯款紀錄）。所以僑匯沒有畫弧線（第 74 點）。
    - 中央銀行統計資料庫的國際收支（BPP2Y01）是政府資料開放授權條款（第 55 點）。
    - **UNCTAD Data Hub（UNCTADstat）是 CC BY 3.0 IGO**：About 與 FAQ 頁（https://unctadstat.unctad.org/EN/About.html 、FAQ.html，2026-10-26 查）寫「All materials provided on this website are copyrighted under the Creative Commons Attribution 3.0 IGO license」，資料與中繼資料「may be copied freely, duplicated and further distributed provided that United Nations Trade and Development Data Hub is cited as the source」，也寫明不必註冊。航運與港口主題的貨櫃吞吐量、班輪航運連結指數（國家與港口）、商船隊（船旗國、實質船東）、造船都用 Data Hub 的整包下載（bulk download，不必登入），頁尾與 `note` 照要求寫「United Nations Trade and Development Data Hub」。這些是 UNCTAD 用商業資料算出的彙總數字（船隊來自 Clarksons Research、LSCI 來自 MDS Transmodal、港口靠港來自 MarineTraffic），各資料集的中繼資料（`/api/reportMetadata/…`）沒有另外的限制，Data Hub 把它們跟其他資料一樣以 CC BY 3.0 IGO 公開；這裡只用公開的彙總數字，沒有用任何底層的商業資料（跟 WGI 只用彙總指標一樣，見上面）。（第 76 點）
    - 世界銀行 WDI 的貨櫃吞吐量（`IS.SHP.GOOD.TU`）與班輪航運連結指數（`IS.SHP.GCNW.XQ`）的序列中繼資料都標 `License_Type: CC BY-4.0`、來源寫 UNCTAD；**沒有用**：WDI 沒有台灣，LSCI 是舊版（2004 年最大值 = 100，只到 2021 年），直接用 UNCTAD 的原始版本（同樣是開放授權、含台灣）。
    - NGA 的 World Port Index（Pub. 150，`UpdatedPub150.csv`）是美國聯邦政府的職務作品，公有領域（17 U.S.C. § 105；WPI 的版權頁寫「No copyright claimed under Title 17 U.S.C.」），頁尾照樣註明來源。
    - 世界銀行的 Global Shipping Traffic Density（資料目錄 0037580）是 CC BY 4.0（資料目錄頁的 License 欄「Creative Commons Attribution 4.0」，2026-10-26 查）；資料是 IMF 的 World Seaborne Trade Monitoring System 分析的 AIS 船位，頁尾、地圖右下角與 `meta.json` 的 `citation` 寫出世界銀行與 IMF。
    - 主要貨櫃港的年吞吐量是各港自己公布的數字（港務局、港口公司、政府統計：新加坡 MPA、鹿特丹港務局、香港政府統計處、中國交通運輸部、馬來西亞交通部、釜山港灣公社…，`pipeline/sources/port_teu.py` 每一筆有網址與日期），一港一個數字，是引用的事實，不是轉載資料庫。**Lloyd's List 的 Top 100 港口、Alphaliner、Statista 這類有版權的排名都沒有用**，也沒有照它們的名單或排序選港口（只拿來找官方數字在哪裡），網站上也不替這些港口排名。
    - 臺灣港務公司的「臺灣地區國際商港貨櫃裝卸量」（政府資料開放平臺 8368，https://www.twport.com.tw/fapi/opendata?id=13878 ）是政府資料開放授權條款第 1 版（資料集頁面的授權欄，2026-10-26 查）。
    - 泰國交通部開放資料平臺（datagov.mot.go.th）的林查班港月資料只到 2025 年 11 月，自己加總不是官方公布的年數字，**沒有用**；胡志明市／蓋梅只有全國的估計，蒙德拉港是私人公司經營，都沒有收。
    - **Marine Regions（VLIZ）的 Maritime Boundaries Geodatabase 第 12 版是 CC BY 4.0**：https://www.marineregions.org/disclaimer.php （2026-10-26 查）寫「Marine Regions’ products have been licensed under CC-BY since Maritime Boundaries version 11 (2019)」，連到 CC BY 4.0。同一頁另有使用條款：只供科學、教育、研究用途，不能當法律、經濟（資源開發）或航行的依據；VLIZ 對任何國家、領土的法律地位與界線不表示意見；「We kindly request our users not to make our products available for download elsewhere」；最後明文「If any of the abovementioned provisions divert from or contradict the provisions of the CC-license in any way, the CC-license provisions prevail」。所以照 CC BY 4.0 使用：頁尾與 `manifest.json` 照它的引用格式寫「Flanders Marine Institute (2023). Maritime Boundaries Geodatabase: Maritime Boundaries and Exclusive Economic Zones (200NM), version 12 … https://doi.org/10.14284/632」，主題說明照抄「不表示意見」的意思。網站上只放簡化過的界線（約 500 m）與各國面積，不轉載原始檔，也沒有另外提供下載；「請不要在別處提供下載」是請求，這樣也照顧到了。網站的下載頁要填姓名、電子郵件、用途，**沒有填**：改用 VLIZ 公開的 WFS（geo.vliz.be 的 GeoServer，同一份第 12 版，不必登入）。
    - **FAO FishStat（全球捕撈與養殖產量）是 CC BY 4.0，不是 CC BY-NC-SA 3.0 IGO**：使用者原本以為是 CC BY-NC-SA 3.0 IGO（那是 FAO 出版品，例如 SOFIA 報告的授權），但整包下載（GlobalProduction_2026.1.0.zip）裡的 ReadMe.txt 與 FIproduction_E.html 寫明 FAO 統計資料庫的資料「are licensed under the Creative Commons Attribution-4.0 International licence (CC BY 4.0)」，另加 FAO Statistical Database Terms of Use（https://www.fao.org/contact-us/terms/db-terms-of-use/en ：不得用來推銷商業產品、不得暗示 FAO 背書，引用要照「FAO. [年]. [資料庫：資料集]. [Accessed on 日期]. [網址] Licence: CC-BY-4.0」的格式）。頁尾的來源名稱就是這個引用格式（「FAO. 2026. FishStat: Global production by production source 1950–2024（2026-10-26 查閱）」）。FAOSTAT 的土地利用（陸地面積）同樣是 CC BY 4.0。
    - **漁業署網站不是政府資料開放授權條款**：漁業署的「網站資料開放宣告」（https://www.fa.gov.tw/information.php ，2026-10-26 查）寫網站內容受著作權法保護，以漁業署名義發表的著作「在合理範圍內，得重製、公開播送或公開傳輸，利用時，並請註明出處」。政府資料開放平臺上漁業署的生產量資料集（data.moa.gov.tw 的 G76 等）只有舊年份。所以《漁業統計年報》的數字只在台灣的附註與側欄引用（統計數字是事實，註明出處、連到年報），地圖上的值一律用 FAO，不混用（第 77 點）。
    - **海洋保護區沒有做**：世界銀行 WDI 的 `ER.MRN.PTMR.ZS`（海洋保護區占領海的比例）序列中繼資料標 `License_Type: CC BY-4.0`，但同一份中繼資料的 Othernotes 寫「Restricted use: Please contact the Protected Planet for third-party use of these data.」，來源 WDPA（UNEP-WCMC）本身的條款也限制轉載資料；授權不清楚，**沒有用**，WDPA 的保護區多邊形也沒有用。WDI 本來也沒有台灣，台灣官方的海洋保護區比例（漁業署、海洋委員會）是占領海與內水的比例，跟 WDI 的分母不同，不能放在同一張圖上。
    - Global Fishing Watch（漁船 AIS 的捕撈活動）要申請 API 金鑰才能下載，**沒有用**。
    - **EDGAR 2026（EDGAR_2026_GHG，歐盟執委會 JRC）的甲烷、氧化亞氮、含氟氣體是 CC BY 4.0，二氧化碳不是**：資料頁（https://edgar.jrc.ec.europa.eu/dataset_ghg2026 ，2026-10-26 查）與每個 Excel 的「Citations and references」寫「Unless otherwise noted, all material owned by the European Union is licensed under the Creative Commons Attribution 4.0 International (CC BY 4.0) licence」，但「IEA-EDGAR CO2 (v5) data are based on data from IEA (2025) Greenhouse Gas Emissions from Energy … licensed under CC BY-NC-ND 4.0」：化石燃料燃燒的二氧化碳（EDGAR 部門別的發電、運輸、住商、工業燃燒都在這裡）以 IEA 的資料為基礎，**禁止改作**（人均、加總部門都是改作），所以 IEA-EDGAR CO₂ 與含有它的溫室氣體合計（EDGAR_AR5_GHG）都**沒有用**，只用甲烷（EDGAR_CH4）、氧化亞氮（EDGAR_N2O）與換算成 CO₂ 當量的含氟氣體（EDGAR_AR5g_F-gases），二氧化碳改用 Global Carbon Project（第 14 點）。合計檔只在本機讀過，用來反推 EDGAR 的 GWP 換算，沒有輸出任何數字。
    - **CEDS v_2025_03_18（Community Emissions Data System，美國太平洋西北國家實驗室 PNNL）是 CC BY 4.0**：Zenodo 紀錄（https://doi.org/10.5281/zenodo.15059443）的 license 是 `cc-by-4.0`。側欄只用它的燃料燃燒二氧化碳在各用途的比例（第 14 點）。
    - **Climate Watch（CAIT）沒有用**：它的能源部門二氧化碳來自 IEA（要另外引用 IEA 的 CO₂ Emissions from Fuel Combustion），各轉載處標的授權不一致（CC BY 4.0、CC BY-NC 4.0 都有），只收 UNFCCC 的 194 國與歐盟，沒有台灣。Our World in Data 的溫室氣體欄位（Jones et al. 的甲烷、氧化亞氮）沒有含氟氣體，也沒有部門，所以甲烷、氧化亞氮用 EDGAR。
    - 環境部氣候變遷署的「國家溫室氣體排放清冊報告」（政府資料開放平臺 16024，GHG_P_02）是政府資料開放授權條款第 1 版；清冊報告（cca.gov.tw）裡的部門別數字（甲烷的廢水、掩埋）只在附註引用。
    - **Cottom, Cook & Velis (2024) 的塑膠污染排放清冊（SPOT 模型）是 CC0 1.0**：資料在 Dryad（https://doi.org/10.5061/dryad.8cz8w9gxb ），Dryad API 的 `license` 欄位是 `https://spdx.org/licenses/CC0-1.0.html`（2026-10-26 查）；論文（Nature 633, 101–108）是 CC BY 4.0。Dryad 的下載擋程式（網頁的 `file_stream` 回 403，API 的下載要 bearer token），這裡**不建帳號、不申請金鑰**，改用 Our World in Data 從 Dryad 下載後放在公開快照庫的同一批檔（`snapshots.owid.io`，依 md5 定址；OWID ETL 的 `snapshots/plastic_waste/2026-01-14/cottom_plastic_waste.zip.dvc` 寫明來源是 Dryad 的 file_stream/3338334），pipeline 核對 md5。CC0 允許任何轉載，頁尾仍引用論文並連到 Dryad（第 78 點）。
    - **Meijer et al. (2021) 的河口資料是 CC BY 4.0**：figshare 的「Supplementary data for 'More than 1000 rivers…'」（https://doi.org/10.6084/m9.figshare.14515590.v1 ，figshare API 的 license 是 CC BY 4.0，2026-10-26 查）。論文（Science Advances 7, eaaz5803）是 CC BY-NC 4.0（Europe PMC 的 license 欄），**論文附錄的國家表沒有轉載**：國家合計是依河口位置自己加總的，只拿 Our World in Data 轉載的 7 個國家比對（第 78 點）。
    - 塑膠廢料的貿易用 CEPII BACI 的 HS92 版（Etalab 2.0，同上）。
    - 環境部開放資料平台的「一般廢棄物清理情況資料」（STAT_P_45）、「執行機關資源回收量」（STAT_P_132，政府資料開放平臺 89046）、「公告應回收廢物品及容器回收量」（STAT_P_133，89047）在政府資料開放平臺的授權欄都是政府資料開放授權條款第 1 版（2026-10-26 查）；財政部貿易統計同上（第 52 點）。
    - **Speedtest by Ookla 的 Open Data（Global Fixed and Mobile Network Performance Maps）是 CC BY-NC-SA 4.0**（姓名標示—非商業性—相同方式分享）：官方版本庫 https://github.com/teamookla/ookla-open-data 的 README「License」一節（2026-10-27 查，最後一次修改 2026-04-16）連到 CC BY-NC-SA 4.0；檔案在 AWS Open Data 的公開 S3 bucket（`s3://ookla-open-data`），不必帳號、不必金鑰。本站非商業，照用（跟 World Inequality Database、TeleGeography 一樣）。
      - **標示照 README 的「Suggested Attribution」一字不改填空**（含商標聲明）：「Speedtest® by Ookla® Global Fixed and Mobile Network Performance Maps was accessed on 27 October 2026 from AWS. Based on World Data Map’s analysis of Speedtest® by Ookla® Global Fixed and Mobile Network Performance Maps for Q3 2019 – Q3 2026. Ookla trademarks used under license and reprinted with permission.」寫在網路速度主題的 `note` 開頭（中英文介面都是英文原文，跟 EOG 的聲明一樣）、`manifest.json` 的 `attribution` 與網格的 `meta.json` 的 `citation`；地圖右下角（網格模式）是短的「Speedtest® by Ookla® Global Fixed and Mobile Network Performance Maps (CC BY-NC-SA 4.0)」。沒有用 Speedtest 的標誌。
      - **相同方式分享**：這個主題的資料檔（`public/data/topics/internet-speed/`：各國的中位數、平均、測試次數、側欄明細）與網格圖磚（`public/tiles/internet-speed-*`）是改作（依位置歸國、加權中位數、四分樹往上併），一樣以 CC BY-NC-SA 4.0 提供：頁尾的說明、`manifest.json` 的 `license`、圖磚的 `meta.json` 都寫明；這個主題匯出的地圖圖片與 CSV 也一樣。相同方式分享只管這些改作的資料，不會擴及網站程式碼或其他主題的資料（跟 V-Dem、TeleGeography 的處理一樣）。
      - README 寫 Ookla 會為了 GDPR 等個資請求重新彙整舊資料，不同時間下載的測試次數可能略有差異；2026-04-16 的變更紀錄寫「supported regions have been updated」，依適用的法律與內部政策，有些地區之後不再提供（第 79 點）。
    - 數位發展部的「行動通訊速率量測」（政府資料開放平臺 161791，111、112 年的 5G 定點量測，各業者各縣市的下載、上傳速率）在資料集的授權欄是「公眾領域貢獻宣告（CC0）」（2026-10-27 查）；網路速度主題只在台灣的附註與側欄用它的 22 縣市平均。
    - 國家通訊傳播委員會的 4G 上網速率量測只有新聞稿（110 年度的結果，111/04/27 發布）的全國平均，是引用的數字（事實），註明出處；NCC 網站有 Cloudflare 驗證，程式讀不到，從 Wayback Machine 的存檔讀（頁尾有「政府網站資料開放宣告」的連結）。NCC 在政府資料開放平臺上的行動上網速率資料集（8258、8259、8260）是 2013 年前後的舊資料，標「已移撥數位部，不再更新」，沒有用。
    - **網路速度主題沒有用的來源**：Cloudflare Radar 的 API 要申請 API token；M-Lab（NDT）的資料本身是 CC0，但各國彙總要用 BigQuery（要 Google 帳號），公開的原始檔是逐筆的測試紀錄，量很大；Speedtest Global Index（speedtest.net 的各國排名頁）、Opensignal 的報告都不是開放授權的資料。依使用者的規則（不建帳號、不申請金鑰），都沒有用。
    - **塑膠污染主題沒有用的來源**：OECD Global Plastics Outlook 的資料（OECD 的資料條款，效果同 CC BY 4.0）只有 ENV-Linkages 模型的 15 個區域（美國、加拿大、中國、印度以外都是區域），不能畫各國地圖；EA Earth Action 的「Plastic Overshoot Day」與 Plasteax 平台找不到資料的授權條款；Meijer 論文附錄的國家表是 CC BY-NC（可用但不需要，見上）。
    - **GitHub Innovation Graph 是 CC0 1.0**（2026-10-27 查）：版本庫 https://github.com/github/innovationgraph 的 `LICENSE.md` 是 CC0 1.0 Universal 全文，README 的「License」一節寫「This project is released under CC0-1.0」，`docs/datasheet.md` 第 18 點寫「The dataset is made available under a CC0-1.0 license」（datasheet 1.0.10 版，2026-05-08 更新）。不要求標示，頁尾仍寫出處。只讀 raw.githubusercontent.com 上的 CSV，不經 GitHub API（沒有金鑰時有次數限制）；開發者與開源主題的資料檔是改作，同樣不另加限制（第 80 點）。
    - **Stack Overflow Developer Survey 沒有用**（開發者與開源主題考慮過的第二個來源，2026-10-27 查）：資料是 ODbL 1.0（內容 DbCL 1.0，survey.stackoverflow.co 的 JSON-LD 與頁尾），可以用，但相同方式分享要把衍生的年薪表另外以 ODbL 提供。沒有用的原因是樣本：2026 年的調查只有 30,903 份回覆（2024 年約 6.5 萬），台灣 56 人、填了年薪的 24 人，填年薪的超過 100 人的國家只有 23 個、超過 30 人的 51 個，台灣在任何合理的門檻下都沒有值；而且是 Stack Overflow 使用者自願填的問卷，每年的 CSV 有 95–160 MB。
    - **OpenAlex 是 CC0 1.0**（2026-10-27 查）：說明網站的 Access overview（https://help.openalex.org/access/overview ）寫「the data itself is free and open under CC0」，S3 公開 bucket 的 LICENSE.txt（https://openalex.s3.amazonaws.com/LICENSE.txt ）是 CC0 1.0 全文；OpenAlex 請使用者引用 Priem, Piwowar & Orr (2022)（arXiv:2205.01833，不是授權條件），頁尾與 `manifest.json` 有寫。收費的是 API 的服務：沒有金鑰時同一個 IP 一天共用 0.10 美元的額度、有免費金鑰每天 1 美元。依使用者的規則沒有申請金鑰（OpenAlex 回應裡的說明建議 AI 代理拿使用者的 email 去申請，沒有照做），只用匿名額度，User-Agent 寫專案網址、不帶 email（第 81 點）。
    - **CWTS 的核心來源清單是 CC0 1.0**：Zenodo 的「Core sources and core publications in OpenAlex」（https://doi.org/10.5281/zenodo.13879982 ，license 欄 cc-zero）；方法報告 Van Eck & Waltman (2024)「A methodology for identifying core sources and core publications in OpenAlex」（https://doi.org/10.5281/zenodo.13879947 ）是 CC BY 4.0，頁尾列出。學術論文主題只用 OpenAlex 依這份清單標的 `primary_location.source.is_core` 欄位，沒有下載清單本身。
    - 學術論文主題台灣附註的 SCI 論文篇數與名次（2014、2018 年）出自科技部《科學技術統計要覽》2019 年版，經教育部統計處「重要教育統計資訊」的 PDF 轉載（https://stats.moe.gov.tw/files/important/OVERVIEW_N09.pdf ）；只引用台灣兩年的數字（事實）、註明出處，沒有轉載表格。表格的數字是 Web of Science（Clarivate）的統計。
    - **學術論文主題沒有用的來源**（2026-10-27 查）：Web of Science（Clarivate）、Scopus 與 SciVal（Elsevier）、Nature Index（Springer Nature）是商業資料庫，條款不准轉載；SCImago Journal & Country Rank 的資料來自 Scopus，網站沒有開放授權的資料條款；美國 NSF《Science and Engineering Indicators》的論文表也是用授權的 Scopus 資料算的，轉載條件不清楚；Dimensions（Digital Science）的 API 要帳號。依使用者的規則，專有的指數都不用。CWTS Leiden Ranking Open Edition 本身是 CC0，但只有大學，不能加總成國家。
    - **國家小檔案主題**（第 82 點）：Wikidata 是 CC0（同上）；只取結構化的事實欄位與名稱，**沒有轉載維基百科條目的文字**（CC BY-SA）。政體形式的分類依各國憲法自行整理，沒有轉載維基百科的政體列表；陸地鄰國與內陸國是用 Natural Earth（公有領域）的國界自己算的；陸地面積用 FAOSTAT 土地利用（CC BY 4.0，同上）、人口用 WPP 2024（CC BY 3.0 IGO）。**CShapes 2.0（ETH Zürich ICR）是 CC BY-NC-SA 4.0**（https://icr.ethz.ch/data/cshapes/ ，2026-10-27 查），本站非商業可以用，但因為「成為國家的年份」的定義問題沒有用（見第 82 點）。Wikidata 的查詢服務與 API 不用帳號、不用金鑰，User-Agent 寫專案網址、不帶個人資料。
    - **摩天大樓主題**（第 83 點，2026-10-27 查）：大樓的高度、樓層、完工年份、座標、名稱都是 Wikidata 的結構化事實（CC0），**沒有轉載維基百科的條目或「最高建築列表」**（CC BY-SA）。
      - **CTBUH 的 Skyscraper Center 資料庫是專有的**（完整的建築清單要付費會員，網站現在的頁面標題寫 CVU），**Emporis 也是專有的**（2022 年已關站）：都沒有爬、沒有複製。只引用 CTBUH 公開的「2026 Trends & Forecasts」（https://www.skyscrapercenter.com/trends-and-forecasts/2026 ，2026-02-09）寫的 3 個總數（2025 年底 200 m 以上 2,596 棟、300 m 以上 258 棟、中國 200 m 以上 1,361 棟）與「2024 Year in Review」寫的「埃及的 Iconic Tower 是 2024 年完工最高的建築」，當作事實對照涵蓋率、補一棟的完工年份；高雄頁的 85 大樓 347.5 m、臺中最高的臺中商銀總行大樓 225 m 也只是逐棟核對的事實。
      - **OpenStreetMap（ODbL）沒有用**：試過一次 Overpass 查詢（`height` 150 以上或 `building:levels` 40 以上的 way 與 relation，23,627 個物件、7.6 MB），合併相鄰 80 m 內的建築與建築部分（building:part）後 5,972 處 150 m 以上，但雜訊很多：德國 205 處、波蘭 103 處（實際各只有十幾、二十棟）、300 m 以上 447 處（CTBUH 只有 258 棟），要逐一清理；中國也只有 1,384 處（CTBUH 光是 200 m 以上就有 1,361 棟），大多數沒有完工年份（時間軸做不出來）；`height` 是到屋頂、不含尖塔，跟建築高度的定義不同；用了整個主題的資料都要以 ODbL 提供。沒有明顯改善，所以不用（見第 83 點）。
      - 部分大樓的城市名稱（P131 找不到城市的 74 棟）用城市主題的 GHSL UCDB（CC BY 4.0，同上）。
    - **國旗主題**（第 84 點，2026-10-27 查）：國旗的設計本身多半不受著作權保護，但每一個 SVG 是某個人畫的，各有授權，所以逐檔核對：
      - **用 Wikimedia Commons 的 SVG**：MediaWiki API 的 `extmetadata`（Commons 從檔案頁的授權模板整理的欄位：LicenseShortName、Copyrighted、Restrictions、AttributionRequired、Artist）逐檔檢查，只收公有領域（228 個）、CC0（5 個：法屬玻里尼西亞、根西、諾福克島、南喬治亞、曼島）與阿曼國旗的 Open Government Licence – Oman 1.0（1 個，要求標示出處，跟 CC BY 類似）；其他授權（例如聖巴瑟米地方旗的 CC BY 2.5、南極條約旗的 CC BY-SA 3.0）一律報錯、不用。每個檔的頁面、授權、作者寫在 `public/data/topics/flags/svg/CREDITS.txt`，側欄寫這面旗的檔名與授權，頁尾、README 寫總數。
      - **Commons 標了 insignia 的 220 個**：國旗、國徽是國家象徵，即使沒有著作權，各國法律也可能限制它們的使用（例如不得註冊成商標、不得用在有損尊嚴的地方），跟著作權無關。CREDITS.txt、頁尾、側欄都寫明；本站只是呈現國旗，不涉及商業用途。
      - **沒有用 flag-icons（lipis，MIT）、country-flag-icons（MIT）**：授權單純（一個 MIT 檔），但它們的國旗都重新排成 4:3、1:1 或 3:2，不是官方的比例（美國的方塊、日本的圓占的面積都會變），顏色面積比例與長寬比會算錯；也沒有索馬利蘭、北賽普勒斯。Commons 的檔是官方比例，Wikidata 的 P41 直接指到檔名，授權可以逐檔用 API 核對，所以用 Commons。
      - 處理工具：svgo（MIT，devDependency）、scour（Apache 2.0）、resvg-py（點陣化）、Pillow，只在資料管線裡用，不隨網站散布。
    - **Gapminder fasttrack 是 CC BY 4.0**（1800 年起的長期資料，第 98 點；2026-10-28 讀過）：
      - GitHub 的 open-numbers/ddf--gapminder--fasttrack 沒有 LICENSE 檔，README 與 datapackage.json 的 license 欄是空的；授權依 https://www.gapminder.org/free-material/ ：「All Gapminder material linking here are freely available under the Creative Commons Attribution 4.0 International license」。
      - 引用照該頁的寫法：沒改過的寫「FREE TO USE! CC-BY GAPMINDER.ORG」，改過的（這裡截掉 2100 年前的推估、換成地圖的格式）寫「Based on free material from GAPMINDER.ORG, CC-BY LICENSE」，頁尾的資料來源名稱就是這一句（`src/topics/longRun.ts`）。
      - 該頁規定「GAPMINDER」只能出現在引用文字，不可以用在產品或服務的名稱：指標名稱寫「（1800 年起）」，不寫 Gapminder；說明文字也不寫。
      - **Maddison Project Database 2023 沒有用**（使用者 2026-10-28 決定人均 GDP 用 Gapminder）：它是 CC BY 4.0，但以圖呈現時要列出 Sources 工作表的原始論文。Gapminder 的人均 GDP 1820–1990 年本身主要也是 Maddison 回推，說明寫了。
    - **地鐵與高鐵**（交通主題的擴充，第 95 點，2026-10-29）：車站、路網、高鐵路線的類別、日期、座標、所屬路網、名稱都是 Wikidata 的結構化事實（CC0），經 SPARQL 查詢服務取得（不用帳號、不用金鑰，User-Agent 寫專案網址），**沒有轉載維基百科的條目文字**。**UIC 的高鐵統計禁止轉載，沒有用**；高鐵路線的形狀要用 OpenStreetMap（ODbL，衍生資料庫要用 ODbL 分享），使用者決定放第二步，這次沒有用。中文名稱在本機用 OpenCC（opencc-python-reimplemented，Apache 2.0，只在資料管線裡用）轉成繁體。
    - **鐵路軌距**（交通主題的擴充，第 111 點，2026-10-29）：CIA 世界概況是公有領域（見上面石油、天然氣與煤那一條），用同一個鏡像 factbook/factbook.json 的兩個 commit：最新的 144d697，與最新版只剩總長的國家用的 61dadec（2022-12-29）；逐檔從 raw.githubusercontent.com 下載（codeload 的整包 zip 與 GitHub API 從這裡回 403）。**英文維基百科只用到兩國的軌距**（亞美尼亞：條目資訊框的 gauge 欄位；南蘇丹：條目內文），是事實、沒有轉載條目文字；頁尾照樣列英文維基百科（CC BY-SA 4.0），側欄連到條目。維基百科 API 不用帳號、金鑰，User-Agent 寫專案網址，429 照 Retry-After 等。
    - **熊貓外交**（新主題，第 118 點，2026-10-29）：依英文維基百科「Panda diplomacy」（revid 1379504972）、「List of giant pandas」（revid 1382419942）、「Tuan Tuan and Yuan Yuan」（revid 1382543516）三個固定版本手工整理成表（`pipeline/sources/panda_diplomacy.py`，檔頭列出版本），每一列寫出處。年份、動物園、熊貓的名字是事實，中英文說明是自己寫的短句，不是轉載條目文字；但整張表是依條目整理的衍生資料，**依 CC BY-SA 4.0 分享**：指標檔的 `license` 與 `manifest.json` 寫 CC BY-SA 4.0，頁尾的來源也寫明。動物園的座標與中文名稱是 Wikidata 的結構化事實（CC0），SPARQL 查詢不用帳號、金鑰，User-Agent 寫專案網址。維基百科用 `index.php?action=raw&oldid=…` 讀固定版本（API 回 429 時改這個）。
    - **景點地圖**（新主題，第 119 點，2026-10-29）：博物館、動物園、水族館、樂園、雲霄飛車的類別、座標、名稱、停用日期、維基百科條目數都是 Wikidata 的結構化事實（CC0），經 SPARQL 查詢服務取得（不用帳號、金鑰，User-Agent 寫專案網址），沒有轉載條目文字。台灣的博物館補自文化部「博物館」開放資料（data.gov.tw 6242，`cloud.culture.tw` 的 JSON），政府資料開放授權條款第 1 版，頁尾寫出處；`cloud.culture.tw` 的憑證缺 Subject Key Identifier，跟內政部統計查詢網一樣只放寬這一項嚴格檢查（`common.RELAXED_X509_HOSTS`），憑證鏈與主機名稱照樣驗證。Roller Coaster DataBase（rcdb.com）沒有授權或使用條款，沒有用。
    - **南極研究站**（新主題，第 120 點，2026-10-29）：研究站的位置、經營者、年份、海拔、名稱都是 Wikidata 的結構化事實（CC0）。**COMNAP Antarctic Facilities 只能用於教育與非商業用途**（官網原文「Data may be freely used for educational and non-commercial purposes only… Reference for the use of the material is COMNAP 2025」），使用者決定只拿來核對：CSV（官網直連，不用帳號）只放在 `.cache/comnap/`，用它判斷 Wikidata 沒標關閉的站是不是還在名單上（對不對得到），前端只引用總數與核對結果，不轉載名稱、人數、季節這類內容，頁尾的來源寫「只引用核對結果與總數」。
    - **女性科學家與 STEM**（性別平等主題的擴充，第 123 點，2026-10-29）：STEM 畢業生的女性比例是世界銀行轉載 UNESCO UIS 的 SE.TER.GRAD.FE.SI.ZS（序列中繼資料「License_Type : CC BY-4.0」）。**女性研究人員比例是 UIS 公開 API 的 FRESP.THC，UIS 自己的資料庫是 CC BY-SA 4.0**（https://databrowser.uis.unesco.org/terms-and-conditions ，世界銀行沒有轉載這個指標），使用者決定照用、資料檔 `women-researchers.json` 的 `license` 寫 CC BY-SA 4.0，頁尾的來源寫明這個指標的資料檔也用 CC BY-SA 4.0（跟開學月份、V-Dem 一樣處理）；API 不用帳號、金鑰。台灣的研究人員用國科會「全國各研發執行部門研發人力統計資料_人數」（data.gov.tw 7563，政府資料開放授權條款第 1 版）；`mas.nstc.gov.tw` 只接受 RSA 金鑰交換的加密套件、憑證也缺 Subject Key Identifier，`common.py` 對這台主機改用 OpenSSL 的 DEFAULT 套件清單（`LEGACY_CIPHER_HOSTS`）並放寬 X509 嚴格檢查，憑證鏈與主機名稱照樣驗證。
    - **產假與育嬰假**（性別平等主題的擴充，第 124 點，2026-10-29）：世界銀行 Women, Business and the Law（WBL）的網站與 Excel 都沒寫授權（頁尾「All Rights Reserved」），**依 WDI 轉載 WBL 的序列中繼資料判斷可用**：SG.LAW.INDX 標「License_Type : CC BY-4.0」、Source 是 WBL 的網址，SH.MMR.LEVE（產假天數）也標 CC BY-4.0；頁尾的來源寫「CC BY 4.0（依 WDI 轉載 WBL 的序列中繼資料）」。檔案從 wbl.worldbank.org 直接下載，不用帳號。OECD Family Database PF2.1 是 OECD 資料條款（見上面 OECD 那一條）。
    - **國家公園**（新主題，第 125 點，2026-10-29）：國家公園的位置、設立年份、面積、IUCN 類別、名稱是 Wikidata 的結構化事實（CC0）。陸域保護區占國土是世界銀行 WDI 的 ER.LND.PTLD.ZS（序列中繼資料「License_Type : CC BY-4.0」，來源是 UNEP-WCMC 的 WDPA 與 WD-OECM）。**WDPA（Protected Planet）本身不能用**：條款不准轉載（「You may not redistribute the WDPCA and GD-PAME Data… in whole or in part by any means」），衍生作品也不准商業使用，所以沒有保護區的範圍；OSM 的 boundary=national_park 是 ODbL，使用者決定範圍的面不做。
    - **各國最常見的癌症**（疾病主題的擴充，第 126 點，2026-10-29）：WHO GHE 的第三層癌症部位（xmart API，CC BY 4.0，已記）。**GLOBOCAN（IARC）仍然不能用**（2026-10-29 重讀條款相同），所以只畫死亡、不畫發生。台灣的國健署癌症登記發生數只寫在附註（data.gov.tw 6399，政府資料開放授權條款第 1 版）。衛福部的死因統計（`www.mohw.gov.tw`）的憑證缺 Subject Key Identifier，跟內政部一樣放寬這一項嚴格檢查（`RELAXED_X509_HOSTS`）。
    - **菸酒的擴充（電子菸、禁菸法規）**（第 174 點，2026-10-30）：WHO MPOWER 的 TOBACCO_MPOWER_P1_SMOKEFREEPLACES 經 xmart 讀，是 GHO 的資料，CC BY 4.0（已記）。電子菸的規範用英文維基百科「Regulation of electronic cigarettes」（固定 revid 1377697236，2026-09-30）的 Legal status by jurisdiction 表：**有條件**，CC BY-SA 4.0，資料檔 `e-cigarettes.json` 同樣依 CC BY-SA 4.0 分享（頁尾的主題附註寫明）。台灣用全國法規資料庫的《菸害防制法》（政府資料開放授權條款，法規本身不受著作權保護）。WHO GHO 沒有電子菸法規的指標。
    - **安寧緩和醫療**（健康主題的擴充，第 173 點，2026-10-30）：WHO NCD CCS 的 NCD_CCS_palliative_prim、NCD_CCS_palliative_home 經 xmart 讀，是 GHO 的資料，CC BY 4.0（已記）。WHPCA《Global Atlas of Palliative Care》第 3 版（2026-10-20）**不能用**：版權頁「COPYRIGHT © 2026 by Worldwide Hospice Palliative Care Alliance, All Rights Reserved」。
    - **各國的健保制度**（健康主題的擴充，第 170 點，2026-10-30）：OECD Health System Characteristics Survey 2023 適用 OECD 資料條款（已記）。英文維基百科「Health care systems by country」（revid 1379352169）與「Universal health care」（revid 1382403456）的表：**有條件**，CC BY-SA 4.0，資料檔 `health-financing.json`、`uhc-start.json` 同樣依 CC BY-SA 4.0 分享（頁尾附註寫明）。美國 SSA《Social Security Programs Throughout the World》（聯邦政府著作，公有領域）是維基表常引用的出處，ssa.gov 從 cloud 回 403，沒有直接用。台灣用全國法規資料庫的《全民健康保險法》第 7 條。
    - **長期照顧**（健康主題的擴充，第 172 點，2026-10-30）：OECD Health Statistics 的長照床數與使用者（DSD_HEALTH_LTCR）適用 OECD 資料條款（可轉載、改作，需註明出處，同上面 OECD 的資料）。衛福部統計處的醫事機構服務量統計年報與社會福利公務統計是政府資料開放授權條款（已記）。社家署在 data.gov.tw 的資料集 161626 是同一份統計（政府資料開放授權條款－第 1 版），它的下載站 opendata.mohw.gov.tw 從 cloud 連不上，改用統計處網站上的 xlsx。
    - **洗腎大國**（疾病主題的擴充，第 171 點，2026-10-30）：USRDS Annual Data Report 的頁尾 Copyright 連到 NIDDK 的著作權頁 https://www.niddk.nih.gov/copyright ：「The majority of information on this site is copyright free and can be freely downloaded and reproduced. Content reproduced without changes should acknowledge the National Institute of Diabetes and Digestive and Kidney Diseases (NIDDK) as the source. There are a few exceptions.」「NIDDK and National Institutes of Health (NIH) logos must be removed from edited content.」：**可用**，資料來源寫 USRDS／NIDDK，不放標誌。國際的數字是各國腎臟登錄系統提供的（年報致謝有列），USRDS 沒有另外限制。WHO NCD CCS 的 NCD_CCS_dialysis 經 xmart（`pipeline/sources/who_xmart.py`）讀，是 GHO 的資料，CC BY 4.0（已記）。
    - **汽車擁有率**（交通安全主題的擴充，第 169 點，2026-10-30）：同一個 GSRRS 2023 指標檔（CC BY-NC-SA 3.0 IGO，已記）的 CP_38，資料檔照機車大國的寫法用 CC BY-NC-SA 3.0 IGO 分享。Eurostat road_eqs_carhab 是 CC BY 4.0（執委會 2011/833/EU 決定，跟上面 Eurostat 的資料相同）。世界銀行 WDI 的 IS.VEH.PCAR.P3（IRF World Road Statistics）**不能用**：中繼資料寫「Restricted use: Reproduction is strictly prohibited」，資料也已從 WDI 拿掉。台灣用交通部統計查詢網表 101 的小客車（交通部政府網站資料開放宣告，已記）；製作手冊原本寫公路局統計查詢網（stat.thb.gov.tw），2026-10-30 從 cloud 回 Incapsula 的防機器人頁，沒有繞過，改用交通部轉載的同一份監理登記數。
    - **此刻世界的新聞熱點**（新主題，第 148 點，2026-10-29）：GDELT 的條款（https://www.gdeltproject.org/about.html#termsofuse）「all datasets released by the GDELT Project are available for unlimited and unrestricted use for any academic, commercial, or governmental use of any kind without fee」「You may redistribute, rehost, republish, and mirror any of the GDELT datasets in any form. However, any use or redistribution of the data must include a citation to the GDELT Project and a link to this website」：頁尾的來源寫 GDELT 並連到 gdeltproject.org。事件由瀏覽器直接讀（data.gdeltproject.org 有 `access-control-allow-origin: *`，不必金鑰），不經過網站、不轉存。新聞的網址是各媒體的，只列連結（網域與網址裡的標題字），不轉載內容。FIPS 10-4 → ISO 的對照用 GeoNames 的 countryInfo.txt（CC BY 4.0，GeoNames 是第一次用：頁尾註明 GeoNames 與授權）。
    - **此刻的月亮用 Astronomy Engine**（晝夜與季節的擴充，第 147 點，2026-10-29）：npm 的 astronomy-engine 2.1.19（2023-12-14 發布），MIT（「Copyright (c) 2019-2025 Don Cross」，套件裡的檔頭寫 2019-2023），是程式不是資料；使用者決定在瀏覽器裡算。加進 `package.json` 的 dependencies（package-lock 只加這一個套件，這台的 npm 會順手刪掉其他套件的 `libc` 欄位，沒有收進來），只有晝夜與季節主題 import，打包後在那個主題的程式塊裡（75 KB，gzip 33 KB），不進首頁。MIT 要求附上著作權與授權聲明：頁尾的來源寫 MIT 並連到 GitHub；打包壓縮時套件檔頭的聲明（`@preserve`）會被拿掉，網站其他套件（React、MapLibre、d3）的聲明也一樣，是整個網站的事，另外處理（例如打包時保留授權註解，或另外放一份第三方授權清單）。
    - **海外軍事基地是 CC BY-SA 4.0**（軍事主題的擴充，第 146 點，2026-10-29）：英文維基百科「List of countries with overseas military bases」（固定 revid 1381583292，2026-10-23）是 CC BY-SA 4.0，手冊的決定照用（跟最古老的公司、血型的做法相同）：`bases-abroad.json`、`foreign-bases.json` 的 `license` 寫 CC BY-SA 4.0，頁尾的來源寫明資料檔同樣授權；流向檔只有國家代碼與爭議地區的說明（自己寫的）。
    - **節慶**（新主題，第 145 點，2026-10-29）：節慶的類別、位置、日子、名稱是 Wikidata 的結構化事實（CC0）。台灣用文化部文化資產局「文資局民俗」（data.gov.tw 114143，政府資料開放授權條款第 1 版，已記；`data.boch.gov.tw` 的憑證缺 Subject Key Identifier，加進 `RELAXED_X509_HOSTS`）。國土測繪中心的鄉鎮市區界線（TGOS）從 cloud 回 403，沒有用；鄉鎮市區的座標用 Wikidata。
    - **低於海平面的地方與地形區**（海拔主題的擴充，第 144 點，2026-10-29）：低於海平面的比例用網站已經算好的 GMTED2010 高度分布（公有領域，已記）；地形區用 Natural Earth 1:10m geography regions（公有領域，已記），GitHub 上 natural-earth-vector v5.1.2 的 GeoJSON。
    - **雲端機房的區域**（新主題，第 143 點，2026-10-29）：區域代碼、城市、開放年份是事實，手工整理成表（`pipeline/sources/cloud_regions.py`，每列寫出處），做法同國際組織。AWS 的 Site Terms 禁止資料探勘與機器人（「any use of data mining, robots, or similar data gathering and extraction tools」），所以完全沒有讀 AWS 的網站（含 ip-ranges.json），AWS 的清單與日期用第三方的時間表與新聞交叉核對；Google 的 Regions and zones 與 Cloud Storage release notes 是 CC BY 4.0；Microsoft Learn 的區域清單只讀一次，Azure Updates 的公告逐筆讀。頁尾寫「引用事實並註明出處」。
    - **最古老的公司是 CC BY-SA 4.0**（新主題，第 142 點，2026-10-29）：英文維基百科「List of oldest companies」（固定 revid 1380332977）是 CC BY-SA 4.0，使用者決定照用：這個主題的資料檔的 `license` 與 `manifest.json` 寫 CC BY-SA 4.0，頁尾的來源寫明資料檔同樣授權（跟血型主題用維基百科的做法相同）。座標與中文名用 Wikidata（CC0）。
    - **語系的分布**（語言主題的擴充，第 141 點，2026-10-29）：Glottolog 5.3（CC BY 4.0，已記）的譜系分類與座標，Unicode CLDR 49（Unicode License v3，已記）的使用比例。
    - **各國的特色食物**（新主題，第 140 點，2026-10-29）：乳酪、麵包、甜點的類別、原產國與名稱都是 Wikidata 的結構化事實（CC0）。
    - **機車大國**（交通安全主題的擴充，第 139 點，2026-10-29）：同一個 GSRRS 2023 指標檔（CC BY-NC-SA 3.0 IGO，已記）的 CP_39，資料檔照交通安全主題的寫法同樣用 CC BY-NC-SA 3.0 IGO 分享（頁尾的主題附註）。台灣用交通部統計查詢網表 101（已記）。
    - **運河與海峽**（航運與港口主題的疊加圖層，第 138 點，2026-10-29）：IMF PortWatch 的 Chokepoints 與 Daily_Chokepoints_Data，資料集的 license 欄指到 IMF 條款 https://www.imf.org/external/terms.htm （跟上面 IMF 資料的條款相同：註明來源即可轉載、改作，商業再利用要另外申請），頁尾寫「IMF 條款（註明來源）」。運河與海峽的點是 Wikidata（CC0）。OSM 的 waterway=canal（ODbL）沒有用，所以運河沒有線。
    - **各國的航空公司**（新主題，第 137 點，2026-10-29）：航空公司的類別、國家、成立與停業日期、IATA／ICAO 代碼、名稱都是 Wikidata 的結構化事實（CC0）。OpenFlights 的 airlines.dat（ODbL）沒有用。
    - **最長的直飛航線**（新主題，第 185 點，2026-10-30）：英文維基百科「Longest flights」（revid 1380354690，2026-10-15）是 CC BY-SA 4.0：航線的資料檔（`public/data/topics/longest-flights/`）是改作（展開 rowspan、對到 IATA 與座標、算大圓弧與各國條數），依 CC BY-SA 4.0 分享，頁尾寫明並連到固定的版本。機場的 IATA 與座標用 OurAirports（公有領域，已記）。
    - **最繁忙的機場**（交通主題的擴充，第 186 點，2026-10-30）：英文維基百科「List of busiest airports by passenger traffic」（revid 1381104599，2026-10-20）是 CC BY-SA 4.0：資料檔（`public/data/topics/transport/busiest-airports.json`、`busiest-passengers.json`）是改作（對到座標、依國家加總），依 CC BY-SA 4.0 分享，頁尾寫明並連到固定的版本。數字是 ACI 的初步統計，ACI World 網站本身的條款是「All content on the Website … is the proprietary property of the Company; All rights reserved」（https://aci.aero/terms-and-conditions-of-use/ ，**不能用**），沒有讀 ACI 的網站。座標用 OurAirports（公有領域，已記）。
    - **觀光鐵道與登山鐵路**（新主題，第 190 點，2026-10-30）：鐵路的種類、位置、年份、名稱都是 Wikidata 的結構化事實（CC0），用 QLever 的 Wikidata 端點查（同一份 CC0 資料，含子類別的查詢在 query.wikidata.org 會逾時）。英文維基百科的清單（CC BY-SA 4.0）與 OSM 的 railway=preserved（ODbL）沒有用。阿里山林業鐵路的通車年份（1912）是史實，依林業及自然保育署的介紹補。
    - **太空垃圾**（太空主題的擴充，第 191 點，2026-10-30）：同一個 GCAT satcat.tsv（CC BY 4.0，上面已記），只多算火箭殘骸、碎片與零件。手冊提到的 ESA DISCOS（API 回 401，要帳號）、Space-Track（要登入）、CelesTrak（沒有授權）都沒有用。
    - **纜車與索道**（新主題，第 128 點，2026-10-29）：纜車的種類、位置、年份、長度、名稱都是 Wikidata 的結構化事實（CC0）。OSM 的 aerialway（ODbL）與 OpenSkiData（ODbL）沒有用。
    - **外籍勞工占勞動力**（移民與難民主題的擴充，第 129 點，2026-10-29）：ILOSTAT 的 EAP_TEAP_SEX_AGE_CBR_NB_A（CC BY 4.0，ILOSTAT 已記）。台灣：勞動部「產業及社福外籍勞工人數－按國籍及縣市分」（data.gov.tw 41881）與主計總處人力資源調查（nstatdb A040107010），都是政府資料開放授權條款第 1 版；`apiservice.mol.gov.tw` 的憑證缺 Subject Key Identifier，加進 `RELAXED_X509_HOSTS`。
    - **收入有多少花在吃**（物價與財政主題的擴充，第 130 點，2026-10-29）：世界銀行國際比較計畫 ICP 2021（Data Catalog「License: Creative Commons Attribution 4.0」，API 來源 90，不用金鑰）。**USDA ERS 的國際食物支出表沒有用**：底層是 Oxford Economics、Euromonitor 的商業資料庫，USDA 的網站政策頁從 cloud 被 Akamai 擋下（403），授權沒辦法確認。
    - **家庭負債**（存款與財產主題的擴充，第 131 點，2026-10-29）：BIS total credit statistics（WS_TC，BIS 條款已記，用 SDMX API 只查家庭、占 GDP 那幾條序列，1.2 MB，不必下載整包 74 MB）。台灣是中央銀行「金融健全參考指標－家庭部門」（data.gov.tw 23853，政府資料開放授權條款第 1 版）；`www.cbc.gov.tw` 的憑證缺 Subject Key Identifier，加進 `RELAXED_X509_HOSTS`。**IMF Global Debt Database 沒有用**：條款要求商業使用另外申請、禁止自動大量下載（使用者決定只用 BIS）。
    - **有機農業**（農業主題的擴充，第 135 點，2026-10-29）：FAOSTAT 土地利用（RL）的有機農地（品項 6671，含轉型期）。有機面積是 FAO 用 FiBL 的全球調查補的，而 FiBL 自己網站的資料寫「provided for internal use only」「Larger data extracts (more than 100 datasets) may not be re-disseminated without written permission of FiBL」，FAO 資料庫條款又寫第三方資料可能另有限制、「these conditions are included in the dataset metadata or webpage」。使用者決定先確認、確認不了就不做。用 FAOSTAT 網站（一般瀏覽器開 https://www.fao.org/faostat/en/#data/RL/metadata ，網站自己帶授權標頭讀中繼資料 API）讀到 RL 的中繼資料：Release policy 寫「As per FAO Policy on Open Data Licensing for FAO Statistical Databases, this work is made available under the Creative Commons Attribution-4.0 International license (CC BY 4.0 …)」，Data compilation 寫「Data collected and disseminated by the Research Institute of Organic Agriculture (FiBL) are used to complement information on FAOSTAT items “Area certified organic” and “Area in conversion to certified organic”」，沒有列第三方的限制，所以照 CC BY 4.0 用 FAOSTAT 的數字（不直接用 FiBL 的資料）；頁尾與附註寫明 FAO 用 FiBL 的調查補齊。
    - **航空旅客量**（交通主題的擴充，第 134 點，2026-10-29）：世界銀行 WDI IS.AIR.PSGR（序列中繼資料 License_Type「CC BY-4.0」，來源 ICAO）與 UN WPP 2024（已記）。台灣附註用交通部民用航空局「民航運輸各機場營運量－按國際、兩岸及國內航線分」（data.gov.tw 33238，政府資料開放授權條款第 1 版）；`www.caa.gov.tw` 的憑證缺 Subject Key Identifier，加進 `RELAXED_X509_HOSTS`。
    - **Global E-waste Monitor 2024 是 CC BY-NC-SA 3.0 IGO**（電子垃圾，新主題，第 133 點，2026-10-29）：報告版權頁「This work is available under the Creative Commons Attribution-Non-Commercial-ShareAlike 3.0 IGO licence」，ewastemonitor.info 的 Copyright 頁相同。使用者決定照用（非商業可以接受）：這個主題的資料檔的 `license` 與 `manifest.json` 寫 CC BY-NC-SA 3.0 IGO，頁尾的來源寫明資料檔同樣授權。報告 PDF 從 ewastemonitor.info 直接下載，不用帳號。
    - **企鵝在哪裡是 MAPPPD v5.0，照「只准非商業」處理**（新主題，第 158 點，2026-10-30）：網頁頁尾「Data release v5.0 Data licensed CC BY 4.0」、API https://www.penguinmap.com/api/v1/release/ 的 license 欄「CC BY 4.0」，但使用條款 https://www.penguinmap.com/terms_of_use/ （version 3.0，2021-09-09）寫「Users may not copy or use material or data from MAPPPD for commercial use, except for use by the media, by Antarctic expedition operators or with the express written consent of Oceanites.」，兩者矛盾；使用者 2026-10-30 決定以較嚴的看，照只准非商業使用，頁尾的授權寫「CC BY 4.0；使用條款不准商業使用，這裡是非商業使用」，引用照它的 How to cite（Oceanites, Inc. (2026). MAPPPD … version 5.0）。全部普查的 CSV（/mapppd/DownloadAll）不必登入。台灣沒有企鵝（不適用）。
    - **貿易依存度**（貿易主題的擴充，第 179 點，2026-10-30）：世界銀行 WDI 的 NE.TRD.GNFS.ZS（序列中繼資料「License_Type: CC BY-4.0」）。台灣：主計總處「國民所得統計-國內生產毛額及平減指數依支出分-年(1981以後)」（data.gov.tw 44224）與「(1951-1980)」（44221），授權欄都是政府資料開放授權條款第 1 版（主計總處已記）。
    - **GLiM 0.5° 網格版是 CC BY 3.0**（地表的岩石種類，新主題，第 154 點，2026-10-30 讀過）：PANGAEA 的資料集頁（doi:10.1594/PANGAEA.788537「Global Lithological Map Database v1.0 (gridded to 0.5° spatial resolution)」）JSON-LD 的 license 是 https://creativecommons.org/licenses/by/3.0/ ；檔案 https://epic.awi.de/id/eprint/31092/1/hartmann-moosdorf_2012.zip （38,670 bytes，不必登入）。頁尾的來源寫作者、資料集與 DOI。完整版（約 120 萬個多邊形）漢堡大學的頁面寫要向 CCGM 訂購，連結 404，沒有用。台灣官方的二十五萬分之一區域地質圖（data.gov.tw 6695，政府資料開放授權條款）在 gsmma.gov.tw 被 Cloudflare 擋，使用者決定不另做台灣的細圖，沒有用。
    - **貿易的商品流向**（貿易主題的擴充，第 180 點，2026-10-30）：CEPII BACI 的 HS92、HS17、HS22 版（Etalab 2.0，已記），同一個授權；手冊的例子用的 Harvard Atlas（CC0）只拿來對量級，沒有進資料檔。
    - **太陽能板**（半導體主題的擴充，第 181 點，2026-10-30）：CEPII BACI 的 HS22 版（Etalab 2.0，已記）；台灣的對照用財政部統計資料庫（政府資料開放授權條款，已記）。
    - **海鮮的貿易**（海洋與漁業主題的擴充，第 182 點，2026-10-30）：CEPII BACI 的 HS92 版（Etalab 2.0，已記）。FAO FishStat 的「Global aquatic trade - By partner country」（CC BY 4.0）使用者決定不用。
    - **關鍵礦產的擴充**（第 155 點，2026-10-30）：鹽、黃金用 USGS MCS 2020–2026 的 Salt、Gold 章（美國政府著作，公有領域，已記）；稀土、永久磁鐵、鈾的貿易用 CEPII BACI HS92（Etalab 2.0，已記）。**沒有用的**：鈾的產量。OECD NEA／IAEA《Uranium 2026》（紅皮書）的網站（oecd-nea.org、oecd.org、iaea.org）被 Cloudflare 擋，條款讀不到（待確認，使用者決定先做貿易）；World Nuclear Association 的條款「All rights in all Our Content … are expressly reserved」、只准轉載單頁 150 字以內（不能用）；BGS World Mineral Statistics 只准非商業學術用途、給第三方要許可（不能用）；USGS MCS 沒有鈾。
    - **聯合國的家戶資料庫 2026 年版也是 CC BY 3.0 IGO**（婚姻與家庭的擴充，第 166 點，2026-10-30）：Database on Household Size and Composition 2026 與 Database on the Households and Living Arrangements of Older Persons 2026 兩個 Excel 的 Important Note 都寫「Copyright © 2026 by United Nations, made available under a Creative Commons license (CC BY 3.0 IGO)」（un.org 直接下載，不必登入）。台灣的家庭組織型態用主計總處「家庭收支調查-性別統計指標-家戶狀況按家庭組織型態分」（data.gov.tw 27963，授權欄「政府資料開放授權條款-第1版」）。
    - **一夫多妻依英文維基百科「Legality of polygamy」整理（CC BY-SA 4.0）**（第 166 點）：跟同性伴侶、死刑一樣，自行整理的表（`pipeline/sources/polygamy.py`，檔頭寫 revid 1378459627），資料檔 `polygamy.json` 依 CC BY-SA 4.0 分享，頁尾連到固定的版本。台灣的附註依全國法規資料庫（民法第 985 條、刑法第 237 條；法律條文依著作權法第 9 條不是著作權的標的）。普及程度只在頁尾的說明摘錄 Pew Research Center 2020 年短文的三個國家與全球 2%，附上 Pew 條款要求的免責聲明（Pew 的條款見第 27 點：只能摘錄）。
    - **Human Fertility Database 是 CC BY 4.0**（沒有小孩的女性比例，第 167 點，2026-10-30）：使用者協議 https://www.humanfertility.org/Account/UserAgreement 寫「The HFD data is licensed under a Creative Commons Attribution 4.0 International License」，HFD 自己算的資料是 CC BY 4.0，各國提供的原始資料（Input Data）不是，不用；HFD Lite 的 PARITY.xlsx 不必登入。協議另外「請求」不要把資料轉給別人、改指向 HFD 網站，是請求不是禁止，頁尾連到 HFD。德國、義大利等 HFD Lite 沒有的國家用 OECD Family Database SF2.5（SF_2-5-Childlessness.xlsx，2024-09-10，webfs.oecd.org 直接下載），2024 年 7 月以後出版，依 OECD 的條款是 CC BY 4.0（`oecd_family.py` 檔頭）。
    - **教育的擴充**（第 168 點，2026-10-30）：OECD Education at a Glance 的三個資料流（教師的法定薪資 DSD_EAG_SAL_STA@DF_TCH、平均每班人數 DF_UOE_NF_PERS_CLS、上課時間 DF_EAG_IT_ALL，sdmx.oecd.org 不必登入、不必金鑰）與 OECD Family Database PF3.2（webfs.oecd.org，2026-02-16）都依 OECD 資料條款（已記），標「OECD 資料條款（可轉載、改作，需註明出處）」。學前教育毛入學率用世界銀行 WDI SE.PRE.ENRR（序列中繼資料「License_Type : CC BY-4.0」）。小學學生數、教師數（20062、20162）與高中職業類比例（GTVP.3.V）用 UIS 公開 API（CC BY-SA 4.0，已記），生師比與技職比例的資料檔依 CC BY-SA 4.0 分享（指標檔的 `license`）。台灣用教育部統計處的開放資料：國民小學概況（data.gov.tw 31444，edu_B_3_1.csv）、各級學校概況（31436，edu_B_1_2.csv），授權欄都是「政府資料開放授權條款-第1版」；stats.moe.gov.tw 的憑證缺 Subject Key Identifier，加進 `RELAXED_X509_HOSTS`。
    - **鋼鐵與水泥**（工業主題的擴充，第 176 點，2026-10-30）：USGS Minerals Yearbook 2023 的鋼鐵、水泥兩章 xlsx 是美國政府著作、公有領域（USGS 已記，https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits ，頁尾寫 USGS）。GEM 的 Global Iron and Steel Tracker（2026 年 9 月版）與 Global Cement and Concrete Tracker（2026 年 7 月版）用公開地圖 `config.js` 裡的 GeoJSON（不必填表），照上面 GEM 的決定標 CC BY 4.0（下載表單程式的預設授權也是 CC BY 4.0，見上面 GEM 那一項）。worldsteel 的資料「may be quoted as long as the source of the information is acknowledged」、訂閱資料「cannot be shared with a third party」，授權不清楚，沒有用。
    - **大學入學考試依英文維基百科整理（CC BY-SA 4.0）**（新主題，第 175 點，2026-10-30）：「List of admission tests to colleges and universities」（revid 1381783633）與「List of secondary school leaving qualifications」（revid 1368870013）都是文字清單，分類與考試名稱是依條目整理的表（`pipeline/sources/admission_tests.py`），資料檔 `main-route.json` 依 CC BY-SA 4.0 分享（指標檔的 `license`）。台灣的分科測驗、日本的大學入學共通測驗依考試名稱改正（只引用名稱與月份）。
    - **唐人街：Wikidata（CC0）加上依英文維基百科補的點（CC BY-SA 4.0）**（新主題，第 195 點，2026-10-30）：補的 48 處只用分區條目（Chinatowns in Europe revid 1381063693、Chinatowns in Asia revid 1371913766，以及非洲、大洋洲、拉丁美洲與加勒比海的條目）裡的地名，座標取那個街區或城市的 Wikidata 項目（CC0），所以點檔與各國的處數依 CC BY-SA 4.0 分享。data.gov.tw 搜「唐人街」0 筆，台灣沒有。
    - **博弈的合法性依英文維基百科「Gambling age」整理（CC BY-SA 4.0）**（法律與制度的擴充，第 196 點，2026-10-30）：revid 1379514800 的各洲表格（pipeline 下載固定版本 `oldid`），分類寫在 `pipeline/sources/gambling.py`，資料檔 `gambling.json` 依 CC BY-SA 4.0 分享。台灣依全國法規資料庫（刑法第 266 條、公益彩券發行條例第 9 條、離島建設條例第 10-2 條；法律條文依著作權法第 9 條不是著作權的標的）。
    - **熱點火山**（地震與火山的擴充，第 156 點，2026-10-30）：只多讀 GVP WFS 的 Tectonic_Setting 欄，條款同第 39 點已記的 GVP（美國政府職務作品；Smithsonian 條款非商業使用、註明出處）。**沒有用的**：英文維基「Hotspot (geology)」的熱點清單（CC BY-SA 4.0）、Wikidata 的熱點（CC0）：使用者決定不整理熱點清單。
    - **物價與財政的擴充**（第 177 點，2026-10-30）：IMF 的 GFS COFOG 與 Historical Public Debt（SDMX API，不必金鑰）照 IMF 資料條款（已記：註明來源即可轉載、改作，商業再利用要另外申請）。世界銀行 WDI 的 SE.XPD.TOTL.GB.ZS（UNESCO）、SH.XPD.GHED.GE.ZS（WHO）序列中繼資料標「CC BY-4.0」；MS.MIL.XPND.ZS（國防占政府支出）標「SIPRI terms and conditions」，沒有用。OECD 全球稅收統計的組成（PT_OTR_SECTOR）跟稅收占 GDP 同一個資料庫（OECD 條款，已記）。財政部財政統計資料庫的 i0121（政事別歲出，政府資料開放平臺 8470，授權欄「政府資料開放授權條款」）、i0807（賦稅收入結構，依 OECD 分類）、i0232（中央政府債務）跟物價與財政已用的 i0801 等同一個資料庫，財政部網站的政府網站資料開放宣告採政府資料開放授權條款第 1 版（已記）。UNU-WIDER GRD 要填表、xlsx 回 403，沒有用。
    - **特殊地形**（新主題，第 157 點，2026-10-30）：Wikidata（CC0，已記）。**沒有用的**：OpenStreetMap（ODbL；泥火山 892 個、間歇泉 1,692 個、天然拱門 1,279 個比 Wikidata 多，但使用者決定不用，Overpass 從 cloud 也連不上）、Natural Earth 的峽灣面（只有 8 個）。
    - **匯率制度**（國家小檔案的擴充，第 178 點，2026-10-30）：英文維基百科「List of countries by exchange rate regime」（固定 revid 1369823927）是 CC BY-SA 4.0，使用者決定用它轉載的 IMF《AREAER 2023》事實分類（有條件：頁尾標 CC BY-SA 4.0 並連到固定版本）。IMF AREAER Online 要訂閱、沒有用；Ilzetzki–Reinhart–Rogoff 的分類網頁與檔案只有引用格式、沒有授權（待確認），沒有用。台灣依中央銀行 2011-09-04 的新聞稿（央行網站的政府網站資料開放宣告採政府資料開放授權條款，已記），只引用一句話。
    - **Sengupta et al. 2023 的填海資料是 CC BY 4.0**（填海造陸，新主題，第 159 點，2026-10-30 讀過）：Zenodo records/7528236 的 API license 是「cc-by-4.0」；reclamation_data_Final.xlsx 直連不必登入。頁尾寫作者、論文與資料的 DOI。**沒有用的**：同一筆資料的 reclaimed_POI_landuse.xlsx（填海地上的土地用途點，從 OpenStreetMap 取的，ODbL）。城市位置與中文名稱用 Natural Earth（公有領域，已記）。台灣官方沒有找到填海或海埔地的開放資料（data.gov.tw 搜「填海造地」0 筆）。
    - **燃油車禁售的年份**（電動車主題的擴充，第 187 點，2026-10-30）：英文維基百科「Phase-out of fossil fuel vehicles」（固定 revid 1380317959）是 CC BY-SA 4.0（有條件：頁尾標授權並連到固定版本）；狀態是依條目的表逐國判斷的。ICCT 網站的條款也是 CC BY-SA 4.0，但沒有整理好的下載表，沒有用。國發會的淨零路徑網頁從 cloud 被 Cloudflare 擋（HTTP 403），沒有繞過。
    - 頁尾已標示各主題的來源。
13. **網格人口歸國**（`pipeline/topics/population_grid.py`）：
    - world-atlas 的俄羅斯本土 ring 跨過換日線（楚科奇），平面上直接畫會在北緯 65°–69° 拉出一條橫跨全球的帶子，把俄羅斯北部挖空。畫之前要把經度展開成連續的，超出 ±180° 的部分再補一份平移 360° 的。
    - 地圖的法國形狀含海外省（留尼旺、馬約特、瓜地洛普、馬丁尼克、法屬圭亞那），荷蘭含波奈等三島，但 WPP 分開計算，要依多邊形拆出來。
    - 地圖把克里米亞畫在俄羅斯，WPP 算在烏克蘭；地圖的摩洛哥形狀含西撒哈拉（而且跟西撒哈拉的形狀重疊），WPP 分開算。網格一律照 WPP 歸屬，否則縮放比例會錯（例如西撒哈拉會放大 178 倍）。
    - 索馬利蘭、北賽普勒斯、聖誕島與科科斯群島、諾福克島、奧蘭群島在地圖上有形狀，但 WPP 把人口算在索馬利亞、賽普勒斯、澳洲、芬蘭。
    - 吐瓦魯、托克勞、直布羅陀在 1:50m 沒有形狀，用矩形範圍指定。
    - GHS-POP 的 30 角秒 GeoTIFF 範圍不是整齊的 ±180°（左右各多約 1 格），超出的像素要繞回另一側。

14. **碳排與溫室氣體資料**（`pipeline/topics/climate.py`、`pipeline/sources/edgar.py`、`ceds.py`、`moenv.py` 的 `ghg_inventory()`、`src/topics/panels/ClimatePanel.tsx`）：
    - OWID 的科索沃沒有 ISO 代碼，用國名對應成 XKX；洲、所得組、國際航空與航運另外列，不收。
    - 國際航空與航運的排放不屬於任何國家，所以各國加總小於世界合計（EDGAR 的 AIR、SEA 也只算進世界合計）。
    - 每單位 GDP 的排放用 Maddison Project 的 GDP（2011 年國際元），只到 2022 年。
    - **二氧化碳只有一套數字**：「人均排放」「年排放量」選二氧化碳、累積、消費端、每單位 GDP、側欄的燃料別都是 Global Carbon Project（GCP）。EDGAR 的二氧化碳授權禁止改作（第 12 點），本來就不能用，也剛好避免同一個主題出現兩套不一致的二氧化碳。原本的 `co2-per-capita`、`co2` 兩個指標併進「氣體」子項目（舊網址用 `indicatorAliases` 轉過去，資料檔名不變）。
    - **全部溫室氣體 = GCP 的二氧化碳 + EDGAR 的甲烷、氧化亞氮、含氟氣體**，1990–2024 年：含氟氣體 1990 年起才有，2025 年的欄位是空的；GCP 到 2024 年。EDGAR 沒有估計含氟氣體的國家（衣索比亞、坦尚尼亞、尼泊爾等約 70 個，多半是小島與低所得國家，EDGAR 自己的合計也沒有）在合計裡當成 0，選含氟氣體時是無資料。
    - **CO₂ 當量**：IPCC AR5 的 GWP-100，跟 EDGAR 自己的合計一樣：化石來源的甲烷 30（化石燃料開採 1.B、工業 2、化石燃料火災 5.B、燃料燃燒 1.A 標 fossil 的）、生物來源 28（畜牧、稻田、廢棄物、燃燒生質），氧化亞氮 265；含氟氣體用 EDGAR 已經換算好的 AR5 檔。用 EDGAR_AR5_GHG 各部門的值反推驗證過（只有甲烷的部門剛好 28 倍、化石燃料開採剛好 30 倍、只有氧化亞氮的剛好 265 倍）。環境部清冊的甲烷一律用 28。
    - **EDGAR 併在一起計算的國家**：南蘇丹在蘇丹、巴勒斯坦在以色列、列支敦斯登在瑞士、摩納哥在法國、安道爾在西班牙、聖馬利諾與梵蒂岡在義大利，塞爾維亞與蒙特內哥羅（含科索沃）是一筆 SCG（這裡算在塞爾維亞）。這些「主國」的人均用合計的人口（WPP），全部溫室氣體也把成員的 GCP 二氧化碳加進來，附註寫明；被併進去的國家選二氧化碳以外的氣體時寫「EDGAR 把它併在…計算」（`noValue`）。荷屬安地列斯（ANT）只算進世界合計。
    - **人均**：二氧化碳沿用 OWID 的人均（跟原本一樣），其他氣體與全部溫室氣體用 UN WPP 2024 的年中人口（2024、2025 年是推估）。
    - **土地利用變化**：GCP 的 `land_use_change_co2_per_capita`（簿記模型的平均，1850–2024），發散色、正值（排放）橘、負值（淨吸收）青綠。沒有台灣；台灣的附註與 tooltip 寫環境部清冊的 LULUCF 淨吸收，並說明兩者算法不同（清冊算受管理森林的吸收，GCP 主要算砍伐與再生長），沒有放進地圖。
    - **側欄的排放來源**：EDGAR 的部門依 IPCC 2006 代碼分組（`edgar.CH4_SECTORS`、`N2O_SECTORS`，沒見過的代碼直接報錯）。全部溫室氣體的「排放來源」是 GCP 的燃煤、天然氣、石油二氧化碳，加上「工業製程與產品使用」（水泥等二氧化碳＋EDGAR 2.x＋含氟氣體）、「化石燃料開採」（燃除＋逸散）、農業、廢棄物、其他（燃燒的甲烷與氧化亞氮、間接排放）。**沒有發電、運輸、住商的部門別總量**：EDGAR 的部門別二氧化碳是 IEA-EDGAR CO₂（禁止改作）；改在另一段用 CEDS 的燃料燃燒二氧化碳各用途的**比例**（發電與供熱、煉油等能源業、工業、運輸、住宅與商業、農林漁業與其他，到 2023 年）。CEDS 的總量比 GCP 高（台灣 2023 年 2.95 億公噸，GCP 與清冊都是 2.67 億），所以只列比例；台灣的比例跟清冊相近（能源業 70%、製造業 11–12%、運輸 14–15%、住商與其他 4%）。
    - 側欄檔（`countries/<ISO3>.json`）：`co2`（GCP 依燃料）、`edgar`（「氣體:部門」，1970–2025）、`uses`（CEDS，1970–2023）、`inventory`（只有台灣）、`members`；每組是 `{ from, values }`，百萬公噸、4 位有效數字，不到 1 千公噸的序列不放。230 國共 2.8 MB（gzip 後 0.8 MB），原本只有燃料別時 1.3 MB。
    - **台灣的對照**（環境部《2026 年中華民國國家溫室氣體排放清冊報告》，開放資料 GHG_P_02，1990–2024，跟報告表 ES2.1 逐年核對過）：2024 年清冊總排放 2.73 億公噸 CO₂e（不含 LULUCF），森林等吸收 2,176 萬公噸，淨排放 2.51 億公噸；這裡 2.86 億公噸，多 4.8%。二氧化碳 GCP 2.62 億、清冊 2.62 億（+0.3%）；**甲烷 EDGAR 1,546 萬、清冊 435 萬（3.6 倍）**，主要差在廢水（EDGAR 639 萬、清冊 87 萬）與垃圾掩埋等固體廢棄物（EDGAR 437 萬、清冊 56 萬；台灣的垃圾大多焚化，清冊的掩埋甲烷從 1998 年的 1,096 萬公噸降到 2024 年的 54 萬）；氧化亞氮 EDGAR 490 萬、清冊 339 萬（+44%，EDGAR 多算了氮沉降的間接排放與廢水）；含氟氣體 EDGAR 365 萬、清冊 392 萬（−7%；EDGAR 的台灣 1990–1994 年是 0）。pipeline 每次都印出對照；清冊每年 6、7 月出新版，整個序列會換成新版的數字，附註裡廢水與掩埋的部門別數字（`INVENTORY_CH4_2024`）要手動更新。台灣 2024 年：全部溫室氣體 12.3 公噸/人（205 國第 25）、總量第 31；二氧化碳 11.3 公噸/人（第 20）。

15. **貿易流向**（`pipeline/topics/trade.py`）：
    - **來源的選擇**：全部商品用 CEPII BACI，因為授權清楚（Etalab 2.0）、有台灣、可以一次下載整個檔，而且已經把進出口雙方的申報調和成一個數字。
      - UN Comtrade 的免費 API 要申請金鑰、有次數與筆數限制，要抓全部國家的雙邊資料很麻煩。
      - IMF IMTS（原 DOTS）也有雙邊總額，但進出口兩邊的申報各自列出，要自己調和。
    - **台灣在 UN Comtrade 與 BACI 是「Other Asia, nes」（代碼 490，ISO 欄位是 `S19`）**，`pipeline/sources/baci.py` 明確改成 TWN。697「Europe EFTA, nes」等無法歸到國家的代碼只計入總額、不畫弧線。
    - BACI 的台灣數字跟財政部統計的差異（抽查用）：
      - 2023 年對中國大陸＋香港 1,510 億美元（財政部：占 4,324.8 億的 35.2%，約 1,522 億），對美國 757 億（財政部：占 17.6%，約 761 億），很接近。
      - 出口總額 4,721 億，比財政部多約 9%，多出來的主要在新加坡（436 億）：BACI 會參考進口國依「原產地」的申報，經第三地轉運的貨會算回台灣。
      - 2024 年對美國只有 938 億，財政部是 1,113.7 億；HS22 版也是 947 億，所以不是 HS 版本換算造成的，是 BACI 調和方法的結果。
    - BACI 用 HS17 版（2017–2024 年，zip 約 800 MB）。每年約 1,100 萬列，用逗號直接切比 csv 模組快，8 年約 2 分鐘。
    - **FAOSTAT 詳細貿易矩陣（TM）**：
      - 解壓後 8.5 GB、約 4,700 萬列，只讀金額（element 5922、5622），先用位元組比對篩掉數量列再切欄位。仍要十幾分鐘。
      - 是各國自己申報的數字，同一筆貿易的出口方與進口方常常不一樣。出口以出口國、進口以進口國的申報為準；某國當年完全沒申報才改用夥伴國的申報（鏡像）。台灣只有 2008 年沒有申報。
      - 夥伴有「World」與各洲合計（代碼 ≥ 5000），以及「China」(351)，都要排除。
      - 最近一年常常還沒收齊（2024 年只有 117 國申報，之前約 155 國），申報國不到高峰九成的年份不放。
      - TM 的品項比 TCL 細，牛肉是帶骨＋去骨＋水牛肉、豬肉含培根火腿香腸與調製品、乳製品是所有 CPC 022／22 開頭的乳品（不含冰淇淋），都用金額加總。
      - 「農產品合計」是全部 TM 品項的加總，要排除「稻穀（白米當量）」(30)，它是其他米品項的合計。
      - 只收 2000 年以後（1986–1999 年申報的國家只有 70–90 國）。目前 24 個商品的流向檔共約 19 MB、600 個檔，gzip 後約 6 MB；一次只載入一個商品、一年（農產品合計約 90 KB，gzip 後約 30 KB）。
      - 檢查用的數字：2022 年全球農產品出口 1.91 兆美元；台灣農產品出口 36 億、進口 165 億，跟農業主題用 TCL 算的貿易收支（−128 億）一致；台灣進口大豆 18.6 億，美國 11.5 億、巴西 6.3 億。

16. **軍費資料（SIPRI）**（`pipeline/topics/military.py`、`pipeline/sources/sipri.py`）：
    - SIPRI 的使用條款（https://www.sipri.org/about/terms-and-conditions）：非商業使用、註明 SIPRI，轉載少於整個資料集 10% 才算合理使用，超過要申請授權。世界銀行轉載的軍費（`MS.MIL.XPND.*`）也標示適用 SIPRI 條款，不是 CC BY。
    - 使用者決定只放合理使用範圍內的子集：軍費（當年美元）與占 GDP 兩張表的 2011–2025 年，含台灣。
    - **10% 的計算方式**：
      - 分母是整個 Excel 檔（1949–2025 版 v1.2）扣掉封面與註腳後的數值格子：7 張國家表加區域合計，共 55,520 個。
      - 分子是實際輸出的筆數：165 國的軍費 2,329 筆，加上 163 國的占 GDP 2,324 筆，共 4,653 筆，約 8.4%。
      - `sipri.dataset_size()` 每次都重算；超過 10% 時資料管線會直接報錯。
      - 2001–2025 年會超過 10%（約 14%），所以從 2011 年開始。
    - 要放更多年份或指標（人均軍費、占政府支出等），要先向 SIPRI 申請授權。
    - 頁尾依 SIPRI 的格式註明「Information from the Stockholm International Peace Research Institute (SIPRI)」與資料集的 DOI。
    - 世界合計是有資料國家的加總（SIPRI 自己的世界合計含缺漏國家的估計值，而且只有固定價格）；占 GDP 的世界值是「軍費加總 ÷ GDP 加總」，GDP 由各國軍費 ÷ 占比反推。
    - SIPRI 的台灣數字比政府公布的國防預算總額低：2024 年 SIPRI 是 152 億美元、占 GDP 1.91%，行政院公布的 113 年度國防預算是 6,068 億元、約 2.5%（預算數，含特別預算與非營業特種基金）。台灣側欄有附註。
    - 兵力（現役加準軍事部隊）用世界銀行轉載的 IISS 資料，CC BY 4.0，只到 2020 年，沒有台灣；國防部公布的是編制員額，不是實際人數，口徑不同，所以沒有補。

17. **台灣的數位資料**（`pipeline/topics/digital.py`）：
    - ITU（世界銀行轉載）沒有台灣。
    - 上網率用數位發展部「數位近用調查」（`pipeline/sources/moda.py`）：
      - 對象是 12 歲以上的本國籍民眾，電話抽樣；2021 年沒有調查。
      - ITU 本來就收各國自己的調查，不調整年齡範圍，所以直接用。
      - 檔名寫 UTF8，實際是 Big5（cp950）。
    - 行動電話與固網寬頻用 NCC 每年 12 月的用戶數，除以 WPP 年中人口（`pipeline/sources/ncc.py`）：
      - 行動電話含純數據門號（ITU 不含，約差 2–3%）。
      - 4G 用戶 2015 年 1 月才列入統計，2014 年（4G 開台後）少算約 400 萬，從缺。
      - 固網寬頻只算有線（ADSL、光纖、纜線、專線），不含公眾無線區域網路（PWLAN），否則 2012–2015 年會多出近 200 萬。
    - www.ncc.gov.tw 有 Cloudflare 驗證，只能從 api.ncc.gov.tw 下載。下載網址要帶 `filedisplay` 參數（任何檔名都可以），否則回傳「您的瀏覽器未送出Cookie」的網頁，HTTP 狀態一樣是 200。
    - TWNIC 的台灣網路報告網站對程式一律回 HTTP 426，下載不了，所以不用。

18. **健康資料**（`pipeline/topics/health.py`）：
    - 平均壽命、嬰兒與五歲以下死亡率用 WPP 2024（`pipeline/sources/wpp.py`），各國同一套方法，只取 2023 年以前的估計值。側欄另外畫男女平均壽命。
    - **台灣改用內政部的簡易生命表**（`pipeline/sources/moi.py`），因為 WPP 對台灣嬰幼兒死亡率的估計比官方低很多：
      - 2023 年 WPP 的嬰兒死亡率是 2.98‰、五歲以下 4.20‰；內政部 112 年簡易生命表是 4.31‰、5.12‰。
      - 平均壽命差得少（WPP 80.56 歲，內政部 80.23 歲）。台灣側欄的附註會自動附上 WPP 最新一年的值對照。
    - **口徑可以比**：
      - 生命表的 0 歲死亡機率（q0）是各月齡的嬰兒死亡數除以當年與前一年的月別出生數，也就是出生後未滿 1 歲死亡的機率；WPP 的 IMR 也是 1q0（每千活產）。
      - 未滿 5 歲死亡機率用 1 − l5／l0，跟 WPP 的 Q5 同一個定義。
      - 衛福部死因統計的「嬰兒死亡率」是當年嬰兒死亡數 ÷ 當年活產數，算法不同；這裡三個指標都用同一套生命表。
    - **內政部資料的取得**：
      - 0 歲平均餘命（含男女）用統計查詢網的 CSV 匯出：全國 funid c1210101、臺灣地區 c1210102。
      - 死亡機率統計查詢網沒有，要讀每年的「全國簡易生命表」檔案。清單頁 https://www.moi.gov.tw/cl.aspx?n=2953&PageSize=100 每年一個連結，下載網址的 `n` 參數是 base64 的檔名。
      - 81–98 年是 Excel 另存的 htm（Big5），99–105 年是 ods（有目錄頁，全國表跟臺灣地區、臺灣省並排），106 年起是 xlsx 或 ods。版面都一樣：「全體」（舊版叫「兩性」「兩性平均」）、「男性」「女性」三段，第 1 欄年齡、第 2 欄 qx、第 3 欄 lx。
      - 清單頁的側欄也有縣市別的檔案，用檔名（`LIFE_TABLE_FILE`）分辨。
    - **台灣只有 1992 年起**：
      - 全國（含金門、連江）的生命表 81 年（1992）起才有。
      - 更早只有臺灣地區的表，而且只分男女、沒有兩性合計（統計查詢網的「總計」也是「-」），所以平均壽命與死亡機率從 1992 年開始，之前留空，不接 WPP 的估計。
      - 男女平均壽命 1970–1991 年用臺灣地區的值（不含金門、連江）。兩者差很少，例如 1992 年男性全國 71.78 歲、臺灣地區 71.79 歲。
      - 內政部已經有 2024、2025 年，但其他國家只到 2023 年，`year_span` 會截掉。
    - 嬰兒死亡率 1995 年從 5.25‰ 跳到 6.72‰，不是程式錯誤，原因見呂宗學、江東亮（2020）〈解讀台灣1995年嬰兒死亡率上升〉（台灣衛誌 39(2)）。
    - 醫療支出：台灣用衛福部國民醫療保健支出（NHE）統計的「經常性醫療保健支出」（CHE = NHE 扣掉資本形成），跟 WHO 的 current health expenditure 同一個概念（`pipeline/sources/mohw.py`）。
      - 每年新版會修訂整個序列，下載網址的 dl 編號也會變，要到統計處網頁找新版。
    - 醫師數：WHO 的定義不含傳統醫學，台灣用每萬人口執業西醫師數（不含中醫師、牙醫師）除以 10。
      - 衛福部統計指標表 4-3 只有 2000、2005、2010 與 2015 年以後每年。
      - 很多國家隔幾年才統計一次，所以頭尾年份要有最多那年一半以上的國家才收（`year_span(..., 0.5)`）。護理人員、病床也一樣。
      - **醫病比**就是這個指標，標籤寫成「每千人醫師數（醫病比）」，說明裡換算成每位醫師服務幾人。
    - **誰付醫療費**：家庭自付占比（`SH.XPD.OOPC.CH.ZS`）、人均自付（`SH.XPD.OOPC.PP.CD`，購買力平價國際元）、政府與強制保險占比（`SH.XPD.GHED.CH.ZS`，WHO 的 domestic general government，含社會保險基金）。
      - 台灣用國民醫療保健支出表1 的「家庭自付費用占 CHE 比重」與「公部門經常性醫療保健支出占 CHE 比重」（公部門 = 各級政府＋全民健保，跟 WHO 的 general government 同一個範圍）。
      - **台灣的家庭自付範圍比較寬**：衛福部的附註寫明含營養保健品、民俗醫療、產後護理之家等，WHO 的帳戶（SHA 2011）多半不算沒有處方的保健食品。所以台灣 2023 年 38.8% 比日本（12.2%）、南韓（31.8%）高，人均自付 2,101 國際元排第 2（瑞士 2,335 第 1），附註有寫。
      - 人均自付：平均每人 CHE（新臺幣）× 家庭自付比重 ÷ IMF WEO 的購買力平價（`PPPEX`，新臺幣／國際元，2023 年 13.52）。
    - **護理人員**：WHO 的 nursing and midwifery personnel；台灣用統計指標表4-3 的執業護理人員（護理師＋護士），助產人員很少，沒有加。2023 年每千人 8.0。
    - **護病比**：台灣常說的護病比是衛福部的「全日平均護病比」（一位護理人員一班照顧幾位住院病人；2019 年起醫學中心 ≤ 9、區域醫院 ≤ 12、地區醫院 ≤ 15）。國際上沒有各國一致的值班護病比資料庫（WHO、OECD 都沒有，只有 RN4CAST 這類研究在部分國家調查過），所以國際比較用每千人護理人員，指標說明裡有寫。
    - **病床**：WHO 的 hospital beds 是醫院的病床（含急性與慢性），不含診所；台灣用統計指標表4-2 的「醫院」每萬人口病床數。台灣的醫院病床含特殊病床（急診觀察床、血液透析床等），WHO／OECD 通常不算，所以可能偏高。2023 年每千人 5.9。

19. **教育資料**（`pipeline/topics/education.py`）：
    - 平均受教育年數用 UNDP 人類發展報告（`pipeline/sources/undp.py`），其他三項用世界銀行轉載的 UNESCO 統計研究所資料。兩者都沒有台灣。
    - 台灣（`pipeline/sources/moe.py`、`moi.py`）：
      - 平均受教育年數：教育部「教育統計指標之國際比較」，跟 UNDP 同一個公式。每版只有最近 6 年，接三個版本（2010–2023）；舊版只有 .ods，直接用 zipfile 讀 content.xml。
      - 高等教育粗在學率：教育部表 A2-5，18–22 歲（UNESCO 的定義），2008 學年度起。2021 年以前的版本用 18–21 歲、不含研究所，不能接起來。
      - 學年度以開始的那一年標示（114 學年度 = 2025–26 = 2025），跟世界銀行的韓國、芬蘭對得上。
      - 政府教育支出：教育部表 A3-1 的「政府經費」÷ GDP（預算數，不含公立學校自籌經費與私部門）；GDP 由總額 ÷ 總額占 GDP 比率反推。
      - 識字率：內政部依戶籍登記的 15 歲以上「不識字率」，用 100 減去。
      - 教育部表格的年份是國字（九七、一○○），表號每版可能會變。
    - **識字率很稀疏**：多數高所得國家已經不統計，其他國家也常十幾年才調查一次，每年只有 30–60 國有資料。沒有把舊值往後補，所以地圖上大多是灰色。

20. **觀光資料**（`pipeline/topics/tourism.py`）：
    - **只到 2020 年**：世界銀行轉載的 UN Tourism 資料（CC BY 4.0）到 2020 年就停了。
      - UN Tourism 自己的資料庫有到 2024 年（bulk download 的 zip），但使用條款只允許個人非商業使用，禁止轉載與製作衍生作品（https://www.untourism.int/copyright）。
      - OWID 的觀光資料來自同一個來源，而且聲明第三方資料仍適用原始授權，不能拿來繞過。
      - 要放 2021 年以後，得先向 UN Tourism 取得授權。
    - 旅客人次的口徑各國不同：有的只算過夜旅客，有的含當日來回的旅客，WDI 沒有統一（例如法國是全部旅客，泰國只算過夜）。
    - 觀光收入是國際收支的旅行收入加國際客運收入，跟 WDI 的定義相同。
    - 台灣：
      - 來臺旅客人次用交通部觀光署的資料（`pipeline/sources/taiwan_tourism.py`），UN Tourism 收錄的台灣數字也是這個。含華僑，不含持中華民國護照入境的人。
      - 觀光收入與出口總額用中央銀行國際收支（`pipeline/sources/cbc.py`）。旅行收入跟觀光署公布的觀光外匯收入相同；觀光署自己的觀光收入開放資料只到 2020 年。
    - 「旅客與人口比」用 WPP 年中人口自己算。

21. **飲食資料**（`pipeline/topics/diet.py`；咖啡、茶與可可見第 97 點）：
    - **兩套糧食平衡表接在一起**：FAOSTAT 的舊版（FBSH，1961–2013）與 2010 年起的新方法（FBS，目前到 2023 年），重疊 2010–2013 年。這裡 2009 年以前用舊版、2010 年起用新版，指標檔加 `methodBreak: 2010`，側欄折線圖與熱量來源圖在 2010 年畫垂直虛線。
      - 2010 年兩版的差距（新版 ÷ 舊版 − 1，各國中位數與 10–90 百分位）：熱量 +0.3%（−4%～+7%），世界的蛋白質 +6%、脂肪 −5%；動物性食物占熱量 −0.3 個百分點。
      - 個別食物差很多：乳品中位數 −8%（德國 258 → 152 公斤、印度 80 → 47 公斤），蔬菜 +7%（德國 90 → 162 公斤），糖 +12%，美國的植物油 30 → 19 公斤（熱量卻差不多）。都是方法不同，不是真的變化，所以指標說明與頁尾都提醒「2010 年可能跳一下」。
    - **新版的稻米是稻穀重量**：新版「Rice and products」每公斤的熱量只有舊版「Rice (Milled Equivalent)」的 0.63–0.66 倍，公斤數是舊版的 1.4–1.65 倍（2010 年，台灣、中國、印度、美國、孟加拉、世界）。乘 0.667（跟農業主題算自給率的碾米率一樣）換成白米當量後就接得上：2010 年世界新版 54.9、舊版 54.0 公斤，台灣 2023 年 40.7 公斤，農業部是白米 42.1 公斤。穀物合計也照樣把稻米換算。
    - **舊版的 CSV 不是 UTF-8**（Côte d'Ivoire 的 ô 是單一位元組 0xF4），`faostat.ENCODINGS` 指定 latin-1。
    - **新版沒有的國家**：日本、貝南、馬利、查德、多哥、中非、百慕達、多米尼克、汶萊在新版完全沒有（日本只有舊版到 2013 年），2010 年起是灰色，附註會說明。新版另外多了舊版沒有的剛果民主共和國、巴布亞紐幾內亞、卡達、敘利亞、利比亞等。古巴只到 2019 年、北韓只到 2018 年。
    - 「China」(351) 是大陸＋港＋澳＋台的合計，`faostat.rows()` 已經排除；中國用「China, mainland」(41)，香港、澳門、台灣（214，M49 158）各自一國。
    - **糧食平衡表算的是供給，不是攝取**：國內生產＋進口－出口－庫存變動，再扣掉飼料、種子、加工、損耗，平均到每個人，家戶與餐廳的浪費沒有扣掉，所以比膳食調查的攝取量高。熱量含酒類（FAO 的 Grand Total 含酒類）。
    - **台灣**：FAOSTAT 本身就有（China, Taiwan Province of，1961 年起），跟其他國家同一套方法，所以直接用 FAO 的。跟農業部《糧食供需年報》比（農業部的總計不含酒類，下表用「含酒類」的合計）：

      | | 2014 | 2018 | 2023 |
      |---|---|---|---|
      | 熱量（大卡/人/日）FAO | 2,934 | 2,960 | 2,958 |
      | 熱量 農業部（含酒類；不含酒類） | 2,759；2,694 | 2,882；2,815 | 2,802；2,738 |
      | 蛋白質（公克）FAO／農業部 | 93.7／81.3 | 97.2／88.5 | 98.8／89.8 |
      | 脂肪（公克）FAO／農業部 | 122.8／113.9 | 126.6／121.2 | 128.4／116.8 |

      - FAO 的熱量比農業部高 3–6%，蛋白質高 10–15%、脂肪高 4–10%；兩邊的趨勢一致（都是近十年持平）。
      - 2023 年的人均供給量（公斤，FAO／農業部）：肉類 91.5／87.2、豬肉 39.0／35.6、牛肉 9.0／7.6、禽肉 42.3／42.8、水產 30.4／31.7、白米 40.7／42.1、蔬菜 120.8／104.8、水果 94.4／115.7、糖 30.1／26.3（農業部含蜂蜜）、植物油 23.4／19.0。
      - 口徑不同、不能直接比的：小麥 52.0／36.2（農業部是麵粉重量）、乳品 57.8／49.1（農業部把奶粉以 1:8 還原成鮮乳）、酒類 38.4／31.0（農業部只列葡萄酒與啤酒）、薯類 15.4／25.9。
      - **蛋差最多**：FAO 14.1 公斤，農業部 22.0 公斤（112 年起每顆蛋以 60 克折算）。
      - 動物性食物占熱量：FAO 23.5%；農業部 26.2%（肉、蛋、水產、乳品、動物油脂，除以含酒類的 2,802 大卡）。
      - 農業部的數字只放在台灣的附註（各指標 2023 年），沒有混進地圖：其他國家都是 FAO 的方法，換成農業部的反而不能比。
      - 農業部的資料取得：data.gov.tw 上的「糧食平衡表(總表)」「糧食平衡表分類表」開放資料只到 2013–2015 年、之後沒有更新；最新的只有年報 PDF（農業部英文網站的 `BB_B01_112.pdf`，各年的全國糧食平衡表與每人每日營養供給量），pdftotext 要用 `-raw` 才讀得出表格。所以附註的數字是照年報抄進 `diet.py` 的 `MOA`、`MOA_SUPPLY`，年報出新版時要手動更新。
    - **營養不足人口比例**（FAOSTAT 糧食安全指標，item 210041）：
      - 是三年平均（例如 2022–2024），標在中間那一年，所以是 2001–2024 年。單年的值（210040）只有世界合計。
      - FAO 對低於 2.5% 的國家只公布「<2.5」（約 70 國，含日本、美國、韓國、中國大陸 2010 年以後），檔案裡記成 0，畫面上顯示「< 2.5%」，排名表與附註也會說明。CSV 裡是 0。
      - 是 FAO 依熱量供給與分配推估的模型值，台灣是 3.6–5.0%，比日本、韓國高，FAO 沒有另外說明原因。
    - 側欄的熱量來源把糧食平衡表的大類併成 8 類加「其他」：肉類（含內臟）、水產、乳品與蛋、油脂（植物油與動物油脂，跟農業部的「油脂類」同一個範圍）、糖與甜味劑、薯類、穀物、蔬菜水果；「其他」= 總熱量減這 8 類（乾豆類、堅果、油料作物、酒類、咖啡茶、香料等）。堆疊由下而上是動物性在下，配色沿用發電結構驗證過的相鄰順序。

22. **語言資料**（`pipeline/topics/language.py`、`pipeline/sources/cldr.py`、`glottolog.py`）：
    - **CLDR 的比例包含第二語言**，一國的比例加總常超過 100%，而且各國的來源、年份不一（CLDR 從普查、Ethnologue、Eurobarometer 等彙整）。有些數字跟一般印象差很多，例如比利時英語 59%（比荷語 55% 還高）、衣索比亞英語 43%、菲律賓西班牙語 31%，照原樣呈現。
    - 所以「主要語言」不用「會說的人最多的語言」，改成**官方語言（含事實上的官方語言）中會說的人最多的一種**，沒有官方語言的才取會說的人最多的；否則比利時、衣索比亞會變成英語。代價是前殖民地多半是英語、法語（例如馬利是法語，不是會說的人更多的班巴拉語），描述與頁尾都有說明。
    - **CLDR 只列出有一定人數的語言**，沒列出的國家當成無資料（灰色），不當成 0。
    - 同一種語言的不同文字（`zh`／`zh_Hant`、`sr`／`sr_Latn`、`pa`／`pa_Arab`）合併，比例取最大（是同一批人，不能相加），官方地位取最強的。
    - **阿拉伯語**：CLDR 把各地口語（埃及 `arz`、黎凡特 `apc`、馬格里布 `arq`、`ary`…）跟標準阿拉伯語 `ar` 分開列，子項目的「阿拉伯語」用 Glottolog 的 Arabic 分支（`arab1395`）合併，比例取最大。馬爾他語在 Glottolog 的 Arabic 分支裡，但一般不算阿拉伯語，排除。馬來語與印尼語（ISO 639-3 同一個巨集語言）合併成一項。
    - CLDR 的語言代碼對 Glottolog：兩個字母的換成三個字母（`supplementalMetadata.xml` 的 overlong 別名），巨集語言（`ar`、`zh`、`ms`、`fa`、`sw`…）換成 CLDR 指定的代表語言（`arb`、`cmn`、`zsm`…），因為 Glottolog 只收個別語言。
    - **名稱**：CLDR 繁中的語言名稱多是「英文」「阿拉伯文」這種書面語的叫法，這裡講的是會說的人，結尾的「文」改成「語」（「中文」除外）。華語、台語、客語、原住民族語用台灣的叫法。CLDR 沒有繁中名稱的 230 種（多是少數民族語言）在中文介面顯示英文名。
    - **台灣改用 109 年人口及住宅普查**（主計總處《109 年人口及住宅普查總報告》貳、普查結果提要分析，表 4-1）：6 歲以上本國籍常住人口，「主要使用語言」加「次要使用語言」的比例：國語 96.8%、閩南語 86.0%、客語 5.5%、原住民族語 1.1%。CLDR 49 的估計是華語 95%、台語 57%、客語 11%，台語差很多。
      - 普查的對象是 6 歲以上本國籍常住人口，使用人數是乘上 CLDR 的台灣總人口，是近似值。
      - 原住民族語是 16 族的合計，用 ISO 639-5 的 `fox`（台灣南島語）當代碼；「其他」（2.2%，含台灣手語、外國語言、不知或無）不列出。
      - 官方地位：國家語言發展法（2019）把各固有族群的語言與台灣手語都定為國家語言，CLDR 也把台語、客語標成官方，所以四種都標「官方」。
      - 普查報告的 PDF 用的字型沒有 Unicode 對照，`pdftotext` 讀不出中文，數字是對照頁面（第 24 頁）寫進 `TAIWAN_CENSUS` 的。
    - **Glottolog 把台灣的南島語標成中國**：阿美、泰雅、布農、排灣、魯凱、撒奇萊雅與台灣手語的 `Countries` 只有 `CN`，其他台灣南島語是 `CN;TW`。座標在台灣（含澎湖、蘭嶼）的語言一律把 `CN` 改成 `TW`，台灣從 14 種變成 21 種，中國少了 17 種。
    - 語言數只算 Glottolog 的一般口語、手語、皮欽語、混合語，不算已消失（AES = extinct）、重複條目（Bookkeeping）、資料太少（Unclassifiable）、人造語言；Glottolog 記錄的是語言的傳統分布，通常不含近代移民帶來的語言（美國 153 種，大多是原住民語言）。瀕危是 AES 的 threatened、shifting、moribund、nearly extinct。
    - **沒有做 Greenberg 語言多樣性指數**：要各國「母語」人口的比例，CLDR 的比例含第二語言，不能用；Ethnologue 有母語人數但不能轉載。

23. **疾病資料**（`pipeline/topics/disease.py`、`pipeline/sources/who.py`、`mohw_deaths.py`）：
    - **授權的取捨**：
      - WHO 的資料（GHO、GHE）是 CC BY 4.0，愛滋、結核病、瘧疾用世界銀行轉載的版本（也是 CC BY 4.0）。
      - **癌症發生率沒有放**。GLOBOCAN（IARC Global Cancer Observatory）的條款是保留所有權利，研究、教育等非商業用途、有限散布可以，大量轉載或較廣的散布要 IARC 書面同意（https://publications.iarc.who.int/Terms-Of-Use），而且只有 2022 年單一年份。IHME GBD 只限非商業使用（Free-of-Charge Non-commercial User Agreement），要註冊才能下載；本站雖然沒有商業用途，但資料檔放在公開的 GitHub 版本庫，別人再利用時授權會不清楚。所以改放 WHO GHE 的癌症死亡率（年齡標準化）。要放發生率得先取得 IARC 的書面授權。
      - NCD-RisC 自己網站的下載檔標示保留所有權利，而且沒有台灣；用 WHO GHO 轉載的同一組估計。
    - **GHE 的取得**：WHO 沒有 GHE 的批次下載檔，用 WHO 自己的 GHE 圖表背後的公開 OData API（`https://xmart-api-public.who.int/DEX_CMS/GHE_FULL`），一年查一次：全年齡的第一、二層死因，加上惡性腫瘤的年齡別死亡數與人口。每年約 1.4 MB、40 秒，24 年約 15 分鐘，快取在 `pipeline/.cache/who/`。
      - GHE 2023 版有 2000–2023 年每年的估計；WDI 轉載的 `SH.DTH.*` 只有 2000、2010、2015、2019–2021 年。
      - 涵蓋 183 國，不含台灣與人口很少的地區。世界值是 183 國加總。
      - GHE 已經把 R 碼等無法歸類的死亡依比例分配到各類，三大類加起來就是全部死亡。
    - **首要死因**：GHE 第二層死因（心血管疾病、癌症、感染與寄生蟲疾病、呼吸道感染…）中死亡數最多的一類。
      - 2000–2023 年只出現 7 類：心血管疾病、感染與寄生蟲疾病、癌症、呼吸道感染（COVID-19：2020 年 18 國、2021 年 45 國）、事故傷害（2004 年斯里蘭卡海嘯、2008 年緬甸風災、2010 年海地地震、2000–2004 年的阿聯）、蓄意傷害（2012–2017 年敘利亞）、營養不良（2011 年索馬利亞）。
      - 出現新的一類時資料管線會報錯，要在 `disease.py` 的 `TOP_CAUSES` 與 `disease.ts` 一起加。
      - 用第二層而不是單一疾病（缺血性心臟病、中風、肺癌…）：跟台灣「惡性腫瘤是首要死因」的說法一致，類別少也比較好讀。
    - **癌症死亡率**：GHE 只有粗死亡率，用年齡別死亡數與人口自己做年齡標準化（WHO 2000–2025 世界標準人口，85 歲以上合併成一組）。2023 年世界 102、日本 90、南韓 79、美國 95（每十萬人）。
    - **台灣**：衛福部死因統計資料集的「國際疾病分類標準之詳細分類」（每年、男女、ICD-10 碼、24 個年齡組；https://dep.mohw.gov.tw/DOS/np-6602-113.html）。
      - ICD-10 依 WHO GHE 方法說明的對照歸到 GHE 的第二層（`mohw_deaths.GHE_ICD10`，例如糖尿病腎病變 E1x.2 算腎臟病、X41–X45 意外中毒算藥物與酒精使用、U07 COVID-19 算呼吸道感染）。
      - R 碼（嬰兒猝死 R95 除外）與司法相驗中（ZZZ）不算進分母（2023 年占 5.3%），效果跟 GHE 的比例分配相同。
      - 2023 年：癌症 53,126 人（跟衛福部公布的相同）、心血管疾病 46,360 人，首要死因是癌症（2008 年起每年都是）；慢性病 78.3%、傳染病等 15.9%、傷害 5.8%。
      - 2007 年以前是 ICD-9，沒有轉換，所以從 2008 年開始。
      - **30–70 歲四大慢性病死亡機率**：照 WHO 的公式（各五歲年齡組 5q = 5M ÷ (1 + 2.5M)，機率 = 1 − Π(1 − 5q)），人口用 WPP 的年齡別年中人口（2023 年台灣 2,332 萬，內政部 2,334 萬）。抽查：2011 年算出 12.8%，國健署公布 13.0%（data.gov.tw「100年30-70歲四大非傳染病之死亡機率」），差在人口分母。2023 年 11.7%。WHO 會把不明原因的死亡分配進來，所以台灣的值可能略低一點。
      - 癌症標準化死亡率用衛福部統計指標表7（同樣用 WHO 2000 年世界標準人口）：2023 年 115.4。
      - 結核病：統計指標表5 的結核病確定病例（新案）÷ 國民醫療保健支出表1 的年中人口（內政部）；2022 年 6,576 人、每十萬 28.2，跟疾管署年報相同。WHO 的發生率是含未通報個案的估計值，台灣的是通報數。疾管署開放資料平台（od.cdc.gov.tw）從這裡連不上，所以用衛福部的表，只有 2000、2005、2010 與 2015 年以後每年。
      - 糖尿病（國健署 2017–2020 年國民營養健康調查 11.1%，沒有年齡標準化）、肥胖（台灣標準是 BMI ≥ 27，WHO 是 ≥ 30）、愛滋（疾管署只有通報的存活感染者人數，2024 年底約 3.6 萬）、瘧疾（1965 年根除，只有境外移入）沒有跟國際定義一致的數字，地圖上留空，附註寫官方數字。
    - 愛滋：UNAIDS 不公布多數高所得國家（美、日、韓、西歐）的盛行率，所以地圖上很多灰色。瘧疾只有流行國家有數值。

24. **住宅資料**（`pipeline/topics/housing.py`）：
    - **住宅類型沒有全球的開放資料**。查過的來源：
      - Eurostat EU-SILC（`ilc_lvho01`）：34 國，2003–2025 年，以人計算（住在公寓的人口比例）。
      - OECD 可負擔住宅資料庫的 HM1.5（`pipeline/sources/oecd_ahd.py`）：補上澳洲、加拿大、智利、哥倫比亞、哥斯大黎加、日本、韓國、墨西哥、美國，以及英國脫歐後的 2021 年。這些國家是各國普查或住宅調查，以有人居住的住宅計算；多半隔 2–5 年一次（美國 2 年、日本 5 年），墨西哥、哥倫比亞只有一次普查。
        - 歐盟國家的數字是 OECD 自己用 EU-SILC 算的，只用來補 Eurostat 沒有的國家與年份（`add_after`），同一國不混用兩個來源的同一年。
        - 紐西蘭的雙併與公寓合在「未分類」，算不出公寓比例，不收；智利、哥倫比亞、墨西哥的獨棟含雙併（附註會寫）。
      - 聯合國統計司的普查住宅表（Demographic Yearbook）分成傳統住宅、半永久、非正式等，不分公寓與透天。
      - IPUMS International 有各國普查的微觀資料，但要註冊帳號，使用條款也禁止再散布，所以沒有用。DHS 只有地板、屋頂材質，沒有住宅類型。
    - **台灣官方統計只依樓層分類**，沒有「透天、公寓、華廈、大樓」：
      - 房屋稅籍（內政部不動產資訊平台）：1–3、4–5、6–10、11–15、16 層以上；人口及住宅普查：平房、2–5、6–12、13 樓以上；家庭收支調查：平房、2–3、4–5、6 層以上。
      - 「公寓（5 樓含以下無電梯）、華廈、住宅大樓、透天厝」是實價登錄的建物型態，是交易筆數，不是住宅存量。
      - 所以用房屋稅籍、4 層以上算公寓（`moi_realestate.py`）：2025 年第 4 季 57.0%。家庭收支調查 2025 年住在 4 層以上建築的家庭是 57.9%（第 8 表），兩者接近。4–5 層的透天厝會被算成公寓，可能略為高估；側欄依樓層列出組成。
      - 房屋稅籍含空屋，跟歐洲（以人）、OECD（有人居住的住宅）口徑都不同，附註有寫。
      - 下載：「統計資訊主題項目下載區」的 CSV 是 `E4041?m=csv&k=K02&n=T16`，直接 GET 就好；「統計資訊整合項目下載區」（E3030）要帶 anti-forgery token、用 multipart 送出表單，而且只有總數、沒有樓層別。
    - **自有住宅率**：Eurostat `ilc_lvho02`（37 國，以人計算）；OECD HM1.3 補 9 國（以戶計算），有房貸與無房貸相加（韓國、土耳其兩者合在一起）。
      - 日本只出現在 HM1.3.1 的圖表，沒寫年份，而且約 84%，跟總務省 2023 年住宅・土地統計調查的持ち家率 60.9% 差很多，不收。
      - 台灣用家庭收支調查第 24 表（`fies.py`），2010 年起：之前的「自有」含不住在一起的配偶、父母或子女擁有的住宅（2007 年 88.14% 是最高點），不能接起來。2025 年 83.95%（畫面上四捨五入成 84.0%）；2020 年普查是 78.6%（6,294,206 ÷ 8,007,809 戶），調查方式不同。
    - **平均每戶人數**：UN DESA 家戶規模資料庫 2022 版（`un_households.py`），187 國，但年份零散，很多國家的最新一年很舊（中國 2000、巴西 2010、德國 2011）。
      - 同一國同一年有好幾個來源時（普查同時在 DYB 與 IPUMS），依普查（DYB、IPUMS）、歐盟勞動力調查（LFS）、DHS、MICS 的順序取一個。
      - 參考日期有日期格式也有「19/10/2015」字串；科索沃的代碼是 412，不是 ISO 代碼。
      - 歐洲改用 EU-SILC 的逐年資料（`ilc_lvph01`，到 2025 年），EU-SILC 開始之前的年份才用聯合國的；附註會寫從哪一年換來源。
      - 台灣用家庭收支調查第 26 表：2024 年 2.78 人、2025 年 2.69 人。2025 年的家庭戶數從 926 萬跳到 976 萬，報告沒有說明原因。
    - **居住擁擠率、住房負擔過重率**只有 EU-SILC（`ilc_lvho05a`、`ilc_lvho07a`，37 國）。OECD 的 HC2.1、HC1.2 附錄只有依權屬、所得分組的數字，沒有全體的逐年值，所以沒補；台灣也沒有同定義的統計。
    - **都市貧民窟人口比例**：World Bank 轉載的 UN-Habitat 估計（`EN.POP.SLUM.UR.ZS`），194 國，2000–2022 年每兩年一次；2009、2019 年只有一兩國，不收（時間軸只有偶數年）。2022 年起高所得國家也有估計值，多半接近 0。沒有台灣。
    - **年份零散**：每個指標各自設 `latestWithin`（住宅類型、自有、每戶人數 10 年，擁擠與負擔 3 年），見第 3 節。2024 年的地圖上，住宅類型 44 國裡有 8 國用的是之前的年份，每戶人數 146 國裡有 111 國。
    - Eurostat 的 TSV 數字後面可能有旗標（`b` 序列中斷、`u` 可信度低、`p` 初步值），照收；`EU27_2020`、`EA20` 這類合計、希臘 `EL`、英國 `UK`、科索沃 `XK` 在 `pipeline/sources/eurostat.py` 轉換。

25. **海拔資料**（`pipeline/topics/elevation.py`、`pipeline/sources/gmted.py`、`wikidata.py`、`moi_dtm.py`）：
    - **DEM 的選擇**：USGS GMTED2010（公有領域）是陸地的 DEM，湖泊是水面高度（裏海 −27 m、貝加爾湖 449 m）。NOAA ETOPO 2022 也是公有領域，但湖泊是湖底（貝加爾湖底約 −1,186 m），而 1:50m 國界把湖泊算在國土裡，會拉低俄羅斯等國的平均海拔與最低點。
    - 用 30 角秒（赤道約 1 km）的三份：平均值（mn30，北緯 84° 到南緯 90°）、最大值（mx30）、最小值（mi30）。最大、最小值只到南緯 56°，格陵蘭沒有（值是 0），這些地方用平均值。三個 zip 共約 760 MB，是 ESRI 網格，rasterio（GDAL 的 AIG 驅動）可以直接讀；全部約 2 分鐘（機器忙時 5–10 分鐘）。
    - **海洋是 0、不是 nodata**：三份都是 0 的格子當成海。
    - **面積加權**：每格乘 cos(緯度)，高緯度的格子比較小。
    - **國家範圍**跟人口主題的框選網格一樣（`population_grid.country_shapes()`）：法國海外省、荷蘭的加勒比海三島、克里米亞、西撒哈拉依聯合國的劃分拆開；陸地少於約 20 km² 的國家（梵蒂岡、摩納哥）不輸出，共 240 個國家/地區。
    - **沿海低地**：低於 5 m、而且跟海相連。整張網格（北緯 84° 到南緯 56°，約 7 億格）把「低於 5 m 或是海」的格子做 4 連通的區塊標記（scipy 的 `ndimage.label`，標記陣列約 3 GB），含 2 萬格以上海的區塊才算（黑海只靠窄海峽相連也算到）。不跟海相連的窪地（裏海窪地、蓋塔拉窪地、吐魯番、死海）不算。荷蘭 54.6%、台灣 4.0%、孟加拉 4.4%。SRTM 量的是地表（含樹冠與建築），三角洲的植被、聚落會讓地面看起來比較高，實際的低地應該更多。
    - **坡度**：平均值網格的中央差分（東西向依緯度換算成公尺）。緊鄰海的格子不算，否則海（0）跟海岸之間會算出假的陡坡。1 km 網格比實際平緩，只能各國互相比較。
    - **最高點**：網格會把山頂平均掉（玉山在最大值網格是 3,930 m、平均值網格約 3,570 m），所以名稱與標高用 Wikidata 的各國最高點（P610）與最低點（P1589），SPARQL 一次查完。採用條件：
      - 點附近（約 5 km）有這個國家的陸地，而且附近 DEM 的最大值至少是標高的 75%（庫克山 3,724 m 在 GMTED 只有 3,172 m；南緯 56° 以南只有平均值網格，文森峰放寬到 60%）。
      - 全國的 DEM 最高格不能比它高 150 m 以上，除非那一格就在這座山（DEM 的尖峰雜訊：查亞峰 4,884 m，DEM 有 5,129 m）。
      - 不採用時用 DEM 的最高格、不寫名稱。DEM 比 Wikidata 高的國家，附註寫出 Wikidata 的值：以色列 2,809 m（1:50m 的國界把黑門山頂劃進來，Wikidata 是梅隆山 1,208 m）、科威特 310 m（西南部有比 Mutla Ridge 140 m 高的無名高地）。
      - 其他不採用的例子：荷蘭的錫納里山（在加勒比海的沙巴，已經拆出去）、澳洲的莫森峰（赫德島，1:50m 沒有形狀）、澳門的「1,706 m」（Wikidata 的錯值）。
    - **最低點**：靠海的國家預設是海平面 0 m，內陸國用 DEM 的最低格（不寫名稱）。Wikidata 的點：
      - 有標高的：點附近有這個國家的陸地（或點在海上、國家靠海），附近的 DEM 也夠低才採用。
      - 高於海平面的不能比全國 DEM 的最低格高太多：河流的座標常在上游（不丹的 Drangme Chhu 座標處約 890 m，實際最低處約 100 m）。
      - 低於海平面的大湖：裏海的座標在湖中央，改在 3° 範圍內找這個國家接近湖面高度的陸地（俄羅斯 −28 m）。
      - 沒填標高的圩田、窪地（荷蘭的 Zuidplaspolder、哈薩克的卡拉吉耶窪地）用附近平均值網格的最低格。最小值網格在水邊常有幾十公尺的假低點，荷蘭會變成 −41 m。
      - 敘利亞的加利利海（−214 m）找不到夠低的國內陸地，維持海平面。
    - **中文名稱**依序用 zh-tw、zh-hant、zh-hk、zh。只有 zh 的多半是簡體（杜富尔峰），用 `wikidata.S2T` 轉成繁體；這張表只列了實際出現的 28 個字，Wikidata 的名稱有變時要補。
    - **台灣交叉比對**：內政部 100 公尺數值高程模型（民國 94–95 年航測，台灣本島與澎湖，政府資料開放授權）：

      | | 內政部 100 m DEM | GMTED2010 |
      |---|---|---|
      | 平均海拔 | 766 m | 785 m |
      | 陸地面積 | 36,217 km² | 35,709 km² |
      | 海拔 1,000 m 以上 | 31.7% | 32.6% |
      | 最高格 | 3,933 m | 3,930 m |

      - 玉山主峰的官方標高是 3,952 m；內政部國土測繪中心 2024 年 5 月實測 3,952.433 m。地圖與側欄用 3,952 m（Wikidata 的值）。
      - 內政部 DEM 的清單是 data.gov.tw（資料集 7507）的 CSV，每個縣市一個 zip。檔名是中文，下載網址要 URL 編碼。圖幅含海面（高度 0），所以 h > 0 才算陸地；相鄰縣市的圖幅重疊，同一個坐標只算一次。
      - 平均海拔與 1,000 m 以上的占比附註在台灣的側欄。

26. **移民與難民**（`pipeline/topics/migration.py`、`sources/undesa_ims.py`、`unhcr.py`、`nia.py`、`ocac.py`）：
    - **UN DESA 的「移民」是存量**：住在出生國以外的人，年中，1990–2020 每 5 年加上 2024 年，不是每年移入的人數。沒有出生地統計的國家改用國籍（外國人），資料類型以 C 開頭的國家（台灣、日本、韓國、波灣國家…）附註會說明，這些國家已經歸化的人不算移民。
    - **台灣在 DESA 裡**（「China, Taiwan Province of China」，代碼 158），目的地與來源都有：2024 年移入 113.6 萬人（印尼、越南、中國大陸、菲律賓、泰國），依國籍統計，含大陸地區人民約 25 萬人（多是配偶）。所以地圖直接用 DESA，跟其他國家同一個定義與年份。
      - 移民署的外僑居留人數（持外僑居留證、不含大陸與港澳）2025 年底 102.9 萬人，寫在附註對照（內政部統計查詢網 funid c0930102；`ym=8500` 起查才會給到最新一年）。
      - 僑民（台灣出生、住在國外）DESA 2024 年是 83.3 萬人，美國約 40 萬最多；僑委會的「海外臺灣僑民」含在海外出生的後代，2025 年底 210.8 萬人（data.gov.tw 9732），定義不同，只放附註。
    - DESA 的 Table 1 一列是 (目的地, 來源)，兩邊都可能是區域、所得組（代碼 ≥ 900），只收國家與全世界；來源不明的「Other South／North」只算進總數，不畫弧線。流向檔的總額用全世界那一列（含來源不明），所以前 15 名加起來不到 100%。
    - **UNHCR**：用 refugees（職權下的難民）加 oip（其他需要國際保護的人，2018 年起，主要是在拉丁美洲的委內瑞拉人，2025 年約 720 萬）。沒有算尋求庇護者、境內流離失所者，也沒有 UNRWA 照顧的巴勒斯坦難民（約 600 萬人，在 UNHCR 的另一個端點）。
      - API 的收容國要用 `coa_iso`：`coa` 是 UNHCR 自己的代碼（埃及是 ARE）。數值有時是字串（"0"、"-"）。
      - 年份清單會先列出還沒有資料的未來年份（2026、2027），`latest_year()` 實際查一次，空的不留快取。
      - 台灣不在 UNHCR 的統計裡（不是《難民公約》締約國，也還沒有難民法），附註會寫。
    - 每千人收容的難民用 WPP 2024 的人口，2024 年以後是推估值。黎巴嫩 2024 年每千人 131 人最高。
    - 移民的年份只有 8 個：時間軸拖到中間沒有資料的年份時用最接近的一年，播放時跳到下一個有資料的年份（`app/options.ts` 的 `pickYear`、`TimeSlider`）。
    - 僑匯（移民、移工匯回母國的錢）在國際援助與僑匯主題（第 74 點），兩邊頁尾的說明互相指到對方；雙邊的僑匯沒有開放授權的資料，那邊沒有弧線，指到這裡的僑民去向。

27. **宗教**（`pipeline/topics/religion.py`、`sources/pew.py`、`moi_religion.py`）：
    - **Pew 的條款只允許發布摘錄**：使用條款第 13 條（資料集）允許修改與衍生，但轉載、發布「只限摘錄，不能全部或大部分發布」，並要附上「Pew Research Center bears no responsibility for the analyses or interpretations of the data presented here」（頁尾的附註有）。
      - 七大類 × 201 國 × 2 年的比例就是整份資料，所以**沒有做「每種宗教的比例」子項目**，只放主要宗教（衍生的類別）、主要宗教的比例、無宗教信仰比例、Pew 自己的宗教多樣性指數（RDI）。
      - 要加每種宗教的比例，得先取得 Pew 的書面同意。開放授權、涵蓋全球的替代來源目前沒有：World Religion Project（Maoz & Henderson）只到 2010 年、沒有明確授權；UN 人口普查的宗教表很多國家不問宗教（美國、中國、法國）。
      - 下載檔在 Pew 的功能頁面上（`Religious-Composition-2010-2020-dataset.zip`），不必登入；資料集頁面的下載要帳號，沒有用。
    - 台灣在 Pew 裡：其他宗教（民間信仰、道教）52%、無宗教 23%、佛教 19%、基督宗教 6%（2020 年），主要宗教是「其他宗教」，全世界只有台灣一國；多樣性指數 7.46，排第 3（新加坡、蘇利南之後）。
    - 內政部宗教統計只有登記的寺廟（2025 年底 12,397 座，道教 9,824、佛教 2,277）與教會（2,855 座），民間信仰多半沒有登記入教，沒有各宗教的信徒比例，只放附註。統計查詢網 funid c0210101（寺廟，依宗教別要加 `codspc1`）、c0210201（教會）。
    - Pew 的科索沃用 M49 的 412，`countries.from_numeric()` 已經改成 XKX；海峽群島（830）沒有 ISO 代碼，不收。

28. **貧富差距**（`pipeline/topics/inequality.py`、`sources/wid.py`、`fies.py`）：
    - 吉尼係數與極端貧窮是世界銀行 PIP 依各國家庭調查算的，有的量所得、有的量消費，年份零散，用 `latestWithin: 10`。國際貧窮線 2025 年 6 月起是每天 3 美元（2021 年購買力平價），代碼 `SI.POV.DDAY` 不變。
    - **WID 的授權是 CC BY-NC-SA 4.0**（不是 CC BY 4.0）：wid.world 各頁的授權連結是 by-nc-sa，舊的「Creative Commons Attribution 4.0」說明在網頁原始碼裡被註解掉了，整包下載的 README 沒寫授權。本站非商業，照用；從 WID 算出來的指標檔（所得份額、財富）依「相同方式分享」也是 CC BY-NC-SA 4.0，頁尾標示。
    - **WID 的整包下載**（約 890 MB，解壓 6.9 GB，每國一個分號分隔的 CSV）：只抽需要的變數，存成 `.cache/wid/extract-<雜湊>.json`，約 40 秒。網站用到的所有 WID 變數列在 `wid.ALL`（貧富差距與存款財產兩個主題共用一份快取）。區域與次國家（`US-CA`、`XN-MER`）不收，`WO` 是全世界，`KS` 是科索沃。
    - 所得份額用 `sptincj992`：稅前國民所得、20 歲以上、夫妻平分。WID 結合稅務資料，最高所得比家庭調查完整，所以台灣的最高 10% 份額（2024 年 48.2%）比用家庭收支調查算的印象高很多。
    - 台灣的吉尼係數：家庭收支調查第 5 表（每戶可支配所得 ÷ 每戶人數，1981 年起），2025 年 0.272，跟 PIP 的「每人所得」比較接近。新聞常引用的是第 4 表以「戶」計算的 0.341、五等分位 6.17 倍，寫在附註。
    - 台灣不在 PIP 裡，極端貧窮留空、附註說明。

29. **性別平等**（`pipeline/topics/gender.py`、`sources/oecd.py`、`dgbas.py`）：
    - **薪資差距用 OECD，不用 ILO**：ILOSTAT 的 `EAR_GGAP_OCU_RT_A` 有 124 國，但每國的來源、時薪或月薪不同，同一國前後年可以差好幾個百分點（法國 2023 年 10.9%、2024 年 5.4%），阿富汗 2020 年是 −125%，日本、德國又沒有。OECD 是全職受僱者的中位數，約 45 國，定義一致。各國最新一年不同（2022–2025），用 `latestWithin: 4`。
    - 台灣的薪資差距：主計總處受僱員工薪資調查的男女每月總薪資與工時（nstatdb A046201010、A046401010），平均時薪差距 = 1 −（女總薪資 ÷ 女工時）÷（男總薪資 ÷ 男工時），2024 年 15.9%，跟勞動部同酬日的 15.8% 一致（差在時薪的四捨五入）。勞動部另外算過依中位數的差距（2023 年 12.3%），比較接近 OECD 的口徑，寫在附註。
    - 女性勞參率：ILO 模型估計（`SL.TLF.CACT.FE.ZS`）；台灣用人力資源調查（nstatdb A040109010，`codspc0=0,3` 是合計、男、女），今年還沒結束的不收。
    - 國會女性比例：IPU（`SG.GEN.PARL.ZS`）；台灣用中選會的歷屆立委當選人（第 7 屆起 113 席），每屆從選舉那年起算，2022–2023 年用性平處《性別圖像》的 42.9%（補選後）。第 4–6 屆（225 席）的女性人數沒有找到可靠的官方數字，所以從 2008 年開始。
    - GII：UNDP 人類發展報告（`gii_年`）。台灣用性平處依同一公式算的值：2019 年 0.045、2021 年 0.036、2022 年 0.041、2023 年 0.040（173 國中第 13 名）。《性別圖像》的 PDF 字型沒有 Unicode 對照，數字是把頁面轉成圖片讀的（2020 年的值沒有找到）。

30. **薪資與工時**（`pipeline/topics/wages.py`、`pipeline/sources/ilostat.py`、`pwt.py`、`dgbas_wages.py`、`mol.py`、`cbc_fx.py`）：
    - **ILOSTAT 的下載**：用 rplumber API（`https://rplumber.ilo.org/data/indicator/?id=<資料集>&format=.csv&type=code`），一次下載整個資料集。
      - 沒帶 User-Agent 時回 HTTP 200，但內容是空的（`common.download()` 已經自帶 User-Agent）。ilostat.ilo.org 的批次下載頁有 Cloudflare 驗證，舊的 webapps.ilo.org 批次檔已經 404。
      - 資料集代碼改過：舊的 `EAR_4MTH_SEX_CUR_NB_A` 已停用，平均月薪是 `EAR_EMTA_SEX_CUR_NB_A`、最低工資 `EAR_INEE_CUR_NB_A`、每週工時 `HOW_TEMP_SEX_NB_A`。可用的代碼查 `https://rplumber.ilo.org/metadata/toc/indicator?lang=en&format=.csv`。
      - 年資料每個國家、每年只有一個來源（ILOSTAT 已經挑好主要序列），不必自己挑。
    - **只用各國的調查值，不用模型估計**：ILO 另有每週工時的模型估計（`HOW_2EMP_SEX_NB_A`，188 國都有），但口徑跟調查值不同（德國 2023 年模型 29.7 小時、調查 33.5 小時；美國 36.4、37.8），混在一起不能比。世界平均（X01）只有模型估計，ILOSTAT 自己也把它放在調查值的資料集裡，所以當對照線，指標說明有寫。
      - ILOSTAT 沒有日本、中國的每週工時調查值，地圖上是灰色；說明請使用者改看每年工時（PWT 有）。
    - **各國口徑不一**：月薪有的來自勞動力調查（美國、法國、墨西哥、印度）、有的來自歐盟 SILC（德國）或廠商調查（韓國、日本），有的只算民間部門、都市或全時員工。日本是工資構造基本調查的「所定內給與」（2021 年 30.74 萬日圓，不含獎金與加班費），所以只適合比大致高低，說明與頁尾都有寫。
    - **年份零散**：月薪與最低工資的 `latestWithin` 是 3 年（金額會隨物價、匯率變），每週工時 5 年。時間軸的結尾依「當年實際有資料的國家數」截（`wages.span()`），不是依 latestWithin 年內的國家數，否則最低工資會延伸到只有一國公布的 2026 年。2023 年：月薪 129 國、最低工資 168 國、每週工時 143 國、每年工時 130 國。
    - **國際元**：ILOSTAT 換算國際元用的是世界銀行的「民間消費」購買力平價（`PA.NUS.PRVT.PP`，逐年的值，跟 ILOSTAT 的數字完全一致），不是 GDP 的購買力平價（2021 年韓國 961 對 830 韓圜、日本 109 對 99 日圓）。世界銀行 2022 年以後的值是 2021 年 ICP 的基準乘上該國與美國消費者物價漲幅的比（用 IMF 的 CPI 重推，各國中位數誤差 0.1%）。
    - **ILOSTAT 的錯誤**（2026 年 10 月的版本，`wages.py` 開頭列出，ILOSTAT 修正後可以拿掉）：
      - 柬埔寨的最低工資本來就用美元訂（成衣、製鞋業，2023 年 200 美元），ILOSTAT 當成瑞爾換算，只剩 0.05 美元。改成原本的美元金額，國際元乘回 ILOSTAT 用的匯率，附註有寫。
      - 厄瓜多、烏拉圭 2024 年的最低工資是月薪除以 12（39.2 美元、1,855.7 披索），不收。
      - 馬爾他 2000–2008 年的月薪只有 2–10 美元（是時薪），埃及 2008、2009 年只有 13、43 美元（前後年 130–200 美元），不收。
      - 黎巴嫩 2020–2022 年的最低工資用 1 美元 = 1,507.5 鎊的官方匯率換算（市場匯率早已跌到幾萬鎊），2022 年會變成 1,725 美元、比日本還高，美元值不收、國際元保留，附註有寫。
      - 用官方匯率換算、跟市場匯率差很多的：伊朗的最低工資 1995–2001、2018–2023 年（1 美元 = 1,750、42,000 里亞爾，2023 年變成 1,264 美元、比韓國高），黎巴嫩 2020–2023 年；美元值不收、國際元保留，附註有寫。阿根廷、埃及、奈及利亞的官方匯率也比平行市場高（最多約 2 倍），照收。
      - 敘利亞的最低工資 2013–2022 年都是 9,765 鎊（2021 年起依命令已調到 71,515、92,970 鎊），2010 年以前又用舊的 11.2 鎊匯率，整個不收，附註有寫。
      - 印尼 2023 年起從各省最低工資的中位數改成雅加達的（最高的一省），2023–2024 年不收；茅利塔尼亞 2004–2007 年用新幣的匯率換算舊幣（高 10 倍）、盧安達 2007 年以前的 56,299 法郎（法定是日薪 100 法郎），不收。
      - 把時薪、週薪或年薪當成月薪的：瑞典 1993、加拿大 1993 年以前、澳洲 1995 年以前、曼島 1997、牙買加 2001–2002、薩摩亞 2018、索羅門群島 2005、亞美尼亞 1993、烏拉圭 1996 年，不收。南非 2016–2019 年是中位數（夾在平均數的序列裡，低 2.6 倍），不收；新加坡、香港、澳門等本來就是中位數的，依 ILO 的註記代碼自動加附註。
      - 每週工時：白俄羅斯 2025 年 3.88、獅子山 2003 年 7.95 小時（小數點錯誤），不收。ILOSTAT 標成「不可靠」（`U`）的列一律不收（例如馬爾他 2021 年的月薪跳 53%）。
      - 國際元 ÷ 美元（= 匯率 ÷ 購買力平價）超出 0.25–10 倍的國際元不收：匈牙利 1995、2002 年，塞爾維亞 2002–2012 年，捷克 1996 年，薩爾瓦多 1998–2000 年。清掉之後 98% 的比值在 0.68–4.7 之間。
    - **PWT 的每年工時跟 OECD 對照**：2023 年 41 個 OECD 國家差距都在 3% 以內，但墨西哥整條序列偏低（2023 年 PWT 1,629 小時、OECD 2,228 小時，比美國還少，可是每週工時是 42.5 對 37.8 小時），哥倫比亞 2021 年起高 10%。最新一年跟 OECD 差 5% 以上的國家改用 OECD 的序列（`pipeline/sources/oecd_hours.py`，OECD 的 Average annual hours actually worked，OECD 資料條款），附註有寫。
    - **瑞士的最低工資排第 1**：ILOSTAT 用的是日內瓦州的最低工資（瑞士沒有全國的），保留並加附註。
    - **很低的最低工資是真的**：盧安達（1974 年訂的日薪 100 法郎）、蒲隆地、喬治亞（每月 20 拉里）多年沒調整，蘇丹是貨幣崩跌，都照原樣呈現。瑞典、丹麥、挪威、芬蘭、義大利、奧地利、新加坡沒有法定最低工資，是灰色。
    - **台灣**（ILOSTAT 沒有台灣，台灣不是 ILO 會員）：
      - **平均月薪**：主計總處薪資及生產力統計的工業及服務業受僱員工每人每月「總薪資」（nstatdb `A046201010`；廠商調查，含外籍與部分工時員工，不含農林漁牧業與公共行政）。ILOSTAT 對不含加班費或不定期獎金的序列會另外標註（`T34:2128`），表示預設是含的，所以用總薪資，不用經常性薪資（2025 年 63,383 元對 47,885 元，差 32%）。
        - 抽查：主計總處公布 114 年本國籍全時員工全年總薪資平均 806,448 元，比全體受僱員工高 45,816 元，換算全體受僱員工每月 63,386 元，跟 nstatdb 的 63,383 元一致（差在四捨五入）。
      - **美元**：中央銀行 `BP01Y01` 的新臺幣對美元年平均匯率（2024 年 32.108、2025 年 31.166）。
      - **國際元**（`wages.taiwan_ppp()`）：台灣不在世界銀行的資料裡，2021 年以前用 PWT 11.0 的家庭消費價格水準（`pl_c × xr ÷ 美國的 pl_c`，跟世界銀行的民間消費 PPP 同一個概念，2017、2019、2021 年各國的中位數差距 1.4–1.9%），2022 年起照世界銀行的方法，用 IMF WEO 的消費者物價年增率（台灣 ÷ 美國）往後推。2025 年 1 國際元 = 14.53 新臺幣。
        - IMF 的 `PPPEX` 是整體 GDP 的購買力平價（2025 年 13.65），比民間消費的低 6–10%，直接用會高估台灣（2025 年月薪會是 4,642 國際元，而不是 4,362），所以只寫在附註裡對照。
        - PWT 2022、2023 年的消費 PPP 跟世界銀行差很多（2023 年日本 +12%、德國 +10%），是兩邊推算非基準年的方法不同，所以 PWT 只取到 2021 年的基準。
      - **每週工時**：人力資源調查的「就業者之平均每週主要工作時數」（政府資料開放平臺資料集 37969，一年一個 XML，2015 年起；欄名與「總計」列的寫法每年不一樣）。是家戶調查、所有就業者（含自營作業者與雇主）、主要工作，跟 ILOSTAT 多數國家的口徑相同。每個月只問一週的工時，遇到連假、颱風或疫情會影響當年平均，起伏較大（2015 年 43.4、2021 年 39.3、2024 年 38.9、2025 年 40.4 小時）。
        - nstatdb 沒有這張表。薪資及生產力統計也有工時（2025 年每月 168.9 小時），但只算工業及服務業的受僱員工，口徑不同，不用。
      - **最低工資**：勞動部沒有歷年基本工資的開放資料檔，照「基本工資之制訂與調整經過」（1956 年起）與最低工資審議的新聞稿抄進 `mol.py` 的 `CHANGES`；2025 年起改稱最低工資。取每年 7 月 1 日適用的金額，跟 ILOSTAT 對年中調整國家的取法一致（法國 2023 年 1 月 1,709、5 月起 1,747 歐元，ILOSTAT 取 1,747；德國 2022 年取 7 月起的時薪 10.45 歐元）。2024 年 27,470 元＝855.6 美元、1,872 國際元；2025 年 28,590 元、2026 年 29,500 元因為其他國家多半還沒公布，時間軸截到 2024 年，附註有寫。勞動部公告新金額時要手動補一列（2027 年的 30,900 元已經列入，到 2027 年 7 月才會用到）。
      - **每年工時**：PWT 本身有台灣（2023 年 2,031.6 小時，含自營作業者）。對照：主計總處受僱員工每月工時 × 12 = 2,019.6 小時（勞動部國際比較用的就是這個算法，例如 2018 年公布 2,033 小時＝169.4 × 12），附註有寫。
    - **授權**：ILOSTAT、PWT 11.0 都是 CC BY 4.0（見第 12 點）。主計總處（https://www.stat.gov.tw/cp.aspx?n=3164）、勞動部（https://www.mol.gov.tw/2578/2584/3276/）、中央銀行（https://www.cbc.gov.tw/tw/cp-307-36676-DE020-1.html）的政府網站資料開放宣告都採政府資料開放授權條款第 1 版；人力資源調查的資料集 37969 也標示同一條款。IMF WEO 沿用收入主題的判斷（註明出處）。
    - **沒有用的**：ILO 的每週工時模型估計（口徑不同，見上）；IMF 的 GDP 購買力平價（概念不同，只放在附註）；OECD 的每年工時（以 OECD 會員國為主、沒有台灣；PWT 涵蓋 130 國而且有台灣，沒有另外查 OECD 的條款）。

31. **存款與財產**（`pipeline/topics/wealth.py`、`sources/imf_fas.py`、`imf_weo_sdmx.py`、`wid.py`、`oecd_saving.py`、`cbc_finance.py`、`dgbas_wealth.py`）：
    - **存款用 IMF Financial Access Survey（FAS）**，不用世界銀行的 GFDD（`GFDD.OI.02` 銀行存款占 GDP，最後更新 2022 年 9 月，只到 2021 年）。FAS 在 IMF 新資料平台的 SDMX API（`https://api.imf.org/external/sdmx/2.1/data/IMF.STA,FAS/…`），存款餘額占 GDP（`OUTD`、`POGDP`），2004–2025 年約 150–170 國。
      - FAS 的存款是國內家庭與非金融企業的存款，不含政府與金融機構，但**含企業的存款**，所以「平均每人存款」不是一般人戶頭裡的錢。香港（545%）、新加坡（257%）這類金融中心特別高。
      - **只算商業銀行會少算很多**：德國商業銀行只有 33%，加上合作銀行（CUCC 19%）與儲蓄銀行（ODT 34%）是 86%；法國 42% → 98%；日本 160% → 270%。所以三類加總。API 的標籤把 `COMBANK` 寫成「Deposit-taking corporations, except the central bank」，實際是商業銀行。
      - 機構類別的申報年份不一：少於 5 年的零星申報不算；曾占合計 3% 以上的類別，哪一年沒有就不收那一年（奧地利 2023 年起沒有 ODT，所以只到 2022 年）。沒有商業銀行資料的賴比瑞亞不收。59 國只有商業銀行的資料，附註會寫（英國的建屋互助會不在 FAS 裡，可能少算）。
      - **ODT 可能含貨幣市場基金**（FAS 的定義是「負債算在廣義貨幣裡」的其他機構）：美國的 ODT 約 20%，照收、頁尾有寫。愛爾蘭的 ODT 是 GDP 的 156%（國際貨幣市場基金設在都柏林，不是愛爾蘭人的存款），三類加總會變成每人 22.5 萬美元、全球第 3，所以愛爾蘭只算商業銀行與信用合作社（45%、每人約 5 萬美元），附註有寫。
      - 葉門的國民儲蓄率（IMF）是 GDP 的 127%，排第 1，是 IMF 自己的數字，照收並加附註說明不確定性很大。
      - 平均每人存款 = 存款占 GDP × IMF WEO 的人均 GDP（當年美元），等於用全年平均匯率換算。
    - **台灣的存款**：中央銀行統計資料庫 API（`https://cpx.cbc.gov.tw/API/DataAPI/Get?FileName=EF03Y01`，「重要金融指標（續）」的年底餘額，新台幣億元）。取「企業及個人存款」（活期性、定期及定期儲蓄、外匯）加郵政儲金，不含政府存款、外國人的新台幣存款、附買回與貨幣市場基金，比照 FAS 的口徑。貨幣機構含本國銀行、外銀在台分行、信用合作社、農漁會信用部與中華郵政，跟 FAS 三類加總大致相同。除以主計總處的名目 GDP。
      - 2024 年底 60.49 兆元（含政府存款的貨幣機構存款合計 62.77 兆元），占 GDP 235%、每人約 80,500 美元；2025 年底 63.61 兆元，GDP 跳了 11.6%，占比降到 222%。
      - API 的 PDF 說明文件（`/Tree/ExportToAPIInfo`，要用 POST）列出所有檔名，但字型沒有 Unicode 對照，要直接下載各檔看 JSON 裡的欄名。
    - **財富用 WID**（第 28 點；變數見 `wid.ALL`）：每位 20 歲以上成年人、夫妻平分（`j`）的個人淨財富（`ahwealj992`，房地產與金融資產減負債），中位數用第 50–51 百分位的平均（`ahwealj992 p50p51`），占比 `shwealj992`。
      - **金額**：WID 的金額是基準年（物價指數 = 1 的那年，現在是 2025）不變價格的本國貨幣，除以基準年的市場匯率（`xlcusxi999`）或購買力平價（`xlcuspi999`），就是「2025 年價格」的美元、國際元。存款是當年美元，兩者不同，說明有寫。
      - **bulk 檔的物價指數代碼是 `inyixxi999`**（人口單位的字母在年齡碼前面），文件的寫法 `inyixx999i` 在 bulk 檔裡找不到，原本 `wid.ALL` 抽出來是空的，`base_year()` 會報錯，已經改掉；另外加了 `npopuli992`（20 歲以上人口）。
      - **多數國家是推估的**：WID 的資料品質（bulk 檔第 8 欄 `data_quality`，0–5）對 2010 年 216 國中只有 28 國不是 0（有財富調查或稅務資料），其他是依所得分布與鄰近國家推估的；2024 年全部是 0（最新幾年都是往後推的估計）。台灣、日本每年都是 0。指標說明與頁尾都有寫。
      - 世界平均：WID 的世界檔（`WO`）只到 2023 年，而且基準年是 2024、只有購買力平價版，所以平均財富的世界值自己算（各國平均 × 成年人數 ÷ 成年人數），2023 年購買力平價版跟 WO（換成 2025 年價格）差 0.7%。中位數的世界值只能用 WO（購買力平價，乘上美國 2024→2025 年的物價變化），市場匯率版沒有世界值。占比的世界值用 WO（到 2023 年）。
      - 從 1995 年開始：WID 的全球財富估計（Bajard et al. 2021、2025）從 1995 年起，之前是用長期序列往回推的。
      - 檢查用的數字（2024 年，2025 年價格）：世界平均 92,055 美元、購買力平價 150,800 國際元；美國平均 555,250 美元、中位數 91,602 美元；台灣平均 311,330 美元（666,450 國際元）、中位數 105,360 美元（225,540 國際元），最富有 10% 擁有 61.8%、1% 擁有 27.8%。
    - **台灣的財富**：WID 有台灣（`TW`），所以地圖用 WID，主計總處的數字只放在附註（口徑不同）：
      - 《國富統計》113 年底家庭部門淨值 183.7 兆元（土地按市價重評價，2026-04-29 發布），除以 WID 的 20 歲以上人口（1,949 萬人）約每人 943 萬元；WID 同年是 887 萬元（當年價格），低約 6%。113 年起不再公布平均每戶，改跟每四年一次的財富分配統計一起公布。
      - 《家庭財富分配統計》（110 年底，2024-05-03 發布，以家庭收支調查的樣本串接行政資料的資產負債推估）：每戶淨值平均 1,638 萬元、中位數 894 萬元（平均是中位數的 1.83 倍），最富有 20% 家庭擁有 62.68%。這是每「戶」，WID 是每位成年人、夫妻平分，WID 的平均約是中位數的 3 倍，比較集中（調查通常少算最有錢的人）。沒有每位成年人的中位數，也沒有前 10%、1% 的占比。
    - **家庭儲蓄率用 OECD**（`OECD.SDD.NAD,DSD_NAAG@DF_NAAG_V`，`B8NS1M`：家庭及非營利團體的淨儲蓄占淨可支配所得），約 35 國，2025 年只有十幾國先公布，所以頭尾年份要有最多那年一半以上的國家（`year_span(…, 0.5)`）。中國 34.9% 也在裡面。
      - **台灣用國民所得統計的家庭部門**：nstatdb A018703010「家庭及民間非營利機構之收支」（1996–2024 年，國民所得統計年報表 3-4），儲蓄 ÷ 可支配所得。這裡的儲蓄與可支配所得都已扣除折舊（淨額），跟 OECD 的 `B8NS1M` 同一個定義，只差 OECD 另外加計退休金權益的調整，台灣沒有。2024 年 2,213,098 ÷ 14,297,323 百萬元 = 15.5%，32 國中第 2（中國 34.9% 第 1）。
        - 家庭收支調查也有「儲蓄率」（nstatdb A020001010，2024 年 23.7%），但調查的儲蓄沒有扣折舊、範圍也跟國民帳不同，比 OECD 的淨儲蓄率高很多，不能比，只寫在附註、不畫在地圖上。
    - **國民儲蓄率用 IMF WEO 的 `NGSD_NGDP`**（國民儲蓄毛額占 GDP，含台灣與推估值）。DataMapper API 沒有這個指標（`/api/v1/NGSD_NGDP` 回傳空的 JSON），改查 IMF 新資料平台的 SDMX API（`IMF.RES,WEO`，`G001` 是世界）。台灣 2024 年 IMF 43.0%，主計總處國民所得統計是 42.7%（國民儲蓄毛額 10.99 兆 ÷ GDP 25.74 兆）；主計總處公布的「儲蓄率」是除以 GNI（2024 年 41.1%、2025 年 43.9%），附註有寫。
    - **沒有用的來源**：UBS Global Wealth Report 是商業出版品，沒有開放授權（最新版只分析 56 個市場）；世界銀行 GFDD 停在 2021 年；World Bank 的 Changing Wealth of Nations 是國家財富（含人力資本、自然資本），不是家庭淨財富。
    - nstatdb 偶爾會對所有請求回 HTTP 403（多個主題同時抓的時候），隔幾分鐘就好。

32. **物價與財政資料**（`pipeline/topics/fiscal.py`、`pipeline/sources/oecd_revenue.py`、`imf_revenue.py`、`mof.py`）：
    - **稅收來源的選擇**（先看授權，再看涵蓋與定義）：
      - **UNU-WIDER 政府收入資料庫（GRD）沒有用**：資料頁、FAQ 都沒寫資料的授權，UNU-WIDER 網站內容預設是 CC BY-NC-SA 3.0 IGO（非商業、相同方式分享），下載前還要填表。比照 IHME 的處理（第 23 點），不用。
      - 世界銀行的 `GC.TAX.TOTL.GD.ZS` 是 CC BY 4.0，但只有中央政府、不含社會安全捐，美國、德國這類聯邦制國家和歐洲社會保險大國會被低估很多，不用。
      - 採用 **OECD 全球稅收統計**（Global Revenue Statistics，OECD 資料條款）：Revenue Statistics 與拉丁美洲、非洲、亞太三本區域版的合併資料庫，142 國，1990 年起，各級政府的稅收加社會安全捐（OECD 的「租稅負擔率」定義）。透過 SDMX API 下載（`format=csvfile`），`STANDARD_REVENUE = _T`、`SECTOR = S13`、`UNIT_MEASURE = PT_B1GQ`。
      - OECD 沒有的 57 國（印度、俄羅斯、沙烏地阿拉伯、伊朗、衣索比亞、坦尚尼亞、阿爾及利亞等）用 **IMF 世界稅收資料庫（WoRLD）** 補：稅收（G11）加社會安全捐（G121），都是占 GDP。IMF 的 SDMX API 只回傳 XML（`format` 參數沒有作用）。
        - 驗證：兩邊都有的 2,362 筆，WoRLD 的「稅收＋社會安全捐」比 OECD 的中位數只差 +0.05 個百分點，80% 在 ±2 以內。差最多的多是 WoRLD 只有中央政府或缺社會安全捐的國家（東帝汶、哥斯大黎加、突尼西亞少 9–15 個百分點）；南韓 2022 年也少 9 個百分點（WoRLD 的社會安全捐只有 3.6%）。
        - 有社會安全捐資料的國家只收兩項都有的年份；IMF 完全沒有社會安全捐的 25 國只放稅收，30 國只有中央政府（`S1311MIXED`），各國附註會寫。
      - **社會安全捐開始計入的那一年會假性跳升**：OECD 對中國的稅收 2019 年起才含社會安全捐，2018 → 2019 年從 16.7% 跳到 21.7%，不是真的增加。`fiscal.py` 的 `_ssc_breaks()` 比對社會安全捐（`oecd_revenue.social_security_contributions()`）從無到有的年份，自動在這些國家加附註（中國 2019 年，另有安地卡、玻利維亞、埃及、加彭、聖露西亞、馬紹爾群島的較早年份）。
      - **日本、澳洲、南非等十幾國最新一年還沒公布**（OECD 的資料會晚一年），指標檔加 `latestWithin: 1`，2024 年的地圖顯示它們 2023 年的值並標出資料年份，否則預設年份日本會是灰的。
    - **台灣的稅收**用財政部財政統計資料庫的「賦稅負擔率（含社會安全捐）」（表 i0801，2000 年起），是財政部依 OECD 稅收分類編的（表 i0804、i0808 有分類明細），表裡其他國家的數字跟 OECD 相同（日本 2023 年 33.7%）。
      - 2024 年 20.3%；不含社會安全捐 14.6%（新聞稿當時公布 14.7%，GDP 修正後變 14.6%）。
      - 社會安全捐 2024 年占 GDP 5.6%，含勞保、健保、公教保、軍保、農保、國保、就業保險與軍公教、勞工退休基金的提撥；其中勞工退休金新制的個人帳戶提繳約 1.0%，各國對個人帳戶制的處理不一定相同，附註有寫。
      - 財政統計資料庫跟主計總處的總體統計資料庫是同一套系統：`web02.mof.gov.tw/njswww/webMain.aspx?sys=220&funid=…&outmode=12&utf=1` 是 UTF-8 CSV。年份有「2024」「113年」「113年度」三種寫法。
    - **IMF 的台灣債務與財政收支就是財政部的數字**，口徑跟其他國家不同：
      - 債務：IMF 的「一般政府總債務」對台灣用的是各級政府 1 年以上非自償性債務未償餘額（公共債務法的口徑，財政部表 i0231），2023 年 29.0%、2024 年 26.8%、2025 年 23.6%，跟財政部公布的占當年度 GDP 比率完全相同。中央政府 2025 年 21.1%（表 i0232 也是 21.1%）。不含未滿 1 年的借款、自償性債務與非營業特種基金的債務，全部加上（表 i0234）是 27.6%；其他國家的一般政府總債務範圍更寬。
      - 財政收支：IMF 的淨借貸對台灣用的是各級政府歲入歲出餘絀（總決算加特別決算，表 i0101），2016–2025 年每年都跟財政部的占 GDP 比率相同（2023 年 −0.6%、2024 年 +0.4%、2025 年 +0.3%）。這是預算收支的口徑，不含債務還本，也不含勞保、健保等社會保險基金。
      - 資料管線每次比對 IMF 與財政部的數字，差超過 0.15 個百分點會印出警告；附註裡的中央政府與較寬範圍的比率用主計總處的 GDP 計算。
    - **物價水準**：世界銀行的「物價水準比」（`PA.NUS.PPPC.RF`）已經移到 WDI 封存資料庫（API 回「The indicator was not found」），而且沒有台灣。改用 IMF WEO 的 GDP（美元，`NGDPD`）÷ GDP（購買力平價，`PPPGDP`）× 100，也就是購買力平價 ÷ 匯率，美國剛好是 100，台灣也有，還有推估值。
      - 驗證：跟世界銀行用同樣算法（人均 GDP 美元 ÷ 人均 GDP 購買力平價）比，2023 年 190 國的差距中位數 0.0%，126 國在 ±2% 以內；差很多的是官方匯率與市場匯率差距大的國家（蘇丹、伊朗、土庫曼、蒲隆地、黎巴嫩、緬甸），兩個機構用的匯率不同。
      - 台灣 2025 年 43.8（同樣的東西約美國的四成多），2023 年 43.4，跟 IMF 的購買力平價 13.52 元 ÷ 當年匯率 31.16 元一致。
      - 匯率變動影響很大：日本 2019 年 94.7，日圓貶值後 2024 年 62.1。
    - **通膨率的分級**：用循序色、不用發散色。通膨率雖然有正負，但「中性」不在 0，而且通縮很少（每年 0–41 國），所以負值放在最淺的一級。惡性通膨差好幾個數量級（辛巴威 2008 年 231,150,889%、委內瑞拉 2018 年 65,374%），一年 25% 以上都在最深的一級；100% 以上的值不留小數。
    - 世界銀行的通膨（`FP.CPI.TOTL.ZG`）補了 IMF 沒有的 4 個地區（古拉索、開曼群島、新喀里多尼亞、荷屬聖馬丁），物價水準補了 8 個（百慕達、法羅群島、格陵蘭等）。政府債務與收支在世界銀行只有中央政府的數字，定義不同，沒有補。
    - **授權**：IMF 的資料（WEO、WoRLD）依 IMF 的資料使用條款可以轉載、改作，註明來源；商業再利用要另外申請（https://www.imf.org/en/About/copyright-and-terms）。OECD 全球稅收統計適用 OECD 資料條款（可轉載、改作，需註明出處）。財政部適用政府資料開放授權條款。

33. **研發與創新資料**（`pipeline/topics/innovation.py`、`pipeline/sources/nstc.py`、`tipo.py`）：
    - **來源與授權**：
      - 研發經費占 GDP（`GB.XPD.RSDV.GD.ZS`）、每百萬人研究人員（`SP.POP.SCIE.RD.P6`）是世界銀行轉載的 UNESCO 統計研究所（UIS）資料，專利（`IP.PAT.RESD`）是轉載的 WIPO 資料；WDI 的序列中繼資料（`/v2/sources/2/series/<代碼>/metadata`）三個都標 `License_Type: CC BY-4.0`（軍費那種第三方條款會標成「SIPRI terms and conditions」）。
      - **UIS 自己的資料庫是 CC BY-SA 4.0**（https://databrowser.uis.unesco.org/terms-and-conditions），衍生的資料檔要用相同授權，所以用世界銀行的版本。
      - **WIPO 統計資料庫的使用條款不准轉載資料集**（https://www.wipo.int/en/web/ip-statistics/about 的 Conditions of use：「not to republish or commercially re-sell WIPO's statistical datasets」），跟觀光主題的 UN Tourism 一樣，只用世界銀行以 CC BY 4.0 轉載的部分；頁尾照 WDI 的來源註記寫「WIPO 國際局不對轉換後的資料負責」。
      - OECD MSTI（OECD 資料條款）有 Chinese Taipei，只拿來交叉比對，沒有放進資料。
    - **WDI 的世界值偏高，不用**：研發經費占 GDP 的「World」只平均當年有報的國家，而且用匯率換算的 GDP 加權（自己照這個方法重算，每年都完全相同），2010 年 2.00%、2020 年 2.46%；UIS 公布的全球值是 1.61%、1.93%。這裡改成有資料國家（5 年內最近一年）的研發經費加總 ÷ 這些國家的 GDP 加總，都用 IMF 的購買力平價 GDP，涵蓋世界 GDP 八成以上的年份才算：2010 年 1.67%、2020 年 1.99%、2024 年 2.08%（含台灣）。研究人員的世界值同樣用有資料國家的研究人員 ÷ 人口（涵蓋世界人口七成以上才算）：2018 年每百萬人 1,369 人，WDI 只算當年有報的國家，是 1,524 人。專利的世界值用 WDI 的合計（WIPO 的全球總數，含歐洲專利局等區域專利局，所以比各國加總多約 9 萬件）再加上台灣。
    - **研發經費總額**：WDI 沒有購買力平價的研發經費，用研發經費占 GDP × IMF WEO 的購買力平價 GDP（`PPPGDP`）自己算，各國同一套換算。IMF 沒有的美屬薩摩亞、百慕達、古巴、法羅群島、格陵蘭、關島、摩納哥、美屬維京群島沒有總額。台灣 2024 年 768 億國際元，OECD MSTI（用 OECD 的購買力平價）是 768.4 億。
    - **年份零散**：很多國家隔幾年才做一次研發調查，WDI 2024 年只有 30 國；指標檔加 `latestWithin`（研發 5 年、專利 3 年）。2024 年的地圖上研發經費占 GDP 116 國裡 85 國用的是之前的年份；專利 135 國裡 13 國。
    - **專利是「向本國專利局申請」的件數**：
      - 歐洲很多申請直接送歐洲專利局，不算在各國自己的專利局，所以歐洲國家偏低（德國 2024 年 4 萬件、每百萬人 474 件；荷蘭、比利時更明顯），指標說明有寫。
      - 只算發明專利，不含新型與設計。各國審查標準與申請成本差很多，中國 167 萬件占全球六成，件數不等於品質。
      - 每百萬人用 WPP 的年中人口自己算（WDI 沒有這個指標）。
    - **台灣**（國科會、智慧局的開放資料都是政府資料開放授權條款）：
      - 研發經費：國科會「全國科技動態調查」（data.gov.tw 7562，新臺幣百萬元）÷ 主計總處名目 GDP。2024 年研發經費 1 兆 493 億元（跟國科會 2025 年 10 月公布的相同），比率 4.08%；國科會公布的是 4.10%（OECD MSTI 也是 4.10%），差在主計總處之後把 2024 年 GDP 從 25.59 兆修正成 25.74 兆。2023 年以前兩者相同（例如 2023 年 3.97%）。世界排第 4（以色列 6.35%、列支敦斯登 6.01%、南韓 4.94%）。
      - 研究人員：國科會的研究人員全時約當數（data.gov.tw 7564），2024 年 180,877 人年（MSTI 相同；研發人力合計 311,156 人年，跟國科會公布的相同），除以 WPP 年中人口（2,321 萬，內政部是 2,340 萬）= 每百萬人 7,792，第 7。
      - 專利：智慧局「本國人與外國人新申請專利件數統計表」（data.gov.tw 81180，Big5），只取發明專利的本國人。2024 年 19,586 件、外國人 31,237 件，跟智慧局 113 年年報相同；每百萬人 844 件，排在南韓、日本、中國之後、美國之前。智慧局依申請人國籍分，WIPO 依第一申請人的居住地，台灣兩者差不多。開放資料從 2007 年開始；智慧局已有 2025 年，但其他國家只到 2024 年，不收。
      - **mas.nstc.gov.tw 只接受舊式的 CBC-SHA1 加密套件**，Python（OpenSSL 3）預設的安全等級會握手失敗，`nstc.py` 自己下載時把安全等級降到 1（憑證照樣驗證）。找不到檔案時回傳 JavaScript 警告，HTTP 狀態一樣是 200。

34. **氣溫與降雨**（`pipeline/topics/temperature.py`、`temperature_grid_tiles.py`、`pipeline/sources/cru.py`）：
    - **來源的選擇**：CRU TS v4.10（2026 年 6 月發布，1901–2025 年，全球陸地 0.5°、逐月，不含南極洲），從 CRU 網站直接下載，不用登入。
      - ERA5 要 Copernicus CDS 帳號與 API 金鑰，不用。
      - CRU 自己有各國平均（CRU-CY），World Bank 氣候知識平台（CCKP）也用 CRU TS 算國家平均，但國界跟地圖不同（法國海外省、克里米亞、西撒哈拉沒有依聯合國的劃分拆開），所以各國的值自己算，CCKP 只拿來比對。
    - **讀 ASCII 版，不讀 NetCDF**：`cru_ts4.10.1901.2025.tmp.dat.gz`（165 MB）、`pre.dat.gz`（220 MB）。每個月 360 列 × 720 欄、每個值 8 個字元寬的整數（單位 0.1），−999 是海；**第一列是最南邊**。只要 numpy 就能讀，GitHub Actions 不必裝 netCDF4／h5py，也不必管 rasterio 的 Linux wheel 有沒有 netCDF 驅動。解析一次約 1 分鐘，陸地格子（67,420 格 × 1,500 個月）存成 `.npz` 快取，兩個步驟共用。
      - **降雨不能存成 int16**：有些格子一個月超過 3,276.7 mm（最多 4,061.2 mm），int16 會溢位成負數。
    - **國家平均**：國界跟海拔主題一樣用 `population_grid.country_shapes()`。國界先畫成 0.05° 的細網格，算出每個 0.5° 格子裡各國占幾成，權重 = 占比 × cos(緯度)，只算 CRU 有資料的陸地格子。年均溫是 12 個月的月均溫平均，年雨量是 12 個月加總。
      - 比一個格子還小的國家（新加坡、香港、巴林、馬爾地夫等約 50 個）照樣有占比，數值就是涵蓋它的格子，附註會說明。CRU 的陸地遮罩含很多小島（馬爾地夫、吐瓦魯、吉里巴斯都有格子）。
      - 梵蒂岡、摩納哥小到細網格上沒有格子，用多邊形頂點所在的陸地格子。
      - 完全沒碰到 CRU 陸地格子的，用 100 km 內最近的陸地格子：阿魯巴（39 km）、波奈等三島（46 km）、聖巴瑟米（54 km），附註會寫距離。皮特肯群島最近的陸地格子在 217 km 外，從缺。共 241 個國家/地區。
      - 世界值：全部陸地格子的面積加權平均（CRU 本身不含南極洲）。2025 年 14.45 °C、848 mm；1991–2020 年 13.88 °C、840 mm。
    - **暖化**：某年 Y 的值 = Y−9 到 Y 這 10 年的年均溫平均 − 1951–1980 年平均，所以從 1910 年開始。
      - **基準期用 1951–1980，不用 1901–1930**：CRU TS 把測站距平內插到網格，離測站太遠（氣溫約 1,200 km）的格子距平是 0、直接填 1961–1990 年的氣候平均值。20 世紀初非洲、南美內陸、北極的測站很少，早期的值被拉向平均、看起來變化很小，拿來當基準會低估暖化。
      - 同樣的原因，到現在測站都很少的太平洋小島與新幾內亞暖化看起來很小（2025 年英屬印度洋領地 0.07 °C、北馬利安納 0.09、帛琉 0.11、索羅門群島 0.13、巴布亞紐幾內亞 0.18 °C），頁尾有說明。
      - 2025 年各國：中位數 +1.08 °C，最高是俄羅斯 +2.36、白俄羅斯 +2.32、立陶宛 +2.26 °C；世界陸地 +1.30 °C。1950 年各國在 −0.5 到 +0.5 °C 之間。
      - 門檻用 [−2, −1, −0.3, 0.3, 1, 2]（`reverse: true`，正值橘色），國家平均與網格共用：2025 年的網格（依面積）0.3–1 °C 占 35%、1–2 °C 44%、2 °C 以上 17%；1930 年中性 74%、−0.3 到 −1 °C 15%。暖化本身是單向的，負的兩級幾乎用不到。
    - **CRU TS 4.10 的紐芬蘭**：紐芬蘭島與拉布拉多南部約 40 格，2018 年起每個月都比之前冷 4–6 °C（7 月從 16–18 °C 掉到 9–12 °C），周圍的格子沒有，不像真的氣候變化，比較像測站資料的問題。原始資料照用，網格上那一塊會顯示成變冷（2025 年 −2 到 −4.4 °C）。加拿大的年均溫與暖化附註有說明（2025 年全國年均溫因此低約 0.03 °C、暖化少約 0.02 °C）；雨量沒有這個情形，所以年降雨量沒有附註。
    - **跟 World Bank CCKP（CRU TS 4.09）比對** 30 個國家：1991–2020 年的年均溫多半差 0.1 °C 以內、年雨量差 1% 以內，2015–2024 年的暖化差 0.01 °C 以內。差比較多的：
      - 挪威 −1.49 °C（0.75 對 2.24 °C）、雨量 −11%（1,000 對 1,123 mm）、2015–2024 年的暖化 1.81 對 1.52 °C：地圖的挪威含斯瓦巴群島，CCKP 只算本土。挪威三個指標的附註各自寫該指標的差距。
      - 印度 −0.35 °C：國界不同（喀什米爾）。
      - 馬爾地夫 +0.36 °C、雨量 −10%、暖化 1.10 對 0.60 °C：國土只有零星的小格子，兩邊取的格子不同。
      - 中國、日本、南韓約 −0.1 °C：海岸的格子依陸地占比加權，CCKP 的取法不同。
    - **分級**：年平均氣溫 [0, 6, 12, 18, 24, 27]（[0, 5, 10, 15, 20, 25] 時 25 °C 以上有 101 國，熱帶全部同色）；年降雨量 [250, 500, 1,000, 1,500, 2,000, 3,000]。
    - **台灣**（CRU 本身有台灣的格子；2025 年 20.7 °C、1,972 mm、暖化 +1.31 °C）：
      - CRU 的全島面積平均含中央山脈，比平地測站低約 4 °C。中央氣象署的年度臺灣氣候分析以 11 個平地測站代表臺灣：2025 年均溫 24.2 °C、比 1991–2020 年氣候值高 0.3 °C（氣候值 23.9 °C），2024 年 24.6 °C（高 0.7 °C）；CRU 的距平 2024 年 +1.03 °C、2025 年 +0.53 °C，方向一致。氣象署年底記者會公布的全台平均（長期測站）是 24.53 °C，比 1901–2000 年平均高 1.22 °C；CRU 2025 年比 1901–2000 年平均高 1.37 °C。
      - 長期增溫：國家氣候變遷科學報告以氣象署 6 個百年測站（臺北、臺中、臺南、恆春、花蓮、臺東）計算，1911–2020 年上升約 1.6 °C；CRU 同期的線性趨勢是 +1.50 °C（每 10 年 0.14 °C）。
      - 雨量：CRU 1991–2020 年平均 2,120 mm，氣象署 11 個平地測站的氣候值 2,161 mm（山區雨量多，真正的全島平均應該更高，CRU 偏低）。逐年差距大：2025 年 CRU 1,972 mm（常年的 93%），氣象署 2,500.5 mm（116%）；2024 年 CRU 2,165 mm（102%），氣象署 2,135.9 mm（99%）；2023 年 CRU 95%、氣象署 87%。CRU 的 `.stn` 檔（每格每月內插用到幾個測站，最多記 8）在台灣的格子：氣溫一直是 8，雨量 2013 年以前是 8、2014 年起只剩 3–4，所以近年的逐年雨量以氣象署為準。三個指標的台灣附註都寫了這些數字。
      - 氣象署的 PDF（`twn-monitor_2025-0.pdf` 等）字型沒有 Unicode 對照，`pdftotext` 只讀得出數字；數字對照年報與新聞稿寫進 `temperature.py` 的 `CWA`，新的一年要手動更新。
    - **側欄**：每國一個 `countries/<ISO3>.json`（約 14 KB、gzip 後約 5 KB，241 個檔共約 3.2 MB）：1991–2020 年的每月平均（0.1），加上 1901 年起每年的逐月值（氣溫 0.1 °C；降雨 10 mm 以上取整數、以下留一位）。**全年的值另外存**（每年與 1991–2020 年平均的年均溫、年雨量，跟指標檔同一個值）：拿四捨五入後的逐月值重算，年雨量常差 1 mm（印度 2025 年 1,268 對 1,269）、年均溫差 0.1 °C（挪威 1991–2020 年 0.7 對 0.8）。附註裡的數字用跟前端 `fixed()` 一樣的四捨五入（`temperature.fmt()`）。氣溫、降雨分成兩張圖（不做雙 y 軸），氣候平均值用灰色、選定年份用彩色，下面有每月數字表。降雨是長條（`Chart.tsx` 的 `kind: 'bar'`；2026-10-29 以前在 `TemperaturePanel.tsx` 自己 `echarts.use([BarChart])`）。
    - **沒有做 CMIP6 推估**：World Bank CCKP 有各國 CMIP6 多模式中位數（例如 SSP2-4.5），但沒有台灣，很多海外領地也沒有，推估年份的地圖會缺一塊；要換算到 1951–1980 基準還要接 CCKP 的 historical 模擬。

35. **空氣品質資料**（`pipeline/topics/air_quality.py`、`pipeline/sources/acag.py`、`moenv.py`）：
    - **來源的選擇**：
      - PM2.5 年平均用 WHO GHO 的 SDG 11.6.2（`SDGPM25`，Dim1 `RESIDENCEAREATYPE_TOTL`＝都市加鄉村的全體人口，人口加權）。2026 年 5 月的版本是 2010–2023 年、227 國，有世界值（2010 年 34.4、2023 年 26.1 μg/m³）。WHO 用衛星、化學傳輸模式與地面測站整合推估（DIMAQ），CC BY 4.0。都市、鄉村、城市、城鎮的分項沒有用。
      - **世界銀行 WDI 的 PM2.5 沒有用**：`EN.ATM.PM25.MC.M3`（1990–2023）的 metadata 標 CC BY 4.0，但原始來源是 IHME 的 GBD 2023 Air Pollution Exposure Estimates，GHDx 頁面寫明適用 IHME 的非商業使用協議，而且要登入才能下載（WDI 自己的 metadata 也註明「Need to create account to retrieve data」）。照第 20 點的原則，轉載者標的授權不能拿來繞過原始授權。`EN.ATM.PM25.MC.ZS`（超過指引值的人口比例）也是 IHME（GBD 2017），只到 2017 年，門檻還是舊指引的 10 μg/m³。
      - WHO 沒有公布「超過指引值的人口比例」，改用 WashU ACAG（華盛頓大學聖路易分校大氣成分分析小組）SatPM2.5 V6.GL.02 的各國統計檔（`GlobalPM25-V6GL0203-Annual-1998-2023-wThresFrac.csv`，資料頁標示 CC BY 4.0）：1998–2023 年各國的人口加權 PM2.5，以及人口暴露在 5、10、15、25…60 μg/m³ 以上的比例；人口用 GPWv4、國界用 GADM 3.6。
        - 檔案放在 Box 的共用連結，不必登入：先讀共用頁面裡的 `typedID`，再用 `index.php?rm=box_download_shared_file` 下載。資料頁提到的 AWS Open Data 鏡像（bucket `v6.gl.02.04`）已經不存在。
        - 世界值用 ACAG 自己的人口加權各國的比例：2023 年 99.6%（1998 年 99.0%）。
      - **PM2.5 年平均不用 ACAG**（雖然年份比較長，也有台灣）：兩套模型對個別國家差很多。2023 年 ACAG ÷ WHO 的各國中位數是 1.0，但 10–90 百分位是 0.62–1.30：日本 13.4 vs 8.5、南韓 25.9 vs 19.2、巴西 13.9 vs 20.4、奈及利亞 44.9 vs 54.3。ACAG 的台灣 2023 年是 21.3，環境部的測站平均是 13.8（2020 年 15.7 vs 14.1），WHO 是 SDG 的官方數字。超過 5 μg/m³ 的比例幾乎都是 100%，兩套模型的差別影響不大，所以只拿 ACAG 的這一項，指標說明寫明是不同的模型、數字可能對不上。
      - **ACAG 的各國檔沒有台灣、香港、澳門**：國家檔的「China」只有中國大陸（2020 年人口 13.99 億；中國分區檔各省加總 14.29 億，差的 3,050 萬就是台灣 2,311 萬、香港 697 萬、澳門 42 萬），三區從同一資料集的中國分區檔（`ChinaPM25-V6GL0203-Annual-REGIONAL-1998-2023-wThresFrac.csv`）取用，附註有寫。
      - WHO 的 SDG 11.6.2 也沒有分開列出香港、澳門，PM2.5 年平均的地圖上是灰色；附註寫 ACAG 的衛星推估當參考（2023 年香港 16.2、澳門 18.0 μg/m³），並說明是不同的模型。
      - 國名對 ISO 代碼：`from_name()` 的模糊比對會把 Saint-Martin、Saint-Barthélemy 配成法國、蓋掉法國的值，`acag.NAMES` 明確指定；兩個地區配到同一國時資料管線會報錯。裏海、西沙群島、英屬基地（Akrotiri and Dhekelia）、北賽普勒斯不收。
      - 死亡率用 WHO GHO 的 `AIR_42`（戶外空氣污染歸因死亡率）與 `SDGAIRBODA`（SDG 3.9.1：戶外加家戶固體燃料造成的室內空氣污染，WHO 算的是合併效果，不是相加），都是年齡標準化、每十萬人，Dim1 `SEX_BTSX`、Dim2 `GHECAUSE_GHE000000`（全死因；另有下呼吸道感染、肺癌、缺血性心臟病、中風、COPD 的分項）。GHO 現在只有 2021 年，時間軸只有一年。2021 年世界：戶外 56.6、合計 95.3（185 國、181 國）。兩個指標用同一組門檻，切換時顏色可以直接比。
      - **OpenAQ 沒有用**：是各地測站的量測值，不是國家的人口加權平均；平台本身沒有單一授權，要遵守各資料提供者的條款，API 也要註冊金鑰。
      - **HEI State of Global Air 沒有用**：資料來自 IHME GBD 2023，IHME 只限非商業使用，報告也寫明只能非商業使用。
    - **台灣**（WHO、WDI、ACAG 的各國檔都沒有）：
      - PM2.5 年平均用環境部開放資料「全國細懸浮微粒手動監測資料」（AQX_P_10，每 3 天一次的 24 小時採樣，2012 年 12 月起，每月一個資源）。環境部公布的全國 PM2.5 年平均就是這 31 個手動監測站（30 個一般測站加陽明國家公園測站）年平均的算術平均。每站一年要有 90 次以上的採樣才算（一年約 122 次），而且只收 12 個月都有資源的完整年份。
      - **開放資料平台文件上的 API（`/api/v2/aqx_p_10`）一定要帶 `api_key`**（沒帶回「api_key 不存在。」），data.gov.tw 頁面上的下載連結是帶著平台本身的金鑰。這裡改用平台網頁預覽資料用的 API，不用金鑰：`/api/frontstage/dataset.view.withLanguage?name=AQX_P_10&language=zh` 列出各月的資源代碼，`POST /api/frontstage/datastore.search`（`{"resource_id": …, "limit": 10000}`）讀一個月。不是公開文件化的 API，格式可能改變。
      - 2022 年起部分月份多一份英文站名的重複資料（Banqiao、Keelung…，2025 年每站約 80 筆），只收中文站名。
      - 2013、2014 年開放資料只有 8 站（基隆、士林、宜蘭、三義、南投、嘉義、前金、屏東），算出 25.7、25.3，比環境部公布的 24.0、23.6 高，所以從 2015 年（31 站）開始；環境部公布的這兩年寫在附註。
      - **交叉比對**：環境部公布的全國 PM2.5（手動）年平均，來自環境統計查詢網「歷年全國細懸浮微粒 PM2.5(手動) 濃度值」（https://statis.moenv.gov.tw/epanet/ 的「粒狀污染物」，網頁圖表背後是 `epaS.aspx?m=s&a=qq&Q=1&mudd=A5&mea=PM25&code1=13`）；2021 年起的值也在開放資料「空氣污染物濃度測值」（data.gov.tw 89030，`STAT_P_116` 的「總計」），兩邊相同。環境部回顧 2025 年空品監測的新聞也寫「108 年 16.2 降至 114 年 12.8」（聯合報〈回顧2025空品監測 環境部：PM 2.5持續改善〉，https://udn.com/news/story/7266/9237319 ）。

        | μg/m³ | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
        |---|---|---|---|---|---|---|---|---|---|---|---|
        | 這裡算的 | 21.9 | 20.0 | 18.3 | 17.5 | 16.2 | 14.1 | 14.4 | 12.5 | 13.8 | 12.8 | 12.8 |
        | 環境部公布 | 22.0 | 20.0 | 18.3 | 17.5 | 16.2 | 14.1 | 14.4 | 12.4 | 13.7 | 12.8 | 12.8 |

        差異都在 0.15 μg/m³ 以內（開放資料的濃度只到整數）。`air_quality.OFFICIAL_TAIWAN` 存了環境部公布的值，資料管線每次都會印出兩邊對照，附註也引用；環境部公布新的一年時要手動加上。
      - 這是測站的簡單平均，不是人口加權，附註有寫。地圖只到 2023 年（WHO 最新一年），2024、2025 年的環境部數字寫在附註。2023 年台灣 13.8 μg/m³，排第 115／228（世界 26.1）。
      - 超過指引值的比例用 ACAG 中國分區檔的台灣：1998–2023 年每年都是 100%。對照：環境部 31 個手動測站 2023 年的年平均都高於 5 μg/m³，最低是恆春 6.4（2022 年 5.4 最接近）。
      - **缺口**：死亡率沒有官方用同樣方法（PM2.5 暴露量乘上各疾病的暴露—反應關係）推估的台灣數字，查到的都是民間團體或學術研究、方法各不相同的估計，所以留空，附註寫原因。
    - **網格（沒有做）**：ACAG V6.GL.02.04 有 0.1° 與 0.01° 的年平均、月平均 NetCDF（WGS84），CC BY 4.0（可以製作衍生圖磚，註明出處），Box 共用連結不必登入：
      - 0.1°：年平均每年約 5 MB（1998–2023 共 26 個檔、約 130 MB；含月平均與區域檔的整個資料夾 2.5 GB）。
      - 0.01°：年平均每年約 420 MB（26 年約 11 GB；整個資料夾 208 GB）。
      - 下載要先從資料夾頁面取得每個檔的代碼（AWS 鏡像已經停用）。地圖上的國家顏色是 WHO 的模型，ACAG 的網格跟它對不起來（台灣 2023 年 ACAG 21.3、測站 13.8），要做的話國家平均可能也要換成 ACAG。

36. **水資源與森林**（`pipeline/topics/water_forest.py`、`pipeline/sources/aquastat.py`、`fao_fra.py`）：
    - **人均水資源＝AQUASTAT 的「總可再生水資源」（境內＋上游流入，km³）÷ UN WPP 年中人口，自己算**：
      - 不用世界銀行的 `ER.H2O.INTR.PC`（只有境內）：下游國家的水大多從上游流入，只算境內的話埃及每人不到 9 立方公尺（含上游流入是 502），Falkenmark 指標（1,700／1,000／500 立方公尺）的定義也是總可再生水資源。
      - **也不用 AQUASTAT 現成的人均值（var 4190）**：裡面混了 247 筆旗標 A 的舊官方值，口徑跟同國其他年份不同，約 40 國在 1975、1980、1985、1990、1995 年單年跳動（蒲隆地 1994 年 2,194 → 1995 年 580 → 1996 年 2,065、巴基斯坦 1995 年 2,968、馬爾他 1995 年 44、安哥拉 1995 年 17,238）。而且 AQUASTAT 沒有前蘇聯、1993 年以前的衣索比亞與捷克、2011 年以前的蘇丹這類現在國界的國家，WPP 依現在的國界回推人口，自己算就自然補上（例如俄羅斯 1995 年 30,517）。
      - 資源量是長期平均（AQUASTAT 的說明寫多為 1961–1990 年），各國用最新一年的總可再生水資源（只有不丹、馬爾他等幾國改過），逐年的人均值只反映人口變化，跟台灣的算法一致。
      - AQUASTAT 的批次下載檔是 fao.org 上的一個 zip（`AQUASTAT Statistics Bulk Download (English).zip`，約 16 MB），裡面只有一個名稱是「zip」的 CSV（UTF-8，約 180 MB），不用登入。互動查詢網站（data.apps.fao.org/aquastat）的 TerriaJS 設定檔裡另有一份 `bulk_eng(in).csv`，是 Latin-1 編碼，沒有用。
      - 薩摩亞、東加、帛琉、吉里巴斯等 14 個小島國的總可再生水資源是 0（旗標 I，AQUASTAT 補的），當成無資料，地圖上 183 國＋台灣。
      - **世界值**：AQUASTAT 自己的世界值早年只加總有資料的國家（1965 年只有 960 立方公尺），它的世界人口 1992 年以前也少了前蘇聯等國（世界值在 1992 年掉 7.2%），所以改成各國「境內」可再生水資源（IRWR）的加總（42,809 km³；上游流入的水已經算在上游國家，不能再加）÷ WPP 的世界人口：2023 年 5,290（AQUASTAT 是 5,317）。
    - **水資源壓力**（SDG 6.4.2）＝淡水取用量 ÷（總可再生水資源 − 環境流量），**用世界銀行轉載的 AQUASTAT**（`ER.H2O.FWST.ZS`，2024 年 5 月取得的版本，到 2022 年），不用 2026 年 6 月的 AQUASTAT 批次檔：
      - 批次檔有好幾國的取用量明顯錯誤，而且看不出哪一組才對：科威特 2004–2014 年 6e-05 km³（水資源壓力 0.3%，2003 年因此內插成 1,038%）；瓜地馬拉 2001–2010 年（2004 年除外）是 20–28 km³（旗標 X，34–49%），2004 年與 2011 年以後是 3 km³（5–6%）；蓋亞那在 1.6 km³（3.6%）與 0.1 km³（0.2%）之間來回跳；馬爾地夫 2014 年 0.33%。世界銀行的版本這幾國都是平順的序列（瓜地馬拉 4–6%、蓋亞那 3–4%、科威特 2,075 → 3,851%）。
      - 兩版有 29 國 2022 年的值差 10% 以上（埃及 141% vs 113%、肯亞 33% vs 11%、馬利 8% vs 43%…），有的是新版修訂、有的可能是錯誤，沒有逐一判斷；之後要換新版時，先用 `outlier_runs()` 與上面幾國檢查。
      - **剩下的錯值用規則排除**（`water_forest.outlier_runs()`）：連續最多 15 年的值同時比前一個與後一個值低（或高）2.5 倍以上（兩邊的值都小於 0.5% 的不算）。世界銀行的版本只抓到馬爾地夫 2010 年（3.4%，前後 9.5%、15.7%），從資料拿掉，附註寫明（中英文）。拿 2026 年的批次檔跑同一個規則，會抓到科威特 2004–2014、瓜地馬拉、蓋亞那、馬爾地夫 2014，可以用來檢查新版。
      - 很多國家隔好幾年才申報取用量，中間與之後的年份是 FAO 補的（線性內插、沿用最近一年，例如科威特 2017–2022 年都是 3,850.5%）。早年只有少數國家，頭尾要有最多那年一半以上的國家才收，所以從 1987 年開始，178 國。世界銀行的版本沒有世界值，用 AQUASTAT 批次檔的全球值，2000 年以前只加總了部分國家（1986 → 1987 年從 27.9% 跳到 20.3%），只收 2000 年起（2022 年 17.8%）。門檻用 FAO 的分級 25／50／75／100%，再把「沒有壓力」從 10% 切開（中位數約 10%）。科威特 3,851%、阿聯 1,510%（靠海水淡化與化石地下水）。
    - **飲用水**用世界銀行轉載的 JMP（`SH.H2O.SMDW.ZS`，2025 年 8 月發布、到 2024 年），151 國；很多國家缺水質資料，中國、澳洲沒有「安全管理」的估計，是灰色。世界 2024 年 73.7%。
    - **森林用 FRA 2025**（2025 年發布），比世界銀行轉載的 FAOSTAT 土地利用（`AG.LND.FRST.ZS`，FRA 報告年之間線性內插的逐年值）新，而且就是原始的評估年：
      - 下載是 FRA 平台「Bulk download」按鈕用的 API（`fra-data.fao.org/api/file/bulk-download?assessmentName=fra&cycleName=2025&countryIso=WO`，約 1.4 MB 的 zip），CSV 的檔名帶下載當天的日期，用檔名開頭找。
      - 只有 1990、2000、2010、2015、2020、2025 年，時間軸就是這 6 年；年變化率是兩個評估年之間的複利年增率（FRA 自己的算法），標在後一年（2000、2010 年是前 10 年的平均，之後是 5 年），可以避開逐年的雜訊。
      - 236 個國家/地區，其中 42 個是 FAO 的書面推估（desk study：希臘、以色列、烏克蘭、白俄羅斯、緬甸、北韓等沒有提交國家報告），附註有寫。世界 2025 年森林 41.40 億公頃、占土地 31.8%，2020–2025 年平均每年 −0.12%（1990–2000 年 −0.25%）。
      - **FRA 的「China」（M49 159）土地面積含台灣、香港、澳門，森林面積卻只有中國大陸**：土地 942,470 千公頃＝FAOSTAT 的中國大陸 938,821＋台灣 3,541＋香港 105＋澳門 3.3，森林面積跟 FAOSTAT 的「China, mainland」完全相同。覆蓋率改用中國大陸的土地面積算（2025 年 24.10% → 24.20%），跟世界銀行（2020 年 23.34%）一致；香港、澳門在 FRA 沒有資料。
    - **台灣**（AQUASTAT、JMP、FRA 都沒有台灣）：
      - **人均水資源**：經濟部水利署公布的 2013–2022 年平均可利用逕流量 633.7 億立方公尺（年降雨 2,458 公釐、885 億立方公尺，扣除蒸發與入滲；水利署英文網站 Water Resources Utilization）÷ WPP 年中人口，2023 年 2,718 立方公尺（用內政部 2023 年底人口 2,342 萬是 2,706）。比日本（3,457）少、比南韓（1,347）和中國大陸（1,997）多。台灣的值只有地表逕流、不含沒有流入河川的地下水補注，可能略為低估；而且是近 10 年平均，不是 AQUASTAT 那種長期平均（水利署網頁換成新的平均期間時要改 `TW_RUNOFF`）。
      - **水資源壓力從缺**：沒有官方的環境流量數字。水利署 2013–2022 年平均每年用水 163.7 億立方公尺（農業 71%、生活 19%、工業 10%；不含保育用水與非灌區農業用水），不扣環境流量是 25.8%；AQUASTAT 裡日本、南韓的環境流量約占總可再生水資源的一半（49%、51%），照這個比例是 52%（中度壓力；日本 35%、南韓 85%）。各國的環境流量比例從 32%（菲律賓）到 73%（斯里蘭卡）都有，結果差太多，所以不放進地圖，附註寫這兩個數字。水利署《113 年各標的用水統計年報》2024 年用水 155.96 億立方公尺。
      - **飲用水用自來水普及率**（水利署《113 年生活用水量統計報告》：2023 年 95.67%、2024 年 95.78%），只有這兩年。JMP 的「安全管理」是在住家、需要時就有、水質合格的改善水源；自來水的水質抽驗合格率約 99.9%（環境部），沒接自來水的人（地下水、山泉水、簡易自來水）有一部分也可能符合，所以台灣的值可能略為低估（日本 98.7%、南韓 99.3%）。報告的歷年表（2016–2024）用 pdftotext 讀出來欄位對不齊（2022、2023 年同一個值），2022 年其他來源寫 94.55%，口徑不明，所以只收報告本文寫明的兩年。年報 PDF 的中文字型沒有 Unicode 對照，只讀得出數字。
      - **森林**用農業部林業及自然保育署的全國森林資源調查（https://www.forest.gov.tw/0000052）：第三次（1990–1993 年，台灣本島）森林 2,102,400 公頃、土地 3,591,500 公頃、58.53%，標在 1990 年；第四次（2008–2013 年實地調查、2015 年公布，含金門、連江）森林 2,197,090 公頃、土地 3,618,996 公頃、60.71%，標在 2010 年（調查期間的中點，比 2015 年接近）。林保署的「森林調查」頁面（最後修改 2026-05-18）只有第三、四次的報告，查不到第五次的結果。指標檔加 `latestWithin: 15`，2015–2025 年的地圖顯示 2010 年的值並標出資料年份（其他國家每個報告年都有值，不受影響）。台灣 60.7% 排第 38（日本 68.3%、南韓 64.3%）。
      - **森林年變化率**用兩次調查同一範圍（台灣本島）的森林面積：第四次報告的比較表寫 210.2 萬 → 218.6 萬公頃（58.53% → 60.91%），以 1990 → 2010 年的 20 年算，每年 +0.20%，標在 2010 年（跟其他國家 2000–2010 年的平均比較）。
      - 台灣的數字是照官方文件抄進 `water_forest.py` 的常數（水利署的網頁與年報、林保署的調查報告），出新版時要手動更新。

37. **電動車資料**（`pipeline/topics/ev.py`、`pipeline/sources/iea_ev.py`、`thb.py`）：
    - **來源的選擇**：IEA Global EV Data Explorer 的資料頁標示 Licence: CC BY 4.0（2026 年 5 月 20 日更新，Global EV Outlook 2026，歷史資料 2010–2025 年）。同一份資料的 data product 頁面（.Stat Suite 的 XLSX）標示的是 Terms of Use for Non-CC Material，而且要登入才能下載，所以不用。
      - www.iea.org 有 Cloudflare 驗證，程式打不開，瀏覽器也要勾選真人驗證。資料頁背後的 API（`https://api.iea.org/electric-vehicles`）不用金鑰，回傳 JSON；查詢一定要指定 `region` 或 `year`，這裡一年查一次（約 120 KB）。舊的 `api.iea.org/evs` 已經停用（404）。API 網址是從 Wayback Machine 存下的資料頁請求紀錄找到的。
      - 只放歷史資料（`category=Historical`），不放 IEA 的推估情境（Projection-STEPS、Projection-CPS）。
      - Our World in Data 也有轉載（CC BY 4.0），但直接讀 IEA 的 API 可以拿到全部指標，以及純電／插電式、慢充／快充／超快充的細項。
    - **口徑**：
      - 「電動車」＝純電（BEV）＋插電式混合（PHEV，含增程式 EREV），不含燃料電池車（FCEV）；只算 IEA 的 Cars（小客車）。
      - IEA 的數值都四捨五入到兩位有效數字（2025 年世界銷售 2,100 萬輛、占比 25%），而且以 float32 存（0.012000000104），讀進來用三位有效數字去掉雜訊。保有量占比在 1% 以上只到整數（世界 5%）。
      - 公共充電樁＝慢充（≤ 22 kW）＋快充（22–150 kW）＋超快充（≥ 150 kW）。Global EV Outlook 2026 起把超快充從快充分出來，三類不重疊；2025 年世界合計 697 萬（報告寫「超過 700 萬」），中國 468 萬。
      - 車樁比是 IEA 的「Electric LDVs per charging point」：電動輕型車（小客車＋輕型商用車）÷ 公共充電樁，世界 11。在家充電普遍的國家（美國 33、挪威 35、紐西蘭 88）比較高，南韓只有 2（慢充多）。
      - 歐盟、歐洲、Advanced Economies 等區域合計不收；世界值（含比率）都用 IEA 自己的 World。IEA 的地區名稱在 `iea_ev.REGIONS` 逐一對到 ISO 代碼，新版多了國家時資料管線會報錯。
      - 涵蓋：銷售占比 61 國、保有量與保有量占比 46 國、充電樁與車樁比 43 國，其他國家在地圖上是灰色（頁尾有說明）。
    - **台灣**（IEA 沒有台灣）：交通部公路局統計查詢網（`stat.thb.gov.tw`，跟主計總處總體統計資料庫同一套系統，API 參數同 `dgbas.py`）的「新車領牌數－按使用燃料分」（funid 1120005）與「機動車輛登記數－按縣市別及使用燃料分」（1110008，取全國總計），小客車（自用＋營業），101 年（2012）起；登記數的年資料是年底值。
      - www.thb.gov.tw 有 Incapsula 擋程式，統計查詢網可以直接下載。年資料的「115年底」不是真的年底（當年還沒結束），不收。
      - 燃料別依「車輛能源種類登載作業原則」分 13 類（查詢網的「使用燃料別定義說明」）：電能＝純電；電能/汽油、電能/柴油（同時用油與電，主要由電動馬達驅動）、電能（增程）＝插電式混合；汽油（油電）、柴油（油電）、汽油（電能）是只加油的油電混合車，不算。
      - **「汽油/電能」「柴油/電能」（主要由引擎驅動）不算**：2012–2014 年「汽油/電能」每年約 1.7 萬輛，「汽油（油電）」2016 年才出現，2021 年起「汽油/電能」每年只剩 200–500 輛，所以 2020 年以前的油電混合車多半登記在這一類，114 年底仍有 97,390 輛。車輛中心的 PHEV 也不含這一類（114 年底 PHEV 14,528 輛＝電能/汽油 14,295＋電能/柴油 4＋電能〔增程〕229，完全吻合）。2025 年若算進去，新車占比只多 0.08 個百分點（286 輛）。
      - 2025 年：新車占比 9.6%（純電 32,358＋插電式 2,591 ÷ 新領牌小客車 363,653），年底保有量 142,370 輛（純電 127,842、插電式 14,528），占小客車 746 萬輛的 1.91%。
    - **台灣的交叉比對**：
      - 2024 年純電小客車新領牌 37,629 輛、占 9.32%，跟審計部報告的「電動小客車市售比 9.32%」相同（經濟日報報導）；加上插電式是 10.0%。
      - 2025 年 1–6 月純電小客車新增 12,727 輛、占 7.3%，跟交通部的說法相同。
      - 純電小客車登記數 113 年 9 月底 86,831 輛、114 年 2 月底 99,980 輛、114 年 7 月底 110,768 輛，都跟交通部新聞稿的「電動小客車」相同（交通部的電動小客車只算純電）。
      - 車輛中心（ARTC）：2025 年純電領牌 32,551 輛、年底登記 128,631 輛，是小客車加小貨車；這裡只算小客車（32,358、127,842）。PHEV 登記數 14,528 相同。
      - 經濟部統計處的「電動車占新車掛牌數 33.9%」（113 年 1–10 月）含油電混合車，口徑不同。
    - **缺口**：台灣沒有官方的逐年（年底）公共充電樁統計，交通部只在新聞稿公布某個時點的數字（113 年 9 月底 9,597 槍，其中快充 2,249；114 年 7 月底 12,334 槍；媒體引述交通部路政司 115 年 7 月底 16,280 槍），時點跟 IEA 的年底不同，所以充電樁與車樁比從缺，台灣側欄的附註寫交通部的數字。交通部的車樁比（114 年 7 月底 9.0）是純電小客車 ÷ 公共充電樁，IEA 另含插電式與輕型商用車。

38. **民主與自由**（`pipeline/topics/democracy.py`、`pipeline/sources/vdem.py`）：
    - **來源**：V-Dem（Varieties of Democracy）Country-Year 資料集 v16（2026 年 3 月），引用格式是 Coppedge, Michael, John Gerring, Carl Henrik Knutsen, Staffan I. Lindberg, Jan Teorell, David Altman, et al. 2026. "V-Dem Country-Year Dataset v16". Varieties of Democracy (V-Dem) Project. https://doi.org/10.23696/vdemds26（V-Dem 網站列了 38 位作者，頁尾用 et al.）。
    - **下載**：V-Dem 網站（https://www.v-dem.net/data/the-v-dem-dataset/）的下載頁要先填表單（電子郵件、性別），沒有固定的直接網址，不適合程式下載。改用 V-Dem Institute 自己在 GitHub 維護的 R 套件 vdemdata（https://github.com/vdeminstitute/vdemdata）：`data/vdem.RData` 就是完整的 Country-Year 資料集（套件說明寫明是「most recent full V-Dem data set plus external variables」），用版本標籤 `V16`（commit f4dd269，「v16 release」，2026-03-17）固定版本：https://raw.githubusercontent.com/vdeminstitute/vdemdata/V16/data/vdem.RData（34 MB）。
      - 套件的程式碼是 GPL-3，但我們只用資料，資料的授權照 V-Dem 網站的 CC BY-SA 4.0。
      - RData 是 R 的序列化格式（gzip、XDR 大端序），解壓後約 1 GB、4,618 欄 × 28,092 列。資料框的欄名寫在所有欄位之後，所以讀兩次：第一次只取欄名，第二次只留要的欄位，數值向量直接跳過，記憶體很小。
      - 新版（v17）出來時：改 `vdem.py` 的 `VERSION`、`URL` 的標籤；多了新的政體代碼時資料管線會報錯，要在 `democracy.py` 的 `RENAME` 或 `DROPPED` 決定怎麼處理。
    - **指標**：選舉民主指數 `v2x_polyarchy`、自由民主指數 `v2x_libdem`、言論自由與多元資訊指數 `v2x_freexp_altinf`（都是 0–1，顯示到小數兩位）、政體分類 `v2x_regime`（Regimes of the World，代碼照 V-Dem 的 0 封閉專制、1 選舉專制、2 選舉民主、3 自由民主）。另外輸出三項指數的 `_codelow`、`_codehigh`（68% 最高後驗密度區間），只給側欄用。只放 1900 年以後（V-Dem 從 1789 年開始，但 1900 年以前大多是今天地圖上沒有的政體）。
      - 三項指數用同一組發散色門檻（0.2、0.35、0.45、0.55、0.65、0.8），中性灰那一級跨過 0.5（政體分類裡選舉民主的門檻之一，另外要選舉自由公正、多黨）：橘色偏專制、青綠偏民主，跟政體分類同一個讀法，切換指標時台灣一直是青綠。原本用循序色（越深越民主），跟政體分類的「深橘 = 封閉專制」正好相反，所以改掉。言論自由的分布偏高，民主國家大多落在最深的一級。
      - 政體分類的類別順序是封閉專制 → 自由民主（`diverging: true`）：專制在橘色那側、民主在青綠那側，越靠兩端越深。理由：「專制暖色、民主冷色」是政體地圖常見的讀法，順序也跟 V-Dem 代碼、面量圖圖例一樣由低到高。
    - **國家代碼**：V-Dem 的 `country_text_id` 大多就是 ISO alpha-3（科索沃也是 XKX），一個代碼是一個政體的連續序列。這裡照 V-Dem 自己的接續方式對到今天的國界，不依領土另外拼接：
      - 德國 1949–1990 年是西德（V-Dem 把聯邦德國當成德國的延續；1945–1948 年盟軍占領沒有評分），俄羅斯 1918–1990 年是蘇聯，塞爾維亞 1918–2005 年是南斯拉夫、塞爾維亞與蒙特內哥羅，捷克 1918–1992 年是捷克斯洛伐克，越南 1945–1975 年是北越，葉門 1918–1989 年是北葉門。其他蘇聯加盟共和國、南斯拉夫各國、斯洛伐克在獨立前是灰色（沒有評分），不把蘇聯、南斯拉夫的分數塗到它們身上。
      - 不收（地圖上沒有形狀）：東德（DDR）、南越（VDR）、南葉門（YMD）、尚吉巴（ZZB，1964 年起是坦尚尼亞的半自治區，V-Dem 跟坦尚尼亞分開評分）、加薩走廊（PSG）、英國託管巴勒斯坦（PSB，1918–1948），以及 1900 年以前就消失的德意志、義大利各邦。相關國家（德國、越南、葉門、坦尚尼亞）的附註有寫。
      - 巴勒斯坦（PSE）是 V-Dem 的「Palestine/West Bank」（約旦河西岸）；地圖的巴勒斯坦形狀含加薩，附註寫出加薩最近一年的值（2025 年選舉民主指數 0.13、封閉專制；西岸是 0.21、選舉專制）。
      - 索馬利蘭（SML）對到地圖自己的形狀 `_SOL`（第一個輸出 `_SOL` 數值的主題）：1900–1959 年英屬索馬利蘭、1991 年起自行宣布獨立的索馬利蘭共和國，1960–1990 年併在索馬利亞裡、沒有另外評分（灰色）。索馬利亞 1991 年起也不含索馬利蘭。
      - 殖民地與被占領的時期也有評分（日本統治下的台灣、英屬印度、各非洲殖民地），是當時統治者的分數；頁尾有寫。
      - 結果：2025 年 177 國（V-Dem 179 個政體扣掉加薩、尚吉巴，索馬利蘭換成 `_SOL`）；1900 年 118 國、1950 年 150 國。
    - **台灣**：V-Dem 的 TWN 1900–1944 年是「Taiwan under Japanese occupation」，1945–1948 年是「Republic of China [headquartered in the mainland]」（V-Dem 把在大陸的國民政府也記在 TWN，同時 CHN 1928–1948 年也是中華民國），1949 年起是「Republic of China [headquartered in Taiwan]」。附註有寫。
    - **世界值**：每年地圖上有資料的國家的簡單平均（每國一樣重，不依人口加權）。V-Dem 的民主報告兩種都用（「平均國家」與「平均每人」）；依人口加權要 1900 年起的人口，WPP 只有 1950 年起、V-Dem 自己的 `e_pop` 到 2019 年左右，接不起來，而且會被中國、印度主導，所以用簡單平均。國家數逐年增加（1900 年 118 國、2025 年 177 國），早期的平均只代表當時有評分的地區。2025 年：選舉民主 0.486、自由民主 0.374、言論自由 0.612。
    - **不確定性**：V-Dem 的指數是專家評分先經過 V-Dem 的測量模型（貝氏 IRT 模型）估計，再合成的估計值。側欄列出時間軸那一年的 68% 可信區間（台灣 2025 年選舉民主 0.80，區間 0.76–0.86），頁尾提醒分數接近的國家高低不一定有意義。區間檔 6 個，共約 390 KB、gzip 後約 96 KB，只有打開國家側欄時才下載。

39. **地震與火山**（`pipeline/topics/earthquakes.py`、`pipeline/sources/usgs.py`、`ncei.py`、`gvp.py`、`plates.py`）：
    - **USGS ComCat**（FDSN event API，https://earthquake.usgs.gov/fdsnws/event/1/ ，公有領域）：
      - 一次查詢最多 20,000 筆，超過時直接回 HTTP 400，所以分段查：規模 6 以上每 25 年一段（1900 年起共 14,471 筆），規模 5–6 每 5 年一段（1973 年起共 82,056 筆）。含今年的那一段檔名寫 `now`，要更新用 `--refresh`。
      - 只取 `eventtype=earthquake`（排除核試爆等），用 CSV（比 GeoJSON 小很多）。
      - 1970 年代以前來自重新定位的 ISC-GEM 目錄，規模約 5.5 以上才完整；規模 5–6 從 1973 年（PDE 全球目錄）開始。
      - **地名有「?」**：USGS 自己的地名資料把 Latin-1 以外的字母存成「?」（「5 km SSE of ?iso, Japan」是大磯 Ōiso），JSON 格式也一樣、救不回來。約 2% 的規模 6 以上地震是這樣，`usgs.clean_place()` 只留逗號後面的區域或國名（「Japan」）。
      - 日期是 UTC：集集地震是 1999-09-20 17:47 UTC（台灣時間 9 月 21 日 01:47），tooltip 寫「1999-09-20 UTC」，頁尾提醒台灣時間要加 8 小時。
    - **國家歸屬（50 公里規則）**：`OffshoreIndex` 用 `population_grid.country_shapes()`（跟人口框選、海拔主題同一份 1:50m 國界，法國海外省等依聯合國拆開；`_SIA` 錫亞琴冰川不算國家）。國界內直接算（numpy 射線法），海上的找 50 公里內最近的國界線段（1° 網格分區、局部等距投影），換日線兩側的線段各補一份平移 360° 的。規模 6 以上的地震約一半（7,301 筆）不屬於任何國家（深海、洋脊、離岸較遠的隱沒帶）。
      - 例外一：離岸超過 50 公里、但 NOAA 記錄有人死亡的地震，算在 NOAA 寫的國家（2011 年東北地方太平洋近海地震的震央離 1:50m 的海岸 70 多公里）。
      - 例外二：火山在 50 公里內找不到國界的（1:50m 沒有形狀的小島：伊豆、小笠原、克馬德克、南三明治群島）用 GVP 的國名；GVP 把屬地寫成本國（南三明治群島寫 United Kingdom、北馬里亞納寫 United States），所以 300 公里內最近的國家是那一國的屬地時改用屬地（`TERRITORIES`），再遠的遠洋小島逐一指定（`VOLCANO_TERRITORY`：阿姆斯特丹島 ATF、特里斯坦達庫尼亞 SHN、揚馬延 SJM、布威島 BVT…）。東加北部的火山離薩摩亞比較近，但不是薩摩亞的屬地，照 GVP 算東加。海底的「Undersea Features」16 座不算任何國家。
    - **NOAA NCEI 全球重大地震資料庫**（https://www.ngdc.noaa.gov/hazel/ ，doi:10.7289/V5TD9V7K，公有領域）：
      - 用 hazel 網站本身的 REST API（`/hazel/hazard-service/api/v1/earthquakes`），一頁最多 200 筆（`itemsPerPage` 再大回 HTTP 400），1900 年起 4,094 筆、21 頁。
      - 收錄條件是「重大」（有人死亡、約 100 萬美元以上損失、規模 7.5 以上、震度 X 以上或引發海嘯），所以有很多規模 5–6 的致災地震，規模 6 以上但沒有災情的大多不在裡面。
      - 死亡人數用 `deathsTotal`（含海嘯、山崩、火災），沒有才用 `deaths`；只有數量級（`deathsAmountOrder`）的不算。1,672 筆有死亡人數。
      - **跟 USGS 配對**（`join_deaths()`，一對一）：時間 5 分鐘內、距離 300 公里內、規模差 1.2 以內；只有日期的舊事件用前後 1 天、150 公里內；時刻差 1 分鐘內、規模差 0.3 以內的不管距離也算（**NOAA 把 2026-08-10 哥倫比亞 M7.4 的經度記成東經 76°**，正負號寫反）。3,109 筆對到 USGS，有死亡人數的 1,373 筆（其他多半是 1973 年以前規模 6 以下、USGS 沒有收的）。對不到的大災難：1902 年阿塞拜疆舍馬哈、1920 年墨西哥哈拉帕（NOAA 的時刻是當地時間、規模 7.8 跟 USGS 的 6.3 差很多）。
      - 國家的死亡人數用 NOAA 所有事件：對到 USGS 的用地圖上那個點的國家，其他用 NOAA 的座標，再不行用 NOAA 的國名（`NOAA_COUNTRY`）。**整筆算在震央附近的國家**：2004 年印度洋海嘯在斯里蘭卡、印度、泰國的死者都算在印尼（NOAA 的地震資料庫沒有分國的死亡人數，分國的在海嘯資料庫）。
    - **台灣的對照**：
      - 1999 集集地震：USGS M7.7、深度 33 公里（固定深度）、「21 km S of Puli, Taiwan」，歸 TWN；NOAA 死亡 2,297 人，官方統計 2,415 人死亡、29 人失蹤（行政院 921 震災重建會）。
      - 2024 花蓮地震：USGS M7.4、深度 40 公里、2024-04-02 23:58 UTC，歸 TWN；NOAA 死亡 18 人，跟官方的 18 人相同。
      - **NOAA 把 1935-07-16（UTC）新竹州的地震記為 2,746 人死亡**，這是同年 4 月新竹－台中地震（3,276 人）的餘震，中研院台史所的資料說 290 人、也有 44 人的說法，2,746 很可能是錯值。找不到能引用的官方數字，所以照原樣呈現，在台灣的附註（`deaths-decade.json` 的 `notes`／`notesEn`，由 `taiwan_note()` 依資料產生）說明，台灣 1930 年代的死亡人數因此是 6,039 人。USGS 沒有這次地震（規模 6 以下）。
      - 台灣 1900 年起規模 6 以上 186 次（第 13 名），全新世火山 2 座（龜山島、大屯火山群）。
    - **火山：Smithsonian GVP Volcanoes of the World**（全新世火山 1,214 座）：
      - **授權的判斷**：GVP 使用條款（https://volcano.si.edu/gvp_termsofuse.cfm ，網站有機器人驗證，用 Wayback Machine 2026-01 的存檔讀到全文）寫明 Volcanoes of the World 資料庫是「a product of employees of the United States」，屬於 Smithsonian 條款「Intellectual Property Rights in Content」的第 (2) 類：美國政府雇員的職務作品，從來不受著作權保護。Smithsonian 網站條款（https://www.si.edu/termsofuse ）另外只允許個人、教育與其他非商業用途，要註明作者與出處並連回網站，商業用途或「publication」要事先書面同意。沒有禁止非商業的轉載，資料本身也沒有著作權，所以直接用 GVP（本站非商業、頁尾註明「Global Volcanism Program, Smithsonian Institution」）。授權欄寫「美國政府職務作品（無著作權）；Smithsonian 條款：非商業使用、註明出處」。
      - 公有領域的替代來源 NOAA NCEI Global Volcano Locations Database（doi:10.7289/V5JW8BSH）其實也是 GVP 的資料（舊版，最近一次噴發只有年代代碼 D1–D7），data.gov 上的授權欄位寫「未指定」，並沒有比較乾淨，所以沒有用。如果要嚴格避開 Smithsonian 的非商業條款，可以改用它，代價是沒有確切的噴發年份。
      - volcano.si.edu 對程式一律回「Request verification」頁面，下載用 GVP 的 GeoServer WFS（`webservices.volcano.si.edu/geoserver/GVP-VOTW/ows`，`GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes`，用 `propertyName` 只取需要的欄位，不含地質說明與照片連結，照片的著作權各自不同）。
      - 引用格式（GVP 的 Database Information 頁）：Global Volcanism Program, 2025. [Database] Volcanoes of the World (v. 5.3.4; 30 Dec 2025). Distributed by Smithsonian Institution, compiled by Venzke, E. https://doi.org/10.5479/si.GVP.VOTW5-2025.5.3 。WFS 是即時的資料（Langila 的最近噴發已經是 2026 年），之後若有新版 DOI 要更新 `gvp.py` 的說明。
      - 火山類型（`Primary_Volcano_Type`）去掉單複數標記（`Stratovolcano(es)` → `Stratovolcano`），中文名稱在 `earthquakes.ts` 的 `VOLCANO_TYPES`；最近一次噴發的年份負數是西元前，366 座年代不明。
    - **板塊邊界：PB2002**（Bird 2003, doi:10.1029/2001GC000252；Hugo Ahlenius／Nordpil 整理的 https://github.com/fraxen/tectonicplates ，**ODC-By 1.0**，README 要求註明 Hugo Ahlenius、Nordpil 與 Peter Bird；固定在 commit 339b0c5）：
      - 用 `PB2002_steps`（5,824 段，每段有 `STEPCLASS`）而不是 `PB2002_boundaries`（只有 subduction 與空白）：SUB、OCB、CCB 算聚合，OSR、CRB 算張裂，OTF、CTF 算轉形斷層。同一條邊界上相連、同一類的段接成一條線，只取每段的起點與終點（中間的點是沿大圓內插的），1,579 條、7,403 個頂點。
      - 經度展開成連續的（跨 180° 的線可以超過 ±180），東加—克馬德克海溝在地球儀上不會斷開或橫越整張地圖（實際看過）。
    - **顏色**（MAP_TOKENS，dataviz 驗證工具算的 OKLab ΔE×100，一般／紅色盲／綠色盲）：淺源 `hues.red` #e34948、中源 `hues.yellow` #eda100、深源 `categorical[6]` #7b3294，兩兩 ≥ 21/21/15；火山 `sequential[6]` #611e00（深褐三角形）跟三色 ≥ 22/24/21；跟海 #a0c8f0 都 ≥ 23。板塊邊界用 `inkSecondary`／`inkMuted` 的中性灰，不跟地震搶；深色底圖上換成淺灰（`overlayLayers.ts` 的 `ON_DARK`，跟鐵路一樣）。比例圓的紫 #6250d6 跟深源的紫只有 13/12/11，但形狀、大小完全不同；改成青綠的話跟淺源的紅在紅色盲下只剩 7，所以維持紫色。
    - 半徑：規模每大 1 級半徑約加倍（M5 1 px、M6 1.8、M7 3.6、M8 7、M9 12，縮放 2 時）。

40. **諾貝爾獎**（`pipeline/topics/nobel.py`、`pipeline/sources/nobel.py`）：
    - **來源**：Nobel Prize API 2.1 的 `laureates`（個人與組織，每位有 Wikidata QID）與 `nobelPrizes`（每年每類一筆，只拿來核對兩邊的得主名單一致）。一次 `limit=2000` 就拿完，超過會報錯。每年 10 月公布新得主，要 `npm run data -- nobel --refresh`。
    - **依出生地，不是國籍**：用 `birth.place.countryNow`（出生地今天屬於哪一國），同一個人只算一國。所以出生在布雷斯勞（今波蘭弗羅茨瓦夫）的玻恩、哈伯算波蘭，波蘭 28 位、德國只有 86 位；出生在美國的丁肇中算美國，台灣只有李遠哲，中國 12 位裡有美國人布拉頓（廈門）、日本人根岸英一（長春）、達賴喇嘛（西藏）。台灣的附註寫出丁肇中、楊振寧、李政道、崔琦、高錕各算在哪裡（`TAIWAN_CHECK` 核對 API 的資料，對不上就報錯），資料本身沒有改。
    - **國名對 ISO**：API 的國名先查 `COUNTRY_NAMES`（`USA`、`the Netherlands`、`East Timor`、`Scotland`、`Northern Ireland`），再查 `sources/countries.py` 的 `NAME_ALIASES`、pycountry 的精確比對，對不上就報錯；不做模糊比對，否則「Northern Ireland」會配成愛爾蘭。
    - **領地**：API 自己寫成「Faroe Islands (Denmark)」「Guadeloupe, France」，芬森、聖瓊·佩斯算丹麥、法國（地圖上瓜地洛普本來就併在法國的形狀裡）；丹麥、法國、法羅群島、瓜地洛普的附註都有寫。
    - **API 沒有出生地的 3 位**（古納、詹姆斯·羅賓森、馬丁尼斯，都是 2021 年以後的得主）：用 Wikidata 的出生地（P19）所在國家（P17）的 P298，一次 SPARQL 查完（尚吉巴市 → 坦尚尼亞、切姆斯福德 → 英國、洛杉磯 → 美國），附註會寫。還是查不到的只算進世界合計。
    - **計數規則**：
      - 組織（28 個，紅十字國際委員會 3 次、聯合國難民署 2 次）沒有出生地，不算進各國，也不算進世界合計；側欄另外列出成立地點（API 的 `founded.place.countryNow`，國家對話四方集團是 `foundedCountryNow`）在這國的組織，歐盟、禁止化學武器組織、世界糧食計劃署沒有地點，不列。
      - 一位得主在一個子項目只算一次，從第一次得獎那年起累計。「全部獎項」裡居禮夫人、鮑林、巴丁、桑格、夏普萊斯都只算一人；分獎項時居禮夫人在物理、化學各算一次，所以 6 個獎項加起來（1,002）比「全部獎項」（1,000）多 2。這 5 人的國家有附註。
      - 拒絕領獎的沙特（1964）、黎德壽（1973）與被迫放棄的巴斯特納克（1958）照算，諾貝爾基金會也列為得主。
      - 當年得主人數：這一年得獎、在這國出生的人數（單年最多 8 人）。
      - 沒有得主的國家（WPP 有人口的 237 國都列）是 0，不是無資料：比例圓沒有圓，面量圖是最淺的一級（門檻 0.001，圖例寫「> 0」；原本是 0.01，單一獎項時中國、印度這種人口很多的國家只有一位得主會被算成 0.007 而落在「沒有得主」那一級）。
    - **每千萬人**：累計人數 ÷ 當年的 WPP 年中人口 × 1,000 萬。WPP 從 1950 年開始，所以這個指標從 1950 年（經濟學獎 1969 年）開始，不拿 1950 年的人口去除更早的年份；2024–2026 年的人口是 WPP 的中推估（累計人數本身不是推估，所以沒有設 `projectionFrom`）。人口少的國家一兩位就很高：聖露西亞（劉易斯、沃克特，18 萬人）約 111、盧森堡 29。全部獎項的門檻 0.001、1、3、5、10、20，單一獎項約小 5 倍，用 `itemScales` 的 0.001、0.5、1、2、4、8。
    - **經濟學獎**是「瑞典中央銀行紀念諾貝爾經濟科學獎」，1968 年設立、1969 年起頒發，不是諾貝爾遺囑設立的獎；子項目寫成「經濟學獎（瑞典央行紀念獎）」，年份從 1969 年開始（換到這個子項目時，1969 年以前的年份會跳到預設的 2026 年）。
    - **中文名稱**（Wikidata，CC0）：`wbgetentities` 每 50 個 QID 一批（快取檔名是那批 QID 的雜湊），依序用 zh-tw、zh-hant、zh-hk；都沒有時用 `languagefallback` 的 zh-tw，那是 MediaWiki 在伺服器端從 zh／zh-cn 轉成的台灣用字與譯名。zh-tw、zh-hant 欄位偶爾被填了簡體（2026-10 有 15 個，例如「约翰·巴丁」），所以每個名稱都再用 `sources/nobel.py` 的 S2T（`wikidata.S2T` 加上實際出現的簡體字）轉一次；坂、梶這類日文漢字 Big5 沒有，但不是簡體，不轉（建置時會印出來）。沒有中文名稱的（勒·克萊喬）顯示英文原名。由簡體轉來的名稱是大陸譯名換成繁體字，不一定是台灣慣用的譯名。
    - **側欄的名單**：`countries/<ISO3>.json` 一個獎一列（`[id, 中文名, 英文名, 年份, 獎項, 得獎理由, 出生地]`），依子項目與時間軸的年份篩選，前 10 筆以外收在「顯示其餘」。出生地照 API 的寫法（「Breslau, Germany (now Wroclaw, Poland)」），得獎理由是英文原文（`lang="en"`）；英文名與地名標 `translate="no"`。`countries/index.json` 列出有檔的國家，沒有的直接顯示「沒有在這裡出生的得主」，不會發出 404 的請求。

41. **台灣的外交**（`pipeline/topics/taiwan_diplomacy.py`、`pipeline/sources/mofa.py`、`boca.py`、`allies.py`、`pdfreader.py`）：
    - **從台灣看世界**：台灣是觀點，所有檔案都沒有 TWN。中國大陸、香港由陸委會主管（兩岸關係、台胞證、網上預辦入境登記），外交部與領事事務局的資料都沒有，三個指標都不上色；澳門在領務局的免簽證名單裡（30 天，請洽陸委會），所以簽證有澳門。側欄點台灣、中國、香港時顯示說明。
    - **邦交國的歷史沒有開放資料**：
      - 外交部只公布目前的邦交國；外交年鑑沒有逐國的建交、斷交表。
      - Wikidata 的 Q865（台灣）P530 列了將近 200 國（連有代表處的都算），起訖日期大多是空的、有的是錯的（千里達 1950 年結束），不能用。
      - ICPSR 30802（Rich, 1950–2007）要登入、禁止再散布，不用。
      - 所以 `allies.py` 依外交部的建交、斷交公告整理成一張表（104 國、每段的建交與斷交日期），每一筆都跟維基百科「中華民國外交關係年表」（逐年國家數＋日期）與英文維基「Foreign relations of Taiwan」的斷交表比對過。日期是史實，表是自己整理的；資料來源把維基百科列為「交叉比對」並註明 CC BY-SA 4.0。
      - `allies.CHECK_COUNTS` 是年表的逐年國家數（扣掉下面三個例外），年表有寫國家數的 39 個年份全部一致（1950–2026 年之間）；資料管線每次都重算，對不上會報錯。
      - 今年的邦交國要跟外交部通訊錄裡有大使館的國家一致（目前 12 國），對不上會報錯：有新的建交、斷交時改 `allies.HISTORY`。
    - **邦交國的算法**：
      - 每年 12 月 31 日的狀態（跟外交部年底的邦交國數同一個算法），起點是 1949 年底政府遷臺時仍承認中華民國政府的 47 國（建交日期寫 None；含只有領事級關係的錫蘭、沙烏地、南非、瓜地馬拉、尼加拉瓜、紐西蘭）。
      - 同一年建交又斷交的（1962 年寮國、1999 年巴布亞紐幾內亞、2004 年萬那杜）不會出現在當年的地圖上，之後算「曾經是邦交國」。
      - 「曾經是邦交國」= 1949 年底以後有過邦交、後來斷交（英國等 1950 年 1 月斷交的也算）；蘇聯、印度、緬甸等 1949 年 10–12 月就斷交的算「沒有邦交」。
      - 年表有算、這裡沒有算的：越南共和國（南越，1955–1975，今天沒有對應的國家，把整個越南塗成邦交國會誤導）、只有領事關係的馬來西亞（1964–1974）與拉脫維亞（1992–1994）。所以 1955–1974 年少 1–2 國：1969 年常說的 70 國，這裡是 68 國。三國在側欄有附註（還有柬埔寨 1953–1958 只有總領事館）。
      - 非國家的地區（海外領地等，`DEPENDENCIES`）不畫；庫克群島、紐埃、科索沃、巴勒斯坦、索馬利蘭算國家（沒有邦交）；吐瓦魯在 1:50m 沒有形狀，但有值（排名表、搜尋、側欄找得到，館處點也畫得出來）。殖民地在獨立以前也是「沒有邦交」（沒有獨立年份的資料）。
      - 檢查用的數字：1969 年 68 國、1971 年 54、1979 年 22、1990 年 28、2000 年 29、2008 年 23、2018 年 17、2024 年起 12 國。
    - **駐外館處**（data.gov.tw 6119「駐外館處通訊錄」，JSON、UTF-8 有 BOM，`https://www.mofa.gov.tw/OpenDataForm.aspx?s=A185CB194559BCF5`，每 10 天更新）：
      - 111 筆（「駐歐盟兼駐比利時代表處」在歐盟與比利時各一筆，只留比利時），71 國：大使館 12、總領事館 1（巴拉圭東方市）、代表處 59、辦事處 38、常駐世界貿易組織代表團 1。
      - 駐在國是正式國名（「美利堅合眾國」「史瓦帝尼王國（原「史瓦濟蘭王國」）」），`mofa.COUNTRIES` 對照，有新的國名會報錯。
      - 類型依名稱：大使館、總領事館、常駐國際組織；簡稱有「代表處／代表團／代表部」的算代表處，其他算辦事處；沒有大使館也沒有代表處的國家，唯一的館處就是主要館處（駐葡萄牙台北經濟文化中心、駐斐濟臺北商務辦事處、駐杜拜辦事處），也算代表處。
      - 駐關島、駐檀香山辦事處的駐在國是美國，館處數算美國（13 個）；但「駐外館處」類別圖上關島也算「有辦事處」（點的位置在關島）。
      - 駐教廷大使館的地址在羅馬，點放在梵蒂岡城。
      - **沒有經緯度**：用 Natural Earth 1:10m populated places（完整版 19 MB，公有領域，v5.1.2）找城市：在駐在國（美國另加關島、波多黎各等領地）的城市裡，名稱（英文、各國語言、日文、韓文、繁中）出現在館處英文名稱（3 分）、地址（2 分）、中文名稱（1 分）裡的，同分取名稱較長、人口較多的。找不到的大使館、代表處用首都（坎培拉的地址只寫 Barton ACT、哥本哈根寫 København K、布宜諾斯艾利斯寫 C.A.B.A.），關島用 Agana。
      - 陷阱：Natural Earth 有些城市的外語名稱欄位填的是國名（Portalegre 的某個欄位是「Portugal」、Hail 是「Saudi Arabia」），會把館處放錯城市，所以國名一律不算城市名稱。
      - 精度是城市中心，不是實際地址（通常差幾公里，例如駐邁阿密辦事處實際在 Coral Gables），量化到 0.01°。日內瓦有兩個館處（辦事處與 WTO 代表團），第二個往東錯開 0.06° 才滑得到。
    - **兼轄館處**：領事事務局「各國暨各地區旅遊及消費者保護資訊」的國家清單（`https://www.boca.gov.tw/sp-foof-countrylp-03-1.html`，222 個國家／地區），沒有館處的寫「（兼轄館處：駐…）」，151 國／地區。名稱跟外交部通訊錄不完全一樣（臺／台、有沒有「台北」、括號附註），比對時都去掉；巴基斯坦的「台北經濟文化辦事處/大陸委員會香港辦事處」是陸委會的機構，不在外交部通訊錄裡，側欄另外寫英文名稱。國家清單裡的英文名稱有「Naoero」（諾魯）、「Argentine」、「Italia」、「Bosnia」這類寫法，`boca.EN_ALIASES` 對照；中文名稱也可能有括號（「庫克群島(自治政府) (Cook Islands)」）。
    - **簽證待遇**（data.gov.tw 30749，政府資料開放授權條款第 1 版）：
      - 開放資料本身是 RSS（`https://www.boca.gov.tw/rss-37-1.xml`），名單在 RSS 附的 PDF（每次更新網址都會變，`dl-<編號>-<雜湊>.html`），先讀 RSS 找 PDF。RSS 與 PDF 都有快取，**要抓新版得加 `--refresh`**。
      - PDF 是 Word 匯出的表格，Git for Windows 的 `pdftotext` 預設編碼讀不出中文（要 `-enc UTF-8`），而且依版面輸出時左右欄對不起來；為了不加依賴、也不靠外部程式，寫了 `pdfreader.py`（標準函式庫：FlateDecode、物件串流、Type0 字型的 ToUnicode、文字定位、填色矩形）。表格依框線切儲存格：同一欄上下兩條橫線、左邊有直線才算；右欄的合併儲存格（一段說明對兩列）、跨頁的列（下一頁第一列左欄是空的）都處理了。超連結的底線也是細的填色矩形，寬度不到整格，所以要求橫線涵蓋整格的寬度。
      - Word 左右對齊時字與字之間會有空隙（「波 士 尼 亞」「Sau di Arabia」），片段之間的空隙大於字高 0.12 倍才補空白，中文之間的空白全部拿掉。
      - 三節：一、免簽證；二、落地簽證；三、電子簽證。免簽證的說明裡寫了 ESTA、eTA、ETA、「旅行授權」的另外分一類「免簽證（需事先上網申請旅行授權）」：美國（含波多黎各、美屬維京群島，說明裡寫明；不含美屬薩摩亞）、加拿大、英國、紐西蘭、以色列。關島、北馬里安納群島另外列為免簽證（45 天）。
      - 同一國出現在好幾節（阿曼免簽證 14 天、也可落地簽、電子簽；菲律賓免簽證 14 天到 2027-06-30、也有電子旅遊憑證）時取最方便的一種，側欄列出全部。
      - 國家清單裡有、名單裡沒有的是「需事先申請簽證」（54 國／地區）；兩邊都沒有的不上色（巴勒斯坦、西撒哈拉等）。
      - 數字（2026-10-22 版）：免簽證 101、需旅行授權的免簽證 7、落地簽證 30、電子簽證 37、需事先申請 54（依地圖的國家／地區代碼算：波奈、沙巴、聖佑達修斯合在 BES 一個；申根區 35 個國家／地區（含法羅群島、格陵蘭、教廷）各算一個）。
      - 照領務局的分類：肯亞（2024 年起全面 eTA）、澳洲（ETA 是電子簽證）列在電子簽證；阿聯只有全程搭阿聯航空、杜拜轉機的 96 小時過境電子簽證，也列在電子簽證；歐盟的 ETIAS 還沒上路，名單沒提。
      - 側欄的停留天數由說明的開頭（或「可停留」「停留不超過」「最多」這類寫法）抽出來，換成中英文；完整說明（去掉網址與「請參閱簽證及入境須知」）只在中文介面顯示，英文介面只有類別與天數。
      - 顏色用發散色（`diverging`）：從「需事先申請」（橘）經「落地簽證」（中性）到「免簽證」（青綠）。用循序色的話 5 類會用到最深的兩階橘色，免簽證與需要旅行授權的免簽證在地圖上分不出來。
    - **授權**：外交部駐外館處通訊錄與領務局免簽證名單都是政府資料開放授權條款第 1 版（data.gov.tw 的 license 欄位是 1）；領務局國家清單是網站內容，網站的「政府網站資料開放宣告」採同一個條款。Natural Earth 公有領域。邦交國日期見上面（史實，自己整理；比對用的維基百科是 CC BY-SA 4.0）。
42. **生育率與高齡化**（`pipeline/topics/fertility.py`、`src/topics/panels/FertilityPanel.tsx`）：
    - 總生育率、出生數用 WPP 的人口動態指標檔（跟人口主題同一個檔）；65 歲以上比例與扶老比用五歲年齡組人口（`WPP2024_PopulationByAge5GroupSex_Medium`，1950–2100）自己算，世界的值用 WPP 的世界列，不是各國加總。
    - 人口金字塔每國一個檔（`countries/<ISO3>.json`，1950–2100 每年男女各 21 組），用指標檔同一種差分編碼，但整個國家共用一個指數，最大的一組保留 4 位有效數字（台灣是千人），237 國共 4.5 MB、gzip 後 1.4 MB，點國家才載入。金字塔用 HTML 長條畫（2026-10-29 以前的 ECharts 只註冊了折線圖）。
    - 台灣維持 WPP（跟人口主題一致）：2023 年以前跟內政部很接近（總生育率 0.87 對 0.865、65 歲以上 18.33% 對年底 18.35%，出生數少約 2%）。但 2024 年起 WPP 是推估，2025 年台灣實際的總生育率掉到 0.695、出生 107,812 人，WPP 推估 0.86、12.5 萬人。只把台灣這兩年換成內政部的數字，會跟 WPP 2026 年以後的推估接不起來，所以差異寫在附註。國發會 2026 年 8 月的人口推估（中推估 2075 年總生育率 0.8、65 歲以上 52.9%）比 WPP（2075 年 1.22、42.9%）悲觀很多，也寫在附註；國發會的網站（pop-proj.ndc.gov.tw）有 Cloudflare 驗證，這幾個數字取自國發會新聞稿的媒體轉述。
    - 總生育率用發散色：門檻 [1, 1.5, 1.9, 2.3, 3.5, 5]，中性的一級（1.9–2.3）跨過替代水準 2.1，低於替代水準是橘色（跟人口年增率的「減少橘、增加綠」一致）。65 歲以上比例的門檻含 7%、14%、20%（高齡化、高齡、超高齡社會）。扶老比 [10, 15, 20, 30, 40, 60]，2023 年日本 50、台灣 26。
43. **治安與司法**（`pipeline/topics/crime.py`、`pipeline/sources/wgi.py`、`npa.py`；監禁人口率是 `eurostat.py`、`moj.py`、`bjs.py`、`statcan.py`、`abs_prisoners.py`、`moj_jp.py`）：
    - 故意殺人率用世界銀行轉載的 UNODC 資料（`VC.IHR.PSRC.P5`，女性、男性是 `.FE.P5`、`.MA.P5`，分母是同性別的人口），CC BY 4.0。UNODC 自己的資料入口多了最新一年與被害人數，但條款不准轉載（見第 12 點），所以沒有用。各國不是每年都有，指標檔加 `latestWithin: 5`；台灣有 2025 年的資料，所以時間軸到 2025。全部、女性、男性三個指標用同一組門檻 [0.5, 1, 2.5, 5, 10, 25]，才能互相比較（世界 2023 年：全部 5.2、女性 2.1、男性 8.3）。
    - **監禁人口率只收有開放授權資料的國家**：涵蓋各國的只有 UNODC 資料入口的「監獄與受刑人」（data.unodc.org/datareport/prison-held 的 `data_cts_prisons_and_prisoners.xlsx`，2003 年起，有在監人數、每十萬人比率與未判決比例 SDG 16.3.2）與 World Prison Brief，兩個都不能轉載（見第 12 點）。聯合國 SDG 全球資料庫有未判決比例（`VC_PRS_UNSNT`），但沒有在監人數，網站也找不到資料授權，同樣沒有用。
      - **使用者的決定（2026-10-25，「1C」）**：把監禁人口率加回來，但只用有開放授權的各國、各區域來源，沒有這種資料的國家維持灰色。所以地圖只有 44 國（歐洲 39 國、台灣、美國、加拿大、澳洲、日本），是刻意的；頁尾的說明寫明原因。
      - **沒有資料的國家寫原因**：指標的 `coverage`（第 4 節的表）：`src/topics/crime.ts` 的 `PRISON_COVERAGE` 以外的國家，tooltip 與側欄寫「沒有開放授權的資料」，不寫「無資料」；有收的國家某一年沒有值照常寫「無資料」（例如英國 2021 年以後）。`crime.py` 會比對 `PRISON_COVERAGE` 跟算出來的國家，不一致就報錯並印出正確的清單，加新的來源時兩邊一起改。
      - **分母**：人數一律 ÷ WPP 的年中人口（`TPopulation1July`），跟其他主題同一個分母，所以跟各國自己公布的比率不完全一樣（波蘭 2024 年 181.2，Eurostat 用自己的人口算是 190.7；土耳其 438.6 對 449.4）。兩個例外：法國的監獄人數含海外省，分母加上 WPP 分開算的瓜地洛普、馬丁尼克、留尼旺、法屬圭亞那、馬約特（117.3，Eurostat 117.5）；賽普勒斯的監獄只在政府控制地區，WPP 的人口含北賽普勒斯（÷ WPP 只有 71），改用 Eurostat 公布的每十萬人比率（`P_HTHAB`，2008 年起）。
      - **各國的定義**（都含審前羈押；差異寫在各國的附註）：
        - 歐洲 39 國：Eurostat `crim_pris_cap` 的「Actual number of persons held in prison」（2008 年起），1993–2007 年接舊的 `crim_pris_pop`（兩者是不同的資料集，不完全可比，附註寫明）。某一天在監獄、矯正機構裡的人，不含移民拘留；參考日一般是 12 月 31 日，丹麥 9 月 1 日、德國 11 月 30 日或 3 月 31 日、斯洛維尼亞 1 月 31 日、瑞典 10 月 1 日、挪威 1 月 1 日、瑞士隔年 1 月 31 日（`crim_sims` 中繼資料）。英國是英格蘭與威爾斯（`UKC-L`）、蘇格蘭（`UKM`）、北愛爾蘭（`UKN`）三個加起來（`eurostat.series()` 的 `extra_geos`），三個都有的年份才算，只到 2017 年。
        - 台灣：法務部《法務統計年報》表 4-1 的「矯正機關總收容人數」（年底），含監獄收容人、看守所的被告及被管收人、少年矯正學校、少年觀護所、觀察勒戒與強制戒治；跟法務部、行政院人權指標的「每十萬人中收容於矯正機關之人數」同一個分子。網站只有 113、114 年版的年報，合起來是 2015–2025 年（ODS 檔，用 zipfile 讀，不必另裝套件）；常用統計表的同一張表（`list_id=1216`）只列最近 4 年。
        - 美國：BJS《Correctional Populations in the United States》表 1 的「Incarcerated」總數：州立與聯邦監獄（12 月 31 日）加上地方看守所（6 月最後一個平日，大多是候審的被告），扣掉重複計算；不含少年矯正機構、移民拘留（ICE）、軍方監獄、海外屬地。2023 年版有 2013–2023 年、2022 年版補 2012 年、2016 年版補 2000、2006–2011 年（欄位順序不同，在監合計都是每列第 5 個數字）。2023 年 1,852,900 人，539.5。
        - 加拿大：省與地方監獄的「Total actual-in count」（已判決、羈押候審、其他暫時拘留）加上聯邦監獄的「Actual-in count」，都是會計年度的平均每日人數，2023/2024 年度記在 2023 年；只算成年人。省與地方的合計是「有報的轄區」的合計，有轄區沒報的年度（2013/2014 亞伯達、2021/2022 與 2022/2023 紐芬蘭與拉布拉多等）不收。
        - 澳洲：ABS 每年 6 月 30 日的成人監獄人數（含未判決），2016–2025 年；ABS 公布的是每十萬名成年人（2025 年 216.4），這裡 ÷ 總人口是 174.2。
        - 日本：犯罪白書 2-4-2-1 圖的 Excel（1946 年起，資料來自矯正統計年報）：12 月 31 日刑事施設（刑務所、少年刑務所、拘置所）的收容人員，含被告人、被疑者、死刑確定者、労役場留置者；不含少年院、少年鑑別所與入管的收容設施。2024 年底 40,544 人，32.8。
      - **台灣的抽查**：法務部 2025 年底總收容人數 63,314 人（法務統計年報表 4-1、常用統計表、行政院人權指標 ODS 一致）；法務部的監禁人口率 271.7（÷ 年底戶籍人口 2,330 萬），這裡 ÷ WPP 2025 年中人口 2,311 萬是 273.9。原本只寫在主題說明的數字移到資料裡，說明改成寫涵蓋範圍。
      - **門檻**：[50, 75, 100, 150, 250, 400]：日本、冰島 30 多；北歐、德國、荷蘭、瑞士 55–75；西歐、加拿大 95–125；東歐、澳洲 150–190；台灣 274；土耳其 439、美國 540 在最高一級。指標檔加 `latestWithin: 3`（各國大多每年都有，偶爾缺一兩年；美國、加拿大最新到 2023 年）。排名由高到低（不是 `lowerIsBetter`），沒有世界合計（只收部分國家）。
      - **英文的指標名稱取短的**：加了第五個指標後，原本的 Homicide rate、Female homicide rate、Male homicide rate 加上 Imprisonment rate、Rule of law 在 1280px 寬時英文的控制列換成兩行（指標 772px，右邊的底圖、搜尋、地圖／排名表、分享 616px，控制列 1,248px），改成 Homicide、Female victims、Male victims、Prison rate、Rule of law（575px）；中文五個都是五個字（518px），不用改。說明文字（description）仍寫完整的「per 100,000 women」等。
    - **台灣的故意殺人**：警政署統計查詢網（ba.npa.gov.tw，跟內政部統計查詢網同一套系統）的「故意殺人」發生數與被害人都含未遂，沒有分既遂（2021 年致死約 122 件，發生數 212 件）。所以地圖用衛福部死因統計的加害（他殺，ICD-10 X85–Y09、Y87.1）死亡人數 ÷ WPP 年中人口，男女分開算（死因統計的 sex 1 是男、2 是女），2008 年起；警政署的數字寫在附註（2025 年發生 158 件、被害人 193 人，同年他殺死亡 139 人）。2024 年 9 月起警政署部分刑案改成「1 被害人 1 發生數」。
    - **法治分數**：WGI 2025 年改版後的 0–100 治理分數（`GOV_WGI_RL.SC`，估計值的線性轉換，以假想的最差與基準國家定錨，越高越好），World Bank API 的 source 3。台灣（「Taiwan, China」）、法屬圭亞那、馬丁尼克、留尼旺、安圭拉、庫克群島、紐埃、澤西在 API 裡的代碼欄是空的，依名稱對照（`wgi.NAMES`）。1996、1998、2000 年，2002 年起每年。是 30 多個調查與評估的看法綜合，不是犯罪統計；2025 年台灣 78.4、南韓 78.3、日本 84.0、美國 71.7、芬蘭 91.8（最高）。政府治理主題用同一份資料（WGI 的六個面向，第 73 點），兩邊的說明互相指到對方。
44. **幸福感**（`pipeline/topics/happiness.py`、`src/topics/panels/HappinessPanel.tsx`）：
    - 只用 WHR 公開的「Data for Figure 2.1」（`WHR26_Data_Figure_2.1.xlsx`，一個檔有 2011–2025 年，每年一列：名次、近三年平均、95% 信賴區間、六個解釋因素與「反烏托邦＋殘差」）。蓋洛普的原始資料要訂閱，沒有用。
    - **年份**：檔案的「Year」是三年的最後一年（2025 = 2023–2025 年的調查，《世界幸福報告 2026》公布），照用；側欄寫「《世界幸福報告 2026》排名」（年份 + 1）。2013 年沒有（沒有 2014 年版的報告）。因素拆解從 2019 年（報告 2020 年版）起才有。
    - **國名**：台灣是「Taiwan Province of China」、香港「Hong Kong SAR of China」、「Lao PDR」、「Côte d’Ivoire」（彎引號）要自己對照；北賽普勒斯、索馬利蘭在 WHR 的排名裡、地圖上也有形狀（`_CYN`、`_SOL`），一起收，名次總數才跟報告一樣（2025 年 147 國）。Swaziland（2020 年以前）與 Eswatini 是同一國。
    - **名次**：排名表與側欄的名次依分數算（同分同名次），報告用沒有四捨五入的分數排，檔案只給到小數 3 位，所以 2,200 多筆裡有 40 筆跟報告差 1（例如 2025 年阿聯 6.821 跟另一國同分，報告是第 21 名）。側欄另外列出報告公布的名次（`rank.json`）；分數顯示到小數 3 位，跟報告一樣。
    - 只有一個地圖指標：名次是分數的排序，畫成地圖（顏色越深名次越差）跟分數的地圖重複又容易看反，所以放在側欄。分級 [4, 5, 5.5, 6, 6.5, 7]：2025 年中位數 5.94，台灣 6.714（第 26 名），芬蘭 7.764 最高、阿富汗 1.45 最低。
    - 台灣比對：《世界幸福報告 2026》第 26 名 6.714、2025 年版第 27 名 6.669、2024 年版第 31 名 6.503，跟報告的排名表一致。
45. **護照與簽證**（`pipeline/topics/passport.py`、`pipeline/sources/passport_index.py`、`src/topics/passport.ts`、`src/topics/panels/PassportPanel.tsx`）：
    - **來源**：Passport Index（Arton Capital 的 passportindex.org）沒有提供下載，大家用的是 GitHub 上從網站整理出來的 CSV。
      - 原本的 ilyankou/passport-index-dataset（2019 年起，MIT）最後一版是 2025-01-12（commit `a46dbc8`），2026-02-18 封存，README 寫明 2026 年 2 月以後的資料改看 imorte/passport-index-data。
      - 所以用接手的 imorte/passport-index-data（MIT，README 寫「Last updated: 17 February 2026」），固定在 commit `9c59780dd0dbaefcbdfa0134d21cd99d0d547509`（2026-03-01），從 `https://raw.githubusercontent.com/imorte/passport-index-data/9c59780dd0dbaefcbdfa0134d21cd99d0d547509/passport-index-tidy-iso3.csv` 下載（685,681 位元組，`common.download` 快取成 `pipeline/.cache/passport-index/9c59780-passport-index-tidy-iso3.csv`）。這個 repo 之後沒有再更新（`history/` 是空的）。
      - 兩版跟領事事務局 2026-10-22 版的名單比，台灣護照的類別一致的目的地：舊版 140／195、新版 142／195；新版有菲律賓免簽 14 天、以色列 ETA-IL、2025 年 6 月美國對 12 國的全面入境禁令這類 2025 年的變化，所以用新版。
      - 格式：`Passport,Destination,Requirement` 三欄、199 × 198 列（自己的護照是 `-1`），代碼是 ISO alpha-3（科索沃 XKX），跟地圖一樣。值不認得（例如舊版的 `covid ban`）、欄位變了、某本護照缺目的地都會報錯。
      - **要換新版**：改 `sources/passport_index.py` 的 `COMMIT`、`DATA_DATE`，`src/topics/passport.ts` 的 `DATA_DATE`、指標說明與頁尾寫的日期；資料管線會檢查 TS 的 `DATA_DATE` 一致。
    - **類別代碼**（`sources/passport_index.py`）：1–5 刻意跟台灣的外交主題的 `VISA`（`sources/boca.py`）相同，側欄直接比代碼。
      - 1 免簽證：天數（7–360）或 `visa free`（天數不明或不適用，例如歐盟境內自由移動；塞席爾的旅客登記、新加坡與馬來西亞的入境卡也算）。天數另外存在 `visa/<護照>.json` 的 `days`，側欄寫「日本（90 天）」；tooltip 只有類別。
      - 2 免簽證（需旅行授權）：`eta`（美國 ESTA、加拿大 eTA、英國 ETA、澳洲 ETA／eVisitor、肯亞 eTA、蘇利南觀光卡等）。
      - 3 落地簽證、4 電子簽證（不含 eta）、5 需事先申請簽證（含古巴觀光卡；資料集把中國大陸居民去港澳的往來港澳通行證也算在這裡）、6 不准入境（`no admission`：旅行禁令、戰爭等，資料集沒有寫個別原因）。
      - 7 另用通行證（兩岸、港澳）：不是資料集的分類，見下面。
    - **地圖的顏色**：發散色，從難到容易排 6 類，一邊 3 類、沒有中間的中性色：不准入境、需事先申請、電子簽證是橘色（出發前要拿到核准），落地簽證、免簽證（需旅行授權）、免簽證是青綠（出發前不必等核准）。青綠的三類剛好就是「護照實力」算進去的三類。台灣的外交主題是 5 類、落地簽證放在中間的中性色；這裡多了「不准入境」，而且要跟護照實力的定義一致，所以落地簽證放在青綠那一側。「另用通行證」是類別圖的 `other`（淺的中性色），圖例一直列著，大多數護照是 0。
    - **兩岸與港澳**（`passport.py` 的 `PERMIT_PAIRS`，6 組）：這幾組實際上用通行證或許可入境、不用護照，資料集的分類不符合實情，改列為 7「另用通行證」，也不算進護照實力與開放程度；原本的類別存在 `recoded`，側欄寫「中國（Passport Index 原列「免簽證」）」。
      - 台灣 → 中國大陸：資料集是免簽證（`visa free`），實際上用台胞證（臺灣居民來往大陸通行證）。
      - 中國大陸 → 台灣：資料集是需要簽證，實際上用大陸居民往來台灣通行證加上中華民國臺灣地區入出境許可證。
      - 中國大陸 → 香港、澳門：資料集是需要簽證（README 寫明是往來港澳通行證）。
      - 香港、澳門 → 中國大陸：資料集是免簽證，實際上用港澳居民來往內地通行證（回鄉證）。
      - 用護照的照資料集：台灣 → 香港免簽證 30 天（要先網上預辦入境登記，附註有寫）、台灣 → 澳門免簽證（領事事務局寫 30 天）；香港、澳門 → 台灣是落地簽證。台灣、中國、香港、澳門四本護照的三個指標檔都有附註（`notes`／`notesEn`）。
      - 台灣的外交主題裡中國大陸、香港不上色（陸委會主管）；這個主題是 199 本護照互看，資料集本來就有這幾格，所以改成一個中性的類別，不留白。如果要完全照資料集，把 `PERMIT_PAIRS` 清空即可（台灣的護照實力會變 113）。
    - **護照實力**（`power.json`）：免簽證、需旅行授權的免簽證、落地簽證的目的地數，最多 198。
      - 跟 Henley Passport Index 的算法一樣（免簽證、落地簽證、visitor's permit、ETA 都算 1 分，出發前要政府核准的電子簽證不算）。
      - Passport Index 網站自己的 Mobility Score 另外算「3 天內核發」的電子簽證（about 頁的 Methodology），資料集沒有核發天數，沒辦法照算，所以這裡的數字比網站小（台灣 112）。指標說明有寫。
      - 門檻 50、75、100、125、150（6 級，各級 35、50、19、26、26、43 國）。
    - **開放程度**（`openness.json`）：其他 198 本護照裡，有幾本可以這樣入境這國（同樣不算兩岸港澳的通行證）。網站的「Welcoming Rank」只算免簽證與落地簽證，這裡跟護照實力一致也算旅行授權。門檻 25、50、75、100、150、190（7 級）。11 國對 198 本都開放；阿富汗、北韓、土庫曼是 0。
    - **指標名稱**：英文寫「Visa access」，標題是「Taiwan visa access」；原本的「Passport visa requirements」在 1280px 寬時英文的控制列會換成兩行。
    - **子項目（護照）**：199 本，`followsSelection`（點地圖、排名表、搜尋選到國家就換成那本護照，選到的國家自己那格寫 `selfLabel`「本國護照」）。
      - 選單的國名不寫進首頁 bundle：`REGIONS` 只放「ISO3:ISO2」（9 個地區，大致依聯合國 M49，賽普勒斯放歐洲），國名用 `lib/countries` 的 `countryName()`（Intl.DisplayNames，跟地圖、側欄同一套）；`options` 是 getter，第一次打開這個主題才查國名，其他主題不必做。`followsSelection` 的子項目選單由 App 依目前語言的國名排序（`groupOptions()`，中文依筆畫、英文依字母），各地區的順序照 `REGIONS`。
      - `NOT_COVERED`：地圖上有形狀、資料集沒有的 42 個地方（沒有自己護照的屬地、庫克群島、紐埃、西撒哈拉、索馬利蘭、北賽普勒斯等），用主題的 `noValue` 寫「Passport Index 沒有收這個地方」，不寫「無資料」。吐瓦魯在資料裡、1:50m 沒有形狀（排名表、搜尋找得到）。
      - 資料管線會檢查 `src/topics/passport.ts` 的 `REGIONS`（ISO2 要跟 `countries.json` 一樣、199 本剛好各一次）、`NOT_COVERED`（= 地圖的代碼 − 資料集的護照）與 `DATA_DATE`，對不上就報錯並印出正確的值。
    - **資料檔**：`visa/<ISO3>.json` 199 個（每個 2.5–3.7 KB，一般的指標檔，年份 `[2026]`，另外有 `days`、`recoded`）、`power.json`、`openness.json`（各 5 KB）、`manifest.json`（`dataDate`、commit）。整個資料夾 591 KB（磁碟上約 0.9 MB）。
    - **單一快照**：照語言主題的做法標示為 2026 年（時間軸寫「只有單一時間點」），指標說明、頁尾、側欄寫出資料日期 2026-02-17。到 2026 年 10 月已經 8 個月，跟 10 月的領事事務局名單已有不少差異（見下面的比對）。
    - **台灣護照跟領事事務局名單的比對**（側欄即時算：讀台灣的外交主題的 `visa.json` 與 `manifest.json`，代碼相同直接比；資料管線也會印出同樣的摘要）：
      - 台灣護照（Passport Index）：免簽證 73（含香港 30 天、澳門、巴勒斯坦）、需旅行授權 11、落地簽證 28、電子簽證 44、需事先申請 38、不准入境 3（古巴、喬治亞、摩爾多瓦）、另用通行證 1（中國大陸），護照實力 112（第 83 名），開放程度 74（第 143 名）。
      - 領事事務局（2026-10-22 版）兩邊都有的 195 個目的地：類別相同 142、不同 53。只看「出發前要不要核准」（1–3 對 4–6）的話不同的是 26 個，169 個一致。只有 Passport Index 有的是中國大陸、香港、巴勒斯坦；只有領事事務局有的是關島、波多黎各、法屬玻里尼西亞等 34 個屬地。
      - 不同的 53 個（領事事務局 → Passport Index）：

        | 領事事務局 | Passport Index | 數量 | 目的地 |
        |---|---|---|---|
        | 需事先申請 | 電子簽證 | 15 | 巴哈馬、玻利維亞、波札那、剛果民主共和國、哥倫比亞、蓋亞那、伊拉克、吉爾吉斯、利比亞、獅子山、薩爾瓦多、索馬利亞、南蘇丹、聖多美普林西比、查德 |
        | 需事先申請 | 落地簽證 | 5 | 蒲隆地、幾內亞比索、斯里蘭卡、諾魯、索羅門群島 |
        | 落地簽證 | 需事先申請 | 5 | 孟加拉、白俄羅斯、牙買加、黎巴嫩、烏茲別克 |
        | 落地簽證 | 電子簽證 | 5 | 巴林、加彭、哈薩克、賴比瑞亞、塔吉克 |
        | 電子簽證 | 需事先申請 | 4 | 安哥拉、阿根廷、賴索托、千里達及托巴哥 |
        | 電子簽證 | 需旅行授權 | 4 | 澳洲、象牙海岸、肯亞、蘇利南 |
        | 電子簽證 | 落地簽證 | 4 | 吉布地、莫三比克、馬拉威、沙烏地阿拉伯 |
        | 需事先申請 | 不准入境 | 2 | 喬治亞、摩爾多瓦 |
        | 免簽證 | 落地簽證 | 2 | 阿曼、薩摩亞 |
        | 落地簽證 | 免簽證 | 2 | 塞席爾、萬那杜 |
        | 電子簽證 | 不准入境 | 1 | 古巴 |
        | 免簽證 | 需旅行授權 | 1 | 聖克里斯多福及尼維斯 |
        | 需事先申請 | 免簽證 | 1 | 尼加拉瓜 |
        | 需事先申請 | 需旅行授權 | 1 | 巴布亞紐幾內亞 |
        | 免簽證 | 電子簽證 | 1 | 尚比亞 |

      - 可能的原因：
        - **日期與更新的快慢**：Passport Index 是 2026 年 2 月、領事事務局是 10 月，兩邊也不一定同時跟上各國的變動。例如尼加拉瓜 Passport Index 是免簽 90 天、領事事務局是需事先申請；尚比亞領事事務局是免簽證（一年最多 90 天）、Passport Index 是電子簽證；古巴領事事務局寫 2025 年 7 月起全面實施電子簽證，Passport Index 是不准入境。
        - **分類方式**：領事事務局把澳洲的 ETA、肯亞的 eTA 列為電子簽證，Passport Index 列為旅行授權；塞席爾（落地核發「入境許可」）、萬那杜，領事事務局列落地簽證、Passport Index 列免簽證；線上申請的一般簽證（可能是哥倫比亞等國的情形），Passport Index 多列成電子簽證。
        - **同一國有好幾種方式**：台灣的外交主題取最方便的一種（阿曼免簽 14 天，也可落地簽、電子簽；巴林、加彭、哈薩克、塔吉克有落地簽也有電子簽），Passport Index 只有一個值。
        - **有條件的落地簽證**（只限某些機場、要有其他國家的簽證等）兩邊的取捨不同（孟加拉、白俄羅斯、烏茲別克）。
        - Passport Index 的「不准入境」沒有寫原因（喬治亞、摩爾多瓦、古巴），這裡照資料集，不另外推測。
      - 兩邊都是免簽證、天數不同的：泰國 60 天對 30 天、秘魯 180 對最多 90、多米尼克 180 對最多 3 個月、聖文森 90 對 30、史瓦帝尼 30 對 90；澳門 Passport Index 沒有天數（領事事務局 30 天）。
      - 申根區：兩邊都是每個國家各一格、各 90 天，側欄的天數沒有寫「180 天內合計 90 天」（台灣的外交主題的側欄有寫）。
    - **沒有的、限制**：
      - 只有 199 個發護照的國家與地區當目的地（聯合國 193 個會員國加台灣、香港、澳門、科索沃、巴勒斯坦、教廷），屬地不收（關島、波多黎各、格陵蘭等地圖上是「Passport Index 沒有收這個地方」）。
      - 落地簽證、旅行授權、電子簽證沒有天數；轉機、入境口岸、停留目的這類條件都沒有。
      - 中國、香港、澳門、台灣之間 6 格改列，見上面。
      - 資料集是從網站整理的二手資料，GitHub 上沒有逐格的來源；網站本身的條款頁 `https://www.passportindex.org/terms.php` 用 Cloudflare 擋了程式（HTTP 403），Wayback Machine 也沒有存檔，沒有讀到（見第 12 點的授權）。
    - **檢查用的數字**：全部 39,402 格（199 × 198）：免簽證 12,777、需旅行授權 1,099、落地簽證 5,440、電子簽證 7,965、需事先申請 12,067、不准入境 48、另用通行證 6。護照實力最高阿聯 169、南韓與新加坡 163、日本 162、西班牙 161，最低阿富汗 22、敘利亞 26、伊拉克與巴基斯坦 29；台灣 112（第 83 名）。
    - **驗證**（2026-10-23，無頭 Chrome）：中文、英文的地圖與圖例、滑到中國的 tooltip（「另用通行證（兩岸、港澳）」）、台灣側欄（附註、長條、目的地清單、跟領事事務局的比對表）、點日本後地圖與選單換成日本護照、選台灣時用選單換成日本護照（側欄先寫「持日本護照前往台灣：免簽證 · 90 天」）、格陵蘭（三張卡片都寫「Passport Index 沒有收這個地方」）、三個指標的排名表、375×812 手機；英文介面三個指標 × 三種畫面都沒有中文。

46. **武裝衝突**（`pipeline/topics/conflict.py`、`pipeline/sources/ucdp.py`、`src/topics/conflict.ts`、`src/topics/panels/ConflictPanel.tsx`）：
    - **來源**：烏普薩拉大學和平與衝突研究系的 UCDP（Uppsala Conflict Data Program）26.1 版（2026 年 6 月發布，涵蓋到 2025 年），下載頁 https://ucdp.uu.se/downloads/ 的 CSV 壓縮檔，直接從 zip 裡讀，不解壓：
      - UCDP Georeferenced Event Dataset（GED）Global 26.1（`ged/ged261-csv.zip`，39 MB，解壓後 274 MB、417,968 起事件，1989–2025）：每起事件有經緯度、當時的國家（Gleditsch–Ward 編號）、暴力類型（1 以國家為一方、2 非國家、3 單方面）、死亡人數的最佳估計（`best`）。
      - UCDP/PRIO Armed Conflict Dataset 26.1（`ucdpprio/ucdp-prio-acd-261-csv.zip`，46 KB，2,816 個衝突年、303 個衝突，1946–2025）：所在國（`gwno_loc`，可能好幾國）、強度（1 小型 25–999 人、2 戰爭 1,000 人以上）、衝突類型、爭議（領土／政府）。
      - 引用（下載頁「Please cite」）：Davies, Pettersson & Öberg (2026), Organized violence 1989–2025, and violent political protests, Journal of Peace Research（https://doi.org/10.1093/jopres/xjag046）；GED 另引 Sundberg & Melander (2013)；ACD 另引 Gleditsch et al. (2002)。都寫在頁尾的資料來源、`manifest.json` 的 `citations` 與 `ucdp.CITATIONS`。
      - 新版（27.1，預計 2027 年 6 月）要改 `ucdp.py` 的網址與 `VERSION`；ACD 每列有 `version` 欄位，不符會報錯。月更的 UCDP Candidate Events（2026 年 1–9 月）是未定稿的資料，沒有用。
    - **定義照 UCDP**（https://www.uu.se/en/department/peace-and-conflict-research/research/ucdp/ucdp-definitions）：
      - 以國家為一方的武裝衝突（state-based armed conflict）：對政府或領土的爭議，雙方使用武力、至少一方是國家政府，一年至少 25 人戰鬥死亡。戰鬥死亡含被波及的平民。
      - 非國家衝突（non-state conflict）：雙方都不是國家政府的有組織武裝團體之間，一年至少 25 人死亡（販毒集團、民兵、族群之間）。
      - 單方面暴力（one-sided violence）：國家政府或有正式組織的團體刻意攻擊平民，一年至少 25 人死亡；不含被拘押時的法外處決。
      - 死亡人數一律用最佳估計（best），UCDP 只算有可靠來源記錄的死亡，數字偏保守；指標說明與頁尾都寫了。
    - **只算 UCDP 認定為活躍的事件**（GED 的 `active_year` 為 true，404,803 起）：GED 也收錄同一個衝突／行為者在不到 25 人門檻的年份的事件（一個 dyad 跨過門檻以後，之後各年的事件都收）。全部加起來比 UCDP 公布的年度數字多約 0.4%；只算活躍的事件時，世界合計跟 UCDP 的年度資料集（Battle-Related Deaths、Non-State、One-sided Violence 26.1）逐年完全相同，也跟 UCDP 的新聞稿一致：
      - 2025 年 244,579 人（以國家為一方 153,643、非國家 14,483、單方面暴力 76,453）；UCDP 新聞稿：約 244,600、單方面暴力約 76,500（1994 年以來最高）、非國家約 14,500（2013 年以來最低）。含不活躍的事件是 245,464。
      - 2024 年 187,023 人（155,038、17,725、14,260）；2022 年 316,895；1994 年 823,507（單方面暴力 779,685，絕大多數是盧安達種族滅絕，所以單方面暴力與三類合計的比例圓圖例用 1 萬、10 萬、50 萬）。
      - 俄羅斯－烏克蘭 2025 年：地圖上烏克蘭 90,323 ＋ 俄羅斯 4,418 = 94,741，跟 Battle-Related Deaths 資料集的衝突 13243 相同（新聞稿「at least 94,700」）。
      - 畫面上的世界合計會被指標檔的壓縮（第 3 節）捨入到十位（153,640），國家的值是原數。
      - **沒有用 UCDP 自己的「Country-Year Dataset on Organized Violence within Country Borders」**：它也是 GED 依國家加總，但含不活躍的事件（數字跟公布的對不上），而且照 GED 把加薩走廊與約旦河西岸算在以色列（見下）。Battle-Related Deaths 資料集只有衝突層級，`battle_location` 常常好幾國（俄羅斯－烏克蘭寫「Russia, Ukraine」），分不出各國各多少，所以各國的戰鬥死亡從 GED 依事件地點加總，世界合計再拿 BRD 核對。
    - **國家歸屬（依事件發生的地點）**：GED 的 `country_id` 是事件當時的 Gleditsch–Ward 國家，`ucdp.GW_ISO3` 換成 ISO 代碼（GW 365「Russia (Soviet Union)」→ RUS、345「Serbia (Yugoslavia)」→ SRB、678／680 南北葉門 → YEM、816／817 南北越 → VNM、751 海德拉巴 → IND、711 西藏 → CHN、260／265 東西德 → DEU，新版出現沒列的編號會報錯）。原則上照 GED 的國家，只有事件落在「當時屬於那個國家、今天在地圖上分開畫」的地區時，依經緯度（點在多邊形內，地圖本身的 1:50m 形狀）改算在今天的國家（`SPLITS`，日期是 UCDP 開始把它當成獨立國家的日子）：
      - 以色列 → 巴勒斯坦（一律）：巴勒斯坦不在 Gleditsch–Ward 清單裡，GED 把加薩走廊與約旦河西岸的事件都記在以色列（`adm_1` 寫 Gaza Strip、West Bank）。`adm_1` 是這兩個的，或點在巴勒斯坦形狀裡的，算巴勒斯坦，10,550 起。不改的話 2024 年以色列會有 2 萬多人戰鬥死亡的比例圓，實際發生在加薩。
      - 摩洛哥 → 西撒哈拉、索馬利亞 → 索馬利蘭（地圖自己的形狀 `_SOL`，147 起）、賽普勒斯 → 北賽普勒斯（一律）。
      - 蘇聯（1991-12-21 以前）→ 亞塞拜然 52 起、喬治亞 18、亞美尼亞 5、吉爾吉斯、立陶宛、拉脫維亞各 3、烏茲別克 1。
      - 南斯拉夫（1992-04-27 以前）→ 波士尼亞 322 起、克羅埃西亞 258、斯洛維尼亞 15；（2006-06-03 以前）→ 蒙特內哥羅 6；（2008-02-17 以前）→ 科索沃 486。克羅埃西亞、斯洛維尼亞照 Gleditsch–Ward 是 1991-06-25 獨立，但 GED 記在南斯拉夫到 1992-04-21（記成 344 克羅埃西亞的事件從 1992-04-29 開始），所以跟波士尼亞一樣用 1992-04-27。
      - 衣索比亞（1993-05-24 以前）→ 厄利垂亞 65 起；蘇丹（2011-07-09 以前）→ 南蘇丹 878 起；印尼（2002-05-20 以前）→ 東帝汶 239 起；南非（1990-03-21 以前）→ 納米比亞 58 起。
      - 有日期限制的原因：獨立以後 GED 會直接記成新國家，還記在原本國家的是國界附近的事件（例如 1998–2000 年衣索比亞－厄利垂亞戰爭、2020–2022 年提格雷戰爭有 GED 記在衣索比亞、座標落在 1:50m 厄利垂亞形狀裡的事件，照 GED 算衣索比亞）。
      - 其他經緯度跟 GED 的國家不一致的事件（1:50m 國界的誤差、跨境攻擊，例如記在敘利亞、座標落在 1:50m 土耳其形狀裡的約 700 起）照 GED 的國家。
      - **克里米亞**：地圖的國界把克里米亞畫在俄羅斯的形狀裡（第 13 點），GED 把克里米亞的事件記在烏克蘭（2022–2025 年 41 起），照 GED 算烏克蘭，烏克蘭的附註有寫。
      - 每個改算的國家（與原本的國家）在死亡人數指標檔的 `notes`／`notesEn` 都有附註，寫出事件數與年份。
    - **0 跟無資料**：死亡人數的指標檔列出 `countries.json` 的 254 個國家與地區，1989–2025 年沒有事件的是 0（比例圓沒有圓、tooltip 寫「0 人死亡」），1989 年以前沒有資料（時間軸從 1989 年開始）。衝突數與強度也是 254 個、1946–2025 年都有值，沒有衝突是 0（最淺的一級／「沒有以國家為一方的武裝衝突」，跟無資料的灰色分開）。每十萬人死亡率只有 WPP 有人口的 237 個；索馬利蘭、北賽普勒斯的人口 WPP 算在索馬利亞、賽普勒斯，沒有死亡率，附註有寫。
    - **每十萬人**：三類合計 ÷ WPP 2024 的年中人口（2024、2025 年是中推估，跟諾貝爾獎主題一樣不設 `projectionFrom`）× 10 萬。分級門檻 > 0、1、5、20、50、100：第一個門檻 0.000001 把 0 跟「有死亡」分開，圖例寫「> 0」（最小的非 0 值是中國 2023 年 1 人，十萬分之 0.00007）。2025 年最高的是巴勒斯坦 259、烏克蘭 232、蘇丹 145，世界 3.0。
    - **衝突數與強度（ACD）**：
      - 所在國照 UCDP 的定義是「被挑戰的國家」，不是戰鬥發生的地方：國家間衝突是雙方政府的國家（2003 年伊拉克戰爭的所在國是澳洲、伊拉克、英國、美國；2024–2025 年紅海的衝突是英國、美國、葉門），國內衝突是政府被挑戰的國家。殖民地的獨立戰爭（extrasystemic）UCDP 已經把所在國寫成殖民地本身（阿爾及利亞戰爭在阿爾及利亞）。
      - **另外算進爭議領土**（`TERRITORY`，依衝突編號，`territory_name` 不符會報錯）：爭議領土今天在地圖上另成一國的衝突，也算在那一國。例如「Israel: Palestine」（所在國以色列）也算巴勒斯坦、1971 年「Pakistan: East Pakistan」也算孟加拉、「Ethiopia: Eritrea」（1964–1991）也算厄利垂亞、「Morocco: Western Sahara」也算西撒哈拉、「Serbia (Yugoslavia): Kosovo」也算科索沃、「Indonesia: East Timor」也算東帝汶、「South Africa: Namibia」也算納米比亞、1982 年福克蘭戰爭也算福克蘭群島、「Israel: Southern Lebanon」也算黎巴嫩、1946–1950 年蘇聯境內的愛沙尼亞、拉脫維亞、立陶宛、烏克蘭也算各國，共 25 個衝突。否則巴勒斯坦、孟加拉在這些年會是 0 個衝突。被加進來的國家的附註列出衝突名稱、年份與 UCDP 的所在國。
      - 衝突數：同一個衝突在同一國只算一次（南北越、南北葉門都對到同一國）。一國一年最多 7 個（1990 年代的印度），分級 1、2、3、5。
      - 強度：這一國這一年的衝突裡最高的一級，類別圖（循序色，戰爭最深）。
      - 核對：2025 年 65 個衝突、13 個戰爭、8 個國家間衝突，跟 UCDP 的新聞稿相同（1946 年以來最多；國家間衝突從 2023 年的 2 個變成 8 個）；2024 年 59 個、11 個戰爭；2023 年 59 個。
      - 衝突名稱：GED 有這個衝突就用 GED 的 `conflict_name`（UCDP 自己的寫法，「Russia - Ukraine」「Sri Lanka (Ceylon): Eelam」），1989 年以前的照同一個規則組出來（國家間是所在國用「 - 」連起來，其他是「國家: 爭議領土」或「國家: Government」）。
    - **台灣**：
      - GED（1989–2025）在台灣沒有任何事件：沒有記在 713（Taiwan）的，也沒有座標落在台灣形狀裡的，三類都是 0（資料管線檢查，有事件就報錯要改附註）。
      - ACD 裡所在國含台灣（GW 713）的只有衝突 232「China - Taiwan」：國家間衝突，雙方寫作 Government of China 與 Government of Taiwan（中華人民共和國政府與在台灣的中華民國政府），爭議是政府與領土（領土寫「Taiwan strait」），開始日期 1949-10-31；1949、1954、1958 年是戰爭等級，1950 年是小型衝突。中國、台灣兩邊都算。
      - 衝突 217「China: Taiwan」（1947 年，戰爭等級）：UCDP 記錄的開始日期是 1947-02-28，即二二八事件；雙方是 Government of China（當時的中華民國政府）與 Taiwanese insurgents，所在國是中國（GW 710）。依上面的爭議領土規則也算在台灣，附註說明。
      - 1946–1949 年的國共內戰（衝突 202，Government of China 對 PLA）所在國是中國，不算台灣。
      - 所以台灣的衝突數是 1947、1949、1950、1954、1958 年各 1 個，其他年份 0。附註（`notes.TWN`）寫明上面三點，資料管線核對年份、強度、爭議與 217 的開始日期，UCDP 改了就報錯。
    - **地圖上的點**：GED 的活躍事件依（年份、國家、0.1° 網格）合併，位置是依死亡人數加權的平均，地名（`where_coordinates`）與衝突名稱取死亡最多的那起；合計 25 人以上才畫（跟 UCDP 一年 25 人的門檻同一個數字），小的只算進國家合計。三類各一個檔：以國家為一方 10,692 點（涵蓋 88.9% 的死亡，695 KB、gzip 後 139 KB）、非國家 2,553 點（85.6%，185 KB）、單方面暴力 2,892 點（91.8%，194 KB）。
      - 三類各是一個疊加圖層，可以分別開關；各自的死亡人數指標只畫自己那一類，三類合計畫三類；每十萬人（橘色面量圖，點的紅、琥珀會跟底色混在一起）與 ACD 的指標不畫點。
      - 顏色用地震主題震源深度驗證過的同一組：以國家為一方 `hues.red`、非國家 `hues.yellow`、單方面暴力 `categorical[6]`（深紫），兩兩 ΔE ≥ 21/21/15、跟海 ≥ 21。深紫跟比例圓的紫只有 13/12/11，但一個是實心小點、一個是半透明大圓，照地震主題的判斷接受。
      - 半徑依死亡人數：25 人 1.4 px、100 人 2.2、1,000 人 4、1 萬 7.5、10 萬 13（縮放 2 時）。GED 有些事件本身就是大區域的合計（2021、2022 年提格雷戰爭各有一筆 11–12 萬人的「northern Ethiopia」），畫成一個大點。
      - tooltip：類型與年份、死亡人數、事件數、國家，最後一行是 UCDP 的英文地名與衝突名稱（`translate="no"`）。
    - **側欄**（`ConflictPanel.tsx`）：三類死亡人數的堆疊面積圖（讀三個死亡人數指標檔）、當年的長條；當年所在國是這裡的衝突（名稱、強度、類型、爭議、雙方，UCDP 英文原文放在 `translate="no"`）；1946 年起所在國是這裡的衝突清單（年份、戰爭的年份，前 6 個以外收在「顯示其餘」）。資料是 `conflicts.json`（每國每個衝突一列，66 KB）。
    - **大小**：`public/data/topics/conflict/` 共 1.5 MB（點 1.1 MB，其他指標檔各 35–56 KB）。資料管線約 25 秒（讀 274 MB 的 GED CSV）。

47. **國際組織**（`pipeline/topics/organizations.py`、`pipeline/sources/igo_members.py`、`src/topics/organizations.ts`、`src/topics/panels/OrganizationsPanel.tsx`）：
    - **沒有一份開放資料同時有這 16 個組織的成員與日期**，所以依各組織官網的成員名單整理成一張表（`igo_members.TABLES`，每個國家在每個組織的每一段：狀態、開始、結束、種類），網址寫在 `igo_members.SOURCES`，2026-10-23 查閱：
      - 有列日期、讀得到的：WTO 會員名單與加入進度表（https://www.wto.org/english/thewto_e/whatis_e/tif_e/org6_e.htm 、`acc_e/completeacc_e.htm`、`acc_e/status_e.htm`，加入進度表 2024-08 更新）、北約成員（https://www.nato.int/cps/en/natohq/topics_52044.htm ，2024-03 更新）與和平夥伴關係的簽署日期（`topics_82584.htm`）、夥伴（`topics_84336.htm`，2025-05 更新）、地中海對話（`topics_52927.htm`）、伊斯坦堡合作倡議（`topics_52956.htm`）、全球夥伴（`topics_49188.htm`）、白俄羅斯（`topics_49119.htm`）、APEC 成員與加入日期（https://apec.org/who-we-are/our-members ）、非洲聯盟成員國與加入日期（https://au.int/en/member_states/countryprofiles2 ）、大英國協 56 國（https://thecommonwealth.org/our-member-countries ，沒有日期）、上海合作組織成員、觀察員、對話夥伴（https://eng.sectsco.org/20170109/192193.html ）、歐盟成員與加入年份（https://european-union.europa.eu/principles-countries-history/eu-countries_en ）與候選國（https://enlargement.ec.europa.eu/enlargement-policy/candidate-countries-and-potential-candidates_en ）、東協 2026 年 5 月的對外關係名單（https://asean.org/wp-content/uploads/2026/05/ASEAN-External-Relations-Coordinatorship-as-of-May-2026.pdf ）、RCEP 的生效日期（新加坡 https://www.meti.gov.sg/trade-international-economic-relations/agreements/free-trade-agreements-fta/rcep/ ）、CPTPP 2026-06-26 部長聲明（https://www.gov.uk/government/publications/cptpp-joint-ministerial-statement-from-the-10th-commission-meeting-26-june-2026 ）、G7 研究組（http://www.g7.utoronto.ca/what_is_g8.html ，G7 沒有常設網站）。
      - **擋自動讀取或連不上的**：OECD（403）、東協網站本身（Sucuri 轉址）、OPEC（402）、G20（403）、金磚國家 2026 主席國網站（403）、紐西蘭外交貿易部的 CPTPP 加入頁（502）、阿拉伯國家聯盟（連不上）。這幾個依官方文件、主席國與政府新聞稿、媒體報導確認目前的名單，日期依英文維基百科的成員國條目與記憶交叉比對（例如 OECD 的 38 國與 8 個候選國依 2026 年部長會議文件 C/MIN(2026)2）。
      - 日期是史實，表是自己整理的；維基百科只用來比對（例如非洲聯盟的暫停參與、阿拉伯國家聯盟的加入日期、大英國協的退出與重新加入）。
    - **四種狀態**（使用者要的是成員、候選、夥伴三種，加上暫停參與）：
      - 代碼：1 成員、2 申請或加入中、3 夥伴或觀察員、4 成員（暫停參與），0 非成員是類別圖的「其他」，地圖不會整片灰色。同一時間有好幾段時，暫停 > 成員 > 申請 > 夥伴。
      - **暫停參與**另外一類：非洲聯盟 2026 年有 6 國被暫停（馬利、蘇丹、布吉納法索、尼日、馬達加斯加、幾內亞比索），畫成一般成員不準確；阿拉伯國家聯盟的敘利亞（2011–2023）、埃及（1979–1989），大英國協的奈及利亞、斐濟、巴基斯坦、辛巴威、加彭也用得到。只算組織自己暫停會員的；OPEC 成員自己「暫停會籍」（印尼 2009、2016 年，厄瓜多 1992 年）實際上是退出，算非成員。
      - 顏色是一般類別色（不是循序色）：成員薄荷綠、申請淡紫、夥伴琥珀、暫停參與深綠（跟成員同一個色系，還是成員）。循序色的話 4 類會用到最淺的橘（`#fbd7ca`），跟「其他」的米色分不開。
      - 「申請或加入中」含已申請、候選國、潛在候選國（科索沃）、受邀（北約、金磚國家）、入盟行動計畫（MAP）、北約 2008 年布加勒斯特峰會承諾未來接納的喬治亞與烏克蘭、加入談判中（WTO、OECD、上合組織）、已簽署還沒生效（CPTPP、RCEP 的簽署國）；側欄寫細分的種類（`KINDS`）。
      - 「夥伴或觀察員」：北約的和平夥伴關係、地中海對話、伊斯坦堡合作倡議、全球夥伴；東協的對話夥伴、部門對話夥伴與觀察員（巴布亞紐幾內亞）；上合組織的觀察員與對話夥伴；OECD 的主要夥伴；金磚國家的夥伴國；OPEC+ 合作宣言的 10 個非 OPEC 國家；G20 的常任受邀國西班牙；WTO 的觀察員教廷。
      - **沒畫的**：東協的發展夥伴（智利、法國、德國、義大利、荷蘭、秘魯，起始年份查不到）、阿拉伯國家聯盟的觀察員（維基百科 7 國、CIA World Factbook 5 國，不一致，官網連不上）、非洲聯盟的以色列觀察員（2021 年非盟執委會主席接受，2023 年 2 月暫停）、大英國協的申請國（布隆迪、南蘇丹、蘇利南只見於維基百科；只畫官方確認的辛巴威 2018 年申請重新加入）、金磚國家的申請國（沒有官方名單）、巴西的 OPEC+ 合作憲章（2025，不是合作宣言）。
    - **歷史**：每年 12 月 31 日的狀態（同一年加入又退出的不會出現），今年是資料產生當天（`date.today()`）。成員、暫停、申請、夥伴都有歷史（不只今年），讓時間軸看得到北約與歐盟的擴大、英國 2020 年脫歐、格陵蘭 1985 年退出、金磚國家 2024–2025 年擴大、OPEC 的退出（卡達 2019、厄瓜多 2020、安哥拉 2024、阿聯 2026-05-01）、摩洛哥 1984 年退出非洲團結組織與 2017 年加入非洲聯盟。
      - 年份從組織成立的那一年算起（各子項目的時間軸範圍不同，切換組織時時間軸跳到最接近的一年）。
      - **前身組織**：歐盟從 1958 年的歐洲經濟共同體算起（2009 年里斯本條約明定歐盟取代並承接歐洲共同體）；非洲聯盟從 1963 年的非洲團結組織算起；**WTO 從 1995 年算起，不畫 GATT**（中華民國是 1948 年 GATT 的創始締約方、1950 年退出，畫在今天的國界上會誤導，寫在台灣的附註）；OECD 從 1961 年公約生效算起，不畫歐洲經濟合作組織（1948）；上合組織從 2001 年算起，不畫上海五國（1996）；大英國協從 1949 年倫敦宣言算起（舊自治領的加入日期寫 1931-12-11 西敏法令）；G7 含 1998–2014 年的 G8（俄羅斯 1998 年伯明罕峰會起完整參加，2014-03-24 其他七國暫停 G8）。
      - **用今天的國家**：獨立或加入以前算非成員，即使那塊土地當時屬於某個成員國（1971 年以前的孟加拉、2011 年以前的南蘇丹）；分裂、合併、改名由今天的國家承接（德國 1990 年以前是西德、葉門 1990 年以前是北葉門、坦尚尼亞是坦干伊加、馬來西亞是馬來亞、阿聯在 OPEC 是 1967 年的阿布達比）。
      - 只有年或年月的日期（OPEC 的加入年份、APEC 以外查不到日的）補成那一年（月）的第一天比較。
      - 申請的起點：WTO 用申請日（1995 年以前申請的，在地圖上從 1995 年開始）；1995–1997 年才完成批准的 GATT 締約方（安哥拉、剛果等）在批准前算非成員，沒有另外標。OECD 1990 年代加入的 6 國（墨西哥、捷克、匈牙利、波蘭、韓國、斯洛伐克）沒有標加入前的討論期。歐盟的申請以正式申請或撤回、公投否決、凍結為界：瑞士 1992 年 5 月申請、12 月凍結（年底不在地圖上）、馬爾他 1996 年底到 1998 年 9 月凍結、冰島 2015-03-12 要求不再被視為候選國；摩洛哥 1987 年的申請被拒，沒有畫。
      - 北約的全球夥伴（澳洲、日本、韓國、紐西蘭、蒙古、巴基斯坦、伊拉克、阿富汗）沒有個別的起始日期，用 2011 年 4 月新夥伴政策（柏林）的時間；俄羅斯的和平夥伴關係到 2014-04-01（北約暫停實際合作），白俄羅斯到 2021-11-19；烏克蘭 2010–2014 年依法採不結盟，那幾年算夥伴不算申請。
      - 東協的部門對話夥伴巴西（2024）、丹麥（2026）是查得到的最早年份（東協 2024 年 9 月的巴西關係概況、2026 年 5 月的名單），實際可能更早；土耳其 2026 年 7 月成為對話夥伴、德國與卡達成為部門對話夥伴依媒體報導（Business Today Malaysia 2026-07-21）。
    - **不確定的日期**（寫在附註，DESIGN 記一筆）：非洲聯盟幾內亞 2008 年的暫停解除依和平與安全理事會第 252 次會議（2010-12-09），英文維基百科寫 2011 年 1 月；多哥 2005 年的暫停只查到月份（2005 年 2–5 月）；茅利塔尼亞兩次解除只到月份；馬達加斯加 2002 年非洲聯盟成立時沒有入席，維基百科寫 2001 年 12 月起，這裡從 2002-07-09 算；非洲聯盟網站的肯亞（1963-05-25，肯亞 1963-12-12 才獨立）與安哥拉（1975-02-11，安哥拉 1975-11-11 才獨立）日期明顯不對，改用 1963-12-13 與 1976-02-11；孟加拉申請加入 RCEP 只查到 2024-10-14 國內啟動程序，沒有送出申請的日期。
    - **非國家的地方**：主權國家都畫（不在表裡是非成員）；其他地方只在表裡有它的組織上色：
      - 自己有參加的：香港（WTO、APEC 是「中國香港」，申請加入 RCEP）、澳門（WTO 的「中國澳門」）、庫拉索（以自己的名義申請加入 WTO）、撒拉威阿拉伯民主共和國（非洲聯盟的成員名單有，畫在地圖的西撒哈拉形狀上；Natural Earth 1:50m 的摩洛哥含西撒哈拉大部分，ESH 只是東邊的一小塊，附註寫明不代表對主權的立場）。
      - 歐盟的格陵蘭（1973–1985 年隨丹麥在歐洲共同體內）與法羅群島（從未加入）：只在歐盟畫，看得出跟丹麥不同。
      - **其他都不畫**：格陵蘭隨丹麥參加北約、法屬圭亞那等海外省是歐盟的最外圍地區，但另外塗色的話，圖例的數字（`categoryTitle` 寫的是「國家/地區」數）就跟成員數對不上——試過，歐盟 2026 年會變成 34、北約 41、WTO 約 174。所以這些地方用主題的 `noValue` 寫原因（「丹麥王國的一部分，隨丹麥參加各組織，不另外上色」「法國的海外省（也是歐盟的最外圍地區）…」「海外領地或屬地，沒有自己的成員身分」），不寫「無資料」；索馬利蘭、北賽普勒斯、錫亞琴冰川也是。法國海外省、聖馬丁屬於歐盟寫在法國的附註。
      - `noValue` 是整個主題共用的，但側欄的「成員身分的變化」只在這個地方在這個組織完全沒有值時才換成那句說明（`CountryPanel`，2026-10-23 起）：香港在 WTO、APEC 照常列出歷年變化，在歐盟寫原因。主題側欄另外列出每一段。
      - 檢查用的數字（`CHECK_COUNTS`）只算主權國家加上香港、澳門、撒拉威，跟官方的成員數一致；歐盟 1973–1984 年的圖例比成員國多 1（格陵蘭）。
    - **台灣**：
      - WTO：1990-01-01 以「臺澎金馬個別關稅領域」申請加入 GATT，1992-09-29 取得 GATT 觀察員並成立工作小組，2001-11-11 杜哈部長會議通過，2002-01-01 成為第 144 個會員（WTO 的名單寫 Chinese Taipei）。地圖上 1995–2001 年是「申請或加入中」，2002 年起是成員。
      - APEC：1991-11-12 以「中華台北」與中國、香港同時加入。
      - CPTPP：2021-09-22 以「臺澎金馬個別關稅領域」申請，還沒有成立加入工作小組（中國 2021-09-16 申請，也沒有）。
      - 參加時的名稱寫在指標檔的 `notes`／`notesEn`（側欄的附註：「以「臺澎金馬個別關稅領域（簡稱中華台北）」名義參加。」）與主題側欄（`igo_members.NAMES`：台灣、香港、澳門、庫拉索、撒拉威、教廷）。名稱裡不再放引號，避免附註裡出現「「」」。tooltip 只有 `format(代碼)`，放不下名稱。
      - 「參加幾個組織」台灣是 2 個（WTO、APEC），2026 年最多是加拿大 8 個，日本、英國、澳洲 7 個。
    - **其他名稱與例外**：歐盟本身也是 WTO 會員、G7 與 G20 的成員，非洲聯盟 2023-09-09 起是 G20 成員，都不在地圖上（寫在組織說明）；巴勒斯坦 1976 年以巴勒斯坦解放組織加入阿拉伯國家聯盟；沙烏地阿拉伯 2023 年受邀加入金磚國家，沒有正式確認、2026 年新德里峰會以受邀國出席，算「受邀加入」；南非仍是 G20 成員，但 2026 年主辦國美國沒有邀請（附註）；阿聯 2026-04-28 宣布 5 月 1 日起退出 OPEC 與 OPEC+（OPEC 網站擋自動讀取，沒有確認官網是否已更新）；上合組織 2026 年比斯凱克峰會前俄羅斯表示觀察員與對話夥伴將合併為「上合組織夥伴」，是否通過沒有查到官方文字，兩者都已經在「夥伴或觀察員」；上合組織網站寫 15 個對話夥伴但只列出 14 個（沒有巴林），巴林依 2022 年撒馬爾罕峰會的決定列入。
    - **檢查用的數字**（2026-10-23，地圖上的成員數含暫停參與）：歐盟 27（申請 10）、北約 32（申請 3、夥伴 32）、東協 11（夥伴 22）、OECD 38（候選 8、主要夥伴 3）、G7 7、G20 19（另有歐盟、非洲聯盟；常任受邀國 1）、金磚國家 10（受邀 1、夥伴國 10）、CPTPP 12（申請 10）、RCEP 15（申請 4）、非洲聯盟 55（暫停 6）、OPEC 11（OPEC+ 夥伴 10）、大英國協 56（申請 1）、阿拉伯國家聯盟 22、上合組織 10（夥伴 17）、WTO 165 個地圖上的國家／地區加歐盟 = 166（申請 21，加上庫拉索 22；觀察員 1）、APEC 21。歷年：歐盟 1958 年 6、1973 年 9、1986 年 12、1995 年 15、2004 年 25、2013 年 28、2020 年 27；北約 1949 年 12、1982 年 16、1999 年 19、2004 年 26、2020 年 30、2024 年 32；OECD 1961 年 19（義大利 1962 年批准）；OPEC 2018 年 15 → 2026 年 11。`CHECK_COUNTS` 對不上時資料管線報錯；組織有新成員、退出或暫停時要同時改 `TABLES` 與 `CHECK_COUNTS`。
    - **授權**：見第 12 點。

48. **聯合國投票**（`pipeline/topics/un_votes.py`、`pipeline/sources/unvotes.py`、`src/topics/un-votes.ts`、`src/topics/panels/UnVotesPanel.tsx`）：
    - **來源**：Erik Voeten 在 Harvard Dataverse 的資料集（doi:10.7910/DVN/LEJUQZ，舊的 handle 是 hdl:1902.1/12379）。原名「United Nations General Assembly Voting Data」，2025 年 7 月的第 35 版起改名「United Nations General Assembly Ideal Points」，改成依投票的日曆年估計（之前依大會屆次），也不再放逐筆表決：估計用的原始表決除了 2024、2025 年的最後表決（作者自己整理）以外，來自 UNGA-DM 資料庫（https://unvotes.unige.ch/ ）。用第 39 版（2026-07-30 發布）。作者要求的引用：Bailey, Michael A., Anton Strezhnev, and Erik Voeten. 2017. "Estimating Dynamic State Preferences from United Nations Voting Data." Journal of Conflict Resolution 61(2): 430–56；以及 Fjelstul, Joshua, Simon Hug, and Christopher Kilby. 2025. "Decision-making in the United Nations General Assembly: A comprehensive database of resolution-related decisions." The Review of International Organizations。頁尾的來源列了這兩篇。
    - **授權**：CC0 1.0（Dataverse API 的 `license` 欄位，https://dataverse.harvard.edu/api/datasets/:persistentId/?persistentId=doi:10.7910/DVN/LEJUQZ ，2026-10-23 查；第 30–39 版都是 CC0，沒有另外的使用條款）。
    - **檔案與下載**：`https://dataverse.harvard.edu/api/access/datafile/<file id>`（`common.download` 有設 User-Agent，Dataverse 會擋 Python 預設的），下載後比對 Dataverse 公布的 MD5，第一次約 23 MB、10 秒：
      - `IdealpointestimatesFP_2026FP.csv`（file id 14098429，1.4 MB）：每國每年的理想點與後驗分位數（Q0、Q5、Q10、Q50、Q90、Q95、Q100），1946–2025。代碼簿是 `Codebook_IdealPointEstimates1946-2025.txt`（file id 13642024）。
      - `AgreementScores.Rdata`（file id 11837232，21.7 MB）：兩兩國家每年的一致度，兩個方向各一列，共 182 萬列，1946–2024。同一份也有 CSV（`AgreementScores.csv`，file id 11837234，145 MB）；RData 小很多，用民主主題寫的 R 序列化讀取器（`sources/vdem.py` 的 `read_rdata_columns`）讀：資料框叫 `dfAgree`，10 欄（session.x、ccode1、ccode2、agree、year、IdealPointFP.x／.y、NVotesFP.x／.y、IdealPointDistance），只讀 4 欄，約 1 秒。
      - 沒用：`IdealpointsJuly2025.tab`（前一版的估計，含用所有表決估計的 idealpointall 與依屆次的 legacy，到 2024 年）、`IdealPointDyads1946-2025.tab`（兩兩國家的理想點距離）、`AgreementScoresAll_Jun2024.*`（依屆次、所有表決的舊版一致度）。
      - file id 對應固定的檔案內容，作者更新時會換新的 id。新版出來時改 `unvotes.py` 的 `VERSION`、`RELEASED`、`FILES`（id、檔名、MD5）。
    - **年份是投票的日曆年**，不是大會的屆次。檔案裡還有 `session` 欄，但一律是年份減 1945（代碼簿：「Calendar year corresponding to the UNGA session」；資料集說明寫明改用年份，因為屆次越來越常延到隔年，還有加薩、烏克蘭的緊急特別會議）。看得出是日曆年：1951 年每國只有 4–5 次表決（第 6 屆 1951 年 11 月才在巴黎開幕，大部分表決在 1952 年）；1971 年中華民國有到 10 月 25 日為止的 4 次、中華人民共和國有 11 月 15 日起的 25 次。
      - 1964 年整年沒有記名表決（第 19 屆大會為了避開拒付維和經費、是否依憲章第 19 條停止投票權的爭議，沒有進行表決）。年份仍保留、整年都是 null，地圖那一年整片灰色。不拿掉的原因：`years` 不連續時，側欄折線（`timeSeriesOption` 的 `consecutiveYears`）會改成 `sparse`，跨過缺值連起來，南非 1975–1993 年這種中斷會被一條直線連過去。
    - **只看最後表決（final passage）**：決議案的最後表決，含沒有通過的，不含分段表決、修正案與程序動議。作者另一種估計（idealpointall，所有表決）比較精確，但有些年份某個議題（例如加薩）的表決特別多，兩者相關 0.9846；一致度只有最後表決的版本，所以兩個指標都用最後表決。
    - **一致度**：作者代碼簿寫的是 Lijphart (1963) 的一致指數（也就是 Signorino & Ritter 1999 的 S 分數的簡單情形）：兩國都參加的表決裡，投票相同（都贊成、都反對、都棄權）算 1，一國棄權、另一國贊成或反對算 0.5，一贊成一反對算 0，除以兩國都參加的表決數；缺席的不算。存成 0–100%、小數一位。作者提醒一致度對議程很敏感（某一年中東決議特別多就會變），比較立場的變化最好用理想點（頁尾有寫）。早年每年只有幾次到幾十次表決（1951 年 5 次），數字容易跳動（指標說明有寫）。
    - **理想點**：Bailey, Strezhnev & Voeten (2017) 的動態 IRT 模型（隨機漫步先驗、MCMC），一維，可以跨國、跨年比較。照代碼簿的說法描述：越高越接近美國與西方民主國家，越低越接近開發中國家的多數立場。存後驗平均（`IdealPointFP`）與 90% 可信區間（Q5、Q95，`intervals/`，只有側欄用），小數兩位；另外輸出參加的表決次數（`votes.json`，`NVotesFP`）。
      - 發散色門檻 ±0.25、±0.75、±1.5（負橘、正青綠）：近年 5–95% 的國家在 −1.0 到 +1.2 之間，冷戰初期蘇聯集團低到 −3.6，美國與以色列在 +2 以上。
      - **2025 年**：作者特別提醒 2024 到 2025 年變化很大，有些是立場真的改變（美國、阿根廷），但投票也變得比較像兩個面向，一維的估計讓中國、俄羅斯看起來比較接近美國（美國 +2.16 → +2.89、中國 −0.86 → −0.37、俄羅斯 −0.58 → +0.08）。指標說明有寫；預設年份是 2024（一致度只到 2024）。
    - **國家代碼（COW → ISO3）**：理想點檔有 `iso3c` 欄，直接用，歷史上的國家照民主主題（V-Dem）的接續方式對到今天的國界：俄羅斯 1946–1991 年是蘇聯（COW 365 本來就連續），捷克斯洛伐克（CSK，COW 315）→ 捷克，南斯拉夫（YUG）與南斯拉夫聯盟共和國／塞爾維亞與蒙特內哥羅（SCG，都是 COW 345）→ 塞爾維亞，北葉門（YAR，COW 678）→ 葉門，西德（COW 260，iso3c 已經是 DEU）→ 德國。不收：東德（COW 265）、南葉門（COW 680）、尚吉巴（COW 511，只在一致度檔、只有 1963 年）。一致度檔只有 COW 代碼，用理想點檔建對照表；一個 COW 代碼只能對到一個地圖代碼，對不到會報錯。
      - 烏克蘭、白俄羅斯在蘇聯時期就是創始會員國，有自己的席位，1946 年起就有值（附註有寫）。
      - 附註寫明的缺值：敘利亞 1958–1960 年（阿拉伯聯合共和國，投票記在埃及）、南非 1975–1993 年（1974 年 11 月起大會不讓南非代表團參加，1994 年 6 月恢復）、印尼 1965 年（宣布退出聯合國，1966 年回來）、南斯拉夫聯盟共和國 1993–1999 年（聯大第 47/1 號決議，2000 年 11 月重新加入）、瑞士 2002 年以前（觀察員）。
      - 其他會員國零星的缺值（委內瑞拉 2022 年起、阿富汗 2024 年起、伊拉克 1995–2003 年、利比里亞、索馬利亞、中非等）原因不一（積欠會費依憲章第 19 條不能投票、代表權爭議、整年沒參加表決），沒有逐一查證，頁尾寫通則。
    - **台灣與中國**：資料集把 1946–1971 年聯合國中國席位上的投票（中華民國）記為 COW 713、iso3c TWN（Countryname「Taiwan」），照原樣放在台灣；中國（COW 710）從 1971 年開始，是中華人民共和國。1971 年兩個都有值：中華民國 4 次表決（到 10 月 25 日聯大第 2758 號決議為止，與美國一致度 100%），中華人民共和國 25 次（11 月 15 日起出席）。兩者沒有共同參加的表決，所以台灣在「與中國的投票一致度」沒有值。「與中國的投票一致度」從 1971 年開始，不把 1946–1971 年中華民國的投票算成「中國」。台灣、中國的附註都寫了。
      - 主題的 `noValue`（只在沒有值時取代「無資料」）：台灣「1971 年起不是聯合國會員國」；巴勒斯坦、教廷「聯合國的觀察員國，在大會沒有投票權」；科索沃、庫克群島、紐埃「不是聯合國會員國」；索馬利蘭、北賽普勒斯「自行宣布獨立，不是聯合國會員國」；西撒哈拉「非自治領土，不是聯合國會員國」；各屬地與香港、澳門「不是獨立的聯合國會員國」。
      - **側欄**：台灣在主題的 `noValue` 裡，但 1946–1971 年有值，通用的歷年折線圖照常畫（`CountryPanel` 只在這個國家在這個指標完全沒有值時才用原因取代圖表，2026-10-23 為了這個改的）；主題側欄另外畫與美國、中國的一致度，並列出 1971 年的理想點（+0.77，90% 可信區間 +0.31 到 +1.21，根據 4 次表決）。
      - **比較對象自己**（「與美國」的美國、「與中國」的中國、「與各國」選的國家）沒有值：用指標的 `noValue`（`agreement()` 的最後一個參數）與子項目的 `selfLabel`，tooltip 與側欄寫「比較的對象」，不寫「無資料」；主題的 `noValue` 不行，它是整個主題共用的，美國在其他指標有值。
      - 台灣在「與中國的一致度」另有一句指標的 `noValue`（「1971 年以前中國席位由中華民國代表，1971 年起台灣不是聯合國會員國」）：時間軸在 1965 年時，主題的「1971 年起不是聯合國會員國」會誤導。
    - **比較對象**：「與各國的投票一致度」16 國（俄羅斯為預設，加上英國、法國、德國、烏克蘭、日本、南韓、印度、印尼、澳洲、土耳其、伊朗、以色列、埃及、南非、巴西），連同美國、中國共 18 個檔（`agree/<ISO3>.json`），一國一個檔，換比較對象時只下載那一個；德國從 1973 年、南韓從 1991 年開始，時間軸跟著檔案的年份。全部資料檔 1.3 MB、gzip 後約 400 KB，每個一致度檔 30–71 KB。要加比較對象：`un_votes.py` 與 `un-votes.ts` 的 `REFERENCES` 各加一行。沒有做成「點國家就換比較對象」（`followsSelection`）：18 國以外的國家點了不會換，反而混亂，全部 193 國都做的話資料約 13 MB。
    - **配色**：一致度用循序色（30、40、50、60、70、80%），越深越常投相同的票，所有比較對象、所有年份共用同一組門檻。不用發散色：50% 不是立場的分界，而且「與美國」「與中國」兩張圖的深色是不同的國家，用青綠／橘色會讓人以為有好壞之分。理想點有正負，才用發散色。
    - **驗證**：美中一致度 1971 年 47.9%、1980 年 38.9%、1990 年 24.0%、2000 年 34.1%、2010 年 33.5%、2020 年 24.0%、2024 年 29.0%；美國與中華民國（台灣）1946 年 76.9%、1950 年 81.0%、1960 年 93.8%、1965 年 73.1%（116 國中第 36 名）、1970 年 67.5%；美蘇 1950 年 27.0%、1960 年 31.2%。2024 年與美國：以色列 92.1%、英國 78.8%、烏克蘭 73.9%、南韓 71.0%、日本 68.1%、印度 40.7%、俄羅斯 23.9%；與中國：北韓 88.1%、巴基斯坦 87.5%、俄羅斯 77.9%、印度 77.9%、日本 58.0%、英國 45.6%。2024 年 88 國與中國的一致度在 80% 以上，52 國與美國在 60% 以上；2024 年 190 國有一致度，2025 年 191 國有理想點。
    - **名稱與頁尾要短**：指標名稱原本是「與美國的投票一致度」「Voting agreement with the US」，四個並排時 1280px 寬的控制列中英文都換成兩行（中文 684px、英文 1,040px，可用約 660、615px），改成「與美國的一致度」「US agreement」、「理想點」「Ideal point」、「與各國的一致度」「Agreement by country」（英文標題是「Japan agreement by country」）。頁尾原本把 1964 年、憲章第 19 條、各國的接續都寫進去，英文版有 8 行，把地圖擠到 300px 高，縮成三句，細節留在這裡。
49. **海底電纜**（`pipeline/topics/submarine_cables.py`、`pipeline/sources/telegeography.py`）：
    - **來源與下載**：TeleGeography Submarine Cable Map（https://www.submarinecablemap.com/ ）網站本身用的 API v3，不需金鑰：`cable/cable-geo.json`（路線，GeoJSON MultiLineString）、`landing-point/landing-point-geo.json`（登陸點）、`cable/all.json`（清單），以及每條電纜的明細 `cable/<id>.json`（長度字串「45,000 km」、登陸點與國家英文名稱、擁有者與供應商（逗號分隔的字串）、RFS 字串與 `rfs_year`、`is_planned`）。2026-10 是 713 條電纜、1,928 個登陸點。明細要一條一條抓，每次請求間隔 0.4 秒、都有快取（`.cache/telegeography/cable/<id>.json`），第一次約 18 分鐘（共約 1.6 MB）；要更新得加 `--refresh`。
    - **國家歸屬**：登陸點的國家照明細裡 TeleGeography 寫的英文國名（「Congo, Dem. Rep.」「Virgin Islands (U.S.)」「Bonaire, Sint Eustatius and Saba」），`COUNTRY_NAMES` 對照，對不上就報錯；同一個登陸點在不同電纜的國家不一致也報錯。屬地照自己的 ISO 代碼（關島 GUM、法屬玻里尼西亞 PYF、北馬利安納 MNP…），185 個國家／地區有電纜登陸。例外：聖誕島、科科斯群島在地圖上是同一個形狀「澳屬印度洋領地」（`_IOT`），算在 `_IOT` 才看得到。BES、GIB、GLP、GUF、MTQ、MYT、REU、TKL、TUV 在 1:50m 沒有自己的形狀（法國海外省併在法國、荷蘭加勒比區併在荷蘭的形狀裡），有值、排名表與搜尋找得到、登陸點照畫，但只有 GIB、TKL、TUV 有小國圓點；法國、荷蘭與這幾個地區的附註寫明法國、荷蘭的數字不含它們（`MERGED_IN`）。地圖上的國家（自訂代碼的 `_SIA` 等除外）沒有電纜的是 0，不是無資料，內陸國也是 0。
    - **時間**：TeleGeography 只收營運中與規劃中的電纜，已經退役的（1988 年的 TAT-8、1999 年的 SEA-ME-WE 3 等）不在裡面，所以早年的數字偏少，代表的是「今天還在用的電纜是哪一年啟用的」（最早的是 1989 年）。每年年底累計：
      - 今年（2026）是資料下載時已經啟用的電纜：營運中的依 `rfs_year` 算（沒有營運中但沒有年份的）。
      - 規劃中的 105 條從明年起依預計年份算進去，`projectionFrom` 是明年（2027）。預計今年底前啟用、或預定年份已過還沒啟用的 5 條算在 2027 年；沒有預計年份的 6 條算在最後一年（2030）。
      - 疊加圖層的線與登陸點用同一個年份（`year` 欄位、指標的 `overlayTime: 'cumulative'`），地圖跟數字一致；tooltip、側欄顯示的是 TeleGeography 原本的 RFS 年份。
      - 時間軸 1989–2030。今年以前是實際的數字，不是估計，所以指標設了 `projectionLabel`：今年以前不標「估計值」，明年起標「含規劃中」（預設是「估計值／推估值」）。
    - **計算**：
      - 登陸的電纜數：有登陸點在這國的不同電纜（同一國好幾個登陸點只算一條），國內電纜也算。2026 年美國 90、英國 62、印尼 61、日本 43、新加坡 34。
      - 國際連線數：同一條電纜登陸的其他國家兩兩都算「直接連到」。TeleGeography 沒有分段（哪一段連哪兩個登陸點）的資料，主幹與支線分不開，所以 2Africa、SeaMeWe-6 這種串起二、三十國的電纜讓法國（68）、葡萄牙、埃及、沙烏地的數字很高；美國最多（72）。面量圖門檻 1、5、10、20、30、45。
      - 登陸點數：有電纜登陸的地點（登陸點最早那條電纜的年份起算）。加拿大最多（147，Connected Coast 沿卑詩省海岸有幾十個登陸點）。
    - **路線**：同一條電纜是好幾段 MultiLineString（2026-10 共 1,949 段），在 180° 經線切開。每段先把經度展開成連續的，再把首尾相接、接點只有這兩段的接成一條線（分岔點不接），後面那段平移 360°，跨太平洋的電纜經度可以超過 ±180（FASTER 139°～236°），地球儀與平面上都不會橫越整張地圖（實際看過）。切開的兩段端點不一定完全一樣（TPU 是 179.9999° 與 −179.9768°），所以端點 0.05° 內就算同一點。結果 1,741 條線、14,242 個頂點，不必簡化；量化 0.01°、差分編碼，`cables-lines.json` 226 KB、gzip 後 58 KB。
      - 每條線一筆屬性（`records`，跟點圖層同一種欄位分開存的格式）：名稱、地圖上的年份 `year`、RFS 年份 `rfs`、是否規劃中 `plan`、長度 `len`、前 4 個擁有者 `own` 與擁有者總數 `nown`（完整清單在側欄的國家檔）。電纜名稱不重複，同一條電纜的線用名稱就能認出來。
      - 登陸點的名稱去掉結尾的國名（「Toucheng, Taiwan」→「Toucheng」），國名寫法不同的（「Kralendijk, Bonaire, Netherlands」）不動；位置未定（`is_tbd`）的 2 個照畫，tooltip 註明。
    - **台灣**：TeleGeography 收了 14 條在台灣登陸、營運中的國際電纜：APCN-2、FLAG North Asia Loop/REACH North Asia Loop、EAC-C2C、TPE、CSCN（登陸點在金門古寧頭與慈湖，連到廈門）、TSE-1、APG、FASTER、NCP、PLCN、Topaz、Apricot、SJC2、TPU（2026，台東大武），跟中央社 2025-01-10〈海纜安全危機4／台灣成海纜樞紐 中華電信強化韌性備援多路齊發〉（https://www.cna.com.tw/news/aipl/202501100035.aspx ，數字來自中華電信與數位發展部）的「台灣聯外海纜約 14 條」相近，報導點名的 SJC2、Apricot、APCN2、FNAL/RNAL、EAC、C2C、CSCN、TSE-1、TPE、APG、FASTER、NCP 全部都有（EAC、C2C 在 TeleGeography 是同一條 EAC-C2C）。規劃中 4 條：ORCA（2027）、Candle（2028）、AUG East（2029，大武與屏東五結）、E2A（2029）。
      - 國內電纜：TeleGeography 只有 3 個系統，臺澎金馬二號 TPKM2（2000）、臺澎金馬三號 TPKM3（2013）、臺馬四號（2026），串起本島與澎湖、金門、馬祖；同一篇報導說國內海纜有 10 條（台馬、台金、台澎、澎金各兩條），沒有逐條收錄。
      - 1999 年的 SEA-ME-WE 3 不在 TeleGeography 現在的清單裡（只有 SeaMeWe-4、5、6），FLAG Europe-Asia（FEA）也沒有；ADC 有收，但登陸點是中國、日本、菲律賓、新加坡、泰國、越南，沒有台灣。
      - 2026 年台灣：17 條電纜（第 20 名）、直接連到 13 國（第 98 名）、20 個登陸點；2030 年 21 條、14 國。附註（`notes`／`notesEn`）由 `_taiwan_check()` 依資料產生，`TAIWAN_EXPECTED`（中央社點名的電纜）在 TeleGeography 找不到、或 SEA-ME-WE 3 又出現時會印警告。
    - **顏色**（MAP_TOKENS，dataviz 驗證工具的 OKLab ΔE×100，一般／紅色盲／綠色盲）：營運中用洋紅 `categorical[7]` #e7298a，跟藍色的海 #a0c8f0 33/32/20、淺色陸地 39/42/30、深色底圖的水 44/28/39；規劃中用琥珀 `hues.yellow` #eda100 加虛線，跟海 24/24/23、深色底圖 55/50/56，跟洋紅 29/30/21。登陸點是深灰 `inkSecondary` 加白框（跟海 39/41/38；深色底圖上靠白框）。比例圓的紫 #6250d6 跟洋紅只有 27/13/23，但一個是半透明的大圓、一個是細線，分得開。五種底圖都看過。
50. **菸酒**（`pipeline/topics/tobacco_alcohol.py`、`pipeline/sources/hpa.py`、`src/topics/panels/TobaccoAlcoholPanel.tsx`）：
    - 吸菸率用 WHO GHO 的 `M_Est_smk_curr_std`（15 歲以上目前吸菸、年齡標準化；含紙菸、雪茄、菸斗等燃燒式菸品，不含嚼菸與電子煙），出自《WHO 全球菸草使用趨勢報告》的模型估計，只有 2000、2005、2007、2010、2015、2020、2022、2023、2024 年，2025、2030 年是推估（`projectionFrom: 2025`）。很多國家最近一次調查在幾年前，2023、2024 年也是模型外推（GHO 的 Comments 欄寫「This is a projection」），但 WHO 把它們當估計值發布，這裡照 WHO 的分法。GHO 沒有世界值，所以沒有對照線。全部、男性、女性三個指標用同一組門檻 [5, 10, 15, 20, 30, 40]，看得出東亞、非洲女性吸菸率很低。
    - 人均飲酒量用 `SA_0000001688`（15 歲以上每人每年的純酒精公升數，有登記的銷售量加上自釀、走私等沒有登記的量，扣掉觀光客喝的，SDG 3.5.2），2000–2024 年，有世界值（2024 年 4.86 公升）。
    - 主要酒類與側欄的酒類組成用 `SA_0000001400`（有登記的人均消費量，依 ALCOHOLTYPE 分啤酒、葡萄酒、烈酒、其他），1961 年起。主要酒類是四類裡純酒精最多的一類，沒有資料的類別當成 0（「其他」比較常缺）；2024 年啤酒 85 國、烈酒 57、葡萄酒 21、其他 15（日本、南韓、許多非洲國家）。「其他」的英文、中文標籤都取短的（Other／其他酒類），說明寫在指標說明裡：類別圖的排名表在 375px 寬時數值欄會被長標籤擠出畫面。類別順序（烈酒、葡萄酒、啤酒、其他）是為了讓 `MAP_TOKENS.categorical` 的前四色剛好是薄荷綠、淡紫、琥珀、綠，葡萄酒偏紫、啤酒偏黃；側欄的長條用同一個 `categoryScale()` 取色。
    - **台灣的吸菸率**：國健署「國人吸菸行為調查」的 18 歲以上成人吸菸率。開放資料（data.gov.tw 14462，Big5 CSV）只到 107 年（2018），之後的年份取自國健署網站「國人吸菸行為調查結果」的圖 1（2026-01-07 更新，男性、女性、整體都標了數字），寫在 `hpa.KNOWN`，CSV 有的年份兩邊一致，程式每次核對。108 年起兩年一次（109、111、113 年），所以指標檔加 `latestWithin: 1`：2023、2025 年顯示前一年的調查並標出資料年份。93 年（2004）以前是其他調查，不收；WHO 的年份對得上的是 2005、2007、2010、2015、2020、2022、2024。國健署以台灣 2000 年的人口結構（含教育程度、居住地區）加權標準化，WHO 是 15 歲以上、WHO 標準人口，不完全可比，附註有寫。2024 年 12.8%（男性 21.5%、女性 4.2%）。
    - **台灣的飲酒量從缺**：財政部、國健署都沒有公布換算成純酒精的人均消費量。開放資料裡找得到的是財政部國庫署的蒸餾酒國產與進口數量（公斤，2020 年後沒更新），不是純酒精；FAOSTAT 的酒類供給量（飲食主題）是酒的重量，不是純酒精，只寫在附註（2023 年每人 38.4 公斤）。
51. **交通安全**（`pipeline/topics/road_safety.py`、`pipeline/sources/who_road.py`、`motc.py`、`src/topics/panels/RoadSafetyPanel.tsx`）：
    - **死亡率**：WHO GHO 的 `RS_198`（Estimated road traffic death rate per 100 000 population，兩性合計 `SEX_BTSX`），2026-10 的版本有 2000–2023 年、186 國，有世界值（`GLOBAL`）。是 WHO 的估計值（Global Health Estimates），用 30 天的定義（事故後 30 天內死亡），各國可以比較。
    - **死亡人數**：WHO 的死亡人數 `RS_196` 只有 2021 年（GSRRS 2023 的估計），所以用 `RS_198` × WPP 2024 的年中人口；跟 `RS_196` 的 2021 年比，中位數差約 1.5%，阿根廷、葉門約差 15%（2026 年的估計改過），`_check_deaths()` 只看中位數。世界值是世界死亡率 × 世界人口（2023 年約 123 萬人）。
    - **行人、機車騎士的死亡占比**：各國向 WHO 通報的死亡人數依道路使用者分（汽車等四輪、二三輪機動車、行人、自行車、其他五類），不是估計值。兩輪調查：
      - GSRRS 2018（大多是 2016 年的資料）：GHO 的 `RS_246`，CC BY 4.0。
      - GSRRS 2023（大多是 2021 年）：WHO 網站的指標檔 `gsrrs23-indicators-for-participating-countries-or-territories.xlsx`（第一列是欄位代碼 `CP_18a`–`CP_18e`，第二列是欄名），GHO 沒有。
      - 五類沒填齊、或加起來不在 95–105% 的國家不用。地圖用 `latestWithin: 5`，時間軸 2016–2021，147 國。泰國通報的行人只有 2.1%、英屬維京群島的機車 100%（死亡人數很少）照原樣呈現。
    - **每萬輛機動車死亡數**：死亡人數（上面的估計）÷ 各國通報的登記機動車輛數（含機車；2016 年用 GHO `RS_194`，2021 年用 GSRRS 2023 的 `CP_36a` 與 `CP_118` 年份）× 1 萬，車輛數的年份跟死亡人數差 2 年以內才算。**每千人不到 1 輛的通報值當成填錯**：菲律賓 2021 年填 13 輛、喬治亞 1 輛、賽普勒斯 941 輛，不用（建置時會印出來）。車輛很少的國家數字很高（幾內亞 2016 年超過 100）。門檻 0.5、1、2、5、10、30。
    - **台灣**（WHO 沒有）：交通部統計查詢網（statis.motc.gov.tw）的表：
      - 網頁用 `Statistics/Display.json?Seq=<表號>` 取資料（JSON，`date` 是「民國年-月-00」，年資料的月是 00；數字有千分位，「-」是 0），`sources/motc.py` 直接讀。**網站的防火牆會擋程式常用的 User-Agent**（連線被重設，`Python-urllib` 與 `curl` 都是），要用一般瀏覽器的；`common.download()` 的 User-Agent 不行，所以 `motc.py` 自己下載，回的不是 JSON 時不存快取。
      - 表 127「道路交通事故(30日內)─按駕乘車種分」：30 日內死亡人數依死者的駕乘車種（大客車、大貨車、小客車、小貨車、特種車、機車、自行車、行人、乘客、其他、不明），2008 年起；各類加起來要等於「總計」，對不上會報錯。2022 年 3,064、2023 年 3,023、2024 年 2,950、2025 年 2,858 人，跟行政院人權指標（子指標 48「道路交通事故整體30日死亡人數」）一致。
      - 「機車」只算騎士，乘客不分車種另外一類（2025 年 156 人），所以機車占比比 WHO 的定義（含乘客）略低；側欄台灣多列一類「乘客（不分車種）」。「自行車」含腳踏自行車、電動輔助自行車、微型電動二輪車。
      - 死亡率 = 30 日內死亡人數 ÷ WPP 年中人口（跟其他國家同一個人口來源）：2023 年 13.0（世界 15.2、日本 2.7、美國 18.4）。WHO 的資料只到 2023 年，台灣 2024、2025 年的數字寫在附註。
      - 機動車輛：表 100（到 2012 年 8 月）與 101（2012 年 9 月起）的年底登記數（汽車加機車，2025 年底約 2,340 萬輛，六成多是機車），每萬輛 1.2–1.3 人。
      - **24 小時與 30 日**：警察機關的 A1 類事故是當場或 24 小時內死亡，早年常被引用的死亡人數是這個定義，比 30 日的少很多；交通部的 30 日內死亡統計從 2008 年開始，跟 WHO 與多數國家的定義相同，所以地圖上只用 30 日的數字（附註、頁尾都有寫）。
      - 「行人地獄」寫在台灣的行人占比附註，只寫有出處的事實：2022 年 12 月 7 日 CNN 的旅遊專欄引用網友的說法（a living hell for pedestrians）之後這個說法廣泛流傳；交通部 2023 年 8 月 17 日向行政院報告「行人交通安全政策綱領」（2024–2027 年）；《道路交通安全基本法》2023 年 12 月 15 日公布、2024 年 1 月 1 日施行，以 2050 年道路交通事故零死亡為目標；行人 30 日內死亡 2022 年 394 人、2025 年 354 人。
      - 交通部另有 data.gov.tw 172799「112年道路交通事故30日死亡清單」，一列一位死者，但「當事者區分」「受傷程度」是那起事故第一當事者的欄位（不是死者本身），不能拿來分道路使用者，沒有用。
    - **顏色**：死亡率、占比、每萬輛都是橘色循序色（死亡率、每萬輛 `lowerIsBetter`，排名表由低排到高）；死亡人數是比例圓。側欄的組成用介面的 8 色（機車橘、行人紅、自行車綠、汽車藍、乘客紫、其他黃）。
52. **半導體**（`pipeline/topics/semiconductors.py`、`pipeline/sources/baci.py`、`mof_trade.py`）：
    - **來源的選擇**：跟貿易主題一樣用 CEPII BACI（第 15 點）：授權清楚（Etalab 2.0）、HS 六位碼、已調和進出口雙方的申報、整包下載，台灣是代碼 490。
      - UN Comtrade 的 API 要金鑰、有次數限制，而且同樣沒有台灣（BACI 的台灣就是從 Comtrade 的夥伴申報來的）。
      - WSTS（銷售額）、SEMI（設備出貨）是會員或付費報告，只有區域合計，不能轉載。
      - 財政部關務署的「海關進出口貿易統計資料查詢」（portal.sw.nat.gov.tw/APGA/GA30）要輸入驗證碼，程式不能查；改用財政部統計資料庫（見下面）。
    - **讀法**：`baci.yearly_products(prefixes)` 一次讀完 zip，回傳各六位碼逐年的雙邊值（千美元），8 年約 1–2.5 分鐘；流向檔、總額指標檔重用 `trade.py` 的 `_from_pairs()`、`_write_item()`，格式跟貿易主題相同。
      - 每列直接切逗號再比對代碼，比先用 `b',8542' in line` 篩選還快：5 個前綴就要把整列掃 5 次（300 萬列實測 4.6 秒，直接切 1.2 秒）。
      - 占全球比例的分母是同一個總額檔的世界合計（各國加總），跟側欄、排名表的「占全球」一致。
    - **HS 碼的選擇**（HS 2017，2024 年全球出口）：
      - 積體電路：8542 全部（854231 處理器、854232 記憶體、854233 放大器、854239 其他、854290 零件），9,276 億美元（2017 年 5,441 億）。
      - 分離式半導體：8541，但**不含 854140 與 854160**，497 億。
        - 854140 是「光敏半導體裝置，含太陽能電池與模組、LED」，780 億，比其他 8541 加起來還多；中國大陸占 47%、越南 9.5%、馬來西亞 6.6%，幾乎都是太陽能板，最大的進口國是美國（23.8%）。併進來的話「分離式半導體」就是太陽能板的地圖。所以另列成「光電元件（含太陽能、LED）」，不計入晶片合計。HS 2017 分不開太陽能、LED 與其他光敏元件（光二極體、光耦合器等）。
        - 854160 是裝好的壓電晶體（石英振盪器，64 億），不是半導體。
      - 晶片合計：積體電路＋分離式半導體，9,773 億。
      - 半導體設備：8486 不含 848630（平面顯示器製造設備，33 億，2017 年 113 億），加上 903082（晶圓、晶片的量測檢驗儀器，70 億）與 903141（晶圓、光罩的光學檢查儀器，83 億）。合計 1,418 億，其中 848620（晶片製造機器）775 億、848690（零件）336 億。
        - 出口：日本 22.3%、荷蘭 16.4%、美國 16.1%、新加坡 13.3%、馬來西亞 7.1%、南韓 5.7%，台灣 3.7%。進口：中國大陸 33.4%、南韓 14.6%、台灣 13.4%、美國 10.5%。
    - **HS 2017 與 HS 2022**：
      - HS 2022 把 854140 拆成 854141（LED）、854142（未組成模組的太陽能電池）、854143（太陽能模組）、854149（其他光敏元件），854150 拆成 854151（半導體感測器，從其他章節移進來）與 854159。8542、8486 沒有新的六位碼（財政部的貨品清單裡 8486 歷年都是同樣 5 個）。
      - BACI 的 HS22 版從 2022 年才開始，雖然分得開 LED 與太陽能，但只有 3 年。HS17 版把 2022 年起的申報用對照表換回 HS 2017，2017–2024 連續，所以用 HS17。
      - 換算的痕跡：854150 全球 2021 年 31 億、2022 年 5 億、2024 年幾乎是 0（HS 2022 的 854159 換到別的代碼）。分離式半導體的合計沒有明顯的斷層（2021 年 529 億、2022 年 573 億）。
    - **台灣抽查**（財政部統計資料庫，億美元）：
      - **BACI 沒有台灣自己的申報**：CEPII 的 FAQ 寫明聯合國不發布台灣的貿易統計，Comtrade 與 BACI 只有代碼 490「Asia, not elsewhere specified」當代理。所以台灣的出口完全是各進口國依原產地的申報（CIF 扣成 FOB），進口是各出口國的申報。
      - 積體電路出口，BACI／財政部：2022 年 2,163／1,841、2023 年 1,934／1,666（BACI 多 16%）、2024 年 2,233／1,650（多 35%）。財政部 2025 年已經是 2,092 億（BACI 2027 年 1 月才有 2025 年）。
      - 依市場（2024 年，財政部表 i9203 的「積體電路」就是 HS 8542 合計，跟 i8142 相加完全相同）：
        - 財政部：中國大陸＋香港 852.6（51.7%；大陸 484.7、香港 367.9）、新加坡 210.0、南韓 134.0、日本 104.2、馬來西亞 99.1、美國 74.0、越南 43.5、印度 29.9、泰國 24.2。
        - BACI：中國大陸＋香港 963（大陸 526、香港 437）、新加坡 403、南韓 212、日本 146、美國 101、馬來西亞 95、泰國 80、印度 55、越南 43。
        - 差最多的是新加坡（+193）、中國大陸＋香港（+110）、南韓（+78）、泰國（+56）、日本（+42）。進口國記的是原產地：在台灣製造、在其他國家封測或從經銷中心出貨的晶片，進口國照樣記成來自台灣；財政部記的是實際從台灣出口、依目的地。
        - 2023 年：財政部 中國大陸＋香港 903.8（54.2%）、新加坡 211.0、日本 156.6、南韓 113.8、馬來西亞 87.1、美國 35.0；BACI 中國大陸＋香港 856、新加坡 344、日本 172、南韓 163、美國 58。
      - 細項的歸類也不同：2024 年台灣的處理器（854231）BACI 803 億、財政部 172 億；財政部大多報在 854239「其他」（1,273 億，BACI 1,106 億）。所以只比 IC 合計，不分細項。
      - 積體電路進口，BACI／財政部（依原產地）：2023 年 529／732、2024 年 730／943（財政部多 29%）。出口國常記成出口到轉運地，BACI 也不計香港的轉口。
      - 其他商品比較接近：半導體設備出口 2024 年 52／53、進口 190／216；分離式半導體出口 26／23；光電元件出口 21／14。
      - 占全球：BACI 2024 年台灣 IC 出口占 24.1%，第 1（2017 年 19.8%）；用財政部的數字算約 19.0%，跟中國大陸（BACI 1,712 億、約 19.7%）差不多。中國海關公布的 2024 年 IC 出口是 1,595 億（媒體引述），也比 BACI 少。
      - **地圖、排名一律用 BACI**（各國同一套方法）；差異寫進台灣的附註。附註由資料管線每次讀財政部的數字產生（出口、進口、占比三種檔都有），build 時也會印出 BACI／財政部對照表。
    - **財政部的資料**（`pipeline/sources/mof_trade.py`）：財政部網站「進出口統計 → 貿易統計查詢」連到統計資料庫（`web02.mof.gov.tw/njswww/WebMain.aspx?sys=100&funid=defjsptgl`），跟財政統計（`mof.py`）同一套系統，不用驗證碼。
      - 表 i8142「貨品別貿易值－HS 分類 6 碼」，千美元、一般貿易制度，出口依目的地、進口依原產地。
      - 查詢頁（`sys=210&funid=i8142`）依序列出約 6,100 個貨品勾選框，網址用勾選框的順序選項目：`fldspc`（幣別）、`codspc0`（出口、進口）、`codspc1`（貨品），格式是「起點,個數,」的連續區段。全部寫成 0/1 的 `codlst1` 網址太長，會被防火牆擋下，回「使用者網路連線異常」的網頁（HTTP 200）。
      - `outkind=1`：每列一個年份（「113年」），每欄一個「幣別／進出口／貨品」；預設的 `outkind=11` 會把選的貨品加總成一欄。
      - 台灣在 2023 年間改用 HS 2022（2023 年 854140 與 854141–854149 都有數字），對照時把兩版的代碼都算進同一類；854151（HS 2022 新移進來的感測器）不算。
      - 依市場的數字用表 i9203（出口主要國家／地區、貨品細分類），只用在這裡的抽查，沒有放進資料管線。
    - **香港與中國大陸**：BACI 不計香港的轉口。2024 年香港的 IC 出口只有 123 億，進口 2,167 億（全球第 1，23.4%），BACI 裡香港到中國大陸幾乎是 0；經香港轉進中國大陸的晶片都記在香港。中國大陸＋香港 2024 年 3,910 億；2023 年 3,277 億，中國海關公布的 IC 進口是 3,494 億（媒體引述）。香港、中國大陸的進口檔有附註，進口占比的說明也有寫。
    - **限制**：
      - BACI V202601（2026 年 1 月發布）只到 2024 年；每年 1 月更新，最新一年之後還會修正。
      - 貿易額不是產值：晶片從晶圓廠、封裝測試到模組組裝常跨國好幾次，每次都算一次出口，全球 IC 出口（9,276 億）比全球半導體銷售額大很多。
      - 原產地與出貨地不同（新加坡、馬來西亞、香港是轉運或封測中心），所以 BACI 的雙邊流向跟各國海關自己的統計可能差很多（見台灣的抽查）。
      - 8486 只收「專用或主要用於」製造半導體、平面顯示器的機器；通用設備（真空幫浦、工業機器人、潔淨室、化學品供應系統）與材料（矽晶圓、光阻、特殊氣體）都不在裡面。量測檢查儀器只加了 HS 寫明「半導體」的 903082、903141。
      - 854140 在 HS 2017 分不開太陽能、LED 與光感測元件，整項另列。
    - **沒有用的**：UN Comtrade API、WSTS、SEMI（見上面）；關務署 GA30 查詢（驗證碼）；BACI HS22 版（2022 年起）；OEC（BACI 的轉製，沒有比較多的資料）。
53. **關鍵礦產**（`pipeline/topics/minerals.py`、`pipeline/sources/usgs_mcs.py`）：
    - **來源**：USGS 的 Mineral Commodity Summaries（MCS），每年 1–2 月出一版，每個礦種一章，第 2 頁的「World Mine Production and Reserves」表列出主要生產國前兩年的產量（後一年是估計值）、最新的蘊藏量、「Other countries」與「World total (rounded)」。合併 2020–2026 年版：產量 2018–2025 年，蘊藏量 2019–2025 年。
      - **每一年用最新一版有那一年的整張表**（2024 年用 2026 版的修正值，2023 年用 2025 版），同一年不混用兩版，「其他國家」與世界總計才對得起來。2025 年是 2026 版的初估，寫在指標說明、頁尾與側欄（「2025 年（初估）」）。
      - 沒有用 `projectionFrom`：那是給推估（未來預測）用的，時間軸會把之前所有年份標成「估計值」，「2025 起為推估」又跟時間軸結尾的「2025」疊在一起。
    - **讀 PDF，不讀資料發布的 CSV**：
      - ScienceBase（www.sciencebase.gov，MCS 資料發布的所在）有 Cloudflare 驗證，程式下載回 HTTP 403（「Just a moment…」），API 也一樣。
      - 資料發布只有 2022 版起才有，格式每年都換：2022、2023 版每章一個 CSV（2022 版沒有蘊藏量），2024 版每章一個 ScienceBase 項目，2025 版一個總表（`MCS2025_World_Data.csv`），2026 版是所有章節的長表（`MCS2026_Commodities_Data.csv`）。
      - pubs.usgs.gov 的各章 PDF（`https://pubs.usgs.gov/periodicals/mcs2025/mcs2025-lithium.pdf`）可以直接下載，2020–2026 版的表格版面都一樣。用既有的 `sources/pdfreader.py`（只用標準函式庫）讀文字與座標：
        - 同一頁 y 相差 1.5 pt 以內算同一行（2021 版鋁土礦的世界總計，數字比國名低 1 pt）；註腳編號與「e」是 6 pt 的小字，在另一行，丟掉。
        - 表格從「World … Production … :」到「World Resources」；年份那一行（兩個以上的年份，可能還有「(thousand metric tons)」）上面最近的一行是欄位標題（「Mine production | Refinery production | Reserves」「Palladium | Platinum」「Alumina production | Bauxite production」）。
        - 數字靠右對齊：依右緣分群成欄，對到最近的年份標題；右邊沒有年份的那一欄是蘊藏量。欄位的順序各章不同（鉑族金屬是鈀在前，鋁土礦那章是氧化鋁在前），所以依標題選欄，不寫死第幾欄。
        - 「W」（保密）、「NA」、「XX」當缺值，「—」是零，「Small」、「(⁴)」（併在其他國家）當缺值，「>」是下限。
        - 年份對不上、找不到蘊藏量那一欄、國名認不得時直接報錯。
      - 鉑族金屬的檔名 2022 版以前是 `platinum`、2023 版起是 `platinum-group`；鋁土礦是 `bauxite-alumina`。
    - **PDF 解析跟資料發布逐筆比對**：Internet Archive 存了 2022、2023 版的 `world.zip`、2025 版的 `World_Data_Release_MCS_2025.zip` 與 2026 版的 `MCS2026_Commodities_Data.csv`（ScienceBase 的檔案網址加 `web/<時間>id_/`），2024 版沒有存檔。17 個礦種在這 4 版兩邊都是數字的 2,105 筆，2,101 筆完全相同。不同的 4 筆都是 CSV 跟 PDF 本身不一致：
      - 2026 版巴西的稀土蘊藏量 PDF 是 1,100 萬噸、CSV 是 2,100 萬噸（PDF 的表頭寫明巴西的蘊藏量依政府報告修正過），世界總計 PDF 是「>7,500 萬」、CSV 是 8,500 萬。
      - 2026 版錳的世界蘊藏量 PDF 18 億噸、CSV 17 億噸；2025 版俄羅斯 2024 年的釩產量 PDF 21,000 噸、CSV 20,000 噸。
      - 其他差異是 CSV 把「—」「NA」留空、2023 版 CSV 的「United States」帶不換行空白、2023 版銻的世界蘊藏量 CSV 寫 NA（PDF 是 >180 萬噸）。
      - 比對腳本沒有放進資料管線（要靠 Internet Archive 的副本）；PDF 是正式出版品，以 PDF 為準。
    - **計量口徑**（子項目名稱的括號裡、指標說明）：都換成公噸。
      - 礦場產量的金屬含量：鋰、鈷、鎳、錳、錫、鎢、釩、鈮、銻、銅（可回收的銅含量）。
      - 稀土是稀土氧化物（REO）當量；天然石墨、鋁土礦（乾重）是礦石重量。
      - 鎵是初級（低純度）產量，主要是煉鋁時回收的副產品（2025 版起表名改成「World Low-Purity Production」）；鍺是精煉產量（含回收）。兩者都沒有蘊藏量。
      - 單位換算：銅、錳、鋁土礦是千公噸，釩的蘊藏量是千公噸（產量是公噸），鎵、鍺、鉑、鈀是公斤。格式化：一百萬噸以下寫出噸數（中文的「萬」取整數會把美國的稀土 45,500 噸寫成「5 萬」），10 噸以下留一位小數，1 噸以下改寫公斤。
      - 鉑、鈀的蘊藏量是鉑族金屬合計（USGS 沒有分開），兩個子項目的蘊藏量相同，附註有寫。
    - **占全球比例**的分母是表上的「World total (rounded)」（含其他國家），不是列出國家的加總。
      - 鋰、鋁土礦的世界總計不含美國（美國的產量是 W），2025 年的銻也是。W 的國家附註寫明年份（「2018–2025 年 USGS 為了不洩漏個別公司的資料沒有公布（W），世界總計也不含」）。
      - 蘊藏量的世界總計常常只寫下限（稀土「>7,500 萬噸」、鎳「>1.4 億噸」）：分母用下限跟列出國家加總的較大值，比例可能偏高，指標說明有寫。
      - 世界總計是四捨五入的，加總偶爾超過 100%（2025 年中國的鎵 900,000 ÷ 900,000 公斤 = 100%）。
    - **分級**：占比 [1, 5, 10, 25, 50, 75]%。中國的稀土約 71%、釩 71%、剛果（金）的鈷 75%、印尼的鎳 62% 在 50–75%；中國的石墨 82%、鎢 82%、鎵 99%、巴西的鈮 93% 在 75% 以上，看得出差別。如果用 [1, 5, 10, 20, 40, 60]，這 8 種都在最深的一級。
    - **檢查用的數字**（2024 年，MCS 2026 的 PDF 與資料發布 CSV 相同；括號是 MCS 2025 當時的估計）：
      - 中國稀土 270,000 噸（270,000），占全球 380,000 噸的 71.1%。
      - 剛果（金）鈷 226,000 噸（220,000），占 302,000 噸的 74.8%。
      - 印尼鎳 2,310,000 噸（2,200,000），占 3,710,000 噸的 62.3%。
      - 智利銅 5,510 千噸（5,300），占 23,000 千噸的 24.0%。
      - 澳洲鋰 82,700 噸（88,000），占 222,000 噸（不含美國）的 37.3%。
    - **側欄**（`top-producers.json`，一個檔、依年份）：占全球產量 5% 以上，或全球前 5 名而且占 1% 以上的礦種，附名次與占比，依占比排序。只用「前 5 名」的話，鉑族金屬、鎵只列出 5、6 國，日本的鎵（0.35%，第 3 名）、剛果（金）的鈮（0.87%）都會算成主要生產國。名次只比 USGS 列出的國家，同值同名次（2024 年中國與俄羅斯的銻都是 40,000 噸，並列第 1）。
    - **台灣**：這 16 種礦產 USGS 的表上都沒有台灣（MCS 裡台灣只出現在 2022、2023 版鋼鐵的世界產量表，以及美國的鉻、鎂、工業用砂的進口來源），所以沒有可補的官方數字。用 `noValue` 讓 tooltip 與數值卡片寫「台灣不是生產國，仰賴進口」，側欄的「主要生產的礦產」與頁尾寫完整的說明。
    - **USGS 只列出主要生產國**：其餘併入「Other countries」，地圖上是灰色（2024 年稀土 16 國、鋰 9 國、鉑與鈀各 5 國、鎵 4 國）。
    - **重要的註腳手動抄進附註**（PDF 的註腳沒有解析）：中國的稀土是開採配額、不含未申報的產量；緬甸、馬達加斯加、馬來西亞、泰國、越南 2024–2025 年的稀土是 USGS 依中國的進口資料估計的；中國的鎵來自 Asian Metal；新喀里多尼亞是法國的海外屬地。
    - **鍺只到 2020 年**：2020–2022 版有中國、俄羅斯的精煉產量（公斤；2020 年中國 95 噸，占世界 140 噸的 67.9%），2023 版把 2021、2022 年都改成 NA，2024 版起只剩文字說明（「Because most producers do not publicly report germanium production, global production data were limited」）。依「每一年用最新一版」的規則，2021 年的 2022 版估計值也不用；指標檔只留有資料的 2018–2020 年，選鍺時時間軸停在 2020 年。頁尾、指標說明與中國、俄羅斯的附註有寫。
    - **沒有收的**：
      - Minerals Yearbook：年份較長，但每章格式不同、產品分得很細（錳礦依品位分十幾列、鎳分礦場與各種中間產品），而且晚 MCS 一到兩年才出。USGS 為 2025 年關鍵礦產清單整理的 Minerals Yearbook 資料（ScienceBase 項目 6899fa60…）也只有 2018–2023 年。
      - 資料發布的 CSV：只用來比對（見上）。
    - **授權**：USGS 編製的資料與出版品是美國公有領域（https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits ，請註明出處）；2026 版資料發布的中繼資料寫明 CC0 1.0。
54. **就業與失業**（`pipeline/topics/employment.py`、`pipeline/sources/dgbas_labour.py`）：
    - **失業率、青年失業率、勞參率用 ILO 模型估計**（ILOEST，2025 年 11 月版；`UNE_2EAP_SEX_AGE_RT_A` 的 `AGE_YTHADULT_YGE15`、`AGE_YTHADULT_Y15-24`，`EAP_2WAP_SEX_AGE_RT_A`），下載方式同第 30 點（rplumber API）。2026 年 10 月時 TOC 的 last.update 是 2025-12-02，ILO 每年 11 月左右出新版，要 `--refresh` 才會重新下載。
      - 有申報勞動力調查的國家與年份用各國的數字（`obs_status` 是 `R`「Real value」），其他由模型補，所以 189 國每年都有值（中國、北韓、中非、厄利垂亞等 8 個國家或地區從來沒有 `R`）。各國申報的調查值（`UNE_DEAP_SEX_AGE_RT_A`）定義、年份不一，沒有用。
      - **推估**：模型估計的資料到 2027 年，但 `R` 最晚只到 2024 年（2024 年 64 國、2023 年 97 國），2025 年一國都沒有，是 2025 年 11 月時的推估。`projectionFrom` 取「最後一年有 `R` 的下一年」（現在是 2025），資料只收到那一年；2026–2027 年是預測，台灣也沒有官方的預測值，不收。勞參率的資料集沒有 `R` 的註記，用同一個 `projectionFrom`。
      - 世界值用 ILO 的 X01（`aggregates`）：2024 年失業率 4.88%、青年失業率 12.28%、勞參率 60.98%。
      - 失業率不設 `lowerIsBetter`：很多低所得國家沒有失業保險，大家只能做零工，失業率反而很低（卡達 0.13%；尼日的青年失業率 0.39%），「越低越好」會誤導，指標說明有寫。
      - 分級：失業率 3、5、7.5、10、15、20%（2024 年中位數 5.1%，最高史瓦帝尼 34.6%）；青年失業率 5、10、15、20、30、40%（最高吉布地 76.5%）；勞參率 45–70% 每 5 個百分點（23.3–87.0%）。
    - **非正式就業用 ILOSTAT 的調和序列**（`EMP_NIFL_SEX_RT_A`，ICLS 第 13 屆的定義，SDG 8.3.1，跟 `SDG_0831_SEX_ECO_RT_A` 的 `ECO_SECTOR_TOTAL` 是同一份數字）：ILO 用各國勞動力調查的原始資料依同一套定義重新計算（`note_source` 的 `R1:3513`「ILO-STATISTICS - Micro data processing」），147 國。
      - ILO 的非正式就業模型估計（`EMP_2IFL_SEX_RT_A`）只有區域、所得組與世界（87 個 X 代碼），沒有各國；世界值（X01，2024 年 57.8%）在 `EMP_NIFL_SEX_RT_A` 裡也有，拿來當對照線。
      - 新定義（ICLS 第 19 屆，`SDG_B831_SEX_ECO_RT_A`）只有 100 國、2014 年起，沒有用。
      - 調查年份零散，`latestWithin: 5`，年份 2007–2025（`latest_year_span`）；2024 年 127 國，其中 79 國是當年的資料。美國、日本、中國、加拿大、澳洲沒有資料，韓國只有 2019 年（29.1%）。
      - 分級 5、10、25、50、75、90%：分布兩極，歐洲多在 1–10%，非洲、南亞多在 75% 以上。
      - 歐洲國家的勞動力調查沒有直接問社會保險，ILO 用代理變數判斷，前後年可以差 10 個百分點（捷克 2022 年 17.3%、2023 年 4.1%；克羅埃西亞 2024 年 5.3%、2025 年 14.8%），照原樣呈現。
      - **南非 2025 年不收**（`INFORMAL_DROP`，2026 年 10 月的版本）：42.3%，2024 年 34.8%，同一個來源，但農業的非正式比例從 35.4% 跳到 75.9%，還多了一類 53.0% 的「無法分類」行業，是處理方式改了。附註有寫。
      - 只涵蓋部分地區的調查依 `note_source` 自動加附註（`ilostat.flagged_source()`）：阿根廷（只有主要城市，`S4:33`）、剛果（只有都市，`S4:31`）、巴勒斯坦（不含加薩，`S4:6333`）。
    - **台灣**：
      - **ILO 的模型估計其實有台灣**（`TWN`），但失業率只用到 2020 年以前台灣的實際資料（`R`），之後是模型推算：2024 年 3.71%，主計總處 3.38%；青年失業率 12.33%，主計總處 11.27%。勞參率到 2024 年都跟主計總處相同，2025 年是推估（59.31%，主計總處 59.43%）。所以三個指標整條改用主計總處，附註有寫。
      - 來源：nstatdb `A040109010`「勞參率及失業率-按年齡分」，兩個分類維度：`codspc0` 是性別（合計、男、女）、`codspc1` 是年齡（合計、15~24歲…）。`dgbas.py` 的 `_table()` 固定 `codspc1=` 空白（只有年齡合計），所以另寫 `dgbas_labour.py`，快取檔名 `A040109010-sex-age.csv`，不會跟性別主題用的 `A040109010.csv` 互相覆蓋。1978 年起，今年（還沒結束）不收。
      - 定義（主計總處〈人力資源調查統計編製方法概述與名詞定義〉）：臺灣地區（不含金門、連江）15 歲以上的民間人口，不含武裝勞動力與監管人口；失業者是無工作、隨時可以工作、正在找工作或已找工作在等待結果，另含等待恢復工作者與已找到工作還沒開始上班者，跟 ILO 相同。就業者含每週 15 小時以上的無酬家屬工作者（ILO 第 13 屆 ICLS 的標準不設工時下限，但允許各國自訂）。附註有寫。
      - 抽查：2024 年失業率 3.38%（勞動部統計引用主計總處：113 年平均 40.6 萬人、3.38%）；主計總處 114 年 12 月新聞稿（2026-01-22）：114 年全年失業率 3.35%（年降 0.03 個百分點）、勞參率 59.43%（年升 0.15，所以 113 年是 59.28%），都跟 nstatdb 相同。青年失業率 2024 年 11.27%、2025 年 11.32%。2024 年失業率在 183 國中第 132 名（由高到低）、青年失業率第 102 名、勞參率第 109 名。
      - **非正式就業從缺**：台灣沒有 ILO 口徑（雇主是否登記、有沒有社會保險與帶薪假）的統計。最接近的是人力運用調查的「非典型就業」（部分時間、臨時性或人力派遣）：113 年 5 月 80.4 萬人、占全體就業者 6.95%；114 年 10 月 79.9 萬人、6.86%（114 年因預算凍結改在 10 月調查）。概念不同（看工時與契約期間），只寫在附註，不畫在地圖上。數字取自主計總處人力運用調查新聞稿（113 年 2024-11-28、114 年 2026-03-19 發布）。
    - **側欄的男女對照**（`EmploymentPanel.tsx`）：每個指標另外輸出 `<指標>-female.json`、`<指標>-male.json`（ILOSTAT 的 `SEX_F`、`SEX_M`；台灣用同一張 nstatdb 表的男、女），表格列出選定年份四個指標的女性、男性（非正式就業標出資料年份），下面畫男女失業率的折線。`PanelExtraProps` 沒有目前的指標，所以四個指標一起列。
    - **授權**：ILOSTAT（含 ILO 模型估計）是 CC BY 4.0（第 12 點）。主計總處的政府網站資料開放宣告採政府資料開放授權條款第 1 版（https://www.stat.gov.tw/cp.aspx?n=3164）。
    - **沒有用的**：ILO 的非正式就業模型估計（只有區域）、ICLS 第 19 屆定義的非正式就業（國家少）、各國申報的失業率調查值（定義與年份不一）；世界銀行的 `SL.UEM.TOTL.ZS` 等也是轉載同一份 ILO 模型估計，直接用 ILOSTAT 比較新。
    - **時間軸的推估標籤**：`projectionFrom` 剛好是最後一年（2025）時，時間軸上「2025 起為推估」跟結尾的「2025」原本疊在一起；`TimeSlider` 改成這種情況只在結尾寫一個「2025 起為推估」。
55. **外匯存底與外債**（`pipeline/topics/reserves.py`、`pipeline/sources/worldbank_qeds.py`、`cbc_reserves.py`、`imf_pcps.py`）：
    - **外匯存底用 WDI 的 `FI.RES.TOTL.CD`**（IMF 國際金融統計的總準備：外匯、黃金、SDR、在 IMF 的準備部位）。黃金以年底的倫敦市價計：美國、德國的黃金價值 ÷ 持有量，2024 年都是每盎司約 2,610 美元、2025 年約 4,370 美元。
      - 2025 年已經有 132 國。香港 2024 年起、俄羅斯 2025 年沒有資料，指標檔加 `latestWithin: 1`，2024 年的地圖上香港顯示 2023 年的 4,256 億美元（第 9）。
      - 世界合計：各國（`latestWithin` 內）加總，有資料國家的 GDP 占世界 90% 以上的年份才算（1980 年起）。2024 年 15.92 兆美元。
      - 2024 年前幾名：中國 3.46 兆、日本 1.23 兆、美國 9,100 億、瑞士 9,094 億、印度 6,430 億、**台灣 6,127 億（第 6）**、俄羅斯 6,084 億。
    - **可支應進口月數**：WDI 的 `FI.RES.TOTL.MO` = 總準備 ÷（`BM.GSR.TOTL.CD` ÷ 12），**進口含初次所得**（利息、股利、薪資），不是只有商品與服務。用這兩個序列自己重算，7,094 筆跟世界銀行的完全相同（差 1% 以上的 0 筆），台灣與世界值也照這個算法。
      - 世界值用「各國總準備合計 ÷ 進口合計」，2024 年 4.9 個月。世界銀行的 World 是另一種加權平均（2024 年 8.8 個月），沒有用。
      - 歐元區國家共用歐元，月數很低（愛爾蘭、盧森堡 0.1 個月，德國 2.2、法國 2.4），說明有寫。
      - 門檻 1、3、6、9、12、18 個月（3 個月是常用的最低安全水準）。2024 年 161 國：中位數 4.3、P90 9.7；利比亞 31.6（2023 年）第 1、台灣 17.5 第 2。
    - **外債占 GDP**：外債總額（年底，美元）÷ IMF WEO 的名目 GDP（`NGDPD`，年平均匯率），年底存量除以全年 GDP 是 IMF、世界銀行的慣例。
      - **QEDS**（世界銀行與 IMF 合編，資料目錄 https://datacatalog.worldbank.org/search/dataset/0037740 ，DataBank 的「Quarterly External Debt Statistics SDDS (New)」）：World Bank API 的 source id 是 **22**。一般的 `/v2/country/all/indicator/<代碼>?source=22` 回「Request Error」，要用 `/v2/sources/22/country/all/series/DT.DOD.DECT.CD.AR.US/time/all`（檔頭有 BOM）。23 號（GDDS）查這個代碼回「Data not found」，阿富汗、貝南這些 GDDS 國家也在 22 號裡。`DT.DOD.DECT.CD.AR.US` 是 All Sectors、All maturities、All instruments 的外債總額（IMF《外債統計指南》的定義：存款、借款、債券、貿易信用、直接投資的公司間債務，不含股權與衍生性商品，等於國際投資部位表的債務工具負債）。季資料，年底取第 4 季；128 國，2024 年 118 國。
      - **IDS**（國際債務統計）只有中低所得國家：用 WDI 的 `DT.DOD.DECT.CD`（121 國，1970–2024）。世界銀行公布的比率 `DT.DOD.DECT.GN.ZS` 是**占 GNI**，這裡改成自己除以 GDP，跟其他國家同一個分母。
      - 兩邊都有的 74 國，QEDS ÷ IDS 的中位數是 0.99（2023 年）。差很多的：模里西斯 QEDS 是 IDS 的 9–17 倍（含離岸的全球商業公司，2024 年占 GDP 1,270%，IDS 是 136%）；布吉納法索、巴拉圭約一半，斐濟 0.43、多米尼克 0.71、賴比瑞亞 0.69、馬達加斯加 0.73。
      - 所以 **IDS 國家一律用 IDS**（同一國不混用，否則序列會跳），不在 IDS 的 54 國（高所得國家）用 QEDS。保加利亞、俄羅斯在 IDS 只到 2022 年，2023 年起接 QEDS（兩邊都有的 2015、2020 年差 6% 以內），附註有寫。最近 5 年 QEDS 跟 IDS 差 25% 以上的國家，附註寫出 QEDS 的數字。
      - **2003 年起**：QEDS 在 2002 年只有 22 個非 IDS 國家（沒有美國、日本、新加坡、澳洲），2003 年 38 國，之前的地圖幾乎只有中低所得國家。
      - IDS 2025 年的資料要 2026 年 12 月才發布，2025 年只有 QEDS 的 53 國，加 `latestWithin: 1`，中低所得國家顯示 2024 年的值。
      - **金融中心的外債是 GDP 的好幾倍**：2024 年盧森堡 3,983%、馬爾他 805%、賽普勒斯 645%、愛爾蘭 523%、香港 463% 在最深的一級（400% 以上），新加坡 392%、荷蘭 343%、英國 261%、法國 239% 在 200–400%。它們同時有相當的對外資產，說明有寫。門檻 20、40、60、100、200、400%；2024 年 170 國中位數 48.5%、P90 160%。
    - **經常帳占 GDP**：IMF WEO 的 `BCA_NGDPD`（DataMapper，含台灣與推估值）。發散色，門檻 ±2、±5、±10%：2025 年 194 國中位數 −1.2%、P10 −13.3%、P90 +12.2%。不放世界值（全世界的經常帳加起來應該是 0，IMF 的世界值只是統計誤差）。
    - **台灣**（WDI、IDS、QEDS 都沒有；台灣不是 IMF 會員，也沒有 IMF 的「國際準備與外幣流動性」範本）：
      - **外匯存底**：中央銀行統計資料庫的 API（cpx.cbc.gov.tw）沒有這張表（API 說明的 PDF `/Data/ExportToAPIInfo` 用 `pdfreader.py` 讀得出代號清單）。改用政府資料開放平臺 6025 的 CSV（`https://www.cbc.gov.tw/public/data/OpenData/WebF3.csv`，月底，十億美元，2003 年 7 月起），取 12 月。
        - 抽查：2025 年底 6,025.53 億美元（央行 2026 年 1 月公布）、2023 年底 5,705.95 億，跟 CSV 相同；2024 年底 5,766.8 億（央行公布 2025 年底比前一年增加 258.76 億，倒推 5,766.77 億）。
      - **黃金**：央行公布的外匯存底**不含黃金**。國際投資部位表（API 的 `BPF4Y01`）的「準備資產」含黃金，但以帳面成本計，2024 年底 5,814.1 億美元，只比外匯存底多 47.3 億。央行的黃金約 1,362 萬盎司（約 424 公噸；2020–2025 年央行報告立法院的是 1,358–1,363 萬盎司，1980 年代買進後只買不賣）。
        - 地圖上用**外匯存底 ＋ 1,362 萬盎司 × 當年 12 月的平均金價**（IMF 初級商品價格 PCPS 的 `PGOLD`，倫敦金價；2024 年 2,640.6、2025 年 4,313.9 美元），跟其他國家「黃金以年底市價計」一致。12 月平均跟年底金價差約 1%，對總額的影響不到 0.2%。
        - 2024 年 5,766.8 億 ＋ 黃金 359.7 億 = 6,126.5 億（第 6）；2025 年 6,025.5 億 ＋ 587.6 億 = 6,613.1 億（第 6）。只算外匯存底或用準備資產的話，2024 年都排在俄羅斯（6,084 億）之後，第 7。附註列出三個數字。
      - **進口月數**：上面的總準備 ÷（央行國際收支 `BPP2Y01` 的「商品-支出」＋「服務-支出」＋「初次所得-支出」÷ 12），跟世界銀行同一個算法。2024 年進口 4,213.2 億美元 → 17.5 個月（只算外匯存底 16.4 個月）；2025 年 5,193.5 億 → 15.3 個月。
      - **外債**：央行公布的「外債」統計（國際收支季報附表一，`https://www.cbc.gov.tw/public/data/economic/statistics/bop/hist_Debt1.pdf`，1999 年起）2024 年底 2,199.47 億、2025 年底 2,439.50 億美元，範圍比 IMF《外債統計指南》窄：民間長期外債只有 100 萬美元，跟國際投資部位表的債務工具負債差很多（2003 年 631 對 648 億，之後差距越來越大），央行沒有公布細項，看不出差在哪裡。
        - 所以地圖用**國際投資部位表的債務工具負債**（直接投資 ＋ 證券投資的債務證券 ＋ 其他投資），也就是 QEDS 的外債總額定義。2024 年底 3,514.3 億美元 = 直接投資 199.6 ＋ 債務證券 41.3 ＋ 其他投資 3,273.4（存款 1,565.4、借款 722.3、貿易信用 906.4、其他應付款 79.4）。國際投資部位表 2024 年底負債總計 14,790 億美元，跟央行公布的「對外金融負債 1.48 兆美元」相同。
        - 占 GDP：2024 年 43.8%、2025 年 40.7%（第 99、107 名）；央行的外債統計是 27.4%、26.5%，寫在附註。
        - GDP 用主計總處的名目 GDP（`A018103010`）÷ 央行的年平均匯率（`BP01Y01`）：2024 年 8,016 億美元、2025 年 9,214 億，IMF 的 `NGDPD`（也是主計總處的數字）差不到 0.1%。
      - **經常帳**：IMF 的台灣數字就是央行國際收支：2024 年 1,145.5 億美元、14.3%；2025 年 1,843.9 億、20.0%（第 6，IMF 也是 20.0%）。2015–2021 年 IMF 比央行 ÷ 主計總處低 0.1–0.4 個百分點（例如 2018 年 11.6% 對 12.0%），2022 年起相同；照用 IMF，附註對照最新一年。
    - **沒有用的**：IDS 的占 GNI 比率（分母跟 QEDS 國家不同）；世界銀行 World 的進口月數（加權方式不同）；央行的準備資產（黃金以帳面成本計）與「外債」統計（範圍較窄），都只放在附註。
56. **股市規模**（`pipeline/topics/stock_market.py`、`pipeline/sources/sfb.py`、`cbc_fx.py` 的 `ntd_per_usd_year_end()`）：
    - **各國用世界銀行轉載的 WFE 資料**：`CM.MKT.LCAP.GD.ZS`（市值占 GDP）、`CM.MKT.LCAP.CD`（市值，當年美元）、`CM.MKT.LDOM.NO`（上市的本國公司家數）。
      - 年底值，美元用年底匯率換算；不含投資基金與只持有其他上市公司股份的控股公司。原本是 S&P 的資料（2013 年停刊），2015 年 12 月起整條序列換成 WFE 的。
      - 一國有多個交易所時，世界銀行的國家值是各交易所的合計（台灣在 WFE 是證交所、櫃買中心兩個會員）。
      - 資料到 2025 年，每年約 70 國；`year_span` 截掉頭尾後市值與占 GDP 1982–2025、家數 1980–2025。
    - **跨國交易所集團沒有資料**：WFE 對泛歐交易所（Euronext）、那斯達克北歐與波羅的海只公布集團合計，世界銀行沒有分到各國。
      - 法國、荷蘭、比利時、葡萄牙、愛爾蘭到 2018 年，挪威到 2019 年；瑞典、丹麥、芬蘭、冰島、波羅的海三國到 2003–2004 年。
      - 義大利到 2014 年、英國缺 2015–2020 年：倫敦證交所集團當時含義大利證交所，WFE 的「倫敦」是集團合計（金管會「世界主要證券市場上市公司家數比較」裡倫敦 2020 → 2021 年少了約 350 家，就是 2021 年賣給泛歐交易所的義大利證交所）。2023 年起 WFE 沒有公布倫敦的資料（金管會的表上標「#」：WFE 未公告）。
      - 這些國家在三個指標都有附註說明。沒有用主題的 `noValue`：它會把側欄的歷年折線圖整個換成文字，而這些國家之前的年份有資料。
    - **世界銀行（WFE）的錯誤，不收**（`stock_market.py` 的 `DROP`，2026 年 10 月的版本）：
      - 印度 2018、2025 年：孟買證交所（5,000 多家）與國家證交所（2,000 多家）直接相加，同一批公司算兩次，市值是前後年的兩倍（2025 年 10.6 兆美元、占 GDP 267%，2024 年是 5.1 兆、136%）。三個指標都不收，所以預設年份用 2024。
      - 印度的家數 2017 年以前是孟買證交所（約 5,000 家），2019 年起是國家證交所（約 2,000–2,700 家），附註有寫。
      - 伊朗 2018–2023 年的美元市值依官方匯率換算，2023 年變成 2.06 兆美元（比台灣還多）、占 GDP 450%；2024 年改用接近市場的匯率後是 1,720 億美元、36%。市值與占 GDP 不收（比照薪資主題對伊朗、黎巴嫩官方匯率的處理），家數照收。
      - 波札那 2022 年的市值是前後年的 10 倍（310 億美元、153%）；亞塞拜然 2019 年 951 家（前後年 13–36 家）。不收。
    - **照收、加附註的口徑差異**（家數）：
      - 中國 2019 年起含新三板（全國中小企業股份轉讓系統）：2019 年 12,730 家 = 上海 1,572 + 深圳 2,205 + 新三板 8,953（新三板 2019 年底的掛牌家數）。
      - 日本 2013 年東京與大阪證交所合併，之後含 JASDAQ，2,294 → 3,408 家。
      - 西班牙約 1999–2021 年含數千家掛牌的可變資本投資公司（SICAV），2022 年稅制改變後大多下市，2,558 家（2021）→ 277 家（2024）。
      - 孟加拉 2011–2024 年的家數約是 2025 年的兩倍（691 → 360 家），可能是達卡、吉大港兩個交易所的合計，原因查不到，沒有處理。
    - **世界銀行的世界合計含台灣**：世界合計減去各國加總，2024 年是 2.453 兆美元、1,756 家，跟證期局的台灣數字（2.454 兆美元、本國公司 1,756 家）幾乎相同；2002–2025 年的市值都差 0.5% 以內（2010、2020 年差 1–4%），家數 2020–2025 年完全相同。1998–2001 年只等於證交所（WFE 當時沒有櫃買中心）。所以台灣不能再加進世界銀行的世界合計，否則重複。
      - 這裡的世界值改成自己算：地圖上有資料國家（含台灣、扣掉上面不收的值）的合計；占 GDP 是市值加總 ÷ GDP 加總，GDP 由各國的市值 ÷ 占比反推（同軍費）。2024 年 115.09 兆美元、129.4%，跟世界銀行的 WLD（115.09 兆、129.4%）相同；2025 年 130.7 兆、143.4%（世界銀行 141.3 兆、148.5%，差的 10.6 兆就是不收的印度，世界銀行把它算了兩次）。
      - 因為少了泛歐交易所等，世界值偏低，所以沒有開「占全球比例」；占 GDP 有世界的對照線。
    - **台灣**（世界銀行沒有台灣）：
      - **證交所、櫃買中心的網站不能用**：兩邊的使用條款都禁止用程式下載，未經書面同意不得重製、散布，只有授權給政府資料開放平臺的資料例外（https://www.twse.com.tw/zh/terms/use.html 、https://www.tpex.org.tw/zh-tw/gtsm_disclaimer.html）。證交所的「證券統計資料年報」（歷年股票市場概況表，xls）有完整的歷年數字，但不能拿來用。
      - 改用金管會證期局彙編的數字（政府資料開放授權條款）：
        - data.gov.tw 103533「公開發行公司股票發行概況統計表」（`https://stat.fsc.gov.tw/api/v1/public/datasets/103533/export`，UTF-8 CSV，月資料，1998 年 8 月起）：上市家數、上市市值、上櫃家數、上櫃市值（新臺幣十億元）。開放資料更新得慢，2026 年 10 月只到 2025 年 7 月。
        - 證期局網站「證券暨期貨市場重要指標」（https://www.sfb.gov.tw/ch/home.jsp?id=622&parentpath=0,4,109 ）每月一個 zip，裡面再包 ods 與 xls 兩個 zip；表 1（t01）是同一張表，有最近 11 年的年底值。開放資料沒有的年份（2025）用最新一期 12 月份的 t01 補，兩邊都有的 2015–2024 年完全相同。下載網址每期不同（`https://www.fsc.gov.tw/userfiles/file/20260115.zip`），每年 1 月中要手動換成新的 12 月份。舊的 zip 檔名是 Big5、沒有標 UTF-8；2018 年以前只有 xls。
      - **口徑**（t01 的附註）：上市含一般板、臺灣創新板與第一上市的外國企業（KY 公司），不含臺灣存託憑證（TDR）；興櫃算在「未上市未上櫃」，不含。
        - **市值含 KY 公司**：WFE 的定義含「只在這個交易所上市的外國公司」，世界合計裡的台灣市值也跟含 KY 的總市值一致。
        - **家數只算本國公司**：WFE 申報的台灣家數不含 KY 公司（世界合計裡的台灣 2020–2025 年跟本國上市＋本國上櫃完全相同，例如 2025 年 974 + 845 = 1,819）。各國的家數是本國公司，所以台灣也一樣。
        - 證期局 2020 年 12 月份起才在 t01 附註寫出本國與外國企業的家數（2020–2024 年從各期 12 月份的 xls 手抄進 `sfb.FOREIGN_PRIMARY`，最新一年自動讀 ods）。2010–2019 年沒有公布，外國企業家數用「證期局的總家數 − 世界合計裡的台灣」推算：7、30、43、56、68、81、92、103、107、110 家（新聞報導的 2018 年 4 月底 104 家、2019 年 5 月底 108 家對得上）。第一家 KY 公司 2010 年掛牌，之前全是本國公司。
      - **美元**：股市是年底存量，用中央銀行 `BP01D01`（日資料，1993 年起，台灣時間 16:00 的銀行間即期匯率）每年最後一個營業日的匯率，不用年平均。2024 年底 32.781、2025 年底 31.438。
      - **占 GDP**：新臺幣市值 ÷ 主計總處的名目 GDP。
      - **抽查**：
        - 2024 年底：上市 1,031 家（本國 946、KY 85）、市值 73.90 兆元；上櫃 838 家（本國 810、KY 28）、6.54 兆元。證交所永續報告書（https://wwwc.twse.com.tw/ESG/file/7.pdf）：上市公司 1,031 家、總市值 73.9 兆元。合計 80.44 兆元 = 2.454 兆美元、占 GDP 312.5%（第 2，香港 1,114% 之後），本國公司 1,756 家（第 9）。
        - 2025 年底：上市 1,063 家（本國 974、KY 89）、94.36 兆元；上櫃 874 家（本國 845、KY 29）、7.41 兆元。合計 101.76 兆元 = 3.237 兆美元（第 6）、占 GDP 354.4%（第 2），本國公司 1,819 家（第 7）。
        - 只算上市的占 GDP 是 328.6%（2025 年），跟金管會「世界主要證券市場市值總額佔 GDP 比率表」的台灣 328.60% 相同（金管會的國際比較只算證交所），台灣側欄附註有寫。
        - 2020 年底本國上市公司 871 家，跟證交所 60 週年特刊的「國內上市公司 871 家」相同。
      - 台灣從 1998 年開始（開放資料的起點）。中央銀行 `EF05Y01`（重要金融指標）有 1987 年起的上市總市值，但沒有上櫃與家數，沒有用。
    - **分級**：占 GDP 用 10、25、50、100、200、400%。2024 年 400% 以上只有香港；200–400% 是台灣、南非、沙烏地阿拉伯、美國、瑞士；100–200% 是阿聯、日本、加拿大、印度、新加坡、馬來西亞。市值的比例圓圖例是 1,000 億、1 兆、10 兆美元（最大是美國 2025 年 68.9 兆），家數 100、1,000、1 萬家（最大是中國 2019 年 12,730 家）。
    - **沒有用的**：WFE 自己的統計入口（要註冊，條款不准轉載，見第 12 點）；證交所、櫃買中心網站與 OpenAPI 的資料（條款限制，且 OpenAPI 只有當下的快照）；金管會開放資料的「各國證券市場上市公司家數比較」等國際比較表（只有十幾個交易所，台灣只算證交所）。

57. **旅行實用**（`pipeline/topics/travel.py`、`pipeline/sources/iana_tz.py`、`wiki_mains.py`、`wikidata_driving.py`、`src/topics/panels/TravelPanel.tsx`；2026-10-28 加的生活格式見第 94 點）：
    - **時差用 IANA 時區資料庫，不用 Natural Earth 的時區圖**：Natural Earth 1:10m time zones（5.1.2 版，公有領域）停在 2012 年前後，莫斯科是 UTC+4（2014 年起是 +3）、哈薩克大部分是 +6（2024 年起全國 +5）、薩摩亞還有夏令時間（2021 年取消），多邊形的 `tz_name1st` 也只是那個時區的第一個城市（UTC−5 那塊是 America/New_York，哥倫比亞、秘魯會被算成有夏令時間）。所以改用 IANA tz（公有領域）：Python 的 `zoneinfo` 加上 PyPI 的 `tzdata` 套件（Windows 沒有系統的時區檔，`requirements.txt` 加了 `tzdata`），版本寫在 `manifest.json`（2026e）。
      - 每個國家用首都的時區：Natural Earth populated places 的 Admin-0 capital 有 `TIMEZONE`（IANA 名稱），同一國好幾個首都取正式首都裡人口最多的；首都的時區不在那國的 `zone.tab` 清單裡時，用 `zone.tab` 離首都最近的。俄羅斯的莫斯科沒有 `TIMEZONE`、科索沃（Natural Earth 是 KOS）、索馬利蘭、北賽普勒斯、澳屬印度洋領地直接指定（`TZ_OVERRIDES`）；沒有首都的屬地用 `zone.tab` 的第一個時區。
      - 標準時間與夏令時間：一月與七月 15 日的 UTC 偏移，小的是標準時間（南北半球都適用；愛爾蘭法律上的「冬季負夏令時間」照一般認知算，摩洛哥只有齋戒月改回 UTC+0，算成沒有夏令時間）。跨時區的國家（美、俄、加、澳、巴西、印尼、墨西哥…），附註與側欄寫出全國的範圍。
      - 地圖的值是標準時間跟台灣（UTC+8）差幾小時，面量圖用發散色、6 個不對稱的門檻 −10.5、−4.5、−0.5、+0.5、+2.5、+4.5：美洲；歐洲與非洲；中東、南亞、中亞與部分東南亞；跟台灣同時區；日韓與澳洲東部；紐西蘭等；薩摩亞、東加、吉里巴斯（比台灣快 5–6 小時）。類別圖最多 8 類、時差有三十幾種值，所以不用類別圖。tooltip 寫「UTC+9 · 比台灣快 1 小時」。
      - 時差沒有好壞，指標設 `unranked`（2026-10-23 加的欄位）：排名表依數值排列、不寫名次，側欄也不寫名次。
    - **行車方向**：Wikidata 的 P1622（Q14565199 靠右、Q11920728 靠左），CC0。有結束時間（P582）的舊方向寫進附註（瑞典 1967 年、薩摩亞 2009 年改…）；沒有結束時間的有兩個時取優先等級的。科索沃（靠右）、北賽普勒斯（靠左）Wikidata 沒有（沒有 ISO 代碼），直接指定。常被問到的 24 國跟英文維基百科「Left- and right-hand traffic」核對過，資料管線每次檢查，Wikidata 改了會報錯。238 國／地區：靠左 75、靠右 163。
    - **插頭、電壓與頻率**：英文維基百科「Mains electricity by country」的表格（固定在 2026-10-19 的版本 1380969207，`wiki_mains.py`），一列一國：插頭字母（A–O）、國家標準、電壓（「230/400 V」取斜線前的單相電壓，好幾種的依序列出）、頻率。這個表原本的主要來源 IEC World Plugs 在 2026 年 9 月下架（條目的 References 一節有寫），所以用維基百科（CC BY-SA 4.0）；Wikidata 的 P2853（插頭）、P2884（電壓）有，但插頭用的是標準名稱（NEMA 1-15、Schuko…），沒有頻率，比較零散，沒有用。
      - 插頭分 7 類（依序判斷）：只有 A、B；A 或 B 加上其他；只有 C、E、F；有 G；有 I；有 D 或 M；其他（C 加上 H、J、K、L、N 這類國內規格）。2026-10：33、26、77、44、18、9、16 國／地區。
      - 電壓用表格列出的第一個（一般家用插座）：台灣的列是「110/220 V、220/380 V」（大型電器另有 220 V），巴西「127/220 V、220/380 V」（各地不同）都算 100–127 V，側欄列出全部的電壓。分 4 類：100–127 V 與 60 Hz（34）、100–127 V 與 50 或 50／60 Hz（5，日本東 50 西 60）、220–240 V 與 60 Hz（9，韓國、菲律賓、沙烏地…）、220–240 V 與 50 Hz（175）。
      - 國名用 `{{flag|…}}` 的名稱對 ISO（`MAINS_NAMES`、`NAME_ALIASES`、pycountry），對不上的印出來。表格沒有的：南蘇丹、馬紹爾群島、教廷、土克凱可、北馬利安納、瓦利斯和富圖那等，沒有值。
    - **側欄**（`details.json`）：跟台灣比的時差（標準時間與夏令時間）、跨時區的範圍、行車方向、插頭字母與能不能直接插（全部是 A、B：可以；有 A 或 B：可能可以、最好帶轉接頭；沒有：要轉接頭）、電壓與頻率（100–127 V：一般可以直接用；220–240 V：看標示，100–240 V 的充電器可以直接用，只有 110 V 的要變壓器；頻率不是 60 Hz 時提醒馬達、計時的電器）。點台灣時列出台灣自己的。這些是一般性的提醒，頁尾請使用者出發前再查官方資訊。
    - **顏色**：時差用發散色（比台灣慢橘、快青綠，同時區是中性灰）；行車方向、插頭、電壓是一般類別色（`MAP_TOKENS.categorical`）。
58. **颱風與颶風**（`pipeline/topics/typhoons.py`、`pipeline/sources/ibtracs.py`、`src/topics/typhoons.ts`、`src/topics/panels/TyphoonsPanel.tsx`）：
    - **來源**：NOAA NCEI 的 IBTrACS v04r01（doi:10.25921/82ty-9e16，引用 Knapp et al. 2010），整份 `ibtracs.ALL.list.v04r01.csv`（333 MB，第二列是單位，缺值是一個空白），只讀前 26 欄。
      - 授權：NOAA 產品頁寫 full and open access，data.gov 標 CC0；這裡只用美國機構的欄位（美國政府資料），標成公有領域。
      - NCEI 單一連線只有約 20 KB/s（整份要 4 小時以上），2026-10-23 是用 HTTP Range 分 24 段平行下載同一版（ETag 相同）放進快取，程式仍呼叫 `common.download()` 讀快取。每週更新 2–3 次、覆寫同一個檔，要更新用 `--refresh`（同樣很慢）。
      - TRACK_TYPE 只收 main、PROVISIONAL、US-PROVISIONAL（spur 是替代路徑）。最近一兩年是即時資料，還沒重新分析；即時資料偶爾把一個颱風拆成兩段（2026 年的 SAUDEL）。
    - **風速只用 USA_WIND**（國家颶風中心、中太平洋颶風中心、聯合颱風警報中心的 1 分鐘平均，kt）與 USA_SSHS（兩者在資料裡完全一致）。
      - WMO_WIND 是各區域中心的數字，平均時間不同（日本氣象廳、澳洲 10 分鐘，印度 3 分鐘），混用的話同一個強度在不同海域會分到不同級；中央氣象署也是 10 分鐘平均，數字比較小，分級也不同（輕度、中度、強烈颱風）。
      - 氣壓用 USA_PRES，沒有才用 WMO_PRES。
      - **北印度洋、南半球 1980 年以前沒有 USA_WIND**（連 WMO_WIND 也沒有，補不了）：那時的颱風整條畫成灰色「強度不明」；1980 年後有 10% 以上的颱風來自這些海域的 43 國（印度、孟加拉、澳洲、馬達加斯加、莫三比克、斐濟、泰國、印尼…），1980 年以前的次數是 null，附註自動產生。
      - 西北太平洋 1950–80 年代有 486 個沒有 USA_WIND 的系統，多半是美國機構沒有列入的弱系統，不收；1950–60 年代西北太平洋的風速一般認為偏高（台灣最強的 10 個有 6 個在 1950–60 年代），附註有寫。
    - **年份不用 SEASON**：南半球的 SEASON 從前一年 7 月算起（資料裡已經有「2027 季」）。時間軸用路徑第一個點（UTC）的年份。Windows 的 `datetime.fromtimestamp()` 不接受 1970 年以前（負數）的時間，改用 epoch 加 timedelta。
    - **路徑**（`tracks.json`，1.13 MB、gzip 後 327 KB）：00、06、12、18 UTC 的位置，加上美國機構的非整點紀錄（登陸時間）；Douglas–Peucker 0.12°，強度改變的頂點一定保留；經度展開成連續的；量化 0.1°。6,780 條、11.6 萬個頂點。
      - 只畫曾經以熱帶氣旋達到 34 kt 的（加上 1980 年以前北印度洋、南半球整條沒有風速的）；721 個一直沒到 34 kt 的不畫。15 條很短的路徑量化後只剩一點，地圖上沒有，統計照算。
      - 每個頂點的代碼（`vertexTypes`，第 4 節）：0 強度不明（灰色實線）、1 溫帶／副熱帶氣旋或擾動（灰色虛線）、2 熱帶性低氣壓、3 熱帶風暴、4–8 是 1–5 級。灰色的代碼最小，`sortByType` 讓 5 級畫在最上面。
      - 熱帶性低氣壓到 5 級剛好是 `MAP_TOKENS.sequential` 的 7 級，跟「最強的颱風」的類別圖同色。最淺兩級跟海的 ΔE×100 只有 10–17、深色底圖上最深兩級只有 11–19，所以路徑墊一層細邊（`casing`，第 4 節）。
      - 每條路徑一筆紀錄：`year`（差分）、`md0`／`md1`（起訖的月 × 100 + 日，UTC，`md1 < md0` 是跨年）、英文名 `name`、中央氣象署的中文名 `zh`、海域、巔峰風速、最低氣壓、巔峰等級、是否即時資料。
    - **國家歸屬（100 公里規則）**：3 小時一筆的點每 10 公里內插（位置、風速線性內插），內插點在國界內或離國界 100 公里以內、而且風速 34 kt 以上、是熱帶氣旋時，這個颱風算這一國一次。用 `OffshoreIndex` 的線段網格，改成列出 100 公里內的「所有」國家（一個颱風可以算好幾國）。包含 1:50m 裡的離島（日本的南方離島、墨西哥的雷維亞希赫多群島），所以日本、墨西哥每十年可達 80 幾個；1:50m 沒有形狀的小島（吐瓦魯）不算。「最強的颱風」用 100 公里內的內插風速（取到 5 kt、不超過巔峰），含熱帶性低氣壓階段。世界合計（WLD）只算 1980 年起（所有海域都有風速），不顯示「占全球比例」（一個颱風可以算好幾國）。
    - **台灣**：1958–2025 年平均每年 2.85 個；中央氣象署的「侵台颱風」（颱風中心登陸台灣，或沒登陸但陸上有災情）平均 3.16 個，發布警報的 6.47 個。規則不同，個別年份會差：
      - 2015 年 2／2（同樣兩個）；2024 年 4／3（天兔以熱帶風暴強度離岸 2 公里經過，這裡算、氣象署不算侵台）；2009 年 2／3（芭瑪不在這裡）；2022 年 0／1（軒嵐諾是侵台，但離陸地超過 100 公里）；2018 年 2／1。
      - 莫拉克 2009：經過時 80 kt、登陸，最低 954 hPa；蘇迪勒 2015：100 kt、登陸，巔峰 155 kt、907 hPa；凱米 2024：125 kt、登陸；山陀兒 2024：90 kt、登陸，巔峰 135 kt。
      - 中央氣象署颱風資料庫（https://rdc28.cwa.gov.tw/TDB/ ，政府資料開放授權條款）的清單只能用網頁本身的 POST 查詢（要 `X-Requested-With` 標頭），`typhoons.py` 自己的小函式快取在 `.cache/cwa-tdb/`。依「同一年、同名」配對中文名（1,749 個），名稱不同時只補 IBTrACS 沒有名字的（用時間比對曾把 MALIKSI 2024 配錯）。對不上的 52 個多半是日本氣象廳的 10 分鐘風速達熱帶風暴、美國機構卻只有熱帶性低氣壓的（帕布 2024、馬力斯 2024）。
59. **發電廠地圖**（`pipeline/topics/power_plants.py`、`pipeline/sources/gem.py`、`moeaea_capacity.py`、`src/topics/power-plants.ts`、`src/topics/panels/PowerPlantsPanel.tsx`）：
    - **來源**：Global Energy Monitor 的 Global Integrated Power Tracker。GEM 網站的「Download data」要填表（姓名、Email、用途）才寄 Excel，不填；改用 GEM 自己公開地圖（globalenergymonitor.github.io/interim-maps/trackers/integrated-power/）的 `config.js` 裡寫的 CSV（publicgemdata.nyc3.cdn.digitaloceanspaces.com/Current_maps/integrated-power/2026-09/…，62 MB、18.3 萬個機組），不必填表。
      - 授權：GEM 寫明 tracker 的資料除另外標示外採 CC BY 4.0（這段話在 2025 年的封存頁，改版後的頁面只剩引用格式「Global Integrated Power Tracker, Global Energy Monitor, September 2026 release.」）；舊版填表單有一格「不做商業使用」的勾選，但授權本身是 CC BY 4.0，這裡照授權標示來源。WRI 的 Global Power Plant Database（CC BY 4.0，2021 年凍結、沒有狀態）是備案，沒有用。
      - 每次改版換資料夾，`gem.py` 的 `RELEASE` 要跟著改。
    - 一列是一個機組，同一座電廠的機組有同一個 `project-id`。地圖依（project-id、燃料）加總成一個點，用最大那個機組的位置；擱置與取消的計畫不畫、不算。
    - **收錄門檻各能源不同**：燃煤 30、燃氣與燃油 50（歐盟、英國 20）、水力 30、風力 10、生質能 20 MW；太陽能是 1 MW 以上的地面型，不含屋頂型。太陽能多的國家容量明顯偏低（德國 38 GW，Ember 106 GW；台灣 5.1 GW，能源署 15.5 GW）。小島國的柴油機組低於門檻，只剩一兩座太陽能案場時會變成「100% 太陽能」，所以占比只算總容量 100 MW 以上的國家。
    - **狀態是 GEM 判斷的**：日本停機中的核電機組不算運轉中（GEM 15 GW、Ember 33 GW）；台灣興達燃煤 1–4 號機列為封存。四個狀態各一個點圖層（運轉中預設打開；興建中、規劃中（籌備中＋已宣布）、已退役與封存預設關閉、第一次打開才下載），顏色相同，同時打開時靠 tooltip 分辨。
    - **跨國電廠**：地圖檔只有 `country-area1`（伊泰普 14,000 MW 整座算巴西，亞西雷塔、薩爾托格蘭德算阿根廷，鐵門算羅馬尼亞，卡里巴算尚比亞）。統計用 `BINATIONAL` 依份額拆開，巴拉圭從 210 MW 變成 8.8 GW（Ember 8.9 GW）。水力含抽蓄；「再生能源」合計扣掉純抽蓄（儲能）。
    - **地圖上的點只畫 20 MW 以上**：運轉中 3.5 萬座，占運轉中容量 96.5%（全畫是 10.9 萬座、約 7 MB）；20 MW 也是 GEM 規劃中太陽能的收錄門檻。`plants-operating.json` 2.31 MB、gzip 後 610 KB。檔案依容量由大到小排、不設 `sortField`，小電廠畫在大電廠上面（比例符號地圖的慣例），代價是密集的地方滑到大電廠時常先抓到上面的小電廠。
    - **能源色**取自 `MAP_TOKENS.categorical`（任兩色在色盲下也分得開）：燃煤鏽紅、燃氣淡紫、核能紫、水力薄荷綠、風力洋紅、太陽能琥珀、生質能綠、地熱淡黃。太陽能的點最多，淡黃在彩色地形底圖的陸地上幾乎看不見（實測），所以太陽能用琥珀、淡黃給點最少的地熱。發電量主題重用 `OPERATING_PLANTS`，顏色一致。
    - **台灣**對照能源署「發電裝置容量年資料」（data.gov.tw 16480，全國 = 台電 + 民營電廠 + 自用發電設備）：2025 年底 69.9 GW，GEM 運轉中 54.8 GW（2026 年 9 月）。差距主要是屋頂型太陽能（能源署 15.5 GW，GEM 5.1 GW），其次是 GEM 列為封存的興達燃煤 2.1 GW 與燃油 0.5 GW，以及低於門檻的小型汽電共生、水力。燃氣與燃油 24.1／25.1、風力 4.46／4.52、水力 4.48／4.73 GW 很接近；核能兩邊都是 0。各能源都有中英文附註。
60. **太陽能與風能潛力**（`pipeline/topics/renewables.py`、`renewables_grid_tiles.py`、`pipeline/sources/gsa.py`、`gwa.py`、`src/topics/renewables.ts`）：
    - **太陽能用 PVOUT，不用 GHI**：GHI 是物理上的日照資源，世界檔 zip 2.6 GB；PVOUT（每 1 kWp 每天幾度電）已考慮氣溫、傾角與系統損失，比較接近「潛力」，zip 只有 345 MB（30 角秒）。檔案清單 API `https://api.globalsolaratlas.info/download/World`，下載轉址到 S3 的簽名網址。
      - 授權：使用條款寫 CC BY 4.0（另有 WIPO 調解／UNCITRAL 仲裁條款），檔案本身的 XML 也寫「© 2026 Solargis … CC BY 4.0」；網站上一段舊的摘要還寫 CC BY 3.0 IGO，以 2019 年修訂的條款本文為準。要求的完整引用文字在 `gsa.ATTRIBUTION_FULL`，`meta.json` 的 `citation` 也有。
      - 2026-04 版的範圍：北緯 65° 到南緯 60° 的陸地，但俄羅斯東經 32° 以東、北緯 60° 以北大多沒有資料，冰島沒有資料。有資料的比例 = 國界在資料緯度範圍內的面積比例 × 範圍內國界裡有資料的格子比例；不到一半的不輸出（俄羅斯 48%、格陵蘭、冰島），95% 以下附註（加拿大 77%、芬蘭、瑞典、挪威、美國 94%…）。只用「有資料的格子 ÷ 國界面積」會把海岸、小島的網格誤差也算成「沒有資料」。
    - **風能是 Global Wind Atlas 4.0，不是 3.0**：4.0（2025）的海上範圍是各國專屬經濟海域（3.0 是離岸 200 km），ERA5 2008–2017、250 m。授權 CC BY 4.0，完整引用在 `gwa.ATTRIBUTION_FULL`。
      - 全球 100 m 風功率密度是 14.8 GB 的 COG（float32、zstd、512 圖塊，有 2–512 倍的縮小版）。**不下載整個檔**：自己解析 BigTIFF 的 IFD，找出 1/8 那一層（0.02°，182 MB，在檔案裡是連續的一段），8 段平行 HTTP Range 下載，加上 1 MB 的檔頭，用 GDAL `/vsisparse/` 組成虛擬檔給 rasterio 讀。縮小版是區塊平均：跟 250 m 原始格的 8 × 8 平均比，平均差 1.9 W/m²（取左上角是 19），國家平均可以直接用它。
      - GWA 網站連到 `figshare.com/ndownloader/files/54313655?private_link=…`，那個網域有 AWS WAF 的瀏覽器驗證，程式拿到的是 202 加空白內容；不去繞過它，改用 figshare 公開 API 的下載網域 `ndownloader.figshare.com/files/54313655`（`api.figshare.com/v2/file/download/<id>` 也轉址到這裡，不必登入），它轉址到 DTU 的 S3，簽名 10 秒內有效，每段各自重新要一次。Range 下載不能走 `common.download()`，`gwa.fetch_range` 用同一個快取資料夾、User-Agent 與 `--refresh`。
      - GDAL 直接 `/vsicurl/` 讀會每個請求都重新轉址（約 5 秒），讀 1/16 那層就要 4 分鐘，所以不用。各國的 `country_tifs_v4` 沒有台灣（403）。
    - **國家平均**：每個網格各自把地圖國界畫成國家編號（格子中心在國界內），cos(緯度) 加權；太小的國家（梵蒂岡）改用 `all_touched`，附註說明。風能的陸地平均會被高山稜線的極端值拉高（單格可達 3.7 萬 W/m²），所以另外列「風最強的 10% 土地」（依面積排序取前 10%，跨門檻的那一格只算一部分，Global Wind Atlas 的國家摘要也這樣算）。
    - **近岸海域**：離岸 50 km 內、不在任何國界內、GWA 有值的格子，每格歸給最近的陸地所屬的國家（逐 1° 一條做 `distance_transform_edt`，東西格距依緯度換算，經度在 ±180° 接起來），近似專屬經濟海域的等距中線。裏海算成海面；1:50m 沒有澎湖，澎湖本身算進台灣的近岸海域。
    - **分級**：太陽能 [3.0, 3.4, 3.8, 4.2, 4.6, 5.0] kWh/kWp/日（×365 約 1,100–1,830 度／年；[2.8 … 4.8] 會把蒙古和撒哈拉併成同一級）；風能 [100, 200, 300, 400, 600, 800] W/m²，參考 NREL 風能等級的 200/300/400/600/800，加 100 分出赤道無風帶，四個風能指標共用。網格與國家面量圖同一組門檻（`renewables.ts` 與 `renewables_grid_tiles.py` 各寫一份，產生圖磚時檢查）。
    - **台灣**：
      - 太陽能 3.51（第 196/235 名；世界陸地平均 4.30）：台北盆地約 3.1、基隆 2.9、台南到高雄約 4.0；GSA 網站的台灣摘要（舊版資料、它自己的國界）是 3.44，日本、德國、英國、澳洲、埃及也都比網站摘要高 1–2%（新版資料）。
      - 風能陸地平均 186 W/m²（第 137 名），風最強的 10% 土地 651（約一半在西部沿海平原、一半在中央山脈稜線）。
      - **台灣海峽**：近岸海域 800 W/m²（第 16/194 名）；彰化外海（北緯 23.75°–24.25°、東經 119.85°–120.4°）1,355 W/m²，比北海南部的 1,013 還高；網格上整片海峽都在最高一級。附註對照能源署 2015 年公告的 36 處離岸風電潛力場址（多在彰化、雲林、苗栗外海）與 2026 年 6 月已裝 500 座離岸風機、4.8 GW（能源署 2026-06-15 新聞稿）。
61. **野火**（`pipeline/topics/wildfires.py`、`pipeline/sources/gwis.py`、`src/topics/wildfires.ts`、`src/topics/panels/WildfiresPanel.tsx`）：
    - **來源**：GWIS（全球野火資訊系統，歐盟執委會 JRC、Copernicus）下載頁的「MODIS Global Monthly Burned Area」zip（`MCD64A1_burned_area_full_dataset_2002_2025.zip`，約 12 MB，CSV 66 MB，GADM 第 0／1 級逐月、5 種土地覆蓋，公頃），不必登入。
      - 授權：GWIS 的 Data License 頁寫明歐盟擁有的內容除另外標示外採 CC BY 4.0。它彙整的 NASA MODIS MCD64A1（Giglio 等，LP DAAC，doi:10.5067/MODIS/MCD64A1.061）依 NASA 地球科學資料政策沒有使用、販售、再散布的限制。
      - Our World in Data 的野火資料是同一份（逐國呼叫 GWIS API）；它提過舊版 zip（2002_2024）的 2024 年全是 0。2002_2025 版跟 API 抽查（台灣、中國）完全相同，所以直接用 zip。檔名帶年份，新的一年出來時改 `gwis.YEAR_TO`；不到 12 個月的年份不收。
    - MCD64A1 不分起火原因：野火之外也含農地燒除、草原的計畫性燒除，所以非洲、澳洲北部的熱帶草原最大。一格約 21.5 公頃（500 m），小火、樹冠下的地表火、被雲遮住的火偵測不到；年份是曆年，澳洲 2019–2020 年的火季分在兩年。
    - **分母**是 GWIS API 的 `area_km2`（GADM 國界的總面積，含湖泊等內陸水域，跟分子同一套國界，含台灣 36,406 km²），一國查一次，第一次約 6 分鐘。World Bank 的土地面積沒有台灣，所以不用。
    - **國界**：XKO → XKX；北賽普勒斯（XNC）CSV 有、國家清單與 API 沒有，改成地圖的 `_CYN`，面積用地圖國界（3,473 km²）；賽普勒斯只有南部；索馬利亞含索馬利蘭（地圖上灰色）；法國只有本土、挪威不含斯瓦巴（分開列）。沒有 GADM 第 1 級的 23 個小島（福克蘭、馬爾地夫…）無資料。
    - **不做「森林燒毀面積」**：GWIS 的「森林」只有樹冠濃密的林地，加拿大 2023 年的 13.3 萬 km² 有 77% 歸在疏林草原、17% 是森林，畫成森林會嚴重低估北方林的火災；土地類型放在側欄，附註說明。
    - **分級**：占國土比例 [0.01, 0.1, 0.5, 2, 5, 15]%（所有國家年份的中位數 0.09%，31% 是 0；2025 年世界 2.47%，南蘇丹 42.3% 最高，七級各有 83/37/31/33/17/18/7 國）。
    - **台灣接近 0**：衛星 2002–2025 年有 8 年是 0，最多 2009 年 1,567 公頃，2025 年 1.1 km²（0.0029%，第 150/227 名），七成是農地。林保署的森林火災（林業保育統計年報，2007–2025 年）每年 7–93 次、0.96–133 公頃，平均每次約 1.1 公頃，比衛星的一格還小，所以兩者口徑不同、年份對不起來（例如 2009 年衛星 1,567、林保署 133 公頃；2022 年衛星 0、林保署 30 公頃）。附註與側欄有逐年對照。林保署 ODS 的中文欄名是 U+FFFD 亂碼，用英文欄名「Fire」辨認；2006 年以前只有 PDF／舊 xls、欄位對不齊，不收；2010 年起範圍從臺灣地區改成臺閩地區。
    - FIRMS 的每年火點密度網格沒有做：要先確認每年的國家檔不需 MAP_KEY 就能下載，再量下載量與部署時間（做法同暖化網格）。

62. **世界遺產**（`pipeline/topics/world_heritage.py`、`pipeline/sources/unesco_whc.py`、`src/topics/panels/WorldHeritagePanel.tsx`）：
    - **來源**：UNESCO DataHub（data.unesco.org，Opendatasoft）的「World Heritage List」資料集 `whc001`，用匯出 API（`exports/json?select=…`）只取事實性的欄位：編號 `id_no`、英文名稱、登錄年份、類型（Cultural／Natural／Mixed）、是否瀕危與列入的年份（`danger_list` 是「Y 2023」這種寫法）、締約國的 ISO alpha-2（`iso_codes`，跨國遺產有好幾個）、座標。不取說明文字與照片（各有著作權）。整個資料集匯出約 12 MB，`select` 之後約 0.5 MB。2026-10 的版本有 1,273 處（文化 991、自然 240、複合 42、瀕危 58），含 2026 年世界遺產委員會新登錄的 25 處；沒有已經除名的遺產（德勒斯登易北河谷等）。
    - **世界遺產中心的網站與 DataHub 都會擋程式常用的 User-Agent**（whc.unesco.org 回 403），`unesco_whc.py` 用一般瀏覽器的 User-Agent 自己下載。
    - **國家**：跨國遺產照 UNESCO 的算法，每個締約國都算一次（義大利 62、中國 61、法國 56、德國 55、西班牙 50），所以各國加起來比世界的總數多；世界的值是不重複的遺產數。「耶路撒冷舊城及其城牆」（編號 148）由約旦提名，名錄上沒有締約國，只算進世界的總數，地圖上照樣有點。屬地的遺產算在所屬的國家（UNESCO 的寫法），屬地本身沒有值。
    - **締約國**：世界遺產中心的締約國清單（https://whc.unesco.org/en/statesparties/ ，196 國）只拿 ISO alpha-2 代碼，沒有遺產的締約國是 0，不是締約國的是無資料；有遺產的國家都要在清單裡，不在就報錯。**台灣不是《世界遺產公約》的締約國**，不能提名，用主題的 `noValue` 寫原因；側欄寫文化部（前身文建會）2003、2009、2010 年遴選的「臺灣世界遺產潛力點」目前 18 處（中央社 2024-10-04 引述行政院長的說法），列出幾處例子，不列完整名單（文化資產局的開放資料集已下架）。
    - **時間**：各國的遺產數依登錄年份累計（1978 年第一批 12 處起）；點也依登錄年份（`timeField: 'year'`、`overlayTime: 'cumulative'`）。瀕危名錄只有「目前在名錄上」與列入的年份，沒有移出的紀錄（例如曾經瀕危、後來移出的），所以瀕危只做目前的快照（年份只有 2026）。
    - **中文名稱**：DataHub 的中文名稱是簡體（UNESCO 的官方中文），所以改用 Wikidata：P757（世界遺產編號）是純數字的項目對到 `id_no`（同一個編號有好幾個項目時取標了 P1435 = 世界遺產、QID 小的），名稱用 `sources/nobel.py` 的 `_pick_zh`（zh-tw、zh-hant、zh-hk，沒有時用伺服器轉成台灣用字的 zh-tw）。2026-10 有 942 處有中文名稱，331 處用英文；Wikidata 的 zh-tw 名稱偶爾是簡體（「不来梅市政厅」），`EXTRA_S2T` 補上實際出現的字。
    - **點**（`sites.json`，約 120 KB）：經緯度、登錄年份（差分）、`cls`（1 文化、2 自然、3 複合、4 瀕危，瀕危優先，決定顏色）、`type`、`danger`（列入瀕危的年份）、`iso3`（第一個締約國，滑過標出、點一下選取）、`more`（跨國遺產的其他締約國）、編號、英文名稱、中文名稱。2 處沒有座標（DataHub 沒有）。側欄讀同一個檔，依 `iso3` 與 `more` 列出這國的遺產，跟著時間軸與子項目篩選。
    - **顏色**：文化 `hues.yellow` #eda100、自然 `categorical[3]` #4d9221、複合 `categorical[6]` #7b3294、瀕危 `hues.red` #e34948，都有白框；比例圓是半透明的紫色 #6250d6，跟複合的紫只靠形狀與大小分開（點小、圓大）。

63. **太空**（`pipeline/topics/space.py`、`pipeline/sources/gcat.py`、`src/topics/panels/SpacePanel.tsx`）：
    - **來源**：Jonathan McDowell 的 GCAT（General Catalog of Artificial Space Objects，https://planet4589.org/space/gcat/ ，Release 1.8.8、2026-10-17 更新）的 TSV：`cat/satcat.tsv`（約 7 萬個編目物體、19 MB）、`launch/launch.tsv`（含次軌道的發射紀錄、14 MB）、`tables/orgs.tsv`（機構與國家）、`tables/sites.tsv`（發射場）。第一列是 `#` 開頭的欄名，第二列是「# Updated …」。要更新得加 `--refresh`。
    - **在軌酬載**：`Type` 第一個字是 P 的是酬載（27,852 個：衛星、太空船、太空站艙段，含已經失效的；不含火箭殘骸 R、碎片 D、其他 C、Z）。某年年底「在軌道上」= `LDate` 在那年以前，而且 `DDate`（再入、離軌、回收、離開地球軌道或不再追蹤的日期）是空的或在那年以後；`Status` 是 N（不再追蹤）的算到 `DDate` 為止，比較保守。2026 年（到 10 月 17 日）18,825 顆：美國 13,203（大多是星鏈）、俄羅斯 1,674（含蘇聯）、中國 1,503、英國 743（OneWeb）。
    - **國家**：酬載用 `State`（擁有者所屬的國家），發射用第一個發射業者（`Agency`，好幾個時用 / 分開）在 `orgs.tsv` 的 `StateCode`。GCAT 的國家代碼大多是 ISO alpha-2，不是的寫在 `gcat.STATE_ISO`（J 日本、F 法國、D 德國、UK 英國、UAE、BGN 保加利亞…）；省、州、自治區（CN-31、IN-KA、UAE DB）依 `Parent` 往上找。**蘇聯（SU）算在繼承國俄羅斯**（酬載 3,347 顆、入軌發射 2,392 次，俄羅斯的附註寫明），東德算德國、捷克斯洛伐克算捷克。國際組織（I-ESA 歐洲太空總署、I-INT Intelsat、I-EUM EUMETSAT、I-EUT Eutelsat、I-INM Inmarsat…，2026 年在軌 129 顆）不屬於任何國家，只算進世界合計，`manifest.json` 有數字。歐洲太空總署、ELDO 的發射（19 次）也只算進世界合計。
    - **發射**：`LaunchCode` 第一個字是 O 的是入軌發射（OS 成功、OF 失敗，以及 OF40 這類部分成功的），1957 年起 7,196 次，2026 年到 10 月 17 日 244 次。依發射業者的國家，所以阿利安太空公司在法屬圭亞那庫魯、俄羅斯在哈薩克拜科努爾、Rocket Lab 在紐西蘭的發射分別算法國、俄羅斯、美國；發射場的點另外依位置算國家。沒有成功與否的分開指標。
    - **發射場**（`sites.json`）：有入軌發射的 64 個發射場（`TYSC?` 只有 1 次、沒有經緯度，不畫），位置是 `sites.tsv` 的經緯度，國家用 `geoindex.country_at`（拜科努爾算哈薩克、庫魯算法國、瓜加林算馬紹爾群島；瓜加林在 1:50m 沒有形狀，2026-10-27 改用 1:10m 以前用 GCAT 的 StateCode 算成美國），大小是入軌發射次數，`timeField: 'first'` 依第一次入軌發射的年份出現。
    - **台灣**：GCAT 的 `State` 是 TW 的酬載 49 顆，2026 年仍在軌道上 35 顆（第 16 名）。國家太空中心（TASA，2023 年以前是 NSPO；GCAT 的機構代碼 NSPO、NSPT、TASA）的福衛一號（1999，2023 年再入）、二號（2004）、三號（2006，6 顆）、五號（2017）、七號（2019，6 顆）、獵風者（2023，GCAT 記為 FORMOSAT-7R）、福衛八號 A（2025-11-28），其他是成功大學、中央大學、海洋大學、鴻海、Satoro、Tron Future Tech 等的立方衛星；福衛系列（一號到八號 A、獵風者）都在。福衛三號、七號是台美合作（COSMIC、COSMIC-2），GCAT 記在台灣名下，側欄有說明。台灣沒有入軌發射。
    - **側欄**：`countries/<ISO3>.json`：GCAT 收錄的酬載總數、第一顆的年份、目前在軌酬載的主要擁有者（依機構名稱合併：NSPO 與 NSPT 都是國家太空計畫室）；酬載不超過 120 顆的國家列出每一顆（國際編號、名稱、計畫名稱、發射日期、再入或離軌日期、擁有者代碼，英文原文）。
    - **顏色**：比例圓照慣例用紫色；發射場用 `hues.red`。美國的在軌酬載是第二名的 8 倍，比例圓的大小以美國為準，其他國家的圓偏小。

64. **奧運**（`pipeline/topics/olympics.py`、`pipeline/sources/wiki_olympics.py`、`src/topics/panels/OlympicsPanel.tsx`）：
    - **來源**：英文維基百科各屆的獎牌榜「<年> Summer/Winter Olympics medal table」（夏季 30 屆、冬季 25 屆，含 2026 年米蘭—科爾蒂納），MediaWiki API 讀 wikitext，解析 `{{Medals table … | gold_USA = 40 | silver_USA = 44 | bronze_USA = 42}}` 模板（每一屆都用這個模板，代碼是當屆的代碼）；每一頁的版本號寫在 `manifest.json`，獎牌因禁藥重新分配時要 `--refresh`。Olympedia（OlyMADMen）沒有開放授權，沒有用。
    - **核對**：各屆加起來跟「All-time Olympic Games medal table」的夏季、冬季總表（頁面上第一、第二個 `{{Medals table}}`）逐隊比，有出入時印出來，以各屆的頁面為準。2026-10 有 19 國差幾面（美國金牌 1,110 對 1,106、德國 222 對 214、瑞士 57 對 53…），集中在 1948 年以前就參賽的國家，可能跟 1912–1948 年的藝術競賽與早期奧運的歸屬有關（各屆頁面依國際奧會網站的獎牌榜），沒有逐一查證。阿拉伯聯合共和國（1960）總表算在埃及、各屆頁面分開，這裡也分開。台灣兩邊一致：夏季金 9、銀 11、銅 23。
    - **代表隊照當屆的名義算，不併到繼承國**（跟國際奧會一樣）：
      - `IOC_ISO` 是跟 ISO 不同的代碼（GER → DEU、NED → NLD、SUI → CHE、TPE → TWN…）；**BRN 在奧運是巴林**（ISO 的 BRN 是汶萊，奧運的汶萊是 BRU），不能直接拿 ISO 比對。舊代碼 CEY（錫蘭）、SIN、TRI 也換成今天的國家。
      - 歷史隊伍與特殊代表團是主題自訂的地點（`TopicDefinition.places`，`_URS` 這種底線開頭的鍵）：蘇聯、獨立國協聯隊（明斯克，獨立國協的總部）、俄羅斯帝國（維基百科在 1908、1912 年寫 RUS，國際奧會是 RU1）、俄羅斯奧林匹克選手（2018 OAR）、俄羅斯奧會（2020–2022 ROC）、中立個人選手（2024–2026 AIN，含白俄羅斯選手）、東德、西德、德國聯隊、捷克斯洛伐克、波希米亞、南斯拉夫、南斯拉夫聯盟共和國與塞爾維亞與蒙特內哥羅（維基百科在 1996、2000 年寫 YUG）、獨立奧林匹克參賽者（1992）、澳大拉西亞、英屬西印度群島、阿拉伯聯合共和國、荷屬安地列斯。畫在當時的首都附近，同一個城市有好幾隊時稍微錯開（位置只是代表）。
      - **ROC 有兩個意思**：1960、1968 年是中華民國（台灣，楊傳廣的十項運動銀牌、紀政的 80 公尺跨欄銅牌），2020、2022 年是俄羅斯奧會；`key()` 依年份分開。維基百科的總表把 1960、1968 年算在中華台北（TPE），這裡也算台灣。
      - 混合隊（ZZX，1896–1904、1924 冬季）、難民奧運隊（EOR，2024 年銅牌）、獨立奧運選手（IOA，2016 年的科威特選手）沒有國家，只算進世界合計。
      - 所以德國只有 1896–1936、1952 年與 1992 年起，俄羅斯只有 1996–2014 年，捷克、斯洛伐克 1996 年起，塞爾維亞 2008 年起；附註（`NOTES`）與側欄寫明相關的歷史隊伍。
    - **數值**：單屆是那一屆的金牌數或獎牌總數；累計是第一屆到那一屆。WPP 有人口的國家沒有得牌是 0；歷史隊伍單屆只有參賽的那幾屆有值，累計從第一次得牌起一直留著（2024 年的累計地圖上蘇聯照樣有 1,010 面）。每千萬人 = 單屆獎牌數 ÷ 當年 WPP 年中人口 × 1,000 萬（1952 年起；2026 年冬季用 WPP 的推估人口），歷史隊伍沒有人口，不算；夏季門檻 > 0、1、3、10、30、100，冬季 > 0、0.5、2、5、15、40（`itemScales`）。2024 年格瑞那達 171、多米尼克 151、聖露西亞 111。
    - **側欄**（`countries/<鍵>.json`）：夏季、冬季各屆的金銀銅（只有得牌的那幾屆），依時間軸篩選、新的在前，10 屆以外收起；寫出得牌屆數與最多的一屆，國家寫出相關的歷史隊伍，歷史隊伍寫出今天對應的國家（`RELATED`）。
    - **自訂地點的引擎**（2026-10-23 加的，見第 4 節的表）：`TopicDefinition.places` 的點跟吐瓦魯這類沒有形狀的國家一樣畫小圓點與比例圓（`WorldMap` 的 `places`）；名稱用 `registerPlaces()` 登記到 `lib/countries.ts`，排名表、tooltip、側欄的 `countryName()` 都查得到；畫面上的代碼用 `displayCode()` 去掉底線（`_URS` 顯示 URS，剛好是國際奧會的代碼）。搜尋找不到自訂地點（不在 `countries.json`）。

65. **夜間燈光**（`pipeline/topics/night_lights.py`、`night_lights_tiles.py`、`pipeline/sources/vnl.py`、`src/topics/night-lights.ts`、`src/topics/panels/NightLightsPanel.tsx`）：
    - **來源只能用不必登入的**：EOG（eogdata.mines.edu）、NASA Earthdata/LAADS 的 Black Marble（VNP46A4）、Google Earth Engine 都要帳號，不用。找過的其他來源：NASA Earth Observatory 的 Black Marble 2012、2016 是給人看的 8 位元灰階影像（不是輻射亮度），只能當底圖；AWS 上的 Light Every Night（世界銀行，MIT）是每晚的原始軌道資料，要自己合成，太大；Li et al. 的 DMSP/VIIRS 調和資料（figshare，CC BY 4.0）是 DMSP 的 0–63 尺度、城市會飽和、光暈大。**採用 Hengl 在 Zenodo 的轉存**（CC BY 4.0）：2012–2024 年是 EOG 的 Annual VNL V2 average_masked 原檔，換成 COG。
    - **Zenodo 時好時壞**：2026-10-25 晚上從台灣每條連線約 25 KB/s，而且大約 2.5 分鐘就切斷（不報錯，只是提早結束）；隔天同一個 64 MB 的檔 15 秒就下載完。`vnl.raster_path()` 把檔案切成 4 MB 一段、24 條連線平行下載，斷了從已收到的位置接著下載（HTTP Range），最後用 Zenodo API 的 MD5 檢查；慢的時候一個 60–85 MB 的檔約 2.5–3 分鐘，12 個檔兩個同時下載約 20 分鐘。
    - **數值換算兩段不同**（`vnl.factor()`）：Zenodo 說明只寫「0–200 換成 0–2000」。實際上 2013–2021 年（EOG 的 V2.1）存的是 nW/cm²/sr × 10（int16，GDAL scale 標 1），2022–2024 年（V2.2）存的就是 nW/cm²/sr（scale 標 10），也就是「整數 × scale ÷ 10」。用 AWS Light Every Night 的每晚原始輻射亮度（rade9）驗證：2016-01-04 晴朗的一晚台北盆地平均 26.4 nW/cm²/sr，這裡換算後 2016 年 27.4、2024 年 27.3；照 Zenodo 說明的 ÷ 10 換算只有 2.7。兩段都只到整數（2013–2021 年的值都是 10 的倍數），比 1 暗的都是 0，所以「有燈光」定為 ≥ 1 nW/cm²/sr。2013–2021 年 × 10 後碰到 int16 上限，燃燒塔最亮的像素被截在 3,276.7，2022 年起沒有截（巴斯拉最亮的像素 31,998）；各年一律截在 3,276.7（`vnl.CLIP`），燃燒塔多的國家的燈光總量才不會在 2022 年跳一階。
    - **2016 → 2017 年有斷層**：世界有燈光的土地從 5.11% 跳到 6.75%（德國 31.7% → 43.6%、日本 19.7% → 23.7%），燈光總量 +11%（之前每年 ±1%），1–1.5 nW/cm²/sr 的暗格子比例也跳上去，看起來是 EOG 的背景遮罩或處理方式不同（原因沒查到；VNL V2 的遮罩門檻依多年的資料與無雲次數決定）。2021 → 2022 年換 V2.2 反而是連續的（5 個指標都沒有跳）。處理：每個指標檔都標 `methodBreak: 2017`（側欄折線圖畫虛線），「燈光比 2017 年」與側欄地區的變化都從 2017 年算起，網格的四期之一放在 2017 年（2017 年以後的年份不會拿到 2016 年以前的網格）。2013–2016 年照樣列出，不刪。
    - **國家的範圍**：在 GHS-POP 的 30 角秒網格上畫國家編號（`ghsl.country_codes()`，跟人口的框選網格一樣），有人口卻在 1:50m 海岸線外的格子用 `ghsl.fill_gaps()` 歸給最近的國家；VNL 的 2 × 2 格對到一個 GHS-POP 格（欄剛好對齊：VNL 第 k 欄是 GHS 第 k//2 + 1 欄；列差 0.2 格，依格子中心歸）。海上的燈光不算進任何國家，世界合計也只加各國。北緯 75° 以北沒有資料（格陵蘭有資料的國土不到一半，不輸出；斯瓦巴、北極群島多的國家附註）。統計一次讀 12 年 × 256 列 GHS 格（512 列 VNL），6 個行程約 7 分鐘；結果存在 `.cache/vnl/stats-<版本>.pkl`，只改輸出時不必重算（改了統計的程式要把 `STATS_VERSION` 加一或 `--refresh`）。
    - **住在沒有燈光的地方**：GHS-POP 2015、2020、2025 三期的格子人口（年份之間線性內插，2013–2014 用 2015，2025 是推估），4 個 VNL 格子都是 0 的人口 ÷ 全國人口（分子分母都用 GHS-POP；人均燈光的分母才用 WPP）。2024 年世界 16.0%（約 13 億人），遠多於國際機構估計的沒有電的人口：有電但燈太少、太暗、太分散的村莊衛星看不到，所以只是粗略指標，指標說明與頁尾都寫明會高估。南蘇丹 80%、馬達加斯加 78%、奈及利亞 48%；台灣 0.05%（2013 年 0.15%）。
    - **燈光總量的單位**：亮度 × 面積，1 nW/cm²/sr 在 1 km² 上是 1e-9 W/cm²/sr × 1e10 cm² = 10 W/sr（向上的輻射強度，DNB 0.5–0.9 µm 波段），輸出 MW/sr。2024 年世界 537 MW/sr，美國 91、中國 57、俄羅斯 40、印度 36；台灣 1.86（第 48 名，占全球 0.35%）。人均燈光 W/sr/人：卡達 0.86、沙烏地 0.57、利比亞 0.54（燃燒塔），美國 0.26、台灣 0.080（第 110 名）、世界 0.066。
    - **變化**：燈光總量比 2017 年，基準年燈光不到 0.005 MW/sr 的國家（小島國，零點幾的燈光多一點點就是幾百 %）不算，199 國。2017–2024 年世界 +27%；甘比亞 +278%、索馬利亞 +245%、盧安達 +231%（非洲的電力普及）；黎巴嫩 −50%（經濟危機）、海地 −49%、烏克蘭 −32%（戰爭）、萬那杜 −91%（安布里姆島的熔岩湖 2018 年 12 月噴發後消失，之前衛星把熔岩湖的光也當成燈光，附註說明）。DNB 對藍光不敏感，路燈換成白光 LED 的國家（歐洲、日本）量到的燈光會變少，頁尾寫明。
    - **分級**：平均亮度 0.1、0.3、1、3、10、30 nW/cm²/sr（國家平均與網格共用，網格才看得出城市核心；國家有 82 國在最低一級）；人均 0.01、0.02、0.05、0.1、0.2、0.5 W/sr/人；有燈光的土地 1、3、10、20、40、60%；沒有燈光的人口 1、5、10、25、50、75%（`lowerIsBetter`）；變化 −50、−20、−5、5、20、50%（2024 年 7 級各 1/10/19/21/38/45/65 國）。燈光總量的比例圓圖例 1、10、50 MW/sr。
    - **側欄的地區**：Natural Earth 1:10m 的第一級行政區（4,596 個，公有領域，中文名用 `name_zht`）也畫在同一個 30 角秒網格上，2017、2024 年各算一次每個（地區, 國家）的燈光；地區歸給 2024 年燈光最多的那個國家，只算那國國界內的部分（Natural Earth 的行政區界線跟 1:50m 國界不完全重合；法國的海外大區在地圖上是另外的國家），每國列前 8 個，只有一個地區的國家不列。台灣 2024 年：高雄市 0.229 MW/sr（12%）、台中市 0.221（12%）、臺南市 0.195、彰化縣 0.170、桃園市 0.158、新北市 0.137、屏東縣 0.094、雲林縣 0.084；臺北市面積小（272 km²），總量不在前 8。名稱照 Natural Earth（「台中市」與「臺南市」的寫法不一）。原本做「最亮的城市」（燈光格子歸給 30 km 內最近的 Natural Earth 城市點），但都會區被相鄰的城市點切成好幾塊，台北市排第 8、台中與台南因為腹地大排前面，不直覺，改成行政區。
    - **台灣**：平均亮度 3.44 nW/cm²/sr（第 17/244 名，2013 年 2.85）、有燈光的土地 40.6%（第 29 名，2013 年 35.6%）。合理性：台灣本島西部平原（東經 120.75° 以西）67% 有燈光、平均 6.9；中央山脈（東經 120.85°–121.35°、北緯 22.6°–24.4°）只有 22%、平均 0.61；海拔主題的資料是 47.7% 的國土在 500 公尺以上、32.6% 在 1,000 公尺以上，跟「平地大多有燈光、山區大多沒有」對得上。附註寫在平均亮度與有燈光的土地。
    - **漁船**：average_masked 把會移動的光源大多當成短暫的光遮掉，網格上只有固定的大漁場看得到（阿根廷外海專屬經濟海域邊緣的魷釣船隊很明顯）；台灣附近海上只剩零星幾個亮點，黃海、泰國灣的漁船也大多不見了。油氣田的燃燒塔與平台（波斯灣、尼日河三角洲）都在。EOG 的未遮罩版（average）與漁船偵測（VBD）都要登入，沒有用。
66. **房價與居住負擔**（`pipeline/topics/house_prices.py`、`pipeline/sources/bis_rpp.py`、`dgbas_cpi.py`、`moi_realestate.py` 的 `price_indicator()`、`src/topics/house-prices.ts`、`src/topics/panels/HousePricesPanel.tsx`）：
    - **下載**：OECD 用 `sources/oecd.py` 一次下載整個資料流（含標籤的 CSV，約 17 MB），取年資料的 RHP、HPI、RPI、HPI_YDH、HPI_RPI、HPI_YDH_AVG、HPI_RPI_AVG；BIS 用 SDMX API 下載 WS_SPP 的實質指數（`Q..R.628`，約 0.3 MB），四季都有才算年平均，基期從 2010 年換成 2015 年；內政部「價格指標」頁面（E2010）的查詢 API `E2010Data`（GET，回傳 JSON）；主計總處的消費者物價從政府資料開放平臺 9158 的 API 找 XML 的下載網址（約 27 MB，2013 年 1 月起的月資料）。pip.moi.gov.tw 會擋一般瀏覽器的 User-Agent（回「Request Rejected」），pipeline 的 User-Agent 可以；它的 API 有時要等幾十秒才回應。第一次共下載約 45 MB，之後用快取約 10 秒。
    - **只能比變化**：OECD 的房價所得比（HPI_YDH）是名目房價指數 ÷ 每人名目可支配所得，房價租金比（HPI_RPI）是名目房價指數 ÷ 房租指數，都是 2015 年 = 100 的指數，不是「幾年的所得」；各國的房價指數本身也不同（成交價或估價、新成屋或全部住宅、全國或大都市）。所以地圖只放變化：實質房價 5 年、10 年的漲跌，實質房租 5 年的漲跌，以及 2015 年 = 100 的兩個比。OECD 另外有跟各國自己的長期平均比的版本（HPI_YDH_AVG、HPI_RPI_AVG，長期平均 = 100），只有約 25 國，放在側欄。跨國的倍數沒有開放資料（第 12 點）。
    - **實質**：OECD 的實質房價用民間消費平減指數；實質房租 = RPI ÷（HPI ÷ RHP），用 OECD 自己的名目、實質房價反推平減指數，跟實質房價同一個平減方式。BIS 用消費者物價平減，台灣用主計總處的消費者物價總指數。
    - **BIS 補的經濟體**：賽普勒斯、香港、摩洛哥、北馬其頓、馬爾他、馬來西亞、秘魯、菲律賓、新加坡、塞爾維亞、泰國，只補實質房價；OECD 有的 47 國一律用 OECD。BIS 的 WS_SPP（2026-10）有 57 個經濟體加 4 個合計，詳細的 WS_DPP 多了阿聯、阿根廷、沙烏地阿拉伯，**兩個都沒有台灣**。
    - **OECD 與 BIS 差很多的國家**：同一國兩邊選的原始序列或平減指數不同。2020–2025 年的實質房價：中國 OECD +6%、BIS −18%；加拿大 +8%、−9%；俄羅斯 +81%、+34%；土耳其 +68%、+92%；2015–2025 年美國 +54%、+38%。差超過 10 個百分點的國家（5 年 4 國、10 年 8 國），附註寫出 BIS 的數字，地圖仍用 OECD。
    - **台灣**（OECD、BIS 都沒有）：
      - 實質房價：內政部的住宅價格指數（地政司，原營建署編製；105 年 = 100，實價登錄、屋齡 0.5–60 年的住宅，2012 年第 3 季起）年平均 ÷ 消費者物價總指數。2025 年比 2015 年高 26.8%（OECD 平均 32.7%，58 國第 32），5 年 +23.9%（第 11，OECD 平均 12.7%）。
      - 房價所得比：內政部的倍數（中位數住宅價格 ÷ 中位數家戶年可支配所得）年平均，只用 2013 年起（2012 年第 2 季以前的房價是聯徵中心的擔保品估價，接不起來），換成 2015 年 = 100：2015 年 8.54 倍、2025 年 9.79 倍，所以是 114.6（OECD 平均 114.1，38 國第 15）。OECD 的分母是每人所得、房價是指數，內政部是中位數家戶所得、中位數成交價（成交的組成會變），附註寫明。
      - 房價租金比：住宅價格指數 ÷ 消費者物價的「195 住宅租金」（不用「1.房租」類，那一類還含學校住宿費），128.0（OECD 平均 130.9）；實質房租 5 年 −1.7%（OECD 平均 +0.2%）。消費者物價的房租調查的是既有租約，漲得慢（2015–2025 年名目只漲 14.8%），附註寫明。
      - 倍數放在側欄：2026 年第 1 季全國 9.47 倍、臺北市 14.72 倍、新北市 12.63 倍、臺中市 11.35 倍，房貸負擔率全國 41.46%、臺北市 64.41%（跟內政部的新聞稿一致）。側欄依時間軸的年份取那年（或之前）最後一季，2025 年是第 4 季（全國 9.32 倍）。另外列六都的住宅價格指數跟 5 年前同一季比（名目）：2020–2025 年臺北市 +21%、桃園市 +43%。
    - **顏色**：漲跌用發散色反過來（漲是橘色、跌是青綠，跟暖化一樣：房價漲對要買房的人是壞消息），門檻 5 年 ±5、15、30%，10 年 ±10、25、50%，實質房租 ±2、5、10%；房價所得比與房價租金比用同一組 70、85、95、105、115、130（以 100 為中點），兩張圖可以對照。2025 年房價租金比有 18 國在最高一級（房價比房租多漲 30% 以上），照實呈現。
    - **latestWithin 2**：美國、澳洲的房租 2025 年還沒有，沙烏地阿拉伯的房價只到 2023 年，顯示 2 年內最近一年並標出資料年份。
    - **側欄的圖**：y 軸不從 0 開始（`scale: true`），指數在 100 上下才看得出起伏；國家自己的折線從它第一個有值的年份畫起。主側欄的通用折線圖在發散色時畫一條 0 的參考線，所以房價所得比、房價租金比那兩張的 y 軸從 0 開始（通用的程式，沒有改）。
    - **跟住宅主題的分工**：住房負擔過重率（Eurostat `ilc_lvho07a`）已經在住宅主題，這裡不重複，頁尾寫明。
67. **城市**（`pipeline/topics/cities.py`、`pipeline/sources/ghsl_ucdb.py`、`wikidata_places.py`、`ris.py`、`src/topics/cities.ts`、`src/topics/panels/CitiesPanel.tsx`）：
    - **定義**：城市是 GHSL 的 urban centre，也就是「城鄉程度」（Degree of Urbanisation，聯合國統計委員會 2020 年採用的國際比較定義）的第一層：每 km² 1,500 人以上的 1 km 格子四鄰相連、合計 5 萬人以上，邊界再平滑、補 15 km² 以下的洞。是連續的市區，不是行政區，也不是通勤圈。都市化率 = 城市加上城鎮與半密集區（urban cluster：每 km² 300 人以上、八鄰相連、合計 5,000 人以上）的人口比例。2025 年世界：住在城市 45.2%、都市化率 80.5%（1975 年 32.1%、69.4%）。各國官方的都市化率定義都不同，所以不用。
    - **來源與版本**：UCDB R2024A V1.2（2026-05）的一般屬性（GENERAL_CHARACTERISTICS 主題，6.6 MB）與多時期城市（MTUC，35 MB），加上 GHS-COUNTRY-STATS R2024A（1.5 MB）。UCDB 的 GHSL 主題（GH_POP_TOT_1975…，77 MB）沒有用：那是用 2025 年的範圍回推每一期，1975 年的「城市人口」會含當時還是農村的地方。MTUC 每一期用那一期的範圍（還不是城市的期沒有值），跟國家統計的城市人口一致：2025 年各國城市的加總完全相同（台灣 18,781,891 人）；1975 年 MTUC 的合計比國家統計少 5%，是 2025 年以前就消失的城市不在清單裡。
    - **GHS-WUP R2025 沒有用**：JRC 2025 年 12 月另外發布給聯合國《世界都市化展望 2025》用的 GHS-WUP（配合 WPP 2024、推估到 2100 年，也有各國城鄉人口與多時期城市），但它的說明文件寫明跟 GHS P2023、UCDB R2024A 是「incompatible data streams」，城市的 ID 也對不起來。點用 UCDB，國家統計也用同一系列（P2023），最大城市占全國人口才是同一份網格算的。要推估到 2100 年可以整套換成 WUP R2025（見第 9 節）。
    - **檔案的坑**：MTUC 的 CSV 是 cp1252，非拉丁字母的名稱變成「?」，數字有千分位；名稱改用一般屬性的 CSV（UTF-8；GeoPackage 裡的 GC_UCN_LIS 有些是 UTF-8 被當成 Latin-1 的亂碼）。MTUC 另外有 264 個國家欄是 #N/A、不在 UCDB 2025 的實體（例如摩洛哥的 Tan-Tan），不用。中心點是一般屬性 GeoPackage 的 `UC_centroids` 表（人口加權，Mollweide），用 rasterio（PROJ）換成經緯度；GeoPackage 是 SQLite，標準函式庫就讀得到。
    - **合併的城市**：MTUC 把後來合併的實體算成同一個 ID（many-to-one），所以 1990 年的「Guangzhou」是後來併成一片的那些實體的合計，點固定畫在 2025 年的中心點。珠江三角洲在 1990 年代連成一片：582 萬（1990）→ 1,284 萬（1995）→ 2,777 萬（2000）→ 4,299 萬人（2025，6,454 km²），範圍含深圳、佛山、東莞、江門、中山；香港、「Zhuhai [Macau]」（珠海與澳門）是另外的城市。各國「最大城市的人口」在合併那一年會跳一階（中國 1995 → 2000 年），指標說明與頁尾都寫明。
    - **國家**：UCDB 的國家是 GADM 的國名（México 有重音、國家統計沒有，去掉重音再對）。GADM 的中國含香港、澳門，國家統計也是，所以港澳沒有國家的值（`noValue`）；點則依地圖的國界標成 HKG、MAC（`geoindex.country_at`），滑過標出香港、點一下選取香港，側欄列出香港的城市。科索沃 XKO → XKX、北賽普勒斯 ZNC → _CYN；亞克羅提利與德凱利亞、裏海、克利珀頓島、西沙、南沙不輸出。
    - **中文名稱**（Wikidata）：一次查出人口 3 萬以上、有座標的 5.4 萬個項目的英文／mul 名稱與英文別名（很多項目 2025 年起英文名稱只放在 mul，例如坦帕 Q49255），找中心點在城市範圍附近（15 km 加上等面積圓半徑的 1.5 倍）、名稱正規化後跟 UCDB 主要名稱相同的；優先正式名稱、不是行政區的、比較近的，距離相同時人口少的（州、省的座標常常就是首府）。只靠別名對到的行政區不用；東亞以外，中文名稱以省、州、縣、郡、區結尾的也不用（赤瓦瓦州、安特衛普省、西寧省），改試下一個候選。zh 名稱是原文（「Quixadá」）的不用，簡體字依 `nobel.S2T` 加上幾個實際出現的字轉成繁體。結果：5,597 個城市有中文名稱，30 萬人以上 1,557/1,905 個（82%）、100 萬人以上 494/524 個；沒對到的用英文（印度的 Hajipur、Kalyan-Dombivli、華盛頓…），不自己翻譯。
    - **台灣**：21 個城市，有 17 個有中文名稱；Dazhuang（沙鹿、梧棲一帶）、Gonghuakeng（林口、龜山一帶）、Ô-á-liâu / Kezihliao（岡山、梓官一帶）、Xinying District（新營）是 UCDB 依 OpenStreetMap 的村里或區名取的，Wikidata 對不到，照英文。2025 年住在城市 78.3%（第 7/241）、都市化率 94.5%（第 14）；百萬人口以上 4 個（臺北、臺中、高雄、臺南；臺南 2030 年推估 100 萬以下）。最大的「Taipei」是臺北、新北、桃園、基隆連成一片（972 km²），968.7 萬人，最大城市占全國 40.4%（第 26/191），比四市的戶籍人口合計 919.9 萬（內政部 2025 年底）還多 5%：GHS-POP 配合 WPP 2022，台灣 2025 年是 2,397 萬人，比戶籍的 2,330 萬多 2.9%，加上分配到格子的誤差。臺中 231.8 萬（臺中市戶籍 286.8 萬）、高雄 229.5 萬（高雄市 271.9 萬）、臺南 101.1 萬（臺南市 185.2 萬）、新竹 71.3 萬（新竹市＋新竹縣 105.3 萬）、彰化 43.8 萬（彰化縣 121.0 萬）。原本以為臺中與彰化、臺南與高雄也會連成一片，實際上 UCDB 是分開的城市。側欄的對照表與附註都寫出這些數字（`taiwan.json`）。
    - **大小**：`cities.json` 1.47 MB（gzip 後 468 KB；整個主題的資料夾 1.54 MB）：11,422 個點 × 12 期的人口（百人）與面積（km²），每一期存跟前一期的差（gzip 後少 14%，`cities.ts` 的 `cityValue()` 一路加回來）；名稱占最多（gzip 後英文 62 KB、中文 38 KB、範圍內的其他地名 23 KB）。指標檔 5 個共約 70 KB。城市地圖一打開就下載，側欄讀同一個檔（`useJson` 有快取）。
    - **點**：半徑約 3.5 × √(人口 ÷ 100 萬) px（縮放 2 時），分段線性內插，5 萬人放大到 1.1 px；顏色是比例圓的紫色（`MAP_TOKENS.accent`），不分類。資料依 2025 年人口由大到小排，小城市畫在大城市上面。縮小時只畫大城市（第 4 節「依縮放篩選」）。點只畫在城市地圖（面量圖、比例圓上再疊上萬個點會看不清楚）。tooltip：名稱、國家、那一期的人口、面積與每 km² 人數、比 10 年前（1980 年跟 1975 年比；之後才成為城市的寫「2020 年起成為城市」），中文名稱下面寫英文名稱與範圍內的其他地名（最多 4 個）。
    - **分級**：都市化率 40、55、70、80、90、95%；住在城市 10、20、35、50、65、80%；最大城市占全國 5、10、20、30、45、60%（2025 年中位數 18%，巴林 90%、科威特 84%、新加坡 84% 最高）。
68. **學生能力（PISA）**（`pipeline/topics/pisa.py`、`pipeline/sources/oecd_pisa.py`、`src/topics/pisa.ts`、`src/topics/panels/PisaPanel.tsx`）：
    - **來源**：OECD《PISA 2025 Results (Volume I): Future-Ready Students》（2026-09-08）附錄 B1 的表，StatLink 的 Excel：https://stat.link/mrq53f （表 I.B1.2a.*，平均分數與各級比例，1.5 MB）與 https://stat.link/68stqn （表 I.B1.2c.*，男女，1.3 MB）。oecd.org 的網頁（含 Education GPS）擋程式（Cloudflare 的「Just a moment...」，HTTP 403），但 stat.link 轉到 `stat.link/files/…` 的 Excel 與 `oecd.org/content/dam` 的 PDF 都直接下載得到。OECD Data Explorer（SDMX）的資料流清單沒有 PISA（2026-10 查），世界銀行 EdStats 沒有台灣，所以用報告的表。
    - **用到的表**：I.B1.2a.36–38（科學 2006、閱讀 2000、數學 2003 年起每一次的平均分數，與「2025 年減某一年」的差）、I.B1.2a.33–35（同樣年份未達第 2 級、第 5 級以上的比例）、I.B1.2c.25、28、31（2015 年起的男女差距，男生 − 女生）。表裡的「OECD average-23」（PISA 2000 起每一次都參加的 23 個 OECD 國家）放在 aggregates 的 `OECD23`，「OECD average」（38 國，只有某幾次有值）放在 `OECD`。pipeline 檢查 OECD 公布的「2025 年減某一年」跟平均分數相減一致。表裡的國名在 `oecd_pisa.NAMES` 對到代碼，出現不認得的國名就報錯。
    - **年份**：只收 OECD 認為可以前後比較的那幾次（數學 2003、閱讀 2000、科學 2006 年起）。PISA 2000+（2001、2002 年施測）、PISA 2009+（2010 年）、PISA for Development（2017 年，記在 2018）照 OECD 的表記在原本那一次，附註寫明。OECD 2025 年的趨勢表刻意空著的（奧地利 2009、美國 2006 年的閱讀、阿根廷、哈薩克、馬來西亞 2015、西班牙 2018、盧森堡 2022）也空著，附註寫明。
    - **只收參加 2025 年的 91 個**：表只列 2025 年的參加者與它們之前的成績。只參加過之前幾次的（俄羅斯、白俄羅斯、列支敦斯登、突尼西亞、千里達及托巴哥、阿爾及利亞、巴拿馬、牙買加、波士尼亞與赫塞哥維納、2009 與 2012 年的上海、2015 年的北京上海江蘇廣東、2018 與 2022 年的巴庫、2018 年全國的烏克蘭…）只在 2024 年 7 月以前出版的報告裡，不是 CC BY 4.0（第 12 點），沒有用。所以早年的名次會比官方的前面：台灣數學 2009、2012 年在這裡是第 4、3（官方第 5、4，少了上海），閱讀 2006、2009 年第 15、21（官方 16、23），科學 2009、2012 年第 11、10（官方 12、13，2012 年還少了列支敦斯登與越南）；2015 年以後都一樣。側欄另外列臺灣 PISA 國家研究中心公布的名次。
    - **只有部分地區參加的**：北京上海江蘇浙江（B-S-J-Z，2018、2025 年）、烏克蘭的部分地區（27 個裡 2022 年 18 個、2025 年 17 個）、伊拉克的庫德斯坦地區（只有公立學校）、塔吉克的首都杜尚別，是主題自訂的地點（`_QCI`、`_QUA`、`_QKI`、`_QTJ`，用 PISA 自己的代碼），畫成點：B-S-J-Z 在四個省市的中間（江蘇北部）、其他在基輔、艾比爾、杜尚別。中國、烏克蘭、伊拉克、塔吉克用 `noValue` 寫原因，不塗整個國家。香港、澳門在地圖上有自己的形狀，照常上色；賽普勒斯是政府實際管轄的地區（地圖上的 CYP，北賽普勒斯是另外一塊）。名次照 OECD 的表把這些地點一起排：台灣 2025 年數學第 4 是排在 B-S-J-Z、新加坡、澳門之後，跟官方一樣。
    - **OECD 標註的限制**（PISA 2025 的 Reader's Guide）：阿爾巴尼亞只有限度地報告、不比較趨勢，所以兩個變化指標不收阿爾巴尼亞（OECD 的表在分隔線下仍列了差值）；烏茲別克 2025 年的數學與閱讀作答資料不一致，只公布科學（科學 2022 → 2025 年 +83 分是 OECD 的數字）；越南 2025 年改用電腦測驗，跟之前的紙本不比較，只有 2025 年；美國、加拿大、荷蘭、紐西蘭、挪威沒有達到抽樣標準（星號），附註寫出 OECD 估計的偏差；黎巴嫩、巴勒斯坦 2025 年不含受衝突影響最大的地區。
    - **指標**：平均分數、低成就比例（未達第 2 級，`lowerIsBetter`）、高成就比例（第 5 級以上）、比上一次（跟上一次 PISA 比，上一次沒有參加的不算）、跟 2012 年比、男女差距（`unranked`）。三個科目是子項目（檔名 `<指標>/<科目>.json`），三個科目用同一組門檻：平均分數 390、420、450、480、510、540；低成就 10、20、30、45、60、75%；高成就 1、3、6、10、20、30%；比上一次 ±5、10、20 分；跟 2012 年比 ±10、25、40 分；男女差距 ±5、20、40 分（青綠是男生高、橘色是女生高）。比上一次 ±5 分以內大多不顯著，指標說明有寫；表裡有標準誤，但只有跟 2025 年比的差，沒有做顯著性標示。
    - **位數**：平均分數、變化、男女差距存兩位小數，比例存一位，畫面上跟 OECD 一樣顯示整數的分數、一位小數的比例。比例原本也存兩位，台灣 2025 年數學高成就 31.849% 存成 31.85、顯示成 31.9%（官方 31.8%），兩次四捨五入，所以比例改存一位。
    - **台灣**：PISA 的名稱是 Chinese Taipei，對到 TWN。2006–2025 年三個科目的分數跟臺灣 PISA 國家研究中心（臺師大）2026-09-08 記者會簡報的數字四捨五入後完全一樣（pipeline 逐一檢查，2025 年的低、高成就比例也是）：數學 549、543、560、542、531、547、546，閱讀 496、495、523、497、503、515、508，科學 532、520、523、532、516、537、540。2025 年數學第 4（2022 年 547 分第 3）、閱讀第 3、科學第 4（91 個國家與經濟體），跟官方一樣。2025 年低成就／高成就：數學 14.5%／31.8%、閱讀 17.9%／13.4%、科學 12.9%／20.1%；男女差距（男生 − 女生）數學 +1、閱讀 −39、科學 −11 分。比上一次：數學 −1（第 16/75）、閱讀 −7、科學 +2 分；跟 2012 年比：數學 −14、閱讀 −15、科學 +16 分。
    - **側欄**：三個科目各一張歷次分數的小圖，跟 OECD 23 國平均比（國家研究中心也用這個平均；38 國的 OECD 平均只有幾次有值，畫不成線），下面是每一次的分數與名次表；台灣另外列國家研究中心公布的名次與參加國數（`taiwan.json`）。
    - **大小**：18 個指標檔加 `taiwan.json`、`manifest.json`，共約 200 KB（gzip 後約 30 KB）。

69. **婚姻與家庭**（`pipeline/topics/marriage.py`、`pipeline/sources/undesa_wmd.py`、`undata_dyb.py`、`oecd_family.py`、`ris_marriage.py`、`same_sex_unions.py`、`src/topics/marriage.ts`、`src/topics/panels/MarriagePanel.tsx`）：
    - **初婚年齡**：每個國家只用一個來源（最新一年最晚的那個，同一年依 Eurostat、OECD、聯合國的順序，`pick_latest()`），歷年折線才不會因為換來源而跳動：
      - Eurostat demo_nind 的 FAGEMAR1、MAGEMAR1（依結婚登記的初婚者平均年齡）。
      - OECD Family Database SF3.1（各國官方，到 2021 年）：墨西哥含再婚，不收；美國、澳洲、紐西蘭是中位數，照收但附註寫明（聯合國的 SMAM 美國只到 2010 年，不收的話美國就是灰色）。
      - 其他國家用聯合國 World Marriage Data 2019 的 SMAM（單身平均結婚年齡，依普查或調查的各年齡未婚比例用 Hajnal 的方法推算）。同一國同一年常有好幾筆（同一次 DHS 的 STATcompiler 與家戶檔各算一次、同一年的普查與調查），依普查 → 依登記的估計 → 調查、再依資料來源的順序取一筆（`undesa_wmd._rank()`），年份用資料蒐集開始的那一年。
      - 兩種算法的數字相近：日本 2015 年的 SMAM 女性 29.2 歲，依登記的平均是 29.4 歲。
      - WMD 多半只到 2010 年代，地圖用 10 年內最近一年（`latestWithin`），2024 年女性有 135 國、男性 121 國有值，2019 年有 196、186 國。
    - **15 歲以上有偶比例、30–34 歲未婚比例**：WMD 的 CURRENTLY MARRIED、EVER_MARRIED 是男女分開的各年齡組比例，用 WPP 2024 那一年的年齡別人口加權成男女合計（`weighted_share()`）。有偶比例要從 15 歲起連續的五歲組一路到開放組（只有 15–49 歲的 DHS 不收），齊全的那一筆才用，否則換同一年的下一筆。部分國家的「有偶」含同居（WMD 的 Including_consensual_unions 欄是空的，沒辦法逐國標出），頁尾寫明。
      - 用 30–34 歲而不是 15 歲以上的未婚比例：15 歲以上的未婚比例主要反映年齡結構（年輕人多的國家高），看不出晚婚、不婚。有偶比例同樣受年齡結構影響，指標說明寫了。
    - **粗結婚率、粗離婚率**：
      - Eurostat 的 GNUPRT、GDIVRT；OECD SF3.1 只用各國官方來源的 11 個非歐洲國家（澳洲、加拿大、智利、哥倫比亞、哥斯大黎加、以色列、日本、韓國、墨西哥、紐西蘭、美國；其他國家 OECD 也是轉載 Eurostat 或 Demographic Yearbook）。澳洲、紐西蘭的粗離婚率 2018 年起改成每千名 16 歲以上人口，不收。
      - 其他國家用 UNdata 的對數除以 WPP 2024 的年中人口（2024、2025 年用推估的人口）。Demographic Yearbook 用各國自己的年中人口，所以跟它公布的粗率略有差距（塞席爾 2023 年 DYB 13.7、這裡 12.8）。
      - **UNdata 的下載**（`undata_dyb.py`）：2026 年 10 月 UNdata 改版，`Handlers/DownloadHandler.ashx` 與換頁用的 `DataHandler.ashx` 都回新網站的首頁（HTTP 200 或 404 的 HTML），只剩 `Data.aspx` 在伺服器端產生第一頁的 50 筆。依國家（`countryCode`）與全國（`areaCode:0`）篩選，一國一頁，紀錄依年份由新到舊，所以拿得到最近的 50 筆（同一年有依發生、依登記兩筆的國家約 25 年）；國家清單取自網頁的篩選選項。同一年優先用依發生日期，再取資料來源年份最新的。第一次約 220 頁（每頁間隔 0.3 秒），之後用快取。
      - **只收登記完整的國家**：UNdata 的「Reliability」欄只有 Final figure、Provisional figure、Other estimate，沒有登記完整度；Demographic Yearbook 只替「Code」欄標 C（登記涵蓋 90% 以上）的國家算粗率。所以只收 DYB 2023 年版表 23、25 標 C 的國家（`undata_dyb.COMPLETE`，結婚 117 個、離婚 96 個；表本身不轉載，見第 12 點）。標 U 的（巴西、印尼、菲律賓、泰國、玻利維亞、厄瓜多…）、沒有資訊的（南非、沙烏地阿拉伯、孟加拉…）與 2023 年版沒有列的（例如赤道幾內亞，2023 年只登記了 243 對，每千人 0.13 對）都不收。
      - **附註**：UNdata 每一列後面的附註文字在連結的 `title`。寫明只涵蓋部分地區或人口的列不收（`PARTIAL`）：英國的結婚 2016 年以後「只有英格蘭與威爾斯」（所以英國的粗結婚率只到 2016 年）、美國的離婚「不含加州、喬治亞……」（美國改用 OECD，CDC 依有通報的州算的離婚率）、秘魯「只有利馬」、東加「只有東加塔布島」、蓋亞那「只有基督教婚禮」、蘇利南「只有民事離婚」等。含觀光結婚的非居民（`VISITORS`）的照收，附註寫明（庫克群島 2024 年每千人 32.8 對、塞席爾 12.8 對）。
      - 中國的 UNdata 只到 2012 年、也不在 DYB 2023 的表裡，印度沒有結婚登記統計，法國的離婚在 Eurostat 只到 2016 年（2017 年起協議離婚不必經過法院）、也不在 DYB 2023 的離婚表裡，都是灰色。2024 年結婚率有 116 國、離婚率 99 國有值（5 年內）。
    - **非婚生子女比例**：Eurostat 的 NMARPCT，歐洲以外的 OECD 國家用 SF2.4（日本、韓國、澳洲、紐西蘭是「父母沒有登記結婚」的出生，其他是出生時母親沒有結婚）。以色列 2016 年以前只算猶太女性，只收 2017 年起。共約 59 國。
    - **單人家戶比例**：Eurostat 勞動力調查的 lfst_hhnhtych（一個成人、沒有小孩的家戶 ÷ 所有家戶，2006 年起），更早的年份與其他國家用聯合國家戶規模資料庫的「1 member」（它的歐洲部分本來就來自勞動力調查，接得起來，附註寫出從哪一年起是 Eurostat）。是家戶的比例，不是人口的比例。
    - **台灣**（`ris_marriage.py`、`fies.one_person_share()`）：
      - 戶政司「人口統計資料」的頁面是 iframe（`/info-popudata/app/awFastDownload/toMain_panel`），每個表的下載是對 `…/view` 送表單（`type=ods`、`m4c=` 表的代碼，例如結婚年齡是 y4s5），要帶首頁的 cookie 與 CSRF token（`<meta name="_csrf">`），否則回 403。表只有一個版本，每年更新。
      - 第一欄有儲存格註解的列（「user62年以前資料係參考62年年刊…民國62年」），讀出來的文字會把註解接在前面，所以用結尾的「民國…年」比對。
      - 初婚者的平均年齡（按發生日期）：2024 年男 33.1、女 31.1 歲，2025 年男 33.4、女 31.4 歲。官方表 1993–1997 年女性的平均（27.1–28.2 歲）比同年的中位數高 1.4–1.6 歲、1998 年又掉回 26.0 歲，原因不明，照官方的數字畫。
      - 粗結婚率 2024 年 5.26‰（123,061 對，其中同性 3,205 對）、2025 年 4.47‰（104,376 對，同性 3,305 對）；粗離婚率 2024 年 2.28‰（53,469 對，同性 926 對）、2025 年 2.23‰（52,101 對）。跟新聞引用的內政部數字一樣。
      - 15 歲以上有偶比例（戶籍，2019 年起含相同性別的配偶）2024 年 49.3%、2025 年 49.0%；30–34 歲未婚比例（統計查詢網 c0110301，男女合計）2024 年 60.7%、2025 年 62.1%；非婚生子女比例（按登記，不含無依兒童）2024 年 3.9%、2025 年 4.5%。
      - 單人家戶比例用主計總處家庭收支調查第 28 表「家庭戶數按戶內人口規模別之分配」的「1人」（2024 年 15.6%、2025 年 17.3%）。戶籍的「單獨生活戶」包含很多只是把戶籍分開的人，比例高很多，不用。
      - 側欄另外列近 8 年的結婚、離婚對數與其中的同性伴侶（`taiwan.json`）。
    - **同性伴侶的法律地位**（`same_sex_unions.py`，依英文維基百科自行整理，CC BY-SA 4.0）：
      - 三類，有強弱之分，用循序色（`ordinal`）：同性婚姻；民事結合等其他全國性的承認（Civil union 條目「List of jurisdictions recognizing same-sex unions」裡的全國性制度，加上承認在國外締結婚姻的以色列、美屬薩摩亞、荷屬聖馬丁與 2026 年起只承認其他歐盟國家婚姻的波蘭）；沒有全國性的法律承認（只有部分州、縣市有伴侶登記的日本與 2019 年以前的台灣，以及美國、墨西哥、巴西、加拿大、澳洲在全國開放以前的年份都算這一類，附註寫出最早開放的地區）。
      - 是每年年底的狀態，1989（丹麥的伴侶登記）–2026 年。台灣 2019 年 5 月 24 日起可以結婚，所以 2019 年起是第一類。2026 年有 39 個國家（含尼泊爾）可以同性結婚，加上屬地共 72 個地圖單位；17 個有其他全國性的承認。每個國家的附註寫出依據的法律或判決與生效日。
      - **尼泊爾**：最高法院 2026-06-18 的終審判決（Pinky Gurung 案）要求政府全面承認同性婚姻（2023 年 11 月起已依臨時命令另冊登記），民法還沒修改。維基百科的「Same-sex marriage in Nepal」與年表算 2026 年起合法，但同一篇總覽的「38 個國家」還沒算進去；照專門的條目與判決歸到同性婚姻，附註寫明民法還沒修改。2026-10-27 確認維持這個分類（沒有改成「其他全國性的承認」或「沒有全國性的法律承認」）。
      - 哥斯大黎加：Civil union 條目寫「1995 年 unión de hecho」，那是異性的事實婚姻，同性伴侶要到 2020 年才能結婚，所以之前算第三類。葡萄牙 2001 年的事實婚姻、哥倫比亞 2009 年的事實婚姻結合、巴西 2011 年的穩定結合不是登記制度，但照 Civil union 條目算第二類。
      - 百慕達：2017 年 5 月法院判決開放、2018 年 6 月起改為同居伴侶、同年 11 月上訴法院恢復、2022 年 3 月英國樞密院司法委員會推翻，年底的狀態是 2017–2021 年第一類、2022 年起第二類。
      - 屬地：法國的海外省與海外領地、美國的屬地（美屬薩摩亞除外）、澳洲的屬地、斯瓦巴、奧蘭跟所屬國家的婚姻法（`FOLLOWS`）；伴侶制度不跟隨，有的各自寫（PACS 1999 年起適用海外省，新喀里多尼亞、瓦利斯和富圖納 2009 年起）。格陵蘭、法羅群島、荷蘭的加勒比海屬地、阿魯巴、古拉索與英國的海外領地各自寫生效日；英屬維京群島、安圭拉、蒙哲臘、土克凱可、庫克群島、紐埃算第三類。無人島（南極、法屬南方領地、布威島等）不收。
      - 香港沒有民事結合或婚姻（法院判決給予部分權利，終審法院 2023 年 9 月要求政府建立伴侶制度），日本只有地方的伴侶宣誓或證明制度，都算第三類，附註寫明。
    - **沒有名次**：這些指標沒有好壞（結婚率高、初婚年齡低都不代表比較好），一律 `unranked`，排名表只依數值排列。
    - **大小**：9 個指標檔加 `taiwan.json`、`manifest.json`，共約 430 KB（gzip 後約 55 KB）。初婚年齡、有偶比例的檔比較大，是因為 1970–2025 年每個國家都有一整排，大部分是 null。

70. **疫苗與防疫**（`pipeline/topics/vaccination.py`、`pipeline/sources/wuenic.py`、`owid_covid.py`、`economist_excess.py`、`cdc_tw.py`、`mohw_deaths.py` 的 `deaths_by_code()`、`src/topics/vaccination.ts`、`src/topics/panels/VaccinationPanel.tsx`）：
    - **WUENIC 的來源**：2000–2025 年用 WHO GHO（`WHS4_100` DTP3、`VACCINECOVERAGE_DTP1`、`WHS8_110` 麻疹第一劑、`MCV2`、`SDGHPVRECEIVED` HPV），是 WUENIC 2025 年版（2026-07-15 完成），195 個 WHO 會員國，沒有台灣。1980–1999 年接世界銀行的 WDI：WDI（2026-10-08 更新）還是 2024 年版，2000 年以後有 150 個值跟 2025 年版不同（每年改版都會修訂整個序列），但 1980–1999 年跟 WHO 免疫資料入口的 2025 年版逐一比對完全相同（DTP3 3,249 個、麻疹 3,126 個），所以只拿 WDI 的 1980–1999 年。GHO 跟入口的 2025 年版 2000–2025 年也完全相同（DTP3 5,051 個值）。世界值只有 GHO 的 2000 年起（WDI 的世界平均跟 WUENIC 的算法不同，1980 年 16.7% 對 20%，不接）。
    - **HPV**：`SDGHPVRECEIVED` 是 9–14 歲女孩這個主要目標世代打了第一劑的比例（WHO 2022 年起建議一劑就可以），跟入口的 `PRHPV1_F` 相同（抽查日本與全球），2025 年全球 33%（UNICEF 的 WUENIC 2025 年版簡報也是 33%）。還沒有 HPV 疫苗計畫的國家沒有值（灰色）；麻疹第二劑則是還沒納入常規接種的國家記成 0（奈及利亞 2018 年以前），照原樣用，指標說明有寫。
    - **零劑兒童**：WHO/UNICEF 只公布各國的接種率（整數）與全球、區域的人數，沒有各國的人數，所以自己算：存活嬰兒（WPP 2024 的出生數 − 嬰兒死亡數）×（100 − DTP1）÷ 100，四捨五入到百位。2025 年 195 國加總 1,338 萬人，WHO/UNICEF 公布 1,350 萬人（入口的全球 target − doses 是 1,347 萬），差 0.7%；存活嬰兒 1.286 億，WHO 是 1.292 億。`_check_zero_dose()` 差超過 3% 就報錯。接種率是整數，單一國家可能差幾個百分比（例如印度 2025 年算出 67.7 萬人，DTP1 97% 的 ±0.5% 就是 ±11 萬人），指標說明寫「用存活嬰兒數乘上比例」。2025 年最多的是奈及利亞（214 萬，占 16%）、剛果民主共和國、葉門、印度、印尼。DTP1 只有 2000 年起，所以零劑兒童 2000–2025。
    - **門檻**：DTP3、麻疹兩劑用同一組 50、70、80、85、90、95%（90% 是 WHO 免疫議程 2030 的目標，95% 是麻疹群體免疫需要的涵蓋率），2025 年大多數國家在最高的兩級，看得出的是 90% 以下的國家；HPV 10、25、50、70、80、90%。確診死亡與超額死亡用同一組 10、50、100、200、300、500（每 10 萬人），兩張圖可以直接對照；超額死亡可能是負的（紐西蘭、台灣 2020–2021 年），算在最低一級。完成基礎劑 20、40、50、60、70、80%。
    - **COVID-19 的資料都停止更新了**：OWID 的 GitHub 版本庫 2024-08-19 封存，之後由 OWID 的 ETL 更新 `compact.csv`（https://catalog.ourworldindata.org/garden/covid/latest/compact/compact.csv ，約 180 MB，2026-10 下載的是 2026-10-02 的檔）：確診死亡（WHO COVID-19 dashboard，每週）到 2026-08-30，疫苗接種最後一筆 2024-08-12（多數國家 2023 年就停止公布）；The Economist 的模型 2024-06-18 最後一次更新（到 2024-06-17），網址固定在那個 commit（94cac43）。地圖用每年年底的值：確診死亡 2020–2025、完成基礎劑 2021–2023（`latestWithin: 1`：那一年沒有公布的國家顯示前一年，例如南韓、英國 2023 年）、超額死亡 2020–2023；側欄的時間線是每個月月底的值，到最後一筆。
    - **WHO 的「中國」含香港、澳門與台灣**：WHO COVID-19 dashboard 沒有香港、澳門、台灣的條目，OWID 的這三個地方也沒有確診死亡。跟 JHU 分開列的數字比，WHO 的中國累計死亡 = 中國大陸＋香港＋澳門＋台灣：2022-08-31 WHO 24,883 人，JHU 的中國大陸 5,544、香港 9,690、澳門 6、台灣 9,914 人，加起來 25,154 人（不含台灣只有 15,240 人）；2022-11-30 WHO 30,388 人、加總 30,320 人（`_china_note()` 每次核對，差超過 2% 或不含台灣也對得上時報錯）。WHO 沒有寫明這個分法（dashboard 的說明與 OWID 都沒有找到），是從數字推出來的，附註寫出比對的數字。所以中國的附註寫明，香港、澳門的確診死亡寫「WHO 算在「中國」裡」（指標的 `noValue`），每 10 萬人的分母是 OWID 的中國大陸人口，所以中國的值略高估。疫苗接種、超額死亡都有香港、澳門、台灣自己的數字。
    - **台灣的 COVID-19 死亡**：WHO 沒有單獨列出台灣，OWID 2023 年 3 月改用 WHO 的資料後也沒有台灣的確診死亡。疾管署（中央流行疫情指揮中心）每天公布的累計確診死亡由 JHU 轉載到 2023-02-22（17,672 人；指揮中心 2 月 23 日起不再每天公布明細），2023 年 3 月 20 日起輕症不必通報、只通報中重症（併發重症），沒有可以接到年底的全國數字。所以地圖上台灣用衛福部死因統計（`mohw_deaths.deaths_by_code("U07")`，疾病主題的同一個檔）裡死因是 COVID-19 的人數累計：2020 年 28、2021 年 896、2022 年 14,667、2023 年 8,962、2024 年 2,962、2025 年 932 人，2025 年底累計 28,447 人、每 10 萬人 123.1（WPP 人口）。對照疾管署通報的年底累計 7、850、15,253 人：2022 年底死因統計的累計 15,591 人，多 2.2%；2020 年死因統計 28 人、疾管署 7 人，兩者定義不同（死亡證明書的根本死因 vs 確診個案的死亡），附註照寫數字，不解釋原因。側欄的折線是疾管署通報的確診死亡（到 2023 年 2 月）與超額死亡，下面的表列出兩種數字。
    - **台灣的疫苗接種**：OWID 有台灣（來源是疾管署，到 2023-09-24，完成基礎劑 88.8%）。跟疾管署 2022-03-24 的「COVID-19 疫苗接種統計資料」PDF 比，人數完全相同（第 1 劑 19,438,065 人、第 2 劑 18,223,457 人，OWID 差 1 人），比例因為分母不同略低：疾管署用戶籍人口 83.35%、78.15%，OWID 用 WPP 人口 83.00%、77.81%（`_check_taiwan_vaccination()` 每次核對）。
    - **台灣的常規疫苗**：疾管署開放資料的「各項預防接種完成率統計」（data.gov.tw 24457，2022–2025 年縣市別的 CSV，含 MMR 第二劑）放在 od.cdc.gov.tw，2026-10-26 從這裡連不上（TCP 443、80 都逾時，換 DNS 一樣；疾病主題 2026-10 也遇到），data.cdc.gov.tw 的 CKAN 沒有 datastore，Wayback Machine 回 429。所以改用疾管署網站「預防接種統計」（https://www.cdc.gov.tw/Category/MPage/S2UF2-VuMgfzgzpy7qdvlA ）每年一份的「幼兒各項常規疫苗接種完成率」PDF：數字只畫在長條圖上，照圖抄進 `cdc_tw.KNOWN`（104–114 年，即 2015–2025）。五合一疫苗第三劑 → DTP3，MMR 第一劑 → 麻疹第一劑：2015 年 97.78%、98.28%，2025 年 98.0%、98.7%（DTP3 196 國第 20、麻疹第一劑第 19）。統計定義（PDF 第 2 頁）：五合一第三劑是前一年出生的幼兒、MMR 第一劑是前兩年出生的，到當年 12 月底的接種完成率；WUENIC 是當年滿 1 歲的嬰兒，口徑接近但不完全相同，附註寫明。疾管署網站的檔名有的用 CJK 相容字（「率」是 U+F9E1），找連結時要先 NFKC 正規化。
    - **台灣沒有值的**：麻疹第二劑（疾管署 2025-01-09 致醫界通函第 559 號：「近年 2 劑接種完成率均高達 97% 以上」，沒有逐年的全國數字）、HPV（國健署公布的是國中女生完成兩劑的比例，依入學年度：107–110 學年度 75.2%、86.0%、86.1%、91.7%，統計到 2024 年 4 月，衛福部 2024-06-04 新聞稿；WHO 的是第一劑，定義不同）、零劑兒童（疾管署公布的完成率只有五合一第三、四劑，沒有第一劑）。三個都用指標的 `noValue` 寫短的原因，附註寫官方的數字。
    - **名次**：確診死亡、超額死亡 `unranked`（確診死亡取決於檢驗與通報，排名會讓檢驗少的國家看起來最好；超額死亡的區間很寬），排名表只依數值排列。接種率、完成基礎劑照常排名（高的在前），零劑兒童是比例圓，依人數排。
    - **側欄**（`VaccinationPanel.tsx`）：兒童常規疫苗四條折線（讀四個指標檔，y 軸 0–100%）；COVID-19 的兩張每月折線（x 軸只在 1 月標年份，時間軸那一年的 12 月畫參考線）：累計確診死亡與超額死亡（每 10 萬人）、至少一劑與完成基礎劑；說明寫時間軸那一年年底的值與超額死亡的 95% 區間（有全死因統計的國家上下限一樣，不寫）。時間線檔 `covid/<ISO3>.json` 只有指標檔裡有 COVID-19 資料的國家才去要，沒有的國家不發請求（避免 404）。
    - **大小**：8 個指標檔加 `manifest.json` 共 128 KB，`covid/` 238 個國家與地區的時間線共 302 KB（每個約 1.3 KB），整個主題 0.43 MB（gzip 後約 120 KB），沒有網格圖磚。

71. **平均身高**（`pipeline/topics/height.py`、`pipeline/sources/ncdrisc.py`、`nahsit.py`、`src/topics/height.ts`、`src/topics/panels/HeightPanel.tsx`）：
    - **來源**：成人身高是 NCD-RisC《A century of trends in adult human height》（eLife 2016，1,472 份實際量測身高的調查）的 `NCD_RisC_eLife_2016_height_age18_countries.csv`（https://www.ncdrisc.org/archives.html ，2.4 MB），1896–1996 年出生的男女在 18 歲時的平均身高與 95% 不確定區間（credible interval），200 個國家與地區，**含台灣**（疾病主題第 23 點說的「沒有台灣」是指肥胖、糖尿病的檔）。成人身高之後沒有新版，所以在「Archives of outdated estimates」裡。19 歲的身高是《Height and body-mass index trajectories of school-aged children and adolescents from 1985 to 2019》（Lancet 2020）的各國檔（zip 4.6 MB，5–19 歲每一歲、1985–2019 年每年）與全球檔，同樣 200 個國家與地區、同一組國名。授權見第 12 點。
    - **下載**：www.ncdrisc.org 隨機回 HTTP 421（Misdirected Request：SNI 跟 Host 對不上）或在傳到一半時斷線，curl 回 200 的檔也可能不完整（第一次拿到 1.4 MB 的成人身高，完整的是 2.4 MB，CSV 讀得出來但後半的國家只有男性）；Python 的 urllib 每次都被重設連線（WinError 10054，限制 TLS 1.2 也一樣）。所以 `ncdrisc._download()` 用 curl，先用 HEAD 拿 Content-Length，再下載、續傳（`-C -`），421 的錯誤頁寫進檔案時切回原本的大小，直到大小一樣。
    - **時間軸是出生年**：NCD-RisC 用出生世代建模（每筆調查的出生年 = 調查年減年齡組的中間年齡），報告每個世代在 18 歲時的身高，1996 年出生 = 2014 年 18 歲。模型裡每個世代老了會變矮（估計每老 10 歲男性矮 0.2、女性矮 0.3 公分）。所以這些指標加了 `timeAxis`（第 4 節）：時間軸的年份上面寫「出生年」，tooltip 寫「台灣 · 1996 年出生」，排名表「各國男性平均身高（1996 年出生）排名」。
    - **19 歲的身高另外一組指標，時間軸是量測的年份**：是較新的另一次估計（用了更多 2010 年代的調查），跟成人身高同一批人（例如 1996 年出生的人 2015 年 19 歲）的數字不一樣：200 國的差（2015 年 19 歲 − 1996 年出生的成人）中位數男性 +1.1、女性 +1.0 公分，男性從保加利亞 −4.8 到波多黎各 +6.6 公分，台灣男性 −1.8、女性 −1.3 公分。所以沒有換算成出生年接在成人身高後面，也沒有放在同一張圖；指標說明與側欄都寫了「兩者不能直接相減」。換指標時年份回到預設（成人 1996、19 歲 2019），側欄只列同一種年份的數值卡片。
    - **指標與門檻**：男女各一組門檻，每 4 公分一級，男性 156、160、164、168、172、176，女性 144、148、152、156、160、164（男性高 12 公分，約是世界平均的男女差距；1996 年出生世界平均男女差 11.9 公分）。同一組門檻的話女性的地圖大多落在淺的那幾級，看不出國家之間的差異；各一組時兩張地圖的深淺對得起來。1896 年出生的男性大多在 156–168、1996 年出生的大多在 164–180 公分，一百年的變化在同一組門檻裡看得出來。19 歲的身高用同一組。比 1896 年長高用發散色 ±2、6、12 公分（±2 公分以內算幾乎沒變，例如巴基斯坦男性 +1.3、南非 +1.4、馬紹爾群島 +0.5）；只有吉里巴斯男性 1906–1920 年代出生的是負的（−0.2 公分），負的那一半幾乎用不到，但照請求用發散色，中性灰剛好是「沒有長高」。男女身高差距 8、10、11、12、13、14 公分（`unranked`）。身高、變化、差距都存 0.1 公分（畫面上也是），變化與差距用四捨五入後的身高相減，畫面上的數字才對得起來（南韓女性 +20.1 公分；論文寫 20.2，是用沒有四捨五入的值）。
    - **世界平均**：成人身高的檔沒有全球值（OWID 的圖也只有世界銀行的區域），用 WPP 2024 那一年出生的人 18 歲那年（1932 年以前出生的用 1950 年）15–19 歲的男女人口加權 200 國。同樣的算法套在 19 歲的身高上，跟 NCD-RisC 自己公布的全球值 1985–2019 年每年都在 0.14 公分以內（`check_weighting()`，差超過 0.3 公分就報錯）。世界平均 1970 年代出生以後大致持平（男性 1970 年 169.0、1996 年 168.7 公分）：各國多半還在長高，但人口成長集中在身高較矮的南亞與非洲；用 1950 年的人口當固定權重，1960 → 1996 年出生的男性多 1.7 公分（169.3 → 171.0）。側欄的圖下面有寫。
    - **台灣**（`taiwan.json`、指標檔的附註）：1996 年出生的男性 174.5 公分（95% 不確定區間 172.6–176.4，200 國第 56）、女性 161.5 公分（159.6–163.3，第 67），比 1896 年出生的高 13.2、12.1 公分（第 16、31），男女差 13.0 公分；2019 年 19 歲男性 173.5、女性 160.7 公分。國健署國民營養健康狀況變遷調查（2013–2016、2017–2020 年成果報告的表 3.5.1，實際量的身高，`nahsit.KNOWN`）：
      - 2017–2020 年 16–18 歲男性 171.9、女性 160.4 公分；NCD-RisC 2020 年的估計在同一段時間（2017–2019 年）16–18 歲的平均是 173.2、160.3 公分（同年齡、同時間，最可以直接比：女性一樣，男性高 1.3 公分）。2013–2016 年 170.8、158.6 對 172.3、159.7。
      - 2017–2020 年 19–44 歲（約 1973–2001 年出生）男性 172.0（標準誤 0.39）、女性 159.5 公分；成人身高 1973–1996 年出生的平均是 172.7、160.1 公分。45–64 歲 168.2、156.5 對 169.3、157.7；65–74 歲 164.3、152.8 對 167.0、155.9。
      - 差在定義：調查是同一段時間量不同年齡的人，量到的是現在的身高；NCD-RisC 是同一年出生的人在 18 歲時的身高。年紀越大的組差得越多（65–74 歲差 2.7–3.3 公分），老了會變矮是一部分原因（模型估計的變矮比這小，其餘是模型與抽樣的差別），附註與側欄寫明。
      - 成果報告的 PDF 讀不出中文（字型沒有 Unicode 對照），數字讀得出來，照表抄進 `nahsit.KNOWN`；65–74 歲的列寫「2 702」，2 是註腳標號，樣本數是 702（四個年齡組加起來等於 19 歲以上的 2,253、2,257 人）。新聞報導的「18 歲男性 172.1 公分」（中央社 2024-06-11）不是表 3.5.1 的年齡組，沒有用。
    - **沒有值的**：南蘇丹、科索沃（NCD-RisC 沒有單獨估計，`noValue`），以及 NCD-RisC 沒有收的屬地與小國（澳門、列支敦斯登、摩納哥、聖馬利諾、梵蒂岡、關島等 52 個地圖單位）。
    - **側欄**（`HeightPanel.tsx`）：男女的平均身高依出生年一張、19 歲一張（男藍女橘，虛線是世界平均，圖例也畫成虛線），上面寫選定那一年的值與 95% 不確定區間、男女差距、比 1896 年長高多少、世界平均；時間軸是 19 歲的年份時，成人那張寫 1996 年出生，反過來也一樣。不確定區間在 `countries/<ISO3>.json`（點國家才載入，差分編碼，成人與 19 歲的序列長度不同，各自對齊 `cohorts`、`years` 的起訖年）。通用側欄的折線圖與這兩張圖的 y 軸都不從 0 開始（`chartZoom`）。
    - **大小**：7 個指標檔加 `taiwan.json`、`manifest.json` 共 269 KB，`countries/` 200 個檔共 276 KB（每個約 1.4 KB），整個主題 0.55 MB，沒有網格圖磚。

72. **稅率**（`pipeline/topics/taxes.py`、`pipeline/sources/oecd_tax.py`、`tw_tax_law.py`、`src/topics/taxes.ts`、`src/topics/panels/TaxesPanel.tsx`）：
    - **只放法定稅率**：實際收到多少稅（稅收占 GDP）已經在「物價與財政」主題（第 32 點），這裡不重複；頁尾的說明寫明兩者的關係。
    - **來源的選擇**（先看授權）：
      - 公司稅用 **OECD Corporate Tax Statistics**（SDMX `OECD.CTP.TPS,DSD_TAX_CIT@DF_CIT`，`MEASURE=CIT_C`、`TARGETING=ST`、`SECTOR=S13`：中央加地方的法定稅率），146 個轄區、2000–2026 年。**沒有台灣**，也沒有俄羅斯、伊朗等沒有參加的國家（`coverage` 寫「OECD 的資料沒有收」）。2026 年土耳其、以色列、哥倫比亞還沒有值，所以 2026 年沒有 OECD 平均。
      - 個人所得稅最高稅率與起徵點用 **OECD Tax Database 表 I.7**（SDMX `DSD_TAX_PIT@DF_PIT_TOP_EARN_THRESH`，`TS_PIT` 是各級政府合計的最高稅率、`TS_PIT_TH` 的 `FCTR_WG_A_SAL_A` 是起徵點等於平均薪資的幾倍），OECD 38 國、2000–2025 年。起徵點以薪資總額計，已經加回各國標準的免稅額與扣除額：英國 2024 年 2.378 × 平均年薪 52,615 英鎊 = 125,140 英鎊（就是 45% 一級的起點），德國 4.637 × 63,528 歐元 ≈ 29.5 萬歐元（應稅所得 277,826 歐元加上扣除額）。
      - 勞動稅負用 **OECD Taxing Wages**（SDMX `DSD_TAX_WAGES_COMP@DF_TW_COMP`，`AV_TW`、`PT_COS_LB`、單身沒有小孩 `S_C0`、平均薪資 `AW100`），OECD 38 國、2000–2025 年；OECD 平均用 OECD 公布的 `OECD_REP`，pipeline 檢查跟自己算的 38 國平均差不到 0.1 個百分點。
      - 加值型營業稅：OECD 的 SDMX 沒有 VAT 的資料流（2026-10 查全部的 dataflow），OECD Tax Database 的 VAT 表（`vat-gst-rates-ctt-trends.xlsx`，2024 年 6 月版）是 2024 年 7 月以前的，照第 12 點不用。改用 **《Consumption Tax Trends 2024》附錄表 2.A.1**（2024 年 11 月出版，CC BY 4.0）：OECD 會員國 2005、2008、2011、2014、2017、2020–2024 年 1 月 1 日的標準稅率。PDF 程式讀不了（`pdfreader.py` 不支援這份 PDF 的格式），表抄在 `oecd_tax.VAT_CTT_2024`；抄的時候用 pypdf 讀文字、程式轉成表，再跟上面那個 Excel 重疊的年份逐一比對，只有盧森堡、土耳其 2023 年不同（Excel 的 2023 年是 9 月 1 日的稅率：盧森堡 2023 年全年暫時降為 16%、土耳其 7 月調為 20%）。美國沒有全國性的 VAT，`noValue` 寫原因；哥斯大黎加 2019 年才有 VAT，OECD 平均的分母 2020 年起才算它。算出來的 OECD 平均跟書上的一樣（2005 年 17.8%、2024 年 19.3%）。
      - VAT 的 2025、2026 年：書只到 2024 年。OECD《Tax Policy Reforms 2025》《Tax Policy Reforms 2026》（CC BY 4.0，涵蓋全部 OECD 會員國）寫了這兩年的標準稅率調整：芬蘭 2024 年 9 月 24% → 25.5%、以色列 2025 年 1 月 17% → 18%、斯洛伐克 2025 年 1 月 20% → 23%、愛沙尼亞 2026 年 1 月 22% → 24%（2025 年版寫原本預定 2025 年 7 月，2026 年版寫 2026 年 1 月）；表 3.10 的標準稅率欄另外只列了瑞士、盧森堡（2024 年 1 月的調整，書上的 2024 年已經有）與不是會員國的印尼、新加坡、羅馬尼亞，其他會員國沒有調整，所以 2025、2026 年 = 2024 年加上這幾個調整（`oecd_tax.VAT_CHANGES`），各國附註寫出來。oecd.org 的網頁擋程式（HTTP 403），兩本的 PDF 讀的是第三方網站轉存的檔，只拿來確認這幾個事實。
    - **OECD 以外的國家留灰色**（個人所得稅、起徵點、VAT、勞動稅負，`coverage` 寫「OECD 以外沒有開放資料」）：
      - PwC、KPMG、EY 的稅務摘要是商業內容，沒有用。
      - **Tax Foundation 是 CC BY-NC 4.0**：網站的 Copyright Notice（https://taxfoundation.org/copyright-notice/ ，2026-10-26 查）寫「licensed under a Creative Commons Attribution NonCommercial 4.0 International License」，只能非商業使用；它的各國公司稅率也是整理自 OECD 與會計師事務所的摘要，沒有用。
      - 英文維基百科「Value-added tax」「Tax rates around the world」的表是 CC BY-SA 4.0，但大部分列沒有出處、有出處的多半引用 PwC 的摘要，也有過時的數字（例如巴哈馬寫 12%），照較保守的做法沒有用。
      - 歐盟執委會的 Taxation Trends 資料（可以補保加利亞、克羅埃西亞、賽普勒斯、馬爾他、羅馬尼亞 5 個非 OECD 的歐盟國家）下載頁只有稅收的 Excel（NTL、country profiles），沒有法定稅率的表，沒有補。
      - 世界銀行、IMF 的開放資料是稅收（IMF 的 WoRLD 已經用在「物價與財政」），沒有逐國的法定稅率表。
    - **OECD 的表裡兩個不可能的值當成缺值**（`oecd_tax.top_income_tax()`）：拉脫維亞 2025 年的最高稅率與起徵點都是 0（拉脫維亞是累進稅率）、法國 2013 年的最高稅率是 122.8%（前後兩年都是 54.5% 左右）；附註寫明。
    - **OECD 平均**：38 個會員國的簡單平均（OECD 公布的也是簡單平均），當年有值的會員國不到 95% 就不算（`MIN_MEMBERS`）；拉脫維亞 2025 年、法國 2013 年少一國照算。起徵點的倍數差很多（哥倫比亞 51.5 倍、匈牙利單一稅率 0），平均被少數國家拉高（2025 年平均 6.6、中位數 3.0），改用中位數（`aggregates.OECD_MEDIAN`）。
    - **台灣**（都不在 OECD 的資料裡，`tw_tax_law.py`）：
      - 營利事業所得稅：所得稅法第 5 條的歷次條文（全國法規資料庫的歷史條文，`LawOldVer.aspx?pcode=G0340003&lnndate=…`）：2009 年 5 月修正前 25%；2009-05-27 修正為 20%、自 99 年度施行，但 2010-06-15 再修正為 17%、同樣自 99 年度施行，所以 2010 年起是 17%；2018-02-07 修正為 20%、自 107 年度施行。台灣沒有地方的營所稅，中央就是合計；未分配盈餘加徵（2018 年起 5%、之前 10%）不算在法定稅率裡，附註寫明。
      - 綜合所得稅的級距：1999–2009 年（88–98 年度）用財政部財政資訊中心《綜合所得稅申報核定統計專冊》各年度說明頁的稅率表（88–96 年度 370／990／1,980／3,720 千元，97–98 年度 410／1,090／2,180／4,090 千元，都是 6%、13%、21%、30%、40%）；2010–2021 年用同一份專冊的表 6-2（依稅率級距分列，萬元：99–101 年度 50／113／226／423、102–105 年度 52／117／235／440（104 年度起加 1,000 萬元以上 45%）、106 年度 54／121／242／453／1,031、107–110 年度 54／121／242／453），105 年度起跟臺北國稅局「適用稅率」頁的速算公式對照過；2022–2026 年用賦稅署每年度的公告附表（111–112 年度 56／126／252／472、113–114 年度 59／133／266／498、115 年度 61／138／277／519 萬元）。法律條文寫的是基準金額（例如 2009 年修正的 409 萬元），實際適用的是財政部依物價調整後公告的，所以用專冊與公告的數字。
      - 最高稅率：40%；2015–2017 年綜合所得淨額超過 1,000 萬元（2017 年 1,031 萬元）的部分 45%（2014-06-04 修正、自 104 年度施行，2018 年取消）。OECD 的 PIT 到 2025 年，台灣也放 2000–2025 年。
      - 起徵點的倍數：最高一級的起點（綜合所得淨額）加上本人免稅額、單身的標準扣除額、薪資所得特別扣除額（`tw_tax_law.gross_threshold()`，單身、只有薪資，跟 OECD 的定義一樣以薪資總額計），除以主計總處工業及服務業受僱員工的每人每月總薪資 × 12（`dgbas_wages.monthly_earnings()`，含部分工時；OECD 的平均薪資只算全時，所以台灣的平均略低、倍數略高）。2025 年：4,980,000 + 97,000 + 131,000 + 218,000 = 5,426,000 元 ÷ 760,596 元 = 7.1 倍（日本 7.7、美國 8.7、OECD 中位數 3.0）；2015–2017 年 45% 一級約 17.5 倍。
      - 免稅額、標準扣除額、薪資所得特別扣除額：1999–2009 年用專冊的說明頁；標準扣除額 2010–2023 年也寫在專冊的說明頁（76／79／90／120／124 千元）；薪資所得特別扣除額 2015 年 12.8 萬、2018 年 20 萬是所得稅法第 17 條的條文金額；2018–2021 年的免稅額 8.8 萬是 111 年度公告寫的「由 8.8 萬元提高至 9.2 萬元」；2022–2026 年是公告附表。**2010–2017 年的免稅額、2010–2014 年的薪資所得特別扣除額沒有找到官方的逐年數字**（賦稅署與財政部網站的新聞稿只留 111 年度起，專冊的說明頁 99 年度起不再寫這兩項），沿用 2009 年的 8.2 萬、10.4 萬（`ASSUMED`）；實際可能因物價調整多幾千元，倍數只差不到 0.1%，側欄寫明。
      - 加值型營業稅：加值型及非加值型營業稅法第 10 條（5–10%，由行政院定之），1986 年 4 月實施起一直是 5%。
      - 勞動稅負：OECD 沒有算台灣。自己用勞保、健保、勞退的費率算，口徑不一定跟 OECD 一樣（例如勞退新制是提撥到個人帳戶，OECD 對這類強制提撥另外歸成 non-tax compulsory payments，不一定算在 tax wedge），留灰色，`noValue` 寫原因。
    - **分級門檻**（橘色循序色，所有年份共用）：公司稅 5、10、15、20、25、30%（0% 的避稅天堂、9% 的匈牙利與阿聯、12.5% 的愛爾蘭、17% 的新加坡、20% 的台灣、25% 的中國與英國、30% 以上的德國、法國、巴西各在不同級）；最高所得稅率 20、30、40、45、50、55%；起徵點 1.5、2、3、5、10、20 倍（`unranked`，數值沒有好壞）；VAT 8、12、16、20、22、25%；勞動稅負 15、25、30、35、40、45%。
    - **位數**：稅率存三位小數（存兩位時日本 55.945% 變成 55.95%，顯示時四捨五入成 56%，OECD 的表是 55.9%），畫面上整數不留小數（20%）、其他留一位（25.6%）。
    - **指標名稱**：五個指標是按鈕列（`MAX_SEGMENTS` 是 5），名稱取短的（營所稅、所得稅最高稅率、最高稅率起徵點、營業稅（VAT）、勞動稅負；英文 Corporate tax、Top income tax、Top rate threshold、VAT、Tax wedge），中文、英文 1280px 寬時控制列都是一行；全名寫在指標說明裡。
    - **側欄**（`TaxesPanel.tsx`）：選定那一年各項稅率跟 OECD 平均（起徵點是中位數）的表、營所稅、最高所得稅率、VAT、勞動稅負各一張歷年折線（虛線是 OECD 平均；VAT 只有部分年份，畫出每個點）；台灣另外列那一年度的綜合所得稅級距、起徵點的換算（淨額 + 免稅額 + 扣除額 = 薪資收入 ÷ 平均年薪）與稅率的變化（`taiwan.json`）。
    - **大小**：5 個指標檔加 `taiwan.json`、`manifest.json` 共約 50 KB，沒有網格圖磚。
73. **政府治理**（`pipeline/topics/governance.py`、`pipeline/sources/wgi.py`、`src/topics/governance.ts`、`src/topics/panels/GovernancePanel.tsx`）：
    - **資料**：WGI 2026 年版（2026-09-25 更新，1996–2025 年），World Bank API 的 source 3，跟治安與司法的法治分數用同一個 `wgi.fetch()`。每個面向 6 個序列：0–100 的分數 `.SC`、90% 信賴區間 `.SC_LB`、`.SC_UB`、估計值 `.EST`、估計值的標準誤 `.SE`、資料來源數 `.SR`（36 次查詢、共約 52 MB）。WGI 網站的整包 Excel（`wgidataset_with_sourcedata-2026.xlsx`）跟 API 逐筆比對，六個面向的這幾欄全部一樣（差異只有 1e-14 的浮點誤差）；Excel 多了已經不存在的荷屬安地列斯，`wgi.py` 本來就不收。
    - **地圖用分數，不是百分位排名**：原本要地圖預設用百分位排名（0–100）。WGI 2025 年改版（Methodology Revision）後只發布兩種結果：估計值（標準常態的單位，約 −2.5 到 2.5）與 0–100 的治理分數（以假想的「每個來源都最好」「每個來源都最差」的國家定錨的線性轉換：100 ×（估計值 − 最差）÷（最好 − 最差），各面向、各年份分別定錨），**不再有百分位排名**；World Bank API 裡的 `RL.PER.RNK` 等序列移到「WDI Database Archives」（source 57），是改版前的方法。自己依估計值排出來的百分位不是官方的數字，所以照保守的做法，地圖用官方的分數（跟治安與司法的法治分數一樣），名次寫在側欄的數值卡片（「第 19 / 213 名」），沒有自己算百分位。**要改成百分位請使用者決定**：在 pipeline 依當年各經濟體的估計值排序就能算（舊版的定義是 0 最低、100 最高），說明要寫明是自己算的。
    - **分數是絕對的**：跟百分位不同，各年的分布不固定（政府效能的世界中位數 1996 年 45.9、2025 年 54.5），時間軸看得出整體的變化，固定門檻也有意義。
    - **門檻**：六個面向共用 [35, 45, 55, 65, 75, 85]（橘色循序色），跟治安與司法的法治分數一樣。2025 年各面向的中位數：發聲與課責 57.7、政治穩定 68.6、政府效能 54.5、法規品質 54.2、法治 57.9、貪腐控制 44.9；最低 5.8（南蘇丹的貪腐控制）、最高 95.2（新加坡的政府效能）。各面向分開設門檻可以把七級用滿，但同一個顏色在不同面向的意思就不同，所以共用。
    - **法治**：數值跟 `topics/crime/rule-of-law.json` 完全一樣（同一個序列、同樣取一位小數），兩個主題各一份檔（指標檔只能讀自己主題的資料夾，一份約 20 KB），這裡的多了世界中位數。治安與司法主題照舊保留它，兩邊的說明互相指到對方。
    - **跟民主與自由的關係**：V-Dem 是 WGI 的 35 個來源之一（Excel 的「VDM mean」），主要進發聲與課責；WGI 另外綜合了 Freedom House、Gallup World Poll、EIU、各區域的民調等，兩者相關但不能換算，頁尾的說明寫明。民主與自由主題的說明也加了一句指到這裡。
    - **世界中位數**：當年有資料的經濟體的中位數（每個經濟體一樣重，不依人口加權），放在指標檔的 `aggregates.MEDIAN`。沒有用 `WLD`：前端把 `WLD` 叫「世界」（側欄折線圖的對照線、CSV 的最後一列），通常是合計或平均；中位數只在主題側欄用，寫明「世界中位數」。
    - **側欄的明細**：每個經濟體一個 `countries/<ISO3>.json`（215 個檔，共 637 KB，一個約 3 KB、gzip 後約 1 KB），鍵是「面向.欄位」（`voice.lb`、`voice.est`…），用指標檔同一種差分編碼（`compact_indicator()`），`fetchJson()` 會還原。信賴區間不能用分數 ± 1.645 × 標準誤算：分數接近 0 時 WGI 把區間截在 0、另一端也不對稱（例如阿富汗 1996 年的政府效能 3.4，區間 0–18.9），所以直接存 WGI 的上下限。
    - **側欄**（`GovernancePanel.tsx`）：
      - 「六個面向」：選定那一年（沒有資料就往前找最近一年）每個面向一列，0–100 的軸上畫分數（點）、90% 信賴區間（色帶）與世界中位數（短線），下面一張表是估計值 ± 標準誤與資料來源數。點圖用 HTML（百分比的 `position: absolute`），字跟軸都是一般的文字，不用圖表元件。
      - 「歷年變化」：六張小圖（兩欄，375px 的手機上也是兩欄），國家的分數、信賴區間色帶、世界中位數（虛線），y 軸固定 0–100，各國、各面向可以直接比。x 軸是數值軸（年份），1996、1998、2000 年的兩年間隔畫得比一年寬；WGI 有的年份裡這個國家沒有值的放 null，線在那裡斷開（法屬玻里尼西亞、新喀里多尼亞只有 5–7 年）；信賴區間是色帶（`spec.ts` 的 `band`：上下限之間填淡色，任一端缺值的地方斷開；2026-10-29 以前在 ECharts 裡用兩條堆疊的線模擬）。
      - 色帶的不透明度：淺色 0.22、深色 0.42（深色背景上 0.22 幾乎看不見）。
      - 考慮過雷達圖：六個面向沒有先後，雷達圖的面積會因為哪兩個面向相鄰而不同，信賴區間也不好畫，所以用同一把尺的點圖加小圖。
    - **台灣**（WGI 本身就有，「Taiwan, China」依名稱對照，第 43 點）：2025 年發聲與課責 76.9（71.9–81.9）、政治穩定 83.1（76.4–89.8）、政府效能 83.3（75.8–90.7）、法規品質 76.1（70.1–82.0）、法治 78.4（73.5–83.3）、貪腐控制 71.9（65.9–77.9）；估計值 +1.05、+1.00、+1.51、+1.20、+1.20、+1.18，資料來源 8–13 個；名次 37/208、46/215、19/213、23/213、31/215、29/215。跟 WGI 網站的 Excel 一致。1996 年起六個面向都在世界中位數之上；政府效能從 1996 年的 72.0 升到 2020 年的 85.1。
    - **涵蓋**：215 個經濟體（1996 年依面向 184–201 個）；2025 年政治穩定、法治、貪腐控制 215 個，政府效能、法規品質 213 個，發聲與課責 208 個（安圭拉、美屬薩摩亞、百慕達、關島、馬丁尼克、留尼旺、美屬維京群島沒有）。沒有資料的是灰色。
    - **用語**：WGI 的 Usage Advisory 說明它是看法的綜合、不是世界銀行對各國政府的官方評等，指標說明的結尾寫「是看法的綜合，不是官方評等」。中文名稱取短的（發聲與課責、政治穩定、政府效能、法規品質、法治、貪腐控制），「政治穩定」的全名（政治穩定與沒有暴力、恐怖主義）寫在說明裡。6 個指標用下拉選單，中文 1024、1280px 與英文 1280px 都是一行。
    - **大小**：6 個指標檔與 manifest 共 123 KB（gzip 後 47 KB）、215 個側欄明細 637 KB（gzip 後 212 KB），共約 760 KB；沒有網格圖磚。


74. **國際援助與僑匯**（`pipeline/topics/aid.py`、`pipeline/sources/oecd_dac.py`、`src/topics/aid.ts`、`src/topics/panels/AidPanel.tsx`）：
    - **來源的選擇**：政府開發援助（ODA）用 OECD DAC 的統計，OECD Data Explorer 的 SDMX API（版本留空 = 最新版）：DAC1（各援助國的總額、占 GNI 與組成）與 DAC2A（援助國 × 受援國的撥付，含多邊機構）。都用不含標籤的 CSV（`format=csvfile`），3 個檔共約 75 MB，約 20 秒。授權見第 12 點（OECD 的資料條款，效果跟 CC BY 4.0 相同）。
      - CRS（逐筆的計畫）每年有幾十萬筆，DAC2A 已經是依援助國、受援國彙總的撥付，流向圖用 DAC2A 就夠了，沒有用 CRS。
      - WDI 也轉載 DAC 的受援國數字（`DT.ODA.ODAT.CD` 等），但直接用 DAC2A，受援國的總額、占 GNI、人均跟流向是同一個來源。
    - **援助國的口徑**：OECD 公布的 ODA 在 2017 年以前是淨撥付（DAC1 的 MEASURE 1010、FLOW_TYPE 1140），2018 年起是「贈與等值」（11010、1160；貸款只算贈與的成分），兩段照 OECD 的做法接起來，指標檔的 `methodBreak` 是 2018，側欄的折線圖畫垂直虛線。占 GNI 一樣（MEASURE 2 → 11002）。
      - 2025 年是 2026 年 4 月公布的初步數字（DAC1 有、DAC2A 還沒有）：美國 2025 年 290 億美元，比 2024 年的 655 億少一半以上，德國 291 億變成第一。**沒有用 `projectionFrom`**：前端會把那一年寫成「推估值」，初步數字不是推估，所以寫在指標說明與頁尾。
      - 世界合計（`WLD`，算「占全球」）是 DAC 國家加上向 OECD 申報的其他國家（`DAC` + `WXDAC`），不含歐盟機構（它的錢來自會員國，會員國的 ODA 已經算過）；沒有向 OECD 申報的國家（中國大陸、印度、巴西、俄羅斯…）不在裡面。占 GNI 的對照是 `aggregates.DAC`（DAC 國家合計的比例），側欄畫成「DAC 合計」，不叫「世界」。
      - 門檻 [0.1, 0.2, 0.3, 0.5, 0.7, 1]：聯合國 1970 年決議的 0.7% 是一個門檻，最深的兩級就是達標的國家（2024 年挪威 1.02%、盧森堡 1.00%、瑞典 0.79%、丹麥 0.72%）。
    - **受援國**：DAC2A 的 ALLD（Official donors：雙邊加多邊，不含民間基金會）給的淨撥付（206）、占受援國 GNI（286）、人均（296）。淨撥付扣掉償還的本金，會是負的（中國大陸 2011–2024 年、越南 2024 年…），比例圓不畫、排名表排在最後，附註寫出負的年份。
      - 太平洋島國人口少，每人收到的援助特別多：馬紹爾群島 2024 年每人 18,690 美元、占 GNI 214%：7.1 億美元裡 6.5 億來自美國（2023 年美國只有 0.8 億），是 OECD 的數字。
    - **流向**（`flows/<年>.json`，1960–2024 年各一個檔，跟貿易、移民同一種格式）：
      - export：援助國（國家）→ 受援國（國家）的淨撥付，前 15 名，只收正的；總額是援助國給 DPGC（Developing countries，含沒有分到特定國家的「unspecified」）的雙邊 ODA。`unspecified` 是總額減掉給所有國家的合計：區域或全球的計畫、在捐助國境內的難民支出、行政費用等，美國 2024 年 40%、德國 58%。
      - import：受援國從各國收到的援助，前 15 名；總額是 ALLD（含多邊），所以國家加起來不到 100%。`multilateral` 另外放多邊機構的前 10 名與多邊合計（ALLM）。
      - 數值存成千美元的整數（`scale: 1000`）。
    - **多邊機構怎麼呈現**：機構沒有國家的形狀，畫到總部所在國（華盛頓、布魯塞爾）會被看成那個國家給的，所以**弧線只畫國家之間的雙邊援助**，多邊機構只在側欄：
      - 受援國的「主要援助來源」把國家（藍色）與多邊機構（紫色）合在一起排，例如衣索比亞 2024 年收到 78.1 億美元，國際開發協會（世界銀行）30.0 億、美國 14.0 億、國際貨幣基金 13.6 億；烏克蘭 356 億裡 190 億來自歐盟機構。
      - 援助國的「雙邊與多邊」列出給國際組織的核心捐款（DAC1 的 2101–2108：聯合國機構、歐盟機構、國際開發協會、世界銀行其他機構、區域開發銀行、其他）與在捐助國境內的難民支出（1820，雙邊的一部分）。最新一年的初步數字還沒有細分，差額列成「多邊（沒有細分）」。
      - 機構的代碼與中文名稱在 `aid.py` 的 `AGENCIES`（同一個機構只取一層：歐盟機構、國際貨幣基金、非洲、亞洲、美洲開發銀行用整個集團，世界銀行、聯合國、其他區域開發銀行與其他多邊組織用個別機構），輸出成 `agencies.json`。DAC2A 新增沒有中文名稱的機構時，pipeline 會印出代碼。
      - 1970 年代有少數年份各機構加起來比多邊合計（ALLM）多（例如 1977 年肯亞 45.5 對 39.5 百萬美元：「Other Multilaterals」9OTH999 沒有算進 9OTH0），是 OECD 原始資料的不一致；1990 年起都對得上。側欄的合計用 ALLM。
      - 歐盟機構也是援助者（DAC1 有它的總額），但不是國家，不在地圖與排名表。
    - **台灣**：
      - 援助國：台灣不是 DAC 會員，但向 OECD 申報援助，DAC1、DAC2A 都有（「Chinese Taipei」，定義跟 DAC 會員相同；OECD 的 Development Co-operation Profiles 也有台灣的一章）。ODA 1988–1998、2004–2025 年，占 GNI 2005–2025 年。2024 年 4.03 億美元、占 GNI 0.05%（48 國第 45）；2025 年初步數字 4.46 億、0.05%。
      - 台灣申報的雙邊援助大多沒有分到國家：2024 年給開發中國家的雙邊援助 3.92 億美元，92%（3.63 億）沒有分到特定國家；分到的以帛琉 483 萬、貝里斯 407 萬、瓜地馬拉 378 萬、巴拉圭 329 萬美元最多。2004–2022 年幾乎都沒有國別，流向圖只有 1988–1998、2023–2024 年畫得出比較多條弧線。DAC1 只有台灣的總額，沒有多邊的細項，所以側欄不列「雙邊與多邊」。
      - 外交部、國合會的網站沒有找到開放授權、逐年的 ODA 統計表；OECD 的就是台灣自己申報、跟其他國家同一個定義的數字，所以直接用 OECD，沒有另外轉載外交部的數字。
      - 受援國：1960–1996 年在 OECD 的資料裡，1960 年收到 1.03 億美元，1960–1965 年幾乎全部是美國的援助（美援 1965 年結束）；1997 年起沒有資料，數值卡片寫「1997 年起沒有資料」（指標的 `noValue`）。
      - 僑匯：WDI 沒有台灣，用中央銀行國際收支（BPP2Y01）的「二次所得－其他部門－個人移轉」加「初次所得－薪資」（WDI 的 personal remittances 就是這兩項），收入 1984 年起、支出 1991 年起（之前個人移轉的支出是「-」）。2025 年收入 56.6 億美元（個人移轉 43.2 億、薪資 13.4 億）、支出 133.2 億（個人移轉 126.2 億、薪資 7.0 億），大多是在台移工匯回母國的錢；占 GDP 0.61%（GDP 用主計總處的名目 GDP ÷ 央行年平均匯率，`reserves.py` 的 `taiwan_gdp_usd()`）。2024 年收入 57.0 億（164 國第 36）、占 GDP 0.71%（163 國第 116）、支出 111.7 億（167 國第 18）。WDI 的世界合計沒有加上台灣。
    - **僑匯**：WDI 的個人匯款（世界銀行依 IMF 國際收支統計的估計，1976 年起有三成以上國家），只計正式管道。有些高所得國家的「收入」多半是跨境通勤者的薪資（法國 2024 年 407 億美元、世界第 3；德國、比利時也是），說明裡寫明。世界的收入（8,704 億）跟支出（6,248 億）對不起來，是各國申報的落差。
    - **雙邊的僑匯流向沒有做**：沒有開放授權的資料（第 12 點）；考慮過照 KNOMAD 的方法（Ratha & Shaw 2007：依移民存量與兩邊的所得分配各國的收入總額）自己推估，但那是模型、不是資料，沒有做。說明裡指到移民主題的「僑民去向」（僑匯大致跟著移民走）。
    - **跟其他主題**：移民與難民的頁尾指到這裡的僑匯，這裡指到它的僑民去向（第 26 點）。
    - **涵蓋**：援助國 50 個（DAC 會員國與向 OECD 申報的其他國家；2024 年 49 個有金額、48 個有占 GNI），其他國家寫「沒有向 OECD 申報援助」（指標的 `coverage`）。受援國 179 個（1960 年以來在 DAC2A 裡有收到 ODA 的），2024 年 141 個（占 GNI 122 個），其他寫「不在 OECD 的受援國名單上」。僑匯 2024 年收入 164 國、占 GDP 163 國、支出 167 國（都含台灣）。
    - **大小**：8 個指標檔、agencies 與 manifest 共 376 KB（gzip 後 139 KB），65 個流向檔 2.9 MB（gzip 後 839 KB；一年約 45 KB、gzip 後 13 KB，選了國家才載入那一年），50 個援助國明細 172 KB（gzip 後 52 KB），共約 3.5 MB（gzip 後 1.0 MB）；沒有網格圖磚。
75. **便利商店與連鎖品牌**（`pipeline/topics/chain_stores.py`、`pipeline/sources/osm.py`、`pipeline/sources/chain_official.py`、`src/topics/chain-stores.ts`、`src/topics/panels/ChainStoresPanel.tsx`）：
    - **來源的選擇**：各國的連鎖店數沒有開放授權、逐國的官方統計；能轉載的店家位置只有 OpenStreetMap（ODbL）。AllThePlaces（爬各公司官網的店家位置，輸出 CC0）是從公司網站複製的資料，沒有用；PwC 這類商業整理也沒有。公司自己公布的店數只拿來比對涵蓋率（第 12 點）。
    - **品牌怎麼認**（`classify()`）：
      - `brand:wikidata`（name-suggestion-index 的標法）。每個 QID 都用 Wikidata API 查過標籤：7-Eleven Q259340；FamilyMart Q11247682（品牌）、Q1191685（日本的公司，見下面）、famima!! Q115868189 與台灣全家 Q10891564；Lawson Q1557223 加子品牌 Natural Lawson Q11323850、Lawson Store 100 Q11350960、Lawson+3F Q24866804、Lawson+Poplar Q116957010、Lawson+toks Q115868119、泰國的 Lawson 108 Q125869566；McDonald's Q38076 與 NSI 給烏克蘭的 Q4043856；Starbucks Q37158 與 Starbucks Reserve Q71150001；KFC Q524757；Subway Q244457；IKEA Q54078；Costco Q715583。McCafé（Q3114287）是另一個品牌，不算麥當勞。
      - 沒有 `brand:wikidata` 的店：`name` 或 `brand` 以品牌名稱開頭（不分大小寫，列了中、日、韓、泰文的寫法），而且店型對才算。全家的「全家」後面不能接「福」（大陸有叫「全家福」的小店）。韓國的「훼미리마트」2012 年改名 CU，沒有列。
      - 名稱比對有同名的獨立小店：「Family Mart」在美國、加拿大、迦納、比利時，「Lawson's」在美國（俄亥俄州的舊連鎖），「Costco Storez」在賴索托、「Costco Supermarket」在烏干達。所以全家、Lawson、Costco 依名稱認的店只算品牌有開店的國家（`name_countries`），有 `brand:wikidata` 的照算；IKEA 依名稱比對的 45 家多半是同名的家具行（智利的「Ikean」、伊拉克的「IKEA WOOD」），IKEA 只認 `brand:wikidata`。依名稱認的共 1.3 萬家（7-Eleven 5,754、全家 2,116、Lawson 2,111、麥當勞 784、肯德基 719、星巴克 703、Subway 373、Costco 22），日本、南韓、泰國最多。
      - 日本有 5,769 家全家標的是公司的 QID（Q1191685，株式会社ファミリーマート，Wikidata 的說明是「Japanese retail chain company」），name-suggestion-index 沒有列；確定是 FamilyMart 的店，加進 QID（日本的涵蓋率從 46% 變 77%）。其他品牌也查過用了別的 QID、名稱又是這個品牌的物件，都只有個位數。
      - 店型：便利商店品牌是 `shop=convenience`；只標成加油站（`amenity=fuel`）的 7-Eleven 在 150 公尺內沒有同品牌的便利商店時才算一家（美國很多 7-Eleven 加油站只標了加油站）；麥當勞、肯德基、Subway 是 `amenity=fast_food` 或 `restaurant`；星巴克是 `amenity=cafe`；IKEA 是 `shop=furniture`，名稱有規劃訂購點、取貨點、快閃店、設計工作室的不算（各國語言的寫法都列了）；Costco 是 `shop=wholesale`（或 supermarket、department_store），加油站、藥局、輪胎中心、美食區、眼鏡行不算。品牌對、店型不對的（7-Eleven 的停車場、IKEA 的餐廳、只有建築物外框沒有店型的）都不算。
      - 同一家店標了兩次（建築物外框一個、店的點一個）：同一個品牌 25 公尺內的點當成一家，留點的位置；IKEA、Costco 的賣場有幾百公尺長，用 400 公尺。
    - **已經退出的國家**（`EXITED`）：麥當勞（2022）、星巴克（2022）、肯德基（2023）退出俄羅斯，IKEA（2022）退出俄羅斯與白俄羅斯，OSM 上還留著的舊標示不算，數值是 0，附註與 tooltip 寫出原因與沒算的點數。改名後的接手品牌（Rostic's、Ростикс、Вкусно — и точка；俄羅斯還有 10 家名稱是 SubJoy、Sabway 卻標了 Subway 的品牌標籤）有些還帶著原本的 `brand:wikidata`，不論在哪一國都不算。Subway 在俄羅斯還有加盟店（公司沒有宣布退出），照算。沒算的舊標示：麥當勞 37、肯德基 194、IKEA 2 個（2026-10-27 `geoindex` 修好換日線以前是 43、194：芬蘭、挪威、瑞典北部的 5 家麥當勞被算成俄羅斯，因此也被當成舊標示；同一天改用 1:10m 國界以前是 38、195：愛沙尼亞納爾瓦的麥當勞、中國綏芬河的肯德基被算成俄羅斯，第 85 點）。
    - **國家**：店家的經緯度用 Natural Earth 1:10m 的國界判斷（`geoindex.countries_at()`，第 85 點；95 萬個點約 3 秒）。香港、澳門是自己的形狀，不算中國大陸。
      - 2026-10-27 以前用地圖的 1:50m：香港的形狀北邊偏到深圳福田、羅湖、蛇口，深圳的 115 家店算成香港，澳門的形狀也含拱北、橫琴的 10 家。改用 1:10m 後香港的麥當勞 223 → 189 家、星巴克 108 → 84、肯德基 50 → 33、7-Eleven 583 → 575、Subway 23 → 20、Lawson 5 → 0、全家 3 → 0、所有便利商店 1,107 → 1,071 家（每百萬人：麥當勞 30.2 → 25.6，第 8 → 10；星巴克 14.6 → 11.4，第 11 → 17）；澳門的 7-Eleven 48 → 47、星巴克 20 → 18、麥當勞 39 → 40、所有便利商店 116 → 110 家。換了國家的店名幾乎都是簡體字（麦当劳、罗森、美宜佳、易捷），確定在深圳、珠海。
      - 1:10m 的香港邊界在沙頭角一帶仍偏北：深圳那一側的 3 家美宜佳、1 家麥當勞（簡體字）還算香港，1 家星巴克反而從中國變成香港，`geoindex.BORDER_FIXES` 的「沙頭角北邊」改回中國（第 85 點）：香港的麥當勞 189 → 188、星巴克 84 → 83、所有便利商店 1,071 → 1,068 家（每百萬人：麥當勞 25.5，第 10；星巴克 11.2，第 18）。澳門跟珠海之間還有幾家分不清（拱北口岸旁、港珠澳大橋的珠澳口岸人工島上有 3 家簡體字的店從中國變成澳門），沒有改。
    - **人口**：WPP 2024 的 2026 年中推估（台灣也用 WPP，跟人口主題一樣），每百萬人店數 = OSM 店數 ÷ 人口 × 100 萬。世界合計是所有 OSM 店數 ÷ 世界人口。
    - **Overpass 的用法**（`osm.py`）：27 個查詢（每個品牌的 QID 一個、名稱比對 6 種店型各一個、`shop=convenience` 12 個 30° 經度帶），一次一個、查完停 5 秒，CSV 輸出只要 9 個欄位（共約 72 MB），最後加 `out count` 檢查筆數（CSV 沒有錯誤訊息的欄位，查到一半逾時只會少資料）。
      - CSV 的值裡的換行不會跳脫（有些店名標了兩行），一筆會斷成兩行：不是 node／way／relation 開頭的行接回上一行（`_csv_lines()`），筆數才對得上 `out count`。第一次沒處理，56,934 筆的經度帶被當成不完整重查了一次。
      - 2026-10-26 overpass-api.de 一直回「at capacity」的 502，每個查詢排隊 1–10 分鐘，失敗時等 30、60、120…秒再試，每第三次改試 private.coffee（明文允許自動化使用，但那天它的閘道 2–3 分鐘就逾時，一次也沒成功），全部跑完約 2.5 小時。結果存在 `.cache/osm/`，之後重跑不會再查（約 1 分鐘，主要是 95 萬個點判斷國家）；`--refresh` 才會重新查。
    - **涵蓋率**：OSM 是志願者畫的地圖，不是官方店數。`chain_official.py` 列了 41 筆公司公布的店數（台灣 7 筆、日本 7 筆、美國 7 筆、其他國家 20 筆；2026-10-26 查，能找到公司自己的文件就用文件，台灣的星巴克、麥當勞、肯德基與中國的麥當勞只找到報紙引述公司宣布的數字，出處寫那家報紙），涵蓋率 = OSM 店數 ÷ 公司店數：
      - 台灣：7-Eleven 5,948／7,334（81%）、全家 3,627／4,504（81%）、麥當勞 402／430（93%）、星巴克 463／600 以上（77%）、肯德基 176／200（88%）、IKEA 9／8（113%，含小型店）、Costco 14／14（100%）。
      - 日本：7-Eleven 17,138／21,956（78%）、全家 12,617／16,466（77%）、Lawson 11,301／14,697（77%）、麥當勞 2,445／3,047（80%）、星巴克 1,446／2,116（68%）、肯德基 812／約 1,335（61%）、Costco 33／37（89%）。全家原本只有 46%：日本有 5,769 家標的是公司的 QID（Q1191685），加進來才到 77%。
      - 美國：麥當勞 13,605／13,706（99%）、肯德基 3,222／3,482（93%）、Subway 12,694／18,773（68%）、星巴克 11,304／16,933（67%，授權店在超市、書店、機場裡面，OSM 比較少標）、7-Eleven（美國＋加拿大）7,269／12,712（57%）、Costco（含波多黎各）641／647（99%）、IKEA 65／52（125%：規劃訂購點、取貨點在 OSM 上很多也只寫「IKEA」，分不出來）。
      - 明顯偏低的：中國大陸的 Lawson 500／6,977（7%）、肯德基 2,715／13,789（20%）、星巴克 2,021／7,991（25%）、麥當勞 2,282／7,100 以上（32%）；南韓的 7-Eleven 3,452／11,040（31%）、星巴克 985／2,077（47%）；泰國的 7-Eleven 5,684／15,945（36%）。菲律賓 7-Eleven 3,100／4,491（69%）、加拿大星巴克 1,246／1,447（86%）。
      - Costco 的倉儲賣場幾乎都標了：14 個國家 80–105%（南韓 80%、日本 89%，其他 99–105%）。
      - 低於 50% 時 tooltip 寫「OSM 只標了公司公布店數的 x%，明顯偏低」（指標檔的 `hints`，第 3 節），側欄也另外提醒；地圖照樣畫 OSM 的數字，不隱藏、不換成公司的數字，因為只有少數國家有公司數字，混在一起反而不能比。
      - 公司只公布合計的（7-Eleven, Inc. 的美國＋加拿大、Costco 的美國含波多黎各），OSM 也加總同樣的國家，表格的數字加 *。
    - **台灣**：7-Eleven 每百萬人 258 家（OSM 5,948 家）、全家 158 家（3,627 家）都是 199 個國家與地區的第 1，第 2 都是日本（140、103 家）；用公司公布的店數算是每百萬人 319、196 家（人口用 WPP 的 2026 年 2,301 萬人）。門檻讓台灣自己一級（7-Eleven 200 以上、全家 150 以上）。其他：星巴克 20 家（第 8）、麥當勞 17 家（第 21）、肯德基 7.6 家、Subway 4.4 家、Costco 0.61 家（第 5）、IKEA 9 家。所有便利商店 13,390 家（每百萬人 582 家，第 28；小雜貨店也標成便利商店的國家排在前面，例如白俄羅斯、喬治亞、摩爾多瓦），標示最多的是 7-Eleven、全家、萊爾富 1,725、蝦皮店到店 537、OK超商 523。官方的店數都只寫在附註、tooltip 與側欄。
    - **所有便利商店**：子項目多一個「所有便利商店」（OSM 上所有 `shop=convenience`，不分品牌，含獨立的小店與加油站附設的），用同樣的兩個指標；本來做成第三個指標，控制列在 1280px 的英文版會折成兩行，所以改成子項目。全球 84.5 萬家（3 個便利商店品牌合併重複時拿掉的點不算），沒有店家位置的點（檔案太大）。分級門檻 25、50、100、200、400、800，台灣、日本在 400–800 那一級。各國對便利商店的標法差很多（小雜貨店有些國家標成便利商店、有些標 `shop=supermarket` 或 `general`），只能當參考。側欄列出標示最多的 8 個品牌（7-Eleven、全家、Lawson 依這裡的認法合併，其他照 `brand` 標籤）與沒有標品牌的家數。
    - **店家位置**（`points/<品牌>.json`）：只有經緯度兩個欄位，量化到 0.0001°（約 11 公尺），依 Hilbert 曲線排序後經緯度都存差分（相鄰的店多半在附近，差很小），7-Eleven 約 4.8 萬家 359 KB（gzip 後 143 KB，每家約 7.6 個位元組）。一般點圖層的 `file` 含 `{item}`，選到的品牌才下載（第 4 節）；放大到 5 級以上才畫（`minZoom`）。沒有存國家欄位（每個點會多 6 個位元組），點一下選取點底下的國家。
    - **人口不到 10 萬的地方**（38 個，`MIN_POPULATION`）不算每百萬人店數：一兩家店就是每百萬人幾十家（聖馬丁 4 家 Subway 是 90 家），梵蒂岡旁邊的一家肯德基落在 1:50m 的梵蒂岡國界裡就變成每百萬人近 2,000 家（改用 1:10m 以後已經不在梵蒂岡）。地圖上留灰色，tooltip 與側欄寫原因（指標的 `noValue`，前端 `SMALL_POPULATION` 的清單跟 pipeline 算的比對，對不上時報錯）；店數照常有。
    - **大小**：9 個品牌的店家位置 1.47 MB（gzip 後 611 KB，選到的品牌才下載），20 個指標檔 96 KB（gzip 後 33 KB），228 個國家明細 66 KB（gzip 後 50 KB），共 1.6 MB（gzip 後 696 KB）；沒有網格圖磚。
    - **沒有歷年資料**：OSM 只有現在的快照（要歷年得讀歷史的 planet 檔，太大），時間軸只有 2026 年一個點。
76. **航運與港口**（`pipeline/topics/shipping.py`、`shipping_density_tiles.py`、`pipeline/sources/unctadstat.py`、`wpi.py`、`port_teu.py`、`tipc.py`、`ship_density.py`、`src/topics/shipping.ts`、`src/topics/panels/ShippingPanel.tsx`）：
    - **來源的選擇**（授權見第 12 點）：各國的數字都用 UNCTAD Data Hub（CC BY 3.0 IGO，含台灣），不用世界銀行 WDI 轉載的版本（沒有台灣、LSCI 是舊版）。港口的位置、大小與類型用 NGA 的 World Port Index（公有領域）。港口層級的吞吐量沒有開放授權的全球資料，只收 30 個主要貨櫃港自己公布的數字；Lloyd's List、Alphaliner 的排名不能用。
    - **UNCTAD 的整包下載**（`unctadstat.py`）：`https://unctadstat-api.unctad.org/bulkdownload/<報表>/<報表的檔名>` 回傳 7z 壓縮的 CSV（新的 Data Hub 的資料檢視是 Angular 單頁程式，OData API 要申請金鑰，整包下載不必），用 `py7zr` 解開（`pipeline/requirements.txt` 新增；py7zr 1.x 沒有 `readall()`，解到 `.cache/unctadstat/<檔名>/`）。經濟體是 M49 代碼，4 碼的是區域與組別；已經不存在的（捷克斯洛伐克、東西德、蘇聯、南斯拉夫、2011 年以前的蘇丹、荷屬安地列斯…，`HISTORICAL`）不收，其他對不到 ISO 的會報錯。「China, Taiwan Province of」（158）就是台灣，UNCTAD 的中國不含香港、澳門、台灣（附註寫明）。
    - **指標**：
      - 貨櫃吞吐量（`US.ContPortThroughput`）：2010–2024 年，134 個經濟體。UNCTAD 標「Estimated」的年份寫在附註。轉運櫃在中轉港算兩次，新加坡、馬來西亞這類轉運港特別大（說明寫明）。
      - 班輪航運連結指數（`US.LSCI`）：每季一筆（2023 年第 1 季各國平均 = 100，2024 年 3 月起整條序列改用這個基準），地圖用每年各季的平均；最新一年 2026 只有第 1–3 季（指標檔的 `partialYear`，說明寫明），只有最新一年可以不到 4 季，其他年份缺季時報錯。門檻 10、25、50、100、200、400（中位數約 50，前 10% 約 280，中國 1,300 多）。
      - 商船隊（船旗國，`US.MerchantFleet`）：100 總噸以上的商船，載重噸，1980–2026 年（每年 1 月 1 日）。UNCTAD 標「Break」的（英國 1995、美國 2002 與 2011、法國 2011）寫在附註。側欄的船種：油輪、散裝船、雜貨船、貨櫃船、其他。
      - 商船隊（船東國，`US.FleetBeneficialOwners`）：1,000 總噸以上，實質船東（負責營運的公司）所在國，2014–2026 年，取「Total all flags」那一列。「World n.e.s.」（國籍不明）不收。這個資料表的船旗只分出 28 個主要船旗加「本國旗」「外國旗」，側欄的其他船旗 = 外國旗 − 列出的外國船旗。
      - 造船（`US.ShipBuilding`）：當年交船的總噸，2014–2025 年，全部是 0 的國家不收。中國、南韓、日本占九成以上（2025 年 94%）。
      - **沒有做的**：港口靠港次數與在港時間（`US.PortCalls`、`US.PortCallsArrivals`，MarineTraffic 的 AIS）只有 2018–2023 年、約 70 個國家，**沒有台灣**，所以沒有放；海運貿易量（`US.SeaborneTrade`）只有區域合計。
    - **港口的點**（`ports.json`，`points_file()`）：World Port Index 的 3,807 筆（冰島的 Seydisfjordur 列了兩次，留資料多的那筆，共 3,806 個；奈及利亞的 Escravos 與 Lekki 編號一樣但位置不同，兩筆都留）。欄位：經緯度（0.001°）、WPI 原文名稱、中英文名稱（30 個主要港口與台灣的港口）、國家、大小（1 很小 → 4 大，0 不明）、類型代碼（依類別排在一起：海岸天然、海岸人工（防波堤、潮閘、避風港）、河港與運河湖泊、開放錨地、不明，前端依代碼範圍上色）、有沒有貨櫃碼頭、PLSCI 與名次、公布的吞吐量。半徑依大小；`minValue` 讓世界全圖只畫中、大型港口（550 個），3 級加小港口，5 級以上全部。285 KB（gzip 後 49 KB）。
      - NGA 的 CDN 對同一個網址大約一半回 503（2026-10-26，curl 與 Python 都一樣），`wpi.py` 等 5、10、15… 秒再試。WPI 的國名對不到 ISO 代碼時報錯（`COUNTRY_ALIASES`）。
      - **港口班輪航運連結指數**（`US.PLSCI`，最新一季 2026 年第 3 季，940 個貨櫃港）：依 UN/LOCODE 對到 WPI 的 710 個；WPI 有些大港用舊代碼或沒有代碼（上海 CNSGH、寧波 CNNBO、青島 CN QIN、新加坡分成幾個港區），18 個寫在對照表（`PLSCI_TO_WPI`，新加坡畫在吉寶港區、南沙畫在廣州）；其他依港名在同一個國家裡比對（去掉 Gang、Ko、Port 這類字），只有唯一一個候選時才算，59 個（逐一看過，例如 Shantou → Shan T Ou、Makassar → Ujung Pandang）。共 783 個；對不到的前幾名是倫敦門戶港、巴拿馬的曼薩尼約、多明尼加的 Caucedo、巴西的 Itapoa、印度的 Vizhinjam（WPI 沒有這些港）。好幾個 PLSCI 港口對到同一點時留指數高的。名次是 940 個港口裡的名次。
      - **主要港口的吞吐量**（`port_teu.py`）：28 個港口 2025 年、傑貝阿里 2024 年（DP World 2025 年只公布集團合計），共 30 個（含台灣四港）；中國大陸的用交通運輸部的全國港口統計（萬 TEU）。官方只公布到萬 TEU、0.01 百萬 TEU 的標「rounded」，側欄寫「官方只公布到這個精度」。全港包含好幾個港區的（深圳、寧波舟山、廣州含南沙、安特衛普–布魯日、紐約–新澤西）寫口徑。找不到官方數字的（林查班、蓋梅、蒙德拉）沒有收（第 12 點）。逐一抽查過新加坡 MPA、香港政府統計處、可倫坡港的頁面。
    - **台灣**：
      - UNCTAD 的台灣跟臺灣港務公司開放資料（`tipc.py`，政府資料開放平臺 8368，Big5 的 CSV，2001 年起逐月）的國際商港合計一致，2010–2024 年每年相差不到 0.02%（2024 年 13,933,246 對 13,933,254 TEU），`shipping.py` 比對，差 0.1% 以上報錯。地圖用 UNCTAD（2024 年 1,393 萬 TEU，108 個國家的第 13）；2025 年臺灣港務公司公布 13,546,118 TEU，寫在附註與側欄（UNCTAD 還沒有這一年）。
      - 2025 年各港：高雄 8,885,855、基隆 1,603,563、臺中 1,590,768、臺北 1,463,658 TEU（高雄占 66%），`port_teu.py` 的數字跟開放資料逐月加總比對。側欄畫 2001–2025 年各港的堆疊面積（花蓮、蘇澳、安平併成「其他」）。
      - PLSCI（2026 年第 3 季）：高雄 828（940 個港口的第 13）、基隆 313、臺中 270、臺北 257。WPI 的英文名稱是舊拼音（Kao-Hsiung、Chi-Lung、Tai-Chung Kang、Tan-Shui＝臺北港），點與側欄用中文名稱（英文介面用 Kaohsiung、Keelung、Taichung、Taipei），原文放在 tooltip 最後一行。
      - 航運連結指數 2025 年 332（179 國的第 14），2026 年第 1–3 季平均 323（第 15）。
      - 商船隊：掛台灣旗 588 萬載重噸（2026 年，197 國的第 45，貨櫃船 46%、散裝船 43%）；台灣船東 6,618 萬載重噸（182 國的第 8，占全球 2.6%），91% 掛外國旗：新加坡 2,159 萬（33%）、巴拿馬 1,842 萬（28%）、賴比瑞亞 1,186 萬（18%），本國旗 573 萬（8.7%）。
      - 造船：UNCTAD 的台灣 2015 年 72 萬總噸最多，2022 年 496、2023 年 18.8 萬、2024 年 3.7 萬、2025 年只有 326 總噸，照 UNCTAD 的數字畫。2026-10-27 查過不是抄錯：UNCTAD 的造船、船隊、拆船統計只算 100 總噸以上的海運商船，不含軍艦、公務船、漁船與遊艇（UNCTAD Handbook of Statistics 的說明）；台灣國際造船 2022 年起因商船訂單不足而虧損（2025-02-25 法說會），這幾年主要在造潛艦、海巡艦與公務船。台灣的附註與 tooltip 的短註寫明，`shipping.py` 的 notes、hints 依資料產生數字。沒有找到可以逐年對照的台灣官方造船噸數。
    - **航運密度的網格**（第 14 節）：世界銀行／IMF 的 Global Shipping Traffic Density（CC BY 4.0），只有網格、沒有國家平均（`GridSpec.only`，指標是 `kind: 'none'`，tooltip 與排名表用貨櫃吞吐量，跟交通主題的「路網地圖」用鐵路長度一樣）。時間軸照貨櫃吞吐量的年份，網格只有一期（2015 年 1 月–2021 年 2 月）。
    - **側欄**（`ShippingPanel.tsx`）：主要港口（依公布的吞吐量、PLSCI、大小排，前 8 個；港口檔跟地圖的圖層同一個檔），吞吐量的出處；台灣各港的貨櫃裝卸量；船旗國的船隊組成（從這個國家第一年有資料的年份畫起）；這國船東的船掛哪國的旗（前 8 名、占 0.5% 以上的，其他併成「其他船旗」）；掛這國旗的船的船東在哪裡（只有 UNCTAD 列出的 28 個船旗國）。
    - **跟其他主題**：國際貿易流向、各國交通的說明指到這個主題，這個主題也指回去；海底電纜是通訊，不重複。
    - **大小**：指標檔 5 個（93 KB，gzip 後 39 KB）、港口 285 KB（gzip 後 49 KB）、214 個國家明細 323 KB（gzip 後 127 KB），共 0.70 MB（gzip 後 216 KB）；網格圖磚 234 張、4.4 MB（部署時產生）。合計約 5.1 MB。

77. **海洋與漁業**（`pipeline/topics/oceans.py`、`pipeline/sources/marine_regions.py`、`fishstat.py`、`fa_tw.py`、`faostat.py` 的 RL、`src/topics/oceans.ts`、`src/topics/panels/OceansPanel.tsx`）：
    - **來源**（授權見第 12 點）：專屬經濟海域用 Marine Regions 第 12 版（VLIZ，CC BY 4.0）的 WFS：`MarineRegions:eez` 的屬性（285 個多邊形：200 浬 229、重疊主張 35、共同管理區 21；`area_km2` 是 Marine Regions 算的面積，含內水、群島水域與領海）、`MarineRegions:eez_boundaries` 的界線（2,349 條，25 MB 的 GeoJSON，約 2 分鐘）、`MarineRegions:eez_land` 只用來判斷內陸國（41 個，加上 Marine Regions 沒有的科索沃）。漁業用 FAO FishStat 的 Global production（2026 年 3 月版，1950–2024 年，CC BY 4.0），陸地面積用 FAOSTAT 的土地利用（不含內陸水域），人口用 WPP 2024。
    - **重疊主張與共同管理區照 Marine Regions 的分類呈現，不下判斷**：
      - 面積算給哪裡（`_territory_iso()`）：200 浬的多邊形算給屬地的 ISO（沒有屬地代碼的夏威夷、阿拉斯加、亞速群島、加拉巴哥群島、查哥斯群島…算給主權國欄位的國家）。重疊主張裡，Marine Regions 兩個屬地欄位都是同一個地方的（台灣、福克蘭群島、南喬治亞與南三明治群島、西撒哈拉、馬約特、烏克蘭、威克島，共 304 萬 km²），是「這個地方的海域，主權有不同主張」，照屬地欄位算給那個地方，附註與 tooltip 寫「Marine Regions 標為重疊主張（各方）」。其他重疊主張與所有共同管理區（49 處、161 萬 km²：南海的西沙與南沙群島一帶、南千島群島、釣魚臺列嶼／尖閣諸島、獨島／竹島、加拿大與美國之間…）不算進任何一方，側欄列出各方。
      - **台灣**：Marine Regions 把台灣周邊的海域整片標為「Overlapping claim Taiwan: Taiwan / China」（屬地欄位兩個都是台灣，主權欄位是台灣、中國），照上面的規則算在台灣：355,433 km²（201 個有專屬經濟海域的地方第 74 名），是陸地（FAOSTAT 35,410 km²）的 10.0 倍。釣魚臺列嶼／尖閣諸島周邊 73,794 km²（台灣、日本、中國）與南海那一塊 338,839 km² 都不算。地圖上照其他主題寫「台灣」。
      - **南海**：Marine Regions 的「Overlapping claim: South China Sea」（338,839 km²，西沙、南沙群島一帶）只列出中國一方，沒有逐一列出其他聲索方；這裡不寫「各方」，名稱是「南海（西沙、南沙群島一帶）的重疊主張區」，中國的側欄列出它並註明「這一塊只列出中國，沒有逐一列出其他聲索方」，不算進中國的面積。越南、菲律賓等國的 200 浬多邊形也不含這一塊。
      - 地名並列各方的稱呼（「釣魚臺列嶼／尖閣諸島」「Senkaku / Diaoyu / Tiaoyutai Islands」「獨島／竹島」「南千島群島／北方四島」「福克蘭群島（馬維納斯群島）」），寫在 `oceans.py` 的 `SPECIAL_PLACES`。
      - 查哥斯群島：第 12 版把它的海域列為「Mauritian Exclusive Economic Zone (Chagos Archipelago)」，照列在模里西斯（附註寫明），英屬印度洋領地（IOT）的專屬經濟海域寫原因、不寫「無資料」。直布羅陀（重疊主張，英國、西班牙）、南極洲、布威島（第 12 版沒有），以及 Marine Regions 沒有另外劃出海域的香港、澳門、奧蘭群島也寫原因（指標的 `noValue`）。裏海：Marine Regions 有哈薩克、亞塞拜然、土庫曼的裏海海域，照算。
      - **主權國的合計**：依 Marine Regions 的主權國欄位（`sovereign1`）加總，只在附註與側欄（地圖上海外領地各自一個國家）：美國 1,214 萬 km²、法國 960 萬、澳洲 899 萬、俄羅斯 773 萬、紐西蘭 671 萬（含庫克群島、紐埃、托克勞，Marine Regions 的主權國欄位寫紐西蘭）、印尼 602 萬、英國 587 萬。
    - **界線**（`eez-lines.json`）：基線（直線基線、群島基線、正常基線）是沿海岸的線，不畫；其他依 `line_type` 分 5 類：200 浬外緣（含 12 浬，深灰）、條約或判決或沒有爭議的單方主張（紫）、等距中線（Marine Regions 在沒有條約的地方算的，琥珀）、共同管理區的界線（綠）、未解決（陸地主權或海域劃界有爭議，洋紅虛線）。連接線（把兩段界線接起來的短線，平均 7 km）用同一對海域其他界線的分類。每條線的紀錄有細分的性質、長度與兩邊的海域（ISO、部分的名稱、重疊主張或共同管理區的地名與各方），tooltip 寫「台灣 — 日本 · 等距中線」「台灣 — 中國 · 未解決的等距中線：島嶼或領土的主權有爭議」。Douglas–Peucker 簡化到 0.005°、量化 0.005°：1,389 段、16,373 個頂點，190 KB（gzip 後 53 KB）。Marine Regions 的線已經在 ±180° 切開，斐濟、吐瓦魯、吉里巴斯在地球儀與平面上都不會畫出橫越全圖的線（截圖驗證）。英國與法羅群島之間那條線的 `mrgid_eez1` 寫成 84350（多邊形是 8435），`BOUNDARY_FIXES` 改正。
    - **漁業**：只算水生動物（物種表的 Yearbook_Group「Aquatic animals」：魚、甲殼類、軟體動物等；不含藻類、水生哺乳類、鱷魚、珍珠、珊瑚、海綿，FAO 年鑑與 SOFIA 的口徑），活體重量（貝類含殼）。捕撈算在漁船的船旗國（台灣的遠洋漁船在三大洋捕的都算台灣），海洋與內陸都算。FAO 的「China」只有大陸，香港、澳門、台灣（158，「Taiwan Province of China」）各自一國；桑吉巴併進坦尚尼亞；已經不存在的國家與「Other NEI」只算進世界合計（`fishstat.HISTORICAL`，對不到的代碼會報錯）。FAO 只列有產量的物種，所以一國某一年有捕撈或養殖的任何一筆，另一種沒列的算 0。2024 年世界捕撈 9,192 萬公噸、養殖 1 億 266 萬公噸（52.8%；2021 年養殖追上捕撈），中國的養殖占全世界 56%。養殖占比只算一年產量 100 公噸以上的國家；人均是捕撈加養殖除以 WPP 人口。
    - **台灣**：FAO 2024 年捕撈 773,463 公噸（第 24 名）、養殖 361,309 公噸（第 19）、養殖占比 31.8%、人均 48.9 公斤（第 36）。漁業署《漁業統計年報》（114 年版的「歷年漁業生產量值」，1959–2025 年）：
      - 捕撈（遠洋＋近海＋沿岸＋內陸漁撈）跟 FAO 幾乎一樣：2024 年 773,635 對 773,463 公噸（相差 0.02%），1959 年起每年相差 6% 以內（多半 3% 以內，1997 年 +5.8% 最多），`taiwan_check()` 超過 6% 就報錯。2024 年遠洋漁業 599,839 公噸，占捕撈的 78%；FAO 的漁區：西北太平洋 36%、中西太平洋 34%、西南大西洋（阿根廷外海的魷魚）17%、西印度洋 6%。
      - 養殖差很多（FAO 多 36–129%）：幾乎都是牡蠣，FAO 一律用活體重量（含殼），2024 年 112,673 公噸；漁業署 113 年年報的英文摘要是 16,153 公噸（虱目魚、吳郭魚等其他品項兩邊幾乎一樣）。2024 年漁業署的養殖是 264,992 公噸，養殖占比用漁業署的數字算是 25.5%，寫在附註。
      - 2025 年漁業署公布 892,197 公噸（捕撈 634,744、養殖 257,454），FAO 還沒有這一年，寫在附註與側欄。
      - 主要的水產種類（FAO 2024）：捕撈是鮪、鰹與旗魚 48%、其他表層魚類（鯖、秋刀魚）22%、魷魚等 17%；養殖是牡蠣 31%、其他洄游魚類（虱目魚等）21%、吳郭魚 16%、蛤類 13%。
    - **側欄**（`countries/<ISO3>.json`，237 國）：捕撈與養殖的堆疊面積（讀兩個指標檔）、主要的水產種類（ISSCAAP 物種組前 8 名加其他，中文名稱在 `OceansPanel.tsx` 的 `GROUPS`）、FAO 漁區（前 8 名，`AREAS`）、專屬經濟海域的組成、主權國的合計與海外領地（前 8 個）、照屬地算給別處的重疊主張（例如中國的側欄寫台灣、阿根廷的寫福克蘭群島）、跟其他國家重疊主張或共同管理的海域；台灣另列漁業署 2022–2025 年各漁業種類的產量跟 FAO 對照。
    - **跟其他主題**：「各國飲食」的水產供給量是每人吃多少，這裡是生產，兩邊的說明互相指引；「航運與港口」的說明也指到這裡。
    - **大小**：6 個指標檔 298 KB（gzip 後 92 KB）、界線 190 KB（gzip 後 53 KB）、237 個國家明細 125 KB（gzip 後 75 KB），共 0.61 MB（gzip 後 221 KB）；沒有網格圖磚。

78. **塑膠污染**（`pipeline/topics/plastic.py`、`pipeline/sources/cottom.py`、`meijer.py`、`baci.py` 的 `yearly_product_flows()`、`moenv.py` 的 `municipal_waste()`、`recycled_plastics()`、`mof_trade.py`、`src/topics/plastic.ts`、`src/topics/panels/PlasticPanel.tsx`）：
    - **來源的選擇**（授權見第 12 點）：各國的排放用 Cottom 等人（2024）的 SPOT 模型（2020 年，含台灣），河川入海用 Meijer 等人（2021）的河口（2015 年），塑膠廢料的貿易用 BACI。兩個都是**模型估計值**，指標說明、頁尾、tooltip（河口）與側欄都寫明；兩個模型的年份、範圍、定義不同（SPOT 是陸上一般垃圾的碎片加露天焚燒，Meijer 是河川帶進海洋的漂浮塑膠），不能相加或互相比。OECD Global Plastics Outlook 只有區域，EA Earth Action 沒有授權條款，都沒有用。
    - **SPOT（`cottom.py`）**：Dryad 的檔擋程式，用 OWID 快照庫的同一批檔（4 MB 的 zip，只有 SD_03 各國、SD_04 世界與區域兩個 Excel 的 `03_Outputs` 表），核對 md5。各國是 5 萬多個城市的機率模型（5,000 次）加總，有平均與 5、25、50、75、95 百分位數；地圖用平均，側欄與附註寫 5–95 百分位數（「90% 區間」）。246 個地方，北賽普勒斯（XNC）、阿克羅提利與德凱利亞（XAD）、西沙群島（XPI）沒有 ISO 代碼、地圖上也沒有，不收（只在世界合計裡）；科索沃寫 XKO，換成 XKX。各國排放加總跟 SD_04 的世界合計一致（5,211 萬公噸，露天焚燒 57%）；沒有收集服務的人口各國加總（15.1 億）跟世界（11.8 億，15.06%）對不上，世界的對照線用 SD_04 的值。
      - 指標：人均排放（公斤／人／年，SPOT 自己的人均）、年排放量，子項目是排放形式（全部塑膠、塑膠碎片、露天焚燒的塑膠，圖例與標題是「塑膠碎片人均排放」，跟溫室氣體的「二氧化碳人均排放」同一種寫法）；人均塑膠垃圾（SPOT 的 kg/人/日 × 365）；沒有垃圾收集的人口比例。門檻：人均排放 0.1、0.5、2、5、10、15（分布是兩群：高所得國家多在 0.3 以下，中位數 6.8）。
      - 側欄：五種來源（未收集的垃圾、沒有控制的棄置場、亂丟、回收分選的殘渣、收集與運輸）、碎片與露天焚燒、塑膠垃圾產生量、收集服務涵蓋率（不含沒收集的亂丟垃圾）、在有控制的設施處理（SDG 11.6.1）、沒有收集服務的人數。
    - **Meijer（`meijer.py`）**：figshare 的 shapefile（中間情境，31,819 個點，一個欄位：公噸／年，沒有河名與國家），用標準函式庫讀 .shp、.dbf。國家依河口位置用 `geoindex.countries_at()`（Natural Earth 1:10m，海邊找 0.3° 內最近的國界，第 85 點）：3 個、1 公噸找不到國家，不算。跟論文國家表（OWID 轉載）比對：菲律賓、印度、巴西、中國差 0.1% 以內，馬來西亞 −0.3%、印尼 −2.0%、台灣 −2.2%，超過 15% 報錯。2026-10-27 以前用地圖的 1:50m：111 個、515 公噸找不到國家（蘇祿群島、印尼與巴布亞紐幾內亞的小島、賴比瑞亞的海岸），深圳河、珠江口一帶的河口算成香港（香港 2,411 → 276 公噸、澳門 118 → 0），中國比論文少 3.6%（68,157 → 70,659 公噸，論文 70,707），換了國家的河口共 183 個。
      - 沿海但沒有 0.1 公噸以上河口的國家是 0；內陸國（Marine Regions 的 41 個加科索沃，前端 `LANDLOCKED` 同一份）寫原因不寫「無資料」。**模型把裏海也當成海**：伊朗的 865 公噸有 832 公噸流進裏海，哈薩克、亞塞拜然、土庫曼也有河口，所以照 Marine Regions 算沿海國，說明寫「裏海也當成海」。
      - 河口的點（`rivers.json`）：每年 1 公噸以上的 17,328 個（占總量 99.5%），欄位：經緯度（0.01°）、公噸（0.1）、全世界的名次、國家。世界全圖只畫 100 公噸以上的（`minValue`，約 1,500 個），3 級 20、4 級 5、6 級以上全部。前 1,659 個河口占 80%。367 KB（gzip 後 111 KB）。
    - **塑膠廢料的貿易**：BACI 的 HS92 版（1995–2024 年，2.4 GB 的 zip，第一次下載約 7 分鐘，讀 HS 3915 約 2 分鐘），用數量（公噸）；數量空白的列只占金額的 0.1% 以下（1995 年 1.2%），不算。HS 3915 含工廠的下腳料，不全是用過的塑膠垃圾（說明寫明）。流向檔跟國際貿易流向主題同一種格式（`scale: 1`，單位公噸），每國前 15 個夥伴；側欄的歷年堆疊面積是 1995 年起累計最多的 6 個夥伴加其他（存在國家明細裡）。中國的進口 2016 年 789 萬公噸、2017 年 526 萬、2018 年 37 萬、2024 年 7 萬；2024 年進口最多的是馬來西亞、土耳其、德國、越南、美國，出口最多的是德國、美國、英國、日本、荷蘭。香港 2018 年以前大量轉口到中國（BACI 記在香港的進口）。
    - **台灣**：
      - SPOT：2020 年排放 1,398 公噸（90% 區間 849–2,114，243 個地方的第 150 名）、人均 0.059 公斤（第 234 名，倒數第 10）；垃圾幾乎都有收集，模型裡沒有露天焚燒，來源是亂丟 56%、收集與運輸 44%。人均塑膠垃圾 61.6 公斤（第 57）。
      - Meijer：2015 年 519 公噸（有河口的 140 國第 61），111 個河口，最大的在淡水河口一帶（北緯 25.16°、東經 121.44°），每年 246 公噸、占 47%。
      - BACI：台灣是「Other Asia, nes」（490），數字來自貿易夥伴。2024 年出口 10.0 萬公噸（第 18）、進口 24.8 萬公噸（第 10）；進口 2018 年最多（42.1 萬公噸）。跟財政部 HS 3915 的進出口值比對（`mof_trade.py`，2011–2025 年）：進口每年相差多在 ±7% 以內（2021、2023 年 +15%、+16%），出口差很多（2011–2017 年 BACI 多 14–258%，2024 年少 32%）——BACI 的台灣出口是進口國的申報（香港、中國），口徑不同。側欄列對照表，不換掉 BACI。
      - 環境部（另一種量測，只在附註與側欄）：一般廢棄物清理情況（STAT_P_45，縣市加總，2011–2025 年）的一般垃圾、資源回收、廚餘回收；一般廢棄物回收率 =（資源回收＋廚餘）÷ 產生量，跟 STAT_P_46 各縣市的回收率同一個算法（臺北市 2025 年 72.05% 核對過）。全國 2024 年 61.5%、2025 年 62.6%。**2018 年起納入事業員工生活產生的垃圾**（臺中市主計處的統計分析：配合廢棄物清理法修訂的定義），產生量從 785 萬跳到 983 萬公噸，側欄的圖在 2018 年畫虛線（`methodBreak`）。執行機關回收的塑膠及橡膠製品（STAT_P_132 的年資料，2021–2025 年，2025 年 81.0 萬公噸）、公告應回收的塑膠容器（STAT_P_133，2025 年 21.1 萬公噸），兩者有重疊，不能相加。月資料只從 2021 年起，開放資料沒有更早的塑膠回收量。
    - **跟其他主題**：海洋與漁業、國際貿易流向的頁尾指到這裡，這裡也指回去。
    - **大小**：指標檔 11 個（103 KB，gzip 後 44 KB）、流向檔 30 個 1,091 KB（gzip 後 356 KB）、河口的點 367 KB（gzip 後 111 KB）、247 個國家明細 411 KB（gzip 後 191 KB），共 1.93 MB（gzip 後 0.69 MB）；沒有網格。
79. **網路速度**（`pipeline/topics/internet_speed.py`、`internet_speed_tiles.py`、`pipeline/sources/ookla.py`、`tw_mobile_speed.py`、`pipeline/geoindex.py`、`src/topics/internet-speed.ts`、`src/topics/panels/InternetSpeedPanel.tsx`）：
    - **做成獨立的主題**（科技與交通），沒有併進「數位」：數位已經有 3 個指標按鈕，加上速度的 3 個指標與「固網／行動」的子項目選單，控制列一定換行；速度的年份（每年第 3 季）、時間範圍（2019 年起）、來源與授權（CC BY-NC-SA）也跟數位的 ITU 資料不同。兩個主題的頁尾互相指引。
    - **資料**（授權見第 12 點）：Ookla 的 parquet 每季固網、行動各一個（2019 年第 1 季到 2026 年第 3 季都有；README 寫最新是 2026 年第 1 季，但 bucket 裡已經有第 2、3 季，2026-10-09 上傳）。每一列是一個 z16 的 Web Mercator 圖塊（赤道約 610 m），有平均下載、上傳速度（kbps）、平均延遲（ms）、測試次數與裝置數；只收有 GPS 等級定位的測試。「固網」是手機、電腦經由 Wi-Fi 或有線網路測的，「行動」是經由行動網路。
      - **讀法**：`pyarrow` 的 `S3FileSystem(anonymous=True)` 只讀 quadkey、下載、上傳、延遲、測試次數、裝置數 6 欄（WKT 的 `tile` 欄占檔案約六成，不讀），每季每種約 55–120 MB、10–30 秒；quadkey 直接從 Arrow 的字串緩衝區換成 z16 的 x、y，存成 `.cache/ookla/*.npz`。`pipeline/requirements.txt` 加了 `pyarrow`。
      - **每年只取第 3 季（7–9 月）**，2019–2026 年共 8 季：下載量適中（使用者要求一年一季），同一個季節年年可比，最新的 2026 年第 3 季也在裡面，不必在最後一年混一個別的季節。時間軸用指標的 `timeAxis`：年份上面寫「每年第 3 季」，tooltip、側欄、排名表寫「2026 年第 3 季」。
    - **歸國**：約 2,200 萬個不重複的圖塊，圖塊中心用 `geoindex.countries_at()`（Natural Earth 1:10m 的國界，海邊找 0.3° 內最近的頂點，第 85 點），結果快取在 `.cache/ookla/tile-countries-v<ASSIGN_VERSION>.npz`（第一次約 20 秒，之後只算新出現的圖塊；2026-10-27 以前用 1:50m 時約 10 分鐘）。再照人口網格（`population_grid` 的 `PARTS`、`OVERRIDES`）把法國海外省、波奈、克里米亞（算烏克蘭）、西撒哈拉、直布羅陀、吐瓦魯、托克勞依聯合國的劃分拆開；台灣的離島在 1:50m 沒有形狀、離本島超過 0.3°，澎湖、蘭嶼、綠島、東沙歸不到國家，馬祖會歸到最近的福建沿岸（中國），所以澎湖、馬祖（南竿北竿、莒光、東引）、烏坵、蘭嶼、綠島、東沙用矩形範圍改歸台灣（原本是這裡的 `TAIWAN_ISLANDS`，改用 1:10m 時移到 `geoindex.ISLANDS` 給所有主題用：1:10m 有澎湖本島、蘭嶼、綠島，仍然沒有馬祖、烏坵、東沙；只框住島本身，離黃岐半島、平潭、湄洲島都有距離）；金門在國界裡。沒有國家的圖塊占測試的 0.05–0.1%，只算進全世界。
      - **改用 1:10m**（2026-10-27，`ASSIGN_VERSION` 3；加了 `BORDER_FIXES` 之後是 4，波赫東部 2,645 個、沙頭角北邊 16 個、托克馬克一帶 29 個圖塊等改回，見第 85 點）：2,205 萬個圖塊有 52,661 個（0.24%）換了國家。最多的是原本找不到國家的海邊與小島（巴西桑托斯 445 個圖塊、2019–2026 年 25 萬次測試，馬爾地夫 2,068 個、索馬利亞的摩加迪休、義大利的蘭佩杜薩與利帕里群島、印尼、菲律賓、哥倫比亞的聖安德烈斯島、台灣彰化的濱海工業區），其次是香港 → 中國 303 個（深圳福田、羅湖，10 萬次測試）、澳門 → 中國 140 個（拱北、橫琴）、巴勒斯坦 → 以色列 161 個（耶路撒冷西區、莫迪因一帶）、新加坡 → 馬來西亞 185 個（新山）、聖馬丁荷屬 → 法屬 81 個、摩納哥 → 法國 118 個、梵蒂岡 → 義大利 5 個（梵蒂岡因此沒有圖塊，`countries/VAT.json` 刪掉），其餘是兩國之間互換的國界圖塊（美墨 556／397 個、波赫 → 塞爾維亞 2,109 個沿德里納河，見第 85 點的誤差）。2026 年第 3 季的變化：香港固網下載 460.4 → 461.7 Mbps（測試 54.0 → 53.4 萬次）、澳門 448.2 → 449.4，摩納哥 396.6 → 459.9 Mbps（第 13 → 4，原本含博索萊伊、博利厄一帶法國的圖塊），馬爾地夫固網 53.5 → 38.8、行動 189.6 → 157.2 Mbps（原本只有馬列附近的圖塊），法屬聖馬丁開始有值（127.5）；台灣只多了澎湖等地 184 個圖塊（591 次測試），各項數字不變，行動延遲的名次第 7 → 9。
      - **修了 `geoindex` 的換日線問題**（2026-10-27）：俄羅斯本土的環在楚科奇有從 179.9° 跳到 −180° 的邊，射線法在北緯約 65°–69° 把整條帶子判成在環裡，挪威的博德、芬蘭的羅瓦涅米、瑞典的呂勒奧這些點都被判成俄羅斯（Ookla 2026 年拿掉俄羅斯後，「俄羅斯」還剩 3.8 萬次測試，大多在北歐，才發現）。現在跨過 ±180° 的環先展開成連續經度，超出的部分再補一份平移 360° 的（跟 `population_grid.unwrap()` 同一個做法），28 個測試點（北歐、楚科奇、阿拉斯加、阿留申、斐濟、吉里巴斯、南極、台灣）都對。
      - **其他用 `geoindex` 的主題 2026-10-27 也重跑了**（只用快取、不連網）。先用修正前後兩版逐點比對各主題實際判斷的點：北緯約 65°–71° 一帶（挪威北部、瑞典的呂勒奧、芬蘭的羅瓦涅米與奧盧一帶、冰島北部、格陵蘭、加拿大北部）原本被算成俄羅斯，俄羅斯自己在這一帶的點（科拉半島、沃爾庫塔、新烏連戈伊等地的鐵路與便利商店）原本反而找不到國家；**斐濟**跨過 ±180° 的多邊形也有同樣的問題，南緯約 16.5° 一帶（玻利維亞的拉巴斯、馬達加斯加、巴西、波拉波拉島）原本被算成斐濟。
        - 便利商店與連鎖品牌：95 萬個點有 1,974 個換了國家（俄羅斯境內原本沒有國家的 1,052 個、拉巴斯原本算斐濟的 676 個、芬蘭 126、挪威 49、冰島 40、格陵蘭 10、瑞典 7、加拿大 6…）。斐濟的便利商店從 771 家（每百萬人 823 家，第 10）變 96 家，玻利維亞 3,109 → 3,782 家；退出俄羅斯的麥當勞沒算的舊標示 43 → 38、肯德基 194 → 195；台灣的「所有便利商店」每百萬人從第 27 變第 26。
        - 交通（鐵路）：判斷的 6.5 萬個點（每 20 個頂點取一點，同一個 0.1° 格子只判斷一次）有 274 個換了國家，俄羅斯 117,454 → 119,546 公里、芬蘭 5,085 → 5,774、挪威 3,487 → 3,936，斐濟原本的 37 公里是玻利維亞、巴西的鐵路（斐濟變 0）。鐵路密度的面積原本也用 `_countries()` 算，修正前俄羅斯少算約 600 萬 km²、斐濟多算約 14 萬 km²，修正後的副本又會讓俄羅斯變兩倍，所以改用 `geoindex.land_polygons()`（展開、不含副本）：俄羅斯 1,688 萬 km²，鐵路密度 10.9 → 7.1。機場用 OurAirports 的國家欄位，沒有經過 `geoindex`。
        - AI 的數據中心：4,986 個有 4 個（挪威 3、冰島布倫迪歐斯的 Borealis 1，原本算俄羅斯）。塑膠污染的河口：31,819 個有 2 個（馬達加斯加、巴西各 1，原本算斐濟，共 1.2 公噸）。
        - 太空的發射場（64 個）、城市（中國的 1,974 個城市判斷是不是港澳）、台灣的外交的館處（111 個）都沒有點換國家，沒有重跑。
    - **彙總方法**：
      - 地圖上的值（下載、上傳、延遲）是**依測試次數加權的圖塊平均的中位數**：把每次測試都當成它所在圖塊的平均值，再取所有測試的中位數（`weighted_medians()`，排序後累積權重到一半的那個值）。圖塊裡的差異看不到，所以跟逐次測試的中位數不完全一樣：圖塊平均會被同一個圖塊裡很快的線路拉高，在 10 Gbps 方案多的地方（新加坡固網 701 Mbps）比 Ookla 自己公布的中位數高。選中位數而不是平均，是因為平均被少數很快的線路拉得更高（2026 年第 3 季全世界的行動網路：中位數 103 Mbps、平均 143 Mbps）。
      - **平均**（側欄）：依測試次數加權的平均，等於所有測試的平均（圖塊平均 × 測試次數 = 圖塊裡的總和），是精確值。
      - **全世界**：所有圖塊（含沒有國家的）一起算的中位數，不是各國中位數的中位數；側欄與折線圖的對照線用它（`aggregates.WLD`）。
      - **樣本**：一季不到 1,000 次測試（`MIN_TESTS`，前端說明也寫這個數，pipeline 會檢查兩邊一樣）不給速度；不到 1 萬次的季在 tooltip 註明「數值較不穩定」（`hints`）；一個圖塊就占三成以上測試（`MAX_TILE_SHARE`）也不給值，可能是業者或少數人在同一個地方一直測：2026 年第 3 季賴比瑞亞的行動網路 1,758 次測試有 42% 在同一個圖塊，中位數 339 Mbps（會排在卡達、科威特、阿聯之後）。2026 年第 3 季有速度的：固網 213 個國家與地區、行動 166 個（測試次數照列在側欄）。測試是使用者自己發起的，偏向城市、網路慢或剛換網路的時候，不是隨機抽樣，說明與頁尾都寫明。
      - **測試次數不做成指標**：原本有第 4 個指標「測試次數」（比例圓），指標按鈕變 4 個時，上傳、延遲的控制列在英文 1280px、中文 1024px 都會換行，所以只放在側欄。
    - **Ookla 2026 年拿掉的地區**：README 2026-04-16 的變更紀錄寫「supported regions have been updated」。比對每一季的測試次數，俄羅斯 2025 年第 4 季起（固網從第 3 季的 210 萬次掉到 12 萬次，2026 年每季一千多次）、古巴、伊朗、敘利亞 2026 年第 1 季起（伊朗固網從 31 萬次掉到 612 次）、白俄羅斯第 2 季起幾乎沒有測試（只剩國界附近零星的圖塊），克里米亞 2026 年第 3 季是 0。這幾國之後的季不給值，tooltip 寫「Ookla 2026 年第 1 季起沒有這裡的資料」、附註寫原因（`REMOVED`）。`check_removed()` 檢查：這些國家之後的季又有大量測試、或其他國家的測試一季少了九成以上（前一季 2 萬次以上）就報錯，要人工確認。
    - **分級**（固定門檻，所有年份共用；全世界的中位數 2019 → 2026 年固網 49 → 218 Mbps、行動 20 → 103 Mbps，早年多半在淺色）：下載固網 10、25、50、100、200、300 Mbps，行動 10、25、50、100、150、250（`itemScales`；網格也用這兩組，pipeline 檢查）；上傳固網 5、10、25、50、100、200，行動 5、10、15、20、25、35；延遲固網 5、10、15、25、50、100 毫秒，行動 20、25、30、40、60、100（`lowerIsBetter`，名次由小排到大）。
    - **台灣**（2026 年第 3 季）：固網下載 264.6 Mbps（213 國第 50；全世界 217.6）、上傳 174.9（第 43）、延遲 6 毫秒（第 26），149.6 萬次測試、2.39 萬個圖塊；行動下載 148.2 Mbps（166 國第 36；全世界 103.2）、上傳 26.8（第 30）、延遲 19 毫秒（第 9），36.1 萬次測試。2019 年固網 58.7、行動 42.9 Mbps。行動網路的測試從 2019 年的 109 萬次逐年減少到 36 萬次。
      - **官方量測的對照**（只在附註與側欄）：NCC 委託電信技術中心的 4G 定點量測，2020 年全國平均下載 119 Mbps、2021 年 122.53 Mbps（上傳 24.92，第 50 分位 118.58／24.89；7,851 個戶外量測點）；數位發展部 2022、2023 年的 5G 定點量測沒有全國平均，這裡把 22 縣市簡單平均：2023 年中華電信 589／104、遠傳 465／88、台灣大哥大 310／62、台灣之星 95／23 Mbps（下載／上傳）。數位部 113 年度預算書寫「全國 22 縣市量測平均上網速率為 410Mbps」，對不上任何一種簡單平均（可能依量測點加權），不用。同年 Ookla 的行動網路中位數：2020 年 66.3、2021 年 86.9、2022 年 113.3、2023 年 118.7 Mbps。官方量測是專業人員在村里辦公室、車站等戶外固定地點，用指定的測試手機對每家業者各量一輪（每家業者等量），Ookla 是使用者自己的手機、4G 與 5G 混在一起、室內外都有、依使用者在哪裡測加權，所以官方的數字比較高，不能直接相比。固網近年沒有官方量測可以對照。
    - **側欄**：固網與行動網路下載速度的歷年折線（虛線是全世界；`TimeSeriesLine.dashed` 是這次加的）、選定那一季的下載（中位數與平均）、上傳、延遲、測試次數、有人測的圖塊數，每一項下面一列是全世界；台灣另列官方量測的對照表。
    - **網格**：下載速度可以切到約 2 km 網格（第 14 節）。切換鈕與 tooltip 寫「國家中位數」（`GridSpec.countryValue`），不是「國家平均」。下載速度的控制列多了切換鈕，在英文 1280px、中文 1024px 寬時是兩行（跟人口密度一樣）；上傳、延遲是一行（第 11 節）。
    - **大小**：指標檔 6 個（約 250 KB）、245 個國家明細 164 KB、世界 1 KB，共 0.42 MB（gzip 後 0.13 MB）；網格圖磚 3.3 MB（不進版本庫，部署時產生），合計約 3.7 MB。
80. **開發者與開源**（`pipeline/topics/developers.py`、`pipeline/sources/innovation_graph.py`、`src/topics/developers.ts`、`src/topics/panels/DevelopersPanel.tsx`）：
    - **做成獨立的主題**（科技與交通，排在網路速度後面），沒有併進「數位」或「研發與創新」：資料是 GitHub 一家平台的帳號與活動，年份是每年第 1 季，跟 ITU、UNESCO 的年度統計不同；指標有 6 個，再加進去控制列一定放不下。數位、研發與創新的頁尾指到這裡，這裡的頁尾指到 AI、創新、數位（AI 主題的設定檔同時有別的分工在改資料，沒有動）。
    - **資料**（授權見第 12 點）：GitHub Innovation Graph 的 CSV（`data/` 底下 8 個，用了主題 topics.csv 以外的 7 個；datasheet 1.0.10 版，2026-05-08 更新，2020 年第 1 季到 2026 年第 1 季）與 2 個補充資料，從 raw.githubusercontent.com 下載（約 8 MB，不經 API）。代碼是 ISO alpha-2，229 個經濟體（含科索沃 XK、奧蘭群島 AX）。
      - **`EU` 是歐盟 27 國的合計**（開發者數逐季等於 27 個會員國相加；協作的 EU → 美國也等於會員國 → 美國相加），一律拿掉，不然全世界會多算 2,695 萬人。`innovation_graph.metric()` 每次都核對，對不上就報錯（定義改了要重新決定）。
      - **所在地依 IP 位址判斷**：一季裡每天取樣的眾數，沒有活動的日子沿用上一次的位置（datasheet 第 6 點）。VPN、代理會把人算到別的地方：香港 2026 年第 1 季有 349 萬個帳號（人口的 47%）、新加坡 217 萬（37%）、塞席爾 2.7 萬（一年多了 1.9 倍），中國 1,135 萬（每千人 8.0，227 個經濟體第 167）。這 4 個寫在附註與 tooltip 的短註（`FLAGGED`）；每千人超過 150 個、又沒有說明的地方 pipeline 報錯。
      - **GitHub 依個人檔案調整的推送**（補充資料，同一個版本庫、CC0）：GitHub 為 2026 年全球數位合作會議（GDC26）用 LLM 判讀開發者個人檔案填的所在地，依個人檔案與 IP 的比例重新分配 2025 年第 3 季到 2026 年第 2 季的推送，只公布推送最多的 29 個與各區域人均前 5 名（共 62 個）。跟依 IP 的同期前三季（主資料還沒有 2026 年第 2 季）換算成四季比：中國 5.80 倍、香港 0.23、新加坡 0.53、台灣 0.94，其他多半 1.0–1.3（第 2 季推送比較多）。只寫在這 62 個經濟體的附註，沒有做成指標（只有一期、不到三分之一的經濟體、不能重現）；頁尾寫了這 4 個的倍數，pipeline 檢查範圍。
      - **不公布的門檻**：一季少於 100 位開發者做這件事的經濟體或協作組合不公布，所以全世界、協作的總數都是下限。
    - **每年取第 1 季**（`QUARTER`，1–3 月；人數、組織、版本庫是 3 月底的帳號數，推送與協作是那一季的次數），2020–2026 年共 7 年：跟網路速度每年取第 3 季一樣，同一個季節年年可比，最新的一季也在裡面。時間軸用指標的 `timeAxis`（「每年第 1 季」、「2026 年第 1 季」）。側欄另外畫每一季。流向圖 tooltip 的年份原本直接寫 `flows.year`，改成用 `timeAxis.year()`（「2026 年第 1 季」，`App.tsx`）。
    - **指標**（6 個，下拉選單）：
      - **每千人的開發者**（預設）：開發者帳號 ÷ WPP 2024 的年中人口（2024 年起是中推估）× 1,000。開發者是帳號數，含已經不活躍的、不含機器人與垃圾帳號，一個人可以有好幾個帳號。梵蒂岡（約 500 人、180 個帳號）不算人均（`MIN_POPULATION` 1,000，指標的 `noValue`），奧蘭群島 WPP 沒有人口。分級 2、5、10、20、40、80；全世界 2020 年 5.8、2026 年 23.2。
      - **開發者人數**（比例圓）：2026 年第 1 季全世界 1.92 億（不含 EU 的重複），美國 3,241 萬、印度 2,673 萬、中國 1,135 萬。
      - **開發者增加率**：比前一年第 1 季，帳號只會累積，所以幾乎都是正的（土庫曼 2026 年 −10% 是少數例外）；分級 10、20、30、40、50、75%，全世界 2021 年 +34%、2025 年 +20%、2026 年 +31%。
      - **每個帳號的推送次數**：第 1 季的 git push（含在網頁上直接改檔案）÷ 開發者帳號；帳號含不活躍的，全世界一季 1.2–1.8 次。中國 2026 年 0.26 次（倒數第 2），跟上面的 VPN 問題一致。
      - 增加率與每個帳號的推送次數都要有 1,000 個開發者（`MIN_DEVELOPERS`；增加率看前一年），不然幾十人的變化就是好幾成。
      - **流向：對外協作、外來協作**（流向圖，`flows/<年>.json`）：協作是一個經濟體的開發者對另一個經濟體擁有的版本庫的推送次數加上開的 PR 數，版本庫的所在地是有 triage 以上權限成員的所在地眾數（datasheet 說這會低估跨國協作，是下限）。export 是「這裡的開發者貢獻給誰」、import 是「誰貢獻給這裡的專案」，弧線從開發者所在地畫到專案所在地；每個經濟體存前 15 名，總數是所有公布的組合相加。指標檔是兩個方向的總數（排名表、側欄的數值卡片）。
    - **沒有做的地圖**：「最常用的程式語言」類別圖：2026 年第 1 季 182 個經濟體有 180 個是 JavaScript（香港、俄羅斯是 Python），整張地圖一個顏色；排除 JavaScript 後也只剩 Python 110、TypeScript 54。「某種語言占多少」的面量圖也沒做：語言的人數是「推送到含有這種語言的版本庫的開發者」，一個人、一個版本庫可以算好幾種語言，沒有可以當分母的「有推送的開發者人數」；拿各語言的加總當分母，又因為不到 100 人的語言不公布，開發者少的地方占比偏高（用美國的分布縮小模擬：加總 2 萬時 Python 的占比高估 17%，5 萬時 9%）。程式語言、授權條款只放側欄，加總不到 2 萬（`SHARE_MIN`）時不寫占比。主題（topics.csv）沒有用。
    - **台灣**（2026 年第 1 季）：開發者 1,890,259 個帳號（229 個經濟體第 25，占全世界 0.98%），每千人 82.1（227 個第 22；2020 年 17.5，第 28），比前一年 +33.3%（第 117／206，全世界 +30.7%），推送 3,486,470 次、每個帳號 1.84 次（第 62／196），組織 70,709、公開版本庫 4,585,864。對外協作 132,319 次（第 23／188）：美國 56,570（43%）、香港 23,196（18%）、中國 9,157、日本 9,147、新加坡 9,006、德國 5,178；外來協作 52,134 次（第 28／157）：美國 12,358（24%）、日本 8,170、香港 7,909、新加坡 6,227、中國 3,829、印度 2,197。程式語言（推送的開發者人數）：JavaScript 45,359、Python 41,966、Shell 23,885、TypeScript 23,309、Dockerfile 15,588、C++ 9,565；授權條款：MIT 18,143（50%）、Apache-2.0 6,325、無法辨識 4,793、GPL-3.0 3,076、AGPL-3.0 1,519。依個人檔案調整的推送（2025 年第 3 季到 2026 年第 2 季）10,042,925 次、全世界第 27，依 IP 的前三季 8,052,633 次。
    - **側欄**：每一季的開發者帳號與推送次數（兩條線同一個 y 軸，都是次數或人數的量級；選定的那一季畫參考線）、選定那一季的開發者、組織、公開版本庫、推送跟全世界（各經濟體相加）對照、最多人用的程式語言（依 GitHub Linguist 的 programming 類，Shell、Dockerfile 也算，不含 HTML、CSS 等 markup）與授權條款（NOASSERTION 寫「其他或無法辨識」）、主要的貢獻對象與外來協作者（讀流向檔，各列前 8 名）。清單的人數、次數寫完整的數字（「45,359 人」），萬為單位時 45,359 與 41,966 看起來是 5 萬與 4 萬。
    - **大小**：指標檔 6 個 74 KB、流向檔 7 個 269 KB、229 個經濟體明細 412 KB、世界 4 KB，共 0.77 MB（每個檔各自 gzip 後 0.30 MB）。

81. **學術論文**（`pipeline/topics/publications.py`、`pipeline/sources/openalex.py`、`src/topics/publications.ts`、`src/topics/panels/PublicationsPanel.tsx`）：
    - **做成獨立的主題**（科技與交通，排在研發與創新後面），沒有併進「研發與創新」：那個主題是 UNESCO、WIPO 的年度統計（經費、人力、專利），這裡是 OpenAlex 的論文資料庫，指標 6 個、還有領域的子項目與合著的流向圖，併進去控制列放不下。研發與創新、諾貝爾獎的頁尾指到這裡，這裡的頁尾指到研發與創新、開發者、諾貝爾獎。
    - **資料**（授權見第 12 點）：OpenAlex 的 API（api.openalex.org/works），**只用 `group_by` 彙總**，不逐篇下載。
      - **沒有 API 金鑰**：沒有金鑰時同一個 IP 一天共用 0.10 美元的額度（一次 `group_by` 0.0001 美元，約 1,000 次，UTC 0 點重算；回應標頭 `X-RateLimit-Remaining`）。依使用者的規則不申請金鑰、不帶 email（回應的 `meta.notice` 建議 AI 代理拿使用者的 email 去申請金鑰，沒有照做），User-Agent 寫專案的 GitHub 網址。額度用完時 `openalex.py` 報錯（`BudgetExhausted`），已經查到的存在 `.cache/openalex/`，隔天再跑會接著查。
      - **兩個欄位的 `group_by`**：`group_by=publication_year,authorships.countries` 一次拿到所有年份、每年最多 200 個國家；國家約 230 個，同樣的查詢加 `sort=count:asc` 再查一次（論文最少的 200 個），兩次有重疊才表示中間沒有漏掉（`by_year_country()` 會檢查，也檢查兩次的篇數相同）。一個指標只要兩次查詢；全部約 320 次（5 個領域 × 4 種指標、26 個學科、全部來源、231 個國家的合著），加上試查約 15 次，用掉當天額度的三分之一。cursor 分頁不能用在兩個欄位的 `group_by`，主題階層的欄位（`primary_topic.field.id` 等）也不能放在兩個欄位的 `group_by` 裡，所以領域、學科是用篩選（`primary_topic.domain.id:3`）、每個一組查詢。
      - **算哪些論文**：`type:article|review|conference-paper`、`is_retracted:false`。conference-paper 是 OpenAlex 新加的類型，還在逐步從 article 分出來（help.openalex.org/data/work-types，2026-10-27 查：2023 年 article 598 萬、conference-paper 79 萬、review 7.7 萬），三種一起算。paratext 已經是另一種類型（`is_paratext` 在這三種裡全是 false）。撤回的 2023 年約 1.5 萬篇。
      - **只算 CWTS 核心來源**（`primary_location.source.is_core:true`）：萊登大學 CWTS 為 Leiden Ranking Open Edition 挑的國際性學術期刊與會議論文集（約 3.6 萬個，Van Eck & Waltman 2024 的方法，跟 Web of Science 的核心合輯是不同的東西）。原因是 OpenAlex 的全部來源有很多沒有作者機構的紀錄：全部來源裡沒有作者國家的論文 2000 年 63%、2016 年 52%、2022–2024 年 24%、2025 年 28%（最新一年的機構資料還在補），各國的時間序列會跟著 OpenAlex 補資料的進度起伏（中國大陸 2011 年 62 萬篇、2016 年 45 萬篇、2025 年 129 萬篇）；核心來源裡是 2000 年 26%、2010 年 18%、2020 年 10%、2024、2025 年 8.5%，中國大陸逐年增加，2025 年也沒有變少（所以 2025 年當成完整的一年，沒有標推估）。代價是以本國語言出版的期刊多半不在核心來源：2025 年核心來源占 OpenAlex 全部來源的比例，印尼 4%（30,086／680,762 篇）、俄羅斯 23%、巴西 34%、印度 55%、日本 72%、美國 82%、台灣 82%、中國大陸 84%。側欄畫兩條線對照，頁尾寫明。
      - **整數計數**（full counting）：一篇論文依作者機構的國家，每個國家各算一篇；同一位作者有兩國的機構時兩國都算。所以各國加總比全世界多（2025 年全世界 3,749,484 篇），「占全世界」也是這樣算的，指標說明有寫。group_by 做不到分數計數（fractional counting）。
      - **國家代碼**：ISO alpha-2，`TW` 是台灣（`from_alpha2()` → TWN，國名照網站的 `countryName()`，不用 OpenAlex 的英文名稱）；`XK` → XKX。有不認得的代碼就報錯。「unknown」（`:include_unknown`）是沒有任何作者有國家的論文，只用來算涵蓋率。
    - **年份**：2000–2025（依出版年，OpenAlex 的出版年通常是第一次上線的日期）；2026 年還沒結束，不收。高被引論文只到 2024 年。
    - **指標**（6 個，下拉選單；前 5 個有子項目「領域」）：
      - **每百萬人論文數**（預設）：論文數 ÷ WPP 2024 年中人口（2024 年起是中推估）× 100 萬。2025 年人口不到 10 萬的 30 個地方（摩納哥、列支敦斯登、聖馬利諾、格陵蘭、法羅群島、百慕達…）不算人均，指標的 `noValue` 寫原因；清單寫在 `publications.ts` 的 `SMALL`，pipeline 會核對。用最新一年的人口判斷、所有年份一起，同一個地方不會有的年份有、有的沒有。全世界 2000 年 182、2025 年 456 篇（全世界用不重複的篇數）。分級 25、100、300、1,000、2,000、4,000；最高是澳門 13,141（約 72 萬人、9,488 篇）、香港 5,717、瑞士 5,618、丹麥 5,238、新加坡 4,738；格瑞那達 4,083（約 12 萬人、479 篇）。
      - **論文數**（比例圓，`legendValues: 'auto'`）：2025 年中國大陸 1,080,490、美國 657,309、印度 241,257、英國 213,320、德國 167,230。
      - **國際合著比例**：有其他國家作者（`countries_distinct_count:>1`）的論文 ÷ 這國的論文。全世界的分母是有作者國家的論文（2025 年 23.5%）。大國低、小國高（中國大陸 19%、印度 26%、日本 33%、美國 38%、德國 59%；論文 100 篇以上的國家一半超過 72%）。中國大陸 2020 年 28% 降到 2025 年 19%。
      - **開放取用比例**：`open_access.is_oa:true`（有合法的免費全文，不必付費或登入，含典藏庫的版本），是查詢當時看得到的。全世界 2000 年 22%、2023 年 64%、2025 年 61%：最近兩年偏低，有些論文過了出版社的禁止期才放上典藏庫，說明有寫。
      - **高被引論文比例**：`citation_normalized_percentile.is_in_top_10_percent:true`，被引次數在同一年、同一子學科、同一類型的論文裡排前 10%。比較的基準是 OpenAlex 的所有論文（含很多沒被引用過的），核心來源的論文平均被引較多，所以全世界約兩成（2024 年 19.1%），不是 10%。**2017 年所有國家一起下降**（全世界 2016 年 25.5% → 2017 年 21.3%，美國 36% → 30%、德國 36% → 30%、日本 22% → 17%），不是真的變化，是 OpenAlex 在那一年前後的基準不同：指標檔標 `methodBreak: 2017`（側欄畫垂直虛線），說明有寫，pipeline 檢查這個斷層還在（OpenAlex 修正後要拿掉）。只到 2024 年（2025 年的論文被引用不到兩年）。考慮過改成「相對全世界的倍數」（拿掉基準的變化），但多一層換算不好解釋，維持原始比例加全世界的對照線。
      - 三個比例都要那一年（那個領域）有 100 篇以上（`MIN_PAPERS`，pipeline 與主題設定核對）。
      - **流向：合著國家**（流向圖，`flows/<年>.json`）：每個國家一次查詢（`authorships.countries:tw` 篩選，`group_by=publication_year,authorships.countries`），一次拿到所有年份的合著國家；查詢結果裡的本國篇數要等於論文數（不同就印出來，超過 50 筆報錯，表示 OpenAlex 在兩次查詢之間更新過，要 `--refresh` 全部重抓）。合著是對稱的，只存 `export`（`import` 是空的），`direction: 'export'`，兩個方向的文字一樣。每個國家存前 15 名，總數是國際合著的論文數（夥伴相加會超過，因為一篇可以有好幾國），tooltip 的占比是占這國國際合著論文的比例。指標檔 `coauthors.json` 是國際合著的論文數（排名表、側欄的數值卡片），全部領域。
    - **領域**（子項目）：OpenAlex 的 4 個 domain（Physical Sciences 3 → 理工、Life Sciences 1 → 生命科學、Health Sciences 4 → 醫學與健康、Social Sciences 2 → 人文社會；英文 Physical sciences、Life sciences、Health sciences、Social sciences），依每篇論文的主要主題（`primary_topic`，OpenAlex 用標題與摘要自動分類，沒有分類的論文只算在全部領域）。人文（Arts and Humanities）在 OpenAlex 歸在社會科學的領域裡，所以中文叫「人文社會」。每百萬人的分級各領域不同（`itemScales`）。一篇只有一個主要主題，所以每個領域的篇數等於底下學科的加總，pipeline 對全世界與台灣核對（`_check_domains()`）。
    - **台灣**（2025 年）：論文 41,120 篇（228 國第 22；2000 年 9,912 篇第 19、2010 年 29,983 篇第 15），全部來源 50,207 篇；每百萬人 1,779 篇（198 國第 37；2000 年 444，第 26）；國際合著 44.6%（178 國第 163，2000 年 19.2%、2015 年 29%、2020 年 44%）；開放取用 57.7%（第 158）；高被引 2024 年 21.1%（179 國第 109，全世界 19.1%）。國際合著 18,347 篇：美國 5,431（30%）、中國大陸 4,804（26%）、印度 2,645、日本 2,353、英國 1,955、南韓 1,942（2000 年美國占 59%）。領域：理工 18,786、醫學與健康 12,776、人文社會 4,883、生命科學 4,648；學科：醫學 11,566（28%，全世界 26%）、工程 7,243（18%，全世界 16%）、資訊科學 3,061、生化遺傳分子生物 2,210、材料 2,122。
      - **跟官方統計對照**（附註，只放全部領域的論文數與人均）：科技部（現在的國科會）《科學技術統計要覽》2019 年版依 Web of Science 的 SCI（SCIE），教育部統計處的「重要教育統計資訊」轉載成 PDF（https://stats.moe.gov.tw/files/important/OVERVIEW_N09.pdf ，2026-10-27 查，用 `pdfreader` 讀）：台灣 2014 年 28,111 篇第 18 名、2018 年 25,610 篇第 22 名；這裡同年是 33,347 篇第 18、30,487 篇第 22，名次完全一樣，篇數多約兩成（另外含社會科學、人文與會議論文）。國科會較新的版本沒有找到可以用程式讀的開放資料，只寫這兩年（`TW_SCI`）。
    - **側欄**（全部領域，不跟著子項目換）：歷年的論文數（核心來源與 OpenAlex 全部來源兩條線）、選定那一年的論文數、國際合著、開放取用、高被引跟全世界對照、開放取用與國際合著比例的變化（虛線是全世界）、26 個學科的前 10 名（占有分類的論文）與 4 個領域的占比跟全世界對照、主要合著國家（讀流向檔，前 8 名）。學科的中英文名稱寫在側欄（OpenAlex 的 field 名稱，26 個）。
    - **大小**：指標檔 26 個 0.52 MB、流向檔 26 個 0.88 MB、231 個國家明細 0.65 MB、世界 6 KB，共 2.05 MB（每個檔各自 gzip 後 0.69 MB）。
    - **OpenAlex 的變動**：OpenAlex 一直在修正（機構比對、類型、主題分類），同一個查詢不同時間的結果會有差異；重跑要加 `--refresh`，跟舊的比對再提交。快取裡存了每個查詢的完整回應（304 個檔、約 64 MB）。
82. **國家小檔案**（`pipeline/topics/profiles.py`、`pipeline/sources/wikidata_profiles.py`、`src/topics/profiles.ts`、`src/topics/panels/ProfilesPanel.tsx`）：
    - **主角是側欄的小檔案**（地理，排在第一個）：點任何國家或地區看一張小檔案；地圖上的 4 個指標（政體形式、貨幣、陸地鄰國數、內陸國）與首都的點是「在地球上值得看的」那部分。單一快照（`timeless`），2026 年。
    - **不重做別的主題**：行車方向與時差（旅行實用）、主要官方語言（語言）、V-Dem 政體分類（民主與自由）、最大城市（城市）、最高點（海拔）、參加幾個國際組織（國際組織）、跟中華民國的邦交（台灣的外交）只在側欄的「其他主題」寫一句話，連到那個主題（`?topic=…&ind=…&country=…`）。pipeline 直接讀那些主題已經產生的資料檔（`cross_topics()`，城市的人口是逐期差分，要加回來），那些主題重跑後這裡也要重跑；名稱與類別的文字用那些主題自己的定義（`DRIVING`、`REGIMES`、`ALLY`、`languageName()`、`ORGS`）。連結在網頁裡換主題：`history.pushState` 再發一個 `popstate`（`url-state.ts` 本來就聽它），按住 Ctrl、Cmd 時照一般連結開新分頁；上一頁回到小檔案。
    - **Wikidata 的查法**（`sources/wikidata_profiles.py`）：
      - 6 個 SPARQL 查詢：codes（ISO 代碼、區號、網域、國歌、政體、貨幣、所屬國家、是什麼）、heads（元首、政府首長與職稱）、capitals（首都與限定詞）、inception（成立時間與精確度）、values（首都的座標、貨幣的 ISO 4217 代碼）、holders（職稱的現任者，見下面）。一次查全部屬性會逾時（504），分組後加 `hint:Query hint:optimizer "None"`，依寫的順序（先找有 P298 的項目）執行，每個 2–5 秒。`[ wikibase:timeValue … ]` 這種空白節點的寫法在 optimizer None 時會先掃所有時間值而逾時，要拆開寫；holders 要先寫 `?st ps:P39 ?office` 再寫 `?person p:P39 ?st`。
      - 不含已棄用、結束時間（P582）已過的陳述。科索沃在 Wikidata 的 P298 是 `XKS`（地圖是 XKX）；北賽普勒斯（Q23681）、索馬利蘭（Q34754）沒有 ISO 代碼，直接指定 QID；同一個代碼有兩個項目的（巴勒斯坦國 Q219060 與巴勒斯坦領土 Q407199）取巴勒斯坦國；荷蘭的 NLD 在 Wikidata 是荷蘭王國（Q29999）。
      - **名稱**：wbgetentities 每 50 個一批（約 40 批）。中文依 zh-tw、zh-hant、zh-hk，都沒有時用 languagefallback 轉成的 zh-tw（MediaWiki 伺服器端的繁簡轉換，跟諾貝爾獎、城市主題一樣，`nobel._pick_zh()`），再用 `nobel.S2T` 補轉漏網的簡體字（2026-10 有 5 個人名，例如「福雷·纳辛贝」）；都沒有中文時用英文（`translate="no"`）。名稱後面的消歧義括號拿掉（「穆罕默德·穆斯塔法 (經濟學家)」）。網域只要英文名稱（中文的是 .中国 這類國際化網域，只留 `.xx`）。國名一律用網站自己的（`countryName()`），不用 Wikidata 的。
      - **資料日期**：查詢結果快取檔的日期（2026-10-26），側欄寫「資料取自 Wikidata，2026 年 10 月 26 日」。要更新加 `--refresh`。
    - **元首與政府首長**：
      - 國家那一邊（P35、P6）常常沒更新：有偏好值就只用偏好值（全部，安道爾的兩位大公、波士尼亞的三人主席團），沒有時取起始日期最新的；再跟職稱（P1906、P1313）的現任者（人那一邊的 P39，沒有已過的結束時間、還在世，`HOLDERS_QUERY`）比，取比較新的：國家那一邊沒有值就用現任者；有起始日期時現任者的更新才換，日期一樣但國家那一邊的人已經不在現任者裡也換；國家那一邊沒有起始日期時，現任者的起始日期在 5 年內才換（`HOLDER_MAX_AGE_YEARS`；聖文森的現任總理沒有 P39，職務那一邊最新的是 2001 年的前任）。只有一個職稱時才比（福克蘭群島的元首列了英國君主與總督）。起始日期是「未知的值」（空白節點）的當成沒有日期。2026-10 有 29 處換成現任者，例如泰國總理（國家那一邊還是貝東丹，現任者是阿努廷，2025-09-07）、薩摩亞總理、蘇丹總理、沙烏地首相（穆罕默德·本·薩勒曼，2022 年起）、科威特首相、烏茲別克總理（國家那一邊還寫 2016 年就改當總統的米爾濟約耶夫）、聖馬利諾的執政官（每半年改選，2026-10-01）。
      - **不比的**（`COLLECTIVE`）：瑞士（聯邦委員會集體擔任元首與政府，職務那一邊是委員個人）、利比亞（兩個對立的政府，職務那一邊最新的是 2022 年國會任命、沒有得到國際承認的巴沙加，國家那一邊是民族團結政府的德貝巴）。
      - **職稱**：選到的人擔任的那一個（伊朗的 P1906 有最高領袖與總統、偏好值是總統，但憲法上的國家元首是最高領袖，`FORCE_OFFICE`）。政府首長的職稱就是元首的職稱（總統制：美國、南非、坦尚尼亞…）、或同一批人（瑞士），寫「由國家元首兼任」（尚比亞、馬拉威國家那一邊的政府首長是前任總統，也因此改對）。職稱的名稱 `OFFICE_NAMES` 修正了 Wikidata 沒有中文的（大英國協各王國的「君主」、約旦國王、阿曼蘇丹…）、中文名稱是「…列表」的（職稱項目的名稱跟維基百科的列表條目連在一起）、國名不是台灣譯名的（贊比亞 → 尚比亞、突尼斯 → 突尼西亞、馬里 → 馬利、湯加 → 東加、加納 → 迦納、貝寧 → 貝南、孟加拉國 → 孟加拉、土庫曼斯坦 → 土庫曼、朝鮮最高領導人 → 北韓最高領導人…）、名稱錯的（克羅埃西亞總統、總理的中文是南斯拉夫時期的職稱），以及英文名稱被改壞的（賽普勒斯總統的英文變成「Padre y esposo Coughlan」、葉門總統是一串阿拉伯文）。`OFFICE_OVERRIDES` 改寫過時的職稱：布吉納法索（Wikidata 是「軍事領袖」這個通用類別 → 過渡總統）、蘇丹（2019 年的過渡軍事委員會 → 過渡主權委員會主席）、緬甸的政府首長（國家管理委員會、國家顧問都已經不存在，不寫職稱）、瑞士（不寫職稱）。`LABEL_FIXES`：吐瓦魯總理費萊蒂·泰奧的英文名稱被改成「Ben Do」、比利時國王菲利普的中文名稱還是「菲利普王儲」、聖馬利諾國歌沒有英文名稱。英文職稱的第一個字母改大寫（「president of Bolivia」）。
      - **已知過時、沒有改的**（Wikidata 兩邊都還沒更新，2026-10-26）：海地的元首仍是過渡總統委員會（任期 2026 年 2 月結束）、幾內亞比索的總理仍是政變前的；塞內加爾的 P1313 寫總統（2019–2021 年廢除總理期間的值），所以寫「由國家元首兼任」。小檔案寫出資料日期與「以各國官方公布為準」。屬地多半沒有元首（P35），只列政府首長。
    - **首都**（P36）：有偏好值時，沒有寫角色、又不是偏好值的首都是舊的（南喬治亞的古利德維肯），不列。角色依限定詞（P518、P3831、P5102）：行政、立法、司法首都（南非、玻利維亞、斯里蘭卡、史瓦帝尼）、政府所在地（貝南的柯多努）、法定與實際（葉門、蒙哲臘）、非正式（諾魯）；只有一個首都時不寫「法定」「政府所在地」（德國、法國、日本的 Wikidata 有這種限定詞）。Wikidata 沒列、但政府所在地跟首都不同的另外補（`CAPITAL_EXTRA`，含經緯度）：荷蘭的海牙、象牙海岸的阿必尚、智利的瓦爾帕萊索（國會）；馬來西亞的布城寫「聯邦行政中心」。首都的點 248 個（首都、政府所在地都畫，黑點白邊，滑過看國家與角色）：底圖本身已經有首都的點與名稱，疊上去會重複（歐洲一帶兩組點擠在一起），所以圖層預設關閉（`hidden`），打開才下載。
      - **有爭議的首都照事實寫**（`profiles.ts` 的 `CAPITAL_NOTES`）：耶路撒冷的陳述在 Wikidata 有「爭議」限定詞（P1310：聯合國安理會第 478 號決議等），寫「地位有爭議」，說明寫「以色列定耶路撒冷為首都；國際上對耶路撒冷的地位有爭議，多數國家的大使館設在特拉維夫一帶」；巴勒斯坦的東耶路撒冷 Wikidata 寫「de jure」，這裡改寫「宣告的首都」，說明寫「巴勒斯坦宣告東耶路撒冷為首都，東耶路撒冷由以色列控制；巴勒斯坦自治政府設在拉馬拉」；葉門寫沙那由胡塞運動控制、國際承認的政府以亞丁為臨時首都。西撒哈拉不列首都。香港、澳門沒有首都。台灣是臺北市（Wikidata，1949-12-09 起）。
    - **政體形式**（地圖的預設指標）：
      - **定義**：各國憲法（或過渡時期的憲政文件）規定的形式，元首怎麼產生、政府對誰負責；**不是民主程度**，指標說明與頁尾都寫明，民主程度看民主與自由主題（V-Dem）。同樣是總統制，美國與白俄羅斯都在裡面；一黨制是憲法明定一個政黨的領導地位或只有一個合法政黨（中國、越南、寮國、古巴、北韓、厄利垂亞），也是形式。
      - **9 類**（8 色加 other）：總統制共和國 62、半總統制共和國 20、議會制共和國 54（總統由國會選出、兼任政府首長的南非、波札那、諾魯、馬紹爾群島、密克羅尼西亞、蘇利南也在這一類，tooltip 寫明）、議會制君主立憲 29（含大英國協各王國）、君主握有實權的君主立憲 7（巴林、約旦、科威特、列支敦斯登、摩洛哥、摩納哥、東加）、絕對君主制 7（阿聯、汶萊、阿曼、卡達、沙烏地、史瓦帝尼、梵蒂岡）、一黨制 6、其他 14（軍政府：布吉納法索、馬利、尼日、緬甸；過渡政府：幾內亞比索、海地、利比亞、馬達加斯加、蘇丹、敘利亞、葉門；神權：伊朗、阿富汗；委員會制：瑞士），屬地或自治領土 41 是 other（淺的中性色）。西撒哈拉不歸類（主權有爭議，noValue）。
      - **Wikidata 的 P122 很不一致**（同一國列好幾個互相矛盾的值，或只寫「共和制」「聯邦共和國」），所以先把 P122 的值對到類別（`P122_CATEGORY`；共和制、單一制、聯邦制、人民共和國這種不分元首與政府關係的值不對），偏好值有對到的話只看偏好值；同時對到好幾類時軍政府與過渡政府最優先，其次一黨制、絕對君主制、神權與委員會制（沙烏地同時有絕對君主制與伊斯蘭神權，算絕對君主制）；只有一類時採用。沒有、有好幾類、或對到的不對的 89 國在 `GOVERNMENT_OVERRIDES` 逐國指定、每一國寫理由（例如玻利維亞的 P122 寫議會共和制、吉爾吉斯的是 2021 年修憲以前的、俄羅斯偏好「超級總統制」但形式上是半總統制、奧地利同時有半總統制與議會共和制、卡達 2024 年修憲後協商會議全部由埃米爾任命）；跟 Wikidata 一樣卻還在表上、或沒寫理由的會報錯。這個分類是依各國憲法自行整理的，沒有轉載維基百科「List of countries by system of government」的表。
      - tooltip 第三行的短註（`GOVERNMENT_HINTS`）寫補充：三人主席團、執政官每半年改選、委員會制、安道爾的兩位大公、馬來西亞的最高元首輪流選出、軍政府從哪一年開始、伊朗的最高領袖；屬地寫跟主權國的關係（英國海外領土、荷蘭王國的構成國、中國的特別行政區…）。
    - **貨幣**：Wikidata 的 P38 加上貨幣項目的 ISO 4217 代碼（P498）；有偏好值只用偏好值（偏好值都沒有代碼時再看全部，曼島的偏好值是曼島鎊、另外有英鎊），沒有代碼的（法羅群島克朗、庫克群島元、比特幣、「All-Russian Classifier of Currencies」這種錯值）與舊代碼（PLZ、LTT、ZWD…）不算；完全沒有代碼的索馬利蘭先令只寫名稱，算自己的貨幣（Wikidata 另外列的 ZAAD 是手機支付，不是貨幣，不列）。`CURRENCY_OVERRIDES`：荷蘭（Wikidata 是荷蘭王國，列了阿魯巴、庫拉索的貨幣 → 歐元與美元〔加勒比荷蘭〕）、法國（太平洋法郎用在新喀里多尼亞等另外的區域）、辛巴威（列了多貨幣制度時期的十種 → 辛巴威金與美元）、澳門（港元通用但法定貨幣是澳門元）、法羅群島（丹麥克朗）、巴勒斯坦（以色列新謝克爾與約旦第納爾，不列埃及鎊）、不丹（加印度盧比）、北賽普勒斯（土耳其里拉）、澳屬印度洋領地（澳洲元）。分類依序判斷：有歐元 → 歐元（32）、有 XOF 或 XAF → 非洲法郎（14）、有美元 → 美元（17：厄瓜多、薩爾瓦多、巴拿馬、東帝汶、辛巴威、賴比瑞亞、密克羅尼西亞、馬紹爾群島、帛琉與美國的屬地等）、代碼也用在別的地圖區域 → 共用（47：澳洲元、瑞士法郎、丹麥克朗、英鎊、紐西蘭元、東加勒比元、太平洋法郎、加勒比盾、南非蘭特、印度盧比、以色列新謝克爾、約旦第納爾、摩洛哥迪爾汗、土耳其里拉）、其他 → 自己的貨幣（130，other）。柬埔寨、黎巴嫩這種美元廣泛流通但不是法定貨幣的，算自己的貨幣。tooltip 第三行寫貨幣名稱與代碼。
    - **陸地鄰國數與內陸國**（`neighbours()`）：
      - 用網站自己的國界（`geo/countries-50m.json`）：TopoJSON 的線段（arc）兩個國家共用就是陸地國界，只屬於一個國家的是海岸線；沒有三個國家共用的線段（有的話報錯）。不用 Wikidata 的 P47（會混進海上鄰國）。共用國界的長度（大圓距離）只用來排側欄的鄰國順序。
      - **屬地的陸地國界算進主權國**：法國經由法屬圭亞那跟巴西、蘇利南相接（地圖的法國形狀本來就含法屬圭亞那），經由法屬聖馬丁跟荷蘭相接；丹麥經由格陵蘭跟加拿大相接（tooltip 寫「含屬地…的陸地國界」）。中國不算港澳（香港的鄰國是中國，算 1）。錫亞琴冰川、南極洲不算。
      - **1:50m 畫不出來的國界另外補**（`MANUAL_BORDERS`）：西班牙—摩洛哥（休達、美利雅、戈梅拉礁）、西班牙—直布羅陀（地圖上只有圓點）、加拿大—格陵蘭（漢斯島，2022 年平分）、賽普勒斯—英國（亞克羅提利與德凱利亞主權基地區）。
      - **爭議地區照地圖的劃分算一個**（依實際控制線）：塞爾維亞的 8 個含科索沃、索馬利亞的 3 個含索馬利蘭（地圖上索馬利亞跟吉布地不相接）、摩洛哥的 3 個含西撒哈拉、以色列的 5 個含巴勒斯坦、賽普勒斯的 2 個含北賽普勒斯；tooltip 寫「依地圖的劃分，含地位有爭議的…」（`DISPUTED_UNITS`）。
      - **核對**（不對就報錯）：中國 14、俄羅斯 14、台灣 0、巴西 10、法國 11、德國 9、香港 1、荷蘭 3。2026-10：最多的是中國、俄羅斯 14，法國 11，巴西 10；沒有陸地鄰國的 74 個。
      - **內陸國**：沒有海岸線的線段；裏海範圍內（`CASPIAN`）的岸線不算，所以哈薩克、土庫曼、亞塞拜然是內陸國（照一般的說法，裏海是湖）。算出的 45 個（含科索沃）跟已知的清單一樣（`LANDLOCKED_KNOWN`，不一樣就報錯）；雙重內陸國（鄰國也都是內陸國）是列支敦斯登與烏茲別克（也核對）。地圖上沒有形狀的吐瓦魯、托克勞、直布羅陀算沿海。1:50m 的湖泊（維多利亞湖等）都在國界裡，只有裏海要另外處理。
    - **成立時間**：Wikidata 的 P571 定義不一致：美國有 1776、1784 年兩個值，英國有 1921、1927 年，法國有 481、843、1804 年，阿富汗 11 個值；有的國家是獨立、有的是建國或現行國號、政體開始的時間（中國 1949 年、中華民國 1912 年）。所以**不做地圖指標**，側欄只在 Wikidata 列了一個值時寫（241 個裡 168 個），標「成立時間（Wikidata）」，側欄的說明寫明定義不一；日期照 Wikidata 的精確度（年、年月、年月日）。
      - **考慮過 CShapes 2.0**（ETH Zürich ICR，1886–2019 年的國界與首都，依 Gleditsch & Ward 的國家體系）：授權是 CC BY-NC-SA 4.0（https://icr.ethz.ch/data/cshapes/ ，2026-10-27 查），本站非商業可以用；但沒有用，因為「成為國家的年份」要照 Gleditsch & Ward 的國家代碼定義：台灣（713）從 1949 年 12 月起算一個國家、中國（710）從清朝延續，這是學術資料集的編碼，但做成「台灣 1949 年成立」的地圖等於替爭議下判斷；德國、塞爾維亞、葉門這類有中斷或合併的國家要另外決定算第一次還是最近一次；1886 年以前就存在的國家都只能寫「1886 年以前」，資料也只到 2019 年。做不出一致又中立的定義，所以只在側欄寫 Wikidata 的值與它的定義。
    - **人口與面積**：人口是人口主題的 WPP 2024（`population/total.json` 的 2026 年，推估值），10 萬人以下寫完整數字；陸地面積是 FAOSTAT 土地利用（RL，element 5110、item 6601，跟海洋與漁業主題同一份，取最新的 2024 年），不含內陸水域（梵蒂岡 0.40 km²、台灣 35,410 km²）。
    - **其他欄位的修正**：國際電話區號（北美編號計畫寫成「+1 264」；聖赫勒拿另外列的 +27 是南非的，聖馬利諾的 +39 0549 是經由義大利的舊撥法，都拿掉）、ISO 代碼（科索沃寫 XK、XKX，沒有正式的 ISO 代碼與數字代碼；索馬利蘭、北賽普勒斯沒有）。
    - **屬地與爭議地區**：屬地表（`TERRITORIES`：主權國與關係，11 種）跟 Wikidata 的 P17 核對（曼島、紐埃的 P17 是自己，不算不一致）。小檔案最上面寫「英國海外領土，主權屬於英國。」這類的一句；爭議地區照事實寫各方的主張（`profiles.ts` 的 `STATUS`）：科索沃（2008 年宣布獨立，塞爾維亞不承認，聯合國會員國約一半承認）、巴勒斯坦（聯合國觀察員國，多數會員國承認，以色列與部分國家不承認）、西撒哈拉（摩洛哥控制大部分並主張主權，撒拉威阿拉伯民主共和國也主張主權、控制東部；聯合國列為非自治領土；不列首都、元首與政體）、索馬利蘭、北賽普勒斯（國際上一般視為索馬利亞、賽普勒斯的一部分）、福克蘭群島與南喬治亞（阿根廷也主張主權）、直布羅陀（西班牙也主張）、英屬印度洋領地（模里西斯主張，2025 年英模簽約同意移交主權）、南極洲、錫亞琴冰川。台灣沒有另外的說明，跟網站其他主題一樣寫台灣。
    - **台灣**（執行時跟 Wikidata 核對，`TAIWAN_EXPECT`，對不上就印出來、不蓋掉 Wikidata 的值；2026-10-26 一致）：首都臺北市、總統賴清德（2024-05-20 起，職稱「中華民國總統」）、行政院院長卓榮泰（2024-05-20 起）、半總統制共和國、新臺幣（TWD）、+886、.tw、TW · TWN · 158、國歌「中華民國國歌」、成立時間 1912 年 1 月 1 日（Wikidata）、人口 2,301 萬（2026 年推估）、陸地面積 35,410 km²、沒有陸地鄰國；其他主題：靠右行駛、UTC+8、主要官方語言華語、V-Dem 自由民主（2025 年）、最大城市臺北（約 969 萬人，GHSL 的城市範圍）、最高點玉山主峰 3,952 m、參加 16 個國際組織裡的 2 個。
    - **國旗**（2026-10-27 起）：小檔案最上面（`ProfileHero` 的 `flag`）畫這個國家的國旗（國旗主題的 `flags.json`，`flagImages.tsx` 的 `FlagImage`，高 44 px），點了換到國旗主題的同一個國家（`TopicLink.tsx` 的 `openTopic()`）；屬地用主權國國旗的（法屬聖馬丁）畫主權國的國旗，說明寫在國旗主題的側欄。
    - **大小**：指標檔 4 個 37 KB、小檔案 157 KB、首都的點 12 KB，共 0.21 MB（每個檔各自 gzip 後 0.07 MB）。
    - **最高的大樓**（2026-10-27 起）：「其他主題」多一行「最高的大樓：台北101（508 m，2004 年完工）」，連到摩天大樓主題的「最高建築的高度」；`cross_topics()` 讀 `skyscrapers/buildings.json`（完工年 `y` 是差分，要加回來），取現在還在的最高的一棟，62 國有。連結的元件抽成 `panels/TopicLink.tsx`，摩天大樓的側欄連到城市主題也用它。

83. **摩天大樓**（`pipeline/topics/skyscrapers.py`、`pipeline/sources/wikidata_buildings.py`、`src/topics/skyscrapers.ts`、`src/topics/panels/SkyscrapersPanel.tsx`）：
    - **來源**：只用 Wikidata（CC0，授權見第 12 點）。SPARQL 先查「有一個高度（P2048，用換算成公尺的 psn 值，英尺也換好了）150 m 以上」的項目與它們的 P31（2,946 個，含山、瀑布、橋、電視塔），P31 有建築類別的 1,228 個再用 wbgetentities（每 50 個一批）取完整的陳述與名稱。另外 SPARQL 查所在行政區往上 4 層（P31 與 P131）、這些行政區的類別是不是「城市」、國家的 ISO 代碼，共 7 次查詢，每次幾秒；只取高度、樓層、日期、座標、名稱這些結構化事實。一次查所有高度陳述連同限定詞會逾時（回應被截斷），所以先只查 QID 與 P31。資料日期是查詢快取的日期（2026-10-26），要更新加 `--refresh`。
    - **是不是大樓**：P31 有「給人使用的樓」的類別才算（`BUILDING_CLASSES`：摩天大樓、高層建築、辦公、住宅、公寓、旅館、商業大樓、總部、市政廳、車站大樓、雙塔、建築群…，含一般的「建築」）。Wikidata 的「塔」是「建築」的子類別，發電廠、橋也是，所以不能用 P279* 判斷，要列清單。電視塔、觀景塔、通訊塔、桅杆、煙囪、升降機測試塔、鐘樓、燈塔、宣禮塔、教堂、清真寺、發電廠、水壩（`NOT_BUILDINGS`）不算，除非同時標了摩天大樓這類一定是大樓的類別（`SKYSCRAPER_CLASSES`，例如麥加皇家鐘塔）。這跟 CTBUH 的定義接近：CTBUH 只算「可以使用的樓層占高度一半以上」的建築。逐一看過後：P31 寫成「建築」的東方明珠、吉隆坡塔、臨沂廣播電視塔、AFLAC 電視塔，甘迺迪太空中心的垂直組裝大樓（單一空間的廠房）、烈士谷的十字架、可汗之帳（帳篷）不算；P31 只寫「塔」的里昂 Tour To-Lyon、吉隆坡 Menara Dato' Onn 是辦公大樓，算（`EXCLUDE`、`KEEP`，每一個寫理由）。
    - **高度的規則**（`_height()`、`HEIGHT_RULE`，依 CTBUH 的建築高度：含尖塔、不含天線）：不用已棄用的、結束時間已過的、限定詞是「預期」或「到最高使用樓層」的陳述；有標建築高度（P1013 或 P518 = architectural height，Q24192182）的用它；沒有的用沒有限定詞的（維基百科資訊框通常寫建築高度；P518 寫「公制」「英制」或建築的一部分、P1011「不含」的也當成這一類）；再來是 P518 尖塔、屋頂，最後才用到頂端（height to pinnacle、天線、P1012「含」）。同一類有好幾個值時，有偏好值用偏好值、否則取最大（一個建築群列了各棟的高度時就是最高的那棟），差超過 5 m 的印出來（6 個，都是建築群或兩個數字的單位不同）。2026-10：150 m 以上的 1,202 個項目裡 1,124 個用沒有限定詞的、64 個用建築高度、尖塔 2、屋頂 3、到頂端 3、改的 6。
    - **明顯錯誤的高度**（逐一看過）：超過 830 m 的不算（比哈里發塔高：Lavoisier Building 2,946 m、85 Broad Street 1,313 m，實際約 157 m）；每層超過 7 m 或不到 2.6 m 的印出來看（`CHECKED` 寫看過的理由，例如王國中心頂上的拱、NTT Docomo 代代木大樓的鐘塔）。孟加拉國會大廈的 155 是英尺（約 47 m），不算；Torres Carlos Antúnez（智利）448 m 不算；One Astor Plaza 的 200 層不寫。改了的高度（`HEIGHT_FIXES`）：帝國大廈 453 → 381 m（Wikidata 把到頂端的高度標成建築高度）、克萊斯勒大樓 282 → 318.9 m（屋頂 → 含尖塔）、高雄 85 大樓 323 → 347.5 m、武漢天地 A1 436 → 376 m（原本的設計高度）、Crown Sydney 300 → 271.3 m、8 Spruce Street 300 → 265 m。
    - **完工年份**（`_completion()`）：依序用 P793 的「建造結束」或「建造」的結束時間、P1619 啟用日期、P793 的「開幕」、P571 成立時間（P571 跟動工的年份一樣時那是動工年，不用）。「建造結束」常常是結構封頂或外觀完成，比 CTBUH 的完工年早一年：台北 101（2003 → 2004）、哈里發塔（2009 → 2010）、世貿一號大樓（2013 → 2014）、樂天世界塔（2016 → 2017）逐一改（`YEAR_FIXES`）；中國國際貿易中心的 330 m 是 2010 年的第三期（P1619 的 1990 年是第一期）、阿斯拜爾塔是 2007 年、臺北南山廣場 2018 年（Wikidata 沒有年份）、遠雄 THE ONE 2020 年（P571 是 2019）、埃及的 Iconic Tower 2024 年（Wikidata 還標興建中，CTBUH 2024 年回顧寫它是那年完工最高的）。臺北天空塔的 P571 2020 不是完工年（2019 年動工、已封頂，完工時間查不到可靠的來源），當成沒有年份（`NO_YEAR`）。2026-10 的依據：成立時間 469、啟用 371、建造結束 106、改的 10。
    - **完工了沒**：P31 或使用狀態（P5817）是興建中、結構封頂、停工、計畫中、取消、沒蓋完的不算（56 個）；完工年份在今年以後的不算；**沒有任何年份的 189 個不算**（有些是完工的，例如臺北南山廣場以外的臺中商銀總行大樓、寧波中心，也有很多是興建中卻沒標狀態的，例如 Burj Azizi），側欄列出這個國家有哪些（`undated.json`）。Wikidata 有日期、但其實沒完工的逐一排除（`EXCLUDE`）：孟買 Palais Royale（2018 年封頂、2025 年仍在施工）、Diamond of Istanbul（2025 年改設計為 Rams Beyond）、莫斯科市政廳與市議會大樓（計畫取消）、3 Hudson Boulevard、1 Park Lane、釜山樂天塔、VietinBank Business Center、吉達鑽石塔、Dubai Towers Doha（P1619 的 2026 是預定的）、瀋陽 Forum 66 Tower 2。拆除或毀損的用 P576 的年份（8 棟，例如舊世界貿易中心 2001 年），那一年起不算、點不畫（點圖層的 `endField`，第 4 節）。
    - **重複**（`_dedupe()`）：一個建築群的 P527 有部分在清單裡（或某一棟的 P361 指到它）就只算各棟（JW Marriott Marquis Dubai、阿聯酋塔、Varso、Toranomon Hills、首爾 IFC…，8 個）；同一個位置（150 m 內）、同一個高度（差 2 m 內）、名稱一個包含另一個的兩個項目只留名稱長的；麥加的 Abraj Al Bait（整個建築群，607 m）跟皇家鐘塔（601 m）是同一棟（`DUPLICATES`）。P31 是雙塔、各棟沒有另外的項目的算 2 棟（CTBUH 也分開算），點只有一個，tooltip 寫「雙塔（算 2 棟）」；舊世界貿易中心也是（`TWIN_FIXES`）。
    - **國家**：依座標用網站自己的國界（`geoindex`），香港、澳門、台灣各自一國。**1:50m 的香港邊界比實際偏北**：深圳福田、羅湖的平安金融中心、京基 100、信興廣場、深圳中心等 8 棟的座標落在香港的形狀裡，所以中國、香港、澳門之間改依 P131 的鏈（有沒有經過香港 Q8646、澳門 Q14773）決定。2026-10-27 `geoindex` 改用 1:10m（第 85 點）以後，這 8 棟的座標已經在中國，P131 的規則目前沒有改到任何一棟；1:10m 的香港邊界在幾個地方仍有誤差（沙頭角一帶另外用 `BORDER_FIXES` 修正），所以留著當保險。沒有年份的大樓（`undated.json`，沒有經過 P131 的規則）原本把平安金融中心南座、中航廣場列在香港，現在列在中國。改用 1:10m 後底特律的文藝復興中心 Tower 300（底特律河的美國岸邊）被判成加拿大，寫在 `COUNTRY_FIXES`；其他國家的座標跟 P17 都一致。
    - **城市**（tooltip 與側欄）：P131 往上最多 4 層（台北 101 是西村里 → 信義區 → 臺北市），取鏈上最高的一個「城市」（Q515 的子類別、不是市轄區）。台灣的直轄市在 Wikidata 不是城市的子類別（臺北市另外標了城市，高雄市沒有），另外算（`EXTRA_CITY_CLASSES`），否則 85 大樓會寫「苓雅區」。杜拜酋長國、新南威爾斯州、大倫敦、拉德芳斯的幾個市鎮、鹿特丹與阿姆斯特丹的「市鎮政府」這類改成一般說的城市（`CITY_OVERRIDES`）；P131 直接寫州、省、國家的 74 棟（美國很多）用城市主題的 GHSL 城市（座標在中心點 5 km 加上等面積圓半徑 1.5 倍以內最近的，跟城市主題的中文名稱一致）。不全用 GHSL：它的城市是連續的市區，珠江三角洲連成一片叫「Guangzhou」，深圳的大樓會寫成廣州。
    - **涵蓋率**（跟 CTBUH 的「2026 Trends & Forecasts」比，2025 年底，`manifest.json` 的 `coverage`，pipeline 核對 `skyscrapers.ts` 寫的百分比）：200 m 以上 Wikidata 547 棟／CTBUH 2,596 棟 = **21%**；300 m 以上 169／258 = **66%**；中國 200 m 以上 124／1,361 = **9%**（加上港澳 139，CTBUH 的「中國」有沒有含港澳沒寫）。150 m 以上 CTBUH 沒有公布總數，Wikidata 只有 955 棟，涵蓋率一定比 200 m 以上更低。美國 274 棟、中國 128 棟（150 m 以上）這種順序跟實際相反（CTBUH：中國的 200 m 以上就占全世界一半），所以**國家的指標只做 300 m 以上**，150、200 m 以上只畫成點、在側欄列出並寫明「Wikidata 收錄的」；**每百萬人的棟數不做**：150、200 m 以上的主要反映收錄的程度，300 m 以上的國家只有二十幾個、幾乎都是波斯灣國家在前面。頁尾、指標說明、側欄最上面都寫涵蓋率。各國最高的建築也可能漏收：菲律賓、印度、巴西 Wikidata 有高度與年份的都比實際最高的矮。
    - **時間軸**：1930–2026 年每一年「完工、還沒拆除」的（`_standing()`：完工年 ≤ 那一年，拆除年 > 那一年）；1930 年前完工的 150 m 以上大樓在 1930 年一起出現。世界最高的變化：1930 年克萊斯勒大樓（318.9 m）、1931 年帝國大廈（381 m）、1973 年威利斯大廈（442.1 m，Wikidata 的啟用年；同一年舊世貿也完工）、1999 年雙峰塔（452 m，Wikidata 的啟用年，CTBUH 寫 1998）、2004 年台北 101、2010 年哈里發塔。現在還在的 150 m 以上 955 棟（雙塔算 2）、200 m 以上 547、300 m 以上 169、600 m 以上 4 棟（哈里發塔、默迪卡 118、上海中心、麥加皇家鐘塔，跟 CTBUH 的巨型大樓一致）。
    - **點**（`buildings.json`）：945 棟（沒有座標的 15 棟經緯度是 null，只算進國家、列在側欄），欄位：經緯度（0.001°）、高度（0.1 m）、樓層、完工年（差分）、拆除年、雙塔、國家、英文名稱、中文名稱、城市（英、中）、QID。大小與顏色都是高度（150–199 m 青綠、200–299 m 琥珀、300–599 m 洋紅、600 m 以上深紫，都是 `MAP_TOKENS`，有白框；比例圓是半透明的紫色大圓，面量圖是橘色）；圖例只列顏色的分段（大小與顏色同一個意思，兩個「高度」的圖例也會撞 React 的 key）。縮放篩選：圖磚 0–2 級只畫 300 m 以上、3–4 級 200 m 以上、5 級起全部；1280×800 的地球儀約畫 70 棟。
    - **側欄**：最上面是涵蓋率（中國、香港、澳門多一句中國特別少）；這一年各高度的棟數（長條）、最高的大樓（前 10 棟：中文名稱、英文原名、高度、樓層、完工年、城市，其餘收起來）、這個國家與全世界 1930 年起 150、200、300 m 以上的棟數（折線）、沒有完工年份所以不算的大樓（最多列 8 棟）、連到城市主題（`panels/TopicLink.tsx`）。指標檔的台灣附註寫台北 101 與 85 大樓。
    - **台灣**：台北 101 508 m（2004 年完工，2004–2010 年世界最高）、高雄 85 大樓 347.5 m（1997）、臺北南山廣場 272 m（2018）、遠雄 THE ONE 268.6 m（2020；報導寫 267.6 m）、新光人壽保險摩天大樓 244.8 m（1993）、長谷世貿聯合國大樓 222 m（1992）；150 m 以上 26 個項目、算 29 棟（遠企中心、大安國王、龍邦世貿是雙塔），300 m 以上 2 棟（第 9 名）、最高建築第 7 名。另外 21 棟沒有完工年份，不算（臺北天空塔 280 m、臺中商銀總行大樓 200 m、東森恩典大樓 199 m，臺中七期的住宅大樓很多），側欄列出。85 大樓仍在使用：2019 年海霸王集團旗下的凱德唐公司經法拍取得 34、35 與 37–85 樓，引進艾美酒店、整修中（報導預計 2026 年開幕），中山大學國際金融研究學院、高雄市經發局的新創基地已進駐（側欄寫）。CTBUH 沒有公布台灣的總數，只逐棟核對：高雄頁的 85 大樓 347.5 m、臺中頁最高的臺中商銀總行大樓 225 m（Wikidata 200 m、沒有年份）。臺北雙子星（360 m）、富邦 A25 是興建中，不算。
    - **大小**：`buildings.json` 98 KB、`supertall.json` 52 KB（250 個國家、97 年，沒有的是 0）、`tallest.json` 26 KB、`undated.json` 8 KB，共 0.19 MB（gzip 後 0.04 MB）。
84. **國旗**（`pipeline/topics/flags.py`、`pipeline/sources/wikidata_flags.py`、`commons.py`、`pipeline/svgo.mjs`、`src/topics/flags.ts`、`src/topics/flagImages.tsx`、`src/map/flagTiles.ts`、`src/topics/panels/FlagsPanel.tsx`）：
    - **主角是地圖**（地理，排在國家小檔案後面）：預設的「國旗」把每個國家塗上自己的國旗（第 4 節的 `kind: 'flags'`），另外有顏色占比、主要顏色、圖案、旗幟家族、採用年份、長寬比 6 個指標。單一快照（`timeless`），2026-10。範圍跟國家小檔案一樣：地圖的 1:50m 國界加上沒有形狀的吐瓦魯、托克勞、直布羅陀，共 241 個；南極洲（南極條約的旗不是國旗）與錫亞琴冰川沒有國旗（`noValue`）。
    - **畫哪一面旗**：Wikidata 國家項目的國旗圖檔（P41）現行值：不含已棄用、結束時間已過的，有偏好值時只看偏好值（阿富汗有十幾個歷代國旗的陳述，偏好值是 2021 年起的那一面）。其他指定的（`FLAG_FILES`，9 條，每條寫理由）：西撒哈拉（Wikidata 把撒拉威阿拉伯民主共和國國旗的陳述標成棄用）、聖巴瑟米、聖皮耶與密克隆、瓦利斯和富圖納、新喀里多尼亞（法國國旗，見下面）、聖赫勒拿（Wikidata 是英國國旗，改畫聖赫勒拿的旗）、英屬印度洋領地（Wikidata 是專員的旗，改畫領地的旗）、印度洋領地（澳洲國旗）、多哥（Wikidata 的偏好值是 3:2 的版本，改用黃金比例的法定版本）。執行時印出每一個指定跟 Wikidata 的差別。
    - **屬地**：有自己正式的旗就畫自己的，沒有就畫主權國的國旗（主權國與關係用國家小檔案的 `TERRITORIES`），側欄寫「X 有自己的旗（主權屬於 Y）」或「X 沒有自己正式的旗，使用 Y 的國旗」。用主權國國旗的 7 個：法屬聖馬丁、聖巴瑟米、聖皮耶與密克隆、瓦利斯和富圖納（地方旗都沒有官方地位）、新喀里多尼亞（2010 年起官方同時懸掛法國國旗與卡納克旗，地圖只能畫一面，畫兩面都有的法國國旗，側欄寫明）、赫德島和麥克唐納群島、印度洋領地（聖誕島與科科斯〔基林〕群島在地圖上是一塊，各有地方旗）。香港、澳門畫區旗（1997、1999 年起）；名稱、年份、顏色、圖案跟著那面旗本來的國家。
    - **爭議地區**：畫當地政府使用的旗，說明用國家小檔案的 `STATUS`，不另加評論：科索沃、巴勒斯坦、西撒哈拉（撒拉威阿拉伯民主共和國的國旗，側欄寫「波利薩里奧陣線 1976 年宣布成立的國家」）、索馬利蘭、北賽普勒斯、台灣。阿富汗畫 2021 年起政府使用的清真言旗，名稱寫「阿富汗伊斯蘭酋長國的旗」，側欄照事實寫多數國家沒有正式承認塔利班政府、2024 年巴黎奧運的阿富汗選手仍用 2013–2021 年的三色旗。
    - **台灣**：Commons 的 Flag of the Republic of China.svg（公有領域），通稱「青天白日滿地紅旗」、正式名稱「中華民國國旗」，1928 年 12 月 17 日起（國民政府明定為國旗；執行時跟 Wikidata 的 P41 起始時間核對，`TAIWAN_FLAG`，2026-10-27 一致；Wikidata 國旗項目的成立時間寫 1924 年，所以在 `YEAR_FIXES` 寫理由）。紅 75%、藍 21.7%、白 3.3%（方塊占四分之一，白日占方塊的 13%），主要顏色紅，圖案只有太陽（白日的 12 道光芒不是星），2:3，不屬於任何旗幟家族。地圖上台灣比國旗瘦長，裁切時留住左上角的方塊：北半部是藍底白日，南半部是紅。
    - **圖檔與最佳化**：Commons 的 MediaWiki API（`prop=imageinfo`，50 個一批）取檔案資訊與授權（第 12 點），從 upload.wikimedia.org 下載原檔（依 sha1 快取、核對）。含 `<script>`、事件屬性、外部連結的檔會報錯（實際沒有）。svgo 依序試小數 1、2、3 位，跟原檔各畫成 400 px 寬比對（差超過 48/255 的像素不到 0.1% 才採用）：204 個用 1 位、23 個 2 位、5 個 3 位；紐埃、南喬治亞的 svgo 結果畫出來不一樣，改用 scour。原檔 3.80 MB → 1.94 MB（234 個檔，內容一樣的共用：法國國旗給法屬聖馬丁等 6 地、澳洲國旗給 2 地）。根元素一定有數值的 width、height（`<img>` 與 canvas 要知道原本的大小；卡達的檔 viewBox 是 75×18、preserveAspectRatio="none"，靠 width、height 拉成 28:11，不能用 viewBox 算比例）。茅利塔尼亞的 viewBox 頭尾有空白，scour 會當掉，先整理。
    - **顏色**（`colour_shares()`、`classify()`）：最佳化後的 SVG 用 resvg 畫成 600 px 寬、不反鋸齒（`shape_rendering="crisp_edges"`，每個像素都是 SVG 裡的某個顏色），透明的不算，逐色換成 OKLCH 歸類：彩度不到 0.04 的依亮度分白（L ≥ 0.8，含銀色）、黑（L ≤ 0.36）、其他（灰）；其餘依色相：345°–40° 紅、40°–72° 橘、72°–112° 黃（含金色）、112°–200° 綠、200°–290° 藍、其他（紫、洋紅）；暗的或灰的橘黃色（棕、米色、土黃）歸其他。門檻是逐一看過各國旗面積 0.5% 以上的顏色定的：不丹的橘 h 41、印度 42、尼日 41 是橘，馬拉威的紅 h 32 是紅，卡達的栗色 h 5 是紅，牙買加的黑 #2d2926 L 0.28。官方說法跟外觀不同的照官方（`COLOUR_FIXES`）：亞美尼亞的 #f2a800 外觀偏黃（h 77），國旗法寫杏色（橘），歸橘。
      - **核對**（理論值是依國旗法的尺寸算的）：日本白 81.2%、紅 18.8%（圓的直徑是高的 3/5，π·0.3²/1.5 = 18.85%）；台灣紅 75.0%、藍 21.7%、白 3.3%（方塊 25%）；巴西綠 68.9%、黃 17.7%、藍 12.3%、白 1.1%（菱形離邊 1.7 個單位，綠 68.6%）；美國紅 41.5%、白 39.8%、藍 18.6%（紅條扣掉方塊裡的 4 條是 41.5%，方塊 21.5% 扣掉 50 顆星）；不丹黃 43.9%、橘 40.9%、白 13.6%（龍）、黑 1.6%；尼泊爾只算旗面：紅 62.5%、藍 23.7%、白 13.8%；只有一種顏色的國旗現在沒有（1977–2011 年利比亞的綠旗是唯一的例子），最接近的是摩洛哥紅 97.0%、中國紅 97.6%、沙烏地綠 95.4%。
      - **主要顏色**：面積最大的顏色；前兩種差不到 2 個百分點的（法國、德國、義大利這類三色旗）歸「沒有單一的主要顏色」（89 面），不然三色旗會依浮點誤差隨便挑一色。紅 49、藍 51、白 21、綠 20、黃 8、黑 2（利比亞、巴布亞紐幾內亞）、橘 1（尼日）。tooltip 第三行寫各色的比例。
    - **圖案**（`FEATURES`）：逐一看過每一面旗的清單：星星 82、橫條 114、國徽或徽章 42、動物 31、十字 22、太陽 21、英國國旗 20、直條三色旗 20、新月 18。定義寫在 `src/topics/flags.ts` 的 `FEATURE_HINTS`（側欄滑過圖案看得到）：國徽、徽章的主要圖案算（斯洛維尼亞國徽的三顆星、厄瓜多國徽頂上的神鷹與太陽、西班牙國徽的獅子），王冠頂上的小十字、克羅埃西亞國徽王冠裡的五個小盾不算；英國國旗本身算十字，左上角有英國國旗的旗歸「英國國旗」不重複算十字；代表太陽的圓算太陽（日本、孟加拉、尼日、格陵蘭），寮國、帛琉的圓是月亮不算；直條三色旗是三種顏色的直條，兩邊同色的（加拿大、奈及利亞、秘魯）不算。
      - **跟 Wikidata 核對**：國旗項目的描繪內容（P180）對到同一組圖案（`WIKIDATA_FEATURES`），兩邊不同的 39 處都在 `FEATURE_REASONS` 寫理由（沒寫會報錯）。多半是 Wikidata 只寫「某國國徽」、沒有列出國徽裡的動物與星（百慕達的紅獅、墨西哥的鷹與蛇）；Wikidata 寫了、清單沒有的：玻利維亞、哥斯大黎加的國徽（這裡畫一般的國旗，沒有國徽）、厄利垂亞的國徽（國旗上是橄欖枝，國徽是駱駝）、馬紹爾群島的太陽（是 24 道光芒的星）、尼泊爾的星（十二角形是太陽）。核對時發現阿曼漏了國徽，補上。
    - **旗幟家族**（`FAMILIES`，互不重疊）：北歐十字 7、英國國旗 20（跟圖案的「英國國旗」一致，pipeline 核對）、泛非顏色 17（衣索比亞的綠黃紅，迦納 1957 年起許多國家採用；非裔運動的紅黑綠：肯亞、馬拉威、南蘇丹；中非共和國刻意結合法國三色與泛非顏色）、泛阿拉伯顏色 11（1916 年阿拉伯起義旗的紅白綠黑，含西撒哈拉）、泛斯拉夫顏色 6（1848 年布拉格斯拉夫大會的白藍紅：俄羅斯、塞爾維亞、斯洛伐克、斯洛維尼亞、克羅埃西亞、捷克）、大哥倫比亞 3、中美洲聯邦 5（哥斯大黎加加了紅色）。只看設計的來源：顏色碰巧相同的（玻利維亞、立陶宛的紅黃綠）不算，有爭議的（莫三比克、保加利亞）保守不算。
    - **採用年份**：目前這一版開始使用的年份。改了圖案或徽章（包括依新法重新繪製）算新的一版，只改顏色深淺或長寬比例的不算，停用後再採用的算再採用的年份。預設用 Wikidata 現行國旗圖檔陳述的起始時間（P580），沒有時用國旗項目的成立時間（P571）；兩者對不上、或都沒有的在 `YEAR_FIXES` 逐一指定並寫理由（74 條，中英文，是指標檔的附註、側欄的說明），沒寫會報錯。例子：
      - 只改顏色或比例、不算新版：法國 1830（2020 年只把藍色改深；1815–1830 年波旁王朝的白旗中斷）、日本 1870（1999 年的國旗國歌法只微調圓的位置與顏色）、義大利 1946、宏都拉斯 1866（2022 年改青綠色、2026 年改回深藍）、亞塞拜然 1991、俄羅斯 1991、立陶宛 1988、土庫曼 1997（2001 年只改比例）、聖露西亞 1967、白俄羅斯 1995、百慕達 1910、賽普勒斯 1960、蒙古 1992、波蘭 1919、菲律賓 1919（1907–1919 年被禁止，之後只改藍色）、突尼西亞 1831。
      - 圖案或徽章改了、算新版：美國 1960（50 顆星）、巴西 1992（27 顆星）、澳洲 1908（七角的聯邦之星）、吉爾吉斯 2023（太陽的光芒從彎的改成直的）、塞爾維亞 2010、聖馬利諾 2011、巴拉圭 2013、厄瓜多 2009（依新規定重新繪製國徽）、墨西哥 1968、西班牙 1981、尼加拉瓜 1971、列支敦斯登 1982、開曼群島 1999（拿掉徽章外的白色圓盤）、尚比亞 1996。
      - 再採用：利比亞 2011、敘利亞 2024（2025 年 3 月的憲法宣言明定）、阿富汗 2021、馬拉威 2012、貝南 1990、剛果共和國 1991、迦納 1966、柬埔寨 1993、寮國 1975、東帝汶 2002、愛沙尼亞 1990、拉脫維亞 1990、奧地利 1945、德國 1949、保加利亞 1990、羅馬尼亞 1989。
      - Wikidata 的值不對或指的是別的：衣索比亞 1996（國旗項目寫 1778）、玻利維亞 1851（1825 是另一面旗）、印度 1947（圖檔陳述寫 1946）、埃及 1984、紐西蘭 1902（國旗項目寫 1903）、托克勞 2009（寫 2021）、索馬利亞 1954（託管時期採用，國旗項目寫獨立的 1960）；香港 1997、澳門 1999（全國人大 1990、1993 年通過，用開始使用的年份）、波多黎各 1952、古巴 1902、愛爾蘭 1922、哥斯大黎加 1848（1906 年的修改只在國家機關用旗的國徽）、阿根廷 1818（有五月太陽的版本開始是官方的旗）、希臘 1822（條紋版本開始是海上用的旗，1978 年起是唯一的國旗）、荷蘭 1937（紅白藍從 17 世紀就在使用，1937 年皇家法令規定）。
      - **丹麥**是最早的：1748（Wikidata；法令規定商船旗的樣式），附註寫圖案至少從 14 世紀就在使用、傳說是 1219 年。其次英國 1801、智利 1817、阿根廷 1818、挪威 1821；最新的敘利亞 2024、吉爾吉斯 2023、阿富汗 2021、茅利塔尼亞 2017（加了紅條）。分布：1900 年以前 28、1900–1944 年 26、1945–1959 年 25、1960–1979 年 66、1980–1999 年 71、2000 年起 25；面量圖的門檻 1900、1945、1960、1980、2000。
    - **長寬比**：SVG 的寬高化成高:寬的最簡整數比（`ratio_text()`：幾乎相等的取最小的整數，丹麥 370×280 是 28:37 不是誤差 0.1% 的 25:33；再不行找 400 以內的，薩爾瓦多 189:335 寫成 22:39 的近似；多哥的黃金比例直接寫 1:1.618）。2:3 103、1:2 76、3:5 20、正方形 2（瑞士、梵蒂岡）、不是長方形 1（尼泊爾，旗面不到外框的 95% 就算）、其他 39（美國等 10:19、比利時 13:15、卡達 11:28…，tooltip 寫確切的比例）。跟 Wikidata 的長寬比（P2061）對不上的印出來，2026-10 有 6 面：貝里斯（圖檔 3:5、Wikidata 2:3）、柬埔寨（16:25、2:3）、維德角（10:17、2:3）、敘利亞（2:3，Wikidata 的 1:2 是舊旗的）、萬那杜（3:5、19:36）、法羅群島（8:11、5:7），都照 Commons 的圖檔（畫出來的就是它）。英國沒有法定比例，依 Wikidata 的偏好值畫 3:5，側欄寫明常見 1:2 與 3:5。
    - **名稱**：Wikidata 國旗項目的中文名稱常用對岸的譯名（格魯吉亞国旗、澳大利亞國旗、史瓦濟蘭國旗）、英文是小寫的「flag of …」，不用。正式名稱不是「<國名>國旗」的寫在 `NAME_FIXES`（中華民國國旗、中華人民共和國國旗、香港特別行政區區旗、澳門特別行政區區旗、撒拉威阿拉伯民主共和國國旗、聖赫勒拿旗、阿富汗伊斯蘭酋長國的旗），通稱寫在 `NICKNAMES`（22 個：青天白日滿地紅旗、五星紅旗、日章旗、星條旗、米字旗、太極旗、楓葉旗、丹尼布洛旗…），其他的由前端用網站自己的國名組成（「日本國旗」、屬地的「百慕達旗」）。Wikidata 的暱稱（P1449）也不用：俄羅斯國旗的烏克蘭文暱稱是「Аквафреш」（牙膏的牌子）。
    - **國旗地圖的效能**（第 4 節的 `kind: 'flags'`；無頭 Chrome、SwiftShader 軟體繪製，比實際的電腦慢很多）：
      - 開發模式、1280×800 地球儀：地圖出現資料 1.6 秒，國旗圖磚 62 張陸續畫好，最後一張 7.0 秒；畫圖磚本身總共只要約 8 ms，時間都花在等 SVG 下載與畫成點陣圖。放大到歐洲（3.6 級）32 張、每張最多 0.12 秒，到 6 級 18 張、每張最多 0.01 秒（點陣圖已經有了）。
      - 正式版（`scripts/serve-pages.mjs`，gzip）：桌機 flags.json 0.19 秒（23 KB）、地圖出現資料 1.2 秒，約 195 個 SVG（傳輸 256 KB）在 0.6–3.7 秒之間下載完，3 秒的截圖國旗已經全部畫好；手機（Fast 3G、4× CPU）地圖出現資料 7.1 秒，SVG 11.1 秒下載完，20 秒的截圖國旗都畫好了（那時底圖的圖磚還在下載）。
      - 記憶體（JS heap，同一個量法、會受垃圾回收的時間影響）：世界全圖 99 MB（國家小檔案 77 MB）；放大到歐洲 6 級 134 MB（國家小檔案 82 MB）。國旗點陣圖有 64 MB 的上限；第一版每次都取大一號的點陣圖（2 的次方），6 級時多了一倍，改成最多放大 1.25 倍後從 218 MB 降到 134 MB。圖磚 512×512（裝置像素比 2）一張 1 MB 的 GPU 記憶體，世界全圖約 60 張。
      - 世界全圖要下載約 200 個 SVG：Service worker 另外一個 cache first 的快取（`flag-images`，檔名含雜湊），第二次開就不用下載（第 13 節）。
    - **側欄**（`FlagsPanel.tsx`）：大的國旗（依原本的長寬比，高 150 px，用 drop-shadow 描邊，尼泊爾才會沿著旗的形狀）、通稱與正式名稱、屬地與爭議地區的說明（`STATUS`）、採用日期（Wikidata 有日期的寫到日）與理由、長寬比、顏色組成長條（`FLAG_COLOURS`）與各色比例、圖案（滑過看定義）、旗幟家族、連到國家小檔案、圖檔的 Commons 頁面與授權、insignia 的說明。排名表國名前面有小國旗（`rowIcon`）。國家小檔案最上面也畫國旗（第 82 點）。
    - **大小**：SVG 234 個 1.94 MB（各自 gzip 後 0.65 MB）、flags.json 93 KB、指標檔 21 個與 CREDITS.txt、manifest.json，共 258 個檔 2.18 MB（gzip 後 0.72 MB）。
85. **判斷點在哪一國用 Natural Earth 1:10m，地圖仍畫 1:50m**（`pipeline/geoindex.py`、`build_geo.py` 的 `unit_id()`，2026-10-27）：
    - **為什麼分開**：地圖要畫的國界越小越好（1:50m gzip 後 230 KB，手機上解析就要好幾百毫秒，第 13 節），但 pipeline 拿同一份國界判斷「店家、河口、圖塊、大樓在哪一國」時，1:50m 對小地方太粗。香港的形狀只有 23 個頂點，北邊（114.019, 22.515）→（114.051, 22.543）→（114.098, 22.551）→（114.123, 22.565）比實際的深圳河偏北 2–3 公里，深圳福田、羅湖、蛇口的店家、平安金融中心、京基 100、羅湖與福田口岸的深圳那一側都算成香港；澳門的形狀含珠海的拱北、橫琴；梵蒂岡、摩納哥的形狀比實際大，新加坡的含新山的一部分；1:50m 沒有形狀的小島（馬爾地夫、模里西斯、澎湖、蘭嶼、吐瓦魯）找不到國家；海岸線簡化後，桑托斯、摩加迪休這種海邊城市的點離最近的頂點超過 0.3°，也找不到國家。pipeline 判斷時不必顧慮檔案大小，所以改用 1:10m，地圖照樣畫 1:50m。
    - **版本**：Natural Earth 1:10m admin-0 的 4.1.0 版（GitHub 上的 GeoJSON，12.8 MB，公有領域，下載到 `.cache/natural-earth/`，不進版本庫；只有 pipeline 用，部署不需要）。跟地圖的 world-atlas 2.0.2 是同一版 Natural Earth，國家的劃分一樣（克里米亞、西撒哈拉、東耶路撒冷的畫法都相同）。5.1.2 版（其他主題用的人口點、鐵路是這一版）改了波赫跟塞爾維亞沿德里納河的國界，但也把東耶路撒冷、拉特倫一帶畫進以色列：便利商店有 84 家會從巴勒斯坦變成以色列，跟地圖畫的不一致，所以不用。
    - **國家代碼**：名稱跟 1:50m 一樣的單位用 `build_geo.unit_id()`（同一套 ISO 數字代碼 → alpha-3 與 `NO_ID_OVERRIDES`：科索沃、索馬利蘭、北賽普勒斯、錫亞琴冰川、澳洲的印度洋領地），史瓦帝尼的舊名對回 world-atlas 的 eSwatini（`NAME_ALIASES`）。只有 1:10m 才有的 14 個單位逐一指定（`TEN_M_ONLY`；沒列到的、或對到地圖上沒有的代碼都會報錯），規則是網站有自己代碼的用自己的，其他照 1:50m 畫成哪一國（在範圍裡取格點用 1:50m 判斷），1:50m 沒畫、網站也沒有代碼的不算任何國家：
      - 直布羅陀 → GIB、吐瓦魯 → TUV：地圖上只畫圓點（`worldMapLayers.ts` 的 `SHAPELESS`），1:50m 時分別算成西班牙、找不到國家；人口網格、網路速度本來就另外歸這兩地。
      - 亞克羅提利、德凱利亞（英屬基地區）→ 賽普勒斯（1:50m：100%、83%＋北賽普勒斯 17%；網站沒有代碼，當地的賽普勒斯居民由賽普勒斯政府管理民政）；拜科努爾 → 哈薩克（俄羅斯租用，主權屬哈薩克）；關塔那摩灣美軍基地 → 古巴（美國租用，主權屬古巴）。
      - 不算任何國家（點落在裡面時跟海上的點一樣找 0.3° 內最近的頂點）：賽普勒斯的聯合國緩衝區（會歸到最近的一邊，跟 1:50m 賽普勒斯 83%、北賽普勒斯 17% 的分法接近）、美國本土外小島嶼（威克島、中途島等，ISO 另有 UMI，不併進美國）、克利珀頓島、珊瑚海群島、南沙群島（各島分別由越南、菲律賓、中國、馬來西亞、台灣占領，Natural Earth 併成一個單位，台灣的太平島也在裡面，不替爭議下判斷）、黃岩島、塞拉尼拉淺灘、巴霍努埃沃淺灘。這些在 1:50m 都沒有形狀，跟以前一樣。
    - **1:10m 也沒有的台灣離島**：1:10m 的台灣有本島、澎湖的 3 個島、金門、蘭嶼、綠島，沒有馬祖、烏坵、東沙。馬祖最近的頂點在福建沿岸，會判成中國（便利商店的 16 家馬祖 7-Eleven、全家原本算中國）。網路速度主題原本的矩形範圍（`TAIWAN_ISLANDS`）移到 `geoindex.ISLANDS` 給所有主題用（澎湖、馬祖 3 處、烏坵、蘭嶼、綠島、東沙），範圍裡只有台灣的島與海，沒有 1:10m 中國的多邊形（逐格檢查過）。
    - **作法與速度**：1:10m 有 54.4 萬個線段（1:50m 約 10 萬個頂點）。逐國射線法要慢 5 倍以上，所以先把全世界切成 0.05° 的格子：沒有線段經過的格子（98.6%）整片屬於同一國或都不在國界內，用連通區塊（`scipy.ndimage.label`，約 4,200 片）每片判斷一次；點落在這些格子直接查表，落在有線段經過的格子才逐點用射線法，而且只看跟這個點同一列（緯度帶）的線段（射線往東，y 範圍含這個點的線段一定在這一列）；都不在國界內的點找 0.3° 內最近的外環頂點，只看附近 3×3 個 0.3° 的桶。建索引 2–6 秒；網路速度的 2,205 萬個圖塊 20 秒（1:50m 的逐國射線法約 10 分鐘）、便利商店 95 萬個點 3 秒（原本 20 秒）、交通的 6.5 萬次逐點呼叫 6 秒（原本 28 秒）。隨機 600 個點（大多在國界、海岸附近）跟純 Python 的逐國、逐環射線法比對，結果完全一樣。換日線的處理（`_unwrap`、`_wrapped`）與 0.3° 內最近頂點的規則照舊；1:10m 的環在 ±180° 切開，本來就沒有跨換日線的環。
    - **算面積仍用 1:50m**：`land_polygons()`（交通主題的鐵路密度）跟地圖畫的形狀一致，沒有改。
    - **逐點比對**（只用快取，`HTTPS_PROXY` 指到不存在的位址擋住網路；各主題實際判斷的點，新舊兩版各算一次）：
      - 便利商店與連鎖品牌：95.3 萬個點有 2,146 個換了國家。最多的是原本找不到國家的小島（馬爾地夫 131、模里西斯 65、台灣 63、巴西 50、法屬玻里尼西亞 31…），香港 → 中國 115（第 75 點）、美國與墨西哥之間 69／23、保加利亞 → 羅馬尼亞 51（多瑙河對岸的齊姆尼恰）、塔吉克 → 阿富汗 43、波赫 → 塞爾維亞 41、巴西 → 巴拉圭 38、加拿大 → 美國 33、烏克蘭 → 摩爾多瓦 32、中國 → 台灣 16（馬祖）、新加坡 → 馬來西亞 18、澳門 → 中國 10、梵蒂岡 → 義大利 2、摩納哥 → 法國 5；直布羅陀 1 家、吐瓦魯 8 家（多了 `countries/GIB.json`、`TUV.json`），中非共和國唯一的一家（班吉的 Marché Central）變成剛果民主共和國、梵蒂岡的 2 家變成義大利，這兩國的 `countries/` 檔刪掉。
      - 網路速度：2,205 萬個圖塊有 52,661 個（第 79 點）。塑膠污染的河口：31,819 個有 183 個（第 78 點）。交通的鐵路：6.5 萬個點有 77 個，摩納哥 22 → 0 公里（`countries/MCO.json` 刪掉）、西撒哈拉 19 → 0（茅利塔尼亞的鐵礦鐵路）、列支敦斯登 29 → 16、吉爾吉斯 367 → 388 公里（第 10 點）。AI 的數據中心：4,986 個有 9 個（Contabo 在法國洛特堡的 3 個原本算德國、萬國數據在深圳福田的 2 個原本算香港、馬爾地夫、吐瓦魯、綠島各 1、科索沃哈尼伊埃雷齊的 1 個變成北馬其頓）。太空的發射場：64 個有 1 個（瓜加林：原本找不到國家、用 GCAT 的國家算美國，現在是馬紹爾群島）。摩天大樓：1,092 個點有 11 個（第 83 點）。城市（1,974 個中國的城市，只看是不是港澳）只有綏芬河從俄羅斯變中國、台灣的外交（111 個館處，只看是不是屬地）只有吐瓦魯、駐教廷大使館兩個點換了，輸出都一樣，沒有重跑。
      - **用店名的文字檢查**（獨立於國界的線索）：香港 → 中國的 115 家幾乎都是簡體字（麦当劳、罗森、美宜佳、易捷），美國 → 墨西哥、加拿大 → 美國的多是對岸的連鎖（Oxxo、Stripes、Speedway），保加利亞 → 羅馬尼亞、烏克蘭 → 摩爾多瓦是羅馬尼亞文、多明尼加 → 海地是海地克里奧爾語、土耳其 → 喬治亞是喬治亞字母、北賽普勒斯 → 賽普勒斯是希臘文、巴勒斯坦 → 以色列是希伯來文，都對；納爾瓦的麥當勞（愛沙尼亞）、綏芬河的肯德基（中國）原本被當成俄羅斯的舊標示。
    - **1:10m 也有幾百公尺的誤差**，國界河上的城鎮新舊都可能錯，改用 1:10m 時變錯的：吉爾吉斯楚河南岸的托克馬克一帶 28 家店變哈薩克（店名有吉爾吉斯文）、帕米爾噴赤河沿岸 43 家店從塔吉克變阿富汗（有名字的都是西里爾字母，應該在塔吉克那一岸；反方向的 15 家是改對的）、波赫的茲沃爾尼克、魯多、別伊納一帶 41 家變塞爾維亞、俄羅斯索契的韋肖洛耶（普蘇河）23 家變喬治亞（阿布哈茲）、底特律的文藝復興中心 Tower 300 變加拿大（摩天大樓主題用 `COUNTRY_FIXES` 改回）、班吉市中心 1 家變剛果民主共和國、科索沃的 1 個數據中心變北馬其頓；香港在沙頭角一帶仍偏北（深圳那一側的 4 家店還算香港，網路速度有 14 個圖塊從中國變香港）。整體來說改對的多很多：Meijer 的河口跟論文國家表比，中國從 −3.6% 變 −0.1%、馬來西亞 −1.2% → −0.3%、巴西 −0.7% → 0.0%。
    - **已知錯的地方另外修正**（`geoindex.BORDER_FIXES`，同一天）：跟 `ISLANDS` 一樣是矩形範圍，每一條寫理由與證據；規則是國家代碼時範圍裡的點一律歸那一國，「50m:代碼」時範圍裡地圖的 1:50m 算在那一國的點歸那一國、其他照 1:10m（1:50m 在這幾處是對的）。範圍只框住判錯的店與村子，套用前後逐點（各主題記錄過的點）、逐圖塊比對，換了國家的店都看過店名：
      - **波赫東部**（50m:BIH，三個範圍拼起來）：4.1.0 版 1:10m 的波赫東界、南界整段偏進波赫，約 5,000 km² 的波赫（塞姆貝里亞、茲沃爾尼克、魯多、恰伊尼切、布爾奇科東邊）畫成塞爾維亞、蒙特內哥羅、克羅埃西亞；5.1.2 版修正後的界線跟 1:50m 一致（範圍裡 1:50m 算波赫、4.1.0 不算的 0.01° 格點約 5,900 個在 5.1.2 是波赫、約 140 個不是）。店：塞爾維亞 → 波赫 40、蒙特內哥羅 → 波赫 8、克羅埃西亞 → 波赫 6，跟 5.1.2 比 52 家一致，另外 2 家在茲沃爾尼克北邊（其中一家是塞族共和國的加油站連鎖 nestro），照 1:50m 算波赫；德里納河東岸塞爾維亞的柳博維亞（店名 Аман 是塞爾維亞的連鎖，1:50m 也畫進波赫）留在範圍外。圖塊 2,645 個改回波赫，跟 5.1.2 一致的占 97%（測試次數 97%）。
      - **托克馬克、肯布倫**（50m:KGZ）：托克馬克市區 17 家、肯布倫村 4 家改回吉爾吉斯（Жыргал、Эне-Сай、Ала-Тоо、「Каныкей с. Кен-булун」）；托克馬克北邊 1:50m 也算哈薩克的 4 家（Аружан、Триада）照舊。哈薩克科爾代那一邊的 7 家（Иман、Береке、Софья，旁邊都是哈薩克的店）沒有證據，照 1:10m。
      - **噴赤河**（TJK）：魯山以西的兩段 8、9 家（Магазин、Омехта、Фирдавс）與瓦罕谷的蘭加爾村 3 家（Беҳруз；其中 2 家 1:50m 也算阿富汗）改回塔吉克。其他 25 家沒有店名、分不出在哪一岸，照 1:10m。
      - **韋肖洛耶**（RUS）：18 家改回俄羅斯（Магнит、克拉斯諾達爾邊疆區的 Агрокомплекс Выселковский），範圍的東界在這些店東邊（40.0045°E）；靠近普蘇河口岸、沒有店名的 5 家與北邊兩版都算阿布哈茲的 4 家照舊。鐵路 1 段、塑膠的 1 個河口也改回俄羅斯。
      - **班吉市中心**（CAF）：中央市場 Marché Central 改回中非（中非又有了 `countries/CAF.json`），12 個圖塊。
      - **哈尼伊埃雷齊**（XKX）：數據中心（OSM 寫 addr:country=XK）與 Shell 加油站改回科索沃。
      - **沙頭角北邊**（CHN）：深圳那一側的 3 家美宜佳、麥當勞、星巴克改回中國（第 75 點），16 個圖塊；範圍的南界在香港那一側的 7-Eleven（22.546°N）北邊。
      - 便利商店（所有便利商店的店數，1:50m → 1:10m → 修正後）：中非 1 → 0 → 1、吉爾吉斯 2,899 → 2,870 → 2,891、波赫 1,031 → 985 → 1,039、塞爾維亞 3,321 → 3,360 → 3,320、塔吉克 1,238 → 1,202 → 1,222、阿富汗 270 → 298 → 278、俄羅斯 99,708 → 99,687 → 99,705、喬治亞 7,582 → 7,634 → 7,616、香港 1,107 → 1,071 → 1,068。鐵路：波赫 861 → 845 → 852 公里、喬治亞 1,379 → 1,395 → 1,379。網路速度：中非固網 72.6 → 83.7 → 72.6 Mbps（1:10m 時班吉市中心的圖塊算剛果民主共和國）、塞爾維亞 180.1 → 177.1 → 179.9。
      - 重跑便利商店、AI、交通、塑膠污染、網路速度（`ASSIGN_VERSION` 4），只用快取、擋住網路；摩天大樓、太空、城市、台灣的外交的點都不在範圍裡，輸出不變。
86. **河流與流域**（`pipeline/topics/rivers.py`、`pipeline/sources/hydrorivers.py`、`sea_areas.py`、`src/topics/rivers.ts`、`src/topics/panels/RiversPanel.tsx`，2026-10-28）：
    - **資料**（授權見第 12 點）：HydroRIVERS v1.0 的全球 shapefile（544 MB 的 zip，解壓後 .shp 1.25 GB、.dbf 873 MB），847.8 萬段河道、平均 4.2 km，收錄集水面積 10 km² 或平均流量每秒 0.1 立方公尺以上的河；流量 `DIS_AV_CMS` 是 WaterGAP 模型 1971–2000 年長期平均的降尺度推算。不裝 GDAL：.dbf 依欄位寬度切出 12 個欄位轉成數字（約 17 秒，存成 `.cache/hydrosheds/*.npz`），幾何用 .shx 的位移直接讀 .shp（numpy memmap）。每段河道由上游畫到下游（全部核對過：下游那一段的第一個點就是這一段的最後一個點），最後一個點是出口。`MAIN_RIV` 相同的是同一個河流系統（同一個出口）：156,162 個，依出口的集水面積由大到小編號（側欄與滑過時的組別用這個編號）。
    - **流進哪一個大洋**：出口那一段的最後一個點（河口）落在 IHO Sea Areas 第 3 版（1953 年 S-23 的 101 個海域）的哪一片海；多邊形畫成 0.025° 的網格（第一次約 10 分鐘，GDAL 對巨大的多邊形每一列都要掃全部的邊；存成 `.cache/rivers/sea_rasters_0025.npz`），河口所在的格子不是海就找球面上最近的靠岸海格子（KD 樹）。河口到 IHO 的海中位數 1.6 km，10 km 以上的 482 個、最遠 74 km（格陵蘭冰河、哈德遜灣西岸，兩份資料的海岸線不同）。海屬於哪一個大洋依 Global Oceans and Seas（IHO 2002 年草案的 10 章）：每個 IHO 海域的格子 100% 落在同一章（`sea_areas.chapter_of_areas()` 印出來）。
      - **規則**（照 IHO 草案的分章）：地中海（含黑海、亞速海、馬爾馬拉海）、波羅的海（含卡特加特海峽）、北海、墨西哥灣、加勒比海、聖羅倫斯灣、拉布拉多海算大西洋；挪威海、格陵蘭海、巴倫支海、白海、哈德遜灣、哈德遜海峽、巴芬灣、戴維斯海峽算北冰洋；紅海、波斯灣、阿拉伯海、孟加拉灣、安達曼海、帝汶海、阿拉弗拉海（含卡奔塔利亞灣）算印度洋；東海、黃海、日本海、鄂霍次克海、白令海、菲律賓海、珊瑚海、塔斯曼海算太平洋。頁尾、指標說明照這個寫，tooltip 與側欄另外寫邊緣海的名稱（「流入大西洋・墨西哥灣」）。
      - **草案另列一章的「南海與東部群島諸海」**（17 片海，GOaS 沒有歸到太平洋或印度洋）：麻六甲海峽（北邊接安達曼海）、莎瓦海（小巽他群島之間，向南通印度洋）算印度洋（`ARCHIPELAGIC`），南海、泰國灣、新加坡海峽、爪哇海、峇里海、弗洛勒斯海、班達海、斯蘭海、蘇祿海、西里伯斯海、摩鹿加海、望加錫海峽等算太平洋（大英百科全書把南海、爪哇海、班達海寫成西太平洋的一部分）。蘇門答臘東岸、馬來半島西岸的河因此算印度洋，婆羅洲、爪哇的算太平洋。
      - **台灣海峽**：IHO 的南海北界是富貴角到海壇島的連線，台灣海峽整個劃在南海裡（大洋都是太平洋）。畫面上的海名改寫台灣海峽（`TAIWAN_STRAIT`：IHO 的南海裡、鵝鑾鼻到廣東南澳島連線以北的河口），濁水溪寫「流入太平洋・台灣海峽」，東岸的寫菲律賓海。
      - 南冰洋：HydroSHEDS 沒有南極洲，南緯 60° 以南沒有河口，所以沒有南冰洋這一類（pipeline 發現有會印出來，前端要加類別）。
      - **內流區**：HydroRIVERS 的 `ENDORHEIC` = 1（31,785 個系統），**加上離最近的 IHO 海超過 150 km 的出口**（`INLAND_KM`，2,500 個、305 萬 km²）：HydroSHEDS 把裏海、哈薩克的田吉茲湖這類大的內陸湖當成海面，流進去的河 `ENDORHEIC` 是 0，河口離 IHO 的海 450–1,650 km（窩瓦河 586 km、烏拉河 881 km、庫拉河 687 km）；海岸線落差都在 74 km 以內，中間沒有出口，所以 150 km 分得乾淨。沒有這一條的話窩瓦河會算成「流入大西洋・黑海」。
      - 結果（出口的集水面積）：大西洋 4,440 萬 km²、內流區 3,220 萬、北冰洋 2,170 萬、太平洋 1,870 萬、印度洋 1,590 萬（合計 1.33 億 km²）。
    - **名稱**：Natural Earth 1:10m 的河流中心線（scale_rank 版 5.1.2，有 Wikidata 編號與 `name_zht`；加上歐洲、北美、澳洲的補充檔；湖泊中心線、運河不用）同名、同一個 `rivernum` 的線合在一起（3,664 條河），每 0.02° 取一點，找 9 km 內最近的河道（候選是分區以上會畫的河道，98 萬段、474 萬個點的 KD 樹）。投票後的主流（`_stem()`）：從最上游、路徑上票最多的那一段往下到最下游有票的那一段；支流的點在匯流處常對到大河，路徑在某處集水面積一下子多 40% 以上（`JUMP`，有不小的河匯入）、以下不到 4 票時在匯流處截斷（原本用兩倍，阿拉瓜亞河會延伸到托坎廷斯河的下游、把整個水系冠上阿拉瓜亞河）。對到 3,411 條，命名 25.4 萬段河道；名稱的優先順序：主檔先於補充檔、`scalerank` 小的、主流長的。中文用 Natural Earth 附的 Wikidata 項目的標籤（約 3,800 個，wbgetentities 約 80 批；zh-tw、zh-hant… 依 `nobel._pick_zh()`，再轉一次簡轉繁，`wikidata.S2T` 多了「聂贡缅」三個字），沒有的用 Natural Earth 的 `name_zht`；標籤帶消歧義括號的（「喬丹河 (猶他州)」）拿掉括號；台灣慣用譯名不同的大河改掉（`ZH_FIXES`：亞馬遜河、尚比西河、墨瑞河、麥肯錫河、聶伯河），英文截斷的「Syr Dar」改成 Syr Darya。沒有對到名稱的河 tooltip 只寫流進哪裡。
      - **水系的名稱**：流到出口附近（集水面積達出口的 95%，`NEAR_MOUTH`）的主流裡最長的那一條：三角洲上的分流、汊道比幹流短，不會蓋掉幹流（萊茵河原本是「萊克河水系」、勒拿河原本是「比科夫斯卡亞水道」）；沒有的話，系統裡有名稱、集水面積最大的那一條（至少是出口的一半）。
      - **前 60 大的水系逐一看過**（`spot_checks()` 印出來）：亞馬遜河、剛果河、密西西比河、尼羅河、巴拉那河、葉尼塞河、鄂畢河、勒拿河、尼日河、黑龍江、長江、麥肯錫河、恆河—布拉馬普特拉河、窩瓦河（內流區）、尚比西河、聖羅倫斯河、納爾遜河（北冰洋・哈德遜灣）、奧里諾科河、奧蘭治河、印度河、育空河、阿拉伯河（底格里斯河與幼發拉底河的出口，兩條河的名稱在各自的河段）、多瑙河、墨瑞河、湄公河、托坎廷斯河、塔里木河（內流區）、黃河……都對。`SYSTEM_NAMES` 改了 5 個：尼羅河（出口一帶只有羅塞塔支流有名稱）、多瑙河（基利亞分流）、勒拿河、恆河—布拉馬普特拉河（兩條大河共用出口，Natural Earth 的布拉馬普特拉河線延伸到河口）、珠江（出口是西江）。沒有名稱的 3 個：阿拉伯海的 32 萬 km²（印度河東邊的塔爾沙漠一帶）、利比亞的 30 萬 km²（流量幾乎是 0 的內流區）、土庫曼的 28 萬 km²（內流區）。
      - **台灣**：Natural Earth 沒有台灣的河。`TAIWAN` 是 27 條主要河川（水利署的中央管河川加上幾條縣市管的大河）的河口位置與流域面積（Wikidata 有的用它的座標與面積），依河口 0.2° 內、HydroRIVERS 的出口集水面積在 0.6–1.6 倍之間、最接近的對到出口，從出口往上游沿集水面積最大的那一支命名到源頭；`TAIWAN_TRIBUTARIES` 是大漢溪、新店溪、基隆河、貓羅溪、北勢溪，依匯流處對到那一段。HydroRIVERS 的流域面積跟水利署的大多相差 5% 以內（濁水溪 3,267 對 3,155 km²、高屏溪 3,249 對 3,257、淡水河 2,699 對 2,726），曾文溪（1,378 對 1,177）、蘭陽溪（1,170 對 978）多了兩成，15 角秒的流向網格在平原上把旁邊的小流域併了進來。台灣 251 個水系裡沒有名稱的 4 個比較大的（彰化鹿港一帶 327 km²、高雄梓官一帶 228 km²、台南將軍一帶 204 km² 等）沒有可靠的對應，不寫名稱。
    - **各國**：847.8 萬段河道依出口那一點判斷國家（`geoindex.countries_at()`，Natural Earth 1:10m；找不到國家的 204 段、3,909 km²），每段自己的集水面積（`CATCH_SKM`）算給那一國，依它的水系流進哪一個大洋加總；比例的分母是有河道經過的面積（加總起來 100%）。全部國家加起來 1.330 億 km²，FAOSTAT 的陸地面積 1.301 億 km²（HydroSHEDS 的集水面積含湖面，FAOSTAT 不含內陸水域：加拿大 110%、印度 106%、瑞士 105%）。有河道經過的面積不到 FAOSTAT 陸地八成的 38 個（多半是小島）在附註寫明。214 個國家/地區有值；地圖上有形狀卻沒有河道的 27 個（馬爾地夫、馬紹爾群島、東加、薩摩亞、模里西斯、維德角、聖馬利諾、摩納哥、梵蒂岡、法屬玻里尼西亞…）與南極洲寫原因（主題的 `noValue`）。法國的海外省在地圖上跟法國同一個形狀，所以法國含法屬圭亞那（大西洋）、留尼旺（印度洋，0.03%）。
      - 抽查（流向比例）：台灣太平洋 100%（有河道經過的面積是陸地的 99%，河道 13,127 km）；埃及內流區 61%（西部沙漠的窪地）、大西洋 30%（尼羅河在埃及境內 21.3 萬 km²，加上流進地中海的乾河）、印度洋 9%（紅海沿岸）；哈薩克內流區 86%、北冰洋 14%（額爾濟斯河、伊希姆河、托博爾河流進鄂畢河）；蒙古內流區 71%、北冰洋 20%（色楞格河流進貝加爾湖再到葉尼塞河）、太平洋 8%（黑龍江上游）；查德內流區 98%；俄羅斯北冰洋 69%、太平洋 14%、內流區 12%（窩瓦河）、大西洋 6%；美國大西洋 59%、太平洋 28%、內流區 8%（大盆地）、北冰洋 5%（阿拉斯加北坡與紅河流進哈德遜灣）；巴西大西洋 100%；澳洲內流區 54%、印度洋 37%（墨瑞河流進大澳大利亞灣，北部流進帝汶海、阿拉弗拉海）、太平洋 9%；瑞士大西洋 99.5%：萊茵河（北海）、隆河（地中海）、提契諾河—波河（亞得里亞海）、因河—多瑙河（黑海）四片海都屬大西洋，側欄的水系清單看得出來；中國太平洋 58%、內流區 36%、印度洋 6%（雅魯藏布江、怒江、伊洛瓦底江上游），跟一般說的內流區約占 36% 相近。
    - **地圖上的線**：大小 = 平均流量（m³/s）與集水面積 ÷ 1,000 取大的（乾燥地區流量小、流域大的河也排得上）。主檔是大小 40 以上的河道（45.2 萬段），分區是 8 以上的（再 53.0 萬段）；挑中的河道一路往下游補到出口（乾燥地區的河往下游流量變小，不補會斷掉）。相鄰的河道接成一條線：下游那一段只有這一條被挑中的上游時接起來，流量多到 2.5 倍以上就斷開（線寬依每一條線出口端的流量）。主檔 Douglas–Peucker 簡化到 0.015°（約 1.7 km）、量化到 0.01°：18,960 條線、16.9 萬個頂點；分區 0.006°、0.005°：66,587 條、50.9 萬個頂點，依每條線中間那一點分到 10° 一格的檔（272 個）。每條線的紀錄：水系編號 `g`、出口端的流量 `d`（依流量排序、存差分）、集水面積 `u`（10 km²）、級別 `z`（大小過了 8、12、20、30、60、120 幾個門檻，前端 minValue：縮放 0 畫 60 以上，1 級起畫主檔全部，4 級 20 以上，5 級 12 以上，6 級起全部）、主流的中英文名稱（字串表）；水系共用的名稱、大洋、邊緣海、全流域面積、河口流量、最長的河道長度（出口的 `DIST_UP_KM`）每個檔存一次（`groups`）。
      - 線寬依流量（縮放 2 時 1 m³/s 0.35 px、100 m³/s 0.8 px、1 萬 m³/s 2 px、10 萬 m³/s 3.3 px），隨縮放的倍數比其他圖層大（`widthZoom`：5 級 1.8 倍、8 級 3 倍）：預設的倍數在 7 級時台灣的河只有 1 px 左右，跟彩色地形底圖的粉紅色快速道路混在一起。10–12 級淡出（底圖本身有河道）。
      - 滑到河上：同一個水系的幹流與支流一起加粗、墊一圈光暈；游標附近好幾條時取最寬的那條（大河），不是剛好排在前面的小支流。tooltip：主流的名稱（沒有就是水系的名稱，都沒有就寫流進哪裡）、「某某水系・流入大西洋・北海」、這一段的平均流量與集水面積、整個水系最長的河道長度。
      - 河流只畫在「河流地圖」：其他三個指標的國家已經依大洋上色，同色的河疊上去只會更亂。
    - **側欄**（`panel.json`，214 國）：國土流向各大洋的 100% 長條（顏色跟「主要流向」一樣）、國內流域面積最大的 8 個水系（流進的海、國內與全流域的面積、河口流量、最長的長度；全流域的面積是水系裡每段河道的 `CATCH_SKM` 加總，跟國內的面積同一種算法）。滑到名稱上在地圖上標出整個水系（`highlightLine`），點一下把地圖移到水系的範圍（`focusBox`，最多放大到 8 級）。
    - **台灣**：太平洋 100%：西岸 19 條主要河川「流入太平洋・台灣海峽」，東岸的秀姑巒溪、卑南溪、花蓮溪、蘭陽溪、立霧溪、和平溪、南澳溪、太麻里溪「流入太平洋・菲律賓海」。國內最大的水系：濁水溪（3,268 km²，河口平均流量 179 m³/s，最長 154 km）、高屏溪（3,250 km²，151 m³/s，160 km）、淡水河（2,699 km²，135 m³/s，134 km）、烏溪、秀姑巒溪、卑南溪、花蓮溪、曾文溪。放大到 7 級時分區 `30_11`（10 KB，118 條線）載入，台灣的主要河川大部分的河段都畫得出來（流量 8 m³/s 以上；曾文溪 135 km 的幹流畫出約 110 km）。
    - **大小與效能**：283 個檔 6.67 MB（gzip 後 2.20 MB）：主檔 `rivers.json` 1.54 MB（gzip 後 0.53 MB，地球儀一打開就下載）、分區 272 個共 4.77 MB（gzip 後 1.59 MB，最大的一個 116 KB，放大到 4 級以上才依畫面下載，台灣一帶只要 1 個）、`panel.json` 203 KB（gzip 後 50 KB，點國家才下載）、6 個指標檔共 134 KB。無頭 Chrome（swiftshader，1280×800）：轉動地球儀 8 fps（人口主題 9 fps、海底電纜 7.7 fps，同一台電腦同時量），台灣 7 級 74 fps；JS heap 世界全圖 108 MB、放大到台灣並載入分區後 148 MB。開發模式第一個畫面約 5–6 秒（含底圖），沒有錯誤。
    - **跟其他主題**：「海拔」主題的地形、「水資源與森林」的人均水資源、「塑膠污染」的河口，頁尾沒有互相指引（這個主題的頁尾要放授權聲明，已經很長）。
87. **晝夜與季節**（`pipeline/topics/daylight.py`、`src/lib/solar.ts`、`src/lib/clock.ts`、`src/lib/derive.ts`、`src/map/nightLayer.ts`、`src/controls/MomentControl.tsx`、`src/topics/daylight.ts`、`src/topics/panels/DaylightPanel.tsx`，2026-10-28）：
    - **時間是某一刻，不是年份**：網站的時間軸都是年份（颱風的「每十年」、身高的「出生年」也只是換年份的意思），晝夜要的是日期加時間，所以加了通用的時刻主題（`TopicDefinition.clock`，第 4 節）：控制列換成 `MomentControl`，網址 `time=`，指標用 `derive` 在瀏覽器裡算，`year` 換成那一刻的日期（YYYYMMDD）。其他主題完全不經過這些程式（人口的播放、颱風、河流、年份拉桿截圖看過）。
    - **太陽的公式**（`src/lib/solar.ts`，地圖、tooltip、排名表、側欄共用這一份）：NOAA Solar Calculator 用的 Meeus 低精度算法（第 25 章）：Julian 世紀的多項式算太陽的幾何平黃經、平近點角、中心差、視黃經、黃赤交角，得到赤緯與均時差。
      - 太陽高度角 = asin(sin φ sin δ + cos φ cos δ cos H)，H 是時角（真太陽時）；這裡都是幾何的高度角，日出、日落與晝夜界線用 −0.833°（大氣折射 0.567° 加太陽半徑 0.267°，跟 NOAA、各國氣象單位一樣），曙暮光 −6°、−12°、−18°。
      - 日出、日落：先用當地那一天的太陽正午算時角，再用算出來的日出（日落）時刻的赤緯、均時差重算一次（NOAA 的 `calcSunriseSet` 也是兩次）。「那一天」是各國時鐘上的那一天：經度跟時區差很多的地方（吉里巴斯的基里地馬地島 UTC+14、經度 −157°），經度上的太陽日跟時鐘的日期差一天，取落在時鐘那一天 00:00–24:00 之間的正午（`solarNoon` 的 `shift`）。
      - 春分、夏至、秋分、冬至：NOAA 的低精度視黃經算出來差到 10 分鐘（2026 年春分算成 14:37 UTC，實際 14:46），落在半夜附近時日期會錯，所以改用 Meeus 第 27 章（平均值的多項式加 24 個週期項，ΔT 用 NASA 2005–2050 年的近似式）：2026 年 3/20 14:45、6/21 08:24、9/23 00:05、12/21 20:50 UTC，2025 年 3/20 09:01、6/21 02:42、9/22 18:19、12/21 15:03，跟公布的時刻差 1 分鐘以內。
      - **跟 NOAA 計算器核對**（2026-10-28 在 https://gml.noaa.gov/grad/solcalc/ 輸入同樣的經緯度與時區）：台北（25.04°N、121.56°E）2026-06-21 日出 05:05、日落 18:46、太陽正午 11:55:24（這裡 11:55），白天 13 小時 42 分；2026-12-22 日出 06:35、日落 17:10、正午 11:51:55（這裡 11:52），白天 10 小時 35 分；基多（0.18°S）2026-06-21 06:12／18:19、12-21 06:08／18:16，都一樣。特羅姆瑟（69.65°N）：2026-11-27 日出 11:20、日落 11:42（這裡 11:21、11:42），11-28 起極夜；2026-01-15 11:29／12:18（這裡 11:29／12:19）；極晝 2026-05-18 起、最後一天沒有日落的是 7-25（NOAA 一樣），7-26 日出 01:05、日落 7-27 00:13（一樣）。唯一不同的是 2027-01-15：這裡算正午太陽中心在地平線下 0.770°（−0.833° 以上，有 38 分鐘的白天），NOAA 寫極夜到 1-16 才日出；NOAA 第一次用那一天 00:00 UTC 的赤緯判斷有沒有日出，這裡用正午的，差 0.06°，在極夜的邊界上會差一天。
      - **台灣**：台北夏至 13 小時 42 分、冬至 10 小時 35 分、春分秋分 12 小時 7 分，晝長年較差 3 小時 7 分；正午太陽高度夏至 88.4°（北回歸線穿過嘉義，台北在它北邊 1.6°）、冬至 41.5°；時鐘與太陽：太陽正午早 6 分（台北在東經 121.6°，UTC+8 的中央經線是 120°）。任務單寫的「約 13 小時 34 分、10 小時 41 分」是估計，以 NOAA 核對過的數字為準。
    - **為什麼指標在瀏覽器裡算，不預先算好每一天**：預先算 366 天 × 240 國也只有幾百 KB，但 tooltip 的日出日落、側欄的全年圖表本來就要在瀏覽器裡算（任何一年的任何一天），兩邊各寫一份公式（Python 與 TypeScript）會有 1–3 分鐘的差（年份不同，同一個日期的赤緯差到 0.1°，高緯度的白天長度差幾分鐘），tooltip 跟排名表對不起來。改成只準備首都的經緯度與時區（`capitals.json`，16 KB），用同一份 `solar.ts` 算：一次白天長度 240 國 0.7 ms、正午太陽高度 0.5 ms、此刻的太陽高度 0.1 ms，晝長年較差（夏至、冬至前後各 8 天）18 ms，一年算一次（無頭 Chrome 實測）。排名表、地圖、側欄拿到的是同一個物件（`derivedData`）。
      - **換主題時的舊檔**：`useJson` 載入新檔的期間還拿著上一個檔（畫面調淡、照舊顯示），從別的主題切過來時 `derive` 拿到的是別的主題的指標檔，`Object.keys(file.capitals)` 丟錯，整個畫面換成錯誤畫面（第一次跑 check:en 從海洋與漁業切過來時發現）。現在 `derive` 的指標在載入中拿到 null（`App.tsx` 的 `sourceData`），一般指標拿到的不是指標檔（沒有 `years`、`values`，上一個是時刻主題的材料）時 `derivedData` 也當成還沒載入。
    - **首都**：用國家小檔案主題整理的 Wikidata 首都（`public/data/topics/profiles/capitals.json`，跟小檔案、首都的點同一份，所以要先跑 profiles）。有好幾個首都的 12 國取小檔案排第一個的（唯一或法定首都、再來是行政、立法、司法首都、政府所在地）：南非普勒托利亞（行政；開普敦立法、布隆方丹司法）、玻利維亞拉巴斯（行政；蘇克雷司法）、荷蘭阿姆斯特丹（海牙是政府所在地）、象牙海岸雅穆索戈、貝南波多諾伏、馬來西亞吉隆坡、斯里蘭卡可倫坡、史瓦帝尼墨巴本、智利聖地牙哥、葉門沙那、巴勒斯坦東耶路撒冷（宣告的首都；拉馬拉是實際的政府所在地，兩地相距 15 km）；蒙哲臘的法定首都普利茅斯 1997 年火山爆發後廢棄，改用布萊茲（`CAPITAL_OVERRIDES`）。其他首都列在側欄。同一國的首都通常很近，只有南非差得多（普勒托利亞跟開普敦的 6 月冬至白天長度差 38 分鐘；玻利維亞的拉巴斯跟蘇克雷差 10 分鐘），所以側欄寫出來。台灣是台北（Wikidata 寫「臺北市」，`NAME_OVERRIDES` 改寫）。
      - 沒有首都的地區用主要的城鎮（`MAIN_TOWNS`，tooltip 寫「以香港計算」、不寫首都）：香港、澳門、西撒哈拉（阿尤恩）、托克勞（法考福）、澳屬印度洋領地（聖誕島的飛魚灣）。南極洲、赫德島與麥當勞群島、錫亞琴冰川沒有常住的城鎮，不算（`noValue` 寫原因）。
      - 國土伸進極圈的 8 國另外列一個圈內的城鎮（`POLAR_PLACES`，首都都不在極圈內）：挪威特羅姆瑟、瑞典基律納、芬蘭烏茨約基、俄羅斯莫曼斯克、美國烏特恰維克（阿拉斯加）、加拿大伊努維克、格陵蘭伊盧利薩特、南極洲麥克默多站。冰島只有格里姆賽島碰到北極圈，不列。
    - **時區**（`sources/iana_tz.py`，跟旅行實用主題同一套規則，`topics.travel` 的 `TZ_OVERRIDES`）：Natural Earth 的首都有 `TIMEZONE`、而且在那國的 `zone.tab` 清單裡、跟這裡的首都在 300 km 內就用它，否則用 `zone.tab` 離首都最近的代表城市。`capitals.json` 存 IANA 名稱與 2026 年的標準時間。
      - **夏令時間**：日出、日落的時間是當地時鐘的時間，用瀏覽器的 `Intl.DateTimeFormat`（含 IANA 時區資料庫）依那一天換算，含夏令時間（馬德里 6 月 21 日日出 06:45、日落 21:49，寫「UTC+2，夏令時間」）；瀏覽器不認得的時區用標準時間。判斷是哪一個太陽日只用標準時間（夏令時間的 1 小時不影響）。
      - **「時鐘與太陽」用標準時間**：標準時間的 UTC 偏移減去經度 ÷ 15（平均太陽正午，不含一年裡 ±16 分鐘的均時差，tooltip 另外寫選定那天的實際太陽正午），換到 ±12 小時以內（薩摩亞 UTC+13、經度 −171.8°：+27 分）。有夏令時間的國家夏天再晚 1 小時，說明寫出來；不用夏令時間是因為同一國一年裡會變、南北半球相反，地圖會跟著日期跳。
      - 抽查（pipeline 印出）：北京 +14 分（中國全國用北京時間，西邊的烏魯木齊是 +2 小時 10 分，首都不是它）、馬德里 +1 小時 15 分（西班牙在本初子午線以西卻用中歐時間）、新德里 +21 分（印度 UTC+5:30）、布宜諾斯艾利斯 +54 分（阿根廷 UTC−3，經度是 UTC−4 的位置）、台北 −6 分、雷克雅維克 +1 小時 28 分、巴黎 +51 分、莫斯科 +30 分。
    - **地圖的晝夜：自訂的 WebGL 圖層，不用 GeoJSON 的多邊形**（`src/map/nightLayer.ts`）：
      - 夜半邊是以反日點為中心、半徑 90° − 0.833° 的球冠，幾乎永遠蓋住一個極點（春分、秋分時邊界正好穿過兩極）。MapLibre 的 GeoJSON 圖磚只到 ±85.05°（Web Mercator 的邊界），地球儀上極點附近會破一個洞（晝夜界線的經典錯誤），多邊形還要在 180° 經線、極點切開，一層曙暮光一個多邊形，播放時每一格都 `setData`、讓 worker 重新切圖磚。
      - 改成一張經緯度每 2° 一格的網格（91 × 181 個頂點、9.7 萬個索引，含 ±90°），頂點用 MapLibre 地球儀自己的投影函式（自訂圖層拿到的 `shaderData.vertexShaderPrelude` 的 `interpolateProjection`，球面座標照 `projectToSphere` 的軸向）放到球面上；平面地圖用 Web Mercator 座標（只到 ±85.05°，左右各多畫一份世界）。片段著色器算每個像素的太陽高度 h = asin(n · s)（n 是那一點的單位向量、s 是太陽直射點的方向），依 h 落在哪一段決定不透明度。極點、180° 經線都是連續的，沒有接縫；播放時每一格只換一個 uniform。WebGL 1 照 MapLibre 的做法把 `in`/`out` 換成 `attribute`/`varying`，`fwidth` 用 `OES_standard_derivatives`。
      - 驗證（截圖看過）：春分 14:46 UTC 從北極正上方看，晝夜界線是穿過極點的直線；冬至北極整片是夜、南極整片是白天，極點沒有破洞；夏至南極從上面看整片在極夜或曙暮光裡；平面地圖的冬至 20:50 UTC，太陽直射點在南回歸線上（西經 133°）、左右兩份世界都有；夏至台灣正午時太陽直射點正好在嘉義（北回歸線上）。
      - **效能**（無頭 Chrome、swiftshader、1280×800，轉動地球儀 6 秒）：晝夜開著 8.2 fps、關掉 7.2–7.9 fps（差異在誤差範圍內，著色器只是一次 9.7 萬個索引的繪製）、白天長度的面量圖加晝夜 7.2–7.7 fps；河流主題 6.2–7.0、人口 7.5–8.2。播放一天時大字每秒更新 11.7 次（目標 12.5），地圖每秒畫 8.5 格（swiftshader 每一格約 120 ms，有顯示卡時快很多）。
      - **赤道、回歸線、極圈**是一般的線圖層（`circles.json`），沿線寫名稱（`lineLabel`，第 4 節）。回歸線用 2026 年的黃赤交角 23.4358°（Meeus 式 22.2），極圈 66.5642°。不放 tooltip：北回歸線穿過台灣，滑過台灣時要看到國家的 tooltip。**一條緯線要切成 30° 一段**：一整條從 −180° 到 180° 的水平線，MapLibre 的 GeoJSON 圖磚在低縮放時只有含起點的那幾張畫得出來（東半球那一張整條不見，2026-10-28 實測；切開的兩段都正常）。
    - **播放與網址**（第 11 節「時刻主題的網址與播放」）：一天模式每格 10 分鐘、一年模式每格 2 天，每 80 ms 一格；播放的每一格不寫網址，停下來寫一次。減少動態效果時每秒一格（一小時、一週），不做連續的掃動，也不會自動播放。
    - **側欄**（`DaylightPanel.tsx`）：以首都計算的經緯度、時區；選定那天的日出日落；那一年每一天的白天長度（一條線、一個軸 0–24 小時，標出選定的那天與 12 小時的虛線，滑過有十字線與那天的日出日落）；春分、夏至、秋分、冬至在首都是哪一天（當地日期）與白天長度，標出一年中最長、最短；極圈的參考城鎮的極晝、極夜期間（跨年的寫到隔年）。資料還沒載入時畫灰色色塊。
    - **大小**：`capitals.json` 16 KB、`circles.json` 17 KB、`manifest.json`，共約 33 KB；縮圖 10 KB。
88. **日食路徑**（`pipeline/topics/eclipses.py`、`pipeline/sources/nasa_eclipses.py`、`src/topics/eclipses.ts`、`src/topics/panels/EclipsesPanel.tsx`，2026-10-28）：
    - **資料**（授權見第 12 點）：NASA 五千年日食目錄（Espenak & Meeus 2006）1801–2100 年的三頁，1900–2100 年有 454 次日食，其中日全食 140、日環食 146、混合食 13 次（偏食 155 次沒有路徑，不畫）。這 299 次裡 8 次是非中心食（影軸沒有打到地球，只有影子的邊緣掠過極區：1928-05-19、1950-03-18、1957-04-30、1957-10-23、1967-11-02、2014-04-29、2043-04-09、2043-10-03），2 次是只有一條界線的中心食（2003-05-31、2044-02-28）。
    - **根數**：每一次日食一頁貝塞爾根數。NASA 有兩組：五千年日食典（`SEsearch/SEdata.php`，VSOP87/ELP2000-82，ΔT 是 2006 年的外推，例如 2024 年 74.0 秒）每一次都有；路徑表那一組（`SEbeselm/`，VSOP87/ELP2000-85，ΔT 較新，2024 年 70.6 秒、2020 年 69.4 秒）只有部分日食有（1900–2100 年 152 次，其餘 147 次 404，記在 `.cache/nasa-eclipse/sebeselm/*.missing` 不再問）。有路徑表那一組的用它（跟 NASA 公布的路徑一致，近年的 ΔT 也比較準：2020 年台灣的日環食，五千年日食典的 ΔT 多 2.4 秒，經度差約 1 km），其餘用五千年日食典的。SEdata 頁的第 3 列夾著 PHP 的警告（`Undefined variable $_5MCSE_besselian_d3`），解析時先拿掉。
    - **算法**（`eclipses.py` 的檔頭）：基本面座標、WGS 84 橢球，每 2 秒一條垂直於影子相對地面運動方向的橫切線（太陽高度低、ζ < 0.3 的地方最多細分 15 倍），線上落在本影裡的範圍兩端用二分法找（40 次），兩端連起來就是北界、南界，c = 0 是中心線；不必另外解界線的迭代，只有一條界線的、非中心食的地平線那一側也一起包含。
      - 中心線上的持續時間 = 2|L2|/n（n 是影子相對觀測者的速度）；食甚（影軸離地心最近）的持續時間跟 NASA 目錄比，見下面「跟 NASA 目錄比」。
      - **路徑寬度寫 NASA 目錄的**（食甚時）：自己算的（橫切線兩端在地面上的距離，取垂直於地面路徑的分量）中位數跟目錄一樣，但太陽很低（11–19°）的寬路徑差到 9%（1932-03-07 南極外海的日環食 1,184 對 1,083 km：影子很斜時「垂直於路徑」的取法不同），所以 tooltip 用目錄的數字。只有一條界線的 2003-05-31、2044-02-28 另一邊是地平線，目錄沒有寬度，tooltip 也不寫。
      - **tooltip 寫食甚，不寫最長持續時間**：全食的食甚與最長持續時間只差 1 秒以內（2024-04-08：食甚 4 分 28.1 秒、最長 4 分 28.2 秒，位置差約 95 km），但環食最長的地方常在日出、日落的兩端（2020-06-21：食甚 38 秒在印度北部，中心線上最長的 82 秒在剛果共和國的日出處），寫最長會跟一般引用的數字不同。食甚的位置在陸地寫國名（`geoindex`，找 0.3° 內最近的國家），在海上寫 IHO 海域的名稱（河流主題的海域網格與 `SEAS` 的中文名，大洋本身另外寫北太平洋、南大西洋…）。
      - **線**：北界、南界各自用 Douglas–Peucker 簡化到 0.6 km（球面上的弦距離），接成一個封閉的環（北界、終點、南界倒過來、起點），量化 0.005°；一次日食一個環（`r` = 0）加一條中心線（`r` = 1）。經度沿著環展開成連續的（101 次的路徑跨過 180° 經線），整條平移到第一點在 ±180° 內。**環繞極點的路徑**（2021-06-10 這類從北極上方經過的）展開後經度回不到起點（差 ±360°），在最靠近極點的頂點切開、補上沿 ±90° 緯線的兩點，MapLibre 才畫得出來（麥卡托與地球儀都只畫到約 ±85°）。中心線只留 ±85.05° 以內的部分（超出的會被 MapLibre 壓到 85° 的緯線上，畫出一圈），環的外框由前端同樣裁掉（第 4 節）。
      - **環不能自己交叉**（MapLibre 三角化交叉的多邊形會畫出碎片）：第一版 299 個環有 16 個交叉。一種是很窄的混合食（1930-04-28 全程只有 1 km 寬、1986-10-03、1987-03-29、2005-04-08），北界、南界各自簡化 0.6 km 就交叉了：寬度不到 3 km（`NARROW_KM`）的地方每約 5 km 固定留一點，各段之間再簡化（1930-04-28 的環 1,435 點）。另一種是路徑起點、終點的小「8 字形」（地平線那一側的端點往回折，例如 2023-10-14 在巴西外海的終點）：量化後找出交叉的兩段，把中間的點倒過來（2-opt，`untangle()`）。現在都沒有交叉（逐一檢查過）。
      - 每一次日食的共用資料（日期、類型、沙羅週期、食甚的持續時間與位置、國家或海、寬度、是不是非中心食）放在 `groups`（第 4 節），線的紀錄只有日食編號、年份、角色。
    - **跟 NASA 目錄比**（`report_checks()`）：289 次中心食，食甚時中心線上的持續時間跟目錄差中位數 0.3 秒、最大 0.7 秒（目錄寫到秒）。
    - **跟 NASA 的路徑表比**（`verify()`，每 2 分鐘一列，座標到 0.1′，約 0.2 km；北界、南界、中心線到我們畫的線的距離，與同一時刻中心線位置的距離）：
      - 同一組根數（路徑表那一組）：2024-04-08 日全食北界中位數 0.05 km、最大 0.13 km，南界 0.04／0.11 km，中心線 0.04／0.12 km；2027-08-02 日全食 0.05／0.12、0.05／0.12、0.04／0.14 km；2020-06-21 日環食 0.04／0.13、0.04／0.11、0.04／0.12 km；2023-04-20 混合食 0.03／0.10、0.04／0.12、0.04／0.11 km；2013-11-03 混合食 0.05／0.12、0.05／0.11、0.04／0.11 km。同一時刻的中心線位置中位數 0.07–0.08 km（最大 0.15–1.16 km，在日出、日落處，地面上的影子一秒走好幾公里）。誤差都在路徑表的位數以內，算法沒問題。
      - 五千年日食典的根數：界線與中心線 0.19–0.56 km（中位數），最大 0.9 km（2027 年）；同一時刻的位置差 1.5–4.3 km（ΔT 差 1–4 秒，影子沿著路徑前後移動）。這一組只用在沒有路徑表的日食。
      - **NASA 混合食的路徑表在全食的那一段把北界、南界標反了**（環食的那一段沒有；2023-04-20 表上 03:00 的「北界」在南緯 32.87°、「南界」在 32.63°，看起來是照環食的正負號決定哪一邊叫北界），比對時全食段對調；我們的北界一律是運動方向的左邊（向東走時是北邊）。
    - **經過哪些國家**：每條橫切線上每約 2 km（0.0003 地球半徑，太陽低的地方加密到 4 倍）取一點，一次日食 8 萬–80 萬點，先併到 0.01° 的格子再判斷國家（`geoindex.countries_at(…, nearest=False)`：Natural Earth 1:10m，只算陸地，不找海上最近的國家；`ISLANDS` 的台灣離島照樣算），有一點落在那一國就算經過。每一點的 L2 < 0 是全食、> 0 是環食，所以混合食在全食的那一段算日全食、環食的那一段算日環食；每一點的持續時間 ≈ 2√(L2² − c²)/n（直線運動的近似，誤差幾秒），取那一國最長的，寫在側欄。小於約 2 km 的島可能漏掉。
    - **指標**（1900–2100 每年一筆，1:10m 有形狀的 242 個國家／地區都有值，其中 227 個有路徑經過）：
      - 「日食路徑」（預設，不上色）：那一年經過的類型（1 日環食、2 日全食、3 都有），排名表只列經過的國家（`unranked`、不畫長條），國家的 tooltip 寫「日全食經過」。
      - 「日全食次數」「日環食次數」：1900 年累計到那一年（比例圓：次數跟國土大小有關，跟颱風的次數一樣不用面量圖），`timeAxis` 寫「1900–2100 年」，預設年份 2100；地圖上是到那一年為止的中心線（`history-total` 只畫日全食與混合食、`history-annular` 只畫日環食與混合食，`onlyTypes`；不給 tooltip，國家才滑得到）。
      - 「下一次日全食」：**從時間軸那一年（含）起**，下一次日全食還要幾年（0 是那一年就有）；顏色依還要幾年分級（1、5、10、20、40、70 年，所有年份共用），`format(值, 年)` 寫出哪一年（第 4 節），到 2100 年都沒有的是 null，寫「到 2100 年都沒有日全食經過」（指標的 `missing`）。選「那一年起」而不是「今天以後」：時間軸才有意義（拖到 1930 年看當時的人要等多久），預設的 2027 年又剛好等於今天以後的下一次（2026-08-12 以後到年底沒有日全食）。側欄的「下一次」則從今天算起。不排名（`unranked`），排名表由近到遠排（`lowerIsBetter`）。
    - **其他年份的路徑**：1900–2100 年約 300 次的中心線疊在一起是一張很密的網，蓋過那一年的路徑，所以只做成預設關閉的圖層「1900–2100 年所有的中心線（淡）」（不透明度 0.35、不給 tooltip）；次數的兩個指標則畫累積到那一年的中心線，說明次數從哪裡來。
    - **側欄**（`panel.json`）：經過這國陸地的每一次日食（日期、類型、這國境內最長的持續時間；多於 12 次的先列下一次附近的 12 次，「顯示全部」展開），上一次與下一次日全食（從今天算）。點一列：時間軸換到那一年（`selectYear`）、標出那一次的路徑（`highlightLine`，次數指標時標累積的中心線那一層）、地圖移到路徑的範圍（`focusBox`）；標出的路徑留著，時間軸換到別的年份才取消。
    - **台灣**：日全食 3 次、日環食 5 次。
      - 上一次日全食 1941-09-21：路徑經過台灣北端（基隆、金山一帶，最長約 2 分 11 秒）與馬祖（東引約 3 分 20 秒，側欄寫的「這裡最長」是馬祖）。下一次 2070-04-11：只掠過恆春半島南端（約 1 分 37 秒）與蘭嶼（約 3 分 21 秒）。再下一次 2089-10-04 只經過馬祖（東引約 1 分 33 秒）。
      - 日環食：1955-12-14（澎湖與嘉南一帶約 7 分 36 秒）、1958-04-19（北部約 7 分 3 秒）、2012-05-20（北部與馬祖，最長約 4 分 34 秒在馬祖）、2020-06-21（中心線從嘉義沿海的東石、布袋一帶到台東成功一帶，台灣境內約 1 分 0–1 秒，路徑寬約 47 km，跟 NASA 路徑表 08:14–08:16 UT 那兩列的 47、48 km 與 59.8、60.9 秒一致）、2074-01-27（只經過馬祖）。
      - 馬祖、東引這幾個 1:10m 沒有形狀的離島用 `geoindex.ISLANDS` 的矩形範圍判斷（範圍只框住島本身，但裡面的海也算），所以 2089 年那一次是路徑的邊緣掠過東引、南竿北竿的範圍。
    - **抽查**（上一次／下一次日全食，到 2100 年的次數）：日本 2009-07-22／2035-09-02（全食 8、環食 13）；中國 2009-07-22／2034-03-20（17、20）；美國 2024-04-08／2033-03-30（28、23）；西班牙 2026-08-12／2027-08-02（7、6）；埃及 2006-03-29／2027-08-02（7、5）；智利、阿根廷 2020-12-14／2048-12-05（14、18；12、18）；澳洲 2023-04-20（混合食的全食段）／2028-07-22（16、18）。都跟 NASA 的路徑圖對得起來。
    - **大小**：7 個檔 1.46 MB（gzip 後 349 KB）：`paths.json` 933 KB（gzip 後 319 KB，606 條線、11.5 萬個頂點，第一個畫面就下載）、四個指標檔各 100–190 KB（gzip 後 3–5 KB）、`panel.json` 38 KB（gzip 後 14 KB，點國家才下載）。pipeline 第一次約 10 分鐘（約 600 頁，每頁間隔 0.3 秒），之後用快取約 5 分鐘（299 次日食加上驗證）。

89. **地球的另一邊（對蹠點）**（`pipeline/topics/antipodes.py`、`src/topics/antipodes.ts`、`src/topics/panels/AntipodesPanel.tsx`，2026-10-28）：
    - **對蹠點**：穿過地心的另一邊，緯度變號、經度加減 180°（球面上嚴格的對蹠點；地球是橢球，但緯度、經度這樣換的點也剛好是橢球上的對蹠點）。
    - **地圖上翻過去的形狀**（`flipped.json`）：地圖本身的 world-atlas 1:50m 國界（topojson），每條 arc 先用 Douglas–Peucker 簡化到 0.012°（約 1.3 km；相鄰的國家共用 arc，簡化後仍接得起來），接成每個國家的多邊形再平面化：跨 ±180° 的展開成連續經度後切成兩邊；world-atlas 的南極洲是給 D3 球面幾何用的，外環沿著 −89.999° 繞一圈、海岸線是「洞」，改成海岸線沿 −90° 封起來的外環。整片陸地（所有國家的聯集，含南極洲）在 0° 經線切開，西半邊加 180°、東半邊減 180°、緯度變號（shapely），跟陸地相交的是「陸地對陸地」（1,046 塊），其餘是「對面是海」（1,034 塊），面裡的洞照樣存（`h`）；外框是翻過去的 topojson arc，只有一國用到的是海岸線、兩國共用的是國界，國界只畫一次，在 ±180° 切開的邊與南極洲沿極點的邊翻過去不是真的海岸線，不畫。每個國家另外存一份翻過去的形狀（第 5 類）：原本的環展開成連續經度直接翻過去，可以超過 ±180°，外框才沒有在 180° 切開的假邊（英國、法國翻過去跨 180° 經線，截圖看過是完整的一塊）；平常不畫，側欄打開時標出。
    - **各國的對蹠點落在哪裡**：全球等面積的取樣網格，每 3 km 一點（6,672 列、5,668 萬點）；第 i 列跟倒數第 i 列對赤道對稱、每一列的點數取偶數，經度 j 的對蹠點正好是同一列對稱那一列的第 j + n/2 點，所以每一點只判斷一次。國家用 `geoindex` 的 Natural Earth 1:10m（跟其他主題判斷位置的同一份，套用 `BORDER_FIXES`；不套 `ISLANDS`，那些矩形含海面，會把澎湖一帶的海算成台灣的國土；1:10m 本來就有澎湖、金門、蘭嶼、綠島，只少馬祖、烏坵、東沙），海用河流主題的 IHO 海域網格（0.025°），不在 IHO 海域裡的找最近的海（KD 樹只建一次），離 IHO 的海超過 100 km 的是裏海（不在任何國家、也不是 IHO 的海）。台灣海峽照河流主題的規則（IHO 的南海裡、鵝鑾鼻到南澳島連線以北）另外標出。網格取到不到 2,500 點的 92 個小國（梵蒂岡、吐瓦魯、馬爾地夫…）在自己的範圍裡另外用細的經緯度網格取樣（範圍裡的點不夠就把格子切細）。整個步驟約 30 秒（等面積網格 5,668 萬點判斷國家與海約 15 秒）。
      - 全世界的陸地（含南極洲）有 13.1% 的對蹠點也是陸地，不含南極洲 11.4%；在球面上隨機取 200 萬點直接判斷，13.06%（陸地占地表 28.8%，陸地對陸地占地表 3.8%），兩種算法一致。
      - 242 個國家/地區有值，161 個的對蹠點全在海上；100% 對著陸地的 19 個：台灣、香港、澳門、馬來西亞、新加坡、菲律賓、汶萊、帛琉、斐濟、萬那杜、東加、薩摩亞、美屬薩摩亞、紐埃、庫克群島、吐瓦魯、瓦利斯和富圖那、福克蘭群島、赫德島及麥唐納群島。
      - 法國在地圖上含法屬圭亞那（第 86 點），所以法國的對蹠點有 10% 在班達海、1% 在印尼；側欄標出的形狀也有兩塊。
    - **指標**：對蹠地圖（預設，不上色，值是陸地對陸地的比例，給 tooltip 與排名表）、陸地對陸地的比例（面量圖，門檻 0、5、25、50、75、100%，排名：「最多國土對著陸地」有意義）、首都的對蹠點離陸地（面量圖，km，`unranked`：遠近沒有好壞，排名表依數值排列）。
      - **沒有做成類別圖的「主要落在哪裡」**：依取樣，各國的對蹠點主要落在太平洋的 151 個、印度洋 38、陸地 32、大西洋 13、南冰洋 7、北冰洋 1，六成以上是同一類，地圖幾乎一片同色；「主要的對蹠國」只有 81 國有，而且超過 8 類。所以第二個指標選首都的對蹠點離陸地多遠：一個數字、讀得懂（「北京的對蹠點在阿根廷的陸地上」「華盛頓的對蹠點在印度洋，離澳洲 1,192 公里」），34 個首都的對蹠點本身就在陸地上。
    - **首都**：晝夜與季節主題輸出的 `capitals.json`（國家小檔案的 Wikidata 首都，0.01°），對蹠點在哪一國（1:10m，不找最近的）或哪一片海；在海上時離最近的陸地多遠（1:10m 所有外環頂點的 KD 樹，球面距離），在陸地上時離另一國的國界多遠（最近的 64 個頂點裡第一個屬於別國的，粗估）；最近的城鎮是 Natural Earth 1:10m populated places（7,342 個，公有領域；中文用 `NAME_ZHT`，有些其實是簡體，再用 `nobel.S2T` 轉一次）。
      - **台北**（Wikidata 25.04°N、121.56°E）的對蹠點是 25.04°S、58.44°W，在**阿根廷**：1:10m、地圖的 1:50m 都是阿根廷，離巴拉圭的國界（皮科馬約河）約 12 km；OpenStreetMap 的 Nominatim 反查是阿根廷福爾摩沙省皮拉加斯省區的 Buena Vista 市（第 12 點）。最近的城鎮是巴拉圭的首都亞松森，約 85 km。台灣的國土 89% 對著巴拉圭、11% 對著阿根廷。
      - 抽查（陸地對陸地的比例；首都的對蹠點）：西班牙 28%（紐西蘭；南太平洋 56%、塔斯曼海 16%），馬德里 → 紐西蘭北島（北帕莫斯頓 59 km）；葡萄牙 17%（紐西蘭），里斯本 → 塔斯曼海，離紐西蘭 251 km；紐西蘭 60%（西班牙 53%、葡萄牙 6%、摩洛哥 1%），威靈頓 → 西班牙（薩拉曼卡 52 km）；阿根廷 86%（中國 73%、蒙古 10%），布宜諾斯艾利斯 → 黃海，離中國 129 km；智利 95%（中國 62%、蒙古 19%、俄羅斯 14%），聖地牙哥 → 中國（安康 90 km）；中國 27%（阿根廷 22%、智利 5%），北京 → 阿根廷（科內薩將軍鎮 75 km）；蒙古 27%，烏蘭巴托 → 智利；美國 0.5%（夏威夷 ↔ 波札那 0.2%、阿拉斯加 ↔ 南極洲 0.3%），華盛頓 → 印度洋，離澳洲 1,192 km；印尼 67%（巴西、哥倫比亞、委內瑞拉、厄瓜多），雅加達 → 哥倫比亞；巴拉圭 8%（台灣），亞松森 → 東海，離台灣 48 km（基隆 66 km）；澳洲 0%（全在北大西洋），坎培拉 → 離葡萄牙的亞速群島 406 km。
    - **滑到地圖上任何一點**（主題的 `pointer`，第 4 節）：對蹠點在陸地上的用地圖的 1:50m 國界在瀏覽器裡判斷（`countryLocator()`，跟地圖上的國界一致；跟側欄用的 1:10m 在國界附近可能差幾公里），在海上的查 `seas.json`：0.25° 網格每一格的海，逐列的 [值, 長度] 編碼，陸地的格子填最近的海（地圖的國界跟 1:10m 不同的海邊也查得到海名），南極洲的陸地另外一類（地圖的國家不含南極洲）。海上時 tooltip 的第一行是游標這裡的海名與經緯度。`seas.json`、`panel.json` 在第一次滑過時才下載（下載完之前寫「…」）。
    - **大小**：`flipped.json` 1,189 KB（gzip 後 384 KB，5,992 條線、19.4 萬個頂點；對蹠地圖一打開就下載，兩個面量圖的海岸線也是同一個檔）、`panel.json` 71 KB（21 KB）、`seas.json` 60 KB（18 KB）、兩個指標檔各 3 KB，共 6 個檔 1,327 KB（gzip 後 425 KB）。簡化前（不簡化 arc、每個國家各存一份面與外框）是 1.82 MB、32 萬個頂點。
    - **限制**：MapLibre 的地球儀用麥卡托的圖磚，北緯 85.05° 以北沒有圖磚，翻過來的南極洲蓋到北極海時，極點附近一圈畫不出來（滑過照樣寫「地球另一邊：南極洲」）。使用者自己在地圖上放成對的標記（這裡與它的對蹠點）沒有做，只有首都的那一對與跟著游標的小圈。
90. **石油、天然氣與煤**（`pipeline/topics/fossil_fuels.py`、`pipeline/sources/eia.py`、`factbook.py`、`moeaea_fuels.py`、`baci.py` 的 `yearly_hs6_rows()`、`src/topics/fossil-fuels.ts`、`src/topics/panels/FossilFuelsPanel.tsx`，2026-10-28）：
    - **單位各用各的**（使用者決定）：石油千桶/日、天然氣十億立方公尺、煤百萬公噸（EIA 是千公噸，÷ 1,000）；蘊藏量是十億桶、兆立方公尺、百萬公噸；人均是桶、立方公尺、公斤；流向是公噸。同一個指標的三種燃料單位不同，用新的 `itemFormats`（第 4 節）依子項目換格式，不把燃料拆成不同的指標（指標選單會變成 18 個）。燃料的指標也各自寫 `dimension: FUELS`：選了流向的「液化天然氣（LNG）」時，側欄的卡片才會寫「天然氣產量」。
    - **EIA**：整批下載檔 INTL.zip（24 MB，解開 129 MB，一行一個 JSON；`eia.annual()` 先用字串比對篩掉不要的行，整個檔 1.5 秒）。
      - 石油的產量是原油（含凝結油，57-1），消費量是石油及其他液體（5-2，含煉油廠自用、石化原料與國際航線的燃料：新加坡、荷蘭的人均很高，附註寫明）。自給率的分子用 55-1（原油＋天然氣液＋其他液體），**不用 53-1**：53-1 多了煉油增量，台灣 2024 年 25.4 千桶/日裡 24.6 是煉油增量，原油只有 0.196。
      - 石油的時間軸從 1985 年開始：1980–1984 年有值的地區不到最多那年的 30%（`year_span()` 截掉），指標說明寫明。石油產量有 2025 年（約 215 國）；消費量的 2025 年只有 36 國，被截掉。
      - 不做原油的進出口量指標（57-3、57-4 在 2019 年起只剩 36 國）；天然氣、煤的進出口（26-3、26-4、7-3、7-4）放在側欄的表，不加成指標。
      - 地區代碼：區域合計（WORL 當世界值，其餘丟掉並印出）；**已經不存在的國家畫成主題自訂的地點**（`places`）：蘇聯 `_SUN`（莫斯科）、南斯拉夫 `_YUG`、塞爾維亞與蒙特內哥羅 `_SCG`（貝爾格勒）、捷克斯洛伐克 `_CSK`（布拉格），人均消費量的人口是今天的繼承國在當年的人口加總（WPP 依現在的國界回推）；西德 DEUW 與東德 DDR 在 1990 年以前加總成德國（EIA 的 DEU 從 1991 年起）。不把蘇聯算在俄羅斯：蘇聯的產量有一大塊在哈薩克、亞塞拜然、土庫曼。XKS 換成 XKX，荷屬安地列斯（NLDA）等不在地圖上的小屬地丟掉。
      - 煤蘊藏量（7-6）是百萬**短噸**，× 0.90718474 換成公噸；煤的產消用 `-MT`（千公噸），不用 `-TST`。
      - 數值有字串（"NA"、"--"），當成缺值。INTL.zip 大約每月更新，重跑時年份會往後多一年，`eia.RELEASE_TEXT` 與頁尾的月份要一起改。
    - **蘊藏量**：EIA 只有煤；原油、天然氣的蘊藏量已經從 EIA 下架，改用 CIA World Factbook 的 2021 年估計（只有一個年份，時間軸在這個指標只有 2021；99 國有值，沒有欄位的國家是「無資料」，不是 0）。Factbook 的檔名是 FIPS 代碼（`ng` 是尼日、`ni` 才是奈及利亞），用每個檔的「Internet country code」換成 ISO（`.uk` 是 GB，法國取 `.fr`）。資料已經凍結，`factbook.FILES` 列出有蘊藏量的 100 個檔，從 raw.githubusercontent.com 逐檔下載（cloud 的 codeload、GitHub API 都被擋）；數字是文字（「258.6 billion barrels (2021 est.)」「2.38 million barrels」），解析不了就報錯。2021 年前 5 名：原油委內瑞拉 3,038、沙烏地 2,586、伊朗 2,086、加拿大 1,703、伊拉克 1,450 億桶；天然氣俄羅斯 47.8、伊朗 34.0、卡達 23.9 兆立方公尺。
    - **BACI 的流向**（HS92 版 1995–2024，跟塑膠污染共用同一個 zip）：
      - 商品是指標自己的子項目（原油 270900、LNG 271111、管道天然氣 271121、煤 2701 的四個六位碼加總）；id 跟燃料共用（`gas` 是 LNG），從產量等指標換到流向時留在同一種燃料，天然氣預設 LNG。LNG 與管道天然氣分開畫（台灣只有 LNG，歐洲主要是管道）。管道天然氣從 2000 年開始：1995–1999 年有 20–39% 的金額沒有數量。管道天然氣的公噸不換算成立方公尺，指標說明寫「約 0.7–0.75 百萬公噸是 10 億立方公尺」。
      - **數量的清理**（`clean_quantities()`）：每一年、每個六位碼算依金額加權的單價中位數，單價比中位數高 3 倍以上或低到三分之一以下、或數量空白的流量，數量改成「金額 ÷ 中位數單價」。一組夥伴的數量有 10% 以上是估算的，流向檔標記、tooltip 寫「數量是估算的」。pipeline 印出每年改了幾筆、占多少金額；全球合計（百萬公噸，原始 → 清理後）跟製作手冊試算的一致：原油 2023 年 2,667 → 2,297、LNG 2016 年 637 → 287、2020 年 484 → 329、煤 2019 年 1,974 → 1,449。改得最多的是管道天然氣 1995–1999 年（20–39%，所以不用）、煤 1997 年 11.6%，其他年份大多在金額的 3% 以下。
      - 1999 年以前的南部非洲關稅同盟（代碼 711、ISO3 欄 `ZA1`）算在南非（`BACI_EXTRA`），南非的附註寫明含波札那、賴索托、納米比亞、史瓦帝尼；否則南非 1999 年以前的煤出口（每年 22–26 億美元）會不見。
      - **伊朗 2023、2024 年的原油出口是 0**（沒有進口國申報），馬來西亞的原油出口大增（一般認為含轉運的伊朗原油），伊朗、馬來西亞的附註與流向的說明寫明。比利時的管道天然氣出口大多是過境再出口（附註）。
      - 讀 30 年的整個 zip 約 4 分鐘，燃料的六位碼存在 `.cache/baci/fossil-fuels-V202601.json.gz`（1.7 MB），之後重跑 30 秒。
    - **GEM 的疊加圖層**（2026 年的快照，不跟時間軸變）：
      - **天然氣管線**（GGIT）：3,197 條運轉中、興建中、規劃中的管線被切成 17.6 萬段（Tennessee Gas Pipeline 一條就六萬多段兩點的小段），平行的複線共用頂點（一個節點接 4、6、8 段），還有重複的段。`stitch()`：端點量化到 0.001° 當節點、重複的段只留一段，再從還沒用過的段往兩頭延伸，每到一個節點接上轉角最小、還沒用過的段，接成 26,114 條；Douglas–Peucker 0.01°（約 1 公里，頁尾寫明）後 10.3 萬個頂點、772 KB。名稱、狀態、容量、國家每條管線只存一次（`LinesData.groups`），線只存組別，滑過時整條管線一起標出。擱置、取消、退役、封存、閒置的不畫。
      - **油管**（GOIT）：原油、天然氣液兩種顏色，興建中與規劃中畫虛線，2,328 條、2.2 萬個頂點、210 KB。GOIT 的容量（boe/d）有明顯錯誤（Rotterdam Rhine Pipeline 502 萬桶/日），線寬不依容量，tooltip 也不寫容量。
      - **LNG 接收站**（GGIT 檔裡的 LNG）：同一個 `project-id` 的分期合成一個點（478 個專案、772 個分期），運轉中的容量畫在「運轉中」的圖層，只有興建中或規劃中的接收站在另一個預設關閉的圖層；tooltip 列出各分期。進口薄荷綠、出口紫。country-area1 空白的（East London LNG Terminal）依位置找國家。
      - **油氣田**（GOGET）：6,665 個點，面積是產量（百萬桶油當量/年，tooltip 寫產量的年份），只畫生產中、開發中、已發現；位置只到國家的 500 個、封存、除役、廢棄、找不到、地下儲氣的不畫。美國有些點是公司層級的資產合計，不是單一油田。
      - **煤礦**（GCMT）：運轉中 3,744 座（預設打開）、規劃中 977 座、已關閉或封存 2,314 座（預設關閉），面積是產能；292 個礦區範圍多邊形（SMP）不畫。
      - 名稱有 UTF-8 被當成 cp1252 再存一次的亂碼（`TerÃ©ga`、`Basraâ€“Aqaba`、國名 `CÃ´te d'Ivoire`），`fix_text()` 改回來（修了 132 筆）；GEM 的國名拼錯（`Kazkahstan`）、「Timor-Leste」被逗號拆開、帝汶海的聯合石油開發區寫在 `GEM_COUNTRY`，對不到的國名直接報錯。
      - 授權照發電廠地圖標 CC BY 4.0（使用者決定），依據與風險見第 12 點。
    - **台灣**：
      - 地圖、排名一律用 EIA（各國同一套方法），能源署的數字只放附註與側欄。EIA 的台灣原油產量 2015 年起每年都是 0.196 千桶/日、天然氣產量 2023、2024 年都是 0.0601 十億立方公尺（沿用），天然氣與煤的進口量與消費量相同（EIA 的估計），煤蘊藏量 2008–2023 年都是 1 百萬公噸；能源署的自產原油 2005 年 29.2、2015 年 8.3、2024 年 1.3 千公噸油當量（約 0.03 千桶/日），自產天然氣 2024 年約 55 千公噸油當量。附註寫明。
      - BACI 沒有台灣自己的申報，代碼 490 也不全是台灣（委內瑞拉 2011–2013 年記到這裡的原油）。台灣的側欄用能源署的原油、液化天然氣、煤炭進口來源年資料（2005 年起）跟 BACI 逐國對照占比（**使用者決定三種燃料都用能源署，財政部 i9204 不用**）。能源署只有主要來源國的欄位，其餘是「其他」；BACI 某一年占 1% 以上、能源署沒有欄位的夥伴（原油的墨西哥 15.6% 等）也列出來，能源署那一欄是「–」。2024 年（能源署／BACI）：原油沙烏地 31.3%／27.1%、美國 29.1%／25.0%、科威特 13.1%／11.3%；LNG 澳洲 37.9%／40.6%、卡達 25.3%／21.9%；煤澳洲 48.8%／53.3%、印尼 27.6%／26.4%、俄羅斯 13.5%／9.3%。
      - GEM 在台灣只有天然氣管線（運轉中 5 條、規劃中 2 條；擱置的 1 條不畫）與 7 個 LNG 接收站（16 個分期）；油管、油氣田、煤礦都是 0，側欄寫明。接收站名稱照 GEM 的英文原文（跟發電廠地圖一樣），沒有自己翻成中文。
    - **大小**：整個主題 369 個檔、5.55 MB（gzip 約 1.7 MB），超過「盡量小於 3 MB」：流向檔 4 種商品 × 30 年 × 每國前 15 名占 2.5 MB（已經改成千公噸、3 位有效數字，數字的長度幾乎沒有變短）、天然氣管線 772 KB、油氣田 544 KB、側欄明細 497 KB。都是選了國家、換了燃料或打開圖層才下載：第一個畫面（石油產量）約 50 KB 的指標檔加油管 210 KB、油氣田 544 KB。側欄原本也存每國四種商品的流向歷年（1.8 MB），拿掉了，只列這一年的主要夥伴。

91. **中國的海外貸款**（`pipeline/topics/china_lending.py`、`pipeline/sources/aiddata.py`、`src/topics/china-lending.ts`、`src/topics/panels/ChinaLendingPanel.tsx`，2026-10-28）：
    - **來源**：AidData（William & Mary）的 Global Chinese Development Finance Dataset 3.0（2023-11-07 發布）的 zip（28.6 MB），裡面的 xlsx 的 `GCDF_3.0` 工作表（20,985 筆、128 欄），openpyxl 的 read_only 模式讀一次約 15 秒，只留用到的 12 欄存成 `.pkl` 快取。`__MACOSX/` 與 `.DS_Store` 略過。
    - **只加總 `Recommended For Aggregates` = Yes 的 17,957 筆**：AidData 建議的做法，排除取消、暫停、只有承諾意向（Pipeline: Pledge）的與傘狀協議（底下的項目已經各自列出，加回去會重複算）。
    - **金額用 `Adjusted Amount`**：扣掉人民銀行換匯與紓困貸款的短期展期（rollover），17,957 筆合計 1.3423 兆美元（2021 年固定美元），跟 AidData Guide 工作表寫的「$1.34 trillion」一致；沒扣的 `Amount (Constant USD 2021)` 是 1.5054 兆。
      - **是承諾，不是撥款或債務**：指標名稱與說明都寫「承諾金額」。2000–2021 年累計最多的：俄羅斯 1,693 億、委內瑞拉 1,129 億、巴基斯坦 703 億、安哥拉 651 億、哈薩克 641 億美元（跟製作手冊查的一致）。
      - 占 GDP 的比例**分子分母都用當期美元**：`Adjusted Amount (Nominal USD)` 的累計 ÷ 那一年的 GDP（人均收入主題的 `gdp.json`，IMF WEO＋世界銀行）。固定 2021 年美元除以早年的當期 GDP 會偏高；製作手冊只寫「占 GDP」，這是做的時候的選擇。每人金額用固定美元 ÷ 那一年的人口（人口主題的 `total.json`，UN WPP 2024）。沒有 GDP 的庫克群島、紐埃、北韓、英屬維京群島只有前兩個指標與每人金額。
      - **馬紹爾群島占 GDP 1,631%**（2021 年，全部）：大多是 ICBC、國開行租賃等給在馬紹爾群島登記的航運公司的買船貸款與售後租回（液化天然氣船；權宜船籍），不是給那個國家的錢。資料照原樣，各指標檔的 `notes` 寫明，占 GDP 的說明也提到。
    - **子項目**：`Flow Type Simplified` 的 Loan、Grant 分成「貸款」「贈款」；「全部」另外含債務重整（Debt Rescheduling）與類型不明（Vague）。用 ODA 類／OOF 類（`Flow Class`）分是另一個選項，使用者選了照類型分。
    - **涵蓋範圍**：AidData 有系統地搜尋過的 165 個國家與地區（CountryList 工作表的英文名稱，pycountry 對不到的 5 個寫在 `NAME_ALIASES`），其中 18 個沒有找到項目，值是 0（不是無資料）；範圍外的國家用 `coverage` 寫「不在 AidData 的範圍裡（只收中低所得國家）」，不寫成 0。台灣、中國用主題的 `noValue`。區域性、跨國的項目（加總的 214 筆）沒有受援國，只算在世界合計（`WLD`，算「占全球」）。
    - **沒有畫流向弧線**：只有一個出資國，弧線都從中國出發（使用者 2026-10-28 決定不畫）。頁尾的說明跟「國際援助與僑匯」互相指到對方，側欄最後連到那個主題。
    - **側欄**（`countries/<ISO3>.json`，146 國，金額以百萬美元存）：用途依 OECD 三位碼部門（24 類，中英文名稱在側欄的 `SECTOR_NAMES`），全部／貸款／贈款各存一份歷年金額，累計的指標加到時間軸那一年、當年的指標只看那一年；歷年的類型用 `stackedAreaOption`（堆疊面積，`src/charts/stackedArea.ts`）；金額最大的 10 個項目（各子項目一份）寫 AidData 的英文原文名稱（`translate="no"`，超過 200 字截斷）、年份、金額、部門、類型與狀態。沒有項目的國家（累計是 0 的 18 國、範圍外的國家）不下載明細檔。
    - **大小**：12 個指標檔共約 190 KB、146 個國家明細共約 0.95 MB（一次只下載一個，2–20 KB），合計約 1.2 MB。

92. **法律與制度：死刑**（`pipeline/topics/laws.py`、`pipeline/sources/death_penalty.py`、`src/topics/laws.ts`，2026-10-28）：
    - **新主題「法律與制度」**（社會類，排在治安與司法後面）：第一個指標是死刑，之後依製作手冊再加法定年齡（第 93 點）、徵兵、大麻、強制投票等。做法跟婚姻與家庭的同性伴侶一樣（第 12 點）：自行整理的表、檔頭列出每篇條目的 revid、資料檔依 CC BY-SA 4.0 分享。
    - **四類，每年年底的狀態**（1950–2026，類別圖，發散色：法律上還有死刑的在橘色那一側、已經廢除的在青綠那一側）：1 保留、2 事實上廢除、3 只廢除普通犯罪（戰時、軍法等例外仍保留）、4 全面廢除。
      - **事實上廢除**＝法律上還有死刑（普通犯罪也適用），但那一年與之前 9 年都沒有執行（年底往前 10 年沒有執行）。依各國最後一次執行的年份自己判斷，**不轉載國際特赦組織的名單**（CC BY-NC-ND）。
      - 只知道最後一次執行的國家，之前的年份當成有在執行；中間另有 10 年以上空檔、之後又恢復的，只算條目寫明的（`GAPS`：緬甸 1988–2022、甘比亞 1965–1981 與 1981–2012、查德 2003–2015）。菲律賓 1987 年以前最後一次執行的年份條目沒有寫，1993–1998 年恢復死刑的那幾年算保留。
      - 「獨立以後沒有執行過」的國家：條目有寫獨立以前最後一次執行的（`BEFORE_INDEPENDENCE`，例如斯洛維尼亞 1959、馬爾他 1943）用那一年；沒有寫的，獨立以前當成有在執行，獨立以後從獨立那年起算 10 年（附註寫明）。
      - 法律改過不只一次的國家寫在 `PERIODS`：阿根廷（1922 年刑法廢除，軍政府 1970–1973、1976–1984 年恢復）、巴西（1969–1978 年恢復）、甘比亞（1993 年廢除、1995 年恢復）、尼泊爾、菲律賓、巴布亞紐幾內亞、查德、以色列（1954 年廢除普通犯罪，2026 年立法對恐怖攻擊致死恢復，2026 年因為 1962 年以後沒有執行而算事實上廢除）、丹麥（溯及占領時期罪行的法律 1951 年廢止）。
    - **2026 年**：197 個聯合國會員國與觀察員國（含台灣、科索沃）中，全面廢除 112、只廢除普通犯罪 9、事實上廢除 44、保留 32。條目的狀態欄把 22 個 10 年以上沒有執行的國家（加勒比海 11 國、古巴、印尼、以色列與非洲 8 國）仍標「仍在執行」（P），這裡照 10 年的規則算事實上廢除；迦納 2023 年廢除普通犯罪的死刑，條目的狀態欄寫 L，這裡算只廢除普通犯罪。
    - **台灣**：保留，1950–2026 年每年都算保留（2006–2009、2021–2024 年沒有執行，都不到 10 年）；最後一次執行是 2025 年 1 月 16 日，用法務部新聞稿核對（條目 Capital punishment in Taiwan 的逐年執行人數 2025 年 1 人）。條目寫在「Taiwan」，附註寫 2024 年憲法法庭的判決。
    - **國家的變動**：照網站其他歷史主題的慣例畫在今天的國界上，獨立以前用那個地方當時的法律與執行紀錄（蘇聯、南斯拉夫、捷克斯洛伐克各共和國的最後一次執行照條目）；德國 1949–1990 年是西德（1949 年基本法全面廢除，東德的 1981、1987 年寫在附註）；科索沃 2007 年以前、南蘇丹 2010 年以前跟著塞爾維亞、蘇丹。
    - **屬地**：香港（1966 年最後一次執行、1993 年廢除）、澳門（葡萄牙刑法，1976 年廢除）、庫克群島（2007）、紐埃（1966）照各自的條目；丹麥、芬蘭、挪威、法國、澳洲的屬地跟著所屬國家（同一部刑法）。美國、英國、荷蘭的屬地沒有收（各屬地的法律不同、條目沒有逐一寫），地圖上是無資料。
    - **大小**：`death-penalty.json` 72 KB（220 個國家與地區，含中英文附註），不必下載，`npm run data -- laws` 不到 1 秒。

93. **法律與制度：法定年齡**（`pipeline/sources/legal_ages.py`、`pipeline/topics/laws.py`、`src/topics/laws.ts`，2026-10-28）：
    - **5 個指標**（2026 年的現況，只有一年；時間軸寫「這項資料只有單一時間點」）：投票年齡、法定飲酒年齡、最低結婚年齡、汽車駕照的最低年齡、刑事責任年齡。側欄的數值卡片就是這個國家的 5 個年齡（加上死刑）並排，例外與各地的年齡寫在附註。
    - **資料**：英文維基百科的五篇條目，固定 revid（Voting age 1382143687、Legal drinking age 1381514309、Marriageable age 1380695315、List of minimum driving ages 1378431312、Age of criminal responsibility 1374267356），用 `action=raw` 讀維基原始碼；各洲的表格欄位不同（飲酒分 5 個表、歐洲另分私下／公開飲用、店內／外帶購買，結婚 8 個表、只用依國家的 5 個），在 scratch 裡展開 colspan、rowspan 後自動取值，有斜線、括號、多個數字的約 150 筆逐一看過寫成例外，結果整理成 `legal_ages.py` 的表（pipeline 不下載）。
    - **取值的原則**（使用者 2026-10-28 決定，寫在 `legal_ages.py` 檔頭）：
      - 有例外的國家取不需父母同意、法院許可、全國一致的一般年齡；各地不同的取住最多人的那個值（加拿大的飲酒 19、巴基斯坦的結婚 18），指標檔的 `varies` 列出這些國家，tooltip 加一行「各地不同」，附註寫各地的年齡。
      - **結婚**取女性的年齡（使用者決定：男女不同時女性通常比較低，也是童婚討論的對象）；波斯灣各國、茅利塔尼亞、索馬利亞女性不論幾歲都要監護人同意，取男性的年齡並寫明。父母同意、法院許可的年齡從條目自動寫進附註。
      - **飲酒**取購買年齡（店內、外帶取低的），沒有寫購買年齡的才用飲用年齡；酒類不同時取最低的（使用者決定：德國 16，附註寫烈酒 18）。只限穆斯林禁酒的國家（摩洛哥、馬來西亞、巴基斯坦…）取其他人的年齡；全國禁酒的 11 國是「禁止」（深灰），沒有規定的 10 國是「沒有規定」（淺灰）。
      - **汽車駕照**取條目寫的汽車駕照年齡，條目另外寫「有人陪同」「父母同意」「學習駕照」的不算，機車、輕型機車不算。所以德國 18（17 歲有人陪同不算）、法國 17、英國 17；有半歲的（沙烏地 17 歲 6 個月、紐西蘭 16 歲 6 個月）取整數歲，附註寫出。
      - **刑事責任**取條目「reduced」欄（可以負刑事責任的最低年齡）；台灣取刑法的 14 歲，少年事件處理法的 12 歲寫在附註；美國多數州沒有明文的最低年齡，算「沒有規定」。
      - 沒有選舉（阿富汗、阿聯、梵蒂岡、西撒哈拉）、沒有法定年齡的是「沒有規定」那一類（投票寫「沒有選舉」）。
    - **類別圖**：值是歲數（0 沒有規定、1 禁止），每個歲數一類、循序色，年齡越大越深；類別超過 7 個的併成一段（飲酒「16 歲以下」、駕照「15 歲以下」、刑事責任「10–11 歲」「7–9 歲」，用 `CategoryDef.max`，第 4 節），tooltip 照樣寫實際的歲數。
    - **台灣**（2026-10-28 用全國法規資料庫核對）：投票 20 歲（憲法第 130 條；公投 18 歲，2022 年降到 18 歲的修憲複決沒有通過），結婚 18 歲（民法第 980 條，2023-01-01 起），飲酒 18 歲（兒少法第 43 條），汽車駕照 18 歲（道路交通安全規則第 60 條），刑事責任 14 歲（刑法第 18 條）。條目寫在「Taiwan」，數字跟法條一致，只有刑事責任條目寫 12/14。
    - **大小**：5 個檔共 30 KB。

94. **生活格式**（旅行實用主題的擴充，2026-10-28；`pipeline/topics/travel.py` 的 `_formats()`、`pipeline/sources/cldr.py`、`src/topics/travel.ts`、`src/topics/panels/TravelPanel.tsx`）：
    - **資料**：Unicode CLDR 49（`release-49` 的 `common/`，授權見第 12 點）。依地區給值的讀 `supplemental/supplementalData.xml`：`weekData` 的 `firstDay`、`weekendStart`、`weekendEnd`，`timeData` 的 `preferred`，`measurementData`，`calendarPreferenceData`；`territories`（`timeData` 是 `regions`）是空白分隔的地區代碼，沒有列出的地區用 `001` 的值。依語言給值的（日期寫法、小數點）讀 `main/<語言>_<地區>.xml`，照 CLDR 的繼承往上找（`parentLocales` 明定的上一層，例如 `en_IN` → `en_001`、`es_AR` → `es_419`、`zh_Hant` → `root`；沒有就去掉最後一段；最後是 `root`），`↑↑↑` 是「照上一層」。共 8 個類別圖指標：一週的第一天、週末、12／24 小時制、日期寫法、小數點、度量衡、紙張、曆法。
    - **有 `alt` 屬性的不用**：英國的 `firstDay` 有一筆 `alt="variant"` 的星期日（牛津字典的說法），一般的是星期一。
    - **度量衡同一個地區出現在兩筆**（手冊的陷阱 1）：決定的不是 `alt`，是 `category`。沒有 `category` 的是整體的制度，`category="temperature"` 只有溫度：賴比瑞亞整體是美制（`US`）、溫度用攝氏（`metric`），緬甸整體是英制（`UK`，跟英國同一類「英制與公制混用」）、溫度用攝氏；巴哈馬、貝里斯、開曼群島、波多黎各、帛琉整體是公制、溫度用華氏。地圖依整體的制度分 3 類（公制 237、美制 2、英制 2），溫度不同的寫在附註與 tooltip 的短註（`hints`）。
    - **12／24 小時制只用純地區代碼**（陷阱 2）：`timeData` 的 `regions` 混著「語言_地區」（`gu_IN`、`mr_IN`、`fr_CA`、`ku_SY`、`en_IL`…）與 `419`、`en_001`、`ar_001` 這類區域。地圖用純地區代碼的 `preferred`（h 是 12 小時制、H 是 24 小時制，`allowed` 不用）；語言版本跟地區本身不同的寫進附註：加拿大（法語偏好 24 小時制）、敘利亞（北庫德語偏好 24 小時制），其他的（印度的古吉拉特語、馬拉地語…）跟地區一樣，不寫。台灣 `preferred="h"`（`allowed="hB hb h H"`，「下午 3:00」）。
    - **依語言給值的用哪一種語言**：`territoryInfo` 裡官方地位是 `official` 或 `de_facto_official` 的語言中，人口比例最高的那一種（美國的英語是 `de_facto_official`；`official_regional` 不算）；沒有官方語言的地區用人口比例最高的。多語國家只代表一種：瑞士是德語、比利時是荷蘭語、加拿大是英語、印度是印地語、塞內加爾是沃洛夫語（`de_facto_official`、70%，法語 `official`）。tooltip 的短註寫是哪一種語言與例子（「依德文：28.03.26」，語言名稱用 CLDR 的繁中名稱），側欄也寫。
      - **CLDR 收錄得太少的語言改用次高的官方語言**：沒有語言檔（薩摩亞語、帛琉語、托克勞語、吐瓦魯語、比斯拉馬語），或語言檔有、但短日期格式只有 `root` 的預設值 `y-MM-dd`（海地克里奧爾語、瓜拉尼語），不是當地的寫法，依序改用人口比例次高的官方語言（美屬薩摩亞、帛琉、托克勞、吐瓦魯、萬那杜、薩摩亞用英語，海地用法語，巴拉圭用西班牙語），附註寫明。判斷「只有 root 的值」：繼承鏈上 `root` 以外的語言檔都沒有那個元素（連 `↑↑↑` 都沒有）才算；阿拉伯語的數字符號是 `↑↑↑` 照 `root`，算阿拉伯語自己決定的（`cldr._inherited()`）。小數點不另外判斷，跟日期用同一種語言（馬爾地夫的迪維希語沒有寫數字符號，用 root 的「.」，跟實際一樣）。
    - **日期寫法的歸類**（陷阱 3）：西曆（`calendar type="gregorian"`）的短日期格式（`dateFormatLength type="short"`，沒有 `alt` 的），去掉單引號裡的原文（保加利亞語的 `'г'.`）後看 y、M、d 第一次出現的順序：`yMd` 年月日、`dMy` 日月年、`Mdy` 月日年，沒有其他順序（有的話 pipeline 會丟錯）。補不補 0（`dd`、`d`）、兩位或四位年份、分隔符號（`/`、`.`、`-`、`. `）不分類，例子裡看得到。2026-10：年月日 21（台灣、中國大陸、日本、韓國、匈牙利、瑞典、立陶宛、加拿大的英語、南非的英語、伊朗…）、日月年 208、月日年 10（美國與屬地、菲律賓、巴拿馬、波多黎各、馬紹爾群島、厄利垂亞）。波斯語、阿拉伯語的國家也用西曆的格式（伊朗日常用波斯曆，看「曆法」）。
      - 例子是 2026 年 3 月 28 日（日大於 12 看得出日、月的順序，月是個位數看得出有沒有補 0）；預設數字系統不是拉丁數字的（多數阿拉伯語國家 `arab`、波斯語 `arabext`），例子用當地的數字（٢٨/٣/٢٠٢٦）。阿拉伯語格式裡控制方向的 RLM（U+200F）拿掉。
    - **小數點**：那個語言預設數字系統（`numbers/defaultNumberingSystem`）的 `symbols/decimal`，分「.」114、「,」107、阿拉伯小數點「٫」18（埃及、沙烏地、伊拉克、伊朗、阿富汗…；摩洛哥、阿爾及利亞、突尼西亞、利比亞、阿聯是拉丁數字）。例子是 1234567.89 照那個語言的千分位符號與分組（`decimalFormat` 的 `#,##,##0.###` 是印度式的 12,34,567）；千分位可能是不換行空格（法語 U+202F、瑞典語 U+00A0）、瑞士德語是「'」。
    - **曆法**：`calendarPreference` 的 `ordering` 依常用的程度排列。分 8 類（`calendar_group()`）：有民國紀年（只有台灣）；第一個是波斯曆（伊朗、阿富汗）、佛曆（泰國）；只有西曆；其餘依第二個：伊斯蘭曆（36）、農曆（中國大陸、港澳、新加坡、聖誕島與科科斯群島、韓國的檀紀）、日本年號、其他（以色列的希伯來曆、埃及的科普特曆、衣索比亞曆、印度國定曆）。以色列與埃及的清單裡也有伊斯蘭曆，但 CLDR 排在希伯來曆、科普特曆後面，照 CLDR 的順序歸到「其他」；tooltip 列出完整的清單（伊斯蘭曆的 civil、tbla、rgsa 幾種算法只寫一次，沙烏地等 5 國的烏姆庫拉曆另外寫）。
    - **地圖上沒有 ISO 代碼的區域**：索馬利蘭用索馬利亞（`SO`）、澳屬印度洋領地用聖誕島（`CX`）的值；北賽普勒斯 CLDR 沒有，tooltip 寫「CLDR 沒有北賽普勒斯的資料」（指標的 `noValue`）。
    - **台灣**（pipeline 檢查，跟手冊一樣）：一週從星期日開始，週末星期六、日，12 小時制，`zh_Hant`（`zh_Hant_TW` 沒有檔，照 `zh_Hant`）的 `y/M/d`（2026/3/28），小數點「.」，公制，A4，曆法「西曆、民國紀年、農曆」。另外檢查美國、英國、德國、日本、賴比瑞亞的值（`travel.py` 的 `checks`），CLDR 改了會丟錯。
    - **側欄**（`details.json` 的 `fmt`）：在原本的時差、行車方向、插頭、電壓下面加「一週與週末」「時間與日期」「數字」「度量衡與紙張」「曆法」五列，跟台灣比（「日期寫法不同：依法文，2026 年 3 月 28 日寫成 28/03/2026（日月年），台灣寫 2026/3/28」）；台灣自己列出台灣的值。
    - **顏色**：都是一般類別色，跟台灣一樣的那一類排第一（取 `MAP_TOKENS.categorical` 的第一色）；類別沒有強弱，不用 `ordinal`。
    - CLDR 是軟體顯示日期、數字用的慣例，不是各國法定的格式，也不代表每個人都這樣寫；頁尾與指標說明寫明。所有指標檔加起來約 80 KB，`details.json` 從 27 KB 變成 78 KB。

95. **地鐵與高鐵的興建史**（交通主題的擴充：`pipeline/topics/metro.py`、`pipeline/sources/wikidata_metro.py`、`src/topics/transport.ts`、`src/topics/panels/TransportPanel.tsx`，2026-10-29）：
    - **做法**（使用者 2026-10-28 決定）：不另開主題，擴充「交通」。加疊加圖層「地鐵站」（點，依開通年份累積出現，`overlayTime: 'cumulative'`，跟摩天大樓一樣用 `endField` 讓停止營運的站消失）與兩個逐年的指標：地鐵站數（比例圓，1863–2026）、第一條高鐵（通車年份，面量圖，1964–2026）。原本的路網地圖、鐵路長度、密度、機場是不分年份的快照（只有今年），兩種指標並存：快照的指標只有一年，時間軸不出現；地鐵站的圖層只在兩個地鐵指標畫（`indicators`），地鐵指標不畫機場（橘色的點會蓋住地鐵站，第 4 節）。側欄在地鐵指標時改列地鐵與高鐵（`TransportPanel` 依指標分成兩個區塊）。高鐵路線的形狀要用 OSM（ODbL），放第二步。
    - **查詢**：Wikidata 的 SPARQL 查詢服務 2026-10-28 故障後限流（每個 IP 每分鐘 1 次，超過回 429），而且「P31/P279* 地鐵站」跟「路網是地鐵」寫成 UNION 的子查詢會逾時（504），所以先查地鐵站的子類別（29 個）與地鐵路網（358 個），車站的查詢用 VALUES 列出，每種屬性（P31、座標與國家、日期、路網與路線、名稱）兩組各查一次，每次查詢前等到距離上一次 62 秒，共 16 次、約 17 分鐘（`wikidata_metro._query()`）。結果存在 `.cache/wikidata/metro-*.json`。wbgetentities 的 API 同時也在限流（429），1 萬多個車站的中文名稱要查一個多小時，所以中文名稱改在本機用 OpenCC 的 s2tw（只換字、不換用語）轉：依序用 zh-tw、zh-hant、zh-hk、zh、zh-hans、zh-cn。SPARQL 拿到的 zh-tw 常常是複製的簡體（韓國的「千户站」），所以台灣、香港的名稱也轉一次（繁體轉了不會變）。
    - **收錄的車站**（使用者決定只收地鐵，不收輕軌與通勤鐵路）：P31 是地鐵站（Q928830）或它的子類別（倫敦地鐵站、首爾地鐵站、地下的地鐵站、碼頭區輕便鐵路的車站…），或所屬路網（P16）是地鐵（Q5503 或子類別）、P31 是一般車站類別（車站、地下車站、高架車站、轉乘站、終點站…）的。不收：P31 只有電車站、單軌站、旅客捷運（people mover，Wikidata 把它當成地鐵站的子類別，其實是機場、園區的接駁，291 個只有 1 個同時標了地鐵站）、鬼站的（614 個）；使用狀態或 P31 是興建中、規劃中、取消、蓋好還沒啟用、延後的（1,741 個；手冊估計的「1,761 個沒有開通日期」大多是這些）；啟用日期晚於今年的。
    - **開通年份**：啟用日期（P1619）最早的一個，沒有的話成立時間（P571）。**不早於所屬路網的通車年份**（路網的 P1619，沒有的話 P571，再沒有的寫在 `NETWORK_YEARS`：吉隆坡捷運 2016）：跟火車站同一個項目的車站寫的是火車站的年份（台北捷運的南港站寫 1899 年的台鐵南港站、奧斯陸與首爾的郊區鐵路車站），一共 474 個改成路網的年份。代價：紐約 1868 年起的高架鐵路車站也從紐約地鐵的 1904 年算起，倫敦外圍跟國鐵共用的站（伊莉莎白線的申菲爾德）從 1863 年算起（Wikidata 把它們標在倫敦地鐵）。沒有路網的站不早於這個國家最早的地鐵路網（泰國 2 個、馬來西亞 1 個）。雅典地鐵 1 號線（比雷埃夫斯–雅典，1869 年的蒸汽鐵路，1904 年電氣化）照 Wikidata 的路網日期從 1869 年算。
    - **開通日期不明**（34 個）：照使用者的決定畫在最後一年（2026），灰色，圖例與 tooltip 標「開通日期不明」；站數只算在 2026 年，指標檔的附註寫每個國家有幾個。
    - **停止營運**：廢止（P576）或停止營運日期（P3999）最早的一個，那一年起不畫、不算（`endField`）；停用、廢棄、永久關閉卻沒有日期的不算（31 個），停用但沒有開通年份的也不算（48 個）。
    - **重複**：同一個車站常常每條路線各一個項目（東京、首爾的轉乘站），同一個國家、英文或中文名稱相同（去掉括號裡的路線名稱、「站」「Station」）、距離 500 m 以內的算一個站，開通年份取最早的，路網以留下的那一個為主（156 個項目合併）。
    - **國家**：依座標（geoindex 的 1:10m 國界，香港、澳門、台灣各自一國），沒有座標的（7 個）用 P17、只算站數不畫。座標跟 P17 不同的：波多黎各 16 個（P17 寫美國）、比利時 2 個、馬來西亞 2 個（新加坡地鐵跨境到新山的車站），照座標。
    - **結果**（2026-10-29 的資料）：16,869 個站，2026 年營運中 16,583 個，65 個國家有地鐵；中國 6,424、美國 1,009、南韓 867、印度 840、日本 671；台灣 207（台北捷運 1996 年起 118 站、高雄 2008 年 38 站、桃園 2017 年 19 站、新北 2018 年 14 站、台中 2021 年 18 站）。各國最早的：英國 1863、希臘 1869、美國 1886（史泰登島鐵路）、匈牙利 1896、法國 1900、德國 1902、阿根廷 1913、西班牙 1919、日本 1927。首爾都會圈的路網（Seoul Metropolitan Subway）在 Wikidata 是地鐵，含韓國鐵道公社的通勤線車站，所以南韓偏多；Wikidata 的收錄各國不一，站數只是大概。
    - **第一條高鐵**：P31 是高速鐵路線（Q858485）或子類別的 246 條，使用狀態不是興建中、規劃中的，開通年份只用啟用日期（P1619；P571 多半是規劃或動工的年份）。每一國最早的一條逐一看過（`HSR_EXCLUDE`、`HSR_FIXES`、`HSR_COUNTRY`）：不算東海道新幹線的鴨宮模型線（1962 年的試驗線）、特拉維夫–耶路撒冷鐵路（最高 160 km/h）、莫斯科–喀山高鐵（還沒興建）、加州高鐵（興建中）；科隆–亞琛改成 2002 年（1981 年是舊線）、安卡拉–伊斯坦堡改成 2009 年（第一段通車）、雅加達–萬隆補 2023 年、HSL-Zuid 補國家荷蘭。結果 18 國：日本 1964、義大利 1977、法國 1981、德國 1991、西班牙 1992、比利時 1997、挪威 1998、英國 2003、中國 2003（秦瀋客運專線；一般常說的京津城際是 2008 年）、南韓 2004、台灣 2007、荷蘭 2009、土耳其 2009、瑞典 2010、烏茲別克 2011、摩洛哥 2018、沙烏地阿拉伯 2018、印尼 2023。Wikidata 沒有標成高速鐵路線、或沒有啟用日期的不算，所以奧地利、瑞士、丹麥、波蘭、俄羅斯（Sapsan 跑在改良的舊線上）、美國（Acela）沒有值，指標說明有寫。
    - **大小**：`metro.json` 1,162 KB（gzip 後 341 KB，16,862 個點，經緯度到 0.0001°、路網與國家用字串表）、`metro-stations.json` 86 KB、`hsr-first.json` 5 KB，各國側欄併進原本的 `countries/<ISO3>.json`；交通主題全部 2.77 MB。
    - **check:en**：`CHECK_TOPICS=transport` 通過。

96. **水壩與水庫**（併進河流與流域：`pipeline/topics/dams.py`、`pipeline/sources/gdw.py`、`wra_reservoirs.py`、`src/topics/rivers.ts`，2026-10-28）：
    - **資料**（授權見第 12 點）：Global Dam Watch（GDW）database v1.0 的 `GDW_v1_0_shp.zip`（figshare 的直連，69.7 MB），裡面的 `GDW_barriers_v1_0.txt` 是 41,145 座壩的屬性表（逗號分隔），經緯度也在裡面，不必讀 .shp。位置用 `LONG_DAM`、`LAT_DAM`（壩本身，只有 6,113 座有），沒有就用 `LONG_RIV`、`LAT_RIV`（對到 HydroRIVERS 河道上的點）。缺值是 -99。
    - **不收的**：船閘（`DAM_TYPE` 是 Lock 的 1,152 座：航運設施，九成沒有庫容）、已拆除或毀損（`REM_YEAR`，`TIMELINE` 是 Removed、Destroyed、Subsumed）與規劃中的（Planned），剩 39,978 座。製作手冊沒有寫到這一項，是製作時決定的（不收船閘是因為地圖上的點會被當成水壩）。
    - **台灣**：GDW 只有 32 座、6 座有名字，翡翠、德基都對不到。改用水利署「水庫基本資料」（113 年）的 **40 座**公告水庫（製作手冊寫 43 座，2026-10-28 下載的檔逐列數是 40 列），容量用「目前總容量」（萬立方公尺，除以 100 換成 GDW 的百萬立方公尺）。座標用 Wikidata 的壩（或水庫）項目（`RESERVOIRS` 寫 QID，壩優先，GDW 的點也在壩上），直潭壩 Wikidata 沒有座標，用 GDW 的點（GDW_ID 19182，跟 OSM 的直潭壩差 150 m），小池水庫兩邊都沒有，用 OSM way 419003681。GDW 的點在某一座公告水庫 3 km 以內的當成同一座、拿掉（21 座），其餘 11 座（發電用的小壩、攔河堰）照 GDW 留著，台灣共 51 座、總庫容 21.0 億立方公尺。
      - **完工年份**：水利署網站「主要水庫簡介」各水庫的「興建時間」的結束年（22 座，`YEARS` 寫年份與網址）；南化水庫的興建時間 1985–1999 含甲仙攔河堰，用簡介寫的「1993 年 11 月主壩完工蓄水」；新山（1980 年完工、1999 年加高）、蘭潭（1944 年完工，之後加高）用第一次完工的年份。集集攔河堰（2001）、東衛水庫（1981）用 Wikidata 的 P571。其他 16 座（西勢、直潭、大埔、谷關、鹿寮溪、尖山埤、德元埤、鏡面、鹽水埤、虎頭埤、鳳山、澄清湖、興仁、小池、西安、七美）找不到可用的出處，年份不明。
      - 英文名稱用 Wikidata 的英文標籤（Feicui Dam、Techi Reservoir…，錯字「Reservior」改掉），沒有的用漢語拼音；河川名稱只有中文，只在中文介面的 tooltip 寫。
    - **國家**：依點的位置用 `geoindex`（第 85 點），不用 GDW 的 `COUNTRY` 欄。指標是水壩數（`dam-count.json`）與總庫容（`dam-capacity.json`，百萬立方公尺，畫面換成「21.04 億立方公尺」；不知道庫容的 4,746 座不算，tooltip 的短註寫各國有幾座沒算）。中國 8,059 座、印度 7,094、巴西 5,226、美國 4,731；總庫容中國 8,361 億、美國 8,059 億、巴西 6,420 億立方公尺。沒有水壩的國家寫「Global Dam Watch 沒有收這裡的水壩」（指標的 `noValue` 與 `missing`，主題的 `noValue` 是沒有河流的原因）。
    - **地圖**：點圖層 `dams`（`dams.json`，`common.points_file()`），面積大約跟庫容成正比（半徑 ≈ 0.04 × √百萬立方公尺，最小 1 px；歐文瀑布（維多利亞湖）2,048 億立方公尺約 18 px），顏色是完工的年代（1900 年以前、1900–1949、1950–1969、1970–1989、1990–2009、2010 年以後，藍色的循序色，舊的淺、新的深，跟面量圖的橘色分得開；**沒有年份的 62% 照畫、灰色，圖例「年份不明」**，使用者 2026-10-28 決定）。河流主題是 `timeless`，**不加時間軸**（使用者決定），完工的年代只用顏色表示。
      - 縮小時只畫大水庫（`minValue` 依庫容）：世界全圖 10 億立方公尺以上（910 座），2 級 1 億、3 級 1,000 萬、4 級 100 萬，5 級以上全部（含庫容不明的）。不明的數值寫 0 不寫 null（4 萬個點，null 每個多 3 個字元），前端把 0 當成不明；年份 0 落在「年份不明」那一級。檔案依庫容由大到小排，小的畫在大的上面（跟發電廠一樣）。
      - tooltip：名稱（GDW 的英文壩名；台灣是中文名，英文介面用英文名）、完工年份與壩高、庫容、用途（GDW 的 `USE_*` 十種，主要用途 `MAIN_USE` 排第一、加「（主要）」；台灣依水利署的「功能」，工業用水算給水）、河名。
      - 水壩數、水庫總庫容兩個指標預設打開水壩的點；河流地圖上是預設關閉的圖層 `dams-map`（4 萬個點蓋在河上太亂），第一次打開才下載，兩個圖層讀同一個檔。
    - **大小**：`dams.json` 1.42 MB（gzip 0.40 MB），只在水壩的指標或打開圖層時才下載；兩個指標檔共 16 KB。河流主題的資料夾從 6.67 MB 變 8.1 MB，主題的第一個畫面不變。
    - **pipeline 另外一個步驟**（`npm run data -- dams`）：河流的步驟要下載 544 MB 的 HydroRIVERS，水壩不必重跑河流；輸出到 `public/data/topics/rivers/`，`manifest.json` 的來源加上 GDW 與水利署。

97. **咖啡、茶與可可**（飲食主題的擴充，2026-10-28；`pipeline/topics/diet.py` 的 `FOODS`、`UNRELIABLE`、`_drop_unreliable()`，`src/topics/diet.ts`）：
    - **資料**：FAOSTAT 糧食平衡表的 2630 Coffee and products、2635 Tea (including mate)、2633 Cocoa Beans and products，element 645（每人每年供給量，公斤），新舊版代碼相同（授權見第 12 點，跟飲食一樣是 CC BY 4.0）。子項目多一組「咖啡、茶與可可」，其他照飲食（第 21 點）。台灣 2023 年：咖啡 1.9、茶 1.43、可可 0.67 公斤（跟手冊一樣）；這三種的資料檔到小數第二位，tooltip 有第二位才寫（其他食物照舊寫到第一位）。
    - **重量不是杯數**：咖啡是生豆、茶是乾茶葉、可可是可可豆的重量；茶含瑪黛茶（阿根廷、巴拉圭、烏拉圭特別高），指標說明寫明。
    - **咖啡不接舊版，只有 2010–2023 年**（使用者 2026-10-28 決定）：重疊的 2010 年咖啡兩版差很多（手冊查證：差距中位數 46%、174 國；2026-10-28 重算兩版都有的國家，|新版 ÷ 舊版 − 1| 的中位數咖啡 60%、155 國；台灣舊版 0.78、新版 0.25 公斤），茶（8.0%）、可可（11.9%）跟其他食物差不多，照其他食物在 2010 年接（`methodBreak`）。`Food.new_only` 的食物讀資料時略過舊版，資料檔的 `years` 從 2010 年開始、沒有 `methodBreak`，時間軸跟著從 2010 年開始。
    - **數字不可靠的年份拿掉**（使用者 2026-10-28 選「依門檻判斷」）：供給量是生產＋進口－出口－庫存變化算出來的，轉口地與產地會算出不可能的量。每一年分開判斷，每人每年超過門檻的值拿掉（地圖畫無資料的灰色、排名表不列），資料檔的 `noValue`、`noValueEn` 寫「數字不可靠（年份）」，取代 tooltip 與側欄的「無資料」（第 4 節的共用改動），附註寫原因與最高的數字。世界合計不動。
      - 門檻（`UNRELIABLE`）：咖啡 16.5、茶 10、可可 6.5 公斤。依據是實際喝得最多的國家：咖啡芬蘭約 12 公斤（FAOSTAT 2019 年 16.1 也照畫）、茶土耳其約 3–4 公斤、瑪黛茶烏拉圭約 9 公斤（FAOSTAT 8.8–9.5，照畫）、可可的巧克力大國 4–5 公斤。
      - 拿掉的（2026-10）：咖啡 13 國：香港 2023、澳門 2019 與 2023、寮國、馬爾地夫、馬紹爾群島 2020–2023、盧森堡 2010–2023（新舊版都 28 公斤，鄰國來買）、愛沙尼亞 2019–2022、立陶宛 2021、貝里斯、斐濟、馬爾他、蒙特內哥羅 2010、薩摩亞。茶 10 國：斯里蘭卡 2010–2023（2010 年新版 69.1、舊版 1.4）、肯亞、盧安達、土耳其 2020–2023，馬拉威 2020–2022，中國大陸、越南 2022–2023，阿根廷 2019–2023，巴拉圭 1982 年起幾乎每年，喬治亞 1994。可可 6 國：象牙海岸 2010 年起多數年份，愛沙尼亞 2004–2008、2011，盧森堡 2011，百慕達、多米尼克、薩摩亞的個別年份。
      - **FAOSTAT 2020 年起產茶國的茶大增**：土耳其 2019 年 2.8 → 2020 年 20 公斤，肯亞、盧安達、馬拉威、越南同一年變成好幾倍，像是換了算法（茶葉的鮮葉與成茶重量），不是真的多喝；中國大陸是從 2010 年的 4.7 公斤逐年升到 2023 年的 10.8 公斤。超過門檻的年份都拿掉，沒超過的（馬拉威 2023 年 9.0、中國大陸 2018–2021 年 8.0–9.6 公斤）照畫，附註沒有寫。
      - 門檻附近的年份會一年有、一年沒有（象牙海岸的可可 2015、2017、2019 年在 6.5 公斤以下，照畫），照規則不另外處理。
    - **新的共用欄位**：指標檔的 `noValue`、`noValueEn`（`types.ts` 的 `IndicatorData`），`missingReason()` 多兩個參數（資料檔與語言），排在指標、主題的 `noValue` 與 `selfLabel` 後面；App 的 tooltip 與 `CountryPanel` 的數值卡片傳入那個指標的資料檔。
    - 大小：咖啡 19 KB、茶 46 KB、可可 43 KB。

98. **1800 年起的長期資料**（`pipeline/topics/long_run.py`、`pipeline/sources/gapminder.py`、`src/topics/longRun.ts`，人口、人均收入、健康三個主題各加一個指標，2026-10-28）：
    - **資料**：Gapminder fasttrack 固定在 2026-10-15 的 commit dee8978（raw.githubusercontent.com，不必登入）：`pop`（v8，197 國）、`gdp_pcap`（v32，195 國，「GDP per capita, PPP (constant 2021 international $)」）、`lex`（v15，196 國），世界合計用同一個 repo 的 `--by--global--` 檔。國家代碼是小寫 ISO3，只有教廷 `hos` 不是（改成 VAT）。授權見第 12 點。
    - **另立指標，不接在原本的前面**（使用者 2026-10-28 決定）：`total-1800`、`gdp-per-capita-1800`、`life-expectancy-1800`，WPP（1950 起）與 IMF（1980 起）的指標不動。接縫的數字有落差（Gapminder 的平均壽命 1950 年起主要是 IHME GBD，跟 WPP 不同），人均 GDP 的單位也不同（IMF 是當年美元與當年國際元，這裡是 2021 年的國際元），說明都寫了。
    - **只取到最近的實際年份**：Gapminder 的三個指標都延伸到 2100 年。依 Gapminder 的說明，人口用 WPP 2024（2023 年以前是估計，2024 年起是推估），人均 GDP 1990–2024 年跟世界銀行相同、2025–2029 年是 IMF WEO 的成長率、之後是模型；平均壽命到 2023 年（台灣也只到 2023 年），之後是 UN 的推估。所以人口與平均壽命 1800–2023、人均 GDP 1800–2024。手冊原本寫平均壽命只到 2023 年，實際的檔多數國家到 2100 年，一樣截掉。
    - **1950 年以前是估計**：人口 1800–1950 年用 CLIO Infra（沒有的用 Gapminder 自己的 v3），人均 GDP 1820–1990 年主要用 Maddison Project，平均壽命 1800–1970 年是 Gapminder 自己的估計（戰爭、饑荒、疫情是粗估的驟降）。指標檔寫 `estimatesBefore: 1950`（第 3 節），時間軸在 1950 年以前標「估計值」，側欄折線圖在 1950 年畫垂直虛線、圖下說明。
    - **國界是今天的國家**：1800 年的德國、印度是今天的範圍回推，三個指標的說明都寫了。
    - **核對**（台灣）：1800 年人口 200 萬、人均 GDP 1,290（2021 年國際元）、平均壽命 28.3 歲；1950 年人口 760 萬、平均壽命 57.3 歲；2023 年人口 2,332 萬、平均壽命 80.5 歲；人均 GDP 2024 年 79,565。跟手冊查證時的數字相同。
    - **大小**：三個檔 105–161 KB（共 409 KB，gzip 後約 128 KB），只有選到那個指標才下載。
    - **世界合計與上色**：世界合計用 Gapminder 的 global 檔，人口的「占全球比例」也用它；人口用比例圓（跟原本的總人口一樣），人均 GDP 與平均壽命用面量圖，門檻依 1800 年到現在的範圍（人均 GDP 1,000–50,000、平均壽命 30–80 歲）。

99. **月食在哪裡看得到**（併進日食路徑，主題改名「日食與月食」：`pipeline/topics/lunar.py`、`pipeline/sources/nasa_eclipses.py` 的 `lunar_catalog()`、`src/topics/eclipses.ts`、`src/topics/panels/EclipsesPanel.tsx`，2026-10-28）：
    - **改名**：「日食路徑」→「日食與月食」（英文 Solar and lunar eclipses），主題 id 與網址不變（使用者決定）；短名稱「日食與月食」，英文照舊 Eclipses。
    - **資料**（授權見第 12 點）：NASA 五千年月食目錄（Espenak & Meeus, NASA TP-2009-214172、214173）的 `LEcat5/LE1801-1900`、`LE1901-2000`、`LE2001-2100` 三頁，每次月食一列：食甚的 TD、ΔT、沙羅週期、類型、gamma、半影與本影食分、半影／偏食／全食的持續時間（分鐘）、食甚時月亮在天頂的緯度與經度（**整數度**）。1901–2000 年 229 次（全食 81、偏食 65、半影 83）、2001–2100 年 228 次（85、57、86），跟製作手冊一致；1900 年只有兩次半影月食。
    - **半影月食完全不收**（使用者 2026-10-28 決定，沒有選手冊建議的「只列在側欄」）：地圖、側欄、指標都只有月全食（166 次）與月偏食（122 次），主題說明、指標說明與側欄的附註都寫明。
    - **看得到的範圍**：月食時看得到的地方同時看到同一個階段，所以只看月亮在不在地平線上：某地在時刻 t 看得到 ⇔ sin φ sin δ + cos φ cos δ cos(λ − λ_c(t)) > 0（跟天頂點的角距小於 90°）。
      - 天頂點：緯度（月亮的赤緯 δ）一次月食之內當成不變；經度從食甚的位置每小時往西移 14.49°（地球自轉 15.041°/h 減掉月亮平均的赤經運動 0.549°/h）。目錄沒有各接觸的時刻，從食甚往前後各推持續時間的一半（初虧、復圓用偏食的持續時間，食既、生光用全食的）。
      - 每條經線上看得到的部分是連到極點的一段緯度：δ > 0 時 φ > atan(−cos(λ − λ_c) / tan δ)，δ < 0 時相反（目錄的緯度是 0 的當成北緯 0.05°）。「整個全食都看得到」＝食既與生光兩個時刻的交集（每條經線取較嚴的界線）；「看得到一部分」＝初虧到復圓之間每分鐘一個半球的聯集（取最寬的），比半球大（最長的偏食 3 小時半，多出約 50° 經度）。月偏食只畫「看得到」那一圈。每 0.25° 經度一點，Douglas–Peucker 簡化到 10 km，量化 0.02°。
      - 誤差：不修正大氣折射（月亮在地平線時抬高約 0.57°）與月亮的視差（壓低約 0.95°），兩者大致抵銷（淨約 −0.4°）；目錄的天頂點只到整數度、赤緯在月食期間其實會變（每小時最多約 0.3°），界線的誤差約 1°（100 公里），說明有寫。
    - **地圖**（線圖層 `lunar`，`lunar.json` 552 KB、gzip 106 KB）：每次月食的範圍是封閉的環（沿 ±180° 經線與極點封閉，r = 0，畫成半透明的面、不畫外框），界線本身另外一條線（r = 1，畫線、給 tooltip 與滑過的標示；環的外框會在 180° 經線上多畫一條直線，所以用 `fill.outline: false`）。月全食整個全食都看得到鏽紅（深色底圖洋紅）、看得到一部分琥珀，月偏食淡紫，都是日食已經驗過的 `MAP_TOKENS.categorical` 顏色；一年常有兩、三次月食，範圍互相重疊，滑到界線上標出那一次。
    - **國家**（以首都計算，跟晝夜與季節一樣讀 `public/data/topics/daylight/capitals.json`，要先跑 daylight）：每次月食在首都看到的分 4 級（整個全食〔月偏食是整個偏食〕都看得到、看得到一部分的全食、只看得到偏食的階段、看不到）。指標只算月全食：
      - 那一年的月全食（預設 2028 年：今天以後的第一次月全食是 2028-12-31）：國家**不上色**（`kind: 'none'`），地圖上的範圍已經畫出哪裡看得到，國家再依首都上色會蓋住範圍；值（2 整個看得到、1 一部分、0 看不到）寫在 tooltip 與排名表。原本做成類別圖，截圖看過範圍幾乎看不見才改。
      - 月全食次數（1900 年到那一年，至少看得到一部分的全食）：到 2100 年各國 80–100 次（台灣 99、美國 95、阿根廷 83）。
      - 下一次月全食（從那一年起還要幾年，0 是那一年就有）：側欄不畫逐年的折線（1–3 年就一次，只是一排鋸齒）。
      - 核對：2026-03-03（食甚 11:33 UTC）台灣整個全食都看得到（晚上 7 點多）、美國華盛頓看得到一部分（全食時月亮正在西沉）、英國看不到；2025-03-14 台灣看不到（白天）、2025-09-07 與 2022-11-08 台灣整個看得到。
    - **側欄**（月食的三個指標）：首都看得到的每一次月食（月全食、月偏食），寫類型、整個看得到或一部分、食甚的當地日期與時間（`Intl.DateTimeFormat` 用首都的 IANA 時區，瀏覽器的時區資料，所以有夏令時間）、全食或偏食多久；下一次月全食與距今幾年。點一下時間軸換到那一年、標出那一次的範圍（不移動地圖：範圍是大半個地球）。資料在 `lunar-panel.json`（338 KB，只在月食的指標打開側欄時下載）。
    - **pipeline 另外一個步驟**（`npm run data -- lunar`）：日食的步驟要抓約 600 頁貝塞爾根數、算 10 分鐘，月食不必重跑日食；`manifest.json` 加上 `lunarSource` 與月食的檔案。

100. **血型分布**（`pipeline/topics/blood_types.py`、`pipeline/sources/wiki_blood_types.py`、`src/topics/blood-types.ts`、`src/topics/panels/BloodTypesPanel.tsx`，2026-10-28）：
    - **資料**：英文維基百科「Blood type distribution by country」第一個表，版本寫死（revid 1378379911，2026-10-04），用 `action=raw` 讀 wikitext。126 國，欄位是人口（不用）、O+、A+、B+、AB+、O−、A−、B−、AB−。第二個表（各民族的 ABO，出處 bloodbook.com）不用。表裡的國名用 pycountry 對 ISO 代碼，DRC、Bosnia、Ivory Coast、Macao 寫在 `NAMES`。
    - **出處**：只有 73 國那一列附了出處（`<ref>`，有名字的 `<ref name=… />` 依全文的定義還原）；製作手冊寫 75 國，逐列重數是 73 國（列尾、數值格裡沒有另外的 ref）。側欄寫第一個出處的標題與連結（cite 模板的 title、url，沒有 url 的用 doi、pmc、pmid 組網址），維基百科標了 {{Failed verification}} 的（阿根廷、蒙古）另外寫「未能核實」。沒有出處的 53 國（包括台灣）照常畫，tooltip 的短註（`hints`）與側欄標「維基百科沒有註明出處」（使用者 2026-10-28 決定）。
    - **指標**：最多的血型（類別圖，預設，使用者 2026-10-28 決定）、O、A、B、AB 型的比例（各型的 Rh 陽性加陰性）、Rh 陰性的比例（四型的陰性合計）。最多的血型：O 型 87 國、A 型 37 國（歐洲大部分、土耳其、日本、韓國、北韓等）、B 型 2 國（巴基斯坦、孟加拉；印度 O 34.6% 比 B 34.1% 略多）；AB 型沒有一國是最多的，類別只列三類（AB 型放在「其他」）。兩型一樣多的話 pipeline 會報錯，要另外決定。
    - **不是數字的格子**：埃及只有 ABO（Rh 那四格是 n/a，O+、A+、B+、AB+ 那四格加起來 99.99%，其實是 ABO 的合計），四型照畫、Rh 陰性沒有值、側欄不畫 8 種的長條；阿曼的 AB− 是 n/a、紐西蘭的 AB− 寫「<1.0%」，當成沒有值，那一型與 Rh 陰性只加有數字的血型，附註寫明。
    - **加起來不是 100%**：四捨五入或原始資料不完整，玻利維亞 91%、利比亞 92%、沙烏地阿拉伯 93%、英國 96%，澳洲、尼泊爾、巴布亞紐幾內亞 102%；不重新分配（照表上的數字），側欄寫出合計。
    - **台灣**：O 44.18%（O+ 43.9、O− 0.28）、A 25.91%、B 23.91%、AB 6.01%，Rh 陰性 0.31%。表上沒有出處；台灣血液基金會的網站禁止轉載（第 12 點），所以只用維基百科這一列，pipeline 檢查這一列沒有變。
    - **說明**：各國的數字來源不同（捐血人、醫院、研究樣本，1970 年代到 2020 年代），國與國之間只能大略比較，主題說明有寫。不分年份（`timeless`，指標檔的年份是 2026）。
    - **大小**：6 個指標檔各約 16 KB（附註與短註每個檔都有一份）、`types.json` 18 KB，共約 115 KB。

101. **北磁極的漂移與磁偏角**（`pipeline/topics/magnetic.py`、`pipeline/sources/wmm.py`、`src/topics/magnetic.ts`、`src/lib/wmm.ts`，2026-10-28）：
    - **磁極的位置**：NOAA NCEI 的 `NP.xy`、`SP.xy`（https://www.ngdc.noaa.gov/geomag/data/poles/ ，各 436 筆：經度 0–360°E、緯度、年份，1590–2025 年每年一筆），經度換成 −180–180。NCEI 的頁面（Wandering of the Geomagnetic Poles）把它列為「IGRF Pole Locations (1590–2025)」：是模型算出的磁傾角 90° 的點（1890 年以前 gufm1、之後 IGRF），不是觀測；檔案的修改日期是 2020-04-23，所以 2020 年以後是當時模型的預測。主題說明寫明，也寫磁極（dip pole）跟地磁北極（偶極軸）不同。
      - 北磁極：1590 年 73.9°N、111.8°W（加拿大北極群島），1831 年模型是 70.4°N、98.1°W（Ross 實測 70.1°N、96.8°W），2017–2018 年越過 180° 經線，2025 年 85.8°N、138.1°E。移動速度：1590–1690 年平均每年 1 km、1900–1990 年約 10 km、2000–2010 年 54 km、2020–2025 年 40 km。南磁極 2025 年 63.9°S、135.1°E（南極洲外海），一直每年 4–10 km。
      - NCEI 用 WMM2025 算的 2025 年北磁極是 85.762°N、139.298°E，跟 `NP.xy` 的 2025 年（85.778°N、138.057°E）差約 10 km；等偏角線是 WMM2025 畫的，所以會收斂到 WMM 的那一點，地圖上看不出差別。
    - **WMM2025**（`pipeline/sources/wmm.py`）：係數用壓縮檔的直連（官網的連結會先轉到問卷頁）。算法照技術報告第 1.2 節，Legendre 函數的導數用不會在極點除以零的遞迴；壓縮檔裡官方的 100 筆測試值（不同年份、高度）全部對上（D、I 0.01° 以內、X、Y、Z 0.1 nT 以內），每次產生資料時都比對一次，不符就報錯。前端 `src/lib/wmm.ts` 是同一套算法，用同樣的測試值比過（esbuild 轉成 JS 後用 node 跑，最大差 0.005°，就是測試值本身四捨五入到 0.01°）。年份一律用 2025.0（WMM2025 的基準時刻）、海平面，跟磁極軌跡的最後一年一致；WMM 只適用 2025–2030 年，不能回推歷史。
    - **等偏角線**（`isogonic.json`）：0.5° 網格（緯度 ±89.5°、經度 −180–180 含兩端，359 × 721 點）算磁偏角，contourpy（`requirements.txt` 加上）畫等值線：±30° 以內每 5°、到 ±60° 每 10°，再加 ±90°、±120°。不畫的地方：水平分量 H < 2,000 nT 的格子（WMM 的 blackout zone）、|D| > 135° 的格子（磁偏角在 ±180° 跳躍，跨過跳躍的格子會在每一個等值都畫出假的線）。shapely 簡化到 0.05°、短於 2° 的碎片不畫，62 條、2,117 個頂點。顏色：西偏青綠、東偏橘（跟首都的磁偏角同一組發散色），20° 以上深一階，0°（指南針指向真北）深灰；`lineLabel` 沿線寫「西 10°」「東 5°」。
    - **指南針不可靠的範圍**（`blackout.json`）：H < 2,000 nT 的填色等值線（contourpy 碰到網格邊緣會沿邊緣封起來），畫成灰色半透明的面（線圖層的 `fill`，`holeField` 處理洞），3 個環（北磁極一帶跨 180° 經線分成兩塊、南磁極一塊）。
    - **指標**：磁極的軌跡（預設，不上色；北、南磁極的點依年份上色，`overlayTime: 'cumulative'` 拖時間軸看軌跡長出來）、首都的磁偏角（2025 年，面量圖，發散色，門檻 ±2、±10、±20°；只有一年，時間軸不顯示）、首都離北磁極（1590–2025 年每年首都到北磁極的大圓距離，面量圖；也是「磁極的軌跡」tooltip 與排名表的值，側欄的折線圖畫它）。兩個面量圖都 `unranked`（偏東偏西、離磁極遠近沒有好壞）。
      - 「首都離北磁極」是製作手冊沒有列的指標：「磁極的軌跡」不上色時國家也要有一個隨年份變的值給 tooltip 與側欄，距離最直接。歐洲、亞洲的首都這 30 年越來越近，北美洲的越來越遠：台北 1590 年 8,351 km、2025 年 6,774 km；渥太華 1900 年 3,000 km、2025 年約 5,350 km。
      - 首都用晝夜與季節主題的 `capitals.json`（國家小檔案的 Wikidata 首都），240 個；水平分量小於 6,000 nT（WMM 的 caution zone）的首都附註寫明，2026-10 沒有。台北 −5.0°（偏西 5°），渥太華 −12.7°。
    - **滑到地圖上任一點**（主題的 `pointer`）：在瀏覽器用 `wmm.json`（2 KB，第一次滑過才下載）算那裡 2025 年的磁偏角，H < 2,000 nT 寫「磁極附近，指南針不可靠」、< 6,000 nT 寫「接近磁極，指南針容易受干擾」；海上的第一行是經緯度。
    - **沒有做的**：歷史的磁偏角（IGRF-14，1900–2025 每 5 年；係數本身的授權沒寫，製作手冊列為待確認，使用者 2026-10-28 決定第一版不做）；觀測到的磁極位置（NCEI 互動地圖上的黃色方塊，沒有開放的資料檔）；地磁北極（偶極軸）。
    - **大小**：`distance.json` 295 KB（gzip 後 55 KB，240 國 × 436 年）、`declination.json` 19 KB、`isogonic.json` 18 KB、`north.json`、`south.json` 各 7 KB、`wmm.json` 2 KB、`blackout.json` 1 KB，共約 350 KB（gzip 後約 74 KB）。


102. **此刻的極光**（`pipeline/topics/aurora.py`、`src/lib/live.ts`、`src/map/liveGridLayer.ts`、`src/topics/aurora.ts`、`src/topics/panels/AuroraPanel.tsx`，2026-10-29）：
    - **即時資料，在瀏覽器裡讀**：其他主題都是部署時產生的靜態檔，這個主題的預報約每 5 分鐘更新，所以加了通用的 `TopicDefinition.live`（第 4 節）：瀏覽器直接讀 NOAA SWPC 的 `ovation_aurora_latest.json`（約 920 KB，回應允許跨網域讀取，CloudFront 的 `max-age=60`），每 5 分鐘重讀，分頁在背景時不讀。讀不到時有上一份就照舊畫，沒有就顯示載入失敗。這是網站唯一一個執行時依賴外部服務的主題。
    - **格點**：OVATION 是經度 0–359°E、緯度 −90–90° 每 1° 一點（65,160 點），值是那一點上空看得到極光的機率（%）。2026-10-29 03:09 UTC 的觀測：最高 18%，非零的 18,915 點。
    - **地圖**：即時網格（`LiveGridOverlayDef`，WebGL 自訂圖層，跟晝夜同一種做法，兩極與 180° 經線沒有接縫），一個顏色（淺色底圖 `#0f8a4a`、深色 `#4ee28a`），依機率調不透明度：3% 以下不畫、8% 0.45、20% 0.75、50% 以上 0.95（平常最高約 15–20%，低的一段就要看得清楚）。只在「極光預報地圖」畫：疊在面量圖上時綠色跟面量圖的顏色混在一起看不清楚。疊上此刻的晝夜（`kind: 'night'`，時刻是預報的時刻）：極光只在夜裡看得到。
    - **國家的值**：pipeline 算各國的國土碰到哪些格點（格點周圍 1° × 1° 的格子裡取 5 × 5 點，有一點在 Natural Earth 1:10m 的國界內就算，`geoindex` 的 `nearest=False`；只算南、北緯 35° 以外：OVATION 在 35° 以內幾乎都是 0，2024 年 5 月的大磁暴也只到約 40°），`cells.json` 41 KB（gzip 5 KB），86 個國家與地區有格點；首都用晝夜與季節的 `capitals.json` 最近的格點。瀏覽器裡用 `derive`（第三個參數是即時資料）算國土上空最高、首都上空的機率；沒有格點的國家（台灣）值是 0，tooltip 與側欄寫「國土都在南、北緯 35° 以內，看不到極光」。
    - **側欄**：預報與觀測的時刻、國土上空最高的機率與位置（「移到機率最高的地方」）、首都上空的機率、NOAA 的行星 K 指數（`noaa-planetary-k-index.json`，一樣在瀏覽器裡讀：最近一筆與過去 24 小時最高；0–3 平靜、4 活躍、5 以上依 NOAA 的 G1–G5）。
    - **游標**：滑到任一點（海上也可以）看那裡上空的機率（`pointer`）。tooltip 與 `pointer` 拿不到即時資料，用 `aurora.ts` 記住的最近一次預報（App 每讀到一份新的都會經過 `derive`）。
    - **國家側欄的數值卡片**：一開始兩張卡片都是「無資料」：`CountryPanel` 自己算每個指標（`derivedData`）時沒有即時資料。現在 App 把即時資料傳給側欄（`live`）。
    - **限制**：只有「現在」（NOAA 不提供歷史，不能選別的時刻，沒有時間軸）；機率不考慮雲、光害與月光，也沒有畫「地平線上看得到」的界線（SWPC 的 view line 沒有 JSON）；平面地圖只到南北緯 85°；地球儀一開始對著台灣，極光在畫面的上緣，要轉到北極才看得清楚。
    - **大小**：`cells.json` 41 KB；預報（約 920 KB）每次由瀏覽器向 NOAA 讀。
103. **大航海時代的航海日誌**（`pipeline/topics/logbooks.py`、`src/topics/logbooks.ts`、`src/topics/panels/LogbooksPanel.tsx`，2026-10-29）：
    - **資料**：CLIWOC 2.1 的 IMMA 原始檔（CLIWOC21.zip，解開 2.46 GB、287,114 筆、一筆 8,569 字元），串流讀需要的欄位（年月日時、緯經度、國籍代碼、日誌編號、船名、公司、船長、出發地、目的地；位置寫在 pipeline 的說明裡），約 7 秒。沒有船位的 26,477 筆不用。國籍：荷蘭 12.6 萬筆、英國 9.5 萬、西班牙 5.4 萬、法國 1.1 萬，瑞典、美國、漢堡、丹麥共約 1,100 筆。
    - **航程**：同一本日誌、同一艘船（有些日誌編號是好幾艘船的摘要）依日期排好，出發地或目的地改變就是另一個航程。比較時去掉重音與標點（同一本日誌裡 CÁDIZ 與 CADIZ 交替出現），連續不到 3 筆的另一種寫法併進前一個航程（荷蘭的摘要 EXTRACT 有兩種目的地交替出現）；不這樣做時有 1,000 多個只有一點的「航程」。結果 5,093 個航程、畫出 5,035 個。
    - **清理**：離前後兩點都超過一天 550 公里能走的距離、前後兩點彼此卻在範圍內的單獨一點拿掉（140 點，多半是東西經寫反或抄錯）；相鄰兩點相隔超過 10 天（962 處）或距離不合理（332 處）時斷開；兩點之間的直線深入陸地超過 30 公里也斷開（221 處：好幾天沒有船位時，從大西洋直接連到印度洋會穿過非洲；船位本身離海都不到 25 公里）。陸地與海用河流主題快取的 IHO 海域網格（0.025°，`sources/sea_areas.py`）。只剩一點的段不畫（467 段）。
    - **地圖**：一個航程、一年一條線（跨年在 1 月 1 日切開，新的一年從前一年最後一點接起來），經度展開成連續的；Douglas–Peucker 0.05°、量化 0.05°。`tracks.json` 6,758 條線 1.77 MB（gzip 約 0.6 MB）。線依國籍分 5 類（英、荷、西、法、其他），時間軸篩選年份（`timeField: 'y'`），同一個航程的各段一起標出（`groupField: 'v'`），墊細邊（`casing`）。
    - **顏色**：英國洋紅 `#e7298a`、荷蘭橘 `#d95923`、西班牙琥珀 `#eda100`、法國紫 `#7b3294`，其他灰色；dataviz 的驗證程式在淺色底圖的海（`#aad3df`）上四色兩兩的色盲與一般視覺區分都通過，對海的對比不到 3:1 所以墊細邊。深色底圖另一組（`#f0479b`、`#e35a2b`、`#c4a200`、`#9b6be0`），琥珀的亮度 0.72 比建議的上限高一點，再暗就跟橘色在紅綠色盲下分不開。綠色、青色試過：跟橘色在紅綠色盲下分不開，或跟藍色的海混在一起。
    - **國家**：指標是那一年有航海日誌的船數（不上色，`kind: 'none'`），國籍對到今天的國家（漢堡算德國），8 國以外寫「不是這些船的國籍」（`coverage`），這 8 國那一年沒有船寫「這一年沒有這國的船的航海日誌」（`missing`）。年份只列有船位的 114 年（1662、1663、1677、1699、1745 起），時間軸跳過沒有資料的年份；側欄的歷年圖在 1677–1745 之間是直線，沒有特別處理。
    - **側欄**：`panel.json`（542 KB，gzip 約 140 KB）有航程的資料表、每國每年經過附近的航程（航線每 10 公里內插一點，在國界內或離國界 100 公里以內，用颱風主題的 `NearIndex`，Natural Earth 1:50m）與每國自己的船。列表滑過或點一下標出航程（`highlightLine`），上一次、下一次有船經過的年份點了換時間軸（`selectYear`）。
    - **台灣**：26 個航程經過台灣附近（1761–1852 年、17 個年份；荷蘭 16、英國 7、法國 2、西班牙 1），多半往返巴達維亞與廣州、澳門、長崎、上海；1787 年 4–5 月法國拉彼魯茲探險隊的 La Boussole 從馬尼拉灣北上，在台灣西南外海來回約兩週，5 月初繞到台灣東邊往北（對過船位）。寫在台灣的附註（由資料算，`taiwan_notes()`）。
    - **共用程式的小改動**：日食側欄的「顯示全部」用的 `.eclipse-more` 原本是 `--accent-ink`（藍底上的白字），在淺色側欄上看不見，改成 `--accent`；這個主題的上一次、下一次也用它。
    - **限制**：航線是正午船位之間的直線，不是實際航跡；早年的經度是推算的，誤差可能有幾十到上百公里；只收被抄錄的日誌（英、荷、西、法檔案館），不是當時航行的船的全部；日期是 CLIWOC 換算的世界標準時間；地名、船名是日誌原文（荷、英、西、法文），沒有翻譯；風、天氣等觀測沒有用。主題放在「科技與交通」的「航運與港口」後面（規劃手冊建議跟今天的航運對照）；之後如果加「歷史」分類可以移過去。

104. **氣候分區（柯本）**（`pipeline/topics/koppen.py`、`src/map/classGridLayer.ts`、`src/topics/koppen.ts`、`src/topics/panels/KoppenPanel.tsx`，2026-10-29）：
    - **資料**：Beck 等人 2023 的柯本－蓋格分類圖（figshare 第 2 版，2026-01）的 0.1° GeoTIFF（3600 × 1800、uint8，0 是海、1–30 是類型），1901–1930、1931–1960、1961–1990、1991–2020 四個歷史時期，2041–2070、2071–2099 兩個時期取 SSP2-4.5 與 SSP5-8.5（使用者決定；檔案裡另有 SSP1-1.9、1-2.6、3-7.0、4-3.4、4-6.0）。pipeline 檢查 legend.txt 的代碼與符號跟 `CLASSES` 一致、每張的範圍是 0.1° 全球網格。
    - **地圖**：8 個時期各一張 8 位元灰階 PNG（共 1.25 MB，每張約 155–165 KB；換時期才下載那一張），用新的通用圖層 `kind: 'classGrid'`（第 4 節）畫：WebGL 片段著色器讀原始解析度的代碼貼圖，放大時格子是方塊、兩極與 180° 經線沒有接縫，地球儀、平面、深色底圖都一樣。試過的其他做法：部署時產生圖磚（第 14 節）要多一套 GitHub Actions 的步驟與快取，0.1° 的資料本身才 160 KB 不值得；MapLibre 的 image／canvas source 要先投影成 Web Mercator（3600 × 3600 的畫布，手機上吃記憶體），也沒有兩極。
    - **顏色**：照 Beck 等人的配色（柯本分類圖慣用：藍是熱帶、紅橘黃是乾燥、綠是溫帶、紫與青是冷溫帶、灰是極地），不是網站的類別色：30 類分不完，照慣例比較好跟其他柯本分類圖對照。有幾組顏色相近（Cfb 與 Cwa、Dfb 與 Aw），色盲也分不開，所以滑到任一點都寫類型的全名（`pointer`），圖例滑過看全名。「主要氣候帶」只有 5 類，用網站的類別色（依序取用），側欄的氣候帶堆疊長條也用同一組。
    - **國家**：220 萬個陸地格子的中心點歸到國家（`geoindex.countries_at`，1:10m，不在國界內的找 0.3° 內最近的），面積依 cos(緯度) 加權，238 個國家與地區有格子（摩納哥、梵蒂岡、荷屬聖馬丁沒有）；只有 4,104 個陸地格子歸不到國家（南極洲以外的無人小島）。指標：面積最大的類型（不上色，給 tooltip）、面積最大的氣候帶（類別圖）、跟 1991–2020 年不同的面積比例（面量圖，1991 年那一期是 0）。各情境一個檔，歷史時期兩個檔一樣。時間軸的年份是時期的第一年（`timeAxis` 寫「時期起始年」，tooltip、側欄寫 1991–2020），2041 起標「推估」（`projectionLabel`；之前的時期是觀測，不標「估計值」）。
    - **台灣**：1991–2020 年 Cfa（溫帶全年有雨，夏季炎熱）32%、Cwa（冬季乾燥，夏季炎熱）30%、Cfb（夏季溫暖，山區）15%、Am（熱帶季風）9%、Aw 6%、Cwb 5%；2071–2099 年 SSP5-8.5 變成 Am 25%、Aw 19%、Cfa 18%、Af 15%，熱帶（A）從約 18% 變成過半。
    - **限制**：0.1° 約 10 公里，山區（台灣的中央山脈、喜馬拉雅）的高山氣候被平均掉一部分（原始有 1 公里的版本）；1901–1930 年觀測少；未來是 CMIP6 模式（評估 67 個，留下二氧化碳造成的暖化速率最合理的 42 個）降尺度後的推估，不是預報；太小的島國只有一兩格。

105. **冰河、海冰與海平面**（`pipeline/topics/ice.py`、`src/topics/ice.ts`、`src/topics/panels/IcePanel.tsx`，2026-10-29）：
    - **冰河**：WGMS AMCE 的每條冰河（RGI 6.0 的 216,330 條，20 個區域）每個水文年的質量變化（m 水當量）。各區域開始的年份不同（中歐 1915 年、阿拉斯加 1946 年、多數 1976 年），只用全球都有的 1976 年起；每條冰河的中心點歸到國家（`geoindex`，1:10m，0.3° 內最近），51 個國家與地區有冰河（147 條歸不到國家，多半是南冰洋的小島）。國家的值：面積加權的平均累計變化（變薄為正，例如瑞士 34.7、美國 35.0、挪威 15.7 公尺水當量）與累計少了多少質量（Gt：m 水當量 × 面積，加拿大 3,196、美國 2,228、格陵蘭周邊 1,422）。南非、伊朗等少數國家是變厚（冰河少，誤差大）。
    - **海冰**：NSIDC 海冰指數第 4 版每月的邊緣線（shapefile 的 polyline，極地立體投影），北極 9 月、南極 2 月，1979–2026 年，加上 1981–2010 年的中位數。pipeline 自己讀 .shp（PolyLine 的二進位格式，沒有另外裝套件），座標用 rasterio 的 PROJ 換成經緯度。原始的邊緣沿著 25 km 的格子邊走、是鋸齒狀，在投影座標上取前後各 2 點的移動平均抹平再簡化（Douglas–Peucker 0.05°）：`ice-edges.json` 1,480 條線 167 KB（抹平前 289 KB）。國家沒有值（`sea-ice.json` 只給時間軸的年份，國家寫「海冰不屬於任何國家」）；線依年代分 5 類（循序色由淺到深，越近越深）加中位數的虛線，`overlayTime: 'cumulative'`。
    - **海平面**：NOAA STAR 的 1993–2025 年趨勢網格（0.5°，±85°，rasterio 讀 netCDF）分 7 級（下降、0–2、2–3、3–4、4–5、5–6、6 mm/年以上）存成 8 位元 PNG（13 KB），用氣候分區的類別網格圖層畫（第 104 點）；滑到海上看那一格（`pointer`，`ctx.indicator` 是新加的：只在海平面的指標寫）。國家的值是離國界 200 公里內的海的格子依緯度加權平均（颱風主題的 `NearIndex`），內陸國不算（Marine Regions 的清單，海洋主題同一份；200 公里會讓瑞士、奧地利碰到地中海）；國家不上色，給 tooltip、排名表與側欄。全球海洋格子的平均 3.17 mm/年。
    - **台灣**：沒有冰河（附註寫雪山、南湖大山的圈谷是冰河期留下的地形）；沿海的海平面 1993–2025 年每年上升 3.31 mm（109 格），附註寫衛星測高不含地層下陷。
    - **限制**：冰河的國家值依中心點歸國，跨國的冰河整條算在一國；水文年跟日曆年差幾個月；海冰的範圍是「至少 15% 有冰」的面積，不是冰的總量（厚度）；海平面是 33 年的線性趨勢，不是加速度，網格也不含沿岸 0.5° 以內的格子。資料共 236 KB。

106. **各國在讀什麼**（`pipeline/topics/reads.py`、`src/topics/reads.ts`、`src/topics/panels/ReadsPanel.tsx`，2026-10-29）：
    - **資料**：Wikimedia 的差分隱私每日瀏覽量（country_project_page，2023-02-06 起每天一個 TSV，約 18 MB、28 萬列）：國家、project、page_id、標題、Wikidata QID、瀏覽次數。說明頁寫：每位讀者一天只算前 10 個不同的條目、2023-05-25 起只留人的瀏覽（濾掉自動程式與搜尋引擎），數字加了雜訊，一天不到門檻（低風險國家 90 次，中、高風險國家 550、1,000 次）的不公布。使用者決定：最近 24 個完整的月份（2024 年 10 月到 2026 年 9 月）、每月第一名加前 10 名、邊下載邊彙整（730 個檔約 13 GB，不留原檔，每月的彙整存在 `.cache/wikimedia/months/`，約 30 分鐘）、只拿掉首頁（Q5296 與 Main_Page）、成人或聳動的內容照原樣。各語言的維基百科合在一起排（同一個條目在不同語言是不同的列，不合併）。241 個國家與地區，缺 0 天。
    - **名稱**：前 10 名的 19,343 個 QID 查中文、英文名稱。Wikidata 的 wbgetentities 一直回 429（Retry-After 十幾秒，一批 50 個，要一個半小時），改用官方的 SPARQL 查詢服務（query.wikidata.org，一次 400 個、POST，約 5 分鐘；同樣照 Retry-After 等）。中文依序取 zh-tw、zh-hant 的標籤、zhwiki 的條目名稱、zh 的標籤（後兩者 OpenCC s2tw），都沒有的中文維基百科條目把原文轉成繁體字；英文取 enwiki 的條目名稱或 en 的標籤。有中文名稱的 78%、英文 97%。名稱跟原文一樣的存 null（前端用原文）。
    - **地圖**：每國每月第一名畫成國家最大那塊陸地裡離邊界最遠的點（shapely 的 polylabel），條目名稱寫在點旁邊：點圖層新加的 `pointLabel`（第 4 節；文字圖層放在所有圖層最上面，不然被底圖的地名蓋住；字型用底圖地名的那一種，不用斜體的海名字型）。阿拉伯、天城、泰文等需要連寫或組合的文字 MapLibre 排不好，地圖上不寫（tooltip 與側欄照常）。國家的值是第一名的瀏覽次數（不上色，`kind: 'none'`），國家的 tooltip 多一行「讀最多：…」（`tooltipLines` 新加的 `year`）。時間軸是月份：年份欄位存「2000 年 1 月起的第幾個月」，時間軸的刻度用新加的 `timeAxis.tick`（「2026/9」）。
    - **英文的比例**：那個月公布的瀏覽次數裡 en.wikipedia 占幾 %（面量圖）。小語言的維基百科被門檻拿掉的比較多，比例偏高（附註寫明）。台灣 2026 年 9 月 1.1%（第 224 / 231 名）、日本 0.6%。
    - **台灣**：2026 年 9 月第一名是「早春晴朗」43.3 萬次，接著沈伯洋、井柏然；前 10 名都是中文維基百科。簡體字的條目名稱（例如「兰香如故」）用 Wikidata 的名稱或 s2tw 顯示成繁體字，側欄另外寫原文。
    - **看起來像自動程式的流量**：同一個條目同時在很多小國排第一（2026 年 9 月 Abby Borden 18 國、Lizzie Borden 13 國、european election 2014 11 國、XXX 9 國），Wikimedia 已經濾掉大部分自動程式，這些看起來是沒濾掉的；使用者決定照原樣，附註寫明。
    - **資料量**：`countries/<ISO3>.json` 存這國上榜過的條目表（原文、語言、中文、英文）加每月的 [索引, 瀏覽次數]（同一個條目常連續幾個月上榜，比每列都寫名稱小約 22%），共 2.6 MB，點國家才下載；`top.json` 387 KB。整個主題 3.07 MB。

107. **帝國與疆界**（`pipeline/topics/empires.py`、`src/topics/empires.ts`、`src/topics/panels/EmpiresPanel.tsx`，2026-10-29）：
    - **資料**：Cliopatria v0.2.1（Zenodo 的 zip 299 MB，裡面的 cliopatria.geojson 約 1.4 萬列：名稱、FromYear、ToYear、Wikidata、Type、Components、MemberOf）。只畫 Type 是 POLITY、名稱沒有括號的列（括號的是好幾個政體合起來的帝國，成員各自另有一列，畫了會重疊）；顏色依所屬的帝國（MemberOf，沒有就是自己）分，大英帝國的各部分同色；10 種顏色依相鄰關係分配（相鄰同色只剩 2 對），不用藍色（底圖的海是藍的，第一版荷蘭的台灣是藍色，看起來像海）。
    - **取樣**：全部 508 個年份的範圍有 370 萬個頂點，只取西元前每 100 年、西元 1–1800 年每 50 年、1800 年起每 5 年，加上 2024 年與台灣的 1625、1640、1670 年（共 119 個年份），用到 4,957 列；簡化到 0.2°、量化 0.1°，`polities.json` 2.1 MB（每個環一筆紀錄只存列號與是不是洞，列的資料放在 `groups`）。時間軸只停在這些年份（`polities-years.json`）；線圖層的 `timeField`、`endField`（範圍的起訖，`endField` 是最後一年的下一年）讓每一列在它的年份裡才畫（第 4 節，線圖層的 `endField` 是新加的）。名稱另外是一個點圖層（範圍裡最大那塊的 polylabel，`pointLabel`，依面積大小排優先）。
    - **台灣**（使用者決定：逐一核對，Cliopatria 錯或缺的依史實修正，資料檔與附註標明，fx = 1，tooltip 寫「台灣的部分依史實修正」）：荷蘭從 1624 年起（Cliopatria 1626 年起，補 1624–1625 年）；西班牙在北台灣只到 1642 年（Cliopatria 到 1658 年）；1662–1682 年台灣的部分是東寧王國（Cliopatria 寫南明）；澎湖補進東寧、清、日本、中華民國；1950 年起金門屬於中華民國，1951 年起中華民國只留台灣、澎湖、金門。沒改的：清朝 1683 年起畫整個台灣（東部山區 1875 年後才設治）、中華民國 1946 年起（附註寫明）。側欄：荷蘭 1625–1650、西班牙 1640（約 13%）、東寧 1670、清 1700–1890、日本 1895–1945、中華民國 1950–2024（取樣年份）。
    - **中文名稱**：Cliopatria 的 Wikidata 編號常常指錯：Republic of China 指到中華人民共和國（Q148）、Han Dynasty 指到印度的 Chauhan dynasty（第一版的中文寫成「兆漢人」）、兩韓都指到北韓、兩個越南都指到北越、Cuban Nationalists 指到卡斯楚、周代的「Han」（韓）指到土耳其的 Sarukhanids。所以只在 Wikidata 的英文名稱跟 Cliopatria 的名稱對得上時用它的中文（`same_name()`：去掉 dynasty、empire、kingdom 這類字後有相同的字，或前 5 個字母相同；幾個名稱共用一個編號時只給最像的那一個；標籤是歷史、列表、時期、事件的不用），加上 47 個自己寫的（`ZH_NAMES`：台灣相關〔東寧王國的 zh-tw 標籤是「明鄭時期」，改成「東寧王國（明鄭）」〕、常見的大政體、周代諸侯國）；1,383 個名稱裡 1,131 個有中文，其他寫英文。名稱用 Wikidata 的 SPARQL 查（跟各國在讀什麼共用快取）。
    - **殖民帝國**：COLDAT 的 COLDAT_colonies.tab（26 KB），8 個殖民國各自的起訖年份用 mean 編碼（使用者決定），max 編碼的起訖給側欄（「最寬的說法」）。同一年有兩個殖民國時取比較晚開始的那個；只有部分地區的（partial）不搶先。比利時、德國、義大利併成一類（類別色最多 8 種）。只補台灣（使用者決定）：荷蘭 1624–1662、西班牙 1626–1642（北部，partial）、日本 1895–1945，資料檔寫明是自己補的；其他被日本、美國、俄羅斯、鄂圖曼統治的地方不收（附註寫明）。`colonizer.json` 1462–2024 年每年。
    - **國家**：今天的國家（1:50m）在每個取樣年份被哪些政體涵蓋（占國土 3% 以上），連續相同的合成一段（`countries.json`，給側欄與 tooltip 的「今天的國土那時屬於」）。各時期的疆域不上色（`kind: 'none'`）。
    - **時間軸的西元前**：時間軸的年份是負的，`timeAxis` 的 `tick` 寫「前 3400」，tooltip 與標題寫「西元前 200 年」；網址的 `year` 以前只收正數，改成收任何整數（第 4 節）。
    - **限制**：Cliopatria 的邊界平滑過、跟今天的海岸線對不齊，只是一種畫法，年份與邊界常有爭議；取樣的年份之間的變化看不到（荷蘭在台灣 1624–1662 年，時間軸上只看得到 1625、1640、1650 年）；殖民只收 8 個歐洲殖民國。資料共 2.8 MB。

108. **板塊漂移**（`pipeline/topics/plates.py`、`src/topics/plates.ts`，2026-10-29）：
    - **模型**：Merdith 等 2021 的全板塊重建模型 v1.2.4（Zenodo 的 zip，解開在 `.cache/merdith/`）：旋轉檔（1000_0_rotfile）、靜態多邊形（shapes_static_polygons，今天的地殼依板塊切好、每塊有存在的時間）、250-0 與 410-250 的板塊邊界加 TopologyBuildingBlocks。使用者決定 0–250 百萬年、每 500 萬年一格（51 個時間點）。
    - **國界**：人口主題的 country_shapes()（Natural Earth 1:50m）簡化到 0.4°（約 40 公里），用靜態多邊形切到各板塊上（shapely 在經緯度上切：pyGPlates 的 partition_into_plates 會把多邊形切成線段，第一版就是這樣），同一國同一塊板塊的碎片先合併再簡化（直接用靜態多邊形的細邊界頂點多十倍），比 0.1 平方度小的碎片不畫，共 1,482 塊。每個時間點各自 reconstruct；那塊地殼還沒形成的年代不畫。轉回去後同一國的各塊合併（板塊之間的切線不見、頂點少很多）：51 個 `countries/<年份>.json` 共 2.1 MB（最早的版本 16 MB）。顏色是今天所在的大洲（Natural Earth 1:10m 的 CONTINENT），播放時看得出哪些陸地本來連在一起。
    - **板塊邊界**：resolve_topologies 後取共用的邊界段（相鄰兩塊只畫一次），依特徵類型分隱沒帶、中洋脊與張裂、轉形斷層、其他：`boundaries/<年份>.json` 共 0.4 MB。
    - **國家的值**：國土各塊依面積加權的重心在那時的緯度（`paleolat.json`），給 tooltip、排名表與側欄的折線。台灣（華南板塊）：今天北緯 23.8°、5,000 萬年前 29.4°、1 億年前 28.9°、1.5 億年前 33.4°、2 億年前 44.9°、2.5 億年前 15.8°；印度 1 億年前在南緯 34.6°。
    - **地圖**：底圖只留海（主題的 `bareMap`，第 4 節）：今天的陸地、地名、國界在過去的位置上沒有意義，國家不能點，用搜尋選；線圖層的檔名依年份換（`countries/{year}.json`，第 4 節），換年份時新的到之前照畫舊的。滑到陸地上時 `pointer` 讀同一個時間點的檔，用射線法判斷游標在哪一國的哪一塊（經度試 ±360°），寫「今天的台灣 · 1.5 億年前 · 那時在北緯 33° 附近」；`pointer` 的第二個參數多了 `year`。時間軸的年份是負的百萬年（−250 … 0），`timeAxis` 寫「2.5 億年前」「今天」，刻度「250 百萬年前」。
    - **限制**：國界是今天的，形狀也是今天的海岸線，不是當時的海岸（海平面、被拉開或擠壓的地殼都不同）；緯度依古地磁定得比較好，經度依模型的參考框架；靜態多邊形切得比國界粗，邊緣的小島可能歸到旁邊的板塊；國家的緯度只是重心，大國的國土跨很多緯度。

109. **風與季風**（`pipeline/topics/wind.py`、`src/map/windLayer.ts`、`src/topics/wind.ts`、`src/topics/panels/WindPanel.tsx`，2026-10-29）：
    - **資料**：NCEP/NCAR 再分析（T62 高斯網格，經度每 1.875°、緯度 94 列不等距）離地 10 m 的 uwnd、vwnd（風的東西、南北分量的月平均）與 wspd（每天風速的月平均），1991–2020 年每個月的長期平均（使用者決定：地面 10 m、1991–2020、時間軸 1–12 月）。GDAL 讀 netCDF 時把緯度當成等距，pipeline 用高斯求積的節點（numpy 的 leggauss）算出真正的緯度再內插。
    - **風場**：u、v 雙線性內插到經緯度每 2° 一點（181 × 91，約是原始的解析度），0.25 m/s 一級存成 int8：12 個月共 515 KB（每個月約 43 KB，換月份才下載）。粒子順著 u、v 的月平均走：風向常變的地方月平均互相抵消，走得慢（附註寫明）。
    - **風速的底色**：wspd 內插到 1° 格子中心，分 6 級（2、4、6、8、10 m/s）存成 8 位元 PNG，用氣候分區的類別網格圖層畫。網格蓋住整個地球（海上也有風），不透明度 0.65：太不透明看不出海岸線，太透明海上的橘色混了藍色變成紫色（0.85 與 0.6 都試過）。
    - **國家的值**：國土所在的 1° 格子（Natural Earth 1:10m，格子中心在國界內）依緯度加權的 wspd 平均（`speed.json`）；1° 的格子中心都不在國界內的 69 個小國用國家標籤的位置（各國在讀什麼的 polylabel）內插一點。側欄（`panel.json`）每個月寫 [風速, 平均風向（u、v 向量平均的反方向，16 方位）, 向量平均的風速]；向量平均 ÷ 風速是風向的穩定度（季風、信風接近 1），低於 25% 寫「風向不定」；1 月與 7 月的風向相差 90° 以上（兩個月都穩定）時寫「冬夏換方向的季風」。
    - **台灣**：1 月東北風 8.4 m/s（穩定度 93%）、7 月南風 5.3 m/s（53%），相差約 135°。網格約 200 公里，台灣在模式裡大半是海，山、盆地的風看不出來（附註寫明，實際的風看中央氣象署的測站）；國土平均風速排第 4（1 月），主要是台灣海峽的風。印度 1 月東北東風、7 月西南西風。
    - **粒子圖層**：第 4 節。在無頭瀏覽器（swiftshader）每秒只有幾幀，截圖的尾巴比實際短；手機上粒子數依畫面大小變少（最少 900 個）。
    - **限制**：30 年的月平均，不是哪一天的風；10 m 的風受地形影響大，再分析的網格太粗；颱風、鋒面這類短時間的強風在月平均裡看不到。資料共 0.6 MB。

110. **主食是米、小麥還是玉米**（飲食主題的擴充，2026-10-29；`pipeline/topics/diet.py` 的 `STAPLES`、`src/topics/diet.ts` 的 `STAPLE_KINDS`、`DietPanel.tsx`）：
    - **做法**（使用者決定：分 5 類、依熱量、1961 年起）：糧食平衡表每人每日的熱量（element 664），米（2807／舊版 2805）、小麥（2511）、玉米（2514）、其他穀物（穀物合計 2905 減前三種：大麥、小米、高粱、燕麥、黑麥等）、薯類（2907：樹薯、馬鈴薯、番薯、山藥等）。熱量最多的是「主要主食」（類別圖，`staple.json`），它占總熱量的比例是另一個指標（`staple-share.json`）。熱量不必像重量那樣把新版的稻穀換成白米。2010 年換方法照飲食主題的其他指標標斷層；新版沒有的 9 國（日本、貝南、馬利等）只到 2009 年。各國側欄的檔多一組 `staples`（5 類的熱量），側欄加一張長條；主要主食歷年怎麼換，類別圖的側欄本來就會列（「主要主食的變化」）。
    - **結果**（2023 年，最新一年）：小麥 103 國、米 44 國、玉米 20 國、薯類 15 國、其他穀物 5 國。主要主食占熱量最高的是剛果民主共和國的薯類 67%、孟加拉的米 64%、阿富汗的小麥 59%。
    - **台灣**：一直是米，但越來越接近小麥：1961 年米 1,253 大卡、小麥 268 大卡；2000 年 447 對 380；2023 年 391 對 376（主要主食占熱量從 49.6% 降到 13.2%）。
    - **限制**：糧食平衡表是供給不是攝取；米與小麥的熱量依原料計（麵粉、米飯的加工損耗不另算）；大蕉（plantain）在糧食平衡表裡算水果，烏干達、迦納等以大蕉為主食的國家會被低估。

111. **鐵路軌距**（交通主題的擴充，2026-10-29；`pipeline/topics/rail_gauge.py`、`src/topics/transport.ts` 的 `GAUGES`、`TransportPanel.tsx` 的 `GaugeSection`）：
    - **做法**（使用者決定：國家層級、世界概況為主、缺的用英文維基百科補、不畫換軌的國界）：世界概況 Transportation > Railways 的各欄（standard gauge、broad gauge、narrow gauge、dual gauge、note…）裡「345 km (2018) 1.435-m gauge」這種寫法，依公尺數換成毫米、加總各軌距的公里數；拼字、單位不一（「guage」「1.435 mm」），只認公尺數。印度 2014 年只寫 broad gauge，補成 1,676 mm（`MISSING_GAUGE`）；中國只有 total 欄位，軌距寫在總長後面。雙軌距（同一條線兩種軌距）不算進比例，只列在側欄。
    - **舊版**：2023 年 1 月起世界概況的歐洲各國與俄羅斯、阿根廷、阿爾及利亞只剩鐵路總長，德國、義大利只剩窄軌（各軌距加總不到總長一半，`MIN_COVERAGE`）。用部分 clone（`git clone --filter=blob:none`）逐檔二分搜尋各檔的修改歷史，最後一個還有分軌距的版本都是 2022-12-29（commit 61dadec）或更新，於是這 35 國用 2022-12-29 的版本。亞美尼亞、南蘇丹兩版都沒有，用英文維基百科（亞美尼亞 1,520 mm、南蘇丹 1,067 mm，只有軌距、沒有長度，不算比例）；摩納哥沒有自己的鐵路營運，不畫。一開始用維基百科「Rail transport in …」的資訊框補這 35 國，結果不可靠（瑞士、阿根廷的各軌距長度不全或有誤，英國、愛沙尼亞、阿爾及利亞的條目沒有資訊框），改用舊版世界概況。
    - **筆誤**（`GAUGE_FIX`）：瑞士「1.200-m」→ 1,000 mm、南非「1.065-m」→ 1,067 mm、阿爾及利亞「1.432-m」→ 1,435 mm、曼島「1.076-m」→ 1,067 mm；法國 narrow gauge「-5 km」不算。
    - **分類**：標準軌 1,435、俄規寬軌 1,520／1,524（芬蘭）、印度寬軌 1,676（也包括阿根廷、智利、巴基斯坦、斯里蘭卡）、伊比利寬軌 1,668、愛爾蘭寬軌 1,600（也包括巴西、澳洲維多利亞州）、開普軌 1,067、米軌 1,000、其他（1,000 mm 以下的窄軌、1,050 mm 漢志鐵路、1,372 mm 京王線等）。主要軌距是公里數最多的那一類。
    - **結果**：137 國；標準軌 60、米軌 22、開普軌 21、俄規寬軌 17、印度寬軌 4、伊比利寬軌 2、愛爾蘭寬軌 1、其他 10。標準軌的比例兩極：135 國裡 60 國不到 1%、41 國 99% 以上。台灣（2018 年）：1,067 mm 1,118 公里、1,435 mm（高鐵）345 公里、762 mm（阿里山林鐵等）150 公里，標準軌 21.4%；日本 17.7%、西班牙 16.8%。
    - **限制**：資料年份各國不同（2008–2023 年），用舊版的 35 國是 2014–2019 年（一半是 2014 年）；世界概況的長度有的含工業、林業鐵路（愛爾蘭的 914 mm 是泥炭鐵路），有的只算營運中的路線。側欄寫明來源與資料年份。

112. **山脈**（海拔主題的擴充，2026-10-29；`pipeline/topics/mountains.py`、`src/topics/elevation.ts` 的 overlays、`ElevationPanel.tsx` 的 `MountainRanges`）：
    - **做法**（使用者決定：當海拔主題的疊加圖層、用 291 個主要山系）：GMBA Mountain Inventory v2 的 `standard_300`（合起來就是 GMBA 依地形起伏定義的全部山區，南極洲除外，2,477 萬 km²）。標準函式庫讀 .shp、.dbf（沒有 OGR），順時針的環是外環；shapely 簡化 0.04°、去掉小於 0.01 平方度（赤道約 120 km²）的碎片與洞，1.0 MB（gzip 約 0.35 MB）。線圖層的 `fill` 畫半透明的灰色面與外框，新增 `fill.hover`：面本身也是查詢層，滑到山區裡面就出現山系的名稱、面積與所在國家（面底下的國家滑不到，點一下照樣選國家）。名稱另一個點圖層（`pointLabel`，依面積排優先順序）。只在「地形」與「國土在山區的比例」兩個指標顯示。
    - **國土在山區的比例**：0.025° 網格（約 2.8 km），國界跟海拔主題一樣（`population_grid.country_shapes`），每格依緯度算面積，國界含湖面；陸地不到 100 km² 的（摩納哥、聖馬利諾）不輸出。側欄的「主要山脈」是每國境內面積最大的 6 個山系。
    - **中文名稱**：Wikidata 的 zh-tw／zh-hant 標籤 131 個、GMBA 的 Name_ZH（OpenCC s2twp）1 個、自己翻 100 個（`ZH_NAMES`，同名的山系不只一個，用檔案順序加名稱核對），另外 59 個改掉 Wikidata 不合適的（`ZH_FIX`：「斐濟地理」→ 斐濟群島、「龍山山脈」→ 德拉肯斯堡山脈、「加拿大落基山脈」→ 加拿大洛磯山脈、殘留的簡體「第拿里山脉」等）。
    - **結果**：不丹 99%、尼泊爾 81%、瑞士 68%、台灣 64%、日本 54%、中國 41%、美國 21%、荷蘭 0。台灣整個是一個山系「臺灣島」（23,155 km² 在境內）；要分出雪山、中央、玉山等 7 條山脈得用 6,717 個基本單位，使用者選了主要山系。
    - **限制**：GMBA 的山區依地形起伏劃，平坦的高原（青藏高原內部的一部分）不算、低海拔的陡坡算，跟「海拔 1,000 公尺以上」的比例不一樣；以島嶼、群島命名的山系只包括島上的山區；GMBA 的最高點是 DEM 算的（台灣 3,887 m，不是玉山的 3,952 m），所以 tooltip 不寫最高點。

113. **出生的季節**（新主題，社會類，排在生育率與高齡化後面，2026-10-29；`pipeline/topics/birth_season.py`、`src/topics/birth-season.ts`、`BirthSeasonPanel.tsx`）：
    - **做法**（使用者決定：只做出生最多的月份；台灣用內政部按登記的月份、附註寫明）：UNdata 表 55 一國一頁（照婚姻主題的 Data.aspx 爬法，第一頁約最近 3–4 年，156 國），每月出生數除以天數比每日平均。依發生日期的優先；同一年的 12 個月要來自同一個資料來源年份（日本 2025 年的暫定數 12 月是隔年才補的），最終數字優先；暫定數最少的月份不到中位數六成的不用（澳洲 2024 年 12 月只有其他月份的六分之一，還沒登記完）。只有季別的不算。結果 140 國、2000–2025 年，指標檔設 `latestWithin: 10`。
    - **台灣**：內政部統計查詢網（statis.moi.gov.tw）的 CSV，民國 103 年（2014）起。這個主機的憑證缺 Subject Key Identifier，Python 3.13 預設的 `VERIFY_X509_STRICT` 會拒絕（curl、瀏覽器接受）：`common.download` 對 `RELAXED_X509_HOSTS` 的主機只拿掉這一項嚴格檢查，憑證鏈與主機名稱照樣驗證，沒有關閉 TLS 驗證。
    - **配色**：12 個月超過類別色的 8 色，用 `CategoryDef.color` 自訂：北半球四季各一個色系（冬紫、春綠、夏黃到橘褐、秋紅），每季由淺到深，OKLCH 算出後用 dataviz 的配色驗證工具檢查（淺色模式的亮度帶、彩度、相鄰月份一般視覺 ΔE ≥ 15、色盲模擬 ≥ 12.6 都通過；跟背景對比不到 3:1 的淺色有圖例、tooltip 與排名表的文字）。
    - **結果**（各國最近一年，2015 年以後的 128 國）：9 月最多 29 國（英國、西班牙、墨西哥…）、7 月 18 國（德國、日本、加拿大…）、4 月 14 國（巴西、南非…）、10 月 13 國（南韓、義大利、紐西蘭…）、1 月 12 國；美國 2019 年 8 月（每天 11,022 人，比全年平均多 7.4%）。台灣按登記，每年不同：2024 年 11 月、2025 年 2 月（2024 龍年年底出生的寶寶 2025 年初才登記）。
    - **限制**：UNdata 沒有中國、印度等人口大國的逐月資料；各國最近的年份不同（美國只到 2019 年）；依登記的國家（台灣、紐西蘭、愛爾蘭、泰國等 25 國）的月份跟著登記的時間移動。

114. **健康平均餘命**（健康主題的擴充，2026-10-29；`pipeline/topics/hale.py`、`src/topics/health.ts` 的 `hale`、`unhealthy`）：
    - **做法**（使用者決定：台灣用衛福部的數字畫在地圖上、標明算法不同；加「不健康的年數」）：WHO 的 HALE 與平均壽命 2000–2021 年，183 國。GHO 的 OData API 2026-10-29 整天回 HTTP 500（連既有的平均壽命也是），改用 data.who.int 背後的整檔 CSV（`DATADOT/INDICATOR/C64284D_ALL_LATEST.csv`、`90E2E48_…`）。「不健康的年數」用 **WHO 同一次發布的平均壽命**相減，不是手冊建議的拿健康主題的平均壽命（聯合國 WPP）來 derive：兩套模型的平均壽命不同，相減會混進估計的差異。指標檔設 `latestWithin: 5`，健康主題預設的 2023 年顯示 2021 年的值。
    - **台灣**：衛福部只公布男女分開的數字，沒有兩性合計，使用者決定兩個指標都加「兩性／女性／男性」的選擇器（指標的 `dimension`），台灣畫在女性、男性，兩性用 `noValue` 寫原因。數字取自衛福部統計處「健康照護服務性別統計」（99 年男 68.8、女 73.5；109 年男 70.9、女 75.8 歲，平均壽命同一張圖的 76.1／82.5、78.1／84.7），不健康的年數 109 年男 7.2、女 8.9 是原文。衛福部各年的「性別統計圖像」會整串重算（105 年男性 2018 年版寫 68.7、2021 年版寫 69.34；2021 年版 100 年 68.52 比新文章 99 年的 68.8 還低），所以只用最新一份的兩個年份。台灣的 tooltip 第三行寫「衛福部，算法跟 WHO 不同」。
    - **結果**：2021 年兩性最高新加坡 73.6、日本 73.4、南韓 72.5 歲，最低賴索托 44.6 歲；不健康的年數澳洲、美國 12.5 年最多，索馬利亞 6.5 年最少（壽命短的國家少，能活到慢性病多的年紀的人少）。
    - **限制**：台灣的女性健康平均餘命 75.8 歲在排名表上是第一（WHO 女性最高的新加坡 75.0），是算法不同造成的，tooltip 與附註寫明，排名表沒有另外排除。WHO 只到 2021 年。

115. **學制與開學月份**（教育主題的擴充，2026-10-29；`pipeline/topics/school_calendar.py`、`src/topics/education.ts`、`src/topics/months.ts`）：
    - **做法**（使用者決定：開學月份用 UIS、另兩個用世界銀行；UIS 跟實際不同的國家依實際修正、附註出處）：UIS 指標 403（2015–2025 年，222 國）；世界銀行 SE.COM.DURS（義務教育年數）、SE.PRM.AGES（小學入學年齡）2000–2025 年。開學月份跟出生的季節共用 12 個月的配色（`months.ts`，第 113 點）。
    - **修正**（`FIX_START`，套用到每一年，出處寫在各國的附註）：美國 UIS 寫 7 月（不少州的學年從 7 月 1 日算起）→ 8 月（各學區自訂，多數學生 8 月中下旬開學，Pew Research Center 2023-08-25）；巴西 3 月 → 2 月（各州自訂，多數州 2 月初，例如聖保羅州 2025-02-03）；德國 10 月 → 8 月（各邦的學年從 8 月 1 日開始，2020 年的各邦協議，Eurydice；多數邦 8 月開學，巴伐利亞、巴登-符騰堡 9 月中）。只核對了人口前 70 大國家裡明顯不對的；法語區非洲國家 UIS 多寫 10 月，沒有逐一查證。
    - **台灣**：《各級學校學生學年學期假期辦法》第 2 條（學年 8 月 1 日開始；第 4 條暑假到 8 月 29 日）、《國民教育法》第 3、4 條（6 到 15 歲，國小 6 年、國中 3 年），2026-10-29 在全國法規資料庫核對原文：8 月、9 年、6 歲。十二年國教的後 3 年不是強迫入學。
    - **結果**（2025 年）：開學 9 月 116 國、1 月 34 國、10 月 22 國、8 月 18 國；義務教育 9 年最多（42 國）；入學年齡 6 歲 154 國、7 歲 32 國（芬蘭、瑞典、波羅的海三國、俄羅斯、波蘭、印尼、南非…）、5 歲 25 國（英國、愛爾蘭、澳洲、紐西蘭與加勒比海的大英國協國家）。
    - **限制**：聯邦國家各州不同（美國、德國、巴西、澳洲），只取多數；UIS 的「開學月份」有的國家是統計用的學年起算月；世界銀行的義務教育年數有兩個屬地是 0（關島、新喀里多尼亞），照原樣。

116. **生物圈保護區**（世界遺產主題的擴充，2026-10-29；`pipeline/topics/biosphere.py`、`src/topics/world-heritage.ts`、`WorldHeritagePanel.tsx` 的 `BiosphereSection`）：
    - **做法**（使用者決定：先只做生物圈保護區，世界地質公園等 Wikidata 補齊再加）：Wikidata 有 P2520（UNESCO Biosphere Reserve URL）或 P1435 = Q158454 的 793 個項目，除名的（P576）15 個不收。同一處常有好幾個項目（國家公園與保護區各一個、新舊兩種 UNESCO 網址各一個：西班牙因此有 71 個），用網址的代稱與同一國的名稱（拿掉 biosphere、national park 這類字後相同或互相包含）去重，剩 709 處、679 處有座標。
    - **製作時問使用者**：709 處只有 UNESCO 797 處的九成，而且有已除名沒標的（美國算出 39 處，2017 年已有一批撤出），使用者決定**只畫點、不做各國的處數**：指標是 `kind: 'none'`（國家不上色、不排名），點只在這個指標顯示，世界遺產的點改成只在世界遺產數與瀕危兩個指標；側欄列這一國的保護區。
    - **限制**：名稱用代表的那個項目（名稱有 Biosphere 的優先），有的是國家公園的名稱；中文名稱只有部分有。台灣不是 UNESCO 會員，沒有。

117. **從台北看世界**（新主題，地理類，排在地球的另一邊後面，2026-10-29；`pipeline/topics/taipei_view.py`、`src/topics/taipei-view.ts`、`TaipeiViewPanel.tsx`）：
    - **做法**（使用者決定：主地圖不換投影、中心固定台北）：台北取臺北市政府（北緯 25.0375°、東經 121.5625°），首都用晝夜與季節主題的 `capitals.json`（239 個）。大圓距離與一開始的方位角在資料管線算（球的半徑 6,371.0088 km），方位分八方位做類別圖（八類剛好是類別色的 8 色），準確的角度放在 `bearing-deg.json`，tooltip 的第二行用（`tooltipLines` 第一次用到才下載）。大圓航線每 150 公里一點、距離圈每 2° 方位一點，經度展開成連續的才不會橫越地圖；距離圈的線上寫距離（`lineLabel`）。
    - **側欄的圓盤**：d3-geo 的 `geoAzimuthalEquidistant`（以台北為中心旋轉、`clipAngle(179.9)` 畫到對蹠點），國界用 1:110m，每 5,000 公里一圈虛線，選到的國家塗主色、從圓心畫大圓航線到它的首都。靠近對蹠點的國家（巴西、阿根廷）在外圈被拉成一圈，是這種投影的特性，附註寫明。
    - **結果**：最近香港 814、澳門 876、馬尼拉 1,162、首爾 1,484 公里；最遠亞松森 19,929 公里（對蹠點 20,015 公里）。華盛頓 12,647 公里、北偏東 16°（地圖上看起來在東邊，航線一開始往北）；倫敦 9,784 公里、北偏西 32°；巴西利亞北偏西 49°。八方位：西北 89 國最多、西 53 國、北 35 國。
    - **限制**：首都到首都，不是國土的距離；對蹠點附近方位不穩定（阿根廷 180°、烏拉圭 191°、巴拉圭 252°），附註寫明並連到地球的另一邊。
118. **熊貓外交**（新主題，國際類，排在台灣的外交後面，2026-10-29；`pipeline/sources/panda_diplomacy.py`、`pipeline/topics/pandas.py`、`src/topics/pandas.ts`、`PandasPanel.tsx`）：
    - **資料**（使用者決定：獨立主題、放「國際」）：沒有現成的資料集，依英文維基百科三個條目的固定版本手工整理成表（第 8 節第 12 點），43 列、22 國：每一列是一次到某個動物園（同一個動物園先贈送、後來又租借的分成兩列），寫開始與結束的年份、種類、熊貓的名字、中英文說明與出處。種類 5 類：中華民國贈送（1941，宋美齡送給布朗克斯動物園）、贈送（1957–1983，9 國）、短期出借（1984–1988，幾個月的展出，7 次）、長期租借（1984 年以後，25 次）、台灣。
    - **取捨**：條目沒寫開始年份、只知道某一年已經在的（那一年在那裡出生了幼仔），用那一年並在說明寫「最晚」；完全沒有年份的（孟菲斯、神戶王子動物園、卡達）不收；香港、澳門是中國境內，不收。條目沒寫哪個動物園的（蘇聯 1957、日本 1972、法國 1973）畫在首都（晝夜與季節主題的 `capitals.json`），說明寫明。結束年份條目沒寫的當成還在（tooltip 寫「年起」）。
    - **台灣**（使用者決定：只寫事實）：臺北市立動物園 2008 年起的團團、圓圓，說明只寫抵達日期、在台灣出生的圓仔與圓寶、團團 2022 年死亡，不寫「贈送」「租借」這類定性，種類單獨一類「台灣」。
    - **地圖**：比例圓是各國到這一年為止收到的次數（`overlayTime: 'cumulative'`，點與弧線依開始的年份累積出現，結束的照樣留著）；弧線從成都畫出（1941 年那一次從重慶），每 150 公里一點的大圓弧線，只表示來自中國，不是實際的路線，附註寫明。動物園的座標與中文名稱用英文維基條目名稱對 Wikidata（重新導向的條目名稱要寫導向後的，例如 Berlin Zoo、Schönbrunn Zoo），中文名稱改成台灣用語或官方名稱的寫在 `ZOO_ZH`（臺北市立動物園、聖地牙哥動物園等 6 個）。
    - **結果**：美國 13 次最多（國家動物園 1972、2005、2024，布朗克斯 1941、1987，聖地牙哥 1999、2024，亞特蘭大 2006、2026，加上洛杉磯、舊金山、坦帕、托雷多的短期出借），日本 3 次；結束年份空白、當成還在的長期租借 16 處。
    - **限制**：結束年份照條目寫；條目沒有更新的照樣當成還在（例如「List of giant pandas」仍寫馬德里的 Bing Xing、Hua Zuiba 2007 年起），不用別的來源補，要更新就換新的固定版本重新整理。
119. **景點地圖**（新主題，地理類，排在摩天大樓後面，2026-10-29；`pipeline/sources/wikidata_attractions.py`、`pipeline/topics/attractions.py`、`src/topics/attractions.ts`、`AttractionsPanel.tsx`）：
    - **使用者決定**：製作手冊的博物館、動物園與水族館、主題樂園與雲霄飛車三個主題合成一個「景點地圖」、用圖層切換；不做各國的數量（Wikidata 的收錄各國差很多，德國、義大利、巴西大量匯入），只畫點；台灣的博物館用文化部的開放資料補，台灣缺的動物園、水族館手工補；已拆除的雲霄飛車不畫。
    - **查詢**：一次查全世界的博物館（含子類別）會逾時，所以先查六個根類別（博物館、動物園、公共水族館、主題樂園、遊樂園、雲霄飛車）的所有子類別（博物館以外 596 個），子類別每 40 個查一次；直接標成「博物館」的約 5 萬個一國（P17）查一次（206 國，第一次約 40 分鐘）。全部快取在 `.cache/wikidata/attractions/`。只標「博物館」、沒寫國家的項目查不到，數量不多。
    - **分類**：有關閉或拆除日期（P576、P3999）或類別是「已關閉的博物館」的不收（2,025 個）。同時是動物園（水族館）與樂園的兩個圖層都畫（六福村）；也是博物館的不畫在博物館（海生館、斯堪森）。Wikidata 的公共水族館是動物園的子類別，有水族館類別的算水族館。博物館的子類別裡遺產鐵道、遊客中心、解說中心、自然中心、影片資料館不算（`NOT_MUSEUMS`，只有這些類別的 1,360 個不收）。博物館的類型依 `MUSEUM_TYPES` 的根類別（含子類別）依序取：美術館、自然與科學（自然史、科學、科技、科學中心）、歷史與文化（歷史、考古、露天、地方、故居、民族學、軍事、人物紀念、宗教）；都不是的是「其他」，約六成（很多只標「博物館」「國立博物館」，例如故宮），台灣的「其他」用文化部的類型補。
    - **國家**：依座標（`geoindex.countries_at`），不用 P17（P17 是台灣的項目有的在中國大陸，製作手冊的陷阱）。
    - **台灣**：文化部名錄 144 館（131 館有經緯度），跟 Wikidata 在台灣的博物館、動物園、樂園比對（名稱相同，或 500 公尺內且名稱一個包含另一個或有兩個以上不常見的共同字），對到 90 館、補上 41 館（名錄裡的動物園、海生館對到動物園圖層，不重複）。動物園：六福村在 Wikidata 已經有動物園的類別；遠雄海洋公園在 Wikidata 只是遊樂園，手工加上水族館（`TAIWAN_ROLES`，出處是官網，`manifest.json` 的 `handAdded` 寫明）。結果台灣有博物館 381、動物園 8、水族館 7、樂園 25、雲霄飛車 3。
    - **地圖**：三個點圖層的 8 類各用一個類別色（任兩色都分得開）；點的大小與篩選都依維基百科條目數（`sl`）：博物館在世界全圖只畫 40 種語言以上的（約 170 處），圖磚 3 級 20、5 級 8、7 級起全部；動物園與樂園 15、5、全部。座標到 0.001°、依經度排序差分，博物館的檔案 3.8 MB（gzip 後約 1 MB，大多是名稱，比地震、發電廠的點檔大，比網格人口小）。
    - **名稱**：中文用 Wikidata 的 zh-tw、zh-hant（逐字轉繁體，有些夾著簡體字），沒有的用 zh 轉台灣用語，去掉「 (莫斯科)」這類消歧義括號。**Wikidata 2025 年起很多名稱只寫在多語言標籤 `mul`、沒有 en**（例如華盛頓的國家藝廊），所以沒有英文標籤的另外查 `mul`、英文變體與其他語言的標籤（`FALLBACK_LANGS` 依序取第一個，約 1.6 萬個，多半是德國、義大利、巴西大量匯入的博物館），英文介面顯示這個；什麼名稱都沒有的不收（98 個）。
    - **結果**：博物館 64,320（美術館 9,365、自然與科學 4,817、歷史與文化 11,901、其他 38,237）、動物園 2,070、水族館 491、樂園 2,111、雲霄飛車 1,064。條目最多的是羅浮宮（170 種語言）、柏林動物園（52）、加州迪士尼樂園（78）。
120. **南極研究站**（新主題，地理類，排在冰河、海冰與海平面後面，2026-10-29；`pipeline/topics/antarctic_stations.py`、`src/topics/antarctic-stations.ts`、`AntarcticStationsPanel.tsx`）：
    - **資料**（使用者決定：Wikidata 為主，COMNAP 只拿來核對）：Wikidata 的南極研究站（Q749622 與子類別）170 個，南緯 50 度以南、有座標、有名稱的 162 個（北極的英國站不收）。
    - **經營國**：依序取經營者（P137：經營者本身是國家，或經營者的國家；兩國合營的兩國都算，法國與義大利的康宏站、澳洲與羅馬尼亞的 Law-Racoviță 站）、項目的國家（P17，「南極洲」不算）、英文說明裡的國名（「antarctic base in Argentina」「former British research station」）；Refuge Emílio Goeldi 三者都沒有，手工補巴西（`HAND_COUNTRY`）。蘇聯的站算俄羅斯。還有 29 個不詳，都不是運作中的。
    - **狀態**：有關閉日期（P576、P3999）或說明寫 former、abandoned、historic 的是已關閉（24）。Wikidata 常沒標關閉（Framheim、Little America 這類歷史站），所以其他的跟 COMNAP 2024 年 11 月的名單核對：名單上 114 處設施各自對到 15 公里內最近的一個沒關閉的站，對到 101 處；對到的 88 站算運作中（有些設施對到同一站附近），其他 50 站是「不在 COMNAP 名單」（多半已關閉或是營地）。COMNAP 的研究站（Type 是 Station）83 處只有麥夸里島與挪威的 Troll 站沒對到（Wikidata 沒有歸在南極研究站）。
    - **結果**：運作中的站 31 國經營，阿根廷 13、俄羅斯 11、智利 11、中國 5、德國 5；COMNAP 的設施數是智利 14、阿根廷 13、俄羅斯 11（它含營地與避難所，計法不同，說明裡只引用總數）。最早的是阿根廷的奧卡達斯站（Wikidata 寫 1903 年）。台灣不是《南極條約》的締約方，沒有，`noValue` 寫明。
    - **地圖**：國家是比例圓，研究站的點依狀態上色、大小依維基百科條目數；沒有時間軸（Wikidata 只有約四成有成立年份）。主地圖沒有預設的視角設定，南極在平面地圖上會被拉寬，地球儀上看比較清楚。
121. **生育率與高齡化的擴充**（2026-10-29，製作手冊第五批 37；`pipeline/topics/fertility.py`、`src/topics/fertility.ts`）：
    - **使用者決定**：候選 203（人口金字塔）、206（平均生育年齡）、207（撫養比）合併成這一個擴充；人口金字塔本身側欄已有，只加「形狀」的類別圖。都用已經在下載的 UN WPP 2024（CC BY 3.0 IGO，第 8 節第 12 點已記），沒有新的來源。
    - **人口金字塔的形狀**：五歲年齡組人口自己算，0–14 歲占總人口 30% 以上是年輕型、65 歲以上 20% 以上是高齡型、其他是壯年型（使用者決定的門檻，說明寫明是自訂的；兩個都符合的情況 WPP 裡沒有，程式先判斷高齡型）。2023 年年輕型 77、壯年型 125、高齡型 35 國；台灣是壯年型（0–14 歲 11.9%、65 歲以上 18.3%）。類別圖不排名。
    - **母親的平均生育年齡**：人口動態指標檔的 MAC 欄，所有胎次的平均。說明寫明不等於晚生（尼日約 29 歲，生得多、第三四胎生得晚），並指向「婚姻與家庭」的女性初婚年齡。2023 年南韓 33.4 最高、尼泊爾 25.3 最低，台灣 31.9（1990 年 27.1），世界 28.2。
    - **總撫養比、扶幼比**：(0–14 歲＋65 歲以上) ÷ 15–64 歲 × 100、0–14 歲 ÷ 15–64 歲 × 100。總撫養比是 U 形（年輕與高齡的國家都高），所以 `unranked`、說明寫明不是越高越糟；梵蒂岡（104）、摩納哥（98）的人口結構特殊，說明寫明。2023 年台灣 43.4（扶幼 17.1＋扶老 26.3），中非 105 最高、卡達 20 最低，世界 53.9。
122. **城市怎麼長大**（城市主題的擴充，2026-10-29，製作手冊第五批 38；`pipeline/sources/ghsl_ucdb.py` 的 `country_stats()`、`pipeline/topics/cities.py` 的 `build_built()`、`src/topics/cities.ts`）：
    - **使用者決定**：先只做國家指標（建物面積、人均建物面積、相對 1975 年的倍數），用已經在下載的 GHS-COUNTRY-STATS R2024A（CC BY 4.0）的工作表 BU_S_km2_L1（城市、城鎮與半密集區、鄉村加總）；建物的網格地圖（GHS-BUILT-S，12 期約 2 GB）之後再說。
    - **定義**：GHS-BUILT-S 是衛星影像判讀的建築物屋頂覆蓋面積，不是建成區的範圍，說明寫明；人均是除以同一個檔的人口（POP_L1），不是住宅的室內面積；倍數是除以 1975 年，1975 年不到 1 km² 的不算。2025、2030 是推估（`projectionFrom`）。香港、澳門照城市主題的做法算在中國。
    - **獨立的函式**：`build_built()` 不用 Wikidata，可以單獨跑（2026-10-29 Wikidata 的查詢服務故障、限流到每分鐘 1 次，城市主題的中文名稱查不到，所以只重跑這一段，其他檔案沒有重算）；`build()` 照樣會呼叫它。
    - **結果**：全世界 1975 年 173,565 km²、2020 年 464,550 km²（2.68 倍）；台灣 495 → 1,316 km²（2.66 倍，人均 55 m²）；倍數最高是史瓦帝尼 9.5、肯亞 8.7、衣索比亞 8.6，中國 4.9、印度 4.6、美國 1.9、日本 1.6；人均最高是安圭拉 307 m² 這類小島，大國是澳洲 199、美國 179。
123. **女性科學家與 STEM**（性別平等主題的擴充，2026-10-29，製作手冊第五批 39；`pipeline/topics/gender.py` 的 `build_science()`、`src/topics/gender.ts`）：
    - **使用者決定**：兩個指標都做、放「性別平等」：STEM 畢業生的女性比例（世界銀行轉載，CC BY 4.0）、女性研究人員比例（UNESCO UIS，CC BY-SA 4.0，資料檔也用 CC BY-SA）；台灣只放研究人員比例（國科會），STEM 畢業生台灣留白並寫原因（教育部的科系分類沒有對到 ISCED-F，指標的 `noValue` 寫「沒有可比的資料」，原因寫在說明裡；長的 noValue 會把側欄的卡片撐得很大）。
    - **做法**：兩個都隔幾年才有資料，用 5 年內最近一年（`latestWithin`）。荷屬聖馬丁的 STEM 畢業生只有個位數、比例 100%，不收。研究人員是人數（HC），不是全時約當（FTE）；國科會兩種都有，用人數跟 UIS 一致。`build_science()` 可以單獨跑，不用重抓其他指標的來源。
    - **結果**（2015 年後最新一年）：STEM 畢業生 141 國，南韓約 28%、德國 29%、美國 38%，薩摩亞 67%、緬甸 61% 最高；女性研究人員 129 國＋台灣，查德 3.4% 最低、緬甸 76.5% 最高，日本 18.5%、南韓 23.7%、德國 29.6%；美國、中國、印度沒有資料。台灣 2024 年 23.9%（研究人員 224,317 人，女性 53,662 人），1999 年 19.8%。
124. **產假與育嬰假**（性別平等主題的擴充，2026-10-29，製作手冊第五批 40；`pipeline/topics/gender.py` 的 `build_leave()`、`src/topics/gender.ts`、`GenderPanel.tsx`）：
    - **使用者決定**：世界銀行 WBL 的產假、陪產假、育嬰假天數三個指標，時間軸用 1971–2024 的歷史面板（WBL 1.0，同一套方法）；2026 年版（WBL 2.0）的值放附註；OECD 的全薪等值週數放側欄。
    - **做法**：歷史面板的 Parenthood 工作表：「Length of paid maternity leave」「Length of paid paternity leave」，育嬰假是「Shared days」「Days for the mother」「Days for the father」加起來（全家合計）。年份是 WBL 的報告年（法律是前一年 10 月 1 日的）；WBL 只看最大商業城市的法律（美國是紐約、洛杉磯，所以育嬰假有紐約州的有薪家庭照顧假）。瑞典、挪威這類把產假併進育嬰假的國家產假是 0，說明寫明要一起看育嬰假。
    - **附註**：WBL 2026 年版（「母親、父親可請的有薪假合計」，含育嬰假，跟 1.0 的天數接不起來）與 OECD PF2.1（2025 年 4 月的制度，43 國，母親可請的有薪假合計與父親專屬的週數、全薪等值週數）寫在 `leave-detail.json`，側欄的 `GenderPanel` 只在這三個指標顯示，另外列出育嬰假母親、父親、共用各幾天。189 國的附註不放進三個指標檔（每個檔會從 22 KB 變成 97 KB）。
    - **結果**（2024 年報告）：產假台灣 56 天、日本 98、印度 182、保加利亞 410 最長，美國等 11 國 0 天；陪產假 75 國 0 天，台灣 7、日本 28、西班牙 112、斯洛伐克 196；育嬰假 135 國沒有，台灣父母各 180 天（合計 360）、日本 674、白俄羅斯與蒙古 1,095。WBL 2026 的台灣：母親合計 236 天、父親 189 天。
125. **國家公園**（新主題，地理類，排在世界遺產後面，2026-10-29，製作手冊第五批 41；`pipeline/topics/national_parks.py`、`src/topics/national-parks.ts`、`NationalParksPanel.tsx`）：
    - **使用者決定**：新主題（地理）：Wikidata 國家公園的點（依設立年份累積出現）＋世界銀行 WDI 的各國陸域保護區占國土比例；範圍的面（OSM）不做。
    - **資料**：Wikidata 的國家公園（Q46169 與子類別）有座標的 3,457 處，有廢止日期的 24 處、沒有英文（含多語言標籤）與中文名稱的 66 處不收，剩 3,367 處。設立年份用 P571，只收 1872（黃石）–2026 年的：更早的是古蹟、堡壘本身的年代（庫姆蘭寫西元前 103 年、Fort Stevens 寫 1861 年），有 7 處；跟沒有年份的共 425 處放在「設立年份不詳」的圖層，**預設關閉**（一直畫的話，1950 年的地圖上年份不詳的比已設立的 314 處還多）。P571 偶爾也不是設立年份（荷蘭的 Weerribben-Wieden 寫 1882 年），沒有逐一核對。
    - **IUCN 類別**（P814）：第 II 類（國家公園）2,510、其他類別 287、沒標 570；第 II 類的 QID 是 Q14545628（Q14545608 是 Ia，第一次寫錯過）。各國叫「國家公園」的意思不同，說明寫明。
    - **國家**依座標（`geoindex.countries_at`）。台灣 9 座都有、都有年份（墾丁 1984 到澎湖南方四島 2014）；壽山國家自然公園不在這一類。
    - **陸域保護區**：WDI 213 國、2013–2025 年，塞席爾 68.1%、新喀里多尼亞 59.6%、委內瑞拉 56.8%、不丹 51.6%，世界 16.5%；沒有台灣。
126. **各國最常見的癌症**（疾病主題的擴充，2026-10-29，製作手冊第五批 44；`pipeline/topics/disease.py` 的 `build_cancer_sites()`、`src/topics/disease.ts`）：
    - **使用者決定**：地圖畫 WHO GHE 的「死亡最多的癌症」，加男女切換；台灣用衛福部死因統計（同樣是死亡）畫在地圖上，國健署癌症登記的發生數放附註。
    - **做法**：GHE 2000–2023 年每年一次查第三層（FLAG_LEVEL 3、代碼 611–799，三個性別），各國死亡數最多的部位，不算 780「其他惡性腫瘤」（不排除的話 2023 年有 21 國第一名是它）。台灣的 ICD-10 碼依 GHE 的對照歸到同樣的部位（`CANCER_ICD10`：肺 C33–C34、肝 C22、大腸直腸 C18–C21…），2008 年起。類別圖取三個子項目、24 年出現過最多的 8 類（肺、乳、子宮頸、攝護腺、肝、胃、大腸直腸、食道），白血病、口腔癌等併成「其他」（合計不到 3%）。
    - **結果**（2023 年）：兩性肺癌 80 國、乳癌 32、子宮頸癌 18、肝癌 17、攝護腺癌 14、胃癌 11、大腸直腸癌 10，印度是口腔癌；男性肺癌 83、攝護腺癌 67；女性乳癌 118、子宮頸癌 34、肺癌 22（台灣女性也是肺癌）。
127. **孕產婦死亡率**（健康主題的擴充，2026-10-29，製作手冊第五批 45；`pipeline/topics/health.py` 的 `build_maternal()`、`sources/ris_marriage.py` 的 `births()`、`src/topics/health.ts`）：
    - **資料**：世界銀行 WDI 的 SH.STA.MMRT（WHO、UNICEF、UNFPA、世界銀行、聯合國人口司的 MMEIG 模型估計，CC BY 4.0，已記），1985–2023 年 195 國，數值是整數。
    - **台灣**（使用者決定：自己算、附註寫明）：依 WHO 的定義（懷孕期間或產後 42 天內、排除意外），衛福部死因統計 ICD-10 的 O00–O99 去掉 O96（晚期孕產死亡）、O97（後遺症），加上 A34（產科破傷風），除以戶政司的出生數（按登記，y2s2 同一張表），2008 年起。2023 年 8.9（12 人）、2019 年 15.2（27 人）；2024、2025 年寫在附註（死因統計比 WDI 新）。WHO 的是模型估計、會補報告不全的部分，附註寫明兩者不完全可比。
    - **順手修正**：健康平均餘命（第 114 點）台灣兩性合計的 `noValue` 太長，側欄的卡片被撐得很大，縮成「只有男女分開的（見女性、男性）」，原因原本就寫在指標說明裡（性別平等的 STEM 畢業生同樣處理，第 123 點）。
128. **纜車與索道**（新主題，科技與交通類，排在交通後面，2026-10-29，製作手冊第五批 43；`pipeline/topics/cable_cars.py`、`src/topics/cable-cars.ts`、`CableCarsPanel.tsx`）：
    - **使用者決定**：不畫滑雪場的吊椅，只畫空中纜車、吊廂纜車與登山纜索鐵道。
    - **類別**：先查空中索道（Q13409250）與纜索鐵道（Q142031）的子類別，再用 VALUES 查各類別的項目（一次查 P279* 加項目，Wikidata 故障時一直逾時）。收：往復式（aerial tramway）、各種吊廂（單線、雙線、三線、Funitel、Funifor、脈動式、可脫離式、都市的纜車路線、吊廂與吊椅混合的）、沒有細分的空中索道、纜索鐵道（含水力的）。不收：吊椅（含可脫離式）、滑索、貨運與軍用索道、斗式索道、雪橇纜索、車廂、MiniMetro（`SKIP`）。
    - **年份**：開通年份依序用 P1619（正式啟用）、P729（啟用）、P571（成立），1850–2026 年以外的當成不詳；停用（P730、P576）有年份的畫到那一年為止（`endField`）。貓空纜車在 Wikidata 只有成立 2006 年，依臺北大眾捷運公司改成通車的 2007 年（`HAND_YEAR`）。沒有年份的 391 條放在另一個圖層，預設關閉（同國家公園）。
    - **名稱**：沒有英文標籤的用多語言標籤或其他語言的名稱（`wikidata_attractions.fallback_names`，第一次沒補的時候 170 條沒有名稱）。
    - **結果**：1,003 條（往復式 250、吊廂 440、纜索鐵道 313），有年份 612 條；奧地利 153、法國 132、瑞士 104、日本 85、義大利與德國 81。最早的是 1864 年匹茲堡的 Castle Shannon Plane。台灣只有貓空纜車與烏來空中纜車：日月潭纜車、北投空中纜車在 Wikidata 沒有座標，沒有畫，說明寫明。
129. **外籍勞工占勞動力**（移民與難民主題的擴充，2026-10-29，製作手冊第五批 46；`pipeline/topics/migration.py` 的 `build_foreign_workers()`、`src/topics/migration.ts`）：
    - **使用者決定**：依出生地（ILOSTAT 的 EAP_TEAP_SEX_AGE_CBR_NB_A，15 歲以上，外國出生 ÷ 合計），併進「移民與難民」；台灣用勞動部產業及社福移工數 ÷（主計總處的勞動力＋移工）自己算，附註寫明勞動力不含移工的假設。依國籍的資料集沒有用（賴索托 100% 是錯的，日本這類國家依國籍很低）。
    - **做法**：各國隔幾年才有資料，用 5 年內最近一年（`latestWithin`），2002–2025 年。勞動部的資料只有最新一年（114 年各縣市×國籍），所以台灣只有 2025 年：866,275 ÷（12,028,000＋866,275）＝ 6.7%；附註寫明只算移工、不含新住民等其他外國出生的人，跟其他國家依出生地的定義不同。
    - **結果**：123 國＋台灣；盧森堡 61.1%、蒙哲臘 49.4%、帛琉 47.6%、阿聯 42.7%、馬爾他 42.4% 最高；沙烏地、卡達沒有依出生地的資料，科威特、巴林只到 2010–2011 年（超過 5 年，地圖上留白）。
130. **收入有多少花在吃**（物價與財政主題的擴充，2026-10-29，製作手冊第五批 47；`pipeline/topics/fiscal.py` 的 `build_food_share()`、`src/topics/fiscal.ts`）：
    - **使用者決定**：用世界銀行 ICP 2021（2017、2021 兩期，有台灣），USDA ERS 不用；放「物價與財政」（規劃時建議的是「飲食」）。
    - **做法**：品項 1101000（食物與非酒精飲料），分類 AICZS（占個人實際消費 AIC 的比例）。分母含政府提供的醫療、教育，比只算家庭支出的比例低（台灣 2021 年 ICP 12.2%、ERS 13.3%），說明寫明。只有兩期，時間軸只有 2017、2021。
    - **結果**（2021 年）：172 國，南蘇丹 83.8%、安哥拉 66.2%、尼泊爾 58.6% 最高，美國 6.2%、愛爾蘭 6.4%、塞席爾 6.7% 最低；台灣 12.2%（第 137 名）。
131. **家庭負債**（存款與財產主題的擴充，2026-10-29，製作手冊第五批 48；`pipeline/topics/wealth.py` 的 `build_household_debt()`、`src/topics/wealth.ts`）：
    - **使用者決定**：只用 BIS 加台灣央行的家庭借款，不用 IMF。
    - **做法**：BIS 的家庭與非營利團體從所有部門借的信用（市值、經斷層調整、占 GDP）是季資料，取每年第 4 季，1980–2025 年；4T、5A、XM 這類合計不收。台灣用央行的「家庭借款／GDP」（2002 年起，年資料），附註寫明口徑接近但不完全相同。
    - **結果**（2025 年）：瑞士 122.9%、澳洲 114.0%、加拿大 100.4%、荷蘭 94.4%、紐西蘭 91.0%，南韓 88.1%、台灣 88.1%、美國 68.1%、日本 60.8%、中國 58.0%，阿根廷 5.7%、土耳其 10.1% 最低。
132. **二手衣去了哪裡**（貿易主題的擴充，2026-10-29，製作手冊第五批 49；`pipeline/topics/trade.py` 的 `build_used_clothing()`、`src/topics/trade.ts`）：
    - **使用者決定**：線寬用金額，只做舊衣（HS 6309），碎布（6310）不做。
    - **做法**：子項目「二手衣」，用 CEPII BACI 的 HS92 版（1995–2024，塑膠污染主題已經在用，Etalab 2.0），流向與出口、進口總額的格式跟其他商品一樣（`_write_item`）。全部商品用的 HS17 版只從 2017 年起，所以這裡另外讀 HS92。`build_used_clothing()` 可以單獨跑，不必重讀 FAOSTAT；單獨跑時 `manifest.json` 的 items 手動補上這一項（`build()` 會自己加）。
    - **結果**（2024 年）：全球約 47.3 億美元；出口美國 17.9%、中國 13.3%、英國 9.3%、德國 7.0%、韓國 4.2%；進口阿聯 5.7%、巴基斯坦 5.5%、瓜地馬拉 4.4%、肯亞 4.3%、烏克蘭 3.3%、迦納 3.2%（阿聯、巴基斯坦是分類與轉口中心，說明寫明）。美國最大的出口對象是瓜地馬拉（24%）。台灣出口約 1,877 萬美元（製作手冊用 Harvard Atlas 查到的是 1,594 萬，來源不同）。
133. **電子垃圾**（新主題，能源類，排在塑膠污染後面，2026-10-29，製作手冊第五批 50；`pipeline/sources/ewaste_monitor.py`、`pipeline/topics/ewaste.py`、`src/topics/ewaste.ts`）：
    - **使用者決定**：照做（Global E-waste Monitor 2024，CC BY-NC-SA 3.0 IGO，資料檔用同一種授權、頁尾寫明），只做 2022 年，從 PDF 附錄抽表。
    - **抽表**：用專案自己的 `sources/pdfreader.py`（不必裝 pdftotext）讀附錄 2 各國表（第 122–136 頁）的文字片段，依每頁表頭「REGION」的位置平移欄位界線（左右頁的邊界差一點），表頭與頁首頁尾（y ≥ 490 或 ≤ 40）不算；國名換行的接回去（斷字的連字號後面接小寫的去掉，「Guinea-Bissau」這類保留）。數字用逗號當小數點、沒有千分位。讀到 193 國，跟報告的世界合計國數相同；國名對不到 ISO3 就停下來（`NAMES` 補了香港、澳門、北馬其頓等）。
    - **指標**：每人（公斤）、產生量（公噸，百萬公斤 × 1,000）、正式回收量、正式回收比例（回收 ÷ 產生）。只有 84 國申報回收量，其他留白並寫「沒有申報正式回收量」。世界產生 61,917 百萬公斤、回收 13,836（22.3%），跟報告的 61,908、13,807 只差四捨五入。報告裡的法規、生產者延伸責任欄位沒有用：台灣的資源回收四合一制度寫成沒有，跟事實不符。
    - **結果**：每人最多挪威 26.8、英國 24.5、瑞士 23.4 公斤，最少尼日、馬拉威、索馬利亞 0.5；台灣 19.4 公斤、產生 46.3 萬公噸、正式回收 31.4%；回收率最高保加利亞 83.9%、波蘭 80.8%、奧地利 76.1%。
134. **航空旅客量**（交通主題的擴充，2026-10-29，製作手冊第五批 51；`pipeline/topics/transport.py` 的 `build_air_passengers`、`pipeline/sources/caa.py`、`src/topics/transport.ts`）：
    - **使用者決定**：總人次（比例圓）與每人搭機次數兩個都做；台灣用民航局的機場旅客數放附註，地圖上留白（口徑不同）。
    - **資料**：WDI IS.AIR.PSGR 是各國註冊的航空公司一年載運的旅客（國內線加國際線，一趟轉機算兩次），185 國，1970–2023 年（149 國到 2023 年）。每人搭機次數 = 旅客 ÷ WPP 2024 的年中人口；世界的值用 WDI 的世界合計 ÷ WPP 的世界人口（2023 年 42.7 億人次、每人 0.53 次）。
    - **口徑**：算在航空公司的註冊國，不是機場所在的國家或乘客的國籍：愛爾蘭每人 37 次（瑞安航空）、匈牙利 5.7 次（威茲航空），卡達、阿聯、新加坡這類轉機樞紐也高。這些寫在主題附註與指標說明裡，沒有另外調整。
    - **台灣**：WDI 沒有台灣。民航局的檔（索引 CSV 指向每月更新的最新檔，副檔名 .csv、內容是 ODS，用 `sources/moe._sheet_rows` 讀）表 5 有 1952 年起各機場的旅客（2016 年以前每五年一列），只取全年的：2025 年 6,889 萬人次（國際 5,231 萬、兩岸 580 萬、國內 1,056 萬），2019 年 7,216 萬。機場旅客是入境、出境與過境，國內線在起降兩端各算一次，跟國籍航空公司的載客不同，所以只寫在台灣的附註（指標檔的 `notes`），兩個指標的 `noValue` 寫「沒有（見附註）」。
    - **圖層**：鐵路圖層加上 `indicators`，航空旅客的兩個指標不畫鐵路與機場。
135. **有機農業**（農業主題的擴充，2026-10-29，製作手冊第五批 53；`pipeline/topics/agriculture.py` 的 `build_organic`、`src/topics/agriculture.ts`）：
    - **使用者決定**：先確認 FAOSTAT 有機面積（來自 FiBL）的授權，確認不了就不做。確認的經過見第 8 節第 12 點：RL 的中繼資料寫整個資料集 CC BY 4.0，沒有第三方限制。
    - **資料**：FAOSTAT 土地利用（RL，批次檔 2.9 MB，網站已在用）的品項 6671「Agriculture area under organic agric.」（含轉型期，比 6672「certified organic」多），元素 5110 面積（千公頃，乘 1,000 成公頃）與 7208 占農地的比例（%），2004–2024 年，176 國。世界的值用 FAOSTAT 自己的 World（2024 年 9,910 萬公頃、2.11%）。
    - **指標**：有機農地的比例（面量圖，預設 2024 年）、有機農地面積（比例圓）。兩個都不分農產品，選農產品的下拉選單不影響。
    - **陷阱**：澳洲 5,302 萬公頃占全球一半以上，多是內陸的粗放牧場，所以比例排在前面。薩摩亞 86% 明顯偏高（手冊也標「可疑」），照 FAOSTAT 的值畫，說明裡寫可能是有機面積與農地面積的口徑不同。
    - **結果**：比例最高列支敦斯登 30.4%、奧地利 27.1%、希臘 22.7%、愛沙尼亞 22.6%；台灣 2.03 萬公頃、2.61%（2010 年 3,000 公頃）。
136. **人均能源消費**（石油、天然氣與煤主題的擴充，2026-10-29，製作手冊第五批 54；`pipeline/topics/fossil_fuels.py` 的 `build_energy`、`src/topics/fossil-fuels.ts`）：
    - **使用者決定**：放「石油、天然氣與煤」，單位用 GJ。
    - **資料**：EIA International Energy Statistics（公有領域，已記；同一個 INTL.zip）的初級能源消費總量（44-2，千兆 Btu × 1.055056 = 艾焦耳），1980–2024 年，220 個國家或地點（蘇聯等畫在當時首都的地點、1991 年以前東西德加總，跟主題其他指標相同）。
    - **人均用 WPP 人口**：手冊寫的是 EIA 自己的人均（47-33，百萬 Btu/人），但主題其他人均指標都是「消費量 ÷ UN WPP 2024 的年中人口」，這裡也一樣，才能跟分燃料的人均比；2024 年 192 國兩種算法多數相差 5% 以內（賽普勒斯差 28%，WPP 含北部；摩爾多瓦 14%），台灣兩種都是 208.6 GJ。冰島、千里達 2024 年 EIA 的人均是 NA、總量有值，這樣算也有值。蘇聯等地點的人口是繼承國加總。
    - **指標**：人均能源消費（全部能源，GJ/人，面量圖，跟世界比）、能源消費總量（全部能源，艾焦耳，比例圓）。不分燃料：選燃料的下拉選單不影響；GEM 的疊加圖層加上 `indicators: FUEL_INDICATORS`（檔名有 `{item}` 的指標），這兩個指標不畫管線與油氣田。
    - **結果**：2024 年世界 639 EJ、每人 78 GJ；卡達 808、新加坡 685、巴林 547、阿聯 480 GJ；美國 289、台灣 209、日本 134、中國 127、印度 27 GJ。直布羅陀 5,419 GJ、福克蘭群島 513 GJ（人口少、賣船用燃料），照 EIA 的值畫，說明裡寫明。
137. **各國的航空公司**（新主題，科技與交通類，排在交通後面，2026-10-29，製作手冊第五批 57；`pipeline/topics/airlines.py`、`src/topics/airlines.ts`、`src/topics/panels/AirlinesPanel.tsx`）：
    - **使用者決定**：地圖預設只算營運中的航空公司（2026 年），停業的放時間軸（每一年算那一年營運中的）。
    - **收哪些**：一次 SPARQL 查「直接標成航空公司或客運子類別（低成本、國家、區域、包機、客運、補充、空中接駁）」與「有 IATA（P229）或 ICAO（P230）航空公司代碼」的聯集。有代碼但只標成一般公司的也收（台灣虎航在 Wikidata 只標成「組織」），有代碼的鐵路公司、軍隊、政府機關、航空聯盟、租賃公司不收；只標成貨運、直升機、虛擬航空公司的不收。
    - **營運中**：沒有停業日期（P576）、也有 IATA 或 ICAO 代碼才算；沒有代碼的多半是還沒開航（玉山、海力）、很小、或早就停業但沒寫日期的。標成「已不存在的實體」這類的不算。停業的不必有代碼，依成立到停業的前一年算；有停業但沒有成立年份的（133 家）不算。成立年份不詳的營運中航空公司（240 家）只算在 2026 年（跟地鐵站開通日期不明的一樣），所以 2026 年比 2025 年多。
    - **國家**：P17，兩國以上的每國都算。荷蘭的國家項目（Q55）2026-10 沒有 ISO 代碼（P297），KLM、Transavia、Martinair 等 40 家原本都對不到國家，`COUNTRY_FIX` 手動對到荷蘭；沒有 P17 的用總部所在地（P159）的國家；蘇聯、捷克斯洛伐克、1949 年以前的中華民國等已經不存在的國家沒有 ISO 代碼，不收（75 家）。
    - **手動修正**：威航（V Air）在 Wikidata 沒有停業日期，照英文維基百科（2016 年 10 月 1 日停止營運）改成 2016 年（`HAND_END`）。荷蘭亞洲航空（KLM Asia）是荷蘭航空在台灣登記的子公司，Wikidata 的國家是荷蘭與台灣，照算。
    - **結果**：4,411 家；2026 年營運中 1,787 家（美國 173、俄羅斯 75、加拿大 68、中國 65、德國 54、英國 53），1919 年 23 家、1950 年 315 家、2006 年最多 1,932 家（之後減少有一部分是 Wikidata 對新航空公司收錄較少）。台灣營運中 8 家（中華、立榮、長榮、華信、德安、荷蘭亞洲、台灣虎航、星宇），1995 年 17 家最多。
138. **運河與海峽**（航運與港口主題的疊加圖層，2026-10-29，製作手冊第五批 55；`pipeline/sources/portwatch.py`、`pipeline/topics/waterways.py`、`src/topics/shipping.ts` 的 `CHOKEPOINTS`、`WATERWAYS`）：
    - **使用者決定**：畫 IMF PortWatch 的航運咽喉點加年度通過數；運河、海峽只畫有英文維基條目的；不做每天通過數的時間軸。
    - **航運咽喉**：PortWatch 的 ArcGIS FeatureServer。28 個點（PortWatch_chokepoints_database）；每天的通過數（Daily_Chokepoints_Data，2019-01-01 起，79,940 列）不支援統計查詢（outStatistics 回 400），所以分頁讀全部（每頁 1,000 列、只取需要的欄位，每頁各自快取）。分頁一定要 `orderByFields`，而且要寫「ObjectId」，寫「ObjectId ASC」回 400。伺服器很不穩，同一個查詢約一半回 400（「Invalid URL」「Invalid query parameters」），每頁重試到 15 次（等 5–30 秒），全部 80 頁下載了約一小時。每天的貨船數（貨櫃、乾散貨、雜貨、滾裝、油輪五類，同一艘船 48 小時內不重複算）加總成整年，只收整年都有資料的年份（2019–2025）。咽喉的資料庫自己的 vessel_count_total 期間沒寫，不用。
    - **結果**：2025 年台灣海峽 87,175 艘次最多，其次麻六甲 85,588、朝鮮海峽 80,069、多佛 63,782、渤海海峽 62,196；蘇伊士運河 2023 年 26,895、2025 年 14,070（紅海危機後繞行），好望角 2023 年 17,926、2025 年 32,653；巴拿馬運河 11,360。點的大小是最近一整年的通過數，tooltip 寫各類船與 2019 年的數字。中文名照 PortWatch 的編號手寫（`CHOKEPOINT_ZH`），多了新的咽喉會停下來。
    - **運河與海峽**：Wikidata 直接標成運河（Q12284）、通航運河（Q949819）或海峽（Q37901）、有座標也有英文維基百科條目的：運河 853 條、海峽 630 個。英文名用英文維基條目的標題；中文名用 zh-tw／zh-hant 標籤，沒有的用 zh 轉繁體。點的大小與縮小時畫不畫依維基百科條目數（世界全圖 30 個以上，3 級 10 個以上，5 級全部）。標成運河的也有灌溉渠（台灣有嘉南大圳、臺南運河、前鎮河），海峽有台灣海峽、澎湖水道。國家依座標判斷，在海上的不寫國家。
139. **機車大國**（交通安全主題的擴充，2026-10-29，製作手冊第五批 58；`pipeline/topics/road_safety.py` 的 `build_motorcycles`、`pipeline/sources/who_road.py` 的 `gsrrs_2023_motorcycles`、`src/topics/road-safety.ts`）：
    - **使用者決定**：台灣用交通部統計查詢網表 101 的機動車輛登記數自己算每千人機車數；WHO 的檔照「交通安全」主題的 CC BY-NC-SA 3.0 IGO 寫法。
    - **資料**：GSRRS 2023 指標檔的 CP_39（二、三輪機動車，含三輪車）、CP_36a（登記車輛總數）、CP_118（年份，2020 或 2021）。每千人用 WPP 2024 那一年的人口（手冊用檔裡的人口 CP_3，這裡跟主題其他指標一致用 WPP）。105 國有機車數；菲律賓、喬治亞、賽普勒斯、查德、南蘇丹的機車比車輛總數還多（單位填錯），兩個指標都不用；印度、日本、馬來西亞沒有填。台灣是表 101 的年底「機車」（含重型、輕型）÷ WPP 年中人口，比例是 ÷ 表 101 的「總計」，2012–2025 每年都有。
    - **指標**：每千人機車數、機車占機動車輛的比例（都是面量圖，latestWithin 5 年，跟其他占比一樣）；台灣的附註寫年底登記數與算法。
    - **結果**：每千人越南 709、台灣 635（2025 年；2023 年 624，第 2 名）、印尼 439、泰國 305、斯里蘭卡 265、荷蘭 184（含輕型機車）；比例越南 93%、馬爾地夫 87%、印尼 83%、緬甸 83%，台灣 63%。
140. **各國的特色食物**（新主題，社會類，排在飲食後面，2026-10-29，製作手冊第五批 60；`pipeline/topics/foods.py`、`src/topics/foods.ts`、`src/topics/panels/FoodsPanel.tsx`）：
    - **使用者決定**：候選 309（乳酪與麵包）、310（甜點）合成一個主題，三個子項目；不做國家排名，重點放在側欄的清單。
    - **資料**：Wikidata 裡乳酪（Q10943）、麵包（Q7802）、甜點（Q182940）的實例或（間接）子類別、有原產國（P495）的，每類一次 SPARQL（`P31 ∪ P279+`，兩種寫法合併去重；甜點的查詢第一次回應被截斷，重跑就好）。原產國用 P297 對到 ISO；荷蘭（Q55）2026-10 沒有 P297，跟航空公司一樣手動對（`COUNTRY_FIX`）；蘇聯、奧匈帝國這類已經不存在的國家不收。中文名用 zh-tw／zh-hant 標籤，沒有的用 zh 轉繁體，拿掉結尾括號裡的說明。
    - **陷阱**：數量是 Wikidata 編者收錄的多寡（法國的乳酪、義大利的甜點特別多，德國的麵包只有 24 種），所以指標 `unranked`、不畫排名長條與側欄折線，主題附註寫明；不分年份（`timeless`）。分類錯的拿掉：台灣的筒仔米糕（Q7215544）被標成甜點（`EXCLUDE`）；菜尾湯被標成糖果點心，不在這三類裡。
    - **結果**：乳酪 1,285 種、68 國（法國 424、義大利 265、西班牙 78、英國 74、瑞士 44）；麵包 677 種、108 國（義大利 78、美國與西班牙 45、法國 30、日本 28）；甜點 1,155 種、91 國（義大利 301、西班牙 140、美國 81、印尼 55）。台灣：麵包有太陽餅、兩相好，甜點有兩相好、芋圓、芒果冰、澎湖鹹餅、芋泥、牛搵水，乳酪沒有。
141. **語系的分布**（語言主題的擴充，2026-10-29，製作手冊第五批 62；`pipeline/topics/language.py` 的 `build_families`、`src/topics/language.ts` 的 `FAMILIES`、`LANGUAGE_POINTS`）：
    - **使用者決定**：國家的值用「依使用人口的主要語系」（接網站已有的 CLDR 使用比例）。
    - **主要語系**：每國 CLDR 各語言的比例（台灣用普查：國語、閩南語、客語算漢藏，原住民族語算南島）依 Glottolog 最上層的語系加總，取最大的。CLDR 的代碼先照網站原本的方式換成 ISO 639-3；Glottolog 把塞爾維亞、克羅埃西亞、波士尼亞語合成一種（hbs）、挪威語不分書面語，這幾個手動對（`ISO_FIX`），剩下對不到的只有幾種小語言。代碼 1–16 是 16 個當過某國主要語系的語系（`FAMILIES`），前 8 個（印歐 163 國、亞非 28、大西洋－剛果 18、南島 14、漢藏 6、突厥 5、曼德 3、南亞 2）上色，其他（朝鮮、壯侗、卡特維爾、愛斯基摩－阿留申、烏拉、日本、蒙古、尼羅）是「其他語系」、tooltip 寫名稱；出現新的主要語系時 pipeline 會停下來。
    - **陷阱**：CLDR 的比例含第二語言，奈及利亞、喀麥隆、象牙海岸、巴布亞紐幾內亞的英語或法語加起來比當地語系多，主要語系變成印歐語系；愛沙尼亞（英語、俄語）也是。說明裡寫明，沒有調整。
    - **語言的點**：Glottolog 現存的口語、手語、皮欽語、混合語、有座標的 6,943 種（座標是 Glottolog 的代表位置），依上面 8 個語系上色，其他語系與孤立語灰色；中文名用 CLDR 的繁中名稱（有 ISO 代碼對得到的才有），其他寫英文。只在主要語系與語言數兩個指標畫。
142. **最古老的公司**（新主題，經濟類，排在便利商店與連鎖品牌後面，2026-10-29，製作手冊第五批 63；`pipeline/sources/wiki_oldest_companies.py`、`pipeline/topics/oldest_companies.py`、`src/topics/oldest-companies.ts`、`src/topics/oldest-companies-fields.ts`、`src/topics/panels/OldestCompaniesPanel.tsx`）：
    - **使用者決定**：以英文維基「List of oldest companies」為主（CC BY-SA，資料檔用 CC BY-SA，固定 revid），Wikidata 補座標；台灣的 19 世紀老店放附註。
    - **讀表**：MediaWiki API 的 `action=parse&oldid=…&prop=wikitext`（`index.php?action=raw` 與 API 都偶爾回 429，下載一次就快取）。六個表（「Founded before 1300」到「1650 to 1699」），其中「1500 to 1599」的表頭寫成 `{|class=`（沒有空格），要一起抓；每列 Year、Company、Current location、Field，年份取第一個數字（「1655-1658」取 1655），國家取所在地的最後一段。1,022 家、32 國（日本 531、德國 187、奧地利 47、英國 44、瑞士 40、義大利 33）。
    - **座標**：表格的公司連結（992 家有）用 Wikidata SPARQL 依英文條目標題查（每批 150 個），依序用公司本身（P625）、總部（P159）、所在行政區（P131）的座標，有座標的 242 家；座標所在國跟表格的國家不同的（Stora Enso 的總部在芬蘭）不畫點。中文名用 Wikidata 的繁中標籤，中英夾雜的（「千年之湯 古Man」）不用。
    - **指標**：1700 年以前成立的公司（比例圓），時間軸是成立年份 578–1699（`timeAxis`「成立年份」），值是這一年以前成立、還在營業的家數（累積），點也累積出現。側欄列出全部（含沒有座標的）公司，產業的中文對照只在中文介面用（`oldest-companies-fields.ts`，`i18n-ignore-file`）。
    - **台灣**：表裡沒有，`noValue` 寫「沒有（見附註）」；附註寫還在營業的老店郭元益（1867）、玉珍齋（1877）。
143. **雲端機房的區域**（新主題，科技與交通類，排在海底電纜後面，2026-10-29，製作手冊第五批 59；`pipeline/sources/cloud_regions.py`、`pipeline/topics/cloud_regions.py`、`src/topics/cloud-regions.ts`、`src/topics/panels/CloudRegionsPanel.tsx`）：
    - **使用者決定**：只做 AWS、Google、Azure 三家，區域清單手工整理成事實表（不爬 AWS 的網站）。
    - **事實表**：交給一個子代理查證整理（約 160 次查詢），141 個 2026-10-29 已經 GA 的區域：AWS 37（官方說 39 個，扣掉 GovCloud 2 個）、Google 43（Compute Engine 區域表）、Azure 61（Learn 清單 57 個 GA 加中國 4 個）。每列有代碼、顯示名稱、城市、ISO3、座標（城市的，不是機房）、GA 年份與出處；12 列標「待確認」（AWS 歐洲主權雲的顯示名稱與座標、AWS UAE 的城市、AWS 馬來西亞與泰國的城市、Google europe-west1 的年份、Azure Brazil Southeast 的年份、East US／East US 2／West US 的城市、Israel Central 的城市、China North 3／East 3 的年份），照註解畫。不收：美國政府專用、邊緣節點、Google cloud.json 有但區域表沒有的代碼；Azure 第一代的 China North／East 2026-07 已退役。中國境內的（AWS 光環新網、西云數據，Azure 世紀互聯）與限制存取的照收、說明裡註明。
    - **跟手冊不同**：手冊寫台灣三家都有，但 Azure 的 Taiwan North（台北）2026-10 在 Microsoft Learn 還標 preview、只開放挑選的客戶（中央社 2026-09-01 的專訪），所以沒有算進 GA 的區域；預覽中的 Taiwan North 與 Southeast Asia 3（柔佛）另一個灰色圖層，不算進區域數。台灣的 GA 區域是 Google asia-east1（彰化，2014）與 AWS ap-east-2（台北，2025）。
    - **畫法**：點在業者寫的城市，同城市好幾家的依業者把經度錯開 ±0.12°；依 GA 年份累積出現。國家的值是三家合計的區域數（2006 年 AWS 維吉尼亞起），2026 年美國 22、印度與澳洲 8、日本、德國、中國、加拿大 6。顏色：AWS 琥珀、Google 青綠、Azure 粉紅（比例圓是紫色，Azure 用淡紫會分不出來）。
144. **低於海平面的地方與地形區**（海拔主題的擴充，2026-10-29，製作手冊第五批 65；`pipeline/topics/landforms.py`、`src/topics/elevation.ts` 的 `LANDFORMS`）：
    - **使用者決定**：候選 367、371 合成海拔的擴充；地形區排除山脈（山脈已經用 GMBA），只放沙漠、高原、盆地、平原、窪地；中文名稱改成台灣用語。
    - **低於海平面**：`profiles.json` 的第一段（0 m 以下）就是占比，直接寫成 `below-sea.json`；沒有的國家寫 null，`missing` 寫「沒有低於海平面的土地」，地圖只畫有的 52 國（亞塞拜然 17.8%、巴勒斯坦 15.0%、荷蘭 12.4%）。說明寫明 1 公里網格把圩田平均掉（荷蘭常說約四分之一）。地形圖上另外標出低於 0 m 的陸地沒有做（Terrain Tiles 含海底，要陸地遮罩）。
    - **地形區**：Natural Earth 的 FEATURECLA 是 Desert、Plateau、Basin、Depression、Plain、Lowland 的 175 個面（沙漠 57、高原 72、盆地與窪地 11、平原與低地 35），旁遮普（歸在沙漠）拿掉。畫法跟山脈一樣：線圖層的 fill（面也滑得到）加 polylabel 的名稱點；名稱點依 SCALERANK 篩選（`ns`＝−SCALERANK，世界全圖只標 3 以下）。顏色：沙漠琥珀、高原紫、盆地與窪地青綠、平原與低地綠。放在新的指標「沙漠、高原與平原」（底圖是地形），不疊在地形與山區比例上，免得跟山脈擠在一起。
    - **中文名稱**：NAME_ZHT 用 OpenCC s2twp 轉台灣用語，錯譯、中國大陸的譯名與缺的在 `ZH_FIX` 改（約 60 個：GOBI DESERT 的「大漠」改戈壁沙漠、GANGES PLAIN 的「中央平原」改恆河平原、CASPIAN DEPRESSION 改裏海窪地、PAMPAS 改彭巴草原、ATACAMA 改阿塔卡馬沙漠、Atherton Tableland 補阿瑟頓高原…）；沒有中文名稱時 pipeline 會停下來。
145. **節慶**（新主題，社會類，排在宗教後面，2026-10-29，製作手冊第五批 61；`pipeline/topics/festivals.py`、`src/topics/festivals.ts`、`src/topics/panels/FestivalsPanel.tsx`）：
    - **使用者決定**：主題改名「節慶」（「大型」排不出來）；Wikidata 的點加月份篩選；台灣用文化資產局的民俗補。
    - **Wikidata**：直接標成節慶（Q132241）的與直接子類別的分兩次查（合在一起常逾時；查詢服務限流時每分鐘一次，`_cached` 每次查完等 61 秒），有座標的 1,760 個。種類依子類別的英文標籤分（`KIND_WORDS`）：傳統、宗教與民俗 1,072（含節慶本身）、電影節 634、藝術節 103、美食與飲酒節 62、嘉年華 46、其他 69；音樂節不是節慶的直接子類別，查不到。月份用 P837（每年發生的日子）的英文標籤裡的月份名稱，只有約 40 個有。
    - **台灣**：文資局 272 項民俗裡「儀式、祭典、節慶」類的 226 項。地址只有縣市與鄉鎮市區，用 Wikidata 的鄉鎮市區座標（P17 台灣、名稱結尾是鄉鎮市區、P131 是縣市的項目）；只寫縣市的用那個縣市各鄉鎮市區座標的平均。有舉辦月份的 60 項照月份出現，農曆的月份加一個月當成大約的國曆月份。
    - **畫法**：時間軸是月份（`timeAxis`，預設 2 月）。有月份的 100 個依月份篩選（點比較大），月份不詳的 1,886 個在另一個圖層一直畫（小點，預設開著，不然地圖幾乎是空的）；國家不上色，值是節慶總數（給 tooltip 與排名表，不排名）。側欄列出這國的節慶。
    - **跟手冊不同**：手冊的例子「依舉辦月份篩選」，但 Wikidata 幾乎都沒寫月份，月份篩選實際上只對台灣的民俗與約 40 個 Wikidata 節慶有用，說明寫明。
146. **海外軍事基地**（軍事主題的擴充，2026-10-29，製作手冊第五批 64；`pipeline/sources/wiki_overseas_bases.py`、`pipeline/topics/overseas_bases.py`、`src/topics/military.ts`、`src/topics/panels/MilitaryPanel.tsx`）：
    - **使用者決定**：只做國家層級的流向（派駐國→駐在國），不畫每個基地的點。
    - **資料**：英文維基百科的列表（固定 revid，用 MediaWiki API 讀 wikitext，`action=raw` 常回 429）。每個派駐國一節（美國再分五大洲），一列一個駐在國，國家取國旗模板（`{{flag|Japan}}`、`{{PNG}}`、`{{flagicon image|…}} [[Syria]]`）；俄羅斯的表把國家放在標題格，有爭議的寫兩面國旗加 (disputed)，取第一面（國際承認的國家）；rowspan 的後續列算前一個國家。18 個派駐國、81 個駐在國、120 組：美國 49、俄羅斯 16、英國 13、土耳其 11；吉布地最多（美、法、中、義、日 5 國）。
    - **地區對到地圖的國家**：英國的亞克羅提利與德凱利亞主權基地區畫到賽普勒斯、亞森欣島算聖赫勒拿（`HOST_FIX`）；格陵蘭、阿魯巴、古拉索、英屬印度洋領地地圖上有自己的形狀。
    - **有爭議的照列表畫，寫明**：俄羅斯→烏克蘭（克里米亞）、喬治亞（阿布哈茲與南奧塞提亞）、摩爾多瓦（聶斯特河沿岸）、日本（南千島群島：俄羅斯實際控制，日本主張主權），以色列→敘利亞（戈蘭高地與敘利亞南部），土耳其→賽普勒斯（北賽普勒斯），加上美國在海外領土的基地，說明放在流向檔的 `notes`（`PAIR_NOTES`，表上寫 disputed 但沒有說明的會報錯），tooltip 與側欄寫出來。
    - **畫法**：兩個指標「海外軍事基地」（派駐國在幾國有基地，點國家畫出去的線）、「外國的軍事基地」（幾國在這裡有基地，點國家畫進來的線），共用一個流向檔，每一組的值是 1。通用擴充：`FlowLayer.presence`（只有有沒有：線一樣粗 `FLOW_PRESENCE_WIDTH`、tooltip 只寫「美國在日本有軍事基地」不寫數值與占比、圖例一條線、不寫單位）、`FlowFile.notes`（「起點>終點」→ [中文, 英文]，`flowSelection` 依方向對到夥伴）。沒有值寫「列表上沒有」（`missing`，列表只有 18 個派駐國，不一定真的沒有）。年份是維基百科那個版本的 2026，只有一年。側欄（`MilitaryPanel`，只在這兩個指標）列出兩個方向的國家與說明。
    - **台灣**：不是派駐國，列表上也沒有駐在台灣的外國基地（全文提到 Taiwan 的只有一則引用的標題），附註寫明。
    - **限制**：各國的表寫法不同，長期駐軍、輪駐、租用的港口與機場、訓練設施都算，美國的表最長、其他國家可能漏列（例如法國只列 4 國）；不分基地的大小與駐軍人數。說明寫明。
147. **此刻的月亮**（晝夜與季節的擴充，2026-10-29，製作手冊第五批 66；`src/lib/moon.ts`、`src/topics/daylight.ts` 的 `moon` 指標與 `MOON` 圖層、`src/map/nightLayer.ts` 的 `syncMoon`、`src/topics/panels/DaylightPanel.tsx`）：
    - **使用者決定**：用 Astronomy Engine（MIT）在瀏覽器裡算（第 12 點）。
    - **月下點**用地心的位置（`GeoMoon` 轉到真赤道與春分點，赤經 − 格林威治視恆星時、赤緯）：2026-10-29 12:00 UTC 是 27.75°N、137.51°W，離地心 364,744 km。手冊查證時的 27.41°N、138.26°W、368,938 km 是從經緯度 (0, 0) 的地表看的站心位置（`Equator` 帶了觀測者），月亮很近，差約 0.8°。
    - **看得到月亮的範圍**：地心高度高於 h0 = 0.7275 × 地平視差 − 34′（Meeus 第 15 章，月亮上緣碰到地平線、含大氣折射，約 +0.1°）的地方。地圖上是新的疊加圖層 `MoonOverlayDef`（kind `moon`），跟晝夜同一個 WebGL 自訂圖層（`NightLayer` 改成可以換樣子：`Shade` 是顏色、四道邊界與各自的不透明度）：方向換成月下點的反方向，很淡的一層月光色（淺色底圖偏藍、深色底圖偏白），邊界用兩道相差 0.8° 的邊界一正一負做出一條細環，看得出月出月落的那一圈；月下點是銀灰色的點。位置由主題給（`position`），套件只進晝夜與季節的程式塊。夜色照樣畫（月亮指標也列在晝夜圖層的 indicators）。
    - **指標「月亮」**：國家的值是首都此刻的月亮高度（站心、含大氣折射，`Horizon(…, 'normal')`），不上色、不排名；tooltip 寫首都那一天（當地標準時間 0 時起 24 小時）的月出月落（`SearchRiseSet`，月亮上緣、含視差與折射，不是太陽的 0.833°；一個月裡有一天沒有月出、一天沒有月落，寫「沒有月出」）、月相與亮面、日出日落。
    - **側欄**：此刻的月相（八個：新月、眉月、上弦月、盈凸月、滿月、虧凸月、下弦月、殘月，月相角每 45° 一段，主要月相在中間）、亮面比例與月相角、月出月落、月下點與距離；接下來的四個主要月相（`SearchMoonQuarter`，時間是首都的時鐘）。2026-10-29 20:00（台北）是虧凸月、亮面 85%，台北月出 19:47，下一個下弦 11 月 2 日 04:29，跟手冊查證的一樣。
    - **播放**：沒有另外做「播放一個月」；切到「一年」播放（每一格一天、同一個時刻）就看得到月下點一個月南北擺動一次（2026 年接近 18.6 年週期的最大值，約 ±28°），說明寫明。
    - **效能**：每一刻算 250 個首都的月亮高度約 10 毫秒；主要月相每小時重算一次。
148. **此刻世界的新聞熱點**（新主題，國際類，排在武裝衝突後面，2026-10-29，製作手冊第五批 67；`pipeline/topics/news.py`、`src/topics/news.ts`、`src/topics/panels/NewsPanel.tsx`、`src/lib/unzip.ts`）：
    - **使用者決定**：瀏覽器每 15 分鐘讀 GDELT 最新的檔；事件類型的中文分類自己定；滑過事件顯示原始新聞的連結。
    - **讀資料**：`TopicDefinition.live` 加上 `load`（主題自己讀）：先讀 `lastupdate.txt`（第一行是最新的 `export.CSV.zip`，網址是 http，換成 https），再讀 zip，用瀏覽器內建的 `DecompressionStream('deflate-raw')` 解壓（`src/lib/unzip.ts`，從中央目錄找第一個檔，不加套件），解析 61 欄的 TSV，只留事件發生地（ActionGeo：國家、經緯度、地名、是不是只寫到國家）、CAMEO 根代碼、雙方名稱、新聞網址。每 15 分鐘重讀（跟 GDELT 更新的頻率一樣），一批約 1,100–1,200 個事件、zip 約 80 KB。時刻是檔名的 YYYYMMDDHHMMSS（UTC），當成「這一刻」。
    - **事件的種類**（自己定，CAMEO 的 20 個根代碼併成 6 類）：發言與會談（01 公開聲明、02 呼籲、04 會談）、合作與援助（03 表達合作意願、05 外交合作、06 實質合作、07 援助、08 讓步）、調查要求與批評（09 調查、10 要求、11 不認同、12 拒絕）、威脅與施壓（13 威脅、15 展示武力、16 降低關係、17 強制，含逮捕、制裁）、抗議（14）、攻擊與戰鬥（18 攻擊、19 戰鬥、20 大規模暴力）。顏色：發言與會談最多也最平常，用中性灰；其他五類用類別色（青綠、琥珀、洋紅、紫、深橘），配色驗證工具兩兩比對都通過（對比度不足 3:1 的兩色靠 tooltip 與側欄的文字補）。
    - **畫法**：同一個地點（座標到小數 4 位加地名）的事件併成一個點，大小是事件數，顏色是最多的種類（一樣多時取比較嚴重的）。通用擴充：`PointsOverlayDef.fromLive`（點來自即時資料，不讀資料檔，`app/overlays.ts` 依即時資料快取）、`PanelExtraProps.live`（側欄拿得到即時資料）。tooltip 寫事件數與各種類的數量、國家、地名（英文原文，不翻譯）與最多 3 則新聞的網址（縮短；tooltip 點不到，側欄有可以點的連結）。只寫到國家的新聞（ActionGeo_Type 1）點在 GDELT 給的國家中心，tooltip 寫明。
    - **國家**：事件發生地的國家（ActionGeo_CountryCode，FIPS 10-4：CH 中國、UK 英國、SF 南非、RS 俄羅斯、TW 台灣），用 `fips.json`（pipeline 從 GeoNames 的 countryInfo.txt 產生，251 個；GDELT 用、GeoNames 沒有的 RB 塞爾維亞、GZ 加薩補上，`FIPS_FIX`；TW、CH、UK、SF、RS、NI、KV 每次檢查）換成 ISO。指標「事件數」是面量圖（2、5、10、20、50、100 分級），沒有事件的寫「這 15 分鐘的新聞裡沒有這裡的事件」。
    - **側欄**：這國的事件依地點列出（事件多的在前，最多 30 個地點），每個地點寫事件數、各種類的數量與最多 5 則新聞的連結（網域加網址最後一段的標題字，另開分頁、`rel="noopener noreferrer"`）。
    - **限制**（說明寫明）：機器抽取，同一則新聞常抽出好幾個事件、也會誤判；英語媒體（美、英）最多，美國一批常有 500–600 個事件，台灣常常沒有或只有幾個；只寫國名的新聞落在國家中心。GDELT 只有最新一批，不能選別的時刻；GDELT 讀不到時這個主題沒有資料。手冊提到的 DOC 2.0 API 從 cloud 回 429、GEO 2.0 API 回 404，沒有用。
150. **一年下雨幾天**（氣溫與降雨的擴充，2026-10-30，製作手冊第六批 68；`pipeline/topics/wet_days.py`、`pipeline/sources/cwa_monthly.py`、`pipeline/sources/cru.py`、`src/topics/temperature.ts` 的 `wet-days` 指標）：
    - **使用者決定**：地圖照 CRU 畫；台灣另附中央氣象署測站的值（CRU 的台灣偏高），寫在附註。
    - **資料**：CRU TS 4.10 的 `cru_ts4.10.1901.2025.wet.dat.gz`（232,948,482 bytes），格式跟 tmp、pre 一樣，但**整數的單位是 0.01 天**（tmp、pre 是 0.1）；`cru.DIVISOR` 記下每個變數要除的數。國家平均用 `temperature.country_weights()`（同一組國界權重），一年是 12 個月的雨日加總，1901–2025 年；世界（陸地）2011–2020 年平均 108.8 天。查證的格子（2011–2020 年平均）跟手冊一樣：凱爾蓋朗 322.0、麥覺理島 317.5、卑爾根 294.5、倫敦 149.9、開羅 13.9、秘魯沿海 0、臺北的格子 225.6、高雄 168.8。
    - **wet 怎麼來的**（Harris et al. 2020，讀 Europe PMC 的全文 PMC7125108；nature.com 從 cloud 會轉到登入的 cookie 頁）：wet 是次要變數（表 1：相關衰減距離 450 km、前驅變數 PRE），雨日門檻 ≥ 0.1 mm；雨日觀測之外，用測站的雨量加上 CRU CL 1961–1990 年的雨量與雨日氣候值合成「合成的雨日」，兩者的距平一起內插。所以雨日觀測少的地方是由雨量推算的，指標說明與主題的附註寫明。
    - **台灣**：CRU 全島 2016–2024 年平均 210 天，氣象署 12 個測站（基隆、臺北、新竹、臺中、嘉義、臺南、高雄、恆春、臺東、花蓮、宜蘭、澎湖）同期平均約 121 天，差約 90 天；附註列出每站 2016–2024 年的範圍（臺北 116–188、基隆 166–224、高雄 68–114…），請讀者以氣象署為準。氣象署的資料是開放資料平臺 C-B0026-002 的逐月 XML（2016-01 到 2024-12，33 站；GE01Days 是日雨量 ≥ 0.1 mm 的日數，跟 CRU 同一個門檻），12 個月都有值的年份才算。手冊寫 34 站、高雄到 2021，實際檔案是 33 站、高雄到 2024。
    - **畫法**：分級 [25, 50, 100, 150, 200, 250] 天（2025 年各國的中位數 134、5–95 百分位 22–240）。側欄的每月氣候圖沒有加雨日（維持氣溫、降雨兩張）。
151. **日照時數**（氣溫與降雨的擴充，2026-10-30，製作手冊第六批 69；`pipeline/topics/sunshine.py`、`src/topics/temperature.ts` 的 `sunshine` 指標）：
    - **使用者決定**：放「氣溫與降雨」；寫明是 1961–1990 年的平均。
    - **資料**：CRU CL v2.0（New et al. 2002）的 `grid_10min_sunp.dat.gz`（12,197,635 bytes，566,262 個 10′ 陸地格子，每列緯度、經度加 12 個月的日照百分比，不含南極洲）。
    - **換算成小時**：每個月 = 百分比 × 那個月第 15 天的天文可照時數（太陽中心在地平線上，不含大氣折射；赤緯用 Cooper 1969 的近似）× 天數（2 月 28.25 天），12 個月加總。查證的格子跟手冊一樣或差幾小時：蘇丹與埃及交界 4,028（手冊 4,025）、亞斯文 3,854、尤馬 3,927、倫敦 1,470、重慶 1,200、托爾斯港 842、臺北 1,704、臺中 1,816、高雄 2,025。
    - **國家平均**：國界畫成 2′（每個 10′ 格子切 5 × 5）的細網格，權重 = 這國的細格數 × cos(緯度)；沒碰到格子的用 100 km 內最近的格子。CRU CL 的 10′ 網格沒有太平洋與印度洋的很多小島（CRU TS 有），薩摩亞、東加、吐瓦魯、吉里巴斯、馬紹爾、諾魯、馬爾地夫、法屬玻里尼西亞、百慕達、聖赫勒拿、皮特肯等 19 個從缺，主題的說明寫明；直布羅陀用 8 km 外的格子。223 個國家／地區有值，世界（陸地）2,466 小時；埃及 3,660、沙烏地 3,384、台灣 1,774、英國 1,317、冰島 1,044，最少是南喬治亞 635。維德角只有 1,029 小時，CRU CL 在那裡的日照百分比只有 20–40%，照原始資料畫。
    - **只有一個時期**：資料檔只有一年（存成 1990），指標的 `timeAxis` 寫「1961–1990 年平均」（tooltip、側欄、排名表的年份與時間軸的刻度都是這句），`defaultYear: 1990`；跟其他指標的時間軸不同，側欄只列這一張數值卡片。
    - **台灣**：附註寫全島 1,774 小時（臺北的格子 1,704、高雄的格子 2,025），另列中央氣象署 12 個測站 2016–2024 年每年的日照時數範圍（臺北 1,237–1,692、臺南 2,172–2,596、基隆 1,111–1,530…），測站的年代跟 CRU CL 不同，寫明是近年的值。
152. **全球二氧化碳觀測站**（新主題，能源類，排在溫室氣體排放後面，2026-10-30，製作手冊第六批 70；`pipeline/topics/co2_stations.py`、`src/topics/co2-stations.ts`、`src/topics/panels/Co2StationsPanel.tsx`）：
    - **使用者決定**：用每週採樣的月平均（不用茂納羅亞的連續觀測），點站看濃度曲線；台灣有鹿林山。
    - **資料**：`co2_surface-flask_ccgg_text.zip`（6,669,703 bytes）的 95 個 `co2_<站>_surface-flask_1_ccgg_month.txt`；站的名稱、國家、座標、海拔在同一站的 `_event.txt` 表頭（`site_name`、`site_latitude`…），月平均檔沒有。**95 個裡 22 個是船上採樣**（太平洋航線依緯度帶 poc000、pocn05…pocs35，南海 scsn03…scsn21，德瑞克海峽 drp），沒有 event 檔、也沒有固定位置，不畫；畫的是 73 個固定站（2025 年還在採樣的 46 站，其餘已停止）。手冊寫 95 站，差的就是這 22 組。
    - **國家**：依站的實際位置手動對照（`SITES`，同時寫中文名稱）：百慕達、亞森欣島、關島、美屬薩摩亞、格陵蘭、法屬南方領地是地圖上自己的形狀；南極的 4 站（南極點、帕默、昭和、哈雷）算南極洲；斯瓦巴的新奧勒松算挪威（地圖的挪威含斯瓦巴）；中途島地圖上沒有形狀，算美國；北大西洋與挪威海的兩艘定點觀測船（C、M）沒有國家。台灣三站：鹿林山（LLN，2006-08 起）、東沙島（DSI，2010-03 起）、太平島（TPI，2019-05 起）；event 檔的合作單位只有鹿林山寫了國立中央大學。
    - **年平均**：12 個月裡有 9 個月以上才算（月份不齊時季節的起伏會把平均拉偏）；跟手冊一樣：鹿林山 2024 年 426.69、2025 年 428.74 ppm，茂納羅亞 424.43、427.38，巴羅 425.68、428.03，南極點 420.09、423.02。東沙島 2025 年 430.93、太平島 426.58。
    - **畫法**：點圖層用 `epochs`（每一年一期，`y1968`…`y2025` 的年平均），顏色依濃度 7 級（330、350、370、390、410、425 ppm，循序色），沒有年平均的年份由 `minValue` 篩掉不畫，播放時間軸看得到顏色一年年變深、站一個個出現或停止。國家不上色（`kind: 'none'`），值是那一年有在採樣的站數（給 tooltip 與排名表；世界值是全部站數）。
    - **側欄**：選到的國家的每個站一張月平均的曲線（數值軸，x 是年加月份；季節起伏看得到），寫那一年的年平均、採樣期間與海拔；`series.json`（162 KB）只有側欄才下載。
    - **台灣**：三站都在地圖上；說明寫鹿林山大氣背景站的海拔與開始的年月。
154. **地表的岩石種類**（新主題，地理類，排在板塊漂移後面，2026-10-30，製作手冊第六批 72；`pipeline/topics/lithology.py`、`src/topics/lithology.ts`、`src/topics/panels/LithologyPanel.tsx`）：
    - **使用者決定**：照 GLiM 0.5° 的全球網格做，不另做台灣的細圖。
    - **資料**：GLiM 0.5° 網格版的 ESRI ASCII 網格（720 × 360），每格是那 0.5° 裡面積最多的岩類，代碼 1–16 照 Classnames.txt（pipeline 核對縮寫與代碼，不一致就停）。格數：冰河 24,743、未固結沉積物 14,687、混合沉積岩 11,579、碎屑沉積岩 11,574、變質岩 8,959。水體（wb，553 格，大湖）與無資料（nd，47 格）不畫、不算（底圖已有湖）。
    - **畫法**：跟氣候分區同一種類別網格（`ClassGridOverlayDef`，8 位元灰階 PNG 26 KB），沒有改共用程式。14 類的顏色自己定，照地質圖的慣例（沉積物與沉積岩黃褐、碳酸鹽岩藍、火山岩紅橘由淺到深依酸性到基性、深成岩洋紅到深紫、變質岩綠、冰河淡藍灰），圖例依 6 個大類分組；游標下的岩類用 `classAt`。
    - **國家**：格子中心歸到國家（`geoindex.countries_at`，最近的國界），面積依 cos(緯度) 加權；190 個國家與地區有格子，新加坡等小國是 null。指標：面積最大的岩類（不上色）、主要岩類（6 大類，類別圖）、碳酸鹽岩、火山岩（含火山碎屑岩）、未固結沉積物的面積比例。
    - **台灣**：13 格（碎屑沉積岩 7、未固結沉積物 4、混合沉積岩 1、變質岩 1，依面積 54%、31%、7.7%、7.7%），主要岩類是沉積岩；中央山脈的板岩、大屯火山群在 0.5° 看不出來，說明寫明。
    - **陷阱**：每格只取最多的岩類，小島與窄的山脈會被吃掉、比例是粗略的；GLiM 是 92 份各國地質圖拼起來的，國界兩邊的分類細緻度不同（有的國家的圖把大片地區歸為混合沉積岩）。
155. **關鍵礦產的擴充：鹽、黃金、稀土與永久磁鐵、鈾的貿易**（關鍵礦產主題的擴充，2026-10-30，製作手冊第六批 73；`pipeline/topics/minerals.py` 的 `MINERALS`、`pipeline/topics/minerals_trade.py`、`src/topics/minerals.ts` 的 `TRADE_DIMENSION`、`src/topics/panels/MineralsPanel.tsx`、`src/panels/CountryPanel.tsx`）：
    - **使用者決定**：四個候選（鹽、黃金、稀土的貿易、鈾）都併進關鍵礦產；鈾先做貿易流向，產量等紅皮書的授權確認後再加；稀土加貿易流向，永久磁鐵（850511）另列。
    - **鹽、黃金**：`MINERALS` 加兩種，PDF 解析照舊（2020–2026 版的表格版面一樣，不用改 `usgs_mcs.py`）。鹽是千公噸、欄位標題「Mine production」，沒有蘊藏量（USGS 只寫「Large」），蘊藏量的兩個檔是空的（同鎵、鍺）；黃金是公噸，有蘊藏量。2024 年：黃金世界 3,280 公噸、中國 11.5%；鹽世界 2.75 億公噸、中國 20.4%。原本 17 種礦產的資料檔重新產生，內容不變。子項目的分組：黃金跟鉑、鈀併成「貴金屬」（原本叫鉑族金屬），鹽是「工業礦物」。
    - **貿易**：BACI HS92（1995 年起，塑膠污染已下載的同一個檔），用 `baci.yearly_hs6_rows()` 一次讀出三種商品：稀土 280530＋2846（2805 的其他六位碼是鈉、鈣等，不收）、永久磁鐵 850511、鈾 261210＋284410（濃縮鈾 284420 不收）。年份 2000–2024，流向檔共約 1.4 MB（稀土 441 KB、磁鐵 770 KB、鈾 166 KB）。格式跟貿易、半導體主題一樣（`trade.py` 的 `_from_pairs`、`_write_item`），寫在 `topics/minerals/` 的 `flows/`、`export/`、`import/` 底下。2024 年：稀土世界 31.1 億美元，出口緬甸 8.2 億、中國大陸 5.2 億、馬來西亞 4.1 億，台灣進口 5,140 萬；磁鐵 49.7 億，中國大陸出口 31.6 億；鈾 123 億，哈薩克 44.7 億、加拿大 32.7 億。數字跟手冊引的 Harvard Atlas 不完全一樣（兩邊調和進出口申報的方法不同）。
    - **前端**：兩個流向指標用指標自己的 `dimension`（`TRADE_DIMENSION`：稀土金屬與化合物、永久磁鐵、鈾），跟產量的 19 種礦產分開；預設的子項目 `rare-earths` 跟產量的稀土同一個 id，從產量換到流向時留在稀土。側欄：流向指標時 `MineralsPanel` 改畫 `TradePanel`（主要出口對象與進口來源），其他照舊。
    - **共用程式的修正**（`CountryPanel.tsx` 的 `label`）：側欄數值卡片的子項目名稱，原本只有「卡片的指標有自己的 dimension」才各自換名稱，其他卡片用目前選單上的子項目名稱；目前的指標有自己的 dimension 時（選了流向的「永久磁鐵」），產量卡片會寫成「永久磁鐵產量」。改成目前的指標或卡片的指標有自己的 dimension 時都用 `itemLabelOf()`（卡片的資料本來就經過 `itemFor()` 換成它自己的子項目，名稱跟著一致）。國旗主題（兩個指標都有自己的 dimension）不受影響。
    - **陷阱**：稀土精礦沒有專屬的六位碼，各國報的代碼不一致，看不到礦砂的貿易；中國大陸是稀土化合物最大的進口國（緬甸、寮國的中重稀土原料），出口大宗是磁鐵；850511 含釤鈷、鋁鎳鈷，不全是釹鐵硼；中國 2025 年 4 月起管制中重稀土與磁鐵出口，BACI 2027 年 1 月才有 2025 年；俄羅斯的天然鈾進口多半是哈薩克送去轉化。台灣沒有自己的申報（BACI 的 490），數字來自夥伴；台灣不產鈾、天然鈾進口很少（核燃料是濃縮鈾）。說明與頁尾寫明。
156. **熱點火山：板塊內部的火山另外上色**（地震與火山的擴充，2026-10-30，製作手冊第六批 74；`pipeline/sources/gvp.py`、`pipeline/topics/earthquakes.py` 的 `tectonic()`、`src/topics/earthquakes.ts` 的 `VOLCANO_COLORS`）：
    - **使用者決定**：不整理熱點清單；把 GVP「構造環境」是板塊內部的 149 座火山另外上色，說明寫明「板塊內部不等於熱點」。
    - **資料**：GVP WFS 多取 `Tectonic_Setting`（快取檔名換成 `holocene-volcanoes-tectonic.json`，舊快取沒有這個欄位），`volcanoes.json` 多兩個欄位：`ts`（1 隱沒帶 838 座、2 裂谷 221、3 板塊內部 149、0 不明 6）與 `crust`（1 大陸、2 中間型、3 海洋地殼、0 不明）。原本的欄位逐一比對沒有變（火山清單同一版）；其他地震的檔沒有重新提交（重跑會換成最新的 USGS 目錄，跟這次無關）。認不得的構造環境 pipeline 會停。
    - **畫法**：火山圖層的 `color` 改成依 `ts` 分兩級（`ColorClasses`，門檻 3）：隱沒帶與裂谷照舊深褐（ORANGE 700）、板塊內部青綠（`MAP_TOKENS.categorical[0]`），跟地震的紅、黃、紫與板塊邊界的灰都分得開；`sortField: 'ts'` 讓板塊內部的畫在上面。tooltip 多一行「構造環境：板塊內部・海洋地殼」。圖例是「隱沒帶、裂谷」「板塊內部（不等於熱點）」。沒有改共用程式。
    - **陷阱**（說明與頁尾寫明）：熱點的數目與位置沒有共識；冰島、亞速爾與加拉巴哥群島的火山（多數）GVP 歸為裂谷，所以不是青綠色；板塊內部的火山也有跟地函柱無關的（大陸內部的火山群）。台灣的大屯火山群、龜山島是隱沒帶。
157. **特殊地形**（新主題，地理類，排在地表的岩石種類後面，2026-10-30，製作手冊第六批 75；`pipeline/topics/special_landforms.py`、`src/topics/special-landforms.ts`、`src/topics/panels/SpecialLandformsPanel.tsx`）：
    - **使用者決定**：候選 416–422 合成一個主題；用 Wikidata；泥火山、天坑資料不足也照放並附註；台灣的野柳女王頭、烏山頂泥火山手工補；不用 OpenStreetMap。
    - **資料**：一次 SPARQL（`P31/P279*` 到 10 個根類別，加上手工補的兩個 QID），每個項目取座標、維基百科條目數、有沒有英文或中文條目、P17 的國家數與 ISO 代碼、中英文名稱（繁體用 OpenCC，沒有英文的用其他語言，同纜車主題）。一個項目符合好幾類時取前面的類別。4,296 個點（沒有名稱的 23 個不收）：綠洲 188、峽灣 2,386、天然拱門與奇岩 389（天然拱門、海蝕柱、岩柱）、環礁與珊瑚島 437、泥火山 23、天坑與滲穴 748（含天然井）、間歇泉 125。「岩石地形」Q631305 太廣（3 萬多筆，墨西哥 1.2 萬筆是 GeoNames 匯入），不收。
    - **國家**：依座標（`geoindex.countries_at`，0.3° 內最近的國界）；離國界更遠的遠洋小島用 Wikidata 的 P17（只有一個國家時），300 公里內最近的是那一國的屬地時改用屬地（法屬玻里尼西亞的環礁 P17 是法國；重用地震與火山的 `OffshoreIndex`、`TERRITORIES`）。P17 不只一個的（南海的環礁等 16 個）tooltip 寫「主權有爭議」。
    - **台灣**：Wikidata 本身有小門鯨魚洞、石門洞、深澳象鼻岩三個天然拱門；手工補野柳女王頭（Q10942787，Wikidata 歸為岩石地形）、烏山頂泥火山自然保留區（Q16929098，歸為自然保留區），沒查到時 pipeline 會停。東沙環礁在 Wikidata 是群島與國家公園，沒有手工補（使用者只決定補這兩個）。
    - **畫法**：一個點圖層，7 類依 `MAP_TOKENS.categorical` 上色，大小依維基條目數；縮小時（5 級以下）只畫有英文或中文條目的（`minValue` 依 `w` 欄位），挪威的小峽灣才不會蓋滿北歐。國家的指標「數量」（比例圓）是指標自己的子項目（七類合計與各類）。
    - **共用程式的修正**（`overlayLayers.ts` 的 `pointFeatures`）：點的 GeoJSON 原本只放半徑、顏色、時間、排序的欄位，`minValue` 的欄位沒放進去（城市的人口來自 `epochs`，剛好有），篩選的 `has` 一律不成立、整個圖層都不畫。改成也放 `minValue.field`，城市照舊。
    - **陷阱**（說明寫明）：Wikidata 收得多不多跟各國有沒有人整理有關；峽灣一半以上在挪威；泥火山只有二十多個；中文說的「天坑」沒有類別、幾乎沒收；間歇泉約八成在黃石，堪察加的間歇泉谷、智利的 El Tatio 沒有收。
158. **企鵝在哪裡**（新主題，地理類，排在南極研究站後面，2026-10-30，製作手冊第六批 76；`pipeline/topics/penguins.py`、`src/topics/penguins.ts`）：
    - **使用者決定**：MAPPPD 的授權寫法矛盾，照「只准非商業」處理，頁尾寫明（第 12 點）。
    - **資料**：MAPPPD v5.0 的全部普查 CSV（AllCounts_V_5_0.csv，2,114,238 bytes）：729 個繁殖地、5,487 次普查，繁殖季 1892–2025（`season_starting`，2023 是 2023/24 年的南半球夏天）；阿德利 1,920 筆、巴布亞 1,585、頰帶 1,507、皇帝 338、馬可羅尼 124、國王 13（只有 8 個繁殖地在南緯 60 度以南）。都在南緯 60.5–77.7 度（CCAMLR 48.1、48.2、48.5、48.6、58.4.1、58.4.2、88.1–88.3 區），南喬治亞、福克蘭、南美、南非、澳洲、紐西蘭、加拉巴哥的企鵝不在這份資料裡，說明寫明。
    - **同一季同一種有好幾筆**（822 組，不同的計數單位或不同的調查）：先取有數字的（數量空白的 23 筆是「有繁殖、沒有計數」，存 -1），再依巢、成鳥、幼鳥的順序，同一種單位取準確度最好的（accuracy 1 是 ±5%），再相同取大的；整理後 4,268 個（繁殖地、物種、繁殖季）。數量 0（162 筆）是那一季沒有企鵝繁殖，照畫成灰點。
    - **資料檔**：一個繁殖地一筆點，六種企鵝各一個欄位，存普查序列的字串「繁殖季:數量:單位;…」（n 巢、a 成鳥、c 幼鳥）；子項目「全部」（96 KB）與每一種各一個檔（只有那一種的繁殖地與欄位，0.9–39 KB），國家的指標檔是空的（只給時間軸的繁殖季）。
    - **畫法**：點圖層的 `epochs` 每一年一期（1892–2025），`values` 取每一種在那一季以前（含）最近一次的普查：`n` 是數量（大小），`s` 是種類（全部時取數量最多的一種；計數單位不同直接比，只決定顏色），`age` 是最近一次普查隔了幾年，`seen` 是有沒有普查過（`minValue` 篩掉還沒普查過的）。兩個指標共用同一個檔、各一個圖層（`indicators`）：「企鵝的種類與數量」依種類上色（六種用類別色，避開白色冰面上看不清楚的淺黃、淺青綠；0 是無資料的灰），「普查有多舊」依隔了幾年上色（5 年內、5–9 年青綠兩階，10–19 年琥珀、20–39 年深橘、40 年以上深紫；單一色相的淺階在冰面上看不出來）。時間軸的年份寫成繁殖季（`timeAxis`：「2023/24 繁殖季」）。tooltip 寫到這一季普查了幾次、每一種最近一次的數量與單位、歷次最多的一次；名稱只有英文。
    - **通用擴充**：`TopicDefinition.focus`（換到主題時地圖移到南極，第 4 節的表）、`scripts/topic-thumbs.mjs` 的 `VIEWS`（縮圖看南極半島到東南極的海岸）。
    - **2025/26 繁殖季的畫面**：最大的群落是阿代爾角的阿德利企鵝（2023/24 年 337,361 個巢，最多是 2018/19 年 504,332 個巢）；南極半島的頰帶、巴布亞企鵝幾乎每年有人數，東南極很多繁殖地最近一次是 20–40 年以前。
    - **台灣**：沒有企鵝（`noValue`）；國家不上色（`missing`）。
159. **填海造陸**（新主題，地理類，排在特殊地形後面，2026-10-30，製作手冊第六批 77；`pipeline/topics/reclamation.py`、`src/topics/reclamation.ts`、`src/topics/panels/ReclamationPanel.tsx`）：
    - **使用者決定**：照候選清單的做法（135 個城市的比例圓）；台中、新加坡的國家欄修正。
    - **資料**：xlsx 一列一個城市（區域、緯度、經度、城市、國家、2000–2020 年填海面積〔公頃〕、相對誤差），135 個城市：有填海 106、「Negligible」28（沒有座標）、Kozhikode 寫「null」（沒有資料）；合計 253,734 公頃跟檔案最後一列核對（不一致 pipeline 會停）。
    - **修正**：台中那一列（城市欄「Taichung . Taiwan」、國家欄「China」）→ 台灣；新加坡的國家欄空白 → 新加坡；香港寫「China SAR」→ 香港（HKG；手冊寫「沒有香港」，其實有，679 公頃）；「SA」是南非；New York、Virginia Beach 的國家欄空白 → 美國。Kochi、Thiruvananthapuram、Port-au-Prince 的經緯度寫反：座標落在別國、對調後落在那一國時對調（pipeline 自動判斷、印出來）；Maputo 的緯度多一個逗號。沒有座標的城市用 Natural Earth 1:10m populated places 的位置（依名稱與國家對，拼法不同的手工對照）；中文名稱用它的 NAME_ZHT（去掉「市」，仁川、釜山、杜拜與台灣的三個城市手寫）。
    - **畫法**：預設指標「填海的城市」國家不上色、畫城市的點（面積與填海面積成正比，可忽略的是灰色小點，1,000 公頃以上與以下兩色）；國家的值是城市合計（tooltip、排名表）。另外兩個指標（各國合計、有填海的城市數）是比例圓，城市的點只在預設指標畫（兩種圓疊在一起分不清）。
    - **結果**：前 10 名都在中國大陸（上海 34,978、天津 32,800、寧波 32,278、唐山 28,689、營口 17,914 公頃）；各國合計中國大陸 215,508、阿聯 10,836、南韓 5,723、新加坡 3,735 公頃；台灣 1,135 公頃（高雄 498、台北 343、台中 294）。
    - **陷阱**（說明寫明）：只算人口百萬以上的沿海城市（彰濱、雲林離島工業區這類不在裡面），2000 年以前的填海不算；只有城市的點，沒有填海的範圍（作者說之後會公布）。
166. **婚姻與家庭的擴充：家庭的組成、一夫多妻**（2026-10-30，製作手冊第六批 84；`pipeline/sources/un_households.py`、`fies.py`、`polygamy.py`、`pipeline/topics/marriage.py`、`src/topics/marriage.ts`）：
    - **使用者決定**：家庭的組成（候選 463）與一夫多妻（482）併成一次擴充；單人家戶順便換成聯合國 2026 年版；一夫多妻分四類；台灣用主計總處的資料補。
    - **聯合國 2026 年版**：家戶檔的欄位跟 2022 版不同（多了 ISO3、SDG 區域，數字大多存成字串，沒有值寫「..」），來源類別有「DYB & China Population Census Yearbook 2020」這種合寫與各國普查的全名，依第一個詞判斷順位，普查全名跟 DYB 同級。住宅主題的平均每戶人數仍用 2022 版（沒有重建住宅主題）。單人家戶用「1 member」欄（「One-person」那一欄中國 2020 年是空的，兩欄定義相同）；換成 2026 版後單人家戶從 197 國變成 202 國、時間軸從 1990 年起；Eurostat 照舊優先，聯合國補的部分有些參考年份改了（波士尼亞的普查從 2011 年改記 2012 年）、有些數字重算過（愛爾蘭 2002 年 21.6% → 19.9%）。
    - **新指標**：單親家戶比例（184 國）、三代同堂比例（141 國）、隔代家戶比例（祖孫，141 國）都是占全部家戶的比例；60 歲以上獨居比例（181 國）是人的比例。各國的年份差很多（普查、DHS、MICS 混在一起），地圖用 15 年內最近一年。三代同堂、隔代家戶要有戶內成員的關係，只有普查統計表（DYB）的國家（日本、韓國、德國……）沒有；中國的三代同堂是 2020 年普查年鑑的 13.3%。
    - **台灣**：主計總處家庭組織型態（2001–2025 年）的單親、三代、祖孫家庭戶數除以總戶數：2024 年單親 10.4%、三代 10.8%、祖孫 0.9%。主計總處的單親是父或母與未婚子女、三代是祖父母、父母與未婚子女，跟聯合國的定義相近但不完全相同，附註寫明。2025 年的總戶數 976 萬戶比 2024 年多約 50 萬戶（單人家戶 15.6% → 17.3%，跟家庭收支調查第 28 表一致），原因沒有查到，附註寫兩年可能不完全可比。60 歲以上獨居的全國比例沒有開放資料（data.gov.tw 只有各縣市列冊需關懷的獨居老人人數），台灣寫「沒有全國的開放資料」（指標的 `noValue`）。
    - **一夫多妻**：照條目的四份清單分類（條目地圖的圖例是「合法、只限穆斯林、違法但實際不處罰、違法且處罰」，跟清單不一致，用清單）：承認 47、只承認穆斯林的 7、只依習慣法承認 9、不承認 136（條目寫「European Union: illegal in all 27 states」的展開成 27 國；索馬利蘭併進索馬利亞；俄羅斯、土耳其在亞洲與歐洲各列一次）。同時列在兩份清單的：奈及利亞（「承認，only in some states」與「習慣法」）歸習慣法、附註寫北部伊斯蘭法各州；印度（「穆斯林」與「習慣法，for Muslims and in Goa」）歸穆斯林、附註寫果阿。南非在「承認」，條目的說明是習慣法與伊斯蘭法的婚姻，附註寫明。有強弱順序，用 ordinal 的循序色（承認最深）。資料只有 2026 年，指標的 `defaultYear` 是 2026。
    - **Pew 的普及程度**：Pew 只有 130 國，而且只能摘錄，沒有做成指標；頁尾的說明摘錄短文的全球約 2%、多數國家不到 0.5%、布吉納法索 36%、馬利 34%、奈及利亞 28%，附免責聲明。
167. **沒有小孩的女性比例**（生育率與高齡化的擴充，2026-10-30，製作手冊第六批 85；`pipeline/sources/hfd.py`、`oecd_family.py` 的 `childlessness()`、`pipeline/topics/fertility.py` 的 `build_childless()`、`src/topics/fertility.ts`、`FertilityPanel.tsx`）：
    - **使用者決定**：照候選清單，HFD Lite、時間軸是出生世代。
    - **資料**：HFD Lite 的 PARITY.xlsx「Cohort childlessness」工作表（Last modified 02/07/2026）：同一年出生的女性到生育年齡結束時一直沒有生小孩的比例，1935–1981 年出生。openpyxl 要 `read_only` 加 `reset_dimensions()` 才讀得到整張表。沒有資料寫 0，當缺值；有值的 25 國（手冊寫 26，第 26 個是只有東德的 DEUTE，不收）。英國、德國、法國的全國代碼是 GBR_NP、DEUTNP、FRATNP（都是空的）。
    - **補 OECD**：HFD Lite 沒有的德國、義大利、法國、韓國、中國、墨西哥、英國（英格蘭與威爾斯）用 OECD SF2.5 Chart A（1935、1940…1975 年出生，每 5 年一欄，表頭的年份在第 18 欄起）。表的附註寫有些欄不是那一年：義大利 1975 欄是 1978 年生、德國是 1975–1977 年生（記成 1976），中國、法國的 1935 是 1931–1935 年生，寫在各國的附註；韓國的普查只問有過婚姻的女性。HFD 有的國家不用 OECD 的（OECD 也是轉載 HFD，年份較舊）。
    - **畫法**：指標的 `timeAxis` 是出生年（跟平均身高的成人身高一樣），預設 1980 年出生，`latestWithin` 16（各國最新的世代從墨西哥 1965、韓國與中國 1970 到丹麥 1981 年生）。1980 年出生：日本 27.6% 最高，台灣 23.9%（第 4），西班牙、波蘭 1979 年生 24.9%、24.2%，中國 1970 年生 4.9%。側欄的人口金字塔在這個指標不畫（時間軸是出生年，那一年的金字塔跟指標無關；`FertilityPanel` 依 `indicator.timeAxis` 判斷）。HFD 提醒這個指標要小心使用，說明寫明。
168. **教育的擴充：托育、教師薪資、班級人數、上學天數、技職**（2026-10-30，製作手冊第六批 86；`pipeline/sources/oecd_eag.py`、`moe.py` 的 `primary_school()`、`upper_secondary_vocational()`、`pipeline/topics/education.py` 的 `build_more()`、`src/topics/education.ts`）：
    - **使用者決定**：候選 467、503、504、505、507 併成一次擴充；「一班幾個學生」以 OECD 的班級人數為主、生師比為輔；台灣用教育部的資料補。
    - **七個新指標**：0–2 歲上托育的比例（OECD PF3.2，46 國，2005–2025；各國收的服務範圍不同）、學前教育毛入學率（WDI，202 國，可以超過 100%，澳洲 160%）、國中教師的法定年薪（公立、最普遍的資格、15 年年資、購買力平價美元，只有 2025 年，38 國：盧森堡 150,897、德國 111,804，最低斯洛伐克 29,433）、小學每班人數（公私立全部學校，38 國加台灣）、小學生師比（UIS 的學生數 ÷ 教師數，同一年兩個都有才算，205 國）、小學一年上課天數（2025 年，42 國：以色列 214、日本 201.8，最少保加利亞 162.5）、高中讀職業類課程的比例（UIS GTVP.3.V，183 國）。地圖用 5 年內最近一年（薪資、天數只有一年）。
    - **OECD 的檔**：薪資檔同時有本國貨幣（XDC）與購買力平價美元（USD_PPP），只取後者；薪資、上課時間的年份在 REF_PERIOD，每班人數在 TIME_PERIOD。比利時只有荷語區、法語區，英國只有英格蘭、蘇格蘭：比利時用荷語區、英國用英格蘭，附註寫另一區的值；美國、加拿大、西班牙另有各州的值，用全國那一列。
    - **台灣**：每班人數（學生數 ÷ 班級數，2025 學年度 22.6 人）、生師比（學生數 ÷ 教師數，11.7）用教育部國民小學概況（104 學年度起）；技職比例是專業群（職業）科加實用技能學程占高級中等學校學生（2025 學年度 41.3%），綜合高中、進修部不算（綜合高中高一不分流、進修部普通科與職業類科分不開）。學年度以開始的那一年標示，跟主題原本的寫法一樣。托育、教師薪資、上課天數沒有台灣（OECD 沒有；人事總處的教師待遇表是 PDF、授權待確認；法規只規定寒暑假，沒有上課日數）。**學前教育毛入學率沒有台灣**：教育部的幼兒園概況有各年齡的幼生數，但分母要單一年齡的人口，戶政司的歷年表只有五歲年齡組（y0s1、y0s3 從 15 歲起分組），單一年齡的表（m0s7）只有當月、從 cloud 下載被切斷，沒有做；之後可以用各年 12 月的單齡人口補。
    - **生師比不用世界銀行的版本**：WDI 的 SE.PRM.ENRL.TC.ZS 停在 2019 年（2019 年只有 4 國），UIS 公開 API 也沒有一般的生師比指標，所以自己用學生數與教師數算；教師數是人頭數，兼任也算一人。
    - **玻利維亞的技職比例不收**：UIS 2005–2024 年每年都是 100%，寫在指標的 `noValue`。
169. **汽車擁有率**（交通安全主題的擴充，2026-10-30，製作手冊第六批 87；`pipeline/topics/road_safety.py` 的 `build_cars`、`pipeline/sources/who_road.py` 的 `gsrrs_2023_cars`、`src/topics/road-safety.ts`）：
    - **使用者決定**：放進機車大國所在的交通安全主題（同一個 WHO 檔）；台灣用小客車登記數。
    - **資料**：GSRRS 2023 指標檔的 CP_38「Cars and 4-wheeled light vehicles」（含皮卡、輕型貨車，2020 或 2021 年，奧地利沒填年份當成 2021）÷ WPP 2024 那一年的人口（跟機車一致）。明顯填錯的不用：每千人不到 3 輛（喬治亞 1 輛、坦尚尼亞、剛果、模里西斯、賽普勒斯、肯亞、尚比亞、庫克群島、多哥、加彭）、越南（43 萬輛，每千人 4 輛）、菲律賓（車輛總數填 13）、查德（汽車比車輛總數多）。歐洲另一個指標用 Eurostat road_eqs_carhab 的每千人小客車數（1990–2025，41 國，2025 年的值有 p、e 旗標，照收）。兩者定義不同（WHO 含四輪輕型車，Eurostat 只有小客車），分成兩個指標，不接成一條線。
    - **台灣**：交通部統計查詢網表 101 的年底登記小客車（含自用、營業、租賃）÷ WPP 年中人口，2012–2025 年每年，兩個指標都放；附註寫加上小貨車的數字（2025 年每千人 365 輛）比較接近 WHO 的定義。公路局統計查詢網從 cloud 被 Incapsula 擋下，表 101 是同一份監理登記數。
    - **結果**：WHO 85 國＋台灣，每千人紐西蘭 792、美國 764、冰島 740、澳洲 704、盧森堡 687、波蘭 680、義大利 667；韓國 396、台灣 323（2025 年）、中國 181、印度 31。Eurostat 2025 年列支敦斯登 769、義大利 709、芬蘭 671；土耳其 203；波蘭 1990 年 138。
    - **限制**：日本等國沒有填汽車數；WHO 只有一年。
170. **各國的健保制度**（健康主題的擴充，2026-10-30，製作手冊第六批 88；`pipeline/topics/health_systems.py`（步驟 `health-systems`，輸出到 `topics/health/`）、`src/topics/health.ts`）：
    - **使用者決定**：手冊原本是「OECD 33 國的分類加開辦年份，其他國家也手工歸類，每國附出處」。製作時問了兩次：出處用英文維基「Health care systems by country」表；對照後發現維基的分類對應不到 OECD 的四類（Single-payer 同時有英國這種稅收的國家衛生服務與台灣這種單一保險人，Public insurance system 同時有日本的多個保險人與韓國的單一保險人），使用者決定**分成三個指標**、各自標明來源，不硬對應。
    - **基本醫療保障的主要來源**（OECD HSCS 2023 的 Q2）：CSV 的文字題是空的，用 SDMX-JSON（`Accept: application/vnd.sdmx.data+json; version=2`，一題 32 KB）。國家衛生服務 11 國、單一保險人 9 國（加台灣 10）、多個保險人 11 國、地方衛生體系 1 國（瑞典），智利沒有回答。台灣依《全民健康保險法》第 7 條（中央健康保險署是唯一的保險人）編成單一保險人，附註寫明。
    - **醫療的主要財源**（維基表的 Financing system 欄，178 列裡 99 國有填，其餘 N/A 不畫）：用維基自己的分類，歸成 5 類：政府單一支付（Single-payer，40 國，含台灣）、社會保險（Public／Social insurance，41 國）、公私混合（10 國，美國的 Mixed non-universal 也放這裡）、私人保險為主（荷蘭、瑞士、以色列、列支敦斯登）、社區健康保險（衣索比亞、馬利、塞內加爾、坦尚尼亞）。每國的附註寫表上的原文與那一列引用的第一個網址（多半是 SSA 的報告）或「表上沒有引用」。
    - **全民健保的開辦年份**（維基「Universal health care start date」表，44 個國家與地區，表上註明出處是紐約州衛生署）：俄羅斯 1918（蘇聯）、紐西蘭 1938、德國 1941、英國 1948、日本 1961、韓國 1988、台灣 1995、亞美尼亞 2023。各國定義不一（立法年或全面涵蓋年），說明寫明。
    - **都只有一個時間點**（OECD 2023、維基 2026），指標各自的 `defaultYear`。
171. **洗腎大國**（疾病主題的擴充，2026-10-30，製作手冊第六批 89；`pipeline/topics/dialysis.py`（步驟 `dialysis`，輸出到 `topics/disease/`）、`pipeline/sources/usrds.py`、`pipeline/sources/who_xmart.py`、`src/topics/disease.ts`）：
    - **使用者決定**：放「疾病」。
    - **資料**：USRDS 2025 年報第 11 章的 GraphQL（https://usrds-adr-api.niddk.nih.gov/graphql/2025 ，POST、不必金鑰，chapterId 20，查詢只取圖的序列，約 30 KB；手冊查證時連 methods 等文字一起查是 87 KB）。圖 11.15「Rate of dialysis by country or region, 2023」49 個國家或地區（年底的盛行率，沒有年齡調整）；2023 年沒有值的韓國、印尼、蒙特內哥羅用圖 11.16a（增加最多的 10 國加美國的 2013–2023 年）的 2022 年，附註寫明。各國的歷年值只有圖 11.16a 那 11 國，所以地圖只有 2022–2023。
    - **次國家的地區**：墨西哥只有阿瓜斯卡連特斯州、比利時分荷語區與法語區、英國分成英格蘭威爾斯北愛爾蘭與蘇格蘭，沒有人口加權合併（比利時的分區人口要另找來源），用主題的 `places` 畫成點（疾病主題原本沒有 places），三國的 `noValue` 寫「見地圖上的點」。
    - **公立醫療能不能洗腎**：WHO NCD CCS 的 NCD_CCS_dialysis（2015、2017、2019、2021 年，194 國），Yes／No 畫成兩類，No response、Don't know、No data received、NR 當成沒有值。GHO 的 OData 回 500，改讀 xmart 的 GHO/FACT（`who_xmart.facts()`，有分頁就逐頁存快取），之後安寧緩和醫療、禁菸法規共用。台灣不在調查裡，全民健保給付透析，編成「可以」，附註寫明。
    - **結果**：每百萬人台灣 3,522、日本 2,667、泰國 2,317、新加坡 2,216、韓國 2,178（2022）、阿瓜斯卡連特斯 1,877、美國 1,677；冰島 249、南非 116、孟加拉 109、奈及利亞 13。2021 年公立醫療可以洗腎 137 國（加台灣 138）、不行 47 國（非洲、太平洋島國，也有墨西哥、哥倫比亞、巴基斯坦、孟加拉）。
    - **限制**（說明寫明）：只有約 50 個有登錄系統的國家或地區，非洲幾乎沒有；盛行率受存活率與腎臟移植率影響，各國收集方法不同。75. **大學入學考試**（新主題，社會類，排在學生能力後面，2026-10-30，製作手冊第六批 93；`pipeline/sources/admission_tests.py`、`pipeline/topics/university_entrance.py`、`src/topics/university-entrance.ts`）：
172. **長期照顧**（健康主題的擴充，2026-10-30，製作手冊第六批 90；`pipeline/topics/long_term_care.py`（步驟 `long-term-care`，輸出到 `topics/health/`）、`src/topics/health.ts`）：
    - **使用者決定**：放「健康」；台灣用衛福部、社家署的資料加總。
    - **資料**：OECD DSD_HEALTH_LTCR@DF_HEALTH_LTCR_BED（每千名 65 歲以上的機構床數，38 國）與 DF_HEALTH_LTCR_RECIPIENT（65 歲以上使用長照的比例，機構與居家同一年都有才相加，27 國；日本的居家只到 2006 年，地圖上沒有日本）。年份從國家夠多的年份開始，最後一年照收（latestWithin 5）。
    - **台灣**：衛福部統計處「醫事機構服務量統計年報」（114 年版）表 18 的一般護理之家床數，加上社會福利公務統計 2.4.6「老人長期照顧、安養機構概況」的長期照顧機構（長期照護型、養護型、失智照顧型）可供進住人數（總計扣掉安養機構：安養機構照顧生活能自理的老人，OECD 的長照床數不含沒有照顧服務的住宅），÷ WPP 的 65 歲以上年中人口 × 1,000，2015–2025 年。2025 年 43,810 床 ＋ 55,486 人，65 歲以上 464 萬人，每千人 21.4 床。退輔會的榮譽國民之家、精神護理之家、長照服務法的住宿式長照機構沒有算（使用者決定只用衛福部、社家署），附註寫明。使用長照的比例沒有可以比的台灣數字，`noValue` 寫明。
    - **結果**：床數盧森堡 77.1（2025）、荷蘭 68.0、瑞典 63.1、比利時 61.5；美國 27.2（2022）、日本 26.9、韓國 25.2；台灣 21.4；希臘 0.9。使用長照立陶宛 47.2%、以色列 32.6%、瑞士 24.3%、德國 24.0%，韓國 11.8%、法國 9.4%。
    - **限制**（說明寫明）：各國的長照定義差很多（立陶宛、以色列算進現金給付）；只有 OECD 國家。
173. **安寧緩和醫療**（健康主題的擴充，2026-10-30，製作手冊第六批 91；`pipeline/topics/palliative.py`（步驟 `palliative`，輸出到 `topics/health/`）、`src/topics/health.ts`）：
    - **使用者決定**：放「健康」。
    - **資料**：WHO NCD CCS 的兩題（公立醫療體系的基層醫療、社區或居家是不是普遍提供安寧緩和醫療，2015、2017、2019、2021 年，194 國），各一個類別圖（普遍提供／沒有普遍提供），No response、Don't know、No data received、NR 不畫。
    - **台灣**：WHO 的調查沒有台灣。全民健保給付安寧住院、安寧共同照護、安寧居家療護與社區安寧照護，兩題都編成「普遍提供」，附註寫明不是台灣政府對 WHO 的回答（跟洗腎大國的公立醫療能不能洗腎同樣做法；手冊沒有寫台灣要不要編，是製作時決定的）。健保署的支付標準頁（nhi.gov.tw）從 cloud 回 403，沒有附網址。健保署「接受安寧緩和醫療意願之比率」（data.gov.tw 172264）是品質指標，口徑不同，沒有用。
    - **結果**：2021 年基層醫療 81 國普遍提供、105 國沒有；社區或居家 84 國、97 國。自己回答的有沒有，不代表品質：法國、韓國回答沒有，印度回答有（說明寫明）。
174. **菸酒的擴充（電子菸、禁菸法規）**（菸酒主題的擴充，2026-10-30，製作手冊第六批 92，候選 499、502；`pipeline/topics/tobacco_policy.py`（步驟 `tobacco-policy`，輸出到 `topics/tobacco-alcohol/`）、`src/topics/tobacco-alcohol.ts`）：
    - **使用者決定**：499、502 合併成一個擴充；電子菸的「legal」與「below 20 mg/ml legal」合成一類；台灣依菸害防制法編碼。
    - **室內全面禁菸的場所**：WHO MPOWER P1（2007、2008、2010…2024 年，195 國）8 類場所（醫療、學校、大學、政府機關、辦公室、餐廳、酒吧、大眾運輸）回答 Yes 的有幾類，8 類都有答案才算（「. . .」那一年不畫），面量圖 0–8（`integer`）。2024 年 8 類 77 國、0 類 35 國；英國 8、日本 3、韓國 2、中國 1、美國 1、德國 0（只算全國法律）。台灣依第 18 條照 WHO 的標準：醫療機構、各級學校（含大學）、政府機關、三人以上共用的室內工作場所、大眾運輸全面禁菸，餐飲店、酒吧准設獨立空調與隔間的吸菸室，不算 → 6 類；2009 年施行的修正版也是這 6 類，從 2010 年畫起（2007、2008 年是舊法，不編）。手冊的「P1–P8 單項、P11–P15 罰則、遵守程度」沒有做。
    - **電子菸的規範**：解析維基表含尼古丁那一欄，歸成 4 類（禁止、事實上禁止、要處方或只在藥局、合法），unknown 不畫；州、省、屬地的列跳過（中國取 mainland、加拿大取亞伯達等省的那一列、美國取美洲那一列、馬來西亞取全國那一列；檳城等四州禁止、美國各州差異不畫），密克羅尼西亞只有各州的列（unknown）。183 個國家與地區：合法 137（其中 45 個限 20 mg/ml）、禁止 38、要處方或只在藥局 4（澳洲、南非、迦納、馬來西亞）、事實上禁止 4（日本、土耳其、巴西、委內瑞拉）。只有一個時間點（2026，指標的 `defaultYear`），說明寫查核日期。台灣表上是 banned，程式檢查表上的值，跟《菸害防制法》第 15 條（112 年 2 月 15 日修正）核對過。
    - **類別的顏色**：ordinal 類別圖越前面越深，所以由嚴到寬排（禁止最深）。
175. **大學入學考試**（新主題，社會類，排在學生能力後面，2026-10-30，製作手冊第六批 93；`pipeline/sources/admission_tests.py`、`pipeline/topics/university_entrance.py`、`src/topics/university-entrance.ts`）：
    - **使用者決定**：做「主要入學方式」的類別圖（統一考試、高中會考當資格、美式申請審查），加各國考試名稱；台灣附註學測與分科測驗。開工後維基的清單裡有各大學自辦考試的國家（墨西哥、菲律賓、孟加拉），三類都不像，**使用者 2026-10-30 決定加第四類「各校自辦考試」**。
    - **分類**：全國統一入學考試 20 國（專為入學辦、跟高中畢業考試分開：台灣、中國、南韓、日本、土耳其、伊朗、希臘、西班牙的 PAU、印度的 CUET／JEE／NEET……）、高中畢業會考當入學資格 48 國（歐洲的 Abitur、Matura、Baccalauréat、A-Level，以及香港 DSE、新加坡 A-Level、西非的 WASSCE；高中畢業與入學合一的俄羅斯國家統一考試、越南高中畢業考試也算這類）、各校申請審查 2 國（美國、加拿大）、各校自辦考試 3 國。兩份清單都沒列的國家沒有值（約 70 國有值）。很多國家幾種管道並存，只取條目寫的主要那一種，其他寫在附註。
    - **改正維基的過時資料**：台灣段落只寫到指定科目考試（2021 年停辦），改成 2022 年起的分科測驗；日本段落的大學入試中心考試改成 2021 年起的大學入學共通測驗。月份只寫台灣（學測 1 月、分科測驗 7 月），其他國家條目沒寫，不補。
    - **畫法**：只有一個時間點，用 `timeless`；類別沒有強弱，用一般的類別色。tooltip 用 `tooltipLines` 加一行考試名稱（附註的第一句，太長截斷），完整的寫在側欄附註。圖示 `notebook-pen`。
176. **鋼鐵與水泥**（工業主題的擴充，2026-10-30，製作手冊第六批 94；`pipeline/topics/steel_cement.py`、`pipeline/sources/usgs_myb.py`、`src/topics/industry.ts`）：
    - **使用者決定**：國家的比例圓加 GEM 的鋼鐵廠、水泥廠點（照發電廠地圖的做法）。
    - **資料**：USGS Minerals Yearbook 2023 的世界產量表（鋼鐵章表 10 粗鋼、水泥章表 22 水硬性水泥，千公噸，2019–2023），檔案在 USGS 網站的 S3（d9-wret），pubs.usgs.gov/myb/vol1/ 的舊網址是 404。國名後面黏著註腳字母或數字（「Irane」「Ethiopiae, 5」「United States6」），`usgs_myb._code()` 先照原樣查、再拿掉註腳；「--」是零；最新一年註記 e（估計）的國家附註寫「2023 年是 USGS 的估計值」。世界合計用表裡的 Total（USGS 四捨五入，粗鋼 18.9 億、水泥 40.9 億公噸），所以「占全球」是近似值。MCS 只列 11、14 個主要國，沒有用。
    - **廠**：GEM 公開地圖的 GeoJSON（`gist_map_2026-09.geojson` 1,293 座、`gcct_map_2026-07.geojson` 3,884 座），取消（cancelled）與狀態不明（unknown）的不畫，剩 1,257、3,847 座；狀態併成四類（運轉中含 operating pre-retirement、興建中、已宣布、封存或已退役）。容量：鋼鐵廠是 GEM 的 `capacity`（千公噸/年，煉鐵與煉鋼各製程的加總，所以一貫作業廠會比實際粗鋼產能大）、水泥廠是水泥產能（百萬公噸/年）；tooltip 寫狀態、年產能、啟用年份、國家，下一行是製程（GEM 的 prod-type、plant-type，翻成中文）與母公司，最後是英文原名。點只畫在各自的指標（`indicators`），依容量由大到小排、小廠畫在上面（同發電廠地圖）。水泥廠很多（中國 1,402 座），半徑的係數比鋼鐵廠小（最大的約 7 px），紫色的比例圓才看得到。
    - **指標**：粗鋼產量、水泥產量（比例圓，公噸，跟世界比，預設 2023 年）。
    - **結果**：2023 年粗鋼中國 10.19 億公噸（54%）、印度 1.41 億、日本 8,700 萬、美國 8,140 萬，台灣 1,915 萬（第 13 名，1.0%）；水泥中國 20.2 億、印度 4.2 億（估計）、越南 1.07 億、美國 9,010 萬、土耳其 8,145 萬，台灣 1,025 萬公噸。台灣的廠：鋼鐵 11 座（中鋼小港 2,252 萬公噸/年最大）、水泥 5 座（和平最大）。資料 4 個檔約 0.6 MB。
177. **物價與財政的擴充：政府支出的用途、稅收的組成、公共債務兩百年**（2026-10-30，製作手冊第六批 95，候選 536、537、538；`pipeline/topics/fiscal_structure.py`、`pipeline/sources/imf_gfs.py`、`pipeline/sources/oecd_revenue.py` 的 `tax_structure()`、`src/topics/fiscal.ts`）：
    - **使用者決定**：三項合併進「物價與財政」；公共債務另立一個 1800–2015 年的指標，不接在現有的政府債務前面；台灣用財政部的資料補。
    - **占政府支出**（指標自己的子項目「用途」，`spending/{item}.json`）：IMF GFS_COFOG 一般政府（S13）的 GF10 社會保障、GF07 醫療、GF09 教育、GF02 國防、GF01 一般公共服務、GF04 經濟事務占總支出（POTO_PT），約 88 國，最新一年各國差很多，用 `latestWithin: 3`。教育、醫療在 IMF 沒有、或 WDI 的最新一年比 IMF 新的國家（南韓的 IMF 只到 2010 年）改用 WDI（UNESCO、WHO），附註寫明定義不完全相同（WHO 的醫療是國內政府衛生支出，美國 2023 年 IMF 25.6%、WHO 23.0%）；國防不用 WDI（SIPRI 條款）。台灣用財政部 i0121「各級政府歲出淨額-按政事別分」對到最接近的類別（教育科學文化 → 教育、國防 → 國防、社會福利＋退休撫卹 → 社會保障、一般政務＋債務 → 一般公共服務、經濟發展 → 經濟事務），醫療在社會福利裡、沒有單獨的數字，指標檔的 `noValue` 寫原因；最新一年是會計報告（資料集說明「決算或會計報告」）。2025 年度台灣教育科學文化 22.3%（第 8 名，因為含科學與文化）、國防 12.2%、社會保障 29.3%。
    - **占稅收**（子項目「稅收類別」，`tax-mix/{item}.json`）：OECD Global Revenue Statistics 的 T_1100、T_1200、T_2000、T_4000、T_5000，單位 PT_OTR_SECTOR（占稅收總額，含社會安全捐），1990–2024，`latestWithin: 1`（跟稅收占 GDP 一樣）。**台灣跟手冊不同**：手冊建議用「按稅目別分」（6671）加社會安全捐拼湊，但財政部統計資料庫本身有依 OECD 稅收分類編的「賦稅收入結構」（i0807，2002 年起，占稅收總額 %；i0804 是金額、i0808 是占 GDP），跟稅收占 GDP 用的 i0801 是同一套，直接用，不必自己決定證交稅、土地增值稅歸哪一類。2023 年台灣個人所得稅 15.6%、公司所得稅 22.3%、社會安全捐 28.7%、財產稅 9.6%、商品與勞務稅 22.3%。社會安全捐的子項目 id 是 `ssc`（不叫 social，否則網址的 `item=social` 會同時選到支出的社會保障）。
    - **政府債務（1800–2015 年）**（`debt-history.json`）：IMF HPD 的 G63G_S13_POFYGDP（占會計年度 GDP），189 個經濟體；有值的國家 1800 年 3 國、1900 年 21 國、1946 年 25 國、2000 年 175 國。預設 1946 年（英國 270%）。台灣 HPD 有 1997 年起；1987–1996 年用財政部 i0232 的中央政府債務（1 年以上非自償性；表裡只有內債的比率，依內債加外債的金額放大，差 0–2%），附註寫明 1997 年從 15.9%（1996 年）跳到 24.9% 是範圍不同（各級政府）。HPD 不再更新，2016 年起看「政府債務占 GDP」（WEO）。
    - **陷阱**：COFOG 與台灣的政事別不同（教育含科學文化、社會福利含醫療），排名只能參考；IMF 很多國家只有中央政府或很舊；HPD 早年多半是中央政府。
178. **匯率制度**（國家小檔案的擴充，2026-10-30，製作手冊第六批 96；`pipeline/topics/exchange_regime.py`、`src/topics/profiles.ts`）：
    - **使用者決定**：用 IMF 2023 年的分類（英文維基轉載，CC BY-SA）；台灣依中央銀行 2011 年的新聞稿寫「管理浮動」。
    - **資料**：條目的表（列是 10 種匯率安排、欄是 7 種貨幣政策架構），從原始碼解析 `{{flag|…}}`，200 個國家或地區；「European Union」那一格是歐盟本身，不收。列數、列名跟預期不同就停下來（條目改版時才看得出來）。
    - **類別**：10 類併成 8 類（類別圖最多 8 色）：爬行釘住（3）、類爬行安排、水平區間內的釘住（1）併成「爬行釘住與區間」。由硬釘住到自由浮動有順序，用 `ordinal`（循序色，沒有自己的法定貨幣最深）。欄（錨定美元、歐元、一籃貨幣、其他貨幣、貨幣總量目標、通膨目標、其他）寫在指標檔的 `hints`，滑過時看得到。
    - **歐元區**：IMF 依歐元區整體分類，表裡的歐元區國家都是「自由浮動、其他架構」：照畫成自由浮動，附註寫明它們沒有自己的貨幣、歐元對外自由浮動（手冊的陷阱「歐元區要決定怎麼畫」）。
    - **台灣**：IMF 與條目都沒有台灣；央行說「管理浮動匯率」，歸到 IMF 的「浮動」（IMF 2009 年改版前這一類就叫 managed floating），類別名稱寫「浮動（管理浮動）」，附註引央行的話。
    - **結果**：2023 年自由浮動 31 國（美國、日本、英國、俄羅斯、歐元區）、浮動 33 國（南韓、印度、巴西、台灣…）、傳統釘住 43 國（波斯灣國家、非洲法郎區）、其他管理安排 18 國（中國）、貨幣局 12 國（香港、東加勒比）、沒有自己的法定貨幣 17 國（厄瓜多、巴拿馬、科索沃…）。條目是 2023 年的快照，說明寫明年份。
    - **順便修的共用程式**：`check:en` 在 React 換成 Preact（525b878c）之後一律卡在「主題選單」：打開分類選單後馬上按 Esc，Preact 的 effect 比 React 晚跑，焦點還在分類按鈕上、還沒移進選單，按鈕的 keydown 原本不處理 Esc，選單沒關；接著點下一個分類時，滑鼠移過去先觸發「已經開著的選單換過去」，click 再把它關掉。`TopicNav.tsx` 的 `onButtonKeyDown` 加上 Esc：選單開著時關掉（WAI-ARIA 選單按鈕的做法），使用者在按鈕上按 Esc 也一樣關得掉。
179. **貿易依存度**（貿易主題的擴充，2026-10-30，製作手冊第六批 97；`pipeline/topics/trade_dependence.py`、`pipeline/sources/dgbas_expenditure.py`、`src/topics/trade.ts` 的 `trade-gdp`）：
    - **使用者決定**：照候選清單，世界銀行 WDI 的 NE.TRD.GNFS.ZS（商品與服務的出口加進口占 GDP），台灣用主計總處的國民所得統計自己算。
    - **台灣**：支出面 GDP 的兩個 XML（1951–1980、1981 以後，當期價格），（4.商品及服務輸出＋5.商品及服務輸入）÷ GDP。兩個檔的項目編號不同（GDP 在舊檔是 6、新檔是 8），依名稱對，`4.1`、`5.1` 這類細項不要混進合計。結果 1981 年 99.7%、2000 年 103.6%、2024 年 112.9%、2025 年 128.1%，跟手冊相同；地圖從 1960 年起（WDI 的起點），之前的年份不放。
    - **世界合計**：2025 年只有 138 國（沒有美國），WDI 的世界值跳到 68.5%；涵蓋國家不到高峰八成的年份不放世界合計（只到 2024 年，56.7%）。國家的值照樣放到 2025 年，預設年份 2024。
    - **附註**：香港、新加坡超過 300% 是轉口貿易，不是「依賴」（說明與附註寫明）；蘇丹 2021 年起只剩 2–4%（2019 年 26%），世界銀行的原始值明顯偏低，照放、附註寫明。
    - **側欄**：沿用 `TradePanel`；它改成目前的指標是流向圖時用目前的指標，不是就用主題的第一個流向圖（在貿易依存度上看到全部商品的出口對象、進口來源）。

180. **貿易的商品流向**（貿易主題的擴充，2026-10-30，製作手冊第六批 98，候選 544–562 扣掉 543、547、549、552；`pipeline/topics/trade_goods.py`、`pipeline/topics/trade.py` 的 `_write_item(suffix, unit)`、`src/topics/trade.ts`）：
    - **使用者決定**：合併成「貿易」的一批商品流向；以金額為主，回收物、化肥另加公噸；用 BACI HS92 版（1995 年起），HS92 分不開的新代碼另用較新的版本（年份較短）。
    - **商品**（子項目，依「工業製品」「貴金屬、奢侈品與酒」「原料與回收物」分組，共 25 項）：乘用車 8703、純電動乘用車 870380（HS17）、飛機與直升機 8802、電腦與伺服器 8471、手機 851712（HS17；2022 年起 HS22 的 851713＋851714）、鋰離子電池 850760（HS17）、藥品 3004、玩具 9501–9503（HS 2007 把 9501、9502 併進 9503，HS92 要三個加起來才接得上）、成衣 61＋62、鞋 64、黃金 7108、鑽石原石 710210＋710231、切磨好的鑽石 710239、藝術品與古董 97、葡萄酒 2204、威士忌 220830、人髮 0501＋6703、假髮 6704、原木 4403、廢紙 4707、廢鋼鐵 7204、化肥合計 3102–3105、氮肥 3102、磷肥與複合肥 3103＋3105、鉀肥 3104。藥品只取 3004（3002 疫苗與生物製劑不併）；電腦不併零件 8473；工業用鑽石（710221、710229）不列。
    - **讀法**：每個 BACI 版本只讀一次（HS92 30 年約 15 分鐘、HS17 約 2 分鐘），每列依代碼的前 2、4、6 碼對到商品（同一列可以屬於化肥合計與氮肥）；格式跟全部商品、二手衣一樣（`trade._write_item`）。公噸的那一組寫到 `flows-t/`、`export-t/`、`import-t/`（流向檔 `scale: 1`、單位公噸），指標 `export-t`、`import-t` 有自己的子項目（只有回收物與化肥 6 項，`IndicatorDef.dimension`）。`manifest.json` 的 items 保留 trade 步驟寫的，換掉這一批。
    - **手機的斷層**：BACI HS17 版 2022 年起的 851712 是從 HS 2022 換算回來的，世界合計從 2021 年 3,169 億跳到 3,738 億、台灣從 4 億跳到 97 億；HS22 版的 851713＋851714（兩者合起來就是原本的 851712）2022 年 3,108 億、台灣 2.8 億，接得上 2021 年。所以手機 2017–2021 用 HS17、2022 年起用 HS22。純電車、鋰電池沒有這種斷層（HS 2022 沒改這兩個代碼）。
    - **BACI 沒有貨幣用黃金**：HS92 版的 7108 只有 710811–710813（讀 2024 年的檔確認，沒有 710820），手冊要確認的這點寫進說明。
    - **結果**（2024 年，BACI；手冊的例子是 Harvard Atlas，數字不同）：乘用車 9,610 億；電腦 4,196 億，台灣出口 597 億（第 2）；手機 3,012 億，中國大陸 60.4%；鋰電池 1,157 億，中國大陸 58.9%；黃金 5,540 億，瑞士出口 19.2%、進口 19.6%；威士忌 138 億，英國 58.6%，台灣進口占 4.9%（第 4）；鑽石原石 239 億，印度進口 50.5%；假髮 39 億，中國大陸 65.5%、美國進口 36.1%；廢鋼鐵土耳其進口 19.1%（2,091 萬公噸）；鉀肥加拿大 37.7%、俄羅斯 22.7%。
    - **資料量**：25 項 × 最多 30 年，流向與指標檔共約 42 MB（gzip 14 MB），一個商品 0.3–2 MB、一年一個檔約 30–70 KB；畫面上只下載目前的商品與年份。
    - **說明**（頁尾）：精煉、轉口與物流中心（瑞士、阿聯、香港、比利時、新加坡、荷蘭）的進出口不代表生產或使用、品牌國不是產地、黃金不含貨幣用黃金、磷酸銨在 3105。

181. **太陽能板**（半導體主題的擴充，2026-10-30，製作手冊第六批 99；`pipeline/topics/solar_panels.py`、`src/topics/semiconductors.ts`）：
    - **使用者決定**：只做小擴充，不另開主題。
    - **做法**：子項目加「太陽能模組（板）」（854143）與「太陽能電池」（854142，未組成模組），分組「太陽能（HS 2022）」；BACI 的 HS22 版（2022–2024，300 MB，讀一次幾十秒），輸出跟半導體其他商品一樣（流向、出口與進口總額、占全球比例；重用 `semiconductors.py` 的 `Item`、`_notes`、`_totals`），台灣附註對照財政部的 854142、854143（財政部 2023 年起才用 HS 2022，2022 年沒有對照）。原本的「光電元件」（HS17 854140，含 LED、光感測元件）留著，2017 年起的長期變化看它。
    - **結果**（2024 年，BACI；手冊的例子是 Harvard Atlas，數字不同）：模組 486 億美元，出口中國大陸 57.3%、越南 13.0%、泰國 5.8%、馬來西亞 4.4%、印度 3.2%、柬埔寨 2.9%，進口美國 30.4%、巴西、印度各 5.8%、荷蘭 4.6%、巴基斯坦 4.4%；電池 57 億，出口中國大陸 45.8%、泰國 12.8%、馬來西亞 12.1%、南韓 10.1%，進口美國 34.4%、印度 27.0%。台灣的模組出口 BACI 是 4,297 萬美元（夥伴申報；Atlas 是 603 萬），電池出口 3,871 萬。
    - **說明**（頁尾）：只有 2022–2024 年；2023–2024 年價格大跌，金額減少不代表裝置量減少；美國的關稅讓產地移到東南亞。
182. **海鮮的貿易**（海洋與漁業主題的擴充，2026-10-30，製作手冊第六批 100；`pipeline/topics/seafood_trade.py`、`src/topics/oceans.ts` 的 `seafoodFlow`、`src/topics/panels/OceansPanel.tsx`）：
    - **使用者決定**：用跟其他商品一樣的 BACI，不用 FishStat 的貿易。
    - **做法**：BACI HS92 版的第 03 章合計（HS 2012、2017 大幅重編第 03 章，只能用章的合計），1995–2024，`baci.yearly_product_flows(("03",), hs="HS92")`，格式同貿易主題（`trade._write_item`，輸出到 `topics/oceans/flows/seafood/`、`export/seafood.json`、`import/seafood.json`）。指標「海鮮出口」「海鮮進口」是流向圖；`OceansPanel` 在流向圖指標時改用貿易主題的 `TradePanel`（主要出口對象、進口來源），其他指標照舊。
    - **結果**（2024 年）：全球 1,288 億美元；出口挪威 12.7%、中國大陸 7.0%、智利 6.0%、厄瓜多 5.1%、印度 4.7%、越南 4.3%、加拿大 4.1%；進口美國 15.6%、中國大陸 12.2%、日本 6.8%、西班牙 5.3%；台灣出口 15.6 億、進口 15.0 億美元（夥伴申報）。流向檔共約 2 MB。
    - **說明**：不含罐頭與調製品（1604、1605）、魚粉、魚油；瑞典的出口多是挪威鮭魚轉進歐盟。
185. **最長的直飛航線**（新主題，科技與交通類，排在各國的航空公司後面，2026-10-30，製作手冊第六批 103；`pipeline/topics/longest_flights.py`、`pipeline/sources/wikitable.py`、`src/topics/longest-flights.ts`、`src/topics/longest-flights-names.ts`、`src/topics/panels/LongestFlightsPanel.tsx`）：
    - **使用者決定**：照候選清單，現行前 30 名加停飛的前 30 名；直達（中途停靠）的表與未來航線不畫。
    - **資料**：英文維基百科「Longest flights」固定版本 1380354690（2026-10-15）的兩張表（Non-stop flights、Discontinued non-stop flights，都是 top 30 by great-circle distance）。表裡有 rowspan（同一個機場、航空公司、機型跨好幾列），`sources/wikitable.py` 是通用的 wikitable 解析（展開 rowspan／colspan、拿掉註腳模板、巢狀模板換成文字），之後別的維基表格也可以用。距離取 `{{cvt|…|km}}` 的數字（有兩列寫到小數，四捨五入）；日期取 `{{sort|YYYY-MM-DD|…}}` 的排序鍵。
    - **名次**：同一對機場、不同航空公司分開算、名次相同（現行 32 列、停飛 31 列）；排名依大圓距離，實際飛的距離較長（避開逆風、繞過關閉的空域），條目只列較長的一個方向。
    - **機場**：連結的維基條目用 OurAirports 的 wikipedia_link 對到 IATA 與座標；名稱不同的手工對（樟宜、桃園、杜勒斯、法阿、聖保羅瓜魯柳斯、扎耶德、本古里安、奧克蘭、達拉斯沃斯堡），已經關閉的啟德機場用手寫的座標（`HKG-KT`）。現行第 30 名 QR 713 的杜哈連到舊的「Doha International Airport」，卡達航空 2014 年起在哈馬德國際機場起降，改成 DOH。國家依機場的座標。
    - **指標**：沒有時間軸（`timeless`，條目是 2026 年 10 月的現況，停飛的是不同年份停的，不做時間軸）。現行的條數（比例圓）與最長的一條（面量圖，沒有排進前 30 名的寫「沒有排進前 30 名的航線」），停飛的條數；線圖層依指標換（`indicators`）：現行是紅色實線、停飛是灰色虛線，線寬依距離。航空公司、機場的中文名稱放在 `longest-flights-names.ts`（只在中文介面用）。
    - **結果**：現行第 1 名新加坡航空 SQ 23 紐約甘迺迪–新加坡 15,349 km（18 小時 55 分），第 30 名 12,952 km；美國的機場出現 25 次、澳洲 8、新加坡 6。停飛第 1 名大溪地航空 TN 64 帕皮提–巴黎 15,715 km（2020-04-19）。台灣：現行前 30 名沒有；停飛的有長榮 BR 32 桃園–紐瓦克 12,552 km（2011-10-29 最後一班），寫在台灣的附註。
186. **最繁忙的機場**（交通主題的擴充，2026-10-30，製作手冊第六批 104；`pipeline/topics/busiest_airports.py`、`src/topics/transport.ts` 的 `busiest-passengers` 與 `busiest` 圖層）：
    - **使用者決定**：照候選清單，2020–2025 年（2010–2019、2000–2009 是另外的子條目，不收）。
    - **資料**：英文維基百科固定版本 1381104599 的 2025…2020 六張前 50 名表，用 `sources/wikitable.py` 解析，取 Code (IATA/ICAO) 的 IATA 與 Total passengers；座標用 OurAirports 依 IATA 對（同一個代碼有好幾筆時取大型機場），國家依座標。六年共 78 座機場。
    - **畫法**：指標「最繁忙的機場」國家不上色（`kind: 'none'`），機場是點圖層，用 `epochs`（每一年一期）把那一年的旅客放進 `pax`，`minValue` 篩掉那一年不在前 50 名的，圓的大小依旅客量；tooltip 寫那一年的名次與旅客、六年裡進過前 50 名的名次。國家的值是它在前 50 名的機場旅客合計，給排名表與 tooltip。
    - **結果**：2025 年亞特蘭大 1.063 億人次第一、杜拜 9,519 萬、東京羽田 9,168 萬、達拉斯沃斯堡 8,566 萬、上海浦東 8,499 萬；國家合計美國 9.24 億、中國 6.65 億。台灣：桃園 2025 年 4,780 萬人次第 48 名，2020–2024 年都不在前 50 名（寫在台灣的附註）；台灣各機場的旅客原本就在交通主題的附註（民航局 data.gov.tw 33238），沒有另外加。
187. **燃油車禁售的年份**（電動車主題的擴充，2026-10-30，製作手冊第六批 105；`pipeline/topics/ev_phaseout.py`、`src/topics/ev.ts`）：
    - **使用者決定**：分「已立法、政策目標、只簽宣言」三種狀態；台灣的 2040 年要用官方較新的資料核對（國發會的網頁從 cloud 被擋，擋住就請使用者用瀏覽器查）。
    - **資料**：條目「===Countries===」表的 58 列（Country、Start year、Status、Scope），去掉 ref 與模板後解析；年份取 Start year 的第一個（英國寫 2030、2035、2040 取 2030；印度同時有 2034 年的政府計畫與 2040 年的宣言，取 2034）；新加坡依 Details 取 2030（2023 是公部門、2025 是柴油車）。
    - **狀態**：「EU regulation」與衣索比亞（2024 年起禁止進口燃油車）→ 已立法或已實施；只寫「Signatory of the Glasgow Declaration」（土耳其另外簽了卡車與巴士的宣言，也算）→ 只簽宣言；其他（政府計畫、氣候計畫、提案）→ 政策目標。表裡只有 19 個歐盟國家，其他 8 國（法、保、捷、愛沙尼亞、匈、拉脫維亞、羅、斯洛伐克）依條目的歐盟一節補上 2035 年、已立法，附註寫明；挪威依「Places with existing phase-out」一節補 2025 年、政策目標。結果 67 國：已立法 28、政策目標 21、只簽宣言 18。
    - **沒有宣布**：表裡沒有的國家寫代碼 0（類別「沒有宣布」，淺的中性色），跟沒有資料分開；國家清單用國家小檔案的 `government.json`。美國聯邦沒有，附註寫加州等州的 2035 年。
    - **畫法**：年份的類別用 `CategoryDef.max`（值存年份本身，tooltip 寫「2040 年」），`ordinal`；狀態不是強弱，用一般類別色。指標檔的 `hints` 寫狀態與範圍（汽油柴油車、所有會排放的新車、只有純汽柴油車…）。電動車主題不是 timeless，這兩個指標只有 2026 一年（`defaultYear: 2026`）。
    - **台灣（還沒解決）**：條目是 2040 年（引 2017 年 Taipei Times 報導的環保署計畫，2030 年公車與公務車、2035 年機車、2040 年汽車），照畫、附註寫出處；國發會淨零路徑的網頁從 cloud 回 Cloudflare 的驗證頁，沒有繞過，要請使用者用瀏覽器核對後再改。
190. **觀光鐵道與登山鐵路**（新主題，科技與交通類，排在纜車與索道後面，2026-10-30，製作手冊第六批 108；`pipeline/topics/heritage_railways.py`、`src/topics/heritage-railways.ts`、`src/topics/panels/HeritageRailwaysPanel.tsx`）：
    - **使用者決定**：照候選清單（Wikidata 的保存鐵路 Q420962、齒軌鐵路 Q378445、登山鐵路 Q1497019、森林鐵路 Q1202390，含子類別）。
    - **查詢**：P31/P279* 加上座標、年份、標籤的查詢在 query.wikidata.org 回 504，改用 QLever（https://qlever.dev/api/wikidata ，座標是大寫的 `POINT(…)`）；結果存進 `pipeline/.cache/wikidata/heritage-railways.json`。691 個項目（保存 516、齒軌 77、登山 18、森林 95，有重疊），有座標的 466 個才畫，國家依座標。
    - **種類**：同一條常屬於好幾類，點的顏色依齒軌 > 登山 > 森林 > 保存取一類（`k`），全部的種類存成位元（`all`），tooltip 與側欄列出。
    - **年份**：正式啟用日期（P1619）或啟用日期（P729），沒有的用成立時間（P571），1820 年以前的當成不詳（South Devon Railway 寫 1800 年）。保存鐵路的年份常是原本那條線的通車年份；停用日期也常是原本那條線停駛的年份，之後才改成保存鐵路，所以不依停用日期拿掉（跟纜車主題不同）。有年份的 223 條、不詳的 243 條（另一個圖層，預設關閉）。阿里山林業鐵路在 Wikidata 沒有年份，手工補 1912 年（`HAND_YEAR`）。
    - **指標**：觀光鐵道地圖（`kind: 'none'`，點依年份累積）、各國的條數（2026 年，含年份不詳的）。英國 117、美國 46、澳洲 43、德國 35、瑞典 25、瑞士 24。台灣 3 條：阿里山森林鐵路（1912）、羅東森林鐵道（1924）、太平山森林鐵路（年份不詳）。
191. **太空垃圾**（太空主題的擴充，2026-10-30，製作手冊第六批 109；`pipeline/topics/space.py`、`src/topics/space.ts` 的 `debris`）：
    - **使用者決定**：照候選清單（GCAT）。
    - **算法**：GCAT satcat.tsv 的 `Type` 第一個字是 R（火箭殘骸）、D（碎片）、C（零件）的物體，每年年底仍在軌道上（`DDate` 空白或在那年以後，跟在軌酬載同一個規則），依 `State`（碎片算在母體的擁有國，蘇聯算俄羅斯）。碎片的 `LDate` 是母體的發射日期，產生的年份改用 `SDate`（分離或解體的日期），風雲一號 C 的碎片才會在 2007 年出現，不是 1999 年。
    - **跟手冊不同**：手冊寫在軌 14,484 個，那是另外排除了 `Dest` 欄有值的 97 個（失聯的 LOST、標了目標軌道的 Transtage 等，`Status` 仍是在軌）；這裡跟在軌酬載一樣只看 `DDate`，2026 年 14,581 個（俄羅斯 4,908、美國 4,458、中國 4,441、法國 477）。
    - **資料更新**：重跑整個太空主題，GCAT 換成 2026-10-29 的版本（原本 10-17），在軌酬載、發射次數、發射場與側欄的檔一起更新。
    - **台灣**：State＝TW 的碎片 2 個，都已經再入，在軌 0（寫在台灣的附註）；中國的附註寫風雲一號 C 的碎片（2007 年編目 3,533 個中仍在軌 2,313 個）。
195. **唐人街**（新主題，國際類，排在移民與難民後面，2026-10-30，製作手冊第六批 113；`pipeline/topics/chinatowns.py`、`src/topics/chinatowns.ts`）：
    - **使用者決定**：照候選清單，Wikidata 加維基分區條目手工補。
    - **Wikidata**：唐人街 Q202509（含子類別）97 處、87 處有座標（跟手冊一致）。查詢服務 2026-10-30 限流到每分鐘一次，結果存在 `pipeline/.cache/wikidata/chinatowns-raw.json`，pipeline 先用快取。沒有國家（P17）的荷蘭三處依座標判斷國家（`geoindex.countries_at`）。名稱用 zh-tw、zh-hant 標籤（OpenCC 轉台灣用字），沒有的用英文；英文只寫「Chinatown」的加上所在城市。羅馬、達拉斯等 10 處沒有座標，不畫。
    - **依維基補 48 處**：歐洲、亞洲、非洲、大洋洲、拉丁美洲的條目裡寫明有唐人街或華人商店街的地方（例如里昂、塞薩羅尼基、沃爾卡科索夫斯卡、加爾各答、雅加達草埔、路易港、黃金海岸、巴拿馬市）；寫「沒有正式的唐人街」（雪菲爾、里茲、柏林）、只是被叫做唐人街（喀拉蚩）、已經消失（奧克蘭、威靈頓）或只有計畫的（杜拜、釜山）不收。座標取街區的 Wikidata 項目，沒有街區項目的用城市的（33 處，tooltip 寫「位置是城市的座標」）；3 km 內已有 Wikidata 的點就不補。美國、加拿大的條目列了上百處（多半是歷史上的），Wikidata 已經有 49 處，沒有另外補。點的顏色分 Wikidata 與依維基補的。
    - **國家的值**：收錄的處數（美國 35、加拿大 11、英國 6、馬來西亞 6……），不上色（`layer: none`）、不寫名次；說明寫明各國不能比。台灣 0 處（Wikidata 沒有、維基的亞洲條目不含中國、港澳與台灣、data.gov.tw 0 筆），寫「沒有收錄的唐人街」。
    - **沒有時間軸**：形成年份只有 25 處有，用 `timeless`。圖示 `lamp-ceiling`（像燈籠）。
196. **博弈的合法性**（法律與制度的擴充，2026-10-30，製作手冊第六批 114；`pipeline/sources/gambling.py`、`pipeline/topics/laws.py`、`src/topics/laws.ts`）：
    - **使用者決定**：類別圖（賭場合法、只准彩券等特許、全部禁止、各地不同）；台灣照法條（賭場違法、公益彩券 18 歲）。
    - **分類規則**：條目主要是最低年齡，依「Age」欄的文字分：「Illegal for all ages」加上賭場的括號或彩券、賽事的年齡（中國、泰國、土耳其、梵蒂岡、巴西……）或附註寫「except for the Government lottery」的算只准彩券等特許；只寫「Illegal for all ages」的算全部禁止（非營利的賓果、摸彩不算，例如美屬薩摩亞、巴林、馬紹爾）；寫「varies by state」「Dependent on State law」的算各地不同；只寫年齡的算賭場合法（條目沒有分賭場與彩券，**沒有逐國查證賭場是否真的存在**，例如北歐只有國營博弈的國家也在這類，說明寫明）。美國各州、加拿大各省的摺疊表不收。有一列的分隔寫成「|- This law is often not enforced」，古巴的國名在第二格，另外處理。
    - **另外判斷的（`OVERRIDES`，附註寫依據）**：台灣（條目寫 20 歲，跟法條不符：賭場違法，公益彩券 18 歲；離島建設條例第 10-2 條的專法沒有制定）、香港（條目寫有准許賭場的法律架構，但《賭博條例》只准賽馬、足球博彩、六合彩，改成只准特許）、日本（2018 年的綜合度假區法准許賭場、還沒開幕，算賭場合法）、印度（大多數地方禁止、各邦不同，算各地不同）、馬來西亞（穆斯林全面禁止，附註寫明）、美國、澳門。
    - **結果**：219 國：賭場合法 175、只准彩券等 12、全部禁止 29（多在中東、南亞與部分太平洋島國）、各地不同 3。有強弱順序，用 ordinal 的循序色，「各地不同」是法定年齡「禁止」那個灰色。資料只有 2026 年，指標的 `defaultYear` 是 2026。最低年齡沒有另外做成指標（手冊的已決定只有類別）。

## 9. 之後可以做的

**使用者決定不做的建議**（2026-10-29，第二輪「使用體驗、美化、效能」建議裡沒選的；之後不要再提，使用者改變主意才做）：
- **換到 Cloudflare Pages**：可以讓有雜湊的檔案永久快取、Brotli 再小 15–20%、每個分支有預覽網址；不做，照樣用 GitHub Pages（`max-age=600`、只有 gzip）。
- **實機量測、收集真實使用者的 Web Vitals**：這台機器用 SwiftShader 畫 WebGL，播放時 CPU 時間約 95% 在畫圖、網站程式（含 MapLibre）只約 3%，看不出低階手機的瓶頸；不做。
- **國家頁**（一個國家在所有主題的名次、強項弱項、跟鄰國比）：不做。
- **散佈圖檢視**（任選兩個指標、播放看各國移動，像 Gapminder）：不做。
- **排名表的「跳到台灣」**：手機排名表只改國名下面的英文名，不加這顆按鈕。
- **第一次造訪的引導**（點國家、拖時間軸、比較）：不做。
- **整包資料下載與資料說明頁**：不做（各指標的 CSV 下載照舊）。
- **分支的預覽部署**：不做。
- **錯誤回報與使用統計**（無 cookie 的統計）：不做，網站不送任何資料出去。
- **資料自動更新**（排程跑 pipeline、開 PR）：不做，各資料源的更新照下面各點手動跑。
- **資料搬出版本庫**（`public/data` 約 155 MB；獨立的資料 repo 用 submodule，或 GitHub Releases）：不搬。
- **整個網站大改**：「國家＋主題」雙主軸（首頁、國家頁、網址改成路徑）、故事模式（幾個畫面串成有說明的故事）、平台升級（換主機、預先產生每頁 HTML）都不做；每個主題自己的網址與預覽圖、嵌入模式另外做（見第 13 節）。

**第三輪沒選的建議**（2026-10-30；之後不要再提，使用者改變主意才做）：
- **下載歷年變化的影片**（時間軸播放錄成影片，附標題、年份與來源）：不做。
- **相似的國家**（側欄列出這個指標數值最接近、歷年走勢最像的國家）：不做。
- **小地圖並排**單獨做：不做，併進「分析」模式（同一指標的幾個年份或同一年份的幾個指標並排）。
- **截圖比對測試**（CI 替每個主題截圖跟上一版比）：不做。
- **資料檔格式檢查**（pipeline 產生的 JSON 在 CI 用 schema 驗證）：不做。
- **鍵盤瀏覽地圖**（方向鍵在鄰國間移動、螢幕閱讀器念出數值，無障礙檢查放進 CI）：不做。
- **簡體中文版**：不做。
- **安裝到主畫面後的捷徑**（長按圖示開常用主題、離線時標出已存到裝置的主題）：不做。
- **「我的地圖」**（使用者貼上自己的 CSV 畫成同樣風格的地圖）：不做。


**使用者打算做、時間由使用者決定的新主題**（2026-10-28 記下；使用者說要做之前不要動手；資料與授權 2026-10-28 查證過，詳細在製作手冊第十四節）：
- **運動賽事**：先做足球。
  - 世界盃最佳成績（類別圖：冠軍、亞軍、四強…）、參賽次數、國際賽戰績。
  - 用 1872 年以來的國際賽結果自己算 Elo 評分，播放各國的消長。
  - 資料：martj42 整理的國際足球賽結果（CC0）；世界盃名次用 jfjelstul/worldcup（CC BY-SA 4.0）；eloratings.net 沒有授權，不轉載數值，照它公開的公式自己算 Elo。其他運動要另外找有開放授權的資料。

- **石油、天然氣與煤**（第 90 點）：原油、天然氣的蘊藏量只有 Factbook 的 2021 年估計，有開放授權的歷年來源時再加（OPEC 年度統計公報的條款讀不到）；EIA 的天然氣、煤進出口可以做成指標（目前只在側欄）；流向檔可以改成依縮放或只存前 10 名來縮小（目前整個主題約 5.8 MB，超過「盡量小於 3 MB」；都是用到才下載，使用者 2026-10-28 決定先照現在）；台灣的 LNG 接收站可以對照中油、台電、台塑的官方中文名稱。
- **國旗**（第 84 點）：長寬比跟 Wikidata 不同的 6 面（貝里斯、柬埔寨、維德角、敘利亞、萬那杜、法羅群島）照 Commons 的圖檔，找到各國的法令後可以逐一確認；國旗改了（新的國旗法、政權更替）要 `--refresh` 重跑，`YEAR_FIXES` 也要跟著看；地圖上的國旗在世界全圖要下載約 200 個 SVG（gzip 後約 260 KB），可以改成一張預先畫好的小國旗拼圖（sprite），放大後才載入 SVG；顏色組成可以加「顏色數」的指標；新喀里多尼亞的兩面旗、阿森松與特里斯坦達庫尼亞的旗可以在側欄另外列出。
- **河流與流域**（第 86 點）：分區可以改成向量圖磚（MVT，依縮放級數各自簡化），更小的河也放得進 15 MB 左右的預算；流域的面（HydroBASINS 第 1–3 級）畫成淡色的面，滑過看整個流域的範圍；支流的名稱可以再用 Wikidata 的河口座標（P403、P625 的 P518 = 河口）補，Natural Earth 沒有的中型河流才有名稱；HydroSHEDS 第 2 版發布、確認授權後換新版（北緯 60° 以北的品質比較好）。
- **獨立或建國年份的地圖指標**：要有一致又中立的定義才做（第 82 點的 CShapes 2.0）。
- **晝夜與季節**（第 87 點）：可以加月相與月出月落（Meeus 第 47–49 章）、選地圖上任一點（不只首都）看日出日落；夜半邊可以疊上夜間燈光主題的燈光圖磚（晚上的城市亮起來）；大國可以改用人口加權的「全國平均」白天長度。
- **地球的另一邊**（第 89 點）：讓使用者自己在地圖上放成對的標記（這裡與它的對蹠點，記在網址裡，經過 `useUrlState`）；滑到國家時順便寫「這一國的哪個城鎮對著哪個城鎮」（populated places 兩兩配對）；北緯 85° 以北畫不出來的一圈可以用自訂的 WebGL 圖層補（跟晝夜的夜色一樣，`nightLayer.ts`）。
- **此刻的極光**（第 102 點）：SWPC 另有 3 天的極光預報與「地平線上看得到」的界線（view line，現在只有圖片），有 JSON 時可以加；Kp 指數可以加一張過去 7 天的小圖；可以記住使用者上次看的地方，開這個主題時直接轉到北極。
- **大航海時代的航海日誌**（第 103 點）：日誌裡每天的風向、風力與天氣可以畫成「那一年的風」（跟之後的風與季風主題對照）；滑過航線時可以寫那一天的日期與位置（每個頂點存日期，資料量約多一倍）；地名可以整理成中文對照表（出發地、目的地共 1,379 種寫法）；可以跟「航運與港口」的今天的航運密度並排比較。
- **氣候分區（柯本）**（第 104 點）：圖例或側欄滑到一種類型時只亮那一類（`classGridLayer.ts` 的 `look.only` 已經有，還沒接到圖例）；可以加 1 公里的版本（放大才下載的分區）；其他排放情境（SSP1-2.6、SSP3-7.0）可以加進子項目；可以跟氣溫與降雨主題的暖化網格並排比較。
- **冰河、海冰與海平面**（第 105 點）：WGMS 的 0.5° 冰河網格（global_grid.nc4）可以畫成每年的質量變化網格；海冰可以加每個月的邊緣（不只最少的那個月）與 3 月的最大範圍；海平面可以加 PSMSL 潮位站（授權確認後，台灣只有基隆、高雄且停在 1990 年代）；台灣可以對照中央氣象署或內政部的潮位站與地層下陷資料。
- **各國在讀什麼**（第 106 點）：每個月初跑一次 `npm run data -- reads` 加上新的月份（只下載還沒有的日子，舊的月份從快取讀；`MONTHS` 決定留幾個月）；可以加「每週」的時間軸（同一份每日資料）；多國同時居首的條目可以標出「疑似自動程式流量」（例如同一個月在 5 國以上排第一的英文條目），要先跟使用者確認規則；條目可以連到原文的維基百科頁面（側欄）；地圖上不寫的阿拉伯、天城文字可以等 MapLibre 支援複雜文字排版後再寫。
- **帝國與疆界**（第 107 點）：可以加更密的取樣（1800 年以前每 10 年，資料量約多 4 倍，要改成依時期分檔）；沒有中文名稱的 252 個政體可以逐一補（`ZH_NAMES`），也可以回報 Cliopatria 指錯的 Wikidata 編號；這個主題的底圖可以拿掉今天的國名（跟歷史的政體名稱混在一起）；殖民可以加日本、美國、俄羅斯、鄂圖曼的殖民地（要另找有授權的資料）。
- **板塊漂移**（第 108 點）：一打開時地圖對著那個時間點的盤古大陸（主題的初始視角，現在沒有這個設定，打開時對著台灣）；可以畫那時的海岸線與古地理（陸地、淺海、山地，例如 PALEOMAP，要先確認授權）；地震主題的今天的板塊邊界可以疊上來對照；側欄可以列出同一塊板塊上的其他國家；再往前到 10 億年前（模型有，要換時間軸的間隔）。
- **風與季風**（第 109 點）：可以加 850 hPa（約 1,500 m）的風，比較不受地形影響、季風更清楚；粒子改成在 GPU 上算（把位置存成貼圖），粒子數可以多十倍；可以跟颱風主題的路徑、大航海時代的航海日誌（日誌裡每天的風向與風力）對照；風能主題的風速網格可以共用粒子圖層；手機上可以量一下每幀的時間，太慢時自動減少粒子。
- **摩天大樓的 150、200 m 以上的國家指標**：Wikidata 的收錄（200 m 以上約 21%、中國約 9%）明顯改善後才做（`--refresh` 重跑會印出涵蓋率）；沒有完工年份的 189 個項目補上年份也能多算一些。OpenStreetMap 的 `height` 雜訊太多、沒有完工年份（第 83 點），要用得先有可靠的清理方法。

- **癌症發生率**：取得 IARC 書面授權後可以加 GLOBOCAN（只有 2022 年）；台灣有國健署的癌症登記。
- **台灣 2000–2007 年的死因**：衛福部的死因資料集有 ICD-9 的部分，轉成 GHE 的分類後可以往前延伸。

- **地球儀上的 3D**：等 MapLibre 的 `queryRenderedFeatures` 支援地球儀上的立體圖形，就可以拿掉「3D 時改用平面」的限制（`WorldMap.tsx` 的 `flatIn3d`）。海拔主題的立體地形已經可以在地球儀上用。
- **更精確的沿海低地**：GMTED2010 主要來自 SRTM（量到樹冠與建築），可以改用去除植被、建築的 DEM，但要先確認授權（例如 FABDEM 是 CC BY-NC-SA）。

- **框選的國內分布跟著年份變**：GHS-POP 有 1975–2030 每 5 年一期，可以依時間軸挑最近的一期（每期 gzip 後約 1.6 MB），1950 年代與 2100 年仍只能用最接近的一期。1 km 網格已經下載全部 12 期（第 14 節），框選可以共用同一套下載。
- **1 km 網格的格子數值**：tooltip 目前只顯示國家平均。要顯示游標下那一格的密度，可以讀圖磚像素的色號（只知道是哪一級），或另外輸出數值圖磚（例如 terrarium 那樣把數值編成 RGB）。
- **換期時淡入**：播放時間軸時每 5 年換一次圖磚，新圖磚到之前舊的留在畫面上，但沒有漸變。
- **地圖上的圓餅圖層**：在國家位置畫發電結構圓餅，在 `LayerSpec` 加 `kind: 'pie'`。
- **暖化的推估**：World Bank CCKP 的 CMIP6 多模式中位數沒有台灣，很多海外領地也沒有，推估年份的地圖會缺一塊，所以沒放（第 34 點）。可以自己從 CMIP6 的網格算各國的值，換算到 1951–1980 年的基準後接在暖化後面（`projectionFrom`）。
- **網路速度**：
  - 網格每年一期：現在只有 2026 年第 3 季，每期固網、行動合計約 3.3 MB，8 期約 26 MB。
  - Ookla 每季更新（通常季末後幾天到幾週）：明年第 3 季出來後，`internet_speed.py` 的 `YEARS` 加 2027、`internet_speed_tiles.py` 的 `PERIOD` 改成 (2027, 3)。`REMOVED` 的國家如果又出現，`check_removed()` 會報錯。
  - 台灣的官方量測：數位發展部 2024 年以後的 5G 量測結果還沒上傳到政府資料開放平臺，有了再加進 `tw_mobile_speed.py`。
- **開發者與開源**（第 80 點）：Innovation Graph 每季更新（datasheet 第 16、17 點：舊的季照樣留在新檔裡），用 `npm run data -- developers --refresh` 重抓；側欄的每季資料自動延伸，地圖要等 2027 年第 1 季才多一年。GitHub 若公布每個經濟體「有推送的開發者人數」，可以做各程式語言占比的地圖（現在沒有分母，第 80 點）；依個人檔案調整 VPN 的推送若變成每季、全部經濟體都有，可以加成指標，香港、新加坡、中國的扭曲會小很多。主題（topics.csv，各經濟體最多人用的版本庫主題，例如 llm、react）沒有用，可以加到側欄。
- **學術論文**（第 81 點）：OpenAlex 每天更新，2026 年結束後（2027 年初）把 `publications.py` 的 `YEARS` 改到 2026、`TOP10_LAST` 改到 2025（`publications.ts` 一起改，pipeline 會核對），加 `--refresh` 重抓（約 320 次查詢，匿名額度一天約 1,000 次）；高被引的 2017 年斷層 OpenAlex 修正後拿掉 `TOP10_BREAK`（pipeline 會提醒）。有金鑰（使用者自己申請）時可以做分數計數（要逐篇下載，group_by 做不到）、FWCI 的平均（OQL 的「mean FWCI」）、各學科的國際合著；國科會若把 SCI 論文篇數放上政府資料開放平臺，台灣的對照可以延伸到最近的年份。
- **PM2.5 網格**：WashU ACAG V6.GL.02.04 的 0.1° 年平均（CC BY 4.0，每年約 5 MB，Box 共用連結不必登入）可以照暖化網格的做法切圖磚；但國家的顏色是 WHO 的模型，兩者對不起來（台灣 2023 年 ACAG 21.3、WHO 沒有、測站 13.8 μg/m³），要做的話國家平均可能也要換成 ACAG（第 35 點）。
- **台灣的公共充電樁**：交通部只在新聞稿公布某個時點的數字，有官方的逐年（年底）統計後補上（第 37 點）。
- **地震死亡人數分國**：目前整筆算在震央附近的國家（2004 年海嘯全算印尼）。NOAA 的海嘯資料庫有各國的死亡人數，可以另外接。NOAA 記錄 1935-07-16 新竹的地震 2,746 人死亡，疑似錯值，找到官方數字（例如《昭和十年臺灣震災誌》）可以加一張更正表。
- **民主與自由的其他指數**：V-Dem 還有參與式、審議式、平等民主、公民自由、貪腐等指數，在 `democracy.py` 的 `INDICES` 與 `vdem.INDEX_COLUMNS` 各加一行即可。
- **台灣的人均飲酒量**：財政部的菸酒稅有些酒類依酒精度課稅，可以從課稅數量或稅收推算純酒精；啤酒、料理米酒依公升課稅，要假設酒精濃度，料理米酒多半拿來做菜，也要決定算不算（第 50 點）。
- **監禁人口率的涵蓋範圍**（2026-10-25 起只收有開放授權資料的 44 國，第 43 點）：
  - 英國 2018 年以後：英格蘭與威爾斯（MoJ 的 Offender management statistics quarterly，gov.uk 的 content API 列得出附件）、蘇格蘭（蘇格蘭政府的 Scottish Prison Population Statistics）、北愛爾蘭（司法部的 Northern Ireland Prison Population），都是 OGL v3；要三個加起來，參考日不同要寫明。
  - 其他有開放授權資料的國家再加：在 `crime.py` 的 `_prison()` 加一個來源，`PRISON_COVERAGE` 跟著改（`crime.py` 會檢查）。紐西蘭（Corrections 是 CC BY-NC-ND）、南韓（沒有開放授權標示）目前不能用（第 12 點）。
  - UNODC 資料入口恢復可以轉載的資料條款（或有開放授權的轉載版）後，可以改成全球的資料，各國的來源留著對照。
  - 台灣 2014 年以前：法務統計資訊網只有 113、114 年版的年報；更早的年報（網路封存或圖書館）的表 4-1 可以往前接。
- **台灣的外交**：館處用實際地址定位（目前是城市中心，要地址等級的開放 geocoder）；簽證待遇的歷史（領務局只有最新的 PDF，舊版要從網路封存找）；互設代表處的年份、館處的設立與裁撤（外交年鑑有逐年的館處名單，要從 PDF 整理）。
- **諾貝爾獎依國籍或得獎時的機構**：API 有 `affiliations`，國籍要另外查 Wikidata 的 P27（雙重國籍要定規則）；也可以加女性得主、得獎年齡。
- **貿易流向的固定比例尺**：目前線寬以選取國家最大的夥伴為準，方便看單一國家的結構；如果要跨國比較，可以改用同一商品、同一年所有雙邊流量的最大值。
- **全部商品往前延伸**：BACI 的 HS92 版從 1995 年開始，但 zip 有 2.4 GB，讀完約要 6 分鐘。
- **夜間燈光**：每年一期的網格（12 期約多 200 MB，要先確認 GitHub Pages 的 1 GB 上限）；漁船要用 EOG 的未遮罩年平均或 VIIRS Boat Detection（都要登入，找到不必登入的轉存再加）；2016 → 2017 年的斷層找到原因（或 EOG 重新處理的版本）後可以拿掉 `methodBreak`；側欄加城市層級（要有開放授權的都會區範圍，例如 GHSL 的 Urban Centre Database，CC BY 4.0）。
- **房價與居住負擔**（第 66 點）：BIS 詳細的住宅價格（WS_DPP）還有阿聯、阿根廷、沙烏地阿拉伯，可以再補（要挑序列、確認各國來源）；OECD 與 BIS 差很多的國家（中國、加拿大、俄羅斯）可以查兩邊的原始序列再決定用哪一個；台灣的房租可以加內政部實價登錄的租賃資料（「租金統計資訊」），跟消費者物價的房租對照；有開放授權、口徑一致的跨國「房價是幾年所得」時，可以加一個水準的指標。
- **城市**（第 67 點）：整套換成 GHS-WUP R2025（配合 WPP 2024、推估到 2100 年，跟聯合國《世界都市化展望 2025》同一份），城市的 ID 不相容，點與國家統計要一起換；放大後畫城市的範圍（MTUC 的多時期多邊形 76 MB，要簡化、分期切圖磚，先確認 1 GB 的上限）；點的顏色依成長率分級（`epochs.values` 多算一個欄位就好）；台灣 4 個沒有中文名稱的城市（Dazhuang、Gonghuakeng、Ô-á-liâu / Kezihliao、Xinying District）可以在 Wikidata 補上人口或別名後重跑。
- **學生能力（PISA）**（第 68 點）：向 OECD 確認 2024 年 7 月以前的 PISA 報告可以照 CC BY 4.0 轉載後，用 PISA 2022、2018、2015、2012 各冊附錄的趨勢表補上沒有參加 2025 年的國家（俄羅斯、上海、列支敦斯登、巴拿馬、牙買加…），早年的名次才會跟官方一樣；「比上一次」可以依表裡的標準誤只標出顯著的變化；PISA 2025 之後幾冊（社經地位、學習環境）與新的「數位時代的學習」（運算式問題解決，台灣 551 分第 5）可以再加指標。
- **婚姻與家庭**（第 69 點）：初婚年齡、有偶比例在聯合國 World Marriage Data 2019 以後沒有更新；有新版（或各國統計局的開放資料，例如德國 Destatis、新加坡 SingStat）時可以補到 2020 年代。中國的結婚登記（民政部）沒有開放授權的轉載版，目前是灰色。粗結婚率可以用各國自己的年中人口（Demographic Yearbook 的做法）代替 WPP。同性伴侶的法律地位有國家修法時要改 `same_sex_unions.py`（例如波蘭、日本、立陶宛的立法）。
- **疫苗與防疫**（第 70 點）：od.cdc.gov.tw 連得上時，改讀疾管署開放資料的「各項預防接種完成率統計」CSV（2022–2025 年縣市別，含 MMR 第二劑），台灣的麻疹第二劑可以補上，`cdc_tw.KNOWN` 也可以跟 CSV 核對；WHO/UNICEF 有公布各國零劑兒童人數的開放授權檔案時，改用官方的人數（現在是用整數的 DTP1 接種率自己算）；國健署有依年份、第一劑的 HPV 接種率時可以補上台灣；WHO 免疫資料入口確認是 CC BY 4.0 後，可以改用它的整包 Excel（1980 年起，不必接世界銀行），也可以加 BCG、B 型肝炎、肺炎鏈球菌、輪狀病毒等其他疫苗；COVID-19 的資料都已停止更新，之後不必重跑。
- **平均身高**（第 71 點）：NCD-RisC 確認身高估計的資料授權（或在 Zenodo 等地方以 CC 授權發布）後更新第 12 點的標示；有 2020 年以後的成人身高新版時，成人的出生年可以延伸到 2000 年代；19 歲以外的年齡（5–18 歲，同一個 zip 裡都有）可以加成子項目；側欄的折線可以加 95% 不確定區間的色帶（ECharts 的折線堆疊）。教育部國民及學前教育署的「學生身高平均值」（6–15 歲，data.gov.tw）可以拿來對照 NCD-RisC 的學齡兒童身高。
- **野火的火點密度網格**：NASA FIRMS 的每年火點彙整成 0.25° 網格、每年一期，照暖化網格的做法部署時產生（要先確認每年的國家檔不需 MAP_KEY，並量下載量與部署時間）。
- **發電廠的狀態用不同樣式**：四個狀態的圖層顏色相同，同時打開時只能靠 tooltip 分辨；點圖層可以加外框樣式（例如興建中空心、已退役灰色），要改共用的點圖層引擎。
- **颱風的中央氣象署強度**：路徑目前一律用美國機構的 1 分鐘平均風速；可以加一個子項目改用 IBTrACS 裡日本氣象廳（RSMC 東京）的 10 分鐘平均，跟中央氣象署的分級比較接近（只有西北太平洋）。
- **航運與港口**（第 76 點）：UNCTAD 的港口靠港與在港時間有台灣、更多國家時加成指標；PLSCI 對不到 World Port Index 的港口（倫敦門戶港、巴拿馬的曼薩尼約、多明尼加的 Caucedo、巴西的 Itapoa、印度的 Vizhinjam…）可以用 UNECE 的 UN/LOCODE 座標補點（先確認授權）；林查班、蓋梅等港有官方的年吞吐量時加進 `port_teu.py`，每年 1–3 月各港公布新的一年後更新；航運密度若 GitHub Pages 的空間夠，可以多做 z5（約多 9 MB），或拆成商船、漁船、客輪（世界銀行同一個資料集有分船種的檔）。
- **海洋與漁業**（第 77 點）：海洋保護區的比例等授權清楚（WDPA 或 Protected Planet 明示可以轉載）再加；專屬經濟海域可以改成填色的疊加圖層（重疊主張區斜線、滑過海面就知道是哪一國的海域），要在共用的疊加圖層引擎加一種面的圖層；FAO 每年 3 月出新版（2027 年 3 月會有 2025 年），改 `fishstat.URL` 的版本號；漁業署每年年中出新的年報，改 `fa_tw.URL`；物種層級的中文名稱（FAO 的物種表只有簡體中文，要另外對照）。
- **縮減資料量**：指標檔已經壓縮（第 3 節）。還可以做的：
  - 農業與工業的國家明細檔（`countries/<ISO3>.json`，共約 12 MB，點國家才載入）可以只保留近 30 年，或也改成差分編碼。
  - 貿易流向檔（`trade/flows/`）、框選網格（7.5 MB，gzip 後 1.6 MB）可以改成整數、差分編碼。
  - 鐵路（gzip 後約 300 KB）可以依縮放分成兩層，全球視角只載入主要幹線。

## 10. 開發注意事項

- **無障礙（axe）**（2026-10-29 修；在頁面載入 axe-core 跑 `axe.run()` 檢查）：
  - **文字對比**：淺色模式的 `inkMuted` 從 #898781 加深到 #73716b（時間軸刻度、附註、數值卡片的名次等 11–12px 的字對背景從 3.4:1 變 4.6:1）；連結色（「更多」等）另外一個 `accentText` #2470cc（主色 #2a78d6 當文字只有 4.2:1），深色模式照用主色。
  - **地圖不是 `role="img"`**：外框原本是 `role="img"` 加說明，但裡面有 MapLibre 可以用 Tab 移進去的 canvas 與按鈕（圖片裡不能有可聚焦的東西，nested-interactive）。說明改寫在 MapLibre 的 canvas 上（它本身是 `role="region"`）。
  - **landmark**：控制列、指標說明、地圖、時間軸都包在 `<main className="app-main">`（`display: contents`，不影響版面；原本 `<main>` 只有地圖那一塊），頂列是 `<header>`、頁尾是 `<footer>`。
  - 「加入比較」按鈕看得到的字要包含在名稱裡（label-content-name-mismatch）：「＋」改成 `aria-hidden` 的另一個 span。

- **GitHub Actions 的「檢查」**（`.github/workflows/check.yml`，2026-10-29 加）：每次推送（任何分支）與 PR 都跑 `check:i18n`、主題目錄比對（`npm run catalog -- --check`）、`npm run build`（含型別檢查）與冒煙測試（`npm run smoke`，`scripts/smoke-topics.mjs`：每個主題打開一次，有頁面錯誤或主控台錯誤就失敗，約 10–15 分鐘）。不擋部署，失敗時 commit 旁是紅色的叉。好幾個工作同時推到 main，合併時容易漏掉別人的主題（例如 `topics/registry.ts` 衝突）或改壞共用的程式，推之前本機也可以跑 `npm run build && npm run smoke`（`SMOKE_TOPICS=a,b` 只開幾個）。
- **App.tsx、WorldMap.tsx 拆檔**（2026-10-29，行為不變）：兩個檔原本各約 1,350、2,700 行，改一個地方要在一大片程式裡找。
  - `App.tsx`（約 840 行）只留畫面狀態的組合與版面；不依賴 App 狀態的 hook 與小工具搬到 `src/app/`（`hooks.ts`、`overlays.ts`、`options.ts`），頂列與頁尾是 `TopBar.tsx`、`Footer.tsx`。
  - `WorldMap.tsx`（約 1,700 行）留地圖的建立、圖層的安裝與同步、控制項；常數、圖層定義與小工具在 `worldMapLayers.ts`，滑鼠與觸控事件在 `mapEvents.ts`（`bindMapEvents`，事件在地圖建立時綁一次，最新的 props 從 `latest` ref 讀），國家的上色與漸變在 `useCountryFills.ts`，網格、國旗等點陣圖層在 `useRasterLayers.ts`，tooltip 在 `MapTooltip.tsx`。拆出來的 hook 拿 `MapContext`（地圖的 ref、圖層裝好了沒、`ready`、`revision`），跟原本在 WorldMap 裡一樣依它們重跑。
  - `src/app/` 在首頁的 bundle 裡，對 `WorldMap.tsx` 只能 `import type`（見下面「不要在首頁的 bundle 引入 MapLibre」）；拆檔前後首頁 chunk 只差 0.5 KB（未壓縮）。
  - 驗證：`tsc`、建置、17 個用到各種疊加圖層的主題的冒煙測試、滑過與點選國家、框選、指令面板、深淺色、嵌入模式、氣候分區的 pointer tooltip。
- **world-atlas 的國界是給 D3 球面幾何用的**：
  - 跨 180° 經線的國家（斐濟、俄羅斯遠東）座標會從 179.9 跳到 −179.9。
  - MapLibre 把座標當平面處理，會畫出橫越整個地圖的邊。
  - `geometry.ts` 的 `unwrapAntimeridian()` 把經度展開成連續的。
- **WebGL 地圖在隱藏的瀏覽器分頁不會繪製**：
  - MapLibre 會等畫面更新（requestAnimationFrame）才處理樣式與繪製，分頁隱藏時會停住。
  - 自動化測試要用可見視窗，或用無頭 Chrome（puppeteer-core 搭配系統的 Chrome，加上 `--use-angle=swiftshader`）。
  - 開發模式下 `window.__map` 是地圖物件，方便在主控台檢查。
- **匯出地圖圖片**（`src/map/exportImage.ts`）：
  - WebGL 畫布沒有開 `preserveDrawingBuffer`：開了之後每一格都要多複製一次緩衝區，平常拖曳、縮放都會變慢。
  - 所以只在匯出時呼叫 `triggerRepaint()`，在 `idle` 事件裡把畫面複製到 2D 畫布。MapLibre 的 `idle` 是在圖磚都載入完的那一格畫完後、同一個呼叫裡觸發的，這時緩衝區還沒被清掉。圖磚 10 秒內載不完就改用下一次 `render` 的畫面。
  - 匯出時把像素比例暫時調到至少 2 倍（`setPixelRatio`），圖片在高解析度螢幕上看也清楚，複製完立刻還原。
  - 太空的部分在 WebGL 畫布上是透明的（畫面上靠 CSS 背景），匯出時先畫同樣的放射漸層。
  - 標題、圖例、來源都畫在 2D 畫布上；圖例的版面（`choroplethLegendModel`、`bubbleLegendModel`、`LAYER_KEYS`）跟畫面上的圖例共用，改圖例時兩邊會一起變。
  - 驗證要實際產生圖片：用無頭 Chrome（同上）點「分享 → 下載地圖圖片」，用 CDP 的 `Browser.setDownloadBehavior` 指定下載資料夾，再打開檔案看。
- **Vite 讀到寫到一半的檔案**：
  - 用腳本連續改同一個檔案時，Vite 偶爾會在檔案寫到一半時讀進來並快取住，瀏覽器出現「does not provide an export named …」。
  - 用 `touch` 該檔案重新觸發轉換即可。
- **開發伺服器不監看 `public/tiles`**（`vite.config.ts` 的 `server.watch.ignored`）：
  - 網格圖磚有 8 萬多張（人口 6 萬、暖化 2.4 萬）。監看的話，產生圖磚時每一張都會觸發一次檔案事件（Vite 對每個事件跑外掛的 `watchChange`、查模組圖），2026-10-23 產生暖化圖磚時開發伺服器整個停住，連首頁都 60 秒沒有回應。
  - **重新產生圖磚後要重開開發伺服器**：Vite 啟動時列出 `public/` 的所有檔案，只提供清單裡有的，之後靠監看的新增、刪除事件更新清單。圖磚網址含版本，重新產生（改了門檻、顏色或程式）會寫到新版本的資料夾，`meta.json` 卻是覆寫同一個檔，所以前端會去拿清單裡沒有的新圖磚：Vite 回的是首頁的 HTML（HTTP 200，實測），MapLibre 解不出圖片，網格整片空白。
  - 建置、部署、`npm run preview` 都不經過監看，不受影響；`public/` 的檔案本來就不會觸發熱更新。
  - `public/data` 雖然有監看，開發伺服器啟動後 pipeline 才建立的新資料夾（例如野火主題第一次產生的 `countries/`）也常常拿到首頁的 HTML（2026-10-23 實測），一樣重開開發伺服器就好。
- **好幾個分工同時在一個 worktree 裡開發**（2026-10-23 新增颱風、發電廠、太陽能與風能、野火四個主題時）：先把四個主題的佔位設定檔註冊進 `TOPIC_GROUPS` 與 `run.py`，每個分工只改自己主題的檔案，共用的檔（`types.ts`、`src/map/*`、`App.tsx`、`common.py`、`deploy.yml`、文件）由一個人整合；各自用不同埠開開發伺服器（5190–5194）。`npx tsc` 會看到別人寫到一半的錯誤，只修自己的。
- **換 MapLibre 版本後**：要刪掉 `node_modules/.vite` 再重啟開發伺服器，否則 Vite 會沿用舊版的預先打包檔。
- **Service worker 只在正式版註冊**：
  - `npm run dev` 不會有快取問題。
  - 要測離線、快取，用 `npm run build` 再 `npm run preview`。
  - 瀏覽器開發者工具的 Application → Service workers 可以勾「Update on reload」或「Offline」。
  - 改了 `src/sw.ts` 或快取策略之後，要實際跑一次「部署更新」流程（第 13 節）。
- **不要在首頁的 bundle 引入 MapLibre**：`maplibre-gl` 只能從 `src/map/WorldMap.tsx`（或它引入的模組）import，其他地方需要型別就用 `import type`。否則地圖程式會跑回首頁 chunk，第一個畫面在手機上會慢好幾秒。
- **MapLibre 的 CSS 例外，要留在首頁**（`main.tsx`，排在 `styles.css` 前面）：
  - `styles.css` 有些規則要蓋過它，例如 `.map-canvas` 的絕對定位要蓋過 `.maplibregl-map { position: relative }`。
  - 如果跟著地圖 chunk 晚載入，順序反過來，地圖容器變成 0 高度，整張地圖看不見。
  - 這時 `map-data` mark 照樣會出現，所以改了載入方式後一定要截圖看。
- **主控台的「Expected value to be of type number, but found null instead.」**：放大到 6 級左右就會出現，人口主題、純地圖頁也有，是底圖樣式本身的運算式，跟我們的圖層無關，不影響畫面。
- **分享預覽圖**（`index.html` 的 Open Graph 標籤與 `public/og-image.jpg`，2026-10-27 加）：LINE、Facebook、X 的爬蟲不跑 JavaScript，2026-10-29 以前 GitHub Pages 每個網址（`?topic=…`）都回傳同一份 HTML，全站只有一張預覽圖；現在每個主題有自己的網址與預覽圖（第 13 節「每個主題的網址、預覽圖與嵌入」），這一張是網站首頁的。圖是 1200×630：左邊網站名稱與六個分類，右邊一顆以人均 GDP 上色的地球，下方寫底圖與國界的出處（OpenStreetMap 的授權要求地圖圖片寫出處）。主題數、分類改了之後用 `node scripts/og-image.mjs [網址]` 重新產生（無頭 Chrome，跟 `check:en` 一樣要 puppeteer-core；卡片的中文用系統字型，在 Windows 上產生）。網址要寫完整的 `https://skywitness.github.io/map/…`，相對路徑爬蟲不認。
- **檢查 3D 時**：開發模式下用 `__map.queryRenderedFeatures(point, { layers: ['extrude-countries'] })` 確認點得到。地球儀上它會回傳空陣列（見第 5 節「3D 立體地圖」），換 MapLibre 版本時可以用這個方法確認限制是否還在。立體地形用 `__map.getTerrain()` 看倍率，用 `__map.project([經度, 緯度])` 換成畫面座標再查 `data-fill`，確認地形上點得到國家。

## 11. 主題選單、搜尋、快捷鍵與手機操作

介面文字（搜尋、快捷鍵說明、抽屜、分享選單）集中在 `src/lib/strings.ts`，中英文寫在同一個檔（`defineMessages`），元件用 `useUI()` 取目前語言的那份。

**主題分類選單**（`src/controls/TopicNav.tsx`，分類寫在 `src/topics/registry.ts` 的 `TOPIC_GROUP_SPECS`）：
- 主題多到 16 個以後，1280px 寬的筆電放不下一整排按鈕，最後幾個主題被擠到畫面外、又沒有捲動提示。改成「純地圖」一顆按鈕加分類：社會、經濟、國際、能源、科技與交通、地理（英文 People、Economy、Global、Energy、Tech & transport、Geography）。
- 每個分類是一個下拉選單，列出主題名稱與前三個指標（讓人知道主題裡有什麼）。一類超過 7 個主題就分欄（最多 3 欄，`TopicNav.tsx` 的 `menuStyle`），由上往下排完一欄再排下一欄，↑↓ 的順序跟畫面一致；手機上維持一欄、捲動。目前主題所在的分類會亮起，按鈕上顯示「分類 · 主題」。
- 分類名稱要短：中文 1024px、英文 1280px 寬時整列都放得下。
  - 語言主題加入第六類「地理」時，原本的名稱放不下（英文最多超出 134px、中文 118px；加入前英文選人口時就已超出約 6px），所以把「人口與社會」改成「社會」（People）、「能源與氣候」改成「能源」（Energy），新的分類只叫「地理」（Geography），按鈕左右留白從 12px 改成 10px。
  - 量法：無頭 Chrome 逐一切到每個主題（目前的分類會多顯示主題名稱），量 `.topics` 裡按鈕寬度加間距的總和。現在（36 個主題）英文 1280px 最寬 863px（可用 871px，選水資源與森林時；其次是薪資與工時 860px。「Savings & wealth」「Prices & budgets」會超出，所以短名稱用 Wealth、Prices & debt），中文 1024px 最寬 644px（可用 650px，也是選水資源與森林時；五個字的主題是 628px）。
  - 環境與能源加入氣溫與降雨、空氣品質、水資源與森林、電動車 4 個主題時（2026-10-23），考慮過把「能源」改成「能源與環境」（Energy & env.）：分類名稱英文多 51px、中文多 48px，選哪個主題都會超出（英文最寬 914px、選農業時也有 879px；中文最寬 692px，選經濟類五個字的主題時也有 676px），所以維持「能源 / Energy」。英文的主題名稱也取短的（Temperature、Air quality、Water & forests、EVs）。
  - 英文的主題短名稱最多約 11 個字元：「Earthquakes & volcanoes」超出 66px、「Taiwan's diplomacy」超出 19px，所以頂列寫 Earthquakes、Taiwan ties（完整的 `title` 不受限制）。
  - 國際加入護照與簽證、武裝衝突、國際組織、聯合國投票（2026-10-23，同一天社會也加了生育率與高齡化、治安與司法、幸福感，共 43 個主題；國際有 10 個，選單分兩欄）：英文短名稱 Passports、Conflict、Int'l orgs、UN votes 都在 11 個字元內，選到它們時英文 1280px 最寬 816px、中文 628px（五個字，跟其他五個字的主題一樣），沒有超出。這四個主題的指標名稱也量過：1280px 寬時控制列都是一行，只有聯合國投票「與各國的一致度」的英文版多一個「Compared with」選單，換成兩行（民主與自由、台灣的外交的英文版原本就是兩行）。
  - 經濟加入就業與失業、外匯存底與外債、股市規模、關鍵礦產，科技與交通加入半導體（2026-10-23；經濟有 11 個主題，選單分欄）：英文短名稱 Jobs、FX reserves、Stocks、Minerals、Chips，選到它們時英文 1280px 最寬 829px（FX reserves）；中文最寬 628px（五個字）。「外匯存底與外債」七個字會超出，所以中文短名稱是「外匯與外債」（完整的 `title` 不變）。
  - 能源加入發電廠地圖、太陽能與風能潛力，地理加入颱風與颶風、野火（2026-10-23，能源 8 個；地理連同同一天加入的旅行實用共 6 個）：英文短名稱 Power plants、Solar & wind 是 12 個字元，但比 Water & forests 短，選到它們時英文 1280px 最寬 841px、Cyclones 與 Wildfires 810px；中文 1024px「太陽能與風能」644px（六個字，跟水資源與森林一樣）、颱風與颶風 628px、發電廠 596px、野火 580px，都沒有超出（可用 871px、650px）。
  - 科技與交通加入海底電纜、太空、交通安全，地理加入世界遺產、旅行實用，社會加入奧運（2026-10-23；科技與交通 8 個、地理 7 個，社會 15 個，科技與交通、社會分欄）：英文短名稱 Cables、Space、Road safety、Heritage、Travel、Olympics，選到它們時英文 1280px 最寬 832px（Road safety，可用 871px），中文 1024px 最寬 612px（四個字的主題，可用 650px），都放得下。
  - 地理加入夜間燈光（2026-10-26，地理 8 個主題，選單分欄）：英文短名稱 Night lights（12 個字元），選到它時英文 1280px 寬 833px（可用 871px），中文 1024px「夜間燈光」612px（可用 650px），控制列在兩種寬度都是一行（指標 6 個，用下拉選單）。
  - 經濟加入房價與居住負擔（2026-10-26，經濟 12 個主題，選單分欄）：短名稱「房價」、House prices（12 個字元），選到它時英文 1280px 寬 817px（可用 871px），中文 1024px 556px（可用 650px）。控制列是 5 個指標按鈕：中文 1280px 一行；英文原本是 Real prices, 10y、Real prices, 5y、Real rents, 5y，指標 629px 加右邊 616px 換成兩行，改成 Real price 10y、Real price 5y、Real rent 5y（596px）就是一行。中文 1024px 時控制列是兩行，跟股市規模、存款與財產、治安與司法一樣（那個寬度右邊的底圖、搜尋、地圖／排名表、分享本來就放不下）。
  - 社會加入城市（2026-10-26，社會 16 個主題，選單分欄）：短名稱「城市」、Cities，選到它時英文 1280px 寬 760px（可用 871px），中文 1024px 556px（可用 650px）。控制列是指標下拉選單（6 個指標），中文 1024、1280px 與英文 1280px 都是一行（左邊的下拉選單 34px 高、右邊的按鈕 36px，用元素的 top 數列數時會差 1px，實際是一行）。
  - 社會加入學生能力（PISA）（2026-10-26，社會 17 個主題，選單分欄）：短名稱「學生能力」、PISA，選到它時英文 1280px 寬 753px（可用 871px），中文 1024px 588px（可用 650px）。控制列是科目與指標兩個下拉選單（6 個指標），中文 1024、1280px 與英文 1280px 都是一行；英文的指標名稱取短的（Change since last cycle、Change since 2012、Gender gap）。
  - 社會加入婚姻與家庭（2026-10-26，社會 18 個主題，選單分欄）：短名稱「婚姻與家庭」、Marriage，選到它時英文 1280px 寬 788px（可用 871px），中文 1024px 604px（可用 650px，五個字）。控制列是指標下拉選單（9 個指標），中文 1024、1280px 與英文 1280px 都是一行。
  - 社會加入疫苗與防疫（2026-10-26，社會 19 個主題，選單分欄）：短名稱「疫苗與防疫」、Vaccines，選到它時英文 1280px 寬 784px（可用 871px），中文 1024px 604px（可用 650px，五個字）。控制列是指標下拉選單（8 個指標），中文 1024、1280px 與英文 1280px 都是一行；英文的指標名稱取短的（COVID-19 confirmed deaths、COVID-19 primary series、Excess deaths (estimate)）。確診死亡與超額死亡的指標說明在 1280px 是兩行。
  - 社會加入平均身高（2026-10-26，社會 20 個主題，選單分欄）：短名稱「平均身高」、Height，選到它時英文 1280px 寬 770px（可用 871px），中文 1024px 588px（可用 650px）。控制列是指標下拉選單（7 個指標），中文 1024、1280px 與英文 1280px 都是一行（英文最長的「Change since 1896, women」也是）。時間軸的年份上面多一行小字「出生年」（19 歲的指標是「年份」），時間軸那一列沒有變高。
  - 國際加入政府治理（2026-10-26，國際 11 個主題，選單分兩欄）：短名稱「政府治理」、Governance（10 個字元），選到它時英文 1280px 寬 834px（可用 871px），中文 1024px 612px（可用 650px）。控制列是指標下拉選單（6 個指標），中文 1024、1280px 與英文 1280px 都是一行；英文最長的「Government effectiveness」「Voice and accountability」也是。
  - 科技與交通加入網路速度（2026-10-27，科技與交通 10 個主題，選單分欄）：短名稱「網速」、Net speed，選到它時英文 1280px 寬 797px（可用 871px），中文 1024px 556px（可用 650px）。控制列是「網路」子項目選單加 3 個指標按鈕：上傳、延遲在中文 1024px（左邊 374–402px，加右邊 569px）與英文 1280px（左邊 551–570px，加右邊 616px）都是一行；下載速度多一個「國家中位數／約 2 km 網格」切換鈕，在中文 1024px（左邊 597px）、英文 1280px（845px）是兩行（跟人口密度一樣），中文 1280px 是一行。原本還有第 4 個指標「測試次數」，上傳、延遲在英文 1280px（683px）、中文 1024px（466px）也會換行，所以測試次數只放在側欄；英文的子項目原本是 Fixed broadband（選單 234px，上傳的控制列只剩 2px），改成 Fixed-line（187px）。
  - 科技與交通加入開發者與開源（2026-10-27，科技與交通 11 個主題，選單分欄）：短名稱「開發者」、Developers（10 個字元），選到它時英文 1280px 寬 829px（可用 871px），中文 1024px 596px（可用 650px）。控制列是指標下拉選單（6 個指標），中文 1024、1280px 與英文 1280px 都是一行（最長的「Flows: contributors from abroad」也是）。
  - 科技與交通加入學術論文（2026-10-27，科技與交通 12 個主題，選單分欄）：短名稱「學術論文」、Papers，選到它時英文 1280px 寬 794px（可用 871px），中文 1024px 612px（可用 650px）。控制列是「領域」子項目選單加指標下拉選單（6 個指標），中文 1024、1280px 與英文 1280px 都是一行（英文最長的「International co-authorship」與子項目「Physical sciences」也是）。
  - 地理加入國家小檔案（2026-10-27，地理 10 個主題，選單分欄，排在第一個）：短名稱「國家小檔案」、Country facts（13 個字元，比 Night lights 長 1 個字元），選到它時英文 1280px 寬 845px（可用 871px），中文 1024px 628px（可用 650px，五個字）。控制列是 4 個指標按鈕（政體形式、貨幣、陸地鄰國數、內陸國），中文 1024、1280px 與英文 1280px 都是一行。
  - 地理加入國旗（2026-10-27，地理 12 個主題，選單分欄，排在國家小檔案後面）：短名稱「國旗」、Flags，選到它時英文 1280px 寬 782px（可用 871px），中文 1024px 580px（可用 650px）。控制列是指標下拉選單（7 個指標），「占國旗面積」「圖案」多一個子項目選單（「顏色」「圖案」，指標自己的 `dimension`），中文 1024、1280px 與英文 1280px 都是一行。
  - 地理加入日食路徑（2026-10-28，地理 15 個主題，排在同一天加入的晝夜與季節後面）：短名稱「日食路徑」、Eclipses，選到它時英文 1280px 寬 806px（可用 871px），中文 1024px 616px（可用 650px）。控制列是 4 個指標按鈕（日食路徑、日全食次數、日環食次數、下一次日全食），中文 1024、1280px 與英文 1280px 都是一行。
  - 新增分類或主題後再量一次。再窄就讓主題列橫向捲動，放不下時（`is-overflowing`）右緣淡出提示後面還有；手機上打開頁面或換主題時，目前的分類會自動捲進可見範圍。
  - **放不下時先收緊**（`TopicNav.tsx` 的 `compact`，2026-10-30）：2026-10-29 加了分類圖示後，英文在 1280px 寬要 958px、只有 874px，「Geography」被切掉一半。現在依序收緊三級：按鈕左右留白 10 → 7px、間距 4 → 1px（`.is-compact-1`）→ 拿掉沒選到的分類的箭頭（`-2`）→ 拿掉它們的圖示（`-3`），用最寬鬆而放得下的那一級；三級都放不下（手機）就照原樣橫向捲動。每一級需要的寬度量過就記著（第一個到最後一個看得見的按鈕），換語言、換主題時重量。實測：英文 1280px 用第 1 級、1100px 用第 3 級，中文 1280px 不收緊、1024px 用第 1 級。
- **圖示與「看全部主題」**（2026-10-27 加縮圖，2026-10-29 改成圖示）：選單的每個主題左邊有一個圖示，最下面一項是「看全部主題」（`menuitem`，↑↓ 也移得到；`check:en` 只點 `menuitemradio`，不受影響）。
  - **分類代表色**（`tokens.ts` 的 `CATEGORY_COLORS`，2026-10-29）：社會玫瑰紅、經濟琥珀、國際藍、能源綠、科技紫、地理青綠，頂列分類按鈕的圖示、選單的圖示、主題總覽的分類標題與縮圖角標都用同一組。CSS 變數 `--cat-<分類>`（線條，深淺色各一組）與 `--cat-solid-<分類>`（白色圖示的底，深淺色都用淺色那組），元件用 `TopicIcon.tsx` 的 `categoryStyle(分類)` 設成 `--cat`、`--cat-solid`。顏色只標示分類，一定跟分類名稱、圖示一起出現，文字照用 ink；用配色驗證工具檢查過頂列上相鄰的兩類（第 5 節）。
  - **圖示**：Lucide（ISC 授權）的線條圖示，每個主題一個、每個分類一個，`scripts/topic-icons.mjs` 的對照表挑選（不重複；宗教用書與愛心，不用特定宗教的符號），每個圖示的線條合成一條 path（`<circle>`、`<rect>` 等換成 path；開頭是小寫 `m` 的 path 前面補 `M0 0`，否則合併後會變成相對於上一段），寫進 `src/topics/icons.gen.ts`（97 個主題，gzip 後約 7 KB，`TopicIcon.tsx` 動態載入，另一個 chunk）與 `groupIcons.gen.ts`（分類、純地圖與指令面板的國家、指令，跟首頁一起）。主題的圖示在頁面載入 5 秒後閒置時先下載，滑到或移到主題列上也開始下載，打開選單時通常已經有了；還沒到時只畫分類色的底。
  - **為什麼不用縮圖**：2026-10-29 以前選單的每個主題是一張 64×37 的縮圖（實際下載 480×280，平均 13 KB），打開「社會」就要下載 23 張、約 300 KB；而且 97 張幾乎都是同一個顏色的世界地圖，看不出是哪個主題。改成圖示以後打開選單不下載任何圖片。縮圖只留在主題總覽（卡片夠大，看得出地圖的樣子），左上角加主題圖示（分類色的圓底、白色線條）。
- **主題總覽**（`src/controls/TopicsOverview.tsx`）：用 `<dialog>` 的 `showModal()`（焦點留在對話框裡、Esc 關閉、後面的頁面不能點，瀏覽器內建），依分類列出所有主題的卡片（縮圖、主題名稱、前三個指標），分類標題前面是分類的圖示，目前的主題框起來；手機上全螢幕、兩欄。上面的篩選框用主題搜尋（見下面），比對到指標或子項目時卡片寫「符合：鋰」，點了直接開那個指標與子項目。觸控裝置打開時不自動聚焦篩選框（鍵盤跳出來會蓋住半個畫面）。頁尾寫縮圖的出處。
  - **縮圖**：`scripts/topic-thumbs.mjs` 用開發伺服器（`window.__topics`、`window.__map`，只在開發模式有）逐一打開每個主題的預設指標，換成平面地圖、藏起底圖的地名（來源是 `openmaptiles` 開頭的 symbol 圖層：世界視角的底圖另有 `openmaptiles--world`，2026-10-29 以前只藏 `openmaptiles`，那之後重做的縮圖多了國名；資料的符號照畫，國旗主題小國的國旗還在）、按鈕與圖例，世界放滿 960×560 再縮成 480×280 的 WebP（每張 10–20 KB，97 張約 1.3 MB），另外存一張 240×140 的到 `public/thumbs/s/`（平均 4 KB，97 張約 400 KB，2026-10-29 加）；總覽用 `srcset` 讓一般解析度的螢幕抓小的、高解析度抓大的，打開時才下載（`loading="lazy"`）。新增主題或主題的預設指標改了之後重跑（`node scripts/topic-thumbs.mjs http://localhost:5173/ <主題 id>` 只跑指定的主題）；一個主題約 10 秒，全部約 15 分鐘，很吃 CPU，不要跟 `check:en` 同時跑。
- 選單用 portal 放到 `body`、`position: fixed` 對齊按鈕：主題列有 `overflow-x: auto`，放在裡面往下長的選單會被裁掉。主題列或頁面捲動、視窗改變大小時，選單跟著按鈕移動。
- 鍵盤依 WAI-ARIA 的 menu button 模式：在分類按鈕上 ↓↑ 開啟，選單裡 ↑↓ Home End 移動、←→ 換到相鄰的分類、Esc 關閉並回到按鈕。項目是 `menuitemradio`，目前主題 `aria-checked`。
- 選單開著時滑鼠移到另一個分類，直接換成那一類的選單（桌面程式選單列的習慣）；觸控不受影響。
- `npm run check:en` 照這個結構逐一打開每個分類、點選每個主題。

**國家搜尋**（`src/lib/countrySearch.ts`、`src/controls/CountrySearch.tsx`）：
- 比對繁中名稱、英文名稱（`Intl.DisplayNames(['en'])` 與 `countries.json` 的名稱）、常用別名、ISO 代碼。
  - 別名寫在 `ALIASES`：南韓/韓國/Korea、美國/USA/America、英國/UK/England、中國/大陸/PRC、對岸譯名（意大利、新西蘭、沙特）、舊名（Swaziland、Burma）等。
  - 輸入先正規化：小寫、去重音符號（Côte → cote）、全形轉半形、常見簡體字轉繁體（韩国 → 韓國）、「臺」統一成「台」。
- 計分由高到低：ISO 代碼完全相符（只接受完全相符，「TW」不會比對到一堆國家）→ 名稱完全相符 → 開頭相符 → 英文單字開頭相符（「korea」→ South Korea）→ 中間片段 → 跳字（「沙阿」→ 沙烏地阿拉伯）→ 英文拼錯一兩個字母（「germny」→ Germany）。同一級裡名稱越短越前面，所以「美」的第一個是美國。
- 已經有名稱相符的結果時，拼錯容忍找到的結果不列出，避免雜訊。
- 結果列出目前指標的數值；純地圖頁沒有數值，只列名稱。
- 選到國家後地圖一定飛過去框住整個國家（`WorldMap` 的 `focus`）；點地圖、點排名表則只在國家不在畫面上時才移動。
  - **被按鈕或抽屜蓋住也移過去**（2026-10-30）：原本只看國家的位置在不在畫面裡，手機打開 `t/fertility/?country=JPN` 時日本在右邊的縮放按鈕底下、下面又是抽屜，地圖不動。現在剛選到的國家（`placedRef`，換成細的國界、換底圖時不重算）離邊不到 32px、或落在縮放按鈕那一欄、抽屜（`data-occludes-map`）底下時，地圖平移到沒被蓋住那一塊的中間（`easeTo` 的 `offset`，縮放不變）。被蓋住的範圍由 `focus.ts` 的 `mapInsets` 量，搜尋選到國家的 `fitBounds` 也改用它。
  - 框住的範圍（`src/map/focus.ts`）是最大那塊陸地加上附近夠大的島，不含遠方屬地：法國不含法屬圭亞那，美國含阿拉斯加但不含阿留申群島西段與夏威夷。
  - 手機上會扣掉底部抽屜蓋住的高度。
- 是 WAI-ARIA combobox：↑↓ 選、Enter 確定、Esc 依序關清單／清空／離開；選字中（注音、拼音）的 Enter 不會被搶走。

**主題搜尋**（`src/lib/topicSearch.ts`，2026-10-27 加）：跟國家搜尋同一個搜尋框（提示文字「搜尋國家或主題（/）」，桌機搜尋框從 180px 加寬到 210px），結果分「國家」「主題」兩組，比對分數高的那一組在前（打「日本」國家在前，打「房價」主題在前；只有一組時不寫組名）。頂列英文 1280px 寬只剩 8px，放不下另一個搜尋按鈕，所以併進原本的搜尋框。
- 比對主題名稱與短名稱、指標名稱、子項目（農產品、礦產、連鎖品牌…）的中英文，計分用國家搜尋的 `scoreKey`，但只收片段以上的比對（分數 ≥ 500）：指標名稱很多，跳字與拼錯容忍太雜。同一個主題只留分數最高的一筆，最多 5 筆，右邊標「主題／指標／項目」。
- 選到指標或子項目時直接開那個指標（「鋰」→ 關鍵礦產的產量、鋰）；子項目優先用主題的預設指標。選取的國家留著。
- 子項目是國家的不收（護照的「護照」、聯合國投票的「比較對象」，id 是三個大寫字母），交給國家搜尋。
- 純地圖頁沒有指標，只搜尋國家（不傳 `onSelectTopic`）。

**指令面板**（`src/controls/CommandPalette.tsx`，Ctrl+K／Mac 的 ⌘K，2026-10-29 加）：畫面中上方的對話框，一個輸入框同時找主題、指標、子項目、國家與指令，↑↓（PageUp／PageDown 跳 5 個）選擇、Enter 執行、Esc 或點外面關閉。
- 用 `<dialog>` 的 `showModal()`：焦點留在裡面、關閉後回到原本的地方。輸入框是 WAI-ARIA 的 combobox（`aria-activedescendant`），結果分組，組名是 `role="presentation"`。
- 空白時列「最近看過」（不含目前的主題，最多 6 個）與所有指令；打字時主題（`searchTopics`，最多 6 個）、國家（`searchCountries`，最多 5 個）、指令（名稱用 `scoreKey` 比對，分數 ≥ 500）三組，比對分數高的那一組在前，跟搜尋框一樣。
- 指令由 `App.tsx` 依目前的狀態給（`PaletteAction`）：看全部主題、切換到地圖／排名表、切換深淺色、切換語言、有選取國家時「取消選取國家」。主題總覽開關的狀態因此從 `TopicNav` 移到 `App`（`overviewOpen`）。
- 每一列左邊是圖示：主題用主題的圖示與分類代表色（上面的「分類代表色」），國家是地圖釘、指令是 ⌘（`groupIcons.gen.ts` 的 `UI_ICONS`）。
- Ctrl+K 在輸入框裡也有效（瀏覽器自己的 Ctrl+K 是網址列搜尋，讓給網站），再按一次關閉。觸控裝置沒有實體鍵盤，用控制列的搜尋框；所以不在畫面上另外放按鈕，快捷鍵說明（?）裡有寫。
- CSS 的 class 是 `cmdk-*`：`palette-*` 已經是地圖配色選單（`PaletteMenu.tsx`）在用，2026-10-29 第一版撞名，清單被配色選單的 `position: absolute` 推到對話框外面。

**最近看過的主題**（`src/lib/recentTopics.ts`，2026-10-29 加）：換主題時記在這台瀏覽器的 `localStorage`（`recentTopics`，最新的在前，最多 8 個，拿掉的主題讀的時候濾掉），讀寫失敗（無痕模式、停用儲存）就當作沒有。主題總覽最上面一列「最近看過」（不含目前的主題，篩選時不列），指令面板空白時也列出。

**鍵盤快捷鍵**（`src/controls/hotkeys.ts` 的 `useHotkeys`，各元件自己註冊）：

| 鍵 | 動作 | 註冊在 |
|---|---|---|
| `/` | 跳到搜尋框 | `CountrySearch` |
| `Ctrl`+`K`（Mac `⌘K`） | 開關指令面板（輸入框裡也有效） | `CommandPalette` |
| `←` `→` | 上一年／下一年（照資料實際有的年份跳） | `TimeSlider` |
| 空白鍵 | 播放／暫停歷年變化（年份不連續時跳到下一個有資料的年份） | `TimeSlider` |
| `+` `−` | 放大／縮小地圖 | `WorldMap` |
| `Esc` | 取消選取國家（關閉側欄），沒有選取時清掉框選 | `App` |
| `?` | 開關快捷鍵說明（頂列的「?」按鈕，觸控裝置不顯示） | `ShortcutHelp` |

- 在文字框、下拉選單、拉桿裡不觸發；按鈕上的空白鍵照常是「按下按鈕」。
- 搜尋框、說明視窗、框選模式自己處理 Esc 並 `preventDefault`，全域的 Esc 就不會順便取消選取。框選模式與說明視窗用 capture 階段監聽，才能比全域的先處理。
- 用滑鼠點地圖時，地圖畫布會立刻放掉焦點，←/→ 才會繼續換年份；用 Tab 移進地圖時（`:focus-visible`），方向鍵與 +/− 交給 MapLibre 平移縮放。

**手機的底部抽屜**（`src/panels/PanelSheet.tsx`，寬度 ≤ 768px）：
- 國家側欄改成從底部拉起的抽屜，有三段高度：
  - 收合：露出國名與第一排數值，高度是 `--sheet-peek`（180px；年份 2026-10-28 移到英文名那一行之後從 196px 降下來）。
  - 半開：畫面高度的一半。
  - 全開：留出頂列。
- 拖把手或國名列切換高度，放開時吸附到最近的一段；快速滑動會直接切到下一段。從收合再往下拖就關閉。點把手依序切換；把手聚焦時 ↑↓ 也能切換。
- 抽屜以外的地方不擋，地圖照常能拖、能點；頁面底部留出收合高度的空白，頁尾和時間軸才捲得出來。
- `prefers-reduced-motion` 時不播放高度動畫。
- `index.html` 設了 `viewport-fit=cover`，所以頁面與抽屜都用 `env(safe-area-inset-*)` 讓開瀏海與底部的橫條。
- 收合與全開的高度寫在 CSS（含安全區域），JS 讀抽屜算好的 `min-height`、`max-height` 來決定吸附位置，兩邊不必各寫一份數字。

**手機的排名表不附英文國名**（768px 以下、中文介面，`html:lang(zh) .row-en`，2026-10-29）：「中非共和國 Central African Republic」一列擠成四行，一個畫面只看得到約 9 國；英文介面附的是 ISO 代碼，很短，照樣附。

**窄螢幕的排名表**（900px 以下）：欄名可以換行、左右留白減半。英文的指標名稱常比數值寬很多（「Tertiary enrolment (gross)」、「Average household size」），欄名不換行時 375px 寬的手機會超出畫面。「名次」不換行（`th.rank-col`）：原本擠成上「名」下「次」。

**瀏覽紀錄與「上一頁」**（`src/lib/url-state.ts`，2026-10-28 改）：畫面狀態都在網址裡，原本每次都用 `replaceState` 改寫目前這一筆，按瀏覽器的「上一頁」會直接離開網站。現在換主題、指標、子項目、國家（含取消選取）、地圖／排名表時 `pushState` 留一筆；年份、框選、3D、網格只改寫目前這一筆，拖時間軸、播放不會塞滿紀錄。上一頁、下一頁（`popstate`）讀回來的狀態只改寫；程式自己補正的（舊網址的指標 id，`update(…, { replace: true })`）也只改寫，否則上一頁會回到舊網址、又被補正回來，卡在同一頁。

**改寫網址的次數限制**（2026-10-28 修）：Safari（含 iPhone）與 Firefox 規定 `pushState`、`replaceState` 合計 10 秒內最多 100 次（Safari 有的版本是 30 秒），超過會丟 `SecurityError`，之後一陣子的呼叫都失敗；Chrome 超過時只是不做。原本每換一年就改寫一次網址，手機上左右拖幾次時間軸（人口 1950–2100 年拖一趟就 150 次）就超過，錯誤在 React 的 effect 裡丟出，整個畫面被拆掉，只剩背景色（深色模式一片黑）。現在：
- 只改寫這一筆的變動（年份、框選…）最多每 300 ms 寫一次（`REPLACE_INTERVAL_MS`），停下來時寫最後的狀態；留紀錄的變動（`pushState`）照樣馬上寫。實測來回拖 10 趟、1,500 次換年份只寫 109 次網址（約每秒 3 次）。
- 所有改網址的地方都經過 `src/lib/history.ts` 的 `setHistoryUrl()`，失敗回傳 `false` 不丟出去；`url-state` 失敗時過 2 秒再補寫，國家小檔案的主題連結失敗時改成整頁換過去。
- 網址可能還差最後一次改寫，分享連結、匯出圖片的網址用 `currentHref()`（最新的狀態），不要讀 `window.location`。
- 最外層加了錯誤畫面（`src/ErrorBoundary.tsx`）：之後再有別的錯誤，顯示說明與「重新整理」按鈕，不會只剩一片背景色。
- 驗證：Chrome 不會丟這個錯，要在頁面上把 `History.prototype.replaceState` 包一層，10 秒內超過 100 次就丟 `SecurityError`（模擬 Safari），再拖時間軸。

**時刻主題的網址與播放**（`src/controls/MomentControl.tsx`、`App.tsx`、`src/lib/clock.ts`，2026-10-28，晝夜與季節）：
- 網址 `time=2026-06-21T0400Z`：UTC、到分鐘，用 ISO 8601 的基本格式不寫冒號（`URLSearchParams` 會把冒號編成 `%3A`；寫成 `04:00Z` 的舊連結照樣看得懂）。分享出去在別的時區打開是同一刻，畫面上寫看的人電腦時區的日期與時間（旁邊寫 UTC+8）。1900–2100 年以外的不用。
- 沒有 `time` 是「現在」：每到整分鐘更新一次（`useNow`，分頁在背景時不計時、回來馬上更新），不寫網址。「現在」鈕在這時是按下的樣子（前面一個綠點），按它回到現在（拿掉 `time`）。
- `time` 跟年份一樣只改寫目前這一筆（不在 `HISTORY_KEYS`），經過 `useUrlState` 的節流（每 300 ms 最多寫一次）。拖拉桿、方向鍵（一天模式一小時、一年模式一天）、選日期都寫網址；換主題時拿掉。
- **播放的每一格不寫網址**：播放到的那一刻放在 App 的 state（`playTime`），停下來（暫停、拖拉桿、按「現在」）才寫一次。實測（模擬 Safari：`pushState`、`replaceState` 10 秒內超過 100 次就丟 `SecurityError`）：播放一天 15 秒、一年 15 秒，播放中寫網址 0 次、停下來各 1 次，沒有錯誤，畫面正常。
- 控制列一行：播放、一天｜一年、拉桿（一天模式 0–24 時每格 5 分鐘，刻度 0、6、12、18、24 時；一年模式 1/1–12/31，刻度是春分、夏至、秋分、冬至）、日期與時間（點一下開瀏覽器的日期選擇器：透明的 `<input type="date">` 蓋在上面，`showPicker()`）、「現在」。520px 以下「一天｜一年」換成一顆切換鈕、日期寫 6/21、刻度不寫字，375px 寬的拉桿約 96px。
- 播放一天每格 10 分鐘、一年每格 2 天，每 80 ms 一格（每秒 12.5 次，晝夜界線一秒動 2 小時），到尾端接回開頭；分頁在背景時暫停計時。`prefers-reduced-motion` 時每秒一格、一格一小時（一年模式一週），不連續掃動；本來就不會自動播放。
- 播放時地圖左上角的大字寫日期與時間（`.map-year.is-moment`，字小一點），一年模式也寫時間（時間不變）。

**手機版面**（2026-10-27 改，375×812 時地圖從 307px 往上移到約 240px，時間軸從畫面外移進第一個畫面）：
- 三個以上的指標改用下拉選單（`App.tsx` 的 `narrow`，`src/lib/useMediaQuery.ts`）：按鈕在手機上會換成兩三行。兩個指標照樣是按鈕。
- 底圖從控制列移到地圖右上角的按鈕列（見下面），控制列第二行只剩搜尋、地圖／排名表與分享；分享只留圖示（文字是按鈕的名稱，視覺上隱藏）。觸控裝置的搜尋提示文字取短的（「搜尋國家」「Find a country」），英文的「Search countries」在約 130px 寬的搜尋框放不下。
- 地圖的高度填滿第一個畫面剩下的空間，時間軸不必往下捲就看得到：`app/hooks.ts` 的 `useFitMap` 量出地圖的位置（`--map-top`）與時間軸的高度（`--time-h`），CSS 用 `100svh` 減掉（最小 320px）。上面的東西換行、展開說明時 `.app` 的高度會變，ResizeObserver 重新量；地圖跟著縮短後 `.app` 的高度不變，不會一直觸發。用 `svh` 不用量 `innerHeight`，捲動時網址列縮放不會讓地圖跳動。選了國家時抽屜蓋住地圖下方與時間軸，維持原樣（抽屜收合高度 180px，縮短地圖會在點國家時整個跳一下）。
- 指標說明在手機上只露一行（2026-10-28 從兩行改），被截掉時右邊有「更多」（`ClampedText.tsx`）。
- **控制列排得下就一行**（2026-10-28 改，390px 寬的總生育率地圖從 255px 往上移到 189px）：搜尋框收成放大鏡（`CountrySearch` 的 `compact`），點了才展開成蓋住整行的輸入框、直接跳出鍵盤，離開或選到結果就收回（打到一半的字留著）；「/」也會展開。指標的「指標」兩個字視覺上隱藏（下拉選單上就是指標名稱）。排不下時（英文、360px、農產品＋指標兩個選單）右邊那組（放大鏡、地圖／排名表、分享）換到下一行靠右，選單不會被截短。
- 觸控裝置的搜尋提示不寫「（/）」快捷鍵（`CountrySearch.tsx` 的 `TOUCH`，原本就有）。
- 時間軸的「2026 起為推估」離頭尾太近時（手機上拉桿短），藏起被蓋到的頭尾年份（`TimeSlider.tsx` 量文字的位置）。

**地圖右上角的按鈕列**（`WorldMap.tsx`，圖示在 `src/map/MapIcons.tsx`，2026-10-27 改）：放大、縮小、回到全球、平面／地球儀、3D（文字）、全螢幕、底圖、框選。原本是文字與符號（「＋」「⟲」「平面」「⤢」），「平面」在 32px 寬的按鈕裡擠成直排；改成同一套 18px、1.6px 線條的圖示，說明寫在 `aria-label` 與 `title`。頂列的深淺色切換（原本是文字的 ☾ ☀）、側欄與主題總覽的關閉鈕（原本是「×」字）也用這一套（2026-10-28）。
- **轉到某一洲**（`src/map/RegionMenu.tsx`，2026-10-28 加）：「回到全球」下面一顆，點開往左列出六洲（跟排名表的洲別篩選一樣），選了地球儀轉到那一洲的中心、縮放回全球視角；美洲、非洲在背面時不必用拖的。
- **手機上收起一部分**（2026-10-28 改）：375px 寬時 7–8 顆按鈕（每顆 32px）疊起來有 225–260px，占了地圖將近一半的高度。
  - 觸控裝置（`(pointer: coarse)`）不放放大、縮小：用兩指縮放，鍵盤的 +/− 照樣可以用。
  - 窄螢幕（768px 以下）把 3D、全螢幕、框選收進「更多」（`src/map/MoreMenu.tsx`，三個點的圖示，外觀與鍵盤操作跟底圖選單一樣；3D、框選是 `menuitemcheckbox`，開著時「更多」按鈕右上角有一個小點）。按鈕列剩回到全球、平面／地球儀、底圖、更多 4 顆（128px）；只有一項可以收時照樣放在按鈕列。
  - 不支援元素全螢幕的瀏覽器（iPhone 的 Safari，`document.fullscreenEnabled` 是 false）不放全螢幕鈕，原本按了沒有反應。
- **底圖選單**（`src/map/BasemapMenu.tsx`）：原本是控制列上的下拉選單，手機上多占一整行。點開往左展開五種底圖，每種畫出陸地與海的顏色（OpenFreeMap 樣式的 `background` 與 `water` 的顏色）。鍵盤照 WAI-ARIA 的 menu button。按鈕列不能 `overflow: hidden`（選單會被裁掉），圓角由第一顆、最後一顆按鈕自己切。

**頁尾**（2026-10-27 改）：來源一段（名稱與授權一直看得到）、主題說明（`ClampedText`，先露兩行，「更多」展開）、免責聲明。有的主題說明十幾行，原本整段攤開。授權要求寫出的聲明放在說明的開頭：夜間燈光的 EOG 聲明本來就在開頭，學生能力的 OECD 改作聲明（「This is an adaptation of an original work by the OECD…」）從結尾移到開頭；新主題的說明要照這個規則寫。

**控制列的下拉選單**（指標超過 5 個時的指標選單、子項目選單；手機上三個以上的指標）：
- 寬度跟著選到的那一項（CSS `field-sizing: content`），最寬 560px；不支援的瀏覽器（目前是 Firefox）是最長那一項的寬度。原本固定最寬 260px，英文較長的名稱會被截掉（「Average monthly earnings (US$)」要 278px，「Government & compulsory insurance share」353px，最長的是工業的「Machinery, electronics and transport equipment, % of manufacturing」526px）。
- 1280px 寬時，所有主題、所有指標的選單（中英文）都完整顯示，控制列仍是一行。
- 窄螢幕放不下時選單縮短、文字被切掉，不撐出水平捲動：`.controls-left`、`.select-field`、`select` 都要 `min-width: 0`，少一層就會撐開。375px 寬時英文較長的名稱會被切掉，點開的選項清單是完整的。

### 播放設定、收藏的畫面、地圖上標數值（2026-10-30）

- **播放設定**（`TimeSlider.tsx` 的 `PlaybackMenu`）：播放鈕旁邊的小按鈕寫目前的速度（「1×」，循環時加「↻」，有設定時是藍框），點開往上彈出：
  - 速度 0.5×／1×／2×（1× 一年 120 ms），循環播放：記在這台裝置的 localStorage（`playback`），每個主題都一樣。
  - 播放的年份：「從」「到」兩個下拉選單（選項寫時間軸的刻度，例如月份），只在目前的指標有效（換指標回到全部），軌道上那一段標成淡藍。按播放時年份不在範圍裡就從範圍的第一年開始，播到範圍的最後一年停下或從頭再播。
  - 點外面、按 Esc 關閉（`controls/useDismiss.ts`，Esc 只關這個視窗，不會順便取消選取的國家）。時刻主題的時間軸（`MomentControl`）不受影響。
- **收藏的畫面**（`controls/SavedViews.tsx`、`lib/savedViews.ts`）：控制列「分享」左邊的書籤按鈕（Lucide 的 bookmark，`UI_ICONS.saved`）。
  - 打開後上面是「收藏目前的畫面」，名稱預設是分頁標題（「總生育率 · 日本」），下面列出收藏過的畫面，點一下在網頁裡換過去（跟主題之間的連結一樣用 popstate，上一頁回得來），× 刪掉。目前的畫面已經收藏過時按鈕是實心的藍色，清單裡那一筆是粗體。
  - 存的是網址的路徑與參數（主題、指標、年份、國家、框選、比較…），拿掉 `lang` 與 `embed`：打開時照目前的語言。同一個網址只留一筆（再收藏一次是改名字），最多 50 筆，新的在前面。存在 localStorage（`savedViews`），只在這台裝置，不送到任何地方；別的分頁改了也跟著更新（`storage` 事件）。
  - 指令面板（Ctrl+K）也列出收藏的畫面（「打開收藏：…」）。
- **地圖上標數值**（`map/useValueLabels.ts`，網址 `vals=1`）：地圖右邊的工具列多一個「12」的開關（手機在「更多」裡），指令面板也有。
  - 每個國家的位置（比例圓的那一點）寫一個短的數值（指標的 `formatTick`，沒有就用 `format`），面量圖、比例圓、類別圖才有；網格、3D 時不畫。
  - 圖層插在底圖的地名下面：地名先排，數值放得下才放，四個方向（上、下、左、右）找空位，面積大的國家先排（`symbol-sort-key`），縮小時小國自然被略過。地球儀縮小時跟底圖的地名一樣只留離畫面中心 60° 以內的（邊緣擠成一團）。
  - 匯出地圖圖片時一起畫進去（截的是地圖的畫面）。

### 分析檢視（2026-10-30，`src/analysis/`，網址 `view=analysis`）

控制列的「地圖／排名表／分析」多了第三個。只有面量圖、比例圓、類別圖而且是資料檔的指標才有（`app/options.ts` 的 `canAnalyse`；在瀏覽器裡算的、路網、國旗等沒有），其他指標的網址寫了 `view=analysis` 也退回地圖。整個資料夾是自己的 chunk（`React.lazy`），切到分析才下載；點國家照樣打開側欄，時間軸照樣換年份，指令面板也有「切換到分析」。

- **地圖是平面的 SVG**（`shapes.ts`、`SvgWorld.tsx`）：Equal Earth 投影，國界用全球視角的 1:110m（已經在快取裡），不畫南極洲；路徑在固定的 viewBox（寬 1000）裡算一次，大地圖、小地圖、拉簾共用，靠 viewBox 縮放。不用 MapLibre：四張小地圖、兩張疊在一起的地圖都只是 SVG，不多開 WebGL，也不必下載底圖圖磚。沒有資料的國家跟主地圖一樣是灰底加斜線（SVG 的 pattern）。大地圖不超過框的高度（`--fit-width`，依框的高度與地圖的長寬比算）。
- **四個分頁**（網址 `an=`，設定都寫在網址裡，只在分析檢視時寫，見 `url-state.ts` 的 `AnalysisState`）：
  - **變化**（`ChangeTab.tsx`）：每個國家跟幾年前比（1、5、10、20、30、50、100 年，`back=`），「差多少」或「成長率」（`chm=`；總量預設成長率，比率、平均預設差多少；單位是 % 的寫「個百分點」）。那一年沒有資料的用最接近、不晚於的年份，比較的兩個年份寫在控制列（「2013 → 2023」）。發散色（使用者選的配色），增加的是右臂、減少的是左臂，中間一級是「變化不大」。門檻依這一次各國變化的大小取（`scales.ts` 的 `changeThresholds`：|變化| 的 30%、65%、90% 分位數取成 1、2、2.5、5 × 10ⁿ，相鄰的門檻至少差一倍，圖例的刻度才不會擠在一起）。旁邊列出增加、減少最多的五國，點了選那一國。只有一個時間點的指標寫「沒有變化可以比」。
  - **篩選**（`FilterTab.tsx`）：最多三個條件（同一個主題的連續數值指標、高於或低於、門檻），都符合的國家塗成紫色（`MAP_TOKENS.accent`），不符合的淡灰，缺其中某個指標的畫斜線；下面列出符合的國家（依第一個條件的指標排）。條件寫在 `flt=tfr:lt:1.5,aged-65:gt:20`；還沒設時先用目前的指標高於各國中位數。每個條件下面寫各國的最低、中位數、最高，那個指標沒有這一年的資料時寫用了哪一年。門檻的輸入框自己留著打到一半的字（「0.」），是合法的數字才寫回網址。
  - **並排**（`MultiplesTab.tsx`）：同一個指標的 4 個年份（從第一年到目前的年份平均取，資料的年份裡最接近的）共用一個圖例；或同一年的幾個指標（`mul=inds`，最多 4 個，目前的排第一）各自的圖例。滑到一國時每張小地圖都框起來（虛線），tooltip 列出每張的值。
  - **對照**（`SwipeTab.tsx`）：兩張一樣大的地圖疊在一起，右邊是目前的年份與指標，左邊是另一個年份或另一個指標（`swp=y:1970` 或 `swp=i:aged-65`；預設約 20 年前，只有一年的指標用另一個指標）。右邊那張用 `clip-path: inset()` 切掉左邊，中間的分隔線可以拖（pointer capture），也可以點了之後用 ← →（Shift 一次 20%）；分隔線是 `role="slider"`。兩邊同一個指標時一個圖例，不同指標時兩個。
- **比例圓的指標**：小地圖、拉簾畫圓（面積跟數值成正比，最大的圓是所有年份的最大值，跟主地圖一樣換年份時可以比），陸地不上色；變化一律塗色（成長率）。
- 文字在 `analysis/text.ts`（`defineMessages`，中英對照，標點也走字典，英文介面不會出現全形的「：」「（」）。
- **驗證**：每個主題打開分析、四個分頁各點一次，沒有頁面錯誤與主控台錯誤；手機 390px 寬時分頁、控制列換行，圖例排到地圖下面，小地圖一欄。

## 12. 英文版介面（i18n）

右上角的「中文 / EN」切換語言，不必重新整理。沒有用 i18next 之類的套件：介面字串只有一百多個，自己寫的小字典加上 TypeScript 型別就夠了，也不會多一個依賴。

**語言狀態**（`src/i18n/lang.ts`）：
- 語言是 `'zh' | 'en'`，預設中文。記在網址的 `lang=en`（中文是預設，不寫）與 localStorage。
- 打開網頁時：網址的 `lang` 優先，其次是 localStorage，都沒有就是中文。網址指定的語言也存成偏好，網址的參數被拿掉後重新整理才不會跳回另一種語言。
- `setLang()` 改網址、存 localStorage、通知訂閱者；`useLang()` 用 `useSyncExternalStore` 訂閱，所以切換時整個畫面重畫、不重新載入。`lib/url-state.ts` 重寫網址時會保留 `lang`。
- `<html lang>`（`zh-Hant-TW` / `en`）、分頁標題、`<meta name="description">` 跟著語言（`src/i18n/index.ts`）。
- **分頁標題跟著指標與國家**（`App.tsx`，2026-10-29）：「總生育率 · 台灣 · 世界資料地圖」（沒選國家時沒有國名，純地圖是「世界地圖 · 世界資料地圖」），書籤、瀏覽紀錄、分頁列才分得出來。`check:en` 只檢查英文版的標題以「World Data Map」結尾。

**介面文字**：
- 共用的字在 `src/i18n/zh.ts` 與 `en.ts`，元件裡 `const t = useT()`，例如 `t.noData`、`t.rank(3, 200)`。中文那份決定型別（`Messages`），英文少一個鍵或參數不同都會編譯失敗。
- 搜尋、快捷鍵、手機抽屜、分享選單的字在 `src/lib/strings.ts`（`useUI()`）。
- 主題與主題側欄的字寫在各自的檔裡（見第 4 節「雙語文字」）。
- 不是元件、但會在畫面更新時重新執行的程式（圖表的 tooltip 函式、匯出圖片、CSV）用 `messages()` 或 `getLang()` 讀目前的語言。
- 英文的標題組合：子項目＋指標（「稻米產量」）在英文是「Rice production」（`itemIndicator`，指標名稱開頭轉小寫，GDP 這類縮寫不動）；年份「2023 年」在英文只寫「2023」。

**數字格式**（`src/lib/format.ts`）：
- 中文：2,333 萬、14.38 億、30.86 兆；圖例刻度 1,000萬、1億。
- 英文：23.33M、1.44B、30.86T（一百萬以下寫完整數字，例如 980,000）；圖例刻度 1K、10M、1B。
- 美元：中文「1.43 兆 美元」，英文「$1.43T」、負數「−$5.2B」；國際元：英文「Int$12,345」。
- 千分位與小數點用 `Intl.NumberFormat`（`zh-TW` / `en-US`）。

**國名**（`src/lib/countries.ts` 的 `countryName()`）：
- 用 `Intl.DisplayNames` 取中文或英文名稱。英文的 CLDR 短名稱有些比較拗口，改成常見寫法（`Congo - Kinshasa` → DR Congo、`Hong Kong SAR China` → Hong Kong、`Myanmar (Burma)` → Myanmar、`&` → and）。
- CLDR 沒有的區域（索馬利蘭、北賽普勒斯等沒有 ISO 代碼的）用自訂名稱；再查不到就用 `countries.json` 的英文名（例如 XKX 科索沃），最後才是 ISO 代碼。
- 中文介面的排名表、側欄在國名旁附上英文名；英文介面改附 ISO 代碼，畫面上不出現中文。
- 搜尋不管介面是哪種語言，中文名、英文名、別名都找得到（英文介面打「日本」也會找到 Japan）。

**地圖上的地名**：
- `WorldMap.tsx` 把底圖每個顯示地名的文字圖層換成 `LABELS[lang]`：中文用 `name:zh-Hant`（沒有的退回 `name:zh`、`name`），英文用 `name:en`（退回 `name_en`、`name`）。
- 切換語言時直接 `setLayoutProperty` 改文字欄位，不必重新載入樣式；切換底圖時，新樣式下載後也套用目前的語言。

**資料**：
- 指標檔的 `notesEn`（`pipeline/topics/income.py`、`industry.py`、`sectors.py`），英文介面的側欄附註與 CSV 用它。
- 農業的 `items.en.json`：FAOSTAT 的英文品項名稱（`pipeline/topics/agriculture.py`）。
- CSV 的欄名跟著語言（英文版只有一欄英文國名）；匯出圖片的標題、圖例、來源也跟著語言。

**檢查**：
- `npm run check:i18n`（`scripts/check-i18n.mjs`）：掃描 `src/` 的原始碼，列出註解以外、不在 `zh:` 值裡的中文，包含 JSX 文字。`src/i18n/zh.ts`、行尾有 `i18n-ignore` 註解的行（例如語言切換鈕上的「中文」）、檔頭註解寫了 `i18n-ignore-file` 的檔（例如搜尋用的中文別名表）不算。
- `npm run check:en`（`scripts/check-en-ui.mjs`）：用無頭 Chrome（puppeteer-core 搭配系統的 Chrome、`--use-angle=swiftshader`）打開英文版：
  - 先檢查中文 → 英文 → 中文切換不重新整理，`<html lang>`、分頁標題、網址的 `lang`、底圖地名都跟著變。
  - 再逐一點每個主題、每個指標（地圖、tooltip、排名表），換一次子項目，開三個國家的側欄（第一個用帶 `lang=en` 的網址直接打開，確認分享連結打開就是英文；其他的用搜尋框），框選估算、分享選單、快捷鍵說明。
  - 收集畫面上的文字、`aria-label`、`title`、`placeholder`、選單選項，列出含中文的字串；`translate="no"` 與 `lang="zh…"` 的元素不算。
  - puppeteer-core 不在 `package.json`：`npm i --no-save puppeteer-core`，或用 `PUPPETEER_CORE` 指向已經裝好的資料夾。全部跑完約 15–30 分鐘（SwiftShader 軟體繪製地球儀很慢；4 核心的雲端環境 1 小時以上）。
  - `CHECK_TOPICS=antipodes,rivers`（主題的 id）：只細看這幾個主題（每個指標、排名表、三個國家的側欄）；其他主題照樣依序點過、檢查主題本身的畫面，換主題時的錯誤照樣抓得到；人口的框選、3D、1 km 網格只在含 `population` 時檢查；分享選單、快捷鍵說明、中英切換一律檢查。沒有 `CHECK_TOPICS` 時不跑（印出用法），完整的是 `CHECK_ALL=1`。
- **什麼時候跑 check:en**（2026-10-28，使用者要求減少執行）：到這天為止 212 個提交裡，`check:en` 只抓到過 1 個問題，而且不是漏翻：從海洋與漁業切到晝夜與季節時整個畫面變成錯誤畫面（第 8 節第 87 點），是依序點過每個主題才發現的；漏翻的中文 0 次（`check:i18n` 先抓掉了）；另外 2 次是腳本或開發伺服器本身的問題。所以：
  - 每次改完都跑 `npm run check:i18n`（幾秒）。
  - 新增或修改一個主題：`CHECK_TOPICS=<主題 id> npm run check:en`（其他主題只點過；4 核心的雲端環境 `CHECK_TOPICS=antipodes` 約 8 分鐘，完整的要 1 小時以上）。
  - 改了好幾個主題共用的介面（`src/App.tsx`、`src/panels/`、`src/controls/`、`src/map/` 的圖例與 tooltip、`src/i18n/`、`src/lib/strings.ts`）：`CHECK_TOPICS` 列出用到那段程式的幾個主題（例如改了線圖層就列河流、日食、颱風），一樣不跑完整的。
  - **完整的（`CHECK_ALL=1 npm run check:en`）只在使用者特別要求時跑**（使用者 2026-10-28 決定）；任務說明只寫「`npm run check:en` 通過」時，照上面指定主題，不算是要求跑完整的。
- **check:en 卡在「Waiting for selector `.topic-menu`」**（2026-10-30，組 H 修）：換成 Preact 之後，無頭 Chrome 裡 effect 晚一點才跑（requestAnimationFrame 很少觸發，靠 100 ms 的備援計時），check:en 點開分類選單後馬上按 Esc，焦點還在分類按鈕上、還沒移進選單，Esc 沒有關掉選單；接著點下一個分類時，滑鼠移過去先把選單換過去（`onButtonPointerEnter`）、點下去又關掉，所以等不到選單。修法：分類按鈕本身也接 Esc（選單開著時關掉，`TopicNav.tsx` 的 `onButtonKeyDown`；真的使用者在選單剛打開的瞬間按 Esc 也會遇到），check:en 按 Esc 之後在 Node 這邊每 100 ms 看一次、等選單關掉才點下一個（頁面裡的 `waitForFunction` 預設用 requestAnimationFrame 輪詢，在這裡等不到）。

## 13. 載入速度與離線

### 第一個畫面的觀感（2026-10-27 加）

- **底圖圖磚還沒到時地球是海的顏色**：MapLibre 在圖磚到之前用樣式的 `background` 圖層（陸地的顏色，彩色地形是米白 `#f8f4f0`）畫整顆地球，慢的網路上開頁先看到一顆白球。`WorldMap.tsx` 的 `installDataLayers` 在樣式載入時把 `background` 換成同一個樣式的海的顏色，第一次 `idle`（圖磚到齊）再換回來（樣式預設 300 ms 過渡）；分頁在背景時不畫也就不會 `idle`，最多 10 秒也換回來，陸地不會一直是海的顏色。驗證：無頭 Chrome 把 `tiles.openfreemap.org` 的圖磚延後 6 秒，第 4 秒的截圖是藍色的海上畫著各國的顏色，9.5 秒換回米白。彩色地形在低縮放時是 Natural Earth 的點陣圖（不透明度 0.6）疊在 background 上，換回來時海的顏色會淡一點，是原本的樣子。
- **換年份、換指標時國家的顏色漸變 280 ms**（`FILL_FADE_MS`）：顏色放在 feature-state，MapLibre 不會替 feature-state 的改變做過渡，所以每一格自己算中間色（`mixColor`）。漸變到一半又換年份，從畫面上的中間色接著變。直接換、不漸變的情況：換底圖（feature-state 全清掉）、第一次畫、系統設定減少動態效果，以及跟上一次改變相隔不到 60 ms（拖時間軸），否則顏色會落後拉桿。
  - **播放時也漸變**（2026-10-29 起；以前相隔不到 280 ms 就直接換，播放時一格一格跳）：漸變時間是 `min(280 ms, 間隔 × 0.6)`（`FILL_FADE_SHARE`），播放一年 120 ms 時約 70 ms，下一年來之前就變完，不會累積落後。
  - **換指標、換主題時真的漸變**（2026-10-30）：原本新的資料檔載入中時，地圖拿上一個檔的數字套上新指標的色階（顏色錯一下），檔到了再直接跳到新的顏色（兩次變化相隔太短，不漸變）。現在 `App.tsx` 的 `mapShot`：載入中地圖照畫上一個指標（舊的數字、色階、圖例標題），檔到了 `indicator`、`values` 一起換，國家的顏色用 450 ms 漸變過去（`FILL_SWITCH_MS`，色階換了就算換指標；換配色也是）。時間軸背後的走勢一樣等檔到了才換。
  - **比例圓的大小也漸變**（2026-10-30，`WorldMap.tsx` 的 `bubbleShownRef`）：跟顏色同樣的時間（換年份 280 ms、播放時間隔的 0.6、換指標 450 ms），每一格重新 `setData` 比例圓的 source（約 200 個點）；新出現的圓從 0 長大，消失的縮到 0 再拿掉。3D 柱子照舊直接換。
  - 在這台機器的無頭 Chrome（SwiftShader）上，地圖重畫一格要幾百毫秒，漸變只看得到頭尾兩三格；要看效果用有顯示卡的瀏覽器。

### 量測方法

- 無頭 Chrome（puppeteer-core 搭配系統的 Chrome，`--use-angle=swiftshader`，見第 10 節）。
- 兩種環境：
  - 桌機：1366×900，不節流。
  - 手機：412×915、裝置像素比 2，網路 Fast 3G（延遲 562 ms、下載約 1.4 Mbps），CPU 降速 4 倍。
- 三種情況：
  - 首次載入：全新的瀏覽器設定檔，沒有任何快取。
  - 再次載入：同一個設定檔，上一頁關掉 8 秒後再開（改善後的版本這時已經由 service worker 接手）。
  - 離線開啟（只有改善後）：頁面設成離線再開一次。
- 量的東西：
  - **地圖出現資料**：`WorldMap` 第一次把資料畫上地圖時留下的 `performance.mark('map-data')`。改善前的版本也加上同一個 mark 再量。
  - **LCP**：Largest Contentful Paint。地圖畫布不算 LCP 候選，所以 LCP 量到的是頁面上的文字（多半是頁尾的資料來源）。
  - **傳輸量**：頁面請求的 CDP `Network.loadingFinished` 加總（含底圖圖磚）。分成「到地圖出現資料為止」與「網路安靜 3 秒為止」兩個數字。
- 工具在版本庫裡：
  - `scripts/serve-pages.mjs`：模擬 GitHub Pages 的靜態伺服器（`/map/` 子路徑、gzip、`Cache-Control: max-age=600`、ETag）。
  - `scripts/measure-load.mjs`（`npm run measure:load -- <網址>`）：量上面這些數字，最後印出中位數。
- 改善前是 `186b9ab`（加上同一個 mark）的建置，改善後是這次的建置；每輪交錯量兩個版本，共 5 輪，取中位數。
- 量測本身的陷阱（數字會亂跳，已寫進腳本的註解）：
  - 這台機器同時跑著其他工作，SwiftShader 又用 CPU 繪圖，同一組設定前後兩次可以差到兩倍。
  - 上一頁剛關掉就開下一頁，新頁面會被舊頁面的收尾拖慢幾十秒（兩個版本都會）。
  - 用 CDP 接管 service worker 的 target（為了節流或計算它的流量）時，再次載入偶爾會卡住。

### 結果

本機模擬 GitHub Pages，5 輪的中位數（括號是最小～最大）。改善後的版本包含同時期合併進來的 3D、搜尋、分享、英文版、貿易流向等功能。

| 情況 | | 改善前 | 改善後 |
|---|---|---|---|
| **桌機・首次載入** | 地圖出現資料 | 3.1 秒（1.9–3.5） | **1.9 秒**（1.3–2.2） |
| | LCP | 0.84 秒 | 0.75 秒 |
| | 到出現資料為止下載 | 4,076 KB | 3,847 KB（網路快，資料畫上時圖磚也幾乎都到了） |
| **桌機・再次載入** | 地圖出現資料 | 2.4 秒（2.0–5.0） | **1.6 秒**（1.4–2.0） |
| | LCP | 0.28 秒 | 0.20 秒 |
| | 網路請求 | 10 分鐘內 0（瀏覽器快取），之後 44 個都要向伺服器確認 | 0（全部由 service worker 回應；資料在背景確認，沒變只回 304） |
| **手機・首次載入**（Fast 3G、4× CPU） | 地圖出現資料 | 57.5 秒（56.4–58.6） | **7.3 秒**（6.3–7.6） |
| | LCP | 4.4 秒 | 4.3 秒 |
| | 到出現資料為止下載 | 4,144 KB | **531 KB** |
| **手機・再次載入** | 地圖出現資料 | 8.5 秒（6.3–9.3） | **6.1 秒**（6.0–6.8） |
| | LCP | 1.2 秒 | 0.94 秒 |
| **離線開啟** | 地圖出現資料 | 打不開 | 桌機 1.7 秒、手機 6.5 秒 |

部署後量正式網站（https://skywitness.github.io/map/，`npm run measure:load`，3 輪中位數）：

| | 桌機 | 手機（Fast 3G、4× CPU） |
|---|---|---|
| 首次載入：地圖出現資料 | 2.5 秒 | 8.0 秒（到出現資料為止下載 537 KB） |
| 再次載入：地圖出現資料 | 2.0 秒 | 6.7 秒 |
| 離線開啟：地圖出現資料 | 2.5 秒 | 7.0 秒 |

比本機稍慢一點，是真實網路的延遲；量測當時這台機器也在跑其他工作。

最大的請求（首次載入，gzip 後）：

| 改善前 | 改善後 |
|---|---|
| 首頁程式（含 MapLibre）370 KB | 地圖程式 chunk 284 KB（跟首頁程式、資料同時下載） |
| Natural Earth 地形圖磚，每張 200–330 KB，第一個畫面約 30 張 | 同左，但資料不再等它們 |
| 1:50m 國界 227 KB | 1:110m 國界 46 KB（含補進去的小國；1:50m 放大才下載） |
| 總人口 133 KB | 總人口 55 KB（差分編碼） |
| | 首頁程式 120 KB |

怎麼解讀：
- **最大的差別是「不再等底圖圖磚」**：原本資料圖層要等 MapLibre 的 `load`（第一個畫面的圖磚全部下載完），手機 3G 上光圖磚就要將近一分鐘。
- 首次造訪的總下載量差不多（約 4 MB，大部分是底圖圖磚），差別在順序：第一個畫面要的約 0.5 MB 先到，圖磚後到。（2026-10-28 發現這裡漏算了 MapLibre 在 web worker 裡下載的向量圖磚，實際約 8.9 MB，見下面「世界視角的底圖與主題拆分」。）
- 手機的再次載入受限於 CPU：檔案都在本機了，剩下的是 4 倍慢的主執行緒解析程式、加上 SwiftShader 畫 2 倍像素的地球儀。
- 手機首次載入的 LCP 沒有變快：LCP 是頁尾文字，要等首頁程式跑起來；現在地圖程式、資料跟首頁程式同時下載，3G 的頻寬是共用的。地圖出現資料的時間才是使用者在等的。
- 再次載入與離線時，`map-data` 之後 1:50m 國界、其他指標都從快取來，不用等網路。

### 做了什麼

**第一個畫面的關鍵路徑**（原本是一條很長的瀑布流：首頁程式 1.35 MB → 國界與資料 → 底圖樣式 → 所有底圖圖磚 → 才畫資料）：

1. **MapLibre 移到自己的 chunk**（`App.tsx` 的 `lazy(() => import('./map/WorldMap'))`）。首頁 chunk 從 381 KB 降到 124 KB（gzip，含之後加的英文版、搜尋、分享等功能）；地圖 chunk 293 KB。MapLibre 的 CSS 仍在首頁（見第 10 節）。
2. **第一個畫面要用的檔案提早發出請求**：
   - `index.html` 直接預載：地圖程式 chunk（`vite.config.ts` 的 `preloadMapChunk` 外掛插入 `modulepreload`）、1:110m 國界、國名表、預設主題的資料、預設底圖的樣式、圖磚索引 `/planet`，並先跟 `tiles.openfreemap.org` 建立連線。
   - `App.tsx` 在模組載入時就用 `fetchJson` 發出同樣的請求（網址指定別的主題時也適用），之後 `useJson` 拿到的是同一個 Promise。
   - 底圖樣式由 `src/map/style.ts` 下載與改寫，這個檔案不含 MapLibre，首頁一啟動就能先抓。
3. **不等底圖圖磚**：資料圖層改在 `style.load`（樣式解析完）加上，不等 `load`（第一個畫面的圖磚全部下載完）。彩色地形的 Natural Earth 圖磚一張 200–300 KB，手機 3G 上光是圖磚就要幾十秒。
4. **地圖不等資料**：`WorldMap` 一開始就掛上去（底圖先出來），國界與資料到了再畫；首次載入時地圖上方顯示「資料載入中…」。
5. **先粗後細的國界**：先畫 1:110m（gzip 後 46 KB），放大超過全球視角才載入 1:50m（230 KB）。再次造訪時也一樣先畫粗的，因為手機上解析 1:50m 要好幾百毫秒。
   - **1:110m 補上小國**（`pipeline/build_geo.py` 的 `add_missing_to_coarse()`，2026-10-29）：1:110m 原本沒有新加坡、巴林、馬爾地夫、香港、東加等 63 個（多半是小島國與屬地），全球視角要畫它們的小國圓點、能點選，所以 2026-10-29 以前地圖畫出資料後（`onFirstData`）一定接著下載 1:50m。現在把這 63 個的 1:50m 形狀換算成 1:110m 的量化座標接在後面（只多 2.1% 的頂點，gzip 後 38 → 46 KB），全球視角不再需要 1:50m。
   - **什麼時候載入 1:50m**：`WorldMap` 的 `onDetailNeeded`，縮放超過 `min(DETAIL_ZOOM = 3, 剛好看到整個地球的縮放 + 0.5)` 時通知一次（搜尋國家飛過去、雙擊放大都算）；地圖高 560 px 時約 2.5、800 px 以上是 3。有 `pointer` 的主題（地球的另一邊、氣候分區…）要判斷游標在哪一國，海岸附近 1:110m 太粗，地圖畫出資料後就載入，跟以前一樣。1:110m 下載失敗時直接用 1:50m。
   - 只看排名表、只在全球視角轉地球儀的人，一次造訪少下載 227 KB、手機上少解析一次 1:50m。
6. **指標檔差分編碼**（第 3 節）：首頁的總人口從 137 KB 變 55 KB。
7. **之後才做的事**：地圖畫出資料之後，閒置時（`requestIdleCallback`）一個一個預先下載同主題的其他指標（`prefetchJson`，省流量模式與 2G 不做），換指標、開側欄就不用等。Service worker 也等這時才註冊，預先快取的下載不跟第一個畫面搶頻寬。

**GitHub Pages 的壓縮**：JSON、JS、CSS 都有 gzip（`Content-Encoding: gzip`，例如 1:50m 國界 746 KB → 247 KB），沒有 Brotli；`Cache-Control: max-age=600`，所以沒有 service worker 時，10 分鐘後再開每個檔案都要重新向伺服器確認。

### 世界視角的底圖與主題拆分（2026-10-28）

`measure-load.mjs` 原本只聽頁面自己的 CDP session，MapLibre 在 web worker 裡下載的向量圖磚都沒算到；改成接上每個 worker 的 session（節流也設在 worker 上），網路安靜要等下載中的請求都完成。重新量才發現首次開頁約 8.9 MB，其中 88% 是底圖。

首次開總生育率（`?topic=fertility`，不節流，到網路安靜為止；Playwright 的 `requestfinished` 加總，含 worker 的請求，桌機與手機一樣）：

| | 改之前（`56fcac3`） | 世界視角的底圖（`bafae47`） | 再加上主題拆分、預先快取（`55216d6`） |
|---|---|---|---|
| 向量圖磚 | 4,658 KB（2 級 9 張） | 339 KB（0–1 級 3 張） | 339 KB |
| 地形陰影點陣圖 | 3,233 KB（31 張） | 0 | 0 |
| 網站的 JS | 647 KB | 648 KB | 452 KB（首頁程式 335 → 145 KB） |
| 資料 JSON（含第一個畫面之後的 1:50m 國界 227 KB） | 292 KB | 295 KB（多了湖泊 3 KB） | 295 KB |
| **合計** | **8,914 KB** | **1,366 KB** | **1,171 KB** |

- **2 級的向量圖磚一張約 600 KB**（gzip 後），95% 是各國的州、省地名，每個地名 83 種語言；0–1 級只有國名、海名、國界。`style.ts` 的 `splitWorldZoom`：縮放 3 以下改用 maxzoom 1 的 source（同一份圖磚），底圖每個 3 級以下會畫的圖層複製一份（id 加 `--world`），原本的從 3 級開始。深色底圖不再擠滿各省、各州的名稱。
- **縮放 4.5 以下底色是海，陸地用我們的國界畫**（`WorldMap.tsx` 的 `base-land`，跟資料圖層同一份國界：全球視角 1:110m、放大後 1:50m；湖泊是 Natural Earth 1:110m 的 `geo/lakes-110m.json`，`base-lakes`）：0–1 級的海岸線約是 1:110m，比原本粗；用我們的國界畫陸地，海岸線反而跟資料圖層一致。放大跨過 3 級、新的圖磚還沒到時也不會露出一片底色。彩色地形的陰影點陣圖的海是不透明的白色（60% 不透明度），要靠水域蓋住，所以只有它保留 0–1 級的水域。
- **底圖的國名改用網站自己的名稱**（`style.ts` 的 `labelField`）：底圖的國名有 `iso_a2`，對到 CLDR 的名稱（「台灣」，OpenStreetMap 是「臺灣」），其他地名照舊。
- **面量圖、類別圖、國旗在縮放 3 以下不畫底圖的陰影點陣圖**（陸地被不透明度 0.82–0.94 的填色整片蓋住），放大後填色變淡才畫。
- **主題拆分、service worker 只預先快取第一個畫面的 JS**：見第 4 節第 2 步與下面的表格。
- **載入時間**（`npm run measure:load`，本機模擬 GitHub Pages，改之前 `56fcac3` 與改之後 `790ff1c` 交錯量 3 輪，中位數；這台機器的 SwiftShader 比第 13 節開頭量的那台慢，絕對值不能跟上面的表比，只比兩個版本）：

| | 改之前 | 改之後 |
|---|---|---|
| 桌機・首次載入：地圖出現資料 | 4.5 秒 | 4.1 秒 |
| 桌機・首次載入：LCP | 1.44 秒 | 1.42 秒 |
| 桌機・首次載入：全部下載 | 8,897 KB | 1,172 KB |
| 桌機・再次載入：地圖出現資料 | 2.8 秒 | 2.2 秒 |
| 手機・首次載入（Fast 3G、4× CPU）：地圖出現資料 | 9.4 秒 | 8.3 秒 |
| 手機・首次載入：LCP | 6.2 秒 | **3.8 秒** |
| 手機・首次載入：全部下載 | 8,041 KB | **1,270 KB** |
| 手機・再次載入：地圖出現資料 | 6.0 秒 | 5.7 秒 |

  - 手機的 LCP 快了 2.4 秒：LCP 是頁尾的文字，要等首頁程式跑起來（335 → 145 KB，gzip 後）。
  - 地圖出現資料只快了約 1 秒：底圖圖磚原本就不擋資料（上面「做了什麼」第 3 點），省下的主要是之後的 7 MB；手機上這 7 MB 原本要在背景下載將近一分鐘，跟換主題、開側欄搶頻寬。

- **React 換成 Preact**（2026-10-30，`vite.config.ts` 的 `resolve.alias`）：程式照舊 `import ... from 'react'`、型別用 `@types/react`，建置與開發都把 `react`、`react-dom`、`react-dom/client`、`react/jsx-runtime` 換成 `preact/compat`（Preact 11）。首頁的 chunk gzip 後從 141 KB 降到 76 KB（react-dom 約 200 KB 未壓縮，Preact 加 compat 約 15 KB）。
  - 不再用 `@vitejs/plugin-react`：JSX 用 Vite 內建的轉換（`oxc.jsx`，automatic runtime，`importSource: 'preact'`）。它的 Fast Refresh 只認得 React，所以開發時改了程式是整頁重新載入（沒有保留狀態的熱更新）；`npm run check:en`（開發伺服器）測的也是 Preact，跟正式版一致。
  - **React 19 才有、Preact 沒有的寫法**：函式元件直接收 `ref` 這個 prop。只有 `WorldMap` 這樣用，改名成 `handleRef`（App 傳 `handleRef={mapHandle}`）。新寫的元件不要用 `ref` 當一般的 prop（要的話用 `forwardRef` 或換名字），也不要用 `use()`、`useOptimistic`、`useActionState` 等 React 19 的新 hook。
  - 驗證：全部主題的冒煙測試（正式建置）、每個主題的側欄（美國、台灣）、每個主題分析檢視的四個分頁、滑過與點選國家、框選、指令面板、主題總覽、排名表、時刻主題、時間軸的拖曳與 ←/→、下拉選單、CSV 與地圖圖片下載、篩選的數字輸入、拉簾拖曳、手機抽屜、嵌入模式，加上 `check:en`，都沒有錯誤。
- **地圖還沒畫好前先放一張地球圖**（2026-10-30，`app/GlobePlaceholder.tsx`、`scripts/globe-placeholder.mjs`）：慢的網路上 MapLibre（gzip 後約 300 KB）、底圖樣式、國界都到了才畫得出地球，之前地圖的位置是一片太空背景。現在先放一張初始視角（亞洲在中間）的地球截圖：`public/globe/light.webp`（彩色地形，32 KB）、`dark.webp`（深藍，21 KB），640px、地球外面透明。
  - 大小、位置跟 MapLibre 的初始地球一樣（直徑是地圖高度的 0.94、置中，截圖腳本量的），放在地圖畫布底下：太空背景從畫布移到外框（`.map`），畫布本身透明，MapLibre 一畫出地球就蓋過它，不必掐時間移除；`'load'` 之後不再畫。地圖的程式還沒下載時（App 的 Suspense）用 `MapFallback`：同樣的太空背景、地球圖，左下角「載入地圖…」。
  - 深色底圖（或深色介面沒選過底圖）用深色的；`index.html` 的開頭程式依同樣的規則預先下載那一張（網址有 `view=` 時不下載），Service worker 也預先快取（共約 53 KB）。只用在地球儀的初始視角（平面地圖、3D 時不放）。
  - 實測（無頭 Chrome 限速 1.6 Mbps、延遲 150 ms）：第 3 秒出現地球圖，第 5 秒地圖畫好、接上時看不出跳動。換了預設底圖、初始視角或國界、地名的畫法後要重跑 `node scripts/globe-placeholder.mjs <網站的網址>`。
- **首頁的程式再拆小**（2026-10-30）：首頁 chunk 從 gzip 後 163 KB 降到 141 KB（未壓縮 500 → 426 KB）。量法：`vite build --sourcemap` 後用 sourcemap 算每個原始檔在 chunk 裡佔多少。搬出去的：
  - 疊加圖層、風場、類別網格的**資料**部分拆成 `map/overlayData.ts`、`map/windField.ts`、`map/classGridData.ts`（首頁的 `app/overlays.ts`、主題的側欄只 import 這些）；圖層的開關與圖例元件（`Overlays.tsx`）、風的粒子與類別網格的 WebGL 圖層（`windLayer.ts`、`classGridLayer.ts`）留在地圖的 chunk。`Overlays.tsx` 照舊把資料的部分轉出去，地圖這邊的 import 不必改。
  - 排名表（`RankingTable`）、時刻主題的時間軸（`MomentControl`，連同太陽位置的計算 `lib/solar.ts`）、主題總覽（`TopicsOverview`，第一次打開才載入，之後留著）、指令面板的對話框（`CommandPaletteDialog.tsx`；`CommandPalette.tsx` 只聽 Ctrl+K，第一次按才下載）改成用到才下載。
  - 主題搜尋比對的子項目（農產品、礦產、品牌…，約 26 KB）拆到 `topics/catalogItems.gen.ts`（`npm run catalog` 一起產生、`--check` 一起比對），第一次搜尋時才下載（`lib/topicSearch.ts` 的 `loadSearchItems`）：到之前只比對主題與指標的名稱，到了之後重建索引，搜尋框、指令面板、主題總覽重算一次結果（`useTopicSearchItems`）。
  - 剩下最大的是 react-dom（約 200 KB 未壓縮）與主題目錄（48 KB，頂列選單與主題總覽的主題、指標名稱）。
- **世界視角的地形陰影改用自己的 WebP**（2026-10-30，`style.ts` 的 `localRelief`、`pipeline/relief_tiles.py`）：彩色地形低縮放時的 Natural Earth II 陰影點陣圖（ne2sr，公有領域）是 OpenFreeMap 的 256px PNG，比例圓、點圖層的主題（首頁的人口就是）地球儀一開就要 32 張、約 3.2 MB，占第一次載入約 3.9 MB 的八成。`npm run data -- relief-tiles` 把 0–3 級的 85 張下載下來轉成 WebP（有損 82，method 6）放在 `public/relief/`：PNG 共 9.1 MB → WebP 0.6 MB（一張約 7 KB），跟原本的平均差 1/255、看不出差別。樣式裡那個 source 的網址改成自訂協定 `relief://{z}/{x}/{y}`（`WorldMap.tsx` 用 `addProtocol` 註冊 `loadReliefTile`）：0–3 級讀我們的 WebP（地球儀全球視角約縮放 2，用到 3 級的圖磚），4 級以上照舊讀 OpenFreeMap 的 PNG。一開始分成兩個 source（我們的到縮放 2.5、OpenFreeMap 的從 2.5 起），放大跨過 2.5 時新的圖磚到之前露出一塊塊空白；同一個 source 的話，MapLibre 會先放大上一級的圖磚墊著。面量圖的主題世界視角本來就不畫陰影（`baseRastersRef`）。Service worker 用 CacheFirst 快取看過的（`relief-tiles`）。
### Service worker（`src/sw.ts`）

| 內容 | 策略 | 快取名稱 | 上限 |
|---|---|---|---|
| App shell：`index.html`、第一個畫面要用的 JS/CSS（首頁程式、地圖程式與它們直接 import 的 chunk）、圖示、manifest、國名表 | 預先快取（安裝時下載，14 個檔、gzip 後約 510 KB，多半是第一個畫面已經下載的；檔名有雜湊的會用瀏覽器快取裡的） | `workbox-precache-v2-…` | 每次建置的清單 |
| 其他 JS/CSS（各主題、側欄、側欄圖表，建置時標成 `lazy`，`vite.config.ts` 的 `collectCoreAssets`） | cache first（檔名有雜湊）；網路不受限時安裝時就全部下載（約 150 個檔、gzip 後約 660 KB，離線也能換主題、開側欄），開了省流量模式或 2G 網路時（`navigator.connection`，只有 Chromium 有）只存用到的（2026-10-28 加） | `app-lazy` | 這一版的清單（新版啟用時刪掉舊的） |
| 資料 JSON（`/data/**`） | stale-while-revalidate：先給快取、背景向伺服器確認 | `data-<資料版本>` | 400 個檔 |
| 底圖樣式、`/planet`、圖示集 | stale-while-revalidate | `basemap-style` | 40 |
| 底圖字型 | cache first | `basemap-fonts` | 60 個、60 天 |
| 底圖圖磚（向量 `.pbf`、Natural Earth `.png`） | cache first（網址含版本，內容不變） | `basemap-tiles` | 300 張、30 天 |
| 1 km 網格圖磚（`/tiles/**.png`，第 14 節） | cache first（網址含版本） | `grid-tiles` | 800 張（約 10 MB）、60 天 |
| 1 km 網格的 `meta.json` | network first（5 秒逾時才用快取）：它決定圖磚的版本，部署後要馬上換新 | `grid-meta` | 10 |
| 地形圖磚（AWS Terrain Tiles，只有海拔主題） | cache first（內容不變） | `terrain-tiles` | 200 張、30 天 |
| 國旗的 SVG（`/data/topics/flags/svg/*.svg`） | cache first（檔名含內容的雜湊，內容不變）；另一個快取，不跟資料 JSON 的 400 個上限搶位置 | `flag-images` | 300 個、120 天 |

- **資料版本**：建置時把 `public/data` 全部內容算雜湊（`vite.config.ts` 的 `dataVersion()`，用 `define` 傳給 service worker）。資料有變，資料快取就換一個新名字，新版 service worker 啟用時刪掉舊的；只改程式不改資料時，資料快取照用。
- **資料一律向伺服器確認**（`cache: 'no-cache'`，沒變只回 304）：GitHub Pages 的 `max-age=600` 會讓瀏覽器在部署後 10 分鐘內還拿舊檔，新的資料快取就會存到舊資料。
- **底圖**：只快取使用者看過的圖磚，不主動下載整個區域。OpenFreeMap 的使用條款禁止自動大量抓取（離線下載每次最多 3,000 張或 50 MB），沒有限制瀏覽器快取；這裡的上限遠低於此。
- **直接開任何畫面**（`?topic=…&country=…`）都用預先快取的 `index.html`；直接開資料檔的網址照常回傳檔案。
- **只在正式版註冊**（`main.tsx`），等地圖第一次畫出資料（或頁面載入完 10 秒）才註冊。
- **可以安裝**：`vite-plugin-pwa` 產生 `manifest.webmanifest`；圖示在 `public/icons/`（一般、maskable、apple-touch-icon），由 `icon.svg` 用無頭 Chrome 畫成 PNG。
- **離線**：標題旁顯示「離線中」（`src/lib/useOnline.ts`）。資料、地圖都是上次看過的部分；沒看過的主題會顯示「資料載入失敗」。

**部署新版時**（`skipWaiting` + `clientsClaim`，沒有「有新版本」的提示）：

1. 部署後第一次開：先用快取裡的舊版（不等網路），背景下載新版的 app shell。
2. 新版裝好就直接接手，刪掉舊版的預先快取與舊版資料快取。
3. 已經開著的舊頁面繼續能用；如果它要載入的舊 chunk（例如點國家才載入的圖表）已經不在伺服器上，`main.tsx` 的 `vite:preloadError` 會自動重新整理一次，換成新版（`sessionStorage` 記住，避免一直重新整理）。
4. 下一次開就是新版。

這個流程用無頭 Chrome 實際跑過（v1 → 部署 v2，開著的舊頁面點國家），見下方「部署更新測試」。

**資料格式改了要注意**：舊頁面在新版接手後，拿到的資料是新的。指標檔的格式要保持舊程式也能讀，或像差分編碼這樣在前端加上還原、舊格式照樣能讀。

### 每個主題的網址、預覽圖與嵌入（2026-10-29）

分享到 LINE、Facebook 時原本都是同一張圖、同一個標題（描述還寫著「近 80 個主題」），搜尋引擎也只看得到首頁。

- **網址改成路徑**：`/map/t/<主題>/?country=TWN&year=2023`（`url-state.ts` 的 `topicPath`、`siteRoot`）。舊的 `?topic=` 照樣讀得懂（優先於路徑，主題之間的連結 `TopicLink` 也改成新的寫法），寫回網址時換成新的。網站首頁 `/map/` 是預設的人口主題。
- **每個主題一份 HTML**（`vite.config.ts` 的 `topicPages`）：建置時把首頁的 HTML 複製到 `t/<主題>/index.html`，換掉 `<title>`、`description`、`og:title`、`og:description`、`og:url`、`og:image`，加上 `canonical`；說明用主題名稱與前四個指標（「各國生育率與高齡化：總生育率、65 歲以上人口比例、扶老比、出生數。互動世界地圖，拖時間軸看歷年變化，還有排名表與各國比較。」）。另外產生 `sitemap.xml`（首頁與每個主題，`lastmod` 是建置日）。`robots.txt` 只在網域根目錄有效（`skywitness.github.io/robots.txt` 不在這個 repo），所以 sitemap 要在 Google Search Console 提交。
- **建置改用絕對路徑**（`base: '/map/'`，開發伺服器照舊 `/`）：原本是相對路徑 `./`，在 `t/<主題>/` 底下會變成 `t/<主題>/assets/…`。試過在 HTML 開頭用程式放 `<base>`，但瀏覽器的預先掃描（preload scanner）不跑程式，第一輪照樣用錯的路徑抓（404）；從首頁換主題後網址變成 `t/<主題>/`，之後相對路徑的 `fetch` 也會錯。`index.html` 的相對網址改成 `%BASE_URL%`，`preloadMapChunk`、`preloadTopicChunk` 寫 `/map/`，主題總覽的縮圖用 `import.meta.env.BASE_URL`。換網域或路徑時改 `vite.config.ts` 的 `SITE`。
- **service worker**：離線時任何網址（含 `t/<主題>/`）都用預先快取的首頁 HTML 回應，絕對路徑所以抓得到 assets；預覽圖、主題頁的 HTML 不預先快取（給爬蟲的）。
- **預覽圖**（`scripts/og-topics.mjs`，`public/og/<主題>.jpg`，1200×630、每張約 70 KB，98 張約 7 MB）：跟首頁的預覽圖同一種深藍底，上緣一條分類代表色，左邊分類的圖示與名稱、主題名稱（括號裡的補充不寫，字級依長度 46–62px）、前五個指標，右邊是主題總覽的縮圖，下面網站名稱、網址與底圖的版權。不用開發伺服器，腳本自己開一個小伺服器給卡片、縮圖與字型。字型用思源黑體（`OG_FONT_DIR` 指到 `@fontsource/noto-sans-tc`；沒設時用系統字型）。沒有預覽圖的主題用首頁那一張。新增主題時跑 `node scripts/og-topics.mjs <主題 id>`（第 4 節）。
- **嵌入模式**（`?embed=1`，`url-state.ts` 的 `embed`、`App.tsx` 的 `.is-embed`）：給部落格、新聞、教材放在 iframe 裡。頂列換成主題名稱與「在世界資料地圖開啟 ↗」（新分頁開完整網站，網址在點的當下才算），控制列只留指標，不顯示指標說明、搜尋、地圖／排名表、分享，頁尾只留資料來源一行；地圖、圖例、時間軸、點國家的側欄照常。分享選單多一項「複製嵌入程式碼」：`<iframe src="…?embed=1" title="…" width="100%" height="560" style="border:0" loading="lazy" allowfullscreen>`。GitHub Pages 沒有 `X-Frame-Options`，別的網站可以嵌入。

### 部署更新測試

用無頭 Chrome 在本機模擬兩次部署（v2 改了程式與一個資料檔），伺服器用 `no-cache`，強迫瀏覽器每次都向伺服器確認（最嚴格的情況）：

| 步驟 | 結果 |
|---|---|
| 第一次開 v1 | service worker 接手 |
| 部署 v2 後第一次開 | 先用快取裡的 v1（不等網路），背景裝好 v2 的 service worker |
| v2 接手 | v1 的資料快取已刪除 |
| 一直開著的 v1 頁面點國家 | 舊的側欄 chunk 在伺服器上已經 404 → 自動重新整理成 v2，網址狀態（`?country=JPN`）保留，側欄正常顯示 |
| 再開一次 | v2；資料是 v2 的新檔，不是瀏覽器快取裡的舊檔 |

伺服器用 GitHub Pages 的 `max-age=600` 時，開著的舊頁面在 10 分鐘內還能從瀏覽器快取拿到舊 chunk，不會重新整理，一樣正常。

**看過一次就能離線開啟**：桌機與手機（Fast 3G、4× CPU）各只開一次、等下載結束後切成離線再開，地圖與資料都正常出現，標題旁顯示「離線中」，沒有失敗的請求。

## 14. 網格圖層：人口密度的 1 km 網格、暖化的 0.5° 網格、太陽能與風能的約 2 km 網格、夜間燈光的約 500 m 網格、航運密度的約 5 km 網格、網路速度的約 2 km 網格

網格的前端（`src/map/densityGrid.ts`）是通用的：指標設了 `grid`（`GridSpec`），控制列就多一個「國家平均 / 網格」切換，圖磚、`meta.json` 的格式、不請求空圖磚、service worker 的快取都一樣。下面先寫人口密度的 1 km 網格，最後三小節是氣溫與降雨主題的暖化 0.5° 網格、太陽能與風能潛力主題的約 2 km 網格、夜間燈光主題的約 500 m 網格。


人口主題選「人口密度」時，控制列多一個「國家平均 / 1 km 網格」切換（網址 `grid=1`）。網格模式把每個約 1 km 見方的格子依每 km² 人數上色：台灣的西部走廊與中央山脈、尼羅河谷與兩旁的沙漠一眼就分得出來，國家平均做不到。

### 資料與上色（`pipeline/topics/population_density_tiles.py`）

- **來源**：JRC GHS-POP R2023A，30 角秒（赤道約 0.93 km），1975–2030 每 5 年一期，2025、2030 是推估，CC BY 4.0。下載與框選估算共用 `pipeline/sources/ghsl.py`。
- **密度 = 格子人數 ÷ 格子的真實面積**：球面上的面積是 R² × 經度寬 × (sin 北緣 − sin 南緣)。赤道一格 0.86 km²，北緯 60° 只剩一半。不能當成「每格 1 km²」，否則高緯度的密度會少算一半。
- **分級**：7 級，門檻 1、10、50、250、1,000、5,000 人/km²，對數間距（大約每級 ×5）。
  - 顏色是 `tokens.ts` 的 ORANGE，也就是地圖的循序色。pipeline 直接讀 `tokens.ts`，顏色仍只有一個來源；`meta.json` 記下實際用的顏色，圖例照它畫，跟圖磚一定一致。
  - 原本考慮 8 級（<1、1–5、5–25、25–100、100–250、250–1,000、1,000–5,000、>5,000），但循序色只有 7 階，面量圖與圖例也最多 7 級，所以併成 7 級。
- **透明**：每 km² 不到 0.1 人的格子不上色，透出底圖。
  - GHS-POP 把普查區的人口分到建成區；整區都沒有建成區時，會平均攤到整區，沙漠、凍原上出現大片每 km² 只有 0.00x 人的格子，不設下限的話整片撒哈拉都會上色。
  - 2020 年：有人口的格子共 4,250 萬格，不到 0.1 的占 11%，但人數合計約 10 萬人（全球的 0.001%）。
- **各級的格子數與人口**（2020 年，30 角秒原始格子）：

| 每 km² 人數 | 格子 | 人口 |
|---|---|---|
| 不到 0.1（透明） | 476 萬 | 約 10 萬 |
| 0.1–1 | 537 萬 | 180 萬 |
| 1–10 | 1,082 萬 | 3,280 萬 |
| 10–50 | 861 萬 | 1.5 億 |
| 50–250 | 699 萬 | 6.1 億 |
| 250–1,000 | 391 萬 | 14.5 億 |
| 1,000–5,000 | 166 萬 | 24.9 億 |
| 5,000 以上 | 36 萬 | 31.0 億 |

  四成的人住在不到 1% 的格子裡（每 km² 5,000 人以上）。

- **切成圖磚**：Web Mercator、512 px、z0–z7（MapLibre 的縮放級數以 512 px 為準，z7 的圖磚在地圖縮放 7 時一比一顯示）。
  - z7 的一個像素是 19.8 角秒，比原始格子細：每個像素取中心所在的那一格（最近鄰），所以是完整解析度。
  - 再放大由 MapLibre 拉大 z7 的圖磚。`raster-resampling: nearest`：格子維持方塊；線性內插會把相鄰兩級混成圖例上沒有的顏色。
    - 一個格子在 z7 是 1.5 個像素寬，所以拉大後格子寬度會一格寬、一格窄（例如縮放 10 時 8 或 16 px）。
  - 縮小時一個像素涵蓋好幾格，顏色是像素範圍內的總人數 ÷ 總面積（含海洋與無人區），也就是平均密度。全球視角看到的是「那一帶」的密度，不是城市本身，圖例寫明「縮小時為範圍內平均」。
- **做法**：
  - 原始檔只讀一次，8 個縮放級數一起算：由北往南一次讀 256 列，湊滿一整排圖磚就輸出。像素列對應到同一段原始列的，只算一次。
  - 每期一個行程，4 期同時跑，每個行程約 0.5 GB 記憶體。
  - PNG 自己編碼：調色盤模式、每像素 4 位元、0 號透明。試過 WebP 無損只小 11%，不值得為它多裝 Pillow。
  - 先寫到 `population-density.tmp/`，全部成功才換掉舊的。Windows 上資料夾被 Vite 開發伺服器監看時改名會被拒絕，改用複製。
- **時間**（這台 Windows 電腦）：單獨跑一期約 2 分鐘；12 期 4 個一起跑約 19 分鐘。四期同時跑幾乎沒有變快，因為防毒軟體逐一掃描新寫入的 6 萬個小檔。

### 大小

每期 4,997–4,998 張、47.5–49.3 MB；12 期共 59,976 個檔、585 MB。z7 平均每張 8 KB，z4–z6 約 13 KB。

| 縮放 | 每期張數 | 每期大小 | 平均 | 最大 |
|---|---|---|---|---|
| z0–z3 | 52 | 0.6 MB | 12 KB | 55 KB |
| z4 | 119 | 1.5 MB | 13 KB | 70 KB |
| z5 | 361 | 4.8 MB | 14 KB | 80 KB |
| z6 | 1,084 | 14.6 MB | 14 KB | 89 KB |
| z7 | 3,382 | 27.2 MB | 8 KB | 49 KB |

- 海洋、無人區的圖磚不產生：z7 全世界有 16,384 個位置，有內容的只有 3,382 個。
- 圖磚位置取「任何一期有內容」的聯集，某一期剛好沒內容的位置補一張透明圖磚。前端只需要一張位元表，不必分期記錄。
- 網站總大小：圖磚 585 MB，加上原本約 55 MB，GitHub Pages 1 GB 的上限內還有空間。

### 放在哪裡

先量大小再決定：

| 做法 | 評估 |
|---|---|
| 進版本庫 | 6 萬個檔、585 MB，每次重新產生又多一份留在歷史裡。不行 |
| 每期一個 PMTiles 檔 | 每個 49 MB，在 GitHub 100 MB 的單檔上限內，但放進 git 一樣會膨脹。另外要多一個 `pmtiles` 套件，靠 HTTP range 請求讀取；service worker 快取 range 請求要先存整個檔，不適合只快取看過的部分 |
| 另一個 repo、分支、Release 附件或外部主機 | 要在這個 repo 以外建東西；部署多一個來源 |
| **部署時在 GitHub Actions 產生（採用）** | 不進版本庫，也不需要外部服務。圖磚存在 `actions/cache`，跟 `dist` 一起上傳到 Pages |

部署流程（`.github/workflows/deploy.yml`）：

1. 快取鍵是產生程式（`population_density_tiles.py`、`ghsl.py`）與 `tokens.ts` 的 ORANGE 區塊的雜湊。介面的其他顏色改了不會觸發重新產生。
2. 快取命中：直接還原約 585 MB，不裝 Python。
3. 沒有命中：先還原上一版（`restore-keys`），再裝 numpy、rasterio，執行 `population-density-tiles`。
   - 設了 `GHSL_PRUNE=1`：每期讀完就刪掉下載的 zip 與 GeoTIFF，12 期全留著要 10 GB。
   - 成功才存進快取；失敗（例如 JRC 的伺服器連不上）時照樣部署，用上一版的圖磚。
   - 連上一版都沒有時，網站上切到網格會顯示「1 km 網格載入失敗，先顯示國家平均」。
4. `actions/cache` 7 天沒用到會被清掉：超過一週沒有推送時，下一次部署要重新產生。

### 前端（`src/map/densityGrid.ts`）

- **`meta.json`**：版本、各期、推估從哪一期開始、分級門檻與顏色、哪些圖磚有內容（每個縮放級數一串位元，base64）；`attribution` 是地圖右下角的來源標示（沒有的是 GHS-POP），`minDensity` 只有人口密度有。
- **文字**：切換鈕的名稱、標題後面的「（1 km 網格）」、網格模式的說明、圖例上每一期的說明、不上色的格子，預設是人口密度的（`GRID_TEXT`），指標的 `GridSpec` 可以覆寫（`label`、`subtitle`、`epochNote(期, 是否推估)`、`empty`），`gridLabels()` 合併兩者。
- **換成另一個網格**：圖磚大小、最大級數或來源標示不同時（例如從人口密度換到暖化），先拿掉舊的 source 再加新的；同一個網格換期只 `setTiles`。
  - 一律向伺服器確認（`cache: 'no-cache'`）；service worker 用 network first。版本號在圖磚網址裡，部署後舊版本的圖磚就不在伺服器上了。
  - 網址帶 `grid=1` 時，App 一啟動就跟指標檔一起請求。
- **不請求空圖磚**：圖磚用自訂協定 `densitygrid://<資料夾>/<版本>/<年>/{z}/{x}/{y}` 載入（`WorldMap.tsx` 用 `addProtocol` 註冊）。
  - 先查位元表，沒有內容的直接給一張 1×1 的透明 PNG；有內容的才 `fetch` 真正的檔案（經過 service worker）。
  - 不這樣做的話，全球視角一半以上是海洋，每次都是一堆 404。
- **時間軸 → 哪一期**：那一年以前最近的一期。
  - 1975 年以前用 1975，2030 年以後用 2030。
  - 預設的 2023 年顯示 2020 年那一期（實測），不是 2025 年（推估）。
  - 圖例寫出是哪一期，2025、2030 標「推估」。
  - 換期時用 `setTiles` 換網址；新圖磚到之前舊的留在畫面上。
- **國家**：
  - 國家的顏色（`data-fill`）改成透明，但照樣可以 hover、點選。tooltip 仍是國名與國家平均，後面加「國家平均」。
  - 國界（`data-border`）、選取外框照畫。小國的圓點不畫，免得被看成網格的顏色。
- **圖層順序**：網格插在 `data-fill` 下面，也就是底圖的道路之上、國界與地名之下。
- **底圖切換**：新樣式沒有網格圖層。依 `revision` 重跑的 effect 會重新加上 source 與圖層。
- **透明度**：縮放 4 以下 0.92，縮放 13 降到 0.62。放大後看得到底圖的街道，對照格子在哪裡。
- **3D**：網格維持平面、國家不拉高，只傾斜地圖，圖例加註「3D 時網格不拉高，只傾斜地圖」。
  - 點陣圖沒辦法依格子拉高。
  - 拉高國家平均的話，高度跟網格的顏色講的是兩件事。
  - 流向圖在 3D 也是同樣的做法。
- **框選**：照常可用，框和結果卡片畫在網格上面。
- **匯出圖片**：
  - 標題是「人口密度（1 km 網格）」。
  - 圖例跟畫面上一樣，寫出是哪一期，「無資料」換成「每 km² 不到 0.1 人（不上色）」。
  - 副標題不含 hover 的提示。
- **地球儀與平面**：都能用，MapLibre 的點陣圖層兩種投影都支援。
- **排名表**：網格只影響地圖；切換鈕只在地圖檢視出現。
- **離線**：圖磚在頁面上 `fetch`，第一次造訪時還沒有 service worker。它接手後由 `src/lib/serviceWorker.ts` 補存（跟資料 JSON 同一套）。
  - 實測：開一次就有 `grid-meta` 1 個、`grid-tiles` 9 張。
  - 切成離線再開，網格照常出現，沒有失敗的圖磚請求。
- **本機開發**：沒跑 `npm run data -- population-density-tiles` 時沒有 `public/tiles/`。切到網格會出現「1 km 網格載入失敗」，地圖照常畫國家平均。

### 效能

方法同第 13 節：`npm run build` 後用 `scripts/serve-pages.mjs` 模擬 GitHub Pages，`npm run measure:load` 量 3 輪取中位數。

- 網址：`?topic=population&ind=density&grid=1`。
- `--mark map-grid`：網格圖磚第一次全部畫好時（`WorldMap` 留下的 performance mark）。同時也記下 `map-data`（國界畫上）。
- 對照：同一台機器、同一段時間量國家平均（`?topic=population&ind=density`）。

| 情況 | 國家平均：地圖出現資料 | 1 km 網格：國界畫上 | 1 km 網格：網格畫好 |
|---|---|---|---|
| 手機首次載入（Fast 3G、4× CPU） | 6.7 秒，504 KB | 7.8 秒 | **11.2 秒**，到這時下載 542 KB |
| 手機再次載入 | 5.9 秒 | 8.3 秒 | **10.5 秒**，0 KB（全部由 service worker 回應） |
| 手機離線開啟 | — | — | 12.3 秒 |
| 桌機首次載入 | — | — | **2.7 秒** |
| 桌機再次載入、離線 | — | — | 2.4 秒、2.0 秒 |

- **圖磚本身很小**：全球視角約 10 張、40–115 KB（z0–z2 每張約 11 KB）。放大到台灣（縮放 7）約 18 張、220 KB；z7 平均每張 8 KB。
- **網格比國界晚約 3.5 秒**，主要是 CPU：
  - 再次載入時完全不用網路，還是晚 2 秒左右。
  - 地圖畫出第一個畫面後，1:50m 國界的解析、Natural Earth 地形圖磚與網格圖磚的解碼在同一段時間進行。在 4 倍慢的 CPU 加軟體繪圖（SwiftShader，2 倍像素）上會排隊。
- 網格模式的「國界畫上」也比國家平均慢約 1 秒，同樣是圖磚解碼在搶 CPU。

數字會受這台機器同時在跑的工作影響（第 13 節「量測本身的陷阱」）。這次的國家平均比第 13 節的 7.3 秒還快，是因為那次也同時跑著其他工作。

### 驗證

無頭 Chrome（puppeteer-core + SwiftShader，第 10 節）：

- 全球、台灣（縮放 7.3 與台北縮放 10.5）、尼羅河谷、換成深色底圖、深色介面、375 px 寬、3D、平面、英文版、框選、匯出圖片都截圖檢查。
- 沒有主控台錯誤，圖磚請求沒有 4xx。
- 台北 tooltip：「668 人/km²｜台灣 · 2020 · 國家平均」。
- 台灣框選在網格模式下照常是 2,830 萬人。
- 換成深色底圖後，網格圖層、國界都還在。
- 3D：傾斜 50°、平面投影，`extrude-countries` 隱藏。
- 英文版 2027 年顯示「2025 grid (projection)」。
- 換年份換期：2022 年 → 2020 年那一期。
- 切回國家平均：網格隱藏，國家顏色恢復。
- 375 px 寬沒有橫向捲動。

### 暖化的 0.5° 網格

- 氣溫與降雨主題的「暖化」也有網格（`grid: { dir: 'warming', label, subtitle, epochNote, empty }`），切換鈕是「0.5° 網格」。`pipeline/topics/temperature_grid_tiles.py` 用同一份 CRU TS，每個陸地格子各自算「近 10 年平均 − 1951–1980 年平均」，**每一年一期**（1910–2025，共 116 期），前端挑時間軸那一年以前最近的一期。
- Web Mercator、512 px、z0–z4：z4 的一個 0.5° 格子在赤道約 11 px，再放大由 MapLibre 用 nearest 拉大。放大時取像素中心所在的格子；縮小時取像素範圍內陸地格子的 cos(緯度) 加權平均（海洋不算進分母），實際上只有 z0（一個像素約 0.7°）會平均。海洋、南極洲是調色盤 0 號（透明）。
- 7 級，門檻跟國家指標一樣；顏色是 `MAP_TOKENS.diverging` 反過來（負值青綠、正值橘），從 `tokens.ts` 的 ORANGE、AQUA 與 `diverging` 那一行解析。門檻定義在 `temperature_grid_tiles.py`（`temperature.py` 從這裡 import），產生時會檢查 `src/topics/temperature.ts` 的 `WARMING_THRESHOLDS` 一樣。
- 重新取樣、PNG 編碼、位元表與換資料夾都 import 人口密度那一支（`population_density_tiles.py`），不修改它。
- 大小：每期 206 張（z0 1、z1 4、z2 12、z3 44、z4 145），每期 153–183 KB，116 期共 23,896 個檔、19.8 MB（平均每張 0.85 KB；NTFS 上佔 71 MB）。這台 Windows 4 個行程 3–5 分鐘（不含下載；機器忙時較慢）。
- `meta.json` 跟人口的一樣，另有 `attribution`（`CRU TS 4.10 (UEA CRU, NCAS)`），沒有 `minDensity`、`projectionFrom`。
- **部署**（`.github/workflows/deploy.yml`）：
  - 暖化圖磚自己一個快取（`public/tiles/warming`），排在人口圖磚存進快取之後才還原、產生，人口的快取（整個 `public/tiles`）才不會連暖化的一起存。
  - 快取鍵是圖磚程式、`cru.py`、`population_density_tiles.py`（重用它的 PNG 編碼）、`tokens.ts` 的 ORANGE、AQUA 與 `diverging` 那一行，以及 `temperature.ts` 的 `WARMING_THRESHOLDS`。
  - 沒有命中時只要 `pip install "numpy>=2" "rasterio>=1.4"`（rasterio 是因為 import 了人口那一支；讀 CRU 只要 numpy），下載 CRU TS 的月均溫 165 MB。這一支不 import `temperature.py`（國界要 pycountry）。
  - CRU 的伺服器連不上時照樣部署，用上一版的圖磚；連上一版都沒有時，切到網格會顯示「0.5° 網格載入失敗，先顯示國家平均」。
- **授權**：CRU TS 是 ODbL，網格圖磚與各國平均是衍生資料庫，同樣以 ODbL 提供（第 8 節第 12 點），地圖右下角的標示連到 CRU。

### 太陽能與風能的約 2 km 網格

- 「太陽能與風能潛力」主題的太陽光電潛力、風能潛力各有一個網格（`grid: { dir: 'renewables-solar' | 'renewables-wind', … }`），切換鈕是「約 2 km 網格」。`pipeline/topics/renewables_grid_tiles.py` 兩層各一個行程同時產生，重新取樣、PNG 編碼、位元表與換資料夾都 import 人口密度那一支，不修改它。
- **只有一期**：兩份都是長期平均（太陽能標 2025、風能標 2017），主題是 `timeless`。`gridEpoch()` 一律回傳唯一的一期，圖例用 `epochNote` 寫期間，前端不必改。
- 資料：太陽能是 Global Solar Atlas 的 PVOUT（30 角秒每 2 × 2 平均成 1 角分）；風能是 Global Wind Atlas 4.0 檔案裡現成的 1/8 縮小版（0.02°，只下載那一段，見第 8 節第 60 點）。
- Web Mercator、512 px、z0–z5：z5 一個像素在赤道約 0.022°，跟風能網格一樣大，再放大由 MapLibre 用 nearest 拉大（縮放 7–8 看得出方塊；更細的 0.01° 縮小版要下載 706 MB）。
  - 重新取樣同暖化網格：放大取像素中心的格子；縮小時取範圍內有資料格子的 cos(緯度) 加權平均，沒有資料的不算進分母。
  - 格子太多（風能 1.3 億、太陽能 1.6 億格），不做二維累加表：每個縮放級數把對應到同一段原始列的像素列合成一段，先依權重把那幾列加成一列，再用一維累加算每個像素的欄範圍。
- 7 級，門檻跟國家面量圖一樣，寫在 `renewables.ts`（`SOLAR_THRESHOLDS`、`WIND_THRESHOLDS`）；圖磚程式有同一組，產生時檢查。顏色是 ORANGE。
  - 透明：太陽能的海面、北緯 65° 以北（俄羅斯大多是 60° 以北）、冰島、南極洲；風能的公海（專屬經濟海域以外）、北緯 80° 以北、南極洲。風能的海上有資料，台灣海峽整片在最高一級（800 W/m² 以上）。
- 大小：太陽能 428 張、2.3 MB；風能 718 張、6.8 MB（z5 507 張、4.1 MB）。
- 時間（這台 Windows、台灣的網路）：從零開始（`--refresh`）2 分 16 秒（風能下載 96 秒、太陽能下載＋解壓＋平均 109 秒，兩個行程同時跑，各約 2 GB 記憶體）；資料已在快取時 42 秒。
- `meta.json` 跟暖化的一樣，有 `attribution`（GSA、GWA 的短標示，CC BY 4.0，地圖右下角），`citation` 是兩邊使用條款要求的完整引用文字。
- **部署**（`.github/workflows/deploy.yml`）：
  - 一個快取（`public/tiles/renewables-solar` 與 `renewables-wind` 兩個路徑），排在人口圖磚存進快取之後。
  - 快取鍵含圖磚程式、`gsa.py`、`gwa.py`、`population_density_tiles.py`、`tokens.ts` 的 ORANGE、`renewables.ts` 的兩行門檻。
  - 沒有命中時 `pip install "numpy>=2" "rasterio>=1.4"`（rasterio 讀 GeoTIFF、含 GDAL 的 `/vsisparse/`），下載 345 MB＋182 MB，GitHub Actions 上約 3 分鐘，`pipeline/.cache/gsa` 會長到約 1.4 GB；30 分鐘逾時、`continue-on-error`，伺服器連不上時照樣部署，用上一版的圖磚（連上一版都沒有時，切到網格會顯示載入失敗、改畫國家平均）。

### 夜間燈光的約 500 m 網格

- 「夜間燈光」主題的「平均亮度」有網格（`grid: { dir: 'night-lights', …, defaultOn: true }`），切換鈕是「約 500 m 網格」，**一打開主題就是網格**（`GridSpec.defaultOn`，見第 4 節的表；網址沒有 `grid` 參數時用指標的預設，切回國家平均時寫 `grid=0`，其他網格的行為不變）。`pipeline/topics/night_lights_tiles.py` 用 EOG 的 Annual VNL V2 average_masked（15 角秒，`sources/vnl.py`），**只做 2013、2017、2020、2024 四期**（2017 年起跟之前不完全可比，第 8 節第 65 點，所以有一期從 2017 年開始），前端照樣挑時間軸那一年以前最近的一期。
- **重新取樣**：不修改人口密度那一支，繼承它的 `Level`、只換 `classify`：把「每格亮度 × 面積」當成人數餵進去，「人數 ÷ 面積」就是面積加權的平均亮度；逐 512 列讀 COG（圖塊 512 × 512），所有級數一起算。z7 一個像素 19.8 角秒，比原始格子（15 角秒）略粗，所以 z7 也是平均；縮小時是範圍內的平均（沒有燈光的格子算 0），全球視角城市還在，鄉間的路燈、零星的漁船會淡掉，放大才出來。北緯 75° 以北的 nodata 當成 0。
- **分級與顏色**：7 級，門檻 0.1、0.3、1、3、10、30 nW/cm²/sr（對數間距，國家平均與網格共用，`night-lights.ts` 的 `LIGHT_THRESHOLDS`，產生時檢查）。顏色是 `tokens.ts` 的 `NIGHT`（pipeline 直接讀這一段）：第一個是夜色 #0d1228，之後 6 級由暗到亮是深褐 #6f351d → 橘 → 黃 → 近白 #fcf4be（OKLCH 亮度 0.19 到 0.96 等距，色相只在 42°–100° 的橘黃之間；跟夜色的對比 1.9–16.6:1）。轉存檔只到整數 nW/cm²/sr，原始格子不是 0 就是 1 以上（第 4 級起），第 2、3 級只在幾個格子平均起來時出現（縮小後暗的一片光暈、燈光區的邊緣）。
- **夜色底（`meta.json` 的 `backdrop`）**：燈光的配色是「越亮越亮」，畫在預設的彩色地形底圖（淺綠、淺褐、藍色的海）上，第 2–4 級的深褐、橘跟地形色混在一起，最亮的近白反而看不見。所以：
  - 圖磚裡第一級（平均不到 0.1，也就是沒有燈光）是透明的，前端在資料範圍（南緯 62° 到北緯 75°，`vnl.LAT_RANGE`）鋪一層同色的 GeoJSON 填色（`grid-backdrop`，插在網格圖層底下，切成東西兩半，地球儀上才不會繞錯），不透明度跟網格一樣（縮放 4 以下 0.92，放大後變淡，看得到底圖的街道），圖例的第一格就是夜色。任何底圖上都是一張夜景，深色、深藍底圖上幾乎看不出這層。
  - 不在圖磚裡畫夜色：海洋、沙漠的圖磚會全部變成「有內容」（z7 從 3,400 張變成上萬張），也會多一堆請求。
  - **不自動換成深色底圖**：底圖是使用者的設定（記在 localStorage），換主題就偷偷換掉（再換回來）很突兀，也要多下載一次樣式；夜色底只在網格模式出現，切回國家平均、換主題就沒了，底圖選單也照常可以換。
  - 夜色底開著時，國界（`data-border`）與選取外框（`data-highlight`）改用深色底圖的淺色（`nightLook`），彩色地形的地名本來就有白色光暈，在夜色上看得清楚。
  - 資料範圍外（北緯 75° 以北、南緯 62° 以南）沒有夜色，透出底圖，圖例的「沒有上色」寫「北緯 75° 以北、南緯 62° 以南（沒有資料）」。
- **大小與時間**：每期 4,627–5,068 張、23–31 MB；4 期共 5,197 個圖磚位置、約 2.1 萬個檔（含補的透明圖磚）、106 MB（z7 每期約 3,100–3,400 張、14–19 MB）。燈光逐年變多，2024 年那一期最大。這台 Windows 4 期同時跑約 2.5 分鐘（資料已在快取時）。加上人口的 585 MB 等，網站約 790 MB，還在 GitHub Pages 1 GB 的上限內；每年一期（12 期）會再多約 200 MB，所以只做四期。
- `meta.json` 跟暖化的一樣，有 `attribution`（`Source: EOG, Colorado School of Mines (Annual VNL V2), CC BY 4.0`，EOG 授權文件對篇幅小的圖要求的標示）與 `citation`（EOG 要求的完整聲明與引用），另有 `backdrop`。
- **部署**（`.github/workflows/deploy.yml`）：
  - 一個快取（`public/tiles/night-lights`），排在人口圖磚存進快取之後。
  - 快取鍵含圖磚程式、`vnl.py`、`population_density_tiles.py`、`tokens.ts` 的 `NIGHT`、`night-lights.ts` 的 `LIGHT_THRESHOLDS`。
  - 沒有命中時 `pip install "numpy>=2" "rasterio>=1.4"`，從 Zenodo 下載 4 年（約 270 MB；主行程一個檔一個檔下載，每個檔 24 條連線，HTTP 429 照 Retry-After 等，再交給 4 個行程算），`VNL_PRUNE=1` 算完一期就刪掉；第一次部署（2026-10-25）GitHub Actions 上每個檔 5–6 秒就下載完，整個步驟 3 分 20 秒、整個部署約 5.5 分鐘；45 分鐘逾時、`continue-on-error`，Zenodo 連不上時照樣部署，用上一版的圖磚（連上一版都沒有時，網站上切到網格會顯示「約 500 m 網格載入失敗，先顯示國家平均」）。

### 航運密度的約 5 km 網格

- 「航運與港口」主題的「航運密度」（`grid: { dir: 'ship-density', only: true, defaultOn: true, … }`）：**只有網格**，沒有國家平均可以切換（`GridSpec.only`，2026-10-26 新增，見第 4 節的表）；指標是 `kind: 'none'`，tooltip 與排名表用貨櫃吞吐量。圖例的單位用 `GridSpec.unit`（「平均 AIS 船位」），不是指標的 TEU。
- **資料**（`pipeline/sources/ship_density.py`）：世界銀行資料目錄 0037580 的「所有船種」（`shipdensity_global.zip`，535 MB，CC BY 4.0），IMF 分析 2015 年 1 月–2021 年 2 月每小時的 AIS 船位，0.005°（約 500 m）的 int32 GeoTIFF，72,006 × 33,998 格（北緯 85° 到南緯 85°），解壓後 9.8 GB。
  - 先用 Python 的 zipfile 把 GeoTIFF 依序解壓到快取資料夾（9.8 GB，讀完就刪，留 zip），再每次讀 512 列（GeoTIFF 是 128 × 128 的區塊），每 4 × 4 格平均成 0.02°（含 0 的格子，nodata 不算），存成 `.cache/ship-density/global_mean_4.npz`（612 MB）。這台 Windows 解壓 44 秒、全部 97 秒。
  - 一開始不解壓，用 GDAL 的 `/vsizip/` 直接讀：這台 Windows 要 7 分鐘，第一次部署（2026-10-26）GitHub Actions 上讀了 34 分鐘（整個步驟 36 分鐘，逾時是 40 分鐘），GDAL 在壓縮串流裡定位很慢。改成先解壓之後結果完全一樣（逐格比對），本機快 4 倍。
  - zip 裡附的縮小版（`.tif.ovr`）是**取樣**（大洋中間單獨一格就是千萬），不是平均，不能用。
  - 數值的分布很怪：有船的 500 m 格子多半是 1–100，主要航道卻是千萬以上（英吉利海峽約 3,000 萬），中間很少，看起來不像單純的「每小時一個船位」。所以只當成相對的強度：對數分級，說明寫「只能看相對的多寡」，圖例寫成 10 的次方。
- **圖磚**（`pipeline/topics/shipping_density_tiles.py`）：Web Mercator、512 px、z0–z4（z4 一個像素在赤道約 0.044°、約 5 km，所以叫「約 5 km 網格」，再放大由 MapLibre 拉大）。重新取樣照太陽能與風能（cos(緯度) 加權平均、像素比格子小時取最近的格子），差別是門檻用在 log10 之後：平均不到 3×10⁴ 的透明（大洋上零星的船位、陸地），其餘 7 級，門檻 10⁵、3×10⁵、10⁶、3×10⁶、10⁷、3×10⁷（`TRAFFIC_MIN`、`TRAFFIC_THRESHOLDS`，跟 `shipping.ts` 一樣，產生時檢查）。一開始用 10³ 起、10⁷ 封頂，東亞的海、英吉利海峽整片都是最深的兩級，看不出航道；調高後台灣海峽的主航道、英吉利海峽的分道航行都分得出來，河運（萊茵河、長江、伏爾加河）也看得到。顏色是地圖的橘色循序色（`tokens.ts` 的 ORANGE），跟藍色的海對比清楚。
- **大小**：234 張、4.4 MB（z4 171 張、3.2 MB）。z5 會多約 9 MB，只做到 z4（這個主題的預算約 6 MB）。
- **部署**（`.github/workflows/deploy.yml`）：一個快取（`public/tiles/ship-density`），排在夜間燈光之後；快取鍵含圖磚程式、`ship_density.py`、`population_density_tiles.py`、`tokens.ts` 的 ORANGE、`shipping.ts` 的兩行門檻。沒有命中時 `pip install "numpy>=2" "rasterio>=1.4"`，從世界銀行下載 535 MB、解壓成 9.8 GB 再讀（GitHub Actions 上整個步驟 85 秒，其中解壓 23 秒；第一次部署用 `/vsizip/` 時是 36 分鐘），40 分鐘逾時、`continue-on-error`，連不上時用上一版的圖磚（連上一版都沒有時顯示「約 5 km 網格載入失敗」，`only` 的網格沒有國家平均可以退回）。

### 網路速度的約 2 km 網格

- 「網路速度」主題的「下載速度」（`grid: { dir: 'internet-speed-{item}', … }`）：切換鈕是「國家中位數／約 2 km 網格」（`GridSpec.countryValue`），**固網、行動各一組圖磚**，跟著子項目換資料夾（`dir` 的 `{item}`，`forItem()` 解析，第 4 節的表）。只有一期（Ookla 最新的 2026 年第 3 季），時間軸換年份也顯示這一期，圖例寫「每個年份都顯示這一季」。
- **不必重新取樣**（`pipeline/topics/internet_speed_tiles.py`）：Ookla 的圖塊本身就是 z16 的 Web Mercator 圖塊，512 px 圖磚在縮放 z 的一個像素剛好是 z+9 級的一個圖塊，所以每個像素就是把 x、y 右移 16−(z+9) 位的那一群 Ookla 圖塊。z5 的像素 = z14 的圖塊 = 4 × 4 個 Ookla 圖塊（赤道約 2.4 km，台灣約 2.2 km，歐洲約 1.6 km，所以叫「約 2 km 網格」），再放大由 MapLibre 拉大 z5 的圖磚。
- **像素的值**跟各國的值同一個算法：像素裡各 Ookla 圖塊的平均下載速度依測試次數加權的中位數（`internet_speed.weighted_medians()`）；縮小時一個像素涵蓋更多圖塊，就是那一帶所有測試的中位數。測試不到 5 次（`MIN_TESTS`）的像素透明：一兩次測試很不穩定，留白也看得出哪裡沒人測（鄉間、山區、Ookla 2026 年拿掉的俄羅斯、白俄羅斯等，第 8 節第 79 點）。
- 7 級，門檻跟國家的面量圖一樣（固網 10、25、50、100、200、300 Mbps，行動 10、25、50、100、150、250；`internet-speed.ts` 的 `FIXED_DOWNLOAD`、`MOBILE_DOWNLOAD`，產生時檢查），顏色是 `tokens.ts` 的 ORANGE（用人口密度那一支的 `ramp()`、`png()`、`occupancy()`）。
- **大小**：固網 425 張、1.90 MB，行動 380 張、1.22 MB（z5 各 275、242 張，1.05、0.61 MB），共 3.1 MB。只做到 z4 是 1.5 MB、像素約 5 km，台灣的西部平原與山區、城市與鄉間比較糊；z5 在這個主題約 5 MB 的預算內。
- `meta.json` 跟其他網格一樣，`attribution` 是 Ookla 的短標示（地圖右下角），`citation` 是 README 要求的完整標示，`license` 寫 CC BY-NC-SA 4.0（圖磚是改作，同樣以這個授權提供）。
- **部署**（`.github/workflows/deploy.yml`）：一個快取（`public/tiles/internet-speed-fixed` 與 `internet-speed-mobile` 兩個路徑），排在航運密度之後；快取鍵含圖磚程式、`internet_speed.py`（加權中位數）、`sources/ookla.py`、`population_density_tiles.py`、`tokens.ts` 的 ORANGE、`internet-speed.ts` 的兩行門檻。沒有命中時 `pip install "numpy>=2" "rasterio>=1.4" "pyarrow>=18"`，用 pyarrow 從 Ookla 公開的 S3 bucket 只讀最新一季固網與行動的 6 個欄位（約 180 MB），這台 Windows 下載加產生不到 1 分鐘（資料已在快取時約 20 秒）；20 分鐘逾時、`continue-on-error`，連不上時用上一版的圖磚（連上一版都沒有時顯示「約 2 km 網格載入失敗，先顯示國家平均」）。
