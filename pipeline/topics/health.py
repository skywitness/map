"""健康主題：平均壽命、嬰兒與五歲以下死亡率、醫療支出、醫師數。

- 壽命與死亡率用 UN WPP 2024（各國同一套估計方法，含台灣），只取 2023 年以前的估計值。
- 醫療支出、醫師數用 World Bank WDI（WHO 全球醫療支出資料庫、全球衛生人力統計）；
  WDI 沒有台灣，台灣用衛生福利部的國民醫療保健支出與醫事人員統計。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import mohw, worldbank, wpp

# 輸出檔名 -> (WPP 欄位, 單位, 小數位數)
WPP_INDICATORS = {
    "life-expectancy": ("LEx", "歲", 2),
    "infant-mortality": ("IMR", "‰", 2),
    "under5-mortality": ("Q5", "‰", 2),
    # 側欄的男女對照，不在地圖指標裡
    "life-expectancy-female": ("LExFemale", "歲", 2),
    "life-expectancy-male": ("LExMale", "歲", 2),
}

# 聯合國對台灣的估計跟內政部的簡易生命表不同，嬰幼兒死亡率差最多
WPP_TAIWAN_NOTES = {
    "life-expectancy": "聯合國的估計值；內政部 112 年（2023）簡易生命表是 80.23 歲",
    "infant-mortality": "聯合國的估計值，比官方統計低；內政部 112 年（2023）簡易生命表的 0 歲死亡機率是 4.31‰",
    "under5-mortality": "聯合國的估計值，比官方統計低；內政部 112 年（2023）簡易生命表的未滿 5 歲死亡機率是 5.12‰",
}

# 輸出檔名 -> (World Bank 代碼, 單位, 小數位數, 頭尾年份至少要有最多那年幾成的國家)
WB_INDICATORS = {
    "health-spending-per-capita": ("SH.XPD.CHEX.PC.CD", "美元", 1, 0.3),
    "health-spending-gdp": ("SH.XPD.CHEX.GD.ZS", "%", 2, 0.3),
    # 醫師數很多國家隔幾年才統計一次，最新一年只有少數國家
    "physicians": ("SH.MED.PHYS.ZS", "人/千人", 2, 0.5),
}


def build() -> None:
    out = OUT_DIR / "topics" / "health"

    demo = wpp.demographic([col for col, _unit, _digits in WPP_INDICATORS.values()])
    for key, (col, unit, digits) in WPP_INDICATORS.items():
        countries = dict(demo[col])
        world = countries.pop("WLD", {})
        years = year_span(countries)
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, {iso3: to_series(s, years, digits) for iso3, s in countries.items()},
                aggregates={"WLD": to_series(world, years, digits)},
                **({"notes": {"TWN": WPP_TAIWAN_NOTES[key]}} if key in WPP_TAIWAN_NOTES else {}),
            ),
        )

    taiwan = mohw.health_series()
    for key, (code, unit, digits, min_share) in WB_INDICATORS.items():
        countries, world = worldbank.fetch(code, 1960)
        countries["TWN"] = taiwan[key]
        years = year_span(countries, min_share)
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, {iso3: to_series(s, years, digits) for iso3, s in countries.items() if s},
                aggregates={"WLD": to_series(world, years, digits)},
                notes={"TWN": mohw.NOTES[key]},
            ),
        )
    write_json(
        out / "manifest.json",
        {"topic": "health", "generatedAt": now_iso(), "source": "UN WPP 2024; World Bank WDI (WHO); 衛生福利部"},
    )
