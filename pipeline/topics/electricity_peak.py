"""發電量的擴充：用電的尖峰月份、自發自用的電（2026-11-07，製作手冊第二十七批 608，候選 1337、1340；
步驟 electricity-peak，輸出 topics/electricity/）。

- **尖峰月份**：Ember Monthly Electricity Data（CC BY 4.0，新網址 files.ember-energy.org，手冊第十五節 1-c）的
  `Electricity source = Demand`（需求＝發電＋淨進口），只用 12 個月都有的完整年份。照「出生的季節」的做法用每天的平均
  （2 月只有 28、29 天，用月總量會吃虧），值是「到那一年為止最近 5 個完整年」平均起來每天用電最多的月份（1–12），
  所以時間軸從有 5 個完整年的那一年開始。側欄：最近 5 年各月的每日平均（TWh/天）。
- **自發自用的電**：Eurostat `nrg_ind_epsc`（CC BY 4.0，40 個 geo 不含英國；科索沃照網站的規則不收）。
  沒有合計列，自己把 5 種用戶（customer）× 6 種能源（siec）加總：自用（AC）÷ 自發的電（PRD）× 100。
  自發的電不到 100 GWh 的不算（太小，比例不穩）；自用是 0 的當成沒有填（波蘭自發 30,208 GWh、自用 0）。
"""
from __future__ import annotations

import calendar
import csv
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources import eurostat
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "electricity"
EMBER = "https://files.ember-energy.org/public-downloads/generation/outputs/release_generation_monthly_global.csv"
WINDOW = 5
CUSTOMERS = ["HH", "IND", "NRG", "OTH", "SERV"]
SIEC = ["G3000", "R5000", "RA300", "RA400", "RA500_5160", "X9900NR"]
MIN_GWH = 100


def _peak() -> None:
    demand: dict[str, dict[tuple[int, int], float]] = defaultdict(dict)
    with open(download(EMBER, "ember", "release_generation_monthly_global.csv"), encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r["Electricity source"] != "Demand" or r["Area type"] != "Country or economy" or not r["Generation (TWh)"]:
                continue
            c = to_iso3(r["ISO 3 code"])
            if c:
                y, m = int(r["Date"][:4]), int(r["Date"][5:7])
                demand[c][(y, m)] = float(r["Generation (TWh)"]) / calendar.monthrange(y, m)[1]
    full = {c: sorted({y for y, _ in d if all((y, m) in d for m in range(1, 13))}) for c, d in demand.items()}
    first = min(ys[WINDOW - 1] for ys in full.values() if len(ys) >= WINDOW)
    last = max(ys[-1] for ys in full.values() if ys)
    years = list(range(first, last + 1))
    values: dict[str, list[int | None]] = {}
    detail: dict[str, list] = {}
    for c, d in demand.items():
        row = []
        for y in years:
            window = list(range(y - WINDOW + 1, y + 1))
            if all(w in full[c] for w in window):
                avg = [sum(d[(w, m)] for w in window) / WINDOW for m in range(1, 13)]
                row.append(avg.index(max(avg)) + 1)
            else:
                row.append(None)
        if any(row):
            values[c] = row
        lw = [w for w in full[c] if w > full[c][-1] - WINDOW] if full[c] else []
        if len(lw) == WINDOW:
            detail[c] = [lw[0], lw[-1], [round(sum(d[(w, m)] for w in lw) / WINDOW, 5) for m in range(1, 13)]]
    write_json(OUT / "peak-month.json", indicator_file("peak-month", "", years, dict(sorted(values.items())), license="CC BY 4.0"))
    write_json(OUT / "peak-month-detail.json", {"countries": detail})
    latest = {c: v[-1] for c, v in values.items() if v[-1]}
    count = defaultdict(list)
    for c, m in latest.items():
        count[m].append(c)
    print(f"  尖峰月份（{years[-1] - WINDOW + 1}–{years[-1]} 平均，{len(latest)} 國）：" + "；".join(f"{m} 月 {len(cs)}" for m, cs in sorted(count.items(), key=lambda x: -len(x[1]))))
    print("  " + "、".join(f"{c} {latest.get(c)}" for c in ("TWN", "JPN", "KOR", "CHN", "USA", "IND", "RUS", "BRA", "THA", "DEU", "FRA", "ESP", "AUS", "EGY", "KWT", "VNM", "NOR")))
    print(f"  時間軸 {years[0]}–{years[-1]}")
    for m in (1, 12, 8, 7):
        print(f"    {m} 月：{sorted(count[m])}")


def _self_consumption() -> None:
    prd: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    ac: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for bal, target in (("PRD", prd), ("AC", ac)):
        for cu in CUSTOMERS:
            for s in SIEC:
                for c, by in eurostat.series("nrg_ind_epsc", freq="A", customer=cu, nrg_bal=bal, siec=s, unit="GWH").items():
                    for y, v in by.items():
                        target[c][y] += v
    years = sorted({y for v in prd.values() for y in v})
    # 自用全部是 0 的多半是沒有填（波蘭 30,208 GWh 自發、自用 0），當成沒有資料
    share = {c: [round(ac[c][y] / prd[c][y] * 100, 3) if prd[c].get(y, 0) >= MIN_GWH and ac[c].get(y) else None for y in years]
             for c in sorted(prd)}
    share = {c: s for c, s in share.items() if any(v is not None for v in s)}
    write_json(OUT / "self-consumption.json", indicator_file("self-consumption", "%", years, share, latestWithin=3, license="CC BY 4.0"))
    y = years[-1]
    r = sorted(((c, s[-1], prd[c][y], ac[c].get(y, 0)) for c, s in share.items() if s[-1] is not None), key=lambda x: -x[1])
    print(f"  自發自用（{y}，{len(r)} 國）：" + "、".join(f"{c} {v:.1f}%（{p:,.0f}/{a:,.0f}）" for c, v, p, a in r))


def build() -> None:
    _peak()
    _self_consumption()
