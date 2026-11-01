"""放大後的國界（製作手冊第十六批 264，2026-11-01）：Natural Earth 1:10m Admin 0 → `public/pmtiles/countries-10m-<雜湊>.pmtiles`。

地圖的國家上色、外框、hover、點選在縮放 `FINE_ZOOM`（src/map/worldMapLayers.ts，5 級）以上改用這一份，
全球視角的 1:110m、中間的 1:50m（build_geo.py）照舊；3D 的立體國界、框選估算、網格歸國照舊用 1:50m。

- **來源**：Natural Earth 1:10m Admin 0 Countries 4.1.0（ne_10m_admin_0_countries，公有領域），geoindex.py 判斷
  位置用的同一份。用 4.1.0 不用 5.1.2：跟地圖的 1:50m（world-atlas 2.0.2 = Natural Earth 4.1.0）同一版，
  國家的劃分一樣（5.1.2 把東耶路撒冷畫進以色列，geoindex.py 的說明）。
- **國家代碼**：照 geoindex.ten_m_units()（名稱跟 1:50m 一樣的用 build_geo.unit_id()，1:10m 才有的照 TEN_M_ONLY），
  三種比例尺的代碼一致；同一個代碼的單位合併成一個（賽普勒斯與英屬基地區、哈薩克與拜科努爾、古巴與關達那摩），
  合併後中間不會多一條線。TEN_M_ONLY 寫 None 的（南沙群島、聯合國緩衝區、美國本土外小島嶼等）不畫，
  跟 1:50m 一樣不算任何國家。南極洲不畫（geometry.ts 的 HIDDEN）。
- **波赫東部**：4.1.0 版 1:10m 的波赫東界整段偏西，約 1.15 萬 km²（茲沃爾尼克、斯雷布雷尼察、維舍格勒、福查一帶）
  不屬於任何國家（geoindex.py 的 BORDER_FIXES「波赫東部」）。照 geoindex 的做法用 1:50m 補：在同一組範圍裡，
  1:50m 的波赫（外擴約 3 km，補上兩份國界的縫）扣掉 1:10m 其他國家的部分併進波赫，跟塞爾維亞、蒙特內哥羅的
  1:10m 國界貼齊。
- **跨 180° 經線**（俄羅斯的楚科奇與弗蘭格爾島、斐濟）：1:10m 在 ±180° 切開，切口在外框上會畫成一條直線。
  碰到 −180° 的那幾塊往東平移 360°、跟另一半合併（經度到約 190°）；tippecanoe 在第 0 級把超出世界邊緣的部分
  複製一份平移到另一邊（tile.cpp 的 clip_to_tile），兩邊的圖磚都有，切口落在圖磚的緩衝區外。
- **台灣**：1:10m 的台灣有本島、金門（跟 1:50m 一樣），另外多了澎湖（3 個島）、蘭嶼、綠島；馬祖、烏坵、東沙
  1:10m 也沒有形狀，跟 1:50m 一樣不畫（geoindex.py 的 ISLANDS 只用在判斷位置）。
- **屬性**：只留 `iso3`（前端的 promoteId，feature-state 跟 1:50m 的 countries 用同一個代碼）。
- **切圖**：pipeline/pmtiles.py 的 build()（tippecanoe，要在本機 session 跑），5–8 級，超過 8 級前端放大第 8 級
  （Natural Earth 1:10m 的細節在 8 級的圖磚精度約 40 m 以內，再切下去檔案變大、看不出差別）。
"""
from __future__ import annotations

import json
import math

from common import CACHE_DIR, OUT_DIR

NAME = "countries-10m"
LAYER = "countries"
# 前端從這一級開始換成 1:10m（src/map/worldMapLayers.ts 的 FINE_ZOOM），比它低的圖磚不切
MIN_ZOOM = 5
MAX_ZOOM = 8
GEOJSON = CACHE_DIR / "borders" / "countries-10m.geojson"
HIDDEN = {"ATA"}
# 波赫東部補 1:50m 時的外擴（度）：補上 1:50m 與 1:10m 國界之間的縫，又不碰到亞得里亞海（範圍南界 42.55°N）
BIH_FILL_BUFFER = 0.03


