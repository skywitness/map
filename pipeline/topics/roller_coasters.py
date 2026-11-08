"""雲霄飛車地圖（新主題，2026-11-08，製作手冊第二十七批 635，候選 1376、1377、1388、1380；步驟 roller-coasters，
輸出 topics/roller-coasters/）。

- **各國的雲霄飛車**：OpenStreetMap（ODbL 1.0）經 QLever 的 `attraction=roller_coaster`。一座雲霄飛車的軌道常畫成好幾段
  way、又另外標 node（手冊的陷阱），所以**同一國、同一個名稱、相距 3 公里內的物件併成一座**；沒有名稱的各算一座。
  點用 `geof:centroid`。每百萬人只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py，同第二十一批）。
  手冊說兩個來源不能混用計數：各國的數量只用 OSM，Wikidata 只用在製造商。
- **世界紀錄**：英文維基「List of roller coaster rankings」固定版本的 12 張表（鋼製與木製 × 高度、落差、速度、長度、
  翻轉次數、俯衝角度；CC BY-SA 4.0，只引用數字；底層是 RCDB，專案 2026-10-29 決定只走維基轉引）。單位取表上括號裡的
  公制（公尺、公里／時）。同一篇的「Number of operating roller coasters」只剩 5 列，不用。座標用樂園條目在 Wikidata 的
  P625（沒有用雲霄飛車條目的）。
- **製造商**：Wikidata（CC0）的雲霄飛車（Q204832 與子類別）的製造商 P176，製造商的國家用 P17（沒有就用總部 P159 的國家）。
  手冊的陷阱：P176 只有約一半的雲霄飛車有，美國的收錄比別國完整；Intamin 在列支敦斯登註冊、瑞士營運。
- **遊樂設施**：OSM 的 `attraction=big_wheel`（摩天輪）、`carousel`（旋轉木馬）、`water_slide`（滑水道；一條滑道是一條線，
  一座水上樂園有十幾條，**不是設施數**）、`amusement_ride`（泛稱）各國的物件數，四支查詢一支一支跑。
"""
from __future__ import annotations

import math
import re
from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, points_file, write_json
from sources import osm_coverage, osm_qlever, qlever_wikidata, wpp
from sources import wikipedia_html as H
from sources.countries import from_alpha2, from_name
from topics.attractions_extra import wiki_items
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "roller-coasters"
YEAR = 2026
MIN_POPULATION = 100  # 千人（WPP 的單位）
RANKINGS = ("List_of_roller_coaster_rankings", 1382935577)
# 表的順序（第 0 張是圖例）：類別代碼、材質
TABLES = {1: ("h", "s"), 2: ("d", "s"), 3: ("h", "w"), 4: ("d", "w"), 5: ("v", "s"), 6: ("v", "w"),
          7: ("l", "s"), 8: ("l", "w"), 9: ("i", "s"), 10: ("i", "w"), 11: ("a", "s"), 12: ("a", "w")}
RIDES = ["big_wheel", "carousel", "water_slide", "amusement_ride"]


def _km(a: tuple[float, float], b: tuple[float, float]) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (a[1], a[0], b[1], b[0]))
    return 6371 * 2 * math.asin(math.sqrt(math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2))


def _osm_coasters() -> list[dict]:
    rows = osm_qlever.query(f"""PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
SELECT ?x ?iso ?name ?namezh ?cent WHERE {{
  {osm_qlever.COUNTRIES}
  ?x osmkey:attraction "roller_coaster" ; geo:hasGeometry/geo:asWKT ?wkt .
  BIND(geof:centroid(?wkt) AS ?cent)
  OPTIONAL {{ ?x osmkey:name ?name }}
  OPTIONAL {{ ?x <https://www.openstreetmap.org/wiki/Key:name:zh> ?namezh }}
}}""", "roller-coasters-centroid")
    seen: set[str] = set()
    groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
    out = []
    for r in rows:
        iso3 = from_alpha2(r["iso"]["value"])
        m = re.match(r"POINT\(([-\d.eE]+) ([-\d.eE]+)\)", r["cent"]["value"], re.I)
        x = r["x"]["value"]
        if not iso3 or not m or x in seen:
            continue
        seen.add(x)
        p = {"lon": float(m.group(1)), "lat": float(m.group(2)), "iso3": iso3,
             "name": r.get("name", {}).get("value") or None, "zh": r.get("namezh", {}).get("value") or None, "n": 1}
        if not p["name"]:
            out.append(p)
            continue
        for q in groups[(iso3, p["name"])]:
            if _km((q["lon"], q["lat"]), (p["lon"], p["lat"])) < 3:
                q["n"] += 1
                break
        else:
            groups[(iso3, p["name"])].append(p)
            out.append(p)
    print(f"  OSM 雲霄飛車物件 {len(seen):,} 個，併成 {len(out):,} 座（有名稱 {sum(1 for p in out if p['name']):,}）")
    return out


