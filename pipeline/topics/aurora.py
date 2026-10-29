"""此刻的極光主題：NOAA SWPC 的 OVATION 極光預報在瀏覽器裡即時讀（TopicDefinition.live），這裡只準備算的材料。

OVATION 的格點是經度 0–359°E、緯度 −90–90° 每 1° 一點（共 360 × 181 = 65,160 點，依經度、再依緯度排列，
第 i 點是經度 i // 181、緯度 i % 181 − 90），值是那一點上空看得到極光的機率（%）。

cells.json：
- countries：各國的國土碰到哪些格點（格點周圍 1° × 1° 的格子裡，每 0.25° 取一點、共 5 × 5 點，有一點在國界內就算），
  只算南、北緯 35° 以外（MIN_LAT）：OVATION 在 35° 以內幾乎都是 0，2024 年 5 月的大磁暴也只到約 40°；
  國土都在 35° 以內的國家（台灣是北緯 22–25°）沒有格點，前端的值是 0、tooltip 寫原因。
  國界用 geoindex（Natural Earth 1:10m，nearest=False：只算陸地）。格點的編號由小到大，差分編碼（第一個是編號，之後是跟前一個的差）。
- capitals：首都（晝夜與季節主題的 capitals.json）最近的格點編號。

要先跑 daylight（capitals.json）。不到 10 秒。
"""
from __future__ import annotations

import json
from collections import defaultdict

import numpy as np

import geoindex
from common import OUT_DIR, now_iso, write_json

OUT = OUT_DIR / "topics" / "aurora"
CAPITALS = OUT_DIR / "topics" / "daylight" / "capitals.json"
MIN_LAT = 35  # 只算南、北緯 35° 以外
SUB = 5  # 每個格子取 SUB × SUB 點
NLAT = 181


def lattice_index(lon: int, lat: int) -> int:
    """OVATION 的格點編號：經度 0–359、緯度 −90–90"""
    return (lon % 360) * NLAT + (lat + 90)


def country_cells() -> dict[str, list[int]]:
    lats = [lat for lat in range(-90, 91) if abs(lat) >= MIN_LAT]
    offsets = (np.arange(SUB) - (SUB - 1) / 2) * (1 / SUB)
    pts_lon, pts_lat, owner = [], [], []
    for lon in range(360):
        for lat in lats:
            idx = lattice_index(lon, lat)
            for dx in offsets:
                for dy in offsets:
                    y = lat + dy
                    if abs(y) > 90:
                        continue
                    x = lon + dx
                    pts_lon.append(x - 360 if x > 180 else x)
                    pts_lat.append(y)
                    owner.append(idx)
    codes = geoindex.countries_at(pts_lon, pts_lat, nearest=False)
    cells: dict[str, set[int]] = defaultdict(set)
    for code, idx in zip(codes, owner):
        if code:
            cells[code].add(idx)
    return {iso3: sorted(s) for iso3, s in sorted(cells.items())}


def delta(values: list[int]) -> list[int]:
    out, prev = [], 0
    for v in values:
        out.append(v - prev)
        prev = v
    return out


def build() -> None:
    capitals = json.loads(CAPITALS.read_text(encoding="utf-8"))["capitals"]
    cells = country_cells()
    nearest = {iso3: lattice_index(round(c[1]), round(c[0])) for iso3, c in sorted(capitals.items())}
    out = {
        "lattice": "OVATION：經度 0–359°E、緯度 −90–90°，第 i 點是經度 i // 181、緯度 i % 181 − 90",
        "minLat": MIN_LAT,
        "countries": {iso3: delta(v) for iso3, v in cells.items()},
        "capitals": nearest,
    }
    write_json(OUT / "cells.json", out)
    write_json(
        OUT / "manifest.json",
        {
            "topic": "aurora",
            "generatedAt": now_iso(),
            "source": "NOAA SWPC OVATION aurora forecast (read live in the browser: https://services.swpc.noaa.gov/json/ovation_aurora_latest.json); "
            "country cells from Natural Earth 1:10m; capitals from Wikidata (CC0)",
            "license": "US Government work; Natural Earth: public domain; Wikidata: CC0",
        },
    )
    total = sum(len(v) for v in cells.values())
    print(f"  {len(cells)} 個國家與地區碰到 {MIN_LAT}° 以外的格點，共 {total:,} 個（含重複）；首都 {len(nearest)} 個")
    for iso3 in ("CAN", "RUS", "NOR", "ISL", "GRL", "NZL", "AUS", "TWN"):
        print(f"    {iso3}: {len(cells.get(iso3, []))} 個格點")
