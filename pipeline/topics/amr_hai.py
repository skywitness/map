"""抗藥性：醫療照護相關感染的盛行率與住院病人使用抗生素的比例（2026-11-04，製作手冊第二十批 320）。

ECDC《Point prevalence survey of healthcare-associated infections and antimicrobial use in European acute care hospitals
2022–2023》的附錄 2 國家摘要表（xlsx，35.9 MB，31 國＝28 個 EU／EEA 加科索沃、蒙特內哥羅、塞爾維亞；CC BY 4.0，
署名 ECDC）。每國一個工作表，讀「Table 3. HAI prevalence and key results」的「HAI prevalence % (95%CI)」與
「Table 7」的「AU prevalence % (95%CI)」（都是調查當天的盛行率，未經驗證校正的觀察值；同表另有驗證後校正、
PPS2 調整的版本，不混用），第 2 列寫調查期間（2021 年 9 月到 2023 年）。一天的切面調查，不是年發生率；
台灣不在調查裡。

台灣沒有點盛行率調查。疾管署「台灣醫院感染管制與抗藥性監測管理系統」（THAS，醫院自願通報）的開放資料只有加護病房：
「加護病房醫療照護相關感染部位別感染密度資料」（data.gov.tw 26324，`THAS_HAI_ICU_11.csv`，2008–2024 年，政府資料開放授權
條款第 1 版）。od.cdc.gov.tw 從 cloud 連線被重設，本機 session 下載到 map-plan 的 `data/cdc/`；重跑前複製到
`pipeline/.cache/cdc/`。全國＝三個醫院層級的感染人次加總 ÷ 住院人日加總 × 1000（每千住院人日），定義跟 ECDC 的盛行率不同，
只寫在台灣的說明（noValue）。
"""
from __future__ import annotations

import csv
import hashlib
import io
import re

import openpyxl

from common import CACHE_DIR, OUT_DIR, download, indicator_file, write_json
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "antimicrobial-resistance"
THAS_ICU = CACHE_DIR / "cdc" / "THAS_HAI_ICU_11.csv"
THAS_ICU_SHA256 = "a3abb11f2d9fe94c6234e4b435ffb165be29c918f6e5e09c6908bc273cc3292f"


def _taiwan_icu() -> dict[int, float]:
    """疾管署 THAS：全國加護病房的感染密度（每千住院人日），{年: 值}"""
    if not THAS_ICU.exists():
        raise RuntimeError(f"沒有 {THAS_ICU}：請把 map-plan 的 data/cdc/THAS_HAI_ICU_11.csv 複製到這裡")
    body = THAS_ICU.read_bytes()
    if hashlib.sha256(body).hexdigest() != THAS_ICU_SHA256:
        raise RuntimeError(f"{THAS_ICU} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改")
    days: dict[int, int] = {}
    cases: dict[int, int] = {}
    for r in csv.DictReader(io.StringIO(body.decode("utf-8-sig"))):
        y = int(r["統計年度"])
        days[y] = days.get(y, 0) + int(r["住院人日數"])
        cases[y] = cases.get(y, 0) + sum(int(r[k]) for k in ("血流感染人次數", "肺炎感染人次數", "泌尿道感染人次數", "其他部位感染人次數"))
    return {y: cases[y] / days[y] * 1000 for y in sorted(days)}
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
    icu = _taiwan_icu()
    last, first = max(icu), min(icu)
    if icu[last] < 3 or icu[last] > 8:
        raise RuntimeError(f"台灣加護病房感染密度 {last} 年 {icu[last]:.2f}‰，跟以前差太多，先看過資料")
    tw_hai = (f"台灣不在 ECDC 的歐洲調查裡，也沒有點盛行率調查。疾管署 THAS（醫院自願通報）只有加護病房的感染密度："
              f"{last} 年全國每千住院人日 {icu[last]:.2f} 人次（{first} 年 {icu[first]:.2f}），定義不同，不能跟這張圖比")
    tw_hai_en = (f"Taiwan is not in the ECDC European survey and has no point-prevalence survey. Taiwan CDC’s THAS (voluntary hospital reporting) "
                 f"only gives intensive-care infection density: {icu[last]:.2f} per 1,000 patient-days nationally in {last} ({icu[first]:.2f} in {first}), "
                 "a different measure that cannot be compared with this map")
    for key, values, ci_index in (("hai-prevalence", hai, 1), ("hospital-antibiotic-use", au, 2)):
        tw, tw_en = ((tw_hai, tw_hai_en) if key == "hai-prevalence"
                     else ("台灣不在 ECDC 的歐洲調查裡", "Taiwan is not in the ECDC European survey"))
        write_json(OUT / f"{key}.json", indicator_file(
            key, "%", [YEAR], {c: [v] for c, v in sorted(values.items())},
            hints={c: f"{h[0]}；95% 信賴區間 {h[ci_index]}%" for c, h in hints.items()},
            hintsEn={c: f"{hints_en[c]}; 95% CI {h[ci_index]}%" for c, h in hints.items()},
            noValue={"TWN": tw}, noValueEn={"TWN": tw_en}))
    print(f"  台灣加護病房感染密度（每千住院人日）：{ {y: round(icu[y], 2) for y in (first, 2019, 2023, last)} }")
    print(f"  醫療照護相關感染：{len(hai)} 國；最高 {sorted(((v, c) for c, v in hai.items()), reverse=True)[:5]}；最低 {sorted((v, c) for c, v in hai.items())[:5]}")
    print(f"  住院病人用抗生素：{len(au)} 國；最高 {sorted(((v, c) for c, v in au.items()), reverse=True)[:5]}；最低 {sorted((v, c) for c, v in au.items())[:5]}")
