"""景點地圖的擴充（第十批順序 182，2026-10-31，製作手冊第一百三十節）：博物館與主題樂園的人次、摩天輪、購物中心、
世界奇觀、UNESCO 創意城市、世界博覽會。

使用者 2026-10-30 決定：世界奇觀、創意城市、世界博覽會放進「景點地圖」當圖層；主題樂園照用英文維基的人次（原本來自
TEA／AECOM），台灣用觀光署的；世界奇觀的極光、亞馬遜雨林用代表點並註明；世界博覽會只收國際展覽局（BIE）認可的屆次，
1935 年臺灣博覽會、2010 年台北花博寫在附註。購物中心、世界博覽會、世界奇觀同已排除的候選 322、132、335，這次決定做。

資料（英文維基 CC BY-SA 4.0，只引用事實；座標用 Wikidata CC0，依英文維基條目對到項目）：
- 博物館：「List of most-visited museums」（revid 1381343174，一年 125 萬人次以上）；台灣另用觀光署「歷年國內主要觀光遊憩
  據點遊客人數月別統計」（data.gov.tw 8116，政府資料開放授權條款第 1 版）2024 年名稱有「博物館」「美術館」「科學教育館」、
  125 萬人次以上而維基表沒有的（海科館、科教館）；維基表上的台灣館另附觀光署的數字。
- 主題樂園：「List of amusement park rankings」（revid 1377863670）全世界前 25 與各區前 20 的樂園（2009–2024 年，水上樂園不算）；
  台灣用觀光署 TW_PARKS 的歷年人次（麗寶、義大含購物中心，說明寫明）。
- 摩天輪：「List of Ferris wheels」（revid 1373915781）的「Fixed Ferris wheels」表（高度、啟用年、國家、座標）。
- 購物中心：「Shopping mall」的 World's largest malls 表（revid 1381757237，總樓地板面積；出處薄弱，說明寫明）。
- 世界奇觀：Wikidata 的古代七大奇蹟（P361 = Q489772）、新七大奇蹟（Q712728 的 P527）、新七大自然奇景（Q846154 的 P527），
  加英文維基「Wonders of the World」（revid 1381472344）列的 CNN 1997 年七大自然奇景（WONDERS_CNN，座標手寫的代表點）。
- 創意城市、世界博覽會：見各自的函式。

輸出（public/data/topics/attractions/）：museum-visitors.json、park-visitors.json、ferris-wheels.json、malls.json、wonders.json、
creative-cities.json、expos.json（點），visitors.json、landmarks.json（空的指標檔），creative.json、expos-count.json（各國數量）。
"""
from __future__ import annotations

import csv
import hashlib
import re
import time
import urllib.error
import urllib.parse
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, download, indicator_file, points_file, write_json, write_manifest_part, more_path
from sources import wikitable as W
from sources.countries import from_name
from sources.wikidata_profiles import _rows, _sparql

OUT = OUT_DIR / "topics" / "attractions"
TW_CSV_URL = "https://media.taiwan.net.tw/od/01_PRD/" + urllib.parse.quote("歷年國內主要觀光遊憩據點遊客人數月別統計.csv")

PAGES = {
    "museums": ("List_of_most-visited_museums", 1381343174),
    "parks": ("List_of_amusement_park_rankings", 1377863670),
    "ferris": ("List_of_Ferris_wheels", 1373915781),
    "malls": ("Shopping_mall", 1381757237),
    "wonders": ("Wonders_of_the_World", 1381472344),
}


def _page(title: str, rev: int) -> str:
    name = re.sub(r"[^a-z0-9]+", "-", title.lower())
    url = f"https://en.wikipedia.org/w/index.php?title={urllib.parse.quote(title)}&action=raw&oldid={rev}"
    return download(url, "wikipedia", f"att-{name}-{rev}.txt").read_text(encoding="utf-8")


def _link(cell: str) -> str | None:
    m = re.search(r"\[\[([^\]|#]+)", cell)
    return m.group(1).strip().replace("_", " ") if m else None


def _zh(r: dict) -> str | None:
    from opencc import OpenCC

    for k in ("zhtw", "zhhant"):
        if k in r:
            return r[k]["value"]
    return OpenCC("s2tw").convert(r["zh"]["value"]) if "zh" in r else None


