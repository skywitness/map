"""國家公園（新主題，地理類，2026-10-29）：Wikidata 的國家公園（Q46169 與子類別）的點，依設立年份累積出現；
各國陸域保護區占國土的比例（世界銀行 WDI 的 ER.LND.PTLD.ZS，UNEP-WCMC 的轉載，CC BY 4.0）。

使用者 2026-10-29 決定：新主題（地理）；範圍的面（OSM，ODbL）不做。WDPA（Protected Planet）不准轉載，不用。

**取捨**：
- 設立年份用 P571（成立時間），只收 1872（黃石）–2026 年的：有些項目的 P571 是古蹟本身的年代（以色列的庫姆蘭國家公園寫
  西元前 103 年、美國的 Fort Stevens 寫 1861 年），不是設立國家公園的年份；不合理或沒有年份的畫在「設立年份不詳」的圖層，不隨時間軸出現。
- 有廢止日期（P576）的不收。國家依座標判斷（geoindex.countries_at）。
- 顏色依 IUCN 保護區類別（P814）：第 II 類（國家公園）、其他類別、沒標；各國叫「國家公園」的意思不同（英國的國家公園
  有城鎮住人，是第 V 類）。
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, now_iso, points_file, to_series, write_json, year_span
from geoindex import countries_at
from sources import worldbank

OUT = OUT_DIR / "topics" / "national-parks"
SPARQL = "https://query.wikidata.org/sparql"
FIRST_YEAR, LAST_YEAR = 1872, 2026  # 時間軸：黃石國家公園 1872 年設立
MIN_YEAR = 1872  # 世界第一個國家公園（黃石）以前的 P571 是古蹟、堡壘本身的年代，不是設立年份
IUCN_II = "Q14545628"  # IUCN 第 II 類：國家公園
QUERY = """SELECT ?item ?coord ?inc ?end ?area ?iucn ?sl ?en ?mul ?zhtw ?zhhant ?zh WHERE {
  ?item wdt:P31/wdt:P279* wd:Q46169 ; wdt:P625 ?coord ; wikibase:sitelinks ?sl .
  OPTIONAL { ?item wdt:P571 ?inc }
  OPTIONAL { ?item wdt:P576 ?end }
  OPTIONAL { ?item p:P2046/psn:P2046/wikibase:quantityAmount ?area }
  OPTIONAL { ?item wdt:P814 ?iucn }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
  OPTIONAL { ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
}"""
# 圖例的類別（前端 IUCN 的順序）
IUCN_II_CODE, IUCN_OTHER, IUCN_NONE = 1, 2, 3


def fetch() -> list[dict]:
    path = CACHE_DIR / "wikidata" / "national-parks.json"
    if not path.exists():
        req = urllib.request.Request(SPARQL, data=urllib.parse.urlencode({"query": QUERY}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
        for attempt in range(10):
            try:
                with urllib.request.urlopen(req, timeout=300) as r:
                    data = r.read()
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                break
            except urllib.error.HTTPError as err:
                if err.code not in (429, 500, 502, 503, 504):
                    raise
                wait = int(err.headers.get("Retry-After") or 30 * (attempt + 1))
                print(f"    Wikidata 回 {err.code}，等 {wait} 秒", flush=True)
                time.sleep(wait + 1)
        else:
            raise RuntimeError("Wikidata 的 SPARQL 一直失敗，稍後再跑")
    return json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]


def build() -> None:
    from opencc import OpenCC

    s2tw, s2twp = OpenCC("s2tw"), OpenCC("s2twp")
    items: dict[str, dict] = {}
    for r in fetch():
        q = r["item"]["value"].rsplit("/", 1)[1]
        d = items.setdefault(q, {"q": q, "inc": set(), "end": False, "area": None, "iucn": set(), "sl": int(r["sl"]["value"])})
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        if "coord" not in d and v("coord").startswith("Point("):
            lon, lat = v("coord")[6:-1].split()
            d["coord"] = (float(lon), float(lat))
        if v("inc"):
            m = re.match(r"(-?\d+)-", v("inc"))
            if m:
                d["inc"].add(int(m.group(1)))
        if v("end"):
            d["end"] = True
        if v("area") and d["area"] is None:
            d["area"] = float(v("area")) / 1e6  # m² → km²
        if v("iucn"):
            d["iucn"].add(v("iucn").rsplit("/", 1)[1])
        for k in ("en", "mul", "zhtw", "zhhant", "zh"):
            if v(k) and not d.get(k):
                d[k] = v(k)

    rows = []
    skipped = {"closed": 0, "no-coord": 0, "old-year": 0}
    for d in items.values():
        if d["end"]:
            skipped["closed"] += 1
            continue
        if "coord" not in d:
            skipped["no-coord"] += 1
            continue
        years = sorted(y for y in d["inc"] if MIN_YEAR <= y <= LAST_YEAR)
        if d["inc"] and not years:
            skipped["old-year"] += 1
        zh = s2tw.convert(d.get("zhtw") or d.get("zhhant")) if d.get("zhtw") or d.get("zhhant") else (s2twp.convert(d["zh"]) if d.get("zh") else None)
        en = d.get("en") or d.get("mul")
        if not (en or zh):
            continue
        iucn = IUCN_II_CODE if IUCN_II in d["iucn"] else IUCN_OTHER if d["iucn"] else IUCN_NONE
        rows.append({
            "lon": round(d["coord"][0], 3), "lat": round(d["coord"][1], 3), "y": years[0] if years else None,
            "c": iucn, "a": round(d["area"]) if d["area"] and d["area"] >= 1 else None, "sl": d["sl"],
            "en": en, "zh": re.sub(r"\s\([^)]*\)$", "", zh) if zh and zh != en else None, "q": d["q"],
        })
    for r, iso3 in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
        r["iso3"] = iso3
    rows.sort(key=lambda r: (r["y"] or 9999, r["q"]))
    dated = [r for r in rows if r["y"]]
    undated = [r for r in rows if not r["y"]]
    fields = ["lon", "lat", "y", "c", "a", "sl", "iso3", "en", "zh"]
    scale = {"lon": 0.001, "lat": 0.001, "y": 1, "c": 1, "a": 1, "sl": 1}
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "parks.json", points_file(dated, fields, scale, delta=("y",), strings=("iso3",)))
    write_json(OUT / "parks-undated.json", points_file(undated, fields, scale, strings=("iso3",)))
    # 國家公園的指標本身不上色（點是疊加圖層），只給時間軸
    write_json(OUT / "parks-map.json", indicator_file("parks-map", "", list(range(FIRST_YEAR, LAST_YEAR + 1)), {}))

    land, land_world = worldbank.fetch("ER.LND.PTLD.ZS", 1990)
    years = year_span(land)
    write_json(OUT / "protected-land.json", indicator_file(
        "protected-land", "%", years, {c: to_series(v, years, 1) for c, v in land.items() if v},
        aggregates={"WLD": to_series(land_world, years, 1)},
    ))
    write_json(OUT / "manifest.json", {
        "topic": "national-parks", "generatedAt": now_iso(),
        "sources": ["Wikidata (CC0)", "World Bank WDI ER.LND.PTLD.ZS (UNEP-WCMC, CC BY 4.0)"],
    })
    by_c = {k: sum(1 for r in rows if r["c"] == k) for k in (1, 2, 3)}
    print(f"  國家公園 {len(rows)} 處（有設立年份 {len(dated)}、不詳 {len(undated)}），不收 {skipped}；IUCN II {by_c[1]}、其他 {by_c[2]}、沒標 {by_c[3]}")
    print(f"  最早的：{[(r['y'], r['en']) for r in dated[:6]]}")
    tw = [(r["y"], r["zh"] or r["en"]) for r in rows if r["iso3"] == "TWN"]
    print(f"  台灣：{sorted(tw, key=lambda x: x[0] or 0)}")
    last = years[-1]
    ranked = sorted((v.get(last), c) for c, v in land.items() if v.get(last) is not None)
    print(f"  陸域保護區 {years[0]}–{last}，{len(ranked)} 國；最高 {ranked[-4:]}，世界 {land_world.get(last)}")


if __name__ == "__main__":
    build()
