"""石油庫存與撐得了幾天（2026-11-07，製作手冊第二十五批 529，候選 1206；擴充「石油、天然氣與煤」）。

原本只用 EIA（8 國）；本機 session 查到 JODI 的條款只寫「All such rights are reserved」，使用者 2026-11-07 決定照 NCD-RisC 的前例
改用 JODI-Oil World Database（sources/jodi.py）：照 How to Cite 註明、標只准非商業、只放算好的數值。
JODI 的品質燈號白色（3，「data has not been assessed」）使用者決定也畫，tooltip 提示「JODI 尚未評估」。

- 石油庫存（oil-stocks）：每年 12 月底的原油（CRUDEOIL）加油品（TOTPRODS）期末庫存（CLOSTLV，千桶 → 百萬桶），兩個都有才算，
  2002–2025。政府的戰略儲備算不算進去各國不同（JODI 收的是國家申報的庫存）。
- 撐得了幾天（oil-stock-days）：12 月底的庫存 ÷ 那一年平均每天的油品需求（TOTPRODS 的 TOTDEMO，千桶/日，12 個月的平均，
  少於 MIN_MONTHS 個月的不算）。
- 每月的石油庫存（oil-stocks-monthly）：每個月底的原油加油品庫存，時間軸是月份的編號（2000 年 1 月是 0，同電價的月價），
  2002 年 1 月到最新一個月。
輸出 public/data/topics/fossil-fuels/{oil-stocks,oil-stock-days,oil-stocks-monthly}.json。
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date

from common import OUT_DIR, indicator_file, write_json
from sources import jodi
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "fossil-fuels"
CURRENT = date.today().year
LAST_YEAR = CURRENT - 1  # 有 12 月的最後一年
MIN_MONTHS = 10
NOT_ASSESSED = "3"
EXTRA = {"license": "JODI terms of use (all rights reserved; non-commercial use with attribution)", "attribution": jodi.CITATION}


def _month_index(period: str) -> int:
    y, m = period.split("-")
    return (int(y) - 2000) * 12 + int(m) - 1


def build() -> None:
    # (國家, 月份編號) → 值與燈號
    crude: dict[tuple[str, int], tuple[float, str]] = {}
    prods: dict[tuple[str, int], tuple[float, str]] = {}
    demand: dict[tuple[str, int], tuple[float, str]] = {}
    for kind in ("primary", "secondary"):
        for r in jodi.rows(kind, CURRENT):
            v = jodi.value(r)
            iso3 = from_alpha2(r["REF_AREA"])
            if v is None or not iso3:
                continue
            key = (iso3, _month_index(r["TIME_PERIOD"]))
            if r["FLOW_BREAKDOWN"] == "CLOSTLV":
                (crude if r["ENERGY_PRODUCT"] == "CRUDEOIL" else prods)[key] = (v, r["ASSESSMENT_CODE"])
            elif r["FLOW_BREAKDOWN"] == "TOTDEMO":
                demand[key] = (v, r["ASSESSMENT_CODE"])

    # 每月的庫存（原油加油品，兩個都有才算）
    total: dict[tuple[str, int], tuple[float, bool]] = {}
    for key, (c, cc) in crude.items():
        if key in prods:
            p, pc = prods[key]
            if c + p > 0:
                total[key] = (c + p, NOT_ASSESSED in (cc, pc))
    countries = sorted({k[0] for k in total})
    last_month = max(m for _, m in total)
    months = list(range(_month_index(f"{jodi.FIRST_YEAR}-01"), last_month + 1))
    monthly = {c: [round(total[(c, m)][0] / 1000, 2) if (c, m) in total else None for m in months] for c in countries}

    years = list(range(jodi.FIRST_YEAR, LAST_YEAR + 1))
    vol: dict[str, list[float | None]] = {}
    days: dict[str, list[float | None]] = {}
    unassessed: set[str] = set()
    for c in countries:
        v_row, d_row = [], []
        for y in years:
            dec = _month_index(f"{y}-12")
            stock = total.get((c, dec))
            v_row.append(round(stock[0] / 1000, 2) if stock else None)
            dem = [demand[(c, m)][0] for m in range(dec - 11, dec + 1) if (c, m) in demand]
            if stock and len(dem) >= MIN_MONTHS and sum(dem) > 0:
                d_row.append(round(stock[0] / (sum(dem) / len(dem)), 1))
            else:
                d_row.append(None)
            if y == LAST_YEAR and stock and stock[1]:
                unassessed.add(c)
        if any(v is not None for v in v_row):
            vol[c] = v_row
        if any(v is not None for v in d_row):
            days[c] = d_row
    # 最新一個月是白色的國家也提示（每月的指標）
    unassessed_monthly = {c for c in countries if (c, last_month) in total and total[(c, last_month)][1]}

    def hints(codes: set[str]) -> dict:
        zh = {c: "JODI 尚未評估這國的數字（品質燈號白色：data has not been assessed）" for c in sorted(codes)}
        en = {c: "JODI has not assessed this country's figures (white quality flag: data has not been assessed)" for c in sorted(codes)}
        return {"hints": zh, "hintsEn": en}

    write_json(OUT / "oil-stocks.json", indicator_file("oil-stocks", "million barrels", years, vol, **hints(unassessed), **EXTRA))
    write_json(OUT / "oil-stock-days.json", indicator_file("oil-stock-days", "days", years, days, **hints(unassessed & set(days)), **EXTRA))
    write_json(
        OUT / "oil-stocks-monthly.json",
        indicator_file("oil-stocks-monthly", "million barrels", months, monthly, **hints(unassessed_monthly), **EXTRA),
    )

    i = years.index(LAST_YEAR)
    print(f"  石油庫存 {len(vol)} 國（{LAST_YEAR} 年有值 {sum(1 for v in vol.values() if v[i] is not None)}）；白色 {sorted(unassessed)}")
    print(f"  {LAST_YEAR}：{sorted(((v[i], k) for k, v in vol.items() if v[i] is not None), reverse=True)[:20]}")
    top = sorted(((v[i], k) for k, v in days.items() if v[i] is not None), reverse=True)
    print(f"  撐得了幾天 {LAST_YEAR}（{len(top)} 國）：多 {top[:15]}；少 {top[-10:]}")
    y0, m0 = divmod(last_month, 12)
    print(f"  每月：{len(monthly)} 國，到 {2000 + y0}-{m0 + 1:02d}；白色 {sorted(unassessed_monthly)}")
    for k in ("TWN", "USA", "JPN", "KOR", "CHN", "SAU", "IND", "DEU"):
        if k in vol:
            print(f"  {k}：庫存 2021 {vol[k][years.index(2021)]}、2022 {vol[k][years.index(2022)]}、{LAST_YEAR} {vol[k][i]}；"
                  f"天數 {days.get(k, [None] * len(years))[i]}")
