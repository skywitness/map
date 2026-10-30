"""教育主題：平均受教育年數、高等教育粗在學率、政府教育支出、成人識字率。

- 平均受教育年數用 UNDP 人類發展報告；粗在學率、教育支出、識字率用 World Bank WDI（UNESCO 統計研究所）。
- 這些都沒有台灣：平均受教育年數、粗在學率、教育經費用教育部統計處，識字率用內政部的戶籍統計。
- 2026-10-30 擴充（製作手冊第六批 86，`build_more()`）：
  - 0–2 歲上托育的比例：OECD Family Database PF3.2（約 45 國），台灣自算（衛福部、教育部、內政部，`sources/tw_childcare.py`，DESIGN.md 第 216 點）。
  - 學前教育毛入學率：UIS 的學前在學人數 ÷ 學前學齡人口自行計算（CC BY-SA 4.0；WDI 的 SE.PRE.ENRR 停在 2021–2022 年，
    UIS 也不再發布這個比率），台灣用教育部的「幼兒(稚)園 2–5 歲粗在學率」（DESIGN.md 第 213 點）。
  - 國中教師的法定年薪：OECD Education at a Glance，15 年年資、最普遍的資格、購買力平價美元，只有 2025 年；台灣自算（法令的薪額、學術研究加給、年終 1.5 個月，`sources/tw_teacher_salary.py`，DESIGN.md 第 216 點）。
  - 小學平均每班人數：OECD Education at a Glance（2013–2024），台灣用教育部國民小學概況的學生數 ÷ 班級數。
  - 小學生師比：UIS 公開 API 的小學學生數（20062）÷ 教師數（20162），同一年兩個都有才算（CC BY-SA 4.0，
    資料檔同樣依 CC BY-SA 4.0 分享）；台灣用教育部的學生數 ÷ 教師數。世界銀行轉載的 SE.PRM.ENRL.TC.ZS 停在 2019 年，不用。
  - 小學一年上課天數：OECD Education at a Glance 的 instruction time（2025），台灣沒有規定上課日數的法規。
  - 高中階段讀職業類課程的比例：UIS GTVP.3.V（CC BY-SA 4.0），台灣用教育部的專業群科加實用技能學程。
  比利時用荷語區、英國用英格蘭的值（OECD 只有分區的值），附註寫另一區。
"""
from __future__ import annotations

import json

from common import OUT_DIR, download, indicator_file, latest_year_span, now_iso, to_series, write_json, year_span
from sources import imf, moe, moi, oecd_eag, tw_childcare, tw_teacher_salary, undp, worldbank

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


UIS_URL = (
    "https://api.uis.unesco.org/api/public/data/indicators?indicator=20062&indicator=20162&indicator=GTVP.3.V"
    "&start=2005&end=2025"
)
# 玻利維亞 2005–2024 年每年的職業類比例都是 100%（UIS 的值看起來不是能跟別國比的分類，手冊的陷阱），不收
VOCATIONAL_DROP = {"BOL"}
WITHIN = {"childcare": 5, "preprimary": 5, "class-size": 5, "pupil-teacher": 5, "vocational": 5}
REGION_NOTES = {
    "BEL": ("荷語區的值（法語區 {other}）", "Flemish Community (French Community: {other})"),
    "GBR": ("英格蘭的值（蘇格蘭 {other}）", "England (Scotland: {other})"),
}


def _uis() -> dict[str, dict[str, dict[int, float]]]:
    """{指標: {iso3: {年: 值}}}"""
    path = download(UIS_URL, "uis", "education-2005-2025.json")
    out: dict[str, dict[str, dict[int, float]]] = {}
    for r in json.loads(path.read_text(encoding="utf-8"))["records"]:
        if r["value"] is not None and len(r["geoUnit"]) == 3:
            out.setdefault(r["indicatorId"], {}).setdefault(r["geoUnit"], {})[int(r["year"])] = float(r["value"])
    return out


PREPRIMARY_URL = "https://api.uis.unesco.org/api/public/data/indicators?indicator=20060&indicator=SAP.02&geoUnitType=NATIONAL"


def _preprimary() -> dict[str, dict[int, float]]:
    """學前教育毛入學率（%）：UIS 的學前在學人數（20060）÷ 學前學齡人口（SAP.02）× 100，自行計算（DESIGN.md 第 213 點）。"""
    path = download(PREPRIMARY_URL, "uis", "preprimary-20060-SAP02.json")
    by: dict[str, dict[str, dict[int, float]]] = {}
    for r in json.loads(path.read_text(encoding="utf-8"))["records"]:
        if r["value"] is not None and len(r["geoUnit"]) == 3:
            by.setdefault(r["indicatorId"], {}).setdefault(r["geoUnit"], {})[int(r["year"])] = float(r["value"])
    enrolled, population = by["20060"], by["SAP.02"]
    return {
        c: {y: v / population[c][y] * 100 for y, v in years.items() if population.get(c, {}).get(y)}
        for c, years in enrolled.items()
    }


def _region_notes(other: dict[str, dict[int, float]], fmt) -> tuple[dict[str, str], dict[str, str]]:
    zh, en = {}, {}
    for iso3, values in other.items():
        text = fmt(values[max(values)])
        zh[iso3] = REGION_NOTES[iso3][0].format(other=text)
        en[iso3] = REGION_NOTES[iso3][1].format(other=text)
    return zh, en


