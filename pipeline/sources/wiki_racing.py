"""英文維基百科的賽季條目與歷年列表（CC BY-SA 4.0）：賽車主題（topics/racing.py）用。

每一頁都是固定版本（REVISIONS），下載一次存進 pipeline/.cache/wikipedia（`racing-<revid>.wikitext`）。
MediaWiki API（action=parse）在這台機器上幾乎每次都回 429，先試 API，回 429 時改用同一個版本的
`index.php?oldid=<revid>&action=raw`（同一份 wikitext，只是沒有標題可以核對；標題另外用 action=query&revids= 核對過，
寫在 REVISIONS 的註解）。

- `season(代碼)`：今年（2026）賽季的各站：日期、名稱、場地（連結的條目）。
- `stages(代碼)`：三大環賽的各賽段：日期、起點、終點（連結的條目）。
- 歷年：`motogp_circuits()`、`wrc_rallies()`、`fe_eprix()`、`wec_races()`、`indycar_tracks()`、`tdf_departs()`、`grand_starts()`（環義、環西）、`megavalanche_years()`。
- 條目名稱 → 座標：`topics/racing.py` 用 Wikidata（CC0）查。
"""
from __future__ import annotations

import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import date

from common import CACHE_DIR, USER_AGENT
from sources import wikitable

YEAR = 2026

# 固定版本（2026-10-30 核對過標題與時間）
REVISIONS: dict[str, tuple[str, int]] = {
    "f1": ("2026 Formula One World Championship", 1382164833),  # 2026-10-27
    "motogp": ("2026 MotoGP World Championship", 1382784400),  # 2026-10-30
    "mtb": ("2026 UCI Mountain Bike World Cup", 1378631453),  # 2026-10-05
    "wrc": ("2026 World Rally Championship", 1382240280),  # 2026-10-27
    "wec": ("2026 FIA World Endurance Championship", 1382453603),  # 2026-10-28
    "fe": ("2025–26 Formula E World Championship", 1378716116),  # 2026-10-05
    "indycar": ("2026 IndyCar Series", 1382100428),  # 2026-10-26
    "nascar": ("2026 NASCAR Cup Series", 1382656461),  # 2026-10-29
    "tdf": ("2026 Tour de France", 1381542691),  # 2026-10-23
    "giro": ("2026 Giro d'Italia", 1373837936),  # 2026-09-08
    "vuelta": ("2026 Vuelta a España", 1378208761),  # 2026-10-03
    "mega": ("Megavalanche", 1366682232),  # 2026-07-29
    "motogp-circuits": ("List of Grand Prix motorcycle circuits", 1382661412),  # 2026-10-29
    "wrc-rallies": ("List of World Rally Championship rallies", 1379642139),  # 2026-10-11
    "mtb-history": ("UCI Mountain Bike World Cup", 1378672207),  # 2026-10-05（只有歷年的總冠軍，沒有場地）
    "fe-eprix": ("List of Formula E ePrix", 1375284024),  # 2026-09-16
    "tdf-departs": ("List of Tour de France Grands Départs", 1367742646),  # 2026-08-04
    "wec-races": ("FIA World Endurance Championship", 1379052812),  # 2026-10-07
    "indycar-tracks": ("List of IndyCar Series racetracks", 1381630080),  # 2026-10-23
    "nascar-tracks": ("List of NASCAR tracks", 1378454234),  # 2026-10-04（看過：只有比賽名稱、沒有場數，不用）
    "giro-starts": ("List of Giro d'Italia starts", 1360750068),  # 2026-06-23
    "vuelta-starts": ("List of Vuelta a España Gran Partidas", 1381803996),  # 2026-10-24
}

MONTHS = {m: i + 1 for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"])}


def wikitext(key: str) -> str:
    page, rev = REVISIONS[key]
    target = CACHE_DIR / "wikipedia" / f"racing-{rev}.wikitext"
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        url = f"https://en.wikipedia.org/w/index.php?oldid={rev}&action=raw"
        for attempt in range(10):
            try:
                print(f"  下載 {url}（{page}）")
                req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req) as resp:
                    target.write_bytes(resp.read())
                break
            except urllib.error.HTTPError as err:
                if err.code != 429 or attempt == 9:
                    raise
                wait = int(err.headers.get("retry-after") or 20) + 2
                print(f"    維基百科回 429，等 {wait} 秒", flush=True)
                time.sleep(wait)
    return target.read_text(encoding="utf-8")


