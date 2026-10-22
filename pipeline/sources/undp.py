"""UNDP Human Development Report 的綜合指數時間序列（CC BY 3.0 IGO）。沒有台灣。

一國一列的寬表，欄名像 mys_1990…mys_2023；ZZ 開頭的是區域與世界合計（ZZK.WORLD）。
新版報告出來後路徑會變（例如 2026_HDR/HDR26_…）。
"""
from __future__ import annotations

import csv

from common import download
from sources.countries import to_iso3

URL = "https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Composite_indices_complete_time_series.csv"


def series(prefix: str) -> tuple[dict[str, dict[int, float]], dict[int, float]]:
    """回傳 (各國 {iso3: {年: 值}}, 世界 {年: 值})，prefix 例如 'mys'（25 歲以上平均受教育年數）。"""
    path = download(URL, "undp", "HDR25_Composite_indices_complete_time_series.csv")
    countries: dict[str, dict[int, float]] = {}
    world: dict[int, float] = {}
    with open(path, encoding="utf-8-sig", errors="replace", newline="") as f:
        for row in csv.DictReader(f):
            values = {
                int(col[len(prefix) + 1:]): float(v)
                for col, v in row.items()
                if col.startswith(f"{prefix}_") and col[len(prefix) + 1:].isdigit() and v
            }
            if row["iso3"] == "ZZK.WORLD":
                world = values
            elif iso3 := to_iso3(row["iso3"]):
                countries[iso3] = values
    return countries, world
