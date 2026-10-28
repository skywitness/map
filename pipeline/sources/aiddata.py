"""AidData（William & Mary）Global Chinese Development Finance Dataset, Version 3.0（GCDF 3.0，2023-11-07 發布）。

- 內容：2000–2021 年中國官方機構（政府、政策性銀行、國有企業…）對 165 個中低所得國家與地區的開發融資，
  一筆一個項目（贈款、貸款、債務重整…），20,985 筆。
- 授權：Open Data Commons Attribution License（ODC-By 1.0）。xlsx 的 License 工作表：「Any use of the dataset and its
  content must include appropriate attribution to AidData」「you must make clear to others the license of the database
  and keep intact any notices on the original database」（DESIGN.md 第 8 節第 91 點）。
- 引用（xlsx 的 Contents 工作表，非學術用途）：AidData. 2023. Global Chinese Development Finance Dataset, Version 3.0.
  Retrieved from https://www.aiddata.org/data/aiddatas-global-chinese-development-finance-dataset-version-3-0
- 下載：zip（28.6 MB，不必填表、不必登入），裡面的 xlsx 26.4 MB；`__MACOSX/` 與 `.DS_Store` 略過。
  openpyxl 的 read_only 模式讀 GCDF_3.0 工作表約 15 秒，讀完存成 .pkl 快取。
"""
from __future__ import annotations

import io
import pickle
import zipfile
from functools import lru_cache

from common import CACHE_DIR, download

URL = "https://docs.aiddata.org/ad4/datasets/AidDatas_Global_Chinese_Development_Finance_Dataset_Version_3_0.zip"
ZIP = "gcdf3.zip"
PAGE = "https://www.aiddata.org/data/aiddatas-global-chinese-development-finance-dataset-version-3-0"

# 用到的欄位（xlsx 的欄名）
COLUMNS = [
    "AidData Record ID",
    "Recommended For Aggregates",
    "Recipient",
    "Recipient ISO-3",
    "Commitment Year",
    "Title",
    "Status",
    "Flow Type Simplified",
    "Flow Class",
    "Sector Code",
    "Adjusted Amount (Constant USD 2021)",
    "Adjusted Amount (Nominal USD)",
]


def _workbook():
    import openpyxl

    path = download(URL, "aiddata", ZIP)
    with zipfile.ZipFile(path) as z:
        name = next(n for n in z.namelist() if n.endswith(".xlsx") and not n.startswith("__MACOSX"))
        data = z.read(name)
    return openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)


@lru_cache(maxsize=1)
def _load() -> dict:
    """{"records": GCDF_3.0 的每一筆（只留 COLUMNS，欄名當 key）, "countries": CountryList 的 (英文名稱, 筆數)}"""
    cache = CACHE_DIR / "aiddata" / "gcdf3-records.pkl"
    if cache.exists():
        with open(cache, "rb") as f:
            return pickle.load(f)
    wb = _workbook()
    rows = wb["GCDF_3.0"].iter_rows(values_only=True)
    header = next(rows)
    index = {name: header.index(name) for name in COLUMNS}
    data = {
        "records": [{name: row[i] for name, i in index.items()} for row in rows if row[0] is not None],
        # 筆數欄沒有項目的寫「No projects/activities found」；表格最後兩列是說明文字（第二欄空白）
        "countries": [
            (row[0], row[2]) for row in wb["CountryList"].iter_rows(values_only=True) if row[0] and row[1] and row[0] != "Country"
        ],
    }
    with open(cache, "wb") as f:
        pickle.dump(data, f)
    return data


def records() -> list[dict]:
    """GCDF_3.0 工作表的每一筆"""
    return _load()["records"]


def covered_countries() -> list[tuple[str, int | str]]:
    """CountryList 工作表：AidData 有系統地搜尋過的 165 個國家與地區，(英文名稱, 筆數或「No projects/activities found」)"""
    return _load()["countries"]
