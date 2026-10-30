"""英文維基百科各屆奧運的比賽場館（CC BY-SA 4.0）：運動主題的「奧運場館」（topics/olympic_venues.py）用。

Wikidata 的場館與各屆奧運的關係很少（2024 年巴黎只有 7 個場館寫了 P793「重要事件」，2026-10-30 查），所以以維基百科為主：
有「Venues of the … Olympics（and Paralympics）」條目的屆別讀整篇，沒有的（1896–1936 年夏季、2024 年夏季、預定的 2030 年冬季）
讀各屆主條目的「Venues」一節。都是固定版本（REVISIONS，2026-10-30 用 action=query 查的最新版本）。

表格的格式各屆不同：找表頭有 venue（或 stadium、location、site）的欄當場館，有 sport（或 event、discipline）的欄當項目；
場館是格子裡第一個連結的條目（座標用 Wikidata 查，topics/olympic_venues.py）。沒有表格、只有清單的屆別讀清單項目的第一個連結。
"""
from __future__ import annotations

import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass

from common import CACHE_DIR, USER_AGENT
from sources import wikitable
from sources.wiki_racing import _links_skip_flags, headers

# (季, 年) → (頁名, revid, 讀哪一節：None 是整篇)
REVISIONS: dict[tuple[str, int], tuple[str, int, str | None]] = {
    ("summer", 1896): ("1896 Summer Olympics", 1381248007, "Venues"),
    ("summer", 1900): ("1900 Summer Olympics", 1377995803, "Venues"),
    ("summer", 1904): ("1904 Summer Olympics", 1382051642, "Venues"),
    ("summer", 1908): ("1908 Summer Olympics", 1377995808, "Venues"),
    ("summer", 1912): ("1912 Summer Olympics", 1381792985, "Venues"),
    ("summer", 1920): ("1920 Summer Olympics", 1380786826, "Venues"),
    ("summer", 1924): ("1924 Summer Olympics", 1370699247, "Venues"),
    ("summer", 1928): ("1928 Summer Olympics", 1376843890, "Venues"),
    ("summer", 1932): ("1932 Summer Olympics", 1381769293, "Venues"),
    ("summer", 1936): ("1936 Summer Olympics", 1382031960, "Venues"),
    ("summer", 1948): ("Venues of the 1948 Summer Olympics", 1343222609, None),
    ("summer", 1952): ("Venues of the 1952 Summer Olympics", 1224546118, None),
    ("summer", 1956): ("Venues of the 1956 Summer Olympics", 1321495060, None),
    ("summer", 1960): ("Venues of the 1960 Summer Olympics", 1368998481, None),
    ("summer", 1964): ("Venues of the 1964 Summer Olympics", 1303319993, None),
    ("summer", 1968): ("Venues of the 1968 Summer Olympics", 1224546124, None),
    ("summer", 1972): ("Venues of the 1972 Summer Olympics", 1373053159, None),
    ("summer", 1976): ("Venues of the 1976 Summer Olympics", 1323655782, None),
    ("summer", 1980): ("Venues of the 1980 Summer Olympics", 1303320832, None),
    ("summer", 1984): ("Venues of the 1984 Summer Olympics", 1372128585, None),
    ("summer", 1988): ("Venues of the 1988 Summer Olympics", 1368691056, None),
    ("summer", 1992): ("Venues of the 1992 Summer Olympics", 1358862738, None),
    ("summer", 1996): ("Venues of the 1996 Summer Olympics", 1349495827, None),
    ("summer", 2000): ("Venues of the 2000 Summer Olympics", 1342461463, None),
    ("summer", 2004): ("Venues of the 2004 Summer Olympics", 1378754469, None),
    ("summer", 2008): ("Venues of the 2008 Summer Olympics", 1367677566, None),
    ("summer", 2012): ("Venues of the 2012 Summer Olympics and Paralympics", 1372201657, None),
    ("summer", 2016): ("Venues of the 2016 Summer Olympics and Paralympics", 1264203448, None),
    ("summer", 2020): ("Venues of the 2020 Summer Olympics and Paralympics", 1332425256, None),
    ("summer", 2024): ("2024 Summer Olympics", 1381136614, "Venues"),
    ("summer", 2028): ("Venues of the 2028 Summer Olympics and Paralympics", 1382252836, None),
    ("summer", 2032): ("Venues of the 2032 Summer Olympics and Paralympics", 1382478573, None),
    ("winter", 1924): ("Venues of the 1924 Winter Olympics", 1303319271, None),
    ("winter", 1928): ("Venues of the 1928 Winter Olympics", 1303319299, None),
    ("winter", 1932): ("Venues of the 1932 Winter Olympics", 1368996541, None),
    ("winter", 1936): ("Venues of the 1936 Winter Olympics", 1368997189, None),
    ("winter", 1948): ("Venues of the 1948 Winter Olympics", 1368997426, None),
    ("winter", 1952): ("Venues of the 1952 Winter Olympics", 1332310442, None),
    ("winter", 1956): ("Venues of the 1956 Winter Olympics", 1368998047, None),
    ("winter", 1960): ("Venues of the 1960 Winter Olympics", 1339916524, None),
    ("winter", 1964): ("Venues of the 1964 Winter Olympics", 1368998662, None),
    ("winter", 1968): ("Venues of the 1968 Winter Olympics", 1303320178, None),
    ("winter", 1972): ("Venues of the 1972 Winter Olympics", 1368125627, None),
    ("winter", 1976): ("Venues of the 1976 Winter Olympics", 1368999749, None),
    ("winter", 1980): ("Venues of the 1980 Winter Olympics", 1369000447, None),
    ("winter", 1984): ("Venues of the 1984 Winter Olympics", 1339673364, None),
    ("winter", 1988): ("Venues of the 1988 Winter Olympics", 1369002458, None),
    ("winter", 1992): ("Venues of the 1992 Winter Olympics", 1369003243, None),
    ("winter", 1994): ("Venues of the 1994 Winter Olympics", 1303321450, None),
    ("winter", 1998): ("Venues of the 1998 Winter Olympics", 1351923190, None),
    ("winter", 2002): ("Venues of the 2002 Winter Olympics", 1367949910, None),
    ("winter", 2006): ("Venues of the 2006 Winter Olympics", 1324460387, None),
    ("winter", 2010): ("Venues of the 2010 Winter Olympics", 1351710013, None),
    ("winter", 2014): ("Venues of the 2014 Winter Olympics and Paralympics", 1309824659, None),
    ("winter", 2018): ("Venues of the 2018 Winter Olympics and Paralympics", 1224546092, None),
    ("winter", 2022): ("Venues of the 2022 Winter Olympics and Paralympics", 1366925561, None),
    ("winter", 2026): ("Venues of the 2026 Winter Olympics and Paralympics", 1369542993, None),
    ("winter", 2030): ("2030 Winter Olympics", 1382766679, "Venues"),
}
# 還沒辦的（場館是預定的）
PLANNED = {("summer", 2028), ("summer", 2032), ("winter", 2030)}


