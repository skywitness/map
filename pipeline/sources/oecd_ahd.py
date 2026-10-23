"""OECD Affordable Housing Database（https://oe.cd/ahd，CC BY 4.0）：補上歐洲以外 OECD 國家的住宅資料。

- 每個指標一個 Excel 檔，放在 webfs.oecd.org；附錄工作表（HM1.5.A1、HM1.3.A1…）是各國歷年的數值。
- 版面：一列一個「國家 × 類別」，國名只寫在每個國家的第一列（有的國家每列都寫），
  國名後面可能有註腳編號，例如「Chile (2)」；HM1.5.A1 另有一欄「國名+類別」的鍵，不用。
- 缺值寫「..」；年份在標題列，欄位位置每個工作表不同，依標題列判斷。
- 歐盟國家的數字是 OECD 自己用 EU-SILC 算的，跟 Eurostat 的口徑不一定相同（例如以戶而不是以人計算），
  所以只用來補 Eurostat 沒有的國家。
"""
from __future__ import annotations

import re

import openpyxl

from common import download
from sources.countries import from_name

BASE = "https://webfs.oecd.org/Els-com/Affordable_Housing_Database/"
FOOTNOTE = re.compile(r"\s*\(\d+\)\s*$")


def annex(filename: str, sheet: str, categories: set[str]) -> dict[str, dict[str, dict[int, float]]]:
    """回傳 {iso3: {類別: {year: value}}}。categories 是要收的類別名稱（工作表第二欄的文字）。"""
    path = download(BASE + filename, "oecd-ahd", filename)
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows = list(wb[sheet].iter_rows(values_only=True))
    header_index = next(
        i for i, r in enumerate(rows) if sum(isinstance(c, int) and 1990 <= c <= 2035 for c in r) >= 5
    )
    year_columns = {j: c for j, c in enumerate(rows[header_index]) if isinstance(c, int) and 1990 <= c <= 2035}
    first_year_column = min(year_columns)

    out: dict[str, dict[str, dict[int, float]]] = {}
    country: str | None = None
    for row in rows[header_index + 1 :]:
        labels = [c.strip() for c in row[:first_year_column] if isinstance(c, str) and c.strip()]
        if labels and labels[0].startswith(("Notes", ".. Not available", "Note")):
            break
        category = next((label for label in labels if label in categories), None)
        names = [label for label in labels if label not in categories and not label.endswith(tuple(categories))]
        if names:
            country = from_name(FOOTNOTE.sub("", names[0]))
        if not category or not country:
            continue
        values = {
            year: float(row[j]) for j, year in year_columns.items() if j < len(row) and isinstance(row[j], (int, float))
        }
        if values:
            out.setdefault(country, {})[category] = values
    return out
