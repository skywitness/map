"""高壓直流輸電（HVDC）與跨國電力聯網（新主題，2026-11-07，製作手冊第二十七批 609，候選 1338；步驟 hvdc，輸出 topics/hvdc/）。

- 英文維基「List of HVDC projects」固定版本 1378703816（CC BY-SA 4.0，只用名稱、端點、長度、電壓、功率、年份這些事實；
  robots.txt 不准 Special:Export，所以讀 `/wiki/…?oldid=` 的 HTML）。7 個表：非洲、大洋洲、亞洲、歐洲、北美、南美
  （兩個換流站，畫成線）與背對背式（只有一個換流站，畫成點）。ENTSO-E 要 token，照手冊不用。
- 換流站的座標用表格裡的 {{coord}}（geo 微格式）；**兩端都有座標的才畫線**（點對點 222 列裡 127 列，歐洲 117 列只有 53 列），
  國家的合計用全部的列（國家從換流站欄「國家 - 站名」的前半段認）。
- 只算 2026 年以前啟用的（年份欄第一個四位數）；2027 年以後的是規劃或興建中，只算數量寫在說明；備註寫停用、拆除的不算。
- 指標：這一國 HVDC 的輸送功率合計（MW，跨國線兩端的國家都算一次），依啟用年份累計（時間軸）。
"""
from __future__ import annotations

import html
import re
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, lines_file, points_file, write_json
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "hvdc"
URL = "https://en.wikipedia.org/wiki/List_of_HVDC_projects?oldid=1378703816"
REGIONS = ["africa", "oceania", "asia", "europe", "north-america", "south-america", "back-to-back"]
LAST = 2026
FIRST = 1950
PLACE_FIX = {"Madurai": "IND", "Anurathapura": "LKA", "Paradip": "IND", "Port Blair": "IND", "Åland": "FIN",
             "Belfast": "GBR", "Ayrshire": "GBR", "Northern Ireland": "GBR", "Scotland": "GBR"}
DEAD = re.compile(r"decommission|dismantl|shut ?down|out of service|abandon|replaced by", re.I)


def _text(c: str) -> str:
    c = re.sub(r"<style.*?</style>", "", c, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub("<[^>]+>", " ", c))).replace("﻿", "").strip()


def _geo(c: str) -> tuple[float, float] | None:
    m = re.search(r'<span class="geo"[^>]*>([-\d.]+);\s*([-\d.]+)</span>', c)
    return (float(m.group(2)), float(m.group(1))) if m else None


def _country(cell: str) -> str | None:
    s = re.sub(r"\d+°.*", "", _text(cell)).strip()
    head = re.split(r"\s*[-–,]\s*", s, maxsplit=1)[0].strip()
    return PLACE_FIX.get(head) or from_name(head)


def _num(s: str) -> float | None:
    m = re.search(r"[\d,]+(\.\d+)?", s.replace("±", ""))
    return float(m.group(0).replace(",", "")) if m else None


