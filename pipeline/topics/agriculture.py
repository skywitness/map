"""農業主題：FAOSTAT 產量（QCL）、貿易（TCL）、產值（QV）。

地圖上可選 20 多種農產品，看產量、出口量、進口量與自給率；
側欄另外列出每個國家各年的主要農產品（依產值）與主要進出口品項（依金額）。
"""
from __future__ import annotations

import heapq
from collections import defaultdict
from typing import NamedTuple

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import faostat
from topics.agriculture_names import ZH_NAMES


class Product(NamedTuple):
    id: str
    label: str
    group: str
    production: int  # QCL 品項代碼
    trade: int  # TCL 品項代碼（跟產量同單位的那個）
    # 算自給率時把產量換成貿易的單位，例如稻穀 → 白米當量
    ssr_factor: float = 1.0


PRODUCTS = [
    Product("rice", "稻米", "穀物", 27, 30, 0.667),  # 產量為稻穀，貿易為白米當量
    Product("wheat", "小麥", "穀物", 15, 15),
    Product("maize", "玉米", "穀物", 56, 56),
    Product("barley", "大麥", "穀物", 44, 44),
    Product("soybeans", "大豆", "油料與經濟作物", 236, 236),
    Product("palm-oil", "棕櫚油", "油料與經濟作物", 257, 257),
    Product("sugar", "糖（原糖）", "油料與經濟作物", 162, 162),
    Product("coffee", "咖啡豆", "油料與經濟作物", 656, 656),
    Product("cocoa", "可可豆", "油料與經濟作物", 661, 661),
    Product("cotton", "棉花（皮棉）", "油料與經濟作物", 767, 767),
    Product("rubber", "天然橡膠", "油料與經濟作物", 836, 836),
    Product("potatoes", "馬鈴薯", "蔬菜水果", 116, 116),
    Product("tomatoes", "番茄", "蔬菜水果", 388, 388),
    Product("bananas", "香蕉", "蔬菜水果", 486, 486),
    Product("apples", "蘋果", "蔬菜水果", 515, 515),
    Product("oranges", "柳橙", "蔬菜水果", 490, 490),
    Product("grapes", "葡萄", "蔬菜水果", 560, 560),
    Product("beef", "牛肉（含水牛）", "畜產品", 1806, 1806),
    Product("pork", "豬肉", "畜產品", 1035, 2073),  # 貿易用「豬肉當量」，含加工品
    Product("chicken", "雞肉", "畜產品", 1058, 1058),
    Product("milk", "乳品（生乳當量）", "畜產品", 1780, 1881),  # 產量為全部生乳，貿易為乳製品折算生乳
    Product("eggs", "雞蛋", "畜產品", 1062, 1062),
]

PRODUCTION_QTY = 5510
EXPORT_QTY, IMPORT_QTY = 5910, 5610
EXPORT_VALUE, IMPORT_VALUE = 5922, 5622  # 千美元
GROSS_VALUE = 152  # 總產值，2014–2016 年固定價格（千國際元）；當期美元（57）沒有台灣
QV_TOTAL = 2051  # Agriculture
TRADE_TOTAL = 1882  # Crops and livestock products
AGGREGATE_ITEM_FROM = 1700  # 1700 以上是合計類品項（穀物合計、乳製品當量等）
MERCHANDISE_TOTAL = 10  # 「全部商品貿易總額」，不是農產品
TOP_N = 10


