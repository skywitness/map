"""菸酒：啤酒產量（2026-11-05，製作手冊第二十二批 385；步驟 beer-production，輸出到 topics/tobacco-alcohol/）。

- 資料：FAOSTAT QCL（農業主題下載的同一個檔，CC BY 4.0）的 Item 51「Beer of barley; malted」、Element 5510 Production，
  公噸（啤酒的密度約 1.01，公升數跟公噸數差不多）。只有大麥麥芽啤酒。區域合計與「China」由 sources/faostat.py 排除。
- **Flag X 不畫**（使用者 2026-11-05 決定）：2023 年 170 國裡 134 國的數字是「Figure from external organization」，
  FAO 條款寫第三方資料要原提供者同意才能再散布，授權待確認，所以只用官方（A）與 FAO 自己的估計、推算（E、I 等）。
  地圖會少很多國家，說明寫原因；被拿掉的國家用 noValue 寫「FAO 的數字來自外部機構，沒有用」。
- 每人每年產量（公升）= 產量 ÷ 1.01 × 1000 ÷ 人口（人口主題的 WPP 2024），跟菸酒主題的人均飲酒量是兩件事（產量含出口）。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import faostat
from topics.profiles import _read_indicator

OUT = OUT_DIR / "topics" / "tobacco-alcohol"
BEER, PRODUCTION = 51, 5510
DENSITY = 1.01  # 公斤／公升


def build() -> None:
    kept: dict[str, dict[int, float]] = defaultdict(dict)
    external: dict[str, set[int]] = defaultdict(set)
    flags: dict[str, int] = defaultdict(int)
    for r in faostat.rows("QCL", {PRODUCTION}, {BEER}):
        flags[r.flag] += 1
        if r.flag == "X":
            external[r.area].add(r.year)
            continue
        kept[r.area][r.year] = r.value
    world = kept.pop("WLD", {})
    external.pop("WLD", None)
    # 年份不依涵蓋率截尾（year_span）：拿掉 X 以後近年只剩約 40 國，但那些國家的數字是實在的，時間軸照樣到最新一年
    all_years = {y for s in kept.values() for y in s} | {y for ys in external.values() for y in ys}
    years = list(range(min(all_years), max(all_years) + 1))
    last = years[-1]
    no_value = {c: "FAO 的數字來自外部機構，授權待確認，沒有用" for c, ys in external.items() if c not in kept or last in ys}
    no_value_en = {c: "FAO’s figure comes from an external organisation; licence unconfirmed, so not used" for c in no_value}
    write_json(OUT / "beer-production.json", indicator_file(
        "beer-production", "公噸", years, {c: to_series(s, years, 0) for c, s in sorted(kept.items())},
        noValue=no_value, noValueEn=no_value_en,
    ))
    population = _read_indicator(OUT_DIR / "topics" / "population" / "total.json")
    pop_years = population["years"]
    per_capita: dict[str, dict[int, float]] = {}
    for c, s in kept.items():
        pop = population["values"].get(c)
        if not pop:
            continue
        per_capita[c] = {y: round(v / DENSITY * 1000 / pop[pop_years.index(y)], 2)
                         for y, v in s.items() if y in pop_years and pop[pop_years.index(y)]}
    write_json(OUT / "beer-per-capita.json", indicator_file(
        "beer-per-capita", "公升", years, {c: to_series(s, years, 2) for c, s in sorted(per_capita.items()) if s},
        noValue=no_value, noValueEn=no_value_en,
    ))
    in_last = {c: s[last] for c, s in kept.items() if last in s}
    top = sorted(in_last.items(), key=lambda kv: -kv[1])[:10]
    pc = sorted(((s.get(last), c) for c, s in per_capita.items() if s.get(last)), reverse=True)[:6]
    print(f"  啤酒產量 {years[0]}–{last}：旗標 {dict(flags)}；{last} 年 {len(in_last)} 國（X 拿掉 {sum(1 for ys in external.values() if last in ys)} 國）；"
          f"{[(c, round(v / 1e4)) for c, v in top]} 萬公噸；台灣 {kept.get('TWN', {}).get(last)}（1961 年 {kept.get('TWN', {}).get(1961)}）；"
          f"每人 {pc}；世界（含 X）{world.get(last)}")
