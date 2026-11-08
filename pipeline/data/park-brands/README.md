# 樂園品牌的據點（brands.csv）

製作手冊第二十七批 632（候選 1372），2026-11-08 整理。步驟 `park-brands`（`pipeline/topics/park_brands.py`）讀這個檔，輸出到
`public/data/topics/theme-parks/brands/`，前端在 `src/topics/park-brands.ts`（「樂園」主題的「樂園品牌的據點」指標）。

手冊的結論是品牌對應不能自動做（OpenStreetMap 的 `brand:wikidata` 在樂園上只有 0.6%，Wikidata 的所有者、營運者、母公司屬性
合起來只有 15.6%），所以照「大企業的據點」（`pipeline/data/company-sites/`）的做法手工整理成表，每一列附出處。

## 出處

每一列的 `source` 是那個品牌的維基百科條目的**固定版本**（`/wiki/<條目>?oldid=<版本>`；robots.txt 不准 `/w/`，所以不用
`action=raw`）裡的據點表或據點清單，只引用「哪個品牌在哪裡有據點、哪一年開」這些事實（CC BY-SA 4.0）：

| 品牌 | 條目 |
| --- | --- |
| 迪士尼 | Disney Experiences（Theme parks and resorts 一節） |
| 環球影城 | Universal Destinations & Experiences（Current theme parks、Future 兩節） |
| 樂高樂園 | Legoland（各洲的表與 Future 表） |
| 默林娛樂的其他樂園 | Merlin Entertainments（Theme parks、Peppa Pig 兩張表） |
| 樂高探索中心 | Legoland Discovery Centre（各洲的表，只收 Status 是 Open 的） |
| Sea Life | Sea Life Centres（Locations 一節，不收 Former sites 與還沒開的四川） |
| 杜莎夫人蠟像館 | Madame Tussauds（Locations 一節，不收 Former locations） |
| Six Flags | Six Flags（Amusement parks、Water parks、International 三張表；不收飯店） |
| United Parks | United Parks & Resorts（Parks 表） |
| Parques Reunidos | Parques Reunidos（樂園、動物園與水族館、水上樂園、室內樂園四張表；不收纜車） |
| PortAventura | PortAventura World（三座園區的小節） |
| 華強方特 | Fantawild（只收 Status 是 Operating 的） |
| 華僑城 | Overseas Chinese Town Enterprises（只收 Operating） |
| 長隆 | Chimelong（Properties 一節） |
| 海昌 | 中文維基「海昌海洋公园」的「主題公園」「室內樂園」兩節（「意向興建」不收） |
| 三麗鷗、富士急、樂天世界、愛寶樂園、台灣五家 | 各樂園自己的條目 |

## 欄位

- `brand`：品牌代碼（`park_brands.py` 的 `BRANDS`）。
- `kind`：`park` 樂園、`water` 水上樂園、`animal` 動物園與水族館（含野生動物園、海洋生物體驗）、`indoor` 室內景點（樂高探索中心、
  Sea Life、杜莎夫人蠟像館、Parques Reunidos 的 Nickelodeon Adventure、海昌的萌寵 park 與 HiLife）。
- `status`：`open` 營運中、`planned` 興建中或已宣布（條目寫的預定年份放在 `year`）。
- `name`、`name_zh`：英文名稱；中文名稱取自 Wikidata 的中文標籤（簡體轉台灣正體），海昌照中文維基。
- `city`、`iso3`：城市與國家（香港是 HKG）。
- `lat`、`lon`、`precision`：`site` 是據點本身的座標（Wikidata 的 P625；中國的樂園沒有 Wikidata 座標時用 OpenStreetMap
  同名物件的中心點，`note` 寫 OSM 物件編號），`city` 是城市的座標（Wikidata）。
- `year`：開幕年（條目的表；表上沒有時用 Wikidata 的 P1619／P571）。
- `wikidata`：據點本身的 Wikidata 項目（有的話）。
- `source`、`note`：出處與備註。

## 注意

- 樂高探索中心、Sea Life、杜莎夫人蠟像館是室內小型景點，跟樂園不是同一量級：「全部品牌」的據點數只算樂園與水上樂園。
- Sea Life 有幾處在樂園裡面（Alton Towers、Chessington、Legoland Windsor、Gardaland、Legoland Billund、Legoland California、
  Legoland Malaysia），座標是那座樂園的。
- 杜莎夫人蠟像館、Sea Life 在「景點地圖」的博物館、動物園與水族館圖層也可能出現，同一個地方會在兩個主題各畫一次。
- 華強方特的 Dream Land Isfahan（伊朗）是華強方特輸出的樂園，條目列在方特的表上，照收。
