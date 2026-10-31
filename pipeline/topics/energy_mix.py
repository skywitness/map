"""石油、天然氣與煤主題的擴充（2026-10-31，製作手冊第十批 163）：一次能源的組成、能源強度、能源進口依存度。

都用 EIA International Energy Statistics（公有領域，同一個 INTL.zip），各國同一套算法；台灣另外用經濟部能源署的
能源供給年資料（8309）、能源指標年資料（8308）寫在附註（使用者 2026-10-30 決定）。能源署的檔在 cloud 被 Cloudflare 擋，
由本機 session 代為下載放在 map-plan 的 data/moeaea/，重跑前複製到 pipeline/.cache/moeaea/。

- 一次能源的組成（primary-mix/{燃料}.json）：EIA 的燃煤、天然氣、石油及其他液體、核能、再生及其他（4411-2…4418-2）÷
  初級能源消費總量（44-2），%。核能與再生能源換算成一次能源的方法跟能源署、IEA 不同（台灣石油 EIA 38.4%、能源署 42.7%）。
- 能源強度（energy-intensity.json）：初級能源消費 ÷ 購買力平價 GDP（4701-34，EIA 的 GDP 是 2015 年美元：美國 2015 年
  18,295 十億美元，跟名目 GDP 相同），換成 MJ/美元。自己相除而不用 EIA 的 47-34，是為了 1990 年以前的德國（東西德加總）；
  其他國家跟 47-34 一樣。
- 能源進口依存度（import-dependency.json）：1 − 初級能源產量（44-1）÷ 消費（44-2），%；負的是淨出口。EIA 把核能算自產，
  能源署把核燃料算進口，所以台灣比能源署的低約 1.5 個百分點。能源指標年資料（8308）第 9–17 欄的值跟欄名錯開，進口依存度不用它。
"""
from __future__ import annotations

from common import indicator_file, write_json, year_span
from sources import eia, moeaea_fuels
from topics.fossil_fuels import MIX_SERIES, MIX_TOTAL, OUT, TAIWAN, known_countries, map_regions, sig

PRODUCTION = "44-1-QBTU"
GDP_PPP = "4701-34-BDOLPPP"
FIRST_YEAR = 1980
# 千兆 Btu ÷ 十億美元 = 百萬 Btu/美元；1 百萬 Btu = 1,055.056 MJ
MJ_PER_MBTU = 1055.056
# 能源署能源供給表的欄位（千公噸油當量）→ 組成的燃料
TW_SUPPLY = {"coal": "能源總供給_煤及煤產品", "oil": "能源總供給_原油及石油產品", "gas": "能源總供給_天然氣",
             "nuclear": "能源總供給_核能", "renewables": "能源總供給_再生能源_小計"}
FUEL_ZH = {"coal": "煤", "oil": "石油", "gas": "天然氣", "nuclear": "核能", "renewables": "再生能源"}
FUEL_EN = {"coal": "coal", "oil": "oil", "gas": "gas", "nuclear": "nuclear", "renewables": "renewables"}


