"""就業與失業主題：失業率、青年失業率（15–24 歲）、非正式就業占總就業比例、勞動力參與率（15 歲以上）。

- 失業率、青年失業率、勞參率：國際勞工組織 ILOSTAT 的 ILO 模型估計（ILOEST，2025 年 11 月版，CC BY 4.0）。
  有申報的國家與年份用各國勞動力調查的值（obs_status R），沒有的由模型補上，所以 189 國每年都有。
  最新一年是模型推估（2025 年 11 月時還沒有任何國家的全年資料），標成推估（projectionFrom）；
  之後的 2026–2027 年是預測，不收（台灣沒有官方的預測值）。
- 非正式就業：ILO 的模型估計只有區域與世界的值（EMP_2IFL_SEX_RT_A），各國用 ILOSTAT 依各國勞動力調查
  原始資料調和的序列（EMP_NIFL_SEX_RT_A，ICLS 第 13 屆的定義，147 國），年份零散，用 latestWithin。
- 台灣：ILO 的模型估計也有台灣，但失業率只用到 2020 年以前台灣的實際資料，之後是模型推算
  （2024 年 3.71%，主計總處 3.38%），所以三個指標都改用主計總處人力資源調查（sources/dgbas_labour.py）。
  非正式就業台灣沒有 ILO 口徑的統計，附註列出人力運用調查的非典型就業對照，不畫在地圖上。
- 側欄的男女對照另外輸出 <指標>-female.json、<指標>-male.json（台灣也用人力資源調查的男女數字）。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, latest_year_span, now_iso, to_series, write_json, year_span
from sources import dgbas_labour, ilostat

Series = dict[str, dict[int, float]]

TAIWAN = "TWN"
UNEMPLOYMENT = "UNE_2EAP_SEX_AGE_RT_A"  # 失業率，依性別與年齡（ILO 模型估計）
PARTICIPATION = "EAP_2WAP_SEX_AGE_RT_A"  # 勞動力參與率，依性別與年齡（ILO 模型估計）
INFORMAL = "EMP_NIFL_SEX_RT_A"  # 非正式就業占總就業比例，依性別（各國調查的調和序列；X01 世界是模型估計）
ADULT, YOUTH = "AGE_YTHADULT_YGE15", "AGE_YTHADULT_Y15-24"
INFORMAL_WITHIN = 5  # 非正式就業：各國顯示 5 年內最近一年的值

# 主計總處 A040109010 的欄位：(指標, 年齡)
TAIWAN_KEYS = {
    "unemployment": ("unemployment", "15+"),
    "youth-unemployment": ("unemployment", "15-24"),
    "participation": ("participation", "15+"),
}
SEXES = {"SEX_T": "total", "SEX_F": "female", "SEX_M": "male"}

# ── ILOSTAT 已知的問題（2026 年 10 月下載的版本；ILOSTAT 修正後可以拿掉） ──
# 南非 2025 年的非正式就業 42.3%（2024 年 34.8%）：同一個來源，但農業的非正式比例從 35.4% 跳到 75.9%，
# 還多了一類 53.0% 的「無法分類」行業（之前沒有），是處理方式改了，不是真的增加，不收
INFORMAL_DROP = {("ZAF", 2025)}

# 只涵蓋部分地區的調查（ILOSTAT 的 note_source）：(中文, 英文)
COVERAGE_NOTES = {
    "S4:31": ("只涵蓋都市地區", "covers urban areas only"),
    "S4:33": ("只涵蓋主要城市或都會區", "covers main cities or metropolitan areas only"),
    "S4:6333": ("不含加薩走廊", "excludes the Gaza Strip"),
}


def _taiwan_definition_notes(last: int, value: float) -> tuple[str, str]:
    """台灣三個指標共用的附註後半：資料來源、最新值、口徑"""
    return (
        f"台灣改用主計總處人力資源調查的數字（{last} 年 {value:.2f}%）。調查範圍是臺灣地區（不含金門、連江）"
        "15 歲以上的民間人口，不含現役軍人與監管人口；失業者是無工作、隨時可以工作、正在找工作（或已找到工作還沒開始）的人，"
        "跟 ILO 的定義相同。",
        f"Taiwan's figures come from DGBAS's Manpower Survey ({value:.2f}% in {last}). The survey covers the civilian "
        "population aged 15 and over in Taiwan proper (excluding Kinmen and Lienchiang), so the armed forces and "
        "institutionalised people are left out; the unemployed are people without work who are available and looking "
        "for work (or waiting to start a job they have found), the same as the ILO definition.",
    )


def build() -> None:
    out = OUT_DIR / "topics" / "employment"
    taiwan = dgbas_labour.rates_by_sex_and_age()
    tw_last = max(taiwan[("unemployment", "total", "15+")])

    # ILO 模型估計：最後一年有「實際值」（各國申報）的下一年起是推估；只收到那一年
    real = ilostat.real_years(UNEMPLOYMENT, ADULT)
    projection_from = max(y for years in real.values() for y in years) + 1
    tw_real_last = max(real.get(TAIWAN, [0]))

    modelled = {
        "unemployment": ilostat.fetch_sexes(UNEMPLOYMENT, ADULT),
        "youth-unemployment": ilostat.fetch_sexes(UNEMPLOYMENT, YOUTH),
        "participation": ilostat.fetch_sexes(PARTICIPATION, ADULT),
    }
    for key, by_sex in modelled.items():
        field, age = TAIWAN_KEYS[key]
        ilo_tw = by_sex["SEX_T"][0].get(TAIWAN, {})
        tw_total = taiwan[(field, "total", age)]
        years = [y for y in year_span(by_sex["SEX_T"][0]) if y <= projection_from]
        # 對照：ILO 模型估計的台灣跟主計總處差最多的一年（只看有主計總處資料的年份）
        compare = max((y for y in years if y in ilo_tw and y in tw_total), key=lambda y: (abs(ilo_tw[y] - tw_total[y]), y))
        def_zh, def_en = _taiwan_definition_notes(tw_last, tw_total[tw_last])
        if key == "participation":
            # 勞參率沒有「實際值」的註記，改成比對：從頭到哪一年都跟主計總處相同（差不到 0.05 個百分點）
            common = [y for y in years if y in ilo_tw and y in tw_total]
            differs = [y for y in common if abs(ilo_tw[y] - tw_total[y]) >= 0.05]
            same_until = (differs[0] - 1) if differs else common[-1]
            ilo_zh = (
                f"ILO 的模型估計也有台灣，{same_until} 年以前跟主計總處的數字相同，之後是 ILO 的推算"
                f"（{compare} 年 {ilo_tw[compare]:.2f}%，主計總處 {tw_total[compare]:.2f}%）。"
            )
            ilo_en = (
                f"The ILO modelled estimates include Taiwan and match DGBAS up to {same_until}; later years are ILO "
                f"estimates ({ilo_tw[compare]:.2f}% in {compare} against DGBAS's {tw_total[compare]:.2f}%). "
            )
            def_zh += "就業者含每週工作 15 小時以上的無酬家屬工作者。"
            def_en += " Unpaid family workers count as employed if they work 15 hours a week or more."
        else:
            ilo_zh = (
                f"ILO 的模型估計也有台灣，但只用到 {tw_real_last} 年以前台灣的實際資料，之後是模型推算"
                f"（{compare} 年 {ilo_tw[compare]:.2f}%，主計總處 {tw_total[compare]:.2f}%）。"
            )
            ilo_en = (
                f"The ILO modelled estimates include Taiwan but use Taiwan's actual data only up to {tw_real_last}; later "
                f"years are model estimates ({ilo_tw[compare]:.2f}% in {compare} against DGBAS's {tw_total[compare]:.2f}%). "
            )
        tail_zh = f"{projection_from} 年其他國家是 ILO 的推估，台灣是主計總處的實際值。"
        tail_en = f" For {projection_from}, other countries are ILO projections while Taiwan's is the actual figure."
        notes = {TAIWAN: ilo_zh + def_zh + tail_zh}
        notes_en = {TAIWAN: ilo_en + def_en + tail_en}

        for sex, suffix in SEXES.items():
            countries, world = by_sex[sex]
            countries = dict(countries)
            countries[TAIWAN] = taiwan[(field, SEXES[sex], age)]
            extra: dict[str, object] = {
                "projectionFrom": projection_from,
                "aggregates": {"WLD": to_series(world, years, 2)},
            }
            if sex == "SEX_T":
                extra.update(notes=notes, notesEn=notes_en)
            name = key if sex == "SEX_T" else f"{key}-{suffix}"
            write_json(out / f"{name}.json", indicator_file(
                name, "%", years, {c: to_series(s, years, 2) for c, s in countries.items() if s}, **extra,
            ))

    _informal(out)
    write_json(out / "manifest.json", {
        "topic": "employment", "generatedAt": now_iso(),
        "source": "ILOSTAT (ILO modelled estimates, Nov. 2025; informal employment rate); 主計總處人力資源調查",
    })


def _informal(out) -> None:
    by_sex = ilostat.fetch_sexes(INFORMAL)
    for series, _world in by_sex.values():
        for iso3, year in INFORMAL_DROP:
            series.get(iso3, {}).pop(year, None)
    years = latest_year_span(by_sex["SEX_T"][0], INFORMAL_WITHIN)

    notes: dict[str, str] = {}
    notes_en: dict[str, str] = {}
    for code, (zh, en) in COVERAGE_NOTES.items():
        for iso3, flagged in ilostat.flagged_source(INFORMAL, code).items():
            shown = [y for y in flagged if years[0] <= y <= years[-1]]
            if shown:
                span = f"{shown[0]}" if len(shown) == 1 else f"{shown[0]}–{shown[-1]}"
                notes[iso3] = f"{span} 年的調查{zh}。"
                notes_en[iso3] = f"The survey for {span} {en}."
    notes["ZAF"] = (
        "ILOSTAT 2025 年的值是 42.3%（2024 年 34.8%），但農業的非正式比例從 35% 跳到 76%，還多了一類「無法分類」的行業，"
        "看起來是處理方式改了，所以不收 2025 年。"
    )
    notes_en["ZAF"] = (
        "ILOSTAT's 2025 figure is 42.3% (34.8% in 2024), but the informal share in agriculture jumps from 35% to 76% and a "
        "new 'not classified' industry appears, which points to a processing change, so 2025 is left out."
    )
    notes[TAIWAN] = (
        "台灣沒有 ILO 口徑的非正式就業統計（看雇主是否登記、有沒有勞健保等社會保險與帶薪假），所以留空。"
        "最接近的是主計總處人力運用調查的「非典型就業」（部分時間、臨時性或人力派遣）：115 年 5 月 79.3 萬人、"
        "占全體就業者 6.82%，是 102 年以來最低（115 年人力運用調查，2026-10-23 發布）。非典型看的是工時與契約期間，跟非正式就業的概念不同，只列在這裡對照。"
    )
    notes_en[TAIWAN] = (
        "Taiwan has no statistics on informal employment in the ILO sense (based on whether the employer is registered and "
        "whether the job carries social insurance and paid leave), so it is left blank. The closest figure is 'atypical "
        "employment' (part-time, temporary or agency work) in DGBAS's Manpower Utilization Survey: 793,000 people or 6.82% "
        "of the employed in May 2026, the lowest since 2013 (2026 survey, published 23 October 2026). Atypical work is about hours and contract "
        "length, a different concept from informality, so it is given here for reference only."
    )

    for sex, suffix in SEXES.items():
        countries, world = by_sex[sex]
        extra: dict[str, object] = {
            "latestWithin": INFORMAL_WITHIN,
            "aggregates": {"WLD": to_series(world, years, 1)},
        }
        if sex == "SEX_T":
            extra.update(notes=notes, notesEn=notes_en)
        name = "informal" if sex == "SEX_T" else f"informal-{suffix}"
        write_json(out / f"{name}.json", indicator_file(
            name, "%", years, {c: to_series(s, years, 1) for c, s in countries.items() if any(y in s for y in years)}, **extra,
        ))
