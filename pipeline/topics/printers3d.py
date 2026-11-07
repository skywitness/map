"""3D 列印機的貿易（2026-11-07，製作手冊第二十五批 514，候選 1213；擴充「半導體」〔科技・運算與晶片〕）。

HS 2022 新設的 8485「Additive manufacturing machines」，Harvard Growth Lab Atlas 的 GraphQL API（CC0，不必金鑰；
product-HS22-1691，productClass 要寫成 enum）。2022 年以前 3D 列印機散在 8477、8463、8456 等，不能往前接，只有 2022–2024 年。
countryId 是「country-<M49>」，台灣是 country-158。2022 年是新稅號的第一年，部分國家（新加坡、台灣）金額特別大，可能是歸類還沒穩定，說明寫明。
輸出 public/data/topics/semiconductors/printers3d/{exports,imports}.json（美元）。
"""

from __future__ import annotations

import json
import urllib.request

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, write_json
from sources.countries import from_numeric

OUT = OUT_DIR / "topics" / "semiconductors" / "printers3d"
API = "https://atlas.hks.harvard.edu/api/graphql"
QUERY = ("{ countryProductYear(productClass: HS22, productId: 1691, yearMin: 2022, yearMax: 2024, productLevel: 4) "
         "{ countryId year exportValue importValue } }")
YEARS = [2022, 2023, 2024]


def _rows() -> list[dict]:
    path = CACHE_DIR / "atlas" / "hs22-8485.json"
    if not path.exists():
        req = urllib.request.Request(API, data=json.dumps({"query": QUERY}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as r:
            body = r.read()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
    return json.loads(path.read_text(encoding="utf-8"))["data"]["countryProductYear"]


def build() -> None:
    data = {"exports": {}, "imports": {}}
    for r in _rows():
        iso3 = from_numeric(r["countryId"].removeprefix("country-"))
        if not iso3:
            continue
        for key, field in (("exports", "exportValue"), ("imports", "importValue")):
            if r[field]:
                data[key].setdefault(iso3, {})[r["year"]] = r[field]
    for key, series in data.items():
        write_json(OUT / f"{key}.json", indicator_file(
            f"printers3d/{key}", "USD", YEARS, {k: [s.get(y) for y in YEARS] for k, s in sorted(series.items())},
            license="CC0", attribution="The Growth Lab at Harvard University, Atlas of Economic Complexity"))
        top = sorted(((s.get(2024, 0), k) for k, s in series.items()), reverse=True)[:6]
        print(f"  3D 列印機 {key}：{len(series)} 國；2024 {[(k, round(v / 1e6, 1)) for v, k in top]}，台灣 {series.get('TWN', {})}")
