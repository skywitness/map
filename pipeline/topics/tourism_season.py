"""觀光：旅遊的季節性（第二十一批 350）與過度觀光（351）（2026-11-04）。

- Eurostat `tour_occ_nim`（旅宿業的月別住宿夜數，CC BY 4.0）：旅館、度假住宿、露營地合計（nace_r2 = I551-I553，
  露營地的季節性比旅館強很多，混在一起是全部住宿的樣子）、全部旅客（c_resid = TOTAL）、人次（unit = NR）。
  12 個月都有值的年份才算。
- 350 最旺的月份：住宿夜數最多的月份（同樣多取較早的），與那個月占全年的比例（12 個月平均是 8.3%）。2020–2021 年
  疫情打亂季節，預設年份用 2024。只看「最旺月」看不出雙峰，tooltip 寫第二旺與最淡的月份。
  台灣：觀光署的月別來臺旅客要請本機 session 下載（觀光統計資料庫是 SPA、沒有免金鑰的 API），還沒有。
- 351 過度觀光：一年的住宿夜數 ÷ 人口（每個居民一年承受幾個觀光客夜，人口用 UN WPP 2024）、÷ 陸地面積
  （每平方公里，World Bank 的 AG.LND.TOTL.K2）。台灣沒有可比的旅宿住宿夜數，不畫。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import worldbank, wpp
from topics.tourism_flows import _geo, eurostat

OUT = OUT_DIR / "topics" / "tourism"
FIRST = 2010
MONTHS_ZH = [f"{m} 月" for m in range(1, 13)]
MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def build() -> None:
    _, _, rows = eurostat("tour_occ_nim")
    monthly: dict[str, dict[int, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    for key, vals in rows:
        if key["unit"] != "NR" or key["nace_r2"] != "I551-I553" or key["c_resid"] != "TOTAL":
            continue
        iso3 = _geo(key["geo"])
        if not iso3:
            continue
        for p, v in vals.items():
            y, m = int(p[:4]), int(p[5:7])
            if y >= FIRST:
                monthly[iso3][y][m] = v
    peak: dict[str, dict[int, float]] = defaultdict(dict)
    peak_share: dict[str, dict[int, float]] = defaultdict(dict)
    nights: dict[str, dict[int, float]] = defaultdict(dict)
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    hint_year = 2024
    for iso3, years in monthly.items():
        for y, months in years.items():
            if len(months) != 12:
                continue
            total = sum(months.values())
            if not total:
                continue
            top = max(months.values())
            m = min(k for k, v in months.items() if v == top)
            peak[iso3][y] = m
            peak_share[iso3][y] = top / total * 100
            nights[iso3][y] = total
            if y == hint_year:
                ranked = sorted(months.items(), key=lambda kv: -kv[1])
                second = ranked[1]
                low = ranked[-1]
                hints[iso3] = (f"{hint_year} 年：最旺 {m} 月 {top / total:.1%}、第二 {second[0]} 月 {second[1] / total:.1%}、"
                               f"最淡 {low[0]} 月 {low[1] / total:.1%}")
                hints_en[iso3] = (f"{hint_year}: busiest {MONTHS_EN[m - 1]} {top / total:.1%}, second {MONTHS_EN[second[0] - 1]} "
                                  f"{second[1] / total:.1%}, quietest {MONTHS_EN[low[0] - 1]} {low[1] / total:.1%}")
    years = sorted({y for s in nights.values() for y in s})
    pending = {"TWN": "台灣的月別旅客資料（交通部觀光署）還在整理，之後補上"}
    pending_en = {"TWN": "Taiwan’s monthly visitor data (Tourism Administration) has not been added yet"}
    write_json(OUT / "peak-month.json", indicator_file(
        "peak-month", "月", years, {c: to_series(s, years, 0) for c, s in sorted(peak.items())},
        hints=hints, hintsEn=hints_en, noValue=pending, noValueEn=pending_en))
    write_json(OUT / "peak-share.json", indicator_file(
        "peak-share", "%", years, {c: to_series(s, years, 1) for c, s in sorted(peak_share.items())},
        hints=hints, hintsEn=hints_en, noValue=pending, noValueEn=pending_en))
    # 351
    pop = wpp.demographic(["TPopulation1July"], last_year=max(years))["TPopulation1July"]
    land, _ = worldbank.fetch("AG.LND.TOTL.K2", FIRST, max(years))
    per_resident: dict[str, dict[int, float]] = defaultdict(dict)
    per_km2: dict[str, dict[int, float]] = defaultdict(dict)
    for iso3, s in nights.items():
        for y, v in s.items():
            if iso3 in pop and pop[iso3].get(y):
                per_resident[iso3][y] = v / (pop[iso3][y] * 1000)
            area = land.get(iso3, {})
            a = area.get(y) or (area[max(area)] if area else None)
            if a:
                per_km2[iso3][y] = v / a
    no_tw = {"TWN": "台灣沒有可以跟歐洲比較的旅宿住宿夜數"}
    no_tw_en = {"TWN": "No accommodation nights for Taiwan comparable with Europe"}
    write_json(OUT / "nights-per-resident.json", indicator_file(
        "nights-per-resident", "夜／人", years, {c: to_series(s, years, 2) for c, s in sorted(per_resident.items())},
        noValue=no_tw, noValueEn=no_tw_en))
    write_json(OUT / "nights-per-km2.json", indicator_file(
        "nights-per-km2", "夜／平方公里", years, {c: to_series(s, years, 0) for c, s in sorted(per_km2.items())},
        noValue=no_tw, noValueEn=no_tw_en))
    y = 2024
    print(f"  季節性：{len(peak)} 國，{years[0]}–{years[-1]}；{y} 最旺比例 "
          f"{sorted(((round(s[y], 1), c, peak[c][y]) for c, s in peak_share.items() if y in s), reverse=True)}")
    print(f"  每個居民 {y}：{sorted(((round(s[y], 1), c) for c, s in per_resident.items() if y in s), reverse=True)}")
    print(f"  每平方公里 {y}：{sorted(((round(s[y]), c) for c, s in per_km2.items() if y in s), reverse=True)[:10]}")
