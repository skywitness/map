"""英文維基百科「List of countries by number of military and paramilitary personnel」：各國的現役兵力（CC BY-SA 4.0）。

固定版本 REVISION（2026-10-18），用 MediaWiki API 讀 wikitext（index.php?action=raw 常回 429）。
表的每一列是一個 {{Number of soldiers| country=…| active=…| reserve=…| paramilitary=…| references=…}} 模板；
數字多數引自 IISS The Military Balance 2024、2025、2026 不同版本（references 寫 [[#IISS2025|IISS 2025]], p. 231），
少數國家的出處是維基百科的條目（[[Royal Bhutan Army]]），沒有寫版本。
同一個出處重複引用時寫成具名的 <ref name="auto"/>，要回頭找第一次出現的 <ref name="auto">…</ref>。
頁首掛著 {{Outdated|date=June 2025}}：有些國家還是舊版的數字。
"""
from __future__ import annotations

import json
import re
import urllib.parse
from dataclasses import dataclass

from common import download

PAGE = "List of countries by number of military and paramilitary personnel"
REVISION = 1380910017  # 2026-10-18
API = "https://en.wikipedia.org/w/api.php"
PAGE_URL = f"https://en.wikipedia.org/w/index.php?oldid={REVISION}"


@dataclass
class Personnel:
    country: str  # 表上的國名
    active: int  # 現役
    reserve: int  # 後備
    paramilitary: int  # 準軍事部隊
    edition: int | None  # 引用的 IISS The Military Balance 版本（年份）；出處不是 IISS 時是 None
    pages: str | None  # IISS 的頁碼（「309-310」）
    article: str | None  # 出處是維基百科條目時的條目名稱


def _int(text: str) -> int:
    return int(re.sub(r"[,\s]", "", text) or 0)


def _field(body: str, name: str) -> str:
    m = re.search(rf"\|\s*{name}\s*=\s*([^|]*)", body)
    return m.group(1).strip() if m else ""


def rows() -> list[Personnel]:
    url = f"{API}?{urllib.parse.urlencode({'action': 'parse', 'oldid': REVISION, 'prop': 'wikitext', 'format': 'json', 'formatversion': 2})}"
    with open(download(url, "wikipedia", f"military-personnel-{REVISION}.json"), encoding="utf-8") as f:
        wikitext = json.load(f)["parse"]["wikitext"]
    named = {m.group(1): m.group(2) for m in re.finditer(r'<ref name="([^"]+)">(.*?)</ref>', wikitext, flags=re.S)}
    out: list[Personnel] = []
    for m in re.finditer(r"\{\{Number of soldiers\s*(\|.*?)\}\}\s*$", wikitext, flags=re.S | re.M):
        body = m.group(1)
        refs = body[body.index("references") :]
        refs = re.sub(r'<ref name="([^"]+)"\s*/>', lambda r: named[r.group(1)], refs)
        edition = pages = article = None
        if iiss := re.search(r"\[\[#IISS(\d{4})\|IISS \d{4}\]\],?\s*pp?\.\s*([\d\s\-–]+)", refs):
            edition, pages = int(iiss.group(1)), re.sub(r"\s", "", iiss.group(2)).replace("–", "-")
        elif link := re.search(r"<ref>\[\[([^|\]]+)", refs):
            article = link.group(1).strip()
        else:
            raise ValueError(f"兵力表的出處讀不懂：{refs[:120]}")
        out.append(Personnel(
            country=_field(body, "country"),
            active=_int(_field(body, "active")),
            reserve=_int(_field(body, "reserve")),
            paramilitary=_int(_field(body, "paramilitary")),
            edition=edition,
            pages=pages,
            article=article,
        ))
    return out
