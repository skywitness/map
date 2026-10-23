"""行政院主計總處 總體統計資料庫（政府資料開放授權條款）：存款財產主題用到的台灣資料。

- A018703010「家庭及民間非營利機構之收支」（國民所得統計，1996 年起）：可支配所得與儲蓄（當期價格，百萬元）。
  所得從「按市價計算之國民所得」分配下來，已扣除固定資本消耗，所以儲蓄是「淨」儲蓄；儲蓄 ÷ 可支配所得
  就是跟 OECD 家庭淨儲蓄率（B8NS1M，含家庭與非營利團體）同一個定義，只差 OECD 另外加上的退休金權益變動調整（D8）。
  同一組數字也在《國民所得統計摘要》第 17 表「家庭所得、家庭可支配所得及消費傾向」與第 9 表的「儲蓄淨額」。
- A020001010「家庭收支重要指標」：家庭收支調查的儲蓄率（%）= 儲蓄 ÷ 可支配所得，儲蓄 = 可支配所得 − 消費支出。
  是抽樣調查，所得與消費的涵蓋範圍跟國民帳不同（例如不含非營利團體），通常比國民帳高好幾個百分點，只放在附註對照。
- A018201010「國民所得、儲蓄與投資」：國內生產毛額與國民儲蓄毛額（當期價格，百萬元），拿來跟 IMF 的國民儲蓄率對照。
- API 參數見 `sources/dgbas.py`。快取檔名加上 `-wealth`，不跟其他主題用同一張表、不同欄位範圍的快取撞名。
"""
from __future__ import annotations

import csv
from datetime import date

from common import download
from sources.dgbas import ROC_OFFSET, URL, _num


def _table(funid: str, first_roc: int, fld: str, cod: str) -> tuple[list[str], dict[int, list[str]]]:
    """同 dgbas._table，只是快取檔名不同。回傳 (最後一列標題, {西元年: 該列})。"""
    last_roc = date.today().year - ROC_OFFSET
    url = URL.format(funid=funid, ymf=first_roc * 100, ymt=last_roc * 100, fld=fld, cod=cod)
    path = download(url, "dgbas", f"{funid}-wealth.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    is_data = [bool(r) and r[0].endswith("年") and r[0][:-1].isdigit() for r in rows]
    if not any(is_data):
        raise RuntimeError(f"{funid} 沒有資料列，API 格式可能變了")
    header = rows[is_data.index(True) - 1]
    return header, {int(r[0][:-1]) + ROC_OFFSET: r for r, ok in zip(rows, is_data) if ok}


def household_net_saving_rate() -> dict[int, float]:
    """國民所得統計的家庭（含民間非營利機構）淨儲蓄率：儲蓄 ÷ 可支配所得 × 100，1996 年起。"""
    header, data = _table("A018703010", 85, "0,12", "0,1")
    saving, income = "11.儲蓄 (11=5-10)", "12.可支配所得 (12=5-7-8-9)"
    if saving not in header or income not in header:
        raise RuntimeError(f"A018703010 的欄位變了：{header}")
    out = {}
    for year, row in data.items():
        s, d = _num(row[header.index(saving)]), _num(row[header.index(income)])
        if s is not None and d:
            out[year] = s / d * 100
    return out


def household_saving_rate() -> dict[int, float]:
    """家庭收支調查的儲蓄率（%），1976 年起（之前隔年調查）。"""
    header, data = _table("A020001010", 53, "0,12", "0,1")
    if "儲蓄率(%)" not in header:
        raise RuntimeError(f"A020001010 沒有「儲蓄率(%)」欄：{header}")
    col = header.index("儲蓄率(%)")
    return {year: v for year, row in data.items() if (v := _num(row[col])) is not None}


def national_accounts() -> dict[str, dict[int, float]]:
    """{'gdp': 名目 GDP（新臺幣元）, 'gross-saving': 國民儲蓄毛額（元）, 'saving-rate-gni': 儲蓄率（占 GNI %）}"""
    header, data = _table("A018201010", 70, "0,1", "0,19")
    columns = {
        "gdp": "1.1國內生產毛額GDP",
        "gross-saving": "3.3國民儲蓄毛額:2.1+3.2",
        "saving-rate-gni": "3.4儲蓄率:3.3/1.4",
    }
    missing = [c for c in columns.values() if c not in header]
    if missing:
        raise RuntimeError(f"A018201010 的欄位變了：{missing}")
    out: dict[str, dict[int, float]] = {k: {} for k in columns}
    for year, row in data.items():
        for key, name in columns.items():
            v = _num(row[header.index(name)])
            if v is not None:
                out[key][year] = v if key == "saving-rate-gni" else v * 1e6
    return out
