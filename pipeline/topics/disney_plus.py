"""Disney+ 在哪些國家看得到、迪士尼片庫的拍攝地與故事場景地（2026-11-08，製作手冊第二十八批 678，候選 1482、1487、1488；
擴充「迪士尼」；步驟 disney-plus，輸出 topics/disney/）。

- **Disney+ 的上線表**：英文維基「Disney+」固定版本 revid 1383663039 的「Launch rollout timeline」表（137 列，2019-11-12
  美國、加拿大、荷蘭到 2025-10-08 印尼、馬來西亞、泰國），解析器 `sources/rollout.py` 跟順序 685 的 Peacock 共用。表上沒有
  區域名（Nordics 這類），French West Indies 拆成瓜地洛普、馬丁尼克、聖巴瑟米、法屬聖馬丁。
- **印度與東南亞是另外的品牌**（手冊：不能跟其他國家算成一樣的 Disney+）：條目的「Other versions」表與正文——印度 2020-04-03
  起是 Disney+ Hotstar，2025-02-14 跟 JioCinema 合併成 JioHotstar（迪士尼不再是控股方）；印尼 2020-09-05、馬來西亞
  2021-06-01、泰國 2021-06-30 先以 Disney+ Hotstar 上線，2025-10-08 改名 Disney+（就是表上那一天）。越南：正文寫曾傳出
  2022 年要上線，之後沒有下文。
- 指標兩個：`disneyplus` 每年年底那一國看得到哪一種（2019–2026，類別：Disney+、Disney+ Hotstar、JioHotstar），
  `disneyplus-launch` 第一次看得到迪士尼經營的版本是哪一年（2019–2022）。**表上沒有的國家＝看不到 Disney+**（前端的
  missing 寫這句）。Hulu、ESPN 兩欄是這個版本的現況，不是上線時的。
- **拍攝地（P915）與故事場景地（P840）**：Wikidata（經 QLever）裡十家迪士尼系片廠（Walt Disney Pictures、Marvel Studios、
  Lucasfilm、Walt Disney Animation Studios、Pixar、20th Century Studios、Searchlight、Touchstone、Walt Disney Studios、
  Walt Disney Studios Motion Pictures）以 P272 製作、P750 發行或 P162 製片掛上的作品。**這是迪士尼現在擁有的片庫，不是
  「迪士尼拍的」**（20th Century 與 Searchlight 併進來以前的舊片都在裡面）。地點分四種：
  1. 國家（有 P297）：算進那一國，不畫點；
  2. 有座標的地點：畫點、依座標歸國（香港的 P17 是中國，用座標才歸香港）；面積（P2046）超過 1 萬平方公里的（美國的州、
     英格蘭）與只在一國境內的山脈、河流、沙漠另外一層畫空心大圈，因為那一點只是地區的中心，不是拍攝或故事發生的地方；
  3. 跨國的地區（洲、海洋，與 P17 不是剛好一國的山脈、河流、沙漠、「地區」類，例如諾曼第、古希臘、阿帕拉契山脈）：不畫點、不算進任何
     一國，只進清單；
  4. 虛構的（P31 往上是 fictional entity Q14897293，例如 Arendelle、Wakanda、Radiator Springs）與沒有座標的（太空、
     火星、神話地點）：只進清單，標「虛構」或「沒有座標」，不硬塞到現實的國家。
- 作品的中文名只用 zh-tw、zh-hant 的標籤（不把簡中的片名轉成繁體，那會變成中國的譯名），沒有就用英文。
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict

import geoindex
from common import OUT_DIR, indicator_file, points_file, write_json
from sources import qlever_wikidata as wd
from sources import rollout
from sources.countries import from_alpha2
from sources.wikipedia_html import page, tables
from zh_names import wikidata_zh

OUT = OUT_DIR / "topics" / "disney"
REVID = 1383663039
YEARS = list(range(2019, 2027))
LIC_WIKI = "英文維基百科「Disney+」revid 1383663039（CC BY-SA 4.0）"
BRANDS = {"plus": 1, "hotstar": 2, "jio": 3}  # 前端 disney.ts 的 PLUS_BRANDS（代碼）
# 條目的「Other versions」表與正文（同一個版本）：先以 Disney+ Hotstar 上線、2025-10-08 改名 Disney+ 的
HOTSTAR_FIRST = {"IDN": "2020-09-05", "MYS": "2021-06-01", "THA": "2021-06-30"}
INDIA = [("2020-04-03", "hotstar"), ("2025-02-14", "jio")]
# label_points() 沒有的地區（首府的座標）
EXTRA_LABELS = {"SJM": (15.63, 78.22), "GIB": (-5.35, 36.14), "ALA": (19.94, 60.10)}
TERRITORY_ZH = {"French West Indies": "法屬西印度群島"}
STUDIOS = ["Q191224", "Q367466", "Q242446", "Q1047410", "Q127552", "Q434841", "Q953040", "Q497155", "Q2216535", "Q1323594"]
# 跨國的地區：不畫點、不算進任何一國
# （P17 不能拿來判斷：曼谷、詹姆斯敦的 P17 連歷史上的國家都算，會有三到五個）
SPAN_TYPES = {"continent", "part of the world", "subcontinent", "ocean", "sea", "marginal sea", "geographic region",
              "geographic concept", "divided region", "mountain range", "mountain system", "river", "desert",
              "inner planet of the Solar System", "superior planet", "planet"}
# SPAN_TYPES 與這幾類只有在 P17 剛好一國時才算進那一國（諾曼第的 P17 有法國、根西、澤西三個，算跨國；多洛米蒂山只在義大利，
# 畫成空心的大圈）
REGION_TYPES = {"region", "cultural region", "historical region", "ethnic territory", "ancient civilization", "civilization"}
# 面積超過這個（平方公里）的地點（美國的州、英格蘭這類）畫成空心的大圈，不是一個城市
REGION_KM2 = 10_000
UNIT_KM2 = {"Q712226": 1.0, "Q25343": 1e-6, "Q81292": 0.00404686, "Q35852": 0.01, "Q232291": 2.58999}
PLACE_KIND = {"point": 1, "country": 2, "span": 3, "fictional": 4, "nowhere": 5, "region": 6}  # 前端 disney.ts 的 PLACE_KINDS


def _ymd(iso: str) -> int:
    return int(iso.replace("-", ""))


def _point(value: str) -> tuple[float, float]:
    lon, lat = value.split("(", 1)[1].rstrip(")").split()
    return float(lon), float(lat)


def _yes(text: str) -> int | None:
    return 1 if text.startswith("Yes") else 0 if text.startswith("No") else None


def plus() -> None:
    from topics.reads import label_points

    labels = label_points() | EXTRA_LABELS
    tbs = tables(page("Disney+", REVID))
    parsed = rollout.rows(tbs[0], "Release date", "Country/territory")
    rows = []
    state: dict[str, list[tuple[str, str]]] = defaultdict(list)  # iso3 → [(日期, 品牌)]
    for r in parsed:
        c = r["cells"]
        partners = c["Release partner(s)"]
        brand = "plus"
        first = None
        if len(r["iso3"]) == 1 and r["iso3"][0] in HOTSTAR_FIRST:
            first = HOTSTAR_FIRST[r["iso3"][0]]
            state[r["iso3"][0]].append((first, "hotstar"))
            brand = "hotstar"
        for iso in r["iso3"]:
            state[iso].append((r["date"], "plus"))
        lon, lat = labels[r["iso3"][0]]
        rows.append({"lon": lon, "lat": lat, "iso3": ",".join(r["iso3"]), "name": r["name"],
                     "zh": TERRITORY_ZH.get(r["name"]) if len(r["iso3"]) > 1 else None,
                     "d": _ymd(r["date"]), "first": _ymd(first) if first else None,
                     "partners": None if partners in ("None", "") else partners,
                     "hulu": _yes(c.get("Hulu included?", "")), "espn": _yes(c.get("ESPN included?", "")),
                     "b": BRANDS[brand]})
    # 印度（Other versions 表）
    other = tbs[1]
    if "India" not in other[1][2][0]:
        raise ValueError("Disney+ 的 Other versions 表改了，找不到印度")
    for d, b in INDIA:
        state["IND"].append((d, b))
    lon, lat = labels["IND"]
    rows.append({"lon": lon, "lat": lat, "iso3": "IND", "name": "India", "zh": None, "d": _ymd(INDIA[0][0]),
                 "first": None, "partners": None, "hulu": None, "espn": None, "b": BRANDS["jio"]})
    rows.sort(key=lambda r: (r["first"] or r["d"], r["name"]))

    fields = ["lon", "lat", "iso3", "name", "zh", "d", "first", "partners", "hulu", "espn", "b"]
    scale = {"lon": 0.01, "lat": 0.01, "d": 1, "first": 1, "hulu": 1, "espn": 1, "b": 1}
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "plus.json", points_file(rows, fields, scale, strings=("partners",)))

    # 每年年底的狀態
    values, launch, hints, hints_en, no_value, no_value_en = {}, {}, {}, {}, {}, {}
    for iso, events in sorted(state.items()):
        events.sort()
        series = []
        for y in YEARS:
            now = [b for d, b in events if d <= f"{y}-12-31"]
            series.append(BRANDS[now[-1]] if now else None)
        values[iso] = series
        launch[iso] = [int(events[0][0][:4])]
        first = events[0][0]
        y, m, d = (int(x) for x in first.split("-"))
        if series[0] is None:
            no_value[iso] = f"{y} 年 {m} 月 {d} 日才上線"
            no_value_en[iso] = f"Launched on {first}"
    for r in rows:
        for iso in r["iso3"].split(","):
            first = str(r["first"] or r["d"])
            date_zh = f"{first[:4]} 年 {int(first[4:6])} 月 {int(first[6:])} 日"
            date_en = f"{first[:4]}-{first[4:6]}-{first[6:]}"
            if iso == "IND":
                hints[iso] = "2020 年 4 月 3 日起是 Disney+ Hotstar；2025 年 2 月 14 日跟 JioCinema 合併成 JioHotstar，迪士尼不再是控股方"
                hints_en[iso] = "Disney+ Hotstar from 3 April 2020; merged with JioCinema into JioHotstar on 14 February 2025, no longer controlled by Disney"
            elif r["first"]:
                hints[iso] = f"{date_zh}先以 Disney+ Hotstar 上線，2025 年 10 月 8 日改名 Disney+"
                hints_en[iso] = f"Launched as Disney+ Hotstar on {date_en}; renamed Disney+ on 2025-10-08"
            else:
                hints[iso] = f"{date_zh}上線" + (f"；上線時搭配 {r['partners']}" if r["partners"] else "")
                hints_en[iso] = f"Launched {date_en}" + (f"; launch partners: {r['partners']}" if r["partners"] else "")
    no_value |= {"VNM": "看不到 Disney+：英文維基寫曾傳出 2022 年要在越南上線，之後沒有下文"}
    no_value_en |= {"VNM": "Disney+ is not available: a 2022 launch in Vietnam was reported, with no update since"}
    write_json(OUT / "disneyplus.json", indicator_file(
        "disneyplus", "", YEARS, values, hints=hints, hintsEn=hints_en, noValue=no_value, noValueEn=no_value_en, license=LIC_WIKI))
    write_json(OUT / "disneyplus-launch.json", indicator_file(
        "disneyplus-launch", "年", [2026], launch, hints=hints, hintsEn=hints_en,
        noValue={"VNM": no_value["VNM"]}, noValueEn={"VNM": no_value_en["VNM"]}, license=LIC_WIKI))
    final = Counter(v[-1] for v in values.values())
    print(f"  Disney+：表 {len(parsed)} 列（加印度 1 列），{len(values)} 個國家或地區；2026 年 Disney+ {final[1]}、"
          f"JioHotstar {final[3]}；第一次看得到的年份 {Counter(v[0] for v in launch.values())}；台灣 {hints.get('TWN')}")


def _place_zh(name: str | None) -> str | None:
    """地名：去掉維基條目式的消歧義括號（「布雷製片廠 (英國)」），簡轉繁把「松」轉成「鬆」的改回來（松木製片廠）"""
    if not name:
        return None
    return re.sub(r"\s\([^)]*\)$", "", name).replace("鬆", "松").replace("佈雷", "布雷")


def _works_places(prop: str) -> tuple[dict, dict, list]:
    """(作品, 地點, 配對)：作品 {qid: {en, zh, y}}、地點 {qid: {...}}、配對 [(作品, 地點)]"""
    studios = " ".join(f"wd:{q}" for q in STUDIOS)
    base = "VALUES ?studio { %s } ?work wdt:P272|wdt:P750|wdt:P162 ?studio . ?work wdt:%s ?place ." % (studios, prop)
    pairs = wd.cached(f"disney-{prop.lower()}-pairs", "SELECT DISTINCT ?work ?place WHERE { %s }" % base)
    works = wd.cached(f"disney-{prop.lower()}-works", """SELECT ?work (SAMPLE(?en) AS ?wen) (SAMPLE(?tw) AS ?wtw) (SAMPLE(?ht) AS ?wht) (MIN(?py) AS ?y) WHERE {
  { SELECT DISTINCT ?work WHERE { %s } }
  OPTIONAL { ?work rdfs:label ?en FILTER(LANG(?en)="en") }
  OPTIONAL { ?work rdfs:label ?tw FILTER(LANG(?tw)="zh-tw") }
  OPTIONAL { ?work rdfs:label ?ht FILTER(LANG(?ht)="zh-hant") }
  OPTIONAL { ?work wdt:P577 ?pub BIND(YEAR(?pub) AS ?py) }
} GROUP BY ?work""" % base)
    places = wd.cached(f"disney-{prop.lower()}-places", """SELECT ?place (SAMPLE(?en) AS ?pen) (SAMPLE(?tw) AS ?ptw) (SAMPLE(?ht) AS ?pht) (SAMPLE(?zh) AS ?pzh)
  (SAMPLE(?coord) AS ?c) (SAMPLE(?iso) AS ?iso2) (COUNT(DISTINCT ?p17) AS ?n17) (SAMPLE(?p17iso) AS ?c17) (MAX(?f) AS ?fict)
  (GROUP_CONCAT(DISTINCT ?tl; SEPARATOR="|") AS ?types) WHERE {
  { SELECT DISTINCT ?place WHERE { %s } }
  OPTIONAL { ?place rdfs:label ?en FILTER(LANG(?en)="en") }
  OPTIONAL { ?place rdfs:label ?tw FILTER(LANG(?tw)="zh-tw") }
  OPTIONAL { ?place rdfs:label ?ht FILTER(LANG(?ht)="zh-hant") }
  OPTIONAL { ?place rdfs:label ?zh FILTER(LANG(?zh)="zh") }
  OPTIONAL { ?place wdt:P625 ?coord }
  OPTIONAL { ?place wdt:P297 ?iso }
  OPTIONAL { ?place wdt:P17 ?p17 . OPTIONAL { ?p17 wdt:P297 ?p17iso } }
  OPTIONAL { ?place wdt:P31/wdt:P279* wd:Q14897293 . BIND(1 AS ?f) }
  OPTIONAL { ?place wdt:P31 ?type . ?type rdfs:label ?tl FILTER(LANG(?tl)="en") }
} GROUP BY ?place""" % base)
    areas = wd.cached(f"disney-{prop.lower()}-areas", wd.PREFIXES + """PREFIX psv: <http://www.wikidata.org/prop/statement/value/>
