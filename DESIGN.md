# 世界資料地圖：設計文件

用世界地圖呈現「跟國家有關的資料」，主題會陸續加入。這份文件記錄技術選型、架構，以及新增主題的方法。

## 1. 技術選型

| 層面 | 工具 | 為什麼 |
|---|---|---|
| 地圖繪製 | **D3**（d3-geo、d3-zoom）畫 SVG | 可以用等面積投影；面量圖、比例圓、圓餅、流向線都能自己控制 |
| 投影 | **Equal Earth**（等面積） | Web Mercator 會把高緯度國家放大好幾倍，面量圖會誤導 |
| 國界 | **Natural Earth 1:50m**（world-atlas 套件） | 1:110m 沒有新加坡、巴林等小國 |
| 側欄圖表 | **ECharts 6**，按需引入 | treemap、sankey、堆疊圖都有；點國家時才載入，不拖慢首頁 |
| 色彩與比例尺 | d3-scale | 分級門檻固定寫在主題設定裡 |
| 前端 | Vite + React + TypeScript | |
| 資料處理 | Python（`pipeline/`），離線執行 | 前端只讀靜態 JSON，不需要後端 |
| 部署 | 任何靜態主機（GitHub Pages、Cloudflare Pages） | `vite.config.ts` 已設 `base: './'` |

**之後可以升級**：如果要做省/州/城市層級或大量點資料，再加 MapLibre + deck.gl。

## 2. 架構

```
原始資料（UN、World Bank、FAOSTAT…）
   │  pipeline/run.py  下載到 pipeline/.cache/，清理、對齊 ISO 代碼
   ▼
public/data/                     ← 靜態 JSON，會進版本控制
   ├─ geo/countries-50m.json     國界（TopoJSON，id 已換成 ISO alpha-3）
   ├─ countries.json             ISO 對照表（alpha-3 → alpha-2、英文名）
   └─ topics/<主題>/<指標>.json   每個指標一個檔，含所有年份
   │
   ▼  fetch
src/
   ├─ topics/      每個主題一個設定檔（TopicDefinition）  ← 新增主題主要改這裡
   ├─ map/         D3 地圖引擎：投影、縮放、圖層、圖例、tooltip
   ├─ charts/      ECharts 包裝與圖表 option 產生器
   ├─ panels/      國家側欄、排名表
   ├─ controls/    時間軸
   ├─ theme/       顏色 token（唯一來源）、深淺色切換
   └─ lib/         資料讀取、國名、網址狀態、數字格式
```

**所有資料一律用 ISO 3166-1 alpha-3 對應**（`TWN`、`JPN`…）。地圖與資料只在 `pipeline/build_geo.py` 對一次。

