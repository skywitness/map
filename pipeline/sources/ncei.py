"""NOAA NCEI 全球重大地震資料庫（Global Significant Earthquake Database，美國政府資料，公有領域）。

https://www.ngdc.noaa.gov/hazel/view/hazards/earthquake/search ，doi:10.7289/V5TD9V7K
- 收錄的條件是「重大」：造成死亡、約 100 萬美元以上的損失、規模 7.5 以上、修正麥卡利震度 X 以上，
  或引發海嘯，所以有不少規模 5–6 的致災地震，規模 6 以上但沒有災情的地震大多不在裡面。
- 用 hazel 網站本身的 REST API，一頁最多 200 筆（itemsPerPage 再大會回 HTTP 400），每頁各自快取在 .cache/ncei/。
- 死亡人數用 deathsTotal（含地震引發的海嘯、山崩、火災），沒有的才用 deaths。
  只有數量級（deathsAmountOrder：1 = 50 人以下、2 = 51–100、3 = 101–1000、4 = 1000 以上）、沒有確切人數的不算。
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime, timezone

from common import download

BASE = "https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/earthquakes"
PER_PAGE = 200


@dataclass
class Event:
    id: int
    year: int
    month: int | None
    day: int | None
    time: float | None  # Unix 秒（UTC）；缺時、分的事件為 None
    lon: float | None
    lat: float | None
    mag: float | None
    deaths: int | None
    country: str  # NOAA 的國名（大寫英文，例如 TAIWAN、USA）
    location: str


def _pages(start_year: int) -> list[dict]:
    end = date.today().year
    items: list[dict] = []
    page, total = 1, 1
    while page <= total:
        url = f"{BASE}?minYear={start_year}&maxYear={end}&itemsPerPage={PER_PAGE}&page={page}"
        with open(download(url, "ncei", f"earthquakes_{start_year}-now_p{page:02d}.json"), encoding="utf-8") as f:
            data = json.load(f)
        items += data["items"]
        total = data["totalPages"]
        page += 1
    return items


def earthquakes(start_year: int) -> list[Event]:
    out = []
    for r in _pages(start_year):
        if not r.get("publish", True):
            continue
        month, day = r.get("month"), r.get("day")
        time = None
        if month and day and r.get("hour") is not None and r.get("minute") is not None:
            second = r.get("second") or 0
            time = datetime(r["year"], month, day, r["hour"], r["minute"], tzinfo=timezone.utc).timestamp() + float(second)
        deaths = r.get("deathsTotal", r.get("deaths"))
        out.append(Event(
            id=r["id"], year=r["year"], month=month, day=day, time=time,
            lon=r.get("longitude"), lat=r.get("latitude"), mag=r.get("eqMagnitude"),
            deaths=int(deaths) if deaths is not None else None,
            country=(r.get("country") or "").strip(), location=(r.get("locationName") or "").strip(),
        ))
    return out
