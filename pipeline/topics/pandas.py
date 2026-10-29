"""熊貓外交（新主題，國際類，2026-10-29）：中國贈送或租借大熊貓到哪些國家的哪些動物園，依年份累積。

**資料**：sources/panda_diplomacy.py 依英文維基百科三個條目（固定版本）手工整理的表（CC BY-SA 4.0，這裡的資料檔同樣用
CC BY-SA 4.0 分享）。動物園的座標與中文名稱：Wikidata（CC0），用英文維基條目名稱對到的項目；條目沒寫是哪個動物園的
（蘇聯 1957、日本 1972、法國 1973）畫在首都（晝夜與季節主題的首都檔）。

**輸出**（public/data/topics/pandas/）：zoos.json（點：每一次到某個動物園）、arcs.json（從中國畫過去的大圓弧線）、
received.json（各國到這一年為止收到熊貓的次數，同一個動物園先贈送後租借算兩次）。時間軸 1941–2026，點與弧線依開始的年份累積出現。
"""
from __future__ import annotations

import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, lines_file, now_iso, points_file, write_json
from sources.panda_diplomacy import ORIGIN, ORIGIN_ROC, PLACEMENTS, GIFT_ROC
from topics.taipei_view import destination, distance_bearing, unwrap

OUT = OUT_DIR / "topics" / "pandas"
FIRST_YEAR, LAST_YEAR = 1941, 2026
SPARQL = "https://query.wikidata.org/sparql"
# Wikidata 的中文名稱改成台灣用語、官方名稱或改掉繁簡轉換的錯字
ZOO_ZH = {
    "Taipei Zoo": "臺北市立動物園",
    "San Diego Zoo": "聖地牙哥動物園",
    "Pairi Daiza": "天堂動物園（Pairi Daiza）",
    "Ähtäri Zoo": "艾赫泰里動物園",
    "Toledo Zoo & Aquarium": "托雷多動物園",
    "Adventure World (Japan)": "白濱冒險大世界",
}


def zoos(titles: set[str]) -> dict[str, dict]:
    """英文維基條目名稱 → {lon, lat, zh}"""
    path = CACHE_DIR / "wikidata" / "panda-zoos.json"
    if not path.exists():
        values = " ".join(json.dumps(t) + "@en" for t in sorted(titles))
        query = f"""SELECT ?title ?coord ?zhtw ?zhhant ?zh WHERE {{
          VALUES ?title {{ {values} }}
          ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
          ?item wdt:P625 ?coord .
          OPTIONAL {{ ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }}
          OPTIONAL {{ ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }}
          OPTIONAL {{ ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }}
        }}"""
        req = urllib.request.Request(SPARQL, data=urllib.parse.urlencode({"query": query}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
        for attempt in range(6):
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(r.read())
                break
            except urllib.error.HTTPError as err:
                if err.code not in (429, 500, 502, 503, 504):
                    raise
                time.sleep(15 * (attempt + 1))
    from opencc import OpenCC

    s2twp = OpenCC("s2twp")
    out: dict[str, dict] = {}
    for r in json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]:
        title = r["title"]["value"]
        if title in out:
            continue
        lon, lat = r["coord"]["value"][6:-1].split()
        zh = (r.get("zhtw") or r.get("zhhant") or {}).get("value") or (s2twp.convert(r["zh"]["value"]) if "zh" in r else None)
        out[title] = {"lon": float(lon), "lat": float(lat), "zh": zh}
    return out


def arc(a: tuple[float, float], b: tuple[float, float]) -> list[tuple[float, float]]:
    d, bearing = distance_bearing(a[0], a[1], b[0], b[1])
    n = max(2, math.ceil(d / 150))
    return unwrap([destination(a[0], a[1], bearing, d * i / n) for i in range(n + 1)])


def build() -> None:
    titles = {p[0] for p in PLACEMENTS if p[0]}
    found = zoos(titles)
    missing = sorted(titles - set(found))
    if missing:
        raise RuntimeError(f"Wikidata 找不到這些動物園的座標：{missing}")
    with open(OUT_DIR / "topics" / "daylight" / "capitals.json", encoding="utf-8") as f:
        caps = json.load(f)["capitals"]

    points, lines, records = [], [], []
    counts: dict[str, dict[int, int]] = {}
    for i, (title, iso3, start, end, kind, names, zh, en, src) in enumerate(PLACEMENTS):
        if title:
            z = found[title]
            lon, lat, zoo_zh, zoo_en = z["lon"], z["lat"], ZOO_ZH.get(title, z["zh"]), title.split(" (")[0]
        else:
            lat, lon = caps[iso3][0], caps[iso3][1]
            zoo_zh, zoo_en = None, None
        row = {"lon": round(lon, 3), "lat": round(lat, 3), "a": start, "e": end, "k": kind, "iso3": iso3, "i": i,
               "zoo": zoo_en, "zooZh": zoo_zh, "names": names or None, "zh": zh, "en": en, "src": src}
        points.append(row)
        lines.append(arc(ORIGIN_ROC if kind == GIFT_ROC else ORIGIN, (lon, lat)))
        records.append({"a": start, "k": kind, "i": i})
        counts.setdefault(iso3, {})
        counts[iso3][start] = counts[iso3].get(start, 0) + 1
    years = list(range(FIRST_YEAR, LAST_YEAR + 1))
    received = {}
    for iso3, by in sorted(counts.items()):
        total, series = 0, []
        for y in years:
            total += by.get(y, 0)
            series.append(total if total else None)
        received[iso3] = series
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "zoos.json", points_file(
        points, ["lon", "lat", "a", "e", "k", "iso3", "i", "zoo", "zooZh", "names", "zh", "en", "src"],
        {"lon": 0.001, "lat": 0.001, "a": 1, "e": 1, "k": 1, "i": 1}))
    write_json(OUT / "arcs.json", lines_file(lines, 0.01, [r["k"] for r in records], records=records,
                                             record_fields=["a", "k", "i"], record_scale={"a": 1, "k": 1, "i": 1}))
    write_json(OUT / "received.json", indicator_file("received", "次", years, received, license="CC BY-SA 4.0"))
    write_json(OUT / "manifest.json", {
        "topic": "pandas", "generatedAt": now_iso(), "license": "CC BY-SA 4.0",
        "sources": ["en.wikipedia.org Panda diplomacy revid 1379504972", "List of giant pandas revid 1382419942",
                    "Tuan Tuan and Yuan Yuan revid 1382543516", "Wikidata (zoo coordinates and Chinese names, CC0)"],
    })
    by_kind: dict[int, int] = {}
    for p in points:
        by_kind[p["k"]] = by_kind.get(p["k"], 0) + 1
    print(f"  {len(points)} 筆、{len(counts)} 個國家與地區；種類 {by_kind}")
    print(f"  中文名稱：{sum(1 for z in found.values() if z['zh'])} / {len(found)} 個動物園")
    for t, z in sorted(found.items()):
        print(f"    {t}：{z['zh']}")


if __name__ == "__main__":
    build()
