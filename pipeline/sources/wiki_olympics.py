"""英文維基百科的奧運獎牌榜（CC BY-SA 4.0）：每一屆一頁「<年> Summer/Winter Olympics medal table」，
加上「All-time Olympic Games medal table」用來核對總數。

- 用 MediaWiki API（action=parse&prop=wikitext）讀 wikitext，解析 `{{Medals table … | gold_USA = 40 | silver_USA = 44 | bronze_USA = 42 …}}`
  模板（每一屆都用這個模板，代碼是當屆的 IOC／NOC 代碼，例如 URS、GDR、FRG、TCH、YUG、EUN、ROC、AIN）。
  快取在 `.cache/wikipedia/olympics-<頁名>.json`，要抓新版（例如獎牌因禁藥重新分配）加 `--refresh`；
  每一頁的版本號（revid）寫進主題的 manifest.json。
- Olympedia（OlyMADMen）沒有開放授權，沒有用。
"""
from __future__ import annotations

import json
import re
import urllib.parse
from dataclasses import dataclass

from common import download

API = "https://en.wikipedia.org/w/api.php"
SUMMER = [1896, 1900, 1904, 1908, 1912, 1920, 1924, 1928, 1932, 1936, 1948, 1952, 1956, 1960, 1964, 1968, 1972, 1976,
          1980, 1984, 1988, 1992, 1996, 2000, 2004, 2008, 2012, 2016, 2020, 2024]
WINTER = [1924, 1928, 1932, 1936, 1948, 1952, 1956, 1960, 1964, 1968, 1972, 1976, 1980, 1984, 1988, 1992, 1994, 1998,
          2002, 2006, 2010, 2014, 2018, 2022, 2026]
ALL_TIME = "All-time Olympic Games medal table"


@dataclass
class Games:
    season: str  # "summer" / "winter"
    year: int
    revid: int
    medals: dict[str, tuple[int, int, int]]  # 代碼 → (金, 銀, 銅)


def _page(title: str) -> tuple[str, int]:
    params = {"action": "parse", "page": title, "prop": "wikitext|revid", "format": "json", "formatversion": 2, "redirects": 1}
    name = re.sub(r"[^A-Za-z0-9]+", "-", title).strip("-")
    path = download(f"{API}?{urllib.parse.urlencode(params)}", "wikipedia", f"olympics-{name}.json")
    with open(path, encoding="utf-8") as f:
        parse = json.load(f)["parse"]
    return parse["wikitext"], parse["revid"]


def _template(wikitext: str, start: int = 0) -> tuple[str, int]:
    """從 start 之後找第一個 {{Medals table，回傳整個模板（大括號配對）與結束位置"""
    i = wikitext.find("{{Medals table", start)
    if i < 0:
        raise RuntimeError("找不到 {{Medals table}}")
    depth, j = 0, i
    while j < len(wikitext):
        if wikitext.startswith("{{", j):
            depth += 1
            j += 2
        elif wikitext.startswith("}}", j):
            depth -= 1
            j += 2
            if depth == 0:
                return wikitext[i:j], j
        else:
            j += 1
    raise RuntimeError("{{Medals table}} 沒有結尾")


def _medals(template: str) -> dict[str, tuple[int, int, int]]:
    counts: dict[str, list[int]] = {}
    for kind, code, value in re.findall(r"\|\s*(gold|silver|bronze)_([A-Z0-9]+)\s*=\s*(\d+)", template):
        c = counts.setdefault(code, [0, 0, 0])
        c[("gold", "silver", "bronze").index(kind)] = int(value)
    return {k: tuple(v) for k, v in counts.items()}  # type: ignore[misc]


def games() -> list[Games]:
    out = []
    for season, years in (("summer", SUMMER), ("winter", WINTER)):
        for year in years:
            wikitext, revid = _page(f"{year} {season.capitalize()} Olympics medal table")
            template, _ = _template(wikitext)
            medals = _medals(template)
            if not medals:
                raise RuntimeError(f"{year} {season} 的獎牌榜是空的")
            out.append(Games(season, year, revid, medals))
    return out


def all_time() -> tuple[dict[str, tuple[int, int, int]], dict[str, tuple[int, int, int]], int]:
    """總表頁的夏季與冬季（頁面上第一、第二個 {{Medals table}}），用來核對各屆加起來的數字"""
    wikitext, revid = _page(ALL_TIME)
    summer, end = _template(wikitext)
    winter, _ = _template(wikitext, end)
    return _medals(summer), _medals(winter), revid
