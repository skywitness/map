"""水資源與森林主題：人均可再生淡水資源、水資源壓力（SDG 6.4.2）、安全管理的飲用水（SDG 6.1.1）、
森林覆蓋率、森林面積年變化率。

- 人均可再生水資源：AQUASTAT 批次下載檔（`sources/aquastat.py`）的「總可再生水資源」（境內＋上游流入，km³）
  ÷ UN WPP 的年中人口，自己算：
  - 不用世界銀行的「境內」（ER.H2O.INTR.PC）：埃及、蘇丹、荷蘭這類下游國家的水大多從上游流入，只算境內會變成
    每人只有幾立方公尺，跟 Falkenmark 指標的定義也不同。
  - 也不用 AQUASTAT 現成的人均值（var 4190）：裡面混了 247 筆旗標 A 的舊官方值，口徑跟同國其他年份不同，
    約 40 國在 1975–1995 年單年跳動（蒲隆地 1995 年 580，前後約 2,100）；而且 AQUASTAT 沒有前蘇聯、
    1993 年以前的衣索比亞與捷克、2011 年以前的蘇丹這些現在國界的國家。WPP 依現在的國界回推人口，自然補上。
  - 資源量是長期平均（各國最新一年的值，幾乎不隨年份變），逐年的人均值只反映人口變化，跟台灣的算法一致；
    值是 0 的小島（薩摩亞、東加…）是 AQUASTAT 補的 0，當成無資料。
- 水資源壓力（SDG 6.4.2）用世界銀行轉載的 AQUASTAT（ER.H2O.FWST.ZS，2024 年 5 月取得的版本，到 2022 年）：
  - 2026 年 6 月的 AQUASTAT 批次檔有好幾國的取用量明顯錯誤（科威特 2004–2014 年 6e-05 km³，2003 年因此內插成
    1,038%；瓜地馬拉 2001–2010 年在 3 與 28 km³ 之間跳、蓋亞那在 0.1 與 1.6 km³ 之間來回跳），哪一年才對看不出來；
    世界銀行的版本這些國家都是平順的序列。
  - 剩下的錯值用規則排除（outlier_runs()），被排除的年份寫在該國的附註。
  - 取用量很多國家隔幾年才更新，中間與之後的年份是 FAO 補的（線性內插、沿用最近一年）。
- 飲用水用世界銀行轉載的 WHO/UNICEF JMP 資料（SH.H2O.SMDW.ZS）。
- 森林用 FAO 全球森林資源評估 FRA 2025（`sources/fao_fra.py`），只有 1990、2000、2010、2015、2020、2025 年；
  年變化率是兩個評估年之間的複利年增率，標在後面那一年。
- 台灣都不在這些資料庫裡：
  - 人均水資源用經濟部水利署公布的可利用逕流量（2013–2022 年平均）除以聯合國的年中人口。
  - 水資源壓力沒有官方的環境流量，地圖上從缺，附註寫不扣環境流量的比例與假設。
  - 飲用水用水利署的自來水普及率（口徑不同，附註說明）。
  - 森林用林業及自然保育署的第三、四次全國森林資源調查。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import aquastat, fao_fra, worldbank, wpp

Series = dict[str, dict[int, float]]

TRWR = "Total renewable water resources"
IRWR = "Total internal renewable water resources (IRWR)"
WATER_STRESS = "SDG 6.4.2. Water Stress"
FIRST_YEAR = 1961  # AQUASTAT 的資料從 1961 年開始
# 世界的水資源壓力用 AQUASTAT 自己的全球值（世界銀行的版本沒有世界值）；2000 年以前只加總了部分國家
# （1986 → 1987 年從 27.9% 跳到 20.3%），不收
WORLD_STRESS_FROM = 2000
# 錯值的規則：連續幾年（最多 15 年）的值同時比前一年與後一年的值低（或高）2.5 倍以上
OUTLIER_FACTOR = 2.5
OUTLIER_MAX_RUN = 15

# ── 台灣的官方數字（照原始文件抄進來，出新版時要手動更新） ──────────────────
# 經濟部水利署「Water Resources Utilization (Average from 2013 to 2022)」https://www.wra.gov.tw/en/cp.aspx?n=5155
TW_RUNOFF = 633.7  # 億立方公尺：年降雨 885 億立方公尺（2,458 公釐）扣除蒸發與入滲後的可利用逕流量
TW_RAINFALL = 885.0
TW_WITHDRAWAL = 163.7  # 億立方公尺：生活 31.8、工業 16.34、農業 115.5（不含保育用水與非灌區農業用水）
# 水利署《113 年各標的用水統計年報》（https://web.wra.gov.tw/Annualwater/）的全國用水量
TW_WITHDRAWAL_LATEST = (2024, 155.96)
# AQUASTAT 裡日本、南韓的環境流量約占總可再生水資源的一半（2023 年 49%、51%），用來說明台灣可能的範圍
TW_EFR_SHARE = 0.5
# 水利署《113 年生活用水量統計報告》：自來水供水人口占總人口
TW_TAP_WATER = {2023: 95.67, 2024: 95.78}
# 農業部林業及自然保育署 全國森林資源調查（https://www.forest.gov.tw/0000052）
# 第三次（1990–1993 年，台灣本島）：森林 2,102,400 公頃、土地 3,591,500 公頃、58.53%
# 第四次（2008–2013 年實地調查、2015 年公布，含金門、連江）：森林 2,197,090 公頃、土地 3,618,996 公頃、60.71%；
# 跟第三次同一範圍（台灣本島）是 218.6 萬公頃、60.91%
TW_FOREST_COVER = {1990: 58.53, 2010: 60.71}
TW_FOREST_SAME_SCOPE = (1990, 2_102_400, 2010, 2_186_000)

# FRA 的「China」土地面積含台灣、香港、澳門，森林面積只有中國大陸；覆蓋率改用中國大陸的土地面積
# （扣掉 FAOSTAT 土地利用資料的台灣 3,541、香港 105、澳門 3.33 千公頃，= FAOSTAT 的中國大陸 938,821 千公頃）
CHINA_LAND_OTHERS = 3541 + 105 + 3.33

# 台灣的值標在調查年份附近的 FRA 報告年；之後沒有新的調查，所以讓 2025 年也顯示 2010 年的值（附註寫明）
FOREST_WITHIN = 15

TAIWAN_NOTES = {
    "renewable-water": (
        f"台灣不在 AQUASTAT 中。改用經濟部水利署公布的 2013–2022 年平均可利用逕流量 {TW_RUNOFF:,.1f} 億立方公尺"
        f"（年降雨 {TW_RAINFALL:,.0f} 億立方公尺、2,458 公釐，扣除蒸發與入滲），除以聯合國的年中人口。"
        "AQUASTAT 的可再生水資源是長期平均的地表水加地下水（扣除重疊的部分）；台灣的值只有地表逕流，"
        "不含沒有流入河川的地下水補注，可能略為低估",
        f"Taiwan is not in AQUASTAT. The Water Resources Agency's average available runoff for 2013–2022, "
        f"{TW_RUNOFF / 10:,.2f} billion m³ (annual rainfall of {TW_RAINFALL / 10:,.1f} billion m³ or 2,458 mm, minus "
        "evaporation and infiltration), is divided by the UN mid-year population. AQUASTAT's renewable resources are "
        "long-term averages of surface water plus groundwater (minus the overlap); Taiwan's figure is surface runoff "
        "only, without groundwater recharge that does not reach rivers, so it may be slightly low",
    ),
    "water-stress": (
        "台灣不在 AQUASTAT 中，而且沒有官方的環境流量數字，所以地圖上從缺。水利署公布 2013–2022 年平均每年用水 "
        f"{TW_WITHDRAWAL:,.1f} 億立方公尺（農業 71%、生活 19%、工業 10%；不含保育用水與非灌區農業用水），"
        f"可利用逕流量 {TW_RUNOFF:,.1f} 億立方公尺：不扣環境流量的取用比例是 {{raw:.1f}}%；"
        "若環境流量比照 AQUASTAT 裡的日本、南韓，約占可再生水資源的一半，是 {efr:.0f}%（中度壓力）。"
        f"{TW_WITHDRAWAL_LATEST[0]} 年用水 {TW_WITHDRAWAL_LATEST[1]:,.1f} 億立方公尺",
        "Taiwan is not in AQUASTAT and has no official environmental flow requirement, so it is left blank. "
        f"The Water Resources Agency reports average withdrawals of {TW_WITHDRAWAL / 10:,.2f} billion m³ a year in "
        "2013–2022 (agriculture 71%, domestic 19%, industry 10%; excluding conservation water and agriculture outside "
        f"irrigation districts) against available runoff of {TW_RUNOFF / 10:,.2f} billion m³: {{raw:.1f}}% without "
        "deducting environmental flows, or about {efr:.0f}% (medium stress) if environmental flows take about half of "
        "renewable resources, as AQUASTAT estimates for Japan and South Korea. Withdrawals were "
        f"{TW_WITHDRAWAL_LATEST[1] / 10:,.2f} billion m³ in {TW_WITHDRAWAL_LATEST[0]}",
    ),
    "safe-water": (
        "台灣不在 WHO／UNICEF JMP 的資料庫中。改用經濟部水利署的自來水普及率（自來水供水人口占總人口，"
        "《113 年生活用水量統計報告》）。JMP 的「安全管理」是在住家、需要時就有、水質合格的改善水源；"
        "自來水的水質抽驗合格率約 99.9%（環境部），但沒有接自來水的人（用地下水、山泉水或簡易自來水）"
        "有一部分也可能符合 JMP 的定義，所以台灣的值可能略為低估",
        "Taiwan is not in the WHO/UNICEF JMP database. The Water Resources Agency's tap water coverage (population "
        "served by public water supply as a share of the total, from its 2024 domestic water use report) is used "
        "instead. JMP's 'safely managed' means an improved source on premises, available when needed and free from "
        "contamination; tap water passes about 99.9% of quality tests (Ministry of Environment), but some people "
        "without tap water (using groundwater, spring water or small community systems) may also meet the JMP "
        "definition, so Taiwan's figure may be slightly low",
    ),
    "forest-cover": (
        "FRA 沒有台灣。改用農業部林業及自然保育署的全國森林資源調查：第三次（1990–1993 年，台灣本島）"
        "森林 210.2 萬公頃、覆蓋率 58.53%，標在 1990 年；第四次（2008–2013 年實地調查，2015 年公布，含金門、連江）"
        "森林 219.7 萬公頃、土地 361.9 萬公頃、覆蓋率 60.71%，標在 2010 年。之後還沒有新的調查結果，"
        "2015 年以後的地圖顯示 2010 年的值",
        "FRA does not cover Taiwan. The Forestry and Nature Conservation Agency's national forest resource "
        "inventories are used instead: the third (1990–1993, main island) found 2.102 million ha of forest, 58.53% "
        "coverage, shown as 1990; the fourth (field surveys in 2008–2013, published in 2015, including Kinmen and "
        "Matsu) found 2.197 million ha of forest on 3.619 million ha of land, 60.71%, shown as 2010. No later "
        "inventory has been published, so maps from 2015 on show the 2010 value",
    ),
    "forest-change": (
        "用第三次與第四次全國森林資源調查同一範圍（台灣本島）的森林面積：210.2 萬公頃 → 218.6 萬公頃，"
        "以 1990 年到 2010 年的 20 年計算，平均每年 {rate}，標在 2010 年（跟其他國家 2000–2010 年的平均比較）。"
        "之後還沒有新的調查結果，2015 年以後的地圖顯示同一個值",
        "Forest area within the same boundaries (Taiwan's main island) in the third and fourth national forest "
        "resource inventories: 2.102 million ha → 2.186 million ha, {rate} a year over the 20 years from 1990 to 2010, shown "
        "as 2010 (compared with other countries' 2000–2010 average). No later inventory has been published, so maps "
        "from 2015 on show the same value",
    ),
}
CHINA_NOTE = (
    "FRA 的「中國」土地面積（94,247 萬公頃）含台灣、香港、澳門，森林面積只有中國大陸，"
    "所以覆蓋率改用中國大陸的土地面積（93,882 萬公頃，FAOSTAT）計算",
    "FRA's 'China' land area (942.47 million ha) includes Taiwan, Hong Kong and Macao, but its forest area covers "
    "mainland China only, so coverage is calculated with mainland China's land area (938.82 million ha, FAOSTAT)",
)
DESK_NOTE = (
    "沒有提交 FRA 2025 的國家報告，數值是 FAO 依現有資料推估的（desk study）",
    "No FRA 2025 country report was submitted; the figures are FAO estimates from existing information (desk study)",
)


OUTLIER_NOTE = (
    "{years} 年的值（{values}）跟前後年份（{before}、{after}）差好幾倍，看起來是原始資料的錯誤，不收",
    "{years}: the value ({values}) is several times off from the years before and after ({before}, {after}), "
    "apparently an error in the source data, so it is left out",
)


def outlier_runs(series: dict[int, float]) -> list[list[int]]:
    """連續幾年的值同時比前一個與後一個值低（或高）OUTLIER_FACTOR 倍以上，回傳這些段落的年份。
    只看前後都有值、中間沒有缺年的段落；值本來就很小（< 0.5）的不算，避免 0.1 → 0.3 這種雜訊。"""
    years = sorted(series)
    out: list[list[int]] = []
    i = 1
    while i < len(years):
        before = series[years[i - 1]]
        found = False
        for low in (True, False):
            def off(v: float, ref: float, low: bool = low) -> bool:
                return max(v, ref) >= 0.5 and (v * OUTLIER_FACTOR < ref if low else v > ref * OUTLIER_FACTOR)
            j = i
            while j < len(years) and j - i < OUTLIER_MAX_RUN and off(series[years[j]], before):
                j += 1
            run = years[i:j]
            if run and j < len(years) and run[-1] - run[0] == len(run) - 1 \
                    and all(off(series[y], series[years[j]]) for y in run):
                out.append(run)
                i, found = j, True
                break
        if not found:
            i += 1
    return out


def drop_outliers(series: Series, unit: str) -> tuple[dict[str, str], dict[str, str]]:
    """把 outlier_runs() 找到的年份拿掉，回傳說明的附註（中、英文）。"""
    notes, notes_en = {}, {}
    for iso3, s in sorted(series.items()):
        parts_zh, parts_en = [], []
        for run in outlier_runs(s):
            years = sorted(s)
            before = s[years[years.index(run[0]) - 1]]
            after = s[years[years.index(run[-1]) + 1]]
            label = str(run[0]) if len(run) == 1 else f"{run[0]}–{run[-1]}"
            values = sorted({round(s[y], 1) for y in run})
            fmt = lambda v: f"{v:,.1f}{unit}"  # noqa: E731
            shown = fmt(values[0]) if len(values) == 1 else f"{fmt(values[0])}–{fmt(values[-1])}"
            args = {"years": label, "values": shown, "before": fmt(before), "after": fmt(after)}
            parts_zh.append(OUTLIER_NOTE[0].format(**args))
            parts_en.append(OUTLIER_NOTE[1].format(**args))
            for y in run:
                del s[y]
        if parts_zh:
            notes[iso3] = "；".join(parts_zh)
            notes_en[iso3] = "; ".join(parts_en)
            print(f"    排除錯值 {iso3}：{notes[iso3]}")
    return notes, notes_en


def compound_rate(start: float, end: float, years: int) -> float:
    """兩個時點之間的平均年變化率（%，複利），FRA 自己公布的年變化率也是這樣算。"""
    return ((end / start) ** (1 / years) - 1) * 100


def build() -> None:
    out = OUT_DIR / "topics" / "water-forest"

    def write(key: str, unit: str, years: list[int], series: Series, digits: int, world: dict[int, float],
              notes: dict[str, str], notes_en: dict[str, str], **extra: object) -> None:
        values = {iso3: s for iso3, s in ((c, to_series(v, years, digits)) for c, v in sorted(series.items()))
                  if any(x is not None for x in s)}
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, values,
                aggregates={"WLD": to_series(world, years, digits)},
                notes=notes, notesEn=notes_en,
                **extra,
            ),
        )
        latest = years[-1]
        taiwan = series.get("TWN", {})
        tw_year = max((y for y in taiwan if y <= latest), default=None)
        print(f"    {key}: {years[0]}–{latest}，{len(values)} 國，{latest} 年世界 {world.get(latest)}，"
              f"台灣 {tw_year} 年 {taiwan.get(tw_year) if tw_year else '—'}")

    # ── 水資源（AQUASTAT） ──
    aq = aquastat.series({TRWR, IRWR, WATER_STRESS})
    population = wpp.demographic(["TPopulation1July"])["TPopulation1July"]  # {iso3 或 WLD: {年: 千人}}

    # 總可再生水資源（長期平均）÷ 年中人口；各國用最新一年的值（只有不丹、馬爾他等幾國改過）
    trwr = {iso3: s[max(s)] for iso3, s in aq[TRWR][0].items() if s[max(s)] > 0}  # 10 億立方公尺
    years = list(range(FIRST_YEAR, max(max(s) for s in aq[TRWR][0].values()) + 1))
    per_capita: Series = {
        iso3: {y: km3 * 1e9 / (population[iso3][y] * 1000) for y in years if y in population.get(iso3, {})}
        for iso3, km3 in trwr.items()
    }
    missing = sorted(iso3 for iso3, s in per_capita.items() if not s)
    if missing:
        print(f"    WPP 沒有這些國家的人口：{missing}")
    per_capita["TWN"] = {y: TW_RUNOFF * 1e8 / (population["TWN"][y] * 1000) for y in years}
    # 世界：各國「境內」可再生水資源（IRWR）的加總 ÷ WPP 的世界人口（上游流入的水已經算在上游國家，不能再加）。
    # AQUASTAT 自己的世界值早年只加總了有資料的國家（1965 年只有 960 立方公尺），它的世界人口 1992 年以前
    # 也少了前蘇聯等國，所以都不用
    total_irwr = sum(s[max(s)] for s in aq[IRWR][0].values())  # 10 億立方公尺
    world = {y: total_irwr * 1e9 / (population["WLD"][y] * 1000) for y in years}
    zh, en = TAIWAN_NOTES["renewable-water"]
    write("renewable-water", "立方公尺/人/年", years, per_capita, 0, world, {"TWN": zh}, {"TWN": en})

    stress, _ = worldbank.fetch("ER.H2O.FWST.ZS", 1960)
    notes, notes_en = drop_outliers(stress, "%")
    world = {y: v for y, v in aq[WATER_STRESS][1].items() if y >= WORLD_STRESS_FROM}
    # 早年只有少數國家有取用量，頭尾要有最多那年一半以上的國家才收
    years = year_span(stress, 0.5)
    raw = TW_WITHDRAWAL / TW_RUNOFF * 100
    efr = TW_WITHDRAWAL / (TW_RUNOFF * (1 - TW_EFR_SHARE)) * 100
    zh, en = TAIWAN_NOTES["water-stress"]
    notes["TWN"], notes_en["TWN"] = zh.format(raw=raw, efr=efr), en.format(raw=raw, efr=efr)
    write("water-stress", "%", years, stress, 2, world, notes, notes_en)

    # ── 飲用水（世界銀行轉載的 JMP） ──
    safe, world = worldbank.fetch("SH.H2O.SMDW.ZS", 2000)
    safe["TWN"] = dict(TW_TAP_WATER)
    years = year_span(safe)
    zh, en = TAIWAN_NOTES["safe-water"]
    write("safe-water", "%", years, safe, 2, world, {"TWN": zh}, {"TWN": en})

    # ── 森林（FRA 2025） ──
    forest = fao_fra.area("1a_forestArea")
    land = fao_fra.area("1a_landArea")
    land_cn = {y: v - CHINA_LAND_OTHERS for y, v in land["CHN"].items()}
    desk = fao_fra.desk_studies()
    notes = {iso3: DESK_NOTE[0] for iso3 in sorted(desk)}
    notes_en = {iso3: DESK_NOTE[1] for iso3 in sorted(desk)}

    def land_of(iso3: str, year: int) -> float | None:
        return land_cn[year] if iso3 == "CHN" else land.get(iso3, {}).get(year)

    cover: Series = {}
    for iso3, s in forest.items():
        cover[iso3] = {y: v / a * 100 for y, v in s.items() if (a := land_of(iso3, y))}
    # 世界：236 個國家/地區的森林加總 ÷ 土地加總（FRA 公布的全球值也是這樣算）
    world = {y: sum(s.get(y, 0) for s in forest.values()) / sum(s.get(y, 0) for s in land.values()) * 100
             for y in fao_fra.YEARS}
    cover["TWN"] = dict(TW_FOREST_COVER)
    zh, en = TAIWAN_NOTES["forest-cover"]
    # 中國的附註只放覆蓋率：年變化率只用森林面積，不受土地面積影響
    write("forest-cover", "%", fao_fra.YEARS, cover, 2, world,
          {**notes, "CHN": CHINA_NOTE[0], "TWN": zh}, {**notes_en, "CHN": CHINA_NOTE[1], "TWN": en},
          latestWithin=FOREST_WITHIN)

    change: Series = {}
    world_forest = {y: sum(s.get(y, 0) for s in forest.values()) for y in fao_fra.YEARS}
    world = {}
    for start, end in zip(fao_fra.YEARS, fao_fra.YEARS[1:]):
        for iso3, s in forest.items():
            if s.get(start) and end in s:  # 一開始就沒有森林的（直布羅陀、梵蒂岡…）算不出變化率
                change.setdefault(iso3, {})[end] = compound_rate(s[start], s[end], end - start)
        world[end] = compound_rate(world_forest[start], world_forest[end], end - start)
    y0, a0, y1, a1 = TW_FOREST_SAME_SCOPE
    tw_rate = compound_rate(a0, a1, y1 - y0)
    change["TWN"] = {y1: tw_rate}
    sign = "+" if tw_rate >= 0 else "−"
    zh, en = TAIWAN_NOTES["forest-change"]
    write("forest-change", "%/年", fao_fra.YEARS[1:], change, 3, world,
          {**notes, "TWN": zh.format(rate=f"{sign}{abs(tw_rate):.2f}%")},
          {**notes_en, "TWN": en.format(rate=f"{sign}{abs(tw_rate):.2f}%")},
          latestWithin=FOREST_WITHIN)

    write_json(
        out / "manifest.json",
        {
            "topic": "water-forest",
            "generatedAt": now_iso(),
            "source": "FAO AQUASTAT; World Bank WDI (WHO/UNICEF JMP); FAO Global Forest Resources Assessment 2025; "
                      "經濟部水利署; 農業部林業及自然保育署; UN WPP 2024",
        },
    )
