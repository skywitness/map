# 世界資料地圖：設計文件

用世界地圖呈現「跟國家有關的資料」，主題會陸續加入。這份文件記錄技術選型、架構，以及新增主題的方法。

## 1. 技術選型

| 層面 | 工具 | 為什麼 |
|---|---|---|
| 地圖繪製 | **MapLibre GL JS 5**（WebGL 向量地圖） | 可以一路放大到街道（zoom 18）；地球儀與平面可切換；資料圖層插在底圖文字下面，地名永遠看得到 |
| 底圖 | **OpenFreeMap** 的 5 種樣式（免費、不需金鑰），使用者可切換 | 預設 Liberty：低縮放是 Natural Earth II 彩色地形，放大後是 OpenStreetMap 細節；地名改用 `name:zh-Hant` |
| 投影 | **地球儀**（預設），可切換成平面（Web Mercator）；3D 模式固定用平面 | 地球儀沒有高緯度放大的問題；平面方便一次看全世界；3D 的原因見第 5 節 |
| 國界 | **Natural Earth 1:50m**（world-atlas 套件） | 給資料上色、點選、框選用；1:110m 沒有新加坡、巴林等小國 |
| 側欄圖表 | **ECharts 6**，按需引入 | 點國家時才載入（約 180 KB gzip），不拖慢首頁 |
| 色彩與比例尺 | d3-scale | 分級門檻固定寫在主題設定裡 |
| 前端 | Vite + React + TypeScript | |
| 離線與快取 | **Service worker**（vite-plugin-pwa 的 injectManifest + Workbox 模組，`src/sw.ts`） | 第二次開啟直接從快取載入；看過一次就能離線開啟；可以安裝成 App（見第 12 節） |
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
   ├─ geo/countries-110m.json             粗略國界，只用來畫第一個畫面（見第 12 節）
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
   ├─ map/             MapLibre 地圖引擎（WorldMap.tsx，自己一個 chunk）：資料圖層、圖例、tooltip、框選、疊加圖層、匯出圖片；
   │                   底圖樣式的下載與改寫在 style.ts（不含 MapLibre，首頁一啟動就先抓）
   ├─ charts/          ECharts 包裝、折線／堆疊面積 option、長條清單
   ├─ panels/          國家側欄、排名表、框選結果
   ├─ controls/        時間軸、分享選單、國家搜尋、快捷鍵與說明（見第 11 節）
   ├─ theme/           顏色 token（唯一來源）、深淺色切換
   ├─ lib/             資料讀取（含指標檔還原）、國名、國家搜尋比對、網址狀態、數字格式、CSV 與下載、
   │                   介面文字（strings.ts）、連線狀態
   └─ sw.ts            service worker（快取策略見第 12 節）

pipeline/
   ├─ run.py           入口：npm run data -- <步驟>
   ├─ common.py        下載快取、輸出 JSON、指標檔格式（含數值壓縮）
   ├─ compact.py       把還沒壓縮的舊指標檔改成差分編碼（npm run data -- compact）
   ├─ build_geo.py     國界與 ISO 對照表
   ├─ geoindex.py      經緯度 → 國家（用上面的國界判斷）
   ├─ sources/         各資料來源的下載與解析（worldbank、imf、faostat、atlas、dgbas、ghsl、epoch、osm…）
   └─ topics/          每個主題一支組裝腳本
