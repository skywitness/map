"""薪資與工時：薪資的十分位差距、低薪比例、最低工資占薪資的比例（Kaitz 指數）（2026-11-07，製作手冊第二十五批 452，
合併候選 1094、1095、1128 的最低工資那一半；步驟 wages-distribution，輸出 topics/wages/）。

- OECD Earnings Distribution Database（OECD.ELS.SAE 的 DSD_EARNINGS，CC BY 4.0），全時受僱者的毛薪資：
  - earnings-ratio/<d9d1|d9d5|d5d1>.json：DEC_I 的第 9 十分位 ÷ 第 1 十分位等（SEX=_T），50 國左右，1970 年起；
  - low-pay.json：PAY_INCIDENCE 的 LP_I（薪資低於中位數三分之二的全時受僱者比例，SEX=_T）；
  - minimum-to-wage/<median|mean>.json：MIN2AVE，法定最低工資占全時受僱者薪資的中位數或平均（33 國）。
  各國調查年份不同，前端用 5 年內最近一年。
- 台灣：OECD 沒有台灣。最低工資占平均薪資自己算：勞動部的每月基本工資（sources/mol.py）÷ 主計總處工業及服務業
  受僱員工每月總薪資（sources/dgbas_wages.py，含年終等非經常性薪資，但也含部分工時，不含公部門與農業），hints 寫明；
  中位數版、十分位比、低薪比例沒有台灣（薪情平臺的中位數沒有開放的資料集）。
- 團體協約涵蓋率與工會密度：使用者 2026-11-07 決定不做（跟 2026-10-29 排除的候選 80 是同一題）。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import dgbas_wages, mol, oecd

OUT = OUT_DIR / "topics" / "wages"
FLOW = "OECD.ELS.SAE,DSD_EARNINGS@{}"
FIRST = 1990
WITHIN = 5
RATIOS = {"d9d1": "D9_1", "d9d5": "D9_5", "d5d1": "D5_1"}
NO_TW = {"TWN": "OECD 的資料沒有台灣"}
NO_TW_EN = {"TWN": "Taiwan is not in the OECD data"}


def _write(path, indicator, unit, series, digits, **extra) -> list[int]:
    last = max(y for s in series.values() for y in s)
    years = list(range(FIRST, last + 1))
    values = {c: to_series({y: v for y, v in s.items() if y >= FIRST}, years, digits) for c, s in sorted(series.items())}
    write_json(path, indicator_file(indicator, unit, years, values, latestWithin=WITHIN, license="CC BY 4.0", **extra), quiet=True)
    return years


def _latest(series, last):
    out = [(round(s[max(y for y in s if y <= last)], 2), c, max(y for y in s if y <= last)) for c, s in series.items()
           if any(last - WITHIN < y <= last for y in s)]
    return sorted(out, reverse=True)


def build() -> None:
    for key, op in RATIOS.items():
        s, _ = oecd.series(FLOW.format("DEC_I,1.0"), AGGREGATION_OPERATION=op, SEX="_T")
        years = _write(OUT / "earnings-ratio" / f"{key}.json", "earnings-ratio", "倍", s, 2, noValue=NO_TW, noValueEn=NO_TW_EN)
        top = _latest(s, years[-1])
        print(f"  {key}：{len(top)} 國；最高 {top[:7]}；最低 {top[-7:]}")
    s, _ = oecd.series(FLOW.format("PAY_INCIDENCE,1.0"), MEASURE="LP_I", SEX="_T")
    years = _write(OUT / "low-pay.json", "low-pay", "%", s, 1, noValue=NO_TW, noValueEn=NO_TW_EN)
    top = _latest(s, years[-1])
    print(f"  低薪比例：{len(top)} 國；最高 {top[:6]}；最低 {top[-6:]}")

    mw, earnings = mol.monthly(), dgbas_wages.monthly_earnings()
    taiwan = {y: mw[y] / earnings[y] * 100 for y in mw if y in earnings and y >= FIRST}
    for key, op in (("median", "MEDIAN"), ("mean", "MEAN")):
        s, _ = oecd.series(FLOW.format("MIN2AVE,1.0"), AGGREGATION_OPERATION=op)
        extra = {"noValue": {"TWN": "台灣沒有開放的薪資中位數資料"}, "noValueEn": {"TWN": "No open data on Taiwan’s median wage"}}
        if key == "mean":
            s["TWN"] = taiwan
            extra = {"hints": {"TWN": "自算：勞動部的每月基本工資 ÷ 主計總處工業及服務業受僱員工每月總薪資（含部分工時、年終獎金）"},
                     "hintsEn": {"TWN": "Own calculation: Ministry of Labor monthly minimum wage ÷ DGBAS average monthly total "
                                        "earnings of employees in industry and services (incl. part-time workers and bonuses)"}}
        years = _write(OUT / "minimum-to-wage" / f"{key}.json", "minimum-to-wage", "%", s, 1, **extra)
        top = _latest(s, years[-1])
        print(f"  最低工資占{key}：{len(top)} 國；最高 {top[:8]}；最低 {top[-7:]}")
    print(f"    台灣 {[(y, round(v, 1)) for y, v in sorted(taiwan.items()) if y >= 2015]}")
