"""健康主題：平均壽命、嬰兒與五歲以下死亡率、醫療支出與誰來付、醫師、護理人員與病床數。

- 壽命與死亡率用 UN WPP 2024（各國同一套估計方法），只取 2023 年以前的估計值。
  台灣改用內政部的簡易生命表：WPP 對台灣的估計跟官方差不少，嬰幼兒死亡率差最多。
- 醫療支出（含家庭自付、政府與健保的比重）、醫師、護理人員、病床數用 World Bank WDI
  （WHO 全球醫療支出資料庫、全球衛生人力統計）；WDI 沒有台灣，台灣用衛生福利部的國民醫療保健支出、
  衛生福利統計指標。人均自付的國際元由台灣的新臺幣金額除以 IMF 的購買力平價換算。
"""
from __future__ import annotations

from common import append_note, later_years_note, OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import imf, moi, mohw, mohw_deaths, ris_marriage, worldbank, wpp

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
        notes = taiwan_notes(key, un_taiwan) if key in TAIWAN_NOTES else {"notes": {}, "notesEn": {}}
        # 內政部比時間軸更新的年份（例如 2025 年的簡易生命表）寫在附註（製作手冊第八批 159）
        unit_en = "years" if unit == "歲" else unit
        append_note(notes["notes"], notes["notesEn"], "TWN", later_years_note(
            taiwan_life[key], years, lambda v: f"{v:.{digits}f} {unit}", lambda v: f"{v:.{digits}f} {unit_en}"))
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, {iso3: to_series(s, years, digits) for iso3, s in countries.items()},
                aggregates={"WLD": to_series(world, years, digits)},
                **{k: v for k, v in notes.items() if v},
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
    build_maternal()
    write_json(
        out / "manifest.json",
        {"topic": "health", "generatedAt": now_iso(), "source": "UN WPP 2024; 內政部; World Bank WDI (WHO); 衛生福利部; IMF WEO"},
    )


# ── 孕產婦死亡率（2026-10-29 擴充，製作手冊第五批 45） ───────────────────────
# 各國：WHO 等機構的 MMEIG 模型估計（WDI 的 SH.STA.MMRT，CC BY 4.0）。台灣不在裡面，依 WHO 的定義（懷孕期間或產後 42 天內、
# 排除意外）用衛福部死因統計自己算：ICD-10 的 O00–O99 去掉 O96（產後 42 天到 1 年的晚期孕產死亡）、O97（後遺症），
# 加上 A34（產科破傷風），除以戶政司的出生數（按登記）。
MATERNAL_EXCLUDE = ("O96", "O97")


def taiwan_maternal_deaths() -> dict[int, float]:
    out: dict[int, float] = {}
    for row in mohw_deaths._rows():
        code = str(row[2]).strip()
        if (code.startswith("O") and not code.startswith(MATERNAL_EXCLUDE)) or code.startswith("A34"):
            out[int(row[0])] = out.get(int(row[0]), 0) + float(row[3] or 0)
    return out


def build_maternal() -> None:
    out = OUT_DIR / "topics" / "health"
    countries, world = worldbank.fetch("SH.STA.MMRT", 1985)
    deaths, births = taiwan_maternal_deaths(), ris_marriage.births()
    taiwan = {y: deaths[y] / births[y] * 1e5 for y in births if y >= 2008 and y in deaths}
    years = year_span(countries)
    extra_years = [y for y in sorted(taiwan) if y > years[-1]]
    later = "、".join(f"{y} 年 {taiwan[y]:.1f}（{deaths.get(y, 0):.0f} 人）" for y in extra_years)
    later_en = ", ".join(f"{taiwan[y]:.1f} in {y} ({deaths.get(y, 0):.0f} deaths)" for y in extra_years)
    countries["TWN"] = taiwan
    last = years[-1]
    write_json(out / "maternal-mortality.json", indicator_file(
        "maternal-mortality", "每十萬活產", years, {c: to_series(v, years, 1) for c, v in countries.items() if v},
        aggregates={"WLD": to_series(world, years, 0)},
        notes={"TWN": "台灣不在 WHO 的估計裡，依 WHO 的定義（懷孕期間或產後 42 天內、排除意外）用衛福部死因統計自己算："
                      "ICD-10 的 O00–O99 去掉 O96、O97，加上 A34，除以戶政司的出生數（按登記），2008 年起。"
                      f"{last} 年 {taiwan[last]:.1f}（{deaths.get(last, 0):.0f} 人）" + (f"；{later}" if later else "") +
                      "。WHO 的是模型估計，會補報告不全的部分，兩者不完全可比。"},
        notesEn={"TWN": "Taiwan is not in the WHO estimates; computed with WHO's definition (deaths during pregnancy or within 42 days, "
                        "excluding accidental causes) from the Ministry of Health and Welfare's death statistics: ICD-10 O00–O99 "
                        "except O96 and O97, plus A34, divided by registered births, from 2008. "
                        f"{taiwan[last]:.1f} in {last} ({deaths.get(last, 0):.0f} deaths)" + (f"; {later_en}" if later_en else "") +
                        ". WHO's figures are modelled estimates that adjust for under-reporting, so the two are not fully comparable."},
    ))
    ranked = sorted((v.get(last), c) for c, v in countries.items() if v.get(last) is not None)
    print(f"  孕產婦死亡率 {years[0]}–{last}：{len(ranked)} 國，最高 {ranked[-4:]}，最低 {ranked[:4]}，世界 {world.get(last)}")
    print(f"  台灣：{ {y: (round(v, 1), deaths.get(y)) for y, v in sorted(taiwan.items())} }")