def wiki_items(titles: list[str]) -> dict[str, dict]:
    """英文維基條目 → {qid, lon, lat, zh}（Wikidata 的 sitelink；轉址的條目對不到）"""
    titles = sorted({t[0].upper() + t[1:] for t in titles if t})
    out: dict[str, dict] = {}
    for i in range(0, len(titles), 250):
        batch = titles[i:i + 250]
        values = " ".join('"' + t.replace("\\", "\\\\").replace('"', '\\"') + '"@en' for t in batch)
        q = f"""
SELECT ?title ?item (SAMPLE(?coord0) AS ?coord) (SAMPLE(?zhtw0) AS ?zhtw) (SAMPLE(?zhhant0) AS ?zhhant) (SAMPLE(?zh0) AS ?zh) WHERE {{
  VALUES ?title {{ {values} }}
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
  OPTIONAL {{ ?item wdt:P625 ?coord0 }}
  OPTIONAL {{ ?item rdfs:label ?zhtw0 FILTER(lang(?zhtw0) = "zh-tw") }}
  OPTIONAL {{ ?item rdfs:label ?zhhant0 FILTER(lang(?zhhant0) = "zh-hant") }}
  OPTIONAL {{ ?item rdfs:label ?zh0 FILTER(lang(?zh0) = "zh") }}
}} GROUP BY ?title ?item"""
        digest = hashlib.sha1(values.encode()).hexdigest()[:10]
        for r in _rows(_sparql(q, f"enwiki-items-{digest}.json")):
            m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r.get("coord", {}).get("value", ""))
            out[r["title"]["value"]] = {"qid": r["item"]["value"].rsplit("/", 1)[1], "lon": float(m.group(1)) if m else None,
                                        "lat": float(m.group(2)) if m else None, "zh": _zh(r)}
    return out


def resolve(titles: list[str]) -> dict[str, str]:
    """轉址的條目 → 目標條目（讀 action=raw 的 #REDIRECT）；不是轉址的不放"""
    out = {}
    for t in titles:
        url = f"https://en.wikipedia.org/w/index.php?title={urllib.parse.quote(t.replace(' ', '_'))}&action=raw&redirect=no"
        name = re.sub(r"[^a-z0-9]+", "-", t.lower())
        for attempt in range(6):  # 維基百科常回 429：等一下再試
            try:
                raw = download(url, "wikipedia", f"redirect-{name}.txt").read_text(encoding="utf-8")
                break
            except urllib.error.HTTPError as e:
                if e.code == 404:  # 紅連結（沒有這個條目）
                    raw = ""
                    break
                if e.code != 429 or attempt == 5:
                    raise
                time.sleep(30)
        m = re.match(r"#REDIRECT\s*\[\[([^\]|#]+)", raw, re.I)
        if m:
            out[t] = m.group(1).strip()
    return out


def with_redirects(titles: list[str]) -> dict[str, dict]:
    """wiki_items()，對不到的條目跟著轉址再查一次"""
    items = wiki_items(titles)
    missing = [t for t in titles if t and t[0].upper() + t[1:] not in items]
    if missing:
        targets = resolve(missing)
        more = wiki_items(list(targets.values()))
        for t, target in targets.items():
            if target[0].upper() + target[1:] in more:
                items[t[0].upper() + t[1:]] = more[target[0].upper() + target[1:]]
    return items


def _country(name: str) -> str | None:
    flag = re.search(r"\{\{[Ff]lag(?:icon|country|u|deco)?\|([^}|]+)", name)
    name = flag.group(1).strip() if flag else W.text(name).strip()
    return {"UAE": "ARE", "US": "USA", "USA": "USA", "UK": "GBR", "Vatican": "VAT", "South Korea": "KOR", "Taiwan": "TWN",
            "Russia": "RUS", "Iran": "IRN", "Turkey": "TUR", "Vietnam": "VNM", "Czech Republic": "CZE"}.get(name) or from_name(name)


def _number(s: str) -> float | None:
    m = re.search(r"\d[\d,]*(?:\.\d+)?", W.text(s))
    return float(m.group(0).replace(",", "")) if m else None


def taiwan_visitors() -> dict[str, dict[int, int]]:
    """觀光署：{據點名稱: {年: 人次}}"""
    path = download(TW_CSV_URL, "taiwan-net", "visitors-by-site.csv")
    out: dict[str, dict[int, int]] = defaultdict(dict)
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            try:
                name = (r["細分"] or "").strip()
                name = name if name and name != "-" else r["觀光遊憩區"].strip()
                out[name][int(r["年別"])] = int(float(r["合計"] or 0))
            except ValueError:
                continue
    return out


# ── 博物館 ────────────────────────────────────────────────────────

# 觀光署名稱 → 維基表的條目（同一館）
TW_MUSEUM_WIKI = {"國立自然科學博物館": "National Museum of Natural Science", "國立科學工藝博物館": "National Science and Technology Museum",
                  "國立故宮博物院": "National Palace Museum", "高雄市立美術館": "Kaohsiung Museum of Fine Arts"}
