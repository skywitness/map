"""抗藥性：醫療照護相關感染的盛行率與住院病人使用抗生素的比例（2026-11-04，製作手冊第二十批 320）。

ECDC《Point prevalence survey of healthcare-associated infections and antimicrobial use in European acute care hospitals
2022–2023》的附錄 2 國家摘要表（xlsx，35.9 MB，31 國＝28 個 EU／EEA 加科索沃、蒙特內哥羅、塞爾維亞；CC BY 4.0，
署名 ECDC）。每國一個工作表，讀「Table 3. HAI prevalence and key results」的「HAI prevalence % (95%CI)」與
「Table 7」的「AU prevalence % (95%CI)」（都是調查當天的盛行率，未經驗證校正的觀察值；同表另有驗證後校正、
PPS2 調整的版本，不混用），第 2 列寫調查期間（2021 年 9 月到 2023 年）。一天的切面調查，不是年發生率；
台灣不在調查裡。
"""
from __future__ import annotations

import re

import openpyxl

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "antimicrobial-resistance"
URL = ("https://www.ecdc.europa.eu/sites/default/files/documents/"
       "healthcare-associated-acute-care-hospitals-point-prevalence-survey-annex-country-summary-sheets-2022-2023.xlsx")
YEAR = 2023
NAMES = {"Kosovo": "XKX", "Netherlands": "NLD", "Czechia": "CZE"}
MONTHS = {m: i for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}
MONTHS_EN = {v: k for k, v in MONTHS.items()}


def _value(cell: object) -> tuple[float, str] | None:
    """「 4.8 (3.4-6.8)」→ (4.8, '3.4–6.8')"""
    m = re.match(r"\s*(\d+(?:\.\d+)?)\s*\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)", str(cell or ""))
    return (float(m.group(1)), f"{m.group(2)}–{m.group(3)}") if m else None


def build() -> None:
    wb = openpyxl.load_workbook(download(URL, "ecdc", "pps-2022-2023-annex.xlsx"), read_only=True, data_only=True)
    hai, au, hints, hints_en = {}, {}, {}, {}
    for name in wb.sheetnames:
        if name in ("Intro", "Dummy"):
            continue
        iso3 = NAMES.get(name) or from_name(name)
        if not iso3:
            raise RuntimeError(f"ECDC PPS：對不到的國名 {name}")
        rows = list(wb[name].iter_rows(min_row=1, max_row=30, values_only=True))
        found = {}
        period = None
        for r in rows:
            for i, c in enumerate(r):
                if isinstance(c, str) and c.strip() == "HAI prevalence % (95%CI)":
                    found["hai"] = _value(r[i + 1])
                elif isinstance(c, str) and c.strip() == "AU prevalence % (95%CI)":
                    found["au"] = _value(r[i + 1])
                elif isinstance(c, str) and c.startswith("PPS data from"):
                    period = c
        if not found.get("hai") or not found.get("au"):
            raise RuntimeError(f"ECDC PPS：{name} 找不到盛行率：{found}")
        hai[iso3], au[iso3] = found["hai"][0], found["au"][0]
        m = re.match(r"PPS data from (\d+) (\w+) (\d{4}) to (\d+) (\w+) (\d{4})", period or "")
        if not m:
            raise RuntimeError(f"ECDC PPS：{name} 的調查期間看不懂：{period!r}")
        d1, mo1, y1, d2, mo2, y2 = m.groups()
        when = f"{y1} 年 {MONTHS[mo1]} 月到 {y2} 年 {MONTHS[mo2]} 月調查" if (y1, mo1) != (y2, mo2) else f"{y1} 年 {MONTHS[mo1]} 月調查"
        when_en = f"surveyed {mo1} {y1}–{mo2} {y2}" if (y1, mo1) != (y2, mo2) else f"surveyed {mo1} {y1}"
        hints[iso3] = (when, found["hai"][1], found["au"][1])
        hints_en[iso3] = when_en
    for key, values, ci_index in (("hai-prevalence", hai, 1), ("hospital-antibiotic-use", au, 2)):
        write_json(OUT / f"{key}.json", indicator_file(
            key, "%", [YEAR], {c: [v] for c, v in sorted(values.items())},
            hints={c: f"{h[0]}；95% 信賴區間 {h[ci_index]}%" for c, h in hints.items()},
            hintsEn={c: f"{hints_en[c]}; 95% CI {h[ci_index]}%" for c, h in hints.items()},
            noValue={"TWN": "台灣不在 ECDC 的歐洲調查裡"}, noValueEn={"TWN": "Taiwan is not in the ECDC European survey"}))
    print(f"  醫療照護相關感染：{len(hai)} 國；最高 {sorted(((v, c) for c, v in hai.items()), reverse=True)[:5]}；最低 {sorted((v, c) for c, v in hai.items())[:5]}")
    print(f"  住院病人用抗生素：{len(au)} 國；最高 {sorted(((v, c) for c, v in au.items()), reverse=True)[:5]}；最低 {sorted((v, c) for c, v in au.items())[:5]}")
