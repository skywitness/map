"""景點地圖的擴充：天文館、觀光景點的總量與密度、購物中心與百貨公司（2026-11-08，製作手冊第二十七批 646，候選 1415、1416、1417；
步驟 attractions-more，輸出 topics/attractions/）；都市公園（647，候選 1418；步驟 urban-parks）。

OpenStreetMap 經 QLever（ODbL 1.0），一個標籤一支查詢、不併發：
- 天文館 `amenity=planetarium`（約 950 處）：全部畫點（代表點），有名稱的列在清單；各國處數畫比例圓，數量少不做面量圖。
  這是給一般人看星星的天文館，不是研究用的天文台（「大型科學設施」）。
- 觀光景點 `tourism=attraction`（約 25 萬處）：每千平方公里（陸地面積 FAOSTAT），點分成 0.1° 的網格。這是 OSM 最被濫用的標籤之一，
  是「有人覺得值得一看」，不是官方認定的景點。
- 購物中心 `shop=mall`、百貨公司 `shop=department_store`：每百萬人（2024 年人口，WPP）。`shop=mall` 在美國是 mall、在東亞是商場。
- 都市公園 `leisure=park`（約 130 萬個物件）：每十萬人，不畫點；含國家公園的一部分、社區小綠地，大小差好幾個量級。
密度都只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py）。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, points_file, write_json, write_points
from sources import osm_qlever
from topics.osm_density import YEAR, area_density, density, grid, write_grid

OUT = OUT_DIR / "topics" / "attractions"


def _planetariums() -> None:
    n = osm_qlever.counts("amenity", "planetarium")
    write_json(OUT / "planetarium-count.json", indicator_file("planetarium-count", "處", [YEAR], {c: [v] for c, v in sorted(n.items())},
                                                              license="ODbL 1.0"))
    points: dict[str, dict] = {}
    for r in osm_qlever.features("amenity", "planetarium", ("name", "name:zh", "name:en")):
        if r["osm"] in points:
            continue
        c = osm_qlever.centroid(r["wkt"])
        if not c:
            continue
        points[r["osm"]] = {"lon": round(c[0], 4), "lat": round(c[1], 4), "iso3": r["iso3"], "n": r["name"] or None,
                            "nz": r["name:zh"] or None, "ne": r["name:en"] or None}
    rows = sorted(points.values(), key=lambda p: (p["iso3"], p["lon"]))
    write_points(OUT / "planetariums.json", points_file(rows, ["lon", "lat", "iso3", "n", "nz", "ne"], {"lon": 0.0001, "lat": 0.0001},
                                                        strings=("iso3",)), ("n", "nz", "ne"))
    top = sorted(n.items(), key=lambda kv: -kv[1])
    print(f"  天文館：{sum(n.values()):,} 處、{len(n)} 國；" + "、".join(f"{c} {v}" for c, v in top[:12]) + f"；台灣 {n.get('TWN')}")
    print(f"    點 {len(rows):,}（有名稱 {sum(1 for r in rows if r['n'])}）；台灣：{[r['nz'] or r['n'] for r in rows if r['iso3'] == 'TWN']}")


def build() -> None:
    _planetariums()
    n = osm_qlever.counts("tourism", "attraction")
    area_density(OUT, "osm-attractions", n, "處/千平方公里", 1000, hints=("觀光景點", "attractions"))
    write_grid(OUT, "osm-attractions-grid", grid("tourism", ("attraction",), "觀光景點"))
    density(OUT, "shop", "mall", "malls-osm", "家/百萬人", 1e6, "購物中心")
    density(OUT, "shop", "department_store", "department-stores", "家/百萬人", 1e6, "百貨公司")


def parks() -> None:
    density(OUT, "leisure", "park", "urban-parks", "座/十萬人", 1e5, "都市公園")