def section(text: str, title: str, level: int = 2) -> str:
    """標題是 title 的那一節（到下一個同級或更高的標題）"""
    heads = list(re.finditer(r"^(=+)\s*(.*?)\s*=+\s*$", text, re.M))
    for i, h in enumerate(heads):
        if len(h.group(1)) == level and h.group(2).strip().lower() == title.lower():
            end = next((x.start() for x in heads[i + 1:] if len(x.group(1)) <= level), len(text))
            return text[h.end():end]
    raise KeyError(title)


def first_table(text: str) -> str:
    """第一張不是圖例（Key、Icon）的 wikitable"""
    for t in wikitable.tables(text):
        head = t[:400]
        if "|+ Key" in head or "|+Key" in head or "! Icon" in head:
            continue
        return t
    raise ValueError("找不到表格")


def headers(table: str) -> list[str]:
    """表頭（第一個 |- 之前或之後第一列的 ! 格子）的純文字，小寫"""
    out: list[str] = []
    for line in wikitable.strip_refs(table).split("\n")[1:]:
        if line.startswith("|-") and out:
            break
        if line.startswith("!"):
            for c in wikitable._split_top(line[1:], "!!"):
                content, _, cs = wikitable._cell(c)
                out += [wikitable.text(content).lower()] * cs
        elif line.startswith("|") and not line.startswith(("|-", "|+")) and out:
            break
    return out


def parse_date(s: str, default_year: int = YEAR) -> tuple[date, date]:
    """「8 March」「March 1」「13–14 June」「6 December 2025」「30 April – 3 May」→ (開始, 結束)"""
    s = wikitable.text(wikitable.strip_refs(s)).replace("\n", " ")
    s = re.sub(r"\s+", " ", s).strip()
    ym = re.search(r"\b(19|20)\d\d\b", s)
    year = int(ym.group(0)) if ym else default_year
    found: list[tuple[int, int]] = []  # (月, 日)
    tokens = [t.lower() for t in re.findall(r"[A-Za-z]+|\d+", s) if t.lower() in MONTHS or (t.isdigit() and int(t) <= 31)]
    if tokens and tokens[0] in MONTHS:
        # 美式「March 1」「May 30 – June 1」：日期屬於前面的月
        month = None
        for t in tokens:
            if t in MONTHS:
                month = MONTHS[t]
            else:
                found.append((month, int(t)))
    else:
        # 「8 March」「13–14 June」「30 April – 3 May」：日期屬於後面的月
        days: list[int] = []
        for t in tokens:
            if t in MONTHS:
                found += [(MONTHS[t], d) for d in days]
                days = []
            else:
                days.append(int(t))
    if not found:
        raise ValueError(f"看不懂日期：{s!r}")
    days = [date(year, m, d) for m, d in found]
    start, end = min(days), max(days)
    # 跨年的（12 月 30 日 – 1 月 2 日）不會出現在這些賽事，不處理
    return start, end


@dataclass
class Event:
    series: str
    name: str  # 賽事名稱（英文原文）
    venue: str  # 場地的條目名稱（Wikidata 查座標）
    venue_text: str  # 場地的顯示文字
    place: str  # 城鎮（顯示文字）
    start: date
    end: date
    round: str = ""
    extra: dict = field(default_factory=dict)


def _links_skip_flags(cell: str) -> list[tuple[str, str]]:
    """格子裡的連結（條目, 顯示文字），不含檔案、圖片"""
    out = []
    for m in re.finditer(r"\[\[([^|\]]+)(?:\|([^\]]*))?\]\]", cell):
        target = m.group(1).split("#")[0].strip()
        if target.lower().startswith(("file:", "image:")):
            continue
        out.append((target, (m.group(2) or m.group(1)).strip()))
    return out


def clean(cell: str) -> str:
    """名稱格子的純文字：拿掉國旗、開頭的 nowrap|"""
    cell = re.sub(r"\{\{\s*flag(?:icon)?\s*\|[^{}]*\}\}", "", cell, flags=re.I)
    cell = re.sub(r"^\s*nowrap\s*\|", "", cell)
    return wikitable.text(cell).replace("\n", " ").strip()


