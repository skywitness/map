"""貿易主題：各國之間的貿易流向。地圖上點選一個國家，畫出它跟主要貿易夥伴之間的弧線。

- 全部商品：CEPII BACI。BACI 已經把進出口兩邊的申報調和成一個數字，A 出口到 B 就等於 B 從 A 進口。
  2017–2024 年用 HS17 版，1995–2016 年用 HS92 版往前接（2026-10-30，製作手冊第七批 143；build_all()）。
- 舊衣（HS 6309，2026-10-29 擴充）：CEPII BACI 的 HS92 版（1995–2024），build_used_clothing()。
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

    items: list[dict] = [build_all()]
    items.append(build_used_clothing())

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


def build_all() -> dict:
    """全部商品的流向與出口、進口總額（可以單獨跑，不必重讀 FAOSTAT）。

    2017 年起用 HS17 版，之前用 HS92 版（1995 年起）往前接。2017–2024 年沒有整段換成 HS92：兩版的總額
    世界只差 0.1–0.4%（2017 年 3.5%），但台灣（BACI 的「Other Asia, nes」）HS92 每年多 4–15%，
    而且 HS92 的台灣在 2016 → 2017 年跳了 24%（3,260 → 4,050 億美元，HS17 是 3,510 億），
    HS17 也比較接近財政部的海關統計；接在 2017 年，台灣、世界的數字都比較連續。
    """
    out = OUT_DIR / "topics" / "trade"
    print("  讀取 BACI HS17（約 800 MB，需要一兩分鐘）…")
    by_year = {year: _from_pairs(pairs) for year, pairs in baci.yearly_totals()}
    first = min(by_year)
    print(f"  讀取 BACI HS92（約 2.4 GB，{first} 年以前，幾分鐘）…")
    for year, pairs in baci.yearly_totals(hs="HS92"):
        if year < first:
            by_year[year] = _from_pairs(pairs)
    _write_item(out, "all", dict(sorted(by_year.items())))
    return {"id": "all", "label": "全部商品", "source": f"BACI HS92（{min(by_year)}–{first - 1}）、HS17（{first} 起）"}


# 二手衣（2026-10-29 擴充，製作手冊第五批 49，使用者決定：只做舊衣 HS 6309、線寬用金額，碎布 6310 不做）：
# BACI HS92 版，1995 年起（全部商品用的 HS17 版只從 2017 年起）
USED_CLOTHING = ("6309",)


def build_used_clothing() -> dict:
    """舊衣的流向與出口、進口總額（可以單獨跑，不必重讀 FAOSTAT）"""
    out = OUT_DIR / "topics" / "trade"
    print("  讀取 BACI HS92（約 2.4 GB，HS 6309，幾分鐘）…")
    by_year = {year: _from_pairs({pair: cell[0] for pair, cell in pairs.items()})
               for year, pairs in baci.yearly_product_flows(USED_CLOTHING, hs="HS92")}
    _write_item(out, "used-clothing", by_year)
    last = max(by_year)
    exports = {c: sum(p.values()) for c, p in by_year[last]["export"].items()}
    imports = {c: sum(p.values()) for c, p in by_year[last]["import"].items()}
    world = sum(exports.values())
    top = lambda d: [(c, round(v / world * 100, 1)) for c, v in sorted(d.items(), key=lambda kv: -kv[1])[:6]]  # noqa: E731
    print(f"  舊衣 {last} 年：全球 {world / 1e5:.1f} 億美元，出口 {top(exports)}，進口 {top(imports)}，"
          f"台灣出口 {exports.get('TWN', 0) / 10:,.0f} 萬美元")
    return {"id": "used-clothing", "label": "舊衣（HS 6309）", "source": "BACI HS92"}


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


def _write_item(out, item: str, by_year: dict[int, dict], suffix: str = "", unit: str = "千美元") -> None:
    """寫出一個商品的流向檔（每年一個）與出口、進口總額的指標檔。

    suffix、unit：公噸的那一組（貿易的商品流向，2026-10-30）寫到 flows-t/、export-t/、import-t/，數值不換算。
    """
    scale = 1000 if unit == "千美元" else 1
    years = sorted(by_year)
    totals: dict[str, dict[str, dict[int, float]]] = {"export": defaultdict(dict), "import": defaultdict(dict)}
    for year in years:
        flows: dict[str, object] = {"item": item, "year": year, "unit": unit, **({} if scale == 1000 else {"scale": scale})}
        for direction, by_country in by_year[year].items():
            entries = {}
            for country, partners in sorted(by_country.items()):
                total = sum(partners.values())
                if total < 0.5:
                    continue
                totals[direction][country][year] = total * scale
                # 自己對自己（再進口）與對應不到國家的夥伴只計入總額，不畫成弧線
                ranked = sorted(
                    ((p, v) for p, v in partners.items() if p is not None and p != country and v >= 0.5),
                    key=lambda kv: -kv[1],
                )
                entries[country] = [round(total), [[p, round(v)] for p, v in ranked[:TOP_N]]]
            flows[direction] = entries
        write_json(out / f"flows{suffix}" / item / f"{year}.json", flows, quiet=True)

    sizes = sum((out / f"flows{suffix}" / item / f"{y}.json").stat().st_size for y in years)
    print(f"  {item}{suffix}：{years[0]}–{years[-1]}，流向檔共 {sizes / 1024:.0f} KB")
    for direction, series in totals.items():
        world = defaultdict(float)
        for by in series.values():
            for y, v in by.items():
                world[y] += v
        write_json(
            out / f"{direction}{suffix}" / f"{item}.json",
            indicator_file(
                f"{direction}{suffix}/{item}", "美元" if scale == 1000 else unit, years,
                {c: to_series(s, years, 0) for c, s in series.items()},
                aggregates={"WLD": to_series(dict(world), years, 0)},
            ),
            quiet=True,
        )
