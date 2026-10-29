"""帝國與疆界主題：Cliopatria（Seshat，v0.2.1，CC BY 4.0）西元前 3400 年到 2024 年各政體的範圍，加上 COLDAT
（Becker，CC0）1462 年起各國被哪個歐洲國家殖民。

**Cliopatria**：每一列是一個政體在一段年份（FromYear–ToYear，含頭尾，負的是西元前）的範圍。
- 只畫 Type 是 POLITY、名稱沒有括號的列：括號的（例如「(British Empire)」）是好幾個政體合起來的帝國
  （Components 列出成員，成員各自另有一列），RELATION 是聯盟、藩屬關係，都跟成員的範圍重疊。
  成員的 MemberOf 是它所屬的帝國：顏色依帝國（沒有就是自己）分，大英帝國的各部分同一個顏色。
- 時間軸只取 YEARS 這些年份（西元前每 100 年、西元 1–1800 年每 50 年、1800 年起每 5 年，加上 2024 年與台灣的
  1625、1640、1670 年）：
  全部 508 個年份的範圍有 370 萬個頂點，取樣後是那些年份有出現的列。
- 形狀用 Douglas–Peucker 簡化到 SIMPLIFY_DEG（世界地圖的比例尺），每個多邊形的外環與洞各一條封閉的線
  （線圖層的 fill，k 是 1 的是洞），量化 QUANTUM；列的資料（年份、名稱、帝國）放在 lines_file 的 groups，只存一次。

**台灣**（使用者決定：逐一核對，Cliopatria 錯或缺的依史實修正，資料檔與附註標明；FIXES）：
1. 荷蘭：Cliopatria 1626 年起，補 1624–1625 年（大員，用 1626 年荷蘭在台灣的範圍）。
2. 西班牙：北台灣（雞籠、淡水）只到 1642 年（被荷蘭逐出），Cliopatria 的西班牙帝國到 1658 年都還有，1643 年起拿掉台灣的部分。
3. 明鄭（東寧王國）：1662–1682 年台灣的部分 Cliopatria 寫南明（Q1198163），改成東寧王國（Kingdom of Tungning，Q152855）。
4. 澎湖：Cliopatria 的範圍都沒有澎湖，1662 年起併進統治台灣的政體（東寧、清、日本、中華民國）。
5. 金門：1950 年起 Cliopatria 畫在中華人民共和國（海岸線太粗），改到中華民國。
6. 中華民國 1950–2023 年的範圍包含 1950 年就失去的海南島、舟山，1951 年起只留台灣、澎湖、金門（大陳 1955 年撤離，太小沒有畫）。
清朝 1683 年起整個台灣都畫在清朝（實際上東部山區到 1875 年後才設治）、日本到 1945 年、中華民國 1946 年起
（1945 年 10 月接收）照 Cliopatria，附註寫明。改過的列 fx 是 1。

**中文名稱**：Wikidata 的 zh-tw、zh-hant 標籤（沒有時用 zhwiki 的條目名稱或 zh 標籤，OpenCC s2tw 轉繁體），
快取在 .cache/wikimedia/labels.json（跟各國在讀什麼主題共用）。Cliopatria 的 QID 常常指錯（Republic of China 指到
中華人民共和國、Han Dynasty 指到印度的 Chauhan dynasty），所以只在 Wikidata 的英文名稱跟 Cliopatria 的名稱對得上時用它的中文
（zh_names()），ZH_NAMES 是自己寫的（台灣相關、常見的大政體、周代諸侯國）；都沒有的寫英文。

**側欄**（countries.json）：今天的每個國家（1:50m）在每個取樣年份被哪些政體涵蓋（占國土 3% 以上，荷蘭的大員約占台灣 4%），
相同的連續年份合併成一段。

**殖民帝國**（COLDAT_colonies.tab，CC0）：8 個殖民國（比利時、英國、法國、德國、義大利、荷蘭、葡萄牙、西班牙）
各自的起訖年份，用 mean 編碼（使用者決定），max 編碼的起訖給側欄。只補台灣（使用者決定）：荷蘭 1624–1662、
西班牙 1626–1642（北部，partial）、日本 1895–1945。同一年有兩個以上殖民國時取比較晚開始的那個（新的統治者），
partial 的不搶先（台灣 1626–1642 年畫荷蘭）。colonizer.json 的值是 COLONIZERS 的代碼；比利時、德國、義大利併成一類
（類別色最多 8 種）。

約 3 分鐘（第一次下載 Zenodo 的 299 MB）。
"""
from __future__ import annotations