def _col(hs: list[str], *names: str) -> int:
    for n in names:
        for i, h in enumerate(hs):
            if h.startswith(n):
                return i
    raise KeyError((names, hs))


def _calendar(key: str, sec: str, name_cols: tuple[str, ...], venue_cols: tuple[str, ...], place_cols: tuple[str, ...],
              date_cols: tuple[str, ...], level: int = 2) -> list[tuple[list[str], dict[str, int]]]:
    text = wikitext(key)
    table = first_table(section(text, sec, level))
    hs = headers(table)
    cols = {"name": _col(hs, *name_cols), "venue": _col(hs, *venue_cols), "date": _col(hs, *date_cols)}
    if place_cols:
        cols["place"] = _col(hs, *place_cols)
    if date_cols and "finish date" in hs:
        cols["end"] = hs.index("finish date")
    return [(r, cols) for r in wikitable.rows(table)], hs


def season(key: str) -> list[Event]:
    """今年各站（依日期）"""
    if key in ("xc", "dh"):
        return _mtb(key)
    spec = {
        "f1": ("Calendar", ("grand prix",), ("circuit",), (), ("race date",)),
        "motogp": ("Calendar", ("grand prix",), ("circuit",), (), ("date",)),
        "wrc": ("Calendar", ("rally",), ("rally headquarters",), (), ("start date",)),
        "wec": ("Calendar", ("race",), ("circuit",), ("location",), ("date",)),
        "fe": ("Calendar", ("e-prix",), ("circuit",), (), ("date",)),
        "indycar": ("Schedule", ("race name",), ("track",), ("location",), ("date",)),
        "nascar": ("Schedule", ("race name",), ("track",), ("location",), ("date",)),
    }[key]
    rows, hs = _calendar(key, *spec)
    events: list[Event] = []
    for r, cols in rows:
        if len(r) < len(hs) - 1:
            continue
        rnd = wikitable.text(r[0])
        if key in ("wec", "nascar") and not re.fullmatch(r"\d+", rnd):
            continue  # WEC 的開季測試（Prologue）、NASCAR 不算積分的表演賽（Clash、Duel、All-Star）
        if not re.fullmatch(r"\d+", rnd):
            continue
        name_cell, venue_cell = r[cols["name"]], r[cols["venue"]]
        name = clean(name_cell)
        vlinks = _links_skip_flags(venue_cell)
        if not vlinks:
            raise ValueError(f"{key} 第 {rnd} 站沒有場地的連結：{venue_cell!r}")
        venue, venue_text = vlinks[0]
        if "place" in cols:
            plinks = _links_skip_flags(r[cols["place"]])
            place = plinks[0][1] if plinks else wikitable.text(r[cols["place"]])
        elif key == "wrc":
            place = venue_text.split(",")[0]
        else:
            place = vlinks[1][1] if len(vlinks) > 1 else ""
        start, end = parse_date(r[cols["date"]])
        if "end" in cols:
            end = parse_date(r[cols["end"]])[1]
        events.append(Event(key, name, venue, wikitable.text(f"[[{venue}|{venue_text}]]"), place, start, end, rnd))
    # 同一個週末同一個場地的兩場（Formula E、IndyCar 的 double-header）併成一站
    if key in ("fe", "indycar"):
        merged: list[Event] = []
        for e in events:
            if merged and (key == "indycar" or merged[-1].name == e.name) and merged[-1].venue == e.venue and (e.start - merged[-1].end).days <= 2:
                merged[-1].end = e.end
                merged[-1].round += f"–{e.round}"
            else:
                merged.append(e)
        events = merged
    return events


