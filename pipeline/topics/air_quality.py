"""空氣品質主題：PM2.5 年平均濃度（人口加權）、人口暴露在 WHO 指引值以上的比例、空氣污染造成的死亡率。

- PM2.5 年平均：WHO GHO 的 SDG 11.6.2（SDGPM25，全體人口＝都市＋鄉村，人口加權），2010–2023 年。
  WHO 用衛星、化學傳輸模式與地面測站整合推估（DIMAQ），CC BY 4.0。
  世界銀行 WDI 的 EN.ATM.PM25.MC.M3 雖然標 CC BY 4.0，原始來源是 IHME GBD 2023（非商業使用、要登入才能下載），
  照「第三方資料仍適用原始授權」的原則不用（DESIGN.md 第 8 節）。
- 超過 WHO 指引值（5 μg/m³）的人口比例：WHO 沒有公布，用 WashU ACAG 衛星推估的各國統計（CC BY 4.0，1998–2023）。
  跟上面的年平均是不同的模型，同一國的兩個數字可能對不上，指標說明有寫。
- 死亡率：WHO GHO 的戶外空氣污染（AIR_42）與 SDG 3.9.1 戶外加室內空氣污染（SDGAIRBODA）
  歸因死亡率，年齡標準化、每十萬人，只有 2021 年。
- 台灣不在 WHO 資料庫中：
  - PM2.5 年平均用環境部手動監測站的年平均算術平均（2015 年起，跟環境部公布的全國平均交叉比對）。
  - 超過指引值的比例用 ACAG 的台灣（中國分區檔，跟其他國家同一套方法）。
  - 死亡率沒有官方用同樣方法推估的數字，留空，附註寫原因。
"""
from __future__ import annotations

import statistics

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, year_span
from sources import acag, moenv, who

GUIDELINE = 5  # WHO 2021 年空氣品質指引的 PM2.5 年平均值（μg/m³）
# 手動監測每 3 天採樣一次，一年約 122 次；少於 75%（90 次）的測站那一年不算
MIN_SAMPLES = 90
# 開放資料 2013、2014 年只有 8 站，2015 年起才是完整的 31 站；測站數少於這個的年份不收
MIN_STATIONS = 25
# 環境部公布的全國 PM2.5（手動）年平均（環境統計查詢網「歷年全國細懸浮微粒 PM2.5(手動) 濃度值」，
# https://statis.moenv.gov.tw/epanet/ ），只用來交叉比對與寫附註
OFFICIAL_TAIWAN = {
    2013: 24.0, 2014: 23.6, 2015: 22.0, 2016: 20.0, 2017: 18.3, 2018: 17.5, 2019: 16.2,
    2020: 14.1, 2021: 14.4, 2022: 12.4, 2023: 13.7, 2024: 12.8, 2025: 12.8,
}

# 死亡率：輸出檔名 -> GHO 代碼（全死因、男女合計）
DEATH_RATES = {
    "ambient-deaths": "AIR_42",  # 戶外空氣污染歸因死亡率（年齡標準化）
    "air-pollution-deaths": "SDGAIRBODA",  # SDG 3.9.1：戶外加室內（家戶燃料）空氣污染歸因死亡率（年齡標準化）
}
DEATH_DIMS = {"Dim1": "SEX_BTSX", "Dim2": "GHECAUSE_GHE000000"}

HK_MACAO = {"HKG": ("香港", "Hong Kong"), "MAC": ("澳門", "Macao")}

DEATHS_NOTE_TW = (
    "台灣不在 WHO 資料庫中，也沒有官方用同樣方法（各國 PM2.5 暴露量乘上疾病的暴露—反應關係）推估的"
    "空氣污染歸因死亡率，所以地圖上留空",
    "Taiwan is not in the WHO database, and there is no official estimate made the same way (each country's PM2.5 "
    "exposure combined with exposure–response relationships for each disease), so it is left blank",
)


