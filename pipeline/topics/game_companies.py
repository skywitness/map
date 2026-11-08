"""新主題「遊戲公司在哪裡」：開發商與發行商、遊戲引擎從哪裡來（2026-11-08，製作手冊第二十七批 652，候選 1426、1428；
步驟 game-companies，輸出 topics/game-companies/）。

資料：Wikidata（CC0）經 QLever（sources/qlever_wikidata.py）。
- 公司：P31（含子類別）是遊戲開發商 Q210167 或遊戲發行商 Q1137109 的項目；國家 P17；座標用自己的 P625，沒有的用總部 P159 的
  P625；成立 P571、解散 P576（解散的另外標，不跟現在的混在一起）；母公司 P749。Wikidata 的收錄偏英語圈與日本，
  中國大陸與東南亞低估；P17 常是現在的註冊地。
- 遊戲引擎：P31（含子類別）是遊戲引擎 Q193564 的項目，開發商 P178 的國家 P17，沒有開發商國家的用原產國 P495；
  清單的位置是開發商（或其總部）的座標，沒有座標的只算在國家的個數。
- 國家的值：公司家數（比例圓）、每百萬人家數（面量圖，WPP 2024；人口不到 100 萬的不畫）、引擎個數（比例圓）。
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, points_file, write_json, write_points
from sources import qlever_wikidata, wpp
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "game-companies"
YEAR = 2026
MIN_POP = 1000  # 千人


def _year(v: str | None) -> int | None:
    m = re.match(r"(-?\d{4})", v or "")
    return int(m.group(1)) if m else None


def companies() -> None:
    rows = qlever_wikidata.cached("game-companies", """
