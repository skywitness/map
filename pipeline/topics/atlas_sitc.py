"""1962 年起的長期貿易：Harvard Atlas 的 SITC Rev. 2（sources/atlas.py，CC0；製作手冊第十七批 270，2026-11-02）。

使用者 2026-11-02 決定另做一組「長期出口／長期進口」，整段用 Atlas，原本 1995 年起的 BACI 指標不動、不接成一條
（1995 年以後兩份的數字不同：2023 年台灣出口 Atlas 4,256 億美元、BACI 4,721 億；1995 年中國差 32%）。

- 貿易主題（topics/trade/）：flows-sitc/all/<年>.json（每個國家前 15 大出口對象與進口來源）、export-sitc/all.json、
  import-sitc/all.json（總額），格式同 topics/trade.py 的 _write_item()。
- 工業主題（topics/industry/）：exports-sitc/<類>.json（出口裡 SITC 八大類各占幾 %，GROUPS；一位碼的 0、1、4 併成
  食品、飲料與油脂，前端的類別色只有 8 個）、top-export-sitc.json（最大的出口類別，類別代碼 1–8）。
  出口總額不到 SHARE_MIN 的國家年份不算比例。
"""
from __future__ import annotations

import json

from common import OUT_DIR, indicator_file, write_json
from sources import atlas
from topics.trade import _write_item

TRADE = OUT_DIR / "topics" / "trade"
INDUSTRY = OUT_DIR / "topics" / "industry"
SHARE_MIN = 1e6  # 美元

# 前端 industry.ts 的 SITC_GROUPS 同一組 id 與順序（類別代碼是順序 + 1）
GROUPS: list[tuple[str, list[str]]] = [
    ("machinery", ["7"]),  # 機械與運輸設備
    ("material", ["6"]),  # 依材料分的製品（紡織品、鋼鐵、紙、橡膠…）
    ("misc", ["8"]),  # 雜項製品（成衣、鞋、玩具、家具、儀器…）
    ("chemicals", ["5"]),
    ("fuels", ["3"]),
    ("food", ["0", "1", "4"]),  # 食品與活動物、飲料與菸草、動植物油脂
    ("crude", ["2"]),  # 非食用原料（燃料除外）
    ("other", ["9"]),  # 未分類商品
]


def build_trade() -> None:
    bilateral = atlas.sitc_bilateral()
    years = sorted(bilateral)
    # _write_item 的數值是千美元
    by_year = {
        y: {d: {c: {p: v / 1000 for p, v in partners.items()} for c, partners in bilateral[y][d].items()} for d in ("export", "import")}
        for y in years
    }
    _write_item(TRADE, "all", by_year, suffix="-sitc")

    tw = {y: bilateral[y]["export"].get("TWN", {}) for y in (1962, 1975, 2000, 2010, years[-1])}
    for y, partners in tw.items():
        total = sum(partners.values())
        top = sorted(((p, v) for p, v in partners.items() if p), key=lambda kv: -kv[1])[:4]
        print(f"  台灣 {y} 年出口 {total / 1e8:,.1f} 億美元：" + "、".join(f"{p} {v / total * 100:.1f}%" for p, v in top))
    baci = json.loads((TRADE / "flows" / "all" / f"{years[-1]}.json").read_text(encoding="utf-8"))
    for c in ("TWN", "CHN", "USA", "DEU"):
        a = sum(bilateral[years[-1]]["export"].get(c, {}).values())
        b = baci["export"][c][0] * baci.get("scale", 1000)
        print(f"    {c} {years[-1]} 年出口：Atlas {a / 1e9:,.1f}、BACI {b / 1e9:,.1f} 十億美元（{(a / b - 1) * 100:+.1f}%）")


def build_industry() -> None:
    sections = atlas.sitc_sections()
    years = sorted({y for by in sections.values() for y in by})
    shares: dict[str, dict[str, list[float | None]]] = {g: {} for g, _ in GROUPS}
    top: dict[str, list[float | None]] = {}
    world = {y: [0.0] * len(GROUPS) for y in years}
    for iso3, by_year in sorted(sections.items()):
        rows = {g: [] for g, _ in GROUPS}
        top_row: list[float | None] = []
        for y in years:
            codes = by_year.get(y, {})
            values = [sum(codes.get(c, 0.0) for c in cs) for _, cs in GROUPS]
            total = sum(values)
            for i, v in enumerate(values):
                world[y][i] += v
            ok = total >= SHARE_MIN
            for (g, _), v in zip(GROUPS, values):
                rows[g].append(round(v / total * 100, 2) if ok else None)
            top_row.append(values.index(max(values)) + 1 if ok else None)
        if any(v is not None for v in top_row):
            for g in rows:
                shares[g][iso3] = rows[g]
            top[iso3] = top_row
    for i, (g, _) in enumerate(GROUPS):
        w = [round(world[y][i] / sum(world[y]) * 100, 2) for y in years]
        write_json(INDUSTRY / "exports-sitc" / f"{g}.json",
                   indicator_file(f"exports-sitc/{g}", "%", years, shares[g], aggregates={"WLD": w}), quiet=True)
    write_json(INDUSTRY / "top-export-sitc.json", indicator_file("top-export-sitc", "類別", years, top))

    print(f"  出口組成：{len(top)} 個國家與地區，{years[0]}–{years[-1]}")
    tw = sections["TWN"]
    for y in (1962, 1980, years[-1]):
        values = [sum(tw[y].get(c, 0.0) for c in cs) for _, cs in GROUPS]
        total = sum(values)
        print(f"    台灣 {y} 年 {total / 1e8:,.1f} 億美元：" + "、".join(f"{g} {v / total * 100:.1f}%" for (g, _), v in zip(GROUPS, values) if v / total >= 0.05))
    last = years[-1]
    i = years.index(last)
    counts = {g: sum(1 for row in top.values() if row[i] == k + 1) for k, (g, _) in enumerate(GROUPS)}
    print(f"    {last} 年最大的出口類別：{counts}")


def build() -> None:
    build_trade()
    build_industry()
