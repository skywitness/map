"""航空的擴充（2026-10-31，製作手冊第十批 175）：最繁忙的航線、航空貨運量與最繁忙的貨運機場、航空公司聯盟、廉價航空。
輸出到航空的資料夾（public/data/topics/aviation/），航線與航空公司、機場與旅客兩個主題共用。

- 最繁忙的航線：英文維基「List of busiest passenger flight routes」（revid 1381576579，CC BY-SA 4.0）的「Top 10 flight routes by
  available seats」與「International flight routes (airport pairs) by available seats」兩張表，2025 年的座位數。數字原本來自
  OAG 的年度報告（OAG 的條款不准轉載，使用者決定照用維基、寫出原始出處）。機場用 OurAirports（公有領域）對座標，畫成大圓弧。
  台灣另外附民航局「國際及兩岸定期航線班機載客率」的桃園航線人次（data.gov.tw 44751，政府資料開放授權條款）。
- 航空貨運量：世界銀行 WDI IS.AIR.GOOD.MT.K1（ICAO，百萬延噸公里，CC BY 4.0），算在航空公司的註冊國；台灣沒有。
- 最繁忙的貨運機場：英文維基「List of busiest airports by cargo traffic」（revid 1381593454，CC BY-SA 4.0，ACI 的初步統計）
  2025 年前 10 名；桃園的數字跟民航局「民航運輸各機場營運量－按機場分」（data.gov.tw 31915）一致。
- 航空公司聯盟：英文維基「Star Alliance」「SkyTeam」「Oneworld」的正式成員、停權成員與前成員表（使用者決定只算正式成員），
  依加入、退出（停權）年份算每一年每個國家有哪些聯盟的航空公司：一國有好幾家分屬不同聯盟的歸「兩個以上」（使用者決定）。
- 廉價航空：英文維基「List of low-cost airlines」（revid 1377811665，CC BY-SA 4.0）依國家列的營運中廉價航空家數。

輸出：busiest-routes.json（線；左邊的清單直接讀線，2026-10-31 起不再另外輸出清單用的點檔）、busy-routes.json、air-freight.json、
cargo-airports.json、busiest-cargo.json、alliances.json、low-cost.json。
"""
from __future__ import annotations

import math
import re
from collections import Counter, defaultdict

import pycountry

from common import OUT_DIR, download, indicator_file, lines_file, points_file, write_json, write_manifest_part
from geoindex import country_at
from sources import worldbank, wpp
from sources import wikitable as W
from topics.longest_flights import _airports, _arc

OUT = OUT_DIR / "topics" / "aviation"
YEAR = 2026
PAGES = {
    "routes": ("List_of_busiest_passenger_flight_routes", 1381576579),
    "cargo": ("List_of_busiest_airports_by_cargo_traffic", 1381593454),
    "star": ("Star_Alliance", 1381148336),
    "skyteam": ("SkyTeam", 1381760703),
    "oneworld": ("Oneworld", 1382042466),
    "lcc": ("List_of_low-cost_airlines", 1377811665),
}
# 國旗模板的代碼（IOC、舊式）→ ISO alpha-3
FLAG_CODES = {"GRE": "GRC", "SLO": "SVN", "SUI": "CHE", "GER": "DEU", "NED": "NLD", "POR": "PRT", "DEN": "DNK", "CRO": "HRV",
              "TAI": "TWN", "TPE": "TWN", "RSA": "ZAF", "UAE": "ARE", "ROK": "KOR", "PRC": "CHN", "KSA": "SAU", "UK": "GBR",
              "US": "USA", "TW": "TWN", "LAT": "LVA", "MAS": "MYS", "PHI": "PHL", "INA": "IDN", "VIE": "VNM", "BAH": "BHR",
              "CHI": "CHL", "URU": "URY", "PAR": "PRY", "HAI": "HTI", "ZIM": "ZWE", "ANG": "AGO", "SRI": "LKA", "BAN": "BGD",
              "NEP": "NPL", "MGL": "MNG", "KUW": "KWT", "OMA": "OMN", "LIB": "LBN", "ALG": "DZA", "MAR": "MAR", "IRI": "IRN",
              "FIJ": "FJI", "SAM": "WSM", "CAM": "KHM", "ROM": "ROU", "MLD": "MDA", "Turks and Caicos": "TCA", "CRC": "CRI", "ESA": "SLV", "HON": "HND", "IRE": "IRL", "SWI": "CHE", "BRU": "BRN", "MYA": "MMR", "KAZ": "KAZ", "TGA": "TON", "MRI": "MUS", "SEY": "SYC", "NGR": "NGA", "BIH": "BIH", "MKD": "MKD"}
