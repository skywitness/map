"""板塊漂移主題：Merdith 等 2021 的全板塊重建模型（v1.2.4，Zenodo，CC BY 4.0），用 pyGPlates（GPL-2.0，只在建置時用，
網站不帶它）把今天的國界帶回 0–250 百萬年前（每 5 百萬年，使用者決定），加上那時的板塊邊界。

**國界**：人口主題的 country_shapes()（Natural Earth 1:50m）先簡化到 SIMPLIFY_DEG，再用模型的靜態多邊形
（shapes_static_polygons）切到各板塊上（shapely 在經緯度上切：pyGPlates 的 partition_into_plates 會把多邊形切成線段），
每一塊帶板塊編號與「存在的時間」（valid time：那塊地殼還沒形成的年代不畫）。每個時間點各自 reconstruct，
存 countries/<年份>.json（年份是負的百萬年，0 是今天）（線圖層的 fill：每一塊一個封閉的環）。types 是今天所在的大洲（Natural Earth 的 CONTINENT，
CONTINENTS 的索引），播放時看得出哪些陸地本來連在一起。

**板塊邊界**：250-0 與 410-250 兩個時期的 plate_bounds 加上 TopologyBuildingBlocks，resolve_topologies 後取共用的邊界段
（shared sub-segments，相鄰兩塊板塊只畫一次），依特徵類型分成隱沒帶、中洋脊與張裂、轉形斷層、其他（BOUNDARY_TYPES），
存 boundaries/<年份>.json。

**國家的值**（paleolat.json）：各國今天的國土（依面積加權的重心）在那時的緯度，給 tooltip、排名表與側欄的折線；
時間軸的年份是負的百萬年（−250 … 0），前端寫「2.5 億年前」。

約 1 分鐘。
"""
from __future__ import annotations

import zipfile
from collections import defaultdict

import numpy as np
from shapely.geometry import Polygon
from shapely.ops import unary_union

from common import CACHE_DIR, OUT_DIR, download, indicator_file, lines_file, now_iso, write_json

OUT = OUT_DIR / "topics" / "plates"
MODEL_URL = "https://zenodo.org/api/records/13635864/files/Merdith_etal_2021_ESR_v1.2.4.zip/content"
MODEL_DIR = CACHE_DIR / "merdith" / "v1.2.4"
TIMES = list(range(0, 251, 5))
SIMPLIFY_DEG = 0.4
MIN_AREA = 0.1  # 平方度：比這小的碎片（板塊邊界切出來的細條、小島）不畫
QUANTUM = 0.1
# src/topics/plates.ts 的 CONTINENTS、BOUNDARY_TYPES 要一致
CONTINENTS = ["Asia", "Europe", "Africa", "North America", "South America", "Oceania", "Antarctica"]
BOUNDARY_TYPES = {"SubductionZone": 0, "MidOceanRidge": 1, "ContinentalRift": 1, "Transform": 2}
OTHER_BOUNDARY = 3


def model() -> dict:
    import pygplates

    path = download(MODEL_URL, "merdith", "Merdith_etal_2021_ESR_v1.2.4.zip")
    if not (MODEL_DIR / "Rotations").exists():
        with zipfile.ZipFile(path) as z:
            z.extractall(MODEL_DIR)
    return {
        "rotation": pygplates.RotationModel(str(MODEL_DIR / "Rotations" / "1000_0_rotfile_Merdith_etal.rot")),
        "static": pygplates.FeatureCollection(str(MODEL_DIR / "StaticPolygons" / "shapes_static_polygons_Merdith_etal.gpml")),
        "topologies": [
            pygplates.FeatureCollection(str(MODEL_DIR / "Topologies" / name))
            for name in ("250-0_plate_bounds_Merdith_etal.gpml", "410-250_plate_bounds_Merdith_etal.gpml",
                         "TopologyBuildingBlocks_Merdith_etal.gpml")
        ],
    }


