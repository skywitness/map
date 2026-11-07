"""喪葬與墓地：墓地、火葬場與殯葬業（2026-11-07，製作手冊第二十七批 555，候選 1250、1251；新主題，社會・生活與文化）。

資料：OpenStreetMap（ODbL 1.0）經 QLever（sources/osm_qlever.py），人口用 UN WPP 2024。
- 墓地（landuse=cemetery）、墓園（amenity=grave_yard，多半在教堂旁，歐洲很多）是兩個標籤，同一處可能兩個都標，
  不能相加，各自一個指標。處數不等於面積；東亞的家族墓、納骨塔多半沒畫進 OSM，台灣一定低估。
- 殯葬業：shop=funeral_directors 或 office=funeral_directors（同一個物件只算一次）。
- 上面三項是每十萬人，照第二十一批的規則只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py），人口不到 10 萬的不畫。
- 火葬場（amenity=crematorium）：每一處畫點（面取中心），依點的位置分國（geoindex.countries_at，跟地圖的國界一致），
  各國的座數畫比例圓。火葬場是大型設施，跟賭場一樣不套覆蓋度名單，但 OSM 明顯不全（日本 300 多座、實際 1,400 多處；
  台灣 22 座、實際 30 多座公立火化場），說明寫明只能看定性差異。
- 每 100 處墓地有幾座火葬場：兩個標籤在同一國被畫的完整程度差不多時，比值比各自的密度穩定，所以不套覆蓋度名單，
  改成墓地至少 MIN_CEMETERIES 處才畫。泰國的寺廟幾乎都附火葬場，比值比墓地還多；伊斯蘭國家禁止火葬，是 0。
"""
from __future__ import annotations

from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json
from geoindex import countries_at
from sources import osm_coverage, osm_qlever, wpp
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "funeral"
YEAR = 2026
MIN_POPULATION = 100  # 千人
MIN_CEMETERIES = 200
FUNERAL_QUERY = """SELECT ?iso (COUNT(DISTINCT ?x) AS ?n) WHERE {
  %s
  { ?x osmkey:shop "funeral_directors" } UNION { ?x osmkey:office "funeral_directors" }
} GROUP BY ?iso""" % osm_qlever.COUNTRIES


def _per_100k(ind: str, counts: dict[str, int], pop: dict[str, float], zh: str, en: str, unit_zh: str) -> dict[str, list]:
    """每十萬人，只替覆蓋良好的國家上色；滑過寫 OSM 上的個數"""
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    values, hints, hints_en, no_value, no_value_en = {}, {}, {}, {}, {}
    for c in sorted(set(counts) | covered):
        if c not in pop:
            continue
        hints[c] = f"OpenStreetMap 上有 {counts.get(c, 0):,} {unit_zh}{zh}"
        hints_en[c] = f"{counts.get(c, 0):,} {en} on OpenStreetMap"
        if c not in covered:
            no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
        elif pop[c] < MIN_POPULATION:
            no_value[c] = "人口不到 10 萬，幾處就差很多，不畫"
            no_value_en[c] = "Population under 100,000, too small for a stable rate, so not shown"
        else:
            values[c] = [round(counts.get(c, 0) / pop[c] * 100, 2)]  # 人口是千人：每十萬人 = 個數 ÷ 千人 × 100
    write_json(OUT / f"{ind}.json", indicator_file(ind, f"{unit_zh}／十萬人", [YEAR], values, hints=hints, hintsEn=hints_en,
                                                   noValue=no_value, noValueEn=no_value_en, license="ODbL 1.0"))
    return values


