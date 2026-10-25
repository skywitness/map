"""OECD Family Database（https://www.oecd.org/en/data/datasets/oecd-family-database.html）的 Excel：結婚與離婚、非婚生子女。

- SF3.1「Marriage and divorce rates」（2025-05-28 更新）：粗結婚率、粗離婚率（1960–2022）、平均初婚年齡（男女，1990–2021）。
- SF2.4「Share of births outside of marriage」（2025-10-16 更新）：非婚生子女比例（1960–2023）。
- 兩個檔都是 2024 年 7 月以後更新的，適用 OECD 的預設授權 CC BY 4.0（DESIGN.md 第 8 節第 12 點）。
- oecd.org 的網頁擋程式，但 webfs.oecd.org 的檔案直接下載得到。
- 缺值寫「..」；國家名稱（或 ISO 代碼）在前兩欄，表的最後是附註與資料來源（第一欄是 None 或附註文字）。
"""
from __future__ import annotations

import openpyxl

from common import download
from sources.countries import from_name, to_iso3

BASE = "https://webfs.oecd.org/Els-com/Family_Database/"
MARRIAGE_FILE = "SF_3_1_Marriage_divorce_rates.xlsx"
BIRTHS_FILE = "SF_2_4_Share_births_outside_marriage.xlsx"
NAMES = {"Korea": "KOR", "Slovak Republic": "SVK", "Russian Fed.": "RUS", "Türkiye": "TUR", "Turkey": "TUR"}

Series = dict[str, dict[int, float]]


def _rows(file: str, sheet: str) -> list[tuple]:
    wb = openpyxl.load_workbook(download(BASE + file, "oecd-family", file), read_only=True, data_only=True)
    return list(wb[sheet].iter_rows(values_only=True))


def _years(header: tuple) -> dict[int, int]:
    """{欄位: 年}"""
    return {i: int(c) for i, c in enumerate(header) if c is not None and str(c).strip().isdigit()}


def _iso3(cells: tuple) -> str | None:
    for c in cells[:2]:
        if isinstance(c, str) and c.strip():
            name = c.strip()
            return to_iso3(name) or NAMES.get(name) or from_name(name)
    return None


def _number(cell: object) -> float | None:
    return float(cell) if isinstance(cell, (int, float)) else None


def _by_country(file: str, sheet: str) -> Series:
    rows = _rows(file, sheet)
    header = next(i for i, r in enumerate(rows) if r and "Country" in r)
    years = _years(rows[header])
    out: Series = {}
    for row in rows[header + 1 :]:
        if not row or not (iso3 := _iso3(row)):
            continue
        values = {y: v for i, y in years.items() if i < len(row) and (v := _number(row[i])) is not None}
        if values:
            out[iso3] = values
    return out


def crude_rates() -> tuple[Series, Series]:
    """(粗結婚率, 粗離婚率)，每千人。"""
    return _by_country(MARRIAGE_FILE, "MarriageRates"), _by_country(MARRIAGE_FILE, "DivorceRates")


def mean_age_first_marriage() -> dict[str, Series]:
    """{'male'/'female': {iso3: {年: 平均初婚年齡}}}。國名只寫在男性那一列，女性那一列接在下面。"""
    rows = _rows(MARRIAGE_FILE, "MeanAgeFirstMarriage")
    header = next(i for i, r in enumerate(rows) if r and r[0] == "Country")
    years = _years(rows[header])
    out: dict[str, Series] = {"male": {}, "female": {}}
    iso3 = None
    for row in rows[header + 1 :]:
        if not row or row[2] not in ("Male", "Female"):
            continue
        if isinstance(row[0], str) and row[0].strip():
            iso3 = _iso3(row)
        if not iso3:
            continue
        values = {y: v for i, y in years.items() if (v := _number(row[i])) is not None}
        if values:
            out["male" if row[2] == "Male" else "female"][iso3] = values
    return out


def births_outside_marriage() -> Series:
    """非婚生子女占所有活產的比例（%）。"""
    return _by_country(BIRTHS_FILE, "Births_outside_marriage")