def build() -> None:
    raw = eia.annual([MIX_TOTAL, PRODUCTION, GDP_PPP, *MIX_SERIES.values()])
    known = known_countries()
    mapped = {k: map_regions(v, known)[0] for k, v in raw.items()}
    world = {k: v.get("WORL", {}) for k, v in raw.items()}
    total = mapped[MIX_TOTAL]
    years = [y for y in year_span(total) if y >= FIRST_YEAR]
    supply = moeaea_fuels.supply()
    ind = moeaea_fuels.indicators()
    tw_last = max(supply)

    # 一次能源的組成
    for fuel, code in MIX_SERIES.items():
        values = {}
        for c, s in mapped[code].items():
            row = [sig(s[y] / total[c][y] * 100, 3) if y in s and total.get(c, {}).get(y) else None for y in years]
            if any(v is not None for v in row):
                values[c] = row
        w = [sig(world[code][y] / world[MIX_TOTAL][y] * 100, 3) if world[MIX_TOTAL].get(y) and y in world[code] else None
             for y in years]
        tw = {y: supply[y][TW_SUPPLY[fuel]] / supply[y]["能源總供給"] * 100 for y in (2024, tw_last)}
        note = (f"能源署的能源供給：{FUEL_ZH[fuel]}占 {tw[2024]:.1f}%（2024 年）、{tw[tw_last]:.1f}%（{tw_last} 年）；"
                "核能與再生能源換算成一次能源的方法跟 EIA 不同，比例對不上，地圖用 EIA（各國同一套算法）。")
        note_en = (f"Energy Administration supply data: {FUEL_EN[fuel]} {tw[2024]:.1f}% (2024), {tw[tw_last]:.1f}% ({tw_last}); "
                   "nuclear and renewables are converted to primary energy differently from the EIA, so the shares differ; the map "
                   "uses the EIA (the same method for every country).")
        write_json(OUT / "primary-mix" / f"{fuel}.json", indicator_file(
            "primary-mix", "%", years, dict(sorted(values.items())), aggregates={"WLD": w},
            notes={TAIWAN: note}, notesEn={TAIWAN: note_en}))

    # 能源強度：MJ／2015 年購買力平價美元（QBTU ÷ 十億美元 = 百萬 Btu/美元）
    gdp = mapped[GDP_PPP]
    intensity = {}
    for c, s in total.items():
        row = [sig(s[y] / gdp[c][y] * MJ_PER_MBTU, 3) if y in s and gdp.get(c, {}).get(y) else None for y in years]
        if any(v is not None for v in row):
            intensity[c] = row
    w_int = [sig(world[MIX_TOTAL][y] / world[GDP_PPP][y] * MJ_PER_MBTU, 3) if world[GDP_PPP].get(y) and y in world[MIX_TOTAL]
         else None for y in years]
    key = "初級能源密集度(公升油當量/千元)"
    note = (f"能源署的初級能源密集度（每千元新台幣 GDP 的公升油當量）{ind[2024][key]:.2f}（2024 年）、"
            f"{ind[max(ind)][key]:.2f}（{max(ind)} 年），2005 年 {ind[2005][key]:.2f}；單位跟地圖不同，不能直接比。")
    note_en = (f"Energy Administration primary energy intensity (litres of oil equivalent per NT$1,000 of GDP): "
               f"{ind[2024][key]:.2f} (2024), {ind[max(ind)][key]:.2f} ({max(ind)}), {ind[2005][key]:.2f} in 2005; "
               "different units from the map.")
    write_json(OUT / "energy-intensity.json", indicator_file(
        "energy-intensity", "MJ/美元", years, dict(sorted(intensity.items())), aggregates={"WLD": w_int},
        notes={TAIWAN: note}, notesEn={TAIWAN: note_en}))

    # 能源進口依存度
    prod = mapped[PRODUCTION]
    dep = {}
    for c, s in total.items():
        row = [sig((1 - prod.get(c, {}).get(y, 0) / s[y]) * 100, 3) if s.get(y) and y in prod.get(c, {}) else None
               for y in years]
        if any(v is not None for v in row):
            dep[c] = row
    w = [sig((1 - world[PRODUCTION][y] / world[MIX_TOTAL][y]) * 100, 3)
         if world[MIX_TOTAL].get(y) and y in world[PRODUCTION] else None for y in years]
    # 能源指標年資料（8308）第 9–17 欄的值跟欄名錯開（標「進口能源依存度」的那欄 2024 年是 99.0，其實是石油的依存度），
    # 不用；只用能源供給表的進口 ÷ 總供給
    imp = {y: supply[y]["進口能源_合計"] / supply[y]["能源總供給"] * 100 for y in (2024, tw_last)}
    note = (f"能源署的能源供給表：進口能源占總供給 {imp[2024]:.1f}%（2024 年）、{imp[tw_last]:.1f}%（{tw_last} 年）；"
            "能源署把核燃料算進口，EIA 把核能算自產，所以地圖上的 EIA 值較低。")
    note_en = (f"Energy Administration supply table: imports are {imp[2024]:.1f}% of total supply (2024) and {imp[tw_last]:.1f}% "
               f"({tw_last}); it counts nuclear fuel as imported while the EIA counts nuclear as domestic, so the EIA figure on the "
               "map is lower.")
    write_json(OUT / "import-dependency.json", indicator_file(
        "import-dependency", "%", years, dict(sorted(dep.items())), aggregates={"WLD": w},
        notes={TAIWAN: note}, notesEn={TAIWAN: note_en}))

    last = years[-1]
    print(f"  一次能源組成、能源強度、進口依存度 {years[0]}–{last}，{len(intensity)} 個地區；{last} 年世界強度 {w_int[-1]} MJ/美元、"
          f"台灣 {intensity[TAIWAN][-1]} MJ/美元、進口依存度 {dep[TAIWAN][-1]}%")
