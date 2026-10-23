"""世界銀行 Worldwide Governance Indicators（WGI，CC BY 4.0，含台灣）。

World Bank API 的 source 3（https://api.worldbank.org/v2/country/all/indicator/<代碼>?source=3）。
2025 年改版後每個面向除了原本的估計值（約 −2.5 到 2.5），還有 0–100 的治理分數（`.SC`）：
估計值的線性轉換，以假想的最差與基準國家定錨，是絕對分數，越高越好。

- 1996、1998、2000 年之後每年都有（2002 年起）。
- 台灣（「Taiwan, China」）、法屬圭亞那、馬丁尼克、留尼旺、安圭拉、庫克群島、紐埃、澤西的代碼欄是空的，
  依名稱對照（NAMES）；荷屬安地列斯已經不存在，不收。

授權：世界銀行資料目錄的 WGI 資料集（https://datacatalog.worldbank.org/search/dataset/0038026）是 CC BY 4.0。
"""
from __future__ import annotations

import json

from common import download
from sources.countries import to_iso3

API = "https://api.worldbank.org/v2/country/all/indicator/{code}?source=3&format=json&per_page=20000&date=1996:2030"

# API 沒有給 ISO 代碼的經濟體
NAMES = {
    "Taiwan, China": "TWN",
    "French Guiana": "GUF",
    "Martinique": "MTQ",
    "Reunion": "REU",
    "Anguilla": "AIA",
    "Cook Islands": "COK",
    "Niue": "NIU",
    "Jersey": "JEY",
}


def fetch(code: str) -> dict[str, dict[int, float]]:
    """{iso3: {年: 值}}"""
    path = download(API.format(code=code), "worldbank", f"WGI-{code}.json")
    with open(path, encoding="utf-8") as f:
        meta, rows = json.load(f)
    if meta.get("pages", 1) > 1:
        raise RuntimeError(f"WGI {code} 超過一頁（{meta}），需要分頁下載")
    out: dict[str, dict[int, float]] = {}
    for row in rows or []:
        if row["value"] is None:
            continue
        iso3 = to_iso3(row["countryiso3code"]) or NAMES.get(row["country"]["value"])
        if iso3:
            out.setdefault(iso3, {})[int(row["date"])] = float(row["value"])
    if "TWN" not in out:
        raise RuntimeError(f"WGI {code} 找不到台灣（Taiwan, China），名稱可能變了")
    return out
