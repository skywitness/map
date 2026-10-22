"""交通部觀光署 觀光統計（data.gov.tw 7322，政府資料開放授權條款）：歷年來臺旅客人次。

依入境紀錄計算：持外國護照、大陸港澳證件與華僑身分入境的旅客，不含持中華民國護照與過境不入境的旅客。
UN Tourism 收錄的台灣數字就是這個總計。1956 年起，數字有千分位逗號。
"""
from __future__ import annotations

import csv

from common import download

URL = "https://stat.taiwan.net.tw/data/opendata/12"


def visitor_arrivals() -> dict[int, int]:
    """{西元年: 來臺旅客人次}"""
    path = download(URL, "taiwan-tourism", "arrivals.csv")
    out: dict[int, int] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row["年別"].strip().isdigit():
                out[int(row["年別"])] = int(row["總計人數"].replace(",", ""))
    return out
