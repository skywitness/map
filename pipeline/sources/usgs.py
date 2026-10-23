"""USGS ComCat 地震目錄（FDSN event web service，美國政府資料，公有領域）。

https://earthquake.usgs.gov/fdsnws/event/1/
- 一次查詢最多 20,000 筆，超過時 API 直接回 HTTP 400，所以依年份分段查（CHUNKS），每段各自快取在
  .cache/usgs/。最後一段含今年，資料會一直增加，要更新時用 `npm run data -- earthquakes --refresh`。
- 只取 eventtype=earthquake（排除核試爆、礦坑塌陷等），用 CSV 格式（比 GeoJSON 小很多）。
- 1900–1970 年代的事件來自 ISC-GEM 目錄（重新定位、統一用矩規模），規模大約 5.5 以上才完整。
"""
from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date, datetime

from common import download

BASE = "https://earthquake.usgs.gov/fdsnws/event/1/query"
MAX_EVENTS = 20000


@dataclass
class Quake:
    id: str
    time: float  # Unix 秒（UTC）
    year: int
    month: int
    day: int
    lon: float
    lat: float
    depth: float | None  # 公里
    mag: float
    mag_type: str
    place: str


def clean_place(place: str) -> str:
    """USGS 的地名資料把 Latin-1 以外的字母存成「?」（「5 km SSE of ?iso, Japan」是大磯 Ōiso），
    JSON 格式也一樣，救不回來，所以只留逗號後面的區域或國名（「Japan」）；約 2% 的規模 6 以上地震是這樣。"""
    place = place.strip()
    if "?" not in place:
        return place
    tail = place.rsplit(",", 1)[-1].strip() if "," in place else ""
    return tail if tail and "?" not in tail else place.replace("?", "").strip()


def _chunks(start: int, step: int) -> list[tuple[int, int]]:
    """[start, start+step), …，最後一段到今年底"""
    last = date.today().year
    return [(y, min(y + step, last + 1)) for y in range(start, last + 1, step)]


def events(min_mag: float, max_mag: float | None, start_year: int, years_per_query: int) -> list[Quake]:
    """規模 min_mag 以上（max_mag 以下，含）的地震，依時間排序。"""
    out: dict[str, Quake] = {}
    for y0, y1 in _chunks(start_year, years_per_query):
        params = f"format=csv&eventtype=earthquake&orderby=time-asc&starttime={y0}-01-01&endtime={y1}-01-01&minmagnitude={min_mag}"
        name = f"m{min_mag:g}"
        if max_mag is not None:
            params += f"&maxmagnitude={max_mag}"
            name += f"-{max_mag:g}"
        # 含今年的那一段檔名不寫結束年，下次執行時沿用快取（--refresh 才重抓）
        span = f"{y0}-{y1 - 1}" if y1 <= date.today().year else f"{y0}-now"
        path = download(f"{BASE}?{params}", "usgs", f"{name}_{span}.csv")
        with open(path, encoding="utf-8", newline="") as f:
            rows = list(csv.DictReader(f))
        if len(rows) >= MAX_EVENTS:
            raise RuntimeError(f"USGS {name} {span} 有 {len(rows)} 筆，達到單次查詢上限，請縮小每段的年數")
        for r in rows:
            if r["type"] != "earthquake" or not r["mag"]:
                continue
            t = datetime.fromisoformat(r["time"])  # 2024-04-02T23:58:12.173Z，UTC
            out[r["id"]] = Quake(
                id=r["id"],
                time=t.timestamp(),
                year=t.year, month=t.month, day=t.day,
                lon=float(r["longitude"]), lat=float(r["latitude"]),
                depth=float(r["depth"]) if r["depth"] else None,
                mag=float(r["mag"]), mag_type=r["magType"], place=clean_place(r["place"]),
            )
    return sorted(out.values(), key=lambda q: q.time)
