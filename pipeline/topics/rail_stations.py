"""鐵路的擴充：火車站有幾座、密度多高，以及車站的無障礙（2026-11-07，製作手冊第二十七批 565，候選 1277、1281；
步驟 rail-stations，輸出 topics/transport/）。

資料：OpenStreetMap（ODbL 1.0）經 QLever（sources/osm_qlever.py），人口 UN WPP 2024。
- 火車站：`railway=station` 扣掉同時標 `station=subway` 的（地鐵站在「地鐵與城市軌道」主題，不重複算；手冊的提醒），
  加上招呼站 `railway=halt`。每百萬人照第二十一批的規則只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py），
  人口不到 10 萬的不畫；站數寫在 tooltip。
- 無障礙：所有 `railway=station`（含地鐵站）裡標 `wheelchair=yes` 與 `wheelchair=no` 的；沒標不等於不能坐輪椅進出，
  比例的分母只用有標的車站（會偏高），有標的不到 MIN_TAGGED 座不畫，tooltip 寫有標的占幾成（手冊的陷阱）。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, write_json
from sources import osm_coverage, osm_qlever, wpp
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "transport"
YEAR = 2026
MIN_POPULATION = 100  # 千人
MIN_TAGGED = 30
# 手冊 566 的提醒：標籤放進內層子查詢、sfContains 在外面，QLever 才不會先展開所有國界裡的物件
SUBWAY_STATIONS = """SELECT ?iso (COUNT(DISTINCT ?x) AS ?n) WHERE {
  %s
  { SELECT ?x WHERE { ?x osmkey:railway "station" ; osmkey:station "subway" . } }
} GROUP BY ?iso""" % osm_qlever.COUNTRIES
WHEELCHAIR = """SELECT ?iso ?w (COUNT(DISTINCT ?x) AS ?n) WHERE {
  %s
  { SELECT ?x ?w WHERE { ?x osmkey:railway "station" ; osmkey:wheelchair ?w . FILTER(?w IN ("yes", "no", "limited")) } }
} GROUP BY ?iso ?w""" % osm_qlever.COUNTRIES


def _counts(rows, key="n") -> dict[str, int]:
    out: dict[str, int] = {}
    for r in rows:
        iso3 = from_alpha2(r["iso"]["value"])
        if iso3:
            out[iso3] = out.get(iso3, 0) + int(r[key]["value"])
    return out


def build() -> None:
    all_stations = osm_qlever.counts("railway", "station")
    subway = _counts(osm_qlever.query(SUBWAY_STATIONS, "rail-stations-subway"))
    stations = {c: n - subway.get(c, 0) for c, n in all_stations.items()}
    halts = osm_qlever.counts("railway", "halt")
    wheel: dict[str, dict[str, int]] = defaultdict(dict)
    for r in osm_qlever.query(WHEELCHAIR, "rail-stations-wheelchair"):
        iso3 = from_alpha2(r["iso"]["value"])
        if iso3:
            wheel[iso3][r["w"]["value"]] = wheel[iso3].get(r["w"]["value"], 0) + int(r["n"]["value"])
    pop = {c: s[YEAR] for c, s in wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"].items() if YEAR in s}
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()

    density, hints, hints_en, no_value, no_value_en = {}, {}, {}, {}, {}
    for c in sorted(set(stations) | set(halts) | covered):
        if c not in pop:
            continue
        n, h = stations.get(c, 0), halts.get(c, 0)
        hints[c] = f"OpenStreetMap 上有 {n:,} 座火車站、{h:,} 個招呼站（不含地鐵站 {subway.get(c, 0):,} 座）"
        hints_en[c] = f"{n:,} railway stations and {h:,} halts on OpenStreetMap (excluding {subway.get(c, 0):,} metro stations)"
        if c not in covered:
            no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
        elif pop[c] < MIN_POPULATION:
            no_value[c] = "人口不到 10 萬，不畫"
            no_value_en[c] = "Population under 100,000, so not shown"
        else:
            density[c] = [round((n + h) / pop[c] * 1000, 1)]  # 人口是千人：每百萬人 = 個數 ÷ 千人 × 1000
    write_json(OUT / "rail-stations.json", indicator_file(
        "rail-stations", "座／百萬人", [YEAR], density, hints=hints, hintsEn=hints_en, noValue=no_value, noValueEn=no_value_en,
        license="ODbL 1.0"))

    share, w_hints, w_hints_en, w_nv, w_nv_en = {}, {}, {}, {}, {}
    for c, w in wheel.items():
        tagged = sum(w.values())
        total = all_stations.get(c, 0)
        if tagged >= MIN_TAGGED:
            share[c] = [round(w.get("yes", 0) / tagged * 100, 1)]
            w_hints[c] = (f"有標的 {tagged:,} 座裡 {w.get('yes', 0):,} 座可以、{w.get('limited', 0):,} 座部分、{w.get('no', 0):,} 座不行；"
                          f"全部 {total:,} 座車站有 {tagged / total:.0%} 有標" if total else "")
            w_hints_en[c] = (f"Of {tagged:,} tagged stations, {w.get('yes', 0):,} yes, {w.get('limited', 0):,} limited, {w.get('no', 0):,} no; "
                             f"{tagged / total:.0%} of all {total:,} stations are tagged" if total else "")
        else:
            w_nv[c] = f"OpenStreetMap 上只有 {tagged} 座車站標了能不能坐輪椅進出，不畫"
            w_nv_en[c] = f"Only {tagged} stations on OpenStreetMap say whether they are wheelchair accessible, so not shown"
    write_json(OUT / "station-wheelchair.json", indicator_file(
        "station-wheelchair", "%", [YEAR], share, hints=w_hints, hintsEn=w_hints_en, noValue=w_nv, noValueEn=w_nv_en,
        license="ODbL 1.0"))

    from collections import Counter
    print(f"  火車站（不含地鐵）{sum(stations.values()):,}、招呼站 {sum(halts.values()):,}、地鐵站 {sum(subway.values()):,}")
    print(f"    站數 {Counter(stations).most_common(8)}；招呼站 {Counter(halts).most_common(6)}")
    top = sorted(((v[0], c) for c, v in density.items()), reverse=True)
    print(f"    每百萬人 {len(top)} 國：{top[:10]} … {top[-6:]}")
    for c in ("TWN", "JPN", "KOR", "CHN", "DEU", "FRA", "GBR", "USA", "CHE", "AUT", "CZE", "IND"):
        print(f"    {c}：{stations.get(c)}+{halts.get(c)}（地鐵 {subway.get(c)}）{density.get(c)}；輪椅 {wheel.get(c)} {share.get(c)}")
    ws = sorted(((v[0], c) for c, v in share.items()), reverse=True)
    print(f"    輪椅 {len(ws)} 國：{ws[:8]} … {ws[-6:]}")
