"""核廢料的最終處置場（2026-10-31，製作手冊第十批 166）：深層地質處置場與低中放處置場，依狀態上色。

- 列表：pipeline/data/nuclear-waste/sites.json，取自英文維基「Deep geological repository」的「Nuclear repository sites」表
  （revid 1381499099，CC BY-SA 4.0），狀態逐一對照條目內文、相關條目與官方消息（使用者決定，寫明日期），見那個檔的 about。
  輸出的檔含維基的內容，照 CC BY-SA 4.0。
- 座標：英文維基條目在 Wikidata 的座標（CC0，WDQS 查一次，存在 .cache/wikidata/）；表格沒寫地點的（中國、日本、南韓的
  高放處置場、瑞士、英國）沒有點，只在左邊的清單，點了移到那個國家（COUNTRY_BOXES）。
- 台灣沒有最終處置場（使用者決定寫在附註）：核安會「核能電廠用過核子燃料貯存數量」（data.gov.tw 119186）與
  「核能電廠低放射性廢棄物貯存現況」（119174），政府資料開放授權條款第 1 版，CSV 是 Big5。

輸出（public/data/topics/nuclear-waste/）：
- points.json：有地點的處置場（地圖上的點）；list.json：全部（左邊的清單，依狀態分組、組內依年份）；
- map.json：各國列入的處置場或計畫數（指標，國家不上色），台灣的附註與沒有值的原因。
"""
from __future__ import annotations

import csv
import io
import json
from pathlib import Path

from common import OUT_DIR, download, indicator_file, now_iso, points_file, write_json
from sources.wikidata_profiles import _rows, _sparql

OUT = OUT_DIR / "topics" / "nuclear-waste"
SITES = Path(__file__).resolve().parent.parent / "data" / "nuclear-waste" / "sites.json"
REVID = 1381499099
YEAR = 2026
WASTE = {"lilw": 1, "hlw": 2, "sf": 3, "tru": 4}
# 表格沒寫地點的國家：清單點了框住整個國家（西、南、東、北）
COUNTRY_BOXES = {
    "CHN": [73.5, 18.2, 134.8, 53.6], "JPN": [129.4, 30.9, 145.9, 45.6], "KOR": [125.0, 33.1, 129.6, 38.7],
    "CHE": [5.9, 45.8, 10.5, 47.8], "GBR": [-8.2, 49.9, 1.8, 58.7],
}
NUSC_SPENT = "https://www.nusc.gov.tw/dataopen/index.php?id=9"  # data.gov.tw 119186
NUSC_LLW = "https://www.nusc.gov.tw/dataopen/index.php?id=8"  # data.gov.tw 119174


def _coords(titles: list[str]) -> dict[str, tuple[float, float]]:
    values = " ".join(f'"{t}"@en' for t in sorted(set(titles)))
    query = f"""SELECT ?title ?coord WHERE {{
  VALUES ?title {{ {values} }}
  ?a schema:name ?title ; schema:isPartOf <https://en.wikipedia.org/> ; schema:about ?s .
  ?s wdt:P625 ?coord .
}}"""
    out: dict[str, tuple[float, float]] = {}
    for r in _rows(_sparql(query, f"nuclear-waste-{REVID}.json")):
        lon, lat = r["coord"]["value"].removeprefix("Point(").removesuffix(")").split()
        out.setdefault(r["title"]["value"], (float(lon), float(lat)))
    return out


def _big5_rows(url: str, name: str) -> list[list[str]]:
    raw = download(url, "nusc", name).read_bytes()
    return list(csv.reader(io.StringIO(raw.decode("big5", errors="replace"))))


def _int(text: str) -> int:
    text = (text or "").replace(",", "").strip()
    return int(text) if text.isdigit() else 0


