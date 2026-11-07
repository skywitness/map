"""人均收入：勞動報酬占 GDP（勞動份額）（2026-11-07，製作手冊第二十五批 448，候選 1088；步驟 income-labour-share，
輸出 topics/income/labour-share.json）。

- ILOSTAT SDG 10.4.1（DF_SDG_1041_NOC_RT，sources/ilostat.py，CC BY 4.0）：勞動報酬（含自僱者的勞動所得推估）占 GDP，
  2004–2026 年；**全部是 ILO 的模型估計**，2025 年起是推估（projectionFrom）。台灣在這個資料集裡（REF_AREA=TWN）。
- 奈及利亞 75% 這類極端值是非正式就業比例高、自僱所得多半算成勞動報酬，說明寫明。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import ilostat

OUT = OUT_DIR / "topics" / "income"
DATASET = "SDG_1041_NOC_RT_A"
FIRST = 2004
PROJECTION_FROM = 2025


def build() -> None:
    countries, world = ilostat.fetch(DATASET)
    last = max(y for s in countries.values() for y in s)
    years = list(range(FIRST, last + 1))
    values = {c: to_series(s, years, 1) for c, s in sorted(countries.items())}
    write_json(OUT / "labour-share.json", indicator_file(
        "labour-share", "%", years, values, projectionFrom=PROJECTION_FROM,
        aggregates={"WLD": to_series(world, years, 1)}, license="CC BY 4.0"))
    y = PROJECTION_FROM - 1
    top = sorted(((round(s[y], 1), c) for c, s in countries.items() if y in s), reverse=True)
    print(f"  勞動份額 {y}：{len(top)} 國，世界 {world.get(y)}；最高 {top[:8]}；最低 {top[-8:]}")
    print(f"    台灣 {[(yy, round(countries['TWN'][yy], 1)) for yy in (2004, 2014, 2022, 2023, 2024, 2025)]}")
    print(f"    {[(c, round(countries[c][y], 1)) for c in ('DEU', 'FRA', 'USA', 'JPN', 'KOR', 'CHN', 'IND', 'SGP', 'HKG')]}")
