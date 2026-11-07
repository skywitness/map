"""化石燃料的基礎建設（新主題，2026-11-07，製作手冊第二十七批 613，候選 1349、1351；步驟 fossil-infrastructure，
輸出 topics/fossil-infrastructure/）。使用者 2026-11-07 核准把「石油、天然氣與煤」拆成兩個主題：管線、LNG、油氣田、煤礦、
煉油廠這些「東西在哪裡」的圖層搬到這個主題，原主題留下產量、消費、貿易與價格。

- 煤礦（GEM Global Coal Mine Tracker，CC BY 4.0，`fossil_fuels.py` 已經快取的 gcmt 檔）：點圖層從這裡寫
  （原本 `fossil_fuels.coal_mines` 寫在 fossil-fuels/，改到這裡），多帶三個欄位：煤種（coal-grade：動力煤、冶金煤、兩者、
  化工用煤）、僱用人數（workforce，GEM 整理的、年份不一致，只當規模的參考）、所屬煤田（coal-field）。
  國家：運轉中煤礦的年產能合計（Mt）、僱用人數合計。
- LNG 接收站、油氣田：讀 `fossil_fuels.py` 已經輸出的 lng-operating.json、fields.json（點圖層照舊在 fossil-fuels/，
  前端用 `../fossil-fuels/` 讀），算國家合計：運轉中的 LNG 接收容量與出口容量（百萬公噸/年）、運轉中油氣田的產量（百萬桶油當量/年）。
- 燃煤機組的技術等級（GEM Global Integrated Power Tracker，發電廠地圖已經快取的 integrated_map_2026-09.csv）：
  運轉中燃煤機組裡超臨界、超超臨界與 IGCC（含加裝碳捕捉的）占已知技術容量的 %；技術不明（unknown）的不算進分母，
  已知技術的容量至少 1,000 MW 才算。側欄是各技術的 MW。
"""
from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, indicator_file, points_file, read_points_file, write_json
from sources.countries import from_name
from topics import fossil_fuels as ff

OUT = OUT_DIR / "topics" / "fossil-infrastructure"
FF = OUT_DIR / "topics" / "fossil-fuels"
YEAR = 2026
GRADES = {"Thermal": 1, "Met": 2, "Thermal & Met": 3, "Chemical": 4}
TECH = ["subcritical", "supercritical", "ultra-supercritical", "IGCC", "unknown"]
EFFICIENT = {"supercritical", "ultra-supercritical", "IGCC"}
MIN_MW = 1000
LICENSE = "CC BY 4.0"


def _mines() -> dict[str, list[dict]]:
    layers: dict[int, list[dict]] = defaultdict(list)
    mojibake = [0]
    for f in ff.gem_load("gcmt"):
        p = f["properties"]
        if p["tracker-acro"] != "GCMT":
            continue
        status = ff.MINE_STATUS.get(p["status"].strip().lower())
        lon, lat = ff._number(p["Longitude"]), ff._number(p["Latitude"])
        if status is None or lon is None or lat is None or p["location-accuracy"].strip() == "country-level only":
            continue
        cap, prod, workers = ff._number(p["capacity"]), ff._number(p["prod-coal"]), ff._number(p.get("workforce", ""))
        field = ff.fix_text(p.get("coal-field", "") or "", mojibake).strip()
        layers[status].append({
            "lon": lon, "lat": lat, "name": ff.fix_text(p["name"], mojibake), "iso3": ff.gem_iso(p["country-area1"], p["name"]),
            "st": status, "cap": round(cap, 2) if cap else None, "prod": round(prod, 2) if prod else None,
            "py": ff._year(p["prod-year-coal"]) if prod else None, "type": {"Surface": 1, "Underground": 2}.get(p["mine-type"].strip()),
            "start": ff._year(p["start-year"]), "grade": GRADES.get((p.get("coal-grade") or "").strip()),
            "work": int(workers) if workers else None, "field": field if field and field != "-" else None,
        })
    fields = ["lon", "lat", "name", "iso3", "st", "cap", "prod", "py", "type", "start", "grade", "work", "field"]
    scale = {"lon": 0.01, "lat": 0.01, "st": 1, "cap": 0.01, "prod": 0.01, "py": 1, "type": 1, "start": 1, "grade": 1, "work": 1}
    order = lambda r: -(r["cap"] or r["prod"] or 0)  # noqa: E731
    from common import write_points
    write_points(OUT / "mines-operating.json", points_file(sorted(layers[1], key=order), fields, scale), text=("name", "field"))
    write_points(OUT / "mines-proposed.json", points_file(sorted(layers[2], key=order), fields, scale), text=("name", "field"))
    write_points(OUT / "mines-closed.json", points_file(sorted(layers.get(3, []) + layers.get(4, []), key=order), fields, scale), text=("name", "field"))
    op = layers[1]
    g = Counter(r["grade"] for r in op)
    print(f"  煤礦：運轉中 {len(op)}；煤種 {dict(g)}；有僱用人數的 {sum(1 for r in op if r['work'])} 座、合計 {sum(r['work'] or 0 for r in op):,} 人")
    by: dict[str, list[dict]] = defaultdict(list)
    for r in op:
        by[r["iso3"]].append(r)
    return by