AIRPORT_EXTRA = {"Jeju International Airport": "CJU", "Gimpo International Airport": "GMP", "Haneda Airport": "HND",
                 "New Chitose Airport": "CTS", "Fukuoka Airport": "FUK", "Noi Bai International Airport": "HAN",
                 "Tan Son Nhat International Airport": "SGN", "Cairo International Airport": "CAI",
                 "King Abdulaziz International Airport": "JED", "Kuala Lumpur International Airport": "KUL",
                 "Incheon International Airport": "ICN", "Narita International Airport": "NRT",
                 "Hong Kong International Airport": "HKG", "Taoyuan International Airport": "TPE", "Changi Airport": "SIN",
                 "Cancún International Airport": "CUN", "Chhatrapati Shivaji Maharaj International Airport": "BOM",
                 "Itami Airport": "ITM", "Moscow Domodedovo Airport": "DME", "Soekarno–Hatta International Airport": "CGK",
                 "Velana International Airport": "MLE"}


def _iso_flag(code: str) -> str | None:
    code = code.strip()
    if code in FLAG_CODES:
        return FLAG_CODES[code]
    c = pycountry.countries.get(alpha_3=code.upper())
    if c:
        return c.alpha_3
    try:
        return pycountry.countries.lookup(code).alpha_3
    except LookupError:
        return None


def _raw(key: str) -> str:
    title, rev = PAGES[key]
    return download(f"https://en.wikipedia.org/w/index.php?title={title}&action=raw&oldid={rev}", "wikipedia",
                    f"{title.lower().replace('_', '-')}-{rev}.txt").read_text(encoding="utf-8")


def _sections(raw: str) -> list[tuple[str, str]]:
    """(標題, 表格)：每個表格前面最近的標題"""
    out = []
    head = ""
    for m in re.finditer(r"(^(=+)\s*(.*?)\s*\2\s*$)|(^\{\|.*?^\|\})", raw, flags=re.M | re.S):
        if m.group(1):
            head = re.sub(r"<[^>]+>", "", m.group(3)).strip()
        else:
            out.append((head, m.group(4)))
    return out


def _num(text: str) -> int | None:
    t = re.sub(r"[^\d]", "", text or "")
    return int(t) if t else None


# ── 最繁忙的航線 ────────────────────────────────────────────────

def busiest_routes(airports: dict[str, dict]) -> None:
    raw = _raw("routes")
    by_iata = {a["iata"]: a for a in airports.values()}
    for title, code in AIRPORT_EXTRA.items():
        airports.setdefault(title, by_iata[code])
    routes: dict[tuple[str, str], dict] = {}
    for head, table in _sections(raw):
        kind = 1 if head.startswith("Top 10 flight routes") else 2 if head.startswith("International flight routes") else 0
        if not kind:
            continue
        for r in W.rows(table):
            ends = []
            for cell in r[1:3]:
                link = (W.links(cell) or [""])[0]
                if link not in airports:
                    raise RuntimeError(f"最繁忙的航線：對不到機場「{link}」")
                ends.append((airports[link], W.text(cell)))
            # 第一張表有距離欄（第 4 格），2025 年的座位數在它後面；第二張表直接是 2025 年
            seats = _num(r[4] if kind == 1 else r[3])
            if not seats:
                continue  # 2025 年沒有進榜的列（只有以前的年份）
            key = tuple(sorted((ends[0][0]["iata"], ends[1][0]["iata"])))
            rank = _num(W.text(r[0]))
            if key in routes:
                continue
            routes[key] = {"ends": ends, "seats": seats, "kind": kind, "rank": rank}
    ranked = sorted(routes.values(), key=lambda x: -x["seats"])
    lines, records = [], []
    for i, rt in enumerate(ranked, 1):
        (a, an), (b, bn) = rt["ends"]
        ai, bi = country_at(a["lon"], a["lat"]), country_at(b["lon"], b["lat"])
        km = round(_km(a, b))
        dom = 1 if ai == bi else 2
        arc = _arc(a, b)
        lines.append(arc)
        rec = {"t": dom, "rank": i, "a": a["iata"], "b": b["iata"], "an": an, "bn": bn, "ai": ai, "bi": bi, "seats": rt["seats"], "km": km}
        records.append(rec)
    fields = ["t", "rank", "a", "b", "an", "bn", "ai", "bi", "seats", "km"]
    attribution = {"license": "CC BY-SA 4.0",
                   "attribution": f"Wikipedia contributors, “List of busiest passenger flight routes” (revision {PAGES['routes'][1]}); "
                                  "seat counts originally from OAG; airport locations from OurAirports"}
    write_json(OUT / "busiest-routes.json", {**lines_file(
        lines, 0.01, types=[r["t"] for r in records], records=records, record_fields=fields,
        record_scale={"t": 1, "rank": 1, "seats": 1, "km": 1}, record_strings=("a", "b", "an", "bn", "ai", "bi")), **attribution})
    count: Counter = Counter()
    for r in records:
        for c in {r["ai"], r["bi"]}:
            count[c] += 1
    every = set(wpp.demographic(["TPopulation1July"])["TPopulation1July"]) - {"WLD"}
    tw = taoyuan_routes()
    write_json(OUT / "busy-routes.json", indicator_file(
        "busy-routes", "條", [2025], {c: [count.get(c, 0)] for c in sorted(every)},
        notes={"TWN": tw[0]}, notesEn={"TWN": tw[1]}))
    dom = sum(1 for r in records if r["t"] == 1)
    print(f"  最繁忙的航線：{len(records)} 條（國內 {dom}、國際 {len(records) - dom}），第 1 名 {records[0]['an']}–{records[0]['bn']} "
          f"{records[0]['seats']:,}；台灣 {[(r['an'], r['bn'], r['seats']) for r in records if 'TWN' in (r['ai'], r['bi'])]}")


