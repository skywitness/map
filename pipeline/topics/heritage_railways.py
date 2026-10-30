"""觀光鐵道與登山鐵路（新主題，科技與交通類，2026-10-30）：Wikidata 的保存鐵路、齒軌鐵路、登山鐵路、森林鐵路的點，依開通年份累積出現。

使用者決定（2026-10-30，製作手冊第一百節）：照候選清單（Wikidata 的四類；OSM 的線、英文維基的清單不用）。

**資料**：Wikidata（CC0）裡是保存鐵路（heritage railway Q420962）、齒軌鐵路（rack railway Q378445）、登山鐵路
（mountain railway Q1497019）、森林鐵路（forest railway Q1202390）或它們子類別（P31/P279*）的項目。一次查詢含子類別的
在 query.wikidata.org 會逾時，改用 QLever 的 Wikidata 端點（同一份 CC0 資料，查詢結果存進 pipeline/.cache/wikidata）。
- **種類**：同一條鐵路常同時是好幾類（阿里山林業鐵路是保存鐵路也是森林鐵路），點的顏色依「齒軌 > 登山 > 森林 > 保存」取一類，
  tooltip 列出全部。纜索鐵道在「纜車與索道」主題，這裡不另外收（Wikidata 的齒軌、登山鐵路類別樹不含纜索鐵道）。
- **年份**：依序用正式啟用日期（P1619）或啟用日期（P729）、成立時間（P571）。保存鐵路的年份常是原本那條鐵路的通車年份，
  不是開始觀光營運的年份；停用日期（P576、P730）也常是原本那條線停駛的年份、之後才改成保存鐵路，所以不依停用日期拿掉。
  沒有年份的畫在「開通年份不詳」的圖層（預設關閉）。
- **只畫有座標的**（Wikidata 的森林鐵路 95 筆只有 25 筆有座標）；國家依座標。

**輸出**（public/data/topics/heritage-railways/）：lines.json、lines-undated.json（點）、map.json（時間軸用的空指標）、
count.json（各國有座標的條數，2026 年）。
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, now_iso, points_file, write_json
from geoindex import countries_at
from sources import wikidata_attractions

OUT = OUT_DIR / "topics" / "heritage-railways"
ENDPOINT = "https://qlever.dev/api/wikidata"
FIRST_YEAR, LAST_YEAR = 1820, 2026
# Wikidata 沒有年份的（手工補，寫出處）
HAND_YEAR = {"Q708937": 1912}  # 阿里山林業鐵路：1912 年 12 月嘉義至二萬平通車（林業及自然保育署阿里山林業鐵路及文化資產管理處）
# 種類代碼（前端 KINDS）：1 保存鐵路、2 齒軌鐵路、3 登山鐵路、4 森林鐵路；點的顏色依 PRIORITY 取第一個
ROOTS = {"Q420962": 1, "Q378445": 2, "Q1497019": 3, "Q1202390": 4}
PRIORITY = [2, 3, 4, 1]
QUERY = """PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?item ?root ?coord ?open ?inc ?sl ?en ?mul ?zhtw ?zhhant ?zh WHERE {{
  VALUES ?root {{ {roots} }}
  ?item wdt:P31/wdt:P279* ?root ; wikibase:sitelinks ?sl .
  OPTIONAL {{ ?item wdt:P625 ?coord }}
  OPTIONAL {{ ?item wdt:P1619|wdt:P729 ?open }}
  OPTIONAL {{ ?item wdt:P571 ?inc }}
  OPTIONAL {{ ?item rdfs:label ?en FILTER(LANG(?en) = "en") }}
  OPTIONAL {{ ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }}
  OPTIONAL {{ ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }}
  OPTIONAL {{ ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }}
  OPTIONAL {{ ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }}
}}"""


def fetch() -> list[dict]:
    path = CACHE_DIR / "wikidata" / "heritage-railways.json"
    if not path.exists():
        query = QUERY.format(roots=" ".join(f"wd:{q}" for q in ROOTS))
        req = urllib.request.Request(ENDPOINT, data=urllib.parse.urlencode({"query": query}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
        for attempt in range(8):
            try:
                with urllib.request.urlopen(req, timeout=300) as r:
                    data = r.read()
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                break
            except (urllib.error.HTTPError, urllib.error.URLError, ConnectionError, TimeoutError) as err:
                wait = 60 * (attempt + 1)
                print(f"    QLever：{err}，等 {wait} 秒", flush=True)
                time.sleep(wait)
        else:
            raise RuntimeError("QLever 一直失敗，稍後再跑")
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
        d = items.setdefault(q, {"q": q, "kinds": set(), "open": set(), "inc": set(), "sl": int(v("sl"))})
        d["kinds"].add(ROOTS[v("root").rsplit("/", 1)[1]])
        if "coord" not in d and (c := v("coord")) and c.upper().startswith("POINT("):
            lon, lat = c[6:-1].split()
            d["coord"] = (float(lon), float(lat))
        for k in ("open", "inc"):
            if (y := year(v(k))) is not None:
                d[k].add(y)
        for k in ("en", "mul", "zhtw", "zhhant", "zh"):
            if v(k) and not d.get(k):
                d[k] = v(k)

    names = wikidata_attractions.fallback_names(sorted(q for q, d in items.items() if "coord" in d and not (d.get("en") or d.get("mul"))))
    rows = []
    for d in items.values():
        if "coord" not in d:
            continue
        opened = HAND_YEAR.get(d["q"]) or (min(d["open"]) if d["open"] else (min(d["inc"]) if d["inc"] else None))
        if opened is not None and not FIRST_YEAR <= opened <= LAST_YEAR:
            opened = None
        zh = s2tw.convert(d.get("zhtw") or d.get("zhhant")) if d.get("zhtw") or d.get("zhhant") else (s2twp.convert(d["zh"]) if d.get("zh") else None)
        en = d.get("en") or d.get("mul") or names.get(d["q"])
        if not (en or zh):
            continue
        kind = next(k for k in PRIORITY if k in d["kinds"])
        rows.append({
            "lon": round(d["coord"][0], 4), "lat": round(d["coord"][1], 4), "k": kind,
            # 其他種類（tooltip 用）：四個位元，1 保存、2 齒軌、4 登山、8 森林
            "all": sum(1 << (k - 1) for k in d["kinds"]), "y": opened, "sl": d["sl"],
            "en": en, "zh": re.sub(r"\s\([^)]*\)$", "", zh) if zh and zh != en else None, "q": d["q"],
        })
    for r, iso3 in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
        r["iso3"] = iso3
    rows.sort(key=lambda r: (r["y"] or 9999, r["q"]))
    dated = [r for r in rows if r["y"]]
    undated = [r for r in rows if not r["y"]]
    fields = ["lon", "lat", "k", "all", "y", "sl", "iso3", "en", "zh", "q"]
    scale = {"lon": 0.0001, "lat": 0.0001, "k": 1, "all": 1, "y": 1, "sl": 1}
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "lines.json", points_file(dated, fields, scale, strings=("iso3",)))
    write_json(OUT / "lines-undated.json", points_file(undated, fields, scale, strings=("iso3",)))
    write_json(OUT / "map.json", indicator_file("map", "", list(range(FIRST_YEAR, LAST_YEAR + 1)), {}))
    by_country = Counter(r["iso3"] for r in rows if r["iso3"])
    tw = [r for r in rows if r["iso3"] == "TWN"]
    tw_names = "、".join(r["zh"] or r["en"] for r in tw)
    write_json(OUT / "count.json", indicator_file(
        "count", "條", [LAST_YEAR], {c: [n] for c, n in by_country.items()},
        notes={"TWN": f"Wikidata 收錄、有座標的：{tw_names}。"},
        notesEn={"TWN": "With coordinates in Wikidata: " + ", ".join(r["en"] or r["zh"] for r in tw) + "."}))
    write_json(OUT / "manifest.json", {"topic": "heritage-railways", "generatedAt": now_iso(), "sources": ["Wikidata (CC0) via QLever"]})
    kinds = Counter(r["k"] for r in rows)
    print(f"  {len(items)} 個項目，有座標 {len(rows)}（有年份 {len(dated)}、不詳 {len(undated)}）；點的種類 {dict(kinds)}")
    print(f"  最早：{[(r['y'], r['en']) for r in dated[:5]]}")
    print(f"  各國（前 10）：{by_country.most_common(10)}")
    print(f"  台灣：{[(r['y'], r['zh'] or r['en'], r['k'], r['all']) for r in tw]}")


if __name__ == "__main__":
    build()
