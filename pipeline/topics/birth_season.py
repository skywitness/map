"""出生的季節（新主題，2026-10-29）：每個國家出生最多的月份。

**來源**：
- UNdata 人口統計資料庫表 55「Live births by month of birth」（DataMartId=POP）：一國一頁（Data.aspx，伺服器端產生的第一頁
  50 筆，約最近 3–4 年，做法同婚姻主題的 sources/undata_dyb.py）。UNdata 的使用條款：可以自由複製、轉載，註明 UNdata。
  優先用依發生日期（「year of occurrence」）的紀錄；12 個月都要有（只有季別「January - March」的不算），而且來自同一個
  資料來源年份（最終數字優先，再來是來源年份新的）；暫定數最少的月份不到中位數的 MIN_RATIO 不用（還沒登記完）；
  附註寫只涵蓋部分地區或人口的不收（undata_dyb.PARTIAL）。
- 台灣（UNdata 沒有）：內政部統計處「出生人數性別概況─按區域別分」（data.gov.tw 14233，政府資料開放授權條款），
  statis.moi.gov.tw 依年月查詢的 CSV，**按登記的月份**（出生後 60 天內登記，1、2 月受春節影響），使用者決定照用、附註寫明。

**換算**：每月的出生數除以那個月的天數（2 月依閏年 28 或 29 天），比的是每日平均，大小月不影響。

**輸出**（public/data/topics/birth-season/）：
- peak-month.json：每日平均出生數最多的月份（1–12），各國只有實際有資料的年份；latestWithin 10 年（地圖上用 10 年內最近一年）
- months.json：側欄 {iso3: {years: [年…], daily: [[1–12 月的每日平均]…], registration: 是否依登記}}
"""
from __future__ import annotations

import calendar
import csv
import io
import re
import time

import common
from common import OUT_DIR, download, indicator_file, now_iso, write_json
from sources.countries import from_numeric
from sources.undata_dyb import COUNTRY, PARTIAL, _rows

OUT = OUT_DIR / "topics" / "birth-season"
TABLE = 55
URL = "https://data.un.org/Data.aspx?d=POP&f=tableCode%3a{table}{extra}"
MONTHS = list(calendar.month_name)[1:]
LATEST_WITHIN = 10
MIN_RATIO = 0.6
FIRST_YEAR = 2000
# 內政部：民國 103 年起（2014）
MOI = (
    "https://statis.moi.gov.tw/micst/webMain.aspx?sys=220&kind=21&type=1&funid=c0120101&cycle=41&outmode=12&utf=1"
    "&compmode=0&outkind=3&fldspc=0,7,&codspc0=0,2,&ym={y0}01&ymt={y1}12"
)
MOI_YEARS = (2014, 2025)


def _page(extra: str, name: str) -> str:
    fresh = common.REFRESH or not (common.CACHE_DIR / "undata" / name).exists()
    path = download(URL.format(table=TABLE, extra=extra), "undata", name)
    if fresh:
        time.sleep(0.3)
    return path.read_text(encoding="utf-8")


def undata() -> dict[str, dict]:
    """{iso3: {year: (依登記?, [12 個月的出生數])}}"""
    index = _page("", f"pop-{TABLE}.html")
    countries = sorted(set(COUNTRY.findall(index)), key=lambda c: int(c[0]))
    if len(countries) < 100:
        raise RuntimeError(f"UNdata 表 {TABLE} 只有 {len(countries)} 個國家，網頁格式可能變了")
    out: dict[str, dict] = {}
    for code, _name in countries:
        iso3 = from_numeric(code)
        if not iso3:
            continue
        text = _page(f"%3bcountryCode%3a{code}%3bareaCode%3a0", f"pop-{TABLE}-{code}.html")
        # (年, 依登記?) → {資料來源年份: {月: (是不是最終數字, 數)}}
        found: dict[tuple[int, bool], dict[int, dict[int, tuple[bool, float]]]] = {}
        for cells, notes in _rows_55(text):
            _country, year, area, month, record, reliability, source_year, value = cells[:8]
            if area != "Total" or month not in MONTHS or not value or any(n.startswith(PARTIAL) for n in notes):
                continue
            key = (int(year), "occurrence" not in record)
            sy = int(source_year) if source_year.isdigit() else 0
            found.setdefault(key, {}).setdefault(sy, {})[MONTHS.index(month) + 1] = (reliability.startswith("Final"), float(value.replace(",", "")))
        years: dict[int, tuple[bool, list[float]]] = {}
        # 依發生日期的先選（registration False 排前面）
        for (year, registration), by_source in sorted(found.items(), key=lambda kv: kv[0][1]):
            if year < FIRST_YEAR or year in years:
                continue
            # 12 個月要來自同一個資料來源年份（日本 2025 年的暫定數 12 月是隔年才補的）；最終數字優先，再來是來源年份新的
            complete = [(all(f for f, _v in ms.values()), sy, ms) for sy, ms in by_source.items() if len(ms) == 12]
            if not complete:
                continue
            final, _sy, ms = max(complete, key=lambda c: (c[0], c[1]))
            counts = [ms[m][1] for m in range(1, 13)]
            # 暫定數常有月份還沒登記完（澳洲 2024 年 12 月只有其他月份的六分之一）：最少的月份不到中位數的 MIN_RATIO 不用
            if not final and min(counts) < MIN_RATIO * sorted(counts)[6]:
                continue
            years[year] = (registration, counts)
        if years:
            out[iso3] = years
    return out


