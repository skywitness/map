"""發電裝置容量（第二十五批 519，候選 1193）、輸配電損失率與容量因數（520，候選 1195、1209）；擴充「發電量」。

2026-11-07。
- 裝置容量：Ember Yearly Electricity Data 新檔（寬表）的 `Capacity (GW)` 欄（CC BY 4.0；「發電量」主題本來就下載這個檔），
  2000–2025（手冊寫 1985 起是發電量欄，容量欄從 2000 年起）。子項目：合計（Total generation 的容量）與 8 種能源。年底值。
- 容量因數：發電量 × 1000 ÷（平均容量 × 8760），平均容量用前一年年底與當年年底的平均（Capacity 是年底值、Generation 是全年值，
  直接除會爆：台灣核能 2024 年會算出 146%）；容量一年變動超過 ±20% 的不畫，平均容量至少 1 GW；太陽能超過 35%、風力超過 60%
  的也不畫（容量沒申報，例如巴基斯坦的屋頂太陽能）。
  能源：太陽能、風力、核能、燃煤、燃氣、水力。
- 輸配電損失率：EIA International Energy Statistics（INTL.zip，美國公有領域；「石油、天然氣與煤」已在用）的
  INTL.2-9-<地區>-BKWH（輸配電損失）÷ INTL.2-12-<地區>-BKWH（淨發電量），1980–2024；淨發電量 10 TWh 以上才畫（小島國分母不穩）。
  損失含竊電（印度、巴西的高值一半是偷電）。
輸出 public/data/topics/electricity/{capacity/<能源>,capacity-factor/<能源>,grid-losses}.json。
"""

from __future__ import annotations

import csv
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources import eia
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "electricity"
URL = "https://files.ember-energy.org/public-downloads/generation/outputs/release_generation_yearly_global.csv"
SOURCES = {"Total generation": "total", "Coal": "coal", "Gas": "gas", "Other fossil": "other-fossil", "Nuclear": "nuclear",
           "Hydro": "hydro", "Wind": "wind", "Solar": "solar", "Bioenergy": "bioenergy"}
CF = ["solar", "wind", "nuclear", "coal", "gas", "hydro"]
# 物理上不可能的上限（超過的是容量沒申報，例如巴基斯坦的屋頂太陽能）
CF_MAX = {"solar": 35, "wind": 60}
FIRST, LAST = 2000, 2025
EMBER = {"license": "CC BY 4.0", "attribution": "Ember, Yearly Electricity Data"}


def _ember() -> tuple[dict, dict]:
    cap: dict[str, dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    gen: dict[str, dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    path = download(URL, "ember", "release_generation_yearly_global.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row["Area type"] != "Country or economy" or row["Electricity source"] not in SOURCES:
                continue
            iso3 = to_iso3(row["ISO 3 code"])
            if not iso3:
                continue
            item, y = SOURCES[row["Electricity source"]], int(row["Year"])
            if row["Capacity (GW)"] not in ("", None):
                cap[item][iso3][y] = float(row["Capacity (GW)"])
            if row["Generation (TWh)"] not in ("", None):
                gen[item][iso3][y] = float(row["Generation (TWh)"])
    return cap, gen


def build() -> None:
    cap, gen = _ember()
    years = list(range(FIRST, LAST + 1))
    for item in SOURCES.values():
        data = {k: [round(s[y], 3) if y in s else None for y in years] for k, s in sorted(cap[item].items()) if any(y in s for y in years)}
        write_json(OUT / "capacity" / f"{item}.json", indicator_file(f"capacity/{item}", "GW", years, data, latestWithin=1, **EMBER))
    tw = {k: cap[k]["TWN"].get(2024) for k in SOURCES.values()}
    print(f"  裝置容量：合計 {len(cap['total'])} 國；台灣 2024 {tw}")

    cf_years = list(range(FIRST + 1, LAST + 1))
    for item in CF:
        data = {}
        for iso3, c in cap[item].items():
            g = gen[item].get(iso3, {})
            vals = []
            for y in cf_years:
                if y in c and y - 1 in c and y in g:
                    avg = (c[y] + c[y - 1]) / 2
                    change = abs(c[y] - c[y - 1]) / c[y - 1] if c[y - 1] else 1
                    cf = g[y] * 1000 / (avg * 8760) * 100 if avg else 0
                    if avg >= 1 and change <= 0.2 and cf <= CF_MAX.get(item, 100):
                        vals.append(round(cf, 1))
                        continue
                vals.append(None)
            if any(v is not None for v in vals):
                data[iso3] = vals
        write_json(OUT / "capacity-factor" / f"{item}.json", indicator_file(f"capacity-factor/{item}", "%", cf_years, data, latestWithin=1, **EMBER))
        last = {k: v[cf_years.index(2024)] for k, v in data.items() if v[cf_years.index(2024)] is not None}
        top = sorted(last.items(), key=lambda kv: -kv[1])
        print(f"  容量因數 {item} 2024：{len(last)} 國，高 {top[:5]}，低 {top[-4:]}，台灣 {last.get('TWN')}")

    raw = eia.annual(["2-9-BKWH", "2-12-BKWH"])
    losses, net = raw["2-9-BKWH"], raw["2-12-BKWH"]
    l_years = list(range(1980, max(y for s in losses.values() for y in s) + 1))
    data = {}
    for region, s in losses.items():
        iso3 = to_iso3(region)
        if not iso3 or region not in net:
            continue
        vals = [round(s[y] / net[region][y] * 100, 2) if y in s and net[region].get(y, 0) >= 10 else None for y in l_years]
        if any(v is not None for v in vals):
            data[iso3] = vals
    write_json(OUT / "grid-losses.json", indicator_file("grid-losses", "%", l_years, data, latestWithin=1,
                                                         license="Public domain", attribution="U.S. Energy Information Administration"))
    i = l_years.index(2024)
    last = sorted(((v[i], k) for k, v in data.items() if v[i] is not None), reverse=True)
    print(f"  輸配電損失率 2024：{len(last)} 國，高 {last[:8]}，低 {last[-8:]}，台灣 {data.get('TWN', [None] * len(l_years))[i]}")
