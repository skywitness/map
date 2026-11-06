"""城市：低排放區與塞車費（2026-11-05，製作手冊第二十三批 410〔候選 1016〕；步驟 city-traffic，輸出 topics/cities/，擴充「城市」）。

- **低排放區**：OpenStreetMap（ODbL 1.0）經 QLever（sources/osm_qlever.py）：`boundary=low_emission_zone` 共 543 個物件
  （2026-11-05 快取）。其中 229 個是面（way 109、relation 120）；306 條線裡 284 條就是 relation 的邊（中點落在某個面的
  邊界上），其餘 22 條是誤標的道路片段（德國的 Akazienstraße 等）；8 個點是義大利馬泰拉的 ZTL 入口，沒有範圍。所以只畫面、
  只數面。同一個範圍畫成 way 與 relation 兩次的（交集 ÷ 聯集 > 0.9，5 對）留 relation；美國那一個是「國家無線電寧靜區」
  誤標，不收（EXCLUDE）。香港的 3 個專營巴士低排放區在 OSM 的中國國界裡，依位置改算香港。
  OSM 的覆蓋很不均（義大利實際有幾百個 ZTL，多半畫在道路的 `motor_vehicle:conditional` 而不是面），各國的數字是「OSM 上
  畫出來的」，不是官方清單；只有 70 個寫了開始日期（start_date），沒寫的不猜。面簡化到約 20 公尺，輸出的線檔是 OSM 的衍生
  資料庫，依 ODbL 提供。
- **塞車費**：英文維基百科「Congestion pricing」固定版本 1380197393（CC BY-SA 4.0）的「Cordon area and area wide」
  「Urban corridors and toll rings」兩節提到已經實施的城市，手工整理在 CONGESTION（年份照條目寫的，沒寫的留空）；
  位置是 Wikidata（CC0）的座標，經 QLever 依英文名稱與國家查，同名取人口最多的。
- **台灣**：OSM 上沒有低排放區，也沒有塞車費。對應的制度是空氣污染防制法第 40 條的空氣品質維護區；data.gov.tw 只有桃園市
  （149351，政府資料開放授權條款第 1 版，3 區），寫在指標說明。
"""
from __future__ import annotations

import csv
import io
import re
from collections import Counter

from shapely import wkt as shapely_wkt
from shapely.geometry import MultiPolygon, Polygon
from shapely.strtree import STRtree

from common import OUT_DIR, download, indicator_file, lines_file, points_file, write_json
from sources import osm_qlever, urban_audit
from topics.airspace import _area_km2

OUT = OUT_DIR / "topics" / "cities"
YEAR = 2026
SIMPLIFY = 0.0002  # 度，約 20 公尺
QUANTUM = 0.0001
EXCLUDE = {"No electromagnetic waves zone"}  # 美國國家無線電寧靜區，不是低排放區
HONG_KONG = (113.8, 22.13, 114.5, 22.57)
TAOYUAN = "https://opendata.tycg.gov.tw/api/dataset/dc135329-332f-4182-a180-7ab4c3d87bf1/resource/f265fa4e-dce9-4841-9c6f-bcf592bfe703/download"

