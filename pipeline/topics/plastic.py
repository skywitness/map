"""塑膠污染主題：各國的塑膠污染排放（模型估計）、河川流入海洋的塑膠（模型估計）、塑膠廢料的貿易流向。

資料：
- Cottom, Cook & Velis (2024), Nature（sources/cottom.py，資料 CC0 1.0，論文 CC BY 4.0）：SPOT 模型的 2020 年
  城市固體廢棄物塑膠排放（碎片＋露天焚燒），依來源分未收集、亂丟、收集與運輸、沒有控制的棄置場、回收分選；
  還有塑膠垃圾產生量、沒有垃圾收集服務的人口比例。含台灣。
- Meijer et al. (2021), Science Advances（sources/meijer.py，figshare 的資料 CC BY 4.0）：31,819 個河口每年流進海洋的
  漂浮塑膠（2015 年，模型估計）。依河口位置歸到國家加總；河口畫成點。
- CEPII BACI HS92 版（sources/baci.py，Etalab 2.0）：HS 3915（塑膠的廢料、下腳及碎屑）的雙邊貿易，1995–2024 年，
  用數量（公噸）。台灣在 BACI 是「Other Asia, nes」（490），沒有自己向聯合國申報，數字來自貿易夥伴。
- 台灣的官方統計（只在附註與側欄，跟模型是不同的量測）：環境部的一般廢棄物清理情況、執行機關資源回收量、
  公告應回收的塑膠容器（sources/moenv.py，政府資料開放授權條款）；財政部 HS 3915 的進出口值（sources/mof_trade.py）。

輸出（public/data/topics/plastic/）：
- per-capita/{all,debris,burn}.json、total/{all,debris,burn}.json：排放（2020 年），子項目是排放的形式
- generation.json（人均塑膠垃圾產生量）、no-collection.json（沒有垃圾收集服務的人口比例）
- ocean.json（河川流入海洋的塑膠，國家合計）、rivers.json（河口的點）
- export.json、import.json（塑膠廢料的出口、進口量）、flows/<年>.json（流向，每國前 15 個夥伴）
- countries/<ISO3>.json（側欄的明細）、manifest.json
"""
from __future__ import annotations

import json
from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, points_file, to_series, write_json
from geoindex import countries_at
from sources import baci, cottom, marine_regions, meijer, moenv, mof_trade

OUT = OUT_DIR / "topics" / "plastic"
TAIWAN = "TWN"
HS_WASTE = ("3915",)
HS_CODES = ["391510", "391520", "391530", "391590"]  # 乙烯、苯乙烯、氯乙烯的聚合物，其他塑膠
TOP_N = 15  # 流向檔每個國家存的夥伴數
HISTORY_PARTNERS = 6  # 側欄歷年圖表分開畫的夥伴數（其他併成一層）
RIVER_MIN = 1.0  # 河口的點只畫每年 1 公噸以上的（占總量 99.5%）

# 排放的形式（子項目）：(總量欄位, 人均欄位)
FORMS = {
    "all": ("plas_em", "plas_em_per_cap"),
    "debris": ("plas_debris_em", "plas_debris_em_per_cap"),
    "burn": ("plas_burn_em", "plas_burn_em_per_cap"),
}
# 排放的來源（側欄），依全世界由大到小
SOURCES = {
    "uncollected": "plas_uncol_em",
    "disposal": "plas_disp_em",
    "litter": "plas_litter_em",
    "recycling": "plas_recy_em",
    "collection": "plas_collection_em",
}
SOURCE_ZH = {"uncollected": "未收集的垃圾", "disposal": "沒有控制的棄置場", "litter": "亂丟的垃圾",
             "recycling": "回收分選", "collection": "收集與運輸"}
SOURCE_EN = {"uncollected": "uncollected waste", "disposal": "uncontrolled disposal sites", "litter": "litter",
             "recycling": "sorting and recycling", "collection": "collection and transport"}

