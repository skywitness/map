"""疾病主題：慢性病（糖尿病、肥胖、四大慢性病過早死亡、癌症死亡率）、傳染病（愛滋、結核病、瘧疾）、
死因結構（三大類的占比）與各國的首要死因類別。

- 糖尿病、肥胖、30–70 歲死於四大慢性病的機率：WHO GHO（糖尿病與肥胖是 NCD-RisC 的年齡標準化估計）。
- 死因結構、首要死因、癌症標準化死亡率：WHO Global Health Estimates 2023 版的死因別死亡數（2000–2023 年）。
  癌症死亡率用 GHE 的年齡別死亡數與人口，以 WHO 世界標準人口自己算年齡標準化死亡率。
- 愛滋（UNAIDS）、結核病、瘧疾（WHO）：World Bank WDI 轉載的版本（CC BY 4.0）。
- 癌症發生率沒有放：GLOBOCAN（IARC）大量轉載要書面授權，IHME GBD 只限非商業使用（見 DESIGN.md）。

台灣不在 WHO 與世界銀行的資料庫中：
- 死因結構、首要死因、四大慢性病過早死亡：用衛福部死因統計的 ICD-10 詳細分類自己歸類（2008 年起），
  30–70 歲的人口用 WPP（跟內政部年中人口差不到 0.2%）。
- 癌症標準化死亡率：衛福部統計指標表7（同樣用 WHO 2000 年世界標準人口）。
- 結核病：衛福部統計指標表5 的確定病例（新案）÷ 內政部年中人口。
- 糖尿病、肥胖、愛滋、瘧疾：沒有跟國際定義一致的數字，地圖上留空，側欄附註寫官方數字與差異。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import mohw, mohw_deaths, who, worldbank, wpp

# 首要死因的分類：GHE 第二層死因代碼。所有國家、所有年份的首要死因都要在這裡（前端 disease.ts 用同一組代碼）
TOP_CAUSES = [1100, 610, 20, 380, 1520, 1600, 540]
LEVEL2_EXCLUDED = {who.ALL_CAUSES, who.COMMUNICABLE, who.NONCOMMUNICABLE, who.INJURIES}

TAIWAN_FROM_DEATHS = (
    "台灣不在 WHO 資料庫中，改用衛福部死因統計（ICD-10 詳細分類）依 WHO 的死因分類自己歸類，2008 年起；"
    "症狀、徵候與不明原因（R 碼）不算進分母，2023 年占全部死亡 5.3%"
)
TAIWAN_FROM_DEATHS_EN = (
    "Taiwan is not in the WHO database; its causes of death are classified here into WHO's categories from "
    "the Ministry of Health and Welfare's detailed ICD-10 death statistics, from 2008. Deaths from symptoms and "
    "ill-defined causes (R codes, 5.3% of deaths in 2023) are left out of the denominator"
)

NOTES = {
    "diabetes": (
        "台灣不在 WHO 資料庫中，也沒有同樣定義的年齡標準化數字，所以地圖上留空。國健署 2017–2020 年國民營養健康調查："
        "18 歲以上糖尿病盛行率 11.1%（空腹血糖 ≥ 126 mg/dL 或服藥，沒有年齡標準化）",
        "Taiwan is not in the WHO database and has no age-standardised figure with the same definition, so it is left "
        "blank. The Health Promotion Administration's 2017–2020 Nutrition and Health Survey found 11.1% of adults "
        "(18+) had diabetes (fasting glucose ≥ 126 mg/dL or on medication, not age-standardised)",
    ),
    "obesity": (
        "台灣不在 WHO 資料庫中，地圖上留空。台灣的成人肥胖標準是 BMI ≥ 27（WHO 是 ≥ 30），"
        "國健署 2017–2020 年國民營養健康調查：18 歲以上男性 28.1%、女性 19.6%",
        "Taiwan is not in the WHO database, so it is left blank. Taiwan defines adult obesity as BMI ≥ 27 "
        "(WHO uses ≥ 30); by that definition the Health Promotion Administration's 2017–2020 Nutrition and Health "
        "Survey found 28.1% of men and 19.6% of women (18+) were obese",
    ),
    "hiv": (
        "台灣不在 UNAIDS 資料庫中，地圖上留空。疾管署統計截至 2024 年底約 3.6 萬名存活的 HIV 感染者"
        "（全人口約 0.15%），是通報的人數，不是 UNAIDS 含未診斷者的 15–49 歲盛行率估計",
        "Taiwan is not in the UNAIDS database, so it is left blank. Taiwan CDC counted about 36,000 people living "
        "with HIV at the end of 2024 (about 0.15% of the population); that is a count of reported cases, not a "
        "modelled prevalence among 15–49-year-olds including undiagnosed infections",
    ),
    "tb-incidence": (
        "台灣不在 WHO 資料庫中，改用衛福部統計指標的結核病確定病例（新案）÷ 內政部年中人口，"
        "2001–2014 年只有 2005、2010 年。WHO 的發生率是含未通報個案的估計值，台灣的是通報數，可能略低",
        "Taiwan is not in the WHO database; confirmed new tuberculosis cases from the Ministry of Health and "
        "Welfare's statistics indicators ÷ mid-year population (for 2001–2014 only 2005 and 2010). WHO's figures "
        "are estimates that include unreported cases, Taiwan's are notifications, so they may be slightly lower",
    ),
    "malaria": (
        "台灣 1965 年經 WHO 認證根除瘧疾，沒有本土病例，只有境外移入（2024 年 9 例），所以地圖上留空",
        "Taiwan was certified malaria-free by WHO in 1965 and has no local transmission, only imported cases "
        "(9 in 2024), so it is left blank",
    ),
    "ncd-mortality": (
        "台灣不在 WHO 資料庫中，改用衛福部死因統計（ICD-10）30–69 歲死於心血管疾病（I00–I99）、癌症（C00–C97）、"
        "糖尿病（E10–E14）、慢性呼吸道疾病（J30–J98）的人數，以 WPP 年齡別人口照 WHO 的公式計算，2008 年起",
        "Taiwan is not in the WHO database; calculated with WHO's formula from deaths at ages 30–69 from "
        "cardiovascular disease (I00–I99), cancer (C00–C97), diabetes (E10–E14) and chronic respiratory disease "
        "(J30–J98) in the Ministry of Health and Welfare's ICD-10 death statistics and WPP population by age, from 2008",
    ),
    "cancer-mortality": (
        "台灣不在 WHO 資料庫中，改用衛福部統計指標的惡性腫瘤標準化死亡率（同樣用 WHO 2000 年世界標準人口），"
        "2001–2014 年只有 2005、2010 年",
        "Taiwan is not in the WHO database; the Ministry of Health and Welfare's age-standardised cancer death rate "
        "(also with the WHO 2000 world standard population); for 2001–2014 only 2005 and 2010 are available",
    ),
}
for key in ("ncd-deaths-share", "communicable-deaths-share", "injury-deaths-share", "top-cause"):
    NOTES[key] = (TAIWAN_FROM_DEATHS, TAIWAN_FROM_DEATHS_EN)

# 輸出檔名 -> (WDI 代碼, 單位, 小數位數)
WB_INDICATORS = {
    "hiv": ("SH.DYN.AIDS.ZS", "%", 2),
    "tb-incidence": ("SH.TBS.INCD", "人/十萬人", 1),
    "malaria": ("SH.MLR.INCD.P3", "人/千人", 1),
}
# 輸出檔名 -> (GHO 代碼, 篩選條件, 單位)
GHO_INDICATORS = {
    "diabetes": ("NCD_DIABETES_PREVALENCE_AGESTD", {"Dim1": "SEX_BTSX", "Dim2": "AGEGROUP_YEARS18-PLUS"}, "%"),
    "obesity": ("NCD_BMI_30A", {"Dim1": "SEX_BTSX"}, "%"),
    "ncd-mortality": ("NCDMORT3070", {"Dim1": "SEX_BTSX"}, "%"),
}
# 死因占比：輸出檔名 -> GHE 第一大類
SHARES = {
    "ncd-deaths-share": who.NONCOMMUNICABLE,
    "communicable-deaths-share": who.COMMUNICABLE,
    "injury-deaths-share": who.INJURIES,
}


def probability_30_70(deaths_by_age: dict[str, float], population_by_age: dict[str, float]) -> float:
    """WHO 的公式：各五歲年齡組的死亡率 M → 5q = 5M ÷ (1 + 2.5M)，機率 = 1 − Π(1 − 5q)，單位 %。"""
    survive = 1.0
    for age in mohw_deaths.AGES_30_69:
        m = deaths_by_age[age] / population_by_age[age]
        survive *= 1 - 5 * m / (1 + 2.5 * m)
    return (1 - survive) * 100


def top_cause(deaths: dict[int, float]) -> int:
    cause = max((c for c in deaths if c not in LEVEL2_EXCLUDED), key=lambda c: deaths[c])
    if cause not in TOP_CAUSES:
        raise RuntimeError(f"首要死因 {cause} 不在 TOP_CAUSES 裡，前端 disease.ts 也要加上這一類")
    return cause


def ghe_series() -> dict[str, tuple[dict[str, dict[int, float]], dict[int, float]]]:
    """GHE 算出來的指標：{檔名: (各國 {iso3: {年: 值}}, 世界 {年: 值})}。"""
    out: dict[str, tuple[dict[str, dict[int, float]], dict[int, float]]] = {
        key: ({}, {}) for key in (*SHARES, "top-cause", "cancer-mortality")
    }
    for year in who.GHE_YEARS:
        ghe = who.GheYear(year)
        world_deaths: dict[int, float] = {}
        world_cancer: dict[str, tuple[float, float]] = {}
        for iso3, deaths in ghe.deaths.items():
            total = deaths[who.ALL_CAUSES]
            if total <= 0:
                continue
            for key, group in SHARES.items():
                out[key][0].setdefault(iso3, {})[year] = deaths[group] / total * 100
            out["top-cause"][0].setdefault(iso3, {})[year] = top_cause(deaths)
            for cause, n in deaths.items():
                world_deaths[cause] = world_deaths.get(cause, 0) + n
        for iso3, by_age in ghe.cancer_by_age.items():
            if (rate := who.age_standardized_rate(by_age)) is not None:
                out["cancer-mortality"][0].setdefault(iso3, {})[year] = rate
            for age, (d, p) in by_age.items():
                wd, wp = world_cancer.get(age, (0.0, 0.0))
                world_cancer[age] = (wd + d, wp + p)
        # 世界：GHE 涵蓋的 183 國加總（不含台灣與人口很少的地區）
        for key, group in SHARES.items():
            out[key][1][year] = world_deaths[group] / world_deaths[who.ALL_CAUSES] * 100
        out["top-cause"][1][year] = top_cause(world_deaths)
        if (rate := who.age_standardized_rate(world_cancer)) is not None:
            out["cancer-mortality"][1][year] = rate
    return out


def taiwan_series() -> dict[str, dict[int, float]]:
    deaths = mohw_deaths.deaths()
    population = wpp.population_by_age("TWN", min(deaths))
    out: dict[str, dict[int, float]] = {key: {} for key in (*SHARES, "top-cause", "ncd-mortality")}
    for year, d in deaths.items():
        classified = d.total - d.unclassified
        for key, group in SHARES.items():
            out[key][year] = d.by_cause.get(group, 0) / classified * 100
        out["top-cause"][year] = top_cause(d.by_cause)
        if year in population:
            out["ncd-mortality"][year] = probability_30_70(d.four_ncds_by_age, population[year])
    out["cancer-mortality"] = mohw.cancer_death_rate()
    cases = mohw.tuberculosis_cases()
    population_total = mohw.nhe()["population"]
    out["tb-incidence"] = {y: n / population_total[y] * 100_000 for y, n in cases.items() if y in population_total}
    return out


def build() -> None:
    out = OUT_DIR / "topics" / "disease"
    taiwan = taiwan_series()

    def write(key: str, unit: str, countries: dict[str, dict[int, float]], world: dict[int, float], digits: int,
              min_share: float = 0.3) -> None:
        if key in taiwan:
            countries["TWN"] = taiwan[key]
        years = year_span(countries, min_share)
        zh, en = NOTES[key] if key in NOTES else (None, None)
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, {iso3: to_series(s, years, digits) for iso3, s in countries.items() if s},
                **({"aggregates": {"WLD": to_series(world, years, digits)}} if world else {}),
                **({"notes": {"TWN": zh}, "notesEn": {"TWN": en}} if zh else {}),
            ),
        )

    for key, (code, dims, unit) in GHO_INDICATORS.items():
        countries, world = who.gho(code, dims)
        write(key, unit, countries, world, 2)
    for key, (code, unit, digits) in WB_INDICATORS.items():
        countries, world = worldbank.fetch(code, 1990)
        write(key, unit, countries, world, digits)
    for key, (countries, world) in ghe_series().items():
        if key == "top-cause":
            write(key, "GHE 死因代碼", countries, {}, 0)
        else:
            write(key, "%" if key in SHARES else "人/十萬人", countries, world, 2)
    write_json(
        out / "manifest.json",
        {
            "topic": "disease",
            "generatedAt": now_iso(),
            "source": "WHO GHO, WHO Global Health Estimates 2023; World Bank WDI (UNAIDS, WHO); 衛生福利部; UN WPP 2024",
        },
    )