def _rows_55(text: str):
    """表 55 多一欄 Month：借用 undata_dyb._rows 的解析，只是欄位檢查不同"""
    import html as _html

    from sources.undata_dyb import CELL, FOOTNOTE, ROW

    table = re.search(r'<div class="DataContainer"><table.*?</table>', text, re.S)
    if not table:
        return []
    rows = [
        ([_html.unescape(re.sub(r"<[^>]*>", "", c)).strip() for c in CELL.findall(r)], [_html.unescape(t) for t in FOOTNOTE.findall(r)])
        for r in ROW.findall(table.group(0))
    ]
    header = ["Country or Area", "Year", "Area", "Month", "Record Type", "Reliability", "Source Year", "Value"]
    if not rows or rows[0][0][: len(header)] != header:
        raise RuntimeError(f"UNdata 表 55 的欄位變了：{rows[:1]}")
    return rows[1:]


def taiwan() -> dict[int, tuple[bool, list[float]]]:
    y0, y1 = MOI_YEARS
    path = download(MOI.format(y0=y0 - 1911, y1=y1 - 1911), "moi", f"births-monthly-{y0}-{y1}.csv")
    text = path.read_text(encoding="utf-8-sig")
    out: dict[int, dict[int, float]] = {}
    for row in csv.reader(io.StringIO(text)):
        m = re.match(r"(\d+)年 (\d+)月/ 區域別總計", row[0] if row else "")
        if m:
            out.setdefault(int(m.group(1)) + 1911, {})[int(m.group(2))] = float(row[1])
    return {y: (True, [ms[i] for i in range(1, 13)]) for y, ms in out.items() if len(ms) == 12}


def daily(year: int, counts: list[float]) -> list[float]:
    return [round(c / calendar.monthrange(year, i + 1)[1], 1) for i, c in enumerate(counts)]


def build() -> None:
    data = undata()
    data["TWN"] = taiwan()
    years = sorted({y for d in data.values() for y in d})
    peak: dict[str, list[float | None]] = {}
    panel: dict[str, dict] = {}
    for iso3, by_year in sorted(data.items()):
        ys = sorted(by_year)
        rows = [daily(y, by_year[y][1]) for y in ys]
        peak[iso3] = [None] * len(years)
        for y, row in zip(ys, rows):
            peak[iso3][years.index(y)] = row.index(max(row)) + 1
        panel[iso3] = {"years": ys, "daily": rows, "registration": [int(by_year[y][0]) for y in ys]}
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "peak-month.json", indicator_file("peak-month", "", years, peak, latestWithin=LATEST_WITHIN))
    write_json(OUT / "months.json", {"countries": panel})
    write_json(OUT / "manifest.json", {
        "topic": "birth-season",
        "generatedAt": now_iso(),
        "sources": ["UNdata Demographic Statistics Database, table 55 (Live births by month of birth)",
                    "內政部統計處 出生人數性別概況─按區域別分（按登記）"],
    })
    latest = {c: panel[c]["years"][-1] for c in panel}
    from collections import Counter

    recent = {c: d for c, d in panel.items() if latest[c] >= years[-1] - LATEST_WITHIN}
    months = Counter(d["daily"][-1].index(max(d["daily"][-1])) + 1 for d in recent.values())
    print(f"  {len(panel)} 國（10 年內有資料的 {len(recent)} 國），{years[0]}–{years[-1]}；最近一年出生最多的月份：{sorted(months.items())}")
    reg = sorted(c for c, d in panel.items() if d["registration"][-1])
    print(f"  依登記月份的：{' '.join(reg)}")
    for c in ("TWN", "USA", "JPN", "KOR", "DEU", "GBR", "AUS", "BRA", "NZL", "SWE", "ZAF"):
        if c in panel:
            d = panel[c]["daily"][-1]
            print(f"    {c} {panel[c]['years'][-1]}：最多 {d.index(max(d)) + 1} 月 {max(d)}／天，最少 {d.index(min(d)) + 1} 月 {min(d)}／天")


if __name__ == "__main__":
    build()