def build_more(out) -> None:
    def write(key, unit, series, digits, notes=({}, {}), **extra):
        series = {c: s for c, s in series.items() if s}
        if key in WITHIN:
            years = latest_year_span(series, WITHIN[key])
            extra["latestWithin"] = WITHIN[key]
        else:
            years = sorted({y for s in series.values() for y in s})
        values = {c: to_series(s, years, digits) for c, s in series.items()}
        write_json(out / f"{key}.json", indicator_file(key, unit, years, values, notes=notes[0], notesEn=notes[1], **extra))
        latest = sorted(((s[max(s)], c) for c, s in series.items()), reverse=True)
        print(f"  {key}：{len(series)} 國，最高 {latest[:3]}，最低 {latest[-3:]}，台灣 {series.get('TWN', {}).get(max(series.get('TWN', {0: 0})))}")

    childcare = oecd_eag.childcare_0_2()
    childcare["TWN"] = tw_childcare.childcare_0_2()
    write("childcare", "%", childcare, 1, (
        {"TWN": "自算：（衛福部托嬰中心收托人數 ＋ 居家托育 0–2 歲收托人數 ＋ 教育部幼兒園「未滿 3 歲」幼生數）÷ 內政部年底 0–2 歲人口。"
                "托嬰中心、居家托育與人口是 12 月底，幼兒園是 11 月 1 日（學年年齡，跟戶籍的 0–2 歲有錯位）"},
        {"TWN": "Own calculation: (children in Ministry of Health and Welfare baby care centres + children aged 0–2 with registered home "
                "childcare providers + Ministry of Education kindergarten pupils under 3) ÷ population aged 0–2 at year end (Ministry of "
                "the Interior). Childcare centres, home childcare and population are as of 31 December, kindergartens as of 1 November "
                "(school-year age, which does not line up exactly with age 0–2)"},
    ))
    preprimary = _preprimary()
    preprimary["TWN"] = moe.preprimary_enrollment()
    write("preprimary", "%", preprimary, 1, (
        {"TWN": "教育部統計處「幼兒(稚)園 2–5 歲粗在學率」：分母是 2–5 歲人口，多數國家是 3–5 歲（學年度開始的那一年）"},
        {"TWN": "Ministry of Education gross enrolment rate for kindergartens, ages 2–5: the denominator is the population aged 2–5, while most countries use 3–5 (the year the school year starts)"},
    ), license="CC BY-SA 4.0")

    salary, other = oecd_eag.teacher_salary()
    salary_notes = _region_notes(other, lambda v: f"{v:,.0f}")
    salary["TWN"], salary_notes[0]["TWN"], salary_notes[1]["TWN"] = tw_teacher_salary.teacher_salary_ppp(imf.fetch("PPPEX")[0]["TWN"])
    write("teacher-salary", "USD PPP", salary, 0, salary_notes)

    taiwan = moe.primary_school()
    classes, other = oecd_eag.class_size()
    classes["TWN"] = {y: v["學生數"] / v["班級數"] for y, v in taiwan.items() if v.get("班級數")}
    notes = _region_notes(other, lambda v: f"{v:.1f}")
    notes[0]["TWN"] = "教育部統計處國民小學概況：學生數 ÷ 班級數（公私立合計，學年度開始的那一年）"
    notes[1]["TWN"] = "Ministry of Education primary school statistics: pupils ÷ classes (public and private; the year the school year starts)"
    write("class-size", "人", classes, 1, notes)

    uis = _uis()
    pupils, teachers = uis.get("20062", {}), uis.get("20162", {})
    ratio = {
        c: {y: pupils[c][y] / t for y, t in years.items() if t and y in pupils.get(c, {})}
        for c, years in teachers.items()
    }
    ratio["TWN"] = {y: v["學生數"] / v["教師數"] for y, v in taiwan.items() if v.get("教師數")}
    write("pupil-teacher", "人", ratio, 1, (
        {"TWN": "教育部統計處國民小學概況：學生數 ÷ 教師數（學年度開始的那一年）"},
        {"TWN": "Ministry of Education primary school statistics: pupils ÷ teachers (the year the school year starts)"},
    ), license="CC BY-SA 4.0")

    days, other = oecd_eag.school_days()
    write("school-days", "天", days, 1, _region_notes(other, lambda v: f"{v:g}"))

    vocational = {c: s for c, s in uis.get("GTVP.3.V", {}).items() if c not in VOCATIONAL_DROP}
    vocational["TWN"] = moe.upper_secondary_vocational()
    write("vocational", "%", vocational, 1, (
        {"TWN": "教育部統計處：高級中等學校讀專業群（職業）科與實用技能學程的學生比例；綜合高中、進修部不算（學年度開始的那一年）"},
        {"TWN": "Ministry of Education: share of upper secondary students in vocational programmes and practical skills programmes, excluding comprehensive high schools and continuing education divisions (the year the school year starts)"},
    ), license="CC BY-SA 4.0")


def build() -> None:
    out = OUT_DIR / "topics" / "education"
    build_more(out)
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
        {"topic": "education", "generatedAt": now_iso(), "source": "UNDP HDR; World Bank WDI (UNESCO UIS); UIS API; OECD Education at a Glance; OECD Family Database; 教育部; 內政部"},
    )
