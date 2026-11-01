"""行政區界（製作手冊第十六批 265，2026-11-01）：世界地圖主題點國家、第一級、第二級，一層一層跳過去。

輸出：
- `public/data/divisions/<代碼>.json`：一國的行政區與來源、授權，前端點了那一國才下載。`u1`（第一級）、`u2`（第二級）
  每一列是 [id, 中文名稱, 英文名稱, 中文種類, 英文種類, 面積 km², [西, 南, 東, 北], [寫名稱的經度, 緯度]]，`u2` 最後多一欄上一級的 id；
  `tiles2` 是第二級在哪一份圖磚。
- `public/data/divisions/index.json`：有行政區的國家、各幾級、第二級在哪一份圖磚。
- 圖磚（`divisions-tiles` 步驟，tippecanoe，本機 session 跑）：第一級一份 `divisions1`（1–9 級），第二級依洲分成
  `divisions2-<洲>`（3–10 級，美洲分北美與拉丁美洲）；圖磚只有 `id`、`c`（國家）、`p`（上一級的 id），名稱都在 JSON。

**資料**（使用者 2026-11-01 選 2A，並決定錯層的國家逐國換、阿曼的第二級不用）：
- **台灣兩級都用內政部國土測繪中心**：直轄市、縣市界線（data.gov.tw 7442）、鄉鎮市區界線（7441），
  政府資料開放授權條款第 1 版；TGOS 擋 cloud，由本機 session 下載到 map-plan 的 `data/nlsc/`。
- **其他國家的第一級：Natural Earth 1:10m Admin 1 5.1.2**（公有領域），中文名稱用檔內的 `wikidataid`
  查 Wikidata（CC0，sources/wikidata_labels.py）的 zh-tw、zh-hant、zh-hk，沒有的用 Natural Earth 的 `name_zht`。
- **其他國家的第二級：geoBoundaries gbOpen ADM2 簡化版**（sources/geoboundaries.py），授權依各國
  （`boundaryLicense`），寫進每一國的 JSON 與頁尾。geoBoundaries 沒有中文名稱，只有 `shapeName`。
- **錯層的國家**（`REGROUP`）：Natural Earth 的 Admin 1 在這些國家其實是第二級（法國 101 省、英國 232 個郡區…），
  第一級改用 geoBoundaries 的真正第一級（義大利用它的 ADM2：20 個大區；它的 ADM1 是 5 個統計大區），
  Natural Earth 那一份當第二級（保留中文名稱）。第一級的中文名稱用 Wikidata 這一國的 P150（下轄行政區）：
  座標落在裡面的剛好一個才用。斯洛維尼亞、北馬其頓、亞塞拜然、烏干達只有一級（`SINGLE`）。

**幾何**：
- **用 264 的 1:10m 國界裁切**（borders_10m.country_shapes()）：每個行政區跟它所在的國家取交集，爭議地區跟著網站的國界走
  （例如克里米亞在 4.1.0 版畫在俄羅斯，Natural Earth 5.1.2 的 Admin 1 寫烏克蘭，照網站的國界算俄羅斯）；別國的行政區
  落在這一國的部分不到那一區的一半時丟掉（國界對不齊的碎片，或阿克賽欽這種網站的國界畫給另一國的地方），由相鄰的區補縫。
  台灣、香港、澳門的國界裡不會有中國的行政區。
- **台灣不裁切**：內政部的界線比 Natural Earth 精細得多，1:10m 的台灣也沒有馬祖、烏坵、東沙；只扣掉跟別國重疊的部分。
- **第二級用上一級裁切**：依重疊面積最大的那一個歸到上一級，再跟上一級取交集（同一國不同來源的界線才貼齊）。
- **補縫**：國家（或上一級）裡沒有被任何行政區蓋到的地方，併到相鄰邊界最長的那一區（不相鄰的小島併到最近的）。
- **簡化**：同一國（或同一個上一級）的行政區一起用 shapely 的 `coverage_simplify` 簡化，相鄰的界線一起動，外圍
  （國界、上一級的界線）不動（`simplify_boundary=False`），所以跟國界、上一級的線貼齊。
- **跨 180° 經線**：俄羅斯、斐濟的行政區照 borders_10m 的規則，碰到 −180° 的部分往東平移 360°。
"""
from __future__ import annotations

import json
import math
import zipfile
from pathlib import Path

from common import CACHE_DIR, OUT_DIR, download, write_json

