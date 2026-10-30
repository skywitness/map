"""WHO Global Health Observatory 的後端（xmart-api-public.who.int/GHO/FACT），GHO 的 OData API 壞掉時直接讀這裡。

- 授權：GHO 的資料是 CC BY 4.0（data.who.int 的條款，見 who.py）；xmart 本身沒有另外的條款頁。
- https://xmart-api-public.who.int/GHO/FACT?$filter=INDICATOR_CODE eq '<代碼>' ，不必金鑰，OData，
  超過一頁時有 @odata.nextLink。欄位：PERIOD_CODE（年）、LOCATION_CODE（ISO3）、LOCATION_TYPE、
  DIMENSION_1／DIMENSION_MEMBER_1…、VALUE_STRING（文字答案，例如 Yes／No）、VALUE_NUMERIC。
- 2026-10-29 起 GHO 的 OData（ghoapi.azureedge.net）回 HTTP 500，製作手冊第六批的國家能力調查（NCD CCS）
  與菸草控制（MPOWER）都從這裡讀。
"""
from __future__ import annotations

import json
import urllib.parse

from common import download

URL = "https://xmart-api-public.who.int/GHO/FACT"
FIELDS = (
    "PERIOD_CODE,LOCATION_CODE,LOCATION_TYPE,DIMENSION_1,DIMENSION_MEMBER_1,DIMENSION_2,DIMENSION_MEMBER_2,"
    "VALUE_STRING,VALUE_NUMERIC"
)


def facts(code: str) -> list[dict]:
    """某個 GHO 指標的所有列（只留常用欄位）；每一頁各存一個快取檔。"""
    query = urllib.parse.urlencode({"$filter": f"INDICATOR_CODE eq '{code}'", "$select": FIELDS}, quote_via=urllib.parse.quote)
    url: str | None = f"{URL}?{query}"
    rows: list[dict] = []
    page = 0
    while url:
        path = download(url, "who-xmart", f"{code}-{page}.json")
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        rows.extend(data["value"])
        url = data.get("@odata.nextLink")
        page += 1
    if not rows:
        raise RuntimeError(f"xmart 的 GHO {code} 沒有資料")
    return rows


def answers(code: str, **dims: str) -> dict[str, dict[int, str]]:
    """國家層級的文字答案：{iso3: {年: VALUE_STRING}}。dims 篩選維度，例如 DIMENSION_MEMBER_1='P6_restaurants'。"""
    out: dict[str, dict[int, str]] = {}
    for row in facts(code):
        if row["LOCATION_TYPE"] != "COUNTRY" or any(row.get(k) != v for k, v in dims.items()):
            continue
        value = (row.get("VALUE_STRING") or "").strip()
        if value:
            out.setdefault(row["LOCATION_CODE"], {})[int(row["PERIOD_CODE"])] = value
    return out
