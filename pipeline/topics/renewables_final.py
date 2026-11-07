"""再生能源占最終能源消費（2026-11-07，製作手冊第二十五批 522，候選 1207；擴充「發電量」）。

- 全世界：World Bank WDI `EG.FEC.RNEW.ZS`（CC BY 4.0，原始來源 IEA Energy Statistics Data Browser，metadata 沒有非商業附註；
  來源欄同時寫 IEA），1990 年起，各國用自己最新的一年（latestWithin 3）。
- 歐洲：Eurostat `nrg_ind_ren`（CC BY 4.0；英國、科索沃照 sources/eurostat.py 的規則不收），2004 年起，
  子項目是整體（REN）、電力（REN_ELC）、暖氣與冷氣（REN_HEAT_CL）、運輸（REN_TRA）。RED 指令的算法：分子的水力與風力
  用常態化發電量、分母是國內毛最終消費，所以電力可能超過 100%（挪威）。
- 台灣：兩邊都沒有；能源署的能源指標只有「再生能源供給占初級能源總供給比例」，分母不同，不畫，寫在 noValue。
輸出 public/data/topics/electricity/{renewable-final,renewable-final-eu/{total,electricity,heating,transport}}.json。
"""

from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat, worldbank

OUT = OUT_DIR / "topics" / "electricity"
SECTORS = {"total": "REN", "electricity": "REN_ELC", "heating": "REN_HEAT_CL", "transport": "REN_TRA"}


def build() -> None:
    countries, world = worldbank.fetch("EG.FEC.RNEW.ZS")
    years = list(range(1990, max(y for s in countries.values() for y in s) + 1))
    data = {k: [round(s[y], 2) if y in s else None for y in years] for k, s in sorted(countries.items())}
    write_json(OUT / "renewable-final.json", indicator_file(
        "renewable-final", "%", years, data, latestWithin=3, license="CC BY 4.0",
        attribution="World Bank, World Development Indicators (EG.FEC.RNEW.ZS); IEA Energy Statistics Data Browser",
        aggregates={"WLD": [round(world[y], 2) if y in world else None for y in years]}))
    last = years[-1]
    top = sorted(((s[last], k) for k, s in countries.items() if last in s), reverse=True)
    print(f"  WDI {years[0]}–{last}：{len(top)} 國有 {last}；高 {top[:8]}；低 {top[-6:]}；世界 {world.get(last)}")
    for item, code in SECTORS.items():
        s = eurostat.series("nrg_ind_ren", nrg_bal=code, unit="PC", freq="A")
        ys = list(range(2004, max(y for v in s.values() for y in v) + 1))
        write_json(OUT / "renewable-final-eu" / f"{item}.json", indicator_file(
            f"renewable-final-eu/{item}", "%", ys, {k: [round(v[y], 3) if y in v else None for y in ys] for k, v in sorted(s.items())},
            latestWithin=1, license="CC BY 4.0", attribution="Eurostat (nrg_ind_ren)"))
        y = ys[-1] if sum(1 for v in s.values() if ys[-1] in v) > 20 else ys[-2]
        top = sorted(((v[y], k) for k, v in s.items() if y in v), reverse=True)
        print(f"  Eurostat {item} {ys[0]}–{ys[-1]}（看 {y}）：{len(top)} 國；高 {top[:6]}；低 {top[-4:]}")
