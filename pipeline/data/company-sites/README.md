# 大企業的據點（sites.csv）

主題「大企業的據點」（`pipeline/topics/company_sites.py`、`src/topics/company-sites.ts`）的事實表：12 家大企業官方公開的
總部、辦公室、研發中心、工廠、資料中心與發射場，2026-10-31 手工整理。每一列附出處網址；授權依「引用事實並註明出處」。
AWS、Azure 的雲端區域不在這裡（沿用 `pipeline/sources/cloud_regions.py`）。

## 欄位

| 欄位 | 說明 |
|---|---|
| `company` | apple、nvidia、microsoft、amazon、tsmc、spacex、meta、broadcom、samsung、micron、amd、intel |
| `kind` | `hq` 總部、`office` 辦公室、`rnd` 研發中心、`factory` 工廠（晶圓廠、封裝測試、組裝、火箭與衛星工廠）、`datacenter` 資料中心、`launch` 發射場與試驗場。同一個園區只列一列，用最主要的那一種（總部優先） |
| `status` | `open` 營運中、`building` 興建中、`planned` 已正式宣布還沒動工。已關閉、已出售的不收 |
| `name` | 據點的官方英文名稱；沒有特別名稱寫「公司 城市」 |
| `name_zh` | 公司自己用的繁體中文名稱（例如台積電的「晶圓十八廠」）；沒有就空白，不自己翻譯 |
| `city`、`iso3` | 英文城市名、ISO 3166-1 alpha-3（台灣 TWN） |
| `lat`、`lon` | 十進位度數 |
| `precision` | `site`：據點本身在 Wikidata 的座標（P625，note 寫 QID）；`city`：城市在 Wikidata 的座標，小數 2 位 |
| `year` | 開始營運（或預計完工）的年份，有寫才填 |
| `source` | 這一列事實的出處網址 |
| `note` | 補充；「待確認：」開頭的是沒能確認的地方，「非官方來源」是沒有官方頁面、用可靠新聞的 |

## 範圍

- 收：總部、官方據點頁或年報列出的辦公室、研發中心、自有工廠、自有資料中心、SpaceX 的發射場與試驗場；興建中與已宣布的也收（`status` 標明，地圖上畫空心、不算進據點數）。
- 不收：零售店（Apple Store 等）、物流倉庫與配送中心、代工廠、已關閉或已出售的據點、經銷商。
- 子公司：完全持有、母公司官方頁面有列出的主要據點才收，`note` 寫子公司名稱。
- 同一個城市有好幾個辦公室時合成一列。
- 座標只用 Wikidata（CC0）：據點本身有條目、有座標的用據點的，其他用城市的（所以辦公室多半是城市的位置，不是大樓本身）。

## 出處與抓取方式

2026-10-31 由 map cloud 整理，抓網頁一律用 pipeline 的 User-Agent（`world-map-viz-pipeline/0.1`），同一網站兩次請求至少隔 1 秒；
**使用條款禁止機器人、爬蟲或資料探勘的網站完全不抓**，改用掛在別的主機上的年報、政府文件；被 Cloudflare 擋或連線被重設的網址沒有繞過。
座標一律取自 Wikidata（SPARQL、`Special:EntityData`，CC0）。

### 使用條款禁止抓取、沒有讀的網站

| 網站 | 條款 | 影響 |
|---|---|---|
| apple.com（含 Newsroom、jobs.apple.com、investor.apple.com） | Website Terms of Use 禁止「page-scrape, robot, spider … or similar manual process」，範圍包括 Apple 連結出去的網站 | Apple 沒有官方據點清單可用，只收年報與政府文件能證實的 |
| Amazon（aboutamazon.com、amazon.jobs、amazon.science、ir） | Conditions of Use（2026-08-14 版）禁止「data mining, robots, or similar data gathering and extraction tools」 | Amazon 的辦公室與科技中心沒有收 |
| zoox.com | 條款禁止「any robot, spider … or other automatic device」 | Zoox 只收加州政府新聞稿寫的 Hayward 工廠 |
| metacareers.com | robots.txt 寫明未經書面許可禁止自動蒐集 | Meta 的辦公室（年報寫「90 多個城市」）沒有收 |
| intel.com（含 newsroom.intel.com） | Terms of Use（2024-06-21 版）4.1.14 禁止 bots、scraping，4.1.16 禁止 text／data mining | Intel 的據點頁沒有讀；工廠用 intc.com 的年報，辦公室與研發中心只收得到 8 處 |
| baxtel.com | 條款禁止 data scraping | 沒有拿來當出處 |

