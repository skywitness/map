"""衛生福利部統計處（政府資料開放授權條款）：補上世界銀行沒有的台灣醫療支出與醫師數。

- 國民醫療保健支出（NHE）統計表，表1：經常性醫療保健支出（CHE）占 GDP 與平均每人 CHE（美元）。
  CHE = NHE 扣掉資本形成，跟 WHO／OECD 的 current health expenditure 同一個概念。
  每年新版會修訂整個序列，下載網址的 dl 編號也會變：到 https://dep.mohw.gov.tw/DOS/lp-5071-113.html
  找「NNN年國民醫療保健支出統計表」的 .xlsx。
- 衛生福利統計指標 表4-3 醫事人力：每萬人口執業西醫師數（不含中醫師、牙醫師），原地更新。
  有 2000、2005、2010 年與 2015 年以後每年。
"""
from __future__ import annotations

import re

import openpyxl

from common import download

NHE_URL = "https://www.mohw.gov.tw/dl-99630-35f4025b-4521-4ff4-84e8-22979a53a7c3.html"  # 113 年版（資料到 2024 年）
PHYSICIANS_URL = "https://www.mohw.gov.tw/dl-63141-3fdaa1b6-5654-4605-8abb-f6c00614d0a4.html"

TAIWAN_NOTE = "台灣不在世界銀行（WHO）資料庫中，改用衛生福利部的資料"
NOTES = {
    "health-spending-per-capita": f"{TAIWAN_NOTE}：國民醫療保健支出統計的平均每人經常性醫療保健支出（美元）",
    "health-spending-gdp": f"{TAIWAN_NOTE}：國民醫療保健支出統計的經常性醫療保健支出占 GDP（不含資本形成，2024 年含資本形成是 7.34%）",
    "physicians": f"{TAIWAN_NOTE}：每萬人口執業西醫師數除以 10（不含中醫師、牙醫師），2001–2014 年只有 2005、2010 年",
}


def _number(cell: object) -> float | None:
    if isinstance(cell, (int, float)):
        return float(cell)
    try:
        return float(str(cell).replace(",", "").strip())
    except ValueError:
        return None  # 「...」「-」


def _rows(url: str, filename: str, sheet: str) -> list[tuple]:
    path = download(url, "mohw", filename)
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    return list(wb[sheet].iter_rows(values_only=True))


def health_spending() -> tuple[dict[int, float], dict[int, float]]:
    """回傳（平均每人 CHE 美元, CHE 占 GDP %），{西元年: 值}。"""
    per_capita: dict[int, float] = {}
    share: dict[int, float] = {}
    for row in _rows(NHE_URL, "nhe.xlsx", "表1"):
        # 資料列：第一欄是「113年」，最後一欄是西元年
        if not (row[0] and re.fullmatch(r"\d+年", str(row[0]).strip())):
            continue
        year = int(str(row[0]).strip()[:-1]) + 1911
        if (v := _number(row[13])) is not None:
            per_capita[year] = v
        if (v := _number(row[9])) is not None:
            share[year] = v
    if not per_capita:
        raise RuntimeError("國民醫療保健支出表1 讀不到資料，表格格式可能變了")
    return per_capita, share


def physicians_per_1000() -> dict[int, float]:
    rows = _rows(PHYSICIANS_URL, "physicians.xlsx", "表4-3")
    # 「西醫師」出現兩次：第一次是人數，第二次是每萬人口
    header = next(r for r in rows if sum(c == "西醫師" for c in r) == 2)
    column = [i for i, c in enumerate(header) if c == "西醫師"][1]
    out: dict[int, float] = {}
    for row in rows:
        if row[0] and re.fullmatch(r"\d+年", str(row[0]).strip()) and (v := _number(row[column])) is not None:
            out[int(str(row[0]).strip()[:-1]) + 1911] = v / 10
    return out


def health_series() -> dict[str, dict[int, float]]:
    per_capita, share = health_spending()
    return {
        "health-spending-per-capita": per_capita,
        "health-spending-gdp": share,
        "physicians": physicians_per_1000(),
    }