def continents() -> dict[str, int]:
    import geoindex

    out = {}
    for f in geoindex._ten_m_features():
        p = f["properties"]
        code = p.get("ADM0_A3")
        if p.get("CONTINENT") in CONTINENTS:
            out[code] = CONTINENTS.index(p["CONTINENT"])
        elif p.get("CONTINENT") == "Seven seas (open ocean)":
            out[code] = CONTINENTS.index("Africa") if (p.get("REGION_UN") == "Africa") else CONTINENTS.index("Oceania")
    return out


def static_plates(m: dict) -> list[tuple[int, tuple[float, float], Polygon]]:
    """模型的靜態多邊形：(板塊編號, 存在的時間 (開始, 結束), 今天的形狀)。經度展開成連續的（跨 180° 的可以超過 ±180）"""
    out = []
    for f in m["static"]:
        pid = f.get_reconstruction_plate_id()
        begin, end = f.get_valid_time()
        for g in f.get_geometries():
            pts = [p.to_lat_lon() for p in g.get_points()]
            if len(pts) < 3:
                continue
            lons = [pts[0][1]]
            for la, lon in pts[1:]:
                lons.append(lons[-1] + ((lon - lons[-1] + 180) % 360 - 180))
            poly = Polygon(list(zip(lons, [la for la, _ in pts]))).buffer(0)
            if not poly.is_empty:
                out.append((pid, (float(begin), float(end)), poly))
    return out


def country_features(m: dict):
    """今天的國界切到各板塊上（shapely 在經緯度上切；pyGPlates 的 partition_into_plates 會把多邊形切成線段）：
    每一塊一個 pygplates.Feature，帶板塊編號與存在的時間"""
    import pygplates
    from shapely.affinity import translate
    from shapely.strtree import STRtree

    from topics.population_grid import country_shapes

    plates_ = static_plates(m)
    tree = STRtree([p for _, _, p in plates_])
    # 同一國、同一塊板塊（同樣的存在時間）的碎片先合併，切完再簡化：靜態多邊形的邊界很細，直接用的話頂點多十倍
    pieces: dict[tuple, list] = defaultdict(list)
    for code, polys in country_shapes().items():
        for p in polys:
            g = Polygon(p[0], p[1:]).buffer(0)
            if g.is_empty:
                continue
            for shift in (0, 360, -360):
                gs = translate(g, xoff=shift) if shift else g
                for j in tree.query(gs, predicate="intersects"):
                    pid, valid, sp = plates_[int(j)]
                    piece = gs.intersection(sp)
                    if not piece.is_empty:
                        pieces[(code, pid, valid)].append(translate(piece, xoff=-shift) if shift else piece)
    feats = []
    for (code, pid, valid), parts in pieces.items():
        merged = unary_union(parts).simplify(SIMPLIFY_DEG, preserve_topology=True)
        for part in getattr(merged, "geoms", [merged]):
            if part.geom_type != "Polygon" or part.area < MIN_AREA:
                continue
            ring = [(y, x) for x, y in list(part.exterior.coords)[:-1]]
            if len(ring) < 3:
                continue
            f = pygplates.Feature()
            f.set_geometry(pygplates.PolygonOnSphere(ring))
            f.set_name(code)
            f.set_reconstruction_plate_id(pid)
            f.set_valid_time(valid[0], valid[1])
            feats.append(f)
    return feats


