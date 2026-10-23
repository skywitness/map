"""生育率與高齡化主題：UN World Population Prospects 2024（中推估，CC BY 3.0 IGO，含台灣）。

- 總生育率、出生數：WPP 的人口動態指標檔（Demographic Indicators），跟人口主題同一個檔。
- 65 歲以上人口比例、扶老比（65 歲以上 ÷ 15–64 歲 × 100）：用 WPP 的五歲年齡組人口（PopulationByAge5GroupSex）自己算，
  世界的值用 WPP 的世界列（LocTypeID 1），不是各國加總。
- 側欄的人口金字塔：同一個五歲年齡組檔，每個國家一個檔（countries/<ISO3>.json），1950–2100 每年男女各 21 組。
  數值用指標檔同一種差分編碼（前端 fetchJson() 會還原），但整個國家共用一個十進位指數：最大的一組保留 4 位有效數字
  （台灣是千人），畫成長條看不出差別，檔案小很多。
- 1950–2023 是估計值，2024 起是推估值（projectionFrom）。

台灣：WPP 本身有台灣（跟人口主題一樣直接用 WPP），沒有改用內政部的數字：
- 2023 年以前跟內政部很接近（總生育率 0.87 對 0.865），差異主要是 WPP 用年中人口、內政部用年底戶籍人口。
- 2024 年起 WPP 是推估值，2025 年台灣實際的總生育率掉到 0.695、出生 10.8 萬人，WPP 推估 0.86、12.5 萬人，差很多。
  但只把台灣這兩年換成內政部的數字，會跟 WPP 自己的推估接不起來（WPP 2026 年以後仍從它的 2024 年推估往後算），
  所以維持 WPP，差異與國發會的人口推估寫在附註（notes／notesEn）。
- 內政部、國發會的數字只寫在附註裡，沒有另外輸出資料檔；兩者都是政府資料開放授權條款第 1 版
  （國發會「人口推計」是 data.gov.tw/dataset/6101）。
"""
from __future__ import annotations

import csv
import gzip
import math

from common import OUT_DIR, download, indicator_file, now_iso, write_json
from sources import wpp

FIRST_YEAR, LAST_YEAR = 1950, 2100
PROJECTION_FROM = 2024  # WPP 2024：2023 年以前是估計值，之後是推估值
YEARS = list(range(FIRST_YEAR, LAST_YEAR + 1))
AGE_STARTS = list(range(0, 101, 5))  # 0-4、5-9 … 95-99、100+
PYRAMID_DIGITS = 4  # 金字塔最大的一組保留幾位有效數字

COUNTRY, WORLD = "4", "1"  # LocTypeID