# 觀光署有、維基表沒有的台灣館（125 萬人次以上、名稱是博物館或美術館、科學教育館）的座標：attractions 的 museums.json 對不到時用
TW_MUSEUM_MIN = 1_250_000


def museums(tw: dict, existing: list[dict]) -> list[dict]:
    text = _page(*PAGES["museums"])
    table = W.tables(text)[0]
    rows = []
    for row in W.rows(table):
        if len(row) < 4:
            continue
        title = _link(row[0])
        v = re.search(r"([\d,]{6,})\s*\((\d{4})\)", W.text(row[1]))
        if not title or not v:
            continue
        rows.append({"title": title, "name": W.text(row[0]), "v": int(v.group(1).replace(",", "")), "vy": int(v.group(2)),
                     "iso3": _country(row[3]), "city": _link(row[2])})
    items = with_redirects([r["title"] for r in rows] + [r["city"] for r in rows if r["city"]])
    out, missing = [], []
    tw_by_title = {v: k for k, v in TW_MUSEUM_WIKI.items()}
    for r in rows:
        it = items.get(r["title"][0].upper() + r["title"][1:]) or {}
        pt = (it.get("lon"), it.get("lat"))
        city = items.get(r["city"][0].upper() + r["city"][1:]) if r["city"] else None
        if pt[0] is None and city:  # 條目沒有座標：用城市的座標
            pt = (city["lon"], city["lat"])
        if pt[0] is None:
            missing.append(r["title"])
            continue
        row = {"lon": pt[0], "lat": pt[1], "en": r["name"], "zh": it.get("zh"), "iso3": r["iso3"], "v": r["v"], "vy": r["vy"]}
        if r["title"] in tw_by_title:
            row["tw"] = tw[tw_by_title[r["title"]]].get(2024)
        out.append(row)
    # 觀光署補的台灣館
    by_zh = {p.get("zh"): p for p in existing if p.get("iso3") == "TWN"}
    for name, years in tw.items():
        v = years.get(2024, 0)
        if v < TW_MUSEUM_MIN or name in TW_MUSEUM_WIKI or not re.search(r"博物館|美術館|科學教育館", name) or "旅服" in name:
            continue
        p = by_zh.get(name)
        if not p:
            raise RuntimeError(f"觀光署的 {name} 在景點地圖的博物館裡對不到座標")
        out.append({"lon": p["lon"], "lat": p["lat"], "en": p.get("en"), "zh": name, "iso3": "TWN", "v": v, "vy": 2024, "tw": v, "src": 2})
    print(f"  博物館：維基表 {len(rows)} 館，畫出 {len(out)}（觀光署補 {sum(1 for o in out if o.get('src') == 2)}）；對不到座標：{missing}")
    return out


def _read_points(path) -> list[dict]:
    """讀回 points_file() 的輸出（景點地圖既有的 museums.json、parks.json）；有 -more.json（2026-10-31 起博物館分兩個檔）
    的話接在後面"""
    more = more_path(path)
    if more.exists():
        return _read_points_one(path) + _read_points_one(more)
    return _read_points_one(path)


def _read_points_one(path) -> list[dict]:
    import json

    data = json.loads(path.read_text(encoding="utf-8"))
    fields, columns, scale, delta = data["fields"], data["columns"], data["scale"], set(data.get("delta", []))
    strings = set(data.get("strings", {}).get("fields", []))
    table = data.get("strings", {}).get("table", [])
    out = [dict() for _ in range(len(columns[0]))]
    for f, col in zip(fields, columns):
        acc = 0
        for i, v in enumerate(col):
            if f in strings:
                out[i][f] = table[v] if v else None
            elif v is None or f not in scale:
                out[i][f] = v
            else:
                if f in delta:
                    acc += v
                    v = acc
                out[i][f] = v * scale[f]
    return out


# ── 主題樂園 ──────────────────────────────────────────────────────

PARK_YEARS = list(range(2009, 2025))
# 觀光署的據點名稱（改過名的都列）→ 景點地圖 parks.json（或 zoos.json）裡的中文名稱
TW_PARKS = {
    "麗寶樂園": (["麗寶樂園", "麗寶樂園渡假村"], "含 Outlet 購物中心、飯店"),
    "義大遊樂世界": (["義大世界"], "含購物中心、飯店"),
    "六福村主題遊樂園": (["六福村主題遊樂園"], None),
    "劍湖山世界": (["劍湖山世界"], None),
    "九族文化村": (["九族文化村"], None),
    "小人國主題樂園": (["小人國主題樂園"], None),
    "遠雄海洋公園": (["遠雄海洋公園", "Farglory Ocean Park"], None),
}


