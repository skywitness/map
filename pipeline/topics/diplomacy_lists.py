"""台灣的外交的左側欄（第十二批順序 202，L14，2026-10-31）：

- allies-list.json：每一段邦交（sources/allies.py 的 HISTORY，建交或復交到斷交），一段一筆：國家 iso3、建交年份 y0
  與日期 d0（1949 年底以前就有邦交的是 null）、斷交年份 y1 與日期 d1（現在的邦交國是 null）；點與範圍是那一國
  主要的那一塊國土（1:10m 國界最大的多邊形，加上離它 20° 以內的其他多邊形，群島國家才框得到整串島），
  清單點了框住那一國（bw、bs、be、bn）。
- missions-list.json：駐外館處（missions.json）加上洲別 rg（regions.json，Natural Earth 的洲），清單依洲分組。
"""
from __future__ import annotations

import json

from common import OUT_DIR, points_file, write_json
from geoindex import _countries
from sources import allies

OUT = OUT_DIR / "topics" / "taiwan-diplomacy"
NEAR_DEG = 20


def _area(ring) -> float:
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]))) / 2


def _centre(ring) -> tuple[float, float]:
    xs = [x for x, _ in ring]
    ys = [y for _, y in ring]
    return (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2


def country_boxes() -> dict[str, tuple[float, float, float, float]]:
    """iso3 → 主要國土的範圍 (西, 南, 東, 北)"""
    out = {}
    for iso3, polygons in _countries():
        outers = [p[0] for p in polygons if p and len(p[0]) >= 3]
        if not outers:
            continue
        main = max(outers, key=_area)
        cx, cy = _centre(main)
        keep = [r for r in outers if abs(_centre(r)[0] - cx) <= NEAR_DEG and abs(_centre(r)[1] - cy) <= NEAR_DEG]
        xs = [x for r in keep for x, _ in r]
        ys = [y for r in keep for _, y in r]
        out[iso3] = (min(xs), min(ys), max(xs), max(ys))
    return out


def build() -> None:
    boxes = country_boxes()
    rows = []
    for iso3, spans in allies.HISTORY.items():
        box = boxes.get(iso3)
        if not box:
            print(f"  {iso3} 沒有國界，不列")
            continue
        w, s, e, n = box
        for d0, d1 in spans:
            rows.append({"iso3": iso3, "y0": int(d0[:4]) if d0 else None, "d0": d0, "y1": int(d1[:4]) if d1 else None, "d1": d1,
                         "lon": round((w + e) / 2, 2), "lat": round((s + n) / 2, 2),
                         "bw": round(w, 2), "bs": round(s, 2), "be": round(e, 2), "bn": round(n, 2)})
    rows.sort(key=lambda r: (r["y0"] or 0, r["d0"] or "", r["iso3"]))
    write_json(OUT / "allies-list.json", points_file(
        rows, ["lon", "lat", "iso3", "y0", "d0", "y1", "d1", "bw", "bs", "be", "bn"],
        {"lon": 0.01, "lat": 0.01, "y0": 1, "y1": 1, "bw": 0.01, "bs": 0.01, "be": 0.01, "bn": 0.01}, strings=("iso3",)))

    regions = json.loads((OUT_DIR / "regions.json").read_text(encoding="utf-8"))
    missions = json.loads((OUT / "missions.json").read_text(encoding="utf-8"))
    fields = missions["fields"]
    cols = missions["columns"]
    i = fields.index("iso3")
    table = missions.get("strings", {}).get("table")
    codes = [table[v] if table and isinstance(v, int) else v for v in cols[i]]
    missions["fields"] = fields + ["rg"]
    missions["columns"] = cols + [[regions.get(c) if isinstance(c, str) else None for c in codes]]
    write_json(OUT / "missions-list.json", missions)
    now = sum(1 for r in rows if r["y1"] is None)
    print(f"  邦交 {len(rows)} 段（{len({r['iso3'] for r in rows})} 國，現在 {now} 國）；館處 {len(codes)} 個")


if __name__ == "__main__":
    build()
