# 世界資料地圖：設計文件

用世界地圖呈現「跟國家有關的資料」，主題會陸續加入。這份文件記錄技術選型、架構，以及新增主題的方法。

## 1. 技術選型

| 層面 | 工具 | 為什麼 |
|---|---|---|
| 地圖繪製 | **MapLibre GL JS 5**（WebGL 向量地圖） | 可以一路放大到街道（zoom 18）；地球儀與平面可切換；資料圖層插在底圖文字下面，地名永遠看得到 |
| 底圖 | **OpenFreeMap** 的 5 種樣式（免費、不需金鑰），使用者可切換 | 預設 Liberty：低縮放是 Natural Earth II 彩色地形，放大後是 OpenStreetMap 細節；地名改用 `name:zh-Hant` |
| 投影 | **地球儀**（預設），可切換成平面（Web Mercator） | 地球儀沒有高緯度放大的問題；平面方便一次看全世界 |
| 國界 | **Natural Earth 1:50m**（world-atlas 套件） | 給資料上色、點選、框選用；1:110m 沒有新加坡、巴林等小國 |
| 側欄圖表 | **ECharts 6**，按需引入 | 點國家時才載入（約 180 KB gzip），不拖慢首頁 |
| 色彩與比例尺 | d3-scale | 分級門檻固定寫在主題設定裡 |
| 前端 | Vite + React + TypeScript | |
| 資料處理 | Python（`pipeline/`），離線執行 | 前端只讀靜態 JSON，不需要後端 |
| 部署 | GitHub Pages（GitHub Actions 自動建置） | `vite.config.ts` 已設 `base: './'` |

**為什麼是 MapLibre 5 而不是 6**：
- MapLibre 6 把 web worker 拆成獨立的 ES module 檔，經過 Vite 打包後 worker 找不到，底圖整個出不來。
- 5.x 把 worker 內嵌在主程式裡，可以直接使用。
- 升級前要先解決 worker 的載入路徑。

**之後可以升級**：省/州/城市層級或大量點資料可以再加 deck.gl。

**一開始用 D3 + Equal Earth**：2026-10-22 改成 MapLibre，因為使用者要能放大到更細，也想要類似 Google 地圖的彩色地球儀。

## 2. 架構

```
原始資料（UN、IMF、World Bank、Ember、FAOSTAT、Harvard Atlas、主計總處、JRC GHSL、OpenStreetMap、Epoch AI、Anthropic、Microsoft、Our World in Data…）
   │  pipeline/run.py  下載到 pipeline/.cache/，清理、對齊 ISO 代碼
   ▼
public/data/                              ← 靜態 JSON，會進版本控制
   ├─ geo/countries-50m.json              國界（TopoJSON，id 已換成 ISO alpha-3）
   ├─ countries.json                      ISO 對照表（alpha-3 → alpha-2、英文名）
   └─ topics/<主題>/
        ├─ <指標>.json                    每個指標一個檔，含所有年份
        ├─ <指標>/<子項目>.json           有子項目的指標（例如 production/rice.json）
        ├─ countries/<ISO3>.json          側欄額外區塊用的單一國家明細
        ├─ grid.json                      框選用的網格人口（只有人口主題）
        └─ manifest.json
   │
   ▼  fetch
src/
   ├─ topics/          每個主題一個設定檔（TopicDefinition）  ← 新增主題主要改這裡
   │   └─ panels/      主題自訂的側欄區塊（動態載入）
   ├─ map/             MapLibre 地圖引擎（WorldMap.tsx）：資料圖層、圖例、tooltip、框選、疊加圖層
   ├─ charts/          ECharts 包裝、折線／堆疊面積 option、長條清單
   ├─ panels/          國家側欄、排名表、框選結果
   ├─ controls/        時間軸
   ├─ theme/           顏色 token（唯一來源）、深淺色切換
   └─ lib/             資料讀取、國名、網址狀態、數字格式

pipeline/
   ├─ run.py           入口：npm run data -- <步驟>
   ├─ common.py        下載快取、輸出 JSON、指標檔格式
   ├─ build_geo.py     國界與 ISO 對照表
   ├─ geoindex.py      經緯度 → 國家（用上面的國界判斷）
   ├─ sources/         各資料來源的下載與解析（worldbank、imf、faostat、atlas、dgbas、ghsl、epoch、osm…）
   └─ topics/          每個主題一支組裝腳本
```

