"""潛水中心與潛點（2026-11-04，製作手冊第二十一批 343）。

- 資料：OpenStreetMap 經 QLever（sources/osm_qlever.py；ODbL，© OpenStreetMap contributors），2026 年 11 月的快照：
  amenity=dive_centre（潛水中心，2,321 個）與 sport=scuba_diving（潛水場域，4,667 個）；兩個標籤都有的算潛水中心。
  面與線取所有頂點的平均當代表點（潛水場域有 543 個面）。
- **sport=scuba_diving 不只海洋潛點**：分國第一是德國、第三是瑞士、第六是荷蘭，多半是內陸的採石場湖、潛水池與
  訓練水域，所以這一層叫「潛水場域（含內陸訓練水域）」；要看潛水勝地看潛水中心（菲律賓、法國、泰國、印尼、埃及…）。
- 點圖是主角（全部畫）；各國的個數（面量圖）只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py 的共用名單）。
- 輸出的點（名稱、位置）是 OSM 的衍生資料庫，依 ODbL 1.0 分享。
"""
from __future__ import annotations

from collections import Counter

from common import OUT_DIR, indicator_file, now_iso, points_file, write_json
from sources import osm_coverage, osm_qlever

OUT = OUT_DIR / "topics" / "diving"
YEAR = 2026
CENTRE, SITE = 1, 2


def build() -> None:
    centres = osm_qlever.features("amenity", "dive_centre", extra=("name", "name:zh", "name:en", "website"))
    sites = osm_qlever.features("sport", "scuba_diving", extra=("name", "name:zh", "name:en"))
    points: dict[str, dict] = {}
    for kind, rows in ((CENTRE, centres), (SITE, sites)):
        for r in rows:
            if r["osm"] in points:  # 兩個標籤都有、或落在兩個重疊國界裡的，只留第一個（潛水中心優先）
                continue
            c = osm_qlever.centroid(r["wkt"])
            if not c:
                continue
            points[r["osm"]] = {"lon": c[0], "lat": c[1], "k": kind, "iso3": r["iso3"], "n": r["name"],
                                "nz": r["name:zh"], "ne": r["name:en"], "id": r["osm"].rsplit("/", 2)[-2][0] + r["osm"].rsplit("/", 1)[-1]}
    rows = sorted(points.values(), key=lambda p: (p["iso3"], p["k"], p["n"] or "~"))
    write_json(OUT / "places.json", points_file(rows, ["lon", "lat", "k", "iso3", "n", "nz", "ne", "id"], {"lon": 0.0001, "lat": 0.0001, "k": 1}))
    cov = osm_coverage.coverage()
    covered = osm_coverage.well_covered()
    for ind, rows_of_kind, zh, en in (("dive-centres", centres, "潛水中心", "dive centres"),
                                      ("dive-sites", sites, "潛水場域", "diving sites")):
        n = Counter(r["iso3"] for r in {r["osm"]: r for r in rows_of_kind}.values())
        values = {c: [v] for c, v in sorted(n.items()) if c in covered}
        hints = {c: f"OpenStreetMap 上有 {v:,} 個{zh}" for c, v in n.items()}
        hints_en = {c: f"{v:,} {en} on OpenStreetMap" for c, v in n.items()}
        no_value, no_value_en = {}, {}
        for c in n:
            if c not in covered:
                no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
        write_json(OUT / f"{ind}.json", indicator_file(ind, "個", [YEAR], values, hints=hints, hintsEn=hints_en,
                                                       noValue=no_value, noValueEn=no_value_en, license="ODbL 1.0"))
        print(f"  {ind}：{sum(n.values())} 個、{len(n)} 國（上色 {len(values)} 國）；最多 {n.most_common(10)}；台灣 {n.get('TWN')}")
    write_json(OUT / "manifest.json", {"topic": "diving", "generatedAt": now_iso(),
                                       "source": "© OpenStreetMap contributors (ODbL 1.0), via QLever", "license": "ODbL 1.0"})
    print(f"  點：{len(rows)} 個，有名稱 {sum(1 for p in rows if p['n'])}")
