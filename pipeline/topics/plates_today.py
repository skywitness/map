"""國土坐在哪些板塊上、造山帶（2026-11-07，製作手冊第二十七批 542，候選 1224；擴充「板塊漂移」；
步驟 plates-today，輸出到 topics/plates/）。

- 板塊與造山帶：PB2002（Bird 2003；Hugo Ahlenius、Nordpil 整理，ODC-By 1.0，sources/plates.py 固定的 commit）的
  PB2002_plates.json（52 塊）與 PB2002_orogens.json（13 個造山帶：瀰散變形、不能用剛體板塊描述的地方，不是「有山」）。
  國土用人口主題的 country_shapes()（Natural Earth 1:50m），跟板塊、造山帶在經緯度上相交，面積用球面公式（plates_pb2002.ring_area_km2）。
  - plate-shares.json（側欄）：每國國土在各板塊的比例、在哪些造山帶裡與比例。
  - orogen-share.json：國土在造山帶裡的比例（%）。
  - plates-land.json：國土跨幾塊板塊（占國土 1% 以上的才算；地震與火山的「跨幾塊板塊」算的是有人住的部分，這裡是面積）。
- 板塊現在的速度（候選 1225）：手冊建議的 Merdith 等 2021 模型 README 寫明它是純古地磁的參考框架，
  「500 萬年內或絕對板塊運動的分析要用別的模型」（試算的德國每年往北 5.2 公分、澳洲往北 3.5 公分），使用者 2026-11-07 選
  改用 NNR-MORVEL56（sources/nnr_morvel.py，Argus 等 2011 的 56 塊板塊角速度，無淨旋轉參考框架）。
  國土在每一塊 PB2002 板塊上的部分，用那塊板塊的歐拉向量算速度（v = ω × r，r 取那部分依面積加權的位置），全國再依面積加權平均成
  一個向量。跨好幾塊往不同方向的板塊時，平均會互相抵消，側欄另外列每一塊的速度。
  - plate-speed.json：公分／年，hints 寫方向；plate-direction.json：方向分 8 類（1 北、2 東北…8 西北）。
- 國土跨幾塊板塊（面積 1% 以上）只在終端機印出來對照：地震與火山主題已經有依人口算的「跨幾塊板塊」。
"""
from __future__ import annotations

import json
from collections import defaultdict

from shapely.affinity import translate
from shapely.geometry import Polygon, shape
from shapely.strtree import STRtree

import math

import numpy as np

from common import download, indicator_file, write_json
from sources import nnr_morvel
from sources import plates as pb
from topics import plates as merdith  # 只用 OUT
from topics.plates_pb2002 import NAMES, polygons, ring_area_km2
from topics.population_grid import country_shapes

OUT = merdith.OUT
ORO_URL = pb.PLATES_URL.replace("PB2002_plates.json", "PB2002_orogens.json")
YEAR = 2026
MIN_SHARE = 1.0  # %：板塊占國土這個比例以上才算「坐在上面」
R_MM = 6371.0088e6  # 地球半徑（公釐）：角速度（弧度／年）× 半徑 = 公釐／年
DIRECTIONS_ZH = ["北", "東北", "東", "東南", "南", "西南", "西", "西北"]
DIRECTIONS_EN = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]


def area_km2(geom) -> float:
    total = 0.0
    for g in getattr(geom, "geoms", [geom]):
        if g.geom_type != "Polygon" or g.is_empty:
            continue
        total += ring_area_km2(list(g.exterior.coords))
        total -= sum(ring_area_km2(list(r.coords)) for r in g.interiors)
    return total


def orogens() -> list[tuple[str, Polygon]]:
    with open(download(ORO_URL, "plates", "PB2002_orogens.json"), encoding="utf-8") as f:
        features = json.load(f)["features"]
    out = []
    for feat in features:
        geom = shape(feat["geometry"]).buffer(0)
        name = feat["properties"].get("Name") or feat["properties"].get("NAME") or ""
        for g in getattr(geom, "geoms", [geom]):
            out.append((name, g))
    return out


def unit(lon: float, lat: float) -> np.ndarray:
    a, b = math.radians(lat), math.radians(lon)
    return np.array([math.cos(a) * math.cos(b), math.cos(a) * math.sin(b), math.sin(a)])


def velocity(plate: str, r: np.ndarray) -> tuple[float, float]:
    """PB2002 板塊在單位向量 r 的位置的 NNR-MORVEL56 速度：(公分／年, 方位角：北 0、東 90)"""
    _name, plat, plon, w = nnr_morvel.POLES[nnr_morvel.PB2002.get(plate, plate)]
    omega = unit(plon, plat) * math.radians(w) / 1e6  # 弧度／年
    v = np.cross(omega, r / np.linalg.norm(r)) * R_MM  # 公釐／年
    p = r / np.linalg.norm(r)
    lat, lon = math.asin(p[2]), math.atan2(p[1], p[0])
    east = np.array([-math.sin(lon), math.cos(lon), 0.0])
    north = np.array([-math.sin(lat) * math.cos(lon), -math.sin(lat) * math.sin(lon), math.cos(lat)])
    ve, vn = float(v @ east), float(v @ north)
    return math.hypot(ve, vn) / 10, (math.degrees(math.atan2(ve, vn)) + 360) % 360


def east_north(speed: float, azimuth: float) -> tuple[float, float]:
    return speed * math.sin(math.radians(azimuth)), speed * math.cos(math.radians(azimuth))


