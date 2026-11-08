"""博物館與美術館（新主題，2026-11-08，製作手冊第二十七批 638，候選 1396、1398、1399、1402、1403、1404；步驟 museums，
輸出 topics/museums/）。使用者 2026-11-07 核准把博物館從景點地圖拆出來。

- **各國有幾座（OSM）**：OpenStreetMap `tourism=museum` 經 QLever（ODbL 1.0）。手冊：全世界沒有官方的各國博物館數，
  EGMUS 的條款禁止使用，所以只能用 OSM；跟 Wikidata 的點是**兩份獨立的來源，不混用**。每十萬人只替 OSM 覆蓋良好的國家
  上色（sources/osm_coverage.py）。
- **開館年份、年參觀人次、館藏量、國立與地方博物館**：Wikidata（CC0）經 QLever：博物館（Q33506 含子類別）、有座標、
  沒有停用日期（P576、P3999）的項目的 P571（成立時間，常是建築落成年）、P1174（年參觀人次，取 P585 最新的一年）、
  P1436（館藏量，各館計法不同、不排名）、類別是國立博物館（Q17431399 含子類別）或地方博物館（Q1595639 含子類別）。
  國家依座標判斷（geoindex）。人次照手冊合併：景點地圖的「最多人造訪的博物館」（英文維基表 62 館＋台灣）優先，
  相距 1 公里內的 Wikidata 項目不重複畫。
- **照片（候選 1403）不做**：手冊要沿用 sources/commons_photos.py，它讀 commons.wikimedia.org/w/api.php 取攝影者與授權，
  但 commons 的 robots.txt 禁止 /w/（2026-11-08 讀過），程式不能抓；沒有攝影者就不能署名，所以這次不放照片。
"""
from __future__ import annotations

import math
import re
from collections import Counter

from common import OUT_DIR, indicator_file, load_points_json, points_file, read_points_file, write_json, write_points
from geoindex import countries_at
from sources import osm_coverage, osm_qlever, qlever_wikidata, wpp
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "museums"
YEAR = 2026
MIN_POPULATION = 100  # 千人
TIME_FROM = 1700
# 一年人次的上限：世界最多人的羅浮宮約 900 萬、故宮約 2,000 萬；Wikidata 有打錯的（皇家安大略博物館 2.8 億），超過就不收
MAX_VISITORS = 30_000_000
LABELS = """
  OPTIONAL { ?m rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?m rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?m rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?m rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
  FILTER NOT EXISTS { ?m wdt:P576 [] } FILTER NOT EXISTS { ?m wdt:P3999 [] }
"""
BASE = "?m wdt:P31/wdt:P279* wd:Q33506 ; wdt:P625 ?coord ."


def _rows(name: str, select: str, where: str) -> dict[str, dict]:
    """QID → {lon, lat, en, zh, …}；同一個 QID 多列的（多個座標、多個值）合併，值留在 vals"""
    rows = qlever_wikidata.cached(f"museums-{name}", f"SELECT ?m ?coord ?en ?zhtw ?zhhant ?zh {select} WHERE {{ {BASE} {where} {LABELS} }}")
    out: dict[str, dict] = {}
    for r in rows:
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", v("coord") or "", re.I)
        if not m:
            continue
        q = v("m").rsplit("/", 1)[1]
        d = out.setdefault(q, {"q": q, "lon": float(m.group(1)), "lat": float(m.group(2)), "en": v("en"),
                               "zh": wikidata_zh(v("zhtw") or v("zhhant"), v("zh"), place=True, terms=False), "vals": []})
        d["vals"].append({k: r[k]["value"] for k in r if k not in ("m", "coord", "en", "zhtw", "zhhant", "zh")})
    return out


def _locate(items: list[dict]) -> None:
    isos = countries_at([d["lon"] for d in items], [d["lat"] for d in items])
    for d, iso in zip(items, isos):
        d["iso3"] = iso


