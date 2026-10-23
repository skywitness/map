"""中央銀行（政府資料開放授權條款）：台灣的外匯存底、國際投資部位與外債。

- **外匯存底**：政府資料開放平臺資料集 6025（https://data.gov.tw/dataset/6025，政府資料開放授權條款第 1 版），
  `https://www.cbc.gov.tw/public/data/OpenData/WebF3.csv`，欄位「日期」（2024.12）、「金額」（十億美元），
  月底餘額，2003 年 7 月起，新的在前。央行公布的外匯存底只有外幣資產，**不含黃金**。
  中央銀行統計資料庫的 API（cpx.cbc.gov.tw）沒有外匯存底這張表。
- **國際投資部位**：統計資料庫 API 的 BPF4Y01（國際投資部位統計依期間，年底，百萬美元，2000 年起），
  格式同國際收支（`sources/cbc.py`）。「準備資產」含黃金，但黃金以帳面成本計（2024 年底比外匯存底只多約 47 億美元，
  央行約 1,362 萬盎司的黃金以年底金價計約 355 億美元）。
- **外債統計**：國際收支季報的附表一「外債及債負比率（年資料）」，
  `https://www.cbc.gov.tw/public/data/economic/statistics/bop/hist_Debt1.pdf`（1999 年起，百萬美元），
  用 `pdfreader.py` 讀。每列是年、外債總餘額、長期（合計、公共、民間）、短期（合計、公共、民間）、債負比率。
"""
from __future__ import annotations

import csv
import json
import re

from common import download
from sources import pdfreader

FX_RESERVES_URL = "https://www.cbc.gov.tw/public/data/OpenData/WebF3.csv"
IIP_URL = "https://cpx.cbc.gov.tw/API/DataAPI/Get?FileName=BPF4Y01"
DEBT_URL = "https://www.cbc.gov.tw/public/data/economic/statistics/bop/hist_Debt1.pdf"

# 國際投資部位表裡屬於「債務工具」的負債：IMF《外債統計指南》的外債總額就是這三項的合計
# （其他投資的負債都是債務工具；「其他股本」是股權，台灣這一欄是「-」）
DEBT_LIABILITIES = [
    "直接投資-債務工具-負債",  # 直接投資的公司間借貸
    "證券投資-債務證券-負債",
    "其他投資-債務工具-負債",  # 現金與存款、貸（借）款、貿易信用及預付（收）款、其他應付款
]
RESERVE_ASSETS = "準備資產"


def fx_reserves() -> dict[int, float]:
    """{年: 年底（12 月底）外匯存底，美元}"""
    path = download(FX_RESERVES_URL, "cbc", "WebF3.csv")
    out: dict[int, float] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            year, month = row["日期"].split(".")
            if month == "12":
                out[int(year)] = float(row["金額"]) * 1e9
    if not out:
        raise RuntimeError("中央銀行外匯存底 CSV 沒有 12 月的資料，格式可能變了")
    return out


def international_investment_position(columns: list[str]) -> dict[str, dict[int, float]]:
    """{欄名: {年: 年底部位，美元}}，欄名例如「準備資產」「其他投資-債務工具-負債」。「-」（無數值）不收。"""
    path = download(IIP_URL, "cbc", "BPF4Y01.json")
    with open(path, encoding="utf-8-sig") as f:
        data = json.load(f)["data"]
    names = [c["data"] for c in data["structure"]["Table1"]]
    missing = [c for c in columns if c not in names]
    if missing:
        raise RuntimeError(f"中央銀行國際投資部位表沒有這些欄位：{missing}")
    out: dict[str, dict[int, float]] = {c: {} for c in columns}
    for row in data["dataSets"]:
        for c in columns:
            try:
                out[c][int(row[0])] = float(row[names.index(c) + 1]) * 1e6
            except ValueError:
                continue
    return out


def external_debt_liabilities() -> dict[int, float]:
    """{年: 國際投資部位表的債務工具負債合計（IMF 外債統計指南的外債總額），美元}"""
    parts = international_investment_position(DEBT_LIABILITIES)
    years = set.intersection(*(set(parts[c]) for c in DEBT_LIABILITIES))
    return {y: sum(parts[c][y] for c in DEBT_LIABILITIES) for y in sorted(years)}


def reserve_assets() -> dict[int, float]:
    """{年: 國際投資部位表的準備資產（黃金以帳面成本計），美元}"""
    return international_investment_position([RESERVE_ASSETS])[RESERVE_ASSETS]


def official_external_debt() -> dict[int, float]:
    """{年: 央行「外債統計」的年底外債總餘額，美元}。

    PDF 的文字片段依列（同一個 y 座標）排好再接起來；千分位逗號後面偶爾被拆開（「37, 168」），先接回去，
    「－」（無數值，例如 2008–2012 年的短期公共外債）當成 0。
    檢查外債總餘額 = 長期合計 + 短期合計。
    """
    path = download(DEBT_URL, "cbc", "hist_Debt1.pdf")
    texts, _rects = pdfreader.read(path)
    lines: dict[tuple[int, int], list[pdfreader.Text]] = {}
    for t in texts:
        lines.setdefault((t.page, round(t.y)), []).append(t)
    out: dict[int, float] = {}
    for key in sorted(lines):
        line = " ".join(t.text for t in sorted(lines[key], key=lambda t: t.x))
        line = re.sub(r"(\d),\s+(\d)", r"\1,\2", line).replace("－", "0")
        m = re.match(r"\s*((?:19|20)\d{2})\s+((?:[\d,]+\s+){7})", line)
        if not m:
            continue
        numbers = [float(n.replace(",", "")) for n in m.group(2).split()]
        total, long_term, short_term = numbers[0], numbers[1], numbers[4]
        if abs(total - long_term - short_term) > 2:
            raise RuntimeError(f"央行外債統計 {m.group(1)} 年的長短期合計不等於總餘額：{line}")
        out[int(m.group(1))] = total * 1e6
    if len(out) < 20:
        raise RuntimeError(f"央行外債統計只讀到 {len(out)} 年，PDF 格式可能變了")
    return out
