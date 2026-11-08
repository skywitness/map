"""OSM 的分國計數與密度（2026-11-08，製作手冊第二十七批 641、642 共用；步驟 culture-venues、attractions-osm）。

- 641（候選 1405）劇院與藝文中心：`amenity=theatre`、`amenity=arts_centre`，放「文化」主題（topics/culture/），每十萬人。
- 642（候選 1406）動物園與水族館：`tourism=zoo`、`tourism=aquarium`，放「景點地圖」（topics/attractions/），數量少用每千萬人。
  候選 1407（動物園的面積、物種數、人次）：Wikidata（CC0）的動物園（Q43501 含子類別）的 P2046、P1990、P1174；手冊說材料不夠，
  只做清單、不上色。面積用正規化成平方公尺的值（psn:P2046；wdt: 是原本的單位，公頃、平方公里混在一起）；
  P1990（飼養的物種）是逐一列出的物種項目，所以是「Wikidata 列了幾種」，不是園方的物種總數。

OSM 經 QLever（ODbL 1.0），一個標籤一支查詢、不併發；密度只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py）。
"""
from __future__ import annotations

import re
from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json, write_points
from geoindex import countries_at
from sources import osm_coverage, osm_qlever, qlever_wikidata, wpp
from zh_names import wikidata_zh

YEAR = 2026
MIN_POPULATION = 100  # 千人


def density(out_dir, key: str, value: str, name: str, unit: str, per: float, label: str) -> dict[str, int]:
    """寫 <name>.json（處數）與 <name>-per.json（每 per 人）；回傳各國處數"""
    n = osm_qlever.counts(key, value)
    write_json(out_dir / f"{name}.json", indicator_file(name, "處", [YEAR], {c: [v] for c, v in sorted(n.items())}, license="ODbL 1.0"))
    pop = {c: s[2024] for c, s in wpp.demographic(["TPopulation1July"], last_year=2024)["TPopulation1July"].items() if s.get(2024)}
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    values, nv, nv_en = {}, {}, {}
    for c in sorted(set(n) | covered):
        if c not in pop:
            continue
        if c not in covered:
            nv[c], nv_en[c] = osm_coverage.reason(c, cov.get(c))
        elif pop[c] < MIN_POPULATION:
            nv[c] = "人口不到 10 萬，一兩處就差很多，不畫"
            nv_en[c] = "Population under 100,000, too small for a stable rate, so not shown"
        else:
            values[c] = [round(n.get(c, 0) / (pop[c] * 1000) * per, 2)]
    write_json(out_dir / f"{name}-per.json", indicator_file(f"{name}-per", unit, [YEAR], values, noValue=nv, noValueEn=nv_en, license="ODbL 1.0"))
    top = sorted(n.items(), key=lambda kv: -kv[1])
    r = sorted(((c, v[0]) for c, v in values.items()), key=lambda x: -x[1])
    print(f"  {label}（{key}={value}）：{sum(n.values()):,} 處、{len(n)} 國；" + "、".join(f"{c} {v:,}" for c, v in top[:10]) + f"；台灣 {n.get('TWN')}")
    print(f"    {unit}（覆蓋良好 {len(values)} 國）：" + "、".join(f"{c} {v}" for c, v in r[:8]) + " … "
          + "、".join(f"{c} {values[c][0]}" for c in ("TWN", "JPN", "USA", "DEU", "FRA", "GBR", "KOR") if c in values))
    return n


GRID = 0.1