def _polygonal(geom):
    """只留面（make_valid、unary_union 可能留下線或點）"""
    from shapely.geometry import MultiPolygon

    if geom.geom_type in ("Polygon", "MultiPolygon"):
        return geom
    polygons = []
    for part in getattr(geom, "geoms", []):
        if part.geom_type == "Polygon":
            polygons.append(part)
        elif part.geom_type == "MultiPolygon":
            polygons.extend(part.geoms)
    return MultiPolygon(polygons)


def _shapes() -> dict[str, "object"]:
    """{iso3: shapely 幾何}，同一個代碼的 1:10m 單位合併"""
    from shapely import make_valid
    from shapely.geometry import shape
    from shapely.ops import unary_union

    from geoindex import _ten_m_features, ten_m_units

    parts: dict[str, list] = {}
    for feature, (_name, iso3) in zip(_ten_m_features(), ten_m_units()):
        if iso3 is None or iso3 in HIDDEN:
            continue
        parts.setdefault(iso3, []).append(make_valid(shape(feature["geometry"])))
    return {iso3: _polygonal(unary_union(geoms)) for iso3, geoms in parts.items()}


def _fix_bosnia(shapes: dict) -> float:
    """波赫東部：1:50m 補 4.1.0 版 1:10m 缺的那一塊（見模組說明）。回傳補上的面積（km²）"""
    from shapely import make_valid
    from shapely.geometry import Polygon, box
    from shapely.ops import unary_union

    from geoindex import BORDER_FIXES, land_polygons

    boxes, rule, _why = BORDER_FIXES["波赫東部"]
    assert rule == "50m:BIH", rule
    region = unary_union([box(*b) for b in boxes])
    fifty = unary_union(
        [make_valid(Polygon(p[0], p[1:])) for iso3, polygons in land_polygons() if iso3 == "BIH" for p in polygons]
    )
    others = unary_union([g for iso3, g in shapes.items() if iso3 != "BIH" and g.intersects(region.buffer(0.5))])
    fill = fifty.buffer(BIH_FILL_BUFFER).intersection(region).difference(others).difference(shapes["BIH"])
    # 只補跟 1:10m 波赫接在一起的部分：範圍西界（18.20°E）外的 1:50m 波赫被切下來的小塊（杜布羅夫尼克北邊約 1.7 km²）不要
    touching = shapes["BIH"].buffer(1e-6)
    fill = unary_union([g for g in getattr(fill, "geoms", [fill]) if g.intersects(touching)])
    shapes["BIH"] = _polygonal(make_valid(unary_union([shapes["BIH"], fill])))
    return fill.area * 111.32**2 * math.cos(math.radians(44))


def _fill_holes(shapes: dict) -> list[tuple[str, float]]:
    """被國家圍起來、不屬於任何國家的縫（波赫東部補完還剩的，4.1.0 版 1:10m 的國界沒有貼齊）：
    照 geoindex.country_at() 判斷那裡算哪一國（跟網站判斷位置的結果一致），併進那一國。
    geoindex 也判不出國家的（裏海）照舊留空。回傳 [(代碼, km²)]
    """
    from shapely import make_valid
    from shapely.geometry import Polygon
    from shapely.ops import unary_union

    from geoindex import country_at

    land = unary_union(list(shapes.values()))
    filled = []
    for polygon in getattr(land, "geoms", [land]):
        for ring in polygon.interiors:
            hole = Polygon(ring)
            km2 = hole.area * 111.32**2 * math.cos(math.radians(hole.centroid.y))
            if km2 < 0.01:
                continue
            point = hole.representative_point()
            iso3 = country_at(point.x, point.y)
            if iso3 is None:
                continue
            if iso3 not in shapes:
                raise ValueError(f"({point.x:.3f}, {point.y:.3f}) 的縫判成 {iso3}，1:10m 沒有這一國")
            shapes[iso3] = _polygonal(make_valid(unary_union([shapes[iso3], hole])))
            filled.append((iso3, km2))
    return sorted(filled, key=lambda x: -x[1])