def _mtb(key: str) -> list[Event]:
    """UCI 登山車世界盃：越野（XCO 與 XCC，同一個週末同一個場地併成一站）、速降（DHI），都只看菁英組的表"""
    text = wikitext("mtb")
    secs = ["Cross-country", "Cross-country short track"] if key == "xc" else ["Downhill"]
    found: list[Event] = []
    for s in secs:
        elite = section(section(text, s, 2), "Elite", 3)
        table = first_table(elite)
        for r in wikitable.rows(table):
            if len(r) < 2 or not re.search(r"\d", r[0]) or not _links_skip_flags(r[1]):
                continue
            start, end = parse_date(r[0])
            links = _links_skip_flags(r[1])
            venue, venue_text = links[-1]
            label = clean(r[1])
            fmt = "XCC" if s.endswith("short track") else ("XCO" if key == "xc" else "DHI")
            found.append(Event(key, label, venue, label, label, start, end, extra={"formats": [fmt]}))
    found.sort(key=lambda e: e.start)
    merged: list[Event] = []
    for e in found:
        same = next((m for m in merged if m.venue == e.venue and abs((e.start - m.start).days) <= 4), None)
        if same:
            same.start, same.end = min(same.start, e.start), max(same.end, e.end)
            same.extra["formats"] = sorted(set(same.extra["formats"] + e.extra["formats"]), key=["XCO", "XCC", "DHI"].index)
        else:
            merged.append(e)
    for i, e in enumerate(merged, 1):
        e.round = str(i)
    return merged


@dataclass
class Stage:
    tour: str
    number: str
    day: date
    start: tuple[str, str]  # (條目, 顯示文字)
    finish: tuple[str, str]
    cancelled: bool


def stages(key: str) -> list[Stage]:
    """三大環賽的各賽段：「[[A]] (國家) to [[B]]」，後面再出現的地名沒有連結，用同一頁前面的連結對回去"""
    text = wikitext(key)
    table = first_table(section(text, "Route and stages"))
    known: dict[str, str] = {}
    for target, label in _links_skip_flags(text):
        known.setdefault(label, target)
        known.setdefault(target, target)
    out: list[Stage] = []
    for r in wikitable.rows(table):
        num = wikitable.text(r[0])
        if not re.fullmatch(r"\d+", num):
            continue  # 休息日
        course = wikitable.strip_refs(r[2])
        parts = re.split(r"\s+to\s+", course, maxsplit=1)

        def place(part: str) -> tuple[str, str]:
            # {{Interlanguage link|Corno alle Scale|lt=…|it}}：英文沒有條目，用義大利文的（座標查 itwiki）
            il = re.search(r"\{\{\s*interlanguage link\s*\|([^|{}]+)\|(?:[^{}]*\|)?([a-z]{2})\s*\}\}", part, re.I)
            if il:
                return f"{il.group(2)}:{il.group(1).strip()}", il.group(1).strip()
            links = _links_skip_flags(part)
            if links:
                return links[0][0], links[0][1]
            label = re.sub(r"\(.*?\)", "", wikitable.text(part)).strip()
            if label not in known:
                raise KeyError(f"{key} 第 {num} 站：{label!r} 沒有連結")
            return known[label], label

        a = place(parts[0])
        b = place(parts[1]) if len(parts) > 1 else a
        winner = wikitable.text(r[-1]) if len(r) > 6 else ""
        out.append(Stage(key, num, parse_date(r[1])[0], a, b, "cancelled" in winner.lower()))
    return out


# ── 歷年 ────────────────────────────────────────────────────────────
@dataclass
class Venue:
    series: str
    title: str  # 場地或城鎮的條目
    label: str
    n: int  # 辦過幾次（依各列表的算法）
    first: int | None
    last: int | None


def _years(s: str) -> list[int]:
    """「2020–2025, 2027」→ 每一年"""
    out: list[int] = []
    for a, b in re.findall(r"(\d{4})(?:\s*[–-]\s*(\d{4}))?", wikitable.text(s)):
        out += list(range(int(a), int(b or a) + 1))
    return out


def motogp_circuits() -> list[Venue]:
    """List of Grand Prix motorcycle circuits：每條賽道一列（rowspan 跨好幾個大獎賽），Total 是辦過的大獎賽數"""
    table = first_table(section(wikitext("motogp-circuits"), "List of circuits"))
    hs = headers(table)
    i_circ, i_seasons, i_total = hs.index("circuit"), hs.index("season(s)"), hs.index("total")
    out: dict[str, Venue] = {}
    for r in wikitable.rows(table):
        links = _links_skip_flags(r[i_circ])
        if not links:
            continue
        total = wikitable.text(r[i_total])
        if not total.isdigit() or int(total) == 0:
            continue  # 還沒辦過的（未來的賽道）
        years = [y for y in _years(r[i_seasons]) if y <= YEAR]
        v = out.get(links[0][0])
        if v is None:
            out[links[0][0]] = Venue("motogp", links[0][0], wikitable.text(r[i_circ]).strip(" ✔*"), int(total),
                                     min(years) if years else None, max(years) if years else None)
        elif years:
            v.first = min(v.first or years[0], min(years))
            v.last = max(v.last or years[0], max(years))
    return list(out.values())


