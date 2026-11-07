"""超級電腦：TOP500 的國別分布（2026-11-07，製作手冊第二十五批 513，候選 1192；擴充「大型科學設施」）。

候選 153（TOP500 官網）使用者 2026-10-29 不做：官網沒有任何資料授權、XLSX 要登入。這一項改用英文維基「TOP500」的
固定版本（revid 1379703900，CC BY-SA 4.0，只引用事實：各國系統數與各國最快的機器），使用者 2026-11-05 在知道這點之後挑了它。
en.wikipedia 的 robots.txt 不准 /wiki/Special:，讀 /wiki/TOP500?oldid=… 的 HTML。
- 「Other rankings」一節的歷年表：2006 年 11 月到 2026 年 6 月共 40 期（手冊寫 1993 年起，實際是 2006 年起），每年取 6 月榜；
  「EU」是聚合列，不收。
- 「Fastest supercomputer in TOP500 by country」：各國最快的機器，寫成附註。
TOP500 是自願申報（條目寫明美國國家安全局 1998 年後不再申報、中國青島 2021 年的 exaflops 機器 OceanLight 沒有送榜），說明寫在最前面。
輸出 public/data/topics/science-facilities/supercomputers.json。
"""

from __future__ import annotations

import html
import re

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "science-facilities"
REVID = 1379703900
URL = f"https://en.wikipedia.org/wiki/TOP500?oldid={REVID}"
NAMES = {"Taiwan": "TWN", "South Korea": "KOR", "Russia": "RUS", "Czech Republic": "CZE", "Czechia": "CZE"}


def _clean(c: str) -> str:
    c = re.sub(r"<style.*?</style>|<sup.*?</sup>", "", c, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip()


def _table(page: str, section: str) -> str:
    i = page.index(f'id="{section}"')
    return re.search(r'<table class="[^"]*wikitable[^"]*".*?</table>', page[i:], re.S).group(0)


def _iso(name: str) -> str | None:
    return NAMES.get(name) or from_name(name)


def build() -> None:
    page = download(URL, "wikipedia", f"TOP500-{REVID}.html").read_text(encoding="utf-8")
    hist = _table(page, "Other_rankings")
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", hist, re.S)
    periods = re.findall(r">((?:Jun|Nov) \d{4})<sup", rows[0])
    assert len(periods) == 40, periods
    june = {int(p[4:]): i for i, p in enumerate(periods) if p.startswith("Jun")}
    years = sorted(june)
    data: dict[str, list[int | None]] = {}
    for tr in rows[1:]:
        cells = [_clean(c) for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", tr, re.S)]
        if not cells or cells[0] in ("EU", "European Union", "Total"):
            continue
        iso3 = _iso(cells[0])
        if not iso3:
            print(f"  對不到國名：{cells[0]}")
            continue
        vals = cells[1:]
        data[iso3] = [int(vals[june[y]]) if june[y] < len(vals) and vals[june[y]].isdigit() else None for y in years]

    fast = _table(page, "Fastest_supercomputer_in_TOP500_by_country")
    notes, notes_en = {}, {}
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", fast, re.S)[1:]:
        raw = re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", tr, re.S)
        c = [_clean(x) for x in raw]
        if len(c) < 5 or not (iso3 := _iso(c[0])):
            continue
        rmax = _clean(re.split(r"<br", raw[3])[0])  # 同一格是 Rmax 換行 Rpeak
        notes[iso3] = f"2026 年 6 月榜上這一國最快的是 {c[1]}（第 {c[2]} 名，Rmax {rmax} PFlop/s，{c[4]}）。"
        notes_en[iso3] = f"The fastest system in this country on the June 2026 list is {c[1]} (rank {c[2]}, Rmax {rmax} PFlop/s, {c[4]})."
    write_json(OUT / "supercomputers.json", indicator_file(
        "supercomputers", "systems", years, dict(sorted(data.items())), notes=notes, notesEn=notes_en,
        license="CC BY-SA 4.0",
        attribution=f"Wikipedia contributors, “TOP500” (revision {REVID}), https://en.wikipedia.org/"))
    last = {k: v[-1] for k, v in data.items() if v[-1]}
    print(f"  TOP500：{len(data)} 國，{years[0]}–{years[-1]} 年 6 月榜；2026："
          + "、".join(f"{k} {v}" for k, v in sorted(last.items(), key=lambda kv: -kv[1])[:12]) + f"；台灣 {last.get('TWN')}")
    print(f"  最快的機器：{len(notes)} 國；台灣：{notes.get('TWN')}")
