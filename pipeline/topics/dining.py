"""外食與喝一杯：餐廳、速食、咖啡館、酒吧與冰淇淋店的密度（2026-11-04，製作手冊第二十一批 342）。

- 資料：OpenStreetMap 經 QLever（sources/osm_qlever.py；ODbL，© OpenStreetMap contributors），每個國家有幾個
  amenity = restaurant、fast_food、cafe、bar、pub、ice_cream（node、way、relation 都算），2026 年 11 月的快照。
  只算固定店面的標籤，夜市與攤販（amenity=marketplace）不算。
- 每十萬人用聯合國 WPP 2024 的 2026 年推估人口（台灣也在 WPP 裡）。
- **只畫 OSM 覆蓋良好的國家**（sources/osm_coverage.py 的名單，用 OSM 餐飲店 ÷ 住宿及餐飲業就業人數判斷）；
  其他國家寫原因不畫。OSM 的店家密度同時在量「OSM 畫得多完整」，覆蓋良好的國家之間也還有差別，只能看大概。
- 餐廳與速食的界線各國的繪圖者判斷不一，所以另外有兩者合計（預設）；bar 與 pub 是文化性的標籤（日本的居酒屋
  常標成 pub），合在一起算「酒吧與酒館」。
- 各國的店數寫在 tooltip；資料檔是 OSM 的衍生資料，依 ODbL 1.0 分享。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, write_json
from sources import osm_coverage, osm_qlever, wpp

OUT = OUT_DIR / "topics" / "dining"
YEAR = 2026
MIN_POPULATION = 100  # 千人；人口不到 10 萬的地方一兩家店就差很多，不畫（店數照樣寫）
# 指標 id → (要加總的 amenity 值, 中文名, 英文名)
INDICATORS = {
    "eat-out": (("restaurant", "fast_food"), "餐廳與速食店", "restaurants and fast-food outlets"),
    "restaurants": (("restaurant",), "餐廳", "restaurants"),
    "fast-food": (("fast_food",), "速食店", "fast-food outlets"),
    "cafes": (("cafe",), "咖啡館", "cafés"),
    "bars": (("bar", "pub"), "酒吧與酒館", "bars and pubs"),
    "ice-cream": (("ice_cream",), "冰淇淋店", "ice-cream shops"),
    "nightclubs": (("nightclub",), "夜店", "nightclubs"),
}
# 各國的「喝一杯」場所類型（第二十一批 367）：bar、pub、biergarten 每十萬人合計不到 LOW_DRINK 算低密度；
# 啤酒花園占三者 BEER_GARDEN_SHARE 以上算啤酒花園；其他看 pub 與 bar 哪個多
DRINK_TYPES = {"bar": 1, "pub": 2, "biergarten": 3, "low": 4}
LOW_DRINK = 10
BEER_GARDEN_SHARE = 0.15


def build() -> None:
    counts = {tag: osm_qlever.counts("amenity", tag) for tags, *_ in INDICATORS.values() for tag in tags}
    pop = {c: s[YEAR] for c, s in wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"].items()
           if c != "WLD" and YEAR in s}
    cov = osm_coverage.coverage()
    covered = osm_coverage.well_covered()
    for ind, (tags, zh, en) in INDICATORS.items():
        n = {c: sum(counts[t].get(c, 0) for t in tags) for c in set().union(*(counts[t] for t in tags)) | covered}
        values, hints, hints_en, no_value, no_value_en = {}, {}, {}, {}, {}
        for c in sorted(set(n) | set(cov)):
            if c not in pop:
                continue
            count = n.get(c, 0)
            hints[c] = f"OpenStreetMap 上有 {count:,} 家{zh}"
            hints_en[c] = f"{count:,} {en} on OpenStreetMap"
            if c not in covered:
                no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
            elif pop[c] < MIN_POPULATION:
                no_value[c] = "人口不到 10 萬，一兩家店就差很多，不畫"
                no_value_en[c] = "Population under 100,000, too small for a stable rate, so not shown"
            else:
                values[c] = [round(count / pop[c] * 100, 1)]  # 人口是千人：每十萬人 = 店數 ÷ 千人 × 100
        write_json(OUT / f"{ind}.json", indicator_file(
            ind, "家／十萬人", [YEAR], values, hints=hints, hintsEn=hints_en, noValue=no_value, noValueEn=no_value_en,
            license="ODbL 1.0"))
        top = sorted(((v[0], c) for c, v in values.items()), reverse=True)
        print(f"  {ind}：{len(values)} 國；最多 {top[:6]}；台灣 {values.get('TWN')}（{n.get('TWN')} 家）；"
              f"美國 {values.get('USA')}、日本 {values.get('JPN')}、南韓 {values.get('KOR')}")
    _drink_types(counts, pop, cov, covered)
    write_json(OUT / "manifest.json", {"topic": "dining", "generatedAt": now_iso(),
                                       "source": "© OpenStreetMap contributors (ODbL 1.0), via QLever"})


def _drink_types(counts: dict, pop: dict, cov: dict, covered: set) -> None:
    """367：各國最典型的喝一杯場所（類別）"""
    biergarten = osm_qlever.counts("amenity", "biergarten")
    values, hints, hints_en, no_value, no_value_en = {}, {}, {}, {}, {}
    for c in sorted(set(counts["bar"]) | set(counts["pub"]) | covered):
        if c not in pop:
            continue
        if c not in covered:
            no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
            continue
        if pop[c] < MIN_POPULATION:
            continue
        d = {k: src.get(c, 0) / pop[c] * 100 for k, src in (("bar", counts["bar"]), ("pub", counts["pub"]), ("biergarten", biergarten))}
        total = sum(d.values())
        if total < LOW_DRINK:
            kind = DRINK_TYPES["low"]
        elif d["biergarten"] >= total * BEER_GARDEN_SHARE:
            kind = DRINK_TYPES["biergarten"]
        else:
            kind = DRINK_TYPES["pub"] if d["pub"] > d["bar"] else DRINK_TYPES["bar"]
        values[c] = [kind]
        hints[c] = f"每十萬人：酒吧 {d['bar']:.1f}、酒館 {d['pub']:.1f}、啤酒花園 {d['biergarten']:.2f} 家"
        hints_en[c] = f"Per 100,000: bars {d['bar']:.1f}, pubs {d['pub']:.1f}, beer gardens {d['biergarten']:.2f}"
    write_json(OUT / "drink-type.json", indicator_file(
        "drink-type", "類別", [YEAR], values, hints=hints, hintsEn=hints_en, noValue=no_value, noValueEn=no_value_en,
        license="ODbL 1.0"))
    from collections import Counter
    print(f"  喝一杯類型：{len(values)} 國 {Counter(v[0] for v in values.values())}；"
          f"啤酒花園 {sorted(c for c, v in values.items() if v[0] == 3)}；台灣 {values.get('TWN')}、日本 {values.get('JPN')}、美國 {values.get('USA')}")
