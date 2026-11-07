"""大型科學設施的天文設施（2026-11-07，製作手冊第二十五批 512，候選 1191）：大型光學望遠鏡、電波望遠鏡、天文台、微中子實驗。

- 資料：英文維基四篇清單的固定版本（CC BY-SA 4.0，只引用事實：名稱、年份、地點）。en.wikipedia 的 robots.txt 不准 /w/、
  /api/、/wiki/Special:，手冊寫的 Special:Export 不能用，改讀 /wiki/<條目>?oldid=<版本> 的 HTML（.cache/wikipedia/）。
  - List of largest optical reflecting telescopes（revid 1380348596）：第一個表（口徑、出資國、地點、First light）
  - List of radio telescopes（revid 1371673085）：依洲分節的表；太空的、提案中的不收，「興建中或規劃中」那一節算規劃中
  - List of astronomical observatories（revid 1377735702）：第二個表（名稱、Established、地點）；品質不齊，只收有啟用年份、
    在 Wikidata 有座標的
  - List of neutrino experiments（revid 1379607454）：Operation 欄的年份（「2006–2022」已關閉、「2020-」運作中、future 規劃中）
- 位置與國家：名稱欄連結的條目在 Wikidata（CC0）的座標（P625）與國家（P17）；沒有的用地點欄的連結。走 QLever
  （qlever.dev/api/wikidata；query.wikidata.org 的 /sparql 被 robots.txt 禁止）。電波望遠鏡沒有年份欄，用 Wikidata 的
  啟用（P571）與關閉（P576）年份。南極的設施國家寫 ATA。地圖歸屬照設施所在地（昴星團望遠鏡在美國夏威夷），出資國不畫。
輸出由 science_facilities.py 合併（群組 4、細類 8–11）。
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import urllib.parse
import urllib.request
from collections import Counter

from common import CACHE_DIR, USER_AGENT, download

ARTICLES = {
    "optical": ("List_of_largest_optical_reflecting_telescopes", 1380348596),
    "radio": ("List_of_radio_telescopes", 1371673085),
    "observatory": ("List_of_astronomical_observatories", 1377735702),
    "neutrino": ("List_of_neutrino_experiments", 1379607454),
}
SUBTYPE = {"optical": 8, "radio": 9, "observatory": 10, "neutrino": 11}
QLEVER = "https://qlever.dev/api/wikidata"
OPERATING, CLOSED, CLOSED_UNKNOWN, PLANNED = 1, 2, 3, 4
LAST = 2026
ZH = {
    "Five-hundred-meter Aperture Spherical Telescope": "五百米口徑球面電波望遠鏡（FAST，天眼）",
    "Arecibo Telescope": "阿雷西博望遠鏡", "Lulin Observatory": "鹿林天文台", "Subaru Telescope": "昴星團望遠鏡",
    "Keck 1": "凱克一號望遠鏡", "Keck 2": "凱克二號望遠鏡", "Gran Telescopio Canarias": "加那利大型望遠鏡",
    "IceCube Neutrino Observatory": "冰立方微中子天文台", "Super-Kamiokande": "超級神岡探測器",
    "Submillimeter Array": "次毫米波陣列（SMA）", "Greenland Telescope": "格陵蘭望遠鏡",
    "Atacama Large Millimeter Array": "阿塔卡瑪大型毫米及次毫米波陣列（ALMA）",
}


def _page(group: str) -> str:
    title, rev = ARTICLES[group]
    return download(f"https://en.wikipedia.org/wiki/{title}?oldid={rev}", "wikipedia", f"{title}-{rev}.html").read_text(encoding="utf-8")


def _clean(c: str) -> str:
    c = re.sub(r"<style.*?</style>|<sup.*?</sup>", "", c, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip()


def _links(c: str) -> list[str]:
    out = []
    for href in re.findall(r'<a [^>]*href="(?:https://en\.wikipedia\.org)?/wiki/([^"#?]+)', c):
        t = urllib.parse.unquote(href).replace("_", " ")
        if ":" not in t:
            out.append(t)
    return out


def _cells(tr: str) -> list[str]:
    return re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", tr, re.S)


def _tables(page: str) -> list[tuple[str, str]]:
    """[(所在的 h2 節名, 表的 HTML)]"""
    out = []
    section = ""
    for m in re.finditer(r'<h2[^>]*id="([^"]+)"|(<table class="[^"]*wikitable[^"]*".*?</table>)', page, re.S):
        if m.group(1):
            section = m.group(1)
        else:
            out.append((section, m.group(2)))
    return out


def _year(text: str) -> int | None:
    m = re.search(r"(1[5-9]\d\d|20\d\d)", text)
    return int(m.group(1)) if m else None


def _records() -> list[dict]:
    recs: list[dict] = []
    # 大型光學望遠鏡
    _, table = _tables(_page("optical"))[0]
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S)[1:]:
        c = _cells(tr)
        if len(c) < 7:
            continue
        first = _clean(c[6])
        planned = bool(re.search(r"planned|construction|future", first, re.I)) or _year(first) is None or (_year(first) or 0) > LAST
        recs.append({"group": "optical", "name": re.sub(r"\s*\([^)]*\)$", "", _clean(c[0])), "links": _links(c[0]) + _links(c[5]),
                     "start": _year(first), "end": None, "planned": planned, "org": _clean(c[4]), "aperture": _clean(c[2]).split(" (")[0]})
    # 電波望遠鏡
    for section, table in _tables(_page("radio")):
        if section in ("Space-based", "Proposed_telescopes", "Gallery_of_big_dishes"):
            continue
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S)[1:]:
            c = _cells(tr)
            if len(c) < 2 or not _clean(c[0]):
                continue
            remarks = _clean(c[3]) if len(c) > 3 else ""
            end = None
            m = re.search(r"(collapsed|decommissioned|demolished|destroyed|closed)[^.]{0,40}?(19\d\d|20\d\d)", remarks, re.I)
            if m:
                end = int(m.group(2))
            recs.append({"group": "radio", "name": _clean(c[0]), "links": _links(c[0]) + _links(c[1]), "start": None, "end": end,
                         "planned": section.startswith("Under_construction"), "org": _clean(c[1]), "aperture": None})
    # 天文台
    _, table = _tables(_page("observatory"))[1]
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S)[1:]:
        c = _cells(tr)
        if len(c) < 3:
            continue
        est = _clean(c[1])
        years = [int(y) for y in re.findall(r"(1[5-9]\d\d|20\d\d)", est)]
        if not years:
            continue
        recs.append({"group": "observatory", "name": _clean(c[0]), "links": _links(c[0]) + _links(c[2]), "start": years[0],
                     "end": years[1] if len(years) > 1 and re.search(r"[–-]", est) else None, "planned": years[0] > LAST,
                     "org": _clean(c[2]), "aperture": None})
    # 微中子實驗
    _, table = _tables(_page("neutrino"))[0]
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S)[1:]:
        c = _cells(tr)
        if len(c) < 11:
            continue
        op = _clean(c[10])
        years = [int(y) for y in re.findall(r"(19\d\d|20\d\d)", op)]
        planned = bool(re.search(r"future|planned|construction|proposed", op, re.I)) or not years or years[0] > LAST
        closed = len(years) > 1
        name = _clean(c[0])
        full = _clean(c[1])
        recs.append({"group": "neutrino", "name": f"{name}（{full}）" if full and full != name else name,
                     "links": _links(c[0]) + _links(c[1]) + _links(c[9]), "start": years[0] if years else None,
                     "end": years[1] if closed else None, "planned": planned, "org": _clean(c[9]), "aperture": None})
    return recs


def _wikidata(titles: list[str]) -> dict[str, dict]:
    vals = " ".join(json.dumps(t, ensure_ascii=False) + "@en" for t in sorted(set(titles)))
    path = CACHE_DIR / "qlever" / f"astro-{hashlib.sha1(vals.encode()).hexdigest()[:10]}.json"
    if not path.exists():
        query = f"""PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX schema: <http://schema.org/>
