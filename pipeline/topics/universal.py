"""環球影城（新主題，2026-11-08，製作手冊第二十八批 680，候選 1521、1522、1525；旅遊・樂園；步驟 universal，輸出 topics/universal/）。

- 據點：手工白名單 `pipeline/data/universal/places.csv`（QID 照 map-plan research/brands/W2.md 第二節 1521，**不用名稱比對**：
  英文名稱只對得到 7 個，日本、北京的名稱是日文與中文）。13 筆：2 個度假區（奧蘭多、北京）、9 座營運中的樂園（含水上樂園
  Volcano Bay 與 2026 年開的 Universal Kids Resort）、1 座已關閉的水上樂園（Wet 'n Wild Orlando，環球 1998–2016 年經營）、
  1 座在建（英國，宣布的目標年 2031 不是事實，不給開幕年、另一層畫）。
- **「環球有幾座樂園」的答案是 9**（手冊）：營運中的主題樂園與水上樂園，不算度假區、不算在建。
- 開幕年：英文維基「Universal Destinations & Experiences」固定版本 revid 1382726905 的條文（跟順序 632 用的同一個版本）。
  Wikidata 的 P571／P1619 只拿來對照（好萊塢的 P1619 有 1912、1915、1964 三個值，不選對會畫成 1912 年開的；新加坡的 P571
  2011-01-01 既不是試營運也不是正式開幕）。新加坡用 2011 年正式開幕，2010 年的試營運寫在說明。
- 座標、英文名：Wikidata（經 QLever，CC0）；國家依座標。共用迪士尼主題的 `_km()`。
- 指標：各國那一年有幾座環球經營的樂園（含水上樂園），時間軸 1964–2026，關閉的在關閉那年之後不算（Wet 'n Wild 1998–2016）。
"""
from __future__ import annotations

import csv
from collections import Counter, defaultdict

import geoindex
from common import OUT_DIR, ROOT, indicator_file, points_file, write_json
from sources import qlever_wikidata as wd
from topics.disney import UNIT_KM2, _km
from topics.park_ownership import UNIVERSAL as OWNERSHIP

OUT = OUT_DIR / "topics" / "universal"
CSV = ROOT / "pipeline" / "data" / "universal" / "places.csv"
FIRST, LAST = 1964, 2026
KINDS = {"park": 1, "water": 2, "resort": 3}
STATUS = {"open": 1, "closed": 2, "planned": 3}
RESORTS = ["hollywood", "orlando", "japan", "singapore", "beijing", "frisco", "uk"]  # 前端 universal.ts 的 RESORTS（代碼是索引 + 1）
RESORT_ZH = {"hollywood": "好萊塢", "orlando": "奧蘭多", "japan": "大阪", "singapore": "新加坡", "beijing": "北京",
             "frisco": "德州 Frisco", "uk": "英國 Bedford"}
FIELDS = ["lon", "lat", "qid", "en", "zh", "iso3", "kind", "resort", "status", "y", "yc", "area", "note", "own", "share", "ownnote"]
SCALE = {"lon": 0.0001, "lat": 0.0001, "kind": 1, "resort": 1, "status": 1, "y": 1, "yc": 1, "area": 0.001, "own": 1, "share": 1}


