"""服務出口的組成：運輸、旅行、資訊與通訊、保險與金融（製作手冊第十七批 271，2026-11-02）。

輸出到貿易主題（topics/trade/）：
- services-export.json：服務出口（美元，WDI BX.GSR.NFSV.CD），地圖是比例圓，圓餅分成下面五類。
- services-share.json：服務占商品與服務出口的比例（BX.GSR.NFSV.CD ÷ BX.GSR.GNFS.CD）。
- services-mix/<類>.json：各類占服務出口的比例。運輸 BX.GSR.TRAN.ZS、旅行 BX.GSR.TRVL.ZS、
  資訊與通訊 BX.GSR.CCIS.ZS（電信、電腦與資訊服務）、保險與金融 BX.GSR.INSF.ZS，其他 ＝ 100 減這四類。
  不用 BX.GSR.CMCP.ZS（「Communications, computer, etc.」）：它是包括其他事務服務、智慧財產權使用費、加工、營建…
  的大剩餘類別，而且不少國家缺項（2024 年英國、香港、中國的四類加起來只有 64–75%），資訊服務要用 CCIS（手冊的陷阱）。
  四類都有才算組成（加起來才是 100%，圓餅才不會把缺的那一類分給別的）。

WDI 轉載 IMF 國際收支（BPM6），metadata 寫 CC BY-4.0（DESIGN.md 第 211 點）。WDI 沒有台灣：台灣用中央銀行國際收支
BPP2Y01（sources/cbc.py，政府資料開放授權條款），保險與金融 ＝ 保險及退休金服務＋金融服務，資訊與通訊 ＝ 電信、電腦及資訊服務。
年份從 FIRST_YEAR 起（IMF 的 BPM6 序列多半從 2005 年開始，之前資訊服務只有少數國家）。
世界值：金額與占出口用 WDI 的 WLD 加台灣；組成用四類都有的國家（含台灣）依服務出口加權，涵蓋不到 WLD 服務出口
WORLD_COVERAGE 的年份不給。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, to_series, write_json, year_span
from sources import cbc, worldbank

OUT = OUT_DIR / "topics" / "trade"
FIRST_YEAR = 2005
# WDI 的快取檔名不含起訖年，跟觀光主題（tourism.py 的 build_travel）用同一個起始年，誰先跑結果都一樣
FETCH_FROM = 1995
WORLD_COVERAGE = 0.9

# 前端 trade.ts 的 SERVICE_GROUPS 同一組 id 與順序
GROUPS: list[tuple[str, str | None]] = [
    ("transport", "BX.GSR.TRAN.ZS"),
    ("travel", "BX.GSR.TRVL.ZS"),
    ("ict", "BX.GSR.CCIS.ZS"),
    ("finance", "BX.GSR.INSF.ZS"),
    ("other", None),  # 100 減上面四類
]

TW_TOTAL = "服務-收入"
TW_GOODS = "商品-收入"
TW_PARTS = {
    "transport": ["服務-運輸-收入"],
    "travel": ["服務-旅行-收入"],
    "ict": ["服務-其他服務-電信、電腦及資訊服務-收入"],
    "finance": ["服務-其他服務-保險及退休金服務-收入", "服務-其他服務-金融服務-收入"],
}
# 台灣「其他」裡的細項（附註用）
TW_OTHER = {
    "服務-其他服務-其他事務服務-收入": ("其他事務服務", "other business services"),
    "服務-加工服務-收入": ("加工服務", "manufacturing services"),
    "服務-其他服務-智慧財產權使用費-收入": ("智慧財產權使用費", "charges for intellectual property"),
    "服務-維修服務-收入": ("維修服務", "maintenance and repair"),
    "服務-其他服務-營建-收入": ("營建", "construction"),
    "服務-其他服務-個人、文化與休閒服務-收入": ("個人、文化與休閒服務", "personal, cultural and recreational services"),
    "服務-其他服務-不包括在其他項目的政府服務-收入": ("政府服務", "government services"),
}


def taiwan() -> tuple[dict[int, float], dict[int, float], dict[str, dict[int, float]], dict[str, dict[int, float]]]:
    """（服務收入〔美元〕、商品收入〔美元〕、{類: {年: %}}、其他的細項 {欄名: {年: 百萬美元}}）"""
    columns = [TW_TOTAL, TW_GOODS, *[c for cs in TW_PARTS.values() for c in cs], *TW_OTHER]
    bop = cbc.balance_of_payments(columns)
    total = {y: v * 1e6 for y, v in bop[TW_TOTAL].items() if y >= FIRST_YEAR}
    goods = {y: v * 1e6 for y, v in bop[TW_GOODS].items() if y >= FIRST_YEAR}
    mix: dict[str, dict[int, float]] = {g: {} for g, _ in GROUPS}
    for y, t in total.items():
        known = 0.0
        for g, cols in TW_PARTS.items():
            v = sum(bop[c].get(y, 0.0) for c in cols) * 1e6 / t * 100
            mix[g][y] = v
            known += v
        mix["other"][y] = 100 - known
    return total, goods, mix, {c: bop[c] for c in TW_OTHER}


def build() -> None:
    services, services_world = worldbank.fetch("BX.GSR.NFSV.CD", FETCH_FROM)
    exports, exports_world = worldbank.fetch("BX.GSR.GNFS.CD", FETCH_FROM)
    shares = {g: worldbank.fetch(code, FETCH_FROM)[0] for g, code in GROUPS if code}
    tw_total, tw_goods, tw_mix, tw_other = taiwan()

    # 組成：四類都有才算，其他 ＝ 100 減四類
    mix: dict[str, dict[str, dict[int, float]]] = {g: {} for g, _ in GROUPS}
    negative = []
    for iso3 in services:
        for y in (y for y in services[iso3] if y >= FIRST_YEAR):
            parts = [shares[g].get(iso3, {}).get(y) for g, code in GROUPS if code]
            if any(v is None for v in parts):
                continue
            other = 100 - sum(parts)
            if other < -0.5:
                negative.append((iso3, y, round(other, 1)))
                continue
            for (g, _), v in zip(GROUPS, [*parts, max(other, 0.0)]):
                mix[g].setdefault(iso3, {})[y] = v
    if negative:
        print(f"  ⚠ 四類加起來超過 100%，不算組成：{negative}")
    for g, _ in GROUPS:
        mix[g]["TWN"] = tw_mix[g]
    services["TWN"] = tw_total

    years = [y for y in year_span(services) if y >= FIRST_YEAR]
    last = years[-1]

    # 世界值：WLD 加台灣
    world_services = {y: v + tw_total.get(y, 0.0) for y, v in services_world.items()}
    world_exports = {y: v + tw_total.get(y, 0.0) + tw_goods.get(y, 0.0) for y, v in exports_world.items()}
    share = {iso3: {y: v / exports[iso3][y] * 100 for y, v in s.items() if exports.get(iso3, {}).get(y)}
             for iso3, s in services.items() if iso3 != "TWN"}
    share["TWN"] = {y: v / (v + tw_goods[y]) * 100 for y, v in tw_total.items() if y in tw_goods}
    share_world = {y: v / world_exports[y] * 100 for y, v in world_services.items() if world_exports.get(y)}

    # 組成的世界值：四類都有的國家依服務出口加權
    mix_world: dict[str, dict[int, float]] = {g: {} for g, _ in GROUPS}
    coverage = {}
    for y in years:
        weights = {iso3: services[iso3][y] for iso3 in mix["transport"] if y in mix["transport"][iso3] and services.get(iso3, {}).get(y)}
        covered = sum(weights.values())
        coverage[y] = covered / world_services[y] if world_services.get(y) else 0
        if coverage[y] < WORLD_COVERAGE:
            continue
        for g, _ in GROUPS:
            mix_world[g][y] = sum(mix[g][iso3][y] * w for iso3, w in weights.items()) / covered

    tw_year = max(tw_total)
    note_mix, note_mix_en = taiwan_mix_note(tw_year, tw_total, tw_mix, tw_other)
    notes = {
        "services-export": ("服務出口用中央銀行國際收支（BPP2Y01）的服務收入。",
                            "Service exports are services receipts from the Central Bank of the Republic of China (Taiwan) balance of payments (BPP2Y01)."),
        "services-share": ("中央銀行國際收支的服務收入 ÷（商品收入＋服務收入）。",
                           "Services receipts ÷ (goods receipts + services receipts) from the Central Bank of the Republic of China (Taiwan) balance of payments."),
    }

    write_json(OUT / "services-export.json", indicator_file(
        "services-export", "美元", years, {iso3: to_series(s, years, 0) for iso3, s in services.items() if any(y in s for y in years)},
        aggregates={"WLD": to_series(world_services, years, 0)},
        notes={"TWN": notes["services-export"][0]}, notesEn={"TWN": notes["services-export"][1]}))
    write_json(OUT / "services-share.json", indicator_file(
        "services-share", "%", years, {iso3: to_series(s, years, 2) for iso3, s in share.items() if any(y in s for y in years)},
        aggregates={"WLD": to_series(share_world, years, 2)},
        notes={"TWN": notes["services-share"][0]}, notesEn={"TWN": notes["services-share"][1]}))
    for g, _ in GROUPS:
        write_json(OUT / "services-mix" / f"{g}.json", indicator_file(
            f"services-mix/{g}", "%", years, {iso3: to_series(s, years, 2) for iso3, s in mix[g].items() if any(y in s for y in years)},
            aggregates={"WLD": to_series(mix_world[g], years, 2)},
            notes={"TWN": note_mix}, notesEn={"TWN": note_mix_en}), quiet=g != "transport")

    # 摘要
    n_mix = sum(1 for s in mix["transport"].values() if last - 1 in s)
    print(f"  服務出口 {len(services)} 個國家與地區，{years[0]}–{last}；{last - 1} 年 {sum(1 for s in services.values() if last - 1 in s)} 國，"
          f"組成 {n_mix} 國；世界組成的涵蓋：" + "、".join(f"{y} {c:.0%}" for y, c in coverage.items() if y >= last - 3))
    print(f"  世界 {last - 1} 年服務出口 {world_services[last - 1] / 1e12:,.2f} 兆美元，占出口 {share_world[last - 1]:.1f}%；組成："
          + "、".join(f"{g} {mix_world[g].get(last - 1, float('nan')):.1f}%" for g, _ in GROUPS))
    for c in ("TWN", "IRL", "IND", "USA", "JPN", "KOR", "CHN", "SGP", "GBR", "PHL", "THA"):
        y = tw_year if c == "TWN" else last - 1
        if y not in mix["transport"].get(c, {}):
            continue
        print(f"    {c} {y} 年 {services[c][y] / 1e8:,.1f} 億美元（占出口 {share[c].get(y, float('nan')):.1f}%）："
              + "、".join(f"{g} {mix[g][c][y]:.1f}%" for g, _ in GROUPS))
    ict = sorted(((c, s[last - 1]) for c, s in mix["ict"].items() if last - 1 in s and services[c].get(last - 1, 0) >= 1e9), key=lambda kv: -kv[1])
    print(f"    {last - 1} 年資訊與通訊占比最高（服務出口 10 億美元以上）：{[(c, round(v, 1)) for c, v in ict[:8]]}")


def taiwan_mix_note(year: int, total: dict[int, float], mix: dict[str, dict[int, float]], other: dict[str, dict[int, float]]) -> tuple[str, str]:
    t = total[year] / 1e6
    parts = sorted(((c, other[c].get(year, 0.0) / t * 100) for c in TW_OTHER), key=lambda kv: -kv[1])
    big = [(TW_OTHER[c], v) for c, v in parts if v >= 1]
    zh = (f"中央銀行國際收支（BPP2Y01）：保險與金融是保險及退休金服務加金融服務，資訊與通訊是電信、電腦及資訊服務。"
          f"{year} 年其他服務 {mix['other'][year]:.1f}% 裡，" + "、".join(f"{n[0]} {v:.1f}%" for n, v in big) + "。")
    en = (f"Central Bank of the Republic of China (Taiwan) balance of payments (BPP2Y01): insurance and finance combine insurance and pension "
          f"services with financial services; ICT is telecommunications, computer and information services. Of the {mix['other'][year]:.1f}% "
          f"in other services in {year}: " + ", ".join(f"{n[1]} {v:.1f}%" for n, v in big) + ".")
    return zh, en
