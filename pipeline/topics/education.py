"""教育主題：平均受教育年數、高等教育粗在學率、政府教育支出、成人識字率。

- 平均受教育年數用 UNDP 人類發展報告；粗在學率、教育支出、識字率用 World Bank WDI（UNESCO 統計研究所）。
- 這些都沒有台灣：平均受教育年數、粗在學率、教育經費用教育部統計處，識字率用內政部的戶籍統計。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import moe, moi, undp, worldbank

TAIWAN = "台灣不在{db}資料庫中，改用"
# 輸出檔名 -> (來源, 代碼, 單位, 頭尾年份至少要有最多那年幾成的國家, 台灣資料, 台灣附註)
INDICATORS = {
    "mean-years-schooling": (
        "undp", "mys", "年", 0.3, moe.mean_years_of_schooling,
        TAIWAN.format(db="聯合國開發計劃署") + "教育部「教育統計指標之國際比較」的 25 歲以上平均受教育年數（同一個公式）",
    ),
    "tertiary-enrollment": (
        "wb", "SE.TER.ENRR", "%", 0.3, moe.tertiary_enrollment,
        TAIWAN.format(db="世界銀行／UNESCO") + "教育部的高等教育粗在學率（18–22 歲），2008 學年度起",
    ),
    "education-spending": (
        "wb", "SE.XPD.TOTL.GD.ZS", "%", 0.3, moe.government_spending_share,
        TAIWAN.format(db="世界銀行／UNESCO") + "教育部教育經費統計的「政府經費」占 GDP（預算數，不含公立學校自籌經費與私部門）",
    ),
    "literacy": (
        "wb", "SE.ADT.LITR.ZS", "%", 0.3, moi.literacy,
        TAIWAN.format(db="世界銀行／UNESCO") + "內政部依戶籍登記的 15 歲以上人口識字率",
    ),
}


# 台灣附註的英文（英文介面用）
NOTES_EN = {
    "mean-years-schooling": (
        "Taiwan is not in the UNDP database; mean years of schooling of people aged 25 and over from the Ministry of "
        "Education's international comparison of education indicators used instead (same formula)"
    ),
    "tertiary-enrollment": (
        "Taiwan is not in the World Bank/UNESCO database; the Ministry of Education's gross tertiary enrolment ratio "
        "(ages 18–22) used instead, from the 2008 school year"
    ),
    "education-spending": (
        "Taiwan is not in the World Bank/UNESCO database; government education funding as a share of GDP from the "
        "Ministry of Education's education expenditure statistics used instead (budget figures, excluding public "
        "schools' own funds and the private sector)"
    ),
    "literacy": (
        "Taiwan is not in the World Bank/UNESCO database; the Ministry of the Interior's literacy rate of people aged "
        "15 and over, based on household registration, used instead"
    ),
}


def build() -> None:
    out = OUT_DIR / "topics" / "education"
    for key, (source, code, unit, min_share, taiwan, note) in INDICATORS.items():
        countries, world = undp.series(code) if source == "undp" else worldbank.fetch(code, 1960)
        countries["TWN"] = taiwan()
        years = year_span(countries, min_share)
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, {iso3: to_series(s, years, 2) for iso3, s in countries.items() if s},
                aggregates={"WLD": to_series(world, years, 2)},
                notes={"TWN": note},
                notesEn={"TWN": NOTES_EN[key]},
            ),
        )
    write_json(
        out / "manifest.json",
        {"topic": "education", "generatedAt": now_iso(), "source": "UNDP HDR; World Bank WDI (UNESCO UIS); 教育部; 內政部"},
    )
