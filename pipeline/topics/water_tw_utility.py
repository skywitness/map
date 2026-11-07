"""台灣的自來水漏水率與水價（2026-11-07，製作手冊第二十五批 496，候選 1163；擴充「各國水資源與森林」的台灣側欄）。

台灣自來水公司開放資料（政府資料開放授權條款第 1 版；www.water.gov.tw 的 robots.txt 同一個 User-agent 先寫 Allow: / 再寫
Disallow: /，依 RFC 9309 第 2.2.2 節「一樣長的 allow 與 disallow 用 allow」）：
- 「近年漏水率」（data.gov.tw 22263）prot2.csv：年度（民國）、供水量、售水量、有效無費水量、漏水量、漏水率，民國 93 年起。
  售水率＝售水量÷供水量自己算（「最近十年配、售水量及售水率」saledata.csv 從 cloud 連線被重設，沒用）。
- 「近年水價資料表」（86103）prop8.csv：平均水價、單位銷售成本、單位銷售盈虧（元／立方公尺）、給水投資報酬率，民國 107 年起。
  民國 113 年的單位銷售成本 11.54 元跟盈虧 −2.46 元對不起來（11.08 − 11.54 = −0.46），照原表。
台水不含臺北市（臺北自來水事業處自營）。
輸出 public/data/topics/water-forest/tw-water.json：{"leak": [[西元年, 漏水率, 售水率], …], "price": [[西元年, 平均水價, 單位成本, 盈虧, 報酬率], …]}。
"""

from __future__ import annotations

import csv
import time
import urllib.error

from common import OUT_DIR, download, write_json

OUT = OUT_DIR / "topics" / "water-forest"
BASE = "https://www.water.gov.tw/opendata/{}.csv"


def _csv(name: str) -> list[list[str]]:
    for attempt in range(3):  # 台水的網站第一次常連線失敗，重試
        try:
            path = download(BASE.format(name), "taiwater", f"{name}.csv")
            break
        except (urllib.error.URLError, ConnectionError, OSError):
            if attempt == 2:
                raise
            time.sleep(5)
    with open(path, encoding="utf-8-sig", newline="") as f:
        return [r for r in csv.reader(f) if r]


def build() -> None:
    leak = []
    for r in _csv("prot2")[1:]:
        year = 1911 + int(r[0])
        supply, sold, rate = float(r[1]), float(r[2]), float(r[5])
        leak.append([year, rate, round(sold / supply * 100, 2)])
    price = []
    for r in _csv("prop8")[1:]:
        price.append([1911 + int(r[0]), *[float(x.strip()) for x in r[1:5]]])
    write_json(OUT / "tw-water.json", {"leak": leak, "price": price})
    print(f"  台水漏水率 {leak[0][0]}–{leak[-1][0]}：{leak[0][1]}% → {leak[-1][1]}%（售水率 {leak[-1][2]}%）；"
          f"平均水價 {price[0][0]} 年 {price[0][1]} 元 → {price[-1][0]} 年 {price[-1][1]} 元（單位成本 {price[-1][2]}）")
