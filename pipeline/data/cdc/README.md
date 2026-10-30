# 疾管署的預防接種完成率（手動下載）

`immunization-coverage-2024.csv`：衛生福利部疾病管制署「各縣市衛生所及合約醫院診所 2024 年預防接種完成率統計」
（政府資料開放平臺 https://data.gov.tw/dataset/24457 ，原檔 `https://od.cdc.gov.tw/acute/2024 Immunization Coverage Annual Data.csv`）。

- 下載方式：od.cdc.gov.tw 從 cloud 連不上（連線逾時），使用者 2026-10-30 用瀏覽器下載，原樣放在這裡，沒有改過內容。
  UTF-8 沒有 BOM、CRLF 換行，SHA-256 `416cd67b497df857aab05068b8ce0ea757924b35e0feb48d6ef60ab1322c478a`。
- 內容：22 個縣市的 15 項疫苗完成率（%），沒有全國值、沒有分母。
- 授權：政府資料開放授權條款第 1 版（資料集頁面）；疾管署全球資訊網的政府網站資料開放宣告：「衛生福利部疾病管制署全球資訊網站上刊載之
  所有資料與素材，其得受著作權保護之範圍，以無償、非專屬，得再授權之方式提供公眾使用」。
- 用途：疫苗與防疫主題的麻疹第二劑（MCV2），台灣 2024 年用各縣市的 5 歲戶籍人口加權（`pipeline/sources/cdc_tw.py`，
  DESIGN.md 第 8 節第 227 點）。
