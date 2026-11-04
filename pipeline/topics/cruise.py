"""航運與港口：郵輪的船籍與母港（2026-11-04，製作手冊第二十一批 358）。

- Wikidata（CC0）的郵輪（P31 = Q39804）：船籍國（P8047，取國家的 ISO 代碼 P298）、母港（P504，座標 P625）、載客量（P1083）。
  query.wikidata.org 會回 429，用 QLever 的 Wikidata 鏡像（同觀光鐵道）。同一艘船有好幾個船籍（換過旗）時每個都算，
  所以各國艘數的合計比船數多一點。只有 Wikidata 有寫的才算，不是完整的船隊名冊（CLIA 的網站 403、條款讀不到，不用）。
- 母港畫成點，大小是母港在這裡的郵輪艘數；Wikidata 的港口資料偏斜，只當參考。
- 台灣：臺灣港務公司「臺灣地區國際商港旅客人數」（政府資料開放授權條款，每月），加總成年的郵輪母港與掛靠港人次，
  寫在台灣的附註；台灣沒有掛國旗的郵輪。
"""
from __future__ import annotations

import csv
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, USER_AGENT, download, indicator_file, points_file, write_json
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "shipping"
ENDPOINT = "https://qlever.dev/api/wikidata"
YEAR = 2026
TWPORT = "https://www.twport.com.tw/fapi/opendata?id=13879&format=csv"
QUERY = """PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?ship ?flagIso ?port ?portCoord ?portEn ?portZh ?cap WHERE {
  ?ship wdt:P31 wd:Q39804 .
  OPTIONAL { ?ship wdt:P8047 ?flag . ?flag wdt:P298 ?flagIso }
  OPTIONAL { ?ship wdt:P504 ?port . OPTIONAL { ?port wdt:P625 ?portCoord }
             OPTIONAL { ?port rdfs:label ?portEn FILTER(LANG(?portEn) = "en") }
             OPTIONAL { ?port rdfs:label ?portZh FILTER(LANG(?portZh) = "zh-tw" || LANG(?portZh) = "zh-hant" || LANG(?portZh) = "zh") } }
  OPTIONAL { ?ship wdt:P1083 ?cap }
}"""


def _fetch() -> list[dict]:
    path = CACHE_DIR / "wikidata" / "cruise-ships.json"
    if not path.exists():
        req = urllib.request.Request(ENDPOINT, data=urllib.parse.urlencode({"query": QUERY}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
        for attempt in range(6):
            try:
                with urllib.request.urlopen(req, timeout=300) as r:
                    data = r.read()
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                break
            except (urllib.error.HTTPError, urllib.error.URLError, ConnectionError, TimeoutError) as err:
                print(f"    QLever：{err}，等 {60 * (attempt + 1)} 秒", flush=True)
                time.sleep(60 * (attempt + 1))
        else:
            raise RuntimeError("QLever 一直失敗，稍後再跑")
    return json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]


def _taiwan() -> tuple[int, int, int]:
    rows = list(csv.DictReader(open(download(TWPORT, "twport", "passengers.csv"), encoding="utf-8-sig")))
    by_year: dict[int, list[int]] = defaultdict(lambda: [0, 0, 0])
    for r in rows:
        y = int(r["年月"][:3]) + 1911
        by_year[y][0] += int(r["國際商港郵輪母港人次"] or 0)
        by_year[y][1] += int(r["國際商港郵輪掛靠港人次"] or 0)
        by_year[y][2] += 1
    full = max(y for y, v in by_year.items() if v[2] == 12)
    return full, by_year[full][0], by_year[full][1]


def build() -> None:
    rows = _fetch()
    flags: dict[str, set[str]] = defaultdict(set)
    ports: dict[str, dict] = {}
    port_ships: dict[str, set[str]] = defaultdict(set)
    for r in rows:
        ship = r["ship"]["value"]
        if "flagIso" in r and (iso3 := to_iso3(r["flagIso"]["value"])):
            flags[ship].add(iso3)
        if "port" in r and "portCoord" in r:
            pid = r["port"]["value"]
            m = re.search(r"\(\s*(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s*\)", r["portCoord"]["value"])  # Point(…) 或 POINT(…)
            if not m:
                continue
            lon, lat = m.group(1), m.group(2)
            p = ports.setdefault(pid, {"lon": float(lon), "lat": float(lat), "en": "", "zh": ""})
            p["en"] = p["en"] or r.get("portEn", {}).get("value", "")
            p["zh"] = p["zh"] or r.get("portZh", {}).get("value", "")
            port_ships[pid].add(ship)
    count = Counter(f for s in flags.values() for f in s)
    year, home, call = _taiwan()
    write_json(OUT / "cruise-flag.json", indicator_file(
        "cruise-flag", "艘", [YEAR], {c: [n] for c, n in sorted(count.items())},
        noValue={"TWN": f"台灣沒有掛國旗的郵輪；{year} 年國際商港的郵輪旅客：母港 {home:,} 人次、掛靠港 {call:,} 人次（臺灣港務公司）"},
        noValueEn={"TWN": f"No cruise ships fly Taiwan’s flag; in {year} its international ports handled {home:,} cruise home-port and {call:,} port-of-call passenger movements (Taiwan International Ports Corporation)"}))
    points = [{"lon": p["lon"], "lat": p["lat"], "n": len(port_ships[pid]), "en": p["en"], "zh": p["zh"]}
              for pid, p in ports.items()]
    points.sort(key=lambda p: -p["n"])
    write_json(OUT / "cruise-ports.json", points_file(points, ["lon", "lat", "n", "en", "zh"], {"lon": 0.001, "lat": 0.001, "n": 1}))
    print(f"  郵輪：{len(flags)} 艘有船籍，{sum(count.values())} 個船籍；{count.most_common(10)}")
    print(f"  母港：{len(points)} 個有座標，{sum(p['n'] for p in points)} 艘次；{[(p['en'], p['n']) for p in points[:8]]}")
    print(f"  台灣 {year}：母港 {home:,}、掛靠港 {call:,}")
