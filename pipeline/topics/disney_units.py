"""迪士尼的影視部門、電視頻道與各國分公司（2026-11-08，製作手冊第二十八批 676，候選 1481、1493、1494；擴充「迪士尼」；
步驟 disney-units，輸出 topics/disney/）。

- **實體清單是固定的白名單** `pipeline/data/disney/units.csv`（手冊：所有權鏈不能無人看管地自動更新，會把不相干的東西畫成
  據點；只讓座標、年份這些屬性自動更新）。白名單 2026-11-08 這樣產生一次：Wikidata（經 QLever）裡 P127／P749／P361／P137
  一到兩跳連到華特迪士尼公司 Q7414 的 1,096 個項目（跟 W1 的 1,096 一樣），依 P31 歸成五組，**排掉美國專利 225 筆**（不排會
  把單位數虛報兩成）、節目時段（program block）、作品與虛構（電影系列、遊戲關卡、角色……0 筆有座標）、已經在樂園、飯店、
  郵輪畫過的實體據點，留下 579 個：1 影視（片廠、動畫、製作、發行）、2 電視與廣播（頻道、電視網、電台）、3 串流與網站、
  4 遊戲、唱片與出版、5 公司與分公司。**這是 Wikidata 的所有權鏈，不等於迪士尼百分之百持股**（Banijay UK、A+E 等是合資或
  曾經持有），說明寫明。
- **座標走三條退路**（W1：自己有 P625 的只有一成）：自己的 P625 → 總部 P159 的 P625 → 所在地 P276 的 P625 → 行政區 P131
  的 P625。**總部是整個國家的丟掉**（Illumination 的 P159 是美國，會落在堪薩斯州中間）：P159 有 P297（ISO 國碼）的就是國家。
  精度欄 `prec`：1 自己的座標、2 總部或所在地的城市。沒有座標的只進清單（國家依 P17，點放在國家的標籤點，`prec` 3）。
- 同一個座標（小數 3 位）有好幾個單位時（伯班克一地就有七八個），照「大企業的據點」的寫法排成半徑 0.025° 的小圓。
- 國家：有座標的依座標（geoindex），沒有的依 P17。台灣在這條鏈裡 0 筆（Disney Channel (Taiwan) Q3030388 不在鏈上、
  也沒有座標），noValue 寫原因。
"""
from __future__ import annotations

import csv
import math
from collections import Counter, defaultdict

import geoindex
from common import OUT_DIR, ROOT, indicator_file, points_file, write_json
from sources import qlever_wikidata as wd
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "disney"
CSV = ROOT / "pipeline" / "data" / "disney" / "units.csv"
YEAR = 2026
GROUPS = ["studio", "broadcast", "streaming", "publishing", "company"]  # 前端 disney.ts 的 UNIT_GROUPS（代碼是索引 + 1）
FIELDS = ["lon", "lat", "qid", "en", "iso3", "g", "prec", "y", "city"]
SCALE = {"lon": 0.0001, "lat": 0.0001, "g": 1, "prec": 1, "y": 1}
SPREAD = 0.025


def _point(value: str) -> tuple[float, float]:
    lon, lat = value.split("(", 1)[1].rstrip(")").split()
    return float(lon), float(lat)


