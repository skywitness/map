"""樂園的擴充：樂園有多大、園內有幾座雲霄飛車；已關閉與廢棄的樂園（2026-11-08，製作手冊第二十七批 634，候選 1384、1379；
步驟 theme-park-area，輸出 topics/theme-parks/）。

- **面積與雲霄飛車**：OpenStreetMap（ODbL 1.0）經 QLever：`tourism=theme_park` 畫成面的物件（way、relation）的
  `osm2rdf:area`（平方公尺，osm2rdf 依幾何算好的），園內的雲霄飛車＝`ogc:sfContains` 落在面裡的 `attraction=roller_coaster`
  （QLever 預先算好的空間關係），**依名稱算**：一座雲霄飛車的軌道常畫成好幾段 way、又另外標 node，直接算物件會把
  Cedar Point 算成 102 座；沒有名稱的不算。只收 1 公頃以上（更小的多半是社區的小遊樂場）。手冊的陷阱：OSM 的樂園邊界畫法不一致
  （有的含停車場與飯店），面積只放在滑過與清單，不做排名；只畫成點的樂園沒有面積，不收。
  Wikidata 的 P2046 只有 168 座有面積，太少，不用。
- **已關閉的樂園**：英文維基「List of defunct amusement parks」固定版本（/wiki/?oldid=，CC BY-SA 4.0，只引用名稱、地點、
  起訖年份），各國一節、條列 `名稱, 城市 (開園–關園)`；座標用條目連到的樂園在 Wikidata 的 P625，沒有就用連到的城市
  （precision 標 city）。年份是 `????` 的照原樣留空。手冊說 SBNO（蓋好沒營運）要分開標：這個版本的條列沒有寫 SBNO 的列，
  所以沒有分。
"""
from __future__ import annotations

import html
import re
import urllib.parse
from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json
from sources import osm_qlever
from sources import wikipedia_html as H
from sources.countries import from_alpha2, from_name
from topics.attractions_extra import wiki_items

OUT = OUT_DIR / "topics" / "theme-parks"
MIN_AREA = 10_000  # 平方公尺（1 公頃）
DEFUNCT = ("List_of_defunct_amusement_parks", 1374461581)
# 小節名稱 → 國家（英國、墨西哥、澳洲底下還有分節）
SECTION_ISO = {"Mainland_China": "CHN", "Hong_Kong_SAR": "HKG", "England": "GBR", "Scotland": "GBR", "Wales": "GBR",
               "Isle_of_Man": "IMN", "North_Korea": "PRK", "South_Korea": "KOR", "Palestine": "PSE", "Mexico_City": "MEX",
               "Monterrey": "MEX", "Guadalupe": "MEX", "Australian_Capital_Territory": "AUS", "New_South_Wales": "AUS",
               "Queensland": "AUS", "South_Australia": "AUS", "Tasmania": "AUS", "Victoria": "AUS", "Western_Australia": "AUS",
               "United_States": "USA", "United_Kingdom": "GBR", "Russia": "RUS", "Iran": "IRN", "Vietnam": "VNM",
               "Turkey": "TUR", "Taiwan": "TWN"}


def _areas() -> list[dict]:
    rows = osm_qlever.query(f"""PREFIX osm2rdf: <https://osm2rdf.cs.uni-freiburg.de/rdf#>
PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
SELECT ?x ?iso ?name ?namezh ?area ?cent (COUNT(DISTINCT ?cname) AS ?coasters) WHERE {{
  {osm_qlever.COUNTRIES}
  ?x osmkey:tourism "theme_park" ; osm2rdf:area ?area .
  FILTER(?area >= {MIN_AREA})
  OPTIONAL {{ ?x osmkey:name ?name }}
  OPTIONAL {{ ?x <https://www.openstreetmap.org/wiki/Key:name:zh> ?namezh }}
  ?x geo:hasGeometry/geo:asWKT ?wkt . BIND(geof:centroid(?wkt) AS ?cent)
  OPTIONAL {{ ?x ogc:sfContains ?c . ?c osmkey:attraction "roller_coaster" ; osmkey:name ?cname }}
}} GROUP BY ?x ?iso ?name ?namezh ?area ?cent""", "theme-park-areas-named-coasters")
    out: dict[str, dict] = {}
    for r in rows:
        iso3 = from_alpha2(r["iso"]["value"])
        m = re.match(r"POINT\(([-\d.eE]+) ([-\d.eE]+)\)", r.get("cent", {}).get("value", ""), re.I)
        if not iso3 or not m:
            continue
        osm = r["x"]["value"].rsplit("/", 2)
        key = f"{osm[-2][0]}{osm[-1]}"
        if key in out:  # 跨兩國國界的樂園只留一次
            continue
        out[key] = {"lon": float(m.group(1)), "lat": float(m.group(2)), "ha": round(float(r["area"]["value"]) / 1e4, 1),
                    "rc": int(r["coasters"]["value"]), "iso3": iso3, "osm": key,
                    "name": r.get("name", {}).get("value") or None, "zh": r.get("namezh", {}).get("value") or None}
    return list(out.values())