OUT = OUT_DIR / "divisions"
WORK = CACHE_DIR / "divisions"
NE_ADMIN1_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_1_states_provinces.geojson"
NE_ADMIN1_FILE = "ne_10m_admin_1_states_provinces-5.1.2.geojson"
NE_ADMIN1_SOURCE = {
    "name": "Natural Earth 1:10m Admin 1 – States, Provinces 5.1.2",
    "url": "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/",
    "license": "Public Domain",
}
WIKIDATA_SOURCE = {"name": "Wikidata（中文名稱）", "url": "https://www.wikidata.org/", "license": "CC0 1.0"}
MOI_SOURCE = {
    "name": "內政部國土測繪中心：直轄市、縣市界線與鄉鎮市區界線（TWD97 經緯度，1140318）",
    "url": "https://data.gov.tw/dataset/7441",
    "license": "政府資料開放授權條款第 1 版",
}
# 內政部的兩個 zip（本機 session 從 TGOS 下載，放在 map-plan 的 data/nlsc/；重跑前複製到 .cache/nlsc/）
MOI_COUNTY = CACHE_DIR / "nlsc" / "county-1140318.zip"
MOI_TOWN = CACHE_DIR / "nlsc" / "town-1140318.zip"

# 錯層的國家：第一級改用 geoBoundaries 的哪一級（Natural Earth 的 Admin 1 當第二級）
REGROUP = {
    "GBR": "ADM1", "FRA": "ADM1", "ESP": "ADM1", "BEL": "ADM1", "GRC": "ADM1", "PHL": "ADM1",
    "BFA": "ADM1", "GIN": "ADM1", "MWI": "ADM1", "LKA": "ADM1", "BIH": "ADM1", "ITA": "ADM2",
}
# Wikidata 的國家（P150 找第一級的中文名稱）
COUNTRY_QID = {
    "GBR": "Q145", "FRA": "Q142", "ESP": "Q29", "BEL": "Q31", "GRC": "Q41", "PHL": "Q928",
    "BFA": "Q965", "GIN": "Q1006", "MWI": "Q1020", "LKA": "Q854", "BIH": "Q225", "ITA": "Q38",
    "HKG": "Q8646",
}
# Natural Earth 的中文名稱是機器翻譯、又沒有 wikidataid 的：改用 Wikidata 的 P150（香港 18 區：「中西部」→ 中西區、「北方」→ 北區）
P150_RENAME = {"HKG"}
# 只有一級：geoBoundaries 的 ADM1 是統計分區，Natural Earth 的 Admin 1 就是真正的第一級，下面沒有第二級
SINGLE = {"SVN", "MKD", "AZE", "UGA"}
# 圖磚依洲分檔（geoBoundaries 的 Continent）
CONTINENT = {
    "Asia": "asia", "Europe": "europe", "Africa": "africa", "Oceania": "oceania",
    # 美洲分兩份：合在一起的 GeoJSON 有 52 MB，切成圖磚可能超過 GitHub 能放的大小（巴西 5,570 個市）
    "Northern America": "northamerica", "Latin America and the Caribbean": "latinamerica",
}
# Natural Earth 的 adm0_a3 跟網站的代碼不同的
NE_ADM0 = {"KOS": "XKX", "PSX": "PSE", "SAH": "ESH", "SDS": "SSD", "SOL": "_SOL", "CYN": "_CYN"}
# coverage_simplify 的容許誤差（度）：第一級約 50 m、第二級約 100 m，台灣約 20 m
TOLERANCE = {1: 0.0005, 2: 0.001}
TOLERANCE_TWN = 0.0002
TILES1 = "divisions1"
EARTH_R = 6371.0088

# 中文的種類：只寫確定的（台灣用內政部的名稱判斷，中國用 Natural Earth 的 type_en）
CHN_TYPE = {"Province": "省", "Autonomous Region": "自治區", "Municipality": "直轄市"}


# ── 幾何的小工具 ─────────────────────────────────────────────


def _polygonal(geom):
    from shapely.geometry import MultiPolygon

    if geom.is_empty:
        return MultiPolygon()
    if geom.geom_type in ("Polygon", "MultiPolygon"):
        return geom
    parts = []
    for g in getattr(geom, "geoms", []):
        if g.geom_type == "Polygon":
            parts.append(g)
        elif g.geom_type == "MultiPolygon":
            parts.extend(g.geoms)
    return MultiPolygon(parts)


