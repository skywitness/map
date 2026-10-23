"""中央銀行 主要貿易對手通貨對美元匯率（https://cpx.cbc.gov.tw/，政府資料開放授權條款）：新臺幣對美元的年平均匯率。

BP01Y01 是年資料（1960 年起），格式跟 cbc.py 的國際收支表一樣：欄名在 data.structure.Table1，
data.dataSets 每列第一格是年，第 i 個欄名的值在第 i+1 格。新臺幣那一欄叫「新台幣NTD/USD」（新臺幣／美元）。
"""
from __future__ import annotations

import json

from common import download

URL = "https://cpx.cbc.gov.tw/API/DataAPI/Get?FileName=BP01Y01"
COLUMN = "NTD/USD"


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
