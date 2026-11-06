"""長途步道與自行車路線：山屋與避難小屋（2026-11-06，製作手冊第二十四批 417；步驟 huts，輸出 topics/trails/）。

使用者 2026-11-06 決定做（872 露營地與青年旅館被排除不影響這一項：山屋是步道的配套，多半是山岳協會或林務機關蓋的）。

- 資料：OpenStreetMap 經 QLever（sources/osm_qlever.py；ODbL，© OpenStreetMap contributors），2026 年 11 月的快照：
  tourism=alpine_hut（山屋，有人管理、多半可以過夜用餐）與 tourism=wilderness_hut（避難小屋，沒有人管理）。
  面取所有頂點的平均當代表點。amenity=shelter（69 萬多筆，公車亭也是）太雜，不用。
- 兩類的界線各國畫法不同：阿爾卑斯有些 alpine_hut 是山上的餐廳，北歐有些 wilderness_hut 是沒人管的空屋，挪威 DNT 的
  有人管小屋算哪一類社群也沒有共識，所以各國的個數用兩類合計，點的顏色分兩類。
- 點全部畫；各國的個數與每萬平方公里幾處（陸地面積用 FAOSTAT，含台灣，跟海洋主題同一份）只替 OSM 覆蓋良好的
  國家上色（sources/osm_coverage.py 的共用名單），其他國家寫原因。
- 輸出的點（名稱、位置、海拔）是 OSM 的衍生資料庫，依 ODbL 1.0 分享。
"""
from __future__ import annotations

from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_points, write_json
from sources import osm_coverage, osm_qlever
from topics.oceans import land_areas

OUT = OUT_DIR / "topics" / "trails"
YEAR = 2026
ALPINE, WILDERNESS = 1, 2


def _ele(v: str) -> int | None:
    """ele 標籤 → 公尺（「2,402 m」「2402.5」這類），認不得的當沒有"""
    v = v.replace(",", "").replace("m", "").strip()
    try:
        x = float(v)
    except ValueError:
        return None
    return round(x) if -500 < x < 9000 else None


def build() -> None:
    points: dict[str, dict] = {}
    by_kind: dict[int, list[dict]] = {}
    for kind, value in ((ALPINE, "alpine_hut"), (WILDERNESS, "wilderness_hut")):
        rows = osm_qlever.features("tourism", value, ("name", "name:zh", "ele", "operator"))
        by_kind[kind] = rows
        for r in rows:
            if r["osm"] in points:  # 落在兩個重疊國界裡的，只留第一個
                continue
            c = osm_qlever.centroid(r["wkt"])
            if not c:
                continue
            points[r["osm"]] = {"lon": c[0], "lat": c[1], "k": kind, "iso3": r["iso3"], "n": r["name"] or None,
                                "nz": r["name:zh"] or None, "ele": _ele(r["ele"]),
                                "id": r["osm"].rsplit("/", 2)[-2][0] + r["osm"].rsplit("/", 1)[-1]}
    rows = sorted(points.values(), key=lambda p: (p["iso3"], p["lon"]))
    data = points_file(rows, ["lon", "lat", "k", "iso3", "ele", "n", "nz", "id"],
                       {"lon": 0.0001, "lat": 0.0001, "k": 1, "ele": 1}, strings=("iso3",))
    write_points(OUT / "huts.json", data, text=("n", "nz", "id"))

    cov = osm_coverage.coverage()
    covered = osm_coverage.well_covered()
    land = land_areas()
    n = {k: Counter(r["iso3"] for r in {r["osm"]: r for r in rows_k}.values()) for k, rows_k in by_kind.items()}
    total = n[ALPINE] + n[WILDERNESS]
    hints = {c: f"OpenStreetMap 上有山屋 {n[ALPINE].get(c, 0):,} 處、避難小屋 {n[WILDERNESS].get(c, 0):,} 處" for c in total}
    hints_en = {c: f"{n[ALPINE].get(c, 0):,} alpine huts and {n[WILDERNESS].get(c, 0):,} wilderness huts on OpenStreetMap"
                for c in total}
    no_value, no_value_en = {}, {}
    for c in total:
        if c not in covered:
            no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
    counts = {c: [v] for c, v in sorted(total.items()) if c in covered}
    density = {c: [round(v / land[c] * 10_000, 2)] for c, v in sorted(total.items()) if c in covered and land.get(c)}
    extra = {"hints": hints, "hintsEn": hints_en, "noValue": no_value, "noValueEn": no_value_en, "license": "ODbL 1.0"}
    write_json(OUT / "huts-count.json", indicator_file("huts-count", "處", [YEAR], counts, **extra))
    write_json(OUT / "huts-density.json", indicator_file("huts-density", "處／萬平方公里", [YEAR], density, **extra))

    print(f"  點：{len(rows)} 處（山屋 {sum(1 for p in rows if p['k'] == ALPINE)}、避難小屋 {sum(1 for p in rows if p['k'] == WILDERNESS)}），"
          f"有名稱 {sum(1 for p in rows if p['n'])}、有海拔 {sum(1 for p in rows if p['ele'] is not None)}")
    for k, zh in ((ALPINE, "山屋"), (WILDERNESS, "避難小屋")):
        print(f"  {zh}：{sum(n[k].values())} 處、{len(n[k])} 國；最多 {n[k].most_common(12)}；台灣 {n[k].get('TWN')}")
    top = sorted(((v[0], c) for c, v in density.items()), reverse=True)
    rank = [c for _, c in top].index("TWN") + 1 if "TWN" in density else None
    print(f"  上色 {len(counts)} 國；每萬平方公里最多 {top[:12]}；台灣 {density.get('TWN')}（第 {rank} 名）")
