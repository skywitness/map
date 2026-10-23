"""Passport Index 的簽證待遇資料集（199 本護照 × 199 個目的地，MIT 授權）。

資料是從 passportindex.org（Arton Capital）的網站抓下來整理的：
- 原本的 ilyankou/passport-index-dataset（2019 年起）最後一版是 2025-01-12，之後封存，README 指向接手的
  imorte/passport-index-data（2026-02-17 起，同一種 CSV 格式，也是 MIT）。這裡用接手的版本，比較新。
- 用 raw.githubusercontent.com 抓固定 commit 的檔案，內容不會跟著變；要換新版時改 COMMIT 與 DATA_DATE。

passport-index-tidy-iso3.csv 的欄位：Passport（護照）、Destination（目的地）、Requirement：
- 7–360：免簽證可停留的天數
- visa free：免簽證，天數不明或不適用（歐盟境內自由移動；塞席爾的旅客登記、新加坡與馬來西亞的入境卡也算）
- eta：電子旅行授權（美國 ESTA、加拿大 eTA、英國 ETA、澳洲 eVisitor、蘇利南觀光卡等）
- visa on arrival：落地簽證
- e-visa：電子簽證（不含 eta）
- visa required：要事先申請簽證；古巴的觀光卡、中國大陸居民去港澳的往來港澳通行證也算在這裡
- no admission：不准入境（旅行禁令、戰爭等）
- -1：護照與目的地相同
"""
from __future__ import annotations

import csv
from dataclasses import dataclass

from common import download

REPO = "imorte/passport-index-data"
COMMIT = "9c59780dd0dbaefcbdfa0134d21cd99d0d547509"
# README 寫的資料日期（Last updated）
DATA_DATE = "2026-02-17"
FILE = "passport-index-tidy-iso3.csv"
URL = f"https://raw.githubusercontent.com/{REPO}/{COMMIT}/{FILE}"
PAGE = f"https://github.com/{REPO}/tree/{COMMIT}"

# 類別代碼：跟台灣的外交主題的簽證待遇（sources/boca.py、src/topics/diplomacy.ts 的 VISA）相同的 1–5，
# 側欄跟領事事務局的名單比對時直接比代碼；6、7 是這個資料集才有的
VISA_FREE, ETA, ON_ARRIVAL, E_VISA, REQUIRED, NO_ADMISSION = 1, 2, 3, 4, 5, 6
# 用通行證或許可、不用護照入境（兩岸、港澳），不是資料集原本的分類（見 topics/passport.py 的 PERMIT_PAIRS）
PERMIT = 7

CODES = {
    "visa free": VISA_FREE,
    "eta": ETA,
    "visa on arrival": ON_ARRIVAL,
    "e-visa": E_VISA,
    "visa required": REQUIRED,
    "no admission": NO_ADMISSION,
}


@dataclass(frozen=True)
class Requirement:
    code: int
    # 免簽證可停留的天數；資料集沒寫（visa free）或不是免簽證時是 None
    days: int | None


def parse(value: str) -> Requirement | None:
    """Requirement 欄位 → 類別與天數；-1（自己的護照）回傳 None。不認得的值（新的分類、舊版的 covid ban）直接報錯。"""
    value = value.strip()
    if value == "-1":
        return None
    if value.isdigit():
        days = int(value)
        if not 1 <= days <= 400:
            raise ValueError(f"Passport Index：免簽證天數不合理：{value}")
        return Requirement(VISA_FREE, days)
    if value not in CODES:
        raise ValueError(f"Passport Index：不認得的簽證待遇「{value}」，要在 sources/passport_index.py 加上對照")
    return Requirement(CODES[value], None)


def load() -> dict[str, dict[str, Requirement]]:
    """{護照: {目的地: Requirement}}，代碼是 ISO alpha-3（科索沃 XKX）；自己的護照不收"""
    path = download(URL, "passport-index", f"{COMMIT[:7]}-{FILE}")
    table: dict[str, dict[str, Requirement]] = {}
    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != ["Passport", "Destination", "Requirement"]:
            raise ValueError(f"Passport Index：欄位跟預期的不同：{reader.fieldnames}")
        for row in reader:
            passport, destination = row["Passport"].strip(), row["Destination"].strip()
            req = parse(row["Requirement"])
            if req is None:
                if passport != destination:
                    raise ValueError(f"Passport Index：{passport} → {destination} 是 -1，但不是同一個國家")
                continue
            table.setdefault(passport, {})[destination] = req
    passports = set(table)
    for passport, row in table.items():
        missing = passports - set(row) - {passport}
        if missing:
            raise ValueError(f"Passport Index：{passport} 護照缺少目的地 {sorted(missing)}")
    return table
