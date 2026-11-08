"""OpenStreetMap 經 QLever 的 SPARQL（https://qlever.dev/api/osm-planet；製作手冊第二十一批的 OSM 題目共用）。

- 使用者 2026-11-04 決定照自律做法用：一個標籤一支查詢、加重試、不併發；結果存在 `.cache/osm-qlever/`，
  輸出成 repo 的靜態檔，前端不直接打 QLever（弗萊堡大學的共用學術服務，沒有條款頁，服務條款待確認）。
  Overpass 從 cloud 連不上，而且它的使用政策把全球掃描列為濫用，不用。
- 資料是 ODbL 1.0（© OpenStreetMap contributors）：各國的計數是 Produced Work；點的清單（名稱、座標）是
  Derivative Database，輸出的資料檔依 ODbL 分享（DESIGN.md 第 8 節第 12 點）。
- 國家：OSM 的 admin_level=2、boundary=administrative、有 ISO3166-1 標籤的 relation（`ogc:sfContains` 是 QLever
  預先算好的空間關係）。同一個物件落在兩個重疊的國界裡（例如克里米亞）兩邊都算。
- **子屬地分開算（製作手冊 1-f，使用者 2026-11-08）**：OSM 把香港、澳門、法國的海外屬地、荷蘭的三島、奧蘭、美國與澳洲的
  幾個屬地畫在母國的 admin_level 2 國界裡（它們自己是 admin_level 3 或 4），用座標判國的 `geoindex.py`（Natural Earth）
  卻分開算。為了全站口徑一致，`SUB_TERRITORIES` 這 20 個地區另外查一支「只看子屬地」的小查詢（`sub_objects()`，不帶幾何），
  點資料依物件改判國家，計數從母國**減掉**（不是放寬 admin_level，那會讓同一個物件算兩次）。法國的 5 個海外省（留尼旺、
  瓜地洛普、馬提尼克、法屬圭亞那、馬約特）geoindex 也算進法國，照舊。子屬地的查詢比母國原本的計數晚，兩次之間新增或刪掉的
  物件會讓母國差幾個。
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
# 跟 geoindex.py 一致、要從母國分出來的地區（OSM 的 ISO3166-1 標籤；每個代碼只有一個 relation，2026-11-08 查過）
SUB_TERRITORIES = (
    "HK", "MO",  # 中國
    "NC", "PF", "WF", "MF", "BL", "PM", "TF",  # 法國（海外屬地；5 個海外省不分）
    "CW", "AW", "SX",  # 荷蘭
    "AX",  # 芬蘭
    "AS", "GU", "MP", "PR", "VI",  # 美國
    "HM", "NF",  # 澳洲
)
SUBS = """?sub <https://www.openstreetmap.org/wiki/Key:ISO3166-1> ?subiso ; osmkey:boundary "administrative" .
  FILTER(?subiso IN (%s))
  FILTER(STRSTARTS(STR(?sub), "https://www.openstreetmap.org/relation/"))
  ?sub ogc:sfContains ?x .""" % ", ".join(f'"{c}"' for c in SUB_TERRITORIES)
# 子屬地裡的物件原本算在哪一國（沒有的是 OSM 母國的國界沒包到，原本就沒算）
MOTHER = """OPTIONAL { ?country osmkey:admin_level 2 ; osmkey:boundary "administrative" ;
      <https://www.openstreetmap.org/wiki/Key:ISO3166-1> ?iso .
    FILTER(STRSTARTS(STR(?country), "https://www.openstreetmap.org/relation/"))
    ?country ogc:sfContains ?x }"""


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


def sub_objects(pattern: str, name: str, extra: tuple[str, ...] = ()) -> list[dict]:
    """在子屬地裡、符合 pattern（物件是 ?x）的物件：[{osm（網址）, sub（iso3）, mother（原本算的 iso3 或 None）, extra 的變數…}]"""
    # 標籤放進內層子查詢、sfContains 在外面（手冊 566 的提醒），不然 QLever 先展開子屬地裡所有的物件，記憶體不夠（HTTP 500）
    rows = query(f"""SELECT DISTINCT ?x ?subiso ?iso {' '.join('?' + v for v in extra)} WHERE {{
  {{ SELECT ?x {' '.join('?' + v for v in extra)} WHERE {{ {pattern} }} }}
  {SUBS}
  {MOTHER}
}}""", f"sub-{name}")
    out = []
    for r in rows:
        item = {"osm": r["x"]["value"], "sub": from_alpha2(r["subiso"]["value"]),
                "mother": from_alpha2(r["iso"]["value"]) if "iso" in r else None}
        for v in extra:
            item[v] = r.get(v, {}).get("value")
        out.append(item)
    return out


def split(totals: dict[str, float], subs: list[dict], value: str | None = None) -> dict[str, float]:
    """依國家彙總的數（計數，或 value 欄的總和）→ 子屬地分開、從母國減掉"""
    out = dict(totals)
    for s in subs:
        v = float(s[value] or 0) if value else 1
        out[s["sub"]] = out.get(s["sub"], 0) + v
        if s["mother"]:
            out[s["mother"]] = out.get(s["mother"], 0) - v
    bad = {c: v for c, v in out.items() if v < -1e-6}
    if bad:
        raise RuntimeError(f"從母國減掉子屬地後變成負的：{bad}")
    return {c: v for c, v in out.items() if v > 1e-9 or c in totals}


def relocate(items: list[dict], subs: list[dict], key: str = "osm") -> list[dict]:
    """點資料（有 iso3 與物件網址）→ 落在子屬地裡的改成子屬地的代碼"""
    where = {s["osm"]: s["sub"] for s in subs}
    for it in items:
        if it[key] in where:
            it["iso3"] = where[it[key]]
    return items


def export(sparql: str, name: str):
    """大的查詢（幾十 MB 以上，例如路線的幾何）：結果用 TSV 串流存到快取，回傳快取檔的路徑；重試同 query()"""
    path = CACHE_DIR / "osm-qlever" / f"{name}.tsv"
    if path.exists():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".part")
    req = urllib.request.Request(
        ENDPOINT, data=urllib.parse.urlencode({"query": PREFIXES + sparql}).encode(),
        headers={"User-Agent": USER_AGENT, "Accept": "text/tab-separated-values"})
    for attempt in range(6):
        try:
            print(f"  QLever：{name}（TSV）", flush=True)
            with urllib.request.urlopen(req, timeout=1200) as r, open(tmp, "wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            tmp.replace(path)
            return path
        except (urllib.error.HTTPError, urllib.error.URLError, ConnectionError, TimeoutError) as err:
            wait = 60 * (attempt + 1)
            print(f"    QLever：{err}，等 {wait} 秒", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"QLever 一直失敗（{name}），稍後再跑")


def tsv_value(cell: str) -> str:
    """TSV 的格子 → 字串：去掉 RDF 字面值的引號與型別、語言標記；網址去掉角括號"""
    if cell.startswith("<") and cell.endswith(">"):
        return cell[1:-1]
    m = re.match(r'^"(.*)"(?:\^\^<[^>]*>|@[\w-]+)?$', cell, re.S)
    if not m:
        return cell
    return m.group(1).replace('\\"', '"').replace("\\t", "\t").replace("\\n", "\n").replace("\\\\", "\\")


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
    subs = sub_objects(f'?x osmkey:{key} "{value}" .', f"{key}-{value}")
    return {c: int(round(v)) for c, v in split(out, subs).items()}


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
    relocate(out, sub_objects(f'?x osmkey:{key} "{value}" .', f"{key}-{value}"))
    if iso2:  # 只查一個國家：改判到子屬地的不算
        out = [it for it in out if it["iso3"] == from_alpha2(iso2)]
    return out


def centroid(wkt: str) -> tuple[float, float] | None:
    """WKT 的代表點：POINT 直接用，其他取所有頂點的平均（潛點、攀岩場有面、線，只要一個點畫在地圖上）"""
    nums = re.findall(r"(-?\d+(?:\.\d+)?(?:[eE]-?\d+)?) (-?\d+(?:\.\d+)?(?:[eE]-?\d+)?)", wkt)
    if not nums:
        return None
    xs = [float(a) for a, _ in nums]
    ys = [float(b) for _, b in nums]
    return sum(xs) / len(xs), sum(ys) / len(ys)
