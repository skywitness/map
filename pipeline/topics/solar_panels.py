"""太陽能板（半導體主題的擴充，2026-10-30，製作手冊第六批 99）：BACI HS22 版的太陽能模組（854143）與電池（854142）。

使用者 2026-10-30 決定只做小擴充、不另開主題。半導體主題的「光電元件」（HS17 的 854140）把太陽能跟 LED、
光感測元件混在一起；HS 2022 才把它拆成 854141 LED、854142 太陽能電池（未組成模組）、854143 太陽能模組（板）、
854149 其他，所以這兩個子項目只有 2022–2024 年。

輸出跟半導體的其他商品一樣（semiconductors.py 的格式：流向、出口與進口總額、占全球比例、台灣對照財政部）。
"""
from __future__ import annotations

import json
from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import baci, mof_trade
from topics.semiconductors import DIRECTIONS, Item, _add_notes, _notes, _print_check, _totals
from topics.trade import _from_pairs, _write_item

OUT = OUT_DIR / "topics" / "semiconductors"
ITEMS = [
    Item("solar-modules", "太陽能模組（板）", "solar module (panel)", lambda k: k == "854143", lambda k: k == "854143"),
    Item("solar-cells", "太陽能電池（未組成模組）", "solar cell (not in modules)", lambda k: k == "854142", lambda k: k == "854142"),
]


def build() -> None:
    print("  讀取 BACI HS22（約 300 MB，HS 854142、854143）…")
    by_item: dict[str, dict[int, dict]] = {item.id: {} for item in ITEMS}
    for year, rows in baci.yearly_hs6_rows(("854142", "854143"), hs="HS22"):
        for item in ITEMS:
            pairs: baci.Pairs = defaultdict(float)
            for code, exporter, importer, v, _ in rows:
                if item.hs17(code):
                    pairs[(exporter, importer)] += v
            by_item[item.id][year] = _from_pairs(pairs)
    years = sorted(by_item[ITEMS[0].id])

    print("  讀取財政部的海關進出口統計（台灣的對照）…")
    mof = mof_trade.hs6(["854142", "854143"], years[0], years[-1])

    for item in ITEMS:
        _write_item(OUT, item.id, by_item[item.id])
        totals = {d: _totals(by_item[item.id], d) for d in DIRECTIONS}
        mof_twn = {
            d: {y: sum(s.get(y, 0) for code, s in mof[d].items() if item.mof(code)) for y in years}
            for d in DIRECTIONS
        }
        for direction, series in totals.items():
            world = {y: sum(s.get(y, 0) for s in series.values()) for y in years}
            _add_notes(OUT / direction / f"{item.id}.json", _notes(item, direction, series, world, mof_twn[direction], totals))
            share_notes = _notes(item, direction, series, world, mof_twn[direction], totals, share=True)
            shares = {c: {y: v / world[y] * 100 for y, v in s.items() if world.get(y)} for c, s in series.items()}
            write_json(
                OUT / f"{direction}_share" / f"{item.id}.json",
                indicator_file(
                    f"{direction}_share/{item.id}", "%", years,
                    {c: to_series(s, years) for c, s in shares.items()},
                    notes={c: zh for c, (zh, _) in share_notes.items()},
                    notesEn={c: en for c, (_, en) in share_notes.items()},
                ),
                quiet=True,
            )
            last = years[-1]
            top = sorted(((s.get(last, 0), c) for c, s in series.items()), reverse=True)[:6]
            print(f"  {item.name}{DIRECTIONS[direction]} {last} 年：全球 {world[last] / 1e8:,.0f} 億美元，"
                  f"{[(c, round(v / world[last] * 100, 1)) for v, c in top]}，台灣 {series.get('TWN', {}).get(last, 0) / 1e4:,.0f} 萬")
        _print_check(item, totals, mof_twn, years)

    path = OUT / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    ids = {item.id for item in ITEMS}
    manifest["items"] = [i for i in manifest["items"] if i["id"] not in ids] + [
        {"id": item.id, "label": item.name, "source": "BACI HS22"} for item in ITEMS
    ]
    manifest["generatedAt"] = now_iso()
    write_json(path, manifest)
