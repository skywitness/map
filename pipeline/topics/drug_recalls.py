"""藥品支出與取得：被美國 FDA 回收的藥品，依回收廠商所在國（2026-11-04，製作手冊第二十批 308）。

- 資料：openFDA drug/enforcement 的整批檔（`download.open.fda.gov/drug/enforcement/drug-enforcement-0001-of-0001.json.zip`，
  約 3.8 MB，2012 年起的回收紀錄；CC0 1.0）。一次回收會依產品與批號拆成好幾筆，用 `event_id` 去重算「回收事件」。
- 地圖：回收廠商所在國（`country`）的回收事件數（比例圓），2012 年起累計，加上一級回收（最嚴重）的件數寫在 tooltip。
  這是美國 FDA 的紀錄，九成以上的廠商在美國；畫的是「有幾家該國廠商的產品被美國 FDA 回收」，不是各國的藥品品質。
- 台灣：附註另寫食藥署「藥品回收」開放資料（data.fda.gov.tw 資料集 6947，政府資料開放授權條款）的件數，
  並用許可證字號對「未註銷藥品許可證」（9123）的製造廠國別，看國產與輸入各幾件。
"""
from __future__ import annotations

import csv
import io
import json
import zipfile
from collections import Counter, defaultdict

from common import OUT_DIR, download, indicator_file, write_manifest_part, write_json
from sources import countries

OUT = OUT_DIR / "topics" / "medicines"
URL = "https://download.open.fda.gov/drug/enforcement/drug-enforcement-0001-of-0001.json.zip"
TW_RECALLS = "https://data.fda.gov.tw/data/opendata/export/34/csv"
TW_LICENCES = "https://data.fda.gov.tw/data/opendata/export/37/csv"
FIRST_YEAR = 2012  # openFDA 的回收紀錄從 2012 年起才完整（2006–2011 年只有 27 件）
NAMES = {"Korea (the Republic of)": "KOR", "Dominican Republic (the)": "DOM", "Turkey": "TUR", "Taiwan": "TWN",
         "Vietnam": "VNM", "United Kingdom": "GBR"}


def _taiwan() -> tuple[int, int, int, Counter, str, str]:
    """食藥署的藥品回收：(總件數, 國產, 輸入, 輸入的製造廠國別, 最早日期, 最晚日期)"""
    rec = list(csv.DictReader(io.StringIO(download(TW_RECALLS, "fda-tw", "drug-recalls-6947.csv").read_bytes().decode("utf-8-sig"))))
    with zipfile.ZipFile(download(TW_LICENCES, "fda-tw", "licences-37.csv")) as z:
        name = next(n for n in z.namelist() if n.endswith(".csv"))
        lic = list(csv.DictReader(io.StringIO(z.read(name).decode("utf-8-sig"))))
    origin = {r["許可證字號"].strip(): r["製造廠國別"].strip() for r in lic}
    domestic = imported = 0
    foreign: Counter = Counter()
    for r in rec:
        key = r["許可證字號"].strip()
        code = origin.get(key)
        if code == "TW" or (code is None and "製" in key):
            domestic += 1
        elif code or "輸" in key:
            imported += 1
            if code:
                foreign[code] += 1
    dates = sorted(r["日期"].strip() for r in rec if r["日期"].strip())
    return len(rec), domestic, imported, foreign, dates[0], dates[-1]


def build() -> None:
    with zipfile.ZipFile(download(URL, "openfda", "drug-enforcement.json.zip")) as z:
        data = json.loads(z.read(z.namelist()[0]))
    updated = data["meta"]["last_updated"]
    events: dict[str, dict] = {}
    for r in data["results"]:
        if r.get("recall_initiation_date", "")[:4] >= str(FIRST_YEAR):
            events.setdefault(r["event_id"], r)
    counts: Counter = Counter()
    class1: Counter = Counter()
    unknown = []
    for r in events.values():
        name = r.get("country", "").strip()
        if not name:
            continue
        iso3 = NAMES.get(name) or countries.from_name(name)
        if not iso3:
            unknown.append(name)
            continue
        counts[iso3] += 1
        if r.get("classification") == "Class I":
            class1[iso3] += 1
    if unknown:
        raise RuntimeError(f"openFDA 的國名對不到 ISO3：{sorted(set(unknown))}")
    last_year = int(updated[:4])
    hints = {c: f"一級回收（最嚴重）{class1[c]} 件" for c in counts if class1[c]}
    hints_en = {c: f"Class I (most serious): {class1[c]}" for c in counts if class1[c]}
    total, domestic, imported, foreign, first, last = _taiwan()
    notes = {"TWN": (
        f"美國 FDA {FIRST_YEAR} 年起回收台灣廠商的藥品 {counts.get('TWN', 0)} 次。台灣自己的紀錄：食藥署公告的藥品回收"
        f"（{first[:4]}–{last[:4]} 年）共 {total:,} 件，國產 {domestic:,} 件、輸入 {imported} 件。")}
    notes_en = {"TWN": (
        f"The US FDA has recalled Taiwanese firms’ drugs {counts.get('TWN', 0)} times since {FIRST_YEAR}. Taiwan’s own record: the "
        f"Food and Drug Administration announced {total:,} drug recalls in {first[:4]}–{last[:4]}, {domestic:,} domestic and {imported} imported.")}
    write_json(OUT / "fda-recalls.json", indicator_file(
        "fda-recalls", "次", [last_year], {c: [n] for c, n in sorted(counts.items())},
        hints=hints, hintsEn=hints_en, notes=notes, notesEn=notes_en))
    write_manifest_part(OUT, "medicines", "fda-recalls", {
        "source": "openFDA drug/enforcement (CC0 1.0); Taiwan FDA drug recalls (data.gov.tw 6947) and drug licences (9123)",
        "openfdaUpdated": updated,
    })
    print(f"  美國 FDA 的藥品回收：{len(events):,} 次（{FIRST_YEAR} 年起，{len(data['results']):,} 筆），{len(counts)} 國；"
          f"{counts.most_common(8)}；一級 {sum(class1.values())} 次；資料更新 {updated}")
    print(f"  台灣食藥署：{total} 件（{first}–{last}），國產 {domestic}、輸入 {imported}；輸入的製造廠國別 {foreign.most_common(8)}")
