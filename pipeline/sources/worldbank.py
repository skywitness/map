"""World Bank WDI API（https://api.worldbank.org/v2）。注意：WDI 沒有台灣。"""
from __future__ import annotations

import json

from common import download
from sources.countries import to_iso3

API = "https://api.worldbank.org/v2/country/all/indicator/{code}?format=json&per_page=20000&date={start}:{end}"


def fetch(code: str, start: int = 1960, end: int = 2030) -> tuple[dict[str, dict[int, float]], dict[int, float]]:
    """回傳 (各國 {iso3: {year: value}}, 世界合計 {year: value})。"""
    path = download(API.format(code=code, start=start, end=end), "worldbank", f"{code}.json")
    with open(path, encoding="utf-8") as f:
        meta, rows = json.load(f)
    if meta.get("pages", 1) > 1:
        raise RuntimeError(f"{code} 超過一頁（{meta}），需要分頁下載")
    countries: dict[str, dict[int, float]] = {}
    world: dict[int, float] = {}
    for row in rows or []:
        if row["value"] is None:
            continue
        year, value = int(row["date"]), float(row["value"])
        if row["countryiso3code"] == "WLD":
            world[year] = value
        elif iso3 := to_iso3(row["countryiso3code"]):
            countries.setdefault(iso3, {})[year] = value
    return countries, world
