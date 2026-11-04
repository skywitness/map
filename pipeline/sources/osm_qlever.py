"""OpenStreetMap 經 QLever 的 SPARQL（https://qlever.dev/api/osm-planet；製作手冊第二十一批的 OSM 題目共用）。

- 使用者 2026-11-04 決定照自律做法用：一個標籤一支查詢、加重試、不併發；結果存在 `.cache/osm-qlever/`，
  輸出成 repo 的靜態檔，前端不直接打 QLever（弗萊堡大學的共用學術服務，沒有條款頁，服務條款待確認）。
  Overpass 從 cloud 連不上，而且它的使用政策把全球掃描列為濫用，不用。
- 資料是 ODbL 1.0（© OpenStreetMap contributors）：各國的計數是 Produced Work；點的清單（名稱、座標）是
  Derivative Database，輸出的資料檔依 ODbL 分享（DESIGN.md 第 8 節第 12 點）。
- 國家：OSM 的 admin_level=2、boundary=administrative、有 ISO3166-1 標籤的 relation（`ogc:sfContains` 是 QLever
  預先算好的空間關係）。同一個物件落在兩個重疊的國界裡（例如克里米亞）兩邊都算。
- 一家店同時畫成 node 與 way 的會算兩次（少見）。
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from common import CACHE_DIR, USER_AGENT
from sources.countries import from_alpha2

ENDPOINT = "https://qlever.dev/api/osm-planet"
PREFIXES = """PREFIX osmkey: <https://www.openstreetmap.org/wiki/Key:>
PREFIX ogc: <http://www.opengis.net/rdf#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
"""
COUNTRIES = """{ SELECT ?country ?iso WHERE {
    ?country osmkey:admin_level 2 ; osmkey:boundary "administrative" ; <https://www.openstreetmap.org/wiki/Key:ISO3166-1> ?iso .
    FILTER(STRSTARTS(STR(?country), "https://www.openstreetmap.org/relation/"))
  } }
  ?country ogc:sfContains ?x ."""


def query(sparql: str, name: str) -> list[dict]:
    """跑一支查詢（有快取就用快取），回傳 bindings。失敗等 60、120… 秒再試，最多 6 次。"""
    path = CACHE_DIR / "osm-qlever" / f"{name}.json"
    if not path.exists():
        req = urllib.request.Request(
            ENDPOINT, data=urllib.parse.urlencode({"query": PREFIXES + sparql}).encode(),
            headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
        for attempt in range(6):
            try:
                print(f"  QLever：{name}", flush=True)
                with urllib.request.urlopen(req, timeout=600) as r:
                    data = r.read()
                json.loads(data)  # 不是 JSON 就當失敗
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                break
            except (urllib.error.HTTPError, urllib.error.URLError, ConnectionError, TimeoutError, ValueError) as err:
                wait = 60 * (attempt + 1)
                print(f"    QLever：{err}，等 {wait} 秒", flush=True)
                time.sleep(wait)
        else:
            raise RuntimeError(f"QLever 一直失敗（{name}），稍後再跑")
    return json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]


def counts(key: str, value: str) -> dict[str, int]:
    """每個國家有幾個 key=value 的物件（node、way、relation 都算）"""
    rows = query(f"""SELECT ?iso (COUNT(DISTINCT ?x) AS ?n) WHERE {{
  {COUNTRIES}
  ?x osmkey:{key} "{value}" .
}} GROUP BY ?iso""", f"count-{key}-{value}")
    out: dict[str, int] = {}
    for r in rows:
        iso3 = from_alpha2(r["iso"]["value"])
        if iso3:
            out[iso3] = out.get(iso3, 0) + int(r["n"]["value"])
    return out


def features(key: str, value: str, extra: tuple[str, ...] = ("name",), iso2: str | None = None) -> list[dict[str, str]]:
    """key=value 的每個物件：osm（網址）、iso3、wkt（幾何）與 extra 列的標籤（沒有的是空字串）；iso2 只查一個國家"""
    optional = "\n  ".join(f"OPTIONAL {{ ?x osmkey:{k} ?{k.replace(':', '_')} }}" for k in extra)
    only = f'FILTER(?iso = "{iso2}")' if iso2 else ""
    rows = query(f"""SELECT ?x ?iso ?wkt {' '.join('?' + k.replace(':', '_') for k in extra)} WHERE {{
  {COUNTRIES}
  {only}
  ?x osmkey:{key} "{value}" ; geo:hasGeometry/geo:asWKT ?wkt .
  {optional}
}}""", f"features-{key}-{value}" + (f"-{iso2}" if iso2 else ""))
    out = []
    for r in rows:
        iso3 = from_alpha2(r["iso"]["value"])
        if not iso3:
            continue
        item = {"osm": r["x"]["value"], "iso3": iso3, "wkt": r["wkt"]["value"]}
        for k in extra:
            item[k] = r.get(k.replace(":", "_"), {}).get("value", "")
        out.append(item)
    return out


def centroid(wkt: str) -> tuple[float, float] | None:
    """WKT 的代表點：POINT 直接用，其他取所有頂點的平均（潛點、攀岩場有面、線，只要一個點畫在地圖上）"""
    nums = re.findall(r"(-?\d+(?:\.\d+)?(?:[eE]-?\d+)?) (-?\d+(?:\.\d+)?(?:[eE]-?\d+)?)", wkt)
    if not nums:
        return None
    xs = [float(a) for a, _ in nums]
    ys = [float(b) for _, b in nums]
    return sum(xs) / len(xs), sum(ys) / len(ys)
