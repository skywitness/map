"""政府財政與稅：政府的利息負擔（2026-11-05，製作手冊第二十二批 380；步驟 fiscal-interest）。

- 利息支出占政府收入（GC.XPN.INTP.RV.ZS）、占政府支出（GC.XPN.INTP.ZS）：World Bank WDI，原始來源是 IMF 的
  Government Finance Statistics Yearbook，CC BY 4.0。WDI 的 GC. 序列是**中央政府**，聯邦國家（美國、德國）的利息
  有一部分在州政府，會比一般政府低。分子是現金基礎的利息支出（不含折價攤銷）。
- 各國最新的年份不同（2024 年約 110 國，其他到 2021–2023 年），指標檔用 latestWithin，tooltip 寫資料年份。
- 台灣：WDI 沒有台灣。用財政部財政統計資料庫的各級政府歲出政事別（i0121）的「債務支出」（公債的利息與手續費；
  還本是融資支出，不在歲出裡）÷ 各級政府歲入淨額、歲出淨額（i0101），1991 年起。台灣算的是**各級政府**（中央加地方），
  範圍比 WDI 的中央政府寬，附註寫明。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, latest_year_span, to_series, write_json
from sources import mof, worldbank

OUT = OUT_DIR / "topics" / "fiscal" / "interest"
WITHIN = 5
CODES = {"revenue": "GC.XPN.INTP.RV.ZS", "expense": "GC.XPN.INTP.ZS"}


def _taiwan() -> dict[str, dict[int, float]]:
    spending = mof.table("i0121", 51, 11)
    totals = mof.table("i0101", 80)
    out: dict[str, dict[int, float]] = {"revenue": {}, "expense": {}}
    for year, row in totals.items():
        interest = spending.get(year, {}).get("債務支出")
        if interest is None:
            continue
        out["revenue"][year] = interest / row["歲入淨額"] * 100
        out["expense"][year] = interest / row["歲出淨額"] * 100
    return out


def build() -> None:
    taiwan = _taiwan()
    for key, code in CODES.items():
        series, world = worldbank.fetch(code, 1972)
        series["TWN"] = taiwan[key]
        years = latest_year_span(series, WITHIN)
        last_tw = max(taiwan[key])
        notes = {"TWN": (
            f"WDI 沒有台灣，改用財政部財政統計資料庫：各級政府（中央加地方）歲出的「債務支出」（公債的利息與手續費）"
            f"÷ {'歲入淨額' if key == 'revenue' else '歲出淨額'}，{last_tw} 年 {taiwan[key][last_tw]:.1f}%。"
            "範圍比其他國家（中央政府）寬。"
        )}
        notes_en = {"TWN": (
            "Taiwan is not in the WDI; Ministry of Finance fiscal statistics are used instead: debt expenditure (interest and fees on "
            f"public debt) of all levels of government (central and local) ÷ net {'revenue' if key == 'revenue' else 'expenditure'}, "
            f"{taiwan[key][last_tw]:.1f}% in {last_tw}. The scope is wider than the central-government figures for other countries."
        )}
        write_json(OUT / f"{key}.json", indicator_file(
            f"interest-{key}", "%", years,
            {c: to_series(s, years, 1) for c, s in sorted(series.items()) if any(y in s for y in years)},
            aggregates={"WLD": to_series(world, years, 1)} if world else {},
            latestWithin=WITHIN, notes=notes, notesEn=notes_en,
        ))
        latest = {c: (max(s), s[max(s)]) for c, s in series.items() if max(s) >= years[-1] - WITHIN + 1}
        top = sorted(latest.items(), key=lambda kv: -kv[1][1])
        by_year: dict[int, int] = {}
        for _c, (y, _v) in latest.items():
            by_year[y] = by_year.get(y, 0) + 1
        print(f"  利息占{key}：{years[0]}–{years[-1]}，{len(latest)} 國（{dict(sorted(by_year.items(), reverse=True))}）；"
              f"台灣 {last_tw} 年 {taiwan[key][last_tw]:.2f}%；最高 {[(c, y, round(v, 1)) for c, (y, v) in top[:5]]}；"
              f"最低 {[(c, y, round(v, 1)) for c, (y, v) in top[-4:]]}；世界 {sorted(world.items())[-1:] if world else None}")
