"""大航海時代的航海日誌主題：CLIWOC 2.1（Climatological Database for the World's Oceans 1750–1854，
英、荷、西、法四國檔案館的航海日誌，PANGAEA，CC BY 3.0）每天正午的船位，畫成每艘船那一年的航線。

**原始檔**：CLIWOC21.zip（IMMA 格式，287,114 筆、1662–1855 年，一筆 8,569 字元、latin-1）。用到的欄位（從 0 起算的字元位置）：
年 [0:4]、月 [4:6]、日 [6:8]、時（UTC × 100）[8:12]、緯度 × 100 [12:17]、經度 × 100（0–360°E）[17:23]、
國籍代碼 [43:45]（NL、UK、ES、FR、SE、US、DE、DK）、日誌編號 [297:327]、船名 [705:735]、公司或海軍 [758:792]、
船長 [1601:1631]、出發地 [2445:2490]、目的地 [2490:2535]。日期與時刻是 CLIWOC 換算的世界標準時間（正午的船位，
在東經的海域是前一天的下午、西經是當天），可能跟日誌上寫的日期差一天。

**航程**（voyage）：同一本日誌、同一艘船（有些日誌編號是好幾艘船的摘要），依日期排好，出發地或目的地改變就是另一個航程
（比較時去掉重音與標點：同一本日誌裡 CÁDIZ 與 CADIZ 交替出現；名稱用航程裡最多的寫法）。連續不到 MIN_RUN 筆的
另一種出發地、目的地併進前一個航程（有些摘要的兩種寫法交替出現）。
國籍取航程裡最多的那個代碼（只有 3 本日誌有兩種）。

**清理**（日誌本身有抄錯、經度東西寫反、日期錯的）：
- 沒有船位、日期不存在（例如 2 月 30 日）的紀錄不用。
- 跳點：一點離前後兩點都超過一天 MAX_KM_PER_DAY 公里能走的距離，前後兩點彼此卻在範圍內，拿掉這一點。
- 斷開：相鄰兩點相隔超過 MAX_GAP_DAYS 天，或距離超過那段天數能走的距離（帆船一天最快約 450 公里），線在這裡斷開
  （在港口停泊、日誌缺頁、或仍然有錯的那幾天）；兩點之間的直線深入陸地超過 LAND_KM 公里也斷開（例如好幾天沒有船位，
  從大西洋直接連到印度洋會穿過非洲；船位本身離海都不到 25 公里）。只剩一點的段不畫。陸地與海用河流主題的 IHO 海域網格
  （sources/sea_areas.py，第一次要下載 Marine Regions 的海域，約 5 分鐘）。
- 經度展開成連續的（可以超過 ±180），跨年的航線在 1 月 1 日切開，新的一年從前一年最後一點接起來（線不斷）。

**地圖**（tracks.json，common.lines_file()）：一個航程、一年一條線（中間斷開的是同一筆紀錄的好幾段），types 是國籍代碼
（NATIONS 的索引，OTHER 以後併成一類），records：年份 y、航程編號 v（groupField，同一航程的各段一起標出）、船名、國籍、公司、出發地、目的地、
航程的起訖日期（YYYYMMDD）、船長。Douglas–Peucker 簡化（SIMPLIFY_DEG）。

**國家**（ships.json）：每年各國有航海日誌的船數（航程不同但同一本日誌、同一艘船算一艘），國籍對到今天的國家
（UK → 英國、NL → 荷蘭…）。國家不上色（指標是 kind: 'none'），只給 tooltip 與側欄。

**側欄**（panel.json）：每個國家每年「經過附近」的航程：航線每 DENSIFY_KM 公里內插一點，在國界內或離國界 NEAR_KM 公里以內
（用颱風主題的 NearIndex：Natural Earth 1:50m 國界）；本國的船另外列（不論在哪裡）。voyages 是航程的資料表。

約 1 分鐘（大部分在讀 2.5 GB 的原始檔與量距離）。
"""
from __future__ import annotations

import io
import math
import re
import unicodedata
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date

import numpy as np

