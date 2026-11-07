"""實質利率與食物價格通膨（2026-11-07，製作手冊第二十五批 461，合併候選 1107、1108；步驟 prices-food-rates，
資料在 fiscal/，「物價與消費」主題用 topics/prices-rates.ts 接上）。

- 實質利率：世界銀行 WDI `FR.INR.RINR`（放款利率減 GDP 平減指數變動率，IMF 國際金融統計），CC BY 4.0。
  缺漏多，前端用 5 年內（latestWithin=4，2025 年看 2021–2025）最近一年。側欄的名目放款利率 `FR.INR.LEND` 與 GDP 平減指數變動率
  `NY.GDP.DEFL.KD.ZG` 也是 WDI。台灣：WDI 沒有；中央銀行的開放資料（data.gov.tw 9464）只有當天的牌告利率、
  不是時間序列，留空。
- 食物價格通膨：FAOSTAT Consumer Price Indices（批次下載 zip，CC BY 4.0），月資料。用 23013（食物指數）與
  23012（總指數）各自 12 個月的平均算年增率（不挑某一個月，基期效應比較小），食物減總指數是差值。
  缺月份的年不算。台灣：主計總處消費者物價基本分類（data.gov.tw 9158，政府資料開放授權條款）的「一.食物類」與
  「總指數」，一樣用 12 個月平均；台灣的食物類含外食費，FAOSTAT 各國多半是 COICOP 01（不含餐廳）。
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, to_series, write_json, write_manifest_part
from sources import dgbas_cpi, faostat, worldbank

OUT = OUT_DIR / "topics" / "fiscal"
FOOD, GENERAL = 23013, 23012
FIRST_FOOD = 2002
RATE_WITHIN = 4  # 前端是「選的年 − 資料年 ≤ latestWithin」：2025 年看 2021–2025 這 5 年
FOOD_WITHIN = 1
NO_TW_RATE = {"TWN": "世界銀行沒有台灣的實質利率"}
NO_TW_RATE_EN = {"TWN": "The World Bank has no real interest rate for Taiwan"}


def _faostat_monthly() -> dict[int, dict[str, dict[int, list[float]]]]:
    """{品項: {iso3: {年: [各月指數]}}}"""
    out: dict[int, dict[str, dict[int, list[float]]]] = {FOOD: defaultdict(lambda: defaultdict(list)),
                                                          GENERAL: defaultdict(lambda: defaultdict(list))}
    reader = faostat._csv("CP")
    col = {name: i for i, name in enumerate(next(reader))}
    cache: dict[str, str | None] = {}
    for r in reader:
        item = int(r[col["Item Code"]])
        if item not in out or not r[col["Value"]] or int(r[col["Months Code"]]) < 7001 or int(r[col["Months Code"]]) > 7012:
            continue
        area = faostat._area(r[col["Area Code"]], r[col["Area Code (M49)"]], cache)
        if area is None or area == "WLD":
            continue
        out[item][area][int(r[col["Year"]])].append(float(r[col["Value"]]))
    return out


def _taiwan_monthly() -> dict[str, dict[int, list[float]]]:
    path = download(dgbas_cpi._xml_url(), "dgbas", "cpi-basic-categories.xml")
    names = {"總指數": GENERAL, "一.食物類": FOOD}
    out: dict[int, dict[int, list[float]]] = {FOOD: defaultdict(list), GENERAL: defaultdict(list)}
    for _, el in ET.iterparse(path):
        if el.tag != "Obs":
            continue
        item = (el.findtext("Item") or "").split("(")[0]
        if item in names and el.findtext("TYPE") == "原始值":
            period = el.findtext("TIME_PERIOD") or ""
            value = el.findtext("Item_VALUE")
            if period[4:5] == "M" and value not in (None, "", "-"):
                out[names[item]][int(period[:4])].append(float(value))
        el.clear()
    if len(out[FOOD]) < 10 or len(out[GENERAL]) < 10:
        raise RuntimeError("主計總處消費者物價的「一.食物類」或「總指數」名稱可能變了")
    return out


def _growth(months: dict[int, list[float]]) -> dict[int, float]:
    avg = {y: sum(v) / 12 for y, v in months.items() if len(v) == 12}
    return {y: (a / avg[y - 1] - 1) * 100 for y, a in avg.items() if y - 1 in avg and avg[y - 1] > 0}


def _latest(series: dict[str, dict[int, float]], last: int, within: int) -> list[tuple[float, str, int]]:
    out = []
    for c, s in series.items():
        ys = [y for y in s if last - within <= y <= last]
        if ys:
            y = max(ys)
            out.append((round(s[y], 1), c, y))
    return sorted(out, reverse=True)


def build() -> None:
    real, _ = worldbank.fetch("FR.INR.RINR", 1960, 2030)
    lend, _ = worldbank.fetch("FR.INR.LEND", 1960, 2030)
    defl, _ = worldbank.fetch("NY.GDP.DEFL.KD.ZG", 1960, 2030)
    first = min(y for s in real.values() for y in s)
    last = max(y for s in real.values() for y in s)
    years = list(range(first, last + 1))
    for name, data in (("real-interest-rate", real), ("real-interest-rate/lending", lend), ("real-interest-rate/deflator", defl)):
        values = {c: to_series(s, years, 1) for c, s in sorted(data.items()) if any(first <= y <= last for y in s)}
        write_json(OUT / f"{name}.json", indicator_file(name.split("/")[-1], "%", years, values, latestWithin=RATE_WITHIN,
                                                       noValue=NO_TW_RATE, noValueEn=NO_TW_RATE_EN, license="CC BY 4.0"),
                   quiet=True)
    top = _latest(real, last, RATE_WITHIN)
    print(f"  實質利率 {last}（{RATE_WITHIN + 1} 年內）{len(top)} 國：最高 {top[:8]}；最低 {top[-6:]}")

    monthly = _faostat_monthly()
    tw = _taiwan_monthly()
    food = {c: g for c, m in monthly[FOOD].items() if (g := _growth(m))}
    general = {c: g for c, m in monthly[GENERAL].items() if (g := _growth(m))}
    food["TWN"], general["TWN"] = _growth(tw[FOOD]), _growth(tw[GENERAL])
    gap = {c: {y: v - general[c][y] for y, v in s.items() if y in general.get(c, {})} for c, s in food.items()}
    gap = {c: s for c, s in gap.items() if s}
    last = max(y for s in food.values() for y in s)
    years = list(range(FIRST_FOOD, last + 1))
    for name, data in (("food-inflation/food", food), ("food-inflation/gap", gap), ("food-inflation/general", general)):
        values = {c: to_series(s, years, 1) for c, s in sorted(data.items()) if any(y in s for y in years)}
        write_json(OUT / f"{name}.json", indicator_file("food-inflation", "%", years, values, latestWithin=FOOD_WITHIN,
                                                       license="CC BY 4.0"), quiet=True)
    for key, data in (("食物通膨", food), ("食物減總指數", gap)):
        top = _latest(data, last, FOOD_WITHIN)
        print(f"  {key} {last}（{FOOD_WITHIN + 1} 年內）{len(top)} 國：最高 {top[:8]}；最低 {top[-8:]}")
        print("    ", {c: round(data[c].get(y, float('nan')), 1) for c in ("TWN", "JPN", "KOR", "CHN", "USA", "DEU", "GBR")
                       for y in (last,) if c in data})
    for y in (2021, 2022, 2023):
        g = sorted(((round(s[y], 1), c) for c, s in gap.items() if y in s), reverse=True)
        print(f"  差值 {y}：{len(g)} 國；最大 {g[:8]}；中位數 {g[len(g) // 2]}")
    write_manifest_part(OUT, "fiscal", "prices-food-rates", {"sources": ["World Bank WDI", "FAOSTAT CP", "DGBAS CPI"]})
