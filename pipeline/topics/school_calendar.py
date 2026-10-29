"""學制與開學月份（教育主題的擴充，2026-10-29）：新學年從幾月開始、義務教育幾年、小學入學年齡。

**來源**（使用者決定：開學月份用 UIS，另兩個用世界銀行的版本）：
- 開學月份：UNESCO 統計研究所（UIS）指標 403「Start month of the academic school year」，公開 API 不必登入、不必金鑰。
  **CC BY-SA 4.0**，所以 school-start.json 要用 CC BY-SA 4.0 分享（頁尾寫明，DESIGN.md 第 8 節第 12 點）。
- 義務教育年數（SE.COM.DURS）、小學入學年齡（SE.PRM.AGES）：世界銀行 WDI 轉載的 UIS 資料，CC BY 4.0。
- 台灣（UIS、世界銀行都沒有）：依法規。《各級學校學生學年學期假期辦法》第 2 條「各級學校以每年八月一日為學年之始」
  （暑假到 8 月 29 日，開學上課在 8 月底或 9 月初）；《國民教育法》第 3、4 條：六歲至十五歲之國民應受國民教育，
  前六年國小、後三年國中（義務教育 9 年、6 歲入學；十二年國教的後三年不是強迫入學）。2026-10-29 在全國法規資料庫核對原文。

**UIS 跟實際不同的國家**（使用者決定：依實際修正、附註出處；FIX_START）：「開學月份」是新學年開始上課的月份，
UIS 有幾國寫的是統計用的學年起算月或明顯不對：美國 7 月（不少州的學年從 7 月 1 日算起，多數學生 8 月開學）、
巴西 3 月（多數州 2 月初開學）、德國 10 月（各邦的學年從 8 月 1 日開始，多數邦 8 月開學）。修正套用到每一年。
"""
from __future__ import annotations

import json

from common import OUT_DIR, download, indicator_file, write_json
from sources import worldbank

OUT = OUT_DIR / "topics" / "education"
UIS = "https://api.uis.unesco.org/api/public/data/indicators?indicator=403&start={start}&end={end}"
FIRST_YEAR, LAST_YEAR = 2015, 2025
WB_FIRST = 2000

# ISO3 → (月份, 中文附註, 英文附註)
FIX_START = {
    "USA": (
        8,
        "UIS 寫 7 月（不少州的學年從 7 月 1 日算起）；各學區自訂開學日，多數學生 8 月中下旬開學，東北部多在 9 月勞動節後"
        "（Pew Research Center，2023 年 8 月 25 日）。",
        "UIS gives July (many states count the school year from 1 July); districts set their own start dates and most students "
        "start in mid-to-late August, the Northeast mostly after Labor Day in September (Pew Research Center, 25 August 2023).",
    ),
    "BRA": (
        2,
        "UIS 寫 3 月；各州自訂校曆，多數州 2 月初開學（例如聖保羅州 2025 年 2 月 3 日，SEDUC-SP 的校曆決議）。",
        "UIS gives March; each state sets its own calendar and most start in early February (São Paulo state on 3 February 2025, "
        "per the SEDUC-SP calendar resolution).",
    ),
    "DEU": (
        8,
        "UIS 寫 10 月；各邦的學年從 8 月 1 日開始（2020 年的各邦協議，Eurydice），開學日跟著各邦的暑假，多數邦 8 月、"
        "巴伐利亞與巴登-符騰堡 9 月中。",
        "UIS gives October; the school year runs from 1 August in every Land (the 2020 agreement between the Länder, per Eurydice), "
        "and classes resume after each Land’s summer holidays: August in most Länder, mid-September in Bavaria and Baden-Württemberg.",
    ),
}
TW_START = 8
TW_COMPULSORY = 9
TW_AGE = 6
TW_NOTE = "依《各級學校學生學年學期假期辦法》第 2 條，學年從 8 月 1 日開始（暑假到 8 月 29 日，開學上課在 8 月底或 9 月初）。"
TW_NOTE_EN = "Under the Regulations on School Years, Semesters and Holidays (Article 2), the school year starts on 1 August (summer holidays end on 29 August, so classes begin in late August or early September)."
TW_LAW = "依《國民教育法》第 3、4 條：6 歲至 15 歲應受國民教育（國小 6 年、國中 3 年）；十二年國教的後 3 年不是強迫入學。"
TW_LAW_EN = "Under the National Education Act (Articles 3 and 4): education is compulsory from age 6 to 15 (six years of primary and three of junior high); the last three years of the 12-year basic education are not compulsory."


def uis_start() -> dict[str, dict[int, float]]:
    path = download(UIS.format(start=FIRST_YEAR, end=LAST_YEAR), "uis", f"school-start-{FIRST_YEAR}-{LAST_YEAR}.json")
    with open(path, encoding="utf-8") as f:
        records = json.load(f)["records"]
    out: dict[str, dict[int, float]] = {}
    for r in records:
        if r["indicatorId"] == "403" and r["value"] is not None and len(r["geoUnit"]) == 3:
            out.setdefault(r["geoUnit"], {})[int(r["year"])] = float(r["value"])
    return out


def series(by: dict[str, dict[int, float]], years: list[int]) -> dict[str, list[float | None]]:
    return {c: [v.get(y) for y in years] for c, v in sorted(by.items())}


def build() -> None:
    start = uis_start()
    years = list(range(FIRST_YEAR, LAST_YEAR + 1))
    changed = []
    for iso3, (month, _zh, _en) in FIX_START.items():
        if iso3 in start:
            changed.append(f"{iso3} {sorted(set(start[iso3].values()))}→{month}")
            start[iso3] = {y: month for y in start[iso3]}
    start["TWN"] = {y: TW_START for y in years}
    print(f"  開學月份：{len(start)} 國，修正 {', '.join(changed)}")
    write_json(OUT / "school-start.json", indicator_file(
        "school-start", "", years, series(start, years),
        license="CC BY-SA 4.0 (UNESCO Institute for Statistics, indicator 403; corrections and Taiwan added by this site)",
        notes={**{c: zh for c, (_m, zh, _e) in FIX_START.items()}, "TWN": TW_NOTE},
        notesEn={**{c: en for c, (_m, _z, en) in FIX_START.items()}, "TWN": TW_NOTE_EN},
    ))

    for name, code, tw in (("compulsory-years", "SE.COM.DURS", TW_COMPULSORY), ("entrance-age", "SE.PRM.AGES", TW_AGE)):
        countries, _world = worldbank.fetch(code, WB_FIRST)
        last = max(y for v in countries.values() for y in v)
        wy = list(range(WB_FIRST, last + 1))
        countries["TWN"] = {y: tw for y in wy}
        write_json(OUT / f"{name}.json", indicator_file(
            name, "年" if name == "compulsory-years" else "歲", wy, series(countries, wy),
            notes={"TWN": TW_LAW}, notesEn={"TWN": TW_LAW_EN},
        ))
        latest = {c: v[max(v)] for c, v in countries.items()}
        from collections import Counter

        print(f"  {name}：{len(countries)} 國，{WB_FIRST}–{last}；最近一年的分布 {sorted(Counter(latest.values()).items())}")
    from collections import Counter

    print(f"  {LAST_YEAR} 年的開學月份：{sorted(Counter(v[LAST_YEAR] for v in start.values() if LAST_YEAR in v).items())}")


if __name__ == "__main__":
    build()