def overlay(
    country: list, layers: list[tuple[str, Polygon]], tree: STRtree, where: dict[str, np.ndarray] | None = None
) -> tuple[float, dict[str, float]]:
    """國土的面積與跟各圖層（板塊或造山帶）相交的面積（經度 ±360° 平移，處理跨 180° 經線）；
    where 不是 None 時另外累加每一塊依面積加權的位置（單位向量 × 面積）"""
    total = 0.0
    parts: dict[str, float] = defaultdict(float)
    for p in country:
        g = Polygon(p[0], p[1:]).buffer(0)
        if g.is_empty:
            continue
        total += area_km2(g)
        for shift in (0, 360, -360):
            gs = translate(g, xoff=shift) if shift else g
            for j in tree.query(gs, predicate="intersects"):
                key, lp = layers[int(j)]
                piece = gs.intersection(lp)
                if not piece.is_empty:
                    a = area_km2(piece)
                    parts[key] += a
                    if where is not None and a > 0:
                        c = piece.centroid
                        where[key] = where.get(key, np.zeros(3)) + unit(c.x - shift, c.y) * a
    return total, dict(parts)


def build() -> None:
    plates = [(code, g) for code, gs in polygons().items() for g in gs]
    p_tree = STRtree([g for _, g in plates])
    oro = orogens()
    o_tree = STRtree([g for _, g in oro])
    print(f"  PB2002：板塊 {len(set(c for c, _ in plates))} 塊、造山帶 {len(set(n for n, _ in oro))} 個 {sorted(set(n for n, _ in oro))}")
    shares: dict[str, dict] = {}
    orogen_share: dict[str, list[float]] = {}
    plate_count: dict[str, list[int]] = {}
    speed: dict[str, list[float]] = {}
    sector: dict[str, list[int]] = {}
    azimuth: dict[str, float] = {}
    for code, polys in country_shapes().items():
        where: dict[str, np.ndarray] = {}
        total, by_plate = overlay(polys, plates, p_tree, where)
        if total <= 0:
            continue
        # 每一塊板塊上那部分的速度，再依面積平均成全國的向量
        per_plate = {c: velocity(c, where[c]) for c in by_plate if c in where}
        e = sum(east_north(*per_plate[c])[0] * by_plate[c] for c in per_plate) / sum(by_plate[c] for c in per_plate)
        n = sum(east_north(*per_plate[c])[1] * by_plate[c] for c in per_plate) / sum(by_plate[c] for c in per_plate)
        az = (math.degrees(math.atan2(e, n)) + 360) % 360
        speed[code] = [round(math.hypot(e, n), 2)]
        sector[code] = [int(((az + 22.5) % 360) // 45) + 1]
        azimuth[code] = az
        _, by_oro = overlay(polys, oro, o_tree)
        ps = sorted(((c, 100 * a / total) for c, a in by_plate.items()), key=lambda x: -x[1])
        os_ = sorted(((n, 100 * a / total) for n, a in by_oro.items()), key=lambda x: -x[1])
        shares[code] = {
            # [板塊, 占國土 %, 那部分的速度（公分／年）, 方位角]
            "plates": [[c, round(min(s, 100), 1), round(per_plate[c][0], 2), round(per_plate[c][1])] for c, s in ps if s >= 0.05],
            "orogens": [[n, round(min(s, 100), 1)] for n, s in os_ if s >= 0.05],
        }
        orogen_share[code] = [round(min(100.0, sum(s for _, s in os_)), 1)]
        plate_count[code] = [sum(1 for _, s in ps if s >= MIN_SHARE)]
    write_json(OUT / "plate-shares.json", {"names": {c: NAMES[c] for c in sorted(NAMES)}, "countries": shares})
    write_json(OUT / "orogen-share.json", indicator_file("orogen-share", "%", [YEAR], orogen_share, license="ODC-By 1.0"))
    top_oro = sorted(((v[0], c) for c, v in orogen_share.items()), reverse=True)
    print(f"  造山帶占國土：{len([1 for v, _ in top_oro if v > 0])} 國 > 0；{top_oro[:16]}；台灣 {orogen_share.get('TWN')} {shares.get('TWN')}")
    cnt = sorted(((v[0], c) for c, v in plate_count.items()), reverse=True)
    print(f"  跨幾塊板塊（面積 1% 以上）：{cnt[:12]}；台灣 {plate_count.get('TWN')}；日本 {shares.get('JPN', {}).get('plates')}")

    hints = {c: f"往{DIRECTIONS_ZH[sector[c][0] - 1]}（方位角 {azimuth[c]:.0f}°）每年 {speed[c][0]:.1f} 公分" for c in speed}
    hints_en = {c: f"{speed[c][0]:.1f} cm a year towards the {DIRECTIONS_EN[sector[c][0] - 1]} (azimuth {azimuth[c]:.0f}°)" for c in speed}
    extra = {
        "license": "facts from a published table",
        "attribution": "Argus, Gordon & DeMets (2011), Geochem. Geophys. Geosyst. 12, Q11001, doi:10.1029/2011GC003751 (NNR-MORVEL56)",
    }
    write_json(OUT / "plate-speed.json", indicator_file("plate-speed", "cm/yr", [YEAR], speed, hints=hints, hintsEn=hints_en, **extra))
    write_json(OUT / "plate-direction.json", indicator_file("plate-direction", "category", [YEAR], sector, hints=hints, hintsEn=hints_en, **extra))
    fast = sorted(((v[0], c) for c, v in speed.items()), reverse=True)
    print(f"  速度：{len(speed)} 國；最快 {fast[:14]}；最慢 {fast[-10:]}")
    from collections import Counter
    print(f"  方向：{Counter(v[0] for v in sector.values())}")
    for c in ("TWN", "JPN", "AUS", "USA", "DEU", "IND", "CHN", "NZL", "PHL", "ISL", "FJI", "BRA", "TON", "SAU"):
        if c in speed:
            print(f"    {c}：{hints[c]}；{shares[c]['plates'][:3]}")

