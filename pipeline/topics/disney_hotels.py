"""迪士尼的飯店：位置、所屬度假區、開幕年與類型（2026-11-08，製作手冊第二十八批 675，候選 1480；擴充「迪士尼」；
步驟 disney-hotels，輸出 topics/disney/）。

- 白名單 `pipeline/data/disney/hotels.csv`：QID 照 map-plan research/brands/W1.md 的 1480（**不用名稱比對**：OSM 與 Wikidata
  的名稱比對都會混進 Hilton、Four Seasons 這類「迪士尼旁邊的旅館」）。欄位：度假區、角色（`hotel` 飯店、`villa` 迪士尼
  度假俱樂部〔DVC〕的別墅，跟 `base` 那家同址、`unbuilt` 沒蓋成的計畫）、`operator`（`marriott`：Swan 與 Dolphin 在華特
  迪士尼世界裡面但由萬豪經營）、中文名（只有香港、上海用官方中文名，其他照英文，不自己翻譯）。
- Wikidata（經 QLever，CC0）：座標、開幕 P571、類型 P31、房間數 P8733。**房間數只有 4 家有**（香港 3 家與上海的玩具總動員
  酒店），手冊：不能做成指標、也**不要用 P1101 冒充**（那是地上樓層數），只寫在說明。迪士尼自己的 Value／Moderate／Deluxe
  分級只在官網上、不能抄，類型改寫 Wikidata 的 P31。
- 國家依座標（香港的 P17 是中國，用座標才歸香港）。
- 指標：各國迪士尼直營的飯店數（不算萬豪經營的兩家、DVC 別墅與沒蓋成的），2026 年一年（開幕年只有一半有，不做時間軸）。
"""
from __future__ import annotations

import csv
from collections import Counter, defaultdict

import geoindex
from common import OUT_DIR, ROOT, indicator_file, points_file, write_json
from sources import qlever_wikidata as wd
from topics.disney import RESORTS, RESORT_ZH

OUT = OUT_DIR / "topics" / "disney"
CSV = ROOT / "pipeline" / "data" / "disney" / "hotels.csv"
YEAR = 2026
ROLES = {"hotel": 1, "villa": 2, "unbuilt": 3}
HOTEL_RESORTS = RESORTS + ["other"]  # 前端 disney.ts 的 HOTEL_RESORTS 同樣的順序（代碼是索引 + 1）
TYPES = {"hotel": 1, "resort": 2, "lodge": 4, "convention center": 8}  # 位元：前端依位元寫類型
# Wikidata 的標籤比實際的名稱舊（W1：Paradise Pier 2024 年改名 Pixar Place，OSM 已經改了）
NAME_FIX = {"Q3030333": "Pixar Place Hotel"}
FIELDS = ["lon", "lat", "qid", "en", "zh", "iso3", "resort", "role", "base", "op", "y", "types", "rooms"]
SCALE = {"lon": 0.0001, "lat": 0.0001, "resort": 1, "role": 1, "op": 1, "y": 1, "types": 1, "rooms": 1}