**所有資料一律用 ISO 3166-1 alpha-3 對應**（`TWN`、`JPN`…）。各來源的代碼在 `pipeline/sources/countries.py` 統一轉換。

畫面狀態都放在網址裡，例如 `?topic=agriculture&ind=self-sufficiency&item=wheat&year=2022&country=TWN`，任何畫面都能直接分享，框選範圍也會記在 `box=` 參數。

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
- `aggregates`（選填）：世界合計，用來算「占全球比例」和畫對照線。
- `notes`（選填）：個別國家的附註，例如改用其他來源補上，會顯示在側欄。

## 4. 新增一個主題

1. **資料**：在 `pipeline/topics/` 新增 `<主題>.py`，實作 `build()`，資料來源寫在 `pipeline/sources/`，用 `common.indicator_file()` 輸出；然後在 `pipeline/run.py` 的 `STEPS` 註冊。
2. **設定**：在 `src/topics/` 新增 `<主題>.ts`，匯出一個 `TopicDefinition`（指標、圖層類型、分級門檻、格式化函式、資料來源），然後在 `src/topics/index.ts` 的 `TOPICS` 註冊。
3. 執行 `npm run data -- <主題>` 產生資料，`npm run dev` 檢查。

世界銀行等來源的最新一年常常只有少數國家先公布，地圖會幾乎全灰。用 `common.year_span()` 截掉頭尾涵蓋國家太少的年份，每個指標的時間軸範圍可以不同。

`TopicDefinition` 的選填擴充點（`pure: true` 是純地圖頁：不載入統計資料，沒有指標、時間軸、資料側欄與排名表）：

| 欄位 | 用途 | 例子 |
|---|---|---|
| `dimension` | 子項目選擇器；指標的 `file` 含 `{item}` 時才會出現 | 農業的農產品、工業的出口產業 |
| `panelExtra` | 側欄額外區塊，用 `() => import(...)` 動態載入 | 發電結構、GDP 與就業結構、主要農產品 |
| `boxEstimate` | 地圖框選，加總框內的網格人口估算總量（要有網格檔，見第 6 節） | 人口 |
| `note` | 頁尾的資料說明 | |
| `overlays` | 疊加在地圖上的點、線圖層（目前支援鐵路線與機場點），左下角可以開關 | 交通 |

圖層的 `legendValues: 'auto'` 會依資料最大值自動挑圖例數值，適合量級差很多的子項目。

圖層的 `kind: 'none'` 表示國家不依數值上色，只畫疊加圖層（例如交通主題的「路網地圖」）；指標資料仍用在 tooltip 與排名表。

疊加圖層是 MapLibre 的 GeoJSON 圖層：
- 鐵路在資料管線先用 Douglas–Peucker 簡化到約 1 公里，再量化與差分編碼（約 12.5 萬個頂點、壓縮後約 300 KB）。
- 放大到 9 級以後，底圖本身有更精細的鐵路，簡化過的線會淡出。

## 5. 視覺化規則

| 資料性質 | 圖層 | 例子 |
|---|---|---|
| 總量（可加總） | **比例圓**，面積與數值成正比 | 人口數、發電量、GDP |
| 比率、密度、人均 | **面量圖**，單一色相分級（最多 7 級） | 人口密度、人均 GDP |
| 有正負的變化 | **面量圖**，橘↔青綠發散色，中間是中性灰 | 人口年增率、經濟成長率、自給率、農產品貿易收支 |