def wrc_rallies() -> list[Venue]:
    """List of World Rally Championship rallies：每個拉力賽一列，依總部（Headquarters）的城鎮，No of Rallies 是辦過的次數"""
    table = first_table(section(wikitext("wrc-rallies"), "Rallies by location"))
    hs = headers(table)
    i_hq, i_n, i_years, i_rally = hs.index("headquarters"), _col(hs, "no of"), hs.index("wrc years"), hs.index("rally")
    out: list[Venue] = []
    for r in wikitable.rows(table):
        links = _links_skip_flags(r[i_hq])
        n = wikitable.text(r[i_n])
        if not links or not n.isdigit():
            continue
        years = [y for y in _years(r[i_years]) if y <= YEAR]
        out.append(Venue("wrc", links[0][0], wikitable.text(r[i_rally]), int(n), min(years) if years else None,
                         max(years) if years else None))
    return out


def fe_eprix() -> list[tuple[str, str, int, list[str]]]:
    """List of Formula E ePrix 的「By race title」：(ePrix 的條目, 名稱, 比過的場數, 各季)"""
    text = section(section(wikitext("fe-eprix"), "Active and past races"), "By race title", 3)
    table = first_table(text)
    out = []
    for r in wikitable.rows(table):
        links = _links_skip_flags(r[0])
        total = wikitable.text(r[-1])
        if not links or not total.isdigit() or int(total) == 0:
            continue
        seasons = [i for i, c in enumerate(r[2:-1]) if wikitable.text(c).isdigit()]
        out.append((links[0][0], wikitable.text(r[0]), int(total), seasons))
    return out


def tdf_departs() -> list[tuple[int, str, str]]:
    """List of Tour de France Grands Départs：(年, 起點的條目, 名稱)，一年一個"""
    table = first_table(section(section(wikitext("tdf-departs"), "Host cities"), "Tour de France", 3))
    out = []
    for r in wikitable.rows(table):
        years = _years(r[0])
        links = _links_skip_flags(r[3])
        if not years or not links or years[0] > YEAR:
            continue  # 已經公布的之後幾年（2027、2028）不算
        # 1912–1924 年的格子寫「[[Paris]]（[[Luna Park, Paris|Luna Park]]）」：同一個城市，只算第一個
        out.append((years[0], links[0][0], links[0][1]))
    return out


def megavalanche_years() -> list[int]:
    """Megavalanche 條目「Megavalanche Alpe D'Huez」的成績表：有成績的年份"""
    sec = section(section(wikitext("mega"), "Results"), "Megavalanche Alpe D'Huez", 3)
    years = []
    for r in wikitable.rows(first_table(sec)):
        y = wikitable.text(r[0])
        if re.fullmatch(r"\d{4}", y):
            years.append(int(y))
    return years


# ── 條目 → 座標（Wikidata，CC0） ─────────────────────────────────────
WIKIDATA = "https://query.wikidata.org/sparql"
VIA: dict[str, tuple[str, float, float]] = {}  # 用地點（P276）或行政區（P131）的座標的條目


def _get_json(url: str, cache: str) -> dict:
    """下載並快取（維基百科、Wikidata 回 429 時照 Retry-After 等一下再試）"""
    import json

    from common import download

    for attempt in range(10):
        try:
            path = download(url, "wikipedia", cache)
            break
        except urllib.error.HTTPError as err:
            if err.code != 429 or attempt == 9:
                raise
            wait = int(err.headers.get("retry-after") or 20) + 2
            print(f"    回 429，等 {wait} 秒", flush=True)
            time.sleep(wait)
    return json.loads(path.read_text(encoding="utf-8"))


