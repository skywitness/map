"""特殊地形（新主題，地理類，2026-10-30，製作手冊第六批 75）：Wikidata 的綠洲、峽灣、天然拱門與奇岩、環礁與珊瑚島、
泥火山、天坑（滲穴）、間歇泉七類的點。

使用者 2026-10-30 決定：七類合成一個主題，用 Wikidata（CC0），不用 OpenStreetMap；泥火山、天坑資料不足也照放並附註；
台灣的野柳女王頭、烏山頂泥火山手工補（它們在 Wikidata 分別歸為「岩石地形」與「自然保留區」，不在這幾類）。

**類別**（KINDS，P31/P279* 到這些類別；一個項目符合好幾類時取前面的）：
1 綠洲 Q43742；2 峽灣 Q45776；3 天然拱門 Q954501、海蝕柱 Q747957、岩柱（hoodoo）Q854550（「岩石地形」Q631305 太廣，
有 3 萬多筆，墨西哥 1.2 萬筆是 GeoNames 匯入的，不收）；4 環礁 Q42523、珊瑚島 Q1324426；5 泥火山 Q193457；
6 滲穴 Q12807180（含天然井 cenote；中國的「天坑」沒有獨立的類別，幾乎沒收）；7 間歇泉 Q83471。

**欄位**：sl 是維基百科條目數（點的大小）；w 是有沒有英文或中文維基條目（縮小時只畫有的，挪威的小峽灣才不會蓋滿）；
d 是 P17（國家）不只一個（南海的環礁，tooltip 寫「主權有爭議」）；國家依座標判斷（geoindex，0.3° 內最近的國界），
離國界更遠的小島用 Wikidata 的 P17（只有一個國家時，ISO 代碼 P298；附近是那一國的屬地時用屬地）。
輸出 points.json（點）、map.json（不上色的指標）、count/<類別>.json（各國的數量，all 是合計）、manifest.json。
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, now_iso, points_file, write_json
from geoindex import countries_at
from sources import wikidata_attractions

OUT = OUT_DIR / "topics" / "special-landforms"
SPARQL = "https://query.wikidata.org/sparql"
YEAR = 2026
# 類別代碼（src/topics/special-landforms.ts 的 KINDS 要一致）→ 根類別
KINDS = {
    1: ["Q43742"],
    2: ["Q45776"],
    3: ["Q954501", "Q747957", "Q854550"],
    4: ["Q42523", "Q1324426"],
    5: ["Q193457"],
    6: ["Q12807180"],
    7: ["Q83471"],
}
# 手工補的台灣（使用者決定）：QID → 類別。座標、名稱照 Wikidata
HAND = {
    "Q10942787": 3,  # 野柳女王頭（Wikidata 歸為岩石地形）
    "Q16929098": 5,  # 烏山頂泥火山自然保留區（Wikidata 歸為自然保留區）
}
QUERY = """SELECT ?item ?root ?coord ?sl ?en ?mul ?zhtw ?zhhant ?zh ?enwiki ?zhwiki (COUNT(DISTINCT ?country) AS ?nc) (SAMPLE(?iso) AS ?iso3) WHERE {{
  {{ VALUES ?root {{ {roots} }} ?item wdt:P31/wdt:P279* ?root . }}
  UNION
  {{ VALUES (?item ?root) {{ {hand} }} }}
  ?item wdt:P625 ?coord ; wikibase:sitelinks ?sl .
  OPTIONAL {{ ?item wdt:P17 ?country . OPTIONAL {{ ?country wdt:P298 ?iso }} }}
  OPTIONAL {{ ?item rdfs:label ?en FILTER(LANG(?en) = "en") }}
  OPTIONAL {{ ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }}
  OPTIONAL {{ ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }}
  OPTIONAL {{ ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }}
  OPTIONAL {{ ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }}
  OPTIONAL {{ ?enwiki schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }}
  OPTIONAL {{ ?zhwiki schema:about ?item ; schema:isPartOf <https://zh.wikipedia.org/> }}
}} GROUP BY ?item ?root ?coord ?sl ?en ?mul ?zhtw ?zhhant ?zh ?enwiki ?zhwiki"""


def fetch() -> list[dict]:
    path = CACHE_DIR / "wikidata" / "special-landforms-v2.json"
    if not path.exists():
        kind_of = {q: k for k, qs in KINDS.items() for q in qs}
        query = QUERY.format(
            roots=" ".join(f"wd:{q}" for q in kind_of),
            hand=" ".join(f"(wd:{q} wd:{KINDS[k][0]})" for q, k in HAND.items()),
        )
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
    return json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]


def build() -> None:
    from opencc import OpenCC

    s2tw, s2twp = OpenCC("s2tw"), OpenCC("s2twp")
    kind_of = {q: k for k, qs in KINDS.items() for q in qs}
    items: dict[str, dict] = {}
    for r in fetch():
        q = r["item"]["value"].rsplit("/", 1)[1]
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        kind = HAND.get(q) or kind_of[v("root").rsplit("/", 1)[1]]
        d = items.setdefault(q, {"q": q, "kinds": set(), "sl": int(v("sl")), "nc": 0, "w": 0, "p17": None})
        if int(v("nc") or 0) == 1 and v("iso3"):
            d["p17"] = v("iso3")
        d["kinds"].add(kind)
        d["nc"] = max(d["nc"], int(v("nc") or 0))
        if v("enwiki") or v("zhwiki"):
            d["w"] = 1
        if "coord" not in d and (v("coord") or "").startswith("Point("):
            lon, lat = v("coord")[6:-1].split()
            d["coord"] = (float(lon), float(lat))
        for k in ("en", "mul", "zhtw", "zhhant", "zh"):
            if v(k) and not d.get(k):
                d[k] = v(k)
    names = wikidata_attractions.fallback_names(sorted(q for q, d in items.items() if not (d.get("en") or d.get("mul"))))
    rows, no_name = [], 0
    for d in items.values():
        if "coord" not in d:
            continue
        zh_raw = d.get("zhtw") or d.get("zhhant")
        zh = s2tw.convert(zh_raw) if zh_raw else (s2twp.convert(d["zh"]) if d.get("zh") else None)
        en = d.get("en") or d.get("mul") or names.get(d["q"])
        if not (en or zh):
            no_name += 1
            continue
        rows.append({
            "lon": round(d["coord"][0], 4), "lat": round(d["coord"][1], 4), "k": min(d["kinds"]),
            "sl": d["sl"], "w": d["w"], "d": 1 if d["nc"] > 1 else None,
            "en": en, "zh": zh if zh and zh != en else None, "q": d["q"], "p17": d["p17"],
        })
    # 離國界 0.3° 以外的小島（太平洋的環礁）用 Wikidata 的國家（只有一個時）；300 公里內最近的是那一國的屬地時改用屬地
    # （法屬玻里尼西亞的環礁 P17 是法國），跟地震與火山主題的火山同一個做法
    from topics.earthquakes import ISLAND_KM, TERRITORIES, OffshoreIndex

    index = None
    for r, iso3 in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
        if not iso3 and r["p17"]:
            index = index or OffshoreIndex()
            near = index.nearest(r["lon"], r["lat"], ISLAND_KM)
            iso3 = near if near in TERRITORIES.get(r["p17"], ()) else r["p17"]
        r["iso3"] = iso3
    rows.sort(key=lambda r: (r["k"], -r["sl"], r["q"]))

    fields = ["lon", "lat", "k", "sl", "w", "d", "iso3", "en", "zh"]
    scale = {"lon": 0.0001, "lat": 0.0001, "k": 1, "sl": 1, "w": 1, "d": 1}
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "points.json", points_file(rows, fields, scale, strings=("iso3",)))
    write_json(OUT / "map.json", indicator_file("map", "", [YEAR], {}))
    counts: dict[str, Counter] = defaultdict(Counter)
    for r in rows:
        if r["iso3"]:
            counts[str(r["k"])][r["iso3"]] += 1
            counts["all"][r["iso3"]] += 1
    for key, c in counts.items():
        write_json(OUT / "count" / f"{key}.json",
                   indicator_file(f"count/{key}", "處", [YEAR], {a: [n] for a, n in sorted(c.items())},
                                  aggregates={"WLD": [sum(1 for r in rows if key == "all" or str(r["k"]) == key)]}),
                   quiet=True)
    write_json(OUT / "manifest.json", {"topic": "special-landforms", "generatedAt": now_iso(), "sources": ["Wikidata (CC0)"]})

    print(f"  共 {len(rows)} 個點（沒有名稱的 {no_name} 個不收）；各類：{dict(sorted(Counter(r['k'] for r in rows).items()))}")
    for k in KINDS:
        top = Counter(r["iso3"] for r in rows if r["k"] == k).most_common(6)
        print(f"    {k}：{top}；有英文或中文條目 {sum(r['w'] for r in rows if r['k'] == k)}；主權爭議 {sum(1 for r in rows if r['k'] == k and r['d'])}")
    print(f"  台灣：{[(r['k'], r['zh'] or r['en'], r['q']) for r in rows if r['iso3'] == 'TWN']}")
    for q in HAND:
        if not any(r["q"] == q for r in rows):
            raise ValueError(f"手工補的 {q} 沒有查到（沒有座標？）")


if __name__ == "__main__":
    build()