def _ring_km2(coords) -> float:
    """球面上一個環的面積（km²，Turf 的 ringArea 公式），經緯度"""
    total = 0.0
    n = len(coords)
    for i in range(n - 1):
        lon1, lat1 = coords[i][:2]
        lon2, lat2 = coords[i + 1][:2]
        total += math.radians(lon2 - lon1) * (2 + math.sin(math.radians(lat1)) + math.sin(math.radians(lat2)))
    return abs(total * EARTH_R * EARTH_R / 2)


def km2(geom) -> float:
    out = 0.0
    for poly in getattr(geom, "geoms", [geom]):
        if poly.is_empty:
            continue
        out += _ring_km2(list(poly.exterior.coords)) - sum(_ring_km2(list(r.coords)) for r in poly.interiors)
    return out


def coverage(units: list[dict], region, tolerance: float) -> list[dict]:
    """units 裁切到 region、去掉重疊、補縫、一起簡化（外圍不動）。units：[{geom, …}]，回傳有面積的"""
    import numpy as np
    import shapely
    from shapely import make_valid
    from shapely.ops import unary_union
    from shapely.strtree import STRtree

    if not units:
        return []
    region = make_valid(region)
    # 1. 裁切；大的先佔，小的扣掉跟比它大的重疊的部分（不同來源的界線可能重疊一點）
    geoms = [_polygonal(g) for g in shapely.intersection(np.array([make_valid(u["geom"]) for u in units]), region)]
    order = sorted(range(len(units)), key=lambda i: -geoms[i].area)
    rank = {i: r for r, i in enumerate(order)}
    tree = STRtree(geoms)
    out = list(geoms)
    for i in order:
        g = geoms[i]
        if g.is_empty:
            continue
        earlier = [int(j) for j in tree.query(g) if rank[int(j)] < rank[i] and not geoms[int(j)].is_empty]
        if earlier:
            # 只扣內部真的重疊的（只碰到邊界的不算）
            overlap = shapely.relate_pattern(np.array([geoms[j] for j in earlier]), g, "T********")
            hit = [geoms[j] for j, o in zip(earlier, overlap) if o]
            if hit:
                g = _polygonal(make_valid(g.difference(unary_union(hit))))
        out[i] = g
    kept = []
    for u, g in zip(units, out):
        if not g.is_empty and g.area > 0:
            kept.append({**u, "geom": g})
    if not kept:
        return []
    # 2. 補縫：沒被蓋到的地方併到相鄰邊界最長的一區（小於約 1 km² 的碎片併到最近的一區），不相鄰的併到最近的
    gap = _polygonal(region.difference(unary_union([u["geom"] for u in kept])))
    if not gap.is_empty:
        tree = STRtree([u["geom"] for u in kept])
        adds: dict[int, list] = {}
        for piece in getattr(gap, "geoms", [gap]):
            if piece.area < 1e-12:
                continue
            best = None
            if piece.area > 1e-4:
                ring = piece.buffer(1e-7)
                best_area = 0.0
                for j in tree.query(ring):
                    a = kept[int(j)]["geom"].intersection(ring).area
                    if a > best_area:
                        best, best_area = int(j), a
            if best is None:
                best = int(tree.nearest(piece))
            adds.setdefault(best, []).append(piece)
        for j, pieces in adds.items():
            kept[j]["geom"] = _polygonal(make_valid(unary_union([kept[j]["geom"], *pieces])))
    # 3. 一起簡化，外圍不動
    geoms = [u["geom"] for u in kept]
    try:
        simplified = shapely.coverage_simplify(np.array(geoms), tolerance, simplify_boundary=False)
    except Exception as e:  # noqa: BLE001
        print(f"    coverage_simplify 失敗（{e}），不簡化")
        simplified = geoms
    for u, g in zip(kept, simplified):
        g = _polygonal(make_valid(g))
        u["geom"] = g if not g.is_empty else u["geom"]
    return kept


def _unwrap(geom):
    """跨 180° 經線：碰到 −180° 的部分往東平移 360°（borders_10m 的規則），其他的照舊"""
    from shapely import make_valid
    from shapely.affinity import translate
    from shapely.ops import unary_union

    parts = list(getattr(geom, "geoms", [geom]))
    west = [p for p in parts if p.bounds[0] <= -180 + 1e-9]
    if not west:
        return geom
    rest = [p for p in parts if p not in west]
    return _polygonal(make_valid(unary_union(rest + [translate(p, xoff=360) for p in west])))