畫面狀態都放在網址裡，例如 `?topic=population&ind=growth&year=2050&country=TWN&view=table`，任何畫面都能直接分享。

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
  }
}
```

- `values` 的陣列與 `years` 一一對應，缺值為 `null`。
- `projectionFrom`（選填）：從這一年開始是推估值，時間軸與折線圖會標示成虛線。
- `aggregates`（選填）：世界或區域的合計，用來算「占全球比例」和畫對照線。
- 每個主題另有 `manifest.json`，記錄資料來源與產生時間。

大型主題（例如農業有上百種產品）用同一個格式，依子項目切檔：`topics/agriculture/production/<產品代碼>.json`。

## 4. 新增一個主題

1. **資料**：在 `pipeline/topics/` 新增 `<主題>.py`，實作 `build()`，用 `common.download()` 下載、`common.indicator_file()` 輸出；然後在 `pipeline/run.py` 的 `STEPS` 註冊。
2. **設定**：在 `src/topics/` 新增 `<主題>.ts`，匯出一個 `TopicDefinition`（指標、圖層類型、分級門檻、格式化函式、資料來源）；然後在 `src/topics/index.ts` 的 `TOPICS` 註冊，並從 `PLANNED_TOPICS` 移除。
3. 執行 `npm run data -- <主題>` 產生資料，`npm run dev` 檢查。

只用面量圖、比例圓、折線圖的主題，做完這三步就好。需要新圖表類型時，見第 7 節。

## 5. 視覺化規則

| 資料性質 | 圖層 | 例子 |
|---|---|---|
| 總量（可加總） | **比例圓**，面積與數值成正比 | 人口數、發電量 |
| 比率、密度、人均 | **面量圖**，單一色相分級（最多 7 級） | 人口密度、人均收入 |
| 有正負的變化 | **面量圖**，藍↔紅發散色，中間是中性灰 | 人口年增率、淨出口 |

總量不畫成面量圖，否則俄羅斯、加拿大這類大國會因為面積大而顯得突出。

- **分級門檻固定**：寫在主題設定裡、所有年份共用，拖動時間軸時顏色才能前後比較。比例圓的大小也是用所有年份的最大值來定。
- **顏色只有一個來源**：`src/theme/tokens.ts`。深色模式的循序色會翻轉，數值低的顏色接近背景。發散色的紅色臂是依藍色同一階的 OKLCH 亮度推導出來的。
- **「無資料」跟「0」要分開**：無資料一律畫成斜線紋理，圖例也有標示。
- **小國**：投影後面積太小的國家（新加坡、加勒比海島國）另外畫一個可點擊的圓點。
- **推估值**：時間軸、tooltip、側欄都會標示，折線圖用虛線。
- **表格版**：每張地圖都有「排名表」檢視，數值不必靠 hover 才讀得到，也能用鍵盤操作。

## 6. 主題規劃

| 主題 | 狀態 | 地圖 | 側欄 | 資料來源 |
|---|---|---|---|---|
| 人口 | ✅ 已上線 | 總人口畫比例圓；密度、年齡中位數畫面量圖；年增率用發散色 | 4 項指標＋排名、歷年折線（含世界對照） | UN WPP 2024 |
| 人均收入 | 規劃中 | 面量圖（對數分級），可切換名目 / PPP | 歷年折線 | World Bank WDI `NY.GDP.PCAP.CD`、IMF WEO（含台灣） |
| 發電量 | 規劃中 | 總量畫比例圓；人均、再生能源占比畫面量圖 | 各能源別堆疊面積圖 | Ember Yearly Electricity Data（CC BY 4.0） |
| 產業結構 | 規劃中 | 選一個產業看占比，或用分類色標主導產業 | 農工服 100% 堆疊，GDP 占比 vs 就業占比 | WDI `NV.AGR/IND/SRV.TOTL.ZS`、ILO、UN AMA |
| 工業 | 規劃中 | 選一個工業類別看面量圖 | treemap 顯示工業組成 | UNIDO INDSTAT、Atlas of Economic Complexity |
| 農業 | 規劃中 | 選一個產品看產量面量圖；切換到淨出口時用發散色 | 產品 treemap、進出口、貿易夥伴流向 | FAOSTAT QCL / TCL / TM |

工業和農業的「占比」有兩種意思，介面要能切換：**占該國的比重**（半導體占台灣製造業多少），以及**占全球的比重**（台灣占全球半導體多少）。

## 7. 擴充時要動的地方

- **子項目選擇器**（農產品、工業類別、能源別）：`TopicDefinition` 要加 `dimensions`，資料檔路徑加一層子項目代碼。
- **新圖層**：
  - 圓餅（能源結構）、流向弧線（貿易）：在 `src/map/WorldMap.tsx` 加圖層，在 `LayerSpec` 加對應的 `kind`。
- **新圖表**：在 `src/charts/EChart.tsx` 的 `echarts.use([...])` 註冊 TreemapChart、SankeyChart 等，再寫對應的 option 產生器。
- **主題自訂側欄**：`TopicDefinition` 可加一個選填的側欄元件，沒有就用預設的 `CountryPanel`。

## 8. 資料陷阱（重要）

1. **World Bank WDI 沒有台灣**：人口用 UN WPP（已採用），收入用 IMF WEO 或主計總處。Ember 和 FAOSTAT 有台灣（FAOSTAT 名稱是 "China, Taiwan Province of"）；UN Comtrade 把台灣列在 "Other Asia, nes"（代碼 490）。
2. **FAOSTAT 的「China」(351) 是大陸、港、澳、台的合計**，要用「China, mainland」(41)，否則會重複計算。
3. **Natural Earth / world-atlas 的代碼**：
   - world-atlas 用 ISO 數字代碼，有 5 個區域沒有代碼：科索沃、北賽普勒斯、索馬利蘭、澳屬印度洋領地、錫亞琴冰川。
   - 澳洲（036）出現兩次。
   - 這些都在 `build_geo.py` 處理掉了。
   - 如果改用 Natural Earth 原始檔，注意它的 `ISO_A3` 欄位裡法國、挪威是 `-99`。
4. **地圖上沒有形狀的國家**：吐瓦魯、托克勞、直布羅陀、荷屬加勒比區在 1:50m 圖資裡沒有形狀。法國海外省（留尼旺、瓜地洛普等）併在法國的形狀裡，地圖上顯示的是法國本土的數值。這些國家在排名表和搜尋裡都還找得到。
5. **國名**：繁中名稱用瀏覽器內建的 `Intl.DisplayNames`；英文名用 pycountry 的通用名稱（`Taiwan`，不是 `Taiwan, Province of China`）。
6. **授權**：WPP 是 CC BY 3.0 IGO；World Bank、Ember、FAOSTAT 是 CC BY 4.0，頁尾要標示來源。UNIDO 的條款比較嚴，公開前要先確認能不能轉載。