def build() -> None:
    with open(CSV, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    groups = {r["qid"]: int(r["group"]) for r in rows}
    values = " ".join(f"wd:{q}" for q in groups)
    found = wd.cached("disney-units", """SELECT ?item ?label ?own ?hq ?hqc ?hqIso ?hqLabel ?loc ?locc ?locLabel ?adm ?admc ?admLabel ?cIso ?inception WHERE {
  VALUES ?item { %s }
  OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label)="en") }
  OPTIONAL { ?item wdt:P625 ?own }
  OPTIONAL { ?item wdt:P159 ?hq . OPTIONAL { ?hq wdt:P625 ?hqc } OPTIONAL { ?hq wdt:P297 ?hqIso }
             OPTIONAL { ?hq rdfs:label ?hqLabel FILTER(LANG(?hqLabel)="en") } }
  OPTIONAL { ?item wdt:P276 ?loc . OPTIONAL { ?loc wdt:P625 ?locc } OPTIONAL { ?loc rdfs:label ?locLabel FILTER(LANG(?locLabel)="en") } }
  OPTIONAL { ?item wdt:P131 ?adm . OPTIONAL { ?adm wdt:P625 ?admc } OPTIONAL { ?adm rdfs:label ?admLabel FILTER(LANG(?admLabel)="en") } }
  OPTIONAL { ?item wdt:P17 ?country . ?country wdt:P297 ?cIso }
  OPTIONAL { ?item wdt:P571 ?inception }
}""" % values)
    meta: dict[str, dict] = defaultdict(dict)
    for b in found:
        q = b["item"]["value"].rsplit("/", 1)[1]
        o = meta[q]
        if "label" in b:
            o.setdefault("en", b["label"]["value"])
        if "own" in b:
            o.setdefault("own", _point(b["own"]["value"]))
        if "hqc" in b and "hqIso" not in b:
            o.setdefault("hq", (_point(b["hqc"]["value"]), b.get("hqLabel", {}).get("value")))
        if "hqIso" in b:
            o["hq_country"] = True
        if "locc" in b:
            o.setdefault("loc", (_point(b["locc"]["value"]), b.get("locLabel", {}).get("value")))
        if "admc" in b:
            o.setdefault("adm", (_point(b["admc"]["value"]), b.get("admLabel", {}).get("value")))
        if "cIso" in b:
            o.setdefault("iso2", b["cIso"]["value"])
        if "inception" in b:
            y = int(b["inception"]["value"][:4]) if b["inception"]["value"][:4].isdigit() else None
            if y and (o.get("y") is None or y < o["y"]):
                o["y"] = y

    from topics.reads import label_points

    labels = label_points()
    out, no_place = [], []
    for q, g in groups.items():
        m = meta.get(q, {})
        city = None
        if "own" in m:
            (lon, lat), prec = m["own"], 1
        elif "hq" in m or "loc" in m or "adm" in m:
            (lon, lat), city = m.get("hq") or m.get("loc") or m.get("adm")
            prec = 2
        else:
            iso3 = from_alpha2(m.get("iso2"))
            if not iso3 or iso3 not in labels:
                no_place.append(q)
                continue
            lon, lat = labels[iso3]
            prec = 3
        out.append({"lon": lon, "lat": lat, "qid": q, "en": m.get("en", q), "g": g, "prec": prec, "y": m.get("y"),
                    "city": city, "iso3": from_alpha2(m.get("iso2")) if prec == 3 else None})
    located = [o for o in out if o["prec"] < 3]
    for o, c in zip(located, geoindex.countries_at([o["lon"] for o in located], [o["lat"] for o in located])):
        o["iso3"] = c or from_alpha2(meta[o["qid"]].get("iso2"))

    # 同一個座標的排成小圓
    by_spot: dict[tuple[float, float], list[dict]] = defaultdict(list)
    for o in located:
        by_spot[(round(o["lon"], 3), round(o["lat"], 3))].append(o)
    for spot, here in by_spot.items():
        if len(here) < 2:
            continue
        for i, o in enumerate(sorted(here, key=lambda o: o["qid"])):
            a = 2 * math.pi * i / len(here)
            o["lon"] = spot[0] + SPREAD * math.cos(a) / max(0.2, math.cos(math.radians(spot[1])))
            o["lat"] = spot[1] + SPREAD * math.sin(a)

    out.sort(key=lambda o: (o["g"], o["y"] or 9999, o["en"]))
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "units-all.json", points_file(out, FIELDS, SCALE, strings=("city",)))
    write_json(OUT / "units.json", points_file(located, FIELDS, SCALE, strings=("city",)))

    lic = "Wikidata（CC0）"
    no_value = {"TWN": "這條所有權鏈裡沒有台灣的單位；Wikidata 上只有一個不在鏈上、也沒有位置的 Disney Channel (Taiwan)"}
    no_value_en = {"TWN": "No unit in this ownership chain is in Taiwan; Wikidata has only Disney Channel (Taiwan), which is off the chain and has no location"}
    for key, keep in [("all", lambda o: True)] + [(GROUPS[i], (lambda i: lambda o: o["g"] == i + 1)(i)) for i in range(len(GROUPS))]:
        counts = Counter(o["iso3"] for o in out if o["iso3"] and keep(o))
        write_json(OUT / "units" / f"{key}.json", indicator_file(
            f"units-{key}", "個", [YEAR], {c: [n] for c, n in sorted(counts.items())}, noValue=no_value, noValueEn=no_value_en, license=lic))
    counts = Counter(o["iso3"] for o in out if o["iso3"])
    print(f"  迪士尼的單位：白名單 {len(groups)}，有位置 {len(out)}（自己的座標 {sum(o['prec'] == 1 for o in out)}、總部或所在地 "
          f"{sum(o['prec'] == 2 for o in out)}、只有國家 {sum(o['prec'] == 3 for o in out)}），沒有位置也沒有國家 {len(no_place)}；"
          f"{len(counts)} 國，前幾名 {counts.most_common(10)}；各組 {Counter(o['g'] for o in out)}")