# Natural Earth 的 name_zht 有些夾著簡體字（「上塞纳省」「滨海省」「特罗姆斯」）：有這些字的不用，顯示英文名稱。
# 只列地名音譯常見、繁簡不同的字（不是完整的繁簡對照）
SIMPLIFIED = set(
    "亚尔伦兰罗维纳萨诺贝达马鲁龙乌门卢兹约热华丽莱赖桥东区县湾岛岭彻贾韦韩赛杰绍迈纽泽滨顿"
    "库鲍杜涅缅宁凯岚览陆奥苏辽黑辖胜营汉广兴庆宾纳亚墨济莫桑给洛阳宫园镇乡村卫齐鲜"
)


def _traditional(name: str | None) -> str | None:
    if not name or any(ch in SIMPLIFIED for ch in name):
        return None
    return name


# ── 來源 ─────────────────────────────────────────────────


def _ne_admin1() -> list[dict]:
    from shapely import make_valid
    from shapely.geometry import shape

    from sources.wikidata_labels import labels

    path = download(NE_ADMIN1_URL, "natural-earth", NE_ADMIN1_FILE)
    features = json.loads(path.read_text(encoding="utf-8"))["features"]
    names = labels([f["properties"].get("wikidataid") for f in features])
    out = []
    for f in features:
        p = f["properties"]
        lab = names.get(p.get("wikidataid") or "", {})
        zh = lab.get("zh-tw") or lab.get("zh-hant") or lab.get("zh-hk") or _traditional(p.get("name_zht"))
        en = p.get("name_en") or p.get("name") or lab.get("en")
        out.append(
            {
                "key": p["adm1_code"].split("-")[-1],
                "adm0": p["adm0_a3"],
                "zh": zh,
                "en": en,
                "type_en": p.get("type_en") or None,
                "type_zh": CHN_TYPE.get(p.get("type_en") or "") if p["adm0_a3"] == "CHN" else None,
                "geom": make_valid(shape(f["geometry"])),
            }
        )
    return out


def _gb_units(row: dict) -> list[dict]:
    from shapely import make_valid
    from shapely.geometry import shape

    from sources import geoboundaries as gb

    fc = gb.simplified(row)
    out = []
    for n, f in enumerate(fc["features"], start=1):
        if not f.get("geometry"):
            continue
        props = f["properties"]
        out.append(
            {"key": str(n), "zh": None, "en": props.get("shapeName") or None, "iso": props.get("shapeISO") or None, "geom": make_valid(shape(f["geometry"]))}
        )
    return out


def _gb_source(row: dict) -> dict:
    return {
        "name": f"geoBoundaries gbOpen {row['boundaryType']} {row['boundaryISO']}（{row['boundarySource']}，{row['boundaryYearRepresented']}）",
        "url": f"https://www.geoboundaries.org/countryDownloads.html#{row['boundaryISO']}",
        "license": row["boundaryLicense"],
        "year": row["boundaryYearRepresented"],
    }


def _iso_names(iso2: str, units: list[dict]) -> int:
    """geoBoundaries 的 shapeISO（ISO 3166-2，有的沒寫國碼、帶 *）對 Wikidata 的 P300，取中文名稱。回傳取到幾個"""
    from sources.wikidata_labels import _post, labels

    codes = {}
    for u in units:
        code = (u.get("iso") or "").rstrip("*").strip()
        if not code:
            continue
        # 比利時寫 VLG、WAL、BRU（沒有國碼）；西班牙寫 ESP（不是區的代碼，補上國碼後對不到，改用 P150）
        if "-" not in code:
            code = f"{iso2}-{code}"
        if code.startswith(f"{iso2}-"):
            codes[code] = u
    if not codes:
        return 0
    cache = WORK / f"p300-{iso2}.json"
    if cache.exists():
        rows = json.loads(cache.read_text(encoding="utf-8"))
    else:
        values = " ".join(f'"{c}"' for c in sorted(codes))
        rows = _post(f"SELECT ?x ?code WHERE {{ VALUES ?code {{ {values} }} ?x wdt:P300 ?code }}")["results"]["bindings"]
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    by_code: dict[str, set[str]] = {}
    for r in rows:
        by_code.setdefault(r["code"]["value"], set()).add(r["x"]["value"].rsplit("/", 1)[-1])
    names = labels([q for qs in by_code.values() for q in qs])
    got = 0
    for code, u in codes.items():
        qids = by_code.get(code, set())
        if len(qids) != 1:
            continue
        lab = names.get(next(iter(qids)), {})
        zh = lab.get("zh-tw") or lab.get("zh-hant") or lab.get("zh-hk")
        if zh:
            u["zh"] = zh
            got += 1
    return got