def _km(a: dict, b: dict) -> float:
    p1, l1, p2, l2 = map(math.radians, (a["lat"], a["lon"], b["lat"], b["lon"]))
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin((l2 - l1) / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def _ods_sheet(path, name: str) -> list[list]:
    """ODS 裡指定名稱的工作表（民航局的檔一個表一張工作表）"""
    import zipfile
    from xml.etree import ElementTree

    ns = {"table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0", "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0"}
    root = ElementTree.fromstring(zipfile.ZipFile(path).read("content.xml"))
    for t in root.iter(f"{{{ns['table']}}}table"):
        if t.get(f"{{{ns['table']}}}name") != name:
            continue
        rows = []
        for tr in t.iter(f"{{{ns['table']}}}table-row"):
            cells: list = []
            for td in tr:
                rep = min(int(td.get(f"{{{ns['table']}}}number-columns-repeated", "1")), 30)
                v = td.get(f"{{{ns['office']}}}value")
                text = "".join(td.itertext()).strip()
                cells.extend([float(v) if v is not None else (text or None)] * rep)
            rows.append(cells)
        return rows
    raise RuntimeError(f"ODS 沒有工作表 {name}")


def taoyuan_routes() -> tuple[str, str]:
    """民航局的桃園航線（表 53-1，航點的合計列：架次、座位、人次），人次前 5 名寫成台灣的附註"""
    import csv

    idx = download("https://www.caa.gov.tw/FileAtt.ashx?lang=1&id=34966", "caa", "route-load-factor-index.csv")
    with open(idx, encoding="utf-8-sig", newline="") as f:
        latest = next(csv.DictReader(f))
    fid = re.search(r"id=(\d+)", latest["路徑"]).group(1)
    rows = _ods_sheet(download(latest["路徑"], "caa", f"route-load-factor-{fid}.ods"), "53-1")
    pax: dict[str, float] = {}
    for r in rows:
        if len(r) > 5 and isinstance(r[1], str) and r[1].strip() and r[1].strip() != "總計" and isinstance(r[5], float):
            pax[r[1].replace(" ", "")] = r[5]
    top = sorted(pax.items(), key=lambda kv: -kv[1])[:5]
    year = int(latest["版本"].replace("年", "")) + 1911
    zh = (f"民航局：{year} 年桃園機場定期航線人次最多的航點是" + "、".join(f"{p} {v / 1e4:,.0f} 萬" for p, v in top)
          + "（國際及兩岸定期航線班機載客率，各航空公司合計）。最繁忙航線表的座位數原本來自 OAG 的班表，口徑不同。")
    en = (f"Civil Aeronautics Administration: in {year} the busiest scheduled destinations from Taoyuan by passengers were "
          + ", ".join(f"{p} ({v / 1e6:.2f} million)" for p, v in top)
          + " (all airlines). Seat counts in the busiest-routes tables come from OAG schedules and are not comparable.")
    print(f"  桃園的航線（民航局 {year}）：{top}")
    return zh, en


# ── 航空貨運 ────────────────────────────────────────────────────

def air_freight() -> None:
    data, world = worldbank.fetch("IS.AIR.GOOD.MT.K1", 1970)
    years = sorted({y for s in data.values() for y in s})
    write_json(OUT / "air-freight.json", indicator_file(
        "air-freight", "百萬延噸公里", years, {c: [round(s[y], 1) if y in s else None for y in years] for c, s in sorted(data.items()) if s},
        aggregates={"WLD": [round(world[y], 1) if y in world else None for y in years]},
        noValue={"TWN": "世界銀行沒有台灣（見附註）"}, noValueEn={"TWN": "Not in the World Bank data (see note)"},
        notes={"TWN": "世界銀行（ICAO）沒有台灣；國籍航空公司的延噸公里在政府資料開放平臺找不到。桃園機場 2025 年貨運量 250 萬公噸，"
                      "全球第 9（民航局，跟 ACI 一致）"},
        notesEn={"TWN": "The World Bank (ICAO) data does not include Taiwan, and no open data on Taiwanese airlines' tonne-kilometres "
                        "was found. Taoyuan airport handled 2.5 million tonnes of cargo in 2025, 9th in the world (Civil Aeronautics "
                        "Administration, matching ACI)"}))
    last = max(years)
    top = sorted(((c, s[last]) for c, s in data.items() if last in s), key=lambda kv: -kv[1])[:6]
    print(f"  航空貨運：{len(data)} 個經濟體，{years[0]}–{last}；{last} 年 " + "、".join(f"{c} {v:,.0f}" for c, v in top))


def cargo_airports(airports: dict[str, dict]) -> None:
    raw = _raw("cargo")
    by_iata = {a["iata"]: a for a in airports.values()}
    head, table = next((h, t) for h, t in _sections(raw) if h.startswith("2025"))
    pts = []
    for r in W.rows(table):
        rank = _num(W.text(r[0]))
        code = W.text(r[3]).split("/")[0].strip()
        tonnes = _num(W.text(r[5]))
        if not rank or code not in by_iata:
            raise RuntimeError(f"貨運機場：對不到「{W.text(r[1])}」（{code}）")
        a = by_iata[code]
        # 名稱的格子前面有國旗模板（{{flagicon|HKG}}），W.text 會留下國家代碼，先拿掉（2026-10-31 修正）
        name = W.text(re.sub(r"\{\{\s*flag(?:icon|deco|u)?\s*\|[^{}]*\}\}", "", r[1]))
        pts.append({"lon": a["lon"], "lat": a["lat"], "rank": rank, "iata": code, "en": name, "t": tonnes,
                    "iso3": country_at(a["lon"], a["lat"])})
    write_json(OUT / "cargo-airports.json", {
        **points_file(pts, ["lon", "lat", "rank", "iata", "en", "t", "iso3"], {"lon": 0.001, "lat": 0.001, "rank": 1, "t": 1}),
        "license": "CC BY-SA 4.0",
        "attribution": f"Wikipedia contributors, “List of busiest airports by cargo traffic” (revision {PAGES['cargo'][1]}); "
                       "figures from Airports Council International",
    })
    totals: Counter = Counter()
    for p in pts:
        totals[p["iso3"]] += p["t"]
    write_json(OUT / "busiest-cargo.json", indicator_file("busiest-cargo", "公噸", [2025], {c: [v] for c, v in sorted(totals.items())}))
    print(f"  貨運機場（{head}）：" + "、".join(f"{p['iata']} {p['t']:,}" for p in pts))


# ── 航空公司聯盟 ────────────────────────────────────────────────

ALLIANCES = {"star": 1, "skyteam": 2, "oneworld": 3}


def _year(text: str) -> int | None:
    m = re.search(r"\{\{\s*dts\s*\|(?:[^|}]*=[^|}]*\|)*\s*(\d{4})", text) or re.search(r"(19|20)\d\d", text)
    return int(m.group(1) if m.lastindex else m.group(0)) if m else None


def alliances() -> None:
    members: list[dict] = []
    for key, code in ALLIANCES.items():
        for head, table in _sections(_raw(key)):
            h = head.lower()
            if any(w in h for w in ("future", "connecting", "intermodal", "associate")) or ("affiliat" in h and "of current" in h):
                continue
            if "suspended" in h:
                status = "suspended"
            elif "former member" in h:
                status = "former"
            elif "full members" in h or h == "members and affiliates":
                status = "current"
            else:
                continue
            for r in W.rows(table):
                flag = re.search(r"\{\{\s*flagicon\s*\|\s*([^|}]+)", r[0])
                if not flag:
                    continue
                iso = _iso_flag(flag.group(1))
                if not iso:
                    raise RuntimeError(f"聯盟：對不到國旗代碼 {flag.group(1)}")
                name = W.text(re.sub(r"\{\{\s*(?:Ref label|flagicon)[^}]*\}\}", "", r[0], flags=re.I))
                joined = _year(r[1])
                left = _year(r[2]) if status != "current" and len(r) > 2 else None
                if not joined:
                    continue
                members.append({"alliance": code, "iso3": iso, "name": name, "joined": joined, "left": left, "status": status})
    years = list(range(1997, YEAR + 1))
    every = set(wpp.demographic(["TPopulation1July"])["TPopulation1July"]) - {"WLD"}
    sets: dict[str, list[set]] = defaultdict(lambda: [set() for _ in years])
    for m in members:
        for i, y in enumerate(years):
            if m["joined"] <= y and (m["left"] is None or y < m["left"]):
                sets[m["iso3"]][i].add(m["alliance"])
    values = {}
    for c in sorted(every | set(sets)):
        row = []
        for s in sets.get(c, [set()] * len(years)):
            row.append(0 if not s else next(iter(s)) if len(s) == 1 else 4)
        values[c] = row
    hints = {}
    hints_en = {}
    names = {1: ("星空聯盟", "Star Alliance"), 2: ("天合聯盟", "SkyTeam"), 3: ("寰宇一家", "Oneworld")}
    for c in sets:
        now = [m for m in members if m["iso3"] == c and m["status"] == "current"]
        if now:
            hints[c] = "、".join(f"{m['name']}（{names[m['alliance']][0]}，{m['joined']}）" for m in sorted(now, key=lambda m: m["joined"]))
            hints_en[c] = ", ".join(f"{m['name']} ({names[m['alliance']][1]}, {m['joined']})" for m in sorted(now, key=lambda m: m["joined"]))
    write_json(OUT / "alliances.json", indicator_file("alliances", "", years, values, hints=hints, hintsEn=hints_en))
    cur = Counter(m["alliance"] for m in members if m["status"] == "current")
    print(f"  聯盟：正式成員 星空 {cur[1]}、天合 {cur[2]}、寰宇一家 {cur[3]}；前成員與停權 {sum(1 for m in members if m['status'] != 'current')}；"
          f"台灣 {[(m['name'], m['alliance'], m['joined']) for m in members if m['iso3'] == 'TWN']}；"
          f"{YEAR} 年兩個以上 {sum(1 for v in values.values() if v[-1] == 4)} 國")


# ── 廉價航空 ────────────────────────────────────────────────────

def low_cost() -> None:
    raw = _raw("lcc")
    body = raw[:raw.index("== Largest low-cost carriers ==")]  # 後面是旅客數表與停業的
    count: Counter = Counter()
    names: dict[str, list[str]] = defaultdict(list)
    current = None
    for line in body.split("\n"):
        # 國家是「;{{TWN}}」「;{{flag|Taiwan}}」這種定義列，航空公司是「:*[[…]]」
        if m := re.match(r"^;\s*\{\{\s*(?:flag(?:country)?\s*\|\s*)?([^}|]+?)\s*(?:\|[^}]*)?\}\}", line, re.I):
            current = _iso_flag(m.group(1))
            if not current:
                raise RuntimeError(f"廉價航空：對不到國家「{m.group(1)}」")
            continue
        if re.match(r"^:?\*", line) and current and W.links(line):
            count[current] += 1
            names[current].append(W.text(line).lstrip(":* ").split("(")[0].strip())
    every = set(wpp.demographic(["TPopulation1July"])["TPopulation1July"]) - {"WLD"}
    hints = {c: "、".join(v[:8]) + ("…" if len(v) > 8 else "") for c, v in names.items()}
    hints_en = {c: ", ".join(v[:8]) + ("…" if len(v) > 8 else "") for c, v in names.items()}
    write_json(OUT / "low-cost.json", indicator_file(
        "low-cost", "家", [YEAR], {c: [count.get(c, 0)] for c in sorted(every | set(count))}, hints=hints, hintsEn=hints_en))
    print(f"  廉價航空：{sum(count.values())} 家、{len(count)} 國；" + "、".join(f"{c} {n}" for c, n in count.most_common(8))
          + f"；台灣 {names.get('TWN')}")


def build() -> None:
    airports = _airports()
    busiest_routes(airports)
    air_freight()
    cargo_airports(airports)
    alliances()
    low_cost()
    write_manifest_part(OUT, "aviation", "aviation-extra", {"revisions": {k: v[1] for k, v in PAGES.items()}})
