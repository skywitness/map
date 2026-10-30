"""維基百科 wikitext 的表格解析（有 rowspan 的表）：最長的直飛航線、最繁忙的機場用。

- `fetch(頁名, 版本)`：用 MediaWiki API 讀固定版本的 wikitext（index.php?action=raw 常回 429），存進 pipeline/.cache/wikipedia。
- `strip_refs()`：拿掉 <ref>…</ref>、{{efn|…}}、{{cn}} 這類註腳（模板可以巢狀，用括號配對）。
- `rows(表格)`：一列一個 list，rowspan 的格子複製到下面幾列（colspan 複製到右邊幾格），表頭列（全是 !）略過。
  格子開頭的屬性（`rowspan="2" |`、`style=… |`、空的 `|`）拿掉，只留內容。
- `text()`：連結、nowrap 等模板換成純文字；`links()`：格子裡的 [[條目|顯示]] 的條目名稱。
"""
from __future__ import annotations

import json
import re
import urllib.parse

from common import download

API = "https://en.wikipedia.org/w/api.php"
# 註腳類的模板：整個拿掉
DROP_TEMPLATES = ("efn", "cn", "citation needed", "sfn", "refn", "r", "dubious", "clarify", "when", "update after", "as of", "better source needed")


def fetch(page: str, revision: int, cache_name: str) -> str:
    url = f"{API}?{urllib.parse.urlencode({'action': 'parse', 'oldid': revision, 'prop': 'wikitext', 'format': 'json', 'formatversion': 2})}"
    with open(download(url, "wikipedia", f"{cache_name}-{revision}.json"), encoding="utf-8") as f:
        data = json.load(f)["parse"]
    assert data["title"] == page, (data["title"], page)
    return data["wikitext"]


def _template_end(s: str, start: int) -> int:
    """s[start:] 以 {{ 開頭，回傳配對的 }} 之後的位置"""
    depth, i = 0, start
    while i < len(s) - 1:
        two = s[i:i + 2]
        if two == "{{":
            depth += 1
            i += 2
        elif two == "}}":
            depth -= 1
            i += 2
            if depth == 0:
                return i
        else:
            i += 1
    return len(s)


def strip_refs(s: str) -> str:
    s = re.sub(r"<ref[^>/]*/>", "", s)
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    out, i = [], 0
    while (j := s.find("{{", i)) >= 0:
        name = re.match(r"\{\{\s*([^|{}]*)", s[j:]).group(1).strip().lower()
        end = _template_end(s, j)
        out.append(s[i:j])
        if name not in DROP_TEMPLATES:
            out.append(s[j:end])
        i = end
    out.append(s[i:])
    return "".join(out)


def _split_top(s: str, sep: str) -> list[str]:
    """在連結與模板外面依 sep 切開"""
    parts, depth_t, depth_l, cur, i = [], 0, 0, [], 0
    while i < len(s):
        if s.startswith("{{", i):
            depth_t += 1
            cur.append("{{")
            i += 2
            continue
        if s.startswith("}}", i) and depth_t:
            depth_t -= 1
            cur.append("}}")
            i += 2
            continue
        if s.startswith("[[", i):
            depth_l += 1
            cur.append("[[")
            i += 2
            continue
        if s.startswith("]]", i) and depth_l:
            depth_l -= 1
            cur.append("]]")
            i += 2
            continue
        if not depth_t and not depth_l and s.startswith(sep, i):
            parts.append("".join(cur))
            cur = []
            i += len(sep)
            continue
        cur.append(s[i])
        i += 1
    parts.append("".join(cur))
    return parts


def _cell(raw: str) -> tuple[str, int, int]:
    """格子 → (內容, rowspan, colspan)；開頭有屬性的（`rowspan="2" | 內容`）拿掉屬性"""
    parts = _split_top(raw, "|")
    attrs, content = ("", raw) if len(parts) == 1 else (parts[0], "|".join(parts[1:]))
    if len(parts) > 1 and "=" not in attrs and attrs.strip():
        # 不是屬性（例如內容本身有 |），整格當內容
        attrs, content = "", raw
    rs = re.search(r'rowspan\s*=\s*"?(\d+)', attrs)
    cs = re.search(r'colspan\s*=\s*"?(\d+)', attrs)
    return content.strip(), int(rs.group(1)) if rs else 1, int(cs.group(1)) if cs else 1


def tables(wikitext: str) -> list[str]:
    """wikitext 裡的 wikitable（不含巢狀的表），依出現的順序"""
    return re.findall(r"^\{\|[^\n]*wikitable.*?^\|\}", wikitext, flags=re.S | re.M)


def rows(table: str) -> list[list[str]]:
    body = strip_refs(table)
    out: list[list[str]] = []
    pending: dict[int, tuple[str, int]] = {}  # 欄位 → (內容, 還要往下複製幾列)
    for block in re.split(r"^\|-.*$", body, flags=re.M)[1:]:
        raw_cells: list[str] = []
        header = True
        for line in block.split("\n"):
            if line.startswith("|}"):
                break
            if line.startswith(("|", "!")):
                is_head = line.startswith("!")
                header = header and is_head
                raw_cells.extend(_split_top(line[1:], "!!" if is_head else "||"))
            elif raw_cells and line.strip():
                raw_cells[-1] += "\n" + line
        if not raw_cells or header:
            continue
        row: list[str] = []
        col = 0
        cells = [_cell(c) for c in raw_cells]
        k = 0
        while k < len(cells) or col in pending:
            if col in pending:
                content, left = pending[col]
                row.append(content)
                if left > 1:
                    pending[col] = (content, left - 1)
                else:
                    del pending[col]
                col += 1
                continue
            content, rs, cs = cells[k]
            k += 1
            for _ in range(cs):
                row.append(content)
                if rs > 1:
                    pending[col] = (content, rs - 1)
                col += 1
        out.append(row)
    return out


def text(cell: str) -> str:
    s = cell
    while True:  # 模板可以巢狀（{{nowrap|{{sort|…}}}}），由內往外換
        t = re.sub(r"\{\{\s*(?:nowrap|nobr|small)\s*\|([^{}]*)\}\}", r"\1", s, flags=re.I)
        t = re.sub(r"\{\{\s*sort\s*\|[^|{}]*\|([^{}]*)\}\}", r"\1", t, flags=re.I)
        t = re.sub(r"\{\{\s*flag(?:icon|country)?\s*\|([^|{}]*)[^{}]*\}\}", r"\1", t, flags=re.I)
        t = re.sub(r"\{\{[^{}]*\}\}", "", t)
        if t == s:
            break
        s = t
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"\[https?://\S+\s+([^\]]*)\]", r"\1", s)
    s = re.sub(r"'{2,}", "", s)
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s).replace("&nbsp;", " ").replace("&ndash;", "–")
    return re.sub(r"[ \t]+", " ", s).strip()


def links(cell: str) -> list[str]:
    return [m.split("#")[0].strip() for m in re.findall(r"\[\[([^|\]]+)", cell)]
