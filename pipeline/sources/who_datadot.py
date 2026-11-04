"""WHO 資料平臺 data.who.int（CC BY 4.0，加上爭議先調解再仲裁、不准反匿名化、不准暗示 WHO 背書的附加條款）。

使用者 2026-11-04 決定：只在 GHO 的指標不用；data.who.int 有同一個指標的，改讀 data.who.int 的版本。
- `csv(code)`：指標頁的整份下載（`DATADOT/INDICATOR/<代碼>_ALL_LATEST.csv`，代碼是指標頁網址的第二段，例如
  https://data.who.int/indicators/i/847662C/75DDA77 的 75DDA77）。
- `relay(table, ind_code)`：指標頁沒有下載連結、圖表直接讀後端的（例如抗藥性結核，頁面寫 `dataSourceTable: RELAY_TB`），
  讀同一個後端 `xmart-api-public.who.int/DATA_/<table>`。
地區是 M49 數字代碼，換成 ISO alpha-3；只留國家（DIM_GEO_CODE_TYPE = COUNTRY）。
"""
from __future__ import annotations

import csv
import json
import time
import urllib.parse
import urllib.request

from common import CACHE_DIR, USER_AGENT, download
from sources.countries import from_numeric

CSV_URL = "https://srhdpeuwpubsa.blob.core.windows.net/whdh/DATADOT/INDICATOR/{}_ALL_LATEST.csv"
RELAY_URL = "https://xmart-api-public.who.int/DATA_/{}"


def csv_rows(code: str) -> list[dict[str, str]]:
    """整份 CSV 的每一列（只留國家），多一個 iso3 欄位"""
    path = download(CSV_URL.format(code), "who-datadot", f"{code}.csv")
    out = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r.get("DIM_GEO_CODE_TYPE") != "COUNTRY":
                continue
            iso3 = from_numeric(r["DIM_GEO_CODE_M49"])
            if iso3:
                out.append({**r, "iso3": iso3})
    return out


def relay(table: str, ind_code: str) -> list[dict]:
    """data.who.int 後端的一個指標（OData，依 @odata.nextLink 分頁），只留國家，多一個 iso3 欄位"""
    path = CACHE_DIR / "who-datadot" / f"relay-{table}-{ind_code}.json"
    if not path.exists():
        url = RELAY_URL.format(table) + "?" + urllib.parse.urlencode({"$filter": f"IND_CODE eq '{ind_code}'"})
        rows: list[dict] = []
        while url:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                page = json.load(r)
            rows += page["value"]
            url = page.get("@odata.nextLink")
            if url:
                time.sleep(1)
        if not rows:
            raise RuntimeError(f"data.who.int 的 {table} 沒有 {ind_code}")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(rows), encoding="utf-8")
    out = []
    for r in json.loads(path.read_text(encoding="utf-8")):
        if r.get("DIM_GEO_CODE_TYPE") != "COUNTRY" or r.get("VALUE_NUMERIC") is None:
            continue
        iso3 = from_numeric(r["DIM_GEO_CODE_M49"])
        if iso3:
            out.append({**r, "iso3": iso3})
    return out