def grid(key: str, values: tuple[str, ...], name: str) -> list[dict]:
    """key 是 values 之一的物件，在 QLever 端依代表點（geof:centroid，面也算）分成經緯度 0.1° 的格子計數（同第 438 點的獵人高台）"""
    vals = " ".join(f'"{v}"' for v in values)
    rows = osm_qlever.query(f"""PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
SELECT ?gx ?gy (COUNT(DISTINCT ?x) AS ?n) WHERE {{
  VALUES ?v {{ {vals} }}
  ?x osmkey:{key} ?v ; geo:hasGeometry/geo:asWKT ?wkt .
  BIND(geof:centroid(?wkt) AS ?c)
  BIND(FLOOR(geof:longitude(?c) * 10) AS ?gx)
  BIND(FLOOR(geof:latitude(?c) * 10) AS ?gy)
}} GROUP BY ?gx ?gy""", f"grid-{key}-{'-'.join(values)}")
    cells = []
    for r in rows:
        if "gx" not in r or "gy" not in r:
            continue
        gx, gy = float(r["gx"]["value"]), float(r["gy"]["value"])
        cells.append({"lon": round((gx + 0.5) * GRID, 2), "lat": round((gy + 0.5) * GRID, 2), "n": int(r["n"]["value"])})
    cells.sort(key=lambda c: (c["lon"], c["lat"]))
    print(f"    網格 {name}：{len(cells):,} 格、{sum(c['n'] for c in cells):,} 處；一格最多 {max(c['n'] for c in cells)}")
    return cells


def write_grid(out_dir, name: str, cells: list[dict]) -> None:
    write_json(out_dir / f"{name}.json", points_file(cells, ["lon", "lat", "n"], {"lon": 0.05, "lat": 0.05}, delta=("lon",)))


def area_density(out_dir, name: str, n: dict[str, int], unit: str, per: float, *, count: bool = True, per_file: bool = True,
                 color: bool = True, hints: tuple[str, str] | None = None) -> dict[str, list[float]]:
    """寫 <name>.json（處數；color=False 時國家不上色、處數只當提示）與 <name>-per.json（每 per 平方公里，
    陸地面積用 FAOSTAT，同第 438 點）；密度只替 OSM 覆蓋良好的國家上色"""
    from topics.oceans import land_areas
    land = land_areas()
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    extra: dict = {"license": "ODbL 1.0"}
    if hints:
        extra["hints"] = {c: f"OpenStreetMap 上有{hints[0]} {v:,} 處" for c, v in n.items()}
        extra["hintsEn"] = {c: f"{v:,} {hints[1]} on OpenStreetMap" for c, v in n.items()}
    if count:
        write_json(out_dir / f"{name}.json", indicator_file(name, "處", [YEAR], {c: [v] for c, v in sorted(n.items())} if color else {},
                                                            **extra))
    values, nv, nv_en = {}, {}, {}
    for c in sorted(set(n) | covered):
        if not land.get(c):
            continue
        if c not in covered:
            nv[c], nv_en[c] = osm_coverage.reason(c, cov.get(c))
        elif land[c] < 1000:
            nv[c] = "陸地不到 1,000 平方公里，一兩處就差很多，不畫"
            nv_en[c] = "Land area under 1,000 km², too small for a stable rate, so not shown"
        else:
            v = n.get(c, 0) / land[c] * per
            values[c] = [round(v, 2 if v < 10 else 1)]
    if per_file:
        write_json(out_dir / f"{name}-per.json", indicator_file(f"{name}-per", unit, [YEAR], values, noValue=nv, noValueEn=nv_en, **extra))
    top = sorted(n.items(), key=lambda kv: -kv[1])
    r = sorted(((c, v[0]) for c, v in values.items()), key=lambda x: -x[1])
    print(f"  {name}：{sum(n.values()):,} 處、{len(n)} 國；" + "、".join(f"{c} {v:,}" for c, v in top[:12]) + f"；台灣 {n.get('TWN')}")
    print(f"    {unit}（覆蓋良好 {len(values)} 國）：" + "、".join(f"{c} {v}" for c, v in r[:10]) + " … "
          + "、".join(f"{c} {values[c][0]}" for c in ("TWN", "JPN", "USA", "DEU", "FRA", "GBR", "KOR", "ITA", "ESP") if c in values))
    return values