def wikitext(key: tuple[str, int]) -> str:
    page, rev, _ = REVISIONS[key]
    target = CACHE_DIR / "wikipedia" / f"olympic-venues-{rev}.wikitext"
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        url = f"https://en.wikipedia.org/w/index.php?oldid={rev}&action=raw"
        for attempt in range(10):
            try:
                print(f"  下載 {url}（{page}）")
                with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": USER_AGENT})) as resp:
                    target.write_bytes(resp.read())
                break
            except urllib.error.HTTPError as err:
                if err.code != 429 or attempt == 9:
                    raise
                wait = int(err.headers.get("retry-after") or 20) + 2
                print(f"    維基百科回 429，等 {wait} 秒", flush=True)
                time.sleep(wait)
    return target.read_text(encoding="utf-8")


@dataclass
class Venue:
    title: str  # 條目名稱（座標用 Wikidata 查）；沒有連結的是 None
    label: str  # 顯示的名稱
    sports: str  # 比過的項目（條目的原文，英文）


# 不是比賽場館的小節或清單項目（選手村、轉播中心、媒體中心、訓練場）
SKIP_HEADING = re.compile(r"non-?compet|training|village|media|broadcast|reference|notes|see also|external|further reading|bibliograph|"
                          r"construction|legacy|transport|accommodation|ceremon", re.I)
SKIP_ITEM = re.compile(r"\bvillage\b|broadcast|\bIBC\b|\bMPC\b|media cent|press cent|training", re.I)


def _cut(text: str) -> str:
    """拿掉不是比賽場館的小節（依標題）"""
    out, skip_level = [], 0
    for line in text.split("\n"):
        h = re.match(r"^(=+)\s*(.*?)\s*=+\s*$", line)
        if h:
            level = len(h.group(1))
            if skip_level and level > skip_level:
                continue
            skip_level = level if SKIP_HEADING.search(h.group(2)) else 0
        if not skip_level:
            out.append(line)
    return "\n".join(out)


def _header(table: str) -> list[str]:
    """表頭：第一個有 venue 的表頭列（2016 年的表上面多一列「New competition venues」）"""
    for block in re.split(r"^\|-.*$", wikitable.strip_refs(table), flags=re.M):
        lines = [ln for ln in block.split("\n") if ln.startswith("!")]
        if not lines or any(ln.startswith("|") and not ln.startswith(("|-", "|+")) for ln in block.split("\n")):
            continue
        cells: list[str] = []
        for ln in lines:
            for c in wikitable._split_top(ln[1:], "!!"):
                content, _, cs = wikitable._cell(c)
                cells += [wikitable.text(content).lower()] * cs
        if any(c.startswith("venue") for c in cells):
            return cells
    return headers(table)


def _sport_text(cell: str) -> str:
    t = wikitable.text(re.sub(r"\[\[(?:File|Image):[^\]]*\]\]", "", cell, flags=re.I))
    return re.sub(r"\s+", " ", t.replace("\n", ", ")).strip(" ,;")


