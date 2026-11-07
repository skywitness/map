"""節慶：票房最高的巡迴演唱會去了哪些城市（2026-11-07，製作手冊第二十四批 436 合併的候選 1038；步驟 concert-tours，
輸出 topics/festivals/tours/）。

- 選哪些巡迴（客觀規則）：英文維基「List of highest-grossing concert tours」（revid 見 LIST_URL）第一張表「Highest-grossing
  tours」的全時期前 20 名（依實際票房）。票房、場次照那張表（原始數字來自 Pollstar、Billboard，維基已刊出的事實）。
- 每一場：各巡迴自己條目的場次表（「Date」「City」「Country」「Venue」這幾欄的 wikitable；讀 /wiki/條目 的 HTML，
  robots.txt 禁止 /w/ 與 /api/），處理 rowspan 與 colspan；標題含「cancel」的段落（取消的場次）不算。
  城市用表格裡的連結（英文維基條目）經 QLever 對到 Wikidata 的座標（schema:about、P625）。同一城市同一場館連著的幾場算一站。
- 輸出（每個巡迴一組）：tours/<id>.json（依日期把各站連成一條線）、tours/<id>-stops.json（每一站的點：城市、國家、場館、
  場次、日期）、tours/<id>-count.json（各國的場次，比例圓）。場次加總跟列表的「Shows」對不上的寫在說明（附加場、
  取消、表格寫法不同）。
- 授權：英文維基百科 CC BY-SA 4.0（只引用事實：日期、城市、場館、場次）；Wikidata CC0。
"""
from __future__ import annotations

import hashlib
import html
import re
import time
import urllib.parse
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, download, indicator_file, lines_file, points_file, write_json
from geoindex import countries_at
from sources import qlever_wikidata

OUT = OUT_DIR / "topics" / "festivals" / "tours"
LIST_URL = "https://en.wikipedia.org/wiki/List_of_highest-grossing_concert_tours?oldid=1383993933"
TOP = 20
# 表上沒有連結的城市（那篇條目裡都沒有連過）：英文維基的條目
CITY_PAGES = {"Lisbon": "Lisbon", "Phoenix": "Phoenix,_Arizona", "Christchurch": "Christchurch", "Barcelona": "Barcelona",
              "New York City": "New_York_City", "Washington, D.C.": "Washington,_D.C.", "Los Angeles": "Los_Angeles"}
YEAR = 2026


def _text(s: str) -> str:
    s = re.sub(r"<sup.*?</sup>", "", s, flags=re.S)
    s = re.sub(r"<span[^>]*display:\s*none[^>]*>.*?</span>", "", s, flags=re.S)
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s))).strip()


def _cells(row: str) -> list[tuple[str, str, int, int]]:
    """(文字, 原始 HTML, rowspan, colspan)"""
    out = []
    for m in re.finditer(r"<t([dh])([^>]*)>(.*?)</t[dh]>", row, re.S):
        attrs, inner = m.group(2), m.group(3)
        rs = re.search(r'rowspan="?(\d+)', attrs)
        cs = re.search(r'colspan="?(\d+)', attrs)
        out.append((_text(inner), inner, int(rs.group(1)) if rs else 1, int(cs.group(1)) if cs else 1))
    return out


def _grid(table: str) -> list[list[tuple[str, str]]]:
    """展開 rowspan、colspan，回傳每一列的（文字, HTML）"""
    rows = re.findall(r"<tr.*?</tr>", table, re.S)
    pending: dict[int, tuple[str, str, int]] = {}  # 欄 → (文字, HTML, 還剩幾列)
    grid = []
    for row in rows:
        cells = _cells(row)
        out: list[tuple[str, str]] = []
        col = 0
        it = iter(cells)
        while True:
            if col in pending:
                t, h, left = pending[col]
                out.append((t, h))
                pending[col] = (t, h, left - 1)
                if left - 1 == 0:
                    del pending[col]
                col += 1
                continue
            c = next(it, None)
            if c is None:
                break
            t, h, rs, cs = c
            for k in range(cs):
                out.append((t, h))
                if rs > 1:
                    pending[col] = (t, h, rs - 1)
                col += 1
        grid.append(out)
    return grid


def _tours() -> list[dict]:
    page = download(LIST_URL, "wikipedia", "tours-list-1383993933.html").read_text(encoding="utf-8")
    table = [t for t in re.findall(r'<table class="wikitable.*?</table>', page, re.S) if ">Peak<" in t or "Peak\n" in t][0]
    out = []
    for row in re.findall(r"<tr.*?</tr>", table, re.S)[1:]:
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)
        txt = [_text(c) for c in cells]
        link = re.search(r'href="https://en\.wikipedia\.org/wiki/([^"#]+)"', cells[5]) or re.search(r'href="\./([^"#]+)"', cells[5])
        out.append({"rank": int(txt[0]), "artist": txt[4], "title": txt[5].replace("†", "").replace("*", "").strip(),
                    "years": txt[6], "shows": int(re.sub(r"\D", "", txt[7]) or 0),
                    "gross": int(re.sub(r"\D", "", txt[2]) or 0), "page": link.group(1) if link else None})
        if len(out) == TOP:
            break
    return out


