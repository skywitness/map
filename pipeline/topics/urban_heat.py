"""城市熱島：Yang 等人的 Global Urban Heat Island Intensity Dataset（figshare 24821538 v3，CC BY 4.0）。

- 使用者 2026-10-30 決定用「夏季白天的地表溫度熱島」：城區的地表溫度比周圍郊外高幾度，不是氣溫的熱島
  （氣溫的熱島晚上比較大，地表溫度的熱島白天、夏天比較大）。
- 資料：`UHII_dataset.rar`（1,443,221,337 bytes）裡每個「溫度來源_日夜_年_月」一個 CSV，每列一個城區（UrbanId）、
  四種郊外參考區的取法（EA、IEA、MEA、DEA）；城區的座標與面積在 `CityInfo.csv`（10,196 個城區）。
  RAR 用 bsdtar（libarchive，Ubuntu 的 libarchive-tools）只解出要用的檔。
- 這裡的選擇（製作手冊只寫到「夏季白天的地表溫度熱島」，下面是細節）：
  - 溫度來源：MYD11A1（Aqua 衛星的每日晴空地表溫度，下午 1 點半左右過境，接近一天最熱的時候），2003–2021 年。
    Terra（MOD11A1，上午 10 點半）2001 年起，但白天的熱島比較小（台北 2021 年夏季 8.5 對 10.6 °C）。
  - 郊外參考區：作者提出的 DEA（動態等面積法，排除水體、地形起伏與其他城區的影響，參考區跟城區一樣大）。
  - 夏季：北半球用 6–8 月（檔名的月份 22），南半球用 12–2 月（24），依城區中心的緯度分。
- 城市名稱：資料只有編號，跟網站「城市」主題的點（GHSL UCDB）依位置對：城區中心到城市點的距離在
  城區的等面積半徑的 1.3 倍加 5 km 以內、人口最多的那一個；對不到的只寫「城區 #編號」，國家依國界判斷。
"""
from __future__ import annotations

import csv
import io
import math
import shutil
import subprocess
from collections import defaultdict

import numpy as np
from shapely.geometry import Point, Polygon
from shapely.strtree import STRtree

from common import CACHE_DIR, OUT_DIR, download, indicator_file, now_iso, points_file, write_json
from topics.population_grid import country_shapes

ARTICLE = "https://figshare.com/articles/dataset/24821538"
RAR_URL = "https://ndownloader.figshare.com/files/43661121"
INFO_URL = "https://ndownloader.figshare.com/files/43661826"
SOURCE = "uhii"
OUT = OUT_DIR / "topics" / "urban-heat"
SENSOR = "Myd1"
YEARS = list(range(2003, 2022))
NORTH, SOUTH = 22, 24  # 季平均的「月份」代碼：22 是 6–8 月、24 是 12–2 月
METHOD = "Intensity_DEA"


def city_info() -> list[dict]:
    path = download(INFO_URL, SOURCE, "CityInfo.csv")
    with open(path, encoding="utf-8-sig") as f:
        return [
            {"id": int(r["UrbanId"]), "lon": float(r["Longitude"]), "lat": float(r["Latitude"]), "area": float(r["Area"])}
            for r in csv.DictReader(f)
        ]


def read_season(year: int, season: int) -> dict[int, float]:
    """{UrbanId: 熱島強度 °C}，從 RAR 裡解出一個 CSV（解過的留在快取）"""
    name = f"{SENSOR}_Day_{year}_{season}.csv"
    cached = CACHE_DIR / SOURCE / "csv" / name
    if not cached.exists():
        if not shutil.which("bsdtar"):
            raise RuntimeError("要有 bsdtar 才能讀 RAR（Ubuntu：apt install libarchive-tools）")
        rar = download(RAR_URL, SOURCE, "UHII_dataset.rar")
        cached.parent.mkdir(parents=True, exist_ok=True)
        data = subprocess.run(["bsdtar", "-xOf", str(rar), name], check=True, capture_output=True).stdout
        if not data:
            raise ValueError(f"{rar.name} 裡沒有 {name}")
        cached.write_bytes(data)
    out = {}
    for r in csv.DictReader(io.StringIO(cached.read_text(encoding="utf-8-sig"))):
        try:
            v = float(r[METHOD])
        except ValueError:  # NA
            continue
        if math.isfinite(v):
            out[int(r["UrbanId"])] = v
    return out


def match_cities(info: list[dict]) -> dict[int, dict]:
    """UrbanId → 網站「城市」主題的那一個城市（名稱、中文名、國家）"""
    data = __import__("json").loads((OUT_DIR / "topics" / "cities" / "cities.json").read_text(encoding="utf-8"))
    fields, cols = data["fields"], data["columns"]
    col = dict(zip(fields, cols))
    lon = np.array(col["lon"]) * data["scale"]["lon"]
    lat = np.array(col["lat"]) * data["scale"]["lat"]
    # 2020 年的人口：p1975、p1980… 是跟前一期的差（cities.py），加起來
    pop = np.zeros(len(lon))
    for f in fields:
        if f.startswith("p") and f[1:].isdigit() and int(f[1:]) <= 2020:
            pop += np.array([v or 0 for v in col[f]], dtype=float) * data["scale"][f]
    out = {}
    for c in info:
        dy = (lat - c["lat"]) * 111.2
        dx = (lon - c["lon"]) * 111.2 * math.cos(math.radians(c["lat"]))
        d = np.hypot(dx, dy)
        # 城區的等面積半徑的 1.3 倍加 5 km 內，人口最多的那一個（最近的常是郊區的小地名，高雄的城區中心比較靠北）
        near = np.nonzero(d <= 1.3 * math.sqrt(c["area"] / math.pi) + 5)[0]
        if near.size:
            j = int(near[np.argmax(pop[near])])
            out[c["id"]] = {"name": col["name"][j], "zh": col["zh"][j], "iso3": col["iso3"][j], "km": float(d[j])}
    return out


