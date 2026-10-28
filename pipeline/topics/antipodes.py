"""地球的另一邊（對蹠點）（DESIGN.md 第 8 節第 89 點）：每個地方穿過地心的另一邊（緯度變號、經度加減 180°）是哪裡。

- 地圖上的形狀：地圖本身的 Natural Earth 1:50m 國界（world-atlas，公有領域），arc 先簡化（SIMPLIFY）。整片陸地
  （所有國家的聯集）翻到對蹠點（緯度變號、經度加減 180°），跟陸地相交的部分是「陸地對陸地」，其餘是「對面是海」；
  地圖上畫成半透明的面，外框是翻過去的海岸線與國界（topojson 的 arc，每條國界只畫一次）。在 ±180° 切開的邊與南極洲
  沿極點的邊翻過去以後不是真的海岸線，不畫。每個國家另外存一份翻過去的形狀，側欄標出那一國時才畫。
- 各國的對蹠點落在哪裡：全球等面積的取樣網格（每 SPACING_KM 公里一點，每一列的點數依緯度的餘弦，取偶數），網格對地心
  對稱，每個點的對蹠點也是網格上的一點，所以每個點只要判斷一次在哪一國（geoindex，Natural Earth 1:10m，跟其他主題判斷
  位置的同一份）或哪一片海（Marine Regions 的 IHO Sea Areas 第 3 版，CC BY 4.0，河流主題的同一份網格）。面積小、
  網格取不到幾個點的國家，在自己的範圍裡另外用細的網格取樣（SMALL_SAMPLES）。
- 首都：國家小檔案的 Wikidata 首都（晝夜與季節主題輸出的 capitals.json，所以要先跑 daylight），算對蹠點在哪一國或哪一片海、
  離最近的陸地多遠（Natural Earth 1:10m 的國界頂點）、最近的城鎮（Natural Earth 1:10m populated places，公有領域）。
- 前端滑到地圖上任何一點時，對蹠點在陸地上的用地圖的國界在瀏覽器裡判斷，在海上的查 seas.json（0.25° 的海域網格，
  逐列的連續長度編碼；陸地的格子填最近的海，南極洲的陸地另外一類）。
"""
from __future__ import annotations

import json
import math
from collections import defaultdict

import numpy as np

import geoindex
from common import OUT_DIR, download, indicator_file, lines_file, now_iso, write_json
from sources import sea_areas
from topics import rivers
from topics.travel import POPULATED_PLACES_URL

OUT = OUT_DIR / "topics" / "antipodes"
YEAR = 2026  # 資料不隨時間變化（國界是 Natural Earth 4.1.0），只是指標檔要有一個年份
R_KM = 6371.0088

# ── 取樣網格 ───────────────────────────────────────────────────
SPACING_KM = 3.0  # 等面積網格的間距：全球約 5,700 萬點，台灣約 4,000 點
SMALL_SAMPLES = 2500  # 網格取到的點比這個少的國家，在自己的範圍裡另外取樣到約這麼多點
ROW_CHUNK = 400  # 一次判斷幾列

# ── 對蹠點落在哪裡的大類（seas.json 每片海的大洋代碼；大洋的代碼跟河流主題一樣） ──
PACIFIC, ATLANTIC, INDIAN, ARCTIC, SOUTHERN = rivers.PACIFIC, rivers.ATLANTIC, rivers.INDIAN, rivers.ARCTIC, rivers.SOUTHERN
LAND = 7  # 陸地（所有國家合起來）
INLAND = 8  # 內陸的水域（裏海：不在任何國家、也不在 IHO 的海裡）
WHERE_ZH = {PACIFIC: "太平洋", ATLANTIC: "大西洋", INDIAN: "印度洋", ARCTIC: "北冰洋", SOUTHERN: "南冰洋", LAND: "陸地", INLAND: "裏海"}

# IHO 的大洋本身（河流主題的 SEAS 寫 None）的名稱
OPEN_OCEANS = {
    "North Pacific Ocean": ("北太平洋", "North Pacific Ocean"),
    "South Pacific Ocean": ("南太平洋", "South Pacific Ocean"),
    "North Atlantic Ocean": ("北大西洋", "North Atlantic Ocean"),
    "South Atlantic Ocean": ("南大西洋", "South Atlantic Ocean"),
    "Indian Ocean": ("印度洋", "Indian Ocean"),
    "Southern Ocean": ("南冰洋", "Southern Ocean"),
    "Arctic Ocean": ("北冰洋", "Arctic Ocean"),
}
# 不在任何國家、也不在 IHO 海域裡，離 IHO 的海又超過這麼遠的水面是內陸的（裏海）
INLAND_KM = 100
CASPIAN = ("裏海", "Caspian Sea")
ANTARCTICA = ("南極洲", "Antarctica")

