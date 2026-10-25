"""OECD《PISA 2025 Results (Volume I)》附錄 B1 的表（StatLink 的 Excel 檔，CC BY 4.0）。

- Volume I 是 2026-09-08 出版的，版權頁寫「© OECD 2026, Attribution 4.0 International (CC BY 4.0)」，
  StatLink 的 Excel 是這本書的一部分（檔案的「About this file」頁寫「PISA 2025 Results (Volume I) - © OECD 2026」）。
- 用到兩個檔：
  - https://stat.link/mrq53f：第 2 章的表 I.B1.2a.*（平均分數與各級比例）。
    I.B1.2a.36–38 是科學 2006、閱讀 2000、數學 2003 年起每一次的平均分數，
    I.B1.2a.33–35 是同樣年份的低成就（未達第 2 級）與高成就（第 5 級以上）比例。
  - https://stat.link/68stqn：表 I.B1.2c.*（男女）。I.B1.2c.25、28、31 是 2015 年起每一次的男女差距（男生 − 女生）。
- 這些表只列參加 2025 年的 91 個國家與經濟體（含它們之前每一次的成績）；只參加過之前幾次的
  （俄羅斯、上海、列支敦斯登…）要用 2024 年 7 月以前出版的報告，那些不是 CC BY 4.0，沒有用（DESIGN.md 第 8 節）。
- 表裡的國名是 OECD 的寫法（「Chinese Taipei」「Hong Kong (China)」「B-S-J-Z (China)」），在 NAMES 對到地圖的
  代碼；只有部分地區參加的（北京上海江蘇浙江、杜尚別、庫德斯坦地區、烏克蘭的部分地區）對到主題自訂的地點（`_` 開頭）。
"""
from __future__ import annotations

import re
from pathlib import Path

import openpyxl

from common import download

FILES = {"performance": "mrq53f", "gender": "68stqn"}
URL = "https://stat.link/{}"

DOMAINS = ("math", "reading", "science")
# 每個科目的表號：平均分數、低／高成就比例、男女差距
MEAN_TABLE = {"science": "I.B1.2a.36", "reading": "I.B1.2a.37", "math": "I.B1.2a.38"}
LEVEL_TABLE = {"science": "I.B1.2a.33", "reading": "I.B1.2a.34", "math": "I.B1.2a.35"}
GENDER_TABLE = {"science": "I.B1.2c.25", "reading": "I.B1.2c.28", "math": "I.B1.2c.31"}

# OECD 的平均：全部會員國（只有各國都有資料的那幾次才有值）、PISA 2000 起每次都參加的 23 國、2015 年起可比的 35 國
AGGREGATES = {"OECD average": "OECD", "OECD average-23": "OECD23", "OECD average-35": "OECD35"}

# 表裡的國名（去掉表示「未達抽樣標準」的星號）→ 地圖的 ISO alpha-3，或主題自訂的地點（`_` 開頭，pisa.ts 的 PLACES）
NAMES = {
    "Albania": "ALB", "Argentina": "ARG", "Armenia": "ARM", "Australia": "AUS", "Austria": "AUT",
    "Azerbaijan": "AZE", "Belgium": "BEL", "Brazil": "BRA", "Brunei Darussalam": "BRN", "B-S-J-Z (China)": "_QCI",
    "Bulgaria": "BGR", "Cambodia": "KHM", "Canada": "CAN", "Chile": "CHL", "Colombia": "COL", "Costa Rica": "CRI",
    "Croatia": "HRV", "Cyprus": "CYP", "Czechia": "CZE", "Denmark": "DNK", "Dominican Republic": "DOM",
    "Dushanbe (Tajikistan)": "_QTJ", "Ecuador": "ECU", "El Salvador": "SLV", "Estonia": "EST", "Finland": "FIN",
    "France": "FRA", "Georgia": "GEO", "Germany": "DEU", "Greece": "GRC", "Guatemala": "GTM",
    "Hong Kong (China)": "HKG", "Hungary": "HUN", "Iceland": "ISL", "Indonesia": "IDN", "Ireland": "IRL",
    "Israel": "ISR", "Italy": "ITA", "Japan": "JPN", "Jordan": "JOR", "Kazakhstan": "KAZ", "Kenya": "KEN",
    "Korea": "KOR", "Kosovo": "XKX", "Kurdistan Region (Iraq)": "_QKI", "Kyrgyzstan": "KGZ", "Latvia": "LVA",
    "Lebanon": "LBN", "Lithuania": "LTU", "Luxembourg": "LUX", "Macao (China)": "MAC", "Malaysia": "MYS",
    "Malta": "MLT", "Mauritius": "MUS", "Mexico": "MEX", "Moldova": "MDA", "Mongolia": "MNG", "Montenegro": "MNE",
    "Morocco": "MAR", "Netherlands": "NLD", "New Zealand": "NZL", "North Macedonia": "MKD", "Norway": "NOR",
    "Palestinian Authority": "PSE", "Paraguay": "PRY", "Peru": "PER", "Philippines": "PHL", "Poland": "POL",
    "Portugal": "PRT", "Qatar": "QAT", "Romania": "ROU", "Rwanda": "RWA", "Saudi Arabia": "SAU", "Serbia": "SRB",
    "Singapore": "SGP", "Slovak Republic": "SVK", "Slovenia": "SVN", "Spain": "ESP", "Sweden": "SWE",
    "Switzerland": "CHE", "Chinese Taipei": "TWN", "Thailand": "THA", "Türkiye": "TUR",
    "Ukrainian regions (17 of 27)": "_QUA", "United Arab Emirates": "ARE", "United Kingdom": "GBR",
    "United States": "USA", "Uruguay": "URY", "Uzbekistan": "UZB", "Viet Nam": "VNM", "Zambia": "ZMB",
}

