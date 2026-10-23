"""FAO AQUASTAT（https://www.fao.org/aquastat/）的批次下載檔。

- AQUASTAT 的說明（metadata）寫明使用條款依 FAO 統計資料庫的條款，也就是 CC BY 4.0
  （https://www.fao.org/contact-us/terms/db-terms-of-use/）。FAO 資料目錄上「AQUASTAT Dissemination System」
  （互動查詢網站的設定檔）標的是 CC BY-NC-SA 4.0，兩者不一致，見 DESIGN.md 第 8 節。
- 一個 zip（約 16 MB），裡面只有一個名稱是「zip」的 CSV（UTF-8，約 180 MB）：
  Country, M49, Variable, Year, Unit, Symbol, Symbol Description, Value，一列一個值。
- 國家用 M49 對應 ISO；M49 1 是 World，其他區域合計（Europe、SIDS…）對不上 ISO，直接略過。
- 沒有台灣，也沒有前蘇聯、南斯拉夫這類已經不存在的國家（各國從獨立那年才有值）。
- 2026 年 6 月這一版的品質問題（topics/water_forest.py 因此只用總可再生水資源、境內水資源與世界的水資源壓力）：
  - 人均可再生水資源（Total renewable water resources per capita）混了 247 筆旗標 A 的舊官方值，口徑跟同國其他年份不同。
  - 淡水取用量（以及由它算出的水資源壓力）有幾國明顯錯誤：科威特 2004–2014 年 6e-05 km³，
    瓜地馬拉、蓋亞那在差 10 倍的兩組數字之間來回跳。
  - 世界值（M49 1）早年只加總了有資料的國家，世界人口 1992 年以前也少了前蘇聯等國。
"""
from __future__ import annotations

import csv
import io
import zipfile

from common import download
from sources.countries import from_numeric

URL = "https://www.fao.org/aquastat/data/AQUASTAT%20Statistics%20Bulk%20Download%20(English).zip"
WORLD = "1"


def series(variables: set[str]) -> dict[str, tuple[dict[str, dict[int, float]], dict[int, float]]]:
    """{變數名稱: (各國 {iso3: {year: value}}, 世界 {year: value})}，變數名稱照檔案裡的英文，
    例如「Total renewable water resources per capita」「SDG 6.4.2. Water Stress」。"""
    path = download(URL, "aquastat", "aquastat-bulk-en.zip")
    out = {v: ({}, {}) for v in variables}
    iso_cache: dict[str, str | None] = {}
    with zipfile.ZipFile(path) as z, z.open(z.namelist()[0]) as raw:
        for row in csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8", newline="")):
            if row["Variable"] not in out or not row["Value"]:
                continue
            countries, world = out[row["Variable"]]
            year, value = int(row["Year"]), float(row["Value"])
            m49 = row["M49"]
            if m49 == WORLD:
                world[year] = value
                continue
            if m49 not in iso_cache:
                iso_cache[m49] = from_numeric(m49)
            if iso3 := iso_cache[m49]:
                countries.setdefault(iso3, {})[year] = value
    missing = [v for v, (c, _) in out.items() if not c]
    if missing:
        raise RuntimeError(f"AQUASTAT 沒有這些變數（名稱可能改了）：{missing}")
    return out
