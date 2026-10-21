# 世界資料地圖：設計文件

用世界地圖呈現「跟國家有關的資料」，主題會陸續加入。這份文件記錄技術選型、架構，以及新增主題的方法。

## 1. 技術選型

| 層面 | 工具 | 為什麼 |
|---|---|---|
| 地圖繪製 | **D3**（d3-geo、d3-zoom）畫 SVG | 可以用等面積投影；面量圖、比例圓、框選都能自己控制 |
| 投影 | **Equal Earth**（等面積） | Web Mercator 會把高緯度國家放大好幾倍，面量圖會誤導；等面積也讓框選估算能直接用平面面積 |
| 國界 | **Natural Earth 1:50m**（world-atlas 套件） | 1:110m 沒有新加坡、巴林等小國 |
| 側欄圖表 | **ECharts 6**，按需引入 | 點國家時才載入（約 180 KB gzip），不拖慢首頁 |
| 色彩與比例尺 | d3-scale | 分級門檻固定寫在主題設定裡 |
| 前端 | Vite + React + TypeScript | |
| 資料處理 | Python（`pipeline/`），離線執行 | 前端只讀靜態 JSON，不需要後端 |
| 部署 | GitHub Pages（GitHub Actions 自動建置） | `vite.config.ts` 已設 `base: './'` |

**之後可以升級**：如果要做省/州/城市層級或大量點資料，再加 MapLibre + deck.gl。

## 2. 架構