def _unwrap_antimeridian(shapes: dict) -> list[str]:
    """碰到 −180° 的部分往東平移 360°，跟 +180° 那一半合併。回傳處理過的國家"""
    from shapely import make_valid
    from shapely.affinity import translate
    from shapely.ops import unary_union

    done = []
    for iso3, geom in shapes.items():
        polygons = list(getattr(geom, "geoms", [geom]))
        west = [p for p in polygons if p.bounds[0] <= -180 + 1e-9]
        east = [p for p in polygons if p.bounds[2] >= 180 - 1e-9]
        if not west or not east:
            continue
        rest = [p for p in polygons if p not in west]
        shapes[iso3] = _polygonal(make_valid(unary_union(rest + [translate(p, xoff=360) for p in west])))
        done.append(iso3)
    return sorted(done)


def _rounded(coords):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], 5), round(coords[1], 5)]
    return [_rounded(c) for c in coords]


def country_shapes(quiet: bool = False) -> dict:
    """{iso3: shapely 幾何}：1:10m 合併、補好波赫與國界之間的縫，還沒接起跨 180° 經線的部分
    （行政區界 divisions.py 也用這一份裁切，三份國界一致）"""
    shapes = _shapes()
    filled = _fix_bosnia(shapes)
    holes = _fill_holes(shapes)
    if not quiet:
        print(f"  波赫東部：用 1:50m 補上 {filled:,.0f} km²")
        print(f"  國界之間的縫：{'、'.join(f'{iso3} {km2:,.1f} km²' for iso3, km2 in holes)}")
    return shapes


def unwrap_antimeridian(shapes: dict) -> list[str]:
    """碰到 −180° 的部分往東平移 360°（俄羅斯、斐濟；行政區界也照同樣的規則）"""
    return _unwrap_antimeridian(shapes)


def build_geojson() -> None:
    from shapely.geometry import mapping

    shapes = country_shapes()
    print(f"  跨 180° 經線合併：{', '.join(_unwrap_antimeridian(shapes))}")
    known = set(json.loads((OUT_DIR / "countries.json").read_text(encoding="utf-8")))
    unknown = sorted(set(shapes) - known)
    if unknown:
        raise ValueError(f"這些代碼不在 countries.json：{unknown}")
    GEOJSON.parent.mkdir(parents=True, exist_ok=True)
    vertices = 0
    with open(GEOJSON, "w", encoding="utf-8", newline="\n") as f:
        # 一行一個 feature（GeoJSONSeq），tippecanoe 讀得比整份 FeatureCollection 快
        for iso3, geom in sorted(shapes.items()):
            g = mapping(geom)
            g = {"type": g["type"], "coordinates": _rounded(g["coordinates"])}
            vertices += sum(len(r) for poly in (g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]) for r in poly)
            f.write(json.dumps({"type": "Feature", "properties": {"iso3": iso3}, "geometry": g}, separators=(",", ":")) + "\n")
    print(f"  {len(shapes)} 個國家／地區，{vertices:,} 個頂點 → {GEOJSON.relative_to(CACHE_DIR.parent.parent)}（{GEOJSON.stat().st_size / 1e6:.1f} MB）")


def build() -> None:
    import pmtiles

    build_geojson()
    pmtiles.build(NAME, GEOJSON, LAYER, min_zoom=MIN_ZOOM, max_zoom=MAX_ZOOM, keep=["iso3"], polygons=True)
