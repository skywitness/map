"""獵人高台與釣魚點（新主題，2026-11-07，製作手冊第二十四批 437；步驟 hunting-fishing，輸出 topics/hunting-fishing/）。

- 資料：OpenStreetMap 經 QLever（sources/osm_qlever.py；ODbL 1.0，© OpenStreetMap contributors），2026 年 11 月的快照：
  amenity=hunting_stand（獵人在林子裡架的瞭望台）與 leisure=fishing（釣魚點）。
- 獵人高台約 31 萬座，點太多：在 QLever 端依經緯度 0.1° 的網格計數（GROUP BY），只輸出有高台的格子（格子中心與座數）；
  面（約 1%）沒有經緯度函數可用，不進網格，國家的座數照樣算。釣魚點約 2 萬處，全部畫點、有名稱的列在清單。
- 各國的座數、每千平方公里（獵人高台）與每萬平方公里（釣魚點）的密度（陸地面積用 FAOSTAT，跟山屋同一份），
  只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py）。德語區社群特別愛畫獵人高台，數量有一部分是測繪習慣，說明寫明。
- 「各國有多少人有狩獵執照」做不了（歐盟 FACE 沒有授權聲明也沒有分國數字，手冊 437），所以只做這兩個 OSM 標籤。
"""
from __future__ import annotations

from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json, write_manifest_part, write_points
from sources import osm_coverage, osm_qlever
from topics.oceans import land_areas

OUT = OUT_DIR / "topics" / "hunting-fishing"
YEAR = 2026
GRID = 0.1
GRID_QUERY = """PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
SELECT ?gx ?gy (COUNT(?x) AS ?n) WHERE {
  ?x osmkey:amenity "hunting_stand" ; geo:hasGeometry/geo:asWKT ?c .
  BIND(FLOOR(geof:longitude(?c) * 10) AS ?gx)
  BIND(FLOOR(geof:latitude(?c) * 10) AS ?gy)
} GROUP BY ?gx ?gy"""


def _density(counts: dict[str, int], per: float, covered: set[str], land: dict[str, float]) -> dict[str, list[float]]:
    return {c: [round(v / land[c] * per, 3 if v / land[c] * per < 1 else 2)] for c, v in sorted(counts.items())
            if c in covered and land.get(c)}


def build() -> None:
    cov, covered, land = osm_coverage.coverage(), osm_coverage.well_covered(), land_areas()

    # 獵人高台：網格與各國
    cells = []
    for r in osm_qlever.query(GRID_QUERY, "hunting-stand-grid"):
        if "gx" not in r:
            continue  # 面：沒有經緯度
        gx, gy = float(r["gx"]["value"]), float(r["gy"]["value"])
        cells.append({"lon": (gx + 0.5) * GRID, "lat": (gy + 0.5) * GRID, "n": int(r["n"]["value"])})
    cells.sort(key=lambda c: (c["lon"], c["lat"]))
    write_json(OUT / "hunting-grid.json", points_file(cells, ["lon", "lat", "n"], {"lon": 0.05, "lat": 0.05}, delta=("lon",)))
    hunt = osm_qlever.counts("amenity", "hunting_stand")
    fish = osm_qlever.counts("leisure", "fishing")

    def extra(counts: dict[str, int], zh: str, en: str) -> dict:
        nv, nv_en = {}, {}
        for c in counts:
            if c not in covered:
                nv[c], nv_en[c] = osm_coverage.reason(c, cov.get(c))
        return {"hints": {c: f"OpenStreetMap 上有{zh} {v:,} 處" for c, v in counts.items()},
                "hintsEn": {c: f"{v:,} {en} on OpenStreetMap" for c, v in counts.items()},
                "noValue": nv, "noValueEn": nv_en, "license": "ODbL 1.0"}

    ex_h = extra(hunt, "獵人高台", "hunting stands")
    ex_f = extra(fish, "釣魚點", "fishing spots")
    write_json(OUT / "hunting-density.json", indicator_file("hunting-density", "座／千平方公里", [YEAR],
                                                            _density(hunt, 1000, covered, land), **ex_h))
    write_json(OUT / "hunting-count.json", indicator_file("hunting-count", "座", [YEAR],
                                                          {c: [v] for c, v in sorted(hunt.items()) if c in covered}, **ex_h))
    write_json(OUT / "fishing-density.json", indicator_file("fishing-density", "處／萬平方公里", [YEAR],
                                                            _density(fish, 10_000, covered, land), **ex_f))
    write_json(OUT / "fishing-count.json", indicator_file("fishing-count", "處", [YEAR],
                                                          {c: [v] for c, v in sorted(fish.items()) if c in covered}, **ex_f))

    # 釣魚點
    points: dict[str, dict] = {}
    for r in osm_qlever.features("leisure", "fishing", ("name", "name:zh", "name:en")):
        if r["osm"] in points:
            continue
        c = osm_qlever.centroid(r["wkt"])
        if not c:
            continue
        points[r["osm"]] = {"lon": c[0], "lat": c[1], "iso3": r["iso3"], "n": r["name"] or None, "nz": r["name:zh"] or None,
                            "ne": r["name:en"] or None}
    rows = sorted(points.values(), key=lambda p: (p["iso3"], p["lon"]))
    write_points(OUT / "fishing.json", points_file(rows, ["lon", "lat", "iso3", "n", "nz", "ne"], {"lon": 0.0001, "lat": 0.0001},
                                                   strings=("iso3",)), text=("n", "nz", "ne"))
    tw_stands = osm_qlever.features("amenity", "hunting_stand", ("name", "description"), iso2="TW")
    write_manifest_part(OUT, "hunting-fishing", "hunting-fishing", {"sources": ["© OpenStreetMap contributors (ODbL 1.0), via QLever"]})

    dh = _density(hunt, 1000, covered, land)
    df = _density(fish, 10_000, covered, land)
    print(f"  獵人高台：{sum(hunt.values()):,} 座、{len(hunt)} 國；網格 {len(cells):,} 格、{sum(c['n'] for c in cells):,} 座；"
          f"最多 {Counter(hunt).most_common(16)}；台灣 {hunt.get('TWN')}")
    print(f"    每千平方公里：{sorted(((v[0], c) for c, v in dh.items()), reverse=True)[:12]}；台灣 {dh.get('TWN')}；"
          f"美國 {dh.get('USA')}、英國 {dh.get('GBR')}、法國 {dh.get('FRA')}")
    print(f"    德國占全球 {hunt.get('DEU', 0) / sum(hunt.values()) * 100:.1f}%；上色 {len(dh)} 國")
    print(f"  釣魚點：{sum(fish.values()):,} 處、{len(fish)} 國；點 {len(rows):,}、有名稱 {sum(1 for p in rows if p['n'])}；"
          f"最多 {Counter(fish).most_common(15)}；台灣 {fish.get('TWN')}")
    print(f"    每萬平方公里：{sorted(((v[0], c) for c, v in df.items()), reverse=True)[:12]}；台灣 {df.get('TWN')}")
    print(f"  台灣的獵人高台：{[(r['name'], r['description'][:30], r['wkt'][:40]) for r in tw_stands]}")
    print(f"  台灣的釣魚點（有名稱）：{[p['nz'] or p['n'] for p in rows if p['iso3'] == 'TWN' and p['n']][:30]}")