from common import OUT_DIR, download, indicator_file, lines_file, now_iso, write_json
from sources import sea_areas
from topics.typhoons import NearIndex, simplify, unwrap

OUT = OUT_DIR / "topics" / "logbooks"
URL = "https://hs.pangaea.de/Projects/CLIWOC/CLIWOC21.zip"
MAX_GAP_DAYS = 10
MAX_KM_PER_DAY = 550
SIMPLIFY_DEG = 0.05
QUANTUM = 0.05
NEAR_KM = 100
DENSIFY_KM = 10
MIN_RUN = 3
LAND_KM = 30

# 國籍代碼（tracks.json 的 types、voyages 的國籍；src/topics/logbooks.ts 的 NATIONS 要一致）與對應的今天的國家
NATIONS = ["UK", "NL", "ES", "FR", "SE", "US", "DE", "DK"]
OTHER = 4  # tracks.json 的 types：英、荷、西、法各一類，其他國家（瑞典、美國、漢堡、丹麥）併成一類
NATION_ISO3 = {"UK": "GBR", "NL": "NLD", "ES": "ESP", "FR": "FRA", "SE": "SWE", "US": "USA", "DE": "DEU", "DK": "DNK"}

# 公司或海軍的代碼（CLIWOC 的 Company 欄位）→ 前端的代碼表（src/topics/logbooks.ts 的 COMPANIES）。
# 荷蘭的 MAR（海軍部，1795 年後）、ADM（各海事部，Admiraliteit）都是海軍；法國船的 MAR、ADM 意思不確定，不寫
COMPANY_CODES = {
    "VOC": "VOC", "VOC-Z": "VOC", "WIC": "WIC", "MCC": "MCC", "EIC": "EIC", "RN": "RN", "ROYAL NAVY": "RN",
    "HUDSON BAY COMPANY": "HBC", "SWEDISH EAST INDIA COMPANY": "SOIC", "OIC": "DAC",
    "WHA": "WHA", "MER": "MER", "MERCHANT NAVY": "MER", "PARTICULIER": "MER",
}
DUTCH_NAVY = {"MAR", "ADM"}
UNKNOWN_SHIPS = re.compile(r"^(UNKNOWN|INCONNU|DESCONOCIDO|ONBEKEND)\b")
# 船名、地名轉成首字大寫時維持小寫的冠詞與介系詞（荷、英、西、法文）
PARTICLES = {
    "de", "der", "den", "van", "het", "te", "ter", "en", "op", "aan", "in", "'t",
    "of", "the", "and", "on", "at", "to",
    "del", "la", "las", "los", "el", "y", "e",
    "le", "les", "du", "des", "d'", "l'", "et",
}


@dataclass
class Voyage:
    log: str
    ship: str
    nation: str
    company: str | None
    origin: str
    dest: str
    captain: str
    # (日期序數, 時 × 100, 緯度, 經度 −180–180)
    fixes: list[tuple[int, int, float, float]] = field(default_factory=list)


def title_case(s: str) -> str:
    """全大寫的原文 → 首字大寫（ADMIRAAL DE RUYTER → Admiraal de Ruyter），第一個字一定大寫"""
    words = s.strip().lower().split()
    out = []
    for i, w in enumerate(words):
        if i > 0 and w in PARTICLES:
            out.append(w)
            continue
        # 連字號、括號、句點後面也大寫（ST.-MALO、(GILOLO)）；撇號只有 O'BRIEN、L'ORIENT 這種開頭的才大寫（LUCIPARA'S 不算）
        w = re.sub(r"(^|[-(./])([^\W\d_])", lambda m: m.group(1) + m.group(2).upper(), w)
        out.append(re.sub(r"^([^\W\d_])'([^\W\d_])", lambda m: f"{m.group(1)}'{m.group(2).upper()}", w))
    return " ".join(out)


def place_key(s: str) -> str:
    """比較出發地、目的地用：去掉重音與標點（同一本日誌裡 CÁDIZ 與 CADIZ 交替出現）"""
    s = unicodedata.normalize("NFKD", s.upper())
    return re.sub(r"[^A-Z0-9]", "", "".join(ch for ch in s if not unicodedata.combining(ch)))


