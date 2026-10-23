"""中央銀行 主要貿易對手通貨對美元匯率（https://cpx.cbc.gov.tw/，政府資料開放授權條款）：新臺幣對美元的年平均匯率。

BP01Y01 是年資料（1960 年起），格式跟 cbc.py 的國際收支表一樣：欄名在 data.structure.Table1，
data.dataSets 每列第一格是年，第 i 個欄名的值在第 i+1 格。新臺幣那一欄叫「新台幣NTD/USD」（新臺幣／美元）。
"""
from __future__ import annotations

import json

from common import download

URL = "https://cpx.cbc.gov.tw/API/DataAPI/Get?FileName=BP01Y01"
COLUMN = "NTD/USD"


DAILY_URL = "https://cpx.cbc.gov.tw/API/DataAPI/Get?FileName=BP01D01"


def ntd_per_usd_year_end() -> dict[int, float]:
    """{西元年: 新臺幣／美元（每年最後一個營業日，台灣時間 16:00 的銀行間即期匯率）}，1993 年起。

    BP01D01 是日資料，格式同 BP01Y01，每列第一格是 YYYYMMDD。股市市值這類年底存量用年底匯率換算美元
    （世界銀行、WFE 的做法），不用年平均。今年還沒結束，不收。
    """
    path = download(DAILY_URL, "cbc", "BP01D01.json")
    with open(path, encoding="utf-8-sig") as f:
        data = json.load(f)["data"]
    names = [c["data"] for c in data["structure"]["Table1"]]
    matches = [i for i, name in enumerate(names) if name.endswith(COLUMN)]
    if len(matches) != 1:
        raise RuntimeError(f"中央銀行日匯率表找不到「{COLUMN}」欄：{names}")
    col = matches[0] + 1
    last: dict[int, tuple[str, float]] = {}
    for row in data["dataSets"]:
        try:
            value = float(row[col])
        except ValueError:
            continue
        year = int(row[0][:4])
        if year not in last or row[0] > last[year][0]:
            last[year] = (row[0], value)
    return {y: v for y, (day, v) in last.items() if day[4:6] == "12" and day[6:] >= "24"}


def ntd_per_usd() -> dict[int, float]:
    """{西元年: 新臺幣／美元（年平均）}"""
    path = download(URL, "cbc", "BP01Y01.json")
    with open(path, encoding="utf-8-sig") as f:
        data = json.load(f)["data"]
    names = [c["data"] for c in data["structure"]["Table1"]]
    matches = [i for i, name in enumerate(names) if name.endswith(COLUMN)]
    if len(matches) != 1:
        raise RuntimeError(f"中央銀行匯率表找不到「{COLUMN}」欄：{names}")
    col = matches[0] + 1
    out: dict[int, float] = {}
    for row in data["dataSets"]:
        try:
            out[int(row[0])] = float(row[col])
        except ValueError:
            continue
    return out