def _density(n: dict[str, int], name: str, unit: str) -> None:
    pop = {c: s[2024] for c, s in wpp.demographic(["TPopulation1July"], last_year=2024)["TPopulation1July"].items() if s.get(2024)}
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    values, no_value, no_value_en = {}, {}, {}
    for c in sorted(set(n) | covered):
        if c not in pop:
            continue
        if c not in covered:
            no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
        elif pop[c] < MIN_POPULATION:
            no_value[c] = "人口不到 10 萬，一兩座就差很多，不畫"
            no_value_en[c] = "Population under 100,000, too small for a stable rate, so not shown"
        else:
            values[c] = [round(n.get(c, 0) / pop[c] * 1000, 2)]
    write_json(OUT / name, indicator_file(name.removesuffix(".json"), unit, [YEAR], values, noValue=no_value,
                                          noValueEn=no_value_en, license="ODbL 1.0"))
    r = sorted(((c, v[0]) for c, v in values.items()), key=lambda x: -x[1])
    print(f"    每百萬人（覆蓋良好 {len(values)} 國）：" + "、".join(f"{c} {v}" for c, v in r[:10]) + " … "
          + "、".join(f"{c} {values[c][0]}" for c in ("TWN", "JPN", "KOR", "USA", "DEU", "FRA", "GBR", "CHN") if c in values))


def _value(cat: str, cell: str) -> float | None:
    if cat in ("h", "d", "l"):
        m = re.search(r"\(([\d,.]+)\s*m\)", cell)
    elif cat == "v":
        m = re.search(r"\(([\d,.]+)\s*km/h\)", cell)
    else:
        m = re.search(r"([\d.]+)", cell)
    return float(m.group(1).replace(",", "")) if m else None


def _records() -> list[dict]:
    text = H.page(*RANKINGS)
    tables = H.tables(text)
    coasters: dict[tuple[str, str], dict] = {}
    for ti, (cat, mat) in TABLES.items():
        for row in tables[ti][1:]:
            if len(row) < 7:
                continue
            rank = re.sub(r"\D", "", row[0][0]) or None
            name, park, country = row[1][0], row[2][0], row[3][0]
            v = _value(cat, row[4][0])
            if v is None:
                continue
            key = (name, park)
            c = coasters.setdefault(key, {"name": name, "park": park, "country": country, "mat": mat,
                                          "links": row[2][1][:1] + row[1][1][:1], "maker": row[5][0], "rec": []})
            c["rec"].append(f"{cat}{rank or '-'}:{v:g}")
    coords = wiki_items([t for c in coasters.values() for t in c["links"]])
    out = []
    for c in coasters.values():
        hit = next((coords[t[0].upper() + t[1:]] for t in c["links"] if coords.get(t[0].upper() + t[1:], {}).get("lon") is not None), None)
        iso3 = from_name(c["country"]) or {"United States": "USA", "United Kingdom": "GBR", "South Korea": "KOR"}.get(c["country"])
        if not hit or not iso3:
            print(f"    （沒有座標或國家）{c['name']}，{c['park']}，{c['country']}")
            continue
        best = min(int(r.split(":")[0][1:]) if r.split(":")[0][1:].isdigit() else 99 for r in c["rec"])
        out.append({"lon": hit["lon"], "lat": hit["lat"], "best": best, "nrec": len(c["rec"]), "w": 1 if c["mat"] == "w" else 0,
                    "iso3": iso3, "name": c["name"], "park": c["park"], "maker": c["maker"], "rec": "|".join(c["rec"])})
    out.sort(key=lambda p: (p["best"], -p["nrec"]))
    return out


def _makers() -> list[dict]:
    rows = qlever_wikidata.cached("roller-coaster-makers", """
SELECT ?c ?cl ?coord ?iso ?m ?ml ?miso ?zhtw ?zh WHERE {
  ?c wdt:P31/wdt:P279* wd:Q204832 ; wdt:P176 ?m .
  OPTIONAL { ?c wdt:P625 ?coord }
  OPTIONAL { ?c wdt:P17/wdt:P298 ?iso }
  OPTIONAL { ?c rdfs:label ?cl FILTER(lang(?cl) = "en") }
  OPTIONAL { ?c rdfs:label ?zhtw FILTER(lang(?zhtw) = "zh-tw") }
  OPTIONAL { ?c rdfs:label ?zh FILTER(lang(?zh) = "zh") }
  OPTIONAL { ?m rdfs:label ?ml FILTER(lang(?ml) = "en") }
  OPTIONAL { { ?m wdt:P17/wdt:P298 ?miso } UNION { ?m wdt:P159/wdt:P17/wdt:P298 ?miso } }
}""")
    items: dict[str, dict] = {}
    for r in rows:
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        q = v("c").rsplit("/", 1)[1]
        it = items.setdefault(q, {"qid": q, "name": v("cl"), "zh": wikidata_zh(v("zhtw"), v("zh"), place=False, terms=False),
                                  "coord": v("coord"), "iso3": v("iso"), "makers": {}})
        it["coord"] = it["coord"] or v("coord")
        it["iso3"] = it["iso3"] or v("iso")
        m = v("m").rsplit("/", 1)[1]
        it["makers"].setdefault(m, {"label": v("ml") or m, "iso": set()})
        if v("miso"):
            it["makers"][m]["iso"].add(v("miso"))
    return list(items.values())