def build() -> None:
    with open(CSV, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        if r["resort"] not in HOTEL_RESORTS or r["role"] not in ROLES:
            raise ValueError(f"hotels.csv 的 {r['qid']} 欄位不對：{r}")
    qids = [r["qid"] for r in rows]
    found = wd.cached("disney-hotels", """SELECT ?item ?label ?coord ?inception ?type ?typeLabel ?rooms WHERE {
 VALUES ?item { %s }
 OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label)="en") }
 OPTIONAL { ?item wdt:P625 ?coord }
 OPTIONAL { ?item wdt:P571 ?inception }
 OPTIONAL { ?item wdt:P1619 ?opening }
 OPTIONAL { ?item wdt:P31 ?type . ?type rdfs:label ?typeLabel FILTER(LANG(?typeLabel)="en") }
 OPTIONAL { ?item wdt:P8733 ?rooms }
}""" % " ".join("wd:" + q for q in qids))
    meta: dict[str, dict] = defaultdict(lambda: {"types": 0})
    for b in found:
        q = b["item"]["value"].rsplit("/", 1)[1]
        o = meta[q]
        if "label" in b:
            o["en"] = b["label"]["value"]
        if "coord" in b and "lon" not in o:
            lon, lat = b["coord"]["value"].split("(", 1)[1].rstrip(")").split()
            o["lon"], o["lat"] = float(lon), float(lat)
        if "inception" in b:
            o["y"] = int(b["inception"]["value"][:4])
        if "typeLabel" in b:
            o["types"] |= TYPES.get(b["typeLabel"]["value"], 0)
        if "rooms" in b:
            o["rooms"] = int(float(b["rooms"]["value"]))
    by_qid = {r["qid"]: r for r in rows}
    out = []
    for r in rows:
        m = meta[r["qid"]]
        if "lon" not in m:
            # 沒有座標的（Animal Kingdom Villas）放在同址的本體
            base = meta[by_qid[r["qid"]]["base"]] if r["base"] else None
            if not base or "lon" not in base:
                raise ValueError(f"{r['qid']} 沒有座標，也沒有可以借的本體")
            m["lon"], m["lat"] = base["lon"], base["lat"]
        out.append({
            "lon": m["lon"], "lat": m["lat"], "qid": r["qid"], "en": NAME_FIX.get(r["qid"], m.get("en", r["qid"])),
            "zh": r["name_zh"] or None, "resort": HOTEL_RESORTS.index(r["resort"]) + 1, "role": ROLES[r["role"]],
            "base": r["base"] or None, "op": 1 if r["operator"] == "marriott" else 0, "y": m.get("y"),
            "types": m["types"] or None, "rooms": m.get("rooms"),
        })
    iso = geoindex.countries_at([o["lon"] for o in out], [o["lat"] for o in out])
    for o, c in zip(out, iso):
        o["iso3"] = c
    out.sort(key=lambda o: (o["resort"], o["y"] or 9999, o["en"]))
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "hotels-all.json", points_file(out, FIELDS, SCALE, strings=("base",)))
    write_json(OUT / "hotels.json", points_file([o for o in out if o["role"] == ROLES["hotel"]], FIELDS, SCALE, strings=("base",)))

    own = [o for o in out if o["role"] == ROLES["hotel"] and not o["op"]]
    counts = Counter(o["iso3"] for o in own)
    hints = {}
    hints_en = {}
    for c in counts:
        by_resort = Counter(o["resort"] for o in own if o["iso3"] == c)
        hints[c] = "、".join(f"{(RESORT_ZH | {'other': '度假區以外'})[HOTEL_RESORTS[k - 1]]} {n} 家" for k, n in by_resort.most_common())
        hints_en[c] = ", ".join(f"{n} at {HOTEL_RESORTS[k - 1].upper()}" for k, n in by_resort.most_common())
    no_value = {"TWN": "台灣沒有迪士尼的飯店", "ARE": "阿布達比的度假區已宣布，還沒有飯店"}
    no_value_en = {"TWN": "Taiwan has no Disney hotel", "ARE": "The Abu Dhabi resort has been announced, with no hotels yet"}
    write_json(OUT / "hotels-count.json", indicator_file(
        "hotels", "家", [YEAR], {c: [n] for c, n in sorted(counts.items())}, hints=hints, hintsEn=hints_en,
        noValue=no_value, noValueEn=no_value_en, license="Wikidata（CC0）"))
    print(f"  迪士尼的飯店：白名單 {len(out)} 筆（飯店 {sum(o['role'] == 1 for o in out)}、DVC 別墅 {sum(o['role'] == 2 for o in out)}、"
          f"沒蓋成 {sum(o['role'] == 3 for o in out)}）；直營 {len(own)} 家 {dict(counts)}；有開幕年 {sum(1 for o in out if o['y'])}、"
          f"有房間數 {sum(1 for o in out if o['rooms'])}")