# Our World in Data 轉載的 Meijer 國家表（論文附錄，CC BY-NC）的幾個值，只用來確認依河口位置加總的結果合理
MEIJER_CHECK = {"PHL": 356_371, "IND": 126_513, "MYS": 73_098, "CHN": 70_707, "IDN": 56_333, "BRA": 37_799, "TWN": 531}


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    inv = cottom.inventory()
    emission_files(inv)
    ocean = river_files()
    trade = trade_files()
    taiwan = taiwan_stats(trade)
    details(inv, ocean, trade, taiwan)
    write_json(
        OUT / "manifest.json",
        {
            "topic": "plastic",
            "generatedAt": now_iso(),
            "sources": [
                cottom.CITATION + f" Downloaded from the Our World in Data snapshot of the Dryad files ({cottom.URL}).",
                meijer.CITATION,
                "CEPII BACI, HS92 version V202601, HS 3915 (Etalab 2.0).",
                "環境部開放資料 STAT_P_45、STAT_P_132、STAT_P_133（政府資料開放授權條款）；財政部貿易統計 i8142（HS 3915）。",
            ],
            "license": "CC0 1.0 (Cottom et al. data); CC BY 4.0 (Meijer et al. data); Etalab 2.0 (BACI)",
        },
    )


# ── Cottom et al.（SPOT）：排放、產生量、收集服務 ─────────────────────


def zh_t(t: float) -> str:
    """公噸 → 「1,398 公噸」「2.6 萬公噸」「52.1 百萬公噸」"""
    if t >= 1e6:
        return f"{t / 1e6:.1f} 百萬公噸"
    if t >= 1e5:
        return f"{t / 1e4:,.0f} 萬公噸"
    if t >= 1e4:
        return f"{t / 1e4:.1f} 萬公噸"
    return f"{t:,.0f} 公噸"


def en_t(t: float) -> str:
    if t >= 1e6:
        return f"{t / 1e6:.1f} Mt"
    if t >= 1e4:
        return f"{t / 1e3:,.0f} kt"
    return f"{t:,.0f} t"


def emission_files(inv: cottom.Inventory) -> None:
    year = [cottom.YEAR]
    mean, p5, p95 = inv.countries["mean"], inv.countries["p5"], inv.countries["p95"]
    world = inv.world["mean"]
    total_check = sum(c["plas_em"] for c in mean.values())
    print(f"  SPOT：{len(mean)} 國，排放合計 {total_check / 1e6:.2f} 百萬公噸（世界 {world['plas_em'] / 1e6:.2f}），"
          f"露天焚燒 {world['plas_burn_em'] / world['plas_em'] * 100:.0f}%")
    if abs(total_check / world["plas_em"] - 1) > 0.01:
        raise RuntimeError("SPOT 各國的排放加總跟世界合計差太多")

    tw = mean[TAIWAN]
    tw_sources = sorted(((k, tw[f]) for k, f in SOURCES.items() if tw[f] > 0), key=lambda kv: -kv[1])
    tw_zh = "、".join(f"{SOURCE_ZH[k]} {v / tw['plas_em'] * 100:.0f}%" for k, v in tw_sources)
    tw_en = ", ".join(f"{SOURCE_EN[k]} {v / tw['plas_em'] * 100:.0f}%" for k, v in tw_sources)
    notes_zh = {TAIWAN: (
        f"模型估計（90% 區間 {p5[TAIWAN]['plas_em']:,.0f}–{p95[TAIWAN]['plas_em']:,.0f} 公噸）。台灣的垃圾幾乎都有收集，"
        f"模型裡沒有露天焚燒，排放來自{tw_zh}。環境部統計的是回收與處理量（2024 年一般廢棄物回收率 "
        "{rate}），是另一種量測，不能直接相比，見側欄。"
    )}
    notes_en = {TAIWAN: (
        f"Model estimate (90% interval {p5[TAIWAN]['plas_em']:,.0f}–{p95[TAIWAN]['plas_em']:,.0f} t). Nearly all waste in "
        f"Taiwan is collected and the model has no open burning there; emissions come from {tw_en}. The Ministry of "
        "Environment reports recycling and treatment (municipal waste recycling rate {rate} in 2024), a different "
        "measure that cannot be compared directly; see the side panel."
    )}
    rate = _taiwan_recycling_rate(2024)
    notes_zh = {k: v.replace("{rate}", rate) for k, v in notes_zh.items()}
    notes_en = {k: v.replace("{rate}", rate) for k, v in notes_en.items()}

    for form, (total_field, per_cap_field) in FORMS.items():
        write_json(
            OUT / "total" / f"{form}.json",
            indicator_file(
                f"total/{form}", "公噸", year,
                {iso: [round(c[total_field])] for iso, c in mean.items()},
                aggregates={"WLD": [round(world[total_field])]},
                notes=notes_zh, notesEn=notes_en,
            ),
        )
        write_json(
            OUT / "per-capita" / f"{form}.json",
            indicator_file(
                f"per-capita/{form}", "公斤/人", year,
                {iso: [round(c[per_cap_field], 4)] for iso, c in mean.items()},
                aggregates={"WLD": [round(world[per_cap_field], 4)]},
                notes=notes_zh, notesEn=notes_en,
            ),
        )
    # 塑膠垃圾產生量：SPOT 的單位是公斤／人／日，換成一年
    write_json(
        OUT / "generation.json",
        indicator_file(
            "generation", "公斤/人", year,
            {iso: [round(c["pwg_per_cap"] * 365, 2)] for iso, c in mean.items()},
            aggregates={"WLD": [round(world["pwg"] * 1000 / world["Population_2020"], 2)]},
        ),
    )
    write_json(
        OUT / "no-collection.json",
        indicator_file(
            "no-collection", "%", year,
            {iso: [round(c["people_no_col_pct_pop"], 2)] for iso, c in mean.items()},
            aggregates={"WLD": [round(world["people_no_col_pct_pop"], 2)]},
        ),
    )