def _defunct() -> list[dict]:
    text = H.page(*DEFUNCT)
    body = text[text.index('id="Africa"'):text.index('id="See_also"')]
    items, iso = [], None
    for m in re.finditer(r'<h[234][^>]*id="([^"]+)"|<li[^>]*>(.*?)</li>', body, re.S):
        if m.group(1):
            sec = m.group(1)
            if sec in ("Africa", "Asia", "Europe", "North_America", "Oceania", "South_America"):
                continue
            iso = SECTION_ISO.get(sec) or from_name(sec.replace("_", " ")) or iso
            continue
        li = re.sub(r'<sup[^>]*class="[^"]*reference.*?</sup>', "", m.group(2), flags=re.S)
        li = re.sub(r"<ul.*", "", li, flags=re.S)  # 巢狀清單（附註）不算
        links = [urllib.parse.unquote(h).replace("_", " ") for h in
                 re.findall(r'href="(?:https://en\.wikipedia\.org)?(?:/wiki/|\./)([^"#?]+)"', li)]
        txt = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", li))).strip()
        y = re.search(r"\((\d{4}|\?{4}|c\. ?\d{4})\s*[–-]\s*(\d{4}|\?{4})\)", txt)
        if not txt or not iso:
            continue
        name = txt.split(",")[0].split(" (")[0].strip()
        opened = int(re.sub(r"\D", "", y.group(1))) if y and re.search(r"\d", y.group(1)) else None
        closed = int(y.group(2)) if y and y.group(2).isdigit() else None
        items.append({"name": name, "text": txt, "links": links, "iso3": iso, "opened": opened, "closed": closed})
    return items


def build() -> None:
    parks = _areas()
    parks.sort(key=lambda p: (-p["rc"], -p["ha"]))
    write_json(OUT / "park-area.json", {**points_file(parks, ["lon", "lat", "ha", "rc", "iso3", "osm", "name", "zh"],
                                                      {"lon": 0.0001, "lat": 0.0001, "ha": 0.1, "rc": 1},
                                                      strings=("iso3", "osm")), "license": "ODbL 1.0"})
    with_rc = [p for p in parks if p["rc"]]
    print(f"  OSM 樂園的面：{len(parks)} 座（1 公頃以上）、{len(Counter(p['iso3'] for p in parks))} 國；有雲霄飛車的 {len(with_rc)} 座、"
          f"共 {sum(p['rc'] for p in parks)} 座雲霄飛車")
    print("    雲霄飛車最多：" + "、".join(f"{p['name']}（{p['iso3']}）{p['rc']} 座 {p['ha']} 公頃" for p in parks[:10]))
    big = sorted(parks, key=lambda p: -p["ha"])[:8]
    print("    面積最大：" + "、".join(f"{p['name']}（{p['iso3']}）{p['ha']:,.0f} 公頃" for p in big))
    print("    台灣：" + "、".join(f"{p['name']} {p['ha']} 公頃 {p['rc']} 座" for p in parks if p["iso3"] == "TWN"))

    items = _defunct()
    coords = wiki_items([t for it in items for t in it["links"]])
    pts = []
    for it in items:
        lon = lat = None
        prec = 0
        for j, t in enumerate(it["links"]):
            c = coords.get(t[0].upper() + t[1:])
            if c and c["lon"] is not None:
                lon, lat, prec = c["lon"], c["lat"], 0 if j == 0 else 1
                zh = c["zh"] if j == 0 else None
                break
        if lon is None:
            continue
        pts.append({"lon": lon, "lat": lat, "o": it["opened"], "c": it["closed"] or 0, "ct": prec, "iso3": it["iso3"],
                    "name": it["name"], "zh": zh})
    pts.sort(key=lambda p: (p["c"] or 0))
    write_json(OUT / "defunct.json", {**points_file(pts, ["lon", "lat", "o", "c", "ct", "iso3", "name", "zh"],
                                                    {"lon": 0.0001, "lat": 0.0001, "o": 1, "c": 1, "ct": 1}, strings=("iso3",)),
                                      "license": "CC BY-SA 4.0"})
    by = Counter(it["iso3"] for it in items)
    write_json(OUT / "defunct-count.json", indicator_file(
        "defunct", "座", [2026], {k: [v] for k, v in sorted(by.items())}, license="CC BY-SA 4.0",
        attribution="English Wikipedia, “List of defunct amusement parks”"))
    years = [it["closed"] for it in items if it["closed"]]
    print(f"  已關閉的樂園：條列 {len(items)} 筆、{len(by)} 國（{by.most_common(8)}）；有關園年 {len(years)} 筆、有座標 {len(pts)} 筆"
          f"（城市座標 {sum(p['ct'] for p in pts)}）；台灣 {[it['text'] for it in items if it['iso3'] == 'TWN']}")
    dec = Counter(y // 10 * 10 for y in years)
    print("    依年代關園：" + "、".join(f"{d}s {n}" for d, n in sorted(dec.items())))
