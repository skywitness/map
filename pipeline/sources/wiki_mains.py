"""英文維基百科「Mains electricity by country」的表格（CC BY-SA 4.0）：各國的插頭類型、市電電壓與頻率。

- 用 MediaWiki API 讀固定版本（`REVISION`）的 wikitext，版本寫死，資料才不會隨條目改動而變；要更新就換版本號。
- 表格一列一國：國家（`{{flag|…}}`）、插頭類型（A–O 的字母）、國家標準、電壓（「230/400 V」是單相／三相，
  取斜線前的單相電壓；有好幾種的用 <br /> 分開）、頻率、附註。
- 這個表原本的主要來源是 IEC World Plugs，IEC 在 2026 年 9 月把那個網站下架了（條目的 References 一節有寫），
  所以用維基百科（衍生的資料檔依 CC BY-SA 4.0 分享）。
"""
from __future__ import annotations

import json
import re
import urllib.parse
from dataclasses import dataclass

from common import download

PAGE = "Mains electricity by country"
REVISION = 1380969207  # 2026-10-19T03:46:59Z
API = "https://en.wikipedia.org/w/api.php"
PAGE_URL = f"https://en.wikipedia.org/w/index.php?oldid={REVISION}"


@dataclass
class Mains:
    name: str  # 表格裡的國名
    plugs: list[str]  # ["A", "B"]
    volts: list[int]  # 單相電壓，例如 [110]、[127, 220]
    hertz: list[int]  # [60]、[50, 60]
    note: str  # 附註（英文原文，已去掉參考資料與連結語法）


def _clean(cell: str) -> str:
    s = re.sub(r"<ref[^>/]*/>", "", cell)
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"\{\{efn\|.*?\}\}", "", s, flags=re.S)
    s = re.sub(r"\{\{(?:nowrap|small)\|([^{}]*)\}\}", r"\1", s)
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = s.replace("&nbsp;", " ").replace("&ndash;", "–")
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    return s.strip()


def table() -> list[Mains]:
    url = f"{API}?{urllib.parse.urlencode({'action': 'parse', 'oldid': REVISION, 'prop': 'wikitext', 'format': 'json', 'formatversion': 2})}"
    path = download(url, "wikipedia", f"mains-electricity-{REVISION}.json")
    with open(path, encoding="utf-8") as f:
        wikitext = json.load(f)["parse"]["wikitext"]
    start = wikitext.index('{| class="wikitable')
    end = wikitext.index("\n|}", start)
    body = wikitext[start:end]
    out: list[Mains] = []
    for block in body.split("\n|-")[1:]:
        lines = [l for l in block.strip("\n").split("\n")]
        cells: list[str] = []
        for line in lines:
            if line.startswith("|") and not line.startswith("|}"):
                cells.append(line[1:].strip())
            elif cells:  # 儲存格裡換行
                cells[-1] += "\n" + line
        if len(cells) < 5:
            continue
        m = re.search(r"\{\{flag\|([^|}]+)", cells[0])
        if not m:
            continue
        name = m.group(1).strip()
        plugs = re.findall(r"\b([A-O])\b", _clean(cells[1]))
        volts = [int(v) for v in re.findall(r"(\d{2,3})(?:/\d{3})?\s*V", _clean(cells[3]))]
        hertz = [int(h) for h in re.findall(r"(\d{2})\s*Hz", _clean(cells[4]))]
        note = _clean(cells[5]) if len(cells) > 5 else ""
        out.append(Mains(name, sorted(set(plugs)), volts, sorted(set(hertz)), re.sub(r"\s+", " ", note)))
    if len(out) < 200:
        raise RuntimeError(f"維基百科的插頭表只讀到 {len(out)} 列，格式可能改了")
    return out
