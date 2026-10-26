"""交通主題：全球鐵路路線（Natural Earth）與機場位置（OurAirports），都是公有領域。

除了畫在地圖上的路線與機場，也依此計算各國的鐵路長度、鐵路密度與機場數。
這些都是依地圖資料計算的近似值：Natural Earth 1:10m 鐵路有簡化、可能缺少支線。
"""
from __future__ import annotations

import csv
import json
import math
from datetime import date

import pycountry

from common import OUT_DIR, download, indicator_file, now_iso, write_json
from geoindex import country_at, land_polygons
from sources.countries import ISO3

RAILROADS_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_railroads.geojson"
AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv"

OUT = OUT_DIR / "topics" / "transport"
SIMPLIFY_DEGREES = 0.01  # Douglas–Peucker 容許誤差，約 1 公里
QUANTUM = 0.005  # 座標量化單位（度），約 500 公尺
EARTH_RADIUS_KM = 6371.0088
CHUNK = 20  # 每 20 個頂點判斷一次所在國家，跨國界的線才會分對


def _simplify(points: list[list[float]], tolerance: float) -> list[list[float]]:
    """Douglas–Peucker（迭代版，避免遞迴過深）。"""
    n = len(points)
    if n < 3:
        return points
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    t2 = tolerance * tolerance
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = points[a][:2], points[b][:2]
        dx, dy = bx - ax, by - ay
        length2 = dx * dx + dy * dy
        best, best_i = -1.0, -1
        for i in range(a + 1, b):
            px, py = points[i][:2]
            if length2 == 0:
                d2 = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length2))
                d2 = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d2 > best:
                best, best_i = d2, i
        if best > t2:
            keep[best_i] = True
            stack.extend([(a, best_i), (best_i, b)])
    return [p for p, k in zip(points, keep) if k]


def _haversine_km(a: list[float], b: list[float]) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def _land_area_km2() -> dict[str, float]:
    """由國界多邊形計算面積（球面近似），用來算鐵路密度。跨過 ±180° 的國家（俄羅斯、斐濟）用展開成連續經度的多邊形。"""
    def ring_area(ring: list[tuple[float, float]]) -> float:
        total = 0.0
        for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
            total += math.radians(x2 - x1) * (2 + math.sin(math.radians(y1)) + math.sin(math.radians(y2)))
        return abs(total) * EARTH_RADIUS_KM**2 / 2

    areas = {}
    for iso3, polygons in land_polygons():
        areas[iso3] = sum(ring_area(p[0]) - sum(ring_area(h) for h in p[1:]) for p in polygons)
    return areas


def railways(year: int) -> dict[str, float]:
    path = download(RAILROADS_URL, "natural-earth", "ne_10m_railroads.geojson")
    with open(path, encoding="utf-8") as f:
        features = json.load(f)["features"]

    lengths: dict[str, float] = {}
    cell_cache: dict[tuple[int, int], str | None] = {}
    encoded: list[list[int]] = []
    for feature in features:
        coords = feature["geometry"]["coordinates"]
        # 長度用原始座標算，每一段依所在國家累加
        for start in range(0, len(coords) - 1, CHUNK):
            chunk = coords[start : start + CHUNK + 1]
            mid = chunk[len(chunk) // 2]
            cell = (round(mid[0] * 10), round(mid[1] * 10))
            if cell not in cell_cache:
                cell_cache[cell] = country_at(mid[0], mid[1])
            iso3 = cell_cache[cell]
            if iso3:
                lengths[iso3] = lengths.get(iso3, 0) + sum(_haversine_km(a, b) for a, b in zip(chunk, chunk[1:]))
        # 畫圖用簡化、量化後的座標，第一個點是絕對值，之後是差分
        q = [(round(x / QUANTUM), round(y / QUANTUM)) for x, y, *_ in _simplify(coords, SIMPLIFY_DEGREES)]
        q = [p for i, p in enumerate(q) if i == 0 or p != q[i - 1]]
        if len(q) < 2:
            continue
        flat = [q[0][0], q[0][1]]
        for (x0, y0), (x1, y1) in zip(q, q[1:]):
            flat += [x1 - x0, y1 - y0]
        encoded.append(flat)

    write_json(OUT / "railways.json", {"quantum": QUANTUM, "lines": encoded})
    print(f"  鐵路 {len(features)} 條 → 簡化後 {sum(len(l) // 2 for l in encoded)} 個頂點")

    areas = _land_area_km2()
    write_json(OUT / "rail-length.json", indicator_file(
        "rail-length", "公里", [year], {a: [round(lengths.get(a, 0))] for a in ISO3}))
    write_json(OUT / "rail-density.json", indicator_file(
        "rail-density", "公里/千平方公里", [year],
        {a: [round(lengths.get(a, 0) / areas[a] * 1000, 1)] for a in areas if not a.startswith("_") and areas[a] > 0}))
    return lengths


def airports(year: int) -> dict[str, list]:
    """大型機場，以及有定期航班的中型機場（不含小型機場、直升機場與純軍用機場）。"""
    path = download(AIRPORTS_URL, "ourairports", "airports.csv")
    rows = []
    by_country: dict[str, list] = {}
    with open(path, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            large = r["type"] == "large_airport"
            if not (large or (r["type"] == "medium_airport" and r["scheduled_service"] == "yes")):
                continue
            country = pycountry.countries.get(alpha_2=r["iso_country"])
            iso3 = "XKX" if r["iso_country"] == "XK" else (country.alpha_3 if country else None)
            if not iso3:
                continue
            row = [
                round(float(r["longitude_deg"]), 4), round(float(r["latitude_deg"]), 4),
                1 if large else 2, r["name"], r["iata_code"], r["municipality"], iso3,
            ]
            rows.append(row)
            by_country.setdefault(iso3, []).append(row)
    # 大型機場排在後面，畫的時候疊在中型機場上面
    rows.sort(key=lambda row: -row[2])
    write_json(OUT / "airports.json", {"fields": ["lon", "lat", "type", "name", "iata", "city", "iso3"], "rows": rows})
    write_json(OUT / "airports-count.json", indicator_file(
        "airports-count", "座", [year], {a: [len(by_country.get(a, []))] for a in ISO3}))
    write_json(OUT / "large-airports.json", indicator_file(
        "large-airports", "座", [year],
        {a: [sum(1 for r in by_country.get(a, []) if r[2] == 1)] for a in ISO3}))
    print(f"  機場 {len(rows)} 座（大型 {sum(1 for r in rows if r[2] == 1)}）")
    return by_country


def build() -> None:
    year = date.today().year
    lengths = railways(year)
    by_country = airports(year)
    for iso3 in set(lengths) | set(by_country):
        ports = sorted(by_country.get(iso3, []), key=lambda r: (r[2], r[3]))
        write_json(OUT / "countries" / f"{iso3}.json", {
            "railKm": round(lengths.get(iso3, 0)),
            "airports": [{"name": r[3], "iata": r[4], "city": r[5], "large": r[2] == 1} for r in ports],
        }, quiet=True)
    write_json(OUT / "manifest.json", {
        "topic": "transport",
        "generatedAt": now_iso(),
        "source": "Natural Earth 1:10m railroads v5.1.2; OurAirports",
    })
