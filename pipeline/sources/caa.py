"""交通部民用航空局（https://www.caa.gov.tw/，政府資料開放授權條款）：台灣各機場的旅客人數。

data.gov.tw 33238「民航運輸各機場營運量－按國際、兩岸及國內航線分」：索引 CSV 指向每月更新的最新檔（副檔名是 .csv，
內容其實是 ODS），表 5 每列是一年（民國年，1952 年起，2016 年以前每五年一列）或最近 13 個月的單月。旅客人數是各機場的入境、出境與過境旅客，
國內線在起降的兩個機場各算一次，跟世界銀行（ICAO）各國註冊航空公司的載客口徑不同。
"""
from __future__ import annotations

import csv
import re

from common import download
from sources.moe import _sheet_rows

INDEX_URL = "https://www.caa.gov.tw/FileAtt.ashx?lang=1&id=30682"
# 表 5 的欄位：0 年(月)別、5 旅客人數總計、6 國際航線（含港澳）、7 兩岸航線、8 國內航線
TOTAL, INTERNATIONAL, CROSS_STRAIT, DOMESTIC = 5, 6, 7, 8


def airport_passengers() -> dict[int, dict[str, int]]:
    """{西元年: {"total", "international", "crossStrait", "domestic"}}（人次），只收全年的（今年到最近一個月的不算）。"""
    with open(download(INDEX_URL, "caa", "airport-traffic-index.csv"), encoding="utf-8-sig", newline="") as f:
        latest = next(csv.DictReader(f))
    file_id = re.search(r"id=(\d+)", latest["路徑"]).group(1)
    rows = _sheet_rows(download(latest["路徑"], "caa", f"airport-traffic-{file_id}.ods"))
    out: dict[int, dict[str, int]] = {}
    year = None
    last_month: dict[int, int] = {}
    for row in rows:
        label = str(row[0] or "").strip()
        if m := re.fullmatch(r"(\d+)年", label):
            year = int(m.group(1)) + 1911
            out[year] = {k: round(row[i]) for k, i in (("total", TOTAL), ("international", INTERNATIONAL),
                                                       ("crossStrait", CROSS_STRAIT), ("domestic", DOMESTIC))}
        elif year and (m := re.fullmatch(r"(\d+)月", label)):
            last_month[year] = int(m.group(1))
    # 年份後面接著單月的列：最後一個月不是 12 月的是今年到目前為止
    for y, month in last_month.items():
        if month != 12:
            del out[y]
    if len(out) < 15 or 2019 not in out or max(out) < 2024:
        raise RuntimeError(f"民航局的機場營運量只讀到 {len(out)} 年（到 {max(out, default=None)}），表格的版面可能變了")
    return out