def read_places() -> list[dict]:
    with open(CSV, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        if r["kind"] not in KINDS or r["status"] not in STATUS or r["resort"] not in RESORTS:
            raise ValueError(f"places.csv 的 {r['qid']} 欄位不對：{r}")
        if r["status"] != "planned" and not r["opened"]:
            raise ValueError(f"{r['qid']} 不是在建，卻沒有開幕年")
        if r["status"] == "planned" and r["opened"]:
            raise ValueError(f"{r['qid']} 在建的不給開幕年（手冊）")
    return rows


def wikidata(qids: list[str]) -> dict[str, dict]:
    rows = wd.cached("universal-places", wd.PREFIXES + """PREFIX psv: <http://www.wikidata.org/prop/statement/value/>
SELECT ?item ?label ?coord ?inc ?open ?area ?unit WHERE { VALUES ?item { %s }
 OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label)="en") } OPTIONAL { ?item wdt:P625 ?coord }
 OPTIONAL { ?item wdt:P571 ?inc } OPTIONAL { ?item wdt:P1619 ?open }
 OPTIONAL { ?item p:P2046/psv:P2046 ?av . ?av wikibase:quantityAmount ?area ; wikibase:quantityUnit ?unit } }""" % " ".join(f"wd:{q}" for q in qids))
    out: dict[str, dict] = defaultdict(lambda: {"years": set()})
    for r in rows:
        o = out[r["item"]["value"].rsplit("/", 1)[1]]
        if "label" in r:
            o.setdefault("en", r["label"]["value"])
        if "coord" in r and "lon" not in o:
            lon, lat = r["coord"]["value"].split("(", 1)[1].rstrip(")").split()
            o["lon"], o["lat"] = float(lon), float(lat)
        for k in ("inc", "open"):
            if k in r and r[k]["value"][:4].isdigit():
                o["years"].add(int(r[k]["value"][:4]))
        if "area" in r and "area" not in o:
            o["area"] = (float(r["area"]["value"]), r["unit"]["value"].rsplit("/", 1)[1])
    return out


def build() -> None:
    places = read_places()
    meta = wikidata([p["qid"] for p in places])
    rows = []
    for p in places:
        m = meta.get(p["qid"], {})
        if "lon" not in m:
            raise ValueError(f"{p['qid']} 在 Wikidata 沒有座標")
        if p["opened"] and m["years"] and int(p["opened"]) not in m["years"]:
            print(f"    {p['qid']} {m.get('en')}：Wikidata 的 P571／P1619 是 {sorted(m['years'])}，CSV 寫 {p['opened']}（照 CSV）")
        area = None
        if "area" in m:
            value, unit = m["area"]
            if unit not in UNIT_KM2:
                raise ValueError(f"{p['qid']} 的面積單位沒見過：{unit}")
            area = value * UNIT_KM2[unit]
        rows.append({
            "lon": m["lon"], "lat": m["lat"], "qid": p["qid"], "en": m.get("en", p["qid"]), "zh": p["name_zh"] or None,
            "kind": KINDS[p["kind"]], "resort": RESORTS.index(p["resort"]) + 1, "status": STATUS[p["status"]],
            "y": int(p["opened"]) if p["opened"] else None, "yc": int(p["closed"]) if p["closed"] else None,
            "area": round(area, 3) if area else None, "note": p["note"] or None,
            # 四種所有權關係（第二十八批 684，topics/park_ownership.py）
            "own": OWNERSHIP[p["resort"]][0], "share": OWNERSHIP[p["resort"]][1], "ownnote": OWNERSHIP[p["resort"]][2],
        })
    for r, c in zip(rows, geoindex.countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
        r["iso3"] = c
    rows.sort(key=lambda r: (r["kind"] == KINDS["resort"], r["status"], r["y"] or 9999))
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "places.json", points_file(rows, FIELDS, SCALE))
    write_json(OUT / "resorts.json", points_file([r for r in rows if r["kind"] == KINDS["resort"]], FIELDS, SCALE))
    # 樂園的點跟時間軸（已關閉的在關閉那年之後消失）；在建的沒有開幕年，另一個檔、一直畫
    write_json(OUT / "sites.json", points_file(
        [r for r in rows if r["kind"] != KINDS["resort"] and r["status"] != STATUS["planned"]], FIELDS, SCALE))
    write_json(OUT / "planned.json", points_file([r for r in rows if r["status"] == STATUS["planned"]], FIELDS, SCALE))

    parks = [r for r in rows if r["kind"] != KINDS["resort"] and r["status"] != STATUS["planned"]]
    years = list(range(FIRST, LAST + 1))
    values = {}
    for c in sorted({r["iso3"] for r in parks}):
        mine = [r for r in parks if r["iso3"] == c]
        values[c] = [sum(1 for r in mine if r["y"] <= y and (r["yc"] is None or y <= r["yc"])) or None for y in years]
    now = [r for r in parks if r["status"] == STATUS["open"]]
    hints, hints_en = {}, {}
    for c in values:
        by_resort = Counter(r["resort"] for r in now if r["iso3"] == c)
        hints[c] = "、".join(f"{RESORT_ZH[RESORTS[k - 1]]} {n} 座" for k, n in by_resort.most_common())
        hints_en[c] = ", ".join(f"{n} in {RESORTS[k - 1].title()}" for k, n in by_resort.most_common())
    if "USA" in hints:
        hints["USA"] += "（另有 1998–2016 年經營的水上樂園 Wet 'n Wild）"
        hints_en["USA"] += " (plus the Wet 'n Wild water park, run 1998–2016)"

    from topics.reads import label_points

    no_value, no_value_en = {}, {}
    for c, (lon, lat) in label_points().items():
        if c in values:
            continue
        near = min(now, key=lambda r: _km((r["lon"], r["lat"]), (lon, lat)))
        km = round(_km((near["lon"], near["lat"]), (lon, lat)), -2)
        no_value[c] = f"沒有環球的樂園；最近的是{near['zh'] or near['en']}（約 {km:,.0f} 公里）"
        no_value_en[c] = f"No Universal park; the nearest is {near['en']} (about {km:,.0f} km)"
    no_value["TWN"] = "台灣沒有環球的樂園，" + no_value["TWN"].split("；", 1)[1] + "；台灣有的是環球的電影發行"
    no_value_en["TWN"] = "Taiwan has no Universal park; " + no_value_en["TWN"].split("; ", 1)[1] + "; Universal is present through film distribution"
    no_value["GBR"] = "英國的環球樂園在建，宣布的目標是 2031 年開幕"
    no_value_en["GBR"] = "A Universal park is under construction in England, with a target opening of 2031"
    write_json(OUT / "parks.json", indicator_file(
        "parks", "座", years, values, hints=hints, hintsEn=hints_en, noValue=no_value, noValueEn=no_value_en,
        license="Wikidata（CC0）；開幕年依英文維基 Universal Destinations & Experiences（CC BY-SA 4.0）"))
    print(f"  環球：{len(rows)} 筆，營運中的樂園 {len(now)} 座（{dict(Counter(r['iso3'] for r in now))}）；"
          f"有面積 {[(r['en'], r['area']) for r in rows if r['area']]}；台灣 {no_value['TWN']}")
