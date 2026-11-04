"""攀岩場分布（2026-11-04，製作手冊第二十一批 363）。

- OpenStreetMap 經 QLever（sources/osm_qlever.py；ODbL）：岩場 climbing=crag 的點（面、線取中心）。更寬的 sport=climbing
  （含每一條攀岩路線、攀岩館）各國差太多（捷克把每條路線都畫進 OSM，每十萬人是美國的 125 倍），所以地圖的主層用岩場；
  各國的 sport=climbing 個數寫在 tooltip。
- 台灣沒有任何 climbing=crag（台灣的 52 個 sport=climbing 是個別路線與攀岩館），另外一層畫台灣的 sport=climbing，
  說明寫明口徑不同。
- 各國岩場數的面量圖只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py 的共用名單）。點全部畫。
- 輸出的點（名稱、位置）是 OSM 的衍生資料庫，依 ODbL 1.0 分享。
"""
from __future__ import annotations

from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json
from sources import osm_coverage, osm_qlever

OUT = OUT_DIR / "topics" / "climbing"
YEAR = 2026
CRAG, TAIWAN_SPOT = 1, 2


def build() -> None:
    crags = osm_qlever.features("climbing", "crag", extra=("name", "name:zh", "name:en"))
    tw = osm_qlever.features("sport", "climbing", extra=("name", "name:zh", "name:en"), iso2="TW")
    broad = osm_qlever.counts("sport", "climbing")
    seen, rows = set(), []
    for kind, src in ((CRAG, crags), (TAIWAN_SPOT, tw)):
        for r in src:
            if r["osm"] in seen:
                continue
            seen.add(r["osm"])
            c = osm_qlever.centroid(r["wkt"])
            if c:
                rows.append({"lon": c[0], "lat": c[1], "k": kind, "iso3": r["iso3"], "n": r["name"], "nz": r["name:zh"], "ne": r["name:en"]})
    rows.sort(key=lambda p: (p["iso3"], p["n"] or "~"))
    write_json(OUT / "crags.json", points_file(rows, ["lon", "lat", "k", "iso3", "n", "nz", "ne"], {"lon": 0.0001, "lat": 0.0001, "k": 1},
                                               strings=("iso3",)))
    n = Counter(r["iso3"] for r in {r["osm"]: r for r in crags}.values())
    cov = osm_coverage.coverage()
    covered = osm_coverage.well_covered()
    hints = {c: f"OpenStreetMap 上有 {n.get(c, 0):,} 個岩場、{broad.get(c, 0):,} 個標成攀岩的地點（含個別路線、攀岩館）"
             for c in set(n) | set(broad)}
    hints_en = {c: f"{n.get(c, 0):,} crags and {broad.get(c, 0):,} climbing features (incl. individual routes and gyms) on OpenStreetMap"
                for c in set(n) | set(broad)}
    no_value, no_value_en = {}, {}
    for c in set(n) | set(broad):
        if c not in covered:
            no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
    no_value["TWN"] = "台灣的 OpenStreetMap 沒有標成岩場（climbing=crag）的地方；地圖上另外畫台灣標成攀岩的 52 個點（個別路線與攀岩館）"
    no_value_en["TWN"] = "Taiwan has no OpenStreetMap features tagged as crags; its climbing features (routes and gyms) are drawn as a separate layer"
    values = {c: [n.get(c, 0)] for c in sorted(covered) if c != "TWN"}  # 覆蓋良好但沒有岩場的寫 0
    write_json(OUT / "crag-count.json", indicator_file("crag-count", "個", [YEAR], values, hints=hints, hintsEn=hints_en,
                                                       noValue=no_value, noValueEn=no_value_en, license="ODbL 1.0"))
    write_json(OUT / "manifest.json", {"topic": "climbing", "source": "© OpenStreetMap contributors (ODbL 1.0), via QLever", "license": "ODbL 1.0"})
    print(f"  岩場：{sum(n.values())} 個、{len(n)} 國（上色 {len(values)}）；{n.most_common(12)}；台灣補 {len(tw)} 個 sport=climbing")
    print(f"  sport=climbing：{sum(broad.values())} 個、{len(broad)} 國；{Counter(broad).most_common(8)}；點 {len(rows)}，有名稱 {sum(1 for r in rows if r['n'])}")
