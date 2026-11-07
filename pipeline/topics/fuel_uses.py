"""石油、天然氣與煤的擴充：天然氣燒去哪裡、石油煉出來做什麼、非能源用途（2026-11-07，製作手冊第二十七批 615，
候選 1345、1346、1347；步驟 fuel-uses，輸出 topics/fossil-fuels/）。

- **天然氣的用途**：UNSD Energy Balance（UNdata 條款），商品 B04_NG，1990–2023，TJ。跟 coal_types.py 的煤一樣，分母是
  全部用途（轉換投入 B10_08 的絕對值＋最終消費 B24_NA），用途：電廠與汽電共生 B11_088（手冊的陷阱：不能只用 B11_08811）、
  工業 B26_121（製造、營建、非燃料採礦）、家戶 B50_1231、運輸 B40_122、非能源用 B52_11（化肥、化工原料），其餘「其他」
  （商業服務、液化、煉油廠自用等）。全部用途至少 10 PJ 的國家才畫。
- **成品油的消費組成**：EIA International Energy Statistics（公有領域，INTL.zip 已快取），活動 2（消費）、千桶/日：
  62 汽油、63 航空燃油、64 煤油、65 柴餾油（柴油與取暖油）、66 燃料油、67 液化石油氣；占六種合計的 %（體積，各種油的熱值不同），
  六種合計至少 10 千桶/日。EIA 的區域合計不算。
- **非能源用途占總供給**：UNSD 商品 B09_TE（全部能源）的 B52_11 ÷ B07_GA（總供給）。總供給至少 10 PJ。
"""
from __future__ import annotations

import csv
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources import eia
from sources.countries import from_numeric, to_iso3

OUT = OUT_DIR / "topics" / "fossil-fuels"
GAS_USES = {"power": "B11_088", "industry": "B26_121", "households": "B50_1231", "transport": "B40_122", "non-energy": "B52_11"}
GAS_KEY = ".B04_NG.B10_08+B24_NA+" + "+".join(GAS_USES.values()) + ".HSO"
NE_KEY = ".B09_TE.B52_11+B07_GA.HSO"
BASE = "https://data.un.org/legacy/ws/rest/data/UNSD,DF_UNData_EnergyBalance,1.0/{key}?startPeriod=1990&format=csv"
AREA = {"251": "FRA", "382": "ITA", "579": "NOR", "757": "CHE"}
MIN_TJ = 10000
PRODUCTS = {"gasoline": "62", "jet": "63", "kerosene": "64", "diesel": "65", "fuel-oil": "66", "lpg": "67"}
MIN_KBD = 10
UNDATA = {"license": "UNdata terms of use (free to copy and redistribute with citation)", "attribution": "UNdata, UN Statistics Division Energy Balances"}