Series = dict[str, dict[int, float]]


def path(key: str) -> Path:
    return download(URL.format(FILES[key]), "oecd-pisa", f"{FILES[key]}.xlsx")


def _rows(file: Path, table: str) -> list[tuple]:
    wb = openpyxl.load_workbook(file, read_only=True, data_only=True)
    try:
        sheet = wb[f"Table {table}"]
        rows = list(sheet.iter_rows(values_only=True))
    finally:
        wb.close()
    if not rows or rows[0][0] != f"Table {table}":
        raise RuntimeError(f"{file.name} 的表 {table} 格式變了")
    return rows


def _number(v: object) -> float | None:
    """表裡的缺值是 m（沒有資料）、c（樣本太少）、w（撤回）等字母"""
    return float(v) if isinstance(v, (int, float)) else None


def _entity(name: object) -> str | None:
    """國名 → 代碼；合計回傳 None（另外處理），不認得的國名直接報錯"""
    if not isinstance(name, str) or not name.strip():
        return None
    name = name.strip().rstrip("*").strip()
    if name in NAMES:
        return NAMES[name]
    raise RuntimeError(f"PISA 表裡有不認得的國名：{name!r}")


def _body(rows: list[tuple], start: int) -> list[tuple[str, tuple]]:
    """表頭以下的列：(代碼或合計代碼, 整列)，碰到附註（長的說明文字）就停"""
    out: list[tuple[str, tuple]] = []
    for row in rows[start:]:
        name = row[0]
        if not isinstance(name, str) or not name.strip():
            continue
        if name.startswith(("Information on data", "Note", "1.", "Costa Rica,", "For ", "Albania, Argentina")):
            break
        if name in AGGREGATES:
            out.append((AGGREGATES[name], row))
        else:
            code = _entity(name)
            if code:
                out.append((code, row))
    return out


def _header_row(rows: list[tuple], pattern: str) -> tuple[int, dict[int, int]]:
    """找到某一列表頭：欄位裡符合 pattern（含年份的群組）的欄 → 年份"""
    for i, row in enumerate(rows[:12]):
        cols = {
            j: int(m.group(1))
            for j, cell in enumerate(row)
            if isinstance(cell, str) and (m := re.fullmatch(pattern, cell.strip()))
        }
        if cols:
            return i, cols
    raise RuntimeError(f"找不到表頭 {pattern}")


def _split(rows: list[tuple], start: int, columns: dict[int, int]) -> tuple[Series, Series]:
    countries: Series = {}
    groups: Series = {}
    names = set(AGGREGATES.values())
    for code, row in _body(rows, start):
        values = {year: v for col, year in columns.items() if (v := _number(row[col])) is not None}
        (groups if code in names else countries)[code] = values
    return countries, groups


def means(domain: str) -> tuple[Series, Series, Series]:
    """(各國每一次的平均分數, OECD 的平均, OECD 公布的「2025 年減某一年」的分數差)"""
    rows = _rows(path("performance"), MEAN_TABLE[domain])
    head, cols = _header_row(rows, r"PISA (\d{4})")
    countries, groups = _split(rows, head + 1, cols)
    # 「PISA 2012 (PISA 2025 - PISA 2012)」：OECD 認為可以比較的才有值（例如阿爾巴尼亞沒有趨勢、全部是 m）
    _, diff_cols = _header_row(rows, r"PISA (\d{4})\s+\(PISA 2025 - PISA \d{4}\)")
    diffs, _ = _split(rows, head + 1, diff_cols)
    return countries, groups, diffs


def levels(domain: str) -> tuple[Series, Series, Series, Series]:
    """(各國的低成就比例, OECD 平均, 各國的高成就比例, OECD 平均)，%"""
    rows = _rows(path("performance"), LEVEL_TABLE[domain])
    head, cycles = _header_row(rows, r"Proficiency level in PISA (\d{4})")
    sub = rows[head + 1]
    low_cols: dict[int, int] = {}
    top_cols: dict[int, int] = {}
    for col, year in cycles.items():
        if not str(sub[col]).startswith("Below Level 2") or not str(sub[col + 2]).startswith("Level 5 or above"):
            raise RuntimeError(f"表 {LEVEL_TABLE[domain]} 的欄位變了（{year} 年）")
        low_cols[col] = year
        top_cols[col + 2] = year
    low, low_g = _split(rows, head + 1, low_cols)
    top, top_g = _split(rows, head + 1, top_cols)
    return low, low_g, top, top_g


def gender_gap(domain: str) -> tuple[Series, Series]:
    """(各國的男女差距（男生 − 女生，平均分數）, OECD 平均)"""
    rows = _rows(path("gender"), GENDER_TABLE[domain])
    head, cycles = _header_row(rows, r"PISA (\d{4}) \(boys - girls\)")
    sub = rows[head + 1]
    if any(sub[col] != "Mean" for col in cycles):
        raise RuntimeError(f"表 {GENDER_TABLE[domain]} 的欄位變了")
    return _split(rows, head + 1, cycles)