import csv
import io
import json
import re
import unicodedata
import zipfile
from collections import defaultdict

import numpy as np
import pycountry
from shapely.geometry import MultiPolygon, Polygon, box, mapping, shape
from shapely.ops import polylabel, unary_union
from shapely.strtree import STRtree

from common import CACHE_DIR, OUT_DIR, download, indicator_file, lines_file, now_iso, points_file, write_json
from topics.reads import wikidata_labels

OUT = OUT_DIR / "topics" / "empires"
CLIO_URL = "https://zenodo.org/api/records/23128623/files/Seshat-Global-History-Databank/cliopatria-v0.2.1.zip/content"
COLDAT_URL = "https://dataverse.harvard.edu/api/access/datafile/7416946?format=original"
SIMPLIFY_DEG = 0.2
QUANTUM = 0.1
MIN_SHARE = 0.03
# 1625、1640、1670：台灣的荷蘭、西班牙、東寧王國時期（每 50 年取樣時都會漏掉）
YEARS = sorted(set(
    list(range(-3400, 0, 100)) + list(range(50, 1800, 50)) + list(range(1800, 2025, 5)) + [1, 2024, 1625, 1640, 1670]
))
COLORS = 10  # 依帝國上色用幾種顏色（src/topics/empires.ts 的 FILLS 要一樣多）

# 台灣與附近島嶼的範圍（修正用）
TAIWAN = box(119.9, 21.8, 122.2, 25.4)
PENGHU = box(119.3, 23.1, 119.8, 23.8)
KINMEN = box(118.1, 24.3, 118.6, 24.6)
TUNGNING = {"name": "Kingdom of Tungning", "qid": "Q152855"}
# 自己寫的中文名稱（Cliopatria 的名稱 → 中文），優先於 Wikidata：Cliopatria 的 QID 有不少指錯（例如 Republic of China 指到
# 中華人民共和國 Q148、Han Dynasty 指到印度的 Chauhan dynasty、兩韓都指到北韓），或 Wikidata 的標籤是時期而不是政權
# （東寧王國的 zh-tw 是「明鄭時期」）。這裡只列台灣相關、常見的大政體與周代的諸侯國，其他對不上的寫英文（zh_names()）
ZH_NAMES = {
    "Kingdom of Tungning": "東寧王國（明鄭）",
    "Republic of China": "中華民國",
    "Japan": "日本",
    "Republic of Korea": "大韓民國",
    "Democratic People's Republic of Korea": "朝鮮民主主義人民共和國",
    "Republic of Vietnam": "越南共和國",
    "Democratic Republic of Vietnam": "越南民主共和國",
    "Republic of Yemen": "葉門共和國",
    "Syria": "敘利亞",
    "Denmark": "丹麥",
    "Kingdom of Denmark": "丹麥王國",
    "Swiss Confederation": "瑞士",
    "Burma": "緬甸",
    "Swaziland": "史瓦帝尼",
    "Republic of Côte d'Ivoire": "象牙海岸",
    "Free French": "自由法國",
    "Italian Republic": "義大利共和國",
    "Great Mongol State": "大蒙古國",
    "Tibet": "西藏",
    "Han Dynasty": "漢朝",
    "Yuan Dynasty": "元朝",
    "Northern Song": "北宋",
    "Southern Song": "南宋",
    "Xiongnu": "匈奴",
    "Southern Xiongnu": "南匈奴",
    "Turks": "突厥",
    "Joseon": "朝鮮王朝",
    "Gojoseon": "古朝鮮",
    "Baekje": "百濟",
    "Hubaekje": "後百濟",
    "Balhae": "渤海國",
    "Đại Việt": "大越",
    "Chámpa": "占婆",
    "Warring States Japan": "日本戰國時代",
    "Roman Empire": "羅馬帝國",
    "Eastern Roman Empire": "東羅馬帝國",
    "Kingdom of the Franks": "法蘭克王國",
    "Kingdom of Axum": "阿克蘇姆王國",
    "Hunnic Empire": "匈人帝國",
    "Song": "宋國",
    "Wei": "魏國",
    "Wu": "吳國",
    "Yan": "燕國",
    "Yue": "越國",
    "Cao": "曹國",
    "Lu": "魯國",
    "Han": "韓（戰國）",
}
# 不是政體名稱的中文標籤（歷史、列表、時期、事件）：Cliopatria 的 QID 指到條目而不是政體
BAD_ZH = re.compile(r"歷史|列表|統治者|總督|戰爭|時期|時代|遺囑|征服")
# 比對名稱時不算的字
NAME_STOP = {
    "of", "the", "and", "dynasty", "empire", "kingdom", "kingdoms", "republic", "state", "states", "sultanate", "principality",
    "duchy", "grand", "khanate", "caliphate", "emirate", "county", "city", "confederation", "federation", "union", "people",
    "democratic", "united", "socialist", "free", "first", "second", "third", "great", "imperial", "colony", "colonies",
    "protectorate", "province", "lordship", "margraviate", "electorate", "imamate", "late", "early", "later", "former", "new",
    "old", "eastern", "western", "northern", "southern", "upper", "lower", "central", "house",
}
ROC_KEEP_FROM = 1951

