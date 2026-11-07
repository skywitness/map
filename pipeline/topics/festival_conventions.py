"""節慶：動漫展、同人誌販售會、漫畫展與電玩展（2026-11-07，製作手冊第二十四批 436 的候選 1032；步驟 festival-conventions，
輸出 topics/festivals/）。

- 資料：Wikidata（CC0，經 QLever：sources/qlever_wikidata.py）P31（含子類別）是動漫展（anime convention Q548126）、
  同人誌販售會（dōjinshi fair Q4390543）、漫畫展（comic book convention Q3070220）、電玩展（gaming convention Q3070242）、
  同好大會（fan convention Q1129398，含 furry、恐怖片、科幻這類）的。東京電玩展、台北國際電玩展、Gamescom 這些大型電玩展
  在 Wikidata 只標成「年度活動」「商展」，用條目編號補進來（EXTRA，種類照它的性質）。
- 位置：條目自己的座標（P625），沒有的用舉辦地點（P276）的座標，再沒有用所在行政區（P131）的座標；台灣的開拓動漫祭、
  Comic World Taiwan、台北國際電玩展、台北國際動漫節在 Wikidata 都沒有地點，放在台北市（Q1867 的座標，點上標「位置是城市」）。
- 創辦年（P571）做時間軸（依創辦年累計）；參觀人次（P1132）幾乎都沒有，有的寫在 tooltip。國家用 P17，沒有的依座標判斷。
- Wikidata 的這幾類嚴重偏美國與歐洲，只畫點；國家的值是「到那一年創辦了幾個」，給 tooltip 與排名表，不上色。
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, points_file, write_json
from geoindex import countries_at
from sources import qlever_wikidata
from sources.countries import to_iso3
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "festivals"
FIRST, LAST = 1960, 2026
# 種類（src/topics/festivals.ts 的 CON_KINDS）：同時屬於好幾類的，依這個順序取第一個
ANIME, DOUJIN, COMIC, GAME, FAN = 1, 2, 3, 4, 5
CLASSES = {"Q4390543": DOUJIN, "Q548126": ANIME, "Q3070220": COMIC, "Q3070242": GAME, "Q1129398": FAN}
PRIORITY = [DOUJIN, ANIME, COMIC, GAME, FAN]
# Wikidata 沒有歸在上面幾類的大型活動（條目編號 → 種類）
EXTRA = {
    "Q683877": GAME,     # 東京電玩展
    "Q10914112": GAME,   # 台北國際電玩展
    "Q265567": GAME,     # Gamescom
    "Q5099651": GAME,    # ChinaJoy
    "Q25943": GAME,      # G-Star
    "Q3365263": GAME,    # Paris Games Week
    "Q4957794": GAME,    # Brasil Game Show
    "Q21006833": GAME,   # EGX
    "Q2523961": ANIME,   # Jump Festa
    "Q2584209": ANIME,   # Anime Expo
    "Q4765143": ANIME,   # Anime Festival Asia
    "Q5174671": ANIME,   # Cosplay Mania
    "Q16926536": ANIME,  # 台北國際動漫節
    "Q7723696": COMIC,   # New York Comic Con
    "Q279385": COMIC,    # San Diego Comic-Con（Wikidata 標成同好大會）
    "Q1070962": COMIC,   # Lucca Comics & Games
    "Q588487": GAME,     # PAX
}
# 單一屆的條目（「Eurofurence 13」「Furry Weekend Atlanta 2004」）：名稱最後是屆數或年份的不畫，只留整個活動
EDITION = re.compile(r"(\s(19|20)\d{2}|\s\d{1,3}|\((19|20)\d{2}\))$")
# 沒有地點的台灣活動：放在台北市
TAIPEI = "Q1867"
HAND_PLACE = {"Q15901741": TAIPEI, "Q105446484": TAIPEI, "Q10914112": TAIPEI, "Q16926536": TAIPEI}
QUERY = """SELECT ?item ?top ?coord ?lcoord ?acoord ?iso ?inc ?att ?attDate ?sl ?en ?mul ?zhtw ?zhhant ?zh WHERE {
  { VALUES ?top { %s } ?item wdt:P31/wdt:P279* ?top . }
  UNION
  { VALUES ?item { %s } BIND(wd:Q0 AS ?top) }
  ?item wikibase:sitelinks ?sl .
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item wdt:P276 ?loc . ?loc wdt:P625 ?lcoord }
  OPTIONAL { ?item wdt:P131 ?adm . ?adm wdt:P625 ?acoord }
  OPTIONAL { ?item wdt:P17 ?c . ?c wdt:P298 ?iso }
  OPTIONAL { ?item wdt:P571 ?inc }
  OPTIONAL { ?item p:P1132 ?st . ?st ps:P1132 ?att . OPTIONAL { ?st pq:P585 ?attDate } }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
  OPTIONAL { ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }
  OPTIONAL { ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }
  OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
}""" % (" ".join(f"wd:{q}" for q in CLASSES), " ".join(f"wd:{q}" for q in EXTRA))
PLACE_QUERY = "SELECT ?item ?coord WHERE { VALUES ?item { wd:%s } ?item wdt:P625 ?coord }"


def _point(v: str | None) -> tuple[float, float] | None:
    if not v or not v.startswith("Point(") and not v.startswith("POINT("):
        return None
    lon, lat = v[6:-1].split()
    return float(lon), float(lat)


def build() -> None:
    rows = qlever_wikidata.cached("festival-conventions", QUERY)
    items: dict[str, dict] = {}
    for r in rows:
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        q = v("item").rsplit("/", 1)[1]
        d = items.setdefault(q, {"q": q, "kinds": set(), "sl": int(v("sl")), "att": {}})
        top = v("top").rsplit("/", 1)[1]
        d["kinds"].add(EXTRA.get(q) if top == "Q0" else CLASSES[top])
        for key, field in (("coord", "coord"), ("lcoord", "lcoord"), ("acoord", "acoord")):
            if field not in d and (p := _point(v(key))):
                d[field] = p
        if v("iso") and "iso" not in d:
            d["iso"] = v("iso")
        if v("inc"):
            y = int(v("inc")[:4].lstrip("+") or 0) if v("inc")[:4].lstrip("+-").isdigit() else None
            if y and (not d.get("y") or y < d["y"]):
                d["y"] = y
        if v("att"):
            year = int(v("attDate")[:4]) if v("attDate") and v("attDate")[:4].isdigit() else 0
            d["att"][year] = max(d["att"].get(year, 0), round(float(v("att"))))
        for k in ("en", "mul", "zhtw", "zhhant", "zh"):
            if v(k) and not d.get(k):
                d[k] = v(k)
    for q, kind in EXTRA.items():  # 也在上面幾類裡的（San Diego Comic-Con 是「同好大會」），種類照這裡
        if q in items:
            items[q]["kinds"].add(kind)
    place = {}
    for q in set(HAND_PLACE.values()):
        for r in qlever_wikidata.cached(f"place-{q}", PLACE_QUERY % q):
            place[q] = _point(r["coord"]["value"])
    names = qlever_wikidata.fallback_names(sorted(q for q, d in items.items() if not (d.get("en") or d.get("mul"))), "conventions")

    out, no_place, editions = [], [], 0
    for q, d in items.items():
        pt = d.get("coord") or d.get("lcoord") or d.get("acoord")
        hand = 0
        if not pt and q in HAND_PLACE:
            pt, hand = place[HAND_PLACE[q]], 1
        en = d.get("en") or d.get("mul") or names.get(q)
        zh = wikidata_zh(d.get("zhtw") or d.get("zhhant"), d.get("zh"), place=True)
        if en and EDITION.search(en.strip()):
            editions += 1
            continue
        if not pt:
            no_place.append((en or zh, d.get("iso")))
            continue
        kind = next(k for k in PRIORITY if k in d["kinds"])
        att_year = max(d["att"]) if d["att"] else None
        out.append({"lon": round(pt[0], 3), "lat": round(pt[1], 3), "k": kind, "y": d.get("y"), "sl": d["sl"],
                    "att": d["att"][att_year] if att_year is not None else None, "ay": att_year or None,
                    "iso3": to_iso3(d["iso"]) if d.get("iso") else None, "en": en, "zh": zh if zh and zh != en else None,
                    "x": hand, "q": q})
    for r, iso3 in zip(out, countries_at([r["lon"] for r in out], [r["lat"] for r in out])):
        r["iso3"] = r["iso3"] or iso3
    out.sort(key=lambda r: r["sl"])
    fields = ["lon", "lat", "k", "y", "sl", "att", "ay", "x", "iso3", "en", "zh"]
    write_json(OUT / "conventions.json", points_file(out, fields, {"lon": 0.001, "lat": 0.001, "k": 1, "y": 1, "sl": 1, "att": 1,
                                                                  "ay": 1, "x": 1}, strings=("iso3",)))
    # 國家的值：到那一年創辦了幾個（創辦年不詳的算在每一年）
    years = list(range(FIRST, LAST + 1))
    by_country: dict[str, list[int | None]] = defaultdict(list)
    for r in out:
        if r["iso3"]:
            by_country[r["iso3"]].append(r["y"])
    values = {c: [sum(1 for y in ys if y is None or y <= yr) for yr in years] for c, ys in sorted(by_country.items())}
    write_json(OUT / "conventions-count.json", indicator_file("conventions", "個", years, values, license="CC0"))

    print(f"  動漫與電玩展：Wikidata {len(items)} 個、有位置 {len(out)}（自己的座標 {sum(1 for d in items.values() if 'coord' in d)}、"
          f"手放台北 {sum(r['x'] for r in out)}），沒有位置 {len(no_place)}、單一屆 {editions}")
    print(f"    種類：{Counter(r['k'] for r in out)}；國家：{Counter(r['iso3'] for r in out).most_common(12)}；台灣 "
          f"{[(r['zh'] or r['en'], r['k'], r['y']) for r in out if r['iso3'] == 'TWN']}")
    print(f"    有創辦年 {sum(1 for r in out if r['y'])}，最早 {sorted((r['y'], r['en']) for r in out if r['y'])[:6]}")
    print(f"    有人次 {[(r['en'], r['att'], r['ay']) for r in out if r['att']]}")
    print(f"    最多語言：{[(r['zh'] or r['en'], r['sl'], r['k']) for r in sorted(out, key=lambda r: -r['sl'])[:15]]}")
