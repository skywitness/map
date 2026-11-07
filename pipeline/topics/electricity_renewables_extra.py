"""離岸風電、地熱發電、海洋能（2026-11-07，製作手冊第二十五批 521，候選 1194、1196、1197；擴充「發電量」）。

- 離岸風電：GEM Global Integrated Power Tracker 2026-09（發電廠地圖已在用同一個檔，照使用者 2026-10-28 的決定標 CC BY 4.0）
  的風力機組，tech-type 是 Offshore hard mount、Offshore mount unknown、Offshore floating 的都算離岸（mount unknown 不能漏）；
  依 unit-id 去重；運轉中與已退役的依 start-year、end-year 算每年的累計容量（MW），浮動式另列。國家是 country-area1。
- 地熱：EIA INTL 的 35-7（裝置容量，百萬瓩）；海洋能（潮汐與波浪，EIA 分不開）：117-7。1980–2024，換成 MW。
輸出 public/data/topics/electricity/{offshore-wind/{all,floating},geothermal,ocean}.json。
"""

from __future__ import annotations

import csv
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources import eia, gem
from sources.countries import from_name, to_iso3

OUT = OUT_DIR / "topics" / "electricity"
OFFSHORE = {"Offshore hard mount", "Offshore mount unknown", "Offshore floating"}
FIRST, LAST = 2000, 2026
NAMES = {"Taiwan": "TWN", "South Korea": "KOR", "Vietnam": "VNM", "Russia": "RUS", "Türkiye": "TUR"}


def _year(v: str) -> int | None:
    v = (v or "").split(".")[0]
    return int(v) if v.isdigit() else None


def _offshore() -> None:
    path = download(gem.CSV_URL, "gem", f"integrated_map_{gem.RELEASE}.csv")
    units = {}
    with open(path, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["tech-type"] not in OFFSHORE or r["status"] not in ("operating", "retired"):
                continue
            key = r["unit-id"] or (r["name"], r["unit-name"])
            units[key] = r
    years = list(range(FIRST, LAST + 1))
    for item, pick in (("all", lambda r: True), ("floating", lambda r: r["tech-type"] == "Offshore floating")):
        data: dict[str, list[float]] = defaultdict(lambda: [0.0] * len(years))
        for r in units.values():
            if not pick(r):
                continue
            iso3 = NAMES.get(r["country-area1"]) or from_name(r["country-area1"])
            start, end = _year(r["start-year"]), _year(r["end-year"])
            if not iso3 or start is None:
                continue
            cap = float(r["capacity"] or 0)
            for i, y in enumerate(years):
                if start <= y and (end is None or y < end):
                    data[iso3][i] += cap
        out = {k: [round(v, 1) if v else None for v in s] for k, s in sorted(data.items())}
        write_json(OUT / "offshore-wind" / f"{item}.json", indicator_file(
            f"offshore-wind/{item}", "MW", years, out, license="CC BY 4.0", attribution="Global Energy Monitor, Global Integrated Power Tracker"))
        last = sorted(((v[-1], k) for k, v in out.items() if v[-1]), reverse=True)
        print(f"  離岸風電 {item} {LAST}：{len(last)} 國，合計 {sum(v for v, _ in last):,.0f} MW；{last[:10]}")


def _eia() -> None:
    raw = eia.annual(["35-7-MK", "117-7-MK"])
    for name, key in (("geothermal", "35-7-MK"), ("ocean", "117-7-MK")):
        series = raw[key]
        years = list(range(1980, max(y for s in series.values() for y in s) + 1))
        data = {}
        for region, s in series.items():
            iso3 = to_iso3(region)
            if iso3 and any(v > 0 for v in s.values()):
                data[iso3] = [round(s[y] * 1000, 2) if s.get(y) else None for y in years]
        write_json(OUT / f"{name}.json", indicator_file(name, "MW", years, data, latestWithin=1,
                                                       license="Public domain", attribution="U.S. Energy Information Administration"))
        i = years.index(2024)
        last = sorted(((v[i], k) for k, v in data.items() if v[i]), reverse=True)
        print(f"  {name} 2024：{len(last)} 國，合計 {sum(v for v, _ in last):,.1f} MW；{last[:10]}；台灣 {data.get('TWN', [None] * len(years))[i]}")


def build() -> None:
    _offshore()
    _eia()
