"""交通部公路局 統計查詢網（https://stat.thb.gov.tw/）：小客車依使用燃料別的新車領牌數與登記數。

- 授權：公路局在政府資料開放平臺的統計資料集（例如 data.gov.tw 30202「新車領牌數」，說明欄指向這個查詢網）
  採政府資料開放授權條款－第 1 版。
- 跟主計總處總體統計資料庫是同一套系統（見 dgbas.py），API 參數一樣：fldspc 是車種、codspc0 是燃料別、
  codspc1 是縣市（「起點,數量」，從 0 起算）；outmode=3 是 UTF-8 CSV，cycle=4 是年資料（登記數是年底值）。
- 101 年（2012）起才有。今年還沒結束，年資料的「115年底」其實是某個月的值，不收。
- 燃料別定義（查詢網的「使用燃料別定義說明」，依「車輛能源種類登載作業原則」）：
  - 電能：只靠電能驅動 → 純電（BEV）
  - 電能/汽油、電能/柴油：同時使用油與電能，主要由電動馬達驅動；電能（增程）：增程式 → 插電式混合（PHEV）
  - 汽油/電能、柴油/電能：同時使用油與電能，主要由引擎驅動。2020 年以前的油電混合車（HEV）多半也登記在這一類
    （「汽油（油電）」2016 年才出現，2012–2014 年「汽油/電能」每年 1.7 萬輛，2021 年起每年只剩幾百輛），
    114 年底仍有約 9.7 萬輛，大多是早期的油電混合車，所以不算電動車；車輛中心的統計也不算
    （114 年底 PHEV 14,528 輛 = 電能/汽油 14,295 + 電能/柴油 4 + 電能（增程）229）。
  - 汽油（油電）、柴油（油電）、汽油（電能）：只加油、不能外接充電的油電混合車 → 不算電動車
"""
from __future__ import annotations

import csv
from datetime import date

from common import download

URL = (
    "https://stat.thb.gov.tw/hb01/webMain.aspx?sys=220&funid={funid}&outmode=3&outkind=1"
    "&ymf=10100&ymt={ymt}&fldspc={fld}&codspc0=0,14&codspc1={cod1}&cycle=4&compmode=0&ratenm=&title="
)
ROC_OFFSET = 1911
PASSENGER_CAR = "10,1"  # 車種清單的第 10 項「小客車」（含自用與營業）

BEV = ("電能",)
PHEV = ("電能/汽油", "電能/柴油", "電能（增程）")


def _table(funid: str, cod1: str) -> dict[int, dict[str, int]]:
    """{西元年: {燃料別: 輛數}}，只收已經結束的年份。"""
    this_roc = date.today().year - ROC_OFFSET
    url = URL.format(funid=funid, ymt=this_roc * 100, fld=PASSENGER_CAR, cod1=cod1)
    path = download(url, "thb", f"{funid}.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    header = rows[1]  # 第一列是車種，第二列是燃料別
    if header[1] != "總計" or not all(name in header for name in BEV + PHEV):
        raise RuntimeError(f"{funid} 的欄位跟預期不同，燃料別可能改了：{header}")
    out: dict[int, dict[str, int]] = {}
    for row in rows[2:]:
        label = row[0].strip() if row else ""
        roc = label.removesuffix("年底").removesuffix("年")
        if not roc.isdigit() or int(roc) >= this_roc:
            continue
        out[int(roc) + ROC_OFFSET] = {
            name: int(cell.replace(",", "")) if cell.strip().replace(",", "").isdigit() else 0  # 「-」是 0
            for name, cell in zip(header[1:], row[1:])
            if name
        }
    if not out:
        raise RuntimeError(f"{funid} 沒有資料列，API 格式可能變了")
    return out


def passenger_cars() -> dict[str, dict[int, int]]:
    """小客車的新車領牌數與年底登記數：{sales, sales_bev, sales_phev, stock, stock_bev, stock_phev: {年: 輛}}。"""
    out: dict[str, dict[int, int]] = {}
    for key, funid, cod1 in (
        ("sales", "1120005", ""),  # 新車領牌數－按使用燃料分
        ("stock", "1110008", "0,1"),  # 機動車輛登記數－按縣市別及使用燃料分，只取「總計」
    ):
        table = _table(funid, cod1)
        out[key] = {y: r["總計"] for y, r in table.items()}
        out[f"{key}_bev"] = {y: sum(r[n] for n in BEV) for y, r in table.items()}
        out[f"{key}_phev"] = {y: sum(r[n] for n in PHEV) for y, r in table.items()}
    return out