def build() -> None:
    # ── 各國的雲霄飛車（OSM） ──
    pts = _osm_coasters()
    n = Counter(p["iso3"] for p in pts)
    write_json(OUT / "count.json", indicator_file("count", "座", [YEAR], {c: [v] for c, v in sorted(n.items())}, license="ODbL 1.0"))
    print(f"    {len(n)} 國：" + "、".join(f"{c} {v}" for c, v in n.most_common(16)) + f"；台灣 {n.get('TWN')}")
    _density(n, "per-million.json", "座/百萬人")
    pts.sort(key=lambda p: (p["name"] is None, p["iso3"]))
    write_json(OUT / "osm.json", {**points_file(pts, ["lon", "lat", "iso3", "name", "zh"], {"lon": 0.0001, "lat": 0.0001},
                                                strings=("iso3",)), "license": "ODbL 1.0"})

    # ── 世界紀錄（英文維基） ──
    rec = _records()
    write_json(OUT / "records.json", {**points_file(rec, ["lon", "lat", "best", "nrec", "w", "iso3", "name", "park", "maker", "rec"],
                                                    {"lon": 0.0001, "lat": 0.0001, "best": 1, "nrec": 1, "w": 1},
                                                    strings=("iso3", "maker")), "license": "CC BY-SA 4.0"})
    holders = [p for p in rec if p["best"] == 1]
    print(f"  紀錄表：{len(rec)} 座（第一名 {len(holders)} 座：" + "、".join(f"{p['name']}（{p['iso3']}）" for p in holders) + "）")
    print("    國家：" + "、".join(f"{c} {v}" for c, v in Counter(p["iso3"] for p in rec).most_common(10)))

    # ── 製造商（Wikidata） ──
    items = _makers()
    by_maker: Counter = Counter()
    maker_iso: dict[str, set] = defaultdict(set)
    label: dict[str, str] = {}
    for it in items:
        for m, d in it["makers"].items():
            by_maker[m] += 1
            maker_iso[m] |= d["iso"]
            label[m] = d["label"]
    top = [m for m, _ in by_maker.most_common(7)]
    country = Counter()
    for m, k in by_maker.items():
        if not maker_iso[m] and label[m].startswith("Vekoma"):
            maker_iso[m] = {"NLD"}  # Wikidata 的 Vekoma 沒有國家與總部，荷蘭 Vlodrop 的公司
        isos = sorted(maker_iso[m])
        if len(isos) == 1:
            country[isos[0]] += k
    write_json(OUT / "maker-country.json", indicator_file("maker-country", "座", [YEAR], {c: [v] for c, v in sorted(country.items())},
                                                          license="CC0"))
    mp = []
    for it in items:
        m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", it["coord"] or "", re.I)
        if not m:
            continue
        first = max(it["makers"], key=lambda k: by_maker[k])
        mp.append({"lon": float(m.group(1)), "lat": float(m.group(2)), "mk": top.index(first) + 1 if first in top else 8,
                   "iso3": it["iso3"], "name": it["name"], "zh": it["zh"],
                   "maker": " / ".join(it["makers"][k]["label"] for k in it["makers"])})
    mp.sort(key=lambda p: p["mk"])
    write_json(OUT / "makers.json", {**points_file(mp, ["lon", "lat", "mk", "iso3", "name", "zh", "maker"], {"lon": 0.0001, "lat": 0.0001, "mk": 1},
                                                   strings=("iso3",)), "license": "CC0",
                                     "makers": [[label[m], sorted(maker_iso[m]), by_maker[m]] for m in top]})
    print(f"  Wikidata 有製造商的雲霄飛車 {len(items):,} 座（有座標 {len(mp):,}）；前 12 家："
          + "、".join(f"{label[m]}（{'/'.join(sorted(maker_iso[m]))}）{k}" for m, k in by_maker.most_common(12)))
    print("    依製造商的國家：" + "、".join(f"{c} {v}" for c, v in country.most_common(10)))

    # ── 遊樂設施（OSM，四支查詢一支一支跑） ──
    for ride in RIDES:
        c = osm_qlever.counts("attraction", ride)
        write_json(OUT / "rides" / f"{ride}.json", indicator_file("rides", "個", [YEAR], {k: [v] for k, v in sorted(c.items())},
                                                                  license="ODbL 1.0"))
        print(f"  {ride}：{sum(c.values()):,} 個、{len(c)} 國；" + "、".join(f"{k} {v}" for k, v in Counter(c).most_common(8))
              + f"；台灣 {c.get('TWN')}")