def _unsd(key: str, name: str) -> tuple[dict[tuple[str, int], dict[str, float]], list[int]]:
    v: dict[tuple[str, int], dict[str, float]] = defaultdict(dict)
    with open(download(BASE.format(key=key), "unsd", name), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["UNIT_MULT"] != "0":
                raise RuntimeError(f"UNSD 的 UNIT_MULT 不是 0：{r}")
            c = AREA.get(r["REF_AREA"]) or from_numeric(r["REF_AREA"])
            if c:
                v[(c, int(r["TIME_PERIOD"]))][r["TRANSACTION"]] = abs(float(r["OBS_VALUE"]))
    return v, sorted({y for _, y in v})


def _gas() -> None:
    v, years = _unsd(GAS_KEY, "energy-balance-gas-uses-1990.csv")
    countries = sorted({c for c, _ in v})
    shares: dict[str, dict[str, list]] = {k: {} for k in [*GAS_USES, "other"]}
    for c in countries:
        rows = {k: [] for k in shares}
        for y in years:
            t = v.get((c, y), {})
            total = t.get("B10_08", 0) + t.get("B24_NA", 0)
            ok = total >= MIN_TJ
            parts = {k: t.get(code, 0) for k, code in GAS_USES.items()}
            for k in GAS_USES:
                rows[k].append(round(parts[k] / total * 100, 3) if ok else None)
            rows["other"].append(round(max(0.0, total - sum(parts.values())) / total * 100, 3) if ok else None)
        for k in shares:
            if any(x is not None for x in rows[k]):
                shares[k][c] = rows[k]
    for k, vals in shares.items():
        write_json(OUT / "gas-use" / f"{k}.json", indicator_file(f"gas-use/{k}", "%", years, vals, latestWithin=3, **UNDATA))
    y = years[-1]
    for c in ("JPN", "SAU", "KOR", "RUS", "USA", "DEU", "GBR", "UKR", "CHN", "IND", "IDN", "ZAF", "TTO"):
        t = v.get((c, y), {})
        total = t.get("B10_08", 0) + t.get("B24_NA", 0)
        if total:
            print(f"    天然氣 {c} {y} {total:,.0f} TJ：" + "、".join(f"{k} {t.get(code, 0) / total:.0%}" for k, code in GAS_USES.items()))
    print(f"  天然氣的用途：{years[0]}–{years[-1]}，{len(shares['power'])} 國")


def _non_energy() -> None:
    v, years = _unsd(NE_KEY, "energy-balance-non-energy-1990.csv")
    vals = {}
    for c in sorted({c for c, _ in v}):
        row = []
        for y in years:
            t = v.get((c, y), {})
            row.append(round(t.get("B52_11", 0) / t["B07_GA"] * 100, 3) if t.get("B07_GA", 0) >= MIN_TJ else None)
        if any(x is not None for x in row):
            vals[c] = row
    write_json(OUT / "non-energy-share.json", indicator_file("non-energy-share", "%", years, vals, latestWithin=3, **UNDATA))
    y = years[-1]
    r = sorted(((c, s[-1]) for c, s in vals.items() if s[-1] is not None), key=lambda x: -x[1])
    print(f"  非能源用占總供給 {y}（{len(r)} 國）：" + "、".join(f"{c} {x:.1f}%" for c, x in r[:10]))
    print("    " + "、".join(f"{c} {vals[c][-1]:.1f}%" for c in ("RUS", "CHN", "USA", "DEU", "JPN", "IND", "KOR", "SAU") if c in vals and vals[c][-1] is not None))


def _oil_products() -> None:
    data = eia.annual([f"{code}-2-TBPD" for code in PRODUCTS.values()])
    by = {k: data[f"{code}-2-TBPD"] for k, code in PRODUCTS.items()}
    regions = {r for v in by.values() for r in v if len(r) == 3 and to_iso3(r)}
    years = sorted({y for v in by.values() for s in v.values() for y in s if y >= 1980})
    totals = {r: {y: sum(by[k].get(r, {}).get(y, 0) for k in PRODUCTS) for y in years} for r in regions}
    for k in PRODUCTS:
        vals = {}
        for r in sorted(regions):
            row = [round(by[k].get(r, {}).get(y, 0) / totals[r][y] * 100, 3) if totals[r][y] >= MIN_KBD else None for y in years]
            if any(x is not None for x in row):
                vals[to_iso3(r)] = row
        write_json(OUT / "oil-products" / f"{k}.json", indicator_file(f"oil-products/{k}", "%", years, vals, latestWithin=3, license="Public domain (EIA)"))
    y = 2024 if 2024 in years else years[-1]
    for c in ("USA", "CHN", "IND", "DEU", "BRA", "NGA", "SAU", "JPN", "TWN"):
        t = totals.get(c, {}).get(y)
        if t:
            print(f"    成品油 {c} {y} {t:,.0f} 千桶/日：" + "、".join(f"{k} {by[k].get(c, {}).get(y, 0) / t:.0%}" for k in PRODUCTS))


def build() -> None:
    _gas()
    _non_energy()
    _oil_products()