def build() -> None:
    pop = {c: s[YEAR] for c, s in wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"].items() if YEAR in s}
    cemeteries = osm_qlever.counts("landuse", "cemetery")
    grave_yards = osm_qlever.counts("amenity", "grave_yard")
    funeral: dict[str, int] = {}
    for r in osm_qlever.query(FUNERAL_QUERY, "count-funeral-directors"):
        iso3 = from_alpha2(r["iso"]["value"])
        if iso3:
            funeral[iso3] = funeral.get(iso3, 0) + int(r["n"]["value"])

    # 火葬場的點
    rows, seen = [], set()
    for r in osm_qlever.features("amenity", "crematorium", extra=("name", "name:zh", "name:en")):
        if r["osm"] in seen:
            continue
        seen.add(r["osm"])
        c = osm_qlever.centroid(r["wkt"])
        if c:
            rows.append({"lon": round(c[0], 4), "lat": round(c[1], 4), "n": r["name"], "nz": r["name:zh"], "ne": r["name:en"]})
    for r, iso3 in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
        r["iso3"] = iso3 or ""
    rows.sort(key=lambda r: (r["iso3"], r["n"] or "~"))
    write_json(OUT / "crematoria.json", points_file(rows, ["lon", "lat", "iso3", "n", "nz", "ne"], {"lon": 0.0001, "lat": 0.0001},
                                                    strings=("iso3",)))
    crem = Counter(r["iso3"] for r in rows if r["iso3"])
    write_json(OUT / "crematoria-count.json", indicator_file(
        "crematoria-count", "座", [YEAR], {c: [v] for c, v in sorted(crem.items())}, license="ODbL 1.0"))

    v_cem = _per_100k("cemeteries", cemeteries, pop, "處墓地", "cemeteries", "處")
    v_grave = _per_100k("grave-yards", grave_yards, pop, "處墓園", "graveyards", "處")
    v_fun = _per_100k("funeral-homes", funeral, pop, "家殯葬業者", "funeral directors", "家")

    # 每 100 處墓地有幾座火葬場
    ratio, r_hints, r_hints_en, r_nv, r_nv_en = {}, {}, {}, {}, {}
    for c in sorted(set(cemeteries) | set(crem)):
        n_cem, n_crem = cemeteries.get(c, 0), crem.get(c, 0)
        r_hints[c] = f"OpenStreetMap 上有 {n_crem:,} 座火葬場、{n_cem:,} 處墓地"
        r_hints_en[c] = f"{n_crem:,} crematoria and {n_cem:,} cemeteries on OpenStreetMap"
        if n_cem >= MIN_CEMETERIES:
            ratio[c] = [round(n_crem / n_cem * 100, 2)]
        else:
            r_nv[c] = f"OpenStreetMap 上只有 {n_cem:,} 處墓地，比值不穩定，不畫"
            r_nv_en[c] = f"Only {n_cem:,} cemeteries on OpenStreetMap, too few for a stable ratio, so not shown"
    write_json(OUT / "crematoria-ratio.json", indicator_file(
        "crematoria-ratio", "座／百處墓地", [YEAR], ratio, hints=r_hints, hintsEn=r_hints_en, noValue=r_nv, noValueEn=r_nv_en,
        license="ODbL 1.0"))
    write_json(OUT / "manifest.json", {"topic": "funeral", "source": "© OpenStreetMap contributors (ODbL 1.0), via QLever",
                                       "license": "ODbL 1.0"})

    def top(values: dict[str, list], k: int = 10) -> list:
        return sorted(((v[0], c) for c, v in values.items()), reverse=True)[:k]

    print(f"  墓地 {sum(cemeteries.values()):,} 處、{len(cemeteries)} 國；{Counter(cemeteries).most_common(12)}")
    print(f"    每十萬人（{len(v_cem)} 國）{top(v_cem)}；台灣 {cemeteries.get('TWN')} {v_cem.get('TWN')}；"
          f"日本 {v_cem.get('JPN')}、美國 {v_cem.get('USA')}、南韓 {v_cem.get('KOR')}、法國 {v_cem.get('FRA')}、德國 {v_cem.get('DEU')}")
    print(f"  墓園 {sum(grave_yards.values()):,} 處；{Counter(grave_yards).most_common(10)}；每十萬人 {top(v_grave)}；台灣 {grave_yards.get('TWN')}")
    print(f"  殯葬業 {sum(funeral.values()):,} 家；{Counter(funeral).most_common(10)}；每十萬人 {top(v_fun)}；"
          f"台灣 {funeral.get('TWN')} {v_fun.get('TWN')}；日本 {v_fun.get('JPN')}、美國 {v_fun.get('USA')}")
    print(f"  火葬場 {len(rows):,} 座、{len(crem)} 國；{crem.most_common(15)}；台灣 {crem.get('TWN')}；"
          f"有名稱 {sum(1 for r in rows if r['n'])}")
    print(f"  每百處墓地的火葬場（{len(ratio)} 國）{top(ratio, 15)}；0 的 {sum(1 for v in ratio.values() if v[0] == 0)} 國；"
          f"台灣 {ratio.get('TWN')}、日本 {ratio.get('JPN')}、美國 {ratio.get('USA')}、英國 {ratio.get('GBR')}、印度 {ratio.get('IND')}、"
          f"中國 {ratio.get('CHN')}、南韓 {ratio.get('KOR')}；世界 {sum(crem.values()) / sum(cemeteries.values()) * 100:.2f}")