def culture_venues() -> None:
    out = OUT_DIR / "topics" / "culture"
    density(out, "amenity", "theatre", "theatres", "家/十萬人", 1e5, "劇院")
    density(out, "amenity", "arts_centre", "arts-centres", "家/十萬人", 1e5, "藝文中心")


def _zoo_facts() -> None:
    rows = qlever_wikidata.cached("zoo-facts", """
SELECT ?z ?coord ?area ?sp ?v ?en ?zhtw ?zh WHERE {
  ?z wdt:P31/wdt:P279* wd:Q43501 ; wdt:P625 ?coord .
  { ?z wdt:P2046 ?area } UNION { ?z wdt:P1990 ?sp } UNION { ?z wdt:P1174 ?v }
  OPTIONAL { ?z rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?z rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?z rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
  FILTER NOT EXISTS { ?z wdt:P576 [] }
}""")
    area_m2: dict[str, float] = {}
    for r in qlever_wikidata.cached("zoo-area-normalized", """SELECT ?z ?a WHERE {
  ?z wdt:P31/wdt:P279* wd:Q43501 ; p:P2046/<http://www.wikidata.org/prop/statement/value-normalized/P2046>/wikibase:quantityAmount ?a .
}"""):
        q = r["z"]["value"].rsplit("/", 1)[1]
        try:
            area_m2[q] = max(area_m2.get(q, 0), float(r["a"]["value"]))
        except ValueError:
            pass
    items: dict[str, dict] = {}
    for r in rows:
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", v("coord") or "", re.I)
        if not m:
            continue
        q = v("z").rsplit("/", 1)[1]
        d = items.setdefault(q, {"lon": float(m.group(1)), "lat": float(m.group(2)), "en": v("en"),
                                 "zh": wikidata_zh(v("zhtw"), v("zh"), place=True, terms=False), "area": [], "sp": set(), "spn": [], "v": []})
        if q in area_m2:
            d["area"] = [area_m2[q]]
        try:
            if v("v"):
                d["v"].append(float(v("v")))
        except ValueError:
            pass
        if v("sp"):
            try:
                d["spn"].append(float(v("sp")))
            except ValueError:
                d["sp"].add(v("sp"))  # 逐一列出的物種（項目）
    out = []
    for d in items.values():
        sp = max([len(d["sp"])] + d["spn"]) if (d["sp"] or d["spn"]) else None
        out.append({"lon": d["lon"], "lat": d["lat"], "ha": round(max(d["area"]) / 1e4, 1) if d["area"] else None,
                    "sp": round(sp) if sp else None, "v": round(max(d["v"])) if d["v"] else None, "en": d["en"], "zh": d["zh"]})
    for o, iso in zip(out, countries_at([o["lon"] for o in out], [o["lat"] for o in out])):
        o["iso3"] = iso
    out = [o for o in out if o["iso3"]]
    out.sort(key=lambda o: -(o["v"] or 0))
    write_points(OUT_DIR / "topics" / "attractions" / "zoo-facts.json",
                 points_file(out, ["lon", "lat", "ha", "sp", "v", "iso3", "en", "zh"], {"lon": 0.001, "lat": 0.001, "ha": 0.1, "sp": 1, "v": 1},
                             strings=("iso3",)), ("en", "zh"))
    c = Counter("ha" if o["ha"] else None for o in out)
    print(f"  Wikidata 動物園：有面積 {sum(1 for o in out if o['ha'])}、有物種數 {sum(1 for o in out if o['sp'])}、有人次 {sum(1 for o in out if o['v'])}，共 {len(out)} 座；"
          f"台灣 {[(o['zh'] or o['en'], o['ha'], o['sp'], o['v']) for o in out if o['iso3'] == 'TWN']}")


def attractions_osm() -> None:
    out = OUT_DIR / "topics" / "attractions"
    density(out, "tourism", "zoo", "zoos-osm", "座/千萬人", 1e7, "動物園")
    density(out, "tourism", "aquarium", "aquariums-osm", "座/千萬人", 1e7, "水族館")
    _zoo_facts()
