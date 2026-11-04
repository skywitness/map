"""疫苗與防疫：COVID-19 的超額死亡與官方少報的倍數（World Mortality Dataset，2026-11-04，製作手冊第二十批 311）。

- 資料：Karlinsky 與 Kobak 的 World Mortality Dataset（https://github.com/akarlinsky/world_mortality ，
  `world_mortality.csv`，MIT License，README 要求引用 Karlinsky & Kobak 2021, eLife 10:e69336）：128 國的每週或每月死亡數，
  2015 年起，台灣是內政部的月資料。算好的超額死亡（dkobak/excess-mortality）是 GPL-3.0，不用，自己算。
- 基準：照 Karlinsky & Kobak 的做法，用 2015–2019 年（有幾年用幾年，至少 3 年）配「每週（月）的季節項＋整體的線性趨勢」，
  預測 2020 年以後的死亡數；超額死亡 = 實際 − 預測。第 53 週用第 52 週的季節項。
- 輸出（年底的累計，2020–2023 年，那年以前每一週或每一月都有才算）：
  - `excess-wmd.json`：每 10 萬人的累計超額死亡（WPP 2024 那一年的年中人口）。
  - `undercount.json`：官方少報的倍數 = 累計超額死亡 ÷ 同一天以前通報的 COVID-19 累計死亡（OWID 轉載的 WHO 數字；
    台灣用 JHU 轉載的疾管署每日公布）。通報死亡不到 50 人、或超額死亡不是正的，不算（倍數沒有意義）。
- 跟主題已有的 The Economist 超額死亡（模型估計、每個國家都有）是不同的方法，不能混著比；WHO 的超額死亡估計
  （CC BY-NC-SA 3.0 IGO）不用。
"""
from __future__ import annotations

import csv
from collections import defaultdict

import numpy as np

from common import OUT_DIR, download, indicator_file, write_manifest_part, write_json
from sources import owid_covid, wpp

OUT = OUT_DIR / "topics" / "vaccination"
URL = "https://raw.githubusercontent.com/akarlinsky/world_mortality/main/world_mortality.csv"
YEARS = [2020, 2021, 2022, 2023]
MIN_REPORTED = 50


def _excess() -> dict[str, dict[int, float]]:
    """{iso3: {年: 那年年底的累計超額死亡（人）}}"""
    rows = list(csv.DictReader(open(download(URL, "wmd", "world_mortality.csv"), encoding="utf-8")))
    by: dict[str, dict] = defaultdict(lambda: {"unit": None, "data": {}})
    for r in rows:
        c = by[r["iso3c"]]
        c["unit"] = r["time_unit"]
        c["data"][(int(r["year"]), int(r["time"]))] = float(r["deaths"])
    out: dict[str, dict[int, float]] = {}
    for iso3, c in by.items():
        weekly = c["unit"] == "weekly"
        periods = 52 if weekly else 12
        base = [(y, t, v) for (y, t), v in c["data"].items() if 2015 <= y <= 2019]
        if len({y for y, _, _ in base}) < 3:
            continue
        season = lambda t: min(t, 52) - 1 if weekly else t - 1  # noqa: E731
        x = np.zeros((len(base), periods + 1))
        for i, (y, t, _) in enumerate(base):
            x[i, season(t)] = 1
            x[i, periods] = y - 2015
        coef, *_ = np.linalg.lstsq(x, np.array([v for _, _, v in base]), rcond=None)
        total = 0.0
        series = {}
        for year in YEARS:
            have = [t for (y, t) in c["data"] if y == year]
            if len(have) < periods:
                break
            for t in sorted(have):
                total += float(c["data"][(year, t)] - (coef[season(t)] + coef[periods] * (year - 2015)))
            series[year] = total
        if series:
            out[iso3] = series
    return out


def build() -> None:
    excess = _excess()
    pop = wpp.demographic(["TPopulation1July"], last_year=max(YEARS))["TPopulation1July"]
    covid = owid_covid.compact()
    tw_reported = owid_covid.jhu_deaths()["Taiwan"]
    per100k, ratio = {}, {}
    for iso3, s in excess.items():
        per100k[iso3] = {y: v / pop[iso3][y] * 100 for y, v in s.items() if pop.get(iso3, {}).get(y)}
        reported_series = tw_reported if iso3 == "TWN" else covid.get(iso3, owid_covid.Covid()).death_count
        for y, v in s.items():
            dates = [d for d in reported_series if d <= f"{y}-12-31"]
            reported = reported_series[max(dates)] if dates else 0
            if reported >= MIN_REPORTED and v > 0:
                ratio.setdefault(iso3, {})[y] = v / reported
    notes = {"TWN": "台灣的死亡數是內政部的月資料（World Mortality Dataset 轉載），通報的 COVID-19 死亡是疾管署每天公布的累計（JHU 轉載），"
                    "只到 2023 年 2 月 22 日（之後不再每天公布），所以 2023 年底的倍數偏高。"}
    notes_en = {"TWN": "Taiwan’s deaths are monthly figures from the Ministry of the Interior (via the World Mortality Dataset); reported COVID-19 deaths are "
                       "Taiwan CDC’s daily cumulative count (via JHU), which stops on 22 February 2023, so the end-2023 ratio is too high."}
    write_json(OUT / "excess-wmd.json", indicator_file(
        "excess-wmd", "每 10 萬人", YEARS, {c: [round(s[y], 1) if y in s else None for y in YEARS] for c, s in sorted(per100k.items())},
        notes=notes, notesEn=notes_en))
    write_json(OUT / "undercount.json", indicator_file(
        "undercount", "倍", YEARS, {c: [round(s[y], 2) if y in s else None for y in YEARS] for c, s in sorted(ratio.items())},
        notes=notes, notesEn=notes_en))
    write_manifest_part(OUT, "vaccination", "excess-wmd", {
        "source": "World Mortality Dataset (Karlinsky & Kobak 2021, MIT License); OWID/WHO and JHU reported COVID-19 deaths; UN WPP 2024",
    })
    last = max(YEARS)
    top = sorted(((s[last], c) for c, s in per100k.items() if last in s), reverse=True)
    rtop = sorted(((s[last], c) for c, s in ratio.items() if last in s), reverse=True)
    print(f"  超額死亡（WMD）：{len(per100k)} 國；{last} 年底每 10 萬人最高 {[(c, round(v)) for v, c in top[:6]]}，最低 {[(c, round(v)) for v, c in top[-4:]]}")
    print(f"  少報倍數：{len(ratio)} 國；最高 {[(c, round(v, 1)) for v, c in rtop[:8]]}")
    print(f"  台灣：超額 { {y: round(excess['TWN'][y]) for y in excess['TWN']} }、每 10 萬人 { {y: round(v, 1) for y, v in per100k['TWN'].items()} }、倍數 {ratio.get('TWN')}")
