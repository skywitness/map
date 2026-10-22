"""中央銀行 國際收支統計（https://cpx.cbc.gov.tw/，政府資料開放授權條款）：台灣的觀光收入與出口總額。

BPP2Y01 是年資料，單位百萬美元，1984 年起。JSON 的欄名在 data.structure.Table1，
data.dataSets 每列第一格是年，第 i 個欄名的值在第 i+1 格；「-」代表無數值。
"""
from __future__ import annotations

import json

from common import download

URL = "https://cpx.cbc.gov.tw/API/DataAPI/Get?FileName=BPP2Y01"


def balance_of_payments(columns: list[str]) -> dict[str, dict[int, float]]:
    """{欄名: {西元年: 百萬美元}}，欄名例如「服務-旅行-收入」。"""
    path = download(URL, "cbc", "BPP2Y01.json")
    with open(path, encoding="utf-8-sig") as f:
        data = json.load(f)["data"]
    names = [c["data"] for c in data["structure"]["Table1"]]
    missing = [c for c in columns if c not in names]
    if missing:
        raise RuntimeError(f"中央銀行國際收支表沒有這些欄位：{missing}")
    out: dict[str, dict[int, float]] = {c: {} for c in columns}
    for row in data["dataSets"]:
        for c in columns:
            try:
                out[c][int(row[0])] = float(row[names.index(c) + 1])
            except ValueError:
                continue
    return out
