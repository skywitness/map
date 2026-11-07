"""國土坐在哪些板塊上、造山帶（2026-11-07，製作手冊第二十七批 542，候選 1224；擴充「板塊漂移」；
步驟 plates-today，輸出到 topics/plates/）。

- 板塊與造山帶：PB2002（Bird 2003；Hugo Ahlenius、Nordpil 整理，ODC-By 1.0，sources/plates.py 固定的 commit）的
  PB2002_plates.json（52 塊）與 PB2002_orogens.json（13 個造山帶：瀰散變形、不能用剛體板塊描述的地方，不是「有山」）。
  國土用人口主題的 country_shapes()（Natural Earth 1:50m），跟板塊、造山帶在經緯度上相交，面積用球面公式（plates_pb2002.ring_area_km2）。
  - plate-shares.json（側欄）：每國國土在各板塊的比例、在哪些造山帶裡與比例。
  - orogen-share.json：國土在造山帶裡的比例（%）。
  - plates-land.json：國土跨幾塊板塊（占國土 1% 以上的才算；地震與火山的「跨幾塊板塊」算的是有人住的部分，這裡是面積）。
- 板塊現在的速度（候選 1225）沒有做：手冊建議的 Merdith 等 2021 模型 README 寫明它是純古地磁的參考框架，
  「500 萬年內或絕對板塊運動的分析要用別的模型」，試算的德國每年往北 5.2 公分、澳洲往北 3.5 公分跟一般的量級對不上。
  換來源要先問使用者（2026-11-07）。
- 國土跨幾塊板塊（面積 1% 以上）只在終端機印出來對照：地震與火山主題已經有依人口算的「跨幾塊板塊」。
"""
from __future__ import annotations

import json
from collections import defaultdict

from shapely.affinity import translate
from shapely.geometry import Polygon, shape
from shapely.strtree import STRtree

from common import download, indicator_file, write_json
from sources import plates as pb
from topics import plates as merdith  # 只用 OUT
from topics.plates_pb2002 import NAMES, polygons, ring_area_km2
from topics.population_grid import country_shapes

OUT = merdith.OUT
ORO_URL = pb.PLATES_URL.replace("PB2002_plates.json", "PB2002_orogens.json")
YEAR = 2026
MIN_SHARE = 1.0  # %：板塊占國土這個比例以上才算「坐在上面」


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


def overlay(country: list, layers: list[tuple[str, Polygon]], tree: STRtree) -> tuple[float, dict[str, float]]:
    """國土的面積與跟各圖層（板塊或造山帶）相交的面積（經度 ±360° 平移，處理跨 180° 經線）"""
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
                    parts[key] += area_km2(piece)
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
    for code, polys in country_shapes().items():
        total, by_plate = overlay(polys, plates, p_tree)
        if total <= 0:
            continue
        _, by_oro = overlay(polys, oro, o_tree)
        ps = sorted(((c, 100 * a / total) for c, a in by_plate.items()), key=lambda x: -x[1])
        os_ = sorted(((n, 100 * a / total) for n, a in by_oro.items()), key=lambda x: -x[1])
        shares[code] = {
            "plates": [[c, round(min(s, 100), 1)] for c, s in ps if s >= 0.05],
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

