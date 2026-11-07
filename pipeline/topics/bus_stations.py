"""新主題「長途客運站與公車站」（2026-11-07，製作手冊第二十七批 576，候選 1292；步驟 bus-stations，輸出 topics/bus-stations/）。

資料：OpenStreetMap（ODbL 1.0）經 QLever（sources/osm_qlever.py）。
- 主軸是客運站的點圖層（使用者兩次否決「公共運輸的可及性」，手冊建議主軸放在客運站在哪裡）：`amenity=bus_station`
  （長途客運站與公車總站）的每一個點（名稱、國家），各國座數畫比例圓。手冊的陷阱：菲律賓、秘魯把小站也標成 bus_station。
- 附帶指標：`highway=bus_stop`（公車站牌）每百萬人，只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py；
  新加坡 5,651 之類的完整度差很多）。
- 點的清單（名稱、座標）是 Derivative Database，依 ODbL 分享。
"""
from __future__ import annotations

from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json
from sources import osm_coverage, osm_qlever, wpp

OUT = OUT_DIR / "topics" / "bus-stations"
YEAR = 2026
MIN_POPULATION = 100  # 千人


def build() -> None:
    stations = osm_qlever.features("amenity", "bus_station", extra=("name", "name:zh", "name:en"))
    stops = osm_qlever.counts("highway", "bus_stop")
    points, per_country = [], Counter()
    seen = set()
    for f in stations:
        if f["osm"] in seen:
            continue
        seen.add(f["osm"])
        c = osm_qlever.centroid(f["wkt"])
        if not c:
            continue
        per_country[f["iso3"]] += 1
        points.append({"lon": round(c[0], 4), "lat": round(c[1], 4), "n": f["name"], "nz": f["name:zh"], "ne": f["name:en"], "iso3": f["iso3"]})
    write_json(OUT / "stations.json", points_file(points, ["lon", "lat", "n", "nz", "ne", "iso3"], {"lon": 0.0001, "lat": 0.0001},
                                                  strings=["iso3"]))
    write_json(OUT / "stations-count.json", indicator_file(
        "bus-stations", "座", [YEAR], {c: [n] for c, n in sorted(per_country.items())}, license="ODbL 1.0"))

    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    pop = {c: s[YEAR] for c, s in wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"].items() if YEAR in s}
    v, h, he, nv, nve = {}, {}, {}, {}, {}
    for c in sorted(set(stops) | covered):
        if c not in pop:
            continue
        n = stops.get(c, 0)
        h[c], he[c] = f"OpenStreetMap 上有 {n:,} 個公車站牌", f"{n:,} bus stops on OpenStreetMap"
        if c not in covered:
            nv[c], nve[c] = osm_coverage.reason(c, cov.get(c))
        elif pop[c] < MIN_POPULATION:
            nv[c], nve[c] = "人口不到 10 萬，不畫", "Population under 100,000, so not shown"
        else:
            v[c] = [round(n / pop[c], 2)]  # 人口是千人：每千人
    write_json(OUT / "bus-stops.json", indicator_file(
        "bus-stops", "個／千人", [YEAR], v, hints=h, hintsEn=he, noValue=nv, noValueEn=nve, license="ODbL 1.0"))
    write_json(OUT / "manifest.json", {"stations": len(points), "countries": len(per_country), "stops": sum(stops.values())})

    print(f"  客運站 {len(points):,} 座、{len(per_country)} 國：{per_country.most_common(14)}；TWN {per_country.get('TWN')} KOR {per_country.get('KOR')} SGP {per_country.get('SGP')}")
    print(f"  公車站牌 {sum(stops.values()):,}、{len(stops)} 國：{Counter(stops).most_common(10)}；TWN {stops.get('TWN')} SGP {stops.get('SGP')}")
    top = sorted(((x[0], c) for c, x in v.items()), reverse=True)
    print(f"  每千人 {len(top)} 國：{top[:10]} … {top[-6:]}；TWN {v.get('TWN')} JPN {v.get('JPN')} KOR {v.get('KOR')}")
