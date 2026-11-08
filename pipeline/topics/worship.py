"""禮拜場所的密度與宗教組成（2026-11-07，製作手冊第二十七批 553，候選 1246、1247；擴充「宗教」；步驟 worship，
輸出 topics/religion/）。

資料：OpenStreetMap（ODbL 1.0）經 QLever（sources/osm_qlever.py）：amenity=place_of_worship 的各國個數，與同時標了
religion 的各國、各宗教個數。人口用 UN WPP 2024。

- 每十萬人幾座：OSM 的密度同時在量 OSM 畫得多完整，照第二十一批的規則只替覆蓋良好的國家上色（sources/osm_coverage.py，
  用餐飲店對餐飲業就業人數判斷），其他寫原因；人口不到 10 萬的不畫。place_of_worship 也含已經不用的建築。
- 哪一教的場所最多：只看有標 religion 的場所（台灣 14,547 座裡約 58%）；有標的不到 100 座或不到一半的國家不畫。
  這是場所數、不是信徒人數（道教的宮廟小而多，台灣的道教場所是基督宗教的 4 倍），說明寫明。
  宗教合成 8 類：基督宗教、伊斯蘭、佛教、印度教、神道、道教（含華人民間信仰 chinese_folk）、猶太教、其他。
"""
from __future__ import annotations

from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, write_json
from sources import osm_coverage, osm_qlever, wpp
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "religion"
YEAR = 2026
MIN_POPULATION = 100  # 千人
MIN_TAGGED = 100
MIN_TAGGED_SHARE = 0.5
GROUPS = {"christian": 1, "muslim": 2, "buddhist": 3, "hindu": 4, "shinto": 5, "taoist": 6, "chinese_folk": 6, "jewish": 7}
OTHER = 8
NAMES = {1: ("基督宗教", "Christian"), 2: ("伊斯蘭", "Muslim"), 3: ("佛教", "Buddhist"), 4: ("印度教", "Hindu"),
         5: ("神道", "Shinto"), 6: ("道教與民間信仰", "Taoist and folk"), 7: ("猶太教", "Jewish"), 8: ("其他", "Other")}
RELIGION_QUERY = """SELECT ?iso ?rel (COUNT(DISTINCT ?x) AS ?n) WHERE {
  %s
  ?x osmkey:amenity "place_of_worship" ; osmkey:religion ?rel .
} GROUP BY ?iso ?rel""" % osm_qlever.COUNTRIES


def build() -> None:
    total = osm_qlever.counts("amenity", "place_of_worship")
    by_rel: dict[str, Counter] = defaultdict(Counter)
    for r in osm_qlever.query(RELIGION_QUERY, "worship-religion"):
        iso3 = from_alpha2(r["iso"]["value"])
        if iso3:
            by_rel[iso3][r["rel"]["value"].strip().lower()] += int(r["n"]["value"])
    # 子屬地分開、從母國減掉（製作手冊 1-f，sources/osm_qlever.py）
    for s in osm_qlever.sub_objects('?x osmkey:amenity "place_of_worship" ; osmkey:religion ?rel .', "worship-religion", ("rel",)):
        rel = s["rel"].strip().lower()
        by_rel[s["sub"]][rel] += 1
        if s["mother"]:
            by_rel[s["mother"]][rel] -= 1
            if by_rel[s["mother"]][rel] < 0:
                raise RuntimeError(f"{s['mother']} 的 {rel} 減掉子屬地後變成負的")
    pop = {c: s[YEAR] for c, s in wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"].items() if YEAR in s}
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()

    density, hints, hints_en, no_value, no_value_en = {}, {}, {}, {}, {}
    main, share, main_hints, main_hints_en, main_nv, main_nv_en = {}, {}, {}, {}, {}, {}
    for c in sorted(set(total) | covered):
        if c not in pop:
            continue
        n = total.get(c, 0)
        tagged = sum(by_rel[c].values())
        hints[c] = f"OpenStreetMap 上有 {n:,} 座，{tagged / n:.0%} 標了宗教" if n else "OpenStreetMap 上沒有"
        hints_en[c] = f"{n:,} on OpenStreetMap, {tagged / n:.0%} with a religion tag" if n else "None on OpenStreetMap"
        if c not in covered:
            no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
        elif pop[c] < MIN_POPULATION:
            no_value[c] = "人口不到 10 萬，幾座就差很多，不畫"
            no_value_en[c] = "Population under 100,000, too small for a stable rate, so not shown"
        else:
            density[c] = [round(n / pop[c] * 100, 1)]  # 人口是千人
        groups = Counter()
        for rel, k in by_rel[c].items():
            groups[GROUPS.get(rel, OTHER)] += k
        if tagged >= MIN_TAGGED and tagged >= MIN_TAGGED_SHARE * n:
            g, k = groups.most_common(1)[0]
            main[c] = [g]
            share[c] = [round(k / tagged * 100, 1)]
            top = "、".join(f"{NAMES[gg][0]} {kk / tagged:.0%}" for gg, kk in groups.most_common(3))
            top_en = ", ".join(f"{NAMES[gg][1]} {kk / tagged:.0%}" for gg, kk in groups.most_common(3))
            main_hints[c] = f"有標宗教的 {tagged:,} 座：{top}"
            main_hints_en[c] = f"{tagged:,} tagged: {top_en}"
        elif n:
            main_nv[c] = f"OpenStreetMap 上 {n:,} 座裡只有 {tagged:,} 座標了宗教，不畫"
            main_nv_en[c] = f"Only {tagged:,} of {n:,} places on OpenStreetMap have a religion tag, so not shown"
    write_json(OUT / "worship-density.json", indicator_file(
        "worship-density", "座／十萬人", [YEAR], density, hints=hints, hintsEn=hints_en, noValue=no_value, noValueEn=no_value_en,
        license="ODbL 1.0"))
    write_json(OUT / "worship-main.json", indicator_file(
        "worship-main", "category", [YEAR], main, hints=main_hints, hintsEn=main_hints_en, noValue=main_nv, noValueEn=main_nv_en,
        license="ODbL 1.0"))
    write_json(OUT / "worship-main-share.json", indicator_file("worship-main-share", "%", [YEAR], share, license="ODbL 1.0"))

    world = sum(total.values())
    world_rel = Counter()
    for c in by_rel.values():
        for rel, k in c.items():
            world_rel[rel] += k
    print(f"  全世界 {world:,} 座；有標宗教 {sum(world_rel.values()):,}：{world_rel.most_common(10)}")
    print("  個數：" + "、".join(f"{c} {n:,}" for c, n in Counter(total).most_common(13)))
    top = sorted(((v[0], c) for c, v in density.items()), reverse=True)
    print(f"  每十萬人（{len(density)} 國）：{top[:12]} … {top[-6:]}")
    print(f"  主要宗教（{len(main)} 國）：{dict(sorted(Counter(v[0] for v in main.values()).items()))}")
    for c in ("TWN", "JPN", "USA", "KOR", "DEU", "GBR", "FRA", "ITA", "ISR", "IND", "IDN", "THA", "HKG", "SGP"):
        print(f"  {c}：{total.get(c)}、每十萬人 {density.get(c)}、{main_hints.get(c) or main_nv.get(c)}；{hints.get(c)}；{no_value.get(c, '')[:30]}")
    print(f"  台灣的宗教標籤：{by_rel['TWN'].most_common(12)}")