def station_means(samples: dict[str, list[float]]) -> dict[str, float]:
    """{測站: 採樣次數夠的年平均}"""
    return {site: statistics.mean(v) for site, v in samples.items() if len(v) >= MIN_SAMPLES}


def taiwan_pm25(stations: dict[int, dict[str, list[float]]]) -> dict[int, float]:
    """環境部手動監測站年平均的算術平均（μg/m³），只收測站數夠的年份。"""
    out: dict[int, float] = {}
    for year, samples in stations.items():
        means = list(station_means(samples).values())
        if len(means) >= MIN_STATIONS:
            out[year] = statistics.mean(means)
        print(f"  台灣 {year} 年：{len(means)} 站，平均 {statistics.mean(means):.2f} μg/m³"
              f"（環境部公布 {OFFICIAL_TAIWAN.get(year, '—')}）" if means else f"  台灣 {year} 年：沒有完整的測站")
    return out


def pm25_notes(taiwan: dict[int, float], last_year: int) -> tuple[str, str]:
    shown = max(y for y in taiwan if y <= last_year)
    later = [y for y in sorted(taiwan) if y > last_year and y in OFFICIAL_TAIWAN]
    first = min(taiwan)
    before = [y for y in sorted(OFFICIAL_TAIWAN) if y < first]
    zh = (
        "台灣不在 WHO 資料庫中，改用環境部 PM2.5 手動監測站（30 個一般測站與陽明國家公園測站）年平均的算術平均，"
        f"{first} 年起（之前的開放資料只有 8 站；環境部公布的 "
        + "、".join(f"{y} 年是 {OFFICIAL_TAIWAN[y]}" for y in before)
        + "）。這是測站的簡單平均，不是 WHO 依衛星、模型與人口分布推估的人口加權平均。"
        f"{shown} 年算出 {taiwan[shown]:.1f} μg/m³，環境部公布的全國平均是 {OFFICIAL_TAIWAN[shown]}"
        + (f"；地圖只到 {last_year} 年，環境部公布的 " + "、".join(f"{y} 年是 {OFFICIAL_TAIWAN[y]}" for y in later)
           if later else "")
    )
    en = (
        "Taiwan is not in the WHO database; the arithmetic mean of the annual averages at the Ministry of Environment's "
        "manual PM2.5 monitoring stations (30 general stations plus the Yangmingshan National Park station) is used "
        f"instead, from {first} (earlier open data cover only 8 stations; the Ministry's figures are "
        + ", ".join(f"{OFFICIAL_TAIWAN[y]} for {y}" for y in before)
        + "). This is a simple average of monitoring stations, not a population-weighted estimate from satellites, "
        f"models and population distribution like WHO's. The {shown} figure calculated here is {taiwan[shown]:.1f} μg/m³, "
        f"against the Ministry's published national average of {OFFICIAL_TAIWAN[shown]}"
        + (f". The map ends in {last_year}; the Ministry's figures are "
           + ", ".join(f"{OFFICIAL_TAIWAN[y]} for {y}" for y in later) if later else "")
    )
    return zh, en


