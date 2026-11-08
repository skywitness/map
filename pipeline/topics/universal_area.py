"""環球影城的園區多邊形與面積、園內的雲霄飛車、維基的設施與主題園區數（2026-11-08，製作手冊第二十八批 681，候選 1523、1526、
1541、1542；擴充「環球影城」；步驟 universal-area，輸出 topics/universal/）。

- **多邊形用 OSM 的 `wikidata` 標籤**（候選 1542，不是 `brand:wikidata`、也不用名稱比對）：白名單的 QID 一支 QLever 查詢對回
  OSM 物件。同一個 QID 有好幾個物件時（日本 relation 與 way 幾何一樣、英國兩個 way）：面積取最大的一個，邊界都畫。
- **面積**：`osm2rdf:area`（osm2rdf 依幾何算好的平方公尺，跟順序 634 的「樂園有多大」同一個來源與做法）。**手冊：兩個口徑並列、
  不做排名**——OSM 的邊界畫法不一（好萊塢只畫了前場，維基寫的整個片廠約 168 公頃），清單把 OSM 與維基的面積寫在一起。
- **園內的雲霄飛車**：`ogc:sfContains` 落在多邊形裡的 `attraction=roller_coaster`，依名稱算（634 的做法：一座常畫成好幾段）；
  **0 寫成「OSM 沒有標」**（佛羅里達環球影城 OSM 0 座、維基寫 3 座）。
- **維基的官方數字**（候選 1541）：各園條目 `Infobox amusement park` 的 `rides`、`coasters`、`water_rides`、`area`
  （英文維基固定版本，revid 寫在 REVIDS；手冊沒有給版本的，2026-11-08 讀當下的版本、把 revid 記下來）。HTML 註解與參考
  資料去掉，只取開頭的整數。只有一部分條目有填，沒填的留空、不補。
"""
from __future__ import annotations

import html
import json
import re

from common import OUT_DIR, lines_file, load_points_json, points_file, read_points_file, write_json
from sources import osm_qlever
from sources.wikipedia_html import page

OUT = OUT_DIR / "topics" / "universal"
# 英文維基的條目與固定版本：日本、新加坡、Kids Resort 是 2026-11-08 讀的當下版本，其他是手冊 680、681 給的
REVIDS = {
    "Q1337576": ("Universal Studios Hollywood", 1384170253),
    "Q1880820": ("Universal Studios Florida", 1384410168),
    "Q2583112": ("Universal Islands of Adventure", 1384215479),
    "Q66085108": ("Universal Epic Universe", 1384410524),
    "Q20979434": ("Universal Volcano Bay", 1380477501),
    "Q18233530": ("Universal Studios Beijing", 1381213236),
    "Q1375103": ("Universal Studios Japan", 1384197462),
    "Q1186714": ("Universal Studios Singapore", 1384000138),
    "Q123878029": ("Universal Kids Resort", 1373818056),
}
ACRE_HA = 0.40468564224


def _param(text: str, key: str) -> str | None:
    m = re.search(r'"%s":\{"wt":"((?:[^"\\]|\\.)*)"\}' % re.escape(key), text)
    if not m:
        return None
    v = html.unescape(json.loads('"' + m.group(1) + '"'))
    v = re.sub(r"<!--.*?-->", "", v, flags=re.S)
    v = re.sub(r"<ref[^>]*/>|<ref.*?</ref>", "", v, flags=re.S)
    return v.strip() or None


def _int(v: str | None) -> int | None:
    m = re.match(r"\s*(\d+)", v or "")
    return int(m.group(1)) if m else None


def _area_ha(v: str | None) -> float | None:
    """infobox 的 area：{{convert|110|acre|ha}}、「44 ha」、「108 acres」……換成公頃"""
    if not v:
        return None
    m = re.search(r"(?i)\{\{convert\|([\d.,]+)\|(acre|acres|ha|hectare|hectares|m2|km2)", v)
    if m:
        n, unit = float(m.group(1).replace(",", "")), m.group(2)
    else:
        m = re.search(r"([\d.,]+)\s*(acres?|ha\b|hectares?)", v)
        if not m:
            return None
        n, unit = float(m.group(1).replace(",", "")), m.group(2)
    if unit.startswith("acre"):
        return round(n * ACRE_HA, 1)
    if unit == "m2":
        return round(n / 1e4, 1)
    if unit == "km2":
        return round(n * 100, 1)
    return round(n, 1)


def _rings(wkt: str) -> list[list[tuple[float, float]]]:
    """POLYGON／MULTIPOLYGON 的每一個環（外環與內環都畫成線）"""
    out = []
    for ring in re.findall(r"\(([^()]+)\)", wkt):
        pts = []
        for pair in ring.split(","):
            x, y = pair.split()
            p = (round(float(x), 5), round(float(y), 5))
            if not pts or p != pts[-1]:
                pts.append(p)
        if len(pts) >= 4:
            out.append(pts)
    return out