# 英文維基百科「Congestion pricing」revid 1380197393 寫到已經實施的（城市、ISO2、種類、開始年份、後來的改變）。
# 種類：1 進入市中心收費（塞車費、擁擠稅）、2 收費環與市區收費道路、3 古城中心、4 已經停收
# 2026-11-06 補：瓦萊塔的 2007 年取自英文維基「Valletta」revid 1381541439（「In 2007, a congestion pricing scheme was
# implemented」）；滕斯貝格、納姆索斯的收費環在「Toll roads in Norway」revid 1382299473 列在「Former toll roads」。
# 其他沒寫年份的（茲諾伊莫、里加、克里斯蒂安桑、海于格松、斯塔萬格）城市條目也沒寫，留空
CONGESTION = [
    ("Singapore", "SG", 1, 1975, {"zh": "1975 年區域通行證（ALS），1998 年改成電子道路收費（ERP）", "en": "Area Licensing Scheme from 1975; Electronic Road Pricing from 1998"}),
    ("Rome", "IT", 1, 2001, {"zh": "限制通行區（ZTL）的電子門禁", "en": "Electronic access control for the limited traffic zone (ZTL)"}),
    ("London", "GB", 1, 2003, {"zh": "塞車費（Congestion Charge）；另有低排放區與超低排放區", "en": "Congestion Charge; separate Low and Ultra Low Emission Zones"}),
    ("Stockholm", "SE", 1, 2006, {"zh": "2006 年試辦 7 個月，2007 年起常態收擁擠稅", "en": "Seven-month trial in 2006; permanent congestion tax from 2007"}),
    ("Milan", "IT", 1, 2008, {"zh": "2008 年 Ecopass（依污染收費），2012 年改成 Area C（塞車費）", "en": "Ecopass (pollution charge) from 2008; Area C (congestion charge) from 2012"}),
    ("Gothenburg", "SE", 1, 2013, {"zh": "仿照斯德哥爾摩的擁擠稅", "en": "Congestion tax modelled on Stockholm’s"}),
    ("New York City", "US", 1, 2025, {"zh": "曼哈頓 61 街以南的中央商業區，美國第一個", "en": "Manhattan south of 61st Street, the first in the US"}),
    ("Durham", "GB", 3, 2002, {"zh": "古城中心收費，一年後車流少了 85%", "en": "Old-town charge; traffic fell 85% within a year"}),
    ("Znojmo", "CZ", 3, None, {"zh": "古城中心收費", "en": "Old-town charge"}),
    ("Riga", "LV", 3, None, {"zh": "古城中心收費", "en": "Old-town charge"}),
    ("Valletta", "MT", 3, 2007, {"zh": "古城中心收費（車牌辨識），每天進城的車從 1 萬輛降到 7,900 輛", "en": "Old-town charge (number-plate cameras); daily vehicles fell from 10,000 to 7,900"}),
    ("Bergen", "NO", 2, 1986, {"zh": "收費環，進市中心只能走收費道路", "en": "Toll ring; the centre can only be reached by toll roads"}),
    ("Oslo", "NO", 2, 1990, {"zh": "收費環，尖峰加價", "en": "Toll ring with peak-hour rates"}),
    ("Trondheim", "NO", 2, 1991, {"zh": "收費環，2010 年起依時段收費", "en": "Toll ring; time-of-day rates from 2010"}),
    ("Kristiansand", "NO", 2, None, {"zh": "收費環，依時段收費", "en": "Toll ring with time-of-day rates"}),
    ("Haugesund", "NO", 2, None, {"zh": "市區收費（2015 年時已實施）", "en": "Urban charging (in place by 2015)"}),
    ("Namsos", "NO", 4, None, {"zh": "收費環，2015 年時已實施，後來停收", "en": "Toll ring, in place by 2015, since discontinued"}),
    ("Stavanger", "NO", 2, None, {"zh": "市區收費（2015 年時已實施）", "en": "Urban charging (in place by 2015)"}),
    ("Tønsberg", "NO", 4, None, {"zh": "收費環，2015 年時已實施，後來停收", "en": "Toll ring, in place by 2015, since discontinued"}),
    ("Santiago", "CL", 2, 2004, {"zh": "穿過市中心的快速道路不停車收費（2004–2005 年），2007 年起尖峰加價", "en": "Free-flow tolls on urban freeways (2004–2005); peak-hour pricing from 2007"}),
]
COORD = re.compile(r"Point\(([-\d.]+) ([-\d.]+)\)", re.I)
PREFER = {"London": "Q84", "Znojmo": "Q214956"}  # 同名同國還有人口更多、不是城市本身的條目


def _date(text: str) -> str:
    """start_date 統一成 ISO 的寫法（OSM 上有幾個寫成「日/月/年」，例如伯明罕的 01/06/2021）"""
    m = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", text.strip())
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else text.strip()


def _year(text: str) -> int | None:
    m = re.search(r"\b(19[5-9]\d|20[0-4]\d)\b", text)
    return int(m.group(1)) if m else None


def _polygons(geom) -> list[Polygon]:
    return list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom] if isinstance(geom, Polygon) else []


def zones() -> list[dict]:
    rows = osm_qlever.features("boundary", "low_emission_zone", extra=("name", "name:en", "name:zh", "start_date"))
    items = []
    for r in rows:
        if not r["wkt"].startswith(("POLYGON", "MULTIPOLYGON")) or r["name"] in EXCLUDE:
            continue
        g = shapely_wkt.loads(r["wkt"]).buffer(0)
        if g.is_empty:
            continue
        items.append({**r, "geom": g, "rel": "/relation/" in r["osm"]})
    # 同一個範圍畫兩次（way 與 relation）：留 relation（或先出現的）
    tree = STRtree([i["geom"] for i in items])
    drop = set()
    for a, item in enumerate(items):
        for b in tree.query(item["geom"]):
            if b <= a or b in drop or a in drop:
                continue
            other = items[b]
            union = item["geom"].union(other["geom"]).area
            if union and item["geom"].intersection(other["geom"]).area / union > 0.9:
                drop.add(a if other["rel"] and not item["rel"] else b)
    out = []
    for k, item in enumerate(items):
        if k in drop:
            continue
        c = item["geom"].representative_point()
        iso3 = item["iso3"]
        if iso3 == "CHN" and HONG_KONG[0] <= c.x <= HONG_KONG[2] and HONG_KONG[1] <= c.y <= HONG_KONG[3]:
            iso3 = "HKG"
        out.append({"osm": item["osm"], "iso3": iso3, "n": item["name"], "ne": item["name:en"], "nz": item["name:zh"],
                    "d": _date(item["start_date"]), "y": _year(item["start_date"]), "geom": item["geom"],
                    "area": _area_km2(item["geom"]), "lon": c.x, "lat": c.y})
    print(f"  低排放區：{len(rows)} 個物件、{len(items)} 個面，重複去掉 {len(drop)} 個 → {len(out)}")
    return out


