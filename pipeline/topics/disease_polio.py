"""疾病與死因：野生型小兒麻痺的病例數（2026-11-04，製作手冊第二十批 327）。

使用者 2026-11-04 決定只在 GHO／WIISE 的指標不用，所以只用 WHO 資料平臺（data.who.int，CC BY 4.0）的
「Number of cases of poliomyelitis caused by wild poliovirus (WPV)」（https://data.who.int/indicators/i/495C2F7/7B2BFA6 ，
整份 CSV `DATADOT/INDICATOR/7B2BFA6_ALL_LATEST.csv`，2016–2023 年、194 國，報 0 的國家也有一列）。
手冊想做的分型（野生型 vs 疫苗衍生型 cVDPV）只有 GPEI 有，GPEI 的條款只准研究或私人研究、轉載大部分要書面同意，不用；
WIISE 的 POL_CONFIRMED 不分型也不用。
"""
from __future__ import annotations

import csv

from common import OUT_DIR, download, indicator_file, to_series, write_json
from sources.countries import from_numeric

OUT = OUT_DIR / "topics" / "disease"
URL = "https://srhdpeuwpubsa.blob.core.windows.net/whdh/DATADOT/INDICATOR/7B2BFA6_ALL_LATEST.csv"


def build() -> None:
    with open(download(URL, "who-datadot", "7B2BFA6_ALL_LATEST.csv"), encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    countries: dict[str, dict[int, float]] = {}
    world: dict[int, float] = {}
    unmatched = set()
    for r in rows:
        if not r["COUNT_N"]:
            continue
        year, value = int(r["DIM_TIME"]), float(r["COUNT_N"])
        if r["DIM_GEO_CODE_TYPE"] == "GLOBAL":
            world[year] = value
        elif r["DIM_GEO_CODE_TYPE"] == "COUNTRY":
            iso3 = from_numeric(r["DIM_GEO_CODE_M49"])
            if not iso3:
                unmatched.add((r["DIM_GEO_CODE_M49"], r["GEO_NAME_SHORT"]))
                continue
            countries.setdefault(iso3, {})[year] = value
    if unmatched:
        raise RuntimeError(f"野生型小兒麻痺對不到的 M49 代碼：{sorted(unmatched)}")
    years = list(range(min(world), max(world) + 1))
    if any(abs(sum(s.get(y, 0) for s in countries.values()) - world[y]) > 0.5 for y in years):
        raise RuntimeError("各國的病例數加總跟世界值不同")
    write_json(OUT / "polio-wild.json", indicator_file(
        "polio-wild", "例", years, {c: to_series(s, years, 0) for c, s in sorted(countries.items())},
        aggregates={"WLD": to_series(world, years, 0)}))
    cases = {c: {y: int(v) for y, v in s.items() if v} for c, s in countries.items() if any(s.values())}
    print(f"  野生型小兒麻痺：{len(countries)} 國，{years[0]}–{years[-1]}；有病例的 {cases}；世界 {dict(sorted(world.items()))}")
