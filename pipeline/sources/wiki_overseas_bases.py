"""英文維基百科「List of countries with overseas military bases」：各國在國外的軍事基地（CC BY-SA 4.0）。

固定版本 REVISION（2026-10-23），用 MediaWiki API 讀 wikitext（index.php?action=raw 常回 429）。
每個派駐國一節（美國再分五大洲的小節），每節一張表，一列是一個駐在國：第一格是駐在國的國旗模板
（{{flag|Japan}}、{{PNG}}、{{flagicon image|…}} [[Syria]]），俄羅斯的表把國家放在標題格（! {{Flag|Armenia}}）。
同一個駐在國跨好幾列（rowspan）的，後面的列沒有國旗，算在前一個國家。
俄羅斯的表裡有爭議的地區寫兩面國旗（{{Flag|Ukraine}}<br />{{Flag|Russia}}<br />(disputed)），取第一面（國際承認的國家）。
"""
from __future__ import annotations

import json
import re
import urllib.parse
from dataclasses import dataclass

from common import download

PAGE = "List of countries with overseas military bases"
REVISION = 1381583292  # 2026-10-23
API = "https://en.wikipedia.org/w/api.php"
PAGE_URL = f"https://en.wikipedia.org/w/index.php?oldid={REVISION}"
# 國旗模板的國家代碼（{{PNG}}）
FLAG_CODES = {"PNG": "Papua New Guinea", "BIH": "Bosnia and Herzegovina"}


@dataclass
class Base:
    operator: str  # 派駐國（節的標題）
    host: str  # 駐在國（國旗模板的名稱）
    disputed: bool  # 表上寫 (disputed)
    location: str  # 地點欄（純文字）


def _text(cell: str) -> str:
    s = re.sub(r"<ref[^>/]*/>", "", cell)
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"'{2,}", "", s)
    s = re.sub(r"<br\s*/?>", ", ", s)
    s = re.sub(r"<[^>]+>", "", s).replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", s).strip(" ,")


def _host(cell: str) -> str | None:
    cell = re.sub(r"\{\{flagicon\|NATO\}\}", "", cell)
    if m := re.search(r"\{\{\s*[Ff]lag\s*\|\s*([^|}]+)", cell):
        return m.group(1).strip()
    if m := re.search(r"\{\{flagicon image\|[^}]*\}\}\s*\[\[([^|\]]+)", cell):
        return m.group(1).strip()
    if m := re.match(r"\s*\{\{([A-Z]{3})\}\}", cell):
        return FLAG_CODES[m.group(1)]
    return None


def bases() -> list[Base]:
    url = f"{API}?{urllib.parse.urlencode({'action': 'parse', 'oldid': REVISION, 'prop': 'wikitext', 'format': 'json', 'formatversion': 2})}"
    with open(download(url, "wikipedia", f"overseas-bases-{REVISION}.json"), encoding="utf-8") as f:
        wikitext = json.load(f)["parse"]["wikitext"]
    heads = list(re.finditer(r"^(=+)\s*(.*?)\s*=+\s*$", wikitext, re.M))
    out: list[Base] = []
    operator = None
    for i, h in enumerate(heads):
        level, title = len(h.group(1)), h.group(2)
        if level == 2:
            operator = title
        if title in {"Background", "See also", "Notes", "References", "Further reading"}:
            continue
        body = wikitext[h.end(): heads[i + 1].start() if i + 1 < len(heads) else len(wikitext)]
        for table in re.findall(r"\{\|.*?\n\|\}", body, flags=re.S):
            host = None
            for row in re.split(r"^\|-.*$", table, flags=re.M)[1:]:
                lines = [ln for ln in row.strip().split("\n") if ln.startswith(("|", "!")) and not ln.startswith("|}")]
                if not lines:
                    continue
                cells = [c for ln in lines for c in re.split(r"\|\||!!", ln[1:])]
                first = re.sub(r'^\s*rowspan="\d+"\s*\|', "", cells[0])
                found = _host(first)
                if found:
                    host = found
                    rest = cells[1:]
                elif all(ln.startswith("!") for ln in lines):  # 欄位名稱的列
                    continue
                elif host:  # rowspan 的後續列：地點是第一格
                    rest = cells
                else:
                    raise RuntimeError(f"{operator} 的表有一列找不到駐在國：{cells[0][:80]}")
                disputed = "(disputed)" in first
                location = _text(rest[0]) if rest and operator not in {"Russia", "Bangladesh"} else ""
                out.append(Base(operator, host, disputed, location))
    return out
