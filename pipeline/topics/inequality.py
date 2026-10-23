"""貧富差距主題：吉尼係數、極端貧窮人口比例、所得最高 10% 與最低 50% 的份額。

- 吉尼係數、極端貧窮：World Bank Poverty and Inequality Platform（WDI 轉載，CC BY 4.0），依各國的家庭調查，
  年份零散，前端用 10 年內最近一年的值（latestWithin）。沒有台灣。
- 所得份額：World Inequality Database（CC BY 4.0），稅前國民所得、20 歲以上成人（夫妻平分），含台灣。
- 台灣的吉尼係數：主計總處家庭收支調查第 5 表，每人可支配所得（每戶所得 ÷ 每戶人數），跟 PIP 的每人所得比較接近；
  附註寫出新聞常引用的「以戶計算」的吉尼係數與五等分位倍數。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, latest_year_span, now_iso, to_series, write_json, year_span
from sources import fies, wid, worldbank

LATEST_WITHIN = 10
TAIWAN = "TWN"


def build() -> None:
    out = OUT_DIR / "topics" / "inequality"
    taiwan = fies.inequality()
    last = max(taiwan)
    tw_gini = {y: v["gini_per_capita"] * 100 for y, v in taiwan.items() if "gini_per_capita" in v}

    # ── World Bank PIP ──
    gini, _ = worldbank.fetch("SI.POV.GINI", 1980)
    gini[TAIWAN] = tw_gini
    poverty, poverty_world = worldbank.fetch("SI.POV.DDAY", 1980)
    h = taiwan[last]
    gini_note = (
        "台灣不在世界銀行 PIP 裡，改用主計總處家庭收支調查的每人可支配所得（每戶所得 ÷ 每戶人數）吉尼係數。"
        f"新聞常引用的是以「戶」計算的數字：{last} 年吉尼係數 {h['gini_household']:.3f}、"
        f"最高與最低 20% 家庭的所得差距 {h['ratio_household']:.2f} 倍；以每人計算是 {h['gini_per_capita']:.3f}、{h['ratio_per_capita']:.2f} 倍。"
    )
    gini_note_en = (
        "Taiwan is not in the World Bank PIP; the Gini of per-capita disposable income (household income ÷ household size) "
        "from DGBAS's Family Income and Expenditure Survey is used instead. The figures usually quoted are per household: "
        f"in {last} a Gini of {h['gini_household']:.3f} and a top-to-bottom quintile ratio of {h['ratio_household']:.2f}; "
        f"per person they are {h['gini_per_capita']:.3f} and {h['ratio_per_capita']:.2f}."
    )
    for key, series, world, unit, note in [
        ("gini", gini, None, "", (gini_note, gini_note_en)),
        ("poverty", poverty, poverty_world, "%", (
            "台灣不在世界銀行 PIP 裡。依國際貧窮線（每人每天 3 美元）幾乎沒有極端貧窮；"
            "台灣自己的低收入戶、中低收入戶依各縣市的最低生活費認定，標準不同，不能直接比。",
            "Taiwan is not in the World Bank PIP. By the international poverty line ($3.00 a day) there is almost no "
            "extreme poverty; Taiwan's own low- and middle-low-income households are defined by each city's or county's "
            "minimum cost of living, a different standard that is not comparable.",
        )),
    ]:
        years = latest_year_span(series, LATEST_WITHIN)
        extra: dict[str, object] = {"latestWithin": LATEST_WITHIN, "notes": {TAIWAN: note[0]}, "notesEn": {TAIWAN: note[1]}}
        if world:
            extra["aggregates"] = {"WLD": to_series(world, years, 2)}
        write_json(out / f"{key}.json", indicator_file(
            key, unit, years, {c: to_series(s, years, 2) for c, s in series.items() if s}, **extra,
        ))

    # ── WID ──
    data = wid.series(wid.ALL)
    for key, var in [("top10", ("sptincj992", "p90p100")), ("bottom50", ("sptincj992", "p0p50"))]:
        series = {c: {y: v * 100 for y, v in s.items() if y >= 1980} for c, s in data[var].items()}
        world = series.pop("WLD", {})
        years = year_span(series)
        write_json(out / f"{key}.json", indicator_file(
            key, "%", years, {c: to_series(s, years, 1) for c, s in series.items() if s},
            aggregates={"WLD": to_series(world, years, 1)},
        ))

    write_json(out / "manifest.json", {
        "topic": "inequality", "generatedAt": now_iso(),
        "source": "World Bank PIP (WDI); World Inequality Database; 主計總處家庭收支調查",
    })
