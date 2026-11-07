"""社會保障覆蓋率（新主題，2026-11-07，製作手冊第二十五批 450，候選 1092；步驟 social-protection，
輸出 topics/social-protection/）。

- ILOSTAT SDG 1.3.1（DF_SDG_0131_SEX_SOC_RT，sources/ilostat.py，CC BY 4.0）：受社會保障給付覆蓋的比例，SOC 維度 9 項
  （ITEMS）。各國回報的年份差很多（多數 2019–2023，2024 年以後只有幾國），前端用 5 年內最近一年（latestWithin）。
  台灣在這個資料集裡（2023 年 8 項；SOC_CONTIG_POOR 沒有台灣）。生育給付（SOC_CONTIG_MAT）的值在 SEX_F（生產的母親），
  男女合計只有 8 國，用女性那一列。
- 「至少一項」的分母是全人口，各項的分母是那一種風險的人口（老年年金是法定退休年齡以上的人、失業給付是失業者…），
  不能相加。100% 是制度上全面覆蓋，不代表給付夠用。
- 側欄（latest.json）：每一國每一項最近一次的值與年份，加上每一項各國最近值的中位數。
"""
from __future__ import annotations

import statistics

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import ilostat

OUT = OUT_DIR / "topics" / "social-protection"
DATASET = "SDG_0131_SEX_SOC_RT_A"
FIRST = 2009
WITHIN = 5
ITEMS = {"total": "SOC_CONTIG_TOTAL", "pension": "SOC_CONTIG_PENSION", "unemployment": "SOC_CONTIG_UNE",
         "children": "SOC_CONTIG_CHILD", "disability": "SOC_CONTIG_DISAB", "maternity": "SOC_CONTIG_MAT",
         "injury": "SOC_CONTIG_INJ", "poor": "SOC_CONTIG_POOR", "vulnerable": "SOC_CONTIG_VULN"}


def build() -> None:
    latest: dict[str, dict[str, list]] = {}
    medians = {}
    for key, code in ITEMS.items():
        # 生育給付只有女性（生產的母親）的值，男女合計只有 8 國
        countries, _ = ilostat.fetch_sexes(DATASET, classif=code)["SEX_F" if key == "maternity" else "SEX_T"]
        last = max(y for s in countries.values() for y in s)
        years = list(range(FIRST, last + 1))
        values = {c: to_series({y: v for y, v in s.items() if y >= FIRST}, years, 1) for c, s in sorted(countries.items())}
        write_json(OUT / "coverage" / f"{key}.json", indicator_file("coverage", "%", years, values, latestWithin=WITHIN,
                                                                    license="CC BY 4.0"), quiet=True)
        recent = {}
        for c, s in countries.items():
            y = max(s)
            if y >= last - 2 * WITHIN:
                recent[c] = (s[y], y)
                latest.setdefault(c, {})[key] = [round(s[y], 1), y]
        medians[key] = round(statistics.median(v for v, _ in recent.values()), 1)
        low = sorted((round(v, 1), c, y) for c, (v, y) in recent.items() if y >= 2019)
        print(f"  {key}：{len(countries)} 國（{FIRST} 年以後），2019 年以後 {len(low)} 國，中位數 {medians[key]}；"
              f"最低 {low[:6]}；最高 {low[-6:]}；台灣 {countries.get('TWN', {})}")
    write_json(OUT / "latest.json", {"items": list(ITEMS), "median": medians, "countries": latest})
    write_json(OUT / "manifest.json", {"topic": "social-protection", "generatedAt": now_iso(), "sources": ["ILOSTAT SDG 1.3.1"]})