# ── 台灣的附註：WPP 跟內政部、國發會的對照 ──────────────────────────
# 內政部：戶政司人口統計（年底戶籍人口、全年出生數、育齡婦女總生育率），https://www.ris.gov.tw/app/portal/346
# 國發會：中華民國人口推估（2026 至 2075 年），2026-08-28 公布，https://pop-proj.ndc.gov.tw/
NDC_ZH = "國發會 2026 年 8 月的人口推估（2026 至 2075 年）"
NDC_EN = "The National Development Council's August 2026 projections (2026–2075)"
NOTES: dict[str, tuple[str, str]] = {
    "tfr": (
        "WPP 2024 的估計：2023 年 0.87，內政部 0.865；2024 年起是 WPP 的推估（2024 年 0.86，內政部實際 0.885；"
        "2025 年 0.86，內政部實際 0.695，創歷史新低）。"
        f"{NDC_ZH}的中推估假設總生育率在 2075 年是 0.8（高推估 1.1、低推估 0.6），比 WPP 低",
        "WPP 2024 estimate: 0.87 in 2023, against 0.865 from the Ministry of the Interior. From 2024 the figures are "
        "WPP projections (0.86 in 2024, while the actual rate was 0.885; 0.86 in 2025, while the actual rate fell to a "
        f"record low of 0.695). {NDC_EN} assume a total fertility rate of 0.8 by 2075 in the medium variant "
        "(1.1 high, 0.6 low), lower than WPP",
    ),
    "births": (
        "WPP 2024 的估計：2023 年 13.2 萬人，內政部登記的出生數是 135,571 人；2024 年起是 WPP 的推估"
        "（2024 年 12.9 萬人，實際 134,856 人；2025 年 12.5 萬人，實際只有 107,812 人）。"
        f"{NDC_ZH}的中推估 2026 年約 9.4 萬人",
        "WPP 2024 estimate: 132,000 in 2023, against 135,571 births registered by the Ministry of the Interior. From "
        "2024 the figures are WPP projections (129,000 in 2024, actual 134,856; 125,000 in 2025, actual only 107,812). "
        f"{NDC_EN} put births at about 94,000 in 2026 in the medium variant",
    ),
    "aged-65": (
        "WPP 是年中人口；內政部的年底戶籍人口：2023 年 18.35%、2024 年 19.18%、2025 年 20.06%"
        "（2025 年底超過 20%，進入超高齡社會）。"
        f"{NDC_ZH}的中推估：2037 年超過 30%，2075 年 52.9%",
        "WPP uses mid-year population. The Ministry of the Interior's year-end figures: 18.35% in 2023, 19.18% in 2024 "
        "and 20.06% in 2025 (above 20% at the end of 2025, a 'super-aged' society). "
        f"{NDC_EN} put the share above 30% in 2037 and at 52.9% in 2075 in the medium variant",
    ),
    "old-age-dependency": (
        "WPP 是年中人口。"
        f"{NDC_ZH}的中推估：2026 年每 3.2 位 15–64 歲的人對 1 位 65 歲以上（扶老比約 31），"
        "2075 年只剩 0.8 位（扶老比約 125）",
        "WPP uses mid-year population. "
        f"{NDC_EN} have 3.2 people aged 15–64 for every person aged 65+ in 2026 (an old-age dependency ratio of "
        "about 31), falling to 0.8 in 2075 (about 125) in the medium variant",
    ),
}


def _demographic() -> tuple[dict[str, dict[str, list]], dict[str, list]]:
    """總生育率、出生數：{指標: {iso3: 序列}}、{指標: 世界序列}"""
    path = download(wpp.URL, "wpp", "WPP2024_Demographic_Indicators_Medium.csv.gz")
    series: dict[str, dict[str, list]] = {"tfr": {}, "births": {}}
    world: dict[str, list] = {k: [None] * len(YEARS) for k in series}
    with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            year = int(row["Time"])
            if row["LocTypeID"] not in (COUNTRY, WORLD) or not FIRST_YEAR <= year <= LAST_YEAR:
                continue
            if row["LocTypeID"] == COUNTRY and not row["ISO3_code"]:
                continue
            i = year - FIRST_YEAR
            values = {
                "tfr": round(float(row["TFR"]), 2) if row["TFR"] else None,
                "births": round(float(row["Births"]) * 1000) if row["Births"] else None,  # 原始單位是千人
            }
            for key, value in values.items():
                if row["LocTypeID"] == WORLD:
                    world[key][i] = value
                else:
                    series[key].setdefault(row["ISO3_code"], [None] * len(YEARS))[i] = value
    return series, world


def _by_age() -> dict[str, dict[int, dict[str, list[float]]]]:
    """五歲年齡組人口：{iso3 或 'WLD': {年: {'m': [21 組], 'f': [21 組]}}}，單位是人"""
    path = download(wpp.AGE5_URL, "wpp", "WPP2024_PopulationByAge5GroupSex_Medium.csv.gz")
    out: dict[str, dict[int, dict[str, list[float]]]] = {}
    with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row["LocTypeID"] == WORLD:
                area = "WLD"
            elif row["LocTypeID"] == COUNTRY and row["ISO3_code"]:
                area = row["ISO3_code"]
            else:
                continue
            year = int(row["Time"])
            if not FIRST_YEAR <= year <= LAST_YEAR:
                continue
            k = AGE_STARTS.index(int(row["AgeGrpStart"]))
            cell = out.setdefault(area, {}).setdefault(year, {"m": [0.0] * len(AGE_STARTS), "f": [0.0] * len(AGE_STARTS)})
            cell["m"][k] = float(row["PopMale"] or 0) * 1000  # 千人
            cell["f"][k] = float(row["PopFemale"] or 0) * 1000
    return out


