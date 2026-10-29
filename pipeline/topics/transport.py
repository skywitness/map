"""交通主題：全球鐵路路線（Natural Earth）與機場位置（OurAirports），都是公有領域；地鐵站與高鐵見 topics/metro.py（Wikidata，CC0）。

除了畫在地圖上的路線與機場，也依此計算各國的鐵路長度、鐵路密度與機場數。
這些都是依地圖資料計算的近似值：Natural Earth 1:10m 鐵路有簡化、可能缺少支線。

航空旅客量（build_air_passengers，2026-10-29）：世界銀行 WDI IS.AIR.PSGR（來源 ICAO，CC BY 4.0），各國註冊的航空公司
一年載運的旅客（國內加國際，一趟轉機算兩次），與每人搭機次數（÷ WPP 人口）。使用者 2026-10-29 決定：兩個都做；
WDI 沒有台灣，民航局的機場旅客數（sources/caa.py，口徑不同）放附註，地圖上留白。
"""
from __future__ import annotations

import csv
import json
import math
from datetime import date

import pycountry

from common import OUT_DIR, download, indicator_file, now_iso, to_series, write_json
from geoindex import country_at, land_polygons
from sources import caa, worldbank, wpp
from sources.countries import ISO3
from topics import metro

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


AIR_FIRST_YEAR = 1970
AIR_LICENSE = "CC BY 4.0"


def _air_taiwan_notes(airports: dict[int, dict[str, int]]) -> tuple[str, str]:
    """台灣的附註：最近一整年與 2019 年（疫情前）民航局統計的機場旅客。"""
    last = max(airports)
    a, peak = airports[last], airports[2019]
    m = lambda v: f"{v / 1e4:,.0f} 萬"  # noqa: E731
    mn = lambda v: f"{v / 1e6:,.1f} million"  # noqa: E731
    zh = (f"世界銀行（ICAO）沒有台灣。民航局統計的台灣各機場旅客（入境、出境與過境，國內線在起降兩端各算一次）{last} 年 "
          f"{m(a['total'])}人次（國際 {m(a['international'])}、兩岸 {m(a['crossStrait'])}、國內 {m(a['domestic'])}），"
          f"2019 年 {m(peak['total'])}人次；算的是機場的旅客，不是國籍航空公司的載客，跟地圖上的數字不能直接比。")
    en = (f"The World Bank (ICAO) has no data for Taiwan. Taiwan’s Civil Aeronautics Administration counted {mn(a['total'])} "
          f"passengers at Taiwan’s airports in {last} (arrivals, departures and transit; domestic passengers are counted at both ends): "
          f"{mn(a['international'])} international, {mn(a['crossStrait'])} cross-strait and {mn(a['domestic'])} domestic, "
          f"against {mn(peak['total'])} in 2019. These are airport passengers, not passengers carried by Taiwanese airlines, "
          f"so they cannot be compared directly with the figures on the map.")
    return zh, en


def build_air_passengers() -> None:
    """各國註冊的航空公司載運的旅客（人次）與每人搭機次數；台灣留白、附註寫民航局的機場旅客。"""
    passengers, world = worldbank.fetch("IS.AIR.PSGR", AIR_FIRST_YEAR)
    pop = wpp.demographic(["TPopulation1July"])["TPopulation1July"]  # 千人
    last = max(max(s) for s in passengers.values())
    years = list(range(AIR_FIRST_YEAR, last + 1))
    per_person = {
        iso3: {y: v / (pop[iso3][y] * 1000) for y, v in s.items() if pop.get(iso3, {}).get(y)}
        for iso3, s in passengers.items()
    }
    zh, en = _air_taiwan_notes(caa.airport_passengers())
    extra = {"license": AIR_LICENSE, "notes": {"TWN": zh}, "notesEn": {"TWN": en}}
    write_json(OUT / "air-passengers.json", indicator_file(
        "air-passengers", "人次", years, {a: to_series(s, years, 0) for a, s in passengers.items()},
        aggregates={"WLD": to_series(world, years, 0)}, **extra))
    world_pp = {y: v / (pop["WLD"][y] * 1000) for y, v in world.items() if pop["WLD"].get(y)}
    write_json(OUT / "air-trips.json", indicator_file(
        "air-trips", "次/人", years, {a: to_series(s, years, 3) for a, s in per_person.items() if s},
        aggregates={"WLD": to_series(world_pp, years, 3)}, **extra))
    latest = sorted(((s[last], a) for a, s in per_person.items() if last in s), reverse=True)
    print(f"  航空旅客 {len(passengers)} 國，到 {last} 年；世界 {world[last] / 1e8:,.1f} 億人次（每人 {world_pp[last]:.2f} 次）")
    print(f"  每人搭機最多 {[(a, round(v, 1)) for v, a in latest[:8]]}")
    print(f"  台灣附註：{zh}")


def build() -> None:
    year = date.today().year
    lengths = railways(year)
    by_country = airports(year)
    rail = metro.build(sorted(a for a in ISO3 if not a.startswith("_")))
    for iso3 in set(lengths) | set(by_country) | set(rail):
        ports = sorted(by_country.get(iso3, []), key=lambda r: (r[2], r[3]))
        write_json(OUT / "countries" / f"{iso3}.json", {
            "railKm": round(lengths.get(iso3, 0)),
            "airports": [{"name": r[3], "iata": r[4], "city": r[5], "large": r[2] == 1} for r in ports],
            **rail.get(iso3, {}),
        }, quiet=True)
    build_air_passengers()
    write_json(OUT / "manifest.json", {
        "topic": "transport",
        "generatedAt": now_iso(),
        "source": "Natural Earth 1:10m railroads v5.1.2; OurAirports; World Bank WDI IS.AIR.PSGR (ICAO); 交通部民用航空局",
    })