def _p150_names(iso3: str, units: list[dict]) -> int:
    """Wikidata 這一國的 P150（下轄行政區）有座標的，座標落在裡面剛好一個時取它的中文名稱（ISO 代碼沒對到的才用）。
    回傳取到幾個"""
    from shapely.geometry import Point

    from sources.wikidata_labels import _post, labels

    query = f"SELECT ?x ?coord WHERE {{ wd:{COUNTRY_QID[iso3]} wdt:P150 ?x . ?x wdt:P625 ?coord }}"
    cache = WORK / f"p150-{iso3}.json"
    if cache.exists():
        rows = json.loads(cache.read_text(encoding="utf-8"))
    else:
        rows = _post(query)["results"]["bindings"]
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    points = []
    for r in rows:
        lon, lat = r["coord"]["value"].removeprefix("Point(").removesuffix(")").split()
        points.append((r["x"]["value"].rsplit("/", 1)[-1], Point(float(lon), float(lat))))
    names = labels([q for q, _ in points])
    got = 0
    for u in units:
        if u.get("zh"):
            continue
        inside = {q for q, pt in points if u["geom"].contains(pt)}
        if len(inside) == 1:
            lab = names.get(inside.pop(), {})
            zh = lab.get("zh-tw") or lab.get("zh-hant") or lab.get("zh-hk")
            if zh:
                u["zh"] = zh
                got += 1
    return got


# geoBoundaries 第二級沒有中文名稱：中國、日本用 Wikidata 有代碼、有座標的縣級（市町村）單位，座標落在裡面剛好一個時取名稱
CODE_NAMES = {
    # 中國：行政區劃代碼 6 位、後兩位不是 00（縣級：縣、區、縣級市、旗…）
    "CHN": ("P442", lambda code: len(code) == 6 and not code.endswith("00")),
    # 日本：地方公共團體代碼 6 位（含檢查碼），第 3–5 位是 000 的是都道府縣
    "JPN": ("P429", lambda code: len(code) == 6 and code[2:5] != "000"),
}


def _code_names(iso3: str, units: list[dict]) -> int:
    """中國、日本第二級的中文名稱（CODE_NAMES）。回傳取到幾個"""
    from shapely.geometry import Point
    from shapely.strtree import STRtree

    from sources.wikidata_labels import _post, labels

    prop, keep = CODE_NAMES[iso3]
    cache = WORK / f"codes-{iso3}.json"
    if cache.exists():
        rows = json.loads(cache.read_text(encoding="utf-8"))
    else:
        # 只取 6 位的代碼（中國的鄉鎮、村有 9、12 位，全部約 5.4 萬筆，一次查回應太大會斷掉）
        query = (
            f"SELECT ?x ?code ?coord WHERE {{ ?x wdt:{prop} ?code ; wdt:P625 ?coord . "
            f'FILTER(STRLEN(REPLACE(?code, " ", "")) = 6) }}'
        )
        rows = _post(query)["results"]["bindings"]
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    points = []
    for r in rows:
        # 中國的代碼在 Wikidata 是兩位一組、用空格隔開（「15 25 02」）
        if not keep(r["code"]["value"].replace(" ", "")):
            continue
        try:
            lon, lat = r["coord"]["value"].removeprefix("Point(").removesuffix(")").split()
        except ValueError:
            continue
        points.append((r["x"]["value"].rsplit("/", 1)[-1], Point(float(lon), float(lat))))
    tree = STRtree([u["geom"] for u in units])
    inside: dict[int, set[str]] = {}
    for qid, pt in points:
        for j in tree.query(pt, predicate="intersects"):
            inside.setdefault(int(j), set()).add(qid)
    names = labels([q for qs in inside.values() for q in qs if len(qs) == 1])
    got = 0
    for j, qids in inside.items():
        if len(qids) != 1:
            continue
        lab = names.get(next(iter(qids)), {})
        zh = lab.get("zh-tw") or lab.get("zh-hant") or lab.get("zh-hk")
        if zh:
            units[j]["zh"] = zh
            got += 1
    return got


