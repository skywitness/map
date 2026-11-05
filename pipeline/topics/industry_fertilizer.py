"""產業結構與工業：化肥的產量與自給率（2026-11-05，製作手冊第二十二批 384；步驟 industry-fertilizer，輸出 topics/industry/fertilizer/）。

- 資料：FAOSTAT Inputs「Fertilizers by Nutrient」（RFN，CC BY 4.0，FAO 統計資料庫條款），三種養分：氮 N（3102）、
  磷 P₂O₅（3103）、鉀 K₂O（3104）；產量（5510）、農業施用量（5157）、進口（5610）、出口（5910），公噸**養分量**
  （不是尿素、磷酸二銨這類實物量，差 2 到 5 倍）。區域合計與「China」（含港澳台）由 sources/faostat.py 排除；台灣是 M49 158。
- 自給率 = 產量 ÷ 農業施用量 × 100%。化肥有庫存與轉口，自給率不是糧食安全指標；施用量是 0 的國家不算。
- 第三方資料：FAO 條款寫第三方提供的資料要原提供者同意才能再散布。使用者 2026-11-05 對啤酒產量（385）決定 Flag X
  （外部機構提供）不畫，這裡同樣處理：X 的值都不用（2024 年產量沒有 X，施用量有 12 筆）。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, to_series, write_json, year_span
from sources import faostat

OUT = OUT_DIR / "topics" / "industry" / "fertilizer"
NUTRIENTS = {3102: "nitrogen", 3103: "phosphate", 3104: "potash"}
PRODUCTION, USE, IMPORT, EXPORT = 5510, 5157, 5610, 5910


def build() -> None:
    data: dict[int, dict[int, dict[str, dict[int, float]]]] = {
        e: {n: defaultdict(dict) for n in NUTRIENTS} for e in (PRODUCTION, USE, IMPORT, EXPORT)
    }
    dropped: dict[int, int] = defaultdict(int)
    for r in faostat.rows("RFN", {PRODUCTION, USE, IMPORT, EXPORT}, set(NUTRIENTS)):
        if r.flag == "X":
            dropped[r.element] += 1
            continue
        data[r.element][r.item][r.area][r.year] = r.value
    print(f"  Flag X（外部機構提供）不用：{dict(dropped)}")
    detail: dict[str, list] = {}
    for item, key in NUTRIENTS.items():
        prod = data[PRODUCTION][item]
        world = prod.pop("WLD", {})
        years = year_span(prod)
        write_json(OUT / "production" / f"{key}.json", indicator_file(
            f"fertilizer-production/{key}", "公噸", years, {c: to_series(s, years, 0) for c, s in sorted(prod.items())},
            aggregates={"WLD": to_series(world, years, 0)},
        ))
        use = data[USE][item]
        use.pop("WLD", None)
        ratio = {c: {y: round(v / use[c][y] * 100, 1) for y, v in s.items() if use.get(c, {}).get(y)} for c, s in prod.items()}
        # 有施用量、沒有產量列的國家：產量當 0（FAOSTAT 只列有生產的國家）
        for c, s in use.items():
            if c not in prod:
                ratio[c] = {y: 0.0 for y, v in s.items() if v}
        ratio = {c: s for c, s in ratio.items() if s}
        ry = year_span(ratio)
        write_json(OUT / "self-sufficiency" / f"{key}.json", indicator_file(
            f"fertilizer-self-sufficiency/{key}", "%", ry, {c: to_series(s, ry, 1) for c, s in sorted(ratio.items())},
        ))
        last = years[-1]
        top = sorted(((s.get(last, 0), c) for c, s in prod.items()), reverse=True)[:6]
        print(f"  {key}：產量 {years[0]}–{last}，{last} 年 {[(c, round(v / 1e4)) for v, c in top]} 萬公噸；世界 {world.get(last, 0) / 1e4:,.0f} 萬；"
              f"自給率 台灣 {ratio.get('TWN', {}).get(last)}%、加拿大 {ratio.get('CAN', {}).get(last)}%")
    # 側欄：每國最近一年（2024）三種養分的 [產量, 施用, 進口, 出口]
    last = max(y for s in data[PRODUCTION][3102].values() for y in s)
    countries = {c for e in data.values() for n in e.values() for c in n if c != "WLD"}
    for c in sorted(countries):
        rows = [[data[e][item].get(c, {}).get(last) for e in (PRODUCTION, USE, IMPORT, EXPORT)] for item in NUTRIENTS]
        if any(v is not None for row in rows for v in row):
            detail[c] = [[None if v is None else round(v) for v in row] for row in rows]
    write_json(OUT / "detail.json", {"year": last, "nutrients": list(NUTRIENTS.values()), "countries": detail})
    print(f"  台灣 {last}：{detail.get('TWN')}")
