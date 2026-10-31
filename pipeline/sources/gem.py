"""Global Energy Monitor（GEM）的 Global Integrated Power Tracker（GIPT），全球發電機組。

- 資料：GEM 公開的追蹤地圖（https://globalenergymonitor.github.io/interim-maps/trackers/integrated-power/）
  自己用的 CSV，放在 GEM 的公開 CDN（publicgemdata.nyc3.cdn.digitaloceanspaces.com），直接下載、不必填表。
  網址寫在地圖的 config.js（`csv:`），每次改版換資料夾（2026-09 是 2026 年 9 月版，約 62 MB）。
  GEM 網站上的「Download data」要填表（姓名、Email、用途）才寄完整的 Excel，這裡不用那個。
- 授權：GEM 的下載頁寫「All Global Energy Monitor tracker data are freely available under a Creative Commons
  Attribution 4.0 International Public License unless otherwise noted.」；建議引用
  「Global Integrated Power Tracker, Global Energy Monitor, September 2026 release.」
- 一列是一個機組或分期（unit / phase，`unit-id` 是 G 開頭的編號），同一座電廠的機組有同一個 `project-id`
  （L 開頭）與同一個名稱。同一個 project-id 偶爾有兩種燃料（燃煤電廠裡的燃氣機組、風光混合案場）。
- 收錄門檻依各燃料的追蹤器（GEM 的 Coverage 說明）：核能不限；燃煤 30 MW 以上；生質能 20 MW；地熱 1 MW；
  燃油與燃氣 50 MW（歐盟、英國 20 MW）；水力 30 MW；太陽能運轉中的 1 MW 以上（規劃中的 20 MW 以上，
  不含 1 MW 以下的屋頂型）；風力 10 MW。
- 跨國電廠（伊泰普等）只寫一個國家（`country-area1`），GEM 完整版的「Country/Area 2」不在這個檔裡。
"""
from __future__ import annotations

import csv
import re
import sys
from dataclasses import dataclass

from common import download

RELEASE = "2026-09"
RELEASE_TEXT = "September 2026"
CSV_URL = (
    "https://publicgemdata.nyc3.cdn.digitaloceanspaces.com/Current_maps/integrated-power/"
    f"{RELEASE}/integrated_map_{RELEASE}.csv"
)
MAP_URL = "https://globalenergymonitor.github.io/interim-maps/trackers/integrated-power/"


@dataclass
class Unit:
    plant: str  # GEM 的電廠／專案編號（project-id，L 開頭）
    name: str  # 電廠名稱（英文原文）
    fuel: str  # GEM 的 asset-type：coal、oil/gas、nuclear、hydropower、wind、utility-scale solar、bioenergy、geothermal
    tech: str  # tech-type，例如 pumped storage、PV、Onshore
    status: str  # operating、construction、pre-construction、announced、retired、cancelled、shelved、mothballed
    mw: float
    start: int | None
    end: int | None  # 退役年份
    country: str  # GEM 的國名（country-area1）
    owner: str  # 「A [60%]; B [40%]」這種寫法
    lon: float
    lat: float
    unit: str = ""  # 機組或分期的名稱（unit-name，例如核電廠的 "1"、"2"）


def _year(text: str) -> int | None:
    m = re.match(r"\s*(\d{4})", text or "")
    return int(m.group(1)) if m else None


def units() -> list[Unit]:
    csv.field_size_limit(min(sys.maxsize, 2**31 - 1))
    path = download(CSV_URL, "gem", f"integrated_map_{RELEASE}.csv")
    out = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            try:
                mw, lat, lon = float(row["capacity"]), float(row["Latitude"]), float(row["Longitude"])
            except ValueError:
                continue
            out.append(Unit(
                plant=row["project-id"], name=row["name"].strip(), fuel=row["asset-type"], tech=row["tech-type"],
                status=row["status"].strip().lower(), mw=mw, start=_year(row["start-year"]), end=_year(row["end-year"]),
                country=row["country-area1"].strip(), owner=row["owner"].strip(), lon=lon, lat=lat,
                unit=row.get("unit-name", "").strip(),
            ))
    return out


def main_owner(owner: str) -> str | None:
    """「A [54%]; B [14%]; …」裡持股最多的；都沒寫比例時取第一個"""
    best, best_share = None, -1.0
    for part in owner.split(";"):
        m = re.search(r"\[(\d+(?:\.\d+)?)%\]\s*$", part)
        name = re.sub(r"\s*\[[^\]]*\]\s*$", "", part).strip()
        share = float(m.group(1)) if m else 0.0
        if name and share > best_share:
            best, best_share = name, share
    if not best or best.lower() in ("unknown", "n/a", "other", "-"):
        return None
    return best
