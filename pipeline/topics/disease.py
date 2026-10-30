"""疾病主題：慢性病（糖尿病、肥胖、四大慢性病過早死亡、癌症死亡率）、傳染病（愛滋、結核病、瘧疾）、
死因結構（三大類的占比）與各國的首要死因類別。

- 糖尿病、肥胖、30–70 歲死於四大慢性病的機率：WHO GHO（糖尿病與肥胖是 NCD-RisC 的年齡標準化估計）。
  GHO 的 OData 2026-10-30 起壞了，改讀 xmart；xmart 沒有糖尿病，糖尿病的檔不重新產生（KEEP_EXISTING）。
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

2026-10-29 擴充（製作手冊第五批 44，使用者決定；build_cancer_sites() 可以單獨跑）：各國死亡數最多的癌症（GHE 第三層的
癌症部位，不算「其他惡性腫瘤」780），男女合計、男性、女性三個子項目。台灣用衛福部死因統計的 ICD-10 碼依 GHE 的對照自己歸
（CANCER_ICD10），國健署癌症登記的發生數（新診斷）只寫在附註；癌症發生率不能畫（GLOBOCAN 不准大量轉載）。
"""
from __future__ import annotations

import json
import urllib.parse

from common import OUT_DIR, download, indicator_file, now_iso, to_series, write_json, year_span
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
# 輸出檔名 -> (GHO 代碼, 篩選條件, 單位)。GHO 的 OData 2026-10-30 起壞了，改讀 xmart（who.py）；
# xmart 沒有糖尿病的代碼，糖尿病照舊用 OData 壞掉以前產生的檔（KEEP_EXISTING，製作手冊第八批 146）
KEEP_EXISTING = {"diabetes"}
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
        if key in KEEP_EXISTING and (out / f"{key}.json").exists():
            print(f"  {key}：xmart 沒有 {code}，保留現有的檔")
            continue
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


# ── 各國死亡數最多的癌症（2026-10-29 擴充） ──────────────────────────
# GHE 第三層的癌症部位與 ICD-10（WHO GHE 方法說明的對照），台灣的死因統計依這張表歸類；780「其他惡性腫瘤」不參加比較
CANCER_ICD10 = {
    620: "C00-C14", 630: "C15", 640: "C16", 650: "C18-C21", 660: "C22", 670: "C25", 680: "C33-C34", 690: "C43-C44",
    700: "C50", 710: "C53", 720: "C54-C55", 730: "C56", 740: "C61", 742: "C62", 745: "C64-C65", 750: "C67",
    751: "C70-C72", 752: "C23-C24", 753: "C32", 754: "C73", 755: "C45", 760: "C81-C90,C96", 770: "C91-C95",
}
OTHER_CANCER = 780
CANCER_SEXES = {"total": "TOTAL", "male": "MALE", "female": "FEMALE"}
TW_SEX = {"1": "male", "2": "female"}
# 國健署癌症登記（data.gov.tw 6399）2023 年新診斷人數，只放附註（製作手冊第三十六節查證的數字）
CANCER_INCIDENCE_NOTE = (
    "死亡最多的癌症依衛福部死因統計（ICD-10 依 WHO GHE 的分類歸類）。發生（新診斷）的人數另依國健署癌症登記：2023 年最多的是"
    "肺癌 19,986 人、大腸直腸癌 19,074 人；男性最多是大腸直腸癌 10,749 人，女性是乳癌 17,779 人",
    "The cancer causing the most deaths is from the Ministry of Health and Welfare's death statistics, with ICD-10 codes "
    "grouped into WHO GHE categories. By new diagnoses (Health Promotion Administration cancer registry, 2023), lung cancer "
    "led with 19,986 cases and colorectal cancer had 19,074; colorectal cancer led among men (10,749) and breast cancer "
    "among women (17,779)",
)


