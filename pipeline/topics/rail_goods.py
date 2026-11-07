"""鐵路的擴充：鐵路運的是什麼（貨類與危險品）、國際鐵路貨運的流向（2026-11-07，製作手冊第二十七批 568，候選 1282、1283；
步驟 rail-goods，輸出 topics/transport/）。

- Eurostat `rail_go_grpgood`（依 NST 2007 的 20 個貨類，千公噸，2008 年起）：地圖是運量最大的貨類（類別圖 7 類加「其他」）。
  手冊的陷阱：GT18（混裝）與 GT19（不明貨類，多半是貨櫃裡的貨）在某些國家很大（義大利、瑞士一半以上），不能當「主要貨類」，
  比的時候扣掉；GT16（空貨櫃等運輸器材）、GT17（搬家行李）、GT20（其他）也不算。側欄列 20 類的運量。
- `rail_go_dnggood`（危險品，TOT_DANG_GDS）÷ 貨類表的總量 = 危險品的比例；`rail_go_contwgt`（裝在貨櫃與交換箱裡的貨，
  CNT_SWP、全部運輸類型）÷ 總量 = 貨櫃化的比例。
- `rail_go_intgong`（國際鐵路貨運：申報國裝車、卸車國，千公噸，2003 年起）：流向圖（一年一個流向檔），指標檔是
  各申報國運出國外的總量（c_unload=WORLD）。申報國只有歐洲 32 個；WORLD、EU27_2020、UNK 這類合計不當國家（手冊的陷阱）。
  卸車國（中國、俄羅斯、土耳其…）沒有申報，流向圖只看得到歐洲各國申報運過去的；鐵路開不到的卸車國（UNREACHABLE）不畫。
- CC BY 4.0；英國、科索沃由 sources/eurostat.py 統一排除。台灣沒有（臺鐵貨運不是開放資料集；台灣沒有跨國鐵路）。
"""
from __future__ import annotations

import gzip

from common import OUT_DIR, download, indicator_file, write_json
from sources import eurostat
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "transport"
GROUPS = ["GT%02d" % i for i in range(1, 21)]
NOT_MAIN = {"GT16", "GT17", "GT18", "GT19", "GT20"}
# 類別圖的代碼（前端 rail-goods.ts 的 GOODS 要一致）；其他貨類都是 8（「其他」）
CLASSES = {"GT03": 1, "GT10": 2, "GT02": 3, "GT07": 4, "GT01": 5, "GT08": 6, "GT04": 7}
OTHER = 8
FIRST_FLOW_YEAR = 2003
TOP_PARTNERS = 15
NON_COUNTRY = {"WORLD", "EU27_2007", "EU27_2020", "EU28", "UNK", "RS_ME"}
# 鐵路從歐洲開不到的卸車國（其他洲與島國）：零星幾筆，多半是申報成最終目的地或代碼填錯（2003 年斯洛維尼亞→特克斯與凱科斯、
# 芬蘭→南韓），不畫；總量（WORLD）照申報國的數字不動
UNREACHABLE = {"USA", "TCA", "SLE", "COD", "MOZ", "SWZ", "YEM", "BHR", "JPN", "KOR", "SGP", "IND", "IRL", "ISL", "MLT", "CYP"}


def _flows() -> tuple[dict[int, dict], dict[str, dict[int, float]]]:
    """{年: {出口國: {卸車國: 千公噸}}} 與各申報國運出國外的總量（WORLD）"""
    path = download(eurostat.URL.format(dataset="rail_go_intgong"), "eurostat", "rail_go_intgong.tsv.gz")
    flows: dict[int, dict[str, dict[str, float]]] = {}
    world: dict[str, dict[int, float]] = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        header = f.readline().rstrip("\n").split("\t")
        dims = header[0].split("\\")[0].split(",")
        years = [int(h) for h in header[1:]]
        for line in f:
            cells = line.rstrip("\n").split("\t")
            key = dict(zip(dims, cells[0].split(",")))
            if key["unit"] != "THS_T" or eurostat.noncommercial(key["geo"]):
                continue
            origin = eurostat._iso3(key["geo"])
            if not origin:
                continue
            dest_code = key["c_unload"]
            for year, cell in zip(years, cells[1:]):
                number = cell.strip().split(" ")[0]
                if number in (":", "") or float(number) <= 0:
                    continue
                if dest_code == "WORLD":
                    world.setdefault(origin, {})[year] = float(number)
                    continue
                if dest_code in NON_COUNTRY or eurostat.noncommercial(dest_code):
                    continue
                dest = eurostat._iso3(dest_code) or from_alpha2(dest_code)
                if dest and dest != origin and dest not in UNREACHABLE:
                    flows.setdefault(year, {}).setdefault(origin, {})[dest] = float(number)
    return flows, world


