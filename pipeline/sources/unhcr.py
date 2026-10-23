"""UNHCR Refugee Population Statistics Database（CC BY 4.0，另加 UNHCR 的資料集條款：https://www.unhcr.org/terms-use-datasets）。

API：https://api.unhcr.org/population/v1/population/ ，每年一次查詢所有 (來源國, 收容國) 的組合（每年約 6 千列）。
- refugees：UNHCR 職權下的難民（含類似難民處境的人）；不含 UNRWA 職權下的巴勒斯坦難民（約 600 萬）。
- oip：其他需要國際保護的人（2018 年起，主要是在拉丁美洲的委內瑞拉人）。
- 年份是年底的存量；最新一年通常在隔年 6 月公布（Global Trends 報告）。
- 收容國用 coa_iso（UNHCR 自己的 coa 代碼跟 ISO 不同，例如埃及是 ARE）。台灣不在 UNHCR 的統計裡。
"""
from __future__ import annotations

import json

from common import download
from sources.countries import to_iso3

URL = "https://api.unhcr.org/population/v1/population/?limit=20000&yearFrom={year}&yearTo={year}&coo_all=true&coa_all=true"
YEARS_URL = "https://api.unhcr.org/population/v1/years/?limit=200"


def _number(value: object) -> float:
    """API 的數值有時是字串（"0"、"-"），有時是整數。"""
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    return float(text) if text.replace(".", "", 1).isdigit() else 0.0


def refugees(first_year: int, last_year: int) -> dict[int, dict[tuple[str | None, str | None], float]]:
    """{年: {(來源國, 收容國): 難民 + 其他需要國際保護的人}}；對應不到 ISO3 的（無國籍、來源不明）是 None。"""
    out: dict[int, dict[tuple[str | None, str | None], float]] = {}
    for year in range(first_year, last_year + 1):
        path = download(URL.format(year=year), "unhcr", f"population-{year}.json")
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if data.get("maxPages", 1) > 1:
            raise RuntimeError(f"UNHCR {year} 年超過一頁，需要分頁下載")
        pairs: dict[tuple[str | None, str | None], float] = {}
        for row in data["items"]:
            n = _number(row["refugees"]) + _number(row["oip"])
            if n <= 0:
                continue
            key = (to_iso3(row["coo_iso"]), to_iso3(row["coa_iso"]))
            pairs[key] = pairs.get(key, 0.0) + n
        out[year] = pairs
    return out


def latest_year() -> int:
    """有資料的最新一年：API 的年份清單會先列出還沒有資料的未來年份，要實際查一次確認。"""
    path = download(YEARS_URL, "unhcr", "years.json")
    with open(path, encoding="utf-8") as f:
        years = sorted((int(i["year"]) for i in json.load(f)["items"]), reverse=True)
    for year in years:
        path = download(URL.format(year=year), "unhcr", f"population-{year}.json")
        with open(path, encoding="utf-8") as f:
            has_data = bool(json.load(f)["items"])
        if has_data:
            return year
        path.unlink()  # 還沒公布的年份不留快取，之後公布了才查得到
    raise RuntimeError("UNHCR 沒有任何一年的資料")
