"""英文維基百科「List of oldest companies」：1700 年以前成立、還在營業的公司（CC BY-SA 4.0）。

固定版本 REVISION（2026-10-15），用 MediaWiki API 讀 wikitext（index.php?action=raw 常回 429）。
「Founded before 1300」到「1650 to 1699」六個表，欄位是 Year、Company、Current location、Field、Sources。
年份有「1655-1658」「c. 1000」這種寫法，取第一個數字；所在地有的只寫國家、有的寫城市與國家，國家取最後一段。
"""
from __future__ import annotations

import json
import re
import urllib.parse
from dataclasses import dataclass

from common import download

PAGE = "List of oldest companies"
REVISION = 1380332977  # 2026-10-15T02:51Z
API = "https://en.wikipedia.org/w/api.php"
PAGE_URL = f"https://en.wikipedia.org/w/index.php?oldid={REVISION}"


@dataclass
class Company:
    year: int
    name: str  # 顯示的名稱
    title: str | None  # 英文維基條目（連結的目標）
    location: str  # 所在地的文字
    places: list[str]  # 所在地連到的條目（城市、國家）
    country: str  # 所在地的最後一段（國名）
    field: str


def _strip(cell: str) -> str:
    cell = re.sub(r"<ref[^>/]*/>", "", cell)
    cell = re.sub(r"<ref[^>]*>.*?</ref>", "", cell, flags=re.S)
    cell = re.sub(r"<!--.*?-->", "", cell, flags=re.S)
    cell = re.sub(r"\{\{efn\|.*?\}\}", "", cell, flags=re.S)
    return cell.strip()


def _text(cell: str) -> str:
    s = re.sub(r"\{\{(?:nowrap|small|lang\|[^|]*)\|([^{}]*)\}\}", r"\1", cell)
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"'{2,}", "", s)
    s = re.sub(r"<br\s*/?>", ", ", s)
    s = re.sub(r"<[^>]+>", "", s).replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", s).strip(" ,")


def _links(cell: str) -> list[str]:
    return [m.group(1).strip() for m in re.finditer(r"\[\[([^|\]#]+)(?:#[^|\]]*)?(?:\|[^\]]*)?\]\]", cell)
            if not m.group(1).startswith(("File:", "Image:"))]


def companies() -> list[Company]:
    url = f"{API}?{urllib.parse.urlencode({'action': 'parse', 'oldid': REVISION, 'prop': 'wikitext', 'format': 'json', 'formatversion': 2})}"
    with open(download(url, "wikipedia", f"oldest-companies-{REVISION}.json"), encoding="utf-8") as f:
        wikitext = json.load(f)["parse"]["wikitext"]
    out: list[Company] = []
    for table in re.finditer(r'\{\|\s*class="wikitable[^\n]*\n(.*?)\n\|\}', wikitext, re.S):
        for block in table.group(1).split("\n|-")[1:]:
            cells: list[str] | None = []
            for line in _strip(block).strip("\n").split("\n"):
                if line.startswith("!"):
                    cells = None  # 表頭
                    break
                if line.startswith("|"):
                    cells.extend(p.strip() for p in line[1:].split("||"))
                elif cells:
                    cells[-1] += " " + line
            if not cells or len(cells) < 4:
                continue
            year = re.search(r"\d{3,4}", cells[0])
            if not year:
                continue
            links = _links(cells[1])
            location = _text(cells[2])
            out.append(Company(
                year=int(year.group()), name=_text(cells[1]), title=links[0] if links else None,
                location=location, places=_links(cells[2]), country=location.split(",")[-1].strip(" |"), field=_text(cells[3]),
            ))
    if len(out) < 900:
        raise RuntimeError(f"「{PAGE}」只讀到 {len(out)} 家，表格的格式可能變了")
    return out
