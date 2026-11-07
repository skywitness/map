"""面板模組、印刷電路板、被動元件、面板設備與石英振盪器的貿易（2026-11-07，製作手冊第二十五批 506，候選 1178；擴充「半導體」）。

格式跟半導體的其他商品一樣（semiconductors.py：流向、出口與進口總額、占全球比例、台灣對照財政部），只是商品不同：
- HS 2017（BACI HS17，2017–2024）：853400 印刷電路、8532 電容器、8533 電阻器、848630 平面顯示器製造設備、
  854160 裝好的壓電晶體（石英振盪器）。848630 與 854160 是半導體主題明文排除的（不是半導體）。
- HS 2022（BACI HS22，2022–2024）：8524 平板顯示模組（HS 2022 新增，以前散在 9013.80 等，不能接成長序列）。
BACI 的台灣是「Other Asia, nes」（夥伴申報），用財政部海關統計對照、寫進台灣附註。
"""
from __future__ import annotations

import json
from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import baci, mof_trade
from topics.semiconductors import DIRECTIONS, Item, _add_notes, _notes, _print_check, _totals
from topics.trade import _from_pairs, _write_item

OUT = OUT_DIR / "topics" / "semiconductors"

CAPACITORS = ("853210", "853221", "853222", "853223", "853224", "853225", "853229", "853230", "853290")
RESISTORS = ("853310", "853321", "853329", "853331", "853339", "853340", "853390")
DISPLAYS = ("852411", "852412", "852419", "852491", "852492", "852499")

HS17_ITEMS = [
    Item("pcb", "印刷電路板", "printed circuit board", lambda k: k == "853400", lambda k: k == "853400"),
    Item("capacitors", "電容器", "capacitor", lambda k: k.startswith("8532"), lambda k: k.startswith("8532")),
    Item("resistors", "電阻器", "resistor", lambda k: k.startswith("8533"), lambda k: k.startswith("8533")),
    Item("fpd-equipment", "平面顯示器製造設備", "flat panel display manufacturing equipment",
         lambda k: k == "848630", lambda k: k == "848630"),
    Item("crystals", "壓電晶體（石英振盪器）", "mounted piezoelectric crystal", lambda k: k == "854160", lambda k: k == "854160"),
]
HS22_ITEMS = [
    Item("display-modules", "平板顯示模組", "flat panel display module", lambda k: k.startswith("8524"), lambda k: k.startswith("8524")),
]


def _collect_hs17() -> dict[str, dict[int, dict]]:
    by_item: dict[str, dict[int, dict]] = {item.id: {} for item in HS17_ITEMS}
    for year, products in baci.yearly_products(("853400", "8532", "8533", "848630", "854160")):
        for item in HS17_ITEMS:
            pairs: baci.Pairs = defaultdict(float)
            for code, flows in products.items():
                if item.hs17(code):
                    for key, v in flows.items():
                        pairs[key] += v
            by_item[item.id][year] = _from_pairs(pairs)
    return by_item


def _collect_hs22() -> dict[str, dict[int, dict]]:
    by_item: dict[str, dict[int, dict]] = {item.id: {} for item in HS22_ITEMS}
    for year, rows in baci.yearly_hs6_rows(("8524",), hs="HS22"):
        for item in HS22_ITEMS:
            pairs: baci.Pairs = defaultdict(float)
            for code, exporter, importer, v, _ in rows:
                if item.hs17(code):
                    pairs[(exporter, importer)] += v
            by_item[item.id][year] = _from_pairs(pairs)
    return by_item


def _write(items: list[Item], by_item: dict[str, dict[int, dict]], codes: list[str], mof_from: int = 0) -> None:
    """mof_from：財政部從這一年起才有完整的數字（台灣 2023 年間才改用 HS 2022，8524 在 2023 年只有部分月份），之前的不拿來對照"""
    years = sorted(by_item[items[0].id])
    print(f"  讀取財政部的海關進出口統計（台灣的對照，{years[0]}–{years[-1]}）…")
    mof = mof_trade.hs6(codes, years[0], years[-1])
    for item in items:
        _write_item(OUT, item.id, by_item[item.id])
        totals = {d: _totals(by_item[item.id], d) for d in DIRECTIONS}
        mof_twn = {
            d: {y: sum(s.get(y, 0) for code, s in mof[d].items() if item.mof(code)) if y >= mof_from else 0 for y in years}
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
            top = sorted(((s.get(last, 0), c) for c, s in series.items()), reverse=True)[:8]
            print(f"  {item.name}{DIRECTIONS[direction]} {last} 年：全球 {world[last] / 1e8:,.0f} 億美元，"
                  f"{[(c, round(v / world[last] * 100, 1)) for v, c in top]}，台灣 {series.get('TWN', {}).get(last, 0) / 1e8:,.1f} 億")
        _print_check(item, totals, mof_twn, years)


def build() -> None:
    print("  讀取 BACI HS17 的 853400、8532、8533、848630、854160（zip 約 800 MB，需要兩分鐘）…")
    _write(HS17_ITEMS, _collect_hs17(), ["853400", *CAPACITORS, *RESISTORS, "848630", "854160"])
    print("  讀取 BACI HS22 的 8524（約 300 MB）…")
    _write(HS22_ITEMS, _collect_hs22(), list(DISPLAYS), mof_from=2024)

    path = OUT / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    ids = {item.id for item in HS17_ITEMS + HS22_ITEMS}
    manifest["items"] = [i for i in manifest["items"] if i["id"] not in ids] + [
        {"id": item.id, "label": item.name, **({"source": "BACI HS22"} if item in HS22_ITEMS else {})}
        for item in HS17_ITEMS + HS22_ITEMS
    ]
    manifest["generatedAt"] = now_iso()
    write_json(path, manifest)
