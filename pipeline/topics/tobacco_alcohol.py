"""菸酒主題：成人吸菸率（全部、男性、女性）、人均飲酒量（純酒精）、主要酒類與各類酒的消費量。

- 吸菸率：WHO GHO 的 M_Est_smk_curr_std（15 歲以上目前吸菸的比例，年齡標準化；含紙菸、雪茄、菸斗等燃燒式菸品，
  不含嚼菸、電子煙），出自《WHO 全球菸草使用趨勢報告》的模型估計：2000、2005、2007、2010、2015、2020、2022–2024 年，
  2025、2030 年是推估（projectionFrom）。三個指標用同一組門檻，才能互相比較。
- 人均飲酒量：WHO GHO 的 SA_0000001688（15 歲以上平均每人一年喝的純酒精公升數，SDG 3.5.2），
  有登記的銷售量加上自釀、走私等沒有登記的量，扣掉觀光客喝的，2000–2024 年，有世界值。
- 主要酒類與側欄的酒類組成：WHO GHO 的 SA_0000001400（有登記的人均消費量，依啤酒、葡萄酒、烈酒、其他分，
  純酒精公升）。主要酒類是四類裡最多的一類（類別圖），沒有登記資料的類別當成 0。
- 授權：WHO 的資料是 CC BY 4.0（見 sources/who.py）。

台灣不在 WHO 的資料中：
- 吸菸率：國健署「國人吸菸行為調查」的 18 歲以上成人吸菸率（sources/hpa.py），以台灣 2000 年的人口結構標準化，
  跟 WHO（15 歲以上、WHO 標準人口）不完全可比。調查 2018 年起兩年一次，WHO 的年份裡只有 2005、2007、2010、2015、
  2020、2022、2024 年對得上；指標檔加 latestWithin: 1，2023、2025 年顯示前一年的調查並標出資料年份。
- 飲酒量、酒類：財政部、國健署都沒有公布換算成純酒精的人均消費量，所以留空，附註寫 FAOSTAT 的酒類供給量
  （酒的重量，不是純酒精；飲食主題有）。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import hpa, who

OUT = OUT_DIR / "topics" / "tobacco-alcohol"

SMOKING_YEARS = [2000, 2005, 2007, 2010, 2015, 2020, 2022, 2023, 2024, 2025, 2030]
SMOKING_PROJECTION_FROM = 2025
SMOKING = {"smoking": ("SEX_BTSX", "total"), "smoking-male": ("SEX_MLE", "male"), "smoking-female": ("SEX_FMLE", "female")}
SEX_ZH = {"total": "", "male": "男性", "female": "女性"}
SEX_EN = {"total": "", "male": "men's ", "female": "women's "}

# 酒類：檔名 → (WHO 的 ALCOHOLTYPE, 主要酒類的代碼；前端 tobacco-alcohol.ts 用同一組)
BEVERAGES = {
    "beer": ("ALCOHOLTYPE_SA_BEER", 1),
    "wine": ("ALCOHOLTYPE_SA_WINE", 2),
    "spirits": ("ALCOHOLTYPE_SA_SPIRITS", 3),
    "other": ("ALCOHOLTYPE_SA_OTHER_ALCOHOL", 4),
}

TAIWAN_ALCOHOL = (
    "台灣不在 WHO 的資料中，財政部、國健署也沒有公布換算成純酒精的人均消費量，所以地圖上留空。"
    "FAOSTAT 的酒類供給量 2023 年平均每人 38.4 公斤（酒的重量，不是純酒精，見飲食主題）",
    "Taiwan is not in the WHO data, and neither the Ministry of Finance nor the Health Promotion Administration "
    "publishes consumption per person in pure alcohol, so it is left blank. FAOSTAT puts the supply of alcoholic "
    "beverages at 38.4 kg per person in 2023 (the weight of the drinks, not pure alcohol; see the diet topic)",
)


def build() -> None:
    # ── 吸菸率 ──
    taiwan = hpa.smoking()
    for key, (dim, sex) in SMOKING.items():
        series, _world = who.gho("M_Est_smk_curr_std", {"Dim1": dim})
        tw = taiwan[sex]
        series["TWN"] = {y: v for y, v in tw.items() if y in SMOKING_YEARS}
        last = max(series["TWN"])
        values = {iso3: to_series(s, SMOKING_YEARS, 1) for iso3, s in series.items()}
        note = (
            f"台灣不在 WHO 的資料中，改用國健署「國人吸菸行為調查」的 18 歲以上{SEX_ZH[sex]}吸菸率"
            f"（以台灣 2000 年的人口結構標準化；WHO 是 15 歲以上、用 WHO 的標準人口），{last} 年 {tw[last]}%。"
            "2018 年起調查兩年一次，2023、2025 年顯示前一年的調查",
            f"Taiwan is not in the WHO data; the Health Promotion Administration's Adult Smoking Behavior Survey is used "
            f"instead: {SEX_EN[sex]}smoking prevalence at ages 18+, standardised to Taiwan's 2000 population (WHO uses "
            f"ages 15+ and the WHO standard population), {tw[last]}% in {last}. The survey has been held every two years "
            "since 2018, so 2023 and 2025 show the previous survey",
        )
        write_json(
            OUT / f"{key}.json",
            indicator_file(
                key, "%", SMOKING_YEARS, values,
                projectionFrom=SMOKING_PROJECTION_FROM, latestWithin=1,
                notes={"TWN": note[0]}, notesEn={"TWN": note[1]},
            ),
        )
        print(f"  {key}：{len(values)} 國；台灣 {last} 年 {tw[last]}%")

    # ── 人均飲酒量 ──
    alcohol, world = who.gho("SA_0000001688", {"Dim1": "SEX_BTSX"})
    years = year_span(alcohol)
    values = {iso3: to_series(s, years, 2) for iso3, s in alcohol.items() if any(y in s for y in years)}
    write_json(
        OUT / "alcohol.json",
        indicator_file(
            "alcohol", "公升", years, values,
            aggregates={"WLD": to_series(world, years, 2)},
            notes={"TWN": TAIWAN_ALCOHOL[0]}, notesEn={"TWN": TAIWAN_ALCOHOL[1]},
        ),
    )
    print(f"  人均飲酒量：{years[0]}–{years[-1]}，{len(values)} 國；世界 {years[-1]} 年 {world[years[-1]]:.2f} 公升")

    # ── 各類酒有登記的消費量、主要酒類 ──
    by_type = {name: who.gho("SA_0000001400", {"Dim1": dim})[0] for name, (dim, _code) in BEVERAGES.items()}
    years = year_span(by_type["beer"])
    countries = set().union(*(set(s) for s in by_type.values()))
    for name, series in by_type.items():
        values = {iso3: to_series(s, years, 2) for iso3, s in series.items() if any(y in s for y in years)}
        write_json(OUT / "beverage" / f"{name}.json", indicator_file(name, "公升", years, values), quiet=True)
    main: dict[str, dict[int, float]] = {}
    for iso3 in countries:
        for y in years:
            amounts = {name: by_type[name].get(iso3, {}).get(y) for name in BEVERAGES}
            if all(v is None for v in amounts.values()):
                continue
            best = max(BEVERAGES, key=lambda n: amounts[n] or 0)
            if (amounts[best] or 0) > 0:
                main.setdefault(iso3, {})[y] = BEVERAGES[best][1]
    write_json(
        OUT / "main-beverage.json",
        indicator_file(
            "main-beverage", "類別", years,
            {iso3: to_series(s, years, 0) for iso3, s in main.items()},
            notes={"TWN": TAIWAN_ALCOHOL[0]}, notesEn={"TWN": TAIWAN_ALCOHOL[1]},
        ),
    )
    latest = {iso3: s[years[-1]] for iso3, s in main.items() if years[-1] in s}
    counts = {name: sum(1 for v in latest.values() if v == code) for name, (_dim, code) in BEVERAGES.items()}
    print(f"  酒類：{years[0]}–{years[-1]}，{len(main)} 國；{years[-1]} 年主要酒類 {counts}")

    write_json(
        OUT / "manifest.json",
        {
            "topic": "tobacco-alcohol",
            "generatedAt": now_iso(),
            "sources": [
                "WHO GHO M_Est_smk_curr_std, SA_0000001688, SA_0000001400",
                "國民健康署國人吸菸行為調查（data.gov.tw 14462 與網站的歷年成人吸菸率）",
            ],
        },
    )
