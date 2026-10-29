"""纜車與索道（新主題，科技與交通類，2026-10-29）：Wikidata 的空中纜車、吊廂纜車與登山纜索鐵道的點，依開通年份累積出現。

使用者 2026-10-29 決定：不畫滑雪場的吊椅，只畫空中纜車、吊廂纜車與纜索鐵道。Wikidata（CC0）的類別樹
（空中索道 Q13409250、纜索鐵道 Q142031 的子類別）裡，吊椅、滑索、貨運與軍用索道、載人的車廂這類不收（SKIP）。

**取捨**：開通年份依序用正式啟用日期（P1619）或啟用日期（P729）、成立時間（P571）；沒有的畫在「開通年份不詳」的圖層（預設關閉，不隨時間軸變）。
停用（P730、P576）的有年份的畫到那一年為止（endField），沒有年份的不收。國家依座標判斷。
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, now_iso, points_file, write_json
from geoindex import countries_at
from sources import wikidata_attractions

OUT = OUT_DIR / "topics" / "cable-cars"
SPARQL = "https://query.wikidata.org/sparql"
FIRST_YEAR, LAST_YEAR = 1850, 2026
# 種類（前端 KINDS 的順序）：1 往復式空中纜車、2 吊廂纜車與其他空中纜車、3 纜索鐵道
TRAMWAY, GONDOLA, FUNICULAR = 1, 2, 3
CLASSES = {
    "Q498002": TRAMWAY,  # aerial tramway
    "Q44667495": GONDOLA,  # urban aerial tramway route（多半是都市的吊廂纜車路線）
    "Q13409250": GONDOLA,  # aerial lift（沒有細分的）
    "Q1576693": GONDOLA, "Q1309027": GONDOLA, "Q1514206": GONDOLA, "Q229497": GONDOLA, "Q1474315": GONDOLA,
    "Q1288569": GONDOLA, "Q101136287": GONDOLA, "Q101136349": GONDOLA, "Q125971696": GONDOLA, "Q21076320": GONDOLA,
    "Q3546684": GONDOLA,  # 吊廂與吊椅混合的（hybrid lift），吊廂的部分算
    "Q142031": FUNICULAR, "Q2550729": FUNICULAR, "Q3029288": FUNICULAR, "Q1572198": FUNICULAR, "Q1748895": FUNICULAR,
}
# 不收：吊椅（含可脫離式）、滑索、貨運索道、軍用索道、斗式索道、雪橇纜索、車廂、MiniMetro（無人駕駛的捷運系統）
SKIP = {"Q850767", "Q3606521", "Q1154882", "Q99189561", "Q3020698", "Q2367733", "Q133930899", "Q1751283",
        "Q1517709", "Q11375866", "Q56296673"}
# Wikidata 的年份明顯不對的（手工改，寫出處）
HAND_YEAR = {"Q710925": 2007}  # 貓空纜車：Wikidata 只有成立時間 2006；臺北大眾捷運公司：2007 年 7 月 4 日通車
QUERY = """SELECT ?item ?cls ?coord ?open ?inc ?end ?len ?sl ?en ?mul ?zhtw ?zhhant ?zh WHERE {{
  VALUES ?cls {{ {classes} }}
  ?item wdt:P31 ?cls ; wdt:P625 ?coord ; wikibase:sitelinks ?sl .
  OPTIONAL {{ ?item wdt:P1619|wdt:P729 ?open }}
  OPTIONAL {{ ?item wdt:P571 ?inc }}
  OPTIONAL {{ ?item wdt:P730|wdt:P576 ?end }}
  OPTIONAL {{ ?item p:P2043/psn:P2043/wikibase:quantityAmount ?len }}
  OPTIONAL {{ ?item rdfs:label ?en FILTER(LANG(?en) = "en") }}
  OPTIONAL {{ ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }}
  OPTIONAL {{ ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }}
  OPTIONAL {{ ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }}
  OPTIONAL {{ ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }}
}}"""


def fetch() -> list[dict]:
    path = CACHE_DIR / "wikidata" / "cable-cars.json"
    if not path.exists():
        query = QUERY.format(classes=" ".join(f"wd:{q}" for q in CLASSES))
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
                wait = 30 * (attempt + 1)
                print(f"    Wikidata：{err}，等 {wait} 秒", flush=True)
                time.sleep(wait)
        else:
            raise RuntimeError("Wikidata 的 SPARQL 一直失敗，稍後再跑")
    return json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]


def year(v: str | None) -> int | None:
    m = re.match(r"(\d{4})-", v or "")
    return int(m.group(1)) if m else None


def build() -> None:
    from opencc import OpenCC

    s2tw, s2twp = OpenCC("s2tw"), OpenCC("s2twp")
    items: dict[str, dict] = {}
    for r in fetch():
        q = r["item"]["value"].rsplit("/", 1)[1]
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        d = items.setdefault(q, {"q": q, "kinds": set(), "open": set(), "inc": set(), "end": set(), "len": None,
                                 "sl": int(r["sl"]["value"])})
        d["kinds"].add(CLASSES[v("cls").rsplit("/", 1)[1]])
        if "coord" not in d and v("coord").startswith("Point("):
            lon, lat = v("coord")[6:-1].split()
            d["coord"] = (float(lon), float(lat))
        for k in ("open", "inc", "end"):
            if (y := year(v(k))) is not None:
                d[k].add(y)
            elif k == "end" and v(k):
                d["end"].add(0)  # 有停用但日期不明
        if v("len") and d["len"] is None:
            d["len"] = float(v("len"))
        for k in ("en", "mul", "zhtw", "zhhant", "zh"):
            if v(k) and not d.get(k):
                d[k] = v(k)

    # 沒有英文標籤的用其他語言的名稱（跟景點地圖同一個做法，sources/wikidata_attractions.py）
    names = wikidata_attractions.fallback_names(sorted(q for q, d in items.items() if not (d.get("en") or d.get("mul"))))
    rows, skipped = [], {"closed-unknown": 0, "no-name": 0}
    for d in items.values():
        if "coord" not in d:
            continue
        if 0 in d["end"]:
            skipped["closed-unknown"] += 1
            continue
        opened = HAND_YEAR.get(d["q"]) or (min(d["open"]) if d["open"] else (min(d["inc"]) if d["inc"] else None))
        if opened is not None and not FIRST_YEAR <= opened <= LAST_YEAR:
            opened = None
        zh = s2tw.convert(d.get("zhtw") or d.get("zhhant")) if d.get("zhtw") or d.get("zhhant") else (s2twp.convert(d["zh"]) if d.get("zh") else None)
        en = d.get("en") or d.get("mul") or names.get(d["q"])
        if not (en or zh):
            skipped["no-name"] += 1
            continue
        kind = min(d["kinds"])  # 往復式優先，其次吊廂，最後纜索鐵道（同時標兩種的很少）
        rows.append({
            "lon": round(d["coord"][0], 4), "lat": round(d["coord"][1], 4), "k": kind, "y": opened,
            "e": max(d["end"]) if d["end"] else None, "l": round(d["len"]) if d["len"] and d["len"] >= 10 else None,
            "sl": d["sl"], "en": en, "zh": re.sub(r"\s\([^)]*\)$", "", zh) if zh and zh != en else None, "q": d["q"],
        })
    for r, iso3 in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
        r["iso3"] = iso3
    rows.sort(key=lambda r: (r["y"] or 9999, r["q"]))
    dated = [r for r in rows if r["y"]]
    undated = [r for r in rows if not r["y"]]
    fields = ["lon", "lat", "k", "y", "e", "l", "sl", "iso3", "en", "zh"]
    scale = {"lon": 0.0001, "lat": 0.0001, "k": 1, "y": 1, "e": 1, "l": 1, "sl": 1}
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "lines.json", points_file(dated, fields, scale, strings=("iso3",)))
    write_json(OUT / "lines-undated.json", points_file(undated, fields, scale, strings=("iso3",)))
    write_json(OUT / "map.json", indicator_file("map", "", list(range(FIRST_YEAR, LAST_YEAR + 1)), {}))
    write_json(OUT / "manifest.json", {"topic": "cable-cars", "generatedAt": now_iso(), "sources": ["Wikidata (CC0)"]})
    by_kind = {k: sum(1 for r in rows if r["k"] == k) for k in (1, 2, 3)}
    print(f"  纜車與索道 {len(rows)} 條（有年份 {len(dated)}、不詳 {len(undated)}），往復式 {by_kind[1]}、吊廂 {by_kind[2]}、"
          f"纜索鐵道 {by_kind[3]}；不收 {skipped}")
    print(f"  最早：{[(r['y'], r['en']) for r in dated[:6]]}")
    from collections import Counter
    print(f"  各國（前 10）：{Counter(r['iso3'] for r in rows).most_common(10)}")
    print(f"  台灣：{[(r['y'], r['zh'] or r['en'], r['k']) for r in rows if r['iso3'] == 'TWN']}")


if __name__ == "__main__":
    build()