_RATE_CACHE: dict[int, str] = {}


def _taiwan_recycling_rate(year: int) -> str:
    if year not in _RATE_CACHE:
        w = moenv.municipal_waste()[year]
        _RATE_CACHE[year] = f"{(w['recycled'] + w['food']) / w['generated'] * 100:.1f}%"
    return _RATE_CACHE[year]


# ── Meijer et al.：河川流入海洋 ─────────────────────────────


def river_files() -> dict:
    outlets = meijer.outlets()
    lons = [o[0] for o in outlets]
    lats = [o[1] for o in outlets]
    isos = countries_at(lons, lats)
    total = sum(o[2] for o in outlets)
    lost = [(o, i) for o, i in zip(outlets, isos) if i is None]
    print(f"  Meijer：{len(outlets)} 個河口，合計 {total:,.0f} 公噸；找不到國家的 {len(lost)} 個、"
          f"{sum(o[2] for o, _ in lost):,.0f} 公噸")
    if sum(o[2] for o, _ in lost) > 0.002 * total:
        raise RuntimeError(f"Meijer 有太多河口找不到國家：{sorted(lost, key=lambda x: -x[0][2])[:10]}")

    by_country: dict[str, list[tuple[float, float, float]]] = defaultdict(list)
    for o, iso in zip(outlets, isos):
        if iso:
            by_country[iso].append(o)
    totals = {iso: sum(o[2] for o in pts) for iso, pts in by_country.items()}
    for iso, expected in MEIJER_CHECK.items():
        got = totals.get(iso, 0)
        print(f"    {iso}：依河口加總 {got:,.0f}，論文的國家表 {expected:,}（{(got / expected - 1) * 100:+.1f}%）")
        if abs(got / expected - 1) > 0.15:
            raise RuntimeError(f"Meijer 的 {iso} 依河口加總跟論文的國家表差太多")

    # 沿海但沒有排放 0.1 公噸以上河口的國家是 0；內陸國沒有值（河川帶出的塑膠算在出海口的國家，前端 plastic.ts 的
    # LANDLOCKED 寫原因，同一份清單）。Meijer 的模型把裏海也當成海（伊朗的 865 公噸有 832 公噸流進裏海），
    # 所以裏海沿岸的哈薩克、亞塞拜然、土庫曼照 Marine Regions 算沿海國
    landlocked = marine_regions.landlocked() | {"XKX"}
    inland = [iso for iso in landlocked if totals.get(iso)]
    if inland:
        raise RuntimeError(f"內陸國有入海的河口：{inland}")
    print(f"  內陸國：{' '.join(sorted(landlocked))}")
    with open(OUT_DIR / "countries.json", encoding="utf-8") as f:
        known = set(json.load(f))
    values = {iso: [round(totals.get(iso, 0), 1)] for iso in sorted(known - landlocked)}
    ranked = sorted(totals, key=lambda i: -totals[i])
    tw = by_country.get(TAIWAN, [])
    tw_top = max(tw, key=lambda o: o[2]) if tw else None
    notes_zh, notes_en = {}, {}
    if tw_top:
        notes_zh[TAIWAN] = (
            f"模型估計（2015 年）。台灣有 {len(tw)} 個河口每年排放 0.1 公噸以上，最大的在北緯 {tw_top[1]:.2f}°、東經 "
            f"{tw_top[0]:.2f}°（淡水河口一帶），每年 {tw_top[2]:,.0f} 公噸，占台灣的 {tw_top[2] / totals[TAIWAN] * 100:.0f}%。"
        )
        notes_en[TAIWAN] = (
            f"Model estimate (2015). Taiwan has {len(tw)} river mouths emitting 0.1 t or more a year; the largest, at "
            f"{tw_top[1]:.2f}°N {tw_top[0]:.2f}°E (around the Tamsui River mouth), emits {tw_top[2]:,.0f} t a year, "
            f"{tw_top[2] / totals[TAIWAN] * 100:.0f}% of Taiwan's total."
        )
    write_json(
        OUT / "ocean.json",
        indicator_file(
            "ocean", "公噸", [meijer.YEAR], values,
            aggregates={"WLD": [round(total)]}, notes=notes_zh, notesEn=notes_en,
        ),
    )

    # 河口的點：依排放量排名，經度排序後差分
    order = sorted(range(len(outlets)), key=lambda i: -outlets[i][2])
    rank = {i: n + 1 for n, i in enumerate(order)}
    rows = [
        {"lon": o[0], "lat": o[1], "t": o[2], "r": rank[i], "iso3": isos[i]}
        for i, o in enumerate(outlets)
        if o[2] >= RIVER_MIN
    ]
    rows.sort(key=lambda r: r["lon"])
    kept = sum(r["t"] for r in rows)
    print(f"  河口的點：每年 {RIVER_MIN:g} 公噸以上 {len(rows)} 個，占 {kept / total * 100:.1f}%")
    write_json(
        OUT / "rivers.json",
        points_file(rows, ["lon", "lat", "t", "r", "iso3"], {"lon": 0.01, "lat": 0.01, "t": 0.1, "r": 1}, delta=("lon",)),
    )

    top80 = 0
    acc = 0.0
    for i in order:
        acc += outlets[i][2]
        top80 += 1
        if acc >= 0.8 * total:
            break
    print(f"  前 {top80} 個河口占 80%")
    return {
        "totals": totals,
        "rank": {iso: n + 1 for n, iso in enumerate(ranked)},
        "of": len(ranked),
        "outlets": {iso: sorted(pts, key=lambda o: -o[2]) for iso, pts in by_country.items()},
        "world": total,
        "top80": top80,
        "count": len(outlets),
    }