def _moi() -> tuple[list[dict], list[dict]] | None:
    """內政部的縣市（第一級）與鄉鎮市區（第二級）；檔案還沒放進快取時回 None"""
    if not MOI_COUNTY.exists() or not MOI_TOWN.exists():
        return None
    import shapefile
    from shapely import make_valid
    from shapely.geometry import shape

    def read(path: Path, layer: str) -> list[dict]:
        # 鄉鎮市區的 zip 裡另有一層 Town_Majia_Sanhe（瑪家鄉含三和村平地的那一塊，跟長治、內埔、鹽埔重疊 5.36 km²），
        # 用不重疊的 TOWN_MOI_1140318（map-plan data/nlsc/README.md）
        with zipfile.ZipFile(path) as z:
            shp = next(n for n in z.namelist() if n.upper().startswith(layer) and n.lower().endswith(".shp"))
            base = shp[:-4]
            cpg = next((n for n in z.namelist() if n.lower() == (base + ".cpg").lower()), None)
            encoding = z.read(cpg).decode("ascii").strip() if cpg else "utf-8"
            encoding = {"950": "big5", "UTF8": "utf-8"}.get(encoding.upper(), encoding)
            reader = shapefile.Reader(
                shp=z.open(shp), dbf=z.open(base + ".dbf"), shx=z.open(base + ".shx"), encoding=encoding
            )
            rows = []
            for sr in reader.iterShapeRecords():
                rows.append({**sr.record.as_dict(), "geom": make_valid(shape(sr.shape.__geo_interface__))})
            return rows

    def county_type(name: str) -> str:
        return "縣" if name.endswith("縣") else "市"

    counties = []
    for r in read(MOI_COUNTY, "COUNTY_MOI"):
        name = r["COUNTYNAME"]
        kind = "直轄市" if name in ("臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市") else county_type(name)
        counties.append(
            {"key": r["COUNTYCODE"], "zh": name, "en": r.get("COUNTYENG"), "type_zh": kind, "type_en": None, "geom": r["geom"]}
        )
    towns = []
    for r in read(MOI_TOWN, "TOWN_MOI"):
        name = r["TOWNNAME"]
        kind = next((k for k in ("區", "鄉", "鎮", "市") if name.endswith(k)), None)
        towns.append(
            {
                "key": r["TOWNCODE"],
                "parent_key": r["COUNTYCODE"],
                "zh": name,
                "en": r.get("TOWNENG"),
                "type_zh": kind,
                "type_en": None,
                "geom": r["geom"],
            }
        )
    return counties, towns


# ── 組裝 ─────────────────────────────────────────────────


def _assign_ne(ne: list[dict], countries: dict) -> dict[str, list[dict]]:
    """Natural Earth 的每個 Admin 1 跟國家取交集，歸到網站的國界（爭議地區跟著國界走）"""
    from shapely import make_valid
    from shapely.strtree import STRtree

    codes = list(countries)
    tree = STRtree([countries[c] for c in codes])
    out: dict[str, list[dict]] = {}
    for u in ne:
        total = u["geom"].area
        if total == 0:
            continue
        for j in tree.query(u["geom"]):
            c = codes[j]
            piece = _polygonal(make_valid(u["geom"].intersection(countries[c])))
            if piece.is_empty:
                continue
            # 自己國家的部分一定留；落在別國的只有大半在那一國時才算那一國的（克里米亞：Natural Earth 寫烏克蘭，
            # 網站的國界畫在俄羅斯）。別國的一小塊（國界對不齊，或阿克賽欽這種網站的國界畫給另一國的地方）不留，
            # 那裡由這一國相鄰的區補縫（不然中國會多出「拉達克」「阿魯納恰爾邦」）
            own = NE_ADM0.get(u["adm0"], u["adm0"]) == c
            if not own and piece.area / total < 0.5:
                continue
            out.setdefault(c, []).append({**u, "geom": piece})
    return out


def _level2(children: list[dict], parents: list[dict], tolerance: float) -> list[dict]:
    """第二級：歸到重疊面積最大的上一級，用上一級裁切、補縫、一起簡化"""
    import numpy as np
    import shapely
    from shapely.strtree import STRtree

    tree = STRtree([p["geom"] for p in parents])
    groups: dict[int, list[dict]] = {}
    for ch in children:
        cand = [int(j) for j in tree.query(ch["geom"])]
        if not cand:
            continue
        areas = shapely.area(shapely.intersection(np.array([parents[j]["geom"] for j in cand]), ch["geom"]))
        k = int(np.argmax(areas))
        if areas[k] > 0:
            groups.setdefault(cand[k], []).append(ch)
    out = []
    for j, kids in groups.items():
        for u in coverage(kids, parents[j]["geom"], tolerance):
            out.append({**u, "parent": j})
    return out


