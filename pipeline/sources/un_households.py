"""UN DESA Population Division, Database on Household Size and Composition 2022（CC BY 3.0 IGO）。

- 一個 Excel 檔，工作表「HH size and composition 2022」一列是一個國家的一次普查或調查：
  ISO 數字代碼、資料來源類別（DYB、IPUMS、LFS、DHS、MICS）、參考日期、平均每戶人數……
- 參考日期有的是日期格式，有的是「19/10/2015」這種字串。
- 同一國同一年可能有好幾個來源（例如普查同時在 DYB 與 IPUMS），依 SOURCE_PRIORITY 取一個：
  普查（DYB、IPUMS）優先，其次是歐盟勞動力調查（LFS），最後才是抽樣調查（DHS、MICS）。
- 沒有台灣；科索沃用 412（不是 ISO 代碼）。
- 住宅主題用平均每戶人數，婚姻與家庭主題用單人家戶的比例（「1 member」，跟「One-person」那一欄相同）。
"""
from __future__ import annotations

import datetime

import openpyxl

from common import download
from sources.countries import from_numeric

URL = (
    "https://www.un.org/development/desa/pd/sites/www.un.org.development.desa.pd/files/"
    "undesa_pd_2022_hh-size-composition.xlsx"
)
SHEET = "HH size and composition 2022"
SOURCE_PRIORITY = ["DYB", "IPUMS", "LFS", "DHS", "MICS"]


def _year(cell: object) -> int | None:
    if isinstance(cell, (datetime.date, datetime.datetime)):
        return cell.year
    text = str(cell).strip()
    return int(text[-4:]) if text[-4:].isdigit() else None


def average_household_size() -> dict[str, dict[int, float]]:
    """{iso3: {year: 平均每戶人數}}"""
    return _column(4, "Average household size")


def one_person_share() -> dict[str, dict[int, float]]:
    """{iso3: {year: 單人家戶占所有家戶的比例（%）}}，「Households by size」的「1 member」。"""
    return _column(5, "1 member")


def _column(index: int, title: str) -> dict[str, dict[int, float]]:
    path = download(URL, "undesa", "hh-size-composition-2022.xlsx")
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows = list(wb[SHEET].iter_rows(values_only=True))
    header = next(i for i, r in enumerate(rows) if r and r[0] == "Country or area")
    if not str(rows[header][index]).startswith(title):
        raise RuntimeError(f"{SHEET} 的欄位變了：{rows[header][:6]}")
    best: dict[tuple[str, int], tuple[int, float]] = {}
    for row in rows[header + 1 :]:
        code, source, date, size = row[1], row[2], row[3], row[index]
        if code is None or not isinstance(size, (int, float)):
            continue
        iso3 = "XKX" if int(code) == 412 else from_numeric(code)
        year = _year(date)
        if not iso3 or year is None:
            continue
        rank = SOURCE_PRIORITY.index(source) if source in SOURCE_PRIORITY else len(SOURCE_PRIORITY)
        if (iso3, year) not in best or rank < best[(iso3, year)][0]:
            best[(iso3, year)] = (rank, float(size))
    out: dict[str, dict[int, float]] = {}
    for (iso3, year), (_, size) in best.items():
        out.setdefault(iso3, {})[year] = size
    return out