# ── BACI：塑膠廢料的貿易（HS 3915） ──────────────────────────


def trade_files() -> dict:
    print("  讀取 BACI HS92（約 2.4 GB，HS 3915，幾分鐘）…")
    by_year: dict[int, dict[str, dict[str, dict[str | None, float]]]] = {}
    values: dict[int, dict[str, dict[str, float]]] = {}  # 年 → 方向 → 國家 → 千美元（台灣跟財政部比對）
    missing_share: dict[int, float] = {}
    for year, pairs in baci.yearly_product_flows(HS_WASTE, hs="HS92"):
        flows = {"export": defaultdict(lambda: defaultdict(float)), "import": defaultdict(lambda: defaultdict(float))}
        vals = {"export": defaultdict(float), "import": defaultdict(float)}
        v_all = v_missing = 0.0
        for (exporter, importer), (v, q, missing) in pairs.items():
            v_all += v
            v_missing += missing
            if exporter is not None:
                flows["export"][exporter][importer] += q
                vals["export"][exporter] += v
            if importer is not None:
                flows["import"][importer][exporter] += q
                vals["import"][importer] += v
        by_year[year] = flows
        values[year] = vals
        missing_share[year] = v_missing / v_all if v_all else 0
    years = sorted(by_year)
    worst = max(missing_share, key=missing_share.get)
    print(f"  {years[0]}–{years[-1]}；數量空白的金額最多是 {worst} 年的 {missing_share[worst] * 100:.1f}%")

    totals: dict[str, dict[str, dict[int, float]]] = {"export": defaultdict(dict), "import": defaultdict(dict)}
    pair_series: dict[str, dict[str, dict[str, dict[int, float]]]] = {
        "export": defaultdict(lambda: defaultdict(dict)), "import": defaultdict(lambda: defaultdict(dict))
    }
    world: dict[int, float] = {}
    for year in years:
        out: dict[str, object] = {"item": "3915", "year": year, "unit": "公噸", "scale": 1}
        for direction, by_country in by_year[year].items():
            entries = {}
            for country, partners in sorted(by_country.items()):
                total = sum(partners.values())
                if total < 0.5:
                    continue
                totals[direction][country][year] = total
                ranked = sorted(
                    ((p, v) for p, v in partners.items() if p is not None and p != country and v >= 0.5),
                    key=lambda kv: -kv[1],
                )
                for p, v in ranked:
                    pair_series[direction][country][p][year] = v
                entries[country] = [round(total), [[p, round(v)] for p, v in ranked[:TOP_N]]]
            out[direction] = entries
        world[year] = sum(totals["export"][c].get(year, 0) for c in totals["export"])
        write_json(OUT / "flows" / f"{year}.json", out, quiet=True)
    size = sum((OUT / "flows" / f"{y}.json").stat().st_size for y in years)
    print(f"  流向檔 {len(years)} 個，共 {size / 1024:.0f} KB；{years[-1]} 年全世界 {world[years[-1]] / 1e6:.2f} 百萬公噸")

    notes_zh = {TAIWAN: "BACI 的台灣（「Other Asia, nes」）是貿易夥伴申報的數字，台灣不向聯合國申報；財政部 HS 3915 的進出口值見側欄。"}
    notes_en = {TAIWAN: "Taiwan in BACI (“Other Asia, nes”) is based on its partners’ reports, as Taiwan does not report to the UN; "
                        "Ministry of Finance values for HS 3915 are in the side panel."}
    for direction in ("export", "import"):
        write_json(
            OUT / f"{direction}.json",
            indicator_file(
                direction, "公噸", years,
                {c: to_series(s, years, 0) for c, s in sorted(totals[direction].items())},
                aggregates={"WLD": to_series(world, years, 0)},
                notes=notes_zh, notesEn=notes_en,
            ),
        )
    for direction in ("export", "import"):
        top = sorted(totals[direction], key=lambda c: -totals[direction][c].get(years[-1], 0))[:5]
        print(f"  {years[-1]} 年{('出口' if direction == 'export' else '進口')}前 5 名：" +
              "、".join(f"{c} {totals[direction][c][years[-1]] / 1e3:,.0f} 千公噸" for c in top))
    china = totals["import"].get("CHN", {})
    print(f"  中國的進口：2016 年 {china.get(2016, 0) / 1e6:.2f}、2017 年 {china.get(2017, 0) / 1e6:.2f}、"
          f"2018 年 {china.get(2018, 0) / 1e6:.2f}、{years[-1]} 年 {china.get(years[-1], 0) / 1e6:.3f} 百萬公噸")
    return {"years": years, "totals": totals, "pairs": pair_series, "values": values, "world": world}


