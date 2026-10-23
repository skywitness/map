"""OECD Data Explorer 的 SDMX API（https://sdmx.oecd.org/public/rest/，2024 年 7 月起的資料預設 CC BY 4.0）。

一次下載整個資料流的 CSV（含標籤），再依欄位篩選。REF_AREA 是 ISO3，OECD、EU27 這類合計不收（另外回傳）。
"""
from __future__ import annotations

import csv
import re

from common import download
from sources.countries import to_iso3

URL = "https://sdmx.oecd.org/public/rest/data/{flow}/{key}?dimensionAtObservation=AllDimensions&format=csvfilewithlabels"


def rows(flow: str, key: str = "all") -> list[dict[str, str]]:
    """整個資料流（或 key 指定的部分）的每一筆觀測值，欄位用 SDMX 的代碼（REF_AREA、TIME_PERIOD、OBS_VALUE…）。"""
    name = re.sub(r"[^A-Za-z0-9_.-]+", "_", f"{flow}_{key}") + ".csv"
    path = download(URL.format(flow=flow, key=key), "oecd", name)
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def series(flow: str, key: str = "all", **filters: str) -> tuple[dict[str, dict[int, float]], dict[str, dict[int, float]]]:
    """回傳 (各國 {iso3: {年: 值}}, 合計 {代碼: {年: 值}})；filters 是欄位 = 值（例如 AGGREGATION_OPERATION='MEDIAN'）。"""
    countries: dict[str, dict[int, float]] = {}
    groups: dict[str, dict[int, float]] = {}
    for r in rows(flow, key):
        if any(r.get(k) != v for k, v in filters.items()) or not r["OBS_VALUE"]:
            continue
        year = int(r["TIME_PERIOD"][:4])
        area = r["REF_AREA"]
        target = countries.setdefault(iso3, {}) if (iso3 := to_iso3(area)) else groups.setdefault(area, {})
        target[year] = float(r["OBS_VALUE"])
    return countries, groups
