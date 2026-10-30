"""USGS Minerals Yearbook（MYB）：各礦種的世界各國產量表（美國政府著作，公有領域）。

- 年鑑每一章一個 xlsx，放在 USGS 網站的 S3（d9-wret）；pubs.usgs.gov/myb/vol1/ 的舊網址 2021 年版起是 404。
  章的網頁：https://www.usgs.gov/centers/national-minerals-information-center/<礦種>-statistics-and-information
- 年鑑比 Mineral Commodity Summaries（MCS，`usgs_mcs.py`）晚兩年（2026 年時最新是 2023 年版），但列出所有國家；
  MCS 只列主要生產國（鋼鐵 11 國、水泥 14 國）。
- 世界產量表的版面（鋼鐵表 10、水泥表 22 都一樣）：第一欄國名，後面每一年兩欄（數值、註記），
  數值單位是千公噸。註記：e 估計、r 修正、p 初步；「--」是零，「NA」「W」是沒有、保密。
  國名後面會黏著註腳字母或數字（「Irane」「Ethiopiae, 5」「United States6」），先照原樣查、查不到再拿掉。
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import openpyxl

from common import download
from sources import countries, usgs_mcs

BASE = "https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/media/files/"
SOURCE = "usgs-myb"


@dataclass
class Row:
    values: dict[int, float]  # 年份 → 千公噸
    estimated: set[int]  # 註記有 e 的年份


def _code(name: str) -> str | None:
    name = name.strip()
    candidates = [name, re.sub(r"(,\s*\d+)+$", "", name)]
    candidates.append(re.sub(r"\d+$", "", candidates[-1]))
    candidates.append(candidates[-1][:-1])  # 黏著的註腳字母 e
    for c in candidates:
        c = c.strip()
        if c == "Total":
            return "WLD"
        code = usgs_mcs.NAMES.get(c) or countries.from_name(c)
        if code:
            return code
    return None


def world_table(filename: str, sheet: str) -> dict[str, Row]:
    """回傳 ISO alpha-3（世界合計是 WLD）→ 各年產量；對不到國家的列印出來"""
    path = download(BASE + filename, SOURCE, filename)
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True)[sheet]
    rows = list(ws.iter_rows(values_only=True))
    header = next(i for i, r in enumerate(rows) if r[0] and str(r[0]).startswith("Country"))
    years = {j: int(v) for j, v in enumerate(rows[header]) if v is not None and str(v).strip().isdigit()}
    out: dict[str, Row] = {}
    for r in rows[header + 1:]:
        if not r[0] or all(r[j] is None for j in years):
            continue
        name = str(r[0])
        code = _code(name)
        if not code:
            if len(name) < 60:  # 註腳的說明文字很長，不是國家
                print(f"    （USGS 年鑑：對不到國家的列「{name}」）")
            continue
        row = Row({}, set())
        for j, year in years.items():
            v, flag = r[j], str(r[j + 1] or "")
            if v == "--":
                v = 0
            if not isinstance(v, (int, float)):
                continue
            row.values[year] = float(v)
            if "e" in flag:
                row.estimated.add(year)
        if code in out:
            raise ValueError(f"USGS 年鑑 {filename} 的 {code} 出現兩次（{name}）")
        out[code] = row
    return out