def taiwan_note() -> tuple[str, str]:
    spent = _big5_rows(NUSC_SPENT, "spent-fuel-storage.csv")
    total = sum(_int(r[6]) for r in spent if len(r) > 6)
    as_of = next((c for r in spent for c in r if "統計至" in c), "").replace("統計至", "").strip()
    llw = _big5_rows(NUSC_LLW, "llw-storage.csv")
    drums = next(_int(r[-1]) for r in llw if r and r[0].replace(" ", "") == "合計")
    month = next((r[0].split("核能電廠")[0].strip() for r in llw if r and "貯存現況表" in r[0]), "")
    zh = (f"台灣沒有最終處置場。用過核子燃料放在核一、核二、核三廠的反應爐、燃料池與乾式貯存，共 {total:,} 束（核安會，統計至{as_of}）；"
          f"低放射性廢棄物在核電廠內貯存 {drums:,} 桶（{month}），另有一部分在蘭嶼貯存場。蘭嶼與核電廠都是貯存，不是最終處置。")
    en = (f"Taiwan has no final repository. Spent fuel is kept in the reactors, fuel pools and dry storage at the Jinshan, Kuosheng and Maanshan "
          f"plants, {total:,} assemblies in all (Nuclear Safety Commission, {as_of} in the ROC calendar); {drums:,} drums of low-level waste "
          "are stored at the plants, with more at the Lanyu storage site. Both are storage, not final disposal.")
    print(f"  台灣：用過核子燃料 {total:,} 束（{as_of}），核電廠內低放射性廢棄物 {drums:,} 桶（{month}）")
    return zh, en


def build() -> None:
    data = json.loads(SITES.read_text(encoding="utf-8"))
    sites = data["sites"]
    coords = _coords([s["wiki"] for s in sites if s["wiki"]])
    points, items = [], []
    for s in sites:
        c = coords.get(s["wiki"]) if s["wiki"] else None
        if s["wiki"] and not c:
            print(f"  {s['en']}（{s['wiki']}）在 Wikidata 沒有座標")
        row = {
            "lon": c[0] if c else None, "lat": c[1] if c else None, "st": s["status"], "w": WASTE[s["waste"]], "y": s["year"],
            "en": s["en"], "zh": s["zh"], "pe": s["place_en"], "pz": s["place_zh"], "ge": s["geology_en"], "gz": s["geology_zh"],
            "d": s["depth"], "se": s["status_en"], "sz": s["status_zh"], "iso3": s["iso3"], "ap": s["approx"],
            "box": ",".join(str(v) for v in COUNTRY_BOXES[s["iso3"]]) if not c else None,
        }
        items.append(row)
        if c:
            points.append(row)
    fields = ["lon", "lat", "st", "w", "y", "ap", "en", "zh", "pe", "pz", "ge", "gz", "d", "se", "sz", "iso3"]
    scale = {"lon": 0.0001, "lat": 0.0001, "st": 1, "w": 1, "y": 1, "ap": 1}
    strings = ("pe", "pz", "ge", "gz", "iso3")
    attribution = {
        "license": "CC BY-SA 4.0",
        "attribution": f"Wikipedia contributors, “Deep geological repository” (revision {REVID}), https://en.wikipedia.org/wiki/Deep_geological_repository; "
                       "statuses checked against linked articles and official sources (2026-10-31); coordinates from Wikidata (CC0)",
    }
    write_json(OUT / "points.json", {**points_file(points, fields, scale, strings=strings), **attribution})
    write_json(OUT / "list.json", {**points_file(items, fields + ["box"], scale, strings=strings), **attribution})

    counts: dict[str, int] = {}
    for s in sites:
        counts[s["iso3"]] = counts.get(s["iso3"], 0) + 1
    zh, en = taiwan_note()
    write_json(OUT / "map.json", indicator_file(
        "map", "處", [YEAR], {c: [n] for c, n in sorted(counts.items())},
        notes={"TWN": zh}, notesEn={"TWN": en},
        noValue={"TWN": "沒有最終處置場（見附註）"}, noValueEn={"TWN": "No final repository (see note)"}))
    by = {}
    for s in sites:
        by[s["status"]] = by.get(s["status"], 0) + 1
    print(f"  {len(sites)} 個處置場或計畫（地圖上 {len(points)} 個點），狀態：{dict(sorted(by.items()))}")
    write_json(OUT / "manifest.json", {"topic": "nuclear-waste", "generatedAt": now_iso()})