# COLDAT 的殖民國 → 代碼（src/topics/empires.ts 的 COLONIZERS 要一致）
COLONIZERS = {"britain": 1, "france": 2, "spain": 3, "portugal": 4, "netherlands": 5, "belgium": 6, "germany": 6, "italy": 6, "japan": 7}
TAIWAN_COLONIAL = [("netherlands", 1624, 1662, False), ("spain", 1626, 1642, True), ("japan", 1895, 1945, False)]
COLDAT_NAMES = {
    "Congo - Brazzaville": "COG", "Congo - Kinshasa": "COD", "Côte d’Ivoire": "CIV", "Micronesia (Federated States of)": "FSM",
    "Myanmar (Burma)": "MMR", "St. Kitts & Nevis": "KNA", "St. Lucia": "LCA", "St. Vincent & Grenadines": "VCT",
    "São Tomé & Príncipe": "STP", "Kosovo": "XKX", "Taiwan": "TWN", "Turkey": "TUR", "Russia": "RUS", "Laos": "LAO",
    "Iran": "IRN", "Syria": "SYR", "North Korea": "PRK", "South Korea": "KOR", "Vietnam": "VNM", "Bolivia": "BOL",
    "Venezuela": "VEN", "Tanzania": "TZA", "Moldova": "MDA", "Brunei": "BRN", "Cape Verde": "CPV", "Eswatini": "SWZ",
    "Czechia": "CZE", "Timor-Leste": "TLS", "Bosnia & Herzegovina": "BIH", "Antigua & Barbuda": "ATG",
    "Trinidad & Tobago": "TTO", "United States": "USA", "United Kingdom": "GBR",
}


# ── Cliopatria ──────────────────────────────────────────────

def read_cliopatria() -> list[dict]:
    path = download(CLIO_URL, "cliopatria", "cliopatria-v0.2.1.zip")
    with zipfile.ZipFile(path) as outer:
        inner_name = next(n for n in outer.namelist() if n.endswith("cliopatria.geojson.zip"))
        with zipfile.ZipFile(io.BytesIO(outer.read(inner_name))) as inner:
            name = next(n for n in inner.namelist() if n.endswith(".geojson"))
            data = json.loads(inner.read(name))
    rows = []
    composites = {}
    for f in data["features"]:
        p = f["properties"]
        if p["Name"].startswith("("):
            composites[p["Name"]] = p.get("Wikidata") or ""
            continue
        if p["Type"] != "POLITY":
            continue
        rows.append({
            "name": p["Name"], "from": int(p["FromYear"]), "to": int(p["ToYear"]), "qid": p.get("Wikidata") or "",
            "member": p.get("MemberOf") or "", "geom": shape(f["geometry"]), "fx": 0,
        })
    print(f"  Cliopatria：{len(data['features']):,} 列，畫 {len(rows):,} 列（{len(composites)} 個括號的帝國不畫）")
    for r in rows:
        r["member_qid"] = composites.get(r["member"], "")
    return rows


