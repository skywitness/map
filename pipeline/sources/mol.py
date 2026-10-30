"""勞動部：台灣的每月基本工資（2025 年起改稱最低工資）。政府資料開放授權條款（https://www.mol.gov.tw/2578/2584/3276/）。

勞動部沒有歷年基本工資的開放資料檔，下面照勞動部網頁抄錄（生效日期, 每月金額）：
- 「基本工資之制訂與調整經過」：https://www.mol.gov.tw/1607/28162/28166/28180/99861/28184/29016/
  （1956 年起；1992 年以前只有月薪與日薪，之後另有時薪。舊網址 …/28180/28182/28184/29016/ 2026-10-30 回 HTTP 410）
- 最低工資法 2025 年 1 月 1 日施行，基本工資改稱最低工資：2025 年 28,590 元；
  2026 年 29,500 元（民國 114 年 10 月 21 日發布）。
- 2027 年 1 月 1 日起每月 30,900 元、每小時 205 元（民國 115 年 10 月 16 日發布，同一頁），還沒生效的不收
  （見 monthly()），附註先寫已公告（upcoming()）。
勞動部公告新的金額時要在 CHANGES 補一列。
"""
from __future__ import annotations

from datetime import date

CHANGES = [
    (date(1956, 1, 1), 300),
    (date(1964, 1, 1), 450),
    (date(1968, 3, 16), 600),
    (date(1978, 12, 1), 2400),
    (date(1980, 5, 1), 3300),
    (date(1983, 5, 1), 5700),
    (date(1984, 7, 1), 6150),
    (date(1986, 11, 1), 6900),
    (date(1988, 7, 1), 8130),
    (date(1989, 7, 1), 8820),
    (date(1990, 8, 1), 9750),
    (date(1991, 8, 1), 11040),
    (date(1992, 8, 1), 12365),
    (date(1993, 8, 16), 13350),
    (date(1994, 8, 20), 14010),
    (date(1995, 8, 1), 14880),
    (date(1996, 9, 1), 15360),
    (date(1997, 10, 16), 15840),
    (date(2007, 7, 1), 17280),
    (date(2011, 1, 1), 17880),
    (date(2012, 1, 1), 18780),
    (date(2013, 4, 1), 19047),
    (date(2014, 7, 1), 19273),
    (date(2015, 7, 1), 20008),
    (date(2017, 1, 1), 21009),
    (date(2018, 1, 1), 22000),
    (date(2019, 1, 1), 23100),
    (date(2020, 1, 1), 23800),
    (date(2021, 1, 1), 24000),
    (date(2022, 1, 1), 25250),
    (date(2023, 1, 1), 26400),
    (date(2024, 1, 1), 27470),
    (date(2025, 1, 1), 28590),  # 最低工資法施行，改稱最低工資
    (date(2026, 1, 1), 29500),
    (date(2027, 1, 1), 30900),  # 2026-10-16 發布，還沒生效
]
# 已公告、還沒生效的每小時最低工資（附註用）
HOURLY = {date(2027, 1, 1): 205}
ANNOUNCED = {date(2027, 1, 1): "2026-10-16"}


def monthly() -> dict[int, float]:
    """{西元年: 每月基本工資／最低工資（新臺幣）}，取每年 7 月 1 日適用的金額。

    ILOSTAT 年中調整的國家也是取年中的金額（例如法國 2023 年 1 月 1,709 歐元、5 月起 1,747 歐元，
    ILOSTAT 的 2023 年是 1,747）。只收已經到 7 月 1 日的年份。
    """
    today = date.today()
    out: dict[int, float] = {}
    for year in range(CHANGES[0][0].year, today.year + 1):
        mid = date(year, 7, 1)
        if mid > today:
            break
        in_force = [amount for start, amount in CHANGES if start <= mid]
        if in_force:
            out[year] = in_force[-1]
    return out


def upcoming() -> list[tuple[date, int, int | None, str | None]]:
    """已公告、還沒生效的調整：[(生效日, 每月, 每小時, 發布日)]"""
    today = date.today()
    return [(start, amount, HOURLY.get(start), ANNOUNCED.get(start)) for start, amount in CHANGES if start > today]
