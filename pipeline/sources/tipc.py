"""臺灣港務公司的「臺灣地區國際商港貨櫃裝卸量」（政府資料開放平臺 8368，政府資料開放授權條款第 1 版）。

- CSV（Big5／cp950 編碼）：年月、港口別、總計、進港、出港，單位 TEU；2001 年 1 月起逐月，每月 8 列
  （國際商港合計，基隆、臺中、高雄、花蓮、臺北、蘇澳、安平港）。臺北港 2009 年以前是 0。
- 逐月加總成每年的值，跟臺灣港務公司網站上的年度統計、交通部統計查詢網（statis.motc.gov.tw 的
  「國際商港貨櫃裝卸量(TEU)」）一致；也跟 UNCTAD 的台灣（「China, Taiwan Province of」）幾乎一樣
  （2024 年 13,933,254 對 13,933,246 TEU），shipping.py 會比對。
"""
from __future__ import annotations

import csv
import io
from collections import defaultdict

from common import download

URL = "https://www.twport.com.tw/fapi/opendata?id=13878"
INFO_URL = "https://data.gov.tw/dataset/8368"
TOTAL = "國際商港"
# 港口別 → 英文名稱（花蓮、蘇澳、安平的貨櫃量很少，側欄併成「其他」）
PORTS = {"高雄港": "Kaohsiung", "臺中港": "Taichung", "基隆港": "Keelung", "臺北港": "Taipei"}


def annual() -> dict[str, dict[int, float]]:
    """{港口別: {年: TEU}}，只收 12 個月都有的年份；港口別含「國際商港」（合計）"""
    path = download(URL, "tipc", "container_teu.csv")
    text = path.read_bytes().decode("cp950")
    sums: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    months: dict[int, set[int]] = defaultdict(set)
    for row in csv.DictReader(io.StringIO(text)):
        ym = row["年月"].strip()
        year, month = int(ym[:4]), int(ym[4:])
        sums[row["港口別"].strip()][year] += float(row["總計"])
        months[year].add(month)
    full = {y for y, m in months.items() if len(m) == 12}
    return {port: {y: v for y, v in by_year.items() if y in full} for port, by_year in sums.items()}
