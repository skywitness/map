# 迪士尼的據點白名單（`places.csv`）

製作手冊第二十八批順序 673（候選 1478、1484、1492）的「迪士尼」主題用，`pipeline/topics/disney.py` 讀這個檔。

手冊的硬規則：**實體清單固定成手工白名單的 QID**，不要用名稱比對或屬性鏈自動更新（名稱比對會抓到澳洲的 Magic Kingdom
Q6730737、那須的 Animal Kingdom Q11642887、阿肯色的 Wild River Country Q8000773、未建成的 Riverfront Square Q7963922）。
QID 來自 map-plan 的 research/brands/W1.md 第二節 1478；座標、面積、英文名從 Wikidata 讀（CC0）。

| 欄位 | 說明 |
|---|---|
| `qid` | Wikidata 項目 |
| `kind` | `resort` 度假區（一層）、`park` 主題樂園、`water` 水上樂園、`other` 其他（Discovery Island、DisneyQuest） |
| `resort` | 所屬度假區：`wdw` 華特迪士尼世界、`dlr` 加州迪士尼樂園度假區、`tdr` 東京、`dlp` 巴黎、`hkdr` 香港、`shdr` 上海、`adr` 阿布達比（已宣布） |
| `status` | `open` 營運中、`closed` 已關閉、`planned` 已宣布或興建中（不給開幕年） |
| `opened`、`closed` | 開幕與關閉的年份：開幕年照「大企業的據點」順序 632 用過的 Disney Experiences 條目（revid 1382282208），關閉年從各條目的固定版本（`source`） |
| `name_zh` | 官方或 632 已在用的中文名；沒有通用中文名的留空，中文介面照用英文（不自己翻譯） |
| `source` | 出處（英文維基固定版本，CC BY-SA 4.0，只引用年份這類事實） |
| `note` | 說明（中文） |

度假區與樂園是兩層，**不要混算**：「迪士尼有幾座樂園」只算 `kind=park`、`status=open` 的 12 座。

# 迪士尼在法國的法人白名單（`france.csv`）

順序 679（候選 1483）用，`pipeline/topics/disney_france.py` 讀這個檔。2026-11-08 用法國政府的公司查詢 API
（recherche-entreprises.api.gouv.fr）搜「euro disney」「walt disney」，人工挑出名稱與行業確定是迪士尼的法人；排掉員工福利委員會與它的
社團、只是名稱裡有 Disney 的無關公司、沒有總部位置的外國公司登記。數字（營業額、淨利、員工級距）每次重跑從 API 更新，出處是 INSEE 的
Base Sirene 與 INPI 的財報申報（data.gouv.fr，Licence Ouverte 2.0）。

| 欄位 | 說明 |
|---|---|
| `siren` | 法國的企業編號（9 碼） |
| `group` | `resort` 迪士尼巴黎（營運、套裝行程、工程設計）、`media` 影視、授權與消費品、`holding` 控股公司 |
| `note` | 這個法人是做什麼的（中文，自己寫的） |
