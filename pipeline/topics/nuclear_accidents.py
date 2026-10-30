"""核子事故（新主題，2026-10-30，製作手冊第六批 101）：民用核電廠、反應爐、核燃料設施與輻射源的事故點。

事件表手工整理自英文維基百科三篇的固定版本（sources/nuclear_accidents.py，CC BY-SA 4.0）；座標用 Wikidata（CC0）：
每個事件的英文維基條目（設施或事件本身）在 Wikidata 的 P625，沒有的用地點（P276）或所在行政區（P131）的座標；
沒有條目的用手工的城市座標（tooltip 寫「位置是大約的」）。國家依座標判斷（今天的國界：車諾比是烏克蘭、基什特姆是俄羅斯）。

輸出：
- points.json：事件的點（年份、月、日、INES、種類、死亡人數上限、名稱、說明、死亡人數的範圍與出處）
- map.json：各國到那一年累計的事故數（不上色的指標，給 tooltip 與排名表），1952–2026 年
- manifest.json
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, now_iso, points_file, write_json
from geoindex import countries_at
from sources.nuclear_accidents import ACCIDENTS

OUT = OUT_DIR / "topics" / "nuclear-accidents"
SPARQL = "https://query.wikidata.org/sparql"
FIRST_YEAR, LAST_YEAR = 1952, 2026
QUERY = """SELECT ?title ?coord ?loc ?adm WHERE {{
  VALUES ?title {{ {titles} }}
  ?page schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
  OPTIONAL {{ ?item wdt:P625 ?coord }}
  OPTIONAL {{ ?item wdt:P276/wdt:P625 ?loc }}
  OPTIONAL {{ ?item wdt:P131/wdt:P625 ?adm }}
}}"""


def coordinates() -> dict[str, tuple[float, float]]:
    titles = sorted({a.wiki for a in ACCIDENTS if a.wiki and not a.coord})
    path = CACHE_DIR / "wikidata" / "nuclear-accidents-v2.json"
    if not path.exists():
        query = QUERY.format(titles=" ".join(json.dumps(t, ensure_ascii=False) + "@en" for t in titles))
        req = urllib.request.Request(SPARQL, data=urllib.parse.urlencode({"query": query}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
        for attempt in range(10):
            try:
                with urllib.request.urlopen(req, timeout=300) as r:
                    data = r.read()
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                break
            except (urllib.error.HTTPError, urllib.error.URLError, ConnectionError, TimeoutError) as err:
                wait = 60 * (attempt + 1)
                print(f"    Wikidata：{err}，等 {wait} 秒", flush=True)
                time.sleep(wait)
        else:
            raise RuntimeError("Wikidata 的 SPARQL 一直失敗，稍後再跑")
    best: dict[str, tuple[int, tuple[float, float]]] = {}
    for r in json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]:
        title = r["title"]["value"]
        for rank, key in enumerate(("coord", "loc", "adm")):
            v = r.get(key, {}).get("value", "")
            if v.startswith("Point(") and (title not in best or rank < best[title][0]):
                lon, lat = v[6:-1].split()
                best[title] = (rank, (float(lon), float(lat)))
    missing = [t for t in titles if t not in best]
    if missing:
        raise ValueError(f"這些條目在 Wikidata 沒有座標，請在 sources/nuclear_accidents.py 寫 coord：{missing}")
    return {t: c for t, (_, c) in best.items()}


def build() -> None:
    coords = coordinates()
    rows = []
    for a in ACCIDENTS:
        approx = a.coord is not None
        lon, lat = a.coord if a.coord else coords[a.wiki]
        parts = [int(x) for x in a.date.split("-")]
        rows.append({
            "lon": round(lon, 3), "lat": round(lat, 3), "y": parts[0], "m": parts[1] if len(parts) > 1 else None,
            "dd": parts[2] if len(parts) > 2 else None, "i": a.ines if a.ines is not None else 0, "k": a.kind,
            "d": a.deaths, "ap": 1 if approx else None, "en": a.en, "zh": a.zh, "wz": a.what_zh, "we": a.what_en,
            "dz": a.deaths_zh, "de": a.deaths_en,
        })
    for r, iso3 in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
        r["iso3"] = iso3
    rows.sort(key=lambda r: (r["y"], r["m"] or 0, r["dd"] or 0))
    fields = ["lon", "lat", "y", "m", "dd", "i", "k", "d", "ap", "iso3", "en", "zh", "wz", "we", "dz", "de"]
    scale = {"lon": 0.001, "lat": 0.001, "y": 1, "m": 1, "dd": 1, "i": 1, "k": 1, "d": 1, "ap": 1}
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "points.json", points_file(rows, fields, scale, strings=("iso3",)))
    years = list(range(FIRST_YEAR, LAST_YEAR + 1))
    by_country: dict[str, list[int]] = {}
    for r in rows:
        if r["iso3"]:
            s = by_country.setdefault(r["iso3"], [0] * len(years))
            for i, y in enumerate(years):
                if y >= r["y"]:
                    s[i] += 1
    write_json(OUT / "map.json", indicator_file("map", "起", years, {c: v for c, v in sorted(by_country.items())},
                                               aggregates={"WLD": [sum(1 for r in rows if r["y"] <= y) for y in years]}))
    write_json(OUT / "manifest.json", {
        "topic": "nuclear-accidents", "generatedAt": now_iso(),
        "sources": ["English Wikipedia (CC BY-SA 4.0): Nuclear and radiation accidents and incidents (revid 1382200054); "
                    "List of nuclear and radiation accidents by death toll (revid 1378930439); List of civilian nuclear accidents (revid 1353556789)",
                    "Wikidata (CC0) coordinates"],
        "license": "CC BY-SA 4.0",
    })
    print(f"  {len(rows)} 起事故；各國：{Counter(r['iso3'] for r in rows).most_common(8)}")
    print(f"  INES：{dict(sorted(Counter(r['i'] for r in rows).items()))}；種類：{dict(sorted(Counter(r['k'] for r in rows).items()))}")
    for r in rows:
        if r["i"] >= 5:
            print(f"    {r['y']} {r['zh']} INES {r['i']} → {r['iso3']} ({r['lon']}, {r['lat']})")


if __name__ == "__main__":
    build()
