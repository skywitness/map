"""UN DESA International Migrant Stock 2024（CC BY 3.0 IGO）：各國的國際移民存量，依目的地與來源國。

- 「國際移民」= 住在出生國以外的人；沒有出生地資料的國家改用國籍（外國人），例如台灣、日本、韓國。
- 年份是 1990、1995、2000、2005、2010、2015、2020、2024 的年中，不是每年。
- Table 1 一列是一組 (目的地, 來源)，目的地與來源都可能是區域或所得組（代碼 ≥ 900）；
  「World」(900) 當來源就是該國的移民總數，當目的地就是該國移居國外的人（僑民）總數。
- 來源國不明的移民歸在「Other South」「Other North」（代碼 2003、2004 等），只算進總數。
- 台灣是「China, Taiwan Province of China」(158)，目的地與來源都有。
"""
from __future__ import annotations

import openpyxl

from common import download
from sources.countries import from_numeric

URL = (
    "https://www.un.org/development/desa/pd/sites/www.un.org.development.desa.pd/files/"
    "undesa_pd_2024_ims_stock_by_sex_destination_and_origin.xlsx"
)
WORLD = 900
# Table 1 的欄位：Index, 目的地名稱, Coverage, Data type, 目的地代碼, 來源名稱, 來源代碼, 1990…2024（男女合計）, 男, 女
FIRST_VALUE_COLUMN = 7


def _iso3(code: int | None) -> str | None:
    """M49 代碼 → ISO3；區域、所得組、「Other South」等回傳 None。海峽群島（830）沒有 ISO 代碼。"""
    if code is None or code >= WORLD:
        return None
    return from_numeric(code)


def matrix() -> tuple[list[int], dict[tuple[str | None, str | None], list[float | None]], dict[str, str]]:
    """回傳 (年份, {(目的地 ISO3 或 None=全世界, 來源 ISO3 或 None=全世界): 各年人數}, {目的地 ISO3: 資料類型})。
    (None, None) 是全世界的移民總數。

    只收國家與全世界的列（不收區域、所得組）；資料類型例如 'B'（出生地）、'C'（國籍）、
    'B R'（出生地，另外加上難民）。
    """
    path = download(URL, "undesa-ims", "undesa_pd_2024_ims_stock_by_sex_destination_and_origin.xlsx")
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb["Table 1"]
    years: list[int] = []
    out: dict[tuple[str | None, str | None], list[float | None]] = {}
    data_type: dict[str, str] = {}
    for row in ws.iter_rows(values_only=True):
        if not years:
            if row[0] == "Index":
                years = [int(c) for c in row[FIRST_VALUE_COLUMN:] if isinstance(c, (int, float))]
                years = years[: years.index(max(years)) + 1]  # 後面接著男、女，年份重新開始
            continue
        dest_code, origin_code = row[4], row[6]
        if not isinstance(dest_code, int) or not isinstance(origin_code, int):
            continue
        dest = None if dest_code == WORLD else _iso3(dest_code)
        origin = None if origin_code == WORLD else _iso3(origin_code)
        if (dest is None and dest_code != WORLD) or (origin is None and origin_code != WORLD):
            continue
        values = [float(v) if isinstance(v, (int, float)) else None for v in row[FIRST_VALUE_COLUMN : FIRST_VALUE_COLUMN + len(years)]]
        out[(dest, origin)] = values
        if dest and origin is None and row[3]:
            data_type[dest] = str(row[3]).strip()
    if not years or not out:
        raise RuntimeError("讀不到 International Migrant Stock 的 Table 1，檔案格式可能變了")
    return years, out, data_type