def build() -> None:
    places = read_points_file(load_points_json(OUT / "places.json"))
    qids = [p["qid"] for p in places]
    rows = osm_qlever.query("""PREFIX osm2rdf: <https://osm2rdf.cs.uni-freiburg.de/rdf#>
SELECT ?x ?q ?area ?wkt (COUNT(DISTINCT ?cname) AS ?coasters) (GROUP_CONCAT(DISTINCT ?cname; SEPARATOR="|") AS ?names) WHERE {
  VALUES ?q { %s }
  ?x <https://www.openstreetmap.org/wiki/Key:wikidata> ?q ; geo:hasGeometry/geo:asWKT ?wkt .
  OPTIONAL { ?x osm2rdf:area ?area }
  OPTIONAL { ?x ogc:sfContains ?c . ?c osmkey:attraction "roller_coaster" ; osmkey:name ?cname }
} GROUP BY ?x ?q ?area ?wkt""" % " ".join(f'"{q}"' for q in qids), "universal-osm-areas")
    by_q: dict[str, list[dict]] = {}
    for r in rows:
        wkt = r["wkt"]["value"]
        if "POLYGON" not in wkt.upper():
            continue
        osm = r["x"]["value"].rsplit("/", 2)
        by_q.setdefault(r["q"]["value"], []).append({
            "osm": f"{osm[-2]}/{osm[-1]}", "ha": round(float(r["area"]["value"]) / 1e4, 1) if "area" in r else None,
            "rc": int(r["coasters"]["value"]), "names": r.get("names", {}).get("value") or "", "wkt": wkt})

    lines, records = [], []
    for p in places:
        found = by_q.get(p["qid"], [])
        best = max(found, key=lambda o: o["ha"] or 0) if found else None
        p["osm_ha"] = best["ha"] if best else None
        p["osm"] = best["osm"] if best else None
        p["osm_n"] = len(found) or None
        # 雲霄飛車只算主題樂園（度假區的多邊形只蓋住一部分，手冊：不要拿來統計）
        p["rc"] = best["rc"] if best and p["kind"] == 1 else None
        seen = set()
        for o in found:
            key = tuple(_rings(o["wkt"])[0][:3]) if _rings(o["wkt"]) else None
            if key in seen:
                continue  # 幾何一樣的（日本的 relation 與 way）只畫一次
            seen.add(key)
            for ring in _rings(o["wkt"]):
                lines.append(ring)
                records.append({"qid": p["qid"], "k": p["kind"]})

        title_rev = REVIDS.get(p["qid"])
        if title_rev:
            text = page(*title_rev)
            p["rev"] = title_rev[1]
            p["rides"] = _int(_param(text, "rides"))
            p["wc"] = _int(_param(text, "coasters"))
            p["wr"] = _int(_param(text, "water_rides"))
            p["wiki_ha"] = _area_ha(_param(text, "area"))
            p["areas_n"] = _int(_param(text, "theme_areas"))

    fields = ["lon", "lat", "qid", "en", "zh", "iso3", "kind", "resort", "status", "y", "yc", "note", "own", "share", "ownnote",
              "osm_ha", "osm", "osm_n", "rc", "rides", "wc", "wr", "wiki_ha", "areas_n", "rev"]
    scale = {"lon": 0.0001, "lat": 0.0001, "kind": 1, "resort": 1, "status": 1, "y": 1, "yc": 1, "own": 1, "share": 1, "osm_ha": 0.1, "osm_n": 1,
             "rc": 1, "rides": 1, "wc": 1, "wr": 1, "wiki_ha": 0.1, "areas_n": 1, "rev": 1}
    write_json(OUT / "places-area.json", points_file(places, fields, scale))
    # 地圖上的點也帶面積與座數（滑過的說明用）：照 universal 步驟同樣的分層重寫
    write_json(OUT / "resorts.json", points_file([p for p in places if p["kind"] == 3], fields, scale))
    write_json(OUT / "sites.json", points_file([p for p in places if p["kind"] != 3 and p["status"] != 3], fields, scale))
    write_json(OUT / "planned.json", points_file([p for p in places if p["status"] == 3], fields, scale))
    write_json(OUT / "outlines.json", lines_file(lines, 0.00001, records=records, record_fields=["qid", "k"], record_scale={"k": 1}))
    print(f"  環球的園區：{len(by_q)}／{len(places)} 個 QID 在 OSM 有多邊形，{len(lines)} 個環")
    for p in places:
        print(f"    {p['en']}: OSM {p['osm_ha']} 公頃（{p['osm_n']} 個物件）、雲霄飛車 OSM {p['rc']}；維基 設施 {p.get('rides')}、"
              f"雲霄飛車 {p.get('wc')}、水上 {p.get('wr')}、面積 {p.get('wiki_ha')} 公頃、主題園區 {p.get('areas_n')}")
