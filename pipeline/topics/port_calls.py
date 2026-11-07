"""航運與港口的擴充：每個港口每天進出幾艘船、裝卸幾噸（2026-11-07，製作手冊第二十七批 579，候選 1297；步驟 port-calls，
輸出 topics/shipping/）。

- IMF PortWatch（跟咽喉同一個 ArcGIS 組織，sources/portwatch.py；IMF 條款：註明來源即可轉載改作，商業再利用要另外申請）：
  - `PortWatch_ports_database`：2,065 個港口（位置、一年的靠港船數依船種、前三大產業、占全國海運進出口的比例）。
  - `Daily_Ports_Data`：每個港口每天的靠港次數與進出口噸數（AIS 推算，2019 年起）。這張表支援 outStatistics，
    在伺服器端依港口、年加總（一頁 1,000 列，照 portid 排序分頁）；台灣的 10 個港另外依月加總。
- DESIGN.md 第 8 節記過 UNCTAD 的 PortCalls 因為「只有約 70 國、沒有台灣」沒有放；PortWatch 有 2,065 港、含台灣 10 港。
- 港口資料庫的 country 欄寫「Taiwan Province of China」，不輸出這一欄，國名一律用網站自己的國名（ISO3）。
- 今年（還沒過完）不算年加總。
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import date

from common import CACHE_DIR, OUT_DIR, indicator_file, points_file, write_json
from sources import portwatch as pw

OUT = OUT_DIR / "topics" / "shipping"
PORTS_URL = pw.BASE + "PortWatch_ports_database/FeatureServer/0/query"
DAILY_URL = pw.BASE + "Daily_Ports_Data/FeatureServer/0/query"
FIELDS = ("portcalls", "import", "export")
LAST_YEAR = date.today().year - 1


def _stats(where: str, group: str, name: str) -> list[dict]:
    path = CACHE_DIR / "portwatch" / f"{name}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    stats = [{"statisticType": "sum", "onStatisticField": f, "outStatisticFieldName": f} for f in FIELDS]
    rows, offset = [], 0
    while True:
        data = pw._query(DAILY_URL, {"where": where, "groupByFieldsForStatistics": group, "outStatistics": json.dumps(stats),
                                     "orderByFields": group, "resultOffset": offset, "resultRecordCount": 1000,
                                     "returnGeometry": "false"})
        feats = [f["attributes"] for f in data.get("features", [])]
        rows += feats
        if not data.get("exceededTransferLimit") or not feats:
            break
        offset += len(feats)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows), encoding="utf-8")
    return rows


def _ports() -> list[dict]:
    path = CACHE_DIR / "portwatch" / "ports-database.json"
    if not path.exists():
        rows, offset = [], 0
        while True:
            data = pw._query(PORTS_URL, {"where": "1=1", "outFields": "*", "returnGeometry": "false", "orderByFields": "ObjectId",
                                         "resultOffset": offset, "resultRecordCount": 1000})
            feats = [f["attributes"] for f in data.get("features", [])]
            rows += feats
            if not data.get("exceededTransferLimit") or not feats:
                break
            offset += len(feats)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(rows), encoding="utf-8")
    return json.loads(path.read_text(encoding="utf-8"))


def build() -> None:
    ports = _ports()
    by_id = {p["portid"]: p for p in ports}
    years = list(range(2019, LAST_YEAR + 1))
    annual: dict[str, dict[int, dict[str, float]]] = defaultdict(dict)
    for y in years:
        for r in _stats(f"year={y}", "portid", f"ports-annual-{y}"):
            annual[r["portid"]][y] = {f: r[f] or 0 for f in FIELDS}

    points = []
    for p in ports:
        a = annual.get(p["portid"], {})
        last = a.get(LAST_YEAR, {})
        points.append({
            "lon": round(p["lon"], 3), "lat": round(p["lat"], 3), "n": p["portname"], "iso3": p["ISO3"] or "",
            "v": p["vessel_count_total"] or 0, "vc": p["vessel_count_container"] or 0, "vd": p["vessel_count_dry_bulk"] or 0,
            "vg": p["vessel_count_general_cargo"] or 0, "vr": p["vessel_count_RoRo"] or 0, "vt": p["vessel_count_tanker"] or 0,
            "i1": p["industry_top1"] or "", "i2": p["industry_top2"] or "", "i3": p["industry_top3"] or "",
            "si": p["share_country_maritime_import"], "se": p["share_country_maritime_export"],
            "c": round(last.get("portcalls", 0)), "im": round(last.get("import", 0)), "ex": round(last.get("export", 0)),
        })
    write_json(OUT / "portwatch-ports.json", points_file(
        points, ["lon", "lat", "n", "iso3", "v", "vc", "vd", "vg", "vr", "vt", "i1", "i2", "i3", "si", "se", "c", "im", "ex"],
        {"lon": 0.001, "lat": 0.001, "v": 1, "vc": 1, "vd": 1, "vg": 1, "vr": 1, "vt": 1, "si": 0.01, "se": 0.01, "c": 1, "im": 1, "ex": 1},
        strings=["iso3", "i1", "i2", "i3"]))

    calls: dict[str, dict[int, float]] = defaultdict(dict)
    cargo: dict[str, dict[int, float]] = defaultdict(dict)
    for pid, by_year in annual.items():
        iso3 = by_id.get(pid, {}).get("ISO3")
        if not iso3:
            continue
        for y, v in by_year.items():
            calls[iso3][y] = calls[iso3].get(y, 0) + v["portcalls"]
            cargo[iso3][y] = cargo[iso3].get(y, 0) + (v["import"] + v["export"]) / 1e6
    write_json(OUT / "port-calls.json", indicator_file(
        "port-calls", "艘次", years, {c: [round(s[y]) if y in s else None for y in years] for c, s in sorted(calls.items())}, license="IMF"))
    write_json(OUT / "port-cargo.json", indicator_file(
        "port-cargo", "百萬公噸", years, {c: [round(s[y], 2) if y in s else None for y in years] for c, s in sorted(cargo.items())}, license="IMF"))

    # 台灣 10 港的月序列
    tw = defaultdict(dict)
    for y in range(2019, date.today().year + 1):
        for r in _stats(f"ISO3='TWN' AND year={y}", "portid,month", f"ports-tw-monthly-{y}"):
            tw[r["portid"]][f"{y}-{r['month']:02d}"] = [round(r["portcalls"]), round(r["import"]), round(r["export"])]
    months = sorted({m for s in tw.values() for m in s})
    write_json(OUT / "portwatch-tw.json", {
        "months": months,
        "ports": {by_id[pid]["portname"]: [s.get(m) for m in months] for pid, s in sorted(tw.items(), key=lambda kv: -(by_id[kv[0]]["vessel_count_total"] or 0))},
        "license": "IMF"})

    print(f"  港口 {len(ports):,}；{years[0]}–{years[-1]}；台灣：{[(p['portname'], p['vessel_count_total'], p['vessel_count_container'], p['share_country_maritime_import']) for p in ports if p['ISO3'] == 'TWN']}")
    top = sorted(((s.get(LAST_YEAR, 0), c) for c, s in calls.items()), reverse=True)[:10]
    print(f"  {LAST_YEAR} 靠港艘次：{[(c, round(v)) for v, c in top]}；TWN {round(calls['TWN'].get(LAST_YEAR, 0))}")
    top = sorted(((s.get(LAST_YEAR, 0), c) for c, s in cargo.items()), reverse=True)[:10]
    print(f"  {LAST_YEAR} 進出口百萬公噸：{[(c, round(v, 1)) for v, c in top]}；TWN {round(cargo['TWN'].get(LAST_YEAR, 0), 1)}")
    big = sorted(points, key=lambda p: -p["c"])[:8]
    print(f"  {LAST_YEAR} 靠港最多的港口：{[(p['n'], p['iso3'], p['c']) for p in big]}")
    print(f"  台灣月份 {months[0]}–{months[-1]}；高雄 2024-01：{tw.get('port524', {}).get('2024-01')}")
