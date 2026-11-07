"""幸福感的擴充：對別人信不信任、有沒有人可以依靠（2026-11-07，製作手冊第二十七批 561，候選 1266、1267；
步驟 happiness-eu，輸出 topics/happiness/）。

- Eurostat `ilc_pw03`：「一般來說你信得過別人嗎」0–10 分的平均（statinfo AVG、unit RTG、domain OTH），16 歲以上、
  兩性、各教育程度合計；2013、2018、2021–2025 年（EU-SILC 的福祉模組與之後的年度題）。
- Eurostat `ilc_pw06`：「需要幫忙時有人可以依靠」的比例（%），2013、2018、2022 年。2015 年以前的 ilc_scp16、ilc_scp18
  問的是不同的題目，不接（手冊的陷阱）。
- CC BY 4.0；英國、科索沃由 sources/eurostat.py 統一排除。台灣沒有（Eurostat 只有歐洲；台灣社會變遷基本調查的微資料要
  申請帳號，公開的是百分比、不是 0–10 平均），noValue 寫明。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "happiness"
TAIWAN = ("Eurostat 只有歐洲；台灣社會變遷基本調查的信任題公開的是百分比、不是 0–10 分，對不起來",
          "Eurostat covers Europe only; Taiwan’s Social Change Survey publishes trust as percentages, not a 0–10 score")


def build() -> None:
    trust = eurostat.series("ilc_pw03", statinfo="AVG", unit="RTG", isced11="TOTAL", domain="OTH", sex="T", age="Y_GE16")
    rely = eurostat.series("ilc_pw06", unit="PC", isced11="TOTAL", sex="T", age="Y_GE16")
    for key, data in (("trust-others", trust), ("someone-to-rely-on", rely)):
        years = sorted({y for s in data.values() for y in s})
        unit = "0–10" if key == "trust-others" else "%"
        write_json(OUT / f"{key}.json", indicator_file(
            key, unit, years, {c: [s.get(y) for y in years] for c, s in sorted(data.items())},
            noValue={"TWN": TAIWAN[0]}, noValueEn={"TWN": TAIWAN[1]}, license="CC BY 4.0"))
        last = years[-1]
        top = sorted(((s[last], c) for c, s in data.items() if last in s), reverse=True)
        print(f"  {key}：{years}；{last} 年 {len(top)} 國 {top[:8]} … {top[-8:]}")
        if key == "trust-others":
            print(f"    2013：{sorted(((s[2013], c) for c, s in data.items() if 2013 in s), reverse=True)[:5]}")
