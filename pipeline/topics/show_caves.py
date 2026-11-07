"""地下觀光：觀光洞穴、觀光礦坑與地下景點（新主題，2026-11-07，製作手冊第二十四批 438；步驟 show-caves，輸出 topics/show-caves/）。

- 各國的數量：showcaves.com 的統計頁（https://www.showcaves.com/english/explain/Index/Statistics.php，原本的 .html
  轉到 .php；頁面寫「entries as of 07-NOV-2026」）。站長 Jochen Duckeck 的條款：「All photos, images and texts on this
  site which were produced by Jochen Duckeck are public domain or CC0. You can use them in any way you like.」
  （同頁另註有些內容是第三方的；這裡只用他自己做的統計表）。robots.txt 只禁 /foreign/、/php/、/js/ 這類路徑，統計頁可以讀。
  七類：Showcaves（對外開放、售票導覽的觀光洞穴）、Caves（非商業洞穴）、Karst Features（岩溶地形）、Springs（大型岩溶泉）、
  Mines（觀光礦坑）、Subterranea（地下城、防空洞、地下教堂、下水道導覽這類地下設施）、Gorges（觀光峽谷）。
  玩笑條目（Matrix、Middle-Earth、Molvanîa）與最後的合計列不算。站方寫約 75 處已關閉但仍列入。
- 點：Wikidata（CC0，經 QLever）的觀光洞穴（show cave Q2232001 與子類別）與觀光礦坑（show mine Q1506469 與子類別）、
  有座標的；OpenStreetMap（ODbL 1.0，經 QLever）同時標 natural=cave_entrance 與 tourism=attraction 的洞口。
  OSM 的洞口嚴重反映洞穴探勘社團的測繪程度，只畫點、不算國家；台灣 OSM 標成景點的洞窟多半是免費的洞窟景點與洞窟廟，
  不是售票導覽的觀光洞穴，說明寫明。
"""
from __future__ import annotations

import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from common import CACHE_DIR, OUT_DIR, USER_AGENT, download, indicator_file, points_file, write_json, write_manifest_part
from sources import osm_qlever
from sources.countries import from_alpha2, from_name
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "show-caves"
URL = "https://www.showcaves.com/english/explain/Index/Statistics.php"
YEAR = 2026
QLEVER = "https://qlever.dev/api/wikidata"
SHOW_CAVE, SHOW_MINE = "Q2232001", "Q1506469"
# 統計表的欄 → 子項目 id（src/topics/show-caves.ts 的 ITEMS）
COLUMNS = {"Showcaves": "showcaves", "Caves": "caves", "Karst Features": "karst", "Springs": "springs",
           "Mines": "mines", "Subterranea": "subterranea", "Gorges": "gorges"}
JOKES = {"Matrix", "Middle-Earth", "Molvanîa"}
NAMES = {"Antigua & Barbuda": "ATG", "México": "MEX", "Perú": "PER", "République Démocratique du Con": "COD",
         "République du Congo": "COG"}
WD_QUERY = """PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?item ?kind ?coord ?iso ?sl ?en ?mul ?zhtw ?zhhant ?zh WHERE {
  VALUES ?kind { wd:%s wd:%s }
  ?item wdt:P31/wdt:P279* ?kind ; wdt:P625 ?coord ; wikibase:sitelinks ?sl .
  OPTIONAL { ?item wdt:P17 ?c . ?c wdt:P297 ?iso }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
  OPTIONAL { ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
}""" % (SHOW_CAVE, SHOW_MINE)
OSM_QUERY = """SELECT ?x ?iso ?wkt ?name ?nameen ?namezh WHERE {
  %s
  ?x osmkey:natural "cave_entrance" ; osmkey:tourism "attraction" ; geo:hasGeometry/geo:asWKT ?wkt .
  OPTIONAL { ?x osmkey:name ?name }
  OPTIONAL { ?x <https://www.openstreetmap.org/wiki/Key:name:en> ?nameen }
  OPTIONAL { ?x <https://www.openstreetmap.org/wiki/Key:name:zh> ?namezh }
}""" % osm_qlever.COUNTRIES


def _qlever(query: str, name: str) -> list[dict]:
    path = CACHE_DIR / "wikidata" / f"{name}.json"
    if not path.exists():
        req = urllib.request.Request(QLEVER, data=urllib.parse.urlencode({"query": query}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
        for attempt in range(6):
            try:
                with urllib.request.urlopen(req, timeout=600) as r:
                    data = r.read()
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                break
            except (urllib.error.HTTPError, urllib.error.URLError, ConnectionError, TimeoutError) as err:
                wait = int(getattr(err, "headers", {}) and err.headers.get("Retry-After") or 60 * (attempt + 1))
                print(f"    QLever：{err}，等 {wait} 秒", flush=True)
                time.sleep(wait)
        else:
            raise RuntimeError("QLever 一直失敗，稍後再跑")
    return json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]


def _table() -> tuple[dict[str, dict[str, int]], str]:
    page = download(URL, "showcaves", "statistics.html").read_text(encoding="utf-8", errors="replace")
    asof = re.search(r"entries as of ([0-9A-Z-]+)", html.unescape(re.sub(r"<[^>]+>", " ", page)))
    table = re.findall(r"<table.*?</table>", page, re.S)[0]
    rows = re.findall(r"<tr.*?</tr>", table, re.S)
    cells = lambda r: [html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, re.S)]
    head = cells(rows[0])
    out: dict[str, dict[str, int]] = {}
    for r in rows[1:]:
        c = cells(r)
        if not c or c[0] in JOKES or c[0] == "Countries" or c[0].endswith("countries"):
            continue
        iso3 = NAMES.get(c[0]) or from_name(c[0])
        if not iso3:
            raise RuntimeError(f"showcaves.com：認不得國名 {c[0]!r}")
        out[iso3] = {COLUMNS[h]: int(v) for h, v in zip(head[1:], c[1:]) if h in COLUMNS}
    return out, asof.group(1) if asof else ""


