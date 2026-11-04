"""博弈：賭場、彩券行與投注站（2026-11-04，製作手冊第二十一批 369，含合併進來的 916）。

- OpenStreetMap 經 QLever（sources/osm_qlever.py；ODbL）：amenity=casino 的每個物件（點，面取中心）、
  shop=lottery 與 amenity=gambling（投注站、吃角子老虎店等）的各國個數。
- 賭場依點的位置分國（geoindex.countries_at，跟地圖的國界一致）：澳門的賭場在 OSM 落在中國的國界裡，這樣才會算到澳門。
  賭場的家數不套覆蓋度名單（賭場是大型地標，各國都畫），但標籤用法不一（德國把吃角子老虎店 Spielhalle 也標成 casino），
  說明寫明。台灣沒有合法賭場，OSM 上 5 處標成 casino 的是電子遊戲場與餐廳；伊拉克的 303 處名稱多是咖啡館、茶館。
  這兩國不畫點、不算家數，寫原因（NOT_CASINOS）。
- 彩券行、投注站的每十萬人只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py）；英國把彩券當便利商店的附屬服務標
  （lottery=yes），不是獨立的店，所以很低，說明寫明。
- 合法性已經在「法律與制度」主題（sources/gambling.py，英文維基 Gambling age），這裡不重做。
"""
from __future__ import annotations

from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json
from geoindex import countries_at
from sources import osm_coverage, osm_qlever, wpp

OUT = OUT_DIR / "topics" / "gambling"
YEAR = 2026
MIN_POPULATION = 100  # 千人
TAIWAN_CASINO = ("台灣沒有合法的賭場（刑法第 266 條）；OpenStreetMap 上 5 處標成賭場的是電子遊戲場與餐廳，不算",
                 "Taiwan has no legal casinos (Article 266 of the Criminal Code); the 5 places tagged as casinos on "
                 "OpenStreetMap are amusement arcades and a restaurant, so they are not counted")
# 標成 casino 但名稱看得出來不是賭場的國家（2026-11-04 看過名稱）：不畫點、不算家數，寫原因
NOT_CASINOS = {
    "TWN": TAIWAN_CASINO,
    "IRQ": ("OpenStreetMap 上伊拉克有 303 處標成賭場，名稱多是咖啡館、茶館（كوفي、مقهى、جاي خانة），不是賭場，不算",
            "Iraq has 303 places tagged as casinos on OpenStreetMap, but their names show they are mostly cafés and tea "
            "houses, not casinos, so they are not counted"),
}


def build() -> None:
    feats = osm_qlever.features("amenity", "casino", extra=("name", "name:zh", "name:en"))
    rows, seen = [], set()
    for r in feats:
        if r["osm"] in seen:
            continue
        seen.add(r["osm"])
        c = osm_qlever.centroid(r["wkt"])
        if c:
            rows.append({"lon": c[0], "lat": c[1], "n": r["name"], "nz": r["name:zh"], "ne": r["name:en"]})
    for r, iso3 in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
        r["iso3"] = iso3 or ""
    rows = [r for r in rows if r["iso3"] not in NOT_CASINOS]
    rows.sort(key=lambda r: (r["iso3"], r["n"] or "~"))
    write_json(OUT / "casinos.json", points_file(rows, ["lon", "lat", "iso3", "n", "nz", "ne"], {"lon": 0.0001, "lat": 0.0001},
                                                 strings=("iso3",)))
    n = Counter(r["iso3"] for r in rows if r["iso3"])
    write_json(OUT / "casinos-count.json", indicator_file(
        "casinos-count", "處", [YEAR], {c: [v] for c, v in sorted(n.items())},
        noValue={c: v[0] for c, v in NOT_CASINOS.items()}, noValueEn={c: v[1] for c, v in NOT_CASINOS.items()}, license="ODbL 1.0"))
    pop = {c: s[YEAR] for c, s in wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"].items() if YEAR in s}
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    for ind, key, value, zh, en in (("lottery", "shop", "lottery", "彩券行", "lottery shops"),
                                    ("betting", "amenity", "gambling", "投注站與吃角子老虎店", "betting shops and gaming halls")):
        counts = osm_qlever.counts(key, value)
        values, hints, hints_en, no_value, no_value_en = {}, {}, {}, {}, {}
        for c in sorted(set(counts) | covered):
            if c not in pop:
                continue
            hints[c] = f"OpenStreetMap 上有 {counts.get(c, 0):,} 家{zh}"
            hints_en[c] = f"{counts.get(c, 0):,} {en} on OpenStreetMap"
            if c not in covered:
                no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
            elif pop[c] < MIN_POPULATION:
                no_value[c] = "人口不到 10 萬，一兩家就差很多，不畫"
                no_value_en[c] = "Population under 100,000, too small for a stable rate, so not shown"
            else:
                values[c] = [round(counts.get(c, 0) / pop[c] * 100, 2)]  # 人口是千人：每十萬人 = 家數 ÷ 千人 × 100
        write_json(OUT / f"{ind}.json", indicator_file(ind, "家／十萬人", [YEAR], values, hints=hints, hintsEn=hints_en,
                                                       noValue=no_value, noValueEn=no_value_en, license="ODbL 1.0"))
        top = sorted(((v[0], c) for c, v in values.items()), reverse=True)
        print(f"  {ind}：{sum(counts.values()):,} 家；每十萬人 {top[:10]}；台灣 {values.get('TWN')}（{counts.get('TWN')}）；"
              f"英國 {values.get('GBR')}、日本 {values.get('JPN')}、美國 {values.get('USA')}")
    write_json(OUT / "manifest.json", {"topic": "gambling", "source": "© OpenStreetMap contributors (ODbL 1.0), via QLever",
                                       "license": "ODbL 1.0"})
    print(f"  賭場 {len(rows):,} 處（不含台灣、伊拉克）；{n.most_common(15)}；澳門 {n.get('MAC')}、新加坡 {n.get('SGP')}、南韓 {n.get('KOR')}")
