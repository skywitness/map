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
