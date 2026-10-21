"""FAOSTAT 批次下載檔（https://bulks-faostat.fao.org/production/），直接從 zip 串流讀取。

貿易檔解壓後約 2.4 GB，所以不解壓、不整個讀進記憶體。
- 國家：用 M49 欄位對應 ISO（M49 的國家代碼與 ISO 數字代碼相同）。
- 排除：區域合計（Area Code ≥ 5000、M49 含「.」）與「China」(351)，
  後者是大陸＋港＋澳＋台的合計，留著會重複計算。台灣是 M49 158。
- World（5000）回傳成 'WLD'。
"""
from __future__ import annotations

import csv
import io
import zipfile
from collections.abc import Iterator
from typing import NamedTuple

from common import download
from sources.countries import from_numeric

BASE = "https://bulks-faostat.fao.org/production/"
DATASETS = {
    "QCL": "Production_Crops_Livestock_E_All_Data_(Normalized).zip",
    "TCL": "Trade_CropsLivestock_E_All_Data_(Normalized).zip",
    "QV": "Value_of_Production_E_All_Data_(Normalized).zip",
}
WORLD_AREA = 5000
CHINA_AGGREGATE = 351


class Row(NamedTuple):
    area: str  # ISO alpha-3 或 'WLD'
    item: int
    item_name: str
    element: int
    year: int
    value: float


def rows(dataset: str, elements: set[int], items: set[int] | None = None) -> Iterator[Row]:
    """逐列讀取，只回傳指定的 element（與 item），值為空的列略過。"""
    path = download(BASE + DATASETS[dataset], "faostat", DATASETS[dataset])
    m49_cache: dict[str, str | None] = {}
    with zipfile.ZipFile(path) as z:
        member = next(n for n in z.namelist() if n.endswith("(Normalized).csv"))
        with z.open(member) as raw:
            reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8", newline=""))
            header = next(reader)
            col = {name: i for i, name in enumerate(header)}
            i_area, i_m49 = col["Area Code"], col["Area Code (M49)"]
            i_item, i_name, i_elem = col["Item Code"], col["Item"], col["Element Code"]
            i_year, i_value = col["Year"], col["Value"]
            for r in reader:
                element = int(r[i_elem])
                if element not in elements or not r[i_value]:
                    continue
                item = int(r[i_item])
                if items is not None and item not in items:
                    continue
                area_code = int(r[i_area])
                if area_code == WORLD_AREA:
                    area = "WLD"
                elif area_code > WORLD_AREA or area_code == CHINA_AGGREGATE:
                    continue
                else:
                    m49 = r[i_m49]
                    if m49 not in m49_cache:
                        m49_cache[m49] = None if "." in m49 else from_numeric(m49)
                    area = m49_cache[m49]
                    if area is None:
                        continue  # 區域合計或已解體的國家（蘇聯、南斯拉夫等）
                yield Row(area, item, r[i_name], element, int(r[i_year]), float(r[i_value]))