def build() -> None:
    g = {k: eurostat.series("rail_go_grpgood", unit="THS_T", nst07=k) for k in GROUPS + ["TOTAL"]}
    total = g["TOTAL"]
    years = sorted({y for s in total.values() for y in s})

    # 主要貨類（扣掉混裝、不明、空貨櫃、行李、其他）
    main: dict[str, list] = {}
    hints, hints_en = {}, {}
    for c, s in sorted(total.items()):
        row = []
        for y in years:
            cand = sorted(((g[k].get(c, {}).get(y) or 0, k) for k in GROUPS if k not in NOT_MAIN), reverse=True)
            row.append(CLASSES.get(cand[0][1], OTHER) if cand and cand[0][0] > 0 else None)
        main[c] = row
        y = max(s)
        unknown = sum(g[k].get(c, {}).get(y) or 0 for k in ("GT18", "GT19"))
        if s[y] and unknown / s[y] >= 0.2:
            hints[c] = f"{y} 年有 {unknown / s[y]:.0%} 是混裝或不明貨類（多半是貨櫃裡的貨），比主要貨類時扣掉"
            hints_en[c] = f"In {y}, {unknown / s[y]:.0%} was grouped or unidentifiable goods (mostly in containers), left out when picking the main group"
    write_json(OUT / "rail-goods-main.json", indicator_file(
        "rail-goods-main", "category", years, main, hints=hints, hintsEn=hints_en, license="CC BY 4.0"))

    # 側欄：20 類每年的運量
    detail = {c: {k: [g[k].get(c, {}).get(y) for y in years] for k in GROUPS + ["TOTAL"] if g[k].get(c)} for c in sorted(total)}
    write_json(OUT / "rail-goods-detail.json", {"years": years, "countries": detail, "license": "CC BY 4.0"})

    # 危險品、貨櫃化的比例
    dang = eurostat.series("rail_go_dnggood", unit="THS_T", dang_gds="TOT_DANG_GDS")
    cont = eurostat.series("rail_go_contwgt", unit="THS_T", tra_cov="TOTAL", cargo="CNT_SWP")
    for name, part in (("rail-dangerous-share", dang), ("rail-container-share", cont)):
        values = {}
        for c, s in sorted(part.items()):
            row = [round(s[y] / total[c][y] * 100, 1) if y in s and total.get(c, {}).get(y) else None for y in years]
            if any(v is not None for v in row):
                values[c] = row
        write_json(OUT / f"{name}.json", indicator_file(name, "%", years, values, license="CC BY 4.0"))

    # 國際鐵路貨運的流向
    flows, world = _flows()
    flow_years = sorted(y for y in flows if y >= FIRST_FLOW_YEAR)
    for y in flow_years:
        exp, imp = {}, {}
        for o, dests in flows[y].items():
            partners = sorted(([d, round(v)] for d, v in dests.items() if round(v) > 0), key=lambda p: -p[1])
            if partners:
                exp[o] = [round(world.get(o, {}).get(y) or sum(p[1] for p in partners)), partners[:TOP_PARTNERS]]
            for d, v in dests.items():
                if round(v) > 0:
                    imp.setdefault(d, []).append([o, round(v)])
        imp = {d: [sum(p[1] for p in ps), sorted(ps, key=lambda p: -p[1])[:TOP_PARTNERS]] for d, ps in imp.items()}
        write_json(OUT / "rail-flows" / f"{y}.json", {"item": "rail", "year": y, "unit": "千公噸", "scale": 1,
                                                      "export": dict(sorted(exp.items())), "import": dict(sorted(imp.items()))})
    # 指標檔：申報國運出國外的總量；沒有申報的卸車國用歐洲各國運過去的合計，寫在 tooltip
    out_years = sorted({y for s in world.values() for y in s if y >= FIRST_FLOW_YEAR})
    hints, hints_en = {}, {}
    received: dict[str, dict[int, float]] = {}
    for y, by_origin in flows.items():
        for o, dests in by_origin.items():
            for d, v in dests.items():
                received.setdefault(d, {})[y] = received.get(d, {}).get(y, 0) + v
    for d, s in received.items():
        if d not in world and s:
            y = max(s)
            hints[d] = f"{y} 年歐洲各國申報鐵路運到這裡 {s[y]:,.0f} 千公噸（這裡沒有申報）"
            hints_en[d] = f"In {y}, European countries reported sending {s[y]:,.0f} thousand tonnes here by rail (no report from here)"
    write_json(OUT / "rail-intl.json", indicator_file(
        "rail-intl", "千公噸", out_years, {c: [s.get(y) for y in out_years] for c, s in sorted(world.items())},
        hints=hints, hintsEn=hints_en, license="CC BY 4.0"))

    from collections import Counter
    for y in (2024, 2025):
        print(f"  {y} 主要貨類：{Counter(r[years.index(y)] for r in main.values() if y in years).most_common()}")
    for c in ("POL", "DEU", "FRA", "SWE", "ITA", "CHE"):
        print(f"    {c} 2024：{main[c][years.index(2024)]}；總量 {total[c].get(2024)}")
    print(f"  流向 {flow_years[0]}–{flow_years[-1]}；DEU 2024 運出 {world.get('DEU', {}).get(2024)}："
          f"{sorted(flows[2024]['DEU'].items(), key=lambda kv: -kv[1])[:6]}")
    for o in ("POL", "NLD", "FIN"):
        print(f"    {o}→CHN {[(y, flows.get(y, {}).get(o, {}).get('CHN')) for y in range(2019, 2026)]}")
    print(f"  不申報的卸車國：{sorted(hints)[:30]}")
