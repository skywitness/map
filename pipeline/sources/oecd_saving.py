"""OECD 國民帳的家庭淨儲蓄率（2024 年 7 月起的 OECD 資料預設 CC BY 4.0）。

- 資料流 OECD.SDD.NAD,DSD_NAAG@DF_NAAG_V（National Accounts at a Glance 第 5 章：家庭），
  MEASURE = B8NS1M：家庭及非營利團體的淨儲蓄占淨可支配所得的 %（含退休金權益變動的調整），
  也就是 OECD 網站「Household savings」那個指標。約 35 國（OECD 會員國加中國、俄羅斯、南非），多數從 1995 年起。
- SDMX API 一次下載 CSV（含標籤）：https://sdmx.oecd.org/public/rest/data/<資料流>/<key>?format=csvfilewithlabels。
  REF_AREA 是 ISO3；EA、EU 這類合計不收。
"""
from __future__ import annotations

import csv

from common import download
from sources.countries import to_iso3

URL = (
    "https://sdmx.oecd.org/public/rest/data/OECD.SDD.NAD,DSD_NAAG@DF_NAAG_V,/A..B8NS1M.."
    "?dimensionAtObservation=AllDimensions&format=csvfilewithlabels"
)


def household_net_saving_rate() -> dict[str, dict[int, float]]:
    """{iso3: {年: 家庭淨儲蓄率 %}}"""
    path = download(URL, "oecd-saving", "naag-b8ns1m.csv")
    out: dict[str, dict[int, float]] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            iso3 = to_iso3(row["REF_AREA"])
            if iso3 and row["MEASURE"] == "B8NS1M" and row["OBS_VALUE"]:
                out.setdefault(iso3, {})[int(row["TIME_PERIOD"][:4])] = float(row["OBS_VALUE"])
    if not out:
        raise RuntimeError("OECD 的家庭儲蓄率沒有資料，API 格式可能變了")
    return out