# ── 台灣的官方統計 ──────────────────────────────────


def taiwan_stats(trade: dict) -> dict:
    waste = moenv.municipal_waste()
    plastics = moenv.recycled_plastics()
    last = max(waste)
    w = waste[last]
    print(f"  環境部：{last} 年一般廢棄物 {w['generated'] / 1e4:,.0f} 萬公噸，回收率 "
          f"{(w['recycled'] + w['food']) / w['generated'] * 100:.2f}%；執行機關回收的塑膠及橡膠製品 "
          f"{plastics[max(plastics)]['plastics'] / 1e4:.1f} 萬公噸（{max(plastics)} 年）")

    mof = mof_trade.hs6(HS_CODES, 2011, 2025)
    mof_years = sorted({y for d in mof.values() for s in d.values() for y in s})
    out_mof: dict[str, object] = {"years": mof_years}
    for direction in ("export", "import"):
        official = [round(sum(s.get(y, 0) for s in mof[direction].values())) for y in mof_years]
        mirror = [
            round(trade["values"][y][direction].get(TAIWAN, 0) * 1000) if y in trade["values"] else None
            for y in mof_years
        ]
        out_mof[direction] = official
        out_mof[f"baci{direction.title()}"] = mirror
        tonnes = trade["totals"][direction].get(TAIWAN, {})
        out_mof[f"tonnes{direction.title()}"] = [round(tonnes[y]) if y in tonnes else None for y in mof_years]
        diffs = [f"{y} {m / o * 100 - 100:+.0f}%" for y, o, m in zip(mof_years, official, mirror) if o and m]
        print(f"  台灣的 HS 3915 {('出口' if direction == 'export' else '進口')}：BACI 對財政部 " + "、".join(diffs))
    return {
        "waste": {
            "years": list(waste),
            **{k: [round(v[k]) for v in waste.values()] for k in ("generated", "garbage", "recycled", "food")},
        },
        "plastics": {
            "years": list(plastics),
            **{k: [round(v.get(k, 0)) for v in plastics.values()] for k in ("plastics", "containers", "recyclables")},
        },
        "mof": out_mof,
    }


