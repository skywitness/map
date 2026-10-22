"""Our World in Data 的 GitHub 資料集（CC BY 4.0）。

- CO₂ and Greenhouse Gas Emissions（https://github.com/owid/co2-data）：
  化石燃料與工業的 CO₂ 來自 Global Carbon Project（GCP），消費端排放也是 GCP，
  每單位 GDP 的排放用 Maddison Project 的 GDP（2011 年國際元）計算。含台灣。
"""
from __future__ import annotations

import csv

from common import download
from sources.countries import to_iso3

CO2_URL = "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv"

# OWID 沒給 ISO 代碼的國家
NAME_TO_ISO3 = {"Kosovo": "XKX"}


def co2_rows() -> list[tuple[str, int, dict[str, str]]]:
    """回傳 [(iso3 或 'WLD', 年, 該列欄位)]；洲、所得組、國際航空與航運等合計不收。"""
    path = download(CO2_URL, "owid", "owid-co2-data.csv")
    out = []
    with open(path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            name = row["country"]
            iso3 = "WLD" if name == "World" else to_iso3(row["iso_code"]) or NAME_TO_ISO3.get(name)
            if iso3:
                out.append((iso3, int(row["year"]), row))
    return out
