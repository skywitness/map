"""迪士尼樂園的年人次與疫情恢復率、園內設施與主題園區（2026-11-08，製作手冊第二十八批 677，候選 1485、1486；
擴充「迪士尼」；步驟 disney-visits，輸出 topics/disney/）。候選 1497（樂園交通）照手冊的建議不做（量很小，手冊寫「當 tooltip
或完全不做」）。

- 人次：景點地圖已經解析的 `attractions/park-visitors.json`（英文維基「List of amusement park rankings」，數字原本來自 TEA／
  AECOM，使用者 2026-10-30 決定走維基轉引；這個檔是 revid 1377863670 解析的，手冊寫的 1383846262 是同一張表的新版，12 座迪士尼
  的數字抽查一樣）。12 座迪士尼主題樂園都在表上，2009–2024 每年都有（含 2020、2021）。依座標配對 `disney/places.json` 的樂園。
- 各國：同一國的迪士尼樂園人次加總（美國 6 座、日本 2、法國 2、香港 1、中國 1）；恢復率是 2024 ÷ 2019。
- 園內設施（候選 1486）：Wikidata（經 QLever）裡 P361（隸屬）或 P276（位在）指向 12 座樂園的項目，依 P31 歸成遊樂設施、主題園區、
  餐廳與商店、表演與活動（遊行、煙火、節慶），清單文章與其他不收。只畫有座標的；各園的數量寫在清單與樂園的點的說明。
  手冊：QLever 的 `ogc:sfContains` 現在回 HTTP 400，所以不用空間連接、只用 Wikidata 的隸屬關係。
"""
from __future__ import annotations

from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, load_points_json, points_file, read_points_file, write_json
from sources import qlever_wikidata as wd
from topics.disney import KINDS, STATUS, _km

OUT = OUT_DIR / "topics" / "disney"
YEARS = list(range(2009, 2025))
KIND_TYPES = [
    (1, {"amusement ride", "steel roller coaster", "dark ride", "roller coaster", "river rafting ride", "people mover",
         "Space Mountain", "heritage railway", "attraction", "railway line", "water ride", "log flume", "carousel",
         "wooden roller coaster", "launched roller coaster", "inverted roller coaster", "spinning roller coaster", "flume ride"}),
    (2, {"themed area", "Tomorrowland", "territory"}),
    (3, {"restaurant", "shop", "café", "food booth", "theme restaurant", "snack bar", "fast food restaurant", "bar"}),
    (4, {"parade", "amusement park show", "firework", "fireworks festival", "show", "planned event", "recurring event",
         "dramatico-musical work", "annual event", "festival", "food festival", "wine festival", "theatre building"}),
]


def _points(path) -> list[dict]:
    pts = read_points_file(load_points_json(path))
    for p in pts:
        p["lon"], p["lat"] = float(p["lon"]), float(p["lat"])
    return pts


