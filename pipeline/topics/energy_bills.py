"""電價與油價的擴充：電費與瓦斯費帳單的組成、能源的通膨（2026-11-07，製作手冊第二十七批 607，候選 1336、1368；
步驟 energy-bills，輸出 topics/energy-prices/）。

- Eurostat `nrg_pc_204_c`（家庭電價的組成，年用電 2,500–4,999 度）、`nrg_pc_202_c`（家庭天然氣的組成，年用量 20–199 GJ，
  單位用每度 KWH），歐元。總價＝能源與供應（NRG_SUP）＋網路（NETC）＋稅費（TAX_FEE_LEV_CHRG，不含加值稅；可以是負的，
  例如荷蘭的退稅）＋加值稅（VAT）。英國照網站的規則不收（`sources.eurostat` 已經排除）。
  - 指標：稅（稅費＋加值稅）占帳單的 %，子項目電與天然氣，2017–2025。
  - 側欄：最近一年的四個組成（歐元/度）。
- OECD 消費者物價指數的能源類（`DF_PRICES_C2018_N_CP045_0722`，COICOP 2018 的 04.5 家用能源＋07.2.2 車用燃料），
  年增率（TRANSFORMATION=GY）、年資料。各國用 OECD 的國家代碼，EA、EU27_2020、OECD 是合計（不畫在地圖上）。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat, oecd

OUT = OUT_DIR / "topics" / "energy-prices"
PARTS = ["NRG_SUP", "NETC", "TAX_FEE_LEV_CHRG", "VAT"]
ITEMS = {
    "electricity": ("nrg_pc_204_c", {"nrg_cons": "KWH2500-4999", "currency": "EUR"}),
    "gas": ("nrg_pc_202_c", {"nrg_cons": "GJ20-199", "currency": "EUR", "unit": "KWH"}),
}
INFLATION = "OECD.SDD.TPS,DSD_PRICES_COICOP2018@DF_PRICES_C2018_N_CP045_0722,"


def build() -> None:
    detail: dict = {"parts": PARTS, "countries": {}}
    for item, (ds, filters) in ITEMS.items():
        comp = {p: eurostat.series(ds, freq="A", nrg_prc=p, **filters) for p in PARTS}
        countries = sorted(set.intersection(*(set(v) for v in comp.values())))
        years = sorted({y for v in comp["NRG_SUP"].values() for y in v})
        share: dict[str, list[float | None]] = {}
        for c in countries:
            row = []
            for y in years:
                vals = [comp[p].get(c, {}).get(y) for p in PARTS]
                total = sum(v for v in vals if v is not None) if all(v is not None for v in vals) else None
                row.append(round((vals[2] + vals[3]) / total * 100, 3) if total and total > 0 else None)
            if any(v is not None for v in row):
                share[c] = row
            last = max((y for y in years if all(comp[p].get(c, {}).get(y) is not None for p in PARTS)), default=None)
            if last:
                detail["countries"].setdefault(c, {})[item] = [last] + [round(comp[p][c][last], 4) for p in PARTS]
        write_json(OUT / "bill-tax-share" / f"{item}.json", indicator_file(
            f"bill-tax-share/{item}", "%", years, share, latestWithin=3, license="CC BY 4.0"))
        y = years[-1]
        rank = sorted(((c, s[-1]) for c, s in share.items() if s[-1] is not None), key=lambda x: -x[1])
        print(f"  {item} {y} 稅的比例（{len(rank)} 國）：" + "、".join(f"{c} {v:.1f}%" for c, v in rank[:8]) + " … " + "、".join(f"{c} {v:.1f}%" for c, v in rank[-5:]))
        for c in ("DEU", "DNK", "FRA", "NLD", "HUN"):
            d = detail["countries"].get(c, {}).get(item)
            print(f"    {c} {d}（總價 {sum(d[1:]):.4f}）" if d else f"    {c} 沒有")
    write_json(OUT / "bill-detail.json", detail)

    countries, groups = oecd.series(INFLATION, "all", FREQ="A", TRANSFORMATION="GY")
    years = sorted({y for v in countries.values() for y in v})
    write_json(OUT / "energy-inflation.json", indicator_file(
        "energy-inflation", "%", years, {c: [round(v[y], 3) if y in v else None for y in years] for c, v in sorted(countries.items())},
        aggregates={k: [round(v[y], 3) if y in v else None for y in years] for k, v in groups.items() if k in ("OECD", "EU27_2020")},
        license="CC BY 4.0"))
    for y in (2021, 2022, 2023, 2024, 2025):
        r = sorted(((c, v[y]) for c, v in countries.items() if y in v), key=lambda x: -x[1])
        print(f"  能源通膨 {y}（{len(r)} 國）：" + "、".join(f"{c} {v:.1f}%" for c, v in r[:6]) + " … " + "、".join(f"{c} {v:.1f}%" for c, v in r[-3:])
              + f"；OECD {groups.get('OECD', {}).get(y)}、EU27 {groups.get('EU27_2020', {}).get(y)}")
    print(f"  年份 {years[0]}–{years[-1]}，{len(countries)} 國；日本 2022 {countries.get('JPN', {}).get(2022)}")
