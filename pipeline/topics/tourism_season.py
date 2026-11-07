"""觀光：旅遊的季節性（第二十一批 350）與過度觀光（351）（2026-11-04）。

- Eurostat `tour_occ_nim`（旅宿業的月別住宿夜數，CC BY 4.0）：旅館、度假住宿、露營地合計（nace_r2 = I551-I553，
  露營地的季節性比旅館強很多，混在一起是全部住宿的樣子）、全部旅客（c_resid = TOTAL）、人次（unit = NR）。
  12 個月都有值的年份才算。
- 350 最旺的月份：住宿夜數最多的月份（同樣多取較早的），與那個月占全年的比例（12 個月平均是 8.3%）。2020–2021 年
  疫情打亂季節，預設年份用 2024。只看「最旺月」看不出雙峰，tooltip 寫第二旺與最淡的月份。
  台灣：交通部觀光署行政資訊網每月「觀光市場概況摘要」附的「月表 1-2 來臺旅客按居住地分析」（xlsx，資料來源內政部
  移民署）。本機 session 下載 2024 年 1 月到 2026 年 9 月的 33 個檔，放在 map-plan 的 `data/taiwan-net/`（README 有網址、
  SHA-256 與核對）；重跑前把 `residence-monthly-*.xlsx` 與 `residence-annual-2002-2025.csv`（data.gov.tw 15453 歷年來台旅客
  居住地統計，政府資料開放授權條款第 1 版）複製到 `pipeline/.cache/taiwan-net/`。用每個檔「當月」的「總計」合計欄，
  12 個月加起來要等於年資料（月別的拆分不在 data.gov.tw，但加總跟開放資料一致）。只用 2024 年起的完整年份
  （2023 年是疫後剛開放、一路往上爬，看不出季節性）。**口徑不同**：歐洲是旅宿業的住宿夜數（含本國旅客），
  台灣是入境的外國與港澳陸旅客人次（不含國人的國內旅遊），說明有寫。
- 351 過度觀光：一年的住宿夜數 ÷ 人口（每個居民一年承受幾個觀光客夜，人口用 UN WPP 2024）、÷ 陸地面積
  （每平方公里，World Bank 的 AG.LND.TOTL.K2）。台灣沒有可比的旅宿住宿夜數，不畫。
"""
from __future__ import annotations

import csv
import hashlib
import re
from collections import defaultdict

import openpyxl

from common import CACHE_DIR, OUT_DIR, download, indicator_file, to_series, write_json
from sources import worldbank, wpp
from topics.tourism_flows import _geo, eurostat

