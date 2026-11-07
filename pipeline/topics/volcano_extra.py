"""火山的類型與岩性、噴發史、更新世的火山（2026-11-07，製作手冊第二十七批 538，候選 1216、1217、1221；擴充「地震與火山」）。

資料是 Smithsonian 全球火山計畫（GVP）GeoServer WFS 的三個圖層（sources/gvp.py；volcano.si.edu 本站 403，只能走
webservices.volcano.si.edu）。授權同現有的全新世火山（美國政府職務作品；Smithsonian 條款限非商業、要註明出處）。

- 火山最多的類型（volcano-type.json，類別）：這一國全新世火山的主要類型（Primary_Volcano_Type）歸成 9 類，取座數最多的，
  一樣多時取 TYPE_GROUPS 裡排前面的。
- 火山最多的岩性（volcano-rock.json，類別）：Major_Rock_Type 歸成 7 類，沒有資料的火山不算。
- 確認的噴發次數（eruptions.json）：Activity_Type 是 Confirmed Eruption、開始年份在 1500 年以後的，依年份累計到時間軸那一年；
  噴發用 Volcano_Number 接回全新世火山才有國家（跟火山同一國）。1500 年以前的紀錄偏向有文獻的地區，所以從 1500 年起。
- 2000 年以後的確認噴發（eruptions-2000.json）。
- 最大的噴發（max-vei.json，順序類別）：這一國全新世確認噴發的最大火山爆發指數（VEI 0–7），沒有估 VEI 的不算。
- 更新世的火山（pleistocene-volcanoes.json，點）：全新世以前噴發、現在不算活火山。國家歸屬跟全新世的火山同一套
  （earthquakes.volcano_countries）。
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date

from common import indicator_file, points_file, write_json
from sources import gvp
from topics.earthquakes import OUT, OffshoreIndex, volcano_countries

FIRST_YEAR = 1500
RECENT_YEAR = 2000

# 主要火山類型 → 類別（前端 earthquakes-volcanoes.ts 的 TYPE_CATEGORIES 用同樣的代碼）
TYPE_GROUPS: list[tuple[int, set[str]]] = [
    (1, {"Stratovolcano"}),
    (2, {"Shield", "Pyroclastic shield"}),
    (3, {"Caldera"}),
    (4, {"Volcanic field"}),
    (5, {"Complex", "Compound"}),
    (6, {"Fissure vent", "Crater rows"}),
    (7, {"Pyroclastic cone", "Lava cone", "Cone", "Tuff cone", "Tuff ring", "Maar", "Explosion crater"}),
    (8, {"Lava dome"}),
]
OTHER_TYPE = 9
# 岩性代碼（gvp.ROCK_CODES）→ 類別：粗面岩與粗面安山岩併一類，三種鹼性岩（似長岩、響岩、響岩質碧玄岩）併一類
ROCK_GROUPS = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 6, 8: 7, 9: 7, 10: 7}


def type_group(t: str) -> int:
    for code, names in TYPE_GROUPS:
        if t in names:
            return code
    return OTHER_TYPE


def main_category(values: list[int]) -> int | None:
    """座數最多的類別，一樣多時取代碼小的（類別依全世界的座數排序）"""
    if not values:
        return None
    counts = Counter(values)
    return min(counts, key=lambda c: (-counts[c], c))


def build() -> None:
    this_year = date.today().year
    index = OffshoreIndex()

    holocene = gvp.holocene_volcanoes()
    iso3 = dict(zip((v.number for v in holocene), volcano_countries(holocene, index)))
    types: dict[str, list[int]] = defaultdict(list)
    rocks: dict[str, list[int]] = defaultdict(list)
    for v in holocene:
        c = iso3[v.number]
        if not c:
            continue
        types[c].append(type_group(v.type))
        if v.rock:
            if v.rock not in gvp.ROCK_CODES:
                raise ValueError(f"GVP 的岩性認不得：{v.rock}")
            rocks[c].append(ROCK_GROUPS[gvp.ROCK_CODES[v.rock]])
    world_types = Counter(type_group(v.type) for v in holocene)
    world_rocks = Counter(gvp.ROCK_CODES[v.rock] for v in holocene if v.rock)
    print(f"  全新世火山 {len(holocene)} 座；類型 {dict(sorted(world_types.items()))}；岩性 {dict(sorted(world_rocks.items()))}，"
          f"沒有岩性 {sum(1 for v in holocene if not v.rock)} 座")
    main_type = {c: main_category(vals) for c, vals in types.items()}
    main_rock = {c: main_category(vals) for c, vals in rocks.items() if vals}
    write_json(OUT / "volcano-type.json", indicator_file(
        "volcano-type", "category", [this_year], {c: [v] for c, v in sorted(main_type.items())}))
    write_json(OUT / "volcano-rock.json", indicator_file(
        "volcano-rock", "category", [this_year], {c: [v] for c, v in sorted(main_rock.items())}))
    print(f"  主要類型：{Counter(main_type.values())}；主要岩性：{Counter(main_rock.values())}")
    for c in ("TWN", "JPN", "IDN", "USA", "ISL", "ITA"):
        print(f"    {c}：類型 {main_type.get(c)}（{Counter(types.get(c, []))}）岩性 {main_rock.get(c)}（{Counter(rocks.get(c, []))}）")

    # ── 噴發 ──
    eruptions = gvp.holocene_eruptions()
    confirmed = [e for e in eruptions if e.confirmed]
    unmatched = sum(1 for e in eruptions if e.volcano not in iso3)
    print(f"  噴發 {len(eruptions)} 筆（確認 {len(confirmed)}），{FIRST_YEAR} 年起 {sum(1 for e in eruptions if (e.year or -99999) >= FIRST_YEAR)} 筆，"
          f"接不到火山 {unmatched} 筆；VEI {dict(sorted(Counter(e.vei for e in eruptions if e.vei is not None).items()))}")
    years = list(range(FIRST_YEAR, this_year + 1))
    per_year: dict[str, Counter] = defaultdict(Counter)
    recent: Counter = Counter()
    max_vei: dict[str, int] = {}
    for e in confirmed:
        c = iso3.get(e.volcano)
        if not c:
            continue
        if e.vei is not None:
            max_vei[c] = max(max_vei.get(c, -1), e.vei)
        if e.year is None or e.year < FIRST_YEAR:
            continue
        per_year[c][e.year] += 1
        if e.year >= RECENT_YEAR:
            recent[c] += 1
    cumulative: dict[str, list[int]] = {}
    for c, counts in per_year.items():
        run, row = 0, []
        for y in years:
            run += counts.get(y, 0)
            row.append(run)
        cumulative[c] = row
    world = [sum(cumulative[c][i] for c in cumulative) for i in range(len(years))]
    write_json(OUT / "eruptions.json", indicator_file(
        "eruptions", "eruptions", years, dict(sorted(cumulative.items())), aggregates={"WLD": world}))
    write_json(OUT / "eruptions-2000.json", indicator_file(
        "eruptions-2000", "eruptions", [this_year], {c: [n] for c, n in sorted(recent.items())},
        aggregates={"WLD": [sum(recent.values())]}))
    write_json(OUT / "max-vei.json", indicator_file(
        "max-vei", "VEI", [this_year], {c: [v] for c, v in sorted(max_vei.items())}))
    top = sorted(((row[-1], c) for c, row in cumulative.items()), reverse=True)
    print(f"  {FIRST_YEAR} 年起確認噴發 {world[-1]} 次（{len(cumulative)} 國）：{top[:14]}；台灣 {cumulative.get('TWN', [0])[-1]}")
    print(f"  {RECENT_YEAR} 年起 {sum(recent.values())} 次（{len(recent)} 國）：{recent.most_common(8)}；台灣 {recent.get('TWN', 0)}")
    print(f"  最大 VEI：{Counter(max_vei.values())}；台灣 {max_vei.get('TWN')}")
    vei7 = [(e.year, e.volcano) for e in confirmed if e.vei == 7]
    print(f"  VEI 7：{sorted(vei7)}")

    # ── 更新世的火山 ──
    pleisto = gvp.pleistocene_volcanoes()
    p_iso3 = volcano_countries(pleisto, index)
    rows = [{
        "lon": v.lon, "lat": v.lat, "vn": v.number, "name": v.name, "type": v.type or None,
        "elev": v.elevation, "iso3": c,
    } for v, c in zip(pleisto, p_iso3)]
    write_json(OUT / "pleistocene-volcanoes.json", points_file(
        rows, ["lon", "lat", "vn", "name", "type", "elev", "iso3"], {"lon": 0.001, "lat": 0.001, "vn": 1, "elev": 1}, delta=("vn",)))
    pc = Counter(c for c in p_iso3 if c)
    print(f"  更新世火山 {len(pleisto)} 座，不屬於任何國家 {sum(1 for c in p_iso3 if not c)} 座；{pc.most_common(12)}")
    print(f"  台灣：{[(v.name, v.type) for v, c in zip(pleisto, p_iso3) if c == 'TWN']}")
