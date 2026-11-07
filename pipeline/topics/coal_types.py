"""石油、天然氣與煤的擴充：煤的品種、煤燒去哪裡（2026-11-07，製作手冊第二十七批 614，候選 1343、1344；步驟 coal-types，
輸出 topics/fossil-fuels/）。

- **煤的品種**：EIA International Energy Statistics（公有領域，`sources/eia.py` 已經快取的 INTL.zip），產品 11 無煙煤、
  12 煙煤、119 次煙煤、14 褐煤，活動 1 產量、2 消費量，單位固定用 MTOE（百萬公噸油當量，手冊的陷阱：各品種熱值不同，
  用重量不能相加）。指標：各品種占煤產量、消費量的 %，四種合計至少 0.5 MTOE 的國家；EIA 的區域合計（代碼不是三個字母或
  含「+」）不算。
- **煤燒去哪裡**：UNSD Energy Balance（UNdata 條款：可自由複製轉載，要註明來源），商品 B00_CL（原煤與泥炭；焦炭、煤球這些
  煤製品 B01_CP 是同一批煤轉換來的，不重複算），1990–2023，TJ。手冊的陷阱：電廠要用 B11_088（電力、熱與汽電共生廠），
  不能只用 B11_08811（只有主要事業電廠）。分母是煤的全部用途：轉換投入（B10_08，負值取絕對值）＋最終消費（B24_NA），
  用途是電熱廠、焦爐（B14_081）、鋼鐵（B27_1211）、非金屬礦物（B30_1214b，水泥等）、家戶（B50_1231），其餘歸「其他」。
  煤的全部用途至少 10 PJ（10,000 TJ）的國家才畫。台灣：UNSD 沒有，EIA 的品種有（產量是 0）。
"""
from __future__ import annotations

import csv
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources import eia
from sources.countries import from_numeric, to_iso3

OUT = OUT_DIR / "topics" / "fossil-fuels"
RANKS = {"anthracite": "11", "bituminous": "12", "subbituminous": "119", "lignite": "14"}
MIN_MTOE = 0.5
USES = {"power": "B11_088", "coke": "B14_081", "steel": "B27_1211", "cement": "B30_1214b", "households": "B50_1231"}
KEY = ".B00_CL.B10_08+B24_NA+" + "+".join(USES.values()) + ".HSO"
URL = f"https://data.un.org/legacy/ws/rest/data/UNSD,DF_UNData_EnergyBalance,1.0/{KEY}?startPeriod=1990&format=csv"
AREA = {"251": "FRA", "382": "ITA", "579": "NOR", "757": "CHE"}
MIN_TJ = 10000
UNDATA = {"license": "UNdata terms of use (free to copy and redistribute with citation)", "attribution": "UNdata, UN Statistics Division Energy Balances"}


def _ranks() -> None:
    wanted = [f"{code}-{act}-MTOE" for code in RANKS.values() for act in ("1", "2")]
    data = eia.annual(wanted)
    for act, name in (("1", "coal-rank-production"), ("2", "coal-rank-consumption")):
        by: dict[str, dict[str, dict[int, float]]] = {k: data[f"{code}-{act}-MTOE"] for k, code in RANKS.items()}
        regions = {r for v in by.values() for r in v if len(r) == 3 and "+" not in r and to_iso3(r)}
        years = sorted({y for v in by.values() for s in v.values() for y in s if y >= 1980})
        totals = {r: {y: sum(by[k].get(r, {}).get(y, 0) for k in RANKS) for y in years} for r in regions}
        for k in RANKS:
            vals = {}
            for r in sorted(regions):
                row = [round(by[k].get(r, {}).get(y, 0) / totals[r][y] * 100, 3) if totals[r][y] >= MIN_MTOE else None for y in years]
                if any(v is not None for v in row):
                    vals[to_iso3(r)] = row
            write_json(OUT / name / f"{k}.json", indicator_file(f"{name}/{k}", "%", years, vals, latestWithin=3, license="Public domain (EIA)"))
        y = 2024 if 2024 in years else years[-1]
        world = {k: sum(by[k].get(r, {}).get(y, 0) for r in regions) for k in RANKS}
        tot = sum(world.values())
        print(f"  {name} {y}：世界 {tot:,.0f} MTOE，" + "、".join(f"{k} {v / tot:.0%}" for k, v in world.items()))
        for c in ("CHN", "IND", "IDN", "USA", "RUS", "DEU", "GRC", "TUR", "VNM", "TWN", "AUS", "POL"):
            t = totals.get(c, {}).get(y)
            if t:
                print(f"    {c} {t:.1f}：" + "、".join(f"{k} {by[k].get(c, {}).get(y, 0) / t:.0%}" for k in RANKS))


def _uses() -> None:
    v: dict[tuple[str, int], dict[str, float]] = defaultdict(dict)
    with open(download(URL, "unsd", "energy-balance-coal-uses-1990.csv"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["UNIT_MULT"] != "0":
                raise RuntimeError(f"UNSD 的 UNIT_MULT 不是 0：{r}")
            c = AREA.get(r["REF_AREA"]) or from_numeric(r["REF_AREA"])
            if c:
                v[(c, int(r["TIME_PERIOD"]))][r["TRANSACTION"]] = abs(float(r["OBS_VALUE"]))
    years = sorted({y for _, y in v})
    countries = sorted({c for c, _ in v})
    shares: dict[str, dict[str, list]] = {k: {} for k in [*USES, "other"]}
    for c in countries:
        rows = {k: [] for k in shares}
        for y in years:
            t = v.get((c, y), {})
            total = t.get("B10_08", 0) + t.get("B24_NA", 0)
            parts = {k: t.get(code, 0) for k, code in USES.items()}
            ok = total >= MIN_TJ
            for k in USES:
                rows[k].append(round(parts[k] / total * 100, 3) if ok else None)
            rows["other"].append(round(max(0.0, total - sum(parts.values())) / total * 100, 3) if ok else None)
        for k in shares:
            if any(x is not None for x in rows[k]):
                shares[k][c] = rows[k]
    for k, vals in shares.items():
        write_json(OUT / "coal-use" / f"{k}.json", indicator_file(f"coal-use/{k}", "%", years, vals, latestWithin=3, **UNDATA))
    y = years[-1]
    for c in ("CHN", "IND", "USA", "ZAF", "VNM", "JPN", "RUS", "KOR", "NLD", "GBR", "POL", "IRN", "DEU"):
        t = v.get((c, y), {})
        total = t.get("B10_08", 0) + t.get("B24_NA", 0)
        if total:
            print(f"    {c} {y} {total:,.0f} TJ：" + "、".join(f"{k} {t.get(code, 0) / total:.0%}" for k, code in USES.items()))
    print(f"  煤的用途：{years[0]}–{years[-1]}，{len(shares['power'])} 國")


def build() -> None:
    _ranks()
    _uses()