# ── 側欄的明細 ─────────────────────────────────────


def _series(by_year: dict[int, float], years: list[int]) -> list[int]:
    return [round(by_year.get(y, 0)) for y in years]


def details(inv: cottom.Inventory, ocean: dict, trade: dict, taiwan: dict) -> None:
    mean, p5, p95 = inv.countries["mean"], inv.countries["p5"], inv.countries["p95"]
    years = trade["years"]
    isos = set(mean) | set(ocean["totals"]) | set(trade["totals"]["export"]) | set(trade["totals"]["import"])
    (OUT / "countries").mkdir(parents=True, exist_ok=True)
    for old in (OUT / "countries").glob("*.json"):
        old.unlink()
    for iso in sorted(isos):
        out: dict[str, object] = {}
        if iso in mean:
            c = mean[iso]
            out["spot"] = {
                "em": round(c["plas_em"]),
                "range": [round(p5[iso]["plas_em"]), round(p95[iso]["plas_em"])],
                "debris": round(c["plas_debris_em"]),
                "burn": round(c["plas_burn_em"]),
                "sources": {k: round(c[f]) for k, f in SOURCES.items()},
                "pwg": round(c["pwg"]),
                "collection": round(c["col_cov_pct_gen_exc_lit"], 1),
                "controlled": round(c["man_cont_pct_gen"], 1),
                "noCollection": round(c["people_no_col"]),
            }
        if iso in ocean["totals"]:
            pts = ocean["outlets"][iso]
            out["ocean"] = {
                "total": round(ocean["totals"][iso], 1),
                "rank": ocean["rank"][iso],
                "of": ocean["of"],
                "outlets": len(pts),
                "top": [[round(o[0], 2), round(o[1], 2), round(o[2], 1)] for o in pts[:5]],
            }
        trade_block: dict[str, object] = {}
        for direction in ("export", "import"):
            total = trade["totals"][direction].get(iso)
            if not total:
                continue
            partners = trade["pairs"][direction].get(iso, {})
            ranked = sorted(partners, key=lambda p: -sum(partners[p].values()))[:HISTORY_PARTNERS]
            other = {y: total.get(y, 0) - sum(partners[p].get(y, 0) for p in ranked) for y in years}
            trade_block[direction] = {
                "partners": [[p, _series(partners[p], years)] for p in ranked],
                "other": _series({y: max(0.0, v) for y, v in other.items()}, years),
            }
        if trade_block:
            out["trade"] = {"years": years, **trade_block}
        if iso == TAIWAN:
            out["taiwan"] = taiwan
        write_json(OUT / "countries" / f"{iso}.json", out, quiet=True)
    size = sum(p.stat().st_size for p in (OUT / "countries").glob("*.json"))
    print(f"  側欄明細 {len(isos)} 國，共 {size / 1024:.0f} KB")