def _ghe_cancer_sites(year: int) -> dict[str, dict[str, dict[int, float]]]:
    """{性別: {iso3: {癌症部位: 死亡數}}}"""
    query = (f"DIM_YEAR_CODE eq {year} and DIM_AGEGROUP_CODE eq 'TOTAL' and FLAG_LEVEL eq 3 and "
             "DIM_GHECAUSE_CODE gt 610 and DIM_GHECAUSE_CODE lt 800")
    select = "DIM_COUNTRY_CODE,DIM_GHECAUSE_CODE,DIM_SEX_CODE,VAL_DTHS_COUNT_NUMERIC"
    url = f"{who.GHE_API}?{urllib.parse.urlencode({'$filter': query, '$select': select})}"
    with open(download(url, "who", f"ghe-cancer-sites-{year}-v2.json"), encoding="utf-8") as f:
        rows = json.load(f)["value"]
    out: dict[str, dict[str, dict[int, float]]] = {}
    sexes = {v: k for k, v in CANCER_SEXES.items()}
    for r in rows:
        iso3 = who.to_iso3(r["DIM_COUNTRY_CODE"])
        if iso3 and r["DIM_SEX_CODE"] in sexes:
            out.setdefault(sexes[r["DIM_SEX_CODE"]], {}).setdefault(iso3, {})[r["DIM_GHECAUSE_CODE"]] = r["VAL_DTHS_COUNT_NUMERIC"] or 0.0
    return out


def _taiwan_cancer_sites() -> dict[str, dict[int, dict[int, float]]]:
    """衛福部死因統計：{性別: {年: {癌症部位: 死亡數}}}"""
    ranges = {site: mohw_deaths._ranges(spec.replace(",", " ")) for site, spec in CANCER_ICD10.items()}
    out: dict[str, dict[int, dict[int, float]]] = {"total": {}, "male": {}, "female": {}}
    for row in mohw_deaths._rows():
        code = str(row[2]).strip()
        if not code.startswith("C"):
            continue
        site = next((s for s, r in ranges.items() if mohw_deaths._within(code, r)), OTHER_CANCER)
        year, n = int(row[0]), float(row[3] or 0)
        for sex in ("total", TW_SEX.get(str(row[1]))):
            if sex:
                cell = out[sex].setdefault(year, {})
                cell[site] = cell.get(site, 0) + n
    return out


def _top_site(deaths: dict[int, float]) -> int | None:
    sites = {c: n for c, n in deaths.items() if c != OTHER_CANCER and n > 0}
    return max(sites, key=lambda c: sites[c]) if sites else None


def build_cancer_sites() -> None:
    out = OUT_DIR / "topics" / "disease" / "top-cancer"
    years = list(who.GHE_YEARS)
    series: dict[str, dict[str, dict[int, float]]] = {sex: {} for sex in CANCER_SEXES}
    for year in years:
        for sex, countries in _ghe_cancer_sites(year).items():
            for iso3, deaths in countries.items():
                top = _top_site(deaths)
                if top:
                    series[sex].setdefault(iso3, {})[year] = top
    taiwan = _taiwan_cancer_sites()
    for sex in CANCER_SEXES:
        for year, deaths in taiwan[sex].items():
            if year in years and (top := _top_site(deaths)):
                series[sex].setdefault("TWN", {})[year] = top
    zh, en = CANCER_INCIDENCE_NOTE
    for sex in CANCER_SEXES:
        write_json(out / f"{sex}.json", indicator_file(
            "top-cancer", "", years, {c: to_series(v, years, 0) for c, v in series[sex].items() if v},
            notes={"TWN": zh}, notesEn={"TWN": en},
        ))
        last = {c: v.get(years[-1]) for c, v in series[sex].items() if v.get(years[-1])}
        from collections import Counter
        print(f"  {sex} {years[-1]}：{len(last)} 國，{Counter(last.values()).most_common()}，台灣 {last.get('TWN')}")