SELECT DISTINCT ?place ?area ?unit WHERE {
  { SELECT DISTINCT ?place WHERE { %s } }
  ?place p:P2046/psv:P2046 ?av . ?av wikibase:quantityAmount ?area ; wikibase:quantityUnit ?unit .
}""" % base)
    q = lambda b, k: b[k]["value"].rsplit("/", 1)[1]
    km2: dict[str, float] = {}
    for b in areas:
        unit = q(b, "unit")
        if unit in UNIT_KM2:
            km2[q(b, "place")] = max(km2.get(q(b, "place"), 0.0), float(b["area"]["value"]) * UNIT_KM2[unit])
    w = {}
    for b in works:
        tw = b.get("wtw", {}).get("value") or b.get("wht", {}).get("value")
        y = b.get("y", {}).get("value")
        w[q(b, "work")] = {"en": b.get("wen", {}).get("value"), "zh": wikidata_zh(tw) if tw else None,
                           "y": int(float(y)) if y else None}
    p = {}
    for b in places:
        if not b["place"]["value"].rsplit("/", 1)[1].startswith("Q"):
            continue  # 「未知的值」（Wikidata 的 somevalue，QLever 回一串雜湊）
        tw = b.get("ptw", {}).get("value") or b.get("pht", {}).get("value")
        p[q(b, "place")] = {
            "km2": km2.get(q(b, "place")),
            "en": b.get("pen", {}).get("value") or q(b, "place"),
            "zh": _place_zh(wikidata_zh(tw, b.get("pzh", {}).get("value"), place=True)),
            "coord": _point(b["c"]["value"]) if "c" in b else None,
            "iso3": from_alpha2(b["iso2"]["value"]) if "iso2" in b else None,
            "n17": int(b["n17"]["value"]), "c17": from_alpha2(b["c17"]["value"]) if "c17" in b else None,
            "fict": "fict" in b, "types": set(filter(None, b.get("types", {}).get("value", "").split("|"))),
        }
    return w, p, [(q(b, "work"), q(b, "place")) for b in pairs]


def places_layer(prop: str, key: str, ind_id: str, what_zh: str, what_en: str) -> None:
    works, places, pairs = _works_places(prop)
    for qid, o in places.items():
        if o["iso3"]:
            o["kind"] = PLACE_KIND["country"]
        elif o["fict"]:
            o["kind"] = PLACE_KIND["fictional"]
        elif not o["coord"]:
            o["kind"] = PLACE_KIND["nowhere"]
        elif (o["types"] & (SPAN_TYPES | REGION_TYPES)) and o["n17"] != 1:
            o["kind"] = PLACE_KIND["span"]
        elif (o["km2"] or 0) > REGION_KM2 or o["types"] & SPAN_TYPES:
            o["kind"] = PLACE_KIND["region"]
        else:
            o["kind"] = PLACE_KIND["point"]
    pts = [o for o in places.values() if o["kind"] in (PLACE_KIND["point"], PLACE_KIND["region"])]
    for o, c in zip(pts, geoindex.countries_at([o["coord"][0] for o in pts], [o["coord"][1] for o in pts])):
        o["country"] = c or o["c17"]
    for o in places.values():
        if o["kind"] == PLACE_KIND["country"]:
            o["country"] = o["iso3"]
        o.setdefault("country", None)

    by_place: dict[str, set] = defaultdict(set)
    for wq, pq in pairs:
        if pq in places:
            by_place[pq].add(wq)
    by_country: dict[str, set] = defaultdict(set)
    country_only: dict[str, set] = defaultdict(set)
    for pq, ws in by_place.items():
        c = places[pq]["country"]
        if c:
            by_country[c] |= ws
            if places[pq]["kind"] == PLACE_KIND["country"]:
                country_only[c] |= ws

    def titles(ws: set, lang: str) -> str:
        # 沒有英文標籤的作品（Wikidata 上只有 QID）照樣算進部數，只是不列名字
        ordered = sorted((wq for wq in ws if works[wq]["en"]), key=lambda wq: (works[wq]["y"] or 9999, works[wq]["en"]))
        return "|".join((works[wq]["zh"] if lang == "zh" and works[wq]["zh"] else works[wq]["en"])
                        + (f" ({works[wq]['y']})" if works[wq]["y"] else "") for wq in ordered)

    out = []
    labels = None
    for pq, ws in by_place.items():
        o = places[pq]
        if o["kind"] in (PLACE_KIND["point"], PLACE_KIND["region"]):
            lon, lat = o["coord"]
        elif o["kind"] == PLACE_KIND["country"]:
            if labels is None:
                from topics.reads import label_points

                labels = label_points() | EXTRA_LABELS
            if o["iso3"] not in labels:
                continue
            lon, lat = labels[o["iso3"]]
        else:
            lon, lat = None, None
        out.append({"lon": lon, "lat": lat, "qid": pq, "en": o["en"], "zh": o["zh"], "iso3": o["country"], "k": o["kind"],
                    "n": len(ws), "wz": titles(ws, "zh"), "we": titles(ws, "en")})
    out.sort(key=lambda r: (r["k"], -r["n"], r["en"]))
    fields = ["lon", "lat", "qid", "en", "zh", "iso3", "k", "n", "wz", "we"]
    scale = {"lon": 0.001, "lat": 0.001, "k": 1, "n": 1}
    write_json(OUT / f"{key}-all.json", points_file(out, fields, scale))
    write_json(OUT / f"{key}.json", points_file([r for r in out if r["k"] == PLACE_KIND["point"]], fields, scale))
    write_json(OUT / f"{key}-regions.json", points_file([r for r in out if r["k"] == PLACE_KIND["region"]], fields, scale))

    counts = {c: [len(ws)] for c, ws in sorted(by_country.items())}
    hints = {}
    hints_en = {}
    for c, ws in by_country.items():
        top = sorted((r for r in out if r["iso3"] == c and r["k"] in (PLACE_KIND["point"], PLACE_KIND["region"])), key=lambda r: -r["n"])[:3]
        part = "、".join(f"{r['zh'] or r['en']} {r['n']} 部" for r in top)
        part_en = ", ".join(f"{r['en']} {r['n']}" for r in top)
        only = len(country_only.get(c, ()))
        hints[c] = "；".join(filter(None, [f"最多的地點：{part}" if part else "", f"只寫到國家的 {only} 部" if only else ""]))
        hints_en[c] = "; ".join(filter(None, [f"Top places: {part_en}" if part_en else "", f"{only} given at country level only" if only else ""]))
    no_value = {} if "TWN" in counts else {"TWN": f"Wikidata 上沒有迪士尼片庫的作品寫{what_zh}在台灣"}
    no_value_en = {} if "TWN" in counts else {"TWN": f"No title in the Disney library on Wikidata is {what_en} in Taiwan"}
    write_json(OUT / f"{key}-count.json", indicator_file(
        ind_id, "部", [2026], counts, hints=hints or None, hintsEn=hints_en or None, noValue=no_value or None,
        noValueEn=no_value_en or None, license="Wikidata（CC0）"))
    kinds = Counter(places[pq]["kind"] for pq in by_place)
    top = sorted(counts.items(), key=lambda kv: -kv[1][0])[:25]
    print(f"  {prop}：作品 {len({w for w, _ in pairs})} 部、地點 {len(by_place)} 處（{dict(kinds)}；1 點 2 國家 3 跨國 4 虛構 5 沒座標 6 大地區）；"
          f"{len(counts)} 國，前 25 {[(c, v[0]) for c, v in top]}；台灣 {counts.get('TWN')}")
    for k in (PLACE_KIND["point"], PLACE_KIND["region"], PLACE_KIND["span"]):
        pts_top = sorted((r for r in out if r["k"] == k), key=lambda r: -r["n"])[:12]
        print(f"    種類 {k} 最多的：" + "、".join(f"{r['en']} {r['n']}" for r in pts_top))
    fic = sorted((r for r in out if r["k"] == PLACE_KIND["fictional"]), key=lambda r: -r["n"])[:12]
    if fic:
        print("    虛構：" + "、".join(f"{r['en']} {r['n']}" for r in fic))


def build() -> None:
    plus()
    places_layer("P915", "filming", "filming", "拍攝地", "filmed")
    places_layer("P840", "settings", "settings", "故事場景", "set")