def _osm() -> None:
    n = osm_qlever.counts("tourism", "museum")
    write_json(OUT / "count.json", indicator_file("count", "座", [YEAR], {c: [v] for c, v in sorted(n.items())}, license="ODbL 1.0"))
    pop = {c: s[2024] for c, s in wpp.demographic(["TPopulation1July"], last_year=2024)["TPopulation1July"].items() if s.get(2024)}
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    values, nv, nv_en = {}, {}, {}
    for c in sorted(set(n) | covered):
        if c not in pop:
            continue
        if c not in covered:
            nv[c], nv_en[c] = osm_coverage.reason(c, cov.get(c))
        elif pop[c] < MIN_POPULATION:
            nv[c] = "人口不到 10 萬，一兩座就差很多，不畫"
            nv_en[c] = "Population under 100,000, too small for a stable rate, so not shown"
        else:
            values[c] = [round(n.get(c, 0) / pop[c] * 100, 2)]
    write_json(OUT / "per-100k.json", indicator_file("per-100k", "座/十萬人", [YEAR], values, noValue=nv, noValueEn=nv_en, license="ODbL 1.0"))
    top = sorted(n.items(), key=lambda kv: -kv[1])
    r = sorted(((c, v[0]) for c, v in values.items()), key=lambda x: -x[1])
    print(f"  OSM tourism=museum：{sum(n.values()):,} 座、{len(n)} 國；" + "、".join(f"{c} {v:,}" for c, v in top[:14]) + f"；台灣 {n.get('TWN')}")
    print(f"    每十萬人（覆蓋良好 {len(values)} 國）：" + "、".join(f"{c} {v}" for c, v in r[:10]) + " … "
          + "、".join(f"{c} {values[c][0]}" for c in ("TWN", "JPN", "USA", "DEU", "FRA", "GBR", "KOR", "CHN") if c in values))


def _opened() -> None:
    items = _rows("opened", "?d", "?m wdt:P571 ?d .")
    rows = []
    for d in items.values():
        years = [int(m.group(1)) for v in d["vals"] if (m := re.match(r"(-?\d{1,4})-", v.get("d", "")))]
        if not years:
            continue
        y = min(years)
        if 1000 <= y <= YEAR:
            rows.append({**d, "y": y})
    _locate(rows)
    rows = [r for r in rows if r["iso3"]]
    rows.sort(key=lambda r: r["y"])
    # 時間軸從 TIME_FROM 起（更早的在第一格就畫；tooltip 用真正的年份 y）
    for r in rows:
        r["yt"] = max(r["y"], TIME_FROM)
    write_points(OUT / "opened.json", points_file(rows, ["lon", "lat", "y", "yt", "iso3", "en", "zh"],
                                                  {"lon": 0.001, "lat": 0.001, "y": 1, "yt": 1}, strings=("iso3",)), ("en", "zh"))
    first = {}
    for r in rows:
        first.setdefault(r["iso3"], r["y"])
    years = list(range(TIME_FROM, YEAR + 1))
    write_json(OUT / "first.json", indicator_file(
        "first", "年", years, {c: [y if t >= max(y, TIME_FROM) else None for t in years] for c, y in sorted(first.items())}, license="CC0"))
    dec = Counter(r["y"] // 100 * 100 for r in rows)
    print(f"  開館年份：{len(rows):,} 館（P571 1000–{YEAR}）；依世紀 " + "、".join(f"{c}s {n:,}" for c, n in sorted(dec.items()))
          + f"；最早 {[(r['en'], r['y']) for r in rows[:5]]}；台灣最早 {first.get('TWN')}")


def _km(a, b) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (a[1], a[0], b[1], b[0]))
    return 6371 * 2 * math.asin(math.sqrt(math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2))


