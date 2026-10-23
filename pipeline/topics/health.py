"""健康主題：平均壽命、嬰兒與五歲以下死亡率、醫療支出與誰來付、醫師、護理人員與病床數。

- 壽命與死亡率用 UN WPP 2024（各國同一套估計方法），只取 2023 年以前的估計值。
  台灣改用內政部的簡易生命表：WPP 對台灣的估計跟官方差不少，嬰幼兒死亡率差最多。
- 醫療支出（含家庭自付、政府與健保的比重）、醫師、護理人員、病床數用 World Bank WDI
  （WHO 全球醫療支出資料庫、全球衛生人力統計）；WDI 沒有台灣，台灣用衛生福利部的國民醫療保健支出、
  衛生福利統計指標。人均自付的國際元由台灣的新臺幣金額除以 IMF 的購買力平價換算。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import imf, moi, mohw, worldbank, wpp

# 輸出檔名 -> (WPP 欄位, 單位, 小數位數)
WPP_INDICATORS = {
    "life-expectancy": ("LEx", "歲", 2),
    "infant-mortality": ("IMR", "‰", 2),
    "under5-mortality": ("Q5", "‰", 2),
    # 側欄的男女對照，不在地圖指標裡
    "life-expectancy-female": ("LExFemale", "歲", 2),
    "life-expectancy-male": ("LExMale", "歲", 2),
}

# 台灣的附註：內政部的資料說明，再附上 WPP 最新一年的估計對照。(中文說明, 英文說明, 數值格式)
TAIWAN_NOTES = {
    "life-expectancy": (
        f"內政部簡易生命表的 0 歲平均餘命，{moi.NATIONAL_FROM} 年起（男女分開的從 1970 年起，"
        f"{moi.NATIONAL_FROM - 1} 年以前不含金門、連江）",
        "Life expectancy at birth from the Ministry of the Interior's abridged life tables, "
        f"from {moi.NATIONAL_FROM} (by sex from 1970, excluding Kinmen and Matsu before {moi.NATIONAL_FROM})",
        ("{} 歲", "{} years"),
    ),
    "infant-mortality": (
        f"內政部簡易生命表的 0 歲死亡機率，{moi.NATIONAL_FROM} 年起",
        f"Probability of dying before age 1 from the Ministry of the Interior's abridged life tables, from {moi.NATIONAL_FROM}",
        ("{}‰", "{}‰"),
    ),
    "under5-mortality": (
        f"內政部簡易生命表的未滿 5 歲死亡機率，{moi.NATIONAL_FROM} 年起",
        f"Probability of dying before age 5 from the Ministry of the Interior's abridged life tables, from {moi.NATIONAL_FROM}",
        ("{}‰", "{}‰"),
    ),
}


def taiwan_notes(key: str, un_estimate: dict[int, float]) -> dict:
    zh, en, (fmt_zh, fmt_en) = TAIWAN_NOTES[key]
    year = max(un_estimate)
    value = f"{un_estimate[year]:.2f}"
    return {
        "notes": {"TWN": f"{zh}；聯合國 WPP 的估計不同，{year} 年是 {fmt_zh.format(value)}"},
        "notesEn": {"TWN": f"{en}; the UN WPP estimate differs: {fmt_en.format(value)} in {year}"},
    }


# 輸出檔名 -> (World Bank 代碼, 單位, 小數位數, 頭尾年份至少要有最多那年幾成的國家)
WB_INDICATORS = {
    "health-spending-per-capita": ("SH.XPD.CHEX.PC.CD", "美元", 1, 0.3),
    "health-spending-gdp": ("SH.XPD.CHEX.GD.ZS", "%", 2, 0.3),
    "oop-share": ("SH.XPD.OOPC.CH.ZS", "%", 2, 0.3),
    "oop-per-capita": ("SH.XPD.OOPC.PP.CD", "國際元", 1, 0.3),
    "government-share": ("SH.XPD.GHED.CH.ZS", "%", 2, 0.3),
    # 醫事人力、病床很多國家隔幾年才統計一次，最新一年只有少數國家
    "physicians": ("SH.MED.PHYS.ZS", "人/千人", 2, 0.5),
    "nurses": ("SH.MED.NUMW.P3", "人/千人", 2, 0.5),
    "hospital-beds": ("SH.MED.BEDS.ZS", "床/千人", 2, 0.5),
}


def taiwan_oop_per_capita() -> dict[int, float]:
    """平均每人經常性醫療保健支出（新臺幣）× 家庭自付比重 ÷ IMF 的購買力平價（新臺幣／國際元）。"""
    table = mohw.nhe()
    ppp = imf.fetch("PPPEX")[0]["TWN"]
    return {
        year: per_capita * table["oop-share"][year] / 100 / ppp[year]
        for year, per_capita in table["che-per-capita-ntd"].items()
        if year in table["oop-share"] and year in ppp
    }


def build() -> None:
    out = OUT_DIR / "topics" / "health"

    demo = wpp.demographic([col for col, _unit, _digits in WPP_INDICATORS.values()])
    life = moi.life_expectancy()
    infant, under5 = moi.child_mortality()
    taiwan_life = {
        "life-expectancy": life["total"],
        "infant-mortality": infant,
        "under5-mortality": under5,
        "life-expectancy-female": life["female"],
        "life-expectancy-male": life["male"],
    }
    for key, (col, unit, digits) in WPP_INDICATORS.items():
        countries = dict(demo[col])
        world = countries.pop("WLD", {})
        un_taiwan = countries.get("TWN", {})
        countries["TWN"] = taiwan_life[key]  # 內政部有比 WPP 估計值更新的年份，year_span 會截掉
        years = year_span(countries)
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, {iso3: to_series(s, years, digits) for iso3, s in countries.items()},
                aggregates={"WLD": to_series(world, years, digits)},
                **(taiwan_notes(key, un_taiwan) if key in TAIWAN_NOTES else {}),
            ),
        )

    taiwan = mohw.health_series()
    taiwan["oop-per-capita"] = taiwan_oop_per_capita()
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
                notesEn={"TWN": mohw.NOTES_EN[key]},
            ),
        )
    write_json(
        out / "manifest.json",
        {"topic": "health", "generatedAt": now_iso(), "source": "UN WPP 2024; 內政部; World Bank WDI (WHO); 衛生福利部; IMF WEO"},
    )
