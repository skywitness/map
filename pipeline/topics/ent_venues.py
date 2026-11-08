"""街角的娛樂場所（2026-11-08，製作手冊第二十七批 665、666、667；步驟 ent-venues）。全部是 OpenStreetMap（ODbL 1.0）經 QLever，
一個標籤一支查詢、不併發；密度只替 OSM 覆蓋良好的國家上色（`osm_density.density`）。

- 665（候選 1455）卡拉OK：`amenity=karaoke_box`（包廂式），輸出 topics/dining/（擴充「外食與喝一杯」）。歐美的 karaoke bar
  多半標成 `amenity=bar` 加 `karaoke=yes`、台灣很多 KTV 標成 nightclub，所以歐美與台灣都低估，說明寫明。
- 666（候選 1386、1460）室內娛樂：`leisure=amusement_arcade`（電子遊樂場，各國意思不同）、`leisure=escape_game`（密室逃脫）、
  `leisure=trampoline_park`（彈跳床樂園），輸出 topics/diving/（擴充「休閒運動場地」，日常休閒）。
- 667（候選 1461）表演場館的類型：有 `theatre:genre` 標籤的物件（key 有冒號，用完整 IRI），多值用分號分隔，併成 8 類；
  國家的類別是「場館最多的類型」，只替有類型的場館至少 MIN_GENRE 處的國家上色。輸出 topics/culture/（跟 641 的劇院放一起）。
"""
from __future__ import annotations

from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json, write_points
from sources import osm_qlever
from topics.osm_density import density

YEAR = 2026
DINING = OUT_DIR / "topics" / "dining"
DIVING = OUT_DIR / "topics" / "diving"
CULTURE = OUT_DIR / "topics" / "culture"
MIN_GENRE = 10

# theatre:genre 的值 → 類別（1–8）；沒列到的是 9（其他）
GENRES = {
    1: ("philharmonic", "chamber_music", "concert", "concert_hall", "music", "contemporary_music", "jazz"),
    2: ("opera", "ballet", "dance"),
    3: ("drama", "dram", "boulevard", "political", "children", "café-théâtre", "passion_play", "greek", "poetry"),
    4: ("musical",),
    5: ("comedy", "stand_up_comedy", "standup_comedy", "variety", "cabaret", "burlesque", "vaudeville", "revue", "magic"),
    6: ("circus", "acrobatics"),
    7: ("puppet", "marionette", "figure", "shadow_play"),
    8: ("noh", "kabuki", "bunraku", "rakugo", "cantonese opera", "cai_cha_opera"),
}
GENRE_OF = {v: k for k, vs in GENRES.items() for v in vs}


def _points(key: str, value: str, k: int, extra=("name", "name:zh", "name:en")) -> list[dict]:
    rows, seen = [], set()
    for r in osm_qlever.features(key, value, extra):
        if r["osm"] in seen or not r["iso3"]:
            continue
        c = osm_qlever.centroid(r["wkt"])
        if not c:
            continue
        seen.add(r["osm"])
        rows.append({"lon": round(c[0], 4), "lat": round(c[1], 4), "k": k, "iso3": r["iso3"], "n": r["name"] or None,
                     "nz": r["name:zh"] or None, "ne": r["name:en"] or None})
    return rows


def _write(path, rows: list[dict]) -> None:
    rows.sort(key=lambda p: (p["k"], p["iso3"], p["lon"]))
    write_points(path, points_file(rows, ["lon", "lat", "k", "iso3", "n", "nz", "ne"], {"lon": 0.0001, "lat": 0.0001, "k": 1},
                                   strings=("iso3",)), ("n", "nz", "ne"))
    print(f"    點 {len(rows):,}（有名稱 {sum(1 for r in rows if r['n']):,}）")


def karaoke() -> None:
    density(DINING, "amenity", "karaoke_box", "karaoke", "家/百萬人", 1e6, "卡拉OK包廂")
    _write(DINING / "karaoke-points.json", _points("amenity", "karaoke_box", 1))


def indoor() -> None:
    rows = []
    for k, (value, name, label) in enumerate((("amusement_arcade", "arcades", "電子遊樂場"), ("escape_game", "escape-games", "密室逃脫"),
                                              ("trampoline_park", "trampoline-parks", "彈跳床樂園")), 1):
        density(DIVING, "leisure", value, name, "家/百萬人", 1e6, label)
        rows += _points("leisure", value, k)
    _write(DIVING / "indoor-points.json", rows)