def _ageing(groups: dict[str, list[float]]) -> tuple[float | None, float | None]:
    """(65 歲以上占總人口 %, 扶老比：65 歲以上 ÷ 15–64 歲 × 100)"""
    total = [m + f for m, f in zip(groups["m"], groups["f"])]
    old = sum(total[13:])  # 65 歲起（第 14 組）
    working = sum(total[3:13])  # 15–64 歲
    everyone = sum(total)
    return (
        round(old / everyone * 100, 2) if everyone else None,
        round(old / working * 100, 1) if working else None,
    )


def _pyramid(by_year: dict[int, dict[str, list[float]]]) -> dict:
    """一個國家的人口金字塔檔：指標檔同一種差分編碼（[e, 差分…]），整個國家共用指數 e"""
    biggest = max(max(v) for cell in by_year.values() for v in cell.values())
    e = max(0, math.floor(math.log10(biggest)) - (PYRAMID_DIGITS - 1)) if biggest > 0 else 0
    values: dict[str, list[int | None]] = {}
    for sex in ("m", "f"):
        for k, start in enumerate(AGE_STARTS):
            out: list[int | None] = [e]
            prev = 0
            for year in YEARS:
                cell = by_year.get(year)
                if cell is None:
                    out.append(None)
                    continue
                q = round(cell[sex][k] / 10**e)
                out.append(q - prev)
                prev = q
            values[f"{sex}{start}"] = out
    return {
        "indicator": "pyramid",
        "unit": "人",
        "years": YEARS,
        "projectionFrom": PROJECTION_FROM,
        "ages": AGE_STARTS,
        "encoding": "delta",
        "values": values,
    }


def build() -> None:
    out = OUT_DIR / "topics" / "fertility"
    series, world = _demographic()

    by_age = _by_age()
    series["aged-65"], series["old-age-dependency"] = {}, {}
    world["aged-65"], world["old-age-dependency"] = [None] * len(YEARS), [None] * len(YEARS)
    for area, by_year in by_age.items():
        share = [None] * len(YEARS)
        ratio = [None] * len(YEARS)
        for year, groups in by_year.items():
            share[year - FIRST_YEAR], ratio[year - FIRST_YEAR] = _ageing(groups)
        if area == "WLD":
            world["aged-65"], world["old-age-dependency"] = share, ratio
        else:
            series["aged-65"][area], series["old-age-dependency"][area] = share, ratio

    units = {"tfr": "人/婦女", "births": "人", "aged-65": "%", "old-age-dependency": "每百位 15–64 歲"}
    for key, unit in units.items():
        zh, en = NOTES[key]
        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, YEARS, series[key],
                projectionFrom=PROJECTION_FROM,
                aggregates={"WLD": world[key]},
                notes={"TWN": zh},
                notesEn={"TWN": en},
            ),
        )

    sizes = []
    for area, by_year in sorted(by_age.items()):
        if area == "WLD":
            continue
        path = out / "countries" / f"{area}.json"
        write_json(path, _pyramid(by_year), quiet=True)
        sizes.append(path.stat().st_size)
    print(f"  人口金字塔 {len(sizes)} 國，共 {sum(sizes) / 1024:.0f} KB（最大 {max(sizes) / 1024:.0f} KB）")

    write_json(
        out / "manifest.json",
        {
            "topic": "fertility",
            "generatedAt": now_iso(),
            "source": "UN World Population Prospects 2024, Medium variant",
            "sourceUrl": [wpp.URL, wpp.AGE5_URL],
            "years": [FIRST_YEAR, LAST_YEAR],
            "projectionFrom": PROJECTION_FROM,
            "countries": sorted(series["tfr"]),
        },
    )
