"""1800 年起的長期資料：人口、人均 GDP（PPP，2021 年國際元）、平均壽命，各加在人口、人均收入、健康主題。

來源是 Gapminder fasttrack（sources/gapminder.py）。另立指標、不接在 WPP（1950 起）、IMF（1980 起）的指標前面：
接縫的數字有落差，人均 GDP 的單位也不同（DESIGN.md 第 8 節第 98 點）。

- 只取到最近的實際年份，Gapminder 之後到 2100 年的推估不收：
  人口依 WPP 2024 的估計到 2023 年；人均 GDP 1990–2024 年跟世界銀行相同，2025 年起是 IMF 的成長率推估；
  平均壽命到 2023 年（IHME GBD），之後是 UN 的推估。
- 1950 年以前多半是估計或內插（人口用 CLIO Infra、人均 GDP 用 Maddison Project 回推、壽命是 Gapminder 自己的估計），
  檔案寫 estimatesBefore: 1950，時間軸標「估計值」、側欄折線圖在 1950 年畫一條垂直虛線。
- 國界是今天的國家：1800 年的「德國」「印度」是今天的範圍回推。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import gapminder

FIRST_YEAR = 1800
ESTIMATES_BEFORE = 1950

# (主題, 輸出檔名, Gapminder 概念, 最後一個實際年份, 單位, 小數位數)
INDICATORS = [
    ("population", "total-1800", "pop", 2023, "人", 0),
    ("income", "gdp-per-capita-1800", "gdp_pcap", 2024, "國際元", 0),
    ("health", "life-expectancy-1800", "lex", 2023, "歲", 1),
]


def build() -> None:
    for topic, key, concept, last_year, unit, digits in INDICATORS:
        data, world = gapminder.fetch(concept)
        years = list(range(FIRST_YEAR, last_year + 1))
        values = {iso3: to_series(series, years, digits) for iso3, series in data.items()}
        values = {iso3: s for iso3, s in values.items() if any(v is not None for v in s)}
        write_json(
            OUT_DIR / "topics" / topic / f"{key}.json",
            indicator_file(
                key, unit, years, values,
                estimatesBefore=ESTIMATES_BEFORE,
                aggregates={"WLD": to_series(world, years, digits)},
            ),
        )
        print(f"  {key}：{len(values)} 個國家，{FIRST_YEAR}–{last_year}")
