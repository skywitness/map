"""植物園（併進「景點地圖」的第四個圖層，輸出到 topics/attractions/，2026-10-30）。

**資料**：Wikidata（CC0）的植物園（P31 是 Q167346 或它的子類別：樹木園、玫瑰園、高山植物園…），有座標、沒有停用日期的；
座標、設立年份（P571）、維基百科條目數、英文與中文名稱，跟景點地圖同一套查詢（sources/wikidata_attractions.py 的 _sparql）。
BGCI GardenSearch 不准轉載（CC BY-NC-ND、資料使用協議不准分享），沒有用（DESIGN.md 第 8 節第 12 點）。

**類型**（兩類）：樹木園（Q272231 與子類別）、其他都是植物園（含玫瑰園、溫室、高山植物園）。
**台灣**：Wikidata 直接標成植物園的 9 處、含子類別 11 處，逐一看過（NOT_GARDENS 放被標成植物園、其實不是的）。

**輸出**：public/data/topics/attractions/gardens.json（點，欄位同其他三個圖層，多一個設立年份 y）。
不必重跑 attractions（那一步第一次要查約 40 分鐘）；幾秒。
"""
from __future__ import annotations

import json
import re
import time

from common import CACHE_DIR, OUT_DIR, now_iso, points_file, write_json
from geoindex import countries_at
from sources import wikidata_attractions as wd

OUT = OUT_DIR / "topics" / "attractions"
CACHE = CACHE_DIR / "wikidata" / "gardens.json"
GARDEN, ARBORETUM = 1, 2
ARBORETUM_ROOT = "Q272231"
QUERY = """SELECT ?item ?cls ?arb ?coord ?sl ?inc ?en ?zhtw ?zhhant ?zh ?closed WHERE {
  ?item wdt:P31 ?cls . ?cls wdt:P279* wd:Q167346 .
  BIND(EXISTS { ?cls wdt:P279* wd:Q272231 } AS ?arb)
  ?item wdt:P625 ?coord ; wikibase:sitelinks ?sl .
  OPTIONAL { ?item wdt:P571 ?inc }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
  OPTIONAL { ?item wdt:P576|wdt:P3999 ?closed }
}"""
# 被標成植物園、其實不是的（逐一看過台灣的；2026-10-30 沒有：手冊提到的安邦公園 Q10179455 沒有座標，本來就不畫）
NOT_GARDENS: dict[str, str] = {}


def fetch() -> list[dict]:
    if not CACHE.exists():
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps(wd._sparql(QUERY)), encoding="utf-8")
        time.sleep(1)
    return json.loads(CACHE.read_text(encoding="utf-8"))


def build() -> None:
    from opencc import OpenCC

    from topics.attractions import zh_name

    s2tw, s2twp = OpenCC("s2tw"), OpenCC("s2twp")
    items: dict[str, dict] = {}
    for r in fetch():
        q = r["item"]["value"].rsplit("/", 1)[1]
        d = items.setdefault(q, {"q": q, "coord": None, "sl": 0, "arb": False, "closed": False, "inc": None})
        v = r["coord"]["value"]
        if not d["coord"] and v.startswith("Point("):
            lon, lat = v[6:-1].split()
            d["coord"] = (float(lon), float(lat))
        d["sl"] = max(d["sl"], int(r["sl"]["value"]))
        d["arb"] |= r["arb"]["value"] == "true"
        d["closed"] |= "closed" in r
        m = re.match(r"(-?\d+)-", r["inc"]["value"]) if "inc" in r else None
        if m:
            d["inc"] = int(m.group(1)) if d["inc"] is None else min(d["inc"], int(m.group(1)))
        for k in ("en", "zhtw", "zhhant", "zh"):
            if k in r and not d.get(k):
                d[k] = r[k]["value"]
    rows = []
    dropped = {"closed": 0, "coord": 0, "hand": 0, "no-name": 0}
    for q, d in items.items():
        if d["closed"]:
            dropped["closed"] += 1
        elif not d["coord"]:
            dropped["coord"] += 1
        elif q in NOT_GARDENS:
            dropped["hand"] += 1
        else:
            lon, lat = d["coord"]
            rows.append({"lon": round(lon, 3), "lat": round(lat, 3), "sl": d["sl"], "q": q, "en": d.get("en"),
                         "zh": zh_name(d, s2tw, s2twp), "t": ARBORETUM if d["arb"] else GARDEN, "y": d["inc"]})
    names = wd.fallback_names(sorted(r["q"] for r in rows if not r["en"]))
    for r in rows:
        r["en"] = r["en"] or names.get(r["q"])
    named = [r for r in rows if r["en"] or r["zh"]]
    dropped["no-name"] = len(rows) - len(named)
    rows = named
    for r, iso3 in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
        r["iso3"] = iso3
        if r["zh"] == r["en"]:
            r["zh"] = None
    rows.sort(key=lambda r: (r["lon"], r["lat"], r["q"]))
    write_json(OUT / "gardens.json", points_file(rows, ["lon", "lat", "t", "sl", "y", "iso3", "en", "zh"],
                                                 {"lon": 0.001, "lat": 0.001, "t": 1, "sl": 1, "y": 1}, delta=("lon",)))
    by_country: dict[str, int] = {}
    for r in rows:
        by_country[r["iso3"] or "?"] = by_country.get(r["iso3"] or "?", 0) + 1
    top = sorted(by_country.items(), key=lambda kv: -kv[1])[:8]
    print(f"  植物園 {len(rows):,} 處（樹木園 {sum(r['t'] == ARBORETUM for r in rows)}、有設立年份 {sum(r['y'] is not None for r in rows)}）；"
          f"沒收 {dropped}；最多：{top}")
    for r in rows:
        if r["iso3"] == "TWN":
            print(f"    台灣：{r['q']} {r['zh'] or r['en']}（{r['y'] or '?'}）")
    manifest = OUT / "manifest.json"
    m = json.loads(manifest.read_text(encoding="utf-8")) if manifest.exists() else {"topic": "attractions"}
    m["counts"] = {**m.get("counts", {}), "gardens": len(rows)}
    m["gardensGeneratedAt"] = now_iso()
    m["notGardens"] = NOT_GARDENS
    write_json(manifest, m)