def build() -> None:
    import pygplates

    m = model()
    cont = continents()
    part = country_features(m)
    print(f"  國界切到板塊上 {len(part):,} 塊")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "countries").mkdir(exist_ok=True)
    (OUT / "boundaries").mkdir(exist_ok=True)
    lat: dict[str, dict[int, float]] = defaultdict(dict)
    total = 0
    for t in TIMES:
        out = []
        pygplates.reconstruct(part, m["rotation"], out, float(t))
        lines, types, records = [], [], []
        weights: dict[str, list[tuple[float, float]]] = defaultdict(list)
        shapes: dict[str, list[Polygon]] = defaultdict(list)
        for r in out:
            code = r.get_feature().get_name()
            geom = r.get_reconstructed_geometry()
            if not isinstance(geom, pygplates.PolygonOnSphere):  # 切板塊時偶爾剩下的線段，不畫
                continue
            pts = [p.to_lat_lon() for p in geom.get_points()]
            if len(pts) < 3:
                continue
            c = geom.get_centroid().to_lat_lon()
            weights[code].append((c[0], geom.get_area()))
            # 經度展開到這一塊重心的 ±180° 以內，同一國的各塊再平移到第一塊的附近，才能合併
            ref = shapes[code][0].centroid.x if shapes[code] else c[1]
            base = c[1] + round((ref - c[1]) / 360) * 360
            ring = [(base + ((lon - base + 180) % 360 - 180), la) for la, lon in pts]
            poly = Polygon(ring).buffer(0)
            if not poly.is_empty:
                shapes[code].append(poly)
        for code, polys in shapes.items():
            # 同一國切到不同板塊的各塊轉回去後合併：板塊之間的切線不見了，頂點少很多（還連在一起的塊合成一塊）
            merged = unary_union([p.buffer(0.05) for p in polys]).buffer(-0.05).simplify(SIMPLIFY_DEG / 2, preserve_topology=True)
            for piece in getattr(merged, "geoms", [merged]):
                if piece.geom_type != "Polygon" or piece.area < MIN_AREA:
                    continue
                lines.append(list(piece.exterior.coords))
                types.append(cont.get(code, CONTINENTS.index("Oceania")))
                records.append({"c": code, "f": 1})
        for code, ws in weights.items():
            w = np.array([a for _, a in ws])
            lat[code][t] = round(float(np.dot([la for la, _ in ws], w) / w.sum()), 1)
        data = lines_file(lines, QUANTUM, types, records=records, record_fields=["c", "f"], record_scale={"f": 1},
                          record_strings=["c"])
        # 檔名是時間軸的年份（負的百萬年，0 是今天）：前端的檔名寫 {year}
        write_json(OUT / "countries" / f"{-t}.json", data, quiet=True)
        total += (OUT / "countries" / f"{-t}.json").stat().st_size

        resolved, sections = [], []
        pygplates.resolve_topologies(m["topologies"], m["rotation"], resolved, float(t), sections)
        b_lines, b_types = [], []
        for s in sections:
            kind = BOUNDARY_TYPES.get(s.get_topological_section_feature().get_feature_type().get_name(), OTHER_BOUNDARY)
            for sub in s.get_shared_sub_segments():
                pts = [p.to_lat_lon() for p in sub.get_resolved_geometry().get_points()]
                if len(pts) < 2:
                    continue
                line = [(pts[0][1], pts[0][0])]
                for la, lon in pts[1:]:
                    prev = line[-1][0]
                    line.append((prev + ((lon - prev + 180) % 360 - 180), la))
                b_lines.append(line)
                b_types.append(kind)
        write_json(OUT / "boundaries" / f"{-t}.json", lines_file(b_lines, QUANTUM, b_types), quiet=True)
        total += (OUT / "boundaries" / f"{-t}.json").stat().st_size
    print(f"  {len(TIMES)} 個時間點，共 {total / 1024:.0f} KB")

    years = [-t for t in reversed(TIMES)]
    write_json(OUT / "paleolat.json", indicator_file(
        "paleolat", "°", years, {c: [by.get(-y) for y in years] for c, by in lat.items()}))
    write_json(OUT / "manifest.json", {
        "topic": "plates",
        "generatedAt": now_iso(),
        "source": "Merdith et al. (2021) full-plate model v1.2.4, Zenodo doi:10.5281/zenodo.13635864, CC BY 4.0; reconstructed with pyGPlates",
        "times": TIMES,
    })
    for c in ("TWN", "IND", "AUS", "USA", "GBR", "BRA", "ZAF"):
        print(f"    {c}: " + "、".join(f"{t}: {lat[c].get(t)}" for t in (0, 50, 100, 150, 200, 250)))


if __name__ == "__main__":
    build()
