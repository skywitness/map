"""貧富差距主題：吉尼係數、極端貧窮人口比例、每人每日所得中位數、繁榮差距、所得最高 10% 與最低 50% 的份額。

- 吉尼係數、極端貧窮：World Bank Poverty and Inequality Platform（WDI 轉載，CC BY 4.0），依各國的家庭調查，
  年份零散，前端用 10 年內最近一年的值（latestWithin）。WDI 沒有台灣，台灣用 PIP API（sources/pip.py，「Taiwan, China」，
  主計總處家庭收支調查經盧森堡所得研究 LIS 整理，1981–2021 年 16 次）：跟其他國家同一套算法（使用者 2026-11-02 決定，
  製作手冊第十七批 272）。主計總處自己公布的吉尼係數（第 5 表每人、第 4 表每戶）寫在附註。
- 每人每日所得中位數、繁榮差距：PIP API（WDI 沒有中位數；繁榮差距 WDI 的 SI.SPR.PGAP 只到小數一位），世界的繁榮差距用 WDI 的 WLD。
- 所得份額：World Inequality Database（CC BY-NC-SA 4.0：非商業、相同方式分享），稅前國民所得、20 歲以上成人（夫妻平分），含台灣。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, latest_year_span, now_iso, to_series, write_json, year_span
from sources import fies, pip, wid, worldbank

LATEST_WITHIN = 10
TAIWAN = "TWN"


def build() -> None:
    out = OUT_DIR / "topics" / "inequality"
    taiwan = fies.inequality()
    last = max(taiwan)
    h = taiwan[last]

    # ── World Bank PIP：其他國家用 WDI，台灣與 WDI 沒有的兩個指標用 PIP API ──
    gini, _ = worldbank.fetch("SI.POV.GINI", 1980)
    poverty, poverty_world = worldbank.fetch("SI.POV.DDAY", 1980)
    _, pg_world = worldbank.fetch("SI.SPR.PGAP", 1980)
    survey = pip.survey_series(["gini", "headcount", "median", "pg"], gini)
    if TAIWAN in gini or TAIWAN not in survey["gini"]:
        raise RuntimeError("WDI 有台灣或 PIP API 沒有台灣，台灣的來源要重新檢查")
    gini[TAIWAN] = {y: v * 100 for y, v in survey["gini"][TAIWAN].items()}
    poverty[TAIWAN] = {y: v * 100 for y, v in survey["headcount"][TAIWAN].items()}
    median = survey["median"]
    pg = survey["pg"]
    version = pip.version()
    tw_last = max(gini[TAIWAN])
    source_zh = f"台灣用世界銀行 PIP API（{version}）的「Taiwan, China」：主計總處家庭收支調查經盧森堡所得研究（LIS）整理的每人可支配所得，跟其他國家同一套算法，最近一次是 {tw_last} 年。"
    source_en = (f"Taiwan comes from the World Bank PIP API ({version}), listed as \"Taiwan, China\": per-capita disposable income from DGBAS's "
                 f"Family Income and Expenditure Survey as harmonised by the Luxembourg Income Study, the same method as for other countries; the latest survey is {tw_last}.")
    gini_note = (
        source_zh + f"主計總處自己公布的 {last} 年吉尼係數：以每人計算（每戶可支配所得 ÷ 每戶人數）{h['gini_per_capita']:.3f}、"
        f"最高與最低 20% 差 {h['ratio_per_capita']:.2f} 倍；新聞常引用的以「戶」計算是 {h['gini_household']:.3f}、{h['ratio_household']:.2f} 倍。"
        "所得的定義、等值化與權數不同，所以跟 PIP 的數字不一樣。"
    )
    gini_note_en = (
        source_en + f" DGBAS's own figures for {last}: per person (household disposable income ÷ household size) a Gini of "
        f"{h['gini_per_capita']:.3f} and a top-to-bottom quintile ratio of {h['ratio_per_capita']:.2f}; per household, the figures "
        f"usually quoted, {h['gini_household']:.3f} and {h['ratio_household']:.2f}. Income definitions and weighting differ, so they do not match PIP."
    )
    poverty_note = (
        source_zh + "依國際貧窮線（每人每天 3 美元）幾乎沒有極端貧窮；台灣自己的低收入戶、中低收入戶依各縣市的最低生活費認定，標準不同，不能直接比。",
        source_en + " By the international poverty line ($3.00 a day) there is almost no extreme poverty; Taiwan's own low- and "
        "middle-low-income households are defined by each city's or county's minimum cost of living, a different standard that is not comparable.",
    )
    for key, series, world, unit, digits, note in [
        ("gini", gini, None, "", 2, (gini_note, gini_note_en)),
        ("poverty", poverty, poverty_world, "%", 2, poverty_note),
        ("median", median, None, "國際元／天", 2, (source_zh, source_en)),
        ("prosperity-gap", pg, pg_world, "", 2, (source_zh, source_en)),
    ]:
        years = latest_year_span(series, LATEST_WITHIN)
        extra: dict[str, object] = {"latestWithin": LATEST_WITHIN, "notes": {TAIWAN: note[0]}, "notesEn": {TAIWAN: note[1]}}
        if world:
            extra["aggregates"] = {"WLD": to_series(world, years, 2)}
        write_json(out / f"{key}.json", indicator_file(
            key, unit, years, {c: to_series(s, years, digits) for c, s in series.items() if s}, **extra,
        ))
    print(f"  PIP {version}：中位數 {len(median)} 國、繁榮差距 {len(pg)} 國；台灣 {tw_last} 年吉尼 {gini[TAIWAN][tw_last]:.1f}、"
          f"極端貧窮 {poverty[TAIWAN][tw_last]:.1f}%、中位數每天 {median[TAIWAN][tw_last]:.1f} 美元、繁榮差距 {pg[TAIWAN][tw_last]:.2f}")

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
        "source": "World Bank PIP (WDI, PIP API); World Inequality Database; 主計總處家庭收支調查",
    })
