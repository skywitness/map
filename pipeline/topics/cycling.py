"""自行車：國際與國家級的自行車路線、歐洲城市騎車通勤的比例（2026-11-04，製作手冊第二十一批 364、365）。

- 路線（364）：OpenStreetMap 經 QLever（sources/osm_qlever.py；ODbL）的 route=bicycle 路線，network=icn（國際級，
  EuroVelo 等）與 ncn（國家級）。QLever 的 relation 幾何只有直接由 way 組成的路線有（EuroVelo 這類由各國分段組成的
  上層路線沒有幾何），所以畫的是各國的分段，不會重複畫。一個網路一支查詢（icn 約 66 MB、ncn 約 191 MB 的 WKT），
  TSV 串流存在快取，簡化後輸出線圖層；各國的路線總長依每一段的中點分到國家（geoindex.countries_at），
  用簡化前的幾何算，同一級網路裡重疊的路段只算一次（順逆時針兩條關係、共用的 way）。各國的總長只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py）。
- 台灣：OSM 有環島 1 號線等國家級路線，照常畫；另外畫交通部觀光署「自行車道」開放資料（data.gov.tw 41652，
  政府資料開放授權條款第 1 版）的 59 條路線，只有國家風景區轄內，口徑不同，另一種顏色、不算進總長。
- 城市（365）：Eurostat Urban Audit（urb_ctran，CC BY 4.0）的 TT1007V「騎自行車上班的比例」，每個城市用最近一年
  （年份差很多，寫在點上）；城市的位置用 Wikidata（sources/urban_audit.py）。TT1079V「自行車道長度」各國的單位
  混用公里與公尺（柏林 1,073,473「公里」），對不出單位，不用。
"""
from __future__ import annotations

import csv
import json
import math
import sys
import zipfile
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, lines_file, points_file, write_json
from geoindex import countries_at
from sources import osm_coverage, osm_qlever, urban_audit

OUT = OUT_DIR / "topics" / "cycling"
YEAR = 2026
NETWORKS = {"icn": 1, "ncn": 2}
TAIWAN_TYPE = 3
TOLERANCE = 0.005  # 度（約 500 公尺）
QUANTUM = 0.001
TW_URL = "https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/CyclingRoute-json.zip"
LICENSE = "ODbL 1.0"
LIST_TOP = 150  # 左邊清單列幾條最長的路線
csv.field_size_limit(sys.maxsize)


def _haversine(a, b) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371.0088 * math.asin(min(1.0, math.sqrt(h)))


def _query(network: str) -> str:
    return f"""SELECT ?r ?ref ?name ?zh ?en ?wkt WHERE {{
  ?r osmkey:route "bicycle" ; osmkey:network "{network}" ; geo:hasGeometry/geo:asWKT ?wkt .
  OPTIONAL {{ ?r osmkey:ref ?ref }}
  OPTIONAL {{ ?r osmkey:name ?name }}
  OPTIONAL {{ ?r osmkey:name:zh ?zh }}
  OPTIONAL {{ ?r osmkey:name:en ?en }}
}}"""


def _lines(geom) -> list[list[tuple[float, float]]]:
    from shapely.geometry import GeometryCollection, LineString, MultiLineString

    if isinstance(geom, LineString):
        return [list(geom.coords)]
    if isinstance(geom, (MultiLineString, GeometryCollection)):
        return [l for g in geom.geoms for l in _lines(g)]
    return []


