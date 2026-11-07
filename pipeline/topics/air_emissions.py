"""七種空氣污染物的排放量（2026-11-07，製作手冊第二十五批 483，候選 1146；擴充「空氣品質」）。

CEDS v_2025_03_18（PNNL，Zenodo doi:10.5281/zenodo.15059443，CC BY 4.0）：sources/ceds.py 已經在抓的
CEDS_v_2025_03_18_aggregate.zip，多讀七種污染物（SO₂、NOx、NH₃、BC、OC、CO、NMVOC）的
<種類>_CEDS_estimates_by_country_v_2025_03_18.csv（國家總量）與 …_by_country_sector_…csv（33 個部門，算部門組成）。
CSV 第 0 欄是 em、第 1 欄 country（小寫 ISO alpha-3，「srb (kosovo)」是科索沃）；global 那一列（含國際航空、航運）不收；
部門 6B_Other-not-in-total 不算進合計。單位各不相同（kt SO₂、kt NO₂、kt NH₃、kt C、kt CO、kt NMVOC），換成公噸後
分開畫，不互加。CH₄、N₂O 不用（溫室氣體主題用 EDGAR，數字不同）。1970–2023 年。
人均用聯合國 WPP 2024 的年中人口（含台灣）。

輸出 public/data/topics/air-quality/：emissions/{item}.json（公噸）、emissions-pc/{item}.json（公斤/人）、
emissions-detail.json（側欄：最新一年的部門組成 %、最高的那一年與比高峰少了幾 %）。
"""

from __future__ import annotations

import csv
import io
import zipfile
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources import ceds, wpp
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "air-quality"
SPECIES = {"so2": "SO2", "nox": "NOx", "nh3": "NH3", "bc": "BC", "oc": "OC", "co": "CO", "nmvoc": "NMVOC"}
FIRST = 1970
PREFIX = "CEDS_v_2025_03_18_aggregate/{}_CEDS_estimates_by_country{}_v_2025_03_18.csv"
# 部門 → 側欄的大類（比對前綴，先比對長的）
GROUPS = [
    ("1A1a", "power"), ("1A1bc", "fuel"), ("1B", "fuel"), ("7A", "fuel"),
    ("1A2", "industry"), ("2", "industry"),
    ("1A3", "transport"),
    ("1A4a", "buildings"), ("1A4b", "buildings"),
    ("3", "agriculture"), ("5", "waste"),
    ("1A4c", "other"), ("1A5", "other"), ("6A", "other"), ("7BC", "other"),
]
GROUP_KEYS = ["power", "fuel", "industry", "transport", "buildings", "agriculture", "waste", "other"]


def _iso3(code: str) -> str | None:
    return "XKX" if code == "srb (kosovo)" else to_iso3(code)


def _group(sector: str) -> str | None:
    if sector.startswith("6B") or sector.startswith("1A3ai") or sector.startswith("1A3di"):
        return None  # 不算進合計；國際航空、航運只在 global
    for prefix, g in GROUPS:
        if sector.startswith(prefix):
            return g
    return None


def build() -> None:
    path = download(ceds.URL, "ceds", "CEDS_v_2025_03_18_aggregate.zip")
    totals: dict[str, dict[str, dict[int, float]]] = {}
    sectors: dict[str, dict[str, dict[str, float]]] = {}
    last = 0
    with zipfile.ZipFile(path) as z:
        for key, name in SPECIES.items():
            series: dict[str, dict[int, float]] = defaultdict(dict)
            with z.open(PREFIX.format(name, "")) as raw:
                for row in csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8", newline="")):
                    iso3 = _iso3(row["country"])
                    if not iso3:
                        continue
                    for col, value in row.items():
                        if col.startswith("X") and int(col[1:]) >= FIRST and value:
                            series[iso3][int(col[1:])] = float(value) * 1000  # 千公噸 → 公噸
            totals[key] = series
            last = max(last, max(y for s in series.values() for y in s))
            by: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
            with z.open(PREFIX.format(name, "_sector")) as raw:
                for row in csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8", newline="")):
                    iso3, g = _iso3(row["country"]), _group(row["sector"])
                    if iso3 and g and row.get(f"X{last}"):
                        by[iso3][g] += float(row[f"X{last}"])
            sectors[key] = by

    years = list(range(FIRST, last + 1))
    pop = wpp.demographic(["TPopulation1July"], last)["TPopulation1July"]  # 千人
    for key, series in totals.items():
        write_json(OUT / "emissions" / f"{key}.json", indicator_file(
            "emissions", "公噸", years, {k: [round(s[y]) if y in s else None for y in years] for k, s in series.items()},
            license="CC BY 4.0"))
        pc = {k: [round(s[y] / (pop[k][y] * 1000) * 1000, 2) if y in s and pop.get(k, {}).get(y) else None for y in years]
              for k, s in series.items() if k in pop}
        write_json(OUT / "emissions-pc" / f"{key}.json", indicator_file("emissions-pc", "公斤/人", years, pc,
                                                                        license="CC BY 4.0"))
    detail: dict[str, dict] = defaultdict(dict)
    for key, series in totals.items():
        for iso3, s in series.items():
            tot = sum(sectors[key].get(iso3, {}).values())
            peak = max(s, key=lambda y: s[y])
            detail[iso3][key] = {
                # 依 GROUP_KEYS 的順序，% 取整數（側欄只畫長條）
                "s": [round(sectors[key][iso3].get(g, 0) / tot * 100) for g in GROUP_KEYS] if tot > 0 else [],
                "p": peak, "c": round((s[last] / s[peak] - 1) * 100, 1) if s.get(peak) else None,
            }
    write_json(OUT / "emissions-detail.json", {"year": last, "groups": GROUP_KEYS, "countries": detail})
    tw = {k: round(totals[k]["TWN"][last] / 1000, 1) for k in SPECIES}
    print(f"  CEDS 七種污染物 {years[0]}–{last}；台灣 {last} 年（千公噸）{tw}")