總量不畫成面量圖，否則俄羅斯、加拿大這類大國會因為面積大而顯得突出。

- **分級門檻固定**：寫在主題設定裡、所有年份共用，拖動時間軸時顏色才能前後比較。比例圓的大小也是用所有年份的最大值來定。
- **顏色只有一個來源**：`src/theme/tokens.ts`。
  - 介面與側欄圖表用藍色系。
  - **地圖上的資料色另外用 `MAP_TOKENS`**：底圖的海是藍色，資料也用藍色的話，淺色的國家會跟海混在一起。
    - 循序色用橘色。
    - 發散色用橘 ↔ 青綠（ColorBrewer BrBG 的配法）。
    - 比例圓用紫色。
    - 這些顏色都跟原本藍色色階同一階的 OKLCH 亮度，只換色相。
    - 地圖固定是明亮的彩色底圖，不跟著介面切深淺色。
  - 多系列圖表用 8 個類別色，排列順序用配色驗證工具檢查過色盲分辨度（發電結構的能源配色見 `ElectricityPanel.tsx`）。
- **地圖背景**：地球儀外面是黑色太空，邊緣有一圈淡藍色大氣層。
- **底圖切換**（`src/map/basemaps.ts`）：
  - 可選彩色地形、亮色街道、淺灰、深色、深藍五種，選擇記在瀏覽器的 localStorage。
  - 切換時用 `setStyle` 換樣式，再重新加上資料圖層。
  - `WorldMap` 的 `revision` 每次加一，資料相關的 effect 依它重跑，把顏色、比例圓等重新套上。
  - 深色底圖上，鐵路、選取外框改用淺色。
  - 資料圖層插在底圖「最後一個非文字圖層」之後：蓋在道路上面、文字下面。深色樣式的水域名稱排在很前面，不能用「第一個文字圖層」當插入點。
- **國界只留一條**：
  - 底圖的國界來自 OpenStreetMap，跟上色用的 Natural Earth 國界不完全重合，面量圖開著時會出現兩條錯開的線。
  - 所以面量圖開著時隱藏底圖的國界，改畫跟上色同一份幾何的國界（`data-border`）。
  - 比例圓、路網等不上色的指標則用底圖的國界。
- **放大後**：面量圖的不透明度隨縮放降低，讓底圖的道路、地形透出來。
- **「無資料」跟「0」要分開**：面量圖上無資料的國家畫成灰色，圖例也有標示。
- **小國**：面積小於 6,000 km² 的國家（新加坡、加勒比海島國）在低縮放時另外畫一個可點擊的圓點。
- **推估值**：時間軸、tooltip、側欄都會標示，折線圖用虛線。
- **表格版**：每張地圖都有「排名表」檢視；側欄的組成資料用長條清單直接寫出數值與占比，不必靠 hover。

## 6. 框選估算