def parks(tw: dict, existing: list[dict]) -> list[dict]:
    text = _page(*PAGES["parks"])
    start, end = text.index("===Amusement parks==="), text.index("[[Water park]]s===")
    series: dict[str, dict] = {}
    for table in W.tables(text[start:end]):
        header = W.strip_refs(table.split("\n|-", 1)[0])
        years = [int(y) for y in re.findall(r"!\s*((?:19|20)\d\d)\s*(?=!!|\n|$)", header)]
        for row in W.rows(table):
            if len(row) < 3 + len(years):
                continue
            title = _link(row[1])
            if not title:
                continue
            vals = row[-len(years):]
            rec = series.setdefault(title, {"title": title, "name": W.text(re.sub(r"<small>.*?</small>", "", row[1])).strip(),
                                            "loc": row[2], "v": {}})
            for y, cell in zip(years, vals):
                n = _number(cell)
                if n and y not in rec["v"]:
                    rec["v"][y] = int(n)
    items = with_redirects(list(series))
    out, missing = [], []
    for title, rec in series.items():
        it = items.get(title[0].upper() + title[1:]) or {}
        if it.get("lon") is None:
            missing.append(title)
            continue
        loc = W.text(rec["loc"])
        iso3 = _country(loc.rsplit(",", 1)[-1]) if "," in loc else None
        out.append({"lon": it["lon"], "lat": it["lat"], "en": rec["name"], "zh": it.get("zh"), "iso3": iso3, "v": rec["v"], "src": 1})
    by_zh = {p.get("zh"): p for p in existing if p.get("iso3") == "TWN"}
    for zh, (names, note) in TW_PARKS.items():
        p = by_zh.get(zh)
        if not p:
            raise RuntimeError(f"台灣的樂園 {zh} 在景點地圖裡對不到座標")
        v = {}
        for n in names:
            for y, x in tw.get(n, {}).items():
                if y in PARK_YEARS and x:
                    v[y] = x
        out.append({"lon": p["lon"], "lat": p["lat"], "en": p.get("en"), "zh": zh, "iso3": "TWN", "v": v, "src": 2, "note": note})
    print(f"  主題樂園：維基各表 {len(series)} 個，畫出 {len(out)}（台灣 {len(TW_PARKS)}）；對不到座標：{missing}")
    return out


def coord(text: str) -> tuple[float, float] | None:
    """{{coord|…}} → (經度, 緯度)：十進位（可帶 N/S/E/W）或度分秒"""
    m = re.search(r"\{\{[Cc]oord\|([^}]*)\}\}", text)
    if not m:
        return None
    parts = [p.strip() for p in m.group(1).split("|") if "=" not in p and ":" not in p]
    nums, dirs = [], []
    for p in parts:
        if p.upper() in ("N", "S", "E", "W"):
            dirs.append((len(nums), p.upper()))
        elif re.fullmatch(r"-?\d+(\.\d+)?", p):
            nums.append(float(p))
    if not dirs and len(nums) >= 2:
        return nums[1], nums[0]
    if len(dirs) >= 2:
        (i, d1), (j, d2) = dirs[0], dirs[1]
        lat_parts, lon_parts = nums[:i], nums[i:j]

        def dms(xs):
            return sum(x / 60 ** k for k, x in enumerate(xs))
        lat, lon = dms(lat_parts), dms(lon_parts)
        return (-lon if d2 == "W" else lon), (-lat if d1 == "S" else lat)
    return None


# ── 摩天輪 ────────────────────────────────────────────────────────


def ferris_wheels() -> list[dict]:
    text = _page(*PAGES["ferris"])
    part = text[text.index("== Fixed Ferris wheels =="):text.index("== Transportable Ferris wheels ==")]
    out, skipped = [], []
    for table in W.tables(part):
        if "Height" not in table:
            continue
        for raw in re.split(r"\n\|-[^\n]*", table)[1:]:
            cells = W.rows("{|\n|-\n" + raw.strip() + "\n|}")
            if not cells or len(cells[0]) < 6:
                continue
            row = cells[0]
            name = W.text(re.sub(r"\{\{[Aa]nchor\|[^}]*\}\}", "", row[0])).strip()
            h = re.search(r"(\d+(?:\.\d+)?)\s*\(", W.strip_refs(row[1]))
            y = re.search(r"(1[89]\d\d|20\d\d)", W.strip_refs(row[2]))
            pt = coord(raw)
            iso3 = _country(row[3])
            if not (h and y and pt):
                skipped.append(name)
                continue
            remark = W.text(row[6]) if len(row) > 6 else ""
            if re.search(r"demolished|\bclosed\b", W.strip_refs(raw), re.I):  # 已拆除、停業的不畫（座標的 name 或備註寫的）
                skipped.append(name)
                continue
            out.append({"lon": pt[0], "lat": pt[1], "en": name, "iso3": iso3, "h": float(h.group(1)), "y": int(y.group(1)),
                        "roof": 1 if re.search(r"rooftop|roof", remark, re.I) else 0})
    print(f"  摩天輪：{len(out)} 座（沒有高度、年份或座標而略過 {len(skipped)}：{skipped[:8]}）；最高 "
          f"{sorted(((o['h'], o['en'], o['y']) for o in out), reverse=True)[:3]}；最早 {min((o['y'], o['en']) for o in out)}；"
          f"台灣 {[(o['en'], o['h'], o['y']) for o in out if o['iso3'] == 'TWN']}")
    return out


