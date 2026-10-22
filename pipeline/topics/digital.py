"""數位主題：網路使用率、行動電話用戶、固網寬頻用戶（World Bank WDI 轉載的 ITU 資料）。

ITU 與世界銀行都沒有台灣，台灣用數位發展部「數位近用調查」的個人上網率，
以及 NCC 的行動通信與寬頻帳號數，除以 UN WPP 的年中人口換算成每百人。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import moda, ncc, worldbank, wpp

# 輸出檔名 -> (World Bank 代碼, 單位, 台灣附註, 台灣附註的英文)
INDICATORS = {
    "internet-users": (
        "IT.NET.USER.ZS", "%",
        "台灣不在 ITU／世界銀行資料庫中，改用數位發展部「數位近用調查」的個人上網率（12 歲以上，2021 年未調查）",
        "Taiwan is not in the ITU/World Bank database; the individual internet use rate from the Ministry of Digital Affairs' Digital Access Survey is used instead (age 12 and over; no survey in 2021)",
    ),
    "mobile-subscriptions": (
        "IT.CEL.SETS.P2", "門/百人",
        "台灣不在 ITU／世界銀行資料庫中，改用 NCC 每年 12 月的行動通信用戶數（含純數據門號）除以聯合國年中人口；2014 年 4G 用戶未列入統計，從缺",
        "Taiwan is not in the ITU/World Bank database; NCC mobile subscriptions at the end of each year (including data-only SIMs) divided by UN mid-year population are used instead; 2014 is missing because 4G subscriptions were not counted",
    ),
    "fixed-broadband": (
        "IT.NET.BBND.P2", "門/百人",
        "台灣不在 ITU／世界銀行資料庫中，改用 NCC 每年 12 月的固網寬頻帳號數（ADSL、光纖、纜線、專線）除以聯合國年中人口",
        "Taiwan is not in the ITU/World Bank database; NCC fixed broadband accounts at the end of each year (DSL, fibre, cable, leased lines) divided by UN mid-year population are used instead",
    ),
}


def taiwan_series() -> dict[str, dict[int, float]]:
    population = wpp.demographic(["TPopulation1July"], last_year=2030)["TPopulation1July"]["TWN"]  # 千人
    per100 = lambda counts: {y: n / (population[y] * 1000) * 100 for y, n in counts.items() if y in population}  # noqa: E731
    return {
        "internet-users": moda.internet_users(),
        "mobile-subscriptions": per100(ncc.mobile_subscriptions()),
        "fixed-broadband": per100(ncc.fixed_broadband()),
    }


def build() -> None:
    out = OUT_DIR / "topics" / "digital"
    taiwan = taiwan_series()
    for key, (code, unit, note, note_en) in INDICATORS.items():
        countries, world = worldbank.fetch(code, 1960)
        countries["TWN"] = taiwan[key]
        # 1990 年以前的網路與寬頻都是 0，地圖從 1990 年開始
        years = [y for y in year_span(countries) if y >= 1990]
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, {iso3: to_series(s, years, 2) for iso3, s in countries.items() if s},
                aggregates={"WLD": to_series(world, years, 2)},
                notes={"TWN": note},
                notesEn={"TWN": note_en},
            ),
        )
    write_json(
        out / "manifest.json",
        {"topic": "digital", "generatedAt": now_iso(), "source": "World Bank WDI (ITU); 數位發展部; NCC; UN WPP 2024"},
    )