def _stops(page: str) -> list[dict]:
    """場次表 → 每一場（日期、城市的條目、城市、國家、場館）"""
    shows = []
    linked: dict[tuple[str, str], str] = {}  # 維基只在第一次出現時加連結：同一個城市名（加國家）後面沒連結的照用
    for m in re.finditer(r'<table class="wikitable[^"]*".*?</table>', page, re.S):
        table = m.group(0)
        before = page[:m.start()]
        heads = re.findall(r'<h[23][^>]*>(.*?)</h[23]>', before)
        if heads and re.search(r"cancel|postpone|resched", _text(heads[-1]), re.I):
            continue
        cap = re.search(r"<caption>(.*?)</caption>", table, re.S)
        if cap and re.search(r"cancel", _text(cap.group(1)), re.I):
            continue
        grid = _grid(table)
        header = next((i for i, r in enumerate(grid) if any(t.lower().startswith("date") for t, _ in r)
                       and any(t.lower() == "city" for t, _ in r) and any(t.lower().startswith("venue") for t, _ in r)), None)
        if header is None:
            continue
        names = [t.lower() for t, _ in grid[header]]
        ci = names.index("city")
        di = next(i for i, n in enumerate(names) if n.startswith("date"))
        ki = names.index("country") if "country" in names else None
        vi = next((i for i, n in enumerate(names) if n.startswith("venue")), None)
        for r in grid[header + 1:]:
            if len(r) <= max(ci, di) or len({t for t, _ in r}) == 1:
                continue  # 段落標題（整列合併）或總計
            date, (city, city_html) = r[di][0], r[ci]
            if not city or re.search(r"total", date, re.I):
                continue
            link = re.search(r'href="(?:https://en\.wikipedia\.org/wiki/|\./)([^"#]+)"', city_html)
            page_link = link.group(1) if link else None
            if page_link:
                linked.setdefault((city, r[ki][0] if ki is not None and ki < len(r) else ""), page_link)
            shows.append({"date": date, "city": city, "page": page_link,
                          "country": r[ki][0] if ki is not None and ki < len(r) else "",
                          "venue": r[vi][0] if vi is not None and vi < len(r) else ""})
    for sh in shows:
        if not sh["page"]:
            sh["page"] = linked.get((sh["city"], sh["country"])) or next(
                (v for (c, _), v in linked.items() if c == sh["city"]), None) or CITY_PAGES.get(sh["city"]) or (
                sh["city"].replace(" ", "_") if sh["city"] == sh["country"] else None)  # 新加坡：城市與國家同名，只有國家有連結
    return shows


