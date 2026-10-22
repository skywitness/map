"""經緯度 → 國家（ISO alpha-3），用 build_geo.py 輸出的 Natural Earth 1:50m 國界。

1:50m 的海岸線有簡化，海邊的點可能剛好落在國界外，所以找不到時改找 0.3° 內最近的國界頂點。
"""
from __future__ import annotations

import json
from functools import lru_cache

from common import OUT_DIR

NEAREST_MAX_DEGREES = 0.3

Ring = list[tuple[float, float]]


@lru_cache(maxsize=1)
def _countries() -> list[tuple[str, tuple[float, float, float, float], list[list[Ring]]]]:
    path = OUT_DIR / "geo" / "countries-50m.json"
    if not path.exists():
        raise RuntimeError("找不到國界檔，請先執行 geo 步驟")
    with open(path, encoding="utf-8") as f:
        topo = json.load(f)
    (sx, sy), (tx, ty) = topo["transform"]["scale"], topo["transform"]["translate"]
    arcs: list[Ring] = []
    for arc in topo["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append((x * sx + tx, y * sy + ty))
        arcs.append(points)

    def ring(indexes: list[int]) -> Ring:
        points: Ring = []
        for i in indexes:
            arc = arcs[i] if i >= 0 else arcs[~i][::-1]
            points.extend(arc if not points else arc[1:])
        return points

    out = []
    for geom in topo["objects"]["countries"]["geometries"]:
        polygons = [geom["arcs"]] if geom["type"] == "Polygon" else geom["arcs"]
        rings = [[ring(r) for r in polygon] for polygon in polygons]
        xs = [p[0] for poly in rings for r in poly for p in r]
        ys = [p[1] for poly in rings for r in poly for p in r]
        out.append((geom["id"], (min(xs), min(ys), max(xs), max(ys)), rings))
    return out


def _inside(x: float, y: float, ring: Ring) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def country_at(lon: float, lat: float) -> str | None:
    candidates = []
    for iso3, (x0, y0, x1, y1), polygons in _countries():
        if x0 - NEAREST_MAX_DEGREES <= lon <= x1 + NEAREST_MAX_DEGREES and y0 - NEAREST_MAX_DEGREES <= lat <= y1 + NEAREST_MAX_DEGREES:
            candidates.append((iso3, polygons))
            for polygon in polygons:
                if _inside(lon, lat, polygon[0]) and not any(_inside(lon, lat, hole) for hole in polygon[1:]):
                    return iso3
    best, best_d2 = None, NEAREST_MAX_DEGREES**2
    for iso3, polygons in candidates:
        for polygon in polygons:
            for px, py in polygon[0]:
                d2 = (px - lon) ** 2 + (py - lat) ** 2
                if d2 < best_d2:
                    best, best_d2 = iso3, d2
    return best
