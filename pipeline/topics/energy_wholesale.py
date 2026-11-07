"""批售電價：日前市場的價格與負電價（2026-11-07，製作手冊第二十五批 526，候選 1202；擴充「電價與油價」）。

Ember European Wholesale Electricity Price Data（CC BY 4.0，https://ember-energy.org/creative-commons/；原始資料是 ENTSO-E
透明平台，來源欄兩個都寫。ENTSO-E 的 API 要申請 token，不用）：
- 月檔 `european_wholesale_electricity_price_data_monthly.csv`：2015-01 起各國日前市場的月平均價（歐元/MWh）。
  最新一個月是不完整月（下載當天為止），不收；時間軸的「年份」是月份的編號（2000 年 1 月是 0，同「各國在讀什麼」）。
- 每小時檔 `…_hourly.zip`（約 42 MB，每國一個 CSV）：依當地時間算每年的平均價與價格小於 0 的小時數。一年的小時數不到 9 成的
  不算（新加入的市場）；今年只算到上個月底（標在說明）。
輸出 public/data/topics/energy-prices/{wholesale,wholesale-monthly,negative-hours}.json。
"""

from __future__ import annotations

import csv
import io
import math
import zipfile
from collections import defaultdict
from datetime import date

from common import OUT_DIR, download, indicator_file, write_json

OUT = OUT_DIR / "topics" / "energy-prices"
BASE = "https://files.ember-energy.org/public-downloads/price/outputs/"
TODAY = date(2026, 11, 7)
LAST_MONTH = (TODAY.year, TODAY.month - 1) if TODAY.month > 1 else (TODAY.year - 1, 12)
EXTRA = {"license": "CC BY 4.0", "attribution": "Ember, European Wholesale Electricity Price Data (from ENTSO-E Transparency Platform)"}


def _index(y: int, m: int) -> int:
    return (y - 2000) * 12 + m - 1


def _monthly() -> None:
    path = download(BASE + "european_wholesale_electricity_price_data_monthly.csv", "ember", "wholesale_monthly.csv")
    data: dict[str, dict[int, float]] = defaultdict(dict)
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            y, m = int(r["Date"][:4]), int(r["Date"][5:7])
            if (y, m) > LAST_MONTH or not r["Price (EUR/MWhe)"]:
                continue
            v = float(r["Price (EUR/MWhe)"])
            if not math.isnan(v):
                data[r["ISO3 Code"]][_index(y, m)] = v
    months = list(range(_index(2015, 1), _index(*LAST_MONTH) + 1))
    out = {k: [round(s[i], 2) if i in s else None for i in months] for k, s in sorted(data.items())}
    write_json(OUT / "wholesale-monthly.json", indicator_file("wholesale-monthly", "EUR/MWh", months, out, **EXTRA))
    last = months[-1]
    top = sorted(((s[last], k) for k, s in data.items() if last in s), reverse=True)
    print(f"  月價 {len(out)} 國，{LAST_MONTH}：高 {top[:6]}；低 {top[-6:]}")


def _hourly() -> None:
    path = download(BASE + "european_wholesale_electricity_price_data_hourly.zip", "ember", "wholesale_hourly.zip")
    total: dict[str, dict[int, list[float]]] = defaultdict(lambda: defaultdict(lambda: [0.0, 0, 0]))  # 和、小時數、負價小時數
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if name == "all_countries.csv":
                continue
            with io.TextIOWrapper(z.open(name), encoding="utf-8-sig") as f:
                for r in csv.DictReader(f):
                    local = r["Datetime (Local)"]
                    y, m = int(local[:4]), int(local[5:7])
                    if (y, m) > LAST_MONTH or not r["Price (EUR/MWhe)"]:
                        continue
                    p = float(r["Price (EUR/MWhe)"])
                    if math.isnan(p):
                        continue
                    t = total[r["ISO3 Code"]][y]
                    t[0] += p
                    t[1] += 1
                    t[2] += 1 if p < 0 else 0
    years = list(range(2015, LAST_MONTH[0] + 1))
    avg, neg = {}, {}
    for iso3, ys in sorted(total.items()):
        a, n = [], []
        for y in years:
            end = date(y + 1, 1, 1) if y < LAST_MONTH[0] else date(LAST_MONTH[0] + LAST_MONTH[1] // 12, LAST_MONTH[1] % 12 + 1, 1)
            hours = (end - date(y, 1, 1)).days * 24
            t = ys.get(y)
            ok = t and t[1] >= 0.9 * hours
            a.append(round(t[0] / t[1], 2) if ok else None)
            n.append(t[2] if ok else None)
        if any(v is not None for v in a):
            avg[iso3], neg[iso3] = a, n
    write_json(OUT / "wholesale.json", indicator_file("wholesale", "EUR/MWh", years, avg, **EXTRA))
    write_json(OUT / "negative-hours.json", indicator_file("negative-hours", "hours", years, neg, **EXTRA))
    for y in (2024, 2025, LAST_MONTH[0]):
        i = years.index(y)
        a = sorted(((v[i], k) for k, v in avg.items() if v[i] is not None), reverse=True)
        n = sorted(((v[i], k) for k, v in neg.items() if v[i] is not None), reverse=True)
        print(f"  {y}：{len(a)} 國；平均價高 {a[:6]} 低 {a[-6:]}；負價小時 {n[:8]}")


def build() -> None:
    _monthly()
    _hourly()
