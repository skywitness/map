"""FAO 全球森林資源評估 FRA 2025（https://fra-data.fao.org/，CC BY 4.0）的批次下載檔。

- 下載網址是 FRA 平台「Bulk download」按鈕用的 API，一個 zip 含各變數的 CSV，檔名帶下載當天的日期
  （例如 FRA_Years_variables/1a_forestArea_2026-10-23.csv），所以用檔名開頭找。
- 數值只有 FRA 的報告年：1990、2000、2010、2015、2020、2025，單位是千公頃。
- 236 個國家/地區，沒有台灣、香港、澳門。「China」（M49 159）的土地面積含台灣、香港、澳門
  （= FAOSTAT 的中國大陸 938,821 + 台灣 3,541 + 香港 105 + 澳門 3.3 千公頃），
  森林面積卻只有中國大陸（跟 FAOSTAT 的「China, mainland」相同），見 topics/water_forest.py。
- 「Desk study」欄是 Yes 的國家沒有提交國家報告，數值是 FAO 依現有資料推估的。
"""
from __future__ import annotations

import csv
import io
import zipfile

from common import download
from sources.countries import to_iso3

URL = "https://fra-data.fao.org/api/file/bulk-download?assessmentName=fra&cycleName=2025&countryIso=WO"
YEARS = [1990, 2000, 2010, 2015, 2020, 2025]


def _rows(variable: str) -> list[dict[str, str]]:
    """FRA_Years_variables/ 底下某個變數（例如 1a_forestArea）的 CSV。"""
    path = download(URL, "fao-fra", "fra2025-bulk.zip")
    with zipfile.ZipFile(path) as z:
        name = next(n for n in z.namelist() if n.startswith(f"FRA_Years_variables/{variable}_"))
        with z.open(name) as raw:
            return list(csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")))


def area(variable: str) -> dict[str, dict[int, float]]:
    """{iso3: {報告年: 千公頃}}，variable 例如 1a_forestArea、1a_landArea。"""
    out: dict[str, dict[int, float]] = {}
    for row in _rows(variable):
        iso3 = to_iso3(row["iso3"])
        if not iso3:
            raise RuntimeError(f"FRA 的國家代碼對不上 ISO：{row['iso3']} {row['name']}")
        values = {y: float(row[str(y)]) for y in YEARS if row[str(y)].strip()}
        if values:
            out[iso3] = values
    return out


def desk_studies() -> set[str]:
    """沒有提交國家報告、由 FAO 推估的國家（Desk study = Yes）。"""
    return {iso3 for row in _rows("1a_forestArea") if row["Desk study"] == "Yes" and (iso3 := to_iso3(row["iso3"]))}