```
原始資料（UN、IMF、World Bank、Ember、FAOSTAT、Harvard Atlas、主計總處）
   │  pipeline/run.py  下載到 pipeline/.cache/，清理、對齊 ISO 代碼
   ▼
public/data/                              ← 靜態 JSON，會進版本控制
   ├─ geo/countries-50m.json              國界（TopoJSON，id 已換成 ISO alpha-3）
   ├─ countries.json                      ISO 對照表（alpha-3 → alpha-2、英文名）
   └─ topics/<主題>/
        ├─ <指標>.json                    每個指標一個檔，含所有年份
        ├─ <指標>/<子項目>.json           有子項目的指標（例如 production/rice.json）
        ├─ countries/<ISO3>.json          側欄額外區塊用的單一國家明細
        └─ manifest.json
   │
   ▼  fetch
src/
   ├─ topics/          每個主題一個設定檔（TopicDefinition）  ← 新增主題主要改這裡
   │   └─ panels/      主題自訂的側欄區塊（動態載入）
   ├─ map/             D3 地圖引擎：投影、縮放、圖層、圖例、tooltip、框選
   ├─ charts/          ECharts 包裝、折線／堆疊面積 option、長條清單
   ├─ panels/          國家側欄、排名表、框選結果
   ├─ controls/        時間軸
   ├─ theme/           顏色 token（唯一來源）、深淺色切換
   └─ lib/             資料讀取、國名、網址狀態、數字格式

pipeline/
   ├─ run.py           入口：npm run data -- <步驟>
   ├─ common.py        下載快取、輸出 JSON、指標檔格式
   ├─ build_geo.py     國界與 ISO 對照表
   ├─ sources/         各資料來源的下載與解析（worldbank、imf、faostat、atlas、dgbas…）
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

`TopicDefinition` 的選填擴充點：

| 欄位 | 用途 | 例子 |
|---|---|---|
| `dimension` | 子項目選擇器；指標的 `file` 含 `{item}` 時才會出現 | 農業的農產品、工業的出口產業 |
| `panelExtra` | 側欄額外區塊，用 `() => import(...)` 動態載入 | 發電結構、GDP 與就業結構、主要農產品 |
| `boxEstimate` | 地圖框選，用面積比例估算框內的總量 | 人口 |
| `note` | 頁尾的資料說明 | |

圖層的 `legendValues: 'auto'` 會依資料最大值自動挑圖例數值，適合量級差很多的子項目。

## 5. 視覺化規則

| 資料性質 | 圖層 | 例子 |
|---|---|---|
| 總量（可加總） | **比例圓**，面積與數值成正比 | 人口數、發電量、GDP |
| 比率、密度、人均 | **面量圖**，單一色相分級（最多 7 級） | 人口密度、人均 GDP |
| 有正負的變化 | **面量圖**，藍↔紅發散色，中間是中性灰 | 人口年增率、經濟成長率、自給率、農產品貿易收支 |

總量不畫成面量圖，否則俄羅斯、加拿大這類大國會因為面積大而顯得突出。

- **分級門檻固定**：寫在主題設定裡、所有年份共用，拖動時間軸時顏色才能前後比較。比例圓的大小也是用所有年份的最大值來定。
- **顏色只有一個來源**：`src/theme/tokens.ts`。深色模式的循序色會翻轉，數值低的顏色接近背景。發散色的紅色臂是依藍色同一階的 OKLCH 亮度推導出來的。多系列圖表用 8 個類別色，排列順序用配色驗證工具檢查過色盲分辨度（發電結構的能源配色見 `ElectricityPanel.tsx`）。
- **「無資料」跟「0」要分開**：無資料一律畫成斜線紋理，圖例也有標示。
- **小國**：投影後面積太小的國家（新加坡、加勒比海島國）另外畫一個可點擊的圓點。
- **推估值**：時間軸、tooltip、側欄都會標示，折線圖用虛線。
- **表格版**：每張地圖都有「排名表」檢視；側欄的組成資料用長條清單直接寫出數值與占比，不必靠 hover。

## 6. 框選估算

人口主題可以在地圖上畫框，估算框內人口（`src/map/boxEstimate.ts`）：

1. 框存成「原始投影座標」（Equal Earth、scale = 1），跟版面大小和縮放無關。
2. 每個國家的形狀投影後，用 Sutherland–Hodgman 演算法裁切到框內，算出「框內面積 ÷ 全國面積」。Equal Earth 是等面積投影，平面面積比例就是實際面積比例。
3. 框內人口 = Σ（面積比例 × 該國人口）。

這等於假設每個國家內部人口平均分布，框越小、國土越大越不準（例如框住加拿大北部會高估）。要更準就要改用網格人口資料（例如 GHSL 或 WorldPop 1 km 網格），見第 9 節。

## 7. 主題現況

| 主題 | 地圖指標 | 側欄額外區塊 | 資料來源 | 年份 |
|---|---|---|---|---|
| 人口 | 總人口、密度、年增率、年齡中位數；可框選估算 | — | UN WPP 2024 | 1950–2100（2024 起推估） |
| 人均收入 | 人均 GDP（名目、PPP）、GDP 總額、經濟成長率 | — | IMF WEO（含台灣），IMF 未涵蓋的 17 個地區用 World Bank 補 | 1980–2031（2026 起推估） |
| 發電量 | 總發電量、人均用電、再生/低碳/燃煤/核能占比、碳排強度 | 發電結構堆疊面積圖＋各能源長條 | Ember | 2000–2025 |
| 產業結構 | 農/工/製造/服務業占 GDP、三業就業占比 | GDP 結構與就業結構對照 | World Bank WDI；台灣用主計總處 | 1960–2025 |
| 工業 | 製造業附加價值、五大類占製造業比重、中高科技占比、各產業占出口比重 | 製造業組成、台灣 25 個製造業細項、商品出口結構 | World Bank WDI（UNIDO）、Harvard Atlas、主計總處 | 生產面 1963–2025（多數國家到 2022）、出口 1995–2024 |
| 農業 | 22 種農產品的產量、出口量、進口量、自給率；農業總產值、農產品貿易收支 | 主要農產品（產值）、主要進出口品項 | FAOSTAT（QCL、TCL、QV） | 1961–2024 |

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
9. **國名**：繁中名稱用瀏覽器內建的 `Intl.DisplayNames`；英文名用 pycountry 的通用名稱（`Taiwan`，不是 `Taiwan, Province of China`）。FAOSTAT 的品項中文名在 `pipeline/topics/agriculture_names.py`。
10. **授權**：
    - WPP 是 CC BY 3.0 IGO。
    - World Bank、Ember、FAOSTAT 是 CC BY 4.0。
    - Harvard Atlas 是 CC0。
    - IMF 資料需註明來源。
    - 主計總處適用政府資料開放授權條款。
    - 頁尾已標示各主題的來源。

## 9. 之後可以做的

- **框選改用網格人口**：GHSL 或 WorldPop 的網格人口資料，預先彙整成 0.25° 網格，框選就不必假設國內人口平均分布。
- **地圖上的圓餅圖層**：在國家位置畫發電結構圓餅，在 `LayerSpec` 加 `kind: 'pie'`。
- **農產品貿易流向**：用 FAOSTAT 雙邊貿易矩陣（TM）畫流向弧線。
- **縮減資料量**：農業與工業的國家明細檔可以只保留近 30 年，目前 `public/data` 約 18 MB。
