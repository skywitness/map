"""交通安全的擴充：圓環與測速照相機（2026-11-07，製作手冊第二十七批 574，候選 1291、1296；步驟 road-features，
輸出 topics/road-safety/）。

資料：OpenStreetMap（ODbL 1.0）經 QLever（sources/osm_qlever.py）。
- 圓環：`junction=roundabout` 的**物件數**。手冊的陷阱：同一個圓環常被切成好幾段 way，所以這是路段數、不是座數，
  說明與 tooltip 都寫「路段」。密度用每千公里道路（CIA World Factbook 2022 年版的 Roadways total，年份各國不同），
  只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py；密度同時在量測繪完整度）。
- 測速照相機：`highway=speed_camera` 的點，每百萬人（UN WPP 2024 的 2026 年），同樣只替覆蓋良好的國家上色；
  OSM 的測速照相機由駕駛社群維護，覆蓋很不平均（日本、美國明顯偏低）。
- 台灣：OSM 有；各縣市警察局的官方資料集要合併幾十個小檔，這次沒有做（說明寫明）。
"""
from __future__ import annotations

import re

from common import OUT_DIR, indicator_file, write_json
from sources import factbook_2022, osm_coverage, osm_qlever, wpp

OUT = OUT_DIR / "topics" / "road-safety"
YEAR = 2026
MIN_POPULATION = 100  # 千人


def _roads_km() -> dict[str, tuple[float, int | None]]:
    """Factbook 2022 年版的 Roadways total：{ISO3: (公里, 年份)}"""
    out = {}
    for iso3, t in factbook_2022.transportation().items():
        total = t.get("Roadways", {}).get("total")
        text = total.get("text") if isinstance(total, dict) else None
        if not text:
            continue
        m = re.match(r"([\d,.]+)\s*(million)?\s*km", text)
        if not m:
            continue
        km = float(m.group(1).replace(",", "")) * (1e6 if m.group(2) else 1)
        y = re.search(r"\((\d{4})\)", text)
        out[iso3] = (km, int(y.group(1)) if y else None)
    return out


def build() -> None:
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    roundabouts = osm_qlever.counts("junction", "roundabout")
    cameras = osm_qlever.counts("highway", "speed_camera")
    roads = _roads_km()
    pop = {c: s[YEAR] for c, s in wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"].items() if YEAR in s}

    v, h, he, nv, nve = {}, {}, {}, {}, {}
    for c in sorted(set(roundabouts) | covered):
        n = roundabouts.get(c, 0)
        km, y = roads.get(c, (None, None))
        h[c] = f"OpenStreetMap 上有 {n:,} 段圓環（同一個圓環常切成好幾段）" + (f"；道路 {km:,.0f} 公里（{y} 年）" if km else "")
        he[c] = f"{n:,} roundabout segments on OpenStreetMap (one roundabout is often several segments)" + (f"; {km:,.0f} km of roads ({y})" if km else "")
        if c not in covered:
            nv[c], nve[c] = osm_coverage.reason(c, cov.get(c))
        elif not km:
            nv[c], nve[c] = "世界概況沒有道路長度，不畫", "No road length in the World Factbook, so not shown"
        else:
            v[c] = [round(n / km * 1000, 1)]
    write_json(OUT / "roundabouts.json", indicator_file(
        "roundabouts", "段／千公里道路", [YEAR], v, hints=h, hintsEn=he, noValue=nv, noValueEn=nve, license="ODbL 1.0"))

    v, h, he, nv, nve = {}, {}, {}, {}, {}
    for c in sorted(set(cameras) | covered):
        if c not in pop:
            continue
        n = cameras.get(c, 0)
        h[c] = f"OpenStreetMap 上有 {n:,} 台測速照相機"
        he[c] = f"{n:,} speed cameras on OpenStreetMap"
        if c not in covered:
            nv[c], nve[c] = osm_coverage.reason(c, cov.get(c))
        elif pop[c] < MIN_POPULATION:
            nv[c], nve[c] = "人口不到 10 萬，不畫", "Population under 100,000, so not shown"
        else:
            v[c] = [round(n / pop[c] * 1000, 1)]
    write_json(OUT / "speed-cameras.json", indicator_file(
        "speed-cameras", "台／百萬人", [YEAR], v, hints=h, hintsEn=he, noValue=nv, noValueEn=nve, license="ODbL 1.0"))

    from collections import Counter
    print(f"  圓環 {sum(roundabouts.values()):,} 段、{len(roundabouts)} 國：{Counter(roundabouts).most_common(12)}")
    for c in ("CHN", "KOR", "TWN", "JPN"):
        print(f"    {c} {roundabouts.get(c)}；道路 {roads.get(c)}")
    print(f"  測速照相 {sum(cameras.values()):,}、{len(cameras)} 國：{Counter(cameras).most_common(14)}")
    for c in ("TWN", "KOR", "CHN", "SGP", "JPN", "USA"):
        print(f"    {c} {cameras.get(c)} 每百萬人 {round(cameras.get(c, 0) / pop[c] * 1000, 1) if c in pop else None}")