def ten_m_taiwan_parts() -> Polygon | MultiPolygon:
    """Natural Earth 1:10m 台灣的島嶼（含澎湖、金門；沒有馬祖）"""
    import geoindex

    for f in geoindex._ten_m_features():
        if f["properties"].get("ADM0_A3") == "TWN":
            return shape(f["geometry"])
    raise RuntimeError("Natural Earth 1:10m 找不到台灣")


def polygonal(g):
    """只留面（相交、相減後可能多出線或點）"""
    if g.is_empty:
        return g
    if g.geom_type in ("Polygon", "MultiPolygon"):
        return g
    parts = [p for p in getattr(g, "geoms", []) if p.geom_type in ("Polygon", "MultiPolygon")]
    return unary_union(parts) if parts else Polygon()


def fix_taiwan(rows: list[dict]) -> list[dict]:
    """FIXES：台灣在各時期屬於誰的修正（見模組說明）；回傳新的列表"""
    ne = ten_m_taiwan_parts()
    penghu = polygonal(ne.intersection(PENGHU))
    kinmen = polygonal(ne.intersection(KINMEN))
    out = []
    added = []
    for r in rows:
        g = r["geom"]
        on_taiwan = g.intersects(TAIWAN) and g.intersection(TAIWAN).area > 0.01
        # 1. 荷蘭 1624–1625：用 1626 年那一列台灣的部分
        if r["name"] == "Dutch Republic" and r["from"] == 1626 and on_taiwan:
            added.append({**r, "from": 1624, "to": 1625, "geom": polygonal(g.intersection(TAIWAN)), "fx": 1})
        # 2. 西班牙：1643 年起拿掉台灣的部分
        if r["name"] == "Spanish Empire" and on_taiwan and r["to"] > 1642:
            if r["from"] <= 1642:
                out.append({**r, "to": 1642})
            out.append({**r, "from": max(r["from"], 1643), "geom": polygonal(g.difference(TAIWAN)), "fx": 1})
            continue
        # 3、4. 南明 1662–1682 年台灣的部分改成東寧王國，加上澎湖
        if r["name"] == "Southern Ming" and r["from"] >= 1662 and on_taiwan:
            rest = polygonal(g.difference(TAIWAN))
            if not rest.is_empty and rest.area > 0.01:
                out.append({**r, "geom": rest, "fx": 1})
            tw = polygonal(unary_union([g.intersection(TAIWAN), penghu]))
            out.append({**r, "name": TUNGNING["name"], "qid": TUNGNING["qid"], "member": "", "member_qid": "", "geom": tw, "fx": 1})
            continue
        # 4. 澎湖併進統治台灣的政體（清、日本、中華民國）
        if r["from"] >= 1683 and on_taiwan and r["name"] in ("Qing Dynasty", "Empire of Japan", "Republic of China"):
            g = polygonal(unary_union([g, penghu]))
            r = {**r, "geom": g, "fx": 1}
        # 5、6. 中華民國：1951 年起只留台灣、澎湖、金門；中華人民共和國 1950 年起拿掉金門
        if r["name"] == "Republic of China" and r["to"] >= ROC_KEEP_FROM and r["from"] >= 1950:
            keep = polygonal(unary_union([g.intersection(TAIWAN), penghu, kinmen]))
            if r["from"] < ROC_KEEP_FROM:
                out.append({**r, "to": ROC_KEEP_FROM - 1})
            out.append({**r, "from": max(r["from"], ROC_KEEP_FROM), "geom": keep, "fx": 1})
            continue
        if r["name"] == "People's Republic of China" and r["from"] >= 1950 and g.intersects(KINMEN):
            r = {**r, "geom": polygonal(g.difference(KINMEN)), "fx": 1}
        out.append(r)
    out += added
    print(f"  台灣的修正：改了或新增 {sum(1 for r in out if r['fx'])} 列")
    return out