# ── 購物中心 ──────────────────────────────────────────────────────


def malls() -> list[dict]:
    text = _page(*PAGES["malls"])
    table = next(t for t in W.tables(text) if "Total floor area" in t)
    rows = []
    for row in W.rows(table):
        if len(row) < 6:
            continue
        area = re.search(r"\{\{convert\|([\d,.]+)\|(m2|sqft|sq ft)", row[5], re.I)
        if not area:
            continue
        a = float(area.group(1).replace(",", ""))
        if area.group(2).lower() != "m2":
            a *= 0.09290304
        y = re.search(r"(19|20)\d\d", W.strip_refs(row[4]))
        rows.append({"title": _link(row[1]), "name": W.text(row[1]).strip(), "iso3": _country(row[2]), "city": _link(row[3]),
                     "a": round(a), "y": int(y.group(0)) if y else None, "rank": _number(row[0])})
    items = with_redirects([r["title"] for r in rows if r["title"]] + [r["city"] for r in rows if r["city"]])
    out, by_city = [], []
    for r in rows:
        key = lambda t: t and (t[0].upper() + t[1:])  # noqa: E731
        it = items.get(key(r["title"])) or {}
        pt = (it.get("lon"), it.get("lat"))
        if pt[0] is None and key(r["city"]) in items and items[key(r["city"])]["lon"] is not None:
            pt = (items[key(r["city"])]["lon"], items[key(r["city"])]["lat"])
            by_city.append(r["name"])
        if pt[0] is None:
            raise RuntimeError(f"購物中心 {r['name']} 對不到座標")
        out.append({"lon": pt[0], "lat": pt[1], "en": r["name"], "zh": it.get("zh"), "iso3": r["iso3"], "a": r["a"], "y": r["y"]})
    print(f"  購物中心：{len(out)} 座（用城市座標的 {len(by_city)}：{by_city[:6]}）；最大 {sorted(((o['a'], o['en']) for o in out), reverse=True)[:3]}；"
          f"台灣 {[(o['en'], o['a']) for o in out if o['iso3'] == 'TWN']}")
    return out


# ── 世界奇觀 ──────────────────────────────────────────────────────

WONDER_QUERY = """
SELECT ?group ?item ?en ?coord WHERE {
  { ?item wdt:P361 wd:Q489772 . BIND("ancient" AS ?group) }
  UNION { wd:Q712728 wdt:P527 ?item . BIND("new7" AS ?group) }
  UNION { wd:Q846154 wdt:P527 ?item . BIND("nature7" AS ?group) }
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en) = "en") }
}
"""
GROUPS = {"ancient": 1, "new7": 2, "nature7": 3, "cnn": 4}
# 中文名稱（Wikidata 的中文標籤多半是簡體或不通行的譯名，手寫台灣通行的名稱）
WONDERS_ZH = {
    "Q37200": "吉薩大金字塔", "Q41553": "羅德島太陽神巨像", "Q41931": "巴比倫空中花園", "Q43018": "以弗所的阿提米絲神廟",
    "Q46239": "奧林匹亞宙斯神像", "Q45368": "摩索拉斯王陵墓", "Q43244": "亞歷山大燈塔",
    "Q5788": "佩特拉", "Q5859": "奇琴伊察", "Q9141": "泰姬瑪哈陵", "Q10285": "羅馬競技場", "Q12501": "萬里長城",
    "Q79961": "救世基督像", "Q676203": "馬丘比丘",
    "Q36332": "伊瓜蘇瀑布", "Q107640": "科摩多島", "Q177567": "亞馬遜雨林", "Q190128": "下龍灣", "Q213360": "桌山",
    "Q495733": "濟州火山島與熔岩洞", "Q824602": "公主港地下河",
}
# 只是代表點、不是一個地方的（註明）
WONDERS_AREA = {"Q177567": ("代表點：馬瑙斯附近；雨林遍布南美洲北部 9 國", "Representative point near Manaus; the forest spans nine countries")}
# CNN 1997 年的七大自然奇景（英文維基「Wonders of the World」列的；座標是手寫的代表點）
WONDERS_CNN = [
    ("Grand Canyon", "大峽谷", -112.11, 36.10, "USA", None),
    ("Great Barrier Reef", "大堡礁", 147.70, -18.29, "AUS", None),
    ("Harbour of Rio de Janeiro", "里約熱內盧港（瓜納巴拉灣）", -43.17, -22.79, "BRA", None),
    ("Mount Everest", "聖母峰", 86.925, 27.988, "NPL", None),
    ("Parícutin", "帕里庫廷火山", -102.251, 19.493, "MEX", None),
    ("Victoria Falls", "維多利亞瀑布", 25.857, -17.924, "ZMB", None),
    ("Aurora", "極光", 18.96, 69.65, "NOR", ("代表點：挪威特羅姆瑟；極光在南北極附近的高緯度都看得到", "Representative point at Tromsø, Norway; auroras are seen at high latitudes near both poles")),
]