def coordinates(titles: list[str], wiki: str = "en") -> dict[str, tuple[float, float, str]]:
    """維基百科條目名稱 → (經度, 緯度, Wikidata QID)。先用維基百科的 API 解開重新導向（一次 50 個），
    再用 Wikidata 的 SPARQL 依條目名稱（schema:name）找到項目的座標（P625）。沒有座標的不回傳"""
    import hashlib
    import json
    import urllib.parse

    titles = sorted(set(titles))
    resolved: dict[str, str] = {}
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]
        key = hashlib.sha1("|".join(batch).encode()).hexdigest()[:12]
        q = urllib.parse.urlencode({"action": "query", "titles": "|".join(batch), "redirects": 1, "format": "json", "formatversion": 2})
        data = _get_json(f"https://{wiki}.wikipedia.org/w/api.php?{q}", f"racing-redirects-{wiki}-{key}.json")["query"]
        norm = {n["from"]: n["to"] for n in data.get("normalized", [])}
        redir = {r["from"]: r["to"] for r in data.get("redirects", [])}
        for t in batch:
            n = norm.get(t, t)
            resolved[t] = redir.get(n, n)
    targets = sorted(set(resolved.values()))
    found: dict[str, tuple[float, float, str]] = {}
    # 一批的網址不能太長（Wikidata 的 SPARQL 端點回 431）：名稱合計約 4,000 字一批
    batches, cur = [], []
    for t in targets:
        if cur and sum(len(x) + 8 for x in cur) + len(t) > 4000:
            batches.append(cur)
            cur = []
        cur.append(t)
    if cur:
        batches.append(cur)
    for batch in batches:
        key = hashlib.sha1("|".join(batch).encode()).hexdigest()[:12]
        values = " ".join(json.dumps(t, ensure_ascii=False) + f"@{wiki}" for t in batch)
        # 項目本身沒有座標的（ePrix 這種賽事的條目、沒有座標的山口）退一步用地點（P276）或所在的行政區（P131）的座標
        query = f"""SELECT ?name ?item ?coord ?via WHERE {{
  VALUES ?name {{ {values} }}
  ?link schema:name ?name ; schema:isPartOf <https://{wiki}.wikipedia.org/> ; schema:about ?item .
  {{ ?item p:P625 ?st . ?st ps:P625 ?coord ; wikibase:rank ?rank . FILTER(?rank != wikibase:DeprecatedRank) BIND("" AS ?via) }}
  UNION {{ ?item wdt:P276 ?loc . ?loc wdt:P625 ?coord . BIND("P276" AS ?via) }}
  UNION {{ ?item wdt:P131 ?adm . ?adm wdt:P625 ?coord . BIND("P131" AS ?via) }}
}}"""
        url = f"{WIKIDATA}?{urllib.parse.urlencode({'query': query, 'format': 'json'})}"
        rows = _get_json(url, f"racing-wikidata2-{wiki}-{key}.json")["results"]["bindings"]
        # 項目自己的座標優先，再來是地點、行政區
        rows.sort(key=lambda r: ["", "P276", "P131"].index(r["via"]["value"]))
        for r in rows:
            m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r["coord"]["value"])
            name = r["name"]["value"]
            if m and name not in found:
                found[name] = (float(m.group(1)), float(m.group(2)), r["item"]["value"].rsplit("/", 1)[-1])
                if r["via"]["value"]:
                    VIA[name] = (r["via"]["value"], round(float(m.group(1)), 3), round(float(m.group(2)), 3))
    return {t: found[resolved[t]] for t in titles if resolved[t] in found}


def item_countries(qids: list[str]) -> dict[str, set[str]]:
    """Wikidata 項目 → 所在國家的 ISO alpha-3（P17 → P298），跟 geoindex 依座標判斷的國家對照用"""
    import hashlib
    import urllib.parse

    qids = sorted(set(qids))
    out: dict[str, set[str]] = {}
    for i in range(0, len(qids), 300):
        batch = qids[i:i + 300]
        query = f"SELECT ?item ?iso WHERE {{ VALUES ?item {{ {' '.join('wd:' + q for q in batch)} }} ?item wdt:P17/wdt:P298 ?iso }}"
        key = hashlib.sha1("|".join(batch).encode()).hexdigest()[:12]
        rows = _get_json(f"{WIKIDATA}?{urllib.parse.urlencode({'query': query, 'format': 'json'})}", f"racing-countries-{key}.json")
        for r in rows["results"]["bindings"]:
            out.setdefault(r["item"]["value"].rsplit("/", 1)[-1], set()).add(r["iso"]["value"])
    return out


