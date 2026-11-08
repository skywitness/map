"""維基百科串流服務「上線時程表」（Release date／Country or territory／Release partner 的 rowspan 表）的解析
（2026-11-08，製作手冊第二十八批 678 的 Disney+；順序 685 的 Peacock 是同一種表，共用這裡）。

`sources.wikipedia_html.tables()` 已經把 rowspan 展開成每一列都有日期，這裡只做：
- 日期「November 12, 2019」→ `2019-11-12`；
- 國家或地區 → ISO alpha-3 的清單（一列可能是好幾個，例如 French West Indies），先看連結的條目名、再看文字；
- **區域名（Sub-Saharan Africa、Nordics、Latin America……）不能當國家**：遇到 REGIONS 裡的名稱直接報錯，讓呼叫的人自己決定；
  遇到對不上的名稱也報錯，不默默丟掉（手冊：解析完要抽樣對 10 列）。
"""
from __future__ import annotations

import datetime as dt
import re

from sources.countries import from_name

# 對不上 pycountry 的地區名，或一列是好幾個 ISO 碼的
TERRITORIES: dict[str, list[str]] = {
    "French West Indies": ["GLP", "MTQ", "BLM", "MAF"],  # 瓜地洛普、馬丁尼克、聖巴瑟米、法屬聖馬丁
    "Caribbean Netherlands": ["BES"],
    "Åland": ["ALA"],
    "French Southern and Antarctic Lands": ["ATF"],
    "Pitcairn Islands": ["PCN"],
    "Sint Maarten": ["SXM"],
    "Svalbard and Jan Mayen": ["SJM"],
    "Gibraltar": ["GIB"],
    "Republic of Ireland": ["IRL"],
    "The Bahamas": ["BHS"],
    "Kosovo": ["XKX"],
    "Palestine": ["PSE"],
}
# 不是國家的區域名：表上出現時要呼叫的人自己拆
REGIONS = {
    "Sub-Saharan Africa", "Nordics", "Nordic countries", "Latin America", "Latin America and the Caribbean", "Caribbean",
    "Europe", "Middle East", "Middle East and North Africa", "MENA", "Southeast Asia", "Asia-Pacific", "Africa",
    "Central America", "South America", "Central and Eastern Europe", "Balkans", "Scandinavia", "Benelux",
}
MONTHS = {m: i + 1 for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"])}


def parse_date(text: str) -> str:
    """「November 12, 2019」→「2019-11-12」；對不上就報錯。"""
    m = re.match(r"\s*([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})", text)
    if not m or m.group(1) not in MONTHS:
        raise ValueError(f"看不懂的日期：{text!r}")
    return dt.date(int(m.group(3)), MONTHS[m.group(1)], int(m.group(2))).isoformat()


def territory(name: str, links: list[str] | None = None) -> list[str]:
    """國家或地區的格子 → ISO alpha-3 的清單。"""
    name = re.sub(r"\[[^\]]*\]", "", name).strip()
    for key in [*(links or [])[:1], name]:
        if key in REGIONS:
            raise ValueError(f"「{key}」是區域名，不是國家，要自己拆成國家")
        if key in TERRITORIES:
            return TERRITORIES[key]
        iso = from_name(key)
        if iso:
            return [iso]
    raise ValueError(f"對不上 ISO 碼的國家或地區：{name!r}（連結 {links}）")


def rows(table: list[list[tuple]], date_col: str, country_col: str) -> list[dict]:
    """表格（第一列是標題）→ 每一列一筆 {date, name, iso3: [...], cells: {標題: 文字}}。"""
    header = [c[0].strip() for c in table[0]]
    di, ci = header.index(date_col), header.index(country_col)
    out = []
    for r in table[1:]:
        cells = {h: re.sub(r"\[[^\]]*\]", "", r[i][0]).strip() for i, h in enumerate(header) if i < len(r)}
        out.append({
            "date": parse_date(r[di][0]),
            "name": cells[country_col],
            "iso3": territory(r[ci][0], list(r[ci][1] or [])),
            "cells": cells,
        })
    return out