def _bbox(geom) -> list[float]:
    """跳過去時框的範圍：只算面積佔整區 5% 以上的部分（加上最大的一塊），很遠的小島不算
    （宜蘭縣的釣魚台、高雄市的東沙與南沙、阿拉斯加的阿留申群島），不然框住的範圍大到看不出那一區"""
    parts = list(getattr(geom, "geoms", [geom]))
    total = sum(p.area for p in parts)
    largest = max(parts, key=lambda p: p.area)
    main = [p for p in parts if p is largest or p.area >= 0.05 * total]
    w = min(p.bounds[0] for p in main)
    s = min(p.bounds[1] for p in main)
    e = max(p.bounds[2] for p in main)
    n = max(p.bounds[3] for p in main)
    return [round(w, 3), round(s, 3), round(e, 3), round(n, 3)]


def _label_point(geom) -> list[float]:
    """地圖上寫名稱的位置：最大那一塊的「離邊界最遠的點」（polylabel，0.01° 精度），小國、細長的區也落在裡面"""
    from shapely.ops import polylabel

    largest = max(getattr(geom, "geoms", [geom]), key=lambda g: g.area)
    try:
        pt = polylabel(largest, tolerance=0.01)
    except Exception:  # noqa: BLE001
        pt = largest.representative_point()
    return [round(pt.x, 3), round(pt.y, 3)]


def _rounded(coords, nd: int = 5):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], nd), round(coords[1], nd)]
    return [_rounded(c, nd) for c in coords]


def _feature(props: dict, geom) -> str:
    from shapely.geometry import mapping

    g = mapping(geom)
    return json.dumps(
        {"type": "Feature", "properties": props, "geometry": {"type": g["type"], "coordinates": _rounded(g["coordinates"])}},
        separators=(",", ":"),
    )


