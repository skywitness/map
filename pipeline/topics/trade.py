"""貿易主題：各國之間的貿易流向。地圖上點選一個國家，畫出它跟主要貿易夥伴之間的弧線。

- 全部商品：CEPII BACI（2017–2024）。BACI 已經把進出口兩邊的申報調和成一個數字，
  A 出口到 B 就等於 B 從 A 進口。
- 農產品：FAOSTAT 詳細貿易矩陣（TM），品項跟農業主題相同，另外加上所有農產品的合計。
  TM 是各國自己申報的數字，同一筆貿易的出口方與進口方申報常常不一樣：
  - 出口以出口國的申報為準、進口以進口國的申報為準。
  - 某國當年完全沒有申報（出口或進口），才改用夥伴國的申報（鏡像資料）。

輸出：
- flows/<商品>/<年>.json：每個國家前 15 大出口對象與進口來源，加上總額（千美元）。
  依商品、年份拆檔，前端只載入目前看的那一個。
- export/<商品>.json、import/<商品>.json：各國的出口、進口總額（美元），地圖 tooltip、排名表、側欄用。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import baci, faostat
from topics.agriculture import PRODUCTS

TOP_N = 15
FLOW_FROM = 2000  # 農產品從 2000 年開始；全部列進來流向檔會超過 30 MB
EXPORT_VALUE, IMPORT_VALUE = 5922, 5622  # 千美元

# 農業主題的品項代碼是 TCL 的，TM 有些品項拆得更細，用金額加總
MATRIX_ITEMS: dict[str, set[int]] = {
    "rice": {30},  # 各種米（稻穀、糙米、白米、碎米）的合計
    "beef": {867, 870, 947},  # 帶骨、去骨牛肉，水牛肉
    "pork": {1035, 1038, 1039, 1041, 1042},  # 帶骨、去骨豬肉，培根火腿、香腸、豬肉調製品
}
RICE_TOTAL = 30  # 「稻穀（白米當量）」是其他米品項的合計，算農產品合計時要排除
ICE_CREAM_CPC = "22270"

# Key 是 (出口國, 進口國)，None 表示對應不到國家的夥伴
Pairs = dict[tuple[str | None, str | None], float]


def build() -> None:
    out = OUT_DIR / "topics" / "trade"

    print("  讀取 BACI（約 800 MB，需要一兩分鐘）…")
    items: list[dict] = [{"id": "all", "label": "全部商品", "source": "BACI"}]
    _write_item(out, "all", {year: _from_pairs(pairs) for year, pairs in baci.yearly_totals()})

    print("  讀取 FAOSTAT 詳細貿易矩陣（解壓後 8.5 GB，需要十幾分鐘）…")
    groups = _matrix_groups()
    # 年 → (element, 商品) → (出口國, 進口國) → 千美元
    reported: dict[int, dict[tuple[int, str], Pairs]] = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    filers: dict[tuple[int, int], set[str]] = defaultdict(set)  # (年, element) → 有申報的國家
    item_groups: dict[int, list[str]] = defaultdict(list)
    for group, codes in groups.items():
        for code in codes:
            item_groups[code].append(group)
    for r in faostat.matrix_rows({EXPORT_VALUE, IMPORT_VALUE}, since=FLOW_FROM):
        filers[(r.year, r.element)].add(r.reporter)
        # 出口申報：(申報國, 夥伴)；進口申報：(夥伴, 申報國)，都是 (出口國, 進口國)
        pair = (r.reporter, r.partner) if r.element == EXPORT_VALUE else (r.partner, r.reporter)
        for group in item_groups.get(r.item, ()):
            reported[r.year][(r.element, group)][pair] += r.value

    # 最近一年通常還沒收齊（2024 年只有 117 國申報，前幾年約 155 國），申報國不到高峰九成的年份不放
    counts = {y: len(filers[(y, EXPORT_VALUE)] | filers[(y, IMPORT_VALUE)]) for y in reported}
    last = max(y for y, n in counts.items() if n >= 0.9 * max(counts.values()))
    dropped = [f"{y} 年只有 {n} 國" for y, n in sorted(counts.items()) if y > last]
    if dropped:
        print(f"  申報不完整、不放：{'、'.join(dropped)}")

    for p in [*PRODUCTS, None]:
        group = p.id if p else "agri"
        by_year = {
            year: _reconcile(
                tables[(EXPORT_VALUE, group)],
                tables[(IMPORT_VALUE, group)],
                filers[(year, EXPORT_VALUE)],
                filers[(year, IMPORT_VALUE)],
            )
            for year, tables in sorted(reported.items())
            if year <= last
        }
        _write_item(out, group, by_year)
        items.append({"id": group, "label": p.label if p else "農產品合計", "source": "FAOSTAT TM"})

    write_json(
        out / "manifest.json",
        {"topic": "trade", "generatedAt": now_iso(), "source": "CEPII BACI, FAOSTAT (TM)", "items": items},
    )


def _matrix_groups() -> dict[str, set[int]]:
    """各商品對應的 TM 品項代碼；乳品是所有乳製品（CPC 022、22 開頭，不含冰淇淋）的合計。"""
    catalog = faostat.matrix_items()
    groups = {p.id: MATRIX_ITEMS.get(p.id, {p.trade}) for p in PRODUCTS}
    groups["milk"] = {
        code for code, (cpc, _) in catalog.items()
        if (cpc.startswith("022") or cpc.startswith("22")) and cpc != ICE_CREAM_CPC
    }
    groups["agri"] = set(catalog) - {RICE_TOTAL}
    for group, codes in groups.items():
        missing = codes - set(catalog)
        assert not missing, f"{group} 的品項 {missing} 不在詳細貿易矩陣裡"
    return groups


def _reconcile(exports: Pairs, imports: Pairs, export_filers: set[str], import_filers: set[str]) -> dict:
    """出口用出口國的申報、進口用進口國的申報；當年沒有申報的國家改用夥伴的鏡像資料。

    回傳 {'export': {出口國: {進口國: 值}}, 'import': {進口國: {出口國: 值}}}。
    """
    out: dict[str, dict[str, dict[str | None, float]]] = {
        "export": defaultdict(lambda: defaultdict(float)),
        "import": defaultdict(lambda: defaultdict(float)),
    }
    for (exporter, importer), v in exports.items():
        if exporter in export_filers:
            out["export"][exporter][importer] += v
        if importer is not None and importer not in import_filers:
            out["import"][importer][exporter] += v
    for (exporter, importer), v in imports.items():
        if importer in import_filers:
            out["import"][importer][exporter] += v
        if exporter is not None and exporter not in export_filers:
            out["export"][exporter][importer] += v
    return out


def _from_pairs(pairs: Pairs) -> dict:
    """BACI 的 (出口國, 進口國) 已經調和過，兩個方向直接用同一個數字。"""
    out: dict[str, dict[str, dict[str | None, float]]] = {
        "export": defaultdict(lambda: defaultdict(float)),
        "import": defaultdict(lambda: defaultdict(float)),
    }
    for (exporter, importer), v in pairs.items():
        if exporter is not None:
            out["export"][exporter][importer] += v
        if importer is not None:
            out["import"][importer][exporter] += v
    return out


def _write_item(out, item: str, by_year: dict[int, dict]) -> None:
    """寫出一個商品的流向檔（每年一個）與出口、進口總額的指標檔。"""
    years = sorted(by_year)
    totals: dict[str, dict[str, dict[int, float]]] = {"export": defaultdict(dict), "import": defaultdict(dict)}
    for year in years:
        flows: dict[str, object] = {"item": item, "year": year, "unit": "千美元"}
        for direction, by_country in by_year[year].items():
            entries = {}
            for country, partners in sorted(by_country.items()):
                total = sum(partners.values())
                if total < 0.5:
                    continue
                totals[direction][country][year] = total * 1000
                # 自己對自己（再進口）與對應不到國家的夥伴只計入總額，不畫成弧線
                ranked = sorted(
                    ((p, v) for p, v in partners.items() if p is not None and p != country and v >= 0.5),
                    key=lambda kv: -kv[1],
                )
                entries[country] = [round(total), [[p, round(v)] for p, v in ranked[:TOP_N]]]
            flows[direction] = entries
        write_json(out / "flows" / item / f"{year}.json", flows, quiet=True)

    sizes = sum((out / "flows" / item / f"{y}.json").stat().st_size for y in years)
    print(f"  {item}：{years[0]}–{years[-1]}，流向檔共 {sizes / 1024:.0f} KB")
    for direction, series in totals.items():
        world = defaultdict(float)
        for by in series.values():
            for y, v in by.items():
                world[y] += v
        write_json(
            out / direction / f"{item}.json",
            indicator_file(
                f"{direction}/{item}", "美元", years,
                {c: to_series(s, years, 0) for c, s in series.items()},
                aggregates={"WLD": to_series(dict(world), years, 0)},
            ),
            quiet=True,
        )