def active(rows: list[dict], year: int) -> list[int]:
    return [i for i, r in enumerate(rows) if r["from"] <= year <= r["to"]]


def color_groups(rows: list[dict], used: list[int]) -> dict[str, int]:
    """依帝國（MemberOf，沒有就是自己）上色：取樣的年份裡相鄰（相交或很近）的帝國用不同的顏色（貪婪著色，
    鄰居多的先），顏色數 COLORS；同一個帝國一直是同一個顏色"""
    group = {i: rows[i]["member"] or rows[i]["name"] for i in used}
    neighbours: dict[str, set[str]] = defaultdict(set)
    for year in YEARS:
        idx = [i for i in active(rows, year) if i in group]
        geoms = [rows[i]["geom"].buffer(0.3) for i in idx]
        tree = STRtree(geoms)
        for a, g in enumerate(geoms):
            for b in tree.query(g, predicate="intersects"):
                ga, gb = group[idx[a]], group[idx[int(b)]]
                if ga != gb:
                    neighbours[ga].add(gb)
                    neighbours[gb].add(ga)
    order = sorted(set(group.values()), key=lambda g: (-len(neighbours[g]), g))
    color: dict[str, int] = {}
    count = [0] * COLORS
    clashes = 0
    for g in order:
        taken = {color[n] for n in neighbours[g] if n in color}
        free = [c for c in range(COLORS) if c not in taken]
        if not free:
            clashes += 1
            free = list(range(COLORS))
        c = min(free, key=lambda c: count[c])
        color[g] = c
        count[c] += 1
    print(f"  {len(order)} 個帝國或政體，{COLORS} 種顏色；相鄰同色 {clashes} 個")
    return color


def rings_of(g) -> list[tuple[list[tuple[float, float]], int]]:
    polys = list(g.geoms) if g.geom_type == "MultiPolygon" else ([g] if g.geom_type == "Polygon" else [])
    out = []
    for p in polys:
        out.append((list(p.exterior.coords), 0))
        for hole in p.interiors:
            out.append((list(hole.coords), 1))
    return out


def country_timeline(rows: list[dict], used: list[int]) -> dict[str, list[list]]:
    """今天的每個國家在每個取樣年份被哪些政體涵蓋（占國土 MIN_SHARE 以上），連續相同的合併：[起, 迄, 列的索引, 比例%]"""
    from topics.population_grid import country_shapes

    countries = {}
    for code, polygons in country_shapes().items():
        g = polygonal(unary_union([Polygon(p[0], p[1:]).buffer(0) for p in polygons]))
        if not g.is_empty:
            countries[code] = g
    codes = list(countries)
    tree = STRtree([countries[c] for c in codes])
    per: dict[str, dict[int, list[tuple[int, float]]]] = defaultdict(dict)
    for year in YEARS:
        for i in active(rows, year):
            if i not in used:
                continue
            g = rows[i]["geom"]
            for j in tree.query(g, predicate="intersects"):
                code = codes[int(j)]
                c = countries[code]
                share = polygonal(c.intersection(g)).area / c.area
                if share >= MIN_SHARE:
                    per[code].setdefault(year, []).append((i, share))
    out = {}
    for code, by_year in per.items():
        spans: list[list] = []
        for year in YEARS:
            for i, share in sorted(by_year.get(year, []), key=lambda t: -t[1]):
                name = rows[i]["name"]
                last = next((s for s in reversed(spans) if s[2] == name and s[1] == prev_year(year)), None)
                if last:
                    last[1] = year
                    last[3] = max(last[3], round(share * 100))
                else:
                    spans.append([year, year, name, round(share * 100)])
        out[code] = spans
    return out


def prev_year(year: int) -> int | None:
    i = YEARS.index(year)
    return YEARS[i - 1] if i else None


# ── COLDAT ──────────────────────────────────────────────