OUT = OUT_DIR / "topics" / "tourism"
FIRST = 2010
TW_DIR = CACHE_DIR / "taiwan-net"
TW_ANNUAL_SHA256 = "ba230c55c34d2a99ac91a586d7675ff63b58d0184261197b7695d72c1f75146b"
TW_FIRST = 2024  # 2023 年是疫後剛開放，看不出季節性
MONTHS_ZH = [f"{m} 月" for m in range(1, 13)]
MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def _taiwan_domestic() -> tuple[int, int, float, int, float] | None:
    """觀光署主要觀光遊憩據點各月的人次加總，最近一年的最旺、最淡月份與占比"""
    import csv

    from topics.attractions_visitors import TW_CSV
    with open(download(TW_CSV, "taiwan-net", "visitors-by-site.csv"), encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    totals: dict[int, list[float]] = {}
    for r in rows:
        if not r["年別"].isdigit():
            continue
        t = totals.setdefault(int(r["年別"]), [0.0] * 12)
        for m in range(12):
            v = (r[f"{m + 1}月"] or "").replace(",", "").strip()
            if v.replace(".", "", 1).isdigit():
                t[m] += float(v)
    if not totals:
        return None
    y = max(totals)
    t, total = totals[y], sum(totals[y])
    hi = max(range(12), key=lambda i: t[i])
    lo = min(range(12), key=lambda i: t[i])
    return y, hi + 1, t[hi] / total * 100, lo + 1, t[lo] / total * 100


def _taiwan_monthly() -> dict[int, dict[int, float]]:
    """觀光署：每月的來臺旅客人次（總計），{年: {月: 人次}}，只回傳 12 個月都有、加總跟年資料一樣的年份"""
    annual_path = TW_DIR / "residence-annual-2002-2025.csv"
    files = sorted(TW_DIR.glob("residence-monthly-*.xlsx"))
    if not annual_path.exists() or not files:
        raise RuntimeError(f"沒有 {TW_DIR} 的檔：請把 map-plan 的 data/taiwan-net/ 裡的 xlsx 與 csv 複製到這裡")
    if hashlib.sha256(annual_path.read_bytes()).hexdigest() != TW_ANNUAL_SHA256:
        raise RuntimeError(f"{annual_path} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改")
    with annual_path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        head = next(reader)
        total_row = next(r for r in reader if r[1].startswith("總計"))
    annual = {int(y): float(v.replace(",", "")) for y, v in zip(head[2:], total_row[2:]) if v}
    monthly: dict[int, dict[int, float]] = defaultdict(dict)
    for path in files:
        m = re.fullmatch(r"residence-monthly-(\d{4})-(\d{2})\.xlsx", path.name)
        y, mo = int(m.group(1)), int(m.group(2))
        rows = list(openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0].iter_rows(values_only=True))
        grand = [r for r in rows if r and isinstance(r[1], str) and r[1].startswith("總計")]
        if len(grand) != 1 or f"{y}" not in str(rows[1][3]):
            raise RuntimeError(f"{path.name} 的版面跟以前不一樣")
        monthly[y][mo] = float(grand[0][3])
    out = {}
    for y, months in monthly.items():
        if y < TW_FIRST or len(months) != 12:
            continue
        if y in annual and round(sum(months.values())) != round(annual[y]):
            raise RuntimeError(f"觀光署 {y} 年 12 個月加起來 {sum(months.values()):,.0f}，跟年資料 {annual[y]:,.0f} 不一樣")
        out[y] = months
    return out


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
    for y, months in _taiwan_monthly().items():
        monthly["TWN"][y] = months
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
            if iso3 != "TWN":  # 台灣是旅客人次，不是住宿夜數，351 不用
                nights[iso3][y] = total
            if y == hint_year:
                ranked = sorted(months.items(), key=lambda kv: -kv[1])
                second = ranked[1]
                low = ranked[-1]
                hints[iso3] = (f"{hint_year} 年：最旺 {m} 月 {top / total:.1%}、第二 {second[0]} 月 {second[1] / total:.1%}、"
                               f"最淡 {low[0]} 月 {low[1] / total:.1%}")
                hints_en[iso3] = (f"{hint_year}: busiest {MONTHS_EN[m - 1]} {top / total:.1%}, second {MONTHS_EN[second[0] - 1]} "
                                  f"{second[1] / total:.1%}, quietest {MONTHS_EN[low[0] - 1]} {low[1] / total:.1%}")
    years = sorted({y for s in peak.values() for y in s})
    hints["TWN"] = "台灣是觀光署的來臺旅客人次（入境的外國與港澳陸旅客，不含國內旅遊）；" + hints["TWN"]
    hints_en["TWN"] = "Taiwan: Tourism Administration visitor arrivals (inbound only, no domestic tourism); " + hints_en["TWN"]
    tw_note = "台灣是入境旅客人次（交通部觀光署，資料來源內政部移民署），歐洲是旅宿業的住宿夜數（含本國旅客），口徑不同"
    tw_note_en = "Taiwan uses inbound visitor arrivals (Tourism Administration, from the National Immigration Agency); Europe uses accommodation nights including domestic guests"
    # 2026-11-07（手冊 432 的補強）：國內旅遊用觀光署「主要觀光遊憩據點」的月別人次（景點地圖主題同一份），寫在台灣的附註
    dom = _taiwan_domestic()
    if dom:
        y, peak_m, peak_s, low_m, low_s = dom
        tw_note += f"。國內旅遊另見觀光署主要觀光遊憩據點的人次：{y} 年 {peak_m} 月最多（占全年 {peak_s:.1f}%）、{low_m} 月最少（{low_s:.1f}%）"
        tw_note_en += (f". For domestic travel, visits to the Tourism Administration’s major tourist sites peaked in {MONTHS_EN[peak_m - 1]} {y} "
                       f"({peak_s:.1f}% of the year) and were lowest in {MONTHS_EN[low_m - 1]} ({low_s:.1f}%)")
    write_json(OUT / "peak-month.json", indicator_file(
        "peak-month", "月", years, {c: to_series(s, years, 0) for c, s in sorted(peak.items())},
        hints=hints, hintsEn=hints_en, notes={"TWN": tw_note}, notesEn={"TWN": tw_note_en}))
    write_json(OUT / "peak-share.json", indicator_file(
        "peak-share", "%", years, {c: to_series(s, years, 1) for c, s in sorted(peak_share.items())},
        hints=hints, hintsEn=hints_en, notes={"TWN": tw_note}, notesEn={"TWN": tw_note_en}))
    print(f"  台灣：最旺 { {y: (peak['TWN'][y], round(peak_share['TWN'][y], 2)) for y in sorted(peak['TWN'])} }；{hints['TWN']}")
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