def _iso(name: str) -> str | None:
    try:
        return ff.gem_iso(name, "GIPT")
    except RuntimeError:
        return from_name(name)


def _coal_tech() -> tuple[dict[str, float], dict[str, list[float]]]:
    mw: dict[str, Counter] = defaultdict(Counter)
    with open(CACHE_DIR / "gem" / "integrated_map_2026-09.csv", encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["asset-type"] != "coal" or r["status"] != "operating":
                continue
            c = _iso(r["country-area1"].strip())
            cap = ff._number(r["capacity"])
            if c and cap:
                mw[c][r["tech-type"].split("/")[0]] += cap
    share, detail = {}, {}
    for c, t in mw.items():
        known = sum(v for k, v in t.items() if k != "unknown")
        detail[c] = [round(t.get(k, 0)) for k in TECH]
        if known >= MIN_MW:
            share[c] = round(sum(t.get(k, 0) for k in EFFICIENT) / known * 100, 3)
    return share, detail


def build() -> None:
    mines = _mines()
    lng = read_points_file(json.loads((FF / "lng-operating.json").read_text(encoding="utf-8")))
    fields = read_points_file(json.loads((FF / "fields.json").read_text(encoding="utf-8")))
    lng_import, lng_export = defaultdict(float), defaultdict(float)
    for t in lng:
        (lng_import if t["kind"] == 1 else lng_export)[t["iso3"]] += t["op"] or 0
    field_out = defaultdict(float)
    for r in fields:
        if r["st"] == 1 and r["prod"]:
            field_out[r["iso3"]] += r["prod"]
    tech, tech_detail = _coal_tech()

    def one(name: str, unit: str, values: dict[str, float], digits: int = 2) -> None:
        write_json(OUT / f"{name}.json", indicator_file(name, unit, [YEAR], {c: [round(v, digits)] for c, v in sorted(values.items()) if c and v is not None and (v or name == 'coal-plant-tech')}, license=LICENSE))

    cap = {c: sum(r["cap"] or 0 for r in rs) for c, rs in mines.items()}
    work = {c: sum(r["work"] or 0 for r in rs) for c, rs in mines.items()}
    one("coal-mine-capacity", "百萬公噸/年", cap)
    one("coal-mine-workforce", "人", work, 0)
    one("lng-import", "百萬公噸/年", lng_import)
    one("lng-export", "百萬公噸/年", lng_export)
    one("field-output", "百萬桶油當量/年", field_out)
    one("coal-plant-tech", "%", tech, 3)
    detail = {c: {"tech": d} for c, d in tech_detail.items()}
    for c, rs in mines.items():
        g = Counter()
        for r in rs:
            g[r["grade"] or 0] += r["cap"] or 0
        detail.setdefault(c, {})["grades"] = [round(g.get(k, 0), 2) for k in (1, 2, 3, 4, 0)]
        detail[c]["mines"] = len(rs)
    write_json(OUT / "detail.json", {"tech": TECH, "countries": detail})
    for label, d, fmt in (("煤礦產能", cap, "{:,.0f}"), ("僱用人數", work, "{:,.0f}"), ("LNG 接收", lng_import, "{:,.1f}"),
                          ("LNG 出口", lng_export, "{:,.1f}"), ("油氣田產量", field_out, "{:,.0f}"), ("高效率燃煤 %", tech, "{:.1f}")):
        r = sorted(((c, v) for c, v in d.items() if c and v), key=lambda x: -x[1])
        print(f"  {label}（{len(r)} 國）：" + "、".join(f"{c} {fmt.format(v)}" for c, v in r[:10]) + (f"；台灣 {fmt.format(d['TWN'])}" if d.get("TWN") else ""))
    r = sorted(tech.items(), key=lambda x: x[1])
    print("  高效率燃煤最低：" + "、".join(f"{c} {v:.1f}" for c, v in r[:8]))
    print(f"  台灣燃煤技術 MW：{dict(zip(TECH, tech_detail.get('TWN', [])))}")
