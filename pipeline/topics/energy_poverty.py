"""能源貧窮：付不出帳單、家裡不夠暖（2026-11-07，製作手冊第二十五批 525，候選 1201；新主題，能源・能源的使用與政策）。

Eurostat 的 EU-SILC（CC BY 4.0；資料集的 geo 含英國、科索沃，照 sources/eurostat.py 的規則不收），2003–2025：
- `sdg_07_60` 家裡冬天沒辦法保持足夠溫暖的人口比例（hhcomp TOTAL）；
- `ilc_mdes07` 過去一年欠繳水電瓦斯帳單的人口比例（hhcomp TOTAL）。
子項目是貧窮狀態（rskpovth）：全部 TOTAL、所得在中位數 60% 以下 B_60、以上 A_60。「不夠暖」是問卷的自評。
台灣沒有官方的能源貧窮統計，寫在 noValue。
輸出 public/data/topics/energy-poverty/{cold-home,arrears}/{all,poor,non-poor}.json。
"""

from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "energy-poverty"
GROUPS = {"all": "TOTAL", "poor": "B_60", "non-poor": "A_60"}
SETS = {"cold-home": "sdg_07_60", "arrears": "ilc_mdes07"}
EXTRA = {"license": "CC BY 4.0", "attribution": "Eurostat, EU-SILC (sdg_07_60, ilc_mdes07)"}


def build() -> None:
    years = list(range(2003, 2026))
    for name, ds in SETS.items():
        for item, code in GROUPS.items():
            s = eurostat.series(ds, hhcomp="TOTAL", rskpovth=code, unit="PC", freq="A")
            data = {k: [round(v[y], 1) if y in v else None for y in years] for k, v in sorted(s.items())}
            write_json(OUT / name / f"{item}.json", indicator_file(f"{name}/{item}", "%", years, data, latestWithin=1, **EXTRA))
            if item == "all":
                for y in (2024, 2025):
                    top = sorted(((v[y], k) for k, v in s.items() if y in v), reverse=True)
                    print(f"  {name} {y}：{len(top)} 國；高 {top[:6]}；低 {top[-4:]}")
                print(f"    2021→2022→2023 {[(k, [s[k].get(y) for y in (2021, 2022, 2023)]) for k in ('DEU', 'FRA', 'ESP', 'ITA', 'GRC') if k in s]}")
            else:
                print(f"  {name} {item} 2024 希臘 {s.get('GRC', {}).get(2024)}、保加利亞 {s.get('BGR', {}).get(2024)}")
