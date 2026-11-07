"""通訊塔與行動基地台的密度（新主題，2026-11-07，製作手冊第二十七批 589，候選 1310；步驟 cell-towers，
輸出 topics/cell-towers/）。

- OpenStreetMap（ODbL 1.0）經 QLever（sources/osm_qlever.py；一個標籤一支、不併發）：
  1. `communication:mobile_phone=yes`（行動電話的天線或基地台；含冒號的 key 寫完整 IRI），各國數量；
  2. `tower:type=communication`（通訊用的塔與桅桿），各國數量；
  3. 1 的 `operator` 標籤，各國各營運者的數量（側欄的前幾名；名稱照 OSM 原樣，同一家業者的不同寫法沒有合併）。
  手冊的第三支是 `man_made=mast`，但桅桿含廣播、電視用的，要靠 `tower:type`／`communication:*` 篩，等於第 2 支，
  所以改查營運者。
- 手冊的陷阱：這張圖同時在量「OSM 畫得多完整」，照網站的規則只替 OSM 畫得完整的國家上色（osm_coverage.well_covered()），
  人口不到 10 萬的不畫；同一座塔上的多家業者可能畫成好幾個點。
- 密度是每萬平方公里（陸地面積 topics.oceans.land_areas()）。沒有做設施的點圖層（26 萬＋54 萬個點太大）。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, write_json
from sources import osm_coverage, osm_qlever, wpp
from sources.countries import from_alpha2
from topics.oceans import land_areas

OUT = OUT_DIR / "topics" / "cell-towers"
YEAR = 2026
MOBILE = "<https://www.openstreetmap.org/wiki/Key:communication:mobile_phone>"
MIN_POPULATION = 100  # 千人
TOP_OPERATORS = 6


def _mobile() -> dict[str, int]:
    rows = osm_qlever.query(f"""SELECT ?iso (COUNT(DISTINCT ?x) AS ?n) WHERE {{
  {osm_qlever.COUNTRIES}
  {{ SELECT ?x WHERE {{ ?x {MOBILE} "yes" }} }}
}} GROUP BY ?iso""", "count-communication_mobile_phone-yes")
    out: dict[str, int] = defaultdict(int)
    for r in rows:
        if (c := from_alpha2(r["iso"]["value"])):
            out[c] += int(r["n"]["value"])
    return out


def _operators() -> dict[str, list[tuple[str, int]]]:
    rows = osm_qlever.query(f"""SELECT ?iso ?op (COUNT(DISTINCT ?x) AS ?n) WHERE {{
  {osm_qlever.COUNTRIES}
  {{ SELECT ?x ?op WHERE {{ ?x {MOBILE} "yes" ; osmkey:operator ?op }} }}
}} GROUP BY ?iso ?op""", "operators-communication_mobile_phone-yes")
    out: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for r in rows:
        if (c := from_alpha2(r["iso"]["value"])):
            out[c][r["op"]["value"].strip()] += int(r["n"]["value"])
    return {c: sorted(ops.items(), key=lambda x: -x[1])[:TOP_OPERATORS] for c, ops in out.items()}


def build() -> None:
    mobile, towers, ops = _mobile(), osm_qlever.counts("tower:type", "communication"), _operators()
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    land = land_areas()
    pop = {c: s[YEAR] for c, s in wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"].items() if YEAR in s}
    countries = set(mobile) | set(towers)
    no_value, no_value_en = {}, {}
    shown = set()
    for c in countries:
        if c not in covered:
            no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
        elif pop.get(c, 0) < MIN_POPULATION:
            no_value[c], no_value_en[c] = "人口不到 10 萬，不畫", "Population under 100,000, not shown"
        else:
            shown.add(c)
    hints = {c: f"OpenStreetMap 上有行動電話的天線或基地台 {mobile.get(c, 0):,} 個、通訊塔 {towers.get(c, 0):,} 座" for c in countries}
    hints_en = {c: f"{mobile.get(c, 0):,} mobile phone antennas or base stations and {towers.get(c, 0):,} communication towers on OpenStreetMap"
                for c in countries}
    extra = {"hints": hints, "hintsEn": hints_en, "noValue": no_value, "noValueEn": no_value_en, "license": "ODbL 1.0"}
    for name, src in (("mobile", mobile), ("towers", towers)):
        density = {c: [round(src.get(c, 0) / land[c] * 10_000, 3)] for c in sorted(shown) if land.get(c)}
        write_json(OUT / f"{name}-density.json", indicator_file(f"{name}-density", "個／萬平方公里", [YEAR], density, **extra))
    write_json(OUT / "operators.json", {"year": YEAR, "countries": {c: ops[c] for c in sorted(ops)}, "license": "ODbL 1.0"})

    for name, src in (("行動電話天線", mobile), ("通訊塔", towers)):
        d = {c: src.get(c, 0) / land[c] * 10_000 for c in shown if land.get(c)}
        top = sorted(((round(v, 1), c) for c, v in d.items()), reverse=True)
        print(f"  {name} {sum(src.values()):,} 個、{len(src)} 國；畫 {len(d)} 國：{top[:10]}；台灣 {src.get('TWN')}（{'畫' if 'TWN' in shown else '不畫'}）")
    print(f"  不畫：{len(no_value)} 國；台灣 {no_value.get('TWN')}")
