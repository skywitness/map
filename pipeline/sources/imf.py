"""IMF World Economic Outlook，透過 DataMapper API（https://www.imf.org/external/datamapper/api/v1）。

有台灣，也有未來 5 年左右的推估值。
"""
from __future__ import annotations

import json
import re

from common import download
from sources.countries import to_iso3

API = "https://www.imf.org/external/datamapper/api/v1"


def fetch(code: str) -> tuple[dict[str, dict[int, float]], dict[int, float]]:
    """回傳 (各國 {iso3: {year: value}}, 世界合計 {year: value})。"""
    path = download(f"{API}/{code}", "imf", f"{code}.json")
    with open(path, encoding="utf-8") as f:
        values = json.load(f)["values"][code]
    countries: dict[str, dict[int, float]] = {}
    world: dict[int, float] = {}
    for area, series in values.items():
        parsed = {int(y): float(v) for y, v in series.items() if v is not None}
        if area == "WEOWORLD":
            world = parsed
        elif iso3 := to_iso3(area):
            countries[iso3] = parsed
    return countries, world


def weo_release() -> tuple[str, int]:
    """目前 WEO 的版次與推估起始年，例如 ('October 2026', 2026)。WEO 當年度的數字都還是推估。"""
    path = download(f"{API}/indicators", "imf", "indicators.json")
    with open(path, encoding="utf-8") as f:
        source = json.load(f)["indicators"]["NGDPDPC"]["source"]
    match = re.search(r"\((\w+) (\d{4})\)", source)
    if not match:
        raise RuntimeError(f"看不懂 WEO 版次：{source}")
    return f"{match.group(1)} {match.group(2)}", int(match.group(2))