def build() -> None:
    out = OUT_DIR / "topics" / "agriculture"
    names: dict[int, str] = {}

    print("  讀取產量…")
    production: dict[tuple[int, str], dict[int, float]] = defaultdict(dict)
    for r in faostat.rows("QCL", {PRODUCTION_QTY}, {p.production for p in PRODUCTS}):
        production[(r.item, r.area)][r.year] = r.value

    print("  讀取產值…")
    gross: dict[tuple[str, int], dict[int, float]] = defaultdict(dict)
    total_value: dict[str, dict[int, float]] = defaultdict(dict)
    for r in faostat.rows("QV", {GROSS_VALUE}):
        if r.item == QV_TOTAL:
            total_value[r.area][r.year] = r.value * 1000
        elif r.item < AGGREGATE_ITEM_FROM and r.area != "WLD":
            names[r.item] = r.item_name
            gross[(r.area, r.year)][r.item] = r.value * 1000
    _drop_non_indigenous(gross, names)

    print("  讀取貿易（約 2.4 GB，需要幾分鐘）…")
    trade_items = {p.trade for p in PRODUCTS}
    trade_qty: dict[tuple[int, int, str], dict[int, float]] = defaultdict(dict)
    trade_total: dict[tuple[int, str], dict[int, float]] = defaultdict(dict)
    top_trade: dict[tuple[str, int, int], list[tuple[float, int]]] = defaultdict(list)
    for r in faostat.rows("TCL", {EXPORT_QTY, IMPORT_QTY, EXPORT_VALUE, IMPORT_VALUE}):
        if r.element in (EXPORT_QTY, IMPORT_QTY):
            if r.item in trade_items:
                trade_qty[(r.element, r.item, r.area)][r.year] = r.value
        elif r.item == TRADE_TOTAL:
            trade_total[(r.element, r.area)][r.year] = r.value * 1000
        elif (
            r.area != "WLD"
            and r.item != MERCHANDISE_TOTAL
            and r.item < AGGREGATE_ITEM_FROM
            and "equivalent" not in r.item_name
            and r.value > 0
        ):
            names[r.item] = r.item_name
            heap = top_trade[(r.area, r.year, r.element)]
            heapq.heappush(heap, (r.value * 1000, r.item))
            if len(heap) > TOP_N:
                heapq.heappop(heap)

    all_years = {y for s in production.values() for y in s} | {y for s in trade_total.values() for y in s}
    years = list(range(min(all_years), max(all_years) + 1))

    # 各農產品：產量、出口量、進口量、自給率
    for p in PRODUCTS:
        prod = {area: s for (item, area), s in production.items() if item == p.production}
        exp = {area: s for (el, item, area), s in trade_qty.items() if el == EXPORT_QTY and item == p.trade}
        imp = {area: s for (el, item, area), s in trade_qty.items() if el == IMPORT_QTY and item == p.trade}
        for key, data, unit in (("production", prod, "公噸"), ("export", exp, "公噸"), ("import", imp, "公噸")):
            world = data.pop("WLD", {})
            write_json(
                out / key / f"{p.id}.json",
                indicator_file(
                    f"{key}/{p.id}", unit, years,
                    {area: to_series(s, years, 0) for area, s in data.items()},
                    aggregates={"WLD": to_series(world, years, 0)},
                ),
            )
        write_json(
            out / "self-sufficiency" / f"{p.id}.json",
            indicator_file(f"self-sufficiency/{p.id}", "%", years, _self_sufficiency(prod, exp, imp, p, years)),
        )

    # 全體農業：總產值、農產品貿易收支
    write_json(
        out / "production-value.json",
        indicator_file(
            "production-value", "國際元", years,
            {a: to_series(s, years, 0) for a, s in total_value.items() if a != "WLD"},
            aggregates={"WLD": to_series(total_value.get("WLD", {}), years, 0)},
        ),
    )
    balance: dict[str, dict[int, float]] = {}
    for (element, area), series in trade_total.items():
        if element != EXPORT_VALUE:
            continue
        imports = trade_total.get((IMPORT_VALUE, area), {})
        balance[area] = {y: v - imports[y] for y, v in series.items() if y in imports}
    write_json(
        out / "trade-balance.json",
        indicator_file(
            "trade-balance", "美元", years,
            {a: to_series(s, years, 0) for a, s in balance.items() if a != "WLD"},
        ),
    )

    # 側欄：每個國家每年的主要農產品（產值）與主要進出口品項（金額）
    used_items: set[int] = set()
    countries: dict[str, dict] = defaultdict(lambda: {"production": {}, "exports": {}, "imports": {}})
    for (area, year), items in gross.items():
        top = sorted(items.items(), key=lambda kv: -kv[1])[:TOP_N]
        total = total_value.get(area, {}).get(year)
        if top and total:
            countries[area]["production"][year] = {"total": round(total), "top": [[i, round(v)] for i, v in top]}
            used_items.update(i for i, _ in top)
    for (area, year, element), heap in top_trade.items():
        total = trade_total.get((element, area), {}).get(year)
        if not total:
            continue
        key = "exports" if element == EXPORT_VALUE else "imports"
        top = sorted(heap, reverse=True)
        countries[area][key][year] = {"total": round(total), "top": [[i, round(v)] for v, i in top]}
        used_items.update(i for _, i in top)
    for area, data in countries.items():
        write_json(out / "countries" / f"{area}.json", data, quiet=True)
    print(f"  {len(countries)} 個國家的側欄資料")

    write_json(out / "items.json", {str(i): ZH_NAMES.get(i, _clean(names[i])) for i in sorted(used_items)})
    # 英文介面用 FAOSTAT 本身的英文品項名稱
    write_json(out / "items.en.json", {str(i): _clean(names[i]) for i in sorted(used_items)})
    missing = sorted(i for i in used_items if i not in ZH_NAMES)
    if missing:
        print(f"  {len(missing)} 個品項沒有中文名稱，暫用英文：{', '.join(f'{i} {names[i]}' for i in missing[:40])}…")

    write_json(
        out / "manifest.json",
        {
            "topic": "agriculture",
            "generatedAt": now_iso(),
            "source": "FAOSTAT (QCL, TCL, QV)",
            "products": [{"id": p.id, "label": p.label, "group": p.group} for p in PRODUCTS],
        },
    )


def _self_sufficiency(prod, exp, imp, p: Product, years: list[int]) -> dict[str, list]:
    """自給率 = 產量 ÷（產量 + 進口 − 出口）。國內供給 ≤ 0（例如動用庫存出口）時無法計算。"""
    out: dict[str, list] = {}
    for area in (set(prod) | set(imp) | set(exp)) - {"WLD"}:
        series = []
        for y in years:
            produced = prod.get(area, {}).get(y)
            imported = imp.get(area, {}).get(y)
            exported = exp.get(area, {}).get(y)
            if produced is None and imported is None:
                series.append(None)
                continue
            produced = (produced or 0) * p.ssr_factor
            supply = produced + (imported or 0) - (exported or 0)
            series.append(round(min(produced / supply * 100, 10000), 1) if supply > 0 else None)
        if any(v is not None for v in series):
            out[area] = series
    return out


def _drop_non_indigenous(gross: dict, names: dict[int, str]) -> None:
    """QV 的肉類同時有「X」和「X (indigenous)」，產值以後者為準，前者刪掉以免重複計算。"""
    by_name = {name: code for code, name in names.items()}
    duplicates = {
        by_name[name.removesuffix(" (indigenous)")]
        for name in names.values()
        if name.endswith(" (indigenous)") and name.removesuffix(" (indigenous)") in by_name
    }
    for items in gross.values():
        for code in duplicates:
            items.pop(code, None)


def _clean(name: str) -> str:
    return name.removesuffix(" (indigenous)")