SELECT ?title ?c ?iso ?inc ?end ?loc WHERE {{
  VALUES ?title {{ {vals} }}
  ?a schema:name ?title ; schema:isPartOf <https://en.wikipedia.org/> ; schema:about ?s .
  OPTIONAL {{ ?s wdt:P625 ?c }}
  OPTIONAL {{ ?s wdt:P276/wdt:P625 ?loc }}
  OPTIONAL {{ ?s wdt:P17/wdt:P298 ?iso }}
  OPTIONAL {{ ?s wdt:P571 ?inc }}
  OPTIONAL {{ ?s wdt:P576 ?end }}
}}"""
        req = urllib.request.Request(QLEVER, data=urllib.parse.urlencode({"query": query}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
        with urllib.request.urlopen(req, timeout=300) as r:
            body = r.read()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
    info: dict[str, dict] = {}
    for r in json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]:
        d = info.setdefault(r["title"]["value"], {"iso": set()})
        for k in ("c", "loc"):
            if k in r and k not in d:
                lon, lat = r[k]["value"].upper().removeprefix("POINT(").removesuffix(")").split()
                d[k] = (float(lon), float(lat))
        if "iso" in r:
            d["iso"].add(r["iso"]["value"])
        for k in ("inc", "end"):
            if k in r and re.match(r"\d{4}", r[k]["value"]):
                y = int(r[k]["value"][:4])
                d[k] = min(y, d.get(k, y))
    return info


def rows() -> list[dict]:
    """science_facilities.py 的列格式（群組 4）"""
    recs = _records()
    # 天文台清單裡也有的望遠鏡、微中子實驗（同一個條目），只留專門清單的那一筆
    primary = {r["links"][0] for r in recs if r["group"] != "observatory" and r["links"]}
    recs = [r for r in recs if not (r["group"] == "observatory" and r["links"] and r["links"][0] in primary)]
    info = _wikidata([t for r in recs for t in r["links"]])
    out, dropped = [], Counter()
    for r in recs:
        where = next(((info[t].get("c") or info[t].get("loc"), info[t]) for t in r["links"] if t in info and (info[t].get("c") or info[t].get("loc"))), None)
        if not where:
            dropped[r["group"]] += 1
            continue
        (lon, lat), d = where
        isos = sorted(d["iso"])
        iso3 = "ATA" if lat < -60 else (isos[0] if len(isos) == 1 else next((i for t in r["links"] if t in info for i in sorted(info[t]["iso"])), None))
        if not iso3:
            dropped[r["group"]] += 1
            continue
        start = r["start"] if r["start"] is not None else d.get("inc")
        end = r["end"] if r["end"] is not None else (d.get("end") if r["group"] == "radio" else None)
        if r["planned"]:
            state = PLANNED
        elif end is not None:
            state = CLOSED
        else:
            state = OPERATING
        out.append({"lon": round(lon, 4), "lat": round(lat, 4), "g": 4, "t": SUBTYPE[r["group"]], "st": state, "s": start,
                    "e": end if state == CLOSED else None, "en": r["name"], "zh": ZH.get(r["name"]), "org": (r["org"] or "")[:120] or None,
                    "iso3": iso3, "gev": r["aperture"] or None, "yr": LAST})
    kinds = Counter(x["t"] for x in out)
    print(f"  天文設施：光學 {kinds[8]}、電波 {kinds[9]}、天文台 {kinds[10]}、微中子 {kinds[11]}（沒有座標或國家不收：{dict(dropped)}）")
    return out