def build() -> None:
    tours = _tours()
    all_pages: set[str] = set()
    per_tour: dict[int, list[dict]] = {}
    revids = {}
    for t in tours:
        if not t["page"]:
            continue
        title = urllib.parse.unquote(t["page"])
        slug = re.sub(r"[^A-Za-z0-9]+", "-", title)[:50].strip("-") + "-" + hashlib.sha1(title.encode()).hexdigest()[:6]
        path = CACHE_DIR / "wikipedia" / f"tour-{slug}.html"
        fresh = not path.exists()
        url = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(urllib.parse.unquote(t["page"]), safe="/:,()'!_-.~")
        page = download(url, "wikipedia", f"tour-{slug}.html").read_text(encoding="utf-8")
        if fresh:
            time.sleep(2)
        rev = re.search(r'"wgRevisionId":(\d+)', page)
        revids[t["rank"]] = int(rev.group(1)) if rev else None
        per_tour[t["rank"]] = _stops(page)
        for sh in per_tour[t["rank"]]:
            if sh["page"]:
                sh["page"] = urllib.parse.quote(urllib.parse.unquote(sh["page"]), safe="/:,()'!_-.~")
        all_pages |= {s["page"] for s in per_tour[t["rank"]] if s["page"]}

    # 城市的條目 → 座標（QLever 的 Wikidata：英文維基的 sitelink）
    coords: dict[str, tuple[float, float]] = {}
    pages = sorted(all_pages)
    for i in range(0, len(pages), 300):
        batch = pages[i:i + 300]
        values = " ".join(f"<https://en.wikipedia.org/wiki/{p}>" for p in batch)
        key = f"tour-cities-{hashlib.sha1(' '.join(batch).encode()).hexdigest()[:10]}"
        rows = qlever_wikidata.cached(key, "SELECT ?a ?c WHERE { VALUES ?a { %s } ?a schema:about ?i . ?i wdt:P625 ?c }" % values)
        for r in rows:
            m = re.match(r"POINT\(([-\d.eE]+) ([-\d.eE]+)\)", r["c"]["value"])
            if m:
                coords.setdefault(r["a"]["value"].split("/wiki/", 1)[1], (float(m.group(1)), float(m.group(2))))

    # 對不到的多半是重新導向的連結（Tampa → Tampa, Florida；Zürich → Zurich）：用城市名加國家名找 Wikidata 上同名、
    # 在那一國、有座標的地點，取維基百科條目最多的一個（同名的城市取最有名的，例如 Columbus 取俄亥俄州的）
    by_name: dict[tuple[str, str], tuple[float, float]] = {}
    pairs = sorted({(sh["city"], sh["country"]) for shows in per_tour.values() for sh in shows
                    if sh["country"] and not coords.get(sh["page"] or "")})
    if pairs:
        values = " ".join(f'("{c.replace(chr(34), "")}"@en "{k.replace(chr(34), "")}"@en)' for c, k in pairs)
        key = f"tour-cities-byname-{hashlib.sha1(values.encode()).hexdigest()[:10]}"
        rows = qlever_wikidata.cached(key, """SELECT ?name ?country ?c ?sl WHERE {
  VALUES (?name ?country) { %s }
  ?i rdfs:label ?name ; wdt:P17 ?k ; wdt:P625 ?c ; wikibase:sitelinks ?sl .
  ?k rdfs:label ?country .
}""" % values)
        best: dict[tuple[str, str], tuple[int, tuple[float, float]]] = {}
        for r in rows:
            m = re.match(r"POINT\(([-\d.eE]+) ([-\d.eE]+)\)", r["c"]["value"])
            if not m:
                continue
            k = (r["name"]["value"], r["country"]["value"])
            sl = int(r["sl"]["value"])
            if k not in best or sl > best[k][0]:
                best[k] = (sl, (float(m.group(1)), float(m.group(2))))
        by_name = {k: v[1] for k, v in best.items()}

    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for t in tours:
        shows = per_tour.get(t["rank"], [])
        if not shows:  # 條目沒有場次表（The Quittin' Time Tour 轉到歌手的條目）
            print(f"  {t['rank']:>2} {t['artist']} {t['title']}：維基條目沒有場次表，不畫")
            continue
        stops: list[dict] = []
        missing = Counter()
        for s in shows:
            pt = coords.get(s["page"] or "") or by_name.get((s["city"], s["country"]))
            if not pt:
                missing[s["city"]] += 1
                continue
            if stops and stops[-1]["page"] == s["page"] and stops[-1]["v"] == s["venue"]:
                stops[-1]["n"] += 1
                stops[-1]["d2"] = s["date"]
                continue
            stops.append({"lon": pt[0], "lat": pt[1], "page": s["page"], "c": s["city"], "co": s["country"], "v": s["venue"],
                          "n": 1, "d": s["date"], "d2": None})
        for i, st in enumerate(stops):
            st["o"] = i + 1
        isos = countries_at([s["lon"] for s in stops], [s["lat"] for s in stops]) if stops else []
        for st, iso in zip(stops, isos):
            st["iso3"] = iso
        tid = f"t{t['rank']}"
        write_json(OUT / f"{tid}-stops.json", points_file(stops, ["lon", "lat", "o", "n", "iso3", "c", "co", "v", "d", "d2"],
                                                          {"lon": 0.001, "lat": 0.001, "o": 1, "n": 1}, strings=("iso3",)), quiet=True)
        # 線：依順序連起來；經度展開成連續的（跨 180° 時不畫成橫越地圖的線）
        line: list[tuple[float, float]] = []
        for st in stops:
            lon = st["lon"]
            if line:
                while lon - line[-1][0] > 180:
                    lon -= 360
                while lon - line[-1][0] < -180:
                    lon += 360
            line.append((lon, st["lat"]))
        write_json(OUT / f"{tid}.json", lines_file([line] if len(line) > 1 else [], 0.01), quiet=True)
        by_country: dict[str, int] = defaultdict(int)
        for st in stops:
            if st["iso3"]:
                by_country[st["iso3"]] += st["n"]
        write_json(OUT / f"{tid}-count.json", indicator_file("concert-tours", "場", [YEAR], {c: [n] for c, n in sorted(by_country.items())},
                                                             license="CC BY-SA 4.0"), quiet=True)
        total = sum(st["n"] for st in stops)
        index.append({"id": tid, "rank": t["rank"], "artist": t["artist"], "title": t["title"], "years": t["years"],
                      "shows": t["shows"], "gross": t["gross"], "mapped": total, "stops": len(stops), "countries": len(by_country),
                      "revid": revids.get(t["rank"]), "page": t["page"], "missing": sum(missing.values())})
        print(f"  {t['rank']:>2} {t['artist'][:20]:<20} {t['title'][:34]:<34} 列表 {t['shows']:>3} 場；表上 {len(shows):>3} 場、"
              f"畫出 {total:>3} 場、{len(stops)} 站、{len(by_country)} 國；對不到 {dict(missing.most_common(4))}；台灣 "
              f"{by_country.get('TWN', 0)}")
    write_json(OUT / "index.json", index)
