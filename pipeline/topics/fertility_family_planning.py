"""生育率與高齡化：避孕需求被現代方法滿足的比例（2026-11-04，製作手冊第二十批 335）。

WHO 資料平臺 data.who.int 的「Family planning satisfied with modern methods」（SDG 3.7.1，指標頁 8074BD9，整份 CSV
`DATADOT/INDICATOR/8074BD9_ALL_LATEST.csv`，CC BY 4.0；手冊開工前要先確認 data.who.int 有沒有，有）：15–49 歲有家庭計畫需求
（想避孕或延後生育）的女性裡，用現代避孕方法的比例。國家值多半來自各國的人口與健康調查，不是每年都有，各國用 10 年內
最近的一年。台灣不在 WHO 的資料裡（聯合國人口司的模型估計有台灣，但授權待確認，不用）。
"""
from __future__ import annotations

import csv

from common import OUT_DIR, download, indicator_file, latest_year_span, to_series, write_json
from sources.countries import from_numeric

OUT = OUT_DIR / "topics" / "fertility"
URL = "https://srhdpeuwpubsa.blob.core.windows.net/whdh/DATADOT/INDICATOR/8074BD9_ALL_LATEST.csv"
WITHIN = 10


def build() -> None:
    with open(download(URL, "who-datadot", "8074BD9_ALL_LATEST.csv"), encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    countries: dict[str, dict[int, float]] = {}
    world: dict[int, float] = {}
    for r in rows:
        if not r["RATE_PER_100_N"]:
            continue
        year, value = int(r["DIM_TIME"]), float(r["RATE_PER_100_N"])
        if r["DIM_GEO_CODE_TYPE"] == "GLOBAL":
            world[year] = value
        elif r["DIM_GEO_CODE_TYPE"] in ("COUNTRY", "OVERSEAS TERRITORY", "NATIONAL LIBERATION MOVEMENT"):
            iso3 = from_numeric(r["DIM_GEO_CODE_M49"])
            if not iso3:
                raise RuntimeError(f"避孕需求：對不到的 M49 代碼 {r['DIM_GEO_CODE_M49']} {r['GEO_NAME_SHORT']}")
            countries.setdefault(iso3, {})[year] = value
    years = latest_year_span(countries, WITHIN)
    write_json(OUT / "family-planning.json", indicator_file(
        "family-planning", "%", years, {c: to_series(s, years, 1) for c, s in sorted(countries.items()) if any(y in s for y in years)},
        latestWithin=WITHIN, aggregates={"WLD": to_series(world, years, 1)},
        noValue={"TWN": "台灣不在 WHO 的資料裡"}, noValueEn={"TWN": "Taiwan is not in WHO’s data"}))
    latest = sorted(((s[max(s)], c, max(s)) for c, s in countries.items() if max(s) >= years[-1] - WITHIN), reverse=True)
    print(f"  避孕需求被現代方法滿足：{len(countries)} 國，時間軸 {years[0]}–{years[-1]}；世界 {dict(sorted(world.items())[-3:])}")
    print(f"  最高 {[(c, round(v, 1), y) for v, c, y in latest[:8]]}；最低 {[(c, round(v, 1), y) for v, c, y in latest[-8:]]}")