def theatre_genres() -> None:
    rows = osm_qlever.query(f"""SELECT ?x ?iso ?g ?wkt ?name ?name_zh ?name_en WHERE {{
  {osm_qlever.COUNTRIES}
  ?x <https://www.openstreetmap.org/wiki/Key:theatre:genre> ?g ; geo:hasGeometry/geo:asWKT ?wkt .
  OPTIONAL {{ ?x osmkey:name ?name }}
  OPTIONAL {{ ?x <https://www.openstreetmap.org/wiki/Key:name:zh> ?name_zh }}
  OPTIONAL {{ ?x <https://www.openstreetmap.org/wiki/Key:name:en> ?name_en }}
}}""", "theatre-genre-points")
    from sources.countries import from_alpha2

    venues: dict[str, dict] = {}
    raw = Counter()
    for r in rows:
        iso3 = from_alpha2(r["iso"]["value"])
        if not iso3:
            continue
        x = r["x"]["value"]
        d = venues.setdefault(x, {"iso3": iso3, "wkt": r["wkt"]["value"], "classes": [], "g": r["g"]["value"],
                                  "n": r.get("name", {}).get("value"), "nz": r.get("name_zh", {}).get("value"),
                                  "ne": r.get("name_en", {}).get("value")})
        for g in r["g"]["value"].split(";"):
            g = g.strip().lower()
            if not g:
                continue
            raw[g] += 1
            c = GENRE_OF.get(g, 9)
            if c not in d["classes"]:
                d["classes"].append(c)
    # 子屬地分開（製作手冊 1-f，sources/osm_qlever.py）
    for sub in osm_qlever.sub_objects("?x <https://www.openstreetmap.org/wiki/Key:theatre:genre> ?g .", "theatre-genre"):
        if sub["osm"] in venues:
            venues[sub["osm"]]["iso3"] = sub["sub"]
    by_country: dict[str, Counter] = {}
    points = []
    for d in venues.values():
        cnt = by_country.setdefault(d["iso3"], Counter())
        for c in d["classes"]:
            cnt[c] += 1
        c = osm_qlever.centroid(d["wkt"])
        if not c or not d["classes"]:
            continue
        points.append({"lon": round(c[0], 4), "lat": round(c[1], 4), "k": d["classes"][0], "iso3": d["iso3"], "n": d["n"], "nz": d["nz"],
                       "ne": d["ne"], "g": d["g"].replace(";", "; ")[:60]})
    values, hints, hints_en, nv, nv_en = {}, {}, {}, {}, {}
    total = Counter({c: sum(1 for d in venues.values() if d["iso3"] == c) for c in by_country})
    for iso, cnt in sorted(by_country.items()):
        if total[iso] < MIN_GENRE:
            nv[iso] = f"OSM 上標了類型的場館只有 {total[iso]} 處，不畫"
            nv_en[iso] = f"Only {total[iso]} venues with a genre in OSM, not shown"
            continue
        top, n = max(cnt.items(), key=lambda kv: (kv[1], -kv[0]))
        values[iso] = [top]
        hints[iso] = f"標了類型的 {total[iso]} 處裡 {n} 處"
        hints_en[iso] = f"{n} of {total[iso]} venues with a genre"
    write_json(CULTURE / "theatre-genre.json", indicator_file("theatre-genre", "類別", [YEAR], values, hints=hints, hintsEn=hints_en,
                                                              noValue=nv, noValueEn=nv_en, license="ODbL 1.0"))
    points.sort(key=lambda p: (p["k"], p["iso3"], p["lon"]))
    write_points(CULTURE / "theatre-genre-points.json", points_file(points, ["lon", "lat", "k", "iso3", "n", "nz", "ne", "g"],
                                                                    {"lon": 0.0001, "lat": 0.0001, "k": 1}, strings=("iso3",)),
                 ("n", "nz", "ne", "g"))
    classes = Counter(c for d in venues.values() for c in d["classes"])
    print(f"  theatre:genre：{len(venues):,} 處、{len(by_country)} 國；類別 {sorted(classes.items())}；其他的值 "
          f"{[(g, n) for g, n in raw.most_common() if g not in GENRE_OF][:15]}")
    print(f"    上色 {len(values)} 國：" + "、".join(f"{c} {v[0]}（{hints[c]}）" for c, v in sorted(values.items(), key=lambda kv: -total[kv[0]])))
    print(f"    台灣 {total.get('TWN')} 處；點 {len(points):,}")


def build() -> None:
    karaoke()
    indoor()
    theatre_genres()
