"""Penn World Table 11.0（Groningen Growth and Development Centre，https://www.rug.nl/ggdc/productivity/pwt/）。

- 2025 年 10 月發布，185 國、1950–2023 年，有台灣。CC BY 4.0，引用 Feenstra, Inklaar & Timmer (2015),
  "The Next Generation of the Penn World Table", American Economic Review 105(10)。
- 檔案在 DataverseNL（DOI 10.34894/FABVLR），pwt110.xlsx 約 5.8 MB，資料在「Data」工作表，一列是一國一年。
- 用到的欄位：avh（就業者平均每年工作時數）、xr（對美元年平均匯率）、
  pl_c（家庭消費的價格水準，以 2021 年美國 GDP 的價格水準 = 1）。
- openpyxl 讀整張表要十幾秒，讀一次就留在記憶體裡。
"""
from __future__ import annotations

from functools import cache

import openpyxl

from common import download
from sources.countries import to_iso3

URL = "https://dataverse.nl/api/access/datafile/554105"  # pwt110.xlsx
VERSION = "11.0"
COLUMNS = ("avh", "xr", "pl_c")

Series = dict[str, dict[int, float]]


@cache
def _data() -> dict[str, Series]:
    path = download(URL, "pwt", "pwt110.xlsx")
    workbook = openpyxl.load_workbook(path, read_only=True)
    try:
        rows = workbook["Data"].iter_rows(values_only=True)
        header = list(next(rows))
        missing = [n for n in ("countrycode", "year", *COLUMNS) if n not in header]
        if missing:
            raise RuntimeError(f"PWT 的 Data 工作表沒有這些欄位：{missing}")
        code_col, year_col = header.index("countrycode"), header.index("year")
        cols = {n: header.index(n) for n in COLUMNS}
        out: dict[str, Series] = {n: {} for n in COLUMNS}
        for row in rows:
            iso3 = to_iso3(row[code_col])
            if not iso3:
                continue
            for name, col in cols.items():
                value = row[col]
                if value is not None:
                    out[name].setdefault(iso3, {})[int(row[year_col])] = float(value)
        return out
    finally:
        workbook.close()


def variable(name: str) -> Series:
    """{iso3: {year: value}}，空格不收。name 要在 COLUMNS 裡。"""
    return _data()[name]


def consumption_ppp(iso3: str) -> dict[int, float]:
    """家庭消費的購買力平價（本國貨幣／國際元，以當年美國的消費價格為準）= pl_c × xr ÷ 美國當年的 pl_c。

    跟世界銀行的 PA.NUS.PRVT.PP（民間消費 PPP，ILOSTAT 換算國際元用的就是它）同一個概念。
    """
    pl_c, xr = variable("pl_c"), variable("xr")
    us = pl_c["USA"]
    return {
        year: level * xr[iso3][year] / us[year]
        for year, level in pl_c.get(iso3, {}).items()
        if year in xr.get(iso3, {}) and year in us
    }