def osm_routes() -> list[dict]:
    """每條路線：osm（relation 編號）、t（1 國際級、2 國家級）、ref、name、zh、en、lines（簡化後）、segs（簡化前每段的中點與長度）"""
    from shapely import wkt
    from shapely.geometry import LineString
    from shapely.ops import linemerge

    routes = {}
    for network, t in NETWORKS.items():
        path = osm_qlever.export(_query(network), f"routes-bicycle-{network}")
        with open(path, encoding="utf-8", newline="") as f:
            reader = csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE)
            header = [h.lstrip("?") for h in next(reader)]
            for row in reader:
                rec = {h: osm_qlever.tsv_value(v) if v else "" for h, v in zip(header, row)}
                rid = rec["r"].rsplit("/", 1)[-1]
                if rid in routes or not rec.get("wkt"):
                    continue
                raw = [l for l in _lines(wkt.loads(rec["wkt"])) if len(l) >= 2]
                if not raw:
                    continue
                merged = linemerge(raw) if len(raw) > 1 else LineString(raw[0])
                simple = []
                for l in _lines(merged):
                    s = LineString(l).simplify(TOLERANCE, preserve_topology=False)
                    if len(s.coords) >= 2:
                        simple.append([(round(x, 4), round(y, 4)) for x, y in s.coords])
                segs = [((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, _haversine(a, b)) for l in raw for a, b in zip(l, l[1:])]
                routes[rid] = {"osm": rid, "t": t, "ref": rec.get("ref", ""), "name": rec.get("name", ""), "zh": rec.get("zh", ""),
                               "en": rec.get("en", ""), "lines": simple, "segs": segs}
    return list(routes.values())


def taiwan_routes() -> list[dict]:
    """觀光署「自行車道」：國家風景區轄內的 59 條（WKT 線）"""
    from shapely import wkt
    from shapely.geometry import LineString

    with zipfile.ZipFile(download(TW_URL, "taiwan-cycling", "CyclingRoute-json.zip")) as z:
        name = next(n for n in z.namelist() if n.endswith(".json"))
        data = json.loads(z.read(name).decode("utf-8-sig"))
    items = data.get("CyclingRoutes") or data.get("CyclingRoute") or next(v for v in data.values() if isinstance(v, list))
    out = []
    for r in items:
        if not r.get("Geometry"):
            continue
        lines = []
        for l in _lines(wkt.loads(r["Geometry"])):
            s = LineString(l).simplify(0.0005)
            if len(s.coords) >= 2:
                lines.append([(round(x, 5), round(y, 5)) for x, y in s.coords])
        if lines:
            out.append({"osm": "", "t": TAIWAN_TYPE, "ref": "", "name": r.get("RouteName") or r.get("Name") or "", "zh": "",
                        "en": "", "lines": lines, "segs": []})
    return out


def build() -> None:
    routes = osm_routes()
    tw = taiwan_routes()
    # 各國的總長：每一段依中點分到國家
    # 同一段路在同一級網路只算一次：順時針、逆時針兩條關係（台灣的環島 1 號線）或幾條路線共用的 way，
    # 每一段的中點（四捨五入到約 10 公尺）一樣的算同一段
    owners, mids, lens, seen = [], [], [], set()
    for i, r in enumerate(routes):
        for x, y, l in r["segs"]:
            key = (r["t"], round(x, 4), round(y, 4))
            if key in seen:
                continue
            seen.add(key)
            owners.append(i)
            mids.append((x, y))
            lens.append(l)
    codes = countries_at([m[0] for m in mids], [m[1] for m in mids])
    km = {t: defaultdict(float) for t in NETWORKS.values()}
    per_route = [defaultdict(float) for _ in routes]
    for i, c, l in zip(owners, codes, lens):
        if c:
            km[routes[i]["t"]][c] += l
            per_route[i][c] += l
    for r, d in zip(routes, per_route):
        r["km"] = round(sum(d.values()))
        r["c"] = ",".join(c for c, _ in sorted(d.items(), key=lambda x: -x[1])[:4])
        del r["segs"]
    _write_lines(routes, tw)
    _write_lengths(km, routes)
    _write_cities()
    write_json(OUT / "manifest.json", {"topic": "cycling", "license": LICENSE,
                                       "sources": ["© OpenStreetMap contributors (ODbL 1.0), via QLever", TW_URL,
                                                   "Eurostat urb_ctran (CC BY 4.0)", "Wikidata (CC0)"]})


def _write_lines(routes: list[dict], tw: list[dict]) -> None:
    # 國家級先畫、國際級畫在上面；台灣觀光署的最後
    ordered = sorted(routes, key=lambda r: -r["t"]) + tw
    lines, types, records, groups = [], [], [], []
    for gi, r in enumerate(ordered):
        for l in r["lines"]:
            lines.append(l)
            types.append(r["t"])
            records.append({"g": gi})
        groups.append({"g": gi, "t": r["t"], "ref": r["ref"], "n": r["name"], "z": r["zh"], "e": r["en"],
                       "km": r.get("km"), "c": r.get("c", "TWN" if r["t"] == TAIWAN_TYPE else "")})
    # 清單：OSM 最長的幾條路線，範圍用簡化後的線
    longest = sorted((gi for gi, r in enumerate(ordered) if r.get("km")), key=lambda gi: -ordered[gi]["km"])[:LIST_TOP]
    listed = []
    for gi in longest:
        r = ordered[gi]
        xs = [x for l in r["lines"] for x, _ in l]
        ys = [y for l in r["lines"] for _, y in l]
        listed.append({"lon": (min(xs) + max(xs)) / 2, "lat": (min(ys) + max(ys)) / 2, "bw": min(xs), "bs": min(ys), "be": max(xs),
                       "bn": max(ys), "g": gi, "t": r["t"], "ref": r["ref"], "n": r["name"], "z": r["zh"], "e": r["en"],
                       "km": r["km"], "c": r["c"]})
    write_json(OUT / "list.json", points_file(listed, ["lon", "lat", "bw", "bs", "be", "bn", "g", "t", "ref", "n", "z", "e", "km", "c"],
                                              {"lon": 0.01, "lat": 0.01, "bw": 0.01, "bs": 0.01, "be": 0.01, "bn": 0.01, "g": 1, "t": 1,
                                               "km": 1}, (), ("c",)))
    write_json(OUT / "routes.json", lines_file(
        lines, QUANTUM, types, records=records, record_fields=["g"], record_scale={"g": 1}, record_delta=["g"],
        groups=("g", points_file(groups, ["g", "t", "ref", "n", "z", "e", "km", "c"], {"g": 1, "t": 1, "km": 1}, ("g",), ("c",)))))
    print(f"  路線：國際級 {sum(r['t'] == 1 for r in routes)}、國家級 {sum(r['t'] == 2 for r in routes)} 條，"
          f"台灣觀光署 {len(tw)} 條；線 {len(lines):,} 段")


def _write_lengths(km: dict, routes: list[dict]) -> None:
    cov = osm_coverage.coverage()
    covered = osm_coverage.well_covered()
    for ind, t, zh, en in (("icn-km", 1, "國際級", "international"), ("ncn-km", 2, "國家級", "national")):
        d = km[t]
        n_routes = defaultdict(int)
        for r in routes:
            if r["t"] == t:
                for c in filter(None, r["c"].split(",")):
                    n_routes[c] += 1
        values, no_value, no_value_en = {}, {}, {}
        for c in sorted(set(d) | covered):
            if c in covered:
                values[c] = [round(d.get(c, 0))]
            else:
                no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
        hints = {c: f"OpenStreetMap 上的{zh}自行車路線經過這裡約 {round(v):,} 公里" for c, v in d.items() if round(v)}
        hints_en = {c: f"About {round(v):,} km of {en} cycle routes on OpenStreetMap" for c, v in d.items() if round(v)}
        write_json(OUT / f"{ind}.json", indicator_file(ind, "km", [YEAR], values, hints=hints, hintsEn=hints_en,
                                                       noValue=no_value, noValueEn=no_value_en, license=LICENSE))
        top = sorted(((round(v), c) for c, v in d.items()), reverse=True)
        print(f"  {ind}：{len(d)} 國、上色 {len(values)}；{top[:10]}；台灣 {round(d.get('TWN', 0))}")


def _write_cities() -> None:
    labels, data = urban_audit.series("urb_ctran", "TT1007V")
    loc = urban_audit.locate({c: labels[c] for c in data})
    rows = []
    for code, s in sorted(data.items()):
        if not loc.get(code):
            continue
        y = max(s)
        lon, lat, qid = loc[code]
        rows.append({"lon": lon, "lat": lat, "v": round(s[y], 1), "y": y, "iso3": urban_audit.iso3(code) or "",
                     "n": labels[code].replace(" (greater city)", ""), "g": 1 if "(greater city)" in labels[code] else 0, "q": qid})
    write_json(OUT / "cities.json", points_file(rows, ["lon", "lat", "v", "y", "iso3", "n", "g", "q"],
                                                {"lon": 0.0001, "lat": 0.0001, "v": 0.1, "y": 1, "g": 1}, strings=("iso3",)))
    per_country: dict[str, int] = defaultdict(int)
    for r in rows:
        per_country[r["iso3"]] += 1
    write_json(OUT / "cities-count.json", indicator_file("cities-count", "個", [YEAR], {c: [n] for c, n in sorted(per_country.items()) if c},
                                                         license="CC BY 4.0"))
    top = sorted(((r["v"], r["n"], r["y"]) for r in rows), reverse=True)
    from collections import Counter
    print(f"  城市：{len(rows)} 個（{len(data)} 個有資料）；最高 {top[:8]}；年份 {Counter(r['y'] for r in rows).most_common(6)}")
