"""樂園之外的環球：CityWalk、奧蘭多的直營飯店、Universal Horror Unleashed、曾經是環球的與取消的樂園、IP 主題園區
（2026-11-08，製作手冊第二十八批 683，候選 1527、1528、1529、1530、1537；擴充「環球影城」；步驟 universal-other，輸出
topics/universal/）。

- 白名單 `pipeline/data/universal/other.csv`（每列寫出處的英文維基固定版本或 Wikidata）：
  - CityWalk 4 處（Wikidata 的座標；新加坡沒有）。
  - 奧蘭多的直營飯店 11 家、合計 11,000 間房：英文維基「Universal Orlando」revid 1384195678 的飯店表（開幕日與房間數）；座標用
    Wikidata（Universal Orlando 的 P527，7 筆；兩家 Endless Summer 在 Wikidata 是同一筆，座標相同），沒有 Wikidata 項目的
    Stella Nova、Terra Luna、Helios Grand 用 OpenStreetMap 那一家的 way 中心（CSV 寫明 way 編號）。**不用名稱比對**（OSM 名稱
    含 Universal 的旅館大多是別家的）。其他度假區沒有直營飯店。
  - Universal Horror Unleashed：拉斯維加斯（2025-08-14）與芝加哥（在建）；Wikidata 沒有座標，用英文維基 revid 1376754925 的
    infobox 座標。
  - 曾經是環球的 PortAventura（1998–2004 年持股，現在不是環球的）與取消的杜拜計畫：Wikidata 的座標，說明照英文維基。
  - IP 主題園區（哈利波特 6 處、超級任天堂 3 處）：只進清單、不另外畫點（手冊：Wikidata 的座標大多沒有，超級任天堂三處共用
    一個 QID）；開幕日依各自條目的固定版本；IP 名稱只當事實指稱，不放圖、不寫劇情。
"""
from __future__ import annotations

import csv
from collections import Counter

import geoindex
from common import OUT_DIR, ROOT, load_points_json, points_file, read_points_file, write_json
from sources import qlever_wikidata as wd

OUT = OUT_DIR / "topics" / "universal"
CSV = ROOT / "pipeline" / "data" / "universal" / "other.csv"
KINDS = ["citywalk", "hotel", "horror", "former", "cancelled", "ip"]  # 前端 universal.ts 的 OTHER_KINDS（代碼是索引 + 1）
STATUS = {"open": 1, "planned": 2, "former": 3, "cancelled": 4}
RESORTS = ["hollywood", "orlando", "japan", "singapore", "beijing", "frisco", "uk"]
FIELDS = ["lon", "lat", "key", "en", "zh", "iso3", "k", "resort", "status", "d", "rooms", "qid", "host", "src", "note"]
SCALE = {"lon": 0.0001, "lat": 0.0001, "k": 1, "resort": 1, "status": 1, "d": 1, "rooms": 1}


def build() -> None:
    with open(CSV, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    qids = sorted({r["qid"] for r in rows if r["qid"]})
    found = wd.cached("universal-other-coords", """SELECT ?item ?coord WHERE { VALUES ?item { %s } ?item wdt:P625 ?coord }"""
                      % " ".join(f"wd:{q}" for q in qids))
    coords: dict[str, tuple[float, float]] = {}
    for b in found:
        q = b["item"]["value"].rsplit("/", 1)[1]
        if q not in coords:
            lon, lat = b["coord"]["value"].split("(", 1)[1].rstrip(")").split()
            coords[q] = (float(lon), float(lat))
    parks = {p["qid"]: p for p in read_points_file(load_points_json(OUT / "places.json"))}
    out = []
    for r in rows:
        if r["kind"] not in KINDS or r["status"] not in STATUS:
            raise ValueError(f"other.csv 的 {r['key']} 欄位不對")
        if r["lon"]:
            lon, lat = float(r["lon"]), float(r["lat"])
        elif r["host"]:
            lon, lat = float(parks[r["host"]]["lon"]), float(parks[r["host"]]["lat"])
        elif r["qid"] in coords:
            lon, lat = coords[r["qid"]]
        else:
            raise ValueError(f"{r['key']} 沒有座標")
        d = r["opened"].replace("-", "")
        out.append({
            "lon": lon, "lat": lat, "key": r["key"], "en": r["name_en"], "zh": r["name_zh"] or None,
            "k": KINDS.index(r["kind"]) + 1, "resort": RESORTS.index(r["resort"]) + 1 if r["resort"] else None,
            "status": STATUS[r["status"]], "d": int(d) if d else None, "rooms": int(r["rooms"]) if r["rooms"] else None,
            "qid": r["qid"] or None, "host": r["host"] or None, "src": r["source"], "note": r["note"] or None,
        })
    for o, c in zip(out, geoindex.countries_at([o["lon"] for o in out], [o["lat"] for o in out])):
        o["iso3"] = c
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "other-all.json", points_file(out, FIELDS, SCALE, strings=("src",)))
    mapped = [o for o in out if o["k"] != KINDS.index("ip") + 1]
    write_json(OUT / "other.json", points_file([o for o in mapped if o["status"] in (1, 3)], FIELDS, SCALE, strings=("src",)))
    write_json(OUT / "other-planned.json", points_file([o for o in mapped if o["status"] in (2, 4)], FIELDS, SCALE, strings=("src",)))
    hotels = [o for o in out if o["k"] == 2]
    print(f"  樂園之外的環球：{len(out)} 筆 {dict(Counter(KINDS[o['k'] - 1] for o in out))}；飯店 {len(hotels)} 家、"
          f"{sum(o['rooms'] for o in hotels):,} 間房；國家 {dict(Counter(o['iso3'] for o in out))}")
