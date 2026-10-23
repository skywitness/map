# 世界資料地圖

用世界地圖瀏覽各國資料。除了純地圖頁，目前有以下資料主題，在頂列依分類放在下拉選單裡：

- **社會**：人口、健康（平均壽命、嬰幼兒死亡率、醫療支出與自付比例、醫師、護理人員與病床數）、疾病（各國首要死因、慢性病過早死亡、癌症死亡率、糖尿病、肥胖、愛滋、結核病、瘧疾、死因結構）、教育（受教育年數、高等教育在學率、教育支出、識字率）、飲食（熱量、蛋白質、脂肪、動物性食物占熱量、各類食物的人均供給量、營養不足人口比例）
- **經濟**：人均收入、產業結構、工業、農業
- **國際**：貿易（國際貿易流向：點選國家，畫出它跟主要貿易夥伴之間的弧線）、觀光（國際旅客、觀光收入）、軍事（軍費、兵力）
- **能源**：發電量、氣候（二氧化碳排放）
- **科技與交通**：AI、數位（網路、行動電話、固網寬頻）、交通
- **地理**：語言（各國的主要官方語言、30 種語言的使用比例、使用人數與官方地位、各國有幾種語言）

地圖可以切換地球儀與平面、一路放大到街道，並有五種底圖配色可選。按「3D」可以把數值畫成高度：比率類指標把國家依色階分級拉高，總量類指標畫成高度與數值成正比的柱子，可以旋轉、傾斜。人口主題可以在地圖上框選範圍，估算框內人口。

每個畫面右上角的「分享」可以下載地圖圖片（PNG，含標題、圖例與資料來源）、下載目前指標的 CSV（選定年份或所有年份，Excel 可直接開啟），或複製這個畫面的連結。

右上角的「中文 / EN」切換介面語言，不必重新整理；英文版的網址帶 `lang=en`，分享出去打開就是英文。

資料來源、架構與新增主題的方法見 [DESIGN.md](DESIGN.md)。

## 操作

- **搜尋國家**：中文、英文、常用別名（南韓、韓國、Korea；美國、USA；英國、UK；中國、大陸）或 ISO 代碼（TW、TWN）都找得到，打一部分或拼錯一兩個字母也可以。結果會列出目前的數值，選了之後地圖會飛到那個國家。
- **鍵盤快捷鍵**（按 `?` 或右上角的「?」看說明）：
  - `/`：搜尋
  - `←` `→`：換年份
  - 空白鍵：播放／暫停
  - `+` `−`：縮放地圖
  - `Esc`：取消選取
- **手機**：國家資料從底部抽屜拉起，可以拖到收合、半開、全開三段，往下拖到底就關閉。
- **語言**：「中文 / EN」切換，選擇記在瀏覽器裡；英文版的數字用 K、M、B、T（中文用萬、億、兆），國名與地圖上的地名也換成英文。

看過一次之後，再開啟會直接從瀏覽器的快取載入，沒有網路也能開（標題旁會顯示「離線中」，資料與地圖是上次看過的部分）。手機與桌機的瀏覽器都可以把它安裝成 App。載入速度的量測與做法見 DESIGN.md 第 13 節。

網站：https://skywitness.github.io/map/

## 開發

```bash
npm install
npm run dev
```

`public/data/` 裡已經有產生好的資料，只改前端的話不需要跑資料管線。

### 檢查英文版

```bash
npm run check:i18n
```

掃描 `src/` 的原始碼，列出英文介面會看到、卻還沒翻譯的中文（新增功能或主題後跑一次）。

```bash
npm i --no-save puppeteer-core
npm run check:en
```

用無頭 Chrome 打開英文版，逐一切換每個主題、指標、排名表、國家側欄與框選，列出畫面上剩下的中文，也檢查中英切換與 `lang=en` 的網址。需要系統的 Chrome（或設定 `CHROME_PATH`）。

## 重新產生資料

第一次使用時，先建立 Python 環境：

```bash
python -m venv pipeline/.venv
pipeline/.venv/Scripts/python -m pip install -r pipeline/requirements.txt
```

