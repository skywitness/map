"""JODI-Oil World Database（Joint Organisations Data Initiative，國際能源論壇 IEF 主辦）的年度 CSV。

- 網址：https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv/{primary,secondary}/<年>.csv
  （2002–2025 每年一個檔；當年的叫 primaryyear<年>.csv、secondaryyear<年>.csv）。primary 是原油（約 11.6 MB 一年），
  secondary 是油品（約 26 MB 一年）。robots.txt 只擋 /_resources/controls、templates、xsl，下載目錄允許。
- 欄位：REF_AREA（ISO 3166 兩碼）、TIME_PERIOD（YYYY-MM）、ENERGY_PRODUCT、FLOW_BREAKDOWN、UNIT_MEASURE、OBS_VALUE、
  ASSESSMENT_CODE。OBS_VALUE 會是「-」（沒有申報）或「x」（單位不適用），不能直接轉數字。
- ASSESSMENT_CODE（JODI 的 Colour Coding 原文）：1 藍色「results of the assessment show reasonable levels of comparability」、
  2 黃色「the metadata should be consulted」、3 白色「data has not been assessed」。
- 授權：條款頁 /terms-of-use.aspx 只寫「All such rights are reserved」，User Guide 要求在「publication, presentation,
  or derivative work utilizing the data」註明 JODI（map-plan 的 data/jodi/README.md）。使用者 2026-11-07 決定照 NCD-RisC 的前例用：
  照 How to Cite 的格式註明、標只准非商業、只放算好的數值、不轉載原始 CSV，對方要求就撤下。

整個檔很大，這裡只留用得到的數列：下載後篩出 KEEP 的組合，另存一份小檔（<種類>-<年>-slim.csv），原檔刪掉。
"""
from __future__ import annotations

import csv
import time
import urllib.error
from pathlib import Path

import common
from common import CACHE_DIR, download

SOURCE = "jodi"
BASE = "https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv"
FIRST_YEAR = 2002
PAUSE = 3  # 秒，下載之間
# 用得到的（產品, 流向, 單位）
KEEP = {
    "primary": {("CRUDEOIL", "CLOSTLV", "KBBL")},
    "secondary": {("TOTPRODS", "CLOSTLV", "KBBL"), ("TOTPRODS", "TOTDEMO", "KBD")},
}
CITATION = (
    "International Energy Forum (IEF). Joint Organizations Data Initiative (JODI) Database. "
    "JODI Oil and Gas World Databases: www.jodidata.org, Accessed 7 November 2026."
)


def _url(kind: str, year: int, current: int) -> str:
    name = f"{kind}year{year}.csv" if year == current else f"{year}.csv"
    return f"{BASE}/{kind}/{name}"


def slim(kind: str, year: int, current: int) -> Path:
    """這一年篩過的小檔：REF_AREA, TIME_PERIOD, ENERGY_PRODUCT, FLOW_BREAKDOWN, UNIT_MEASURE, OBS_VALUE, ASSESSMENT_CODE。

    當年的檔每個月都會更新，用 --refresh 重抓（只重抓當年的，往年的小檔留著）。
    """
    out = CACHE_DIR / SOURCE / f"{kind}-{year}-slim.csv"
    if out.exists() and not (common.REFRESH and year == current):
        return out
    # 一次要抓 50 個檔：每個之間停一下；連線被重設（2026-11-07 抓到一半遇過）等 30 秒再試，最多 3 次
    time.sleep(PAUSE)
    for attempt in range(3):
        try:
            raw = download(_url(kind, year, current), SOURCE, f"{kind}-{year}.csv")
            break
        except urllib.error.URLError as err:
            if attempt == 2 or "reset" not in str(err.reason).lower():
                raise
            print(f"  連線被重設，30 秒後再試（{err.reason}）")
            time.sleep(30)
    keep = KEEP[kind]
    with open(raw, encoding="utf-8", newline="") as f, open(out, "w", encoding="utf-8", newline="") as g:
        reader = csv.reader(f)
        writer = csv.writer(g)
        writer.writerow(next(reader))
        for row in reader:
            if (row[2], row[3], row[4]) in keep:
                writer.writerow(row)
    raw.unlink()
    return out


def rows(kind: str, current: int) -> list[dict[str, str]]:
    """2002 年到 current 年的全部篩過的列"""
    out: list[dict[str, str]] = []
    for year in range(FIRST_YEAR, current + 1):
        with open(slim(kind, year, current), encoding="utf-8", newline="") as f:
            out.extend(csv.DictReader(f))
    return out


def value(row: dict[str, str]) -> float | None:
    try:
        return float(row["OBS_VALUE"])
    except ValueError:
        return None