SELECT ?s ?iso ?coord ?hq ?inc ?end ?parentEn ?en ?zhtw ?zhhant ?zh ?kind WHERE {
  { ?s wdt:P31/wdt:P279* wd:Q210167 . BIND("d" AS ?kind) } UNION { ?s wdt:P31/wdt:P279* wd:Q1137109 . BIND("p" AS ?kind) }
  OPTIONAL { ?s wdt:P17 ?c . ?c wdt:P298 ?iso }
  OPTIONAL { ?s wdt:P625 ?coord }
  OPTIONAL { ?s wdt:P159 ?h . ?h wdt:P625 ?hq }
  OPTIONAL { ?s wdt:P571 ?inc }
  OPTIONAL { ?s wdt:P576 ?end }
  OPTIONAL { ?s wdt:P749 ?parent . ?parent rdfs:label ?parentEn FILTER(LANG(?parentEn) = "en") }
  OPTIONAL { ?s rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?s rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?s rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?s rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
}""")
    items: dict[str, dict] = {}
    for r in rows:
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        q = v("s").rsplit("/", 1)[1]
        d = items.setdefault(q, {"iso": set(), "coord": None, "hq": None, "inc": None, "end": None, "parent": None, "kinds": set(),
                                 "en": v("en"), "zh": wikidata_zh(v("zhtw") or v("zhhant"), v("zh"), terms=False)})
        d["kinds"].add(v("kind"))
        if v("iso"):
            d["iso"].add(v("iso"))
        for k in ("coord", "hq"):
            if v(k) and not d[k]:
                d[k] = v(k)
        for k in ("inc", "end"):
            y = _year(v(k))
            if y and (d[k] is None or y < d[k]):
                d[k] = y
        if v("parentEn") and not d["parent"]:
            d["parent"] = v("parentEn")
    counts: Counter = Counter()
    points = []
    for q, d in items.items():
        if not d["en"] and not d["zh"]:
            continue
        for iso in d["iso"]:
            if not d["end"]:
                counts[iso] += 1
        m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", d["coord"] or d["hq"] or "", re.I)
        if not m or not d["iso"]:
            continue
        k = 3 if d["end"] else (1 if "d" in d["kinds"] else 2)  # 1 開發商（含兼發行）、2 只有發行、3 已解散
        points.append({"lon": round(float(m.group(1)), 4), "lat": round(float(m.group(2)), 4), "k": k, "iso3": sorted(d["iso"])[0],
                       "y": d["inc"], "end": d["end"], "en": d["en"] or q, "zh": d["zh"], "parent": d["parent"]})
    points.sort(key=lambda p: (p["k"], p["iso3"], p["en"]))
    write_points(OUT / "companies.json", points_file(points, ["lon", "lat", "k", "iso3", "y", "end", "en", "zh", "parent"],
                                                     {"lon": 0.0001, "lat": 0.0001, "k": 1, "y": 1, "end": 1}, strings=("iso3",)),
                 ("en", "zh", "parent"))
    write_json(OUT / "companies-count.json", indicator_file("companies-count", "家", [YEAR], {c: [v] for c, v in sorted(counts.items())},
                                                            license="CC0"))
    pop = {c: s[2024] for c, s in wpp.demographic(["TPopulation1July"], last_year=2024)["TPopulation1July"].items() if s.get(2024)}
    per = {c: [round(v / (pop[c] * 1000) * 1e6, 2)] for c, v in sorted(counts.items()) if pop.get(c, 0) >= MIN_POP}
    nv = {c: "人口不到 100 萬，一兩家就差很多，不畫" for c in counts if c in pop and pop[c] < MIN_POP}
    nv_en = {c: "Population under 1 million, too small for a stable rate, so not shown" for c in nv}
    write_json(OUT / "companies-per.json", indicator_file("companies-per", "家/百萬人", [YEAR], per, license="CC0", noValue=nv, noValueEn=nv_en))
    alive = sum(1 for d in items.values() if not d["end"])
    print(f"  遊戲公司：{len(items):,} 家（開發商 {sum(1 for d in items.values() if 'd' in d['kinds'])}、發行商 {sum(1 for d in items.values() if 'p' in d['kinds'])}；"
          f"已解散 {len(items) - alive}），有國家而且沒解散的 {sum(counts.values()):,}、{len(counts)} 國；點 {len(points):,}（已解散 {sum(1 for p in points if p['k'] == 3)}）")
    print(f"    最多：{counts.most_common(20)}；台灣 {counts.get('TWN')}（點 {sum(1 for p in points if p['iso3'] == 'TWN')}）")
    r = sorted(per.items(), key=lambda kv: -kv[1][0])
    print("    每百萬人：" + "、".join(f"{c} {v[0]}" for c, v in r[:12]) + " … " + "、".join(f"{c} {per[c][0]}" for c in ("TWN", "JPN", "USA", "KOR", "CHN", "GBR") if c in per))


def engines() -> None:
    rows = qlever_wikidata.cached("game-engines", """
SELECT ?e ?en ?zhtw ?zh ?dev ?devEn ?iso ?origin ?dcoord ?dhq WHERE {
  ?e wdt:P31/wdt:P279* wd:Q193564 .
  OPTIONAL { ?e wdt:P178 ?dev . OPTIONAL { ?dev rdfs:label ?devEn FILTER(LANG(?devEn) = "en") } OPTIONAL { ?dev wdt:P17 ?dc . ?dc wdt:P298 ?iso }
             OPTIONAL { ?dev wdt:P625 ?dcoord } OPTIONAL { ?dev wdt:P159/wdt:P625 ?dhq } }
  OPTIONAL { ?e wdt:P495 ?o . ?o wdt:P298 ?origin }
  OPTIONAL { ?e rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?e rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?e rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
}""")
    items: dict[str, dict] = {}
    for r in rows:
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        q = v("e").rsplit("/", 1)[1]
        d = items.setdefault(q, {"en": v("en"), "zh": wikidata_zh(v("zhtw"), v("zh"), terms=False), "dev": set(), "devEn": set(), "origin": set(),
                                 "at": None})
        m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", v("dcoord") or v("dhq") or "", re.I)
        if m and not d["at"]:
            d["at"] = (round(float(m.group(1)), 4), round(float(m.group(2)), 4))
        if v("iso"):
            d["dev"].add(v("iso"))
        if v("devEn"):
            d["devEn"].add(v("devEn"))
        if v("origin"):
            d["origin"].add(v("origin"))
    counts: Counter = Counter()
    by: dict[str, list] = defaultdict(list)
    for q, d in items.items():
        isos = d["dev"] or d["origin"]
        for iso in isos:
            counts[iso] += 1
            if d["at"]:
                by[iso].append({"lon": d["at"][0], "lat": d["at"][1], "en": d["en"] or q, "zh": d["zh"], "dev": ", ".join(sorted(d["devEn"]))[:80] or None})
    write_json(OUT / "engines-count.json", indicator_file("engines-count", "個", [YEAR], {c: [v] for c, v in sorted(counts.items())}, license="CC0"))
    rows_out = [{"iso3": c, **e} for c, es in sorted(by.items()) for e in sorted(es, key=lambda e: e["en"])]
    write_points(OUT / "engines.json", points_file(rows_out, ["lon", "lat", "iso3", "en", "zh", "dev"], {"lon": 0.0001, "lat": 0.0001},
                                                   strings=("iso3",)), ("en", "zh", "dev"))
    print(f"  遊戲引擎：{len(items)} 個，有國家的 {sum(1 for d in items.values() if d['dev'] or d['origin'])}、{len(counts)} 國：{counts.most_common(16)}")


def build() -> None:
    companies()
    engines()