def read_records() -> list[tuple]:
    path = download(URL, "cliwoc", "CLIWOC21.zip")
    rows = []
    with zipfile.ZipFile(path) as z, z.open("CLIWOC21.txt") as fh:
        for raw in io.TextIOWrapper(fh, encoding="latin-1", newline=""):
            r = raw.rstrip("\r\n")
            if len(r) < 2535:
                continue

            def num(a: int, b: int) -> int | None:
                s = r[a:b].strip()
                return int(s) if s.lstrip("-").isdigit() else None

            rows.append((
                num(0, 4), num(4, 6), num(6, 8), num(8, 12), num(12, 17), num(17, 23), r[43:45].strip(),
                r[297:327].strip(), r[705:735].strip(), r[758:792].strip(), r[2445:2490].strip(), r[2490:2535].strip(),
                r[1601:1631].strip(),
            ))
    print(f"  CLIWOC 原始紀錄 {len(rows):,} 筆")
    return rows


def build_voyages(rows: list[tuple]) -> list[Voyage]:
    by_ship: dict[tuple[str, str], list[tuple]] = defaultdict(list)
    skipped = Counter()
    for r in rows:
        yr, mo, dy, hr, lat, lon = r[:6]
        if lat is None or lon is None or abs(lat) > 9000:
            skipped["沒有船位"] += 1
            continue
        try:
            d = date(yr, mo, dy).toordinal()
        except (TypeError, ValueError):
            skipped["日期錯誤"] += 1
            continue
        by_ship[(r[7], r[8])].append((d, hr if hr is not None else 1200, lat / 100, ((lon / 100) + 180) % 360 - 180, r))
    voyages: list[Voyage] = []
    for (log, ship), recs in by_ship.items():
        recs.sort(key=lambda x: (x[0], x[1]))
        # 連續同一個出發地、目的地的紀錄是一段；短的段（少於 MIN_RUN 筆）併進前一個航程：
        # 有些摘要（EXTRACT）的兩種寫法交替出現（BATAVIA → NEDERLAND、BATAVIA → KAAP DE GOEDE HOOP）
        runs: list[list] = []
        for rec in recs:
            if runs and voyage_key(rec) == voyage_key(runs[-1][-1]):
                runs[-1].append(rec)
            else:
                runs.append([rec])
        current: list = []
        keys: set = set()
        for run in runs:
            key = voyage_key(run[0])
            if current and key not in keys and len(run) >= MIN_RUN:
                voyages.append(make_voyage(log, ship, current))
                current, keys = [], set()
            if not current or len(run) >= MIN_RUN:
                keys.add(key)
            current += run
        if current:
            voyages.append(make_voyage(log, ship, current))
    print(f"  有船位的航程 {len(voyages):,} 個；不用的紀錄：{dict(skipped)}")
    return voyages


def voyage_key(rec: tuple) -> tuple[str, str]:
    return place_key(rec[4][10]), place_key(rec[4][11])


def make_voyage(log: str, ship: str, recs: list) -> Voyage:
    nation = Counter(x[4][6] for x in recs).most_common(1)[0][0]
    raw_company = Counter(x[4][9] for x in recs).most_common(1)[0][0]
    company = COMPANY_CODES.get(raw_company)
    if company is None and nation == "NL" and raw_company in DUTCH_NAVY:
        company = "NLN"
    if company is None and raw_company and raw_company not in DUTCH_NAVY:
        company = title_case(raw_company)  # 鹿特丹的船公司等，照原文
    captain = Counter(x[4][12] for x in recs if x[4][12]).most_common(1)
    origin = Counter(x[4][10] for x in recs).most_common(1)[0][0]
    dest = Counter(x[4][11] for x in recs).most_common(1)[0][0]
    v = Voyage(log, ship, nation, company, origin, dest, captain[0][0] if captain else "")
    v.fixes = [(x[0], x[1], x[2], x[3]) for x in recs]
    return v