def build() -> None:
    s = download(URL, "wikipedia", "list_of_hvdc_projects_1378703816.html").read_text(encoding="utf-8")
    tables = re.findall(r'<table class="wikitable.*?</table>', s, re.S)
    assert len(tables) == 7, len(tables)
    projects = []
    for ti, t in enumerate(tables):
        b2b = REGIONS[ti] == "back-to-back"
        for r in t.split("</tr>")[1:]:
            cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, re.S)
            if len(cells) < 6:
                continue
            if b2b:
                name, ends, kv, mw, year, typ, remarks = cells[0], [cells[1]], cells[2], cells[3], cells[4], cells[5], cells[6] if len(cells) > 6 else ""
            else:
                name, ends, kv, mw, year, typ, remarks = cells[0], cells[1:3], cells[4], cells[5], cells[6], cells[7], cells[8] if len(cells) > 8 else ""
            ys = re.findall(r"(18\d\d|19\d\d|20\d\d)", _text(year))
            projects.append({
                "name": _text(name), "region": REGIONS[ti], "b2b": b2b,
                "ends": [(_country(e), _geo(e), re.sub(r"\d+°.*", "", _text(e)).strip()) for e in ends],
                "kv": _num(_text(kv)), "mw": _num(_text(mw)), "year": int(ys[0]) if ys else None,
                "len": _num(_text(cells[3])) if not b2b else None, "type": _text(typ), "dead": bool(DEAD.search(_text(remarks))),
            })
    live = [p for p in projects if p["year"] and p["year"] <= LAST and not p["dead"]]
    planned = [p for p in projects if p["year"] and p["year"] > LAST]
    print(f"  {len(projects)} 列：啟用到 {LAST} 年 {len(live)}、規劃或興建中 {len(planned)}、停用 {sum(p['dead'] for p in projects)}、沒有年份 {sum(1 for p in projects if not p['year'])}")
    missing = sorted({e[2] for p in live for e in p["ends"] if not e[0]})
    if missing:
        print(f"  換流站認不出國家：{missing}")

    years = list(range(FIRST, LAST + 1))
    mw: dict[str, list[float]] = defaultdict(lambda: [0.0] * len(years))
    for p in live:
        if not p["mw"]:
            continue
        for c in {e[0] for e in p["ends"] if e[0]}:
            for i, y in enumerate(years):
                if y >= max(p["year"], FIRST):
                    mw[c][i] += p["mw"]
    write_json(OUT / "capacity.json", indicator_file("hvdc-capacity", "MW", years, {c: [v or None for v in s] for c, s in sorted(mw.items())},
                                                    license="CC BY-SA 4.0"))
    rank = sorted(((c, s[-1]) for c, s in mw.items()), key=lambda x: -x[1])
    print("  輸送功率合計：" + "、".join(f"{c} {v:,.0f}" for c, v in rank[:12]))

    lines, records, b2b_pts = [], [], []
    for p in live:
        coords = [e[1] for e in p["ends"]]
        rec = {"name": p["name"], "mw": p["mw"], "kv": p["kv"], "year": p["year"], "len": p["len"],
               "c1": p["ends"][0][0] or "", "c2": p["ends"][-1][0] or "",
               "cls": 3 if (p["kv"] or 0) >= 800 else 2 if (p["kv"] or 0) >= 500 else 1}
        if p["b2b"]:
            if coords[0]:
                b2b_pts.append({"lon": coords[0][0], "lat": coords[0][1], **rec})
        elif all(coords):
            (x1, y1), (x2, y2) = coords
            if abs(x2 - x1) > 180:
                x2 += 360 if x1 > x2 else -360
            lines.append([(x1, y1), (x2, y2)])
            records.append(rec)
    data = lines_file(lines, quantum=0.01, types=[r["cls"] for r in records], records=records,
                      record_fields=["name", "mw", "kv", "year", "len", "c1", "c2"], record_scale={"mw": 1, "kv": 1, "year": 1, "len": 1})
    write_json(OUT / "lines.json", {**data, "license": "CC BY-SA 4.0"})
    b2b_pts.sort(key=lambda r: r["lon"])
    write_json(OUT / "back-to-back.json", points_file(
        b2b_pts, ["lon", "lat", "name", "mw", "kv", "year", "c1"], {"lon": 0.01, "lat": 0.01, "mw": 1, "kv": 1, "year": 1}))
    drawn = len(records)
    total_p2p = sum(1 for p in live if not p["b2b"])
    print(f"  畫成線 {drawn}／{total_p2p} 條點對點；背對背 {len(b2b_pts)}／{sum(1 for p in live if p['b2b'])} 個")
    top = sorted(records, key=lambda r: -(r["mw"] or 0))[:8]
    print("  最大的線：" + "、".join(f"{r['name']} {r['mw']:,.0f} MW {r['kv']:.0f} kV {r['year']}" for r in top))
    print(f"  特高壓（≥800 kV）線 {sum(1 for r in records if r['cls'] == 3)} 條；最早的 {min(p['year'] for p in live)}")