def country_of(info: list[dict]) -> dict[int, str]:
    shapes = country_shapes()
    polys, codes = [], []
    for iso3, polygons in shapes.items():
        for p in polygons:
            try:
                poly = Polygon(p[0], p[1:])
            except ValueError:
                continue
            polys.append(poly.buffer(0) if not poly.is_valid else poly)
            codes.append(iso3)
    tree = STRtree(polys)
    out = {}
    for c in info:
        pt = Point(c["lon"], c["lat"])
        hits = [i for i in tree.query(pt) if polys[i].contains(pt)]
        if not hits:
            near = tree.nearest(pt)
            # 50m 的國界沒有的小島（澎湖的馬公，離台灣本島 0.53°）：0.6° 內最近的國家
            if polys[near].distance(pt) < 0.6:
                hits = [near]
        if hits:
            out[c["id"]] = codes[hits[0]]
    return out


def build() -> None:
    info = city_info()
    north = {y: read_season(y, NORTH) for y in YEARS}
    south = {y: read_season(y, SOUTH) for y in YEARS}
    matched = match_cities(info)
    located = country_of(info)

    rows = []
    by_country: dict[str, dict[int, list[tuple[float, float]]]] = defaultdict(lambda: defaultdict(list))
    for c in sorted(info, key=lambda c: -c["area"]):
        season = north if c["lat"] >= 0 else south
        m = matched.get(c["id"])
        iso3 = located.get(c["id"]) or (m["iso3"] if m else None)
        row = {
            "id": c["id"], "lon": c["lon"], "lat": c["lat"], "area": round(c["area"]),
            "iso3": iso3, "name": m["name"] if m else None, "zh": m["zh"] if m else None,
        }
        values = []
        for y in YEARS:
            v = season[y].get(c["id"])
            row[f"y{y}"] = round(v, 1) if v is not None else None
            if v is not None:
                values.append(v)
                if iso3:
                    by_country[iso3][y].append((v, c["area"]))
        row["avg"] = round(sum(values) / len(values), 1) if values else None
        rows.append(row)

    fields = ["id", "lon", "lat", "area", "iso3", "name", "zh", "avg", *[f"y{y}" for y in YEARS]]
    scale = {"lon": 0.01, "lat": 0.01, "area": 1, "avg": 0.1, **{f"y{y}": 0.1 for y in YEARS}}
    write_json(OUT / "cities.json", points_file(rows, fields, scale, strings=["iso3"]))

    # 國家：依城區面積加權的平均（大城市的分量比較重）
    series = {}
    for iso3, by_year in sorted(by_country.items()):
        series[iso3] = [
            round(sum(v * a for v, a in by_year[y]) / sum(a for _v, a in by_year[y]), 2) if by_year.get(y) else None for y in YEARS
        ]
    world = []
    for y in YEARS:
        pairs = [(v, a) for by_year in by_country.values() for v, a in by_year.get(y, [])]
        world.append(round(sum(v * a for v, a in pairs) / sum(a for _v, a in pairs), 2))
    counts = {iso3: max(len(by_year[y]) for y in by_year) for iso3, by_year in by_country.items()}
    notes = {iso3: f"這裡有 {n} 個城區，數值依城區面積加權" for iso3, n in counts.items() if n <= 2}
    notes_en = {iso3: f"{n} urban area{'s' if n > 1 else ''} here; area-weighted" for iso3, n in counts.items() if n <= 2}
    write_json(OUT / "uhi.json", indicator_file("uhi", "°C", YEARS, series, aggregates={"WLD": world}, notes=notes, notesEn=notes_en))
    write_json(OUT / "manifest.json", {
        "topic": "urban-heat",
        "generatedAt": now_iso(),
        "source": f"Yang et al., Global Urban Heat Island Intensity Dataset (figshare 24821538 v3, CC BY 4.0): {SENSOR} daytime, DEA, summer",
    })
    report(rows, matched, located, series, world)


def report(rows, matched, located, series, world) -> None:
    print(f"  {len(rows)} 個城區，對到城市名稱 {len(matched)}、有國家 {sum(1 for r in rows if r['iso3'])}")
    tw = [r for r in rows if r["iso3"] == "TWN"]
    print(f"  台灣 {len(tw)} 個城區：" + "、".join(f"{r['zh'] or r['name'] or r['id']} {r['area']} km² {r['y2021']}" for r in tw[:8]))
    for r in rows[:8]:
        print(f"  {r['id']} {r['name']}（{r['iso3']}）{r['area']} km²：2003 {r['y2003']}、2021 {r['y2021']}、平均 {r['avg']}")
    print(f"  世界（依面積加權）2003 {world[0]}、2021 {world[-1]}")
    for iso3 in ("TWN", "JPN", "CHN", "USA", "IND", "DEU", "BRA", "EGY", "SAU"):
        if iso3 in series:
            print(f"  {iso3}：2003 {series[iso3][0]}、2021 {series[iso3][-1]}")
    vals = sorted(r["y2021"] for r in rows if r["y2021"] is not None)
    print("  2021 分位數：" + " / ".join(str(vals[int(len(vals) * q)]) for q in (0, 0.05, 0.25, 0.5, 0.75, 0.95, 0.999)))
