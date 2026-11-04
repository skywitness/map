"""旅行實用：各國的緊急電話號碼（2026-11-04，製作手冊第二十批 304）。

資料是英文維基百科「List of emergency telephone numbers」的固定版本（`sources/emergency_numbers.py`，CC BY-SA 4.0），
衍生的三個資料檔（`emergency-ambulance.json`、`emergency-police.json`、`emergency-fire.json`）依 CC BY-SA 4.0 分享。
- 地圖：救護、警察、消防各一個類別指標，依每格的第一個號碼歸類（112、911、999 加上各服務常見的號碼，其餘是「其他」）。
- tooltip 第三行（hints）寫三個號碼；一格有好幾個號碼的寫「999／112」。側欄（details.json 的 `sos`）列三個號碼。
- `topics/travel.py` 的 build() 也會呼叫 `write()`；單獨更新緊急電話時跑 `travel-emergency`，
  讀現有的 details.json 補上 `sos`（不必重抓 travel 的其他來源；Wikipedia 的 API 從 cloud 常回 429）。
"""
from __future__ import annotations

import json

from common import OUT_DIR, indicator_file, write_json
from sources import emergency_numbers

OUT = OUT_DIR / "topics" / "travel"
YEAR = 2026
# 各服務的類別（src/topics/travel.ts 的 EMERGENCY_*）：號碼 → 代碼；其他號碼是 OTHER
CATEGORIES = {
    "ambulance": {"112": 1, "911": 2, "999": 3, "119": 4},
    "police": {"112": 1, "911": 2, "999": 3, "110": 4, "117": 5, "17": 6},
    "fire": {"112": 1, "911": 2, "999": 3, "119": 4, "118": 5, "18": 6},
}
OTHER = 9
LABEL = {"police": ("警察", "Police"), "ambulance": ("救護", "Ambulance"), "fire": ("消防", "Fire")}
# 台灣的附註：維基百科「Other numbers」欄（「112 on mobile phones – after call is connected 0 redirects 110 and 9
# redirects 119; Domestic violence – 113; Coast guard – 118」）的翻譯
TAIWAN_NOTE = (
    "手機可以撥 112，接通後按 0 轉 110、按 9 轉 119；家暴防治 113、海巡 118（英文維基百科）。",
    "Mobile phones can dial 112, then press 0 for 110 or 9 for 119; domestic violence 113, coast guard 118 (Wikipedia).",
)


def _fmt(raw: str) -> str:
    """格子裡的號碼寫成「999／112」（最多三個）"""
    return "／".join(emergency_numbers.numbers(raw)[:3])


def write(map_ids: set[str], details: dict[str, dict]) -> None:
    table = {k: v for k, v in emergency_numbers.table().items() if k in map_ids or k in ("TUV", "TKL", "GIB")}
    hints, hints_en = {}, {}
    for iso3, row in table.items():
        parts = [_fmt(r) for r in row["raw"]]
        if not any(parts):
            continue
        if parts[0] and parts[0] == parts[1] == parts[2]:
            hints[iso3] = f"警察、救護、消防都是 {parts[0]}"
            hints_en[iso3] = f"Police, ambulance and fire: {parts[0].replace('／', ' / ')}"
        else:
            hints[iso3] = " · ".join(f"{LABEL[s][0]} {p}" for s, p in zip(emergency_numbers.SERVICES, parts) if p)
            hints_en[iso3] = " · ".join(f"{LABEL[s][1]} {p.replace('／', ' / ')}" for s, p in zip(emergency_numbers.SERVICES, parts) if p)
        details.setdefault(iso3, {})["sos"] = [emergency_numbers.numbers(r)[:3] for r in row["raw"]]
    notes = {"TWN": TAIWAN_NOTE[0]}
    notes_en = {"TWN": TAIWAN_NOTE[1]}
    for svc, cats in CATEGORIES.items():
        values = {}
        for iso3, row in table.items():
            first = row[svc]
            if first is None:
                continue
            values[iso3] = [cats.get(first, OTHER)]
        write_json(OUT / f"emergency-{svc}.json", indicator_file(
            f"emergency-{svc}", "", [YEAR], dict(sorted(values.items())), hints=hints, hintsEn=hints_en,
            notes=notes, notesEn=notes_en))
        counts: dict[int, int] = {}
        for v in values.values():
            counts[v[0]] = counts.get(v[0], 0) + 1
        print(f"  緊急電話 {svc}：{len(values)} 國，{dict(sorted(counts.items()))}")
    tw = table["TWN"]
    if (tw["police"], tw["ambulance"], tw["fire"]) != ("110", "119", "119"):
        raise RuntimeError(f"台灣的緊急電話跟預期（110、119、119）不同：{tw}")


def build() -> None:
    with open(OUT_DIR / "geo" / "countries-50m.json", encoding="utf-8") as f:
        map_ids = {g["id"] for g in json.load(f)["objects"]["countries"]["geometries"]}
    path = OUT / "details.json"
    with open(path, encoding="utf-8") as f:
        details = json.load(f)
    write(map_ids, details)
    write_json(path, details)
