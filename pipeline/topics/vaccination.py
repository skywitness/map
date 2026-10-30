"""疫苗與防疫主題：兒童常規疫苗的接種率、零劑兒童，與 COVID-19 的確診死亡、疫苗接種、超額死亡。

- 兒童常規疫苗：WHO/UNICEF 的 WUENIC 2025 年版（`sources/wuenic.py`：2000 年起 WHO GHO、1980–1999 年世界銀行轉載，
  都是 CC BY 4.0）。DTP3、麻疹第一劑 1980–2025，麻疹第二劑 2000–2025，HPV（女孩第一劑）2010–2025。
- 零劑兒童：沒有打過任何一劑 DTP 的嬰兒人數 = 存活嬰兒（WPP 2024 的出生數 − 嬰兒死亡數）×（100% − DTP1）。
  WHO/UNICEF 的國家估計是用沒有四捨五入的接種率算的，這裡用公布的整數接種率，所以單一國家可能差幾個百分比；
  195 國加總跟 WHO 公布的全球數字差 1% 以內（_check_zero_dose()）。
- COVID-19 確診死亡（累計，每 10 萬人）：Our World in Data 轉載的 WHO 各國通報數（`sources/owid_covid.py`），每年年底的值，
  2020–2025。各國的檢驗量、死因認定與通報方式差很多，指標說明有寫。
  台灣不在 WHO 的資料裡：用衛福部死因統計裡死因是 COVID-19（ICD-10 U07）的人數累計（2020–2025 每年都有），
  跟疾管署通報的確診死亡（JHU 轉載，到 2023 年 2 月）對照，寫在附註與側欄。
- 完成 COVID-19 基礎劑的人口比例：OWID（含台灣），每年最後一筆，2021–2023（`latestWithin: 1`，當年沒有公布的國家顯示前一年）。
  台灣的人數跟疾管署的接種統計一致（_check_taiwan_vaccination()）。
- 超額死亡（累計，每 10 萬人，估計）：The Economist 的模型（MIT，`sources/economist_excess.py`），每年年底，2020–2023；
  側欄另外列 95% 區間與到 2024 年 6 月的變化。
- 台灣的常規疫苗：疾管署「預防接種統計」各年的完成率（`sources/cdc_tw.py`）：五合一第三劑 → DTP3、MMR 第一劑 → 麻疹第一劑，
  2015–2025。麻疹第二劑只有 2024 年，用疾管署的縣市別完成率依各縣市 5 歲人口加權自算（97.41%，製作手冊第八批 145）。
  HPV、零劑兒童沒有可以比的數字，附註寫官方公布的說法。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import cdc_tw, economist_excess, mohw_deaths, owid_covid, wpp, wuenic

OUT = OUT_DIR / "topics" / "vaccination"
LAST_YEAR = 2025
COVID_YEARS = list(range(2020, 2026))  # 確診死亡：每年年底
VACCINATED_YEARS = list(range(2021, 2024))  # 完成基礎劑：多數國家 2023 年就停止公布
EXCESS_YEARS = list(range(2020, 2024))  # 超額死亡：模型到 2024 年 6 月，只用完整的年份
FIRST_MONTH = "2020-01"

# 疾管署 2022-03-24 的「COVID-19 疫苗接種統計資料」（https://www.cdc.gov.tw/Uploads/e18e290d-fb96-4056-80ce-bed073c69b42.pdf ）：
# 第 1 劑 19,438,065 人（83.35%）、第 2 劑 18,223,457 人（78.15%），分母是戶籍人口
CECC_VACCINATION = ("2022-03-24", 83.35, 78.15)
CECC_VACCINATION_URL = "https://www.cdc.gov.tw/Uploads/e18e290d-fb96-4056-80ce-bed073c69b42.pdf"
# WHO/UNICEF 2026-07-15 公布：2025 年全球 1,350 萬名零劑兒童（沒有打過任何一劑 DTP）
WHO_ZERO_DOSE_2025 = 13.5e6

Series = dict[str, dict[int, float]]


def build() -> None:
    demo = wpp.demographic(["TPopulation1July", "Births", "InfantDeaths"], last_year=LAST_YEAR)
    population = demo["TPopulation1July"]  # 千人
    tw = cdc_tw.coverage()

    # ── 兒童常規疫苗 ──
    dtp1, _ = wuenic.coverage("dtp1")
    for antigen, first in (("dtp3", 1980), ("mcv1", 1980), ("mcv2", 2000), ("hpv", 2010)):
        countries, world = wuenic.coverage(antigen)
        years = list(range(first, LAST_YEAR + 1))
        values = {k: to_series(s, years, 0) for k, s in countries.items()}
        notes, notes_en = _coverage_notes(antigen, tw)
        if antigen in tw:
            digits = 2 if antigen == "mcv2" else 1  # 麻疹第二劑是自算的加權值，留到小數第二位（97.41%）
            values["TWN"] = to_series({y: round(v, digits) for y, v in tw[antigen].items()}, years)
        write_json(
            OUT / f"{antigen}.json",
            indicator_file(
                antigen, "%", years, values,
                aggregates={"WLD": to_series(world, years, 0)}, notes=notes, notesEn=notes_en,
            ),
        )
        print(f"  {antigen}：{len(values)} 國，{years[0]}–{years[-1]}，{LAST_YEAR} 年世界 {world.get(LAST_YEAR)}%")

    # ── 零劑兒童 ──
    zero = _zero_dose(dtp1, demo["Births"], demo["InfantDeaths"])
    zero_years = list(range(wuenic.GHO_FROM, LAST_YEAR + 1))
    world_zero = {y: sum(s.get(y, 0) for s in zero.values()) for y in zero_years}
    _check_zero_dose(world_zero)
    write_json(
        OUT / "zero-dose.json",
        indicator_file(
            "zero-dose", "人", zero_years, {k: to_series(s, zero_years, 0) for k, s in zero.items()},
            aggregates={"WLD": to_series(world_zero, zero_years, 0)},
            notes={"TWN": TW_ZERO_DOSE_NOTE}, notesEn={"TWN": TW_ZERO_DOSE_NOTE_EN},
        ),
    )

    # ── COVID-19 ──
    covid = owid_covid.compact()
    excess = economist_excess.excess()
    jhu = owid_covid.jhu_deaths()
    cecc = jhu["Taiwan"]
    certificates = mohw_deaths.deaths_by_code("U07")
    _check_taiwan_vaccination(covid["TWN"])
    china_note = _china_note(covid["CHN"].death_count, jhu)

    deaths = {k: {y: v / 10 for y in COVID_YEARS if (v := _at_year_end(c.deaths, y)) is not None} for k, c in covid.items()}
    world_deaths = deaths.pop("WLD")
    deaths = {k: s for k, s in deaths.items() if s}
    tw_cum = _cumulative({y: certificates[y] for y in COVID_YEARS})
    deaths["TWN"] = {y: n / (population["TWN"][y] * 1000) * 1e5 for y, n in tw_cum.items()}
    tw_cecc_year_end = {y: v for y in (2020, 2021, 2022) if (v := _at_year_end(cecc, y)) is not None}
    death_notes = _taiwan_death_notes(certificates, tw_cum, tw_cecc_year_end, cecc)
    write_json(
        OUT / "covid-deaths.json",
        indicator_file(
            "covid-deaths", "每 10 萬人", COVID_YEARS, {k: to_series(s, COVID_YEARS, 1) for k, s in deaths.items()},
            aggregates={"WLD": to_series(world_deaths, COVID_YEARS, 1)},
            notes={"TWN": death_notes[0], "CHN": china_note[0]}, notesEn={"TWN": death_notes[1], "CHN": china_note[1]},
        ),
    )

    fully = {k: {y: v for y in VACCINATED_YEARS if (v := _in_year(c.fully, y)) is not None} for k, c in covid.items()}
    world_fully = fully.pop("WLD")
    fully = {k: s for k, s in fully.items() if s}
    tw_last = max(covid["TWN"].fully)
    write_json(
        OUT / "covid-vaccinated.json",
        indicator_file(
            "covid-vaccinated", "%", VACCINATED_YEARS, {k: to_series(s, VACCINATED_YEARS, 1) for k, s in fully.items()},
            aggregates={"WLD": to_series(world_fully, VACCINATED_YEARS, 1)}, latestWithin=1,
            notes={"TWN": _taiwan_vaccination_note(covid["TWN"], tw_last)[0]},
            notesEn={"TWN": _taiwan_vaccination_note(covid["TWN"], tw_last)[1]},
        ),
    )

    excess_year_end = {
        k: {y: e for y in EXCESS_YEARS if (e := _at_year_end(s, y)) is not None} for k, s in excess.items()
    }
    world_excess = {y: e.value for y, e in excess_year_end.pop("WLD").items()}
    write_json(
        OUT / "excess-deaths.json",
        indicator_file(
            "excess-deaths", "每 10 萬人", EXCESS_YEARS,
            {k: to_series({y: e.value for y, e in s.items()}, EXCESS_YEARS, 1) for k, s in excess_year_end.items() if s},
            aggregates={"WLD": to_series(world_excess, EXCESS_YEARS, 1)},
        ),
    )

    # ── 側欄：每個國家每月的 COVID-19 時間線 ──
    months = _months(FIRST_MONTH, max(d for c in covid.values() for d in c.deaths)[:7])
    written = 0
    for iso3 in sorted((set(covid) | set(excess)) - {"WLD"}):
        c = covid.get(iso3, owid_covid.Covid())
        e = excess.get(iso3, {})
        if iso3 == "TWN":
            pop = population["TWN"]
            confirmed = {d: v / (pop[int(d[:4])] * 1000) * 1e5 for d, v in cecc.items()}
        else:
            confirmed = {d: v / 10 for d, v in c.deaths.items()}
        timeline = {
            "start": FIRST_MONTH,
            "deaths": _monthly(confirmed, months, carry=True),
            "excess": _monthly({d: x.value for d, x in e.items()}, months, carry=True),
            "vaccinated": _monthly(c.vaccinated, months),
            "fully": _monthly(c.fully, months),
            # 每年年底與最後一筆（2024-06-17）的 95% 區間
            "excessRange": {
                str(y): [round(x.low, 1), round(x.high, 1)] for y in EXCESS_YEARS if (x := _at_year_end(e, y)) is not None
            },
        }
        if e:
            last = max(e)
            timeline["excessLast"] = [last, round(e[last].value, 1), round(e[last].low, 1), round(e[last].high, 1)]
        if iso3 == "TWN":
            timeline["certificates"] = {str(y): int(n) for y, n in sorted(certificates.items()) if y >= 2020}
            timeline["cecc"] = {str(y): int(v) for y, v in tw_cecc_year_end.items()}
            last = max(cecc)
            timeline["ceccLast"] = [last, int(cecc[last])]
        if not any(timeline[k] for k in ("deaths", "excess", "vaccinated", "fully")):
            continue
        write_json(OUT / "covid" / f"{iso3}.json", timeline, quiet=True)
        written += 1
    print(f"  側欄的 COVID-19 時間線：{written} 個國家，{months[0]}–{months[-1]}")

    write_json(
        OUT / "manifest.json",
        {
            "generatedAt": now_iso(),
            "wuenic": "WHO/UNICEF Estimates of National Immunization Coverage, 2025 revision (WHO GHO; World Bank WDI for 1980–1999)",
            "owidCovid": owid_covid.COMPACT_URL,
            "owidLastDeaths": max(d for d in covid["WLD"].deaths),
            "owidLastVaccination": max(d for d in covid["WLD"].fully),
            "economist": economist_excess.BASE,
            "economistLicence": (
                "MIT License. Copyright (c) 2021 The Economist Newspaper. Permission is hereby granted, free of charge, "
                "to any person obtaining a copy of this software and associated documentation files (the \"Software\"), "
                "to deal in the Software without restriction, including without limitation the rights to use, copy, modify, "
                "merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom "
                "the Software is furnished to do so, subject to the following conditions: The above copyright notice and "
                "this permission notice shall be included in all copies or substantial portions of the Software. "
                "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND."
            ),
            "economistCitation": "The Economist and Solstad, S. (corresponding author), 2021. The pandemic's true death toll.",
            "taiwanCoverage": cdc_tw.PAGE,
        },
    )

    tw_d = deaths["TWN"]
    print(
        f"  台灣：DTP3（五合一第三劑）{LAST_YEAR} 年 {tw['dtp3'][LAST_YEAR]}%、MMR 第一劑 {tw['mcv1'][LAST_YEAR]}%；"
        f"COVID-19 死亡（死因統計累計）{LAST_YEAR} 年 {tw_cum[LAST_YEAR]:,.0f} 人、每 10 萬人 {tw_d[LAST_YEAR]:.1f}；"
        f"完成基礎劑 {covid['TWN'].fully[tw_last]:.1f}%（{tw_last}）；超額死亡 2023 年底 {excess_year_end['TWN'][2023].value:.1f}"
    )


# ── 附註 ──────────────────────────────────────────────

TW_COVERAGE_NOTE = {
    "dtp3": (
        "台灣不在 WHO/UNICEF 的估計裡（台灣不是 WHO 會員）。這裡用疾管署「預防接種統計」公布的五合一疫苗"
        "（白喉、破傷風、百日咳、b 型嗜血桿菌、小兒麻痺）第三劑接種完成率：全國性預防接種資訊管理系統（NIIS）每年 12 月底的資料，"
        "統計前一年出生的幼兒（出生滿 6 個月接種），2015 年起。WHO/UNICEF 的 DTP3 是當年滿 1 歲的嬰兒，定義接近但不完全相同。",
        "Taiwan is not in the WHO/UNICEF estimates (it is not a WHO member). Its figure is the completion rate of the third dose of "
        "the five-in-one vaccine (diphtheria, tetanus, pertussis, Hib and polio) published by Taiwan CDC from the National "
        "Immunization Information System at the end of each year, for children born the previous year (dose given at 6 months), "
        "since 2015. WHO/UNICEF DTP3 refers to children reaching age one that year, a close but not identical definition.",
    ),
    "mcv1": (
        "台灣不在 WHO/UNICEF 的估計裡。這裡用疾管署公布的 MMR（麻疹、腮腺炎、德國麻疹混合疫苗）第一劑接種完成率："
        "每年 12 月底的資料，統計前兩年出生的幼兒（出生滿 12 個月接種），2015 年起。",
        "Taiwan is not in the WHO/UNICEF estimates. Its figure is the completion rate of the first dose of MMR (measles, mumps "
        "and rubella) published by Taiwan CDC at the end of each year, for children born two years earlier (dose given at 12 "
        "months), since 2015.",
    ),
    "mcv2": (
        "台灣不在 WHO/UNICEF 的估計裡。MMR 第二劑在滿 5 歲到入小學前接種；疾管署沒有公布全國的第二劑完成率，"
        "這裡是自算的估計，只有 2024 年：疾管署開放資料「各縣市衛生所及合約醫院診所 2024 年預防接種完成率統計」的 22 個縣市"
        "完成率，用內政部 2024 年 12 月底各縣市的 5 歲戶籍人口加權（縣市的完成率沒有附分母，權重是戶籍人口；用 6 歲人口加權也是 97.41%，"
        "同法算第一劑 98.77%，疾管署公布的是 98.7%）。統計對象是衛生所及合約醫院診所。疾管署 2025 年 1 月 9 日的致醫界通函"
        "第 559 號寫「近年2劑接種完成率均高達97%以上」。",
        "Taiwan is not in the WHO/UNICEF estimates. The second MMR dose is given between age five and primary school. Taiwan CDC "
        "publishes no national completion rate for the second dose, so this is an estimate for 2024 only: the completion rates of "
        "Taiwan's 22 counties and cities in Taiwan CDC's open data on immunization coverage at health stations and contracted "
        "clinics in 2024, weighted by each county's registered population aged five at the end of 2024 (the county rates come "
        "without denominators; weighting by age six also gives 97.41%, and the same method gives 98.77% for the first dose "
        "against Taiwan CDC's published 98.7%). Taiwan CDC said in a letter to physicians on 9 January 2025 (no. 559) that "
        "completion of both doses has been above 97% in recent years.",
    ),
    "hpv": (
        "台灣不在 WHO 的估計裡。國中女生的公費 HPV 疫苗 2018 年 12 月開始，國健署公布的是完成兩劑的比例（依入學年度，統計到 2024 年 4 月）："
        + "、".join(f"{y} 年入學 {v}%" for y, v in cdc_tw.HPV_COMPLETE_BY_ENTRY.items())
        + "；WHO 的指標是第一劑，定義不同，所以地圖上沒有值。2025 年 9 月起國中男生也可以公費接種。",
        "Taiwan is not in the WHO estimates. Free HPV vaccination for junior high school girls began in December 2018; the Health "
        "Promotion Administration publishes the share completing two doses by school-entry year (as of April 2024): "
        + ", ".join(f"{v}% for the {y} intake" for y, v in cdc_tw.HPV_COMPLETE_BY_ENTRY.items())
        + ". The WHO indicator counts the first dose, so the map has no value. Boys have been eligible since September 2025.",
    ),
}
TW_ZERO_DOSE_NOTE = "台灣不在 WHO/UNICEF 的估計裡；疾管署公布的完成率只有五合一疫苗的第三、四劑，沒有第一劑，所以算不出零劑兒童。"
TW_ZERO_DOSE_NOTE_EN = (
    "Taiwan is not in the WHO/UNICEF estimates, and Taiwan CDC publishes completion rates only for the third and fourth "
    "doses of the five-in-one vaccine, not the first, so zero-dose children cannot be estimated."
)


def _coverage_notes(antigen: str, tw: Series) -> tuple[dict[str, str], dict[str, str]]:
    zh, en = TW_COVERAGE_NOTE[antigen]
    if antigen in tw:
        last = max(tw[antigen])
        zh += f"{last} 年 {tw[antigen][last]}%。"
        en += f" {last}: {tw[antigen][last]}%."
    return {"TWN": zh}, {"TWN": en}


def _taiwan_death_notes(
    certificates: dict[int, float], cum: dict[int, float], cecc_year_end: dict[int, float], cecc: dict[str, float]
) -> tuple[str, str]:
    by_year_zh = "、".join(f"{y} 年 {certificates[y]:,.0f}" for y in COVID_YEARS)
    by_year_en = ", ".join(f"{certificates[y]:,.0f} in {y}" for y in COVID_YEARS)
    cecc_zh = "、".join(f"{y} 年底 {v:,.0f}" for y, v in cecc_year_end.items())
    cecc_en = ", ".join(f"{v:,.0f} at the end of {y}" for y, v in cecc_year_end.items())
    last = max(cecc)
    return (
        "WHO 的 COVID-19 資料沒有單獨列出台灣（台灣通報的確診死亡含在 WHO 的「中國」數字裡）。"
        "這裡用衛福部死因統計裡死因是 COVID-19（ICD-10 U07）的人數累計：" + by_year_zh
        + f" 人，{COVID_YEARS[-1]} 年底累計 {cum[COVID_YEARS[-1]]:,.0f} 人。疾管署（中央流行疫情指揮中心）通報的確診死亡累計是 "
        + cecc_zh + f" 人、{last} 為 {cecc[last]:,.0f} 人，2023 年 3 月 20 日起只通報併發重症，所以接不到之後的年份。",
        "The WHO COVID-19 data do not list Taiwan separately (deaths reported by Taiwan are included in WHO's figure for China). "
        "Taiwan's figure here is the cumulative number of deaths with COVID-19 (ICD-10 U07) as the "
        "underlying cause in Ministry of Health and Welfare cause-of-death statistics: " + by_year_en
        + f"; {cum[COVID_YEARS[-1]]:,.0f} by the end of {COVID_YEARS[-1]}. Confirmed deaths reported by Taiwan CDC (the Central "
        "Epidemic Command Center) were " + cecc_en + f", and {cecc[last]:,.0f} on {last}; from 20 March 2023 only severe cases "
        "were reported, so that series cannot be extended.",
    )


CHINA_CHECK_DATE = "2022-11-30"  # 台灣、香港的疫情都已經過了高峰，中國大陸 12 月才大量增加


def _china_note(who_china: dict[str, float], jhu: dict[str, dict[str, float]]) -> tuple[str, str]:
    """WHO 的「China」含香港、澳門與台灣：跟 JHU 分開列的中國大陸、香港、澳門、台灣加總比"""
    d = CHINA_CHECK_DATE
    parts = {n: jhu[n][d] for n in ("China", "Hong Kong", "Macao", "Taiwan")}
    total, without_tw = sum(parts.values()), sum(v for n, v in parts.items() if n != "Taiwan")
    who = who_china[max(k for k in who_china if k <= d)]
    if abs(who / total - 1) > 0.02 or abs(who / without_tw - 1) < 0.2:
        raise RuntimeError(f"WHO 的中國 {who:,.0f} 跟 JHU 的加總 {total:,.0f} 對不起來，WHO 的分法可能改了")
    p = {n: f"{v:,.0f}" for n, v in parts.items()}
    return (
        f"WHO 的「中國」含香港、澳門與台灣通報的確診死亡：{d} WHO 的中國累計 {who:,.0f} 人，"
        f"JHU 分開列的中國大陸 {p['China']}、香港 {p['Hong Kong']}、澳門 {p['Macao']}、台灣 {p['Taiwan']} 人，加起來 {total:,.0f} 人。"
        "每 10 萬人的分母只有中國大陸的人口。",
        f"WHO's figure for China includes confirmed deaths reported by Hong Kong, Macao and Taiwan: on {d} WHO's cumulative total "
        f"for China was {who:,.0f}, while JHU listed {p['China']} for mainland China, {p['Hong Kong']} for Hong Kong, "
        f"{p['Macao']} for Macao and {p['Taiwan']} for Taiwan, {total:,.0f} in all. The per-100,000 rate uses the population of "
        "mainland China only.",
    )


def _taiwan_vaccination_note(tw: owid_covid.Covid, last: str) -> tuple[str, str]:
    date, first, second = CECC_VACCINATION
    return (
        f"台灣的數字是疾管署公布的接種人數（OWID 整理，最後一筆是 {last}，{tw.fully[last]:.1f}%），分母是聯合國的人口，"
        f"所以比疾管署用戶籍人口算的比例略低：{date} 疾管署公布第 1 劑 {first}%、第 2 劑 {second}%，"
        f"這裡是 {tw.vaccinated[date]:.2f}%、{tw.fully[date]:.2f}%（人數相同）。",
        f"Taiwan's figures are vaccination counts published by Taiwan CDC (compiled by OWID; last update {last}, "
        f"{tw.fully[last]:.1f}%). The denominator is the UN population, so the shares are slightly lower than Taiwan CDC's, which "
        f"use the household-registered population: on {date} Taiwan CDC reported {first}% with a first dose and {second}% with a "
        f"second, against {tw.vaccinated[date]:.2f}% and {tw.fully[date]:.2f}% here (the counts are the same).",
    )


# ── 計算 ──────────────────────────────────────────────


def _zero_dose(dtp1: Series, births: Series, infant_deaths: Series) -> Series:
    """沒有打過任何一劑 DTP 的嬰兒人數：存活嬰兒 ×（100 − DTP1）÷ 100"""
    out: Series = {}
    for iso3, s in dtp1.items():
        for y, cov in s.items():
            b, d = births.get(iso3, {}).get(y), infant_deaths.get(iso3, {}).get(y)
            if b is None or d is None:
                continue
            # 接種率是整數，算出來的人數只有前兩三位有意義，四捨五入到百位
            out.setdefault(iso3, {})[y] = round((b - d) * 1000 * (100 - cov) / 100, -2)
    return out


def _check_zero_dose(world: dict[int, float]) -> None:
    v = world[LAST_YEAR]
    print(f"  零劑兒童：{LAST_YEAR} 年 195 國加總 {v / 1e6:.2f} 百萬（WHO/UNICEF 公布 {WHO_ZERO_DOSE_2025 / 1e6:.1f} 百萬）")
    if abs(v / WHO_ZERO_DOSE_2025 - 1) > 0.03:
        raise RuntimeError("零劑兒童的加總跟 WHO/UNICEF 公布的差太多，人口或接種率可能讀錯了")


def _check_taiwan_vaccination(tw: owid_covid.Covid) -> None:
    """OWID 的台灣跟疾管署的接種統計比：人數相同，只是分母不同（UN 人口比戶籍人口多約 0.4%）"""
    date, first, second = CECC_VACCINATION
    for name, mine, theirs in (("第 1 劑", tw.vaccinated[date], first), ("第 2 劑", tw.fully[date], second)):
        if not 0 < theirs - mine < 1:
            raise RuntimeError(f"台灣 {date} 的{name}：OWID {mine:.2f}%、疾管署 {theirs}%，差太多")


def _cumulative(by_year: dict[int, float]) -> dict[int, float]:
    out, total = {}, 0.0
    for y in sorted(by_year):
        total += by_year[y]
        out[y] = total
    return out


def _at_year_end(series: dict, year: int):
    """累計的序列在那一年年底（含）以前最後一筆的值；那一年以前都沒有資料時回傳 None"""
    dates = [d for d in series if d <= f"{year}-12-31"]
    return series[max(dates)] if dates and max(dates) >= f"{year}-01-01" else None


def _in_year(series: dict[str, float], year: int) -> float | None:
    """那一年最後一次公布的值（那一年沒有公布就是 None）"""
    dates = [d for d in series if d.startswith(str(year))]
    return series[max(dates)] if dates else None


def _months(first: str, last: str) -> list[str]:
    y, m = int(first[:4]), int(first[5:])
    out = []
    while f"{y}-{m:02d}" <= last:
        out.append(f"{y}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def _monthly(series: dict[str, float], months: list[str], carry: bool = False) -> list[float | None]:
    """每個月最後一筆（一位小數），結尾的 null 去掉。carry 為 True（累計值）時，沒有新資料的月份沿用之前的值，到最後一筆為止"""
    last: dict[str, float] = {}
    for d in sorted(series):
        last[d[:7]] = series[d]  # 同一個月後面的日期蓋掉前面的
    out: list[float | None] = []
    prev = None
    final = max(last) if last else ""
    for m in months:
        if m in last:
            prev = last[m]
            out.append(round(prev, 1))
        elif carry and prev is not None and m < final:
            out.append(round(prev, 1))
        else:
            out.append(None)
    while out and out[-1] is None:
        out.pop()
    return out