### 各公司

- **Apple**（12 列）：總部用 FY2025 10-K（s2.q4cdn.com）。資料中心、研發中心與台灣的兩處用政府文件：內華達州經濟發展局（Reno）、Mesa 市政府、Waukee 市政府、奧勒岡州能源資訊網（Prineville）、德州 TDLR（Austin）、北卡州商務部（Research Triangle，已宣布、報導說暫停）、巴伐利亞邦經濟部（Munich）、竹科管理局的廠商資料（龍潭）、國貿署的出進口廠商資料（台北）；Maiden 用 Catawba County 經濟發展公司轉載的報導（非官方來源）。
- **Meta**（34 列）：資料中心是官方清單 https://datacenters.atmeta.com/all-locations/ 的全部 33 處（網站沒有使用條款，robots.txt 允許），各處資訊表寫「is part of」的算營運中、「will be part of」的算興建中；總部用 2024 年報。
- **Amazon**（6 列）：兩個總部（Seattle、Arlington HQ2）用 2025 年報（s2.q4cdn.com）；Nashville 用田納西州經濟發展廳、Amazon Leo（原 Project Kuiper）的 Kirkland 衛星工廠用 Kirkland 市長的剪綵致詞、Zoox 的 Hayward 工廠用加州州長辦公室新聞稿、Hyderabad 園區用 Telangana 州政府新聞稿。
- **TSMC**（38 列）：2025 年報（中文版的台灣各廠與中文名稱、英文版的海外子公司）與 2025 年 20-F 列出的晶圓廠、先進封測廠、研發中心、海外子公司與辦公室；A、B 廠照年報分開列。**台積電的官方主機（tsmc.com、investor.tsmc.com、esg.tsmc.com）從 cloud 都是 Cloudflare 驗證頁（403）**，年報是用搜尋結果引用的內容核對，待本機 session 下載年報再核對一次。Fab 25（中科）、慕尼黑設計中心用新聞（非官方來源）。
- **Samsung**（84 列）：半導體部門的據點頁與晶圓代工製造據點頁（semiconductor.samsung.com）、Samsung Research 的全球研發網（research.samsung.com）、2026 年半年報（國內事業場、區域總部、子公司清單）；生產法人的城市補自官方 2012 年報的 Global Network 頁，只收 2026 半年報仍列為製造法人的。不收 89 個銷售法人、設計中心、Harman、FläktGroup。
- **Micron**（42 列）：官網據點頁 https://www.micron.com/about/locations 的全部城市（台灣的中文名稱用 tw.micron.com）、公司簡介的 11 個製造地點、2026 永續報告書（興建中的）；紐約 Clay 與台中先進封裝與測試二廠用新聞（非官方來源）。
- **Intel**（19 列）：FY2025 10-K（intc.com，投資人網站沒有引用 intel.com 的條款）與 intc.com 的新聞稿、NIST CHIPS 的各據點頁、InvestPenang、波蘭投資貿易局；以色列、越南、哥斯大黎加、印度與台灣的據點用新聞（非官方來源）。德國 Magdeburg、波蘭 Wrocław（年報寫取消）、大連（已賣給 SK hynix）、Mobileye（不是完全持有）不收。
- **AMD**（17 列）：FY2025 10-K 的 Item 2（總部 Santa Clara 與 9 個主要據點）與 ir.amd.com 的新聞稿（印度、愛爾蘭、Silo AI）；台南、高雄用新聞。只出現在年報、沒寫用途的據點標辦公室。amd.com 的條款頁與據點頁從 cloud 連不上（HTTP/2 錯誤、連線被重設），待本機 session 確認。
- **SpaceX**（16 列）：官網的 Sites 頁 https://www.spacex.com/sites 與子頁（內容是網站自己的 JavaScript 檔載入的文字）列出的全部據點，發射台各一列；SLC-6 用 FAA 的決策紀錄、Terafab 用德州州長新聞稿。總部與 Starfactory 同一個園區，只列一列總部。
