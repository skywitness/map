"""IANA 時區資料庫（tz database，公有領域），用 Python 的 `zoneinfo` 加上 PyPI 的 `tzdata` 套件（Windows 沒有系統的時區檔）。

- `zone.tab`：每個國家（ISO alpha-2）有哪些時區，以及每個時區代表地點的經緯度（ISO 6709，例如 +2503+12128）。
- 時區的標準時間與夏令時間：取一月與七月 15 日的 UTC 偏移，小的是標準時間、大的是夏令時間（南北半球都適用；
  愛爾蘭法律上夏天才是標準時間、冬天是「負的夏令時間」，這樣算出來的是一般認知的冬夏時間）。
  摩洛哥一年裡只有齋戒月改回 UTC+0，一月、七月都是 UTC+1，算成沒有夏令時間。

Natural Earth 1:10m 的時區圖（ne_10m_time_zones，5.1.2 版）沒有用：它停在 2012 年前後（莫斯科是 UTC+4、
哈薩克大部分是 UTC+6、薩摩亞還有夏令時間），跟現在不一樣。
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from importlib import resources
from zoneinfo import ZoneInfo

import tzdata

VERSION = tzdata.IANA_VERSION


@dataclass
class Zone:
    name: str
    lat: float
    lon: float


def _coord(s: str) -> tuple[float, float]:
    """ISO 6709 的 ±DDMM±DDDMM 或 ±DDMMSS±DDDMMSS → (緯度, 經度)"""
    m = re.fullmatch(r"([+-])(\d{2})(\d{2})(\d{2})?([+-])(\d{3})(\d{2})(\d{2})?", s)
    if not m:
        raise ValueError(f"看不懂的座標：{s}")
    lat = int(m[2]) + int(m[3]) / 60 + int(m[4] or 0) / 3600
    lon = int(m[6]) + int(m[7]) / 60 + int(m[8] or 0) / 3600
    return (lat if m[1] == "+" else -lat, lon if m[5] == "+" else -lon)


@lru_cache(maxsize=1)
def zones_by_country() -> dict[str, list[Zone]]:
    """{ISO alpha-2: [Zone…]}（zone.tab 的順序）"""
    text = resources.files("tzdata").joinpath("zoneinfo", "zone.tab").read_text(encoding="utf-8")
    out: dict[str, list[Zone]] = {}
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        cc, coord, name, *_ = line.split("\t")
        lat, lon = _coord(coord)
        out.setdefault(cc, []).append(Zone(name, lat, lon))
    return out


def offsets(name: str, year: int) -> tuple[float, float | None]:
    """(標準時間的 UTC 偏移, 夏令時間的 UTC 偏移或 None)，單位是小時"""
    tz = ZoneInfo(name)
    jan = datetime(year, 1, 15, 12, tzinfo=tz).utcoffset().total_seconds() / 3600
    jul = datetime(year, 7, 15, 12, tzinfo=tz).utcoffset().total_seconds() / 3600
    if jan == jul:
        return jan, None
    return min(jan, jul), max(jan, jul)
