"""樂園的擴充：樂園集團的年人次、人次恢復到疫情前多少（2026-11-08，製作手冊第二十七批 631，候選 1373、1385；
步驟 theme-park-groups，輸出 topics/theme-parks/）。

- **集團**：英文維基「List of amusement park rankings」的「Amusement park corporations」表（CC BY-SA 4.0，只引用人次事實；
  底層是 TEA／AECOM 的報告，All rights reserved，只能走維基轉引，使用者 2026-10-30 的決定）。用景點地圖已經快取的同一個版本
  （attractions_extra.py 的 PAGES["parks"]，revid 1377863670；手冊寫的 action=raw 被 robots.txt 禁止）。前 10 大集團，
  2009–2019 與 2022–2024 年（表上沒有 2020、2021），千人次。國家是表上的總部國家（{{USA}} 這類模板）。
  指標：總部在這一國的前 10 大集團人次合計（百萬人次；名單每年不同，Six Flags Entertainment 2024 年才由 Cedar Fair 與
  舊 Six Flags 合併，表上只有 2023、2024）。側欄列這一國的集團。
- **恢復率**：單一樂園 2024 年人次 ÷ 2019 年（景點地圖的 park-visitors.json：TEA 的樂園與台灣觀光署的樂園），
  兩年都有的才算；點的顏色是恢復率。手冊的陷阱：恢復率混著新開園潮，不要說成「觀光復甦」。
"""
from __future__ import annotations

import re

from common import OUT_DIR, indicator_file, load_points_json, points_file, read_points_file, write_json
from sources import wikitable as W
from sources.countries import to_iso3
from topics.attractions_extra import PAGES, _page

OUT = OUT_DIR / "topics" / "theme-parks"
COUNTRY_FIX = {"UK": "GBR"}


def _groups() -> None:
    text = _page(*PAGES["parks"])
    s = text.index("===Amusement park corporations===")
    e = text.index("===", s + 40)
    groups = []
    for table in W.tables(text[s:e]):
        header = W.strip_refs(table.split("\n|-", 1)[0])
        years = [int(y) for y in re.findall(r"!\s*((?:19|20)\d\d)\s*(?=!!|\n|$)", header)]
        for row in W.rows(table):
            if len(row) < 3 + len(years):
                continue
            code = re.search(r"\{\{(\w+)\}\}", row[2])
            iso = COUNTRY_FIX.get(code.group(1)) or to_iso3(code.group(1)) if code else None
            if not iso:
                raise RuntimeError(f"集團的國家對不到：{row[1]} {row[2]}")
            vals = {}
            for y, cell in zip(years, row[-len(years):]):
                n = W.text(cell).replace(",", "").strip()
                if n.isdigit():
                    vals[y] = int(n)
            groups.append({"name": W.text(row[1]), "iso3": iso, "v": vals})
    years = sorted({y for g in groups for y in g["v"]})
    by_country: dict[str, dict[int, float]] = {}
    for g in groups:
        for y, v in g["v"].items():
            by_country.setdefault(g["iso3"], {}).setdefault(y, 0)
            by_country[g["iso3"]][y] += v
    write_json(OUT / "group-visitors.json", indicator_file(
        "group-visitors", "百萬人次", years, {c: [round(s[y] / 1000, 2) if y in s else None for y in years] for c, s in sorted(by_country.items())},
        license="CC BY-SA 4.0", attribution="English Wikipedia, “List of amusement park rankings” (TEA/AECOM figures)"))
    write_json(OUT / "groups.json", {"years": years, "groups": [[g["name"], g["iso3"], [g["v"].get(y) for y in years]] for g in groups],
                                     "license": "CC BY-SA 4.0"})
    for g in groups:
        v = g["v"]
        r = f"{v[2024] / v[2019]:.0%}" if 2019 in v and 2024 in v else "-"
        print(f"    {g['name']}（{g['iso3']}）2012 {v.get(2012)}、2019 {v.get(2019)}、2024 {v.get(2024)}，恢復 {r}")
    print("  依總部國家 2024：" + "、".join(f"{c} {s.get(2024, 0) / 1000:.1f}" for c, s in by_country.items()))


def _recovery() -> None:
    pts = read_points_file(load_points_json(OUT_DIR / "topics" / "attractions" / "park-visitors.json"))
    rows = []
    for p in pts:
        a, b = p.get("v2019"), p.get("v2024")
        if a and b:
            rows.append({"lon": p["lon"], "lat": p["lat"], "r": round(b / a * 100, 1), "v2019": a, "v2024": b,
                         "src": p.get("src", 1), "iso3": p.get("iso3"), "en": p.get("en"), "zh": p.get("zh")})
    rows.sort(key=lambda r: -r["v2024"])
    write_json(OUT / "park-recovery.json", {**points_file(rows, ["lon", "lat", "r", "v2019", "v2024", "src", "iso3", "en", "zh"],
                                                          {"lon": 0.001, "lat": 0.001, "r": 0.1, "v2019": 1, "v2024": 1, "src": 1},
                                                          strings=("iso3",)), "license": "CC BY-SA 4.0"})
    s = sorted(rows, key=lambda r: -r["r"])
    print(f"  恢復率：{len(rows)} 座；最高 " + "、".join(f"{r['en'] or r['zh']} {r['r']:.0f}%" for r in s[:6])
          + "；最低 " + "、".join(f"{r['en'] or r['zh']} {r['r']:.0f}%" for r in s[-6:]))
    print("    台灣：" + "、".join(f"{r['zh'] or r['en']} {r['r']:.0f}%" for r in rows if r["iso3"] == "TWN"))
    print("    " + "、".join(f"{r['en']} {r['r']:.0f}%" for r in rows[:8]))
    under = sum(1 for r in rows if r["r"] < 100)
    print(f"    低於 100% 的 {under} 座、以上 {len(rows) - under} 座；中位數 {sorted(r['r'] for r in rows)[len(rows) // 2]:.0f}%")


def build() -> None:
    _groups()
    _recovery()