```

**所有資料一律用 ISO 3166-1 alpha-3 對應**（`TWN`、`JPN`…）。各來源的代碼在 `pipeline/sources/countries.py` 統一轉換。

畫面狀態都放在網址裡，例如 `?topic=agriculture&ind=self-sufficiency&item=wheat&year=2022&country=TWN`，任何畫面都能直接分享，框選範圍也會記在 `bbox=` 參數，3D 模式是 `3d=1`。

**分享選單**（控制列右邊的「分享」，`src/controls/ShareMenu.tsx`）：
- **下載地圖圖片（PNG）**：只有地圖檢視有。內容是目前的地圖畫面，上面加標題（主題 · 指標 · 年份）與指標說明，左下角是圖例（跟畫面上一樣，含開著的疊加圖層），下面是資料來源、底圖版權（OpenFreeMap © OpenMapTiles © OpenStreetMap contributors）、國界來源與這個畫面的網址。做法見第 10 節。
- **下載 CSV**：目前的指標，可選「選定的年份」或「所有年份」，排名表檢視也有（`src/lib/csv.ts`）。
  - 欄位：ISO3、國名、英文名、單位，接著每年一欄；推估年份的欄名加「（推估）」，有附註的指標最後多一欄「附註」，世界合計放在最後一列。
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
- `aggregates`（選填）：世界合計，用來算「占全球比例」和畫對照線。
- `notes`（選填）：個別國家的附註，例如改用其他來源補上，會顯示在側欄。

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
- **地圖背景**：地球儀外面是黑色太空（`tokens.ts` 的 `SPACE_GRADIENT`，畫面與匯出圖片共用），邊緣有一圈淡藍色大氣層。
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
| 軍事 | 軍費（美元，比例圓）、軍費占 GDP、兵力（比例圓）、兵力占勞動力 | — | SIPRI（2011–2025 年子集，非商業使用）、World Bank WDI（IISS） | 軍費 2011–2025；兵力 1985–2020 |
| 氣候 | 人均 CO₂ 排放、年排放量、累積排放量（1750 年起）、人均消費端排放、每單位 GDP 排放 | 排放來源（燃煤、天然氣、石油、水泥…）堆疊面積圖＋長條 | Our World in Data（Global Carbon Project） | 1850–2024；消費端 1990–2023；每單位 GDP 到 2022 |
| 數位 | 網路使用率、行動電話用戶（每百人）、固網寬頻用戶（每百人） | — | World Bank WDI（ITU）；台灣用數位發展部數位近用調查、NCC 電信統計 | 1990–2024 |

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
    - **SIPRI 軍費資料不是開放授權**：只能非商業使用、註明出處，轉載少於整個資料集 10% 才算合理使用（見第 16 點）。
    - Anthropic Economic Index 是 CC BY。
    - Microsoft AI Diffusion 是 MIT。
    - OpenStreetMap 是 ODbL，需標示「© OpenStreetMap contributors」。
    - OECD.AI 的 OpenRouter 資料未明示授權。
    - Natural Earth（國界、鐵路）與 OurAirports 是公有領域。
    - 底圖：OpenFreeMap（免費、不需金鑰）、© OpenMapTiles、資料 © OpenStreetMap contributors（ODbL）。地圖右下角會自動標示。
    - IMF 資料需註明來源。
    - 主計總處適用政府資料開放授權條款。
    - 數位發展部、NCC 等部會的開放資料也適用政府資料開放授權條款。
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

## 9. 之後可以做的

- **地球儀上的 3D**：等 MapLibre 的 `queryRenderedFeatures` 支援地球儀上的立體圖形，就可以拿掉「3D 時改用平面」的限制（`WorldMap.tsx` 的 `projection`）。

- **框選的國內分布跟著年份變**：GHS-POP 有 1975–2030 每 5 年一期，可以依時間軸挑最近的一期（每期 gzip 後約 1.6 MB），1950 年代與 2100 年仍只能用最接近的一期。
- **地圖上的圓餅圖層**：在國家位置畫發電結構圓餅，在 `LayerSpec` 加 `kind: 'pie'`。
- **農產品貿易流向**：用 FAOSTAT 雙邊貿易矩陣（TM）畫流向弧線。
- **縮減資料量**：指標檔已經壓縮（第 3 節）。還可以做的：
  - 農業與工業的國家明細檔（`countries/<ISO3>.json`，共約 12 MB，點國家才載入）可以只保留近 30 年，或也改成差分編碼。
  - 框選網格（7.5 MB，gzip 後 1.6 MB）可以改成整數、差分編碼。
  - 鐵路（gzip 後約 300 KB）可以依縮放分成兩層，全球視角只載入主要幹線。

## 10. 開發注意事項

- **world-atlas 的國界是給 D3 球面幾何用的**：
  - 跨 180° 經線的國家（斐濟、俄羅斯遠東）座標會從 179.9 跳到 −179.9。
  - MapLibre 把座標當平面處理，會畫出橫越整個地圖的邊。
  - `WorldMap.tsx` 的 `unwrapAntimeridian()` 把經度展開成連續的。
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
- **換 MapLibre 版本後**：要刪掉 `node_modules/.vite` 再重啟開發伺服器，否則 Vite 會沿用舊版的預先打包檔。
- **Service worker 只在正式版註冊**：
  - `npm run dev` 不會有快取問題。
  - 要測離線、快取，用 `npm run build` 再 `npm run preview`。
  - 瀏覽器開發者工具的 Application → Service workers 可以勾「Update on reload」或「Offline」。
  - 改了 `src/sw.ts` 或快取策略之後，要實際跑一次「部署更新」流程（第 12 節）。
- **不要在首頁的 bundle 引入 MapLibre**：`maplibre-gl` 只能從 `src/map/WorldMap.tsx`（或它引入的模組）import，其他地方需要型別就用 `import type`。否則地圖程式會跑回首頁 chunk，第一個畫面在手機上會慢好幾秒。
- **檢查 3D 時**：開發模式下用 `__map.queryRenderedFeatures(point, { layers: ['extrude-countries'] })` 確認點得到。地球儀上它會回傳空陣列（見第 5 節「3D 立體地圖」），換 MapLibre 版本時可以用這個方法確認限制是否還在。

## 11. 搜尋、快捷鍵與手機操作

介面文字（搜尋、快捷鍵說明、抽屜）集中在 `src/lib/strings.ts`，之後翻譯成其他語言時只改那個檔。

**國家搜尋**（`src/lib/countrySearch.ts`、`src/controls/CountrySearch.tsx`）：
- 比對繁中名稱、英文名稱（`Intl.DisplayNames(['en'])` 與 `countries.json` 的名稱）、常用別名、ISO 代碼。
  - 別名寫在 `ALIASES`：南韓/韓國/Korea、美國/USA/America、英國/UK/England、中國/大陸/PRC、對岸譯名（意大利、新西蘭、沙特）、舊名（Swaziland、Burma）等。
  - 輸入先正規化：小寫、去重音符號（Côte → cote）、全形轉半形、常見簡體字轉繁體（韩国 → 韓國）、「臺」統一成「台」。
- 計分由高到低：ISO 代碼完全相符（只接受完全相符，「TW」不會比對到一堆國家）→ 名稱完全相符 → 開頭相符 → 英文單字開頭相符（「korea」→ South Korea）→ 中間片段 → 跳字（「沙阿」→ 沙烏地阿拉伯）→ 英文拼錯一兩個字母（「germny」→ Germany）。同一級裡名稱越短越前面，所以「美」的第一個是美國。
- 已經有名稱相符的結果時，拼錯容忍找到的結果不列出，避免雜訊。
- 結果列出目前指標的數值；純地圖頁沒有數值，只列名稱。
- 選到國家後地圖一定飛過去框住整個國家（`WorldMap` 的 `focus`）；點地圖、點排名表則只在國家不在畫面上時才移動。
  - 框住的範圍（`src/map/focus.ts`）是最大那塊陸地加上附近夠大的島，不含遠方屬地：法國不含法屬圭亞那，美國含阿拉斯加但不含阿留申群島西段與夏威夷。
  - 手機上會扣掉底部抽屜蓋住的高度。
- 是 WAI-ARIA combobox：↑↓ 選、Enter 確定、Esc 依序關清單／清空／離開；選字中（注音、拼音）的 Enter 不會被搶走。

**鍵盤快捷鍵**（`src/controls/hotkeys.ts` 的 `useHotkeys`，各元件自己註冊）：

| 鍵 | 動作 | 註冊在 |
|---|---|---|
| `/` | 跳到搜尋框 | `CountrySearch` |
| `←` `→` | 上一年／下一年（照資料實際有的年份跳） | `TimeSlider` |
| 空白鍵 | 播放／暫停歷年變化 | `TimeSlider` |
| `+` `−` | 放大／縮小地圖 | `WorldMap` |
| `Esc` | 取消選取國家（關閉側欄），沒有選取時清掉框選 | `App` |
| `?` | 開關快捷鍵說明（頂列的「?」按鈕，觸控裝置不顯示） | `ShortcutHelp` |

- 在文字框、下拉選單、拉桿裡不觸發；按鈕上的空白鍵照常是「按下按鈕」。
- 搜尋框、說明視窗、框選模式自己處理 Esc 並 `preventDefault`，全域的 Esc 就不會順便取消選取。框選模式與說明視窗用 capture 階段監聽，才能比全域的先處理。
- 用滑鼠點地圖時，地圖畫布會立刻放掉焦點，←/→ 才會繼續換年份；用 Tab 移進地圖時（`:focus-visible`），方向鍵與 +/− 交給 MapLibre 平移縮放。

**手機的底部抽屜**（`src/panels/PanelSheet.tsx`，寬度 ≤ 768px）：
- 國家側欄改成從底部拉起的抽屜，有三段高度：
  - 收合：露出國名與第一排數值，高度是 `--sheet-peek`。
  - 半開：畫面高度的一半。
  - 全開：留出頂列。
- 拖把手或國名列切換高度，放開時吸附到最近的一段；快速滑動會直接切到下一段。從收合再往下拖就關閉。點把手依序切換；把手聚焦時 ↑↓ 也能切換。
- 抽屜以外的地方不擋，地圖照常能拖、能點；頁面底部留出收合高度的空白，頁尾和時間軸才捲得出來。
- `prefers-reduced-motion` 時不播放高度動畫。
- `index.html` 設了 `viewport-fit=cover`，所以頁面與抽屜都用 `env(safe-area-inset-*)` 讓開瀏海與底部的橫條。
- 收合與全開的高度寫在 CSS（含安全區域），JS 讀抽屜算好的 `min-height`、`max-height` 來決定吸附位置，兩邊不必各寫一份數字。

## 12. 載入速度與離線

### 量測方法

- 無頭 Chrome（puppeteer-core 搭配系統的 Chrome，`--use-angle=swiftshader`，見第 10 節）。
- 兩種環境：
  - 桌機：1366×900，不節流。
  - 手機：412×915、裝置像素比 2，網路 Fast 3G（延遲 562 ms、下載約 1.4 Mbps），CPU 降速 4 倍。
- 兩種情況：
  - 首次載入：全新的瀏覽器設定檔，沒有任何快取。
  - 再次載入：同一個設定檔再開一次（改善後的版本這時已經由 service worker 接手）。
- 量的東西：
  - **地圖出現資料**：`WorldMap` 第一次把資料畫上地圖時留下的 `performance.mark('map-data')`。改善前的版本也加上同一個 mark 再量。
  - **LCP**：Largest Contentful Paint。地圖畫布不算 LCP 候選，所以 LCP 量到的是頁面上的文字。
  - **傳輸量**：CDP 的 `Network.loadingFinished` 加總（含底圖圖磚），也追蹤 service worker 自己發出的請求。
- 本機用一個模擬 GitHub Pages 的靜態伺服器：`/map/` 子路徑、gzip、`Cache-Control: max-age=600`、ETag。每輪交錯量改善前與改善後，取中位數。
- 這台機器同時跑著其他工作，swiftshader 又是用 CPU 算圖，同一組設定前後兩次可以差到兩倍，所以每格都是多輪的中位數。

### 結果

（量測中）

### 做了什麼

**第一個畫面的關鍵路徑**（原本是一條很長的瀑布流：首頁程式 1.35 MB → 國界與資料 → 底圖樣式 → 所有底圖圖磚 → 才畫資料）：

1. **MapLibre 移到自己的 chunk**（`App.tsx` 的 `lazy(() => import('./map/WorldMap'))`）。首頁 chunk 從 381 KB 降到 96 KB（gzip）。
2. **第一個畫面要用的檔案提早發出請求**：
   - `index.html` 直接預載：地圖程式 chunk 與它的 CSS（`vite.config.ts` 的 `preloadMapChunk` 外掛插入 `modulepreload`）、1:110m 國界、國名表、預設主題的資料、預設底圖的樣式、圖磚索引 `/planet`，並先跟 `tiles.openfreemap.org` 建立連線。
   - `App.tsx` 在模組載入時就用 `fetchJson` 發出同樣的請求（網址指定別的主題時也適用），之後 `useJson` 拿到的是同一個 Promise。
   - 底圖樣式由 `src/map/style.ts` 下載與改寫，這個檔案不含 MapLibre，首頁一啟動就能先抓。
3. **不等底圖圖磚**：資料圖層改在 `style.load`（樣式解析完）加上，不等 `load`（第一個畫面的圖磚全部下載完）。彩色地形的 Natural Earth 圖磚一張 200–300 KB，手機 3G 上光是圖磚就要幾十秒。
4. **地圖不等資料**：`WorldMap` 一開始就掛上去（底圖先出來），國界與資料到了再畫；首次載入時地圖上方顯示「資料載入中…」。
5. **先粗後細的國界**：先畫 1:110m（gzip 後 35 KB），地圖畫出資料後（`onFirstData`）才載入 1:50m（230 KB）。再次造訪時也一樣先畫粗的，因為手機上解析 1:50m 要好幾百毫秒。
6. **指標檔差分編碼**（第 3 節）：首頁的總人口從 137 KB 變 55 KB。
7. **之後才做的事**：地圖畫出資料之後，閒置時（`requestIdleCallback`）一個一個預先下載同主題的其他指標（`prefetchJson`，省流量模式與 2G 不做），換指標、開側欄就不用等。Service worker 也等這時才註冊，預先快取的下載不跟第一個畫面搶頻寬。

**GitHub Pages 的壓縮**：JSON、JS、CSS 都有 gzip（`Content-Encoding: gzip`，例如 1:50m 國界 746 KB → 247 KB），沒有 Brotli；`Cache-Control: max-age=600`，所以沒有 service worker 時，10 分鐘後再開每個檔案都要重新向伺服器確認。

### Service worker（`src/sw.ts`）

| 內容 | 策略 | 快取名稱 | 上限 |
|---|---|---|---|
| App shell：`index.html`、所有 JS/CSS（含 ECharts）、圖示、manifest、國名表 | 預先快取（安裝時下載，約 2 MB、gzip 後約 600 KB） | `workbox-precache-v2-…` | 每次建置的清單 |
| 資料 JSON（`/data/**`） | stale-while-revalidate：先給快取、背景向伺服器確認 | `data-<資料版本>` | 400 個檔 |
| 底圖樣式、`/planet`、圖示集 | stale-while-revalidate | `basemap-style` | 40 |
| 底圖字型 | cache first | `basemap-fonts` | 60 個、60 天 |
| 底圖圖磚（向量 `.pbf`、Natural Earth `.png`） | cache first（網址含版本，內容不變） | `basemap-tiles` | 300 張、30 天 |

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

### 部署更新測試

（測試中）
