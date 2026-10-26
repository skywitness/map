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
def _polygons() -> list[tuple[str, list[list[Ring]]]]:
    """國界檔的每個國家：多邊形的清單，每個多邊形是 [外環, 洞…]（原始的經度，跨過 ±180° 的環會跳 360°）"""
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
        out.append((geom["id"], [[ring(r) for r in polygon] for polygon in polygons]))
    return out


@lru_cache(maxsize=1)
def _countries() -> list[tuple[str, tuple[float, float, float, float], list[list[Ring]]]]:
    """判斷位置用：(國家, 範圍, 多邊形)，跨過 ±180° 的多邊形含 _wrapped() 補的平移 360° 的副本"""
    out = []
    for iso3, polygons in _polygons():
        rings = []
        for polygon in polygons:
            rings.extend(_wrapped(polygon))
        xs = [p[0] for poly in rings for r in poly for p in r]
        ys = [p[1] for poly in rings for r in poly for p in r]
        out.append((iso3, (min(xs), min(ys), max(xs), max(ys)), rings))
    return out


def land_polygons() -> list[tuple[str, list[list[Ring]]]]:
    """算面積用：每個國家的多邊形，跨過 ±180° 的展開成連續經度，不含 _wrapped() 補的平移 360° 的副本。

    _countries() 的副本會重複計算（俄羅斯本土的環整個多一份，面積變成兩倍）；換日線修好以前，跳 360° 的邊
    則讓俄羅斯少算約 600 萬 km²、斐濟多算約 14 萬 km²（交通主題的鐵路密度用這個面積）。
    """
    return [(iso3, [_wrapped(polygon)[0] for polygon in polygons]) for iso3, polygons in _polygons()]


def _unwrap(ring: Ring) -> Ring:
    """跨過 ±180° 的環改成連續的經度；繞極的環（南極洲）展開後頭尾接不起來，維持原樣（同 population_grid.unwrap）"""
    out = [ring[0]]
    for x, y in ring[1:]:
        x += 360 * round((out[-1][0] - x) / 360)
        out.append((x, y))
    return out if abs(out[-1][0] - out[0][0]) < 1e-9 else ring


def _wrapped(polygon: list[Ring]) -> list[list[Ring]]:
    """跨過 ±180° 的多邊形：展開成連續經度，超出 ±180° 的部分再補一份平移 360° 的。

    不展開的話，從 179.9° 跳到 −180° 的邊會橫跨整個地圖，射線法在那幾個緯度把整條帶子都判成在環裡：
    俄羅斯本土的環在北緯約 65°–69°（楚科奇）有這樣的邊，原本挪威的博德、芬蘭的羅瓦涅米、瑞典的呂勒奧
    這些排在俄羅斯後面、或落在自己國界外的點都被判成俄羅斯（2026-10-27 網路速度主題發現的）；斐濟跨過 ±180° 的
    多邊形也一樣，南緯約 16.5° 的玻利維亞拉巴斯、馬達加斯加、波拉波拉島的點被判成斐濟（DESIGN.md 第 8 節第 79 點）。
    """
    unwrapped = [_unwrap(r) for r in polygon]
    if unwrapped == polygon:
        return [polygon]
    out = [unwrapped]
    xs = [x for r in unwrapped for x, _y in r]
    if max(xs) > 180:
        out.append([[(x - 360, y) for x, y in r] for r in unwrapped])
    if min(xs) < -180:
        out.append([[(x + 360, y) for x, y in r] for r in unwrapped])
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


# 一次判斷很多點（便利商店與連鎖品牌主題約 100 萬個店家）：規則跟 country_at() 完全一樣，改用 numpy 一次算一批點，
# 逐點呼叫 country_at() 要一個多小時，這裡幾十秒。
_CHUNK_CELLS = 4_000_000  # 一批「點數 × 邊數」的上限，控制記憶體


@lru_cache(maxsize=1)
def _ring_arrays() -> list[list[tuple[tuple[float, float, float, float], list[object]]]]:
    """每個國家每個多邊形：(外環的範圍, [外環, 洞…])，環是 numpy 的 (x, y) 陣列。"""
    import numpy as np

    out = []
    for _iso3, _bbox, polygons in _countries():
        country = []
        for polygon in polygons:
            rings = [np.asarray(r, dtype=float) for r in polygon]
            outer = rings[0]
            country.append(((outer[:, 0].min(), outer[:, 1].min(), outer[:, 0].max(), outer[:, 1].max()), rings))
        out.append(country)
    return out


def _inside_many(x, y, ring):
    """_inside() 的向量版：x、y 是一批點，回傳每個點在不在環裡（射線法，邊的配對跟 _inside() 一樣）"""
    import numpy as np

    xi, yi = ring[:, 0], ring[:, 1]
    xj, yj = np.roll(xi, 1), np.roll(yi, 1)
    out = np.zeros(len(x), dtype=bool)
    step = max(1, _CHUNK_CELLS // len(ring))
    with np.errstate(divide="ignore", invalid="ignore"):
        for s in range(0, len(x), step):
            px, py = x[s : s + step, None], y[s : s + step, None]
            crosses = ((yi > py) != (yj > py)) & (px < (xj - xi) * (py - yi) / (yj - yi) + xi)
            out[s : s + step] = (crosses.sum(axis=1) % 2) == 1
    return out


def countries_at(lons: list[float], lats: list[float]) -> list[str | None]:
    """country_at() 的批次版，結果相同：依國家順序，第一個包含這個點的國家；都不在國界內時取 0.3° 內最近的國界頂點。"""
    import numpy as np

    x, y = np.asarray(lons, dtype=float), np.asarray(lats, dtype=float)
    found = np.full(len(x), -1)
    r = NEAREST_MAX_DEGREES
    countries = _countries()
    for ci, ((_iso3, (x0, y0, x1, y1), _polygons), polygons) in enumerate(zip(countries, _ring_arrays())):
        idx = np.nonzero((found < 0) & (x >= x0 - r) & (x <= x1 + r) & (y >= y0 - r) & (y <= y1 + r))[0]
        if not len(idx):
            continue
        inside = np.zeros(len(idx), dtype=bool)
        for (px0, py0, px1, py1), rings in polygons:
            sub = np.nonzero(~inside & (x[idx] >= px0) & (x[idx] <= px1) & (y[idx] >= py0) & (y[idx] <= py1))[0]
            if not len(sub):
                continue
            j = idx[sub]
            hit = _inside_many(x[j], y[j], rings[0])
            for hole in rings[1:]:
                hit &= ~_inside_many(x[j], y[j], hole)
            inside[sub] = hit
        found[idx[inside]] = ci

    rest = np.nonzero(found < 0)[0]
    best = np.full(len(rest), r * r)
    for ci, ((_iso3, (x0, y0, x1, y1), _polygons), polygons) in enumerate(zip(countries, _ring_arrays())):
        sub = np.nonzero((x[rest] >= x0 - r) & (x[rest] <= x1 + r) & (y[rest] >= y0 - r) & (y[rest] <= y1 + r))[0]
        if not len(sub):
            continue
        j = rest[sub]
        for _bbox, rings in polygons:
            v = rings[0]
            step = max(1, _CHUNK_CELLS // len(v))
            for s in range(0, len(j), step):
                k = sub[s : s + step]
                d2 = ((v[None, :, 0] - x[j[s : s + step], None]) ** 2 + (v[None, :, 1] - y[j[s : s + step], None]) ** 2).min(axis=1)
                closer = d2 < best[k]
                best[k[closer]] = d2[closer]
                found[rest[k[closer]]] = ci
    return [countries[c][0] if c >= 0 else None for c in found]