def _visitors() -> None:
    items = _rows("visitors", "?v ?t", "?m p:P1174 ?st . ?st ps:P1174 ?v . OPTIONAL { ?st pq:P585 ?t }")
    rows, dropped = [], []
    for d in items.values():
        best = None
        for v in d["vals"]:
            try:
                n = float(v["v"])
            except (KeyError, ValueError):
                continue  # 「未知的值」空白節點
            y = int(v["t"][:4]) if v.get("t") and re.match(r"\d{4}", v["t"]) else None
            if n > 0 and (best is None or (y or 0) > (best[1] or 0)):
                best = (n, y)
        if best and best[0] > MAX_VISITORS:
            dropped.append((d["en"], round(best[0])))
        elif best:
            rows.append({**d, "v": round(best[0]), "vy": best[1], "src": 2})
    _locate(rows)
    rows = [r for r in rows if r["iso3"]]
    # 景點地圖的「最多人造訪的博物館」優先（英文維基表 62 館＋台灣），相距 1 公里內的 Wikidata 不重複
    table = read_points_file(load_points_json(OUT_DIR / "topics" / "attractions" / "museum-visitors.json"))
    keep = [r for r in rows if not any(_km((r["lon"], r["lat"]), (t["lon"], t["lat"])) < 1 for t in table)]
    merged = [{"lon": t["lon"], "lat": t["lat"], "v": t["v"], "vy": t["vy"], "iso3": t["iso3"], "en": t["en"], "zh": t["zh"],
               "src": 1 if not t.get("tw") else 3} for t in table if t.get("v")] + keep
    merged.sort(key=lambda r: -r["v"])
    write_points(OUT / "visitors.json", points_file(merged, ["lon", "lat", "v", "vy", "src", "iso3", "en", "zh"],
                                                    {"lon": 0.001, "lat": 0.001, "v": 1, "vy": 1, "src": 1}, strings=("iso3",)), ("en", "zh"))
    big = Counter("125萬以上" if r["v"] >= 1.25e6 else "10–125萬" if r["v"] >= 1e5 else "10萬以下" for r in merged)
    print(f"  人次超過 {MAX_VISITORS:,.0f} 的當成 Wikidata 打錯，不收：{dropped}")
    print(f"  人次：Wikidata P1174 {len(rows):,} 館（去掉跟維基表重複的 {len(rows) - len(keep)}），加維基表 {len(table)} 館，共 {len(merged):,}；{dict(big)}")
    print("    Wikidata 最多：" + "、".join(f"{r['en']}（{r['iso3']}）{r['v']:,}／{r['vy']}" for r in sorted(keep, key=lambda r: -r["v"])[:8]))
    print(f"    台灣：{[(r['zh'] or r['en'], r['v'], r['vy']) for r in merged if r['iso3'] == 'TWN']}")


def _collection() -> None:
    items = _rows("collection", "?c", "?m wdt:P1436 ?c .")
    rows = []
    for d in items.values():
        vals = []
        for v in d["vals"]:
            try:
                vals.append(float(v["c"]))
            except (KeyError, ValueError):
                pass
        if vals and max(vals) >= 1:
            rows.append({**d, "c": round(max(vals))})
    _locate(rows)
    rows = [r for r in rows if r["iso3"]]
    rows.sort(key=lambda r: -r["c"])
    write_points(OUT / "collection.json", points_file(rows, ["lon", "lat", "c", "iso3", "en", "zh"], {"lon": 0.001, "lat": 0.001, "c": 1},
                                                      strings=("iso3",)), ("en", "zh"))
    print(f"  館藏量：{len(rows):,} 館；最多 " + "、".join(f"{r['en']}（{r['iso3']}）{r['c']:,}" for r in rows[:8])
          + f"；台灣 {[(r['zh'] or r['en'], r['c']) for r in rows if r['iso3'] == 'TWN']}")


def _kinds() -> None:
    nat = _rows("national", "", "?m wdt:P31/wdt:P279* wd:Q17431399 .")
    loc = _rows("local", "", "?m wdt:P31/wdt:P279* wd:Q1595639 .")
    rows = [{**d, "k": 1} for d in nat.values()] + [{**d, "k": 2} for q, d in loc.items() if q not in nat]
    _locate(rows)
    rows = [r for r in rows if r["iso3"]]
    write_points(OUT / "kinds.json", points_file(rows, ["lon", "lat", "k", "iso3", "en", "zh"], {"lon": 0.001, "lat": 0.001, "k": 1},
                                                 strings=("iso3",)), ("en", "zh"))
    c = Counter(r["k"] for r in rows)
    print(f"  國立 {c[1]:,}、地方 {c[2]:,}；國立最多的國家 {Counter(r['iso3'] for r in rows if r['k'] == 1).most_common(6)}；"
          f"台灣國立 {[r['zh'] or r['en'] for r in rows if r['iso3'] == 'TWN' and r['k'] == 1]}")


def build() -> None:
    _osm()
    _opened()
    _visitors()
    _collection()
    _kinds()
