"""World Bank International Debt Statistics（IDS，API 的 source 6，CC BY 4.0）。

WDI 的一般網址（country/all/indicator/<代碼>）查不到 IDS 獨有的序列（例如外債的幣別組成 DT.CUR.*，回「The indicator was
not found」）；用 source 6 的 series 網址，而且要指定債權方 counterpart-area/WLD（世界合計）才會列出各國：
https://api.worldbank.org/v2/sources/6/country/all/series/<代碼>/counterpart-area/WLD/time/all?format=json&per_page=50000
（第二十五批 460）。只收中低所得、向世界銀行報告債務的國家；區域與所得組合計（代碼不是 ISO3）不收。
"""
from __future__ import annotations

import json

from common import download
from sources.countries import to_iso3

URL = "https://api.worldbank.org/v2/sources/6/country/all/series/{code}/counterpart-area/WLD/time/all?format=json&per_page=50000"


def series(code: str) -> dict[str, dict[int, float]]:
    """{iso3: {年: 值}}"""
    path = download(URL.format(code=code), "worldbank-ids", f"{code}.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if data.get("pages", 1) > 1:
        raise RuntimeError(f"IDS {code} 超過一頁")
    out: dict[str, dict[int, float]] = {}
    for row in data["source"]["data"]:
        if row["value"] is None:
            continue
        var = {v["concept"]: v["id"] for v in row["variable"]}
        if iso3 := to_iso3(var["Country"]):
            out.setdefault(iso3, {})[int(var["Time"][2:])] = float(row["value"])
    return out
