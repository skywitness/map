"""機場與旅客的擴充：機場以誰命名（2026-11-07，製作手冊第二十七批 573，候選 1290；步驟 airport-names，
輸出 topics/aviation/）。

資料：Wikidata（CC0）經 QLever（sources/qlever_wikidata.py；query.wikidata.org 的 robots.txt 禁止 /sparql）。
- 機場是 P31/P279* Q1248784（airport 與它的子類別），P138（named after）指向的對象；對象是人（P31 Q5）的
  列出機場、人、生卒年與職業（P106 的英文標籤）。
- 一個人常有好幾個職業（手冊的陷阱），依優先序只歸一類：政治人物 > 軍人 > 飛行員與太空人 > 作家與詩人 > 其他
  （關鍵字比對職業的英文標籤，見 CATEGORIES）。
- P138 的收錄極不平均（美國、巴西特別多），各國座數只畫比例圓、寫明是 Wikidata 有記的；台灣的機場都是以地名命名
  （桃園機場 1979–2006 年的「中正國際機場」Wikidata 沒有記成 P138），說明寫明。
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, points_file, write_json
from sources import qlever_wikidata
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "aviation"
YEAR = 2026
AIRPORT = "?a wdt:P31/wdt:P279* wd:Q1248784 ; wdt:P138 ?x ."
PEOPLE = """SELECT ?a ?aen ?azh ?coord ?cc ?x ?xen ?xzh ?born ?died ?occ WHERE {
  %s
  ?x wdt:P31 wd:Q5 .
  OPTIONAL { ?a wdt:P625 ?coord }
  OPTIONAL { ?a wdt:P17 ?c . ?c wdt:P297 ?cc }
  OPTIONAL { ?a rdfs:label ?aen . FILTER(LANG(?aen) = "en") }
  OPTIONAL { ?a rdfs:label ?azh . FILTER(LANG(?azh) = "zh-tw") }
  OPTIONAL { ?x rdfs:label ?xen . FILTER(LANG(?xen) = "en") }
  OPTIONAL { ?x rdfs:label ?xzh . FILTER(LANG(?xzh) = "zh-tw") }
  OPTIONAL { ?x wdt:P569 ?b . BIND(YEAR(?b) AS ?born) }
  OPTIONAL { ?x wdt:P570 ?d . BIND(YEAR(?d) AS ?died) }
  OPTIONAL { ?x wdt:P106 ?o . ?o rdfs:label ?occ . FILTER(LANG(?occ) = "en") }
}""" % AIRPORT
TYPES = """SELECT ?a ?x ?t ?ten WHERE {
  %s
  OPTIONAL { ?x wdt:P31 ?t . OPTIONAL { ?t rdfs:label ?ten . FILTER(LANG(?ten) = "en") } }
}""" % AIRPORT
# 職業的分類（代碼要跟前端 airport-names.ts 的 CATEGORIES 一致），依序比對，先中先贏
CATEGORIES = [
    (1, "politician", r"politician|statesperson|head of state|head of government|monarch|president|prime minister|diplomat"),
    (2, "military", r"military|soldier|army officer|naval officer|general|admiral|air force officer"),
    (3, "aviator", r"aviator|pilot|astronaut|cosmonaut|flight instructor"),
    (4, "writer", r"writer|poet|novelist|playwright|essayist"),
]
OTHER = 5


def _qid(uri: str) -> str:
    return uri.rsplit("/", 1)[1]


def _category(occs: set[str]) -> int:
    for code, _, pattern in CATEGORIES:
        if any(re.search(pattern, o, re.I) for o in occs):
            return code
    return OTHER


def build() -> None:
    rows = qlever_wikidata.cached("airport-namesake-people", PEOPLE)
    airports: dict[str, dict] = {}
    occs: dict[str, set[str]] = defaultdict(set)
    for r in rows:
        a, x = _qid(r["a"]["value"]), _qid(r["x"]["value"])
        p = airports.setdefault(a, {"people": {}, "cc": set(), "coord": None, "en": "", "zh": ""})
        if "cc" in r:
            p["cc"].add(r["cc"]["value"])
        if "coord" in r and not p["coord"]:
            m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r["coord"]["value"], re.I)
            if m:
                p["coord"] = (float(m.group(1)), float(m.group(2)))
        p["en"] = p["en"] or r.get("aen", {}).get("value", "")
        p["zh"] = p["zh"] or r.get("azh", {}).get("value", "")
        person = p["people"].setdefault(x, {"en": "", "zh": "", "born": None, "died": None})
        person["en"] = person["en"] or r.get("xen", {}).get("value", "")
        person["zh"] = person["zh"] or r.get("xzh", {}).get("value", "")
        for k in ("born", "died"):
            if k in r:
                y = int(float(r[k]["value"]))
                person[k] = y if person[k] is None else min(person[k], y)
        if "occ" in r:
            occs[x].add(r["occ"]["value"])

    points, per_country, cat_count = [], Counter(), Counter()
    people = set()
    for a, p in airports.items():
        iso3s = {c for c in (from_alpha2(cc) for cc in p["cc"]) if c}
        x, person = next(iter(sorted(p["people"].items())))  # 一座機場以兩個人命名的很少，取第一個；其他寫在 tooltip
        cat = min(_category(occs[q]) for q in p["people"])
        people.update(p["people"])
        for c in iso3s:
            per_country[c] += 1
        if not p["coord"]:
            continue
        others = [v["en"] for q, v in sorted(p["people"].items()) if q != x and v["en"]]
        points.append({
            "lon": round(p["coord"][0], 3), "lat": round(p["coord"][1], 3), "n": p["en"] or a, "nz": p["zh"],
            "p": person["en"] or x, "pz": person["zh"], "b": person["born"], "d": person["died"], "c": cat,
            "o": ", ".join(sorted(occs[x])[:4]), "more": ", ".join(others), "iso3": min(iso3s) if iso3s else "", "q": a,
        })
    write_json(OUT / "airport-names.json", points_file(
        points, ["lon", "lat", "n", "nz", "p", "pz", "b", "d", "c", "o", "more", "iso3", "q"],
        {"lon": 0.001, "lat": 0.001, "b": 1, "d": 1, "c": 1}, strings=["iso3"]))
    cat_count.update(_category(occs[q]) for q in people)
    write_json(OUT / "airport-names-count.json", indicator_file(
        "airport-names", "座", [YEAR], {c: [n] for c, n in sorted(per_country.items())}, license="CC0",
        noValue={"TWN": "台灣的機場在 Wikidata 都以地名命名（桃園機場 1979–2006 年的「中正國際機場」沒有記成 P138）"},
        noValueEn={"TWN": "Taiwan’s airports are all named after places in Wikidata (Taoyuan’s 1979–2006 name, Chiang Kai-shek International Airport, is not recorded with P138)"}))

    types = qlever_wikidata.cached("airport-namesake-types", TYPES)
    named = {_qid(r["a"]["value"]) for r in types}
    type_count: Counter = Counter()
    seen = set()
    for r in types:
        key = (_qid(r["x"]["value"]), r.get("ten", {}).get("value", "?"))
        if key not in seen:
            seen.add(key)
            type_count[key[1]] += 1
    tw = [(p["zh"] or p["en"], [v["en"] for v in p["people"].values()]) for p in airports.values() if "TW" in p["cc"]]
    print(f"  有 P138 的機場 {len(named):,} 座；以人命名的機場 {len(airports):,} 座、{len(people):,} 人；有座標 {len(points):,}")
    print(f"    命名對象的類型：{type_count.most_common(12)}")
    print(f"    職業分類（每人一類）：{sorted(cat_count.items())}")
    occ_all = Counter(o for q in people for o in occs[q])
    print(f"    職業（一人多個）：{occ_all.most_common(16)}")
    print(f"    各國：{per_country.most_common(12)}；TWN {per_country.get('TWN')} {tw}")
