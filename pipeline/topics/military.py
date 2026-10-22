"""軍事主題：軍費（SIPRI）與兵力（World Bank WDI，資料來自 IISS The Military Balance）。

SIPRI 不是開放授權：非商業使用、註明出處，轉載少於整個資料集 10% 才算合理使用。
所以只放兩張表（當年美元、占 GDP）的 2011–2025 年，輸出前會檢查實際筆數占整個資料集的比例。
SIPRI 有台灣；兵力資料（CC BY 4.0）沒有台灣，只到 2020 年。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import sipri, worldbank

SIPRI_YEARS = (2011, 2025)
SIPRI_LIMIT = 0.10  # SIPRI 合理使用：少於資料集的 10%

ARMED_FORCES = {
    "armed-forces": ("MS.MIL.TOTL.P1", "人", 0),
    "armed-forces-labor": ("MS.MIL.TOTL.TF.ZS", "%", 2),
}
TAIWAN_SPENDING_NOTE = (
    "SIPRI 依自己的定義估計，跟政府公布的國防預算總額口徑不同"
    "（2024 年政府公布 6,068 億元、占 GDP 約 2.5%，是預算數，含特別預算與非營業特種基金）"
)
TAIWAN_ARMED_FORCES_NOTE = "世界銀行（IISS）的兵力資料不含台灣；國防部公布的是編制員額而非實際人數，口徑不同，所以沒有放"
TAIWAN_SPENDING_NOTE_EN = (
    "SIPRI's estimate follows its own definition and differs from the government's published defence budget "
    "(NT$606.8 billion in 2024, about 2.5% of GDP, a budget figure including special budgets and non-business special funds)"
)
TAIWAN_ARMED_FORCES_NOTE_EN = (
    "The World Bank (IISS) armed forces data does not include Taiwan; the Ministry of National Defense publishes authorised "
    "strength rather than actual personnel, a different measure, so it is not shown"
)


def build() -> None:
    out = OUT_DIR / "topics" / "military"
    years = list(range(SIPRI_YEARS[0], SIPRI_YEARS[1] + 1))
    usd = sipri.table("Current US$", *SIPRI_YEARS)  # 百萬美元
    share = sipri.table("Share of GDP", *SIPRI_YEARS)  # 0.025 = 2.5%

    published = sum(len(s) for s in usd.values()) + sum(len(s) for s in share.values())
    total = sipri.dataset_size()
    print(f"  SIPRI：輸出 {published} 筆，占整個資料集 {total} 筆的 {published / total:.1%}")
    if published >= total * SIPRI_LIMIT:
        raise RuntimeError("SIPRI 子集超過資料集的 10%，超出合理使用範圍，請縮短年份")

    # 世界合計：有資料國家的加總；占 GDP 用「軍費加總 ÷ GDP 加總」，GDP 由軍費 ÷ 占比反推
    world_usd = {y: sum(s[y] for s in usd.values() if y in s) * 1e6 for y in years}
    world_share = {}
    for y in years:
        both = [(usd[c][y], share[c][y]) for c in usd if y in usd[c] and y in share.get(c, {}) and share[c][y] > 0]
        world_share[y] = sum(u for u, _ in both) / sum(u / s for u, s in both) * 100
    write_json(
        out / "spending.json",
        indicator_file(
            "spending", "美元", years, {c: to_series({y: v * 1e6 for y, v in s.items()}, years, 0) for c, s in usd.items()},
            aggregates={"WLD": to_series(world_usd, years, 0)},
            notes={"TWN": TAIWAN_SPENDING_NOTE},
            notesEn={"TWN": TAIWAN_SPENDING_NOTE_EN},
        ),
    )
    write_json(
        out / "spending-gdp.json",
        indicator_file(
            "spending-gdp", "%", years, {c: to_series({y: v * 100 for y, v in s.items()}, years, 2) for c, s in share.items()},
            aggregates={"WLD": to_series(world_share, years, 2)},
            notes={"TWN": TAIWAN_SPENDING_NOTE},
            notesEn={"TWN": TAIWAN_SPENDING_NOTE_EN},
        ),
    )

    for key, (code, unit, digits) in ARMED_FORCES.items():
        countries, world = worldbank.fetch(code, 1985)
        span = year_span(countries)
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, span, {c: to_series(s, span, digits) for c, s in countries.items()},
                aggregates={"WLD": to_series(world, span, digits)},
                notes={"TWN": TAIWAN_ARMED_FORCES_NOTE},
                notesEn={"TWN": TAIWAN_ARMED_FORCES_NOTE_EN},
            ),
        )
    write_json(
        out / "manifest.json",
        {
            "topic": "military",
            "generatedAt": now_iso(),
            "source": "SIPRI Military Expenditure Database (2011–2025 subset, fair use); World Bank WDI (IISS)",
            "sipriValues": published,
            "sipriDatasetValues": total,
        },
    )