（macOS / Linux 的路徑是 `pipeline/.venv/bin/python`。）

產生資料：

```bash
npm run data                   # 全部
npm run data -- population     # 只跑人口
npm run data -- --refresh      # 忽略快取，重新下載原始資料
```

可用的步驟：`geo`、`population`、`population-grid`、`income`、`sectors`、`agriculture`、`electricity`、`industry`、`ai`、`transport`、`climate`、`military`、`digital`、`health`、`disease`、`diet`、`education`、`tourism`、`trade`、`language`、`compact`。

`population-grid` 是框選估算用的網格人口，要先有 `geo` 的國界。`disease` 第一次會向 WHO 的 API 一年一年查 2000–2023 年的死因資料，約 15 分鐘。

指標檔輸出時數值會壓縮（格式見 DESIGN.md 第 3 節）。`compact` 把還沒壓縮的舊指標檔一次轉換，不需要重新下載，重複執行沒有影響。

下載的原始檔會快取在 `pipeline/.cache/`，這個資料夾不進版本控制。第一次跑全部大約要下載 2.5 GB（主要是 FAOSTAT 的貿易檔、雙邊貿易矩陣與糧食平衡表、CEPII BACI、GHS-POP 的網格人口和 Anthropic Economic Index），世界銀行 API 比較慢，全部跑完約 30 分鐘，其中 `trade` 要讀 8.5 GB 的 FAOSTAT 雙邊貿易矩陣，約占一半。

## 建置

```bash
npm run build
```

輸出在 `dist/`，可以放到任何靜態主機。

Service worker（離線、快取）只在建置後的版本運作。要在本機試，執行：

```bash
npm run preview
```

## 部署

推送到 `main` 後，GitHub Actions（`.github/workflows/deploy.yml`）會自動建置並發佈到 GitHub Pages，約 1–2 分鐘。
資料檔已經在版本庫裡，所以更新資料的流程是：本機執行 `npm run data`，再把 `public/data/` 的變更提交、推送。

## English

World Data Map shows country data on an interactive world map: population, income, electricity, economic structure, industry, agriculture, trade flows, AI, transport, climate (CO₂ emissions), military, digital, health, disease and causes of death, education, tourism, diet (calories, protein, fat, food supply by food group, undernourishment) and languages, plus a plain map page. Switch the interface between Chinese and English with the **中文 / EN** button at the top right; the English version uses K/M/B/T for large numbers, English country and place names, and English labels on the map.

Live site: https://skywitness.github.io/map/?lang=en

- **Map**: switch between globe and flat map, zoom down to street level, and choose from five basemaps. Click a country to open its panel with rankings, time series and topic details. Every map also has a **Ranking** table view.
- **Search**: type a country name in English or Chinese, a common alias (UK, USA, Korea) or an ISO code (TW, TWN). Partial names and small typos work too.
- **Keyboard shortcuts** (press `?`): `/` search, `←` `→` change year, Space play/pause, `+` `−` zoom, `Esc` clear the selection.
- **Share**: download the current map as a PNG (with title, legend and sources), download the indicator as CSV, or copy a link. The whole view, including the language (`lang=en`), is stored in the URL.
- **Area estimate**: on the population topic, draw a box on the map to estimate how many people live inside it.

Data sources include UN World Population Prospects, IMF World Economic Outlook, World Bank, WHO (Global Health Estimates, Global Health Observatory), Ember, FAOSTAT, the Harvard Atlas of Economic Complexity, Taiwan's DGBAS, JRC GHS-POP, Epoch AI, the Anthropic Economic Index, Microsoft AI Diffusion, OECD.AI, Our World in Data, Unicode CLDR, Glottolog, Natural Earth, OurAirports and OpenStreetMap; each topic lists its sources and licences in the footer.

Development: `npm install`, then `npm run dev`. Data is pre-built in `public/data/`; run `npm run data` to rebuild it (see the Chinese sections above). Design notes, including how to add a topic with bilingual text, are in [DESIGN.md](DESIGN.md) (in Chinese).
