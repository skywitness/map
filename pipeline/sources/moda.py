"""數位發展部「數位近用調查」（data.gov.tw 5960，政府資料開放授權條款）：台灣的個人上網率。

電話抽樣調查，對象是 12 歲以上的本國籍民眾；2021 年沒有調查。
檔名寫 UTF8，實際是 Big5（cp950）；年度是民國年，最新的在最上面。
"""
from __future__ import annotations

import csv

from common import download

URL = "https://www-api.moda.gov.tw/OpenData/Files/4303"
ROC_OFFSET = 1911


def internet_users() -> dict[int, float]:
    """{西元年: 個人上網率 %}"""
    path = download(URL, "moda", "digital-access.csv")
    with open(path, encoding="cp950", newline="") as f:
        rows = list(csv.reader(f))
    column = next(i for i, name in enumerate(rows[0]) if name.startswith("個人上網率"))
    out: dict[int, float] = {}
    for row in rows[1:]:
        if row and row[0].strip().isdigit() and row[column].strip():
            out[int(row[0]) + ROC_OFFSET] = float(row[column])
    return out


def column(prefix: str) -> dict[int, float]:
    """數位近用調查的某一欄（欄名開頭比對，例如「男性」「家戶連網率」）：{西元年: %}，沒調查的年份不放"""
    path = download(URL, "moda", "digital-access.csv")
    with open(path, encoding="cp950", newline="") as f:
        rows = list(csv.reader(f))
    index = next(i for i, name in enumerate(rows[0]) if name.replace("\n", "").startswith(prefix))
    out: dict[int, float] = {}
    for row in rows[1:]:
        if row and row[0].strip().isdigit() and row[index].strip():
            out[int(row[0]) + ROC_OFFSET] = float(row[index])
    return out