def venues(key: tuple[str, int]) -> list[Venue]:
    page, _, sec = REVISIONS[key]
    text = wikitext(key)
    if sec:
        from sources.wiki_racing import section

        for level in (2, 3):
            try:
                text = section(text, sec, level)
                break
            except KeyError:
                continue
    text = _cut(text)
    out: list[Venue] = []
    for table in wikitable.tables(text):
        hs = _header(table)
        # 場館欄有兩欄時（2028 年：園區、場館）用後面那一欄；項目欄可能有好幾欄（2016 年的「Sports」跨 3 欄，第一欄是園區代號），
        # 每一列取第一個有文字的；帕運的項目欄不用
        ivs = [i for i, h in enumerate(hs) if h.startswith("venue")]
        isps = [i for i, h in enumerate(hs) if re.match(r"(olympic )?(sport|event|discipline)", h)]
        if not ivs or not isps:
            continue  # 不是比賽場館的表（非比賽場館的 purpose、type；閉幕的表演）
        iv = ivs[-1]
        for r in wikitable.rows(table):
            if len(r) <= max(iv, *isps):
                continue
            links = _links_skip_flags(r[iv])
            label = wikitable.text(r[iv]).split("\n")[0].strip(" *†‡")
            if not label or label.lower().startswith("venue") or label.upper() == "TBA":
                continue
            # 2016 年項目欄的第一格是園區代號（一個字母），跳過；其他表只看第一個項目欄（第二欄是帕運）
            cells = [_sport_text(r[i]) for i in isps]
            sports = next((t for t in cells if not re.fullmatch(r"[A-Z]?", t)), "")
            out.append(Venue(links[0][0] if links else None, label, sports))
    if not out:
        # 清單：「* [[場館]]: 項目」「* [[場館]], 城鎮 – 項目」
        for line in text.split("\n"):
            if not line.startswith("*") or SKIP_ITEM.search(line):
                continue
            body = wikitable.strip_refs(line.lstrip("* "))
            links = _links_skip_flags(body)
            parts = re.split(r"\s*(?::|&nbsp;–|\s–\s|\s-\s)\s*", body, maxsplit=1)
            label = wikitable.text(parts[0]).split(",")[0].strip()
            sports = _sport_text(parts[1]) if len(parts) > 1 else ""
            if not label:
                continue
            first = links[0] if links and body.find("[[") == body.find(f"[[{links[0][0]}") and body.find("[[") < len(parts[0]) + 2 else None
            out.append(Venue(first[0] if first else None, label, sports))
    if not out:
        # 每個場館一個小節（2002 年冬季）：小節標題是場館，{{Main|條目}}
        for m in re.finditer(r"^===\s*(.*?)\s*===\s*\n(?:\{\{\s*[Mm]ain\s*\|([^|}]+))?", text, re.M):
            out.append(Venue((m.group(2) or m.group(1)).strip(), m.group(1).strip(), ""))
    # 只留比過奧運項目的（帕運專用的、只辦典禮或頒獎的不算比賽場館）
    kept = []
    for v in out:
        sports = olympic_sports(v.sports)
        if sports is None:
            continue
        v.sports = sports
        kept.append(v)
    # 同一個場館在好幾張表（依區域分表、奧運與帕運分表）：併成一筆
    merged: dict[str, Venue] = {}
    for v in kept:
        k = v.title or v.label
        if k in merged:
            if v.sports and v.sports not in merged[k].sports:
                merged[k].sports = ", ".join(x for x in (merged[k].sports, v.sports) if x)
        else:
            merged[k] = v
    return list(merged.values())


def olympic_sports(text: str) -> str | None:
    """項目的原文 → 只留奧運的比賽項目；沒有的（帕運專用、只辦開閉幕典禮、頒獎廣場、N/A）回傳 None。
    沒寫項目的（2002 年冬季的小節）回傳空字串"""
    t = text.strip()
    if not t:
        return ""
    m = re.search(r"Olympics?\s*:\s*(.*?)(?:Paralympics?\s*:|$)", t, re.I)  # 2032 年「Olympics: …, Paralympics: …」
    if m:
        t = m.group(1)
    # 在括號外依逗號、分號切開（「Cycling (BMX, track)」不切）
    parts, depth, cur = [], 0, ""
    for ch in t:
        depth += (ch == "(") - (ch == ")")
        if ch in ",;" and depth <= 0:
            parts.append(cur.strip())
            cur = ""
        else:
            cur += ch
    parts.append(cur.strip())
    keep = []
    for p in parts:
        low = p.lower()
        if not p or low in ("n/a", "—", "-", "tba", "none"):
            continue
        if re.search(r"\bpara\b|para[- ]|wheelchair|paralympic|goalball|boccia|sitting volleyball|blind football", low):
            continue
        if re.search(r"village|training cent|broadcast|media cent", low):
            continue
        if re.search(r"ceremon|medals? plaza|opening|closing|awarding", low) and not re.search(r"athletic|football|ski|skat|hockey", low):
            continue
        keep.append(p)
    return ", ".join(keep) if keep else None