def congestion() -> list[dict]:
    values = " ".join(sorted({f'"{name}"@en' for name, *_ in CONGESTION}))
    rows = urban_audit._wdqs(f"""PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?name ?item ?coord ?pop ?cc WHERE {{
  VALUES ?name {{ {values} }}
  ?item rdfs:label ?name ; wdt:P1082 ?pop ; wdt:P625 ?coord ; wdt:P17 ?c .
  ?c wdt:P297 ?cc .
}}""", "congestion-pricing")
    best: dict[tuple[str, str], tuple[float, float, float, str]] = {}
    for r in rows:
        m = COORD.search(r["coord"]["value"])
        if not m:
            continue
        key = (r["name"]["value"], r["cc"]["value"])
        cand = (float(r["pop"]["value"]), float(m.group(1)), float(m.group(2)), r["item"]["value"].rsplit("/", 1)[-1])
        if PREFER.get(key[0]) == cand[3]:
            cand = (float("inf"), *cand[1:])
        if key not in best or cand[0] > best[key][0]:
            best[key] = cand
    out = []
    for name, cc, kind, year, note in CONGESTION:
        hit = best.get((name, cc))
        if not hit:
            raise RuntimeError(f"Wikidata 查不到 {name}（{cc}）")
        _, lon, lat, qid = hit
        out.append({"lon": round(lon, 4), "lat": round(lat, 4), "n": name, "iso3": urban_audit.iso3(cc) or "", "k": kind,
                    "y": year, "zh": note["zh"], "en": note["en"], "q": qid})
    return out


def taoyuan() -> list[list[str]]:
    raw = download(TAOYUAN, "tycg", "air-zones-149351.csv").read_bytes().decode("big5")
    return [[r["空維區名稱"], r["公告日期"], r["管制對象"]] for r in csv.DictReader(io.StringIO(raw))]


def build() -> None:
    zs = zones()
    lines, records = [], []
    for i, z in enumerate(sorted(zs, key=lambda z: (z["iso3"], -z["area"]))):
        simple = z["geom"].simplify(SIMPLIFY, preserve_topology=True)
        polys = _polygons(simple) or _polygons(z["geom"])
        for p in polys:
            for h, ring in enumerate([p.exterior, *p.interiors]):
                lines.append([(x, y) for x, y in ring.coords])
                records.append({"id": i, "n": z["n"], "ne": z["ne"] if z["ne"] != z["n"] else "", "nz": z["nz"] if z["nz"] != z["n"] else "",
                                "iso3": z["iso3"], "y": z["y"], "d": z["d"], "a": round(z["area"], 2), "f": 1, "h": int(h > 0)})
    write_json(OUT / "low-emission-zones-map.json", lines_file(
        lines, QUANTUM, types=[1] * len(lines), records=records,
        record_fields=["id", "n", "ne", "nz", "iso3", "y", "d", "a", "f", "h"],
        record_scale={"id": 1, "y": 1, "a": 0.01, "f": 1, "h": 1}, record_strings=("iso3",)))
    count = Counter(z["iso3"] for z in zs)
    write_json(OUT / "low-emission-zones.json", indicator_file(
        "low-emission-zones", "個", [YEAR], {c: [n] for c, n in sorted(count.items())}, license="ODbL 1.0"))
    dated = [z for z in zs if z["y"]]
    print(f"  各國：{count.most_common()}")
    print(f"  有開始年份的 {len(dated)} 個：{sorted(Counter(z['y'] for z in dated).items())}")
    print(f"  最早：{sorted((z['y'], z['n'], z['iso3']) for z in dated)[:8]}")
    print(f"  最大：{sorted(((round(z['area']), z['n'], z['iso3']) for z in zs), reverse=True)[:8]}（km²）")

    cg = congestion()
    write_json(OUT / "congestion-charges.json", points_file(
        cg, ["lon", "lat", "n", "iso3", "k", "y", "zh", "en", "q"], {"lon": 0.0001, "lat": 0.0001, "k": 1, "y": 1}, strings=("iso3",)))
    print(f"  塞車費 {len(cg)} 城：{[(c['n'], c['y'], c['q'], c['lon'], c['lat']) for c in cg]}")
    print(f"  桃園：{taoyuan()}")
