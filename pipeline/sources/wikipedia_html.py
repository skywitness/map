"""英文維基百科的條目頁（HTML）：讀固定版本的表格。

- 為什麼讀 HTML：en.wikipedia.org 的 robots.txt 對所有程式寫 `Disallow: /w/`、`Disallow: /api/`、`Disallow: /wiki/Special:`，
  所以 `index.php?action=raw`、`api.php`、`Special:Export` 都不該用程式抓（2026-11-05 讀過 robots.txt）；
  `/wiki/<條目>?oldid=<版本>` 是允許的，用它讀固定版本的 HTML，表格一樣在裡面。
- 版本號（revid）寫在呼叫的地方，換版本時改它；頁面裡的 "wgRevisionId" 要跟它一致，對不上會報錯。
- 授權：維基百科的文字是 CC BY-SA 4.0，用它整理出來的資料檔要用相同授權分享。
"""
from __future__ import annotations

import html
import re
import urllib.parse
from html.parser import HTMLParser

from common import download


def page(title: str, revid: int) -> str:
    """固定版本的條目 HTML（快取在 .cache/wikipedia/）"""
    url = f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}?oldid={revid}"
    path = download(url, "wikipedia", f"{title.replace(' ', '_').replace('/', '_')}-{revid}.html")
    text = path.read_text(encoding="utf-8")
    found = re.search(r'"wgRevisionId":(\d+)', text)
    if not found or int(found.group(1)) != revid:
        raise RuntimeError(f"維基百科「{title}」：頁面的版本 {found and found.group(1)} 不是要的 {revid}")
    return text


class _Tables(HTMLParser):
    """把頁面裡的 wikitable 拆成 [列][格]；每一格是 (文字, 連結的條目名稱, 有沒有斜體)。處理 rowspan、colspan。"""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tables: list[list[list[tuple[str, list[str], bool]]]] = []
        self._depth = 0  # 巢狀表格的層數（只收最外層的 wikitable）
        self._rows: list[list[tuple[str, list[str], bool]]] | None = None
        self._row: list | None = None
        self._cell: list[str] | None = None
        self._links: list[str] = []
        self._italic = False
        self._skip = 0  # <sup class="reference">、<style> 這類不算文字
        self._spans: list[tuple[int, int]] = []
        self._pending: dict[tuple[int, int], tuple[str, list[str], bool]] = {}
        self._row_index = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "table":
            self._depth += 1
            if self._depth == 1 and "wikitable" in (a.get("class") or ""):
                self._rows, self._pending, self._row_index = [], {}, 0
            return
        if self._rows is None or self._depth != 1:
            return
        if tag == "tr":
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell, self._links, self._italic = [], [], False
            self._span = (int(re.sub(r"\D", "", a.get("rowspan") or "1") or 1), int(re.sub(r"\D", "", a.get("colspan") or "1") or 1))
        elif self._cell is not None:
            if tag == "sup" and "reference" in (a.get("class") or "") or tag in ("style", "script"):
                self._skip += 1
            elif self._skip:
                if tag in ("sup", "style", "script"):
                    self._skip += 1
            elif tag == "a" and (href := a.get("href", "")).startswith("/wiki/"):
                self._links.append(urllib.parse.unquote(href[6:].split("#")[0]).replace("_", " "))
            elif tag == "i":
                self._italic = True
            elif tag == "br":
                self._cell.append(" ")

    def handle_endtag(self, tag):
        if tag == "table":
            if self._depth == 1 and self._rows is not None:
                self.tables.append(self._rows)
                self._rows = None
            self._depth -= 1
            return
        if self._rows is None or self._depth != 1:
            return
        if self._skip and tag in ("sup", "style", "script"):
            self._skip -= 1
        elif tag in ("td", "th") and self._cell is not None and self._row is not None:
            text = re.sub(r"\s+", " ", html.unescape("".join(self._cell))).strip()
            cell = (text, self._links, self._italic)
            col = self._next_col()
            rows, cols = self._span
            for dr in range(rows):
                for dc in range(cols):
                    if dr or dc:
                        self._pending[(self._row_index + dr, col + dc)] = cell
            self._row.append(cell)
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self._fill_pending(len(self._row) + 100)
            self._rows.append(self._row)
            self._row, self._row_index = None, self._row_index + 1

    def _next_col(self) -> int:
        """這一格前面先補上 rowspan 留下來的格，回傳這一格的欄號"""
        assert self._row is not None
        while (self._row_index, len(self._row)) in self._pending:
            self._row.append(self._pending.pop((self._row_index, len(self._row))))
        return len(self._row)

    def _fill_pending(self, limit: int) -> None:
        assert self._row is not None
        while len(self._row) < limit and (self._row_index, len(self._row)) in self._pending:
            self._row.append(self._pending.pop((self._row_index, len(self._row))))

    def handle_data(self, data):
        if self._cell is not None and not self._skip:
            self._cell.append(data)


def tables(text: str) -> list[list[list[tuple[str, list[str], bool]]]]:
    """頁面裡所有 wikitable（最外層），每個是 [列][格]，格是 (文字, 連結, 斜體)"""
    parser = _Tables()
    parser.feed(text)
    return parser.tables


def number(text: str) -> float | None:
    """表格裡的數字：去掉千分位逗號、註腳；沒有數字（—、空白）是 None"""
    m = re.search(r"-?\d[\d,]*(?:\.\d+)?", text.replace("−", "-"))
    return float(m.group(0).replace(",", "")) if m else None
