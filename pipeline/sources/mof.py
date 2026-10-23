"""財政部 財政統計資料庫（https://web02.mof.gov.tw/njswww/WebMain.aspx?sys=100&funid=defjspf2）：台灣的稅收、債務與收支。

跟主計總處的總體統計資料庫是同一套系統，網址參數照 data.gov.tw 上財政部資料集的下載連結（資料集 6744）：
- funid：資料表代碼（目錄頁 defjsp3 的 waiturl("i0801") 這類）；ym：起始年，民國年 × 100
- outmode=12、utf=1：UTF-8 CSV（含 BOM），第一列是欄名，第一欄是年份
- fldspc=0,N：取前 N 欄（N 給大一點沒關係）
- 年份有三種寫法：「2024」（國際比較表）、「113年」（日曆年）、「113年度」（會計年度，民國 90 年度起與日曆年相同）
- 缺值寫成「...」（尚未發布）或「－」（無）
"""
from __future__ import annotations

import csv
import re

from common import download

URL = (
    "https://web02.mof.gov.tw/njswww/webMain.aspx?sys=220&ym={ym}&kind=21&type=5&funid={funid}"
    "&cycle=4&outmode=12&compmode=00&outkind=11&fldspc=0,{cols},&utf=1"
)
ROC_OFFSET = 1911
TAIWAN = "中華民國"  # 國際比較表裡台灣的欄名


def _num(text: str) -> float | None:
    try:
        return float(text.strip().replace(",", ""))
    except ValueError:
        return None  # 「...」「－」


def _year(text: str) -> int | None:
    match = re.fullmatch(r"(\d+)(年度|年)?", text.strip())
    if not match:
        return None
    year = int(match.group(1))
    return year + ROC_OFFSET if match.group(2) else year


def table(funid: str, first_roc: int = 54, cols: int = 40) -> dict[int, dict[str, float]]:
    """{西元年: {欄名: 值}}，缺值的欄不放。欄名前面的全形空白（表示層級）會去掉。"""
    path = download(URL.format(ym=first_roc * 100, funid=funid, cols=cols), "mof", f"{funid}.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.reader(f) if r]
    if len(rows) < 2 or _year(rows[1][0]) is None:
        raise RuntimeError(f"財政部 {funid} 沒有資料列，網址格式可能變了：{rows[:2]}")
    header = [h.strip().replace("　", "") for h in rows[0]]
    out: dict[int, dict[str, float]] = {}
    for row in rows[1:]:
        year = _year(row[0])
        if year is None:
            continue
        values = {name: v for name, cell in zip(header[1:], row[1:]) if (v := _num(cell)) is not None}
        if values:
            out[year] = values
    return out


def tax_burden(with_social_security: bool = True) -> dict[int, float]:
    """台灣的賦稅負擔率（賦稅收入 ÷ GDP，%），各級政府合計、日曆年。

    含社會安全捐的（i0801）2000 年起，是財政部依 OECD 稅收分類編的，跟 OECD Revenue Statistics 的
    total tax revenue 同一個定義；不含的（i08012）1966 年起。表裡其他國家的數字照抄 OECD。
    """
    data = table("i0801" if with_social_security else "i08012")
    return {y: row[TAIWAN] for y, row in data.items() if TAIWAN in row}


def social_security() -> dict[int, dict[str, float]]:
    """社會安全捐（i0809，百萬元）：「社會安全捐合計」、各項保險與退休基金，以及「占GDP比率」。"""
    return table("i0809", 89)


def government_debt() -> dict[int, dict[str, float]]:
    """各級政府 1 年以上非自償性債務未償餘額（i0231，百萬元；公共債務法的口徑）。

    欄位有「總計」「各級政府總計占當年度GDP之比率」「中央政府」等。IMF WEO 的台灣「一般政府總債務」就是這個比率。
    """
    return table("i0231", 80)


def public_debt_overview() -> dict[int, dict[str, float]]:
    """各級政府公共債務概況（i0234，百萬元）：普通基金與非營業基金的債務，含未滿 1 年、自償性債務。"""
    return table("i0234", 80)


def budget_balance() -> dict[int, float]:
    """各級政府歲入歲出餘絀占 GDP（%，總決算及特別決算，i0101）。IMF WEO 的台灣淨借貸就是這個比率。"""
    return {y: row["餘絀占GDP比率"] for y, row in table("i0101", 80).items() if "餘絀占GDP比率" in row}