def wonders() -> list[dict]:
    from geoindex import countries_at

    rows = _rows(_sparql(WONDER_QUERY, "wonders-2026-10-31.json"))
    seen, out = set(), []
    for r in rows:
        qid = r["item"]["value"].rsplit("/", 1)[1]
        if qid in seen or qid not in WONDERS_ZH:
            continue
        seen.add(qid)
        m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r.get("coord", {}).get("value", ""))
        note = WONDERS_AREA.get(qid)
        out.append({"lon": float(m.group(1)), "lat": float(m.group(2)), "en": r["en"]["value"], "zh": WONDERS_ZH[qid],
                    "g": GROUPS[r["group"]["value"]], "note": note[0] if note else None, "noteEn": note[1] if note else None})
    if len(out) != 21:
        raise RuntimeError(f"Wikidata 的三組奇觀應該是 21 項，查到 {len(out)}")
    for en, zh, lon, lat, iso3, note in WONDERS_CNN:
        out.append({"lon": lon, "lat": lat, "en": en, "zh": zh, "g": GROUPS["cnn"], "iso3": iso3,
                    "note": note[0] if note else None, "noteEn": note[1] if note else None})
    codes = countries_at([o["lon"] for o in out], [o["lat"] for o in out])
    for o, c in zip(out, codes):
        o.setdefault("iso3", c)
    return out


# ── UNESCO 創意城市 ──────────────────────────────────────────────

# 類型代碼（前端的 CREATIVE_FIELDS）→ 英文維基的條目
CREATIVE_PAGES = {
    1: "City_of_Literature", 2: "City_of_Film", 3: "City_of_Music_(UNESCO)", 4: "City_of_Crafts_and_Folk_Arts",
    5: "Design_Cities_(UNESCO)", 6: "City_of_Media_Arts", 7: "City_of_Gastronomy",
}
ARCHITECTURE = 8
CREATIVE_NETWORK = ("Creative_Cities_Network", 1381312946)


def _latest(title: str) -> str:
    """cache 裡這個條目的檔（抓的時候取當時最新的 revid）"""
    name = re.sub(r"[^a-z0-9]+", "-", title.lower())
    files = sorted((CACHE_DIR / "wikipedia").glob(f"att-{name}-*.txt"))
    if not files:
        raise RuntimeError(f"沒有 {title} 的條目（先抓 action=history 的最新 revid 再抓 raw）")
    return files[-1].read_text(encoding="utf-8")


def creative_revisions() -> dict[str, int]:
    out = {}
    for title in CREATIVE_PAGES.values():
        name = re.sub(r"[^a-z0-9]+", "-", title.lower())
        files = sorted((CACHE_DIR / "wikipedia").glob(f"att-{name}-*.txt"))
        out[title] = int(files[-1].stem.rsplit("-", 1)[1])
    return out


