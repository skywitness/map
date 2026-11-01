"""聯合國人口司《World Urbanization Prospects: The 2025 Revision》（CC BY 3.0 IGO）的 File 21：人口 5 萬以上的城市
1975–2050 年每年年中的人口（千人）。城市主題只拿它補城市的名稱（製作手冊第十六批 266）。

- 城市就是 GHS-WUP-MTUC R2025A 的城市（`City_Code`＝`ID_UC_G0`，sources/ghsl_wup.py）：2026-11-01 核對 16,828 個城市，
  每 5 年的人口、國家（LocID）、首都都相同（人口最多差 0.001%），中間的年份是前後兩期之間的直線內插；1975–2050 年
  只有一期是城市的 377 個沒有收。所以地圖照用 GHS-WUP 每 5 年一期，不另加指標（使用者 2026-11-01 決定）。
- 名稱：GHS-WUP 寫「N/A」的 1,578 個城市裡，657 個在這裡有名稱（多半在印度、奈及利亞、埃及、阿富汗）；其他城市的名稱
  兩邊相同。
- 授權：info 工作表寫「Copyright © 2025 by United Nations, made available under a Creative Commons license CC BY 3.0
  IGO」，讀檔時核對這一句，條款換了就報錯。
"""
from __future__ import annotations

import pickle
from functools import lru_cache

from common import CACHE_DIR, download

URL = "https://population.un.org/wup/assets/Download/Cities/WUP2025-F21-DEGURBA-Cities_Pop.xlsx"
FILENAME = URL.rsplit("/", 1)[1]
CACHE = "un-wup"
PAGE = "https://population.un.org/wup/"
LICENSE_LINE = "made available under a Creative Commons license CC BY 3.0 IGO"
CITATION = (
    "United Nations, Department of Economic and Social Affairs, Population Division (2025). "
    "World Urbanization Prospects: The 2025 Revision, Online Edition."
)
NO_NAME = {"", "N/A"}


@lru_cache(maxsize=1)
def city_names() -> dict[int, str]:
    """City_Code（＝GHS-WUP 的 ID_UC_G0）→ 城市名稱；沒有名稱（N/A）的不收。讀完存成 .pkl 快取。"""
    cache = CACHE_DIR / CACHE / "names.pkl"
    if cache.exists():
        with open(cache, "rb") as f:
            return pickle.load(f)
    import openpyxl

    wb = openpyxl.load_workbook(download(URL, CACHE, FILENAME), read_only=True, data_only=True)
    info = " ".join(str(v) for row in wb["info"].iter_rows(values_only=True) for v in row if v is not None)
    if LICENSE_LINE not in info:
        raise RuntimeError(f"{FILENAME} 的 info 工作表沒有「{LICENSE_LINE}」，授權可能換了，先查清楚再用")
    rows = wb["Data"].iter_rows(values_only=True)
    header = next(rows)
    code, name = header.index("City_Code"), header.index("City_Name")
    out: dict[int, str] = {}
    for r in rows:
        if r[code] is None:
            continue
        text = str(r[name] or "").strip()
        if text not in NO_NAME:
            out[int(r[code])] = text
    cache.parent.mkdir(parents=True, exist_ok=True)
    with open(cache, "wb") as f:
        pickle.dump(out, f)
    return out