def build() -> None:
    out = OUT_DIR / "topics" / "air-quality"

    def write(key: str, unit: str, countries: dict[str, dict[int, float]], world: dict[int, float], digits: int,
              notes: dict[str, tuple[str, str]]) -> None:
        years = year_span(countries)
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, {iso3: to_series(s, years, digits) for iso3, s in countries.items() if s},
                aggregates={"WLD": to_series(world, years, digits)},
                notes={iso3: zh for iso3, (zh, _en) in notes.items()},
                notesEn={iso3: en for iso3, (_zh, en) in notes.items()},
            ),
        )

    # PM2.5 年平均（WHO），台灣用環境部測站
    countries, world = who.gho("SDGPM25", {"Dim1": "RESIDENCEAREATYPE_TOTL"})
    if "TWN" in countries:
        raise RuntimeError("WHO 的 PM2.5 已經有台灣，請改用 WHO 的值並拿掉環境部的補值")
    stations = moenv.manual_pm25_samples()
    taiwan = taiwan_pm25(stations)
    last_year = max(max(s) for s in countries.values())
    countries["TWN"] = taiwan
    notes = {"TWN": pm25_notes(taiwan, last_year)}
    # 香港、澳門：WHO 沒有分開列出，地圖上留空；附註寫 ACAG 的衛星推估當參考
    for iso3, (zh, en) in HK_MACAO.items():
        if iso3 in countries:
            raise RuntimeError(f"WHO 的 PM2.5 已經有 {iso3}，請拿掉 air_quality.HK_MACAO 的附註")
        reference = acag.mean_pm25(iso3)
        year = min(max(reference), last_year)
        notes[iso3] = (
            f"WHO 的 PM2.5 估計（SDG 11.6.2）沒有分開列出{zh}，所以地圖上留空。參考：WashU ACAG 的衛星推估 {year} 年是 "
            f"{reference[year]:.1f} μg/m³，跟 WHO 是不同的模型，不能直接比；「超過 WHO 指引值的人口比例」有{zh}的值",
            f"WHO's PM2.5 estimates (SDG 11.6.2) do not list {en} separately, so it is left blank. For reference, "
            f"WashU ACAG's satellite-based estimate for {year} is {reference[year]:.1f} μg/m³, from a different model "
            f"that is not directly comparable; “People above WHO guideline” does include {en}",
        )
    write("pm25", "μg/m³", countries, world, 2, notes)

    # 超過 WHO 指引值的人口比例（ACAG），台灣、香港、澳門來自同一資料集的中國分區檔
    countries, world = acag.share_above(GUIDELINE)
    region_note = (
        "WashU ACAG 的各國統計檔沒有{zh}，{zh}的數字在同一資料集的中國分區統計檔裡（同一套方法），從那裡取用",
        "WashU ACAG's country file does not list {en}; the {en} figures are taken from the same dataset's "
        "file of Chinese regions (same method)",
    )
    names = {"TWN": ("台灣", "Taiwan"), "HKG": ("香港", "Hong Kong"), "MAC": ("澳門", "Macao")}
    notes = {iso3: (region_note[0].format(zh=zh), region_note[1].format(en=en)) for iso3, (zh, en) in names.items()}
    # 跟 ACAG 台灣最新一年同一年的測站比，看是不是每一站都超過指引值
    latest = min(max(countries["TWN"]), max(stations))
    means = station_means(stations[latest])
    lowest = min(means, key=means.get)
    zh, en = notes["TWN"]
    notes["TWN"] = (
        zh + f"。對照：環境部 {len(means)} 個 PM2.5 手動監測站 {latest} 年的年平均都"
        + ("高於" if means[lowest] > GUIDELINE else "不全高於")
        + f" {GUIDELINE} μg/m³（最低是{lowest} {means[lowest]:.1f}）",
        en + f". For comparison, the {latest} annual averages at the Ministry of Environment's {len(means)} manual PM2.5 "
        "monitoring stations were "
        + ("all above" if means[lowest] > GUIDELINE else "not all above")
        + f" {GUIDELINE} μg/m³ (lowest: {means[lowest]:.1f})",
    )
    write("pm25-above-guideline", "%", countries, world, 1, notes)

    # 空氣污染歸因死亡率（WHO，2021 年）
    for key, code in DEATH_RATES.items():
        countries, world = who.gho(code, DEATH_DIMS)
        write(key, "人/十萬人", countries, world, 1, {"TWN": DEATHS_NOTE_TW})

    write_json(
        out / "manifest.json",
        {
            "topic": "air-quality",
            "generatedAt": now_iso(),
            "source": "WHO GHO (SDG 11.6.2, SDG 3.9.1); WashU ACAG SatPM2.5 V6.GL.02; 環境部",
        },
    )