# ── 地圖上的面與線 ─────────────────────────────────────────────
QUANTUM = 0.01
SIMPLIFY = 0.012  # 國界的 arc 用 Douglas–Peucker 簡化的容許誤差（度，約 1.3 km）
# 線的分類（前端的 color.classes）：1 對面是海的部分、2 陸地對陸地（面）；3 翻過去的海岸線、4 翻過去的國界（線）；
# 5 每個國家翻過去的形狀（面，只在側欄標出那一國時畫，外框由前端從同一個環畫出）
SEA_PART, LAND_PART, COAST, BORDER, OUTLINE = 1, 2, 3, 4, 5
NO_GROUP = -2  # 海岸線、國界不屬於任何一組（前端的「沒有滑到」是 -1）
MIN_PIECE_DEG2 = 2e-4  # 比這個小的碎塊（約 2 km²）不畫

# ── 前端查海名的網格 ───────────────────────────────────────────
LOOKUP_RES = 0.25

# 最近的城鎮的中文名稱：Natural Earth 的 NAME_ZHT 裡還有的簡體字（nobel.S2T 沒有的），與名稱本身不對的（依英文名）
PLACE_S2T = str.maketrans("县务琼", "縣務瓊")
PLACE_FIXES = {"Port Hedland": "黑德蘭港", "Broome": "布魯姆"}

# 抽查（spot_checks）
SPOT = ["TWN", "ESP", "PRT", "NZL", "ARG", "CHL", "CHN", "MNG", "USA", "PRY", "BWA", "AUS", "RUS", "IDN"]


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    from shapely.ops import unary_union

    arcs, used, topology = simplified_topology()
    polygons_by_country = country_polygons(arcs, topology)
    shapes = country_shapes(polygons_by_country)
    group = {iso3: i for i, iso3 in enumerate(sorted(shapes))}
    land = unary_union(list(shapes.values()))
    footprints = write_overlay(shapes, land, group, arcs, used, polygons_by_country)

    seas = sea_table()
    shares = sample_shares(seas)
    capitals = capital_antipodes(seas)
    write_lookup(seas)

    write_indicators(shares, seas, capitals)
    write_panel(shares, seas, capitals, group, footprints)
    write_json(OUT / "manifest.json", {
        "topic": "antipodes",
        "generatedAt": now_iso(),
        "source": "Natural Earth 1:50m and 1:10m admin-0 countries, 1:10m populated places (public domain); "
        "Marine Regions IHO Sea Areas v3 and Global Oceans and Seas v1 (CC BY 4.0); Wikidata capitals (CC0)",
        "license": "Natural Earth: public domain; Marine Regions: CC BY 4.0",
    })
    spot_checks(shares, seas, capitals)


# ── 國家的形狀（平面的經緯度，在 ±180° 以內） ─────────────────────


