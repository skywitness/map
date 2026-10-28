"""Gapminder fasttrack（GitHub open-numbers/ddf--gapminder--fasttrack）的 1800 年起長期資料。

授權：CC BY 4.0（https://www.gapminder.org/free-material/ ；repo 本身沒有 LICENSE 檔）。
改過的資料要寫「Based on free material from GAPMINDER.ORG, CC-BY LICENSE」；
「GAPMINDER」只能出現在引用文字，不可以用在產品或服務的名稱（DESIGN.md 第 8 節第 98 點）。

固定在 2026-10-15 的 commit dee8978，換版本要改 COMMIT 並重新檢查各指標的實際年份。
國家代碼是小寫 ISO3；Gapminder 自己的代碼只有教廷 hos 不是 ISO3。
"""
from __future__ import annotations

import csv

from common import download
from sources.countries import to_iso3

COMMIT = "dee8978"
BASE = f"https://raw.githubusercontent.com/open-numbers/ddf--gapminder--fasttrack/{COMMIT}"
ALIASES = {"hos": "VAT"}


def _rows(path: str, key: str, concept: str) -> dict[str, dict[int, float]]:
    name = path.rsplit("/", 1)[-1]
    src = download(f"{BASE}/{path}", f"gapminder-{COMMIT}", name)
    out: dict[str, dict[int, float]] = {}
    with open(src, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            out.setdefault(row[key], {})[int(row["time"])] = float(row[concept])
    return out


def fetch(concept: str) -> tuple[dict[str, dict[int, float]], dict[int, float]]:
    """回傳（{ISO3: {年: 值}}, 世界 {年: 值}）；年份含 Gapminder 的推估，呼叫的地方自己截掉。"""
    by_country = _rows(f"countries_etc_datapoints/ddf--datapoints--{concept}--by--country--time.csv", "country", concept)
    values: dict[str, dict[int, float]] = {}
    for code, series in by_country.items():
        iso3 = ALIASES.get(code) or to_iso3(code)
        if iso3 is None:
            raise ValueError(f"Gapminder 的國家代碼 {code} 對不到 ISO3")
        values[iso3] = series
    world = _rows(f"global_regions_datapoints/ddf--datapoints--{concept}--by--global--time.csv", "global", concept)
    return values, world["world"]