def creative_cities() -> list[dict]:
    rows = []
    for field, title in CREATIVE_PAGES.items():
        text = _latest(title)
        n = 0
        for table in W.tables(text):
            if not re.search(r"Year|year|Inscri|Designat|Since", table[:800]):
                continue
            for row in W.rows(table):
                if len(row) < 3:
                    continue
                city = _link(row[0])
                y = re.search(r"\b(200[4-9]|20[12]\d)\b", W.strip_refs(" ".join(row[2:])))
                iso3 = _country(row[1])
                if not city or not y or not iso3:
                    continue
                rows.append({"title": city, "name": W.text(row[0]).strip(), "iso3": iso3, "f": field, "y": int(y.group(1))})
                n += 1
        if n == 0:
            raise RuntimeError(f"{title} 沒有讀到城市")
    network = _page(*CREATIVE_NETWORK)
    arch = network[network.index("== Architecture =="):network.index("== Film ==")]
    for link in re.findall(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]", arch):
        rows.append({"title": link, "name": link, "iso3": None, "f": ARCHITECTURE, "y": 2025})
    items = with_redirects([r["title"] for r in rows])
    from geoindex import countries_at

    out, missing = [], []
    for r in rows:
        it = items.get(r["title"][0].upper() + r["title"][1:]) or {}
        if it.get("lon") is None:
            missing.append(r["title"])
            continue
        out.append({"lon": it["lon"], "lat": it["lat"], "en": r["name"], "zh": it.get("zh"), "iso3": r["iso3"], "f": r["f"], "y": r["y"]})
    for o, c in zip(out, countries_at([o["lon"] for o in out], [o["lat"] for o in out])):
        o["iso3"] = o["iso3"] or c
    counts = Counter(o["f"] for o in out)
    print(f"  創意城市：{len(rows)} 列、畫出 {len(out)}（對不到座標 {missing}）；依類型 {sorted(counts.items())}；"
          f"城市 {len({(o['lon'], o['lat']) for o in out})}")
    return out


# ── 輸出 ──────────────────────────────────────────────────────────


def build() -> None:
    tw = taiwan_visitors()
    museum_rows = museums(tw, _read_points(OUT / "museums.json"))
    write_json(OUT / "museum-visitors.json", points_file(
        museum_rows, ["lon", "lat", "en", "zh", "iso3", "v", "vy", "tw", "src"],
        {"lon": 0.001, "lat": 0.001, "v": 1, "vy": 1, "tw": 1, "src": 1}, (), ("iso3",)))

    park_rows = parks(tw, _read_points(OUT / "parks.json") + _read_points(OUT / "zoos.json"))
    for p in park_rows:
        for y in PARK_YEARS:
            p[f"v{y}"] = p["v"].get(y)
    write_json(OUT / "park-visitors.json", points_file(
        park_rows, ["lon", "lat", "en", "zh", "iso3", "src", "note", *(f"v{y}" for y in PARK_YEARS)],
        {"lon": 0.001, "lat": 0.001, "src": 1, **{f"v{y}": 1 for y in PARK_YEARS}}, (), ("iso3", "note")))
    write_json(OUT / "visitors.json", indicator_file("visitors", "", PARK_YEARS, {}))

    wheels = ferris_wheels()
    write_json(OUT / "ferris-wheels.json", points_file(
        wheels, ["lon", "lat", "en", "iso3", "h", "y", "roof"], {"lon": 0.001, "lat": 0.001, "h": 0.1, "y": 1, "roof": 1}, ("y",), ("iso3",)))
    mall_rows = malls()
    write_json(OUT / "malls.json", points_file(
        mall_rows, ["lon", "lat", "en", "zh", "iso3", "a", "y"], {"lon": 0.001, "lat": 0.001, "a": 1000, "y": 1}, (), ("iso3",)))
    wonder_rows = wonders()
    write_json(OUT / "wonders.json", points_file(
        wonder_rows, ["lon", "lat", "en", "zh", "iso3", "g", "note", "noteEn"], {"lon": 0.001, "lat": 0.001, "g": 1}, (), ("iso3",)))
    first = min(w["y"] for w in wheels)
    write_json(OUT / "landmarks.json", indicator_file("landmarks", "", list(range(first, 2027)), {}))

    cities = creative_cities()
    write_json(OUT / "creative-cities.json", points_file(
        cities, ["lon", "lat", "en", "zh", "iso3", "f", "y"], {"lon": 0.001, "lat": 0.001, "f": 1, "y": 1}, ("y",), ("iso3",)))
    years = list(range(2004, max(c["y"] for c in cities) + 1))
    per: dict[str, list[int]] = defaultdict(lambda: [0] * len(years))
    seen = set()
    for c in sorted(cities, key=lambda c: c["y"]):
        key = (c["iso3"], round(c["lon"], 2), round(c["lat"], 2))
        if key in seen or not c["iso3"]:
            continue  # 同一城市兩個類型只算一次
        seen.add(key)
        for i, y in enumerate(years):
            if y >= c["y"]:
                per[c["iso3"]][i] += 1
    write_json(OUT / "creative.json", indicator_file(
        "creative", "個城市", years, {k: [v or None for v in s] for k, s in sorted(per.items())},
        noValue={"TWN": "台灣不是 UNESCO 會員國，沒有創意城市"}, noValueEn={"TWN": "Taiwan is not a UNESCO member and has no Creative Cities"}))

    expo_rows, expo_years, expo_counts = expos()
    write_json(OUT / "expos.json", points_file(
        expo_rows, ["lon", "lat", "en", "zh", "iso3", "y", "y2", "t", "city"], {"lon": 0.001, "lat": 0.001, "y": 1, "y2": 1, "t": 1}, ("y",), ("iso3",)))
    write_json(OUT / "expos-count.json", indicator_file("expos-count", "屆", expo_years, expo_counts))

    write_manifest_part(OUT, "attractions", "attractions-extra", {
        "license": "CC BY-SA 4.0 (English Wikipedia facts); CC0 (Wikidata); 政府資料開放授權條款第 1 版（觀光署）",
        "sources": [f"https://en.wikipedia.org/w/index.php?title={t}&oldid={r}" for t, r in [*PAGES.values(), CREATIVE_NETWORK]]
                   + [f"https://en.wikipedia.org/w/index.php?title={t}&oldid={r}" for t, r in creative_revisions().items()]
                   + ["https://data.gov.tw/dataset/8116"],
    })