def coldat() -> tuple[dict[str, list], list[int]]:
    path = download(COLDAT_URL, "coldat", "COLDAT_colonies.tab")
    with open(path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    spans: dict[str, list] = {}
    for r in rows:
        name = r["country"]
        iso3 = COLDAT_NAMES.get(name)
        if not iso3:
            try:
                iso3 = pycountry.countries.lookup(name.replace("&", "and")).alpha_3
            except LookupError:
                raise RuntimeError(f"COLDAT 的國名對不到 ISO3：{name}") from None
        out = []
        for c in ("belgium", "britain", "france", "germany", "italy", "netherlands", "portugal", "spain"):
            if r[f"col.{c}"] != "1":
                continue
            def num(k: str) -> int | None:
                v = r[k]
                return int(float(v)) if v not in ("NA", "") else None
            out.append([c, num(f"colstart.{c}_mean"), num(f"colend.{c}_mean"), num(f"colstart.{c}_max"), num(f"colend.{c}_max"), 0, 0])
        spans[iso3] = out
    # 只補台灣：[殖民國, 起, 迄, max 起, max 迄, 部分地區, 自己補的]
    spans["TWN"] = [[c, a, b, a, b, int(partial), 1] for c, a, b, partial in TAIWAN_COLONIAL]
    first = min(s[1] for v in spans.values() for s in v if s[1])
    years = list(range(first, 2025))
    return spans, years


def colonizer_values(spans: dict[str, list], years: list[int]) -> dict[str, list[int | None]]:
    out = {}
    for iso3, ss in spans.items():
        series = []
        for y in years:
            live = [s for s in ss if s[1] is not None and s[2] is not None and s[1] <= y <= s[2]]
            if not live:
                series.append(None)
                continue
            # 比較晚開始的優先；只有部分地區的（台灣北部的西班牙）不搶先
            best = max(live, key=lambda s: (not s[5], s[1]))
            series.append(COLONIZERS[best[0]])
        if any(v is not None for v in series):
            out[iso3] = series
    return out


def _letters(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s.lower()) if "a" <= c <= "z" or c == " ")


def same_name(name: str, en: str | None) -> int:
    """Cliopatria 的名稱跟 Wikidata 的英文名稱像不像：2 一樣、1 有共同的字（前 5 個字母相同；短字要整個相同）、0 不像"""
    if not en:
        return 0
    a, b = _letters(name).replace(" ", ""), _letters(en).replace(" ", "")
    if a == b:
        return 2
    if min(len(a), len(b)) >= 5 and (a in b or b in a):
        return 1
    ta = {t for t in _letters(name).split() if t not in NAME_STOP}
    tb = {t for t in _letters(en).split() if t not in NAME_STOP}
    return int(any(x == y or (min(len(x), len(y)) >= 5 and x[:5] == y[:5]) for x in ta for y in tb))


def zh_names(rows: list[dict], used: list[int], labels: dict[str, list]) -> dict[str, str]:
    """Cliopatria 的名稱（政體與帝國）→ 中文名稱。Wikidata 的中文只在它的英文名稱跟 Cliopatria 的名稱對得上時用
    （same_name()；幾個名稱共用一個 QID 時只給最像的那一個），標籤是歷史、列表、時期的不用；ZH_NAMES 優先。對不上的不給，前端寫英文"""
    by_name: dict[str, str] = {}
    for i in used:
        r = rows[i]
        by_name.setdefault(r["name"], r["qid"])
        if r["member"]:
            by_name.setdefault(r["member"], r["member_qid"])
    # 帝國的名稱寫在括號裡（「(British Empire)」），跟沒有括號的同一個政體算一個名稱；自己寫了的不參加比較
    shared: dict[str, set[str]] = defaultdict(set)
    for name, q in by_name.items():
        if q and name.strip("()") not in ZH_NAMES:
            shared[q].add(name.strip("()"))
    out = {}
    for q, names_ in shared.items():
        zh, en = labels.get(q) or [None, None]
        if not zh or BAD_ZH.search(zh):
            continue
        score = {n: same_name(n, en) for n in names_}
        best = max(score.values())
        winners = [n for n, v in score.items() if v == best]
        if best and len(winners) == 1:
            out[winners[0]] = zh
    out.update(ZH_NAMES)
    out.update({f"({n})": zh for n, zh in list(out.items())})
    total = {n.strip("()") for n in by_name}
    print(f"  中文名稱：{sum(1 for n in total if n in out):,} / {len(total):,} 個名稱（{len(ZH_NAMES)} 個自己寫的；其他寫英文）")
    return out