人口主題可以在地圖上畫框，估算框內人口（`src/map/boxEstimate.ts`、`App.tsx` 的 `useBoxEstimate`）：

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
| 人口 | 總人口、密度、年增率、年齡中位數；可框選估算 | — | UN WPP 2024；框選用 JRC GHS-POP R2023A 網格 | 1950–2100（2024 起推估）；網格是 2020 年 |
| 人均收入 | 人均 GDP（名目、PPP）、GDP 總額、經濟成長率 | — | IMF WEO（含台灣），IMF 未涵蓋的 17 個地區用 World Bank 補 | 1980–2031（2026 起推估） |
| 發電量 | 總發電量、人均用電、再生/低碳/燃煤/核能占比、碳排強度 | 發電結構堆疊面積圖＋各能源長條 | Ember | 2000–2025 |
| 產業結構 | 農/工/製造/服務業占 GDP、三業就業占比 | GDP 結構與就業結構對照 | World Bank WDI；台灣用主計總處 | 1960–2025 |
| 工業 | 製造業附加價值、五大類占製造業比重、中高科技占比、各產業占出口比重 | 製造業組成、台灣 25 個製造業細項、商品出口結構 | World Bank WDI（UNIDO）、Harvard Atlas、主計總處 | 生產面 1963–2025（多數國家到 2022）、出口 1995–2024 |
| 農業 | 22 種農產品的產量、出口量、進口量、自給率；農業總產值、農產品貿易收支 | 主要農產品（產值）、主要進出口品項 | FAOSTAT（QCL、TCL、QV） | 1961–2024 |
| 交通 | 路網地圖（鐵路線＋機場點）、鐵路長度、鐵路密度、機場數、大型機場數 | 鐵路長度、機場清單（IATA 代碼） | Natural Earth 1:10m 鐵路、OurAirports | 目前的快照 |
| AI | 數據中心數、AI 算力（H100 等效）、重要 AI 模型數、token 用量（OpenRouter）、Claude 使用量占比與人均指數、生成式 AI 使用率 | 數據中心營運者、逐月 token 用量、已知 AI 叢集、近期重要模型、Claude 用途 | OpenStreetMap、Epoch AI、OECD.AI（OpenRouter）、Anthropic Economic Index、Microsoft AI Diffusion | 數據中心為 2026 年快照；算力 2015–2025；模型 2010–2025；token 2025–2026（每月平均）；使用量 2025–2026 |
| 氣候 | 人均 CO₂ 排放、年排放量、累積排放量（1750 年起）、人均消費端排放、每單位 GDP 排放 | 排放來源（燃煤、天然氣、石油、水泥…）堆疊面積圖＋長條 | Our World in Data（Global Carbon Project） | 1850–2024；消費端 1990–2023；每單位 GDP 到 2022 |

## 8. 資料陷阱（重要）

1. **World Bank WDI 沒有台灣**。各主題的補法：
   - 人口：改用 UN WPP。
   - 收入：改用 IMF WEO。
   - 產業結構、工業：改用主計總處總體統計資料庫（`pipeline/sources/dgbas.py`）。它的 API 參數是從網站本身的查詢頁面整理出來的。
   - Ember、FAOSTAT、Harvard Atlas 本身就有台灣。
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
   - 吐瓦魯、托克勞、直布羅陀在 1:50m 圖資裡沒有形狀。
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
    - 鐵路長度用地圖線段計算，每 20 個頂點判斷一次所在國家，跨國界的線會略有誤差。
    - 機場來自 OurAirports，只取大型機場與有定期航班的中型機場（不含 4 萬多座小型機場、直升機場與純軍用機場）。
    - 機場名稱是英文原名。
11. **國名**：繁中名稱用瀏覽器內建的 `Intl.DisplayNames`；英文名用 pycountry 的通用名稱（`Taiwan`，不是 `Taiwan, Province of China`）。FAOSTAT 的品項中文名在 `pipeline/topics/agriculture_names.py`。
12. **授權**：
    - WPP 是 CC BY 3.0 IGO。
    - World Bank、Ember、FAOSTAT、JRC GHS-POP 是 CC BY 4.0。
    - Harvard Atlas 是 CC0。
    - Epoch AI 是 CC BY。
    - Our World in Data 整理的資料（碳排來自 Global Carbon Project）是 CC BY 4.0。
    - Anthropic Economic Index 是 CC BY。
    - Microsoft AI Diffusion 是 MIT。
    - OpenStreetMap 是 ODbL，需標示「© OpenStreetMap contributors」。
    - OECD.AI 的 OpenRouter 資料未明示授權。
    - Natural Earth（國界、鐵路）與 OurAirports 是公有領域。
    - 底圖：OpenFreeMap（免費、不需金鑰）、© OpenMapTiles、資料 © OpenStreetMap contributors（ODbL）。地圖右下角會自動標示。
    - IMF 資料需註明來源。
    - 主計總處適用政府資料開放授權條款。
    - 頁尾已標示各主題的來源。
