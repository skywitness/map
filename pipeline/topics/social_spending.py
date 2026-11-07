"""政府財政：公共社會支出占 GDP（2026-11-07，製作手冊第二十五批 451，候選 1093；步驟 fiscal-social-spending，
輸出 topics/fiscal/social-spending/<用途>.json）。

- OECD Social Expenditure Database（SOCX，OECD.ELS.SPD 的 DSD_SOCX_AGG@DF_SOCX_AGG，CC BY 4.0）。**一定要加 key**：
  整個資料流 982 MB；key `.A.SOCX.PT_B1GQ.ES10._T..`（公共 ES10、占 GDP、全部支出型態、全部用途）只有幾 MB。
- 子項目是 SOCX 的用途：合計 _T 與 8 個用途（老年與遺屬 TP01＝TP11＋TP21、身心障礙相關 TP31、醫療 TP41、家庭 TP51、
  積極勞動市場政策 TP60、失業 TP71、住宅 TP82、其他 TP91）；TP11、TP21 與 TP601–607 是細項，不另列（加總會重複）。
- 1980–2024 年；2024 年只有 25 國、2022 年 40 國，前端用 3 年內最近一年。OECD 合計放 aggregates。
- 跟同一個主題的「政府支出的用途」（IMF COFOG 的社會保障占政府總支出）不同：這裡是占 GDP、用途分類不同，只算公共
  （含強制性社會保險），不含強制性與自願性的民營支出（美國雇主提供的醫療保險在民營）。台灣不在 SOCX。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import oecd
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "fiscal" / "social-spending"
FLOW, KEY = "OECD.ELS.SPD,DSD_SOCX_AGG@DF_SOCX_AGG,1.0", ".A.SOCX.PT_B1GQ.ES10._T.."
FIRST = 1980
ITEMS = {"total": "_T", "old-age": "TP01", "incapacity": "TP31", "health": "TP41", "family": "TP51", "almp": "TP60",
         "unemployment": "TP71", "housing": "TP82", "other": "TP91"}


def build() -> None:
    by: dict[str, dict[str, dict[int, float]]] = {k: defaultdict(dict) for k in ITEMS}
    oecd_avg: dict[str, dict[int, float]] = {k: {} for k in ITEMS}
    code_to_key = {v: k for k, v in ITEMS.items()}
    for r in oecd.rows(FLOW, KEY):
        key = code_to_key.get(r["PROGRAMME_TYPE"])
        if not key or not r["OBS_VALUE"]:
            continue
        y = int(r["TIME_PERIOD"][:4])
        if r["REF_AREA"] == "OECD":
            oecd_avg[key][y] = float(r["OBS_VALUE"])
        elif iso3 := to_iso3(r["REF_AREA"]):
            by[key][iso3][y] = float(r["OBS_VALUE"])
    last = max(y for s in by["total"].values() for y in s)
    years = list(range(FIRST, last + 1))
    no = {"TWN": "台灣不在 OECD 的社會支出資料庫裡"}
    no_en = {"TWN": "Taiwan is not in the OECD Social Expenditure Database"}
    for key, series in by.items():
        values = {c: to_series(s, years, 1) for c, s in sorted(series.items())}
        write_json(OUT / f"{key}.json", indicator_file("social-spending", "%", years, values, latestWithin=3, noValue=no,
                                                      noValueEn=no_en, aggregates={"OECD": to_series(oecd_avg[key], years, 1)},
                                                      license="CC BY 4.0"), quiet=True)
        for y in (2022, last):
            top = sorted(((round(s[y], 1), c) for c, s in series.items() if y in s), reverse=True)
            print(f"  {key} {y}：{len(top)} 國，OECD {oecd_avg[key].get(y)}；{top[:6]} … {top[-4:]}")
