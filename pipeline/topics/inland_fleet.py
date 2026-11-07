"""河流與流域（內河航道）的擴充：內河船隊——自航貨船、推拖船與船齡（2026-11-07，製作手冊第二十七批 583，候選 1302；
步驟 inland-fleet，輸出 topics/rivers/）。

- Eurostat `iww_eq_age`（內河船隊依建造年份，CC BY 4.0）：BAR_SP 自航貨船、TUG_PUSH 推拖船（不含客船與遊船），
  y_const：1974 年以前、1975–1999、2000 年以後，1990–2024，各國最近一年不一樣（latestWithin 2）。
  1974 年以前造的比例 = Y_LE1974 ÷ TOTAL（自航貨船）；只申報 Y_LE1974 一類的（波蘭）不算。手冊的陷阱：烏克蘭 1990 → 2023 的暴增是序列中斷（1990 年只申報部分船隊）。
- 台灣沒有可通航的內陸水道（第二十三批 411 的決定：灰色加 tooltip）。英國照網站的規則不收。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "rivers"
AGES = {"Y_LE1974": "le1974", "Y1975-1999": "1975-1999", "Y_GE2000": "ge2000"}
TAIWAN = ({"TWN": "台灣沒有可通航的內陸水道"}, {"TWN": "Taiwan has no navigable inland waterways"})


def build() -> None:
    files = {}
    for vessel, name in (("BAR_SP", "inland-barges"), ("TUG_PUSH", "inland-pushers")):
        data = eurostat.series("iww_eq_age", vessel=vessel, unit="NR", y_const="TOTAL")
        files[name] = data
        years = sorted({y for s in data.values() for y in s})
        write_json(OUT / f"{name}.json", indicator_file(
            name, "艘", years, {c: [s.get(y) for y in years] for c, s in sorted(data.items())}, latestWithin=2,
            noValue=TAIWAN[0], noValueEn=TAIWAN[1], license="CC BY 4.0"))
    total = files["inland-barges"]
    old = eurostat.series("iww_eq_age", vessel="BAR_SP", unit="NR", y_const="Y_LE1974")
    # 波蘭只申報「1974 年以前」一類（等於合計，另外兩類是空的），算出來的 100% 不可信：另外兩類至少要有一類有值才算
    newer = [eurostat.series("iww_eq_age", vessel="BAR_SP", unit="NR", y_const=k) for k in ("Y1975-1999", "Y_GE2000")]
    years = sorted({y for s in total.values() for y in s})
    share = {}
    for c, s in total.items():
        row = [round(old[c][y] / s[y] * 100, 1)
               if y in s and s[y] and y in old.get(c, {}) and any(y in n.get(c, {}) for n in newer) else None for y in years]
        if any(v is not None for v in row):
            share[c] = row
    write_json(OUT / "inland-old-share.json", indicator_file(
        "inland-old-share", "%", years, share, latestWithin=2, noValue=TAIWAN[0], noValueEn=TAIWAN[1], license="CC BY 4.0"))
    detail = {}
    for vessel, key in (("BAR_SP", "b"), ("TUG_PUSH", "t")):
        for code, age in AGES.items():
            for c, s in eurostat.series("iww_eq_age", vessel=vessel, unit="NR", y_const=code).items():
                detail.setdefault(c, {}).setdefault(key, {})[age] = [s.get(y) for y in years]
    write_json(OUT / "inland-fleet-detail.json", {"years": years, "countries": detail, "license": "CC BY 4.0"})
    for c in ("NLD", "UKR", "DEU", "BEL", "FRA"):
        s = total.get(c, {})
        print(f"  {c} 自航貨船 1990 {s.get(1990)} → {max(s) if s else None} {s.get(max(s)) if s else None}；1974 年以前 {share.get(c, [None])[-1]}%")
