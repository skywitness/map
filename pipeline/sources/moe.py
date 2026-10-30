"""教育部統計處（https://stats.moe.gov.tw/，政府資料開放授權條款）：補上世界銀行與 UNDP 沒有的台灣教育資料。

- 教育統計（每年一版）：
  - 表 A2-5 各級教育粗在學率：高等教育是 18–22 歲，跟 UNESCO 定義相同，2008 學年度起。
    2021 年以前的版本用 18–21 歲、不含研究所，跟現在不能接起來。
  - 表 A3-1 教育經費支出占 GDP：分政府經費、公立學校自籌經費與私部門，這裡只取政府經費。
  表號每版可能會變（以前粗在學率是 A2-4），新版到 .../Education_Statistics/{版次}/{版次}edu_ODF.htm 找。
- 教育統計指標之國際比較：25 歲以上平均受教育年數（跟 UNDP 同一個公式），每版只有最近 6 年，
  所以接三個版本。舊版只有 .ods。
年度是民國年，表格裡用國字（九七、一○○），學年度以開始的那一年算（114 學年度 = 2025–26 = 2025）。
"""
from __future__ import annotations

import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree

import openpyxl

from common import download

BASE = "https://stats.moe.gov.tw/files/ebook/"
EDITION = 115  # 教育統計 115 年版（資料到 114 學年度）
GER_URL = f"{BASE}Education_Statistics/{EDITION}/{EDITION}edu_A_2_5.xlsx"
SPENDING_URL = f"{BASE}Education_Statistics/{EDITION}/{EDITION}edu_A_3_1.xlsx"
# 國際比較的平均受教育年數，舊版在前，重疊的年份用新版
MYS_URLS = [
    f"{BASE}International_Comparison/2018/i2018_1-2-5.ods",  # 2010–2015
    f"{BASE}International_Comparison/2022/i2022_3-4.ods",  # 2014–2019
    f"{BASE}International_Comparison/2026/i2026_3-4.xlsx",  # 2018–2023
]
GER_TERTIARY_COLUMN = 20  # 高等教育 18–22 歲的「總計」

CHINESE_DIGITS = {"○": 0, "〇": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}


def _roc_numeral(text: str) -> int | None:
    """「九七」「一○○」→ 97、100；「五十」這種寫法回傳 None（1960 年代，用不到）。"""
    digits = [CHINESE_DIGITS.get(ch) for ch in text.strip()]
    if not digits or None in digits:
        return None
    return int("".join(str(d) for d in digits))


def _number(cell: object) -> float | None:
    if isinstance(cell, (int, float)):
        return float(cell)
    try:
        return float(str(cell).replace(",", "").strip())
    except ValueError:
        return None


def _sheet_rows(path: Path) -> list[list]:
    """第一張工作表的所有列。xlsx 用 openpyxl；ods 直接讀 content.xml。"""
    if path.suffix == ".xlsx":
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        return [list(r) for r in wb.worksheets[0].iter_rows(values_only=True)]
    ns = {
        "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
        "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    }
    with zipfile.ZipFile(path) as z:
        root = ElementTree.fromstring(z.read("content.xml"))
    table = root.find(".//table:table", ns)
    rows = []
    for tr in table.iter(f"{{{ns['table']}}}table-row"):
        cells: list = []
        for td in tr:
            repeat = min(int(td.get(f"{{{ns['table']}}}number-columns-repeated", "1")), 50)
            value = td.get(f"{{{ns['office']}}}value")
            text = "".join(td.itertext()).strip()
            cells.extend([float(value) if value is not None else (text or None)] * repeat)
        rows.append(cells)
    return rows


def tertiary_enrollment() -> dict[int, float]:
    """高等教育粗在學率（%），{學年度開始的西元年: 值}。"""
    out: dict[int, float] = {}
    for row in _sheet_rows(download(GER_URL, "moe", Path(GER_URL).name)):
        if row and isinstance(row[0], str) and (roc := _roc_numeral(row[0])) is not None:
            if (v := _number(row[GER_TERTIARY_COLUMN])) is not None:
                out[roc + 1911] = v
    return out


def government_spending_share() -> dict[int, float]:
    """政府教育經費占 GDP（%）= 政府經費 ÷（教育經費總額 ÷ 總額占 GDP 比率），會計年度。"""
    out: dict[int, float] = {}
    for row in _sheet_rows(download(SPENDING_URL, "moe", Path(SPENDING_URL).name)):
        label = str(row[0] or "")
        year = re.search(r"(19|20)\d\d", label)
        total, government, total_share = (_number(row[i]) if len(row) > i else None for i in (2, 3, 9))
        if year and total and government is not None and total_share:
            out[int(year.group())] = government / (total / total_share)
    return out


def mean_years_of_schooling() -> dict[int, float]:
    """25 歲以上平均受教育年數，{西元年: 年}。"""
    out: dict[int, float] = {}
    for url in MYS_URLS:
        rows = _sheet_rows(download(url, "moe", Path(url).name))
        # 年份欄寫成「2018年」或「2010年 Year」
        year_of = lambda c: (m := re.match(r"((?:19|20)\d\d)\s*年", str(c or "").strip())) and int(m.group(1))  # noqa: E731
        header = next(r for r in rows if sum(bool(year_of(c)) for c in r) >= 3)
        years = {i: year_of(c) for i, c in enumerate(header) if year_of(c)}
        taiwan = next(r for r in rows if str(r[0] or "").strip().startswith("中華民國"))
        for i, year in years.items():
            if i < len(taiwan) and (v := _number(taiwan[i])) is not None:
                out[year] = v
    return out


# ── 開放資料的 CSV（data.gov.tw；學年度是民國年，換成開始的西元年）──────────
OPENDATA = "https://stats.moe.gov.tw/files/opendata/"


def _opendata(name: str) -> list[list[str]]:
    import csv

    path = download(f"{OPENDATA}{name}.csv", "moe", f"{name}.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.reader(f))


def primary_school() -> dict[int, dict[str, float]]:
    """國民小學概況（edu_B_3_1，data.gov.tw 31444）：{年: {學生數, 教師數, 班級數}}，「總計」欄，104 學年度起。"""
    out: dict[int, dict[str, float]] = {}
    for row in _opendata("edu_B_3_1")[1:]:
        if len(row) > 2 and row[1] in ("學生數", "教師數", "班級數") and row[0].isdigit():
            out.setdefault(int(row[0]) + 1911, {})[row[1]] = float(row[2])
    return out


def upper_secondary_vocational() -> dict[int, float]:
    """高級中等學校讀專業群（職業）科與實用技能學程的學生占全部學生的比例（%），各級學校概況（edu_B_1_2，data.gov.tw 31436）。

    綜合高中、進修部不算（綜合高中高一不分流，進修部有普通科也有職業類科，分不開）。
    """
    by_year: dict[int, dict[str, float]] = {}
    for row in _opendata("edu_B_1_2")[1:]:
        if len(row) > 2 and row[0].isdigit() and row[1] in ("高級中等學校", "專業群(職業)科", "實用技能學程"):
            by_year.setdefault(int(row[0]) + 1911, {})[row[1]] = float(row[2])
    return {
        y: (v["專業群(職業)科"] + v["實用技能學程"]) / v["高級中等學校"] * 100
        for y, v in by_year.items() if len(v) == 3 and v["高級中等學校"]
    }