def km(a: tuple, b: tuple) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (a[2], a[3], b[2], b[3]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(min(1.0, math.sqrt(h)))


def reach(a: tuple, b: tuple) -> float:
    """兩點之間的天數能走的最遠距離（同一天的兩筆算一天）"""
    return MAX_KM_PER_DAY * max(1, b[0] - a[0])


def despike(fixes: list[tuple], stats: Counter) -> list[tuple]:
    """拿掉跳點與同一個位置的重複紀錄"""
    pts = list(fixes)
    i = 1
    while i < len(pts) - 1:
        a, p, b = pts[i - 1], pts[i], pts[i + 1]
        if km(a, p) > reach(a, p) and km(p, b) > reach(p, b) and km(a, b) <= reach(a, b):
            del pts[i]
            stats["跳點"] += 1
            continue
        i += 1
    return [p for j, p in enumerate(pts) if j == 0 or (p[2], p[3]) != (pts[j - 1][2], pts[j - 1][3])]


def land_crossings(tracks: list[list[tuple]]) -> list[set[int]]:
    """每條航線哪幾段（第 j 段是第 j 點到第 j + 1 點）的直線深入陸地超過 LAND_KM：沿線每 DENSIFY_KM 公里取一點，
    量到最近的海的距離（IHO 海域的網格，河流主題的同一份快取）。間隔太久、距離不合理的段反正會斷開，不量"""
    xs, ys, owner = [], [], []
    for t, pts in enumerate(tracks):
        for j, (a, b) in enumerate(zip(pts, pts[1:])):
            if b[0] - a[0] > MAX_GAP_DAYS or km(a, b) > reach(a, b):
                continue
            # 經度取跨換日線比較短的那一邊
            bx = a[3] + ((b[3] - a[3] + 180) % 360 - 180)
            n = max(1, math.ceil(km(a, b) / DENSIFY_KM))
            f = np.arange(1, n) / n
            xs.append(a[3] + (bx - a[3]) * f)
            ys.append(a[2] + (b[2] - a[2]) * f)
            owner.append(np.full(len(f), t * 100_000 + j))
    if not xs:
        return [set() for _ in tracks]
    x = (np.concatenate(xs) + 180) % 360 - 180
    y = np.concatenate(ys)
    o = np.concatenate(owner)
    iho = sea_areas.rasters()[0]
    _, dist = sea_areas.nearest_sea(iho, x, y)
    out: list[set[int]] = [set() for _ in tracks]
    for key in np.unique(o[dist > LAND_KM]).tolist():
        out[key // 100_000].add(key % 100_000)
    return out


def split(pts: list[tuple], land: set[int], stats: Counter) -> list[list[tuple]]:
    """在間隔太久、距離不合理、深入陸地的地方斷開，回傳各段（至少兩點）"""
    segments, current = [], [pts[0]] if pts else []
    for j, (a, b) in enumerate(zip(pts, pts[1:])):
        reason = (
            "間隔太久" if b[0] - a[0] > MAX_GAP_DAYS
            else "距離不合理" if km(a, b) > reach(a, b)
            else "穿過陸地" if j in land
            else None
        )
        if reason:
            stats[reason] += 1
            segments.append(current)
            current = []
        current.append(b)
    segments.append(current)
    kept = [seg for seg in segments if len(seg) >= 2]
    stats["只剩一點的段"] += len(segments) - len(kept)
    return kept


def split_years(segment: list[tuple]) -> dict[int, list[tuple]]:
    """依年份切開；新的一年從前一年最後一點接起來"""
    out: dict[int, list[tuple]] = {}
    prev = None
    for p in segment:
        y = date.fromordinal(p[0]).year
        if y not in out:
            out[y] = [prev] if prev is not None else []
        out[y].append(p)
        prev = p
    return {y: pts for y, pts in out.items() if len(pts) >= 2}


def ymd(ordinal: int) -> int:
    d = date.fromordinal(ordinal)
    return d.year * 10000 + d.month * 100 + d.day


def densify(lons: list[float], lats: list[float]) -> tuple[list[float], list[float]]:
    xs, ys = [lons[0]], [lats[0]]
    for (x0, y0), (x1, y1) in zip(zip(lons, lats), zip(lons[1:], lats[1:])):
        dist = math.hypot((x1 - x0) * math.cos(math.radians((y0 + y1) / 2)), y1 - y0) * 111.2
        n = max(1, math.ceil(dist / DENSIFY_KM))
        for k in range(1, n + 1):
            xs.append(x0 + (x1 - x0) * k / n)
            ys.append(y0 + (y1 - y0) * k / n)
    return xs, ys


NATION_ZH = {"UK": "英國", "NL": "荷蘭", "ES": "西班牙", "FR": "法國", "SE": "瑞典", "US": "美國", "DE": "漢堡", "DK": "丹麥"}
NATION_EN = {"UK": "British", "NL": "Dutch", "ES": "Spanish", "FR": "French", "SE": "Swedish", "US": "American", "DE": "Hamburg", "DK": "Danish"}


def taiwan_notes(table: list[list], by_year: dict[int, set[int]]) -> tuple[dict[str, str], dict[str, str]]:
    """台灣的附註：經過台灣附近的航程數、年份與國籍（數字由資料算）；拉彼魯茲的那一段 2026-10-29 對過船位"""
    voyages = sorted({v for vs in by_year.values() for v in vs})
    if not voyages:
        return {}, {}
    years = sorted(by_year)
    count = Counter(NATIONS[table[v][1]] for v in voyages)
    zh_n = "、".join(f"{NATION_ZH[k]} {n} 個" for k, n in count.most_common())
    en_n = ", ".join(f"{n} {NATION_EN[k]}" for k, n in count.most_common())
    zh = (
        f"台灣不是這些船的國籍，國家的值留空。{years[0]}–{years[-1]} 年間有 {len(voyages)} 個航程經過台灣附近"
        f"（航線離國界 100 公里以內，{len(years)} 個年份；{zh_n}），多半是往返巴達維亞與廣州（黃埔）、澳門、長崎、上海的船；"
        "1787 年 4 月法國拉彼魯茲（La Pérouse）探險隊的 La Boussole 從馬尼拉灣北上，在台灣西南外海來回約兩週，"
        "5 月初繞到台灣東邊往北。在側欄可看每一年經過的船。"
    )
    en = (
        f"Taiwan is not the nationality of any of these ships, so it has no value. Between {years[0]} and {years[-1]}, "
        f"{len(voyages)} voyages passed near Taiwan (within 100 km, in {len(years)} different years; {en_n}), mostly ships "
        "sailing between Batavia and Canton (Whampoa), Macao, Nagasaki or Shanghai. In April 1787 La Boussole of the French La Pérouse "
        "expedition headed north from Manila Bay, sailed back and forth off south-western Taiwan for about two "
        "weeks, then went round the east side of the island in early May. The side panel lists the ships for each year."
    )
    return {"TWN": zh}, {"TWN": en}


def build() -> None:
    rows = read_records()
    voyages = build_voyages(rows)
    voyages.sort(key=lambda v: (v.fixes[0][0], v.nation, v.ship))

    stats = Counter()
    lines, types, records = [], [], []
    ships_year: dict[str, dict[int, set]] = defaultdict(lambda: defaultdict(set))
    voyage_years: dict[int, set[int]] = defaultdict(set)
    # 側欄量距離用的點：(航程, 年份) 與內插後的經緯度
    near_pts_x, near_pts_y, near_owner = [], [], []
    table = []
    cleaned = [despike(v.fixes, stats) for v in voyages]
    land = land_crossings(cleaned)
    for v, pts, crossing in zip(voyages, cleaned, land):
        segments = split(pts, crossing, stats)
        if not segments:
            continue
        vi = len(table)
        first = min(s[0][0] for s in segments)
        last = max(s[-1][0] for s in segments)
        nation = NATIONS.index(v.nation) if v.nation in NATIONS else None
        if nation is None:
            stats["國籍不明的航程"] += 1
            continue
        ship = "" if UNKNOWN_SHIPS.match(v.ship) or not v.ship else title_case(v.ship)
        origin, dest = title_case(v.origin), title_case(v.dest)
        captain = title_case(v.captain) if v.captain and not UNKNOWN_SHIPS.match(v.captain) else ""
        table.append([ship, nation, v.company, origin, dest, ymd(first), ymd(last), captain])
        for seg in segments:
            for y, pts in split_years(seg).items():
                xs = unwrap([p[3] for p in pts])
                ys = [p[2] for p in pts]
                idx = simplify(xs, ys, set(), SIMPLIFY_DEG)
                lines.append([(xs[i], ys[i]) for i in idx])
                types.append(min(nation, OTHER))
                records.append({
                    "y": y, "v": vi, "s": ship, "n": nation, "c": v.company, "f": origin, "t": dest,
                    "a": ymd(first), "b": ymd(last), "k": captain,
                })
                voyage_years[vi].add(y)
                ships_year[NATION_ISO3[v.nation]][y].add((v.log, v.ship))
                dx, dy = densify(xs, ys)
                near_pts_x += dx
                near_pts_y += dy
                near_owner += [vi * 10000 + y] * len(dx)
    print(f"  航程 {len(table):,} 個、線 {len(lines):,} 條；清理：{dict(stats)}")

    years = sorted({y for ys in voyage_years.values() for y in ys})
    values = {
        iso3: [len(by_year[y]) if by_year.get(y) else None for y in years] for iso3, by_year in ships_year.items()
    }

    # 側欄：每個國家每年經過附近（100 公里內）的航程
    print("  量航線離各國的距離…")
    index = NearIndex(NEAR_KM)
    px, py = np.asarray(near_pts_x), np.asarray(near_pts_y)
    hit_p, hit_c, _ = index.query(px, py, np.zeros(len(px), dtype=bool))
    owner = np.asarray(near_owner)[hit_p]
    near: dict[str, dict[int, set[int]]] = defaultdict(lambda: defaultdict(set))
    for o, c in set(zip(owner.tolist(), hit_c.tolist())):
        near[index.codes[c]][o % 10000].add(o // 10000)
    panel_near = {
        iso3: {str(y): sorted(vs) for y, vs in sorted(by_year.items())} for iso3, by_year in sorted(near.items())
    }
    own: dict[str, dict[int, list[int]]] = defaultdict(dict)
    for vi, row in enumerate(table):
        iso3 = NATION_ISO3[NATIONS[row[1]]]
        for y in voyage_years[vi]:
            own[iso3].setdefault(y, []).append(vi)
    panel_own = {iso3: {str(y): vs for y, vs in sorted(by_year.items())} for iso3, by_year in own.items()}

    twn = sorted({v for vs in near.get("TWN", {}).values() for v in vs})
    print(f"  經過台灣附近的航程 {len(twn)} 個：")
    for vi in twn:
        print("   ", table[vi])
    notes, notes_en = taiwan_notes(table, near.get("TWN", {}))

    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "tracks.json", lines_file(
        lines, QUANTUM, types,
        records=records,
        record_fields=["y", "v", "s", "n", "c", "f", "t", "a", "b", "k"],
        record_scale={"y": 1, "v": 1, "n": 1, "a": 1, "b": 1},
        record_delta=["y", "v"],
        record_strings=["s", "c", "f", "t", "k"],
    ))
    write_json(OUT / "ships.json", indicator_file("ships", "艘", years, values, notes=notes, notesEn=notes_en))
    write_json(OUT / "panel.json", {
        "fields": ["ship", "nation", "company", "from", "to", "start", "end", "captain"],
        "voyages": table,
        "near": panel_near,
        "own": panel_own,
    })
    write_json(OUT / "manifest.json", {
        "topic": "logbooks",
        "generatedAt": now_iso(),
        "source": "CLIWOC 2.1 (García-Herrera et al. 2007, PANGAEA, doi:10.1594/PANGAEA.743343)",
        "license": "CC BY 3.0",
    })


if __name__ == "__main__":
    build()
