"""OECD 就業者平均每年實際工作時數（2024 年 7 月起的 OECD 資料預設 CC BY 4.0）。

- 資料流 OECD.ELS.SAE,DSD_HW@DF_AVG_ANN_HRS_WKD（Average annual hours actually worked per worker），
  WORKER_STATUS = _T 是全體就業者（含自營作業者），另有 ICSE93_1 只算受僱者。約 45 國，多數從 1970、1990 年代起。
- SDMX API 一次下載 CSV（含標籤）：https://sdmx.oecd.org/public/rest/data/<資料流>/all?format=csvfilewithlabels。
- Penn World Table 的 avh 大多就是這份資料（2023 年 41 國差距在 3% 以內），薪資主題只拿它補 PWT 明顯偏離的國家。
"""
from __future__ import annotations

import csv

from common import download
from sources.countries import to_iso3

URL = (
    "https://sdmx.oecd.org/public/rest/data/OECD.ELS.SAE,DSD_HW@DF_AVG_ANN_HRS_WKD,1.0/all"
    "?dimensionAtObservation=AllDimensions&format=csvfilewithlabels"
)


def annual_hours() -> dict[str, dict[int, float]]:
    """{iso3: {年: 全體就業者平均每年實際工作時數}}"""
    path = download(URL, "oecd-hours", "avg-ann-hrs-wkd.csv")
    out: dict[str, dict[int, float]] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            iso3 = to_iso3(row["REF_AREA"])
            if iso3 and row["WORKER_STATUS"] == "_T" and row["OBS_VALUE"]:
                out.setdefault(iso3, {})[int(row["TIME_PERIOD"][:4])] = float(row["OBS_VALUE"])
    if not out:
        raise RuntimeError("OECD 的每年工時沒有資料，API 格式可能變了")
    return out