def build() -> None:
    rows = fix_taiwan(read_cliopatria())
    used = sorted({i for y in YEARS for i in active(rows, y)})
    print(f"  取樣 {len(YEARS)} 個年份，用到 {len(used):,} 列")
    color = color_groups(rows, used)

    qids = {rows[i]["qid"] for i in used} | {rows[i]["member_qid"] for i in used}
    names = zh_names(rows, used, wikidata_labels({q for q in qids if q}))

    # 每個環一筆紀錄只放列的編號 r 與是不是洞 k；列的資料（年份、名稱、帝國、有沒有修正）放在 groups，只存一次
    lines, types, records, groups, label_pts = [], [], [], [], []
    for i in used:
        r = rows[i]
        g = r["geom"].simplify(SIMPLIFY_DEG, preserve_topology=True)
        if g.is_empty:
            continue
        zh = names.get(r["name"])
        member = r["member"].strip("()")
        member_zh = names.get(r["member"]) if member else None
        c = color[r["member"] or r["name"]]
        # f：前端線圖層的 fill 用來挑出要畫成面的環（全部都是），放在 groups 只存一次
        groups.append({"r": i, "a": r["from"], "b": r["to"] + 1, "n": r["name"], "z": zh, "m": member or None, "w": member_zh,
                       "fx": r["fx"], "f": 1})
        for ring, hole in rings_of(g):
            lines.append(ring)
            types.append(c)
            records.append({"r": i, "k": hole})
        big = max(list(g.geoms) if g.geom_type == "MultiPolygon" else [g], key=lambda p: p.area)
        pt = polylabel(big, tolerance=0.1)
        label_pts.append({"lon": round(pt.x, 2), "lat": round(pt.y, 2), "a": r["from"], "b": r["to"] + 1, "n": r["name"], "z": zh,
                          "s": round(r["geom"].area, 2)})

    OUT.mkdir(parents=True, exist_ok=True)
    data = lines_file(
        lines, QUANTUM, types, records=records,
        record_fields=["r", "k"], record_scale={"r": 1, "k": 1}, record_delta=["r"],
        groups=("r", points_file(groups, ["r", "a", "b", "n", "z", "m", "w", "fx", "f"], {"r": 1, "a": 1, "b": 1, "fx": 1, "f": 1},
                                 ("r",), ("n", "z", "m", "w"))),
    )
    write_json(OUT / "polities.json", data)
    label_pts.sort(key=lambda p: -p["s"])
    write_json(OUT / "labels.json", points_file(
        label_pts, ["lon", "lat", "a", "b", "n", "z", "s"], {"lon": 0.01, "lat": 0.01, "a": 1, "b": 1, "s": 0.01}, (), ("n", "z")))

    timeline = country_timeline(rows, set(used))
    write_json(OUT / "countries.json", {
        "names": {rows[i]["name"]: names[rows[i]["name"]] for i in used if rows[i]["name"] in names},
        "countries": timeline,
    })
    # 政體的指標：國家不上色，只給時間軸的年份（tooltip 與側欄用 countries.json）
    write_json(OUT / "polities-years.json", indicator_file("polities", "", YEARS, {}))

    spans, col_years = coldat()
    values = colonizer_values(spans, col_years)
    write_json(OUT / "colonizer.json", indicator_file("colonizer", "", col_years, values))
    write_json(OUT / "colonial.json", {"countries": spans})
    write_json(OUT / "manifest.json", {
        "topic": "empires",
        "generatedAt": now_iso(),
        "sources": [
            "Cliopatria v0.2.1 (Seshat Global History Databank), CC BY 4.0, doi:10.5281/zenodo.13363121",
            "COLDAT colonial dates dataset (Becker), CC0, doi:10.7910/DVN/T9SDEW",
        ],
        "years": YEARS,
    })
    print(f"  台灣：{timeline.get('TWN')}")
    print(f"  殖民：台灣 {values.get('TWN', [])[1624 - col_years[0]:1650 - col_years[0]]}")


if __name__ == "__main__":
    build()