def _point(wkt: str) -> tuple[float, float] | None:
    m = re.match(r"POINT\(([-\d.eE]+) ([-\d.eE]+)\)", wkt)
    return (float(m.group(1)), float(m.group(2))) if m else osm_qlever.centroid(wkt)


def build() -> None:
    table, asof = _table()
    (OUT / "counts").mkdir(parents=True, exist_ok=True)
    nv = {"TWN": "showcaves.com 沒有台灣的條目"}
    nv_en = {"TWN": "showcaves.com has no entries for Taiwan"}
    for item in [*COLUMNS.values(), "total"]:
        vals = {c: [sum(v.values()) if item == "total" else v[item]] for c, v in sorted(table.items())}
        vals = {c: v for c, v in vals.items() if v[0]}
        write_json(OUT / "counts" / f"{item}.json", indicator_file("show-caves", "處", [YEAR], vals, noValue=nv, noValueEn=nv_en,
                                                                   license="CC0"), quiet=True)

    # Wikidata 的觀光洞穴與觀光礦坑
    rows = _qlever(WD_QUERY, "show-caves")
    seen: dict[str, dict] = {}
    for r in rows:
        q = r["item"]["value"].rsplit("/", 1)[1]
        kind = 1 if r["kind"]["value"].endswith(SHOW_CAVE) else 2
        pt = _point(r["coord"]["value"])
        if not pt:
            continue
        d = seen.setdefault(q, {"q": q, "lon": pt[0], "lat": pt[1], "k": kind, "sl": int(r["sl"]["value"]),
                                "iso3": from_alpha2(r.get("iso", {}).get("value")),
                                "en": (r.get("en") or r.get("mul") or {}).get("value"),
                                "hant": next((r[k]["value"] for k in ("zhtw", "zhhant") if k in r), None),
                                "hans": r.get("zh", {}).get("value")})
        d["k"] = min(d["k"], kind)  # 同時是洞穴與礦坑的算洞穴
    for q, d in seen.items():
        d["zh"] = wikidata_zh(d.pop("hant"), d.pop("hans"), place=True)
        if not d["en"] and not d["zh"]:
            d["en"] = q
    wd = sorted(seen.values(), key=lambda d: d["lon"])
    write_json(OUT / "wikidata.json", points_file(wd, ["lon", "lat", "q", "k", "sl", "iso3", "en", "zh"],
                                                  {"lon": 0.0001, "lat": 0.0001}, delta=("lon",), strings=("iso3",)))

    # OSM 標成景點的洞口
    osm_rows = osm_qlever.query(OSM_QUERY, "cave-entrance-attraction")
    osm: dict[str, dict] = {}
    for r in osm_rows:
        pt = _point(r["wkt"]["value"])
        iso3 = from_alpha2(r["iso"]["value"])
        if not pt or not iso3:
            continue
        osm.setdefault(r["x"]["value"], {"lon": pt[0], "lat": pt[1], "iso3": iso3,
                                         "name": r.get("name", {}).get("value"), "en": r.get("nameen", {}).get("value"),
                                         "zh": r.get("namezh", {}).get("value")})
    op = sorted(osm.values(), key=lambda d: d["lon"])
    write_json(OUT / "osm.json", points_file(op, ["lon", "lat", "iso3", "name", "en", "zh"], {"lon": 0.0001, "lat": 0.0001},
                                             delta=("lon",), strings=("iso3",)))
    osm_count: dict[str, int] = {}
    for d in op:
        osm_count[d["iso3"]] = osm_count.get(d["iso3"], 0) + 1
    write_manifest_part(OUT, "show-caves", "show-caves", {"sources": [
        URL + f" (CC0, entries as of {asof})", "Wikidata (CC0) via QLever", "© OpenStreetMap contributors (ODbL 1.0), via QLever"]})

    tot = {k: sum(v[k] for v in table.values()) for k in COLUMNS.values()}
    print(f"  showcaves.com（{asof}）：{len(table)} 國；{tot}")
    for k in ("showcaves", "mines", "subterranea"):
        top = sorted(table.items(), key=lambda kv: -kv[1][k])[:12]
        print(f"    {k}：{[(c, v[k]) for c, v in top]}；有的國家 {sum(1 for v in table.values() if v[k])}")
    top = sorted(table.items(), key=lambda kv: -sum(kv[1].values()))[:8]
    print(f"    七類合計：{[(c, sum(v.values())) for c, v in top]}")
    from collections import Counter
    print(f"  Wikidata：{len(wd)}（洞穴 {sum(1 for d in wd if d['k'] == 1)}、礦坑 {sum(1 for d in wd if d['k'] == 2)}）；"
          f"國家 {Counter(d['iso3'] for d in wd).most_common(8)}；台灣 {sum(1 for d in wd if d['iso3'] == 'TWN')}")
    print(f"    最多語言：{[(d['zh'] or d['en'], d['sl']) for d in sorted(wd, key=lambda d: -d['sl'])[:15]]}")
    print(f"  OSM 洞口＋景點：{len(op)}、{len(osm_count)} 國；{Counter(osm_count).most_common(10)}；台灣 {osm_count.get('TWN')}")
    print(f"    台灣：{[d['zh'] or d['name'] for d in op if d['iso3'] == 'TWN']}")