def _planar_ring(ring: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """繞極點的環（南極洲）：拿掉沿極點的頂點、展開成連續的經度，再沿 ±90° 封起來，變成平面上的多邊形"""
    pole = max((y for _x, y in ring), key=abs)
    pts = [(x, y) for x, y in ring if abs(y) < 89.99]
    out = [pts[0]]
    for x, y in pts[1:]:
        x += 360 * round((out[-1][0] - x) / 360)
        out.append((x, y))
    sign = 1 if pole > 0 else -1
    return out + [(out[-1][0], 90 * sign), (out[0][0], 90 * sign), out[0]]


def simplified_topology() -> tuple[list[list[tuple[float, float]]], list[int], list[tuple[str, list[list[list[int]]]]]]:
    """地圖的 topojson（1:50m）：每條 arc 用 Douglas–Peucker 簡化（SIMPLIFY，兩端不動，相鄰的國家共用同一條 arc，
    簡化後國界仍然接得起來）。回傳 (arcs, 每條 arc 被幾個國家用到, [(iso3, 多邊形的 arc 編號)])"""
    from shapely.geometry import LineString

    with open(OUT_DIR / "geo" / "countries-50m.json", encoding="utf-8") as f:
        topo = json.load(f)
    (sx, sy), (tx, ty) = topo["transform"]["scale"], topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            px = x * sx + tx
            if pts:  # 跨過 ±180° 的 arc 先展開成連續的經度再簡化
                px += 360 * round((pts[-1][0] - px) / 360)
            pts.append((px, y * sy + ty))
        if len(pts) > 2:
            simple = list(LineString(pts).simplify(SIMPLIFY, preserve_topology=False).coords)
            pts = simple if len(simple) >= 2 else [pts[0], pts[-1]]
        arcs.append([(((px + 180) % 360) - 180 if abs(px) > 180 else px, py) for px, py in pts])
    used = [0] * len(arcs)

    def walk(node):
        if isinstance(node, int):
            used[node if node >= 0 else ~node] += 1
        else:
            for child in node:
                walk(child)

    countries = []
    for geom in topo["objects"]["countries"]["geometries"]:
        walk(geom["arcs"])
        countries.append((geom["id"], [geom["arcs"]] if geom["type"] == "Polygon" else geom["arcs"]))
    return arcs, used, countries


def country_polygons(arcs, countries) -> list[tuple[str, list[list[list[tuple[float, float]]]]]]:
    """每個國家的多邊形（[外環, 洞…]，原始的經度，跟 geoindex._polygons() 同一種格式），由簡化過的 arc 接成"""
    def ring(ids: list[int]) -> list[tuple[float, float]]:
        pts: list[tuple[float, float]] = []
        for i in ids:
            arc = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts.extend(arc if not pts else arc[1:])
        return pts

    return [(iso3, [[ring(r) for r in polygon] for polygon in polygons]) for iso3, polygons in countries]


def country_shapes(polygons_by_country) -> dict:
    """{iso3: shapely 的（多）多邊形}，平面的經緯度、在 ±180° 以內：跨過 ±180° 的展開成連續的經度後切成兩邊，
    繞極點的南極洲沿 −90° 封起來"""
    from shapely.affinity import translate
    from shapely.geometry import Polygon, box
    from shapely.ops import unary_union
    from shapely.validation import make_valid

    world = box(-180, -90, 180, 90)
    out = {}
    for iso3, polygons in polygons_by_country:
        parts = []
        for polygon in polygons:
            # _unwrap() 展開後頭尾接不起來時回傳原本的環：繞極點的環。world-atlas 的南極洲（給 D3 的球面幾何用）是
            # 外環沿著 −89.999° 繞一圈、海岸線是「洞」；平面上改成海岸線沿 −90° 封起來的外環，只在極點的環不要
            normal = [r for r in polygon if len(r) >= 4 and geoindex._unwrap(r) is not r]
            polar = [r for r in polygon if len(r) >= 4 and geoindex._unwrap(r) is r and min(abs(y) for _x, y in r) < 89.99]
            if len(polar) > 1:
                raise ValueError(f"{iso3} 有好幾個繞極點的環")
            rings = ([_planar_ring(polar[0])] if polar else []) + [geoindex._unwrap(r) for r in normal]
            if not rings:
                continue
            poly = make_valid(Polygon(rings[0], rings[1:]))
            for dx in (0, 360, -360):
                piece = (translate(poly, dx) if dx else poly).intersection(world)
                if not piece.is_empty:
                    parts.append(piece)
        if parts:
            out[iso3] = make_valid(unary_union(parts))
    return out


def flip(geom):
    """對蹠點：緯度變號、經度加減 180°。先在 0° 經線切開，西半邊加 180°、東半邊減 180°，結果仍在 ±180° 以內"""
    from shapely.affinity import affine_transform
    from shapely.geometry import box
    from shapely.ops import unary_union

    west = geom.intersection(box(-180, -90, 0, 90))
    east = geom.intersection(box(0, -90, 180, 90))
    return unary_union([affine_transform(west, [1, 0, 0, -1, 180, 0]), affine_transform(east, [1, 0, 0, -1, -180, 0])])


def flip_point(lon: float, lat: float) -> tuple[float, float]:
    return (lon - 180 if lon > 0 else lon + 180), -lat


# ── 地圖上的面與線 ─────────────────────────────────────────────


def _polygons(geom):
    from shapely.geometry import MultiPolygon, Polygon

    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    return [g for part in getattr(geom, "geoms", []) for g in _polygons(part)]


def _quantized_ring(coords) -> list[tuple[float, float]] | None:
    """量化後還是一個環（至少 3 個不同的點）才留"""
    q = []
    for x, y in coords:
        p = (round(x / QUANTUM), round(y / QUANTUM))
        if not q or q[-1] != p:
            q.append(p)
    if len(q) > 1 and q[0] == q[-1]:
        q.pop()
    if len(set(q)) < 3:
        return None
    return [(x * QUANTUM, y * QUANTUM) for x, y in q] + [(q[0][0] * QUANTUM, q[0][1] * QUANTUM)]


def _split_artificial(points: list[tuple[float, float]]) -> list[list[tuple[float, float]]]:
    """在不是真的海岸線或國界的邊切開：在 ±180° 經線上切開的邊（兩端都在同一條 ±180°）、沿極點的邊；
    每一段展開成連續的經度"""
    runs: list[list[tuple[float, float]]] = []
    run: list[tuple[float, float]] = []
    for k, (x, y) in enumerate(points):
        if abs(y) > 89.99:
            if len(run) >= 2:
                runs.append(run)
            run = []
            continue
        if run and k > 0:
            px, _py = points[k - 1]
            if abs(px) > 179.999 and abs(x) > 179.999 and px * x > 0:
                if len(run) >= 2:
                    runs.append(run)
                run = []
        if run:
            x += 360 * round((run[-1][0] - x) / 360)
        run.append((x, y))
    if len(run) >= 2:
        runs.append(run)
    return runs


def _flipped_line(run: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """翻到對蹠點的線（經度連續，可以超過 ±180°；第一個點在 ±180° 以內）"""
    shift = 180 if run[0][0] <= 0 else -180
    return [(x + shift, -y) for x, y in run]


def write_overlay(shapes: dict, land, group: dict[str, int], arcs, used, polygons_by_country) -> dict[str, list[float]]:
    """flipped.json：翻到對蹠點的陸地（面：對面是海、陸地對陸地，含洞），翻過去的海岸線與國界（topojson 的 arc，
    國界只畫一次），每個國家翻過去的形狀與外框（只在滑過、側欄標出那一國時畫）。回傳每個國家對蹠的範圍 [西, 南, 東, 北]"""
    from shapely.geometry.polygon import orient

    lines: list[list[tuple[float, float]]] = []
    types: list[int] = []
    records: list[dict] = []

    def add(line, t, g, p=0, h=0):
        lines.append(line)
        types.append(t)
        records.append({"g": g, "p": p, "h": h})

    def add_polygons(geom, t, g) -> int:
        n = 0
        for poly in _polygons(geom):
            if poly.area < MIN_PIECE_DEG2:
                continue
            poly = orient(poly, sign=1.0)  # 外環逆時針、洞順時針
            outer = _quantized_ring(poly.exterior.coords)
            if outer is None:
                continue
            add(outer, t, g, p=1)
            for hole in poly.interiors:
                ring = _quantized_ring(hole.coords)
                if ring is not None:
                    add(ring, t, g, p=1, h=1)
            n += 1
        return n

    # 整片陸地翻過去：跟陸地相交的是「陸地對陸地」，其餘是「對面是海」（面，不分國家，不畫外框）
    flipped = flip(land)
    both = flipped.intersection(land)
    n_land = add_polygons(both, LAND_PART, NO_GROUP)
    n_sea = add_polygons(flipped.difference(land), SEA_PART, NO_GROUP)
    print(f"  陸地對陸地 {n_land:,} 塊、對面是海 {n_sea:,} 塊；陸地對陸地占陸地（平面的度²，只是概略）"
          f"{both.area / land.area:.1%}")

    # 翻過去的海岸線與國界：topojson 的 arc，國界只畫一次
    for arc, n in zip(arcs, used):
        if n == 0:
            continue
        for run in _split_artificial(arc):
            add(_flipped_line(run), COAST if n == 1 else BORDER, NO_GROUP)

    # 每個國家翻過去的形狀：平常不畫（前端的 onlyTypes），側欄標出那一國時畫成較深的面，外框由前端從同一個環畫出。
    # 直接把原本的環展開成連續的經度再翻過去（可以超過 ±180°，不在 ±180° 切開，外框才沒有假的邊）；南極洲不能選，不放
    from shapely.geometry import Polygon
    from shapely.validation import make_valid

    footprints: dict[str, list[float]] = {}
    for iso3, polygons in polygons_by_country:
        if iso3 not in group or iso3 == "ATA":
            continue
        for polygon in polygons:
            rings = [geoindex._unwrap(r) for r in polygon if len(r) >= 4]
            if not rings:
                continue
            outer = _flipped_line(rings[0])
            shift = outer[0][0] - rings[0][0][0]
            center = sum(x for x, _y in outer) / len(outer)
            holes = []
            for r in rings[1:]:  # 洞跟外環用同一個平移（再對齊到外環那一圈的經度）
                hole = [(x + shift, -y) for x, y in r]
                k = 360 * round((center - sum(x for x, _y in hole) / len(hole)) / 360)
                holes.append([(x + k, y) for x, y in hole])
            poly = make_valid(Polygon(outer, holes))
            add_polygons(poly, OUTLINE, group[iso3])
        footprints[iso3] = _footprint_box(shapes[iso3])

    data = lines_file(
        lines, QUANTUM, types,
        records=records, record_fields=["g", "p", "h"], record_scale={"g": 1, "p": 1, "h": 1},
    )
    write_json(OUT / "flipped.json", data)
    vertices = sum(len(l) // 2 for l in data["lines"])
    print(f"  flipped.json：{len(data['lines']):,} 條線、{vertices:,} 個頂點")
    return footprints


def _footprint_box(geom) -> list[float]:
    """對蹠的範圍：國家最大那一塊（加上離它不遠的）翻過去的經緯度範圍，經度連續（東可以超過 180°）"""
    polys = sorted(_polygons(geom), key=lambda p: -p.area)
    if not polys:
        return [0, 0, 0, 0]
    main = polys[0]
    x0, y0, x1, y1 = main.bounds
    for p in polys[1:]:
        a, b, c, d = p.bounds
        # 離主體不到它大小一半的島一起框（日本的四島、紐西蘭的南北島）
        pad = 0.5 * max(x1 - x0, y1 - y0)
        if a >= x0 - pad and c <= x1 + pad and b >= y0 - pad and d <= y1 + pad:
            x0, y0, x1, y1 = min(x0, a), min(y0, b), max(x1, c), max(y1, d)
    if x1 - x0 > 300:  # 跨過 ±180° 的國家（俄羅斯、斐濟）：框住全部
        x0, x1 = -180, 180
    shift = 180 if (x0 + x1) / 2 <= 0 else -180
    return [round(x0 + shift, 2), round(-y1, 2), round(x1 + shift, 2), round(-y0, 2)]


# ── 海域 ───────────────────────────────────────────────────────


class SeaTable:
    """所有可能的「海」：IHO 的 101 片海（網格的標籤 1–101 → 索引 0–100），加上台灣海峽、裏海、南極洲（陸地，但地圖不畫）"""

    def __init__(self) -> None:
        iho, names, _goas, _goas_names = sea_areas.rasters()
        self.grid = iho
        self.iho_names = names
        ocean = rivers.ocean_of_seas()
        self.names: list[tuple[str, str]] = []
        self.ocean: list[int] = []
        for name in names:
            label = rivers.SEAS[name] or OPEN_OCEANS.get(name)
            if label is None:
                raise ValueError(f"IHO 海域 {name} 沒有名稱")
            self.names.append(label)
            self.ocean.append(ocean[name])
        self.south_china_sea = names.index("South China Sea")
        self.taiwan_strait = self._add(rivers.TAIWAN_STRAIT[0], PACIFIC)
        self.caspian = self._add(CASPIAN, INLAND)
        self.antarctica = self._add(ANTARCTICA, LAND)

    def _nearest(self, lons: np.ndarray, lats: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """最近的靠岸海格子（sea_areas.nearest_sea() 的作法，KD 樹只建一次）：(網格的標籤, 距離 km)"""
        if not hasattr(self, "_coast"):
            from scipy import ndimage
            from scipy.spatial import cKDTree

            res = sea_areas.RES
            sea = self.grid > 0
            coast = sea & ndimage.binary_dilation(~sea, structure=np.ones((3, 3), bool))
            r, c = np.nonzero(coast)
            self._coast = (cKDTree(_xyz((c + 0.5) * res - 180, 90 - (r + 0.5) * res)), self.grid[r, c])
        tree, values = self._coast
        d, k = tree.query(_xyz(lons, lats))
        return values[k].astype(np.int64), _chord_km(d)

    def _add(self, label: tuple[str, str], ocean: int) -> int:
        self.names.append(label)
        self.ocean.append(ocean)
        return len(self.names) - 1

    def labels(self, lons: np.ndarray, lats: np.ndarray, land: np.ndarray | None = None) -> np.ndarray:
        """每個點的海（索引）：IHO 海域的網格；不在網格裡的找最近的海，離 IHO 的海超過 INLAND_KM 的是裏海。
        台灣海峽：IHO 的南海裡、鵝鑾鼻到南澳島連線以北（河流主題的規則）"""
        res = sea_areas.RES
        col = np.clip(((lons + 180) / res).astype(np.int64), 0, sea_areas.W - 1)
        row = np.clip(((90 - lats) / res).astype(np.int64), 0, sea_areas.H - 1)
        label = self.grid[row, col].astype(np.int64)
        miss = np.nonzero(label == 0)[0]
        if len(miss):
            near, dist = self._nearest(lons[miss], lats[miss])
            inland = dist > INLAND_KM
            if land is not None:
                inland &= ~land[miss]  # 陸地的格子（前端查海名的網格）一律填最近的海
            label[miss] = np.where(inland, 0, near)
            out = label - 1
            out[miss[inland]] = self.caspian
        else:
            out = label - 1
        (_n, (ax, ay), (bx, by)) = rivers.TAIWAN_STRAIT
        north = (bx - ax) * (lats - ay) - (by - ay) * (lons - ax) > 0  # 鵝鑾鼻—南澳島連線的北邊（左側）
        out[(out == self.south_china_sea) & north] = self.taiwan_strait
        return out


def sea_table() -> SeaTable:
    return SeaTable()


# ── 取樣 ───────────────────────────────────────────────────────


class Codes:
    """國家代碼 ↔ 編號（geoindex 1:10m 的單位，含南極洲）；只算陸地（海上是 −1）"""

    def __init__(self) -> None:
        index = geoindex._index()
        self.index = index
        self.iso = list(index.codes)
        self.of = {c: i for i, c in enumerate(self.iso)}

    def at(self, x: np.ndarray, y: np.ndarray) -> np.ndarray:
        found = self.index.lookup(x, y, nearest=False)
        # 跟 geoindex.countries_at 一樣套用國界河的修正（ISLANDS 的矩形含海面，取樣不用：
        # 澎湖、金門、蘭嶼、綠島 1:10m 本來就有，只少了馬祖、烏坵、東沙幾個小島）
        for boxes, rule, _why in geoindex.BORDER_FIXES.values():
            inside = np.zeros(len(x), dtype=bool)
            for x0, y0, x1, y1 in boxes:
                inside |= (x >= x0) & (x <= x1) & (y >= y0) & (y <= y1)
            hit = np.nonzero(inside)[0]
            if not len(hit):
                continue
            if rule.startswith("50m:"):
                iso3 = rule[4:]
                hit = hit[geoindex._in_fifty_m(iso3, x[hit], y[hit])]
            else:
                iso3 = rule
            found[hit] = self.of[iso3]
        return found


def _rows(spacing_km: float):
    """等面積網格的列：(緯度, 這一列的點數（偶數）, 每一點代表的面積 km²)；第 i 列跟倒數第 i 列對赤道對稱、點數相同"""
    n_rows = 2 * round(90 / (spacing_km / (math.pi * R_KM / 180)))
    dlat = 180 / n_rows
    half = []
    for i in range(n_rows // 2):
        lat0 = -90 + i * dlat
        lat = lat0 + dlat / 2
        n = max(2, 2 * round(180 * math.cos(math.radians(lat)) / dlat))
        band = 2 * math.pi * R_KM**2 * (math.sin(math.radians(lat0 + dlat)) - math.sin(math.radians(lat0)))
        half.append((lat, n, band / n))
    return half + [(-lat, n, a) for lat, n, a in reversed(half)]


def sample_shares(seas: SeaTable) -> dict:
    """{iso3: {目標: 面積 km²}}：目標是國家代碼，或海的索引（整數）。等面積網格對地心對稱，每一點的對蹠點也是網格上的點"""
    codes = Codes()
    rows = _rows(SPACING_KM)
    print(f"  取樣網格：每 {SPACING_KM:g} km 一點，{len(rows):,} 列、{sum(n for _l, n, _a in rows):,} 點")
    country: list[np.ndarray] = []
    sea: list[np.ndarray] = []
    for start in range(0, len(rows), ROW_CHUNK):
        chunk = rows[start:start + ROW_CHUNK]
        lons = np.concatenate([-180 + (np.arange(n) + 0.5) * (360 / n) for _lat, n, _a in chunk])
        lats = np.concatenate([np.full(n, lat) for lat, n, _a in chunk])
        c = codes.at(lons, lats)
        s = np.full(len(c), -1, dtype=np.int64)
        water = np.nonzero(c < 0)[0]
        if len(water):
            s[water] = seas.labels(lons[water], lats[water])
        k = 0
        for _lat, n, _a in chunk:
            country.append(c[k:k + n].astype(np.int16))
            sea.append(s[k:k + n].astype(np.int16))
            k += n
    nc = len(codes.iso)
    nt = nc + len(seas.names)
    totals = np.zeros((nc, nt))
    samples = np.zeros(nc, dtype=np.int64)
    for i, (_lat, n, a) in enumerate(rows):
        j = len(rows) - 1 - i
        src = country[i]
        on = np.nonzero(src >= 0)[0]
        if not len(on):
            continue
        anti = (on + n // 2) % n
        target = np.where(country[j][anti] >= 0, country[j][anti], nc + sea[j][anti]).astype(np.int64)
        totals += np.bincount(src[on].astype(np.int64) * nt + target, minlength=nc * nt).reshape(nc, nt) * a
        samples += np.bincount(src[on], minlength=nc)
    if (totals[:, nc:].sum(axis=0)[[seas.antarctica]] > 0).any():
        raise ValueError("南極洲的陸地應該由國家代碼 ATA 算到，不會落在「海」")

    small = [i for i in range(nc) if samples[i] < SMALL_SAMPLES]
    print(f"  網格取到的點不到 {SMALL_SAMPLES:,} 個、另外細取樣的國家：{len(small)} 個")
    for i in small:
        dense = _dense_targets(codes, seas, i, nc)
        if dense is not None:
            totals[i] = dense
    out = {}
    for i, iso3 in enumerate(codes.iso):
        row = totals[i]
        if row.sum() <= 0:
            continue
        out[iso3] = {(codes.iso[t] if t < nc else int(t - nc)): float(row[t]) for t in np.nonzero(row)[0]}
    return out


def _dense_targets(codes: Codes, seas: SeaTable, ci: int, nc: int) -> np.ndarray | None:
    """小國：在 1:10m 的範圍裡用細的網格取樣（經緯度網格，面積依緯度的餘弦加權），每一點的對蹠點各自判斷"""
    iso3 = codes.iso[ci]
    boxes = [_ring_box(polygon[0]) for c, polygons in geoindex._countries() if c == iso3 for polygon in polygons]
    if not boxes:
        return None
    total_deg2 = sum(max(b[2] - b[0], 1e-4) * max(b[3] - b[1], 1e-4) for b in boxes)
    step = math.sqrt(total_deg2 / SMALL_SAMPLES)
    # 範圍內的點不夠就把格子再切細（環礁、小島的範圍大多是海）；所有範圍用同一套格點（同一個點只算一次）
    for _ in range(12):
        cells = set()
        for x0, y0, x1, y1 in boxes:
            ix = np.arange(math.floor(x0 / step), math.ceil(x1 / step) + 1)
            iy = np.arange(math.floor(y0 / step), math.ceil(y1 / step) + 1)
            if len(ix) * len(iy) > 4_000_000:
                continue
            gx, gy = np.meshgrid(ix, iy)
            cells.update(zip(gx.ravel().tolist(), gy.ravel().tolist()))
        if not cells:
            step *= 2
            continue
        cell = np.array(sorted(cells), dtype=np.int64)
        lons = ((cell[:, 0] + 0.5) * step + 180) % 360 - 180
        lats = (cell[:, 1] + 0.5) * step
        inside = codes.at(lons, lats) == ci
        if inside.sum() >= SMALL_SAMPLES // 2 or step < 2e-4:
            break
        step /= 2
    if not inside.any():
        return None
    lons, lats = lons[inside], lats[inside]
    weight = np.cos(np.radians(lats)) * (step * math.pi / 180 * R_KM) ** 2
    alon = np.where(lons > 0, lons - 180, lons + 180)
    alat = -lats
    c = codes.at(alon, alat)
    target = np.where(c >= 0, c, -1).astype(np.int64)
    water = np.nonzero(c < 0)[0]
    if len(water):
        target[water] = nc + seas.labels(alon[water], alat[water])
    return np.bincount(target, weights=weight, minlength=nc + len(seas.names))


def _ring_box(ring) -> tuple[float, float, float, float]:
    xs = [x for x, _y in ring]
    ys = [y for _x, y in ring]
    return min(xs), min(ys), max(xs), max(ys)


# ── 首都 ───────────────────────────────────────────────────────


def _xyz(lon, lat):
    lon, lat = np.radians(np.asarray(lon, float)), np.radians(np.asarray(lat, float))
    return np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)], axis=-1)


def _chord_km(d):
    return 2 * np.arcsin(np.clip(np.asarray(d) / 2, 0, 1)) * R_KM


def _places() -> list[dict]:
    """Natural Earth 1:10m populated places（公有領域）：名稱（中文用 NAME_ZHT，有些其實是簡體，再用 S2T 轉一次）、經緯度"""
    from sources.nobel import S2T

    path = download(POPULATED_PLACES_URL, "natural-earth", "ne_10m_populated_places.geojson")
    with open(path, encoding="utf-8") as f:
        features = json.load(f)["features"]
    out = []
    for feat in features:
        p = feat["properties"]
        zh = PLACE_FIXES.get(p["NAME"]) or (p.get("NAME_ZHT") or p.get("NAME_ZH") or p["NAME"]).translate(S2T).translate(PLACE_S2T)
        out.append({"en": p["NAME"], "zh": zh, "lon": float(p["LONGITUDE"]), "lat": float(p["LATITUDE"]), "pop": p.get("POP_MAX") or 0})
    return out


def capital_antipodes(seas: SeaTable) -> dict[str, dict]:
    """每個首都的對蹠點：在哪一國（或哪一片海）、離最近的陸地多遠、最近的城鎮"""
    from scipy.spatial import cKDTree

    with open(OUT_DIR / "topics" / "daylight" / "capitals.json", encoding="utf-8") as f:
        capitals = json.load(f)["capitals"]
    codes = Codes()
    # 陸地的外環頂點（1:10m），算離最近的陸地多遠與那是哪一國
    vx, vy, vc = [], [], []
    for iso3, polygons in geoindex._countries():
        for polygon in polygons:
            for x, y in polygon[0]:
                if -180 <= x <= 180:
                    vx.append(x)
                    vy.append(y)
                    vc.append(iso3)
    coast = cKDTree(_xyz(vx, vy))
    places = _places()
    place_tree = cKDTree(_xyz([p["lon"] for p in places], [p["lat"] for p in places]))
    place_iso = geoindex.countries_at([p["lon"] for p in places], [p["lat"] for p in places])

    out = {}
    for iso3, (lat, lon, _zone, _std, zh, en, kind) in capitals.items():
        alon, alat = flip_point(lon, lat)
        x, y = np.array([alon]), np.array([alat])
        c = int(codes.at(x, y)[0])
        rec: dict[str, object] = {"zh": zh, "en": en, "kind": kind, "lat": lat, "lon": lon, "alat": round(alat, 2), "alon": round(alon, 2)}
        if c >= 0:
            rec["at"] = codes.iso[c]
            rec["km"] = 0
            # 對蹠點離另一國的國界多遠（抽查用：太靠近國界時，1:10m 的誤差可能讓它落到隔壁）
            d, k = coast.query(_xyz(alon, alat), k=64)
            other = [_chord_km(dd) for dd, kk in zip(d, k) if vc[kk] != codes.iso[c]]
            rec["border"] = round(float(other[0]), 1) if other else None
        else:
            rec["at"] = int(seas.labels(x, y)[0])
            d, k = coast.query(_xyz(alon, alat))
            rec["km"] = round(float(_chord_km(d)))
            rec["near"] = vc[k]
        d, k = place_tree.query(_xyz(alon, alat))
        p = places[k]
        rec["place"] = {"zh": p["zh"], "en": p["en"], "iso3": place_iso[k], "km": round(float(_chord_km(d)), 1)}
        out[iso3] = rec
    return out


# ── 前端查海名的網格 ───────────────────────────────────────────


def write_lookup(seas: SeaTable) -> None:
    """seas.json：0.25° 網格每一格的海（索引），逐列的連續長度編碼 [值, 長度, 值, 長度…]；陸地填最近的海，南極洲的陸地另外一類"""
    w, h = round(360 / LOOKUP_RES), round(180 / LOOKUP_RES)
    lon = -180 + (np.arange(w) + 0.5) * LOOKUP_RES
    lat = 90 - (np.arange(h) + 0.5) * LOOKUP_RES
    gx, gy = np.meshgrid(lon, lat)
    x, y = gx.ravel(), gy.ravel()
    codes = Codes()
    c = codes.at(x, y)
    land = c >= 0
    label = seas.labels(x, y, land=land)
    label[c == codes.of["ATA"]] = seas.antarctica
    grid = label.reshape(h, w)
    rows = []
    for r in range(h):
        row = grid[r]
        cut = np.nonzero(np.diff(row))[0] + 1
        starts = np.concatenate([[0], cut])
        ends = np.concatenate([cut, [w]])
        rows.append([int(v) for s, e in zip(starts, ends) for v in (row[s], e - s)])
    write_json(OUT / "seas.json", {
        "res": LOOKUP_RES,
        # 每一片海：[中文, 英文, 大洋的代碼]（大洋的代碼見 WHERE_ZH；南極洲是陸地）
        "seas": [[zh, en, o] for (zh, en), o in zip(seas.names, seas.ocean)],
        "rows": rows,
    })


# ── 指標與側欄 ─────────────────────────────────────────────────


def _where(targets: dict, seas: SeaTable) -> dict[int, float]:
    """依大洋（或陸地）合計的面積"""
    out: dict[int, float] = defaultdict(float)
    for t, a in targets.items():
        out[LAND if isinstance(t, str) else seas.ocean[t]] += a
    return out


def write_indicators(shares: dict, seas: SeaTable, capitals: dict) -> None:
    land, capital = {}, {}
    counts = defaultdict(int)
    for iso3, targets in shares.items():
        total = sum(targets.values())
        where = _where(targets, seas)
        land[iso3] = [round(100 * where.get(LAND, 0) / total, 2)]
        counts[max(where, key=where.get)] += 1
    for iso3, rec in capitals.items():
        capital[iso3] = [rec["km"]]
    write_json(OUT / "land.json", indicator_file("land", "%", [YEAR], land))
    write_json(OUT / "capital.json", indicator_file("capital", "km", [YEAR], capital))
    # 「對蹠點主要落在哪裡」沒有做成類別圖：六成以上的國家是太平洋（見 DESIGN.md 第 8 節第 89 點）
    print("  對蹠點主要落在：" + "、".join(f"{WHERE_ZH[k]} {n}" for k, n in sorted(counts.items(), key=lambda kv: -kv[1])))
    zero = sum(1 for (v,) in land.values() if v == 0)
    print(f"  對蹠點都在海上的國家/地區：{zero}／{len(land)}")


TOP_TARGETS = 10


def write_panel(shares: dict, seas: SeaTable, capitals: dict, group: dict[str, int], footprints: dict) -> None:
    """panel.json：每個國家對蹠點落在哪些國家與海（占比，依面積由大到小，前 TOP_TARGETS 個，其餘併成「其他」）、
    首都的對蹠點、地圖上那一組的編號（flipped.json 的 g）與對蹠的範圍"""
    countries = {}
    for iso3 in sorted(set(shares) | set(capitals)):
        rec: dict[str, object] = {}
        if iso3 in footprints:
            rec["g"] = group[iso3]
            rec["box"] = footprints[iso3]
        targets = shares.get(iso3)
        if targets:
            total = sum(targets.values())
            ranked = sorted(targets.items(), key=lambda kv: -kv[1])
            top = [[t, round(100 * a / total, 2)] for t, a in ranked[:TOP_TARGETS] if 100 * a / total >= 0.05]
            rest = 100 - sum(s for _t, s in top)
            rec["targets"] = top
            if rest >= 0.05:
                rec["other"] = round(rest, 2)
            rec["km2"] = round(total)
        cap = capitals.get(iso3)
        if cap:
            rec["capital"] = cap
        countries[iso3] = rec
    write_json(OUT / "panel.json", {"countries": countries})


def spot_checks(shares: dict, seas: SeaTable, capitals: dict) -> None:
    def name(t):
        return t if isinstance(t, str) else seas.names[t][0]

    for iso3 in SPOT:
        targets = shares.get(iso3)
        if not targets:
            continue
        total = sum(targets.values())
        top = sorted(targets.items(), key=lambda kv: -kv[1])[:6]
        where = _where(targets, seas)
        cap = capitals.get(iso3)
        cap_text = ""
        if cap:
            at = name(cap["at"])
            extra = f"，離另一國的國界約 {cap['border']} km" if cap.get("border") is not None else f"，離最近的陸地（{cap.get('near')}）{cap['km']} km"
            cap_text = (f"；首都 {cap['zh']} 的對蹠點 {cap['alat']}, {cap['alon']} 在 {at}{extra}，"
                        f"最近的城鎮 {cap['place']['zh']}（{cap['place']['iso3']}）{cap['place']['km']} km")
        print(f"  {iso3}：陸地 {100 * where.get(LAND, 0) / total:.1f}%：" + "、".join(f"{name(t)} {100 * a / total:.1f}%" for t, a in top) + cap_text)
