"""主計總處 家庭收支調查（政府資料開放授權條款）：台灣的自有住宅率與平均每戶人數。

- 每年的調查報告（https://www.stat.gov.tw/News.aspx?n=3908）附有歷年統計表，ods 讀 content.xml：
  - 第 24 表「家庭住宅狀況」：住宅權屬分配（自有、不住在一起的配偶父母或子女所有、租押、配住借用及其他）。
  - 第 26 表「年中戶數與平均每戶人數、就業人數」。
- 下載網址裡的編號每一版都不同（114 年版是 11530/236588），新版要到上面的網頁找。
- 第一欄是民國年（「114年」），第二欄是西元年。
- 自有住宅率 99 年（2010）改了定義：
  - 之前「自有」含不住在一起的配偶、父母或子女所有的住宅（2007 年 88.14% 是最高點）；
  - 之後只算戶內經常居住成員自己擁有的，另外列出「不住在一起的配偶、父母或子女所有」（約 5%）。
  所以只取 2010 年起。
"""
from __future__ import annotations

from pathlib import Path

from common import download
from sources.moe import _sheet_rows

BASE = "https://ws.dgbas.gov.tw/001/Upload/463/relfile/11530/236588/"  # 114 年家庭收支調查報告
EDITION = 114
OWNERSHIP_FROM = 2010  # 自有住宅率改定義的那一年


def _table(name: str) -> list[list]:
    path: Path = download(f"{BASE}{name}.ods", "fies", f"{EDITION}-{name}.ods")
    return _sheet_rows(path)


def _year_rows(rows: list[list]) -> dict[int, list]:
    """第一欄是「114年」、第二欄是西元年的列：{西元年: 該列}"""
    out = {}
    for row in rows:
        if len(row) > 1 and isinstance(row[0], str) and row[0].endswith("年") and isinstance(row[1], float):
            out[int(row[1])] = row
    if not out:
        raise RuntimeError("家庭收支調查的統計表沒有年份列，格式可能變了")
    return out


def _numbers(row: list) -> list[float | None]:
    return [c if isinstance(c, float) else None for c in row[2:]]


def home_ownership() -> dict[int, float]:
    """自有住宅率（%，戶內經常居住成員自有），2010 年起。

    第 24 表的數值欄依序是：每戶居住坪數平均、中位數，每人居住坪數平均、中位數，自來水普及率，
    接著是住宅權屬：自有、不住在一起的配偶父母或子女所有、租押、配住借用及其他。
    """
    out = {}
    for year, row in _year_rows(_table("Year24")).items():
        numbers = _numbers(row)
        if year >= OWNERSHIP_FROM and len(numbers) >= 9 and numbers[5] is not None:
            tenure = numbers[5:9]
            if any(v is None for v in tenure) or abs(sum(tenure) - 100) > 0.5:
                raise RuntimeError(f"第 24 表 {year} 年的住宅權屬加起來不是 100：{tenure}")
            out[year] = numbers[5]
    return out


def household_size() -> dict[int, float]:
    """平均每戶人數（全體家庭），1976 年起每年（1971 年另有一次）。第 26 表第二個數值欄。"""
    out = {}
    for year, row in _year_rows(_table("Year26")).items():
        numbers = _numbers(row)
        if len(numbers) >= 2 and numbers[1] is not None:
            out[year] = numbers[1]
    return out
