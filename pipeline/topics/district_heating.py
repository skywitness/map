"""區域供熱：管線長度、用戶與送出多少熱（新主題，2026-11-07，製作手冊第二十七批 611，候選 1341；步驟 district-heating，
輸出 topics/district-heating/）。

- Eurostat（CC BY 4.0，2016–2024；英國不在這幾個表裡，科索沃照網站的規則不收）：
  - `nrg_dhdc_n`：網路數（NR）與管線長度（KM）；
  - `nrg_dhdc_c`：用戶數（各國的定義不同，有的算建築、有的算住戶）；
  - `nrg_dhdc_e`：送出的熱（TJ），依用戶（住宅與服務業 RES_SERV、工業 IND、其他 OTH、合計 TOTAL）。
  區域供熱是 network=DHEAT（熱水＋蒸汽，不含區域供冷 DCL），lev_efcy 的「高效率」與「其他」兩類相加。
- 指標：每人送出的熱（GJ，人口用 WPP）、管線長度（比例圓）。側欄：最近一年的網路數、長度、用戶數與熱依用戶。
- 手冊的陷阱：很多國家有些年份沒有申報（沒有申報不等於沒有），各國用 3 年內最近的一年。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat, wpp

OUT = OUT_DIR / "topics" / "district-heating"
LEVELS = ["HIGH", "LOW"]


def _sum(ds: str, **filters: str) -> dict[str, dict[int, float]]:
    out: dict[str, dict[int, float]] = defaultdict(dict)
    parts = [eurostat.series(ds, freq="A", lev_efcy=lv, network="DHEAT", **filters) for lv in LEVELS]
    for c in set().union(*parts):
        years = set().union(*(p.get(c, {}).keys() for p in parts))
        for y in years:
            vals = [p.get(c, {}).get(y) for p in parts]
            total = sum(v for v in vals if v is not None)
            if total > 0:  # 0 多半是沒有申報或保密（丹麥的長度、瑞典的網路數都是 0），當成沒有資料
                out[c][y] = total
    return out


def build() -> None:
    length = _sum("nrg_dhdc_n", unit="KM")
    networks = _sum("nrg_dhdc_n", unit="NR")
    customers = _sum("nrg_dhdc_c", unit="NR")
    heat = {cu: _sum("nrg_dhdc_e", unit="TJ", customer=cu) for cu in ("TOTAL", "RES_SERV", "IND", "OTH")}
    years = sorted({y for v in length.values() for y in v} | {y for v in heat["TOTAL"].values() for y in v})
    pop = wpp.demographic(["TPopulation1July"], last_year=years[-1])["TPopulation1July"]
    per_cap = {}
    for c, by in heat["TOTAL"].items():
        row = [round(by[y] * 1000 / (pop[c][y] * 1000), 4) if by.get(y) and pop.get(c, {}).get(y) else None for y in years]
        if any(row):
            per_cap[c] = row
    write_json(OUT / "heat-per-capita.json", indicator_file("dh-heat-per-capita", "GJ", years, dict(sorted(per_cap.items())), latestWithin=3, license="CC BY 4.0"))
    write_json(OUT / "length.json", indicator_file(
        "dh-length", "公里", years, {c: [round(v[y], 1) if v.get(y) else None for y in years] for c, v in sorted(length.items()) if any(v.values())},
        latestWithin=3, license="CC BY 4.0"))
    detail = {}
    for c in sorted(set(length) | set(heat["TOTAL"]) | set(customers)):
        ys = [y for y in years if heat["TOTAL"].get(c, {}).get(y) or length.get(c, {}).get(y)]
        if not ys:
            continue
        y = ys[-1]
        detail[c] = {"year": y, "networks": networks.get(c, {}).get(y), "km": length.get(c, {}).get(y), "customers": customers.get(c, {}).get(y),
                     "heat": [heat[k].get(c, {}).get(y) for k in ("RES_SERV", "IND", "OTH")]}
    write_json(OUT / "detail.json", {"countries": detail})
    y = years[-1]
    r = sorted(((c, v[-1]) for c, v in per_cap.items() if v[-1]), key=lambda x: -x[1])
    print(f"  每人送出的熱 {y}（{len(r)} 國）：" + "、".join(f"{c} {v:.1f}" for c, v in r))
    r = sorted(((c, v.get(y)) for c, v in length.items() if v.get(y)), key=lambda x: -x[1])
    print(f"  管線長度 {y}（{len(r)} 國）：" + "、".join(f"{c} {v:,.0f}" for c, v in r[:10]))
    for c in ("ROU", "FRA", "AUT", "ITA", "LVA", "BGR", "DNK", "SWE", "FIN", "POL", "DEU"):
        print(f"    {c} {detail.get(c)}")