def build() -> None:
    import borders_10m
    from sources import geoboundaries as gb

    countries = borders_10m.country_shapes(quiet=True)
    countries.pop("ATA", None)
    ne_by_country = _assign_ne(_ne_admin1(), countries)
    gb1 = {r["boundaryISO"]: r for r in gb.metadata("ADM1")}
    gb2 = {r["boundaryISO"]: r for r in gb.metadata("ADM2")}
    moi = _moi()
    if moi is None:
        print(f"  ⚠ 沒有內政部的檔（{MOI_COUNTY.relative_to(CACHE_DIR.parent)}），台灣先用 Natural Earth、沒有第二級")

    WORK.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.json"):
        old.unlink()
    tiles1 = open(WORK / f"{TILES1}.geojsonseq", "w", encoding="utf-8", newline="\n")
    tiles2: dict[str, object] = {}
    index: dict[str, dict] = {}
    totals = {1: 0, 2: 0}
    for iso3 in sorted(countries):
        country = countries[iso3]
        sources: list[dict] = []
        # 第一級
        if iso3 == "TWN" and moi:
            from shapely.ops import unary_union

            others = unary_union([g for c, g in countries.items() if c != "TWN" and g.intersects(country.buffer(2))])
            level1 = [{**u, "geom": _polygonal(u["geom"].difference(others))} for u in moi[0]]
            level1 = coverage(level1, unary_union([u["geom"] for u in level1]), TOLERANCE_TWN)
            sources.append(MOI_SOURCE)
        elif iso3 in REGROUP and iso3 in gb1:
            row = gb1[iso3] if REGROUP[iso3] == "ADM1" else gb2[iso3]
            level1 = coverage(_gb_units(row), country, TOLERANCE[1])
            import pycountry

            got = _iso_names(pycountry.countries.get(alpha_3=iso3).alpha_2, level1) + _p150_names(iso3, level1)
            sources += [_gb_source(row), WIKIDATA_SOURCE]
            print(f"  {iso3}：第一級用 geoBoundaries {REGROUP[iso3]}（{len(level1)} 個，Wikidata 中文名稱 {got} 個）")
        else:
            units = ne_by_country.get(iso3, [])
            if not units:
                continue
            level1 = coverage(units, country, TOLERANCE[1])
            sources += [NE_ADMIN1_SOURCE, WIKIDATA_SOURCE]
            if iso3 in P150_RENAME:
                for u in level1:
                    u["zh"] = None
                got = _p150_names(iso3, level1)
                print(f"  {iso3}：第一級 {len(level1)} 個，中文名稱改用 Wikidata 的 P150（{got} 個）")
        if not level1:
            continue
        prefix = "r" if iso3 in REGROUP else ""
        for u in level1:
            u["id"] = f"{iso3}-{prefix}{u['key']}"
        # 第二級
        level2: list[dict] = []
        if iso3 == "TWN" and moi:
            by_key = {u["key"]: i for i, u in enumerate(level1)}
            kids: dict[int, list[dict]] = {}
            for t in moi[1]:
                kids.setdefault(by_key[t["parent_key"]], []).append(t)
            for j, ts in kids.items():
                for u in coverage(ts, level1[j]["geom"], TOLERANCE_TWN):
                    u["id"] = f"{level1[j]['id']}-{u['key'][len(level1[j]['key']):]}"
                    level2.append({**u, "parent": j})
        elif iso3 in REGROUP and iso3 in gb1:
            level2 = _level2(ne_by_country.get(iso3, []), level1, TOLERANCE[2])
            sources.insert(1, NE_ADMIN1_SOURCE)
        elif iso3 not in SINGLE and iso3 in gb2:
            level2 = _level2(_gb_units(gb2[iso3]), level1, TOLERANCE[2])
            sources.append(_gb_source(gb2[iso3]))
            if iso3 in CODE_NAMES:
                got = _code_names(iso3, level2)
                if WIKIDATA_SOURCE not in sources:
                    sources.append(WIKIDATA_SOURCE)
                print(f"  {iso3}：第二級 {len(level2)} 個，Wikidata 中文名稱 {got} 個")
        if level2 and not (iso3 == "TWN" and moi):
            # 同一個上一級裡依名稱排，編號 1、2、3…
            seen: dict[int, int] = {}
            # 編號只看英文名稱與來源裡的序號（不看 Wikidata 的中文名稱），本機重跑時一樣
            for u in sorted(level2, key=lambda u: (u["parent"], u.get("en") or "", u["key"])):
                seen[u["parent"]] = seen.get(u["parent"], 0) + 1
                u["id"] = f"{level1[u['parent']]['id']}-{seen[u['parent']]}"
        region = None
        if level2:
            region = CONTINENT.get((gb2.get(iso3) or gb1.get(iso3) or {}).get("Continent", ""), "asia" if iso3 == "TWN" else None)
            if region is None:
                raise ValueError(f"{iso3} 不知道是哪一洲")
        # 面積在跨 180° 經線接起來以前算；範圍、圖磚用接起來的
        for u in level1 + level2:
            u["km2"] = round(km2(u["geom"]))
            u["geom"] = _unwrap(u["geom"])
        for u in level1:
            tiles1.write(_feature({"id": u["id"], "c": iso3}, u["geom"]) + "\n")
        if level2:
            f2 = tiles2.get(region)
            if f2 is None:
                f2 = tiles2[region] = open(WORK / f"divisions2-{region}.geojsonseq", "w", encoding="utf-8", newline="\n")
            for u in level2:
                f2.write(_feature({"id": u["id"], "c": iso3, "p": level1[u["parent"]]["id"]}, u["geom"]) + "\n")
        row1 = lambda u: [u["id"], u.get("zh"), u.get("en"), u.get("type_zh"), u.get("type_en"), u["km2"], _bbox(u["geom"]), _label_point(u["geom"])]  # noqa: E731
        data = {
            "sources": sources,
            "tiles2": f"divisions2-{region}" if level2 else None,
            "u1": [row1(u) for u in sorted(level1, key=lambda u: u["id"])],
            "u2": [[*row1(u), level1[u["parent"]]["id"]] for u in sorted(level2, key=lambda u: u["id"])],
        }
        write_json(OUT / f"{iso3}.json", data, quiet=True)
        index[iso3] = {"levels": 2 if level2 else 1, "n1": len(level1), "n2": len(level2)}
        totals[1] += len(level1)
        totals[2] += len(level2)
    tiles1.close()
    for f in tiles2.values():
        f.close()
    write_json(OUT / "index.json", dict(sorted(index.items())))
    two = sum(1 for v in index.values() if v["levels"] == 2)
    print(f"  {len(index)} 國有第一級（{totals[1]:,} 個），{two} 國有第二級（{totals[2]:,} 個）；圖磚的 GeoJSON 在 {WORK}")


def build_tiles() -> None:
    """divisions 步驟產生的 GeoJSON 切成 PMTiles（tippecanoe，本機 session 跑）"""
    import pmtiles

    # 最大縮放跟簡化的精度一致：第一級約 50 m（9 級一個像素約 150 m），第二級約 100 m（10 級約 75 m）；放得更大時前端放大最後一級
    pmtiles.build(TILES1, WORK / f"{TILES1}.geojsonseq", "d1", min_zoom=1, max_zoom=9, keep=["id", "c"], polygons=True)
    for path in sorted(WORK.glob("divisions2-*.geojsonseq")):
        pmtiles.build(path.stem, path, "d2", min_zoom=3, max_zoom=10, keep=["id", "c", "p"], polygons=True)