def build() -> None:
    places = _points(OUT / "places.json")
    parks = [p for p in places if p["kind"] == KINDS["park"] and p["status"] == STATUS["open"]]
    tea = _points(OUT_DIR / "topics" / "attractions" / "park-visitors.json")
    rows = []
    for p in parks:
        near = min(tea, key=lambda t: _km((t["lon"], t["lat"]), (p["lon"], p["lat"])))
        if _km((near["lon"], near["lat"]), (p["lon"], p["lat"])) > 1.5:
            raise ValueError(f"{p['en']} 在人次檔裡找不到")
        row = {"lon": p["lon"], "lat": p["lat"], "qid": p["qid"], "en": p["en"], "zh": p.get("zh"), "iso3": p["iso3"],
               "resort": p["resort"]}
        for y in YEARS:
            row[f"v{y}"] = near.get(f"v{y}")
        rows.append(row)

    # 園內設施（Wikidata 的 P361／P276）
    qids = " ".join(f"wd:{p['qid']}" for p in parks)
    found = wd.cached("disney-rides", """SELECT ?item ?park ?label ?coord ?type ?typeLabel ?open WHERE {
  VALUES ?park { %s }
  ?item wdt:P361|wdt:P276 ?park .
  OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label)="en") }
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item wdt:P31 ?type . OPTIONAL { ?type rdfs:label ?typeLabel FILTER(LANG(?typeLabel)="en") } }
  OPTIONAL { ?item wdt:P1619 ?open }
}""" % qids)
    items: dict[str, dict] = defaultdict(lambda: {"types": set()})
    for b in found:
        q = b["item"]["value"].rsplit("/", 1)[1]
        o = items[q]
        o["park"] = b["park"]["value"].rsplit("/", 1)[1]
        if "label" in b:
            o["en"] = b["label"]["value"]
        if "coord" in b and "lon" not in o:
            lon, lat = b["coord"]["value"].split("(", 1)[1].rstrip(")").split()
            o["lon"], o["lat"] = float(lon), float(lat)
        if "typeLabel" in b:
            o["types"].add(b["typeLabel"]["value"])
    park_index = {p["qid"]: i + 1 for i, p in enumerate(rows)}
    per_park: dict[str, Counter] = defaultdict(Counter)
    rides = []
    for q, o in items.items():
        kind = next((k for k, s in KIND_TYPES if o["types"] & s), None)
        if not kind:
            continue
        per_park[o["park"]][kind] += 1
        if "lon" in o and o.get("en"):
            rides.append({"lon": o["lon"], "lat": o["lat"], "qid": q, "en": o["en"], "k": kind, "park": park_index[o["park"]]})
    for r in rows:
        c = per_park[r["qid"]]
        r["n1"], r["n2"], r["n3"], r["n4"] = (c.get(k) or None for k in (1, 2, 3, 4))
    fields = ["lon", "lat", "qid", "en", "zh", "iso3", "resort"] + [f"v{y}" for y in YEARS] + ["n1", "n2", "n3", "n4"]
    scale = {"lon": 0.0001, "lat": 0.0001, "resort": 1, **{f"v{y}": 1 for y in YEARS}, "n1": 1, "n2": 1, "n3": 1, "n4": 1}
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "park-visits.json", points_file(rows, fields, scale))
    rides.sort(key=lambda r: r["lon"])
    write_json(OUT / "park-rides.json", points_file(rides, ["lon", "lat", "qid", "en", "k", "park"],
                                                    {"lon": 0.0001, "lat": 0.0001, "k": 1, "park": 1}, delta=("lon",)))

    # 各國的人次與恢復率
    by_country: dict[str, list] = defaultdict(lambda: [0] * len(YEARS))
    n_parks = Counter(r["iso3"] for r in rows)
    for r in rows:
        for i, y in enumerate(YEARS):
            by_country[r["iso3"]][i] += r[f"v{y}"] or 0
    lic = "英文維基百科 List of amusement park rankings（CC BY-SA 4.0；數字原本來自 TEA／AECOM）"
    hints = {c: f"{n_parks[c]} 座迪士尼樂園的合計" for c in by_country}
    hints_en = {c: f"Total of {n_parks[c]} Disney park{'s' if n_parks[c] > 1 else ''}" for c in by_country}
    no_value = {"TWN": "台灣沒有迪士尼的樂園"}
    no_value_en = {"TWN": "Taiwan has no Disney park"}
    write_json(OUT / "visitors.json", indicator_file(
        "visitors", "人次", YEARS, {c: [v or None for v in vals] for c, vals in sorted(by_country.items())},
        hints=hints, hintsEn=hints_en, noValue=no_value, noValueEn=no_value_en, license=lic))
    recovery = {c: [round(v[-1] / v[YEARS.index(2019)] * 100, 1)] for c, v in by_country.items()}
    write_json(OUT / "recovery.json", indicator_file(
        "recovery", "%", [2024], dict(sorted(recovery.items())), hints=hints, hintsEn=hints_en,
        noValue=no_value, noValueEn=no_value_en, license=lic))
    total = [sum(v[i] for v in by_country.values()) for i in range(len(YEARS))]
    print(f"  迪士尼的人次：12 座合計 2019 年 {total[YEARS.index(2019)]:,}、2020 年 {total[YEARS.index(2020)]:,}、"
          f"2024 年 {total[-1]:,}（{total[-1] / total[YEARS.index(2019)] * 100:.1f}%）；各國恢復率 {recovery}")
    print(f"  園內設施：{len(items)} 個項目，分得進四類的 {sum(sum(c.values()) for c in per_park.values())}，有座標 {len(rides)}；"
          f"{dict(Counter(r['k'] for r in rides))}")
    for r in sorted(rows, key=lambda r: -(r['v2024'] or 0)):
        print(f"    {r['en']}：2019 {r['v2019']:,}、2020 {r['v2020']:,}、2024 {r['v2024']:,}（{r['v2024'] / r['v2019'] * 100:.0f}%）；"
              f"設施 {r['n1']}、園區 {r['n2']}")