# ── 世界博覽會 ────────────────────────────────────────────────────

# 英文維基「World's fair」的「List of expositions」：BIE 的官方名單（世界博覽會、專業博覽會、園藝博覽會三個表）
EXPO_PAGE = ("World's_fair", 1381882062)
EXPO_SECTIONS = {"===World Expos===": 1, "===Specialised Expos===": 2, "===Horticultural Expos===": 3}


def expos() -> tuple[list[dict], list[int], dict]:
    from geoindex import countries_at

    text = _page(*EXPO_PAGE)
    part = text[text.index("==List of expositions=="):text.index("==Legacies==")]
    rows = []
    for header, t in EXPO_SECTIONS.items():
        start = part.index(header)
        nxt = min([part.index(h, start + 1) for h in EXPO_SECTIONS if part.find(h, start + 1) > 0] + [len(part)])
        for table in W.tables(part[start:nxt]):
            for row in W.rows(table):
                if len(row) < 3:
                    continue
                m = re.search(r"\[\[([^\]|]+)\|?((?:18|19|20)\d\d)?\]\]", row[0])
                y = re.search(r"(18|19|20)\d\d", W.strip_refs(row[0]))
                if not y:
                    continue
                years = [int(x) for x in re.findall(r"\b(1[89]\d\d|20\d\d)\b", W.strip_refs(row[2]))]
                loc_raw = re.sub(r"\[\[File:[^\]]*\]\]|\{\{flagicon\|[^{}]*\}\}", "", row[1])
                city = re.search(r"\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]", loc_raw)
                rows.append({"article": m.group(1).strip() if m else None, "y": int(y.group(0)),
                             "y2": max(years) if years else int(y.group(0)), "t": t,
                             "city_title": city.group(1).strip() if city else None,
                             "loc": (city.group(2) or city.group(1)).strip() if city else W.text(loc_raw).strip()})
    items = with_redirects([r["city_title"] for r in rows if r["city_title"]] + [r["article"] for r in rows if r["article"]])
    out, missing = [], []
    for r in rows:
        key = lambda s: s and s[0].upper() + s[1:]  # noqa: E731
        city = items.get(key(r["city_title"])) or {}
        art = items.get(key(r["article"])) or {}
        lon, lat = (city.get("lon"), city.get("lat")) if city.get("lon") is not None else (art.get("lon"), art.get("lat"))
        if lon is None:
            missing.append(r["loc"])
            continue
        out.append({"lon": lon, "lat": lat, "en": r["article"] or r["loc"], "zh": art.get("zh"), "y": r["y"], "y2": r["y2"], "t": r["t"],
                    "city": r["loc"]})
    for o, c in zip(out, countries_at([o["lon"] for o in out], [o["lat"] for o in out])):
        o["iso3"] = c
    years = list(range(min(o["y"] for o in out), max(o["y"] for o in out) + 1))
    counts: dict[str, list[int]] = defaultdict(lambda: [0] * len(years))
    for o in out:
        for i, y in enumerate(years):
            if y >= o["y"]:
                counts[o["iso3"]][i] += 1
    values = {c: [v or None for v in s] for c, s in sorted(counts.items()) if c}
    print(f"  世界博覽會：{len(rows)} 屆（世界 {sum(1 for r in rows if r['t'] == 1)}、專業 {sum(1 for r in rows if r['t'] == 2)}、"
          f"園藝 {sum(1 for r in rows if r['t'] == 3)}），對不到座標 {missing}；最多 {sorted(((s[-1], c) for c, s in counts.items() if c), reverse=True)[:6]}；"
          f"{years[0]}–{years[-1]}")
    return out, years, values