13. **網格人口歸國**（`pipeline/topics/population_grid.py`）：
    - world-atlas 的俄羅斯本土 ring 跨過換日線（楚科奇），平面上直接畫會在北緯 65°–69° 拉出一條橫跨全球的帶子，把俄羅斯北部挖空。畫之前要把經度展開成連續的，超出 ±180° 的部分再補一份平移 360° 的。
    - 地圖的法國形狀含海外省（留尼旺、馬約特、瓜地洛普、馬丁尼克、法屬圭亞那），荷蘭含波奈等三島，但 WPP 分開計算，要依多邊形拆出來。
    - 地圖把克里米亞畫在俄羅斯，WPP 算在烏克蘭；地圖的摩洛哥形狀含西撒哈拉（而且跟西撒哈拉的形狀重疊），WPP 分開算。網格一律照 WPP 歸屬，否則縮放比例會錯（例如西撒哈拉會放大 178 倍）。
    - 索馬利蘭、北賽普勒斯、聖誕島與科科斯群島、諾福克島、奧蘭群島在地圖上有形狀，但 WPP 把人口算在索馬利亞、賽普勒斯、澳洲、芬蘭。
    - 吐瓦魯、托克勞、直布羅陀在 1:50m 沒有形狀，用矩形範圍指定。
    - GHS-POP 的 30 角秒 GeoTIFF 範圍不是整齊的 ±180°（左右各多約 1 格），超出的像素要繞回另一側。

14. **碳排資料**（`pipeline/topics/climate.py`）：
    - OWID 的科索沃沒有 ISO 代碼，用國名對應成 XKX；洲、所得組、國際航空與航運另外列，不收。
    - 國際航空與航運的排放不屬於任何國家，所以各國加總小於世界合計。
    - 每單位 GDP 的排放用 Maddison Project 的 GDP（2011 年國際元），只到 2022 年。

## 9. 之後可以做的

- **框選的國內分布跟著年份變**：GHS-POP 有 1975–2030 每 5 年一期，可以依時間軸挑最近的一期（每期 gzip 後約 1.6 MB），1950 年代與 2100 年仍只能用最接近的一期。
- **地圖上的圓餅圖層**：在國家位置畫發電結構圓餅，在 `LayerSpec` 加 `kind: 'pie'`。
- **農產品貿易流向**：用 FAOSTAT 雙邊貿易矩陣（TM）畫流向弧線。
- **縮減資料量**：農業與工業的國家明細檔可以只保留近 30 年，目前 `public/data` 約 26 MB（其中框選網格 7.5 MB）。

## 10. 開發注意事項

- **world-atlas 的國界是給 D3 球面幾何用的**：
  - 跨 180° 經線的國家（斐濟、俄羅斯遠東）座標會從 179.9 跳到 −179.9。
  - MapLibre 把座標當平面處理，會畫出橫越整個地圖的邊。
  - `WorldMap.tsx` 的 `unwrapAntimeridian()` 把經度展開成連續的。
- **WebGL 地圖在隱藏的瀏覽器分頁不會繪製**：
  - MapLibre 會等畫面更新（requestAnimationFrame）才處理樣式與繪製，分頁隱藏時會停住。
  - 自動化測試要用可見視窗，或用無頭 Chrome（puppeteer-core 搭配系統的 Chrome，加上 `--use-angle=swiftshader`）。
  - 開發模式下 `window.__map` 是地圖物件，方便在主控台檢查。
- **Vite 讀到寫到一半的檔案**：
  - 用腳本連續改同一個檔案時，Vite 偶爾會在檔案寫到一半時讀進來並快取住，瀏覽器出現「does not provide an export named …」。
  - 用 `touch` 該檔案重新觸發轉換即可。
- **換 MapLibre 版本後**：要刪掉 `node_modules/.vite` 再重啟開發伺服器，否則 Vite 會沿用舊版的預先打包檔。