def item_coordinates(qids: list[str]) -> dict[str, tuple[float, float, str]]:
    """Wikidata 項目 → (經度, 緯度, QID)：英文維基沒有條目的地方（紅色連結）直接指定項目"""
    import hashlib
    import urllib.parse

    if not qids:
        return {}
    qids = sorted(set(qids))
    query = f"SELECT ?item ?coord WHERE {{ VALUES ?item {{ {' '.join('wd:' + q for q in qids)} }} ?item wdt:P625 ?coord }}"
    key = hashlib.sha1("|".join(qids).encode()).hexdigest()[:12]
    rows = _get_json(f"{WIKIDATA}?{urllib.parse.urlencode({'query': query, 'format': 'json'})}", f"racing-items-{key}.json")
    out = {}
    for r in rows["results"]["bindings"]:
        m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r["coord"]["value"])
        q = r["item"]["value"].rsplit("/", 1)[-1]
        if m and q not in out:
            out[q] = (float(m.group(1)), float(m.group(2)), q)
    return out


def wec_races() -> list[Venue]:
    """FIA World Endurance Championship 條目的「Races」：現行、2027 年回歸、以前的三張表（Race | Circuit | Seasons），
    沒有場數，用比過的賽季數（2012 年起；2018–19 年的「超級賽季」算一季，一條賽道一季通常一場）"""
    races = section(wikitext("wec-races"), "Races")
    out: dict[str, Venue] = {}
    for table in wikitable.tables(races):
        for r in wikitable.rows(table):
            if len(r) < 3:
                continue
            links = _links_skip_flags(r[1])
            text = wikitable.text(r[2]).replace("present", str(YEAR))
            years = [y for y in _years(text) if y <= YEAR]
            if not links or not years:
                continue  # 2027 年才回歸、還沒比過的
            v = out.setdefault(links[0][0], Venue("wec", links[0][0], links[0][1], 0, None, None))
            v.n += len(years)
            v.first = min(v.first or years[0], min(years))
            v.last = max(v.last or years[0], max(years))
    return list(out.values())


def indycar_tracks() -> list[Venue]:
    """List of IndyCar Series racetracks 的 Current、Former 兩張表（1996 年 IRL 起；Races 是場數，同一條賽道好幾個比賽名稱時分列）"""
    text = section(wikitext("indycar-tracks"), "Racetracks")
    out: dict[str, Venue] = {}
    for sub in ("Current", "Former"):
        table = first_table(section(text, sub, 3))
        hs = headers(table)
        i_track, i_seasons, i_races = hs.index("racetrack"), hs.index("seasons"), hs.index("races")
        seen: set[tuple] = set()
        for r in wikitable.rows(table):
            links = _links_skip_flags(r[i_track])
            n = wikitable.text(r[i_races])
            if not links or not n.isdigit():
                continue
            key = (links[0][0], r[i_seasons], n)
            if key in seen:  # rowspan 複製到下一列的同一格
                continue
            seen.add(key)
            years = [y for y in _years(wikitable.text(r[i_seasons]).replace("present", str(YEAR))) if y <= YEAR]
            v = out.setdefault(links[0][0], Venue("indycar", links[0][0], links[0][1], 0, None, None))
            v.n += int(n)
            if years:
                v.first = min(v.first or years[0], min(years))
                v.last = max(v.last or years[0], max(years))
    return [v for v in out.values() if v.n > 0]


def grand_starts(key: str) -> list[tuple[int, str, str]]:
    """List of Giro d'Italia starts、List of Vuelta a España Gran Partidas：(年, 開幕站的條目, 名稱)，一年一個"""
    table = first_table(section(wikitext(key), "Host cities"))
    out = []
    for r in wikitable.rows(table):
        years = _years(r[0])
        links = _links_skip_flags(r[3]) if len(r) > 3 else []
        if not links and len(r) > 3 and wikitable.text(r[3]):
            links = [(wikitable.text(r[3]), wikitable.text(r[3]))]  # 2026 年環西的「Monaco」沒有連結，用文字當條目名稱
        if not years or not links or years[0] > YEAR:
            continue
        out.append((years[0], links[0][0], links[0][1]))
    return out
