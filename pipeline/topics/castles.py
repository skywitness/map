"""城堡與要塞（2026-11-06，參考 thecastlemap.com，使用者選「城1–城7 都做」）。

資料：Castle Map 整理的 9,040 座城堡、要塞、宮殿與遺址（https://thecastlemap.com/data/ 的 castles.csv，
CC0 1.0；GitHub 的 Flightmussy/castlemap-dataset 的 LICENSE 寫明：事實資料〔代碼、名稱、類別、國家、座標、年份、連結、
次數與名次〕放棄所有權利，照片與維基百科的文字不在裡面，照各自的授權）。它從 Wikidata 挑出有真的照片、精確座標、
維基條目、夠多語言版的，分成城堡、要塞、宮殿、遺址四類，知名度依維基語言版數與近 60 天的瀏覽量排名。

另外從 Wikidata（CC0）用 qid 補：
- 中文名稱（繁中標籤原樣用；只有簡中的轉繁，再修正音譯地名常見的錯字，跟撞擊坑一樣）
- 是不是世界遺產（P1435 是 Q9259；或 P361 屬於的項目是世界遺產 → 「世界遺產的一部分」）
- 每年的參觀人數（P1174，取 P585 最新的一年）
- 各國在 Wikidata 一共有幾座（P31/P279* 城堡、要塞、堡壘、城館、宮殿、日本城，P17 是那一國），跟這份名單並列
照片的攝影者與授權照 castles.csv 的 image_by、image_licence（取自 Commons 的 Artist 欄）；名字重複兩次的
（「Unknown authorUnknown author」，資料集的已知錯誤）、截斷的，改從 Commons 的 API 重查。

輸出 public/data/topics/castles/：
- castles.json、castles-more.json：點（知名的 1,100 座在第一份，縮小時只畫它們；其餘放大才下載）
- castles-count.json：各國在名單裡、時間軸那一年以前蓋好的座數（國家不上色，tooltip 與排名表用）
- castles-stats.json：左側欄的統計（各國的數量與 Wikidata 全部的數量、每百萬人、各世紀蓋了幾座）
"""
from __future__ import annotations

import csv
import re
import urllib.parse
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, download, indicator_file, write_json, write_layered_points
from geoindex import countries_at
from sources import commons_photos, wpp
from sources.countries import from_alpha2
from sources.wikidata_attractions import _cached
from zh_names import hans, translit_fix, undo_terms

OUT = OUT_DIR / "topics" / "castles"
SNAPSHOT = "2026-11-06"
CSV_URL = "https://thecastlemap.com/castles.csv"
CACHE = CACHE_DIR / "castles"
YEAR_END = 2026  # 時間軸的最後一年：沒有年份的城堡在這一年才畫（tooltip 寫「年份不詳」）

# 時間軸的年份（累積）：西元前稀疏，1000 年起每 25 年
YEARS = [-3000, -2000, -1500, -1000, -750, -500, -250, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] + list(
    range(1025, 2001, 25)) + [YEAR_END]

CATEGORIES = {"castle": 1, "fortress": 2, "palace": 3, "ruin": 4}

# 知名度的四級（照 Castle Map 的 100／300／700／其餘：累計前 100、400、1,100 名）
TIERS = [(100, 4), (400, 3), (1100, 2)]

# 英國的四個構成國（資料用 ISO 3166-2）
SUBDIVISIONS = {"GB-ENG": "GBR", "GB-SCT": "GBR", "GB-WLS": "GBR", "GB-NIR": "GBR"}

ENRICH = """SELECT ?item ?zhtw ?zhhant ?zh ?zhwiki ?whs ?part ?vis ?visy WHERE {{
  VALUES ?item {{ {items} }}
  OPTIONAL {{ ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }}
  OPTIONAL {{ ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }}
  OPTIONAL {{ ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }}
  OPTIONAL {{ ?a schema:about ?item ; schema:isPartOf <https://zh.wikipedia.org/> ; schema:name ?zhwiki }}
  OPTIONAL {{ ?item wdt:P1435 wd:Q9259 . BIND(1 AS ?whs) }}
  OPTIONAL {{ ?item wdt:P361 ?p . ?p wdt:P1435 wd:Q9259 . BIND(1 AS ?part) }}
  OPTIONAL {{ ?item p:P1174 ?vst . ?vst ps:P1174 ?vis . OPTIONAL {{ ?vst pq:P585 ?visy }} }}
}}"""

# 各國在 Wikidata 的數量：城堡 Q23413、要塞 Q57831、堡壘 Q1785071、城館 Q751876、宮殿 Q16560、日本城 Q92026（含子類別）
CLASSES = ["Q23413", "Q57831", "Q1785071", "Q751876", "Q16560", "Q92026"]
COUNT = """SELECT ?c (COUNT(DISTINCT ?item) AS ?n) WHERE {{
  ?item wdt:P31/wdt:P279* wd:{cls} ; wdt:P17 ?c .
}} GROUP BY ?c"""
ALL_ITEMS = """SELECT DISTINCT ?item ?c WHERE {{
  ?item wdt:P31/wdt:P279* wd:{cls} ; wdt:P17 ?c .
}}"""


def _q(url: str) -> str:
    return url.rsplit("/", 1)[1]


def _zh_name(d: dict, en: str) -> str | None:
    from opencc import OpenCC

    # 有繁體字的標籤原樣用（再轉一次會把「大武崙砲台」轉成「砲臺」、音譯的「里」「克」轉成「裡」「剋」）；
    # Wikidata 的 zh-tw、zh-hant 標籤有些其實是簡體（「新天鹅堡」），跟只有簡中的一樣轉繁（地名用的 s2twp，不套「布爾→布林」這種
    # 會打到音譯的詞條，zh_names.place_s2twp），轉完修正音譯地名常見的錯字；繁中標籤有些是機器用 s2twp 轉的（「布林戈斯城堡」），
    # 跟簡中標籤對照改回來（zh_names.undo_terms）
    raw = d.get("zhtw") or d.get("zhhant") or d.get("zh") or d.get("zhwiki")
    if not raw:
        return None
    traditional = OpenCC("t2s").convert(raw) != raw
    if traditional:
        zh = translit_fix(undo_terms(raw, d["zh"]) if d.get("zh") else raw)
    else:
        zh = hans(raw, place=True)
    # 維基條目名稱的消歧義括號（「XX城 (某地)」）拿掉
    zh = re.sub(r"\s*[（(][^）)]*[）)]$", "", zh)
    return zh if zh != en else None


def enrich(qids: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    batch = 300
    for i in range(0, len(qids), batch):
        part = qids[i:i + batch]
        rows = _cached(f"castles-{SNAPSHOT}-{i // batch:02d}", ENRICH.format(items=" ".join(f"wd:{q}" for q in part)))
        for b in rows:
            v = lambda k: b[k]["value"] if k in b else None  # noqa: E731
            d = out.setdefault(_q(v("item")), {})
            for k in ("zhtw", "zhhant", "zh", "zhwiki"):
                if v(k) and k not in d:
                    d[k] = v(k)
            if v("whs"):
                d["whs"] = 1
            if v("part"):
                d["part"] = 1
            # 「未知的值」（somevalue）是空白節點，不是數字
            if v("vis") and re.match(r"^-?[\d.]+(e[+-]?\d+)?$", v("vis")):
                year = int(v("visy")[:4]) if v("visy") and re.match(r"^\d{4}", v("visy")) else 0
                if year >= d.get("visy", -1):
                    d["vis"], d["visy"] = float(v("vis")), year
    return out


def wikidata_counts() -> dict[str, int]:
    """各國在 Wikidata 的城堡、要塞、堡壘、城館、宮殿、日本城（含子類別）有幾項；同一項屬於好幾類只算一次"""
    by_country: dict[str, set[str]] = defaultdict(set)
    for cls in CLASSES:
        for b in _cached(f"castles-wd-{cls}-{SNAPSHOT}", ALL_ITEMS.format(cls=cls)):
            by_country[_q(b["c"]["value"])].add(_q(b["item"]["value"]))
    # 國家項目 → ISO3（P298）
    qs = " ".join(f"wd:{q}" for q in by_country)
    iso = {}
    for b in _cached(f"castles-wd-iso-{SNAPSHOT}", f"SELECT ?c ?iso WHERE {{ VALUES ?c {{ {qs} }} ?c wdt:P298 ?iso }}"):
        iso.setdefault(_q(b["c"]["value"]), b["iso"]["value"])
    out: dict[str, set[str]] = defaultdict(set)
    for c, items in by_country.items():
        if c in iso:
            out[iso[c]] |= items
    return {k: len(v) for k, v in out.items()}


# ── 照片的攝影者 ───────────────────────────────────────────────────

def _doubled(s: str) -> bool:
    n = len(s)
    return n >= 2 and n % 2 == 0 and s[: n // 2] == s[n // 2:]


def commons_artists(files: list[str]) -> dict[str, str]:
    """Commons 的攝影者（sources/commons_photos.py；快取沿用 .cache/castles）"""
    return {f: by for f, (by, _lic) in commons_photos.metadata(files, CACHE).items() if by}


def build() -> None:
    path = download(CSV_URL, "castles", f"castles-{SNAPSHOT}.csv")
    with open(path, encoding="utf-8") as f:
        src = list(csv.DictReader(f))
    print(f"  Castle Map：{len(src)} 筆")
    extra = enrich([r["qid"] for r in src])

    # 攝影者：重複兩次的、太長被截斷的、未知的改查 Commons
    def filename(r: dict) -> str:
        return commons_photos.from_url(r["image"])

    suspect = sorted({filename(r) for r in src if _doubled(r["image_by"]) or r["image_by"].endswith("…") or not r["image_by"]})
    artists = commons_artists(suspect)
    fixed = sum(1 for f in suspect if f in artists)
    print(f"  攝影者可疑的 {len(suspect)} 張，Commons 查到 {fixed} 張")

    located = countries_at([float(r["lon"]) for r in src], [float(r["lat"]) for r in src])
    rows = []
    unmatched: Counter = Counter()
    for r, iso_geo in zip(src, located):
        iso3 = iso_geo or SUBDIVISIONS.get(r["iso"]) or from_alpha2(r["iso"])
        if not iso_geo:
            unmatched[r["iso"]] += 1
        rank = int(r["fame_rank"])
        tier = next((t for limit, t in TIERS if rank <= limit), 1)
        year = int(r["year"]) if r["year"] else None
        e = extra.get(r["qid"], {})
        file = filename(r)
        by = r["image_by"]
        if file in artists:
            by = artists[file]
        elif _doubled(by):
            by = by[: len(by) // 2]
        wiki = r["wikipedia"]
        m = re.match(r"^https://([a-z-]+)\.wikipedia\.org/wiki/(.+)$", wiki)
        rows.append({
            "lon": float(r["lon"]), "lat": float(r["lat"]),
            "c": CATEGORIES[r["category"]], "f": tier, "r": rank,
            "y": year, "ya": 1 if year is not None and r["year_approx"] in ("1", "true", "True") else None,
            # 時間軸用的年份：沒有年份的在最後一年才畫
            "yt": year if year is not None else YEAR_END,
            "iso3": iso3, "en": r["name"], "zh": _zh_name(e, r["name"]),
            "w": 1 if e.get("whs") else (2 if e.get("part") else None),
            "v": round(e["vis"], -3 if e["vis"] >= 10000 else 0) if e.get("vis") else None,
            "vy": e.get("visy") or None,
            "img": commons_photos.image_path(file), "by": commons_photos.credit(by), "lic": r["image_licence"] or None,
            "wp": f"{m.group(1)}:{urllib.parse.unquote(m.group(2))}" if m else None,
            "q": r["qid"],
        })
    if unmatched:
        print(f"  座標不在國界裡（海上的砲台、小島），用資料的國家碼：{dict(unmatched)}")

    # 各國的名次（依全世界的知名度名次）
    by_country: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        by_country[row["iso3"]].append(row)
    for items in by_country.values():
        for i, row in enumerate(sorted(items, key=lambda x: x["r"]), 1):
            row["nr"] = i

    # 點：依知名度排（大的畫在上面靠 sortField；檔案依經度排，差分小）
    rows.sort(key=lambda x: (x["lon"], x["lat"]))
    fields = ["lon", "lat", "c", "f", "r", "nr", "y", "ya", "yt", "iso3", "w", "v", "vy", "en", "zh", "img", "by", "lic", "wp"]
    scale = {"lon": 0.001, "lat": 0.001, "c": 1, "f": 1, "r": 1, "nr": 1, "y": 1, "ya": 1, "yt": 1, "w": 1, "v": 1, "vy": 1}
    # 名稱、照片路徑、攝影者、維基條目是 tooltip 與清單才用的文字，另外放（城6）：地圖先畫，文字隨後到
    write_layered_points(OUT / "castles.json", rows, lambda x: x["f"] >= 2, fields, scale, delta=("lon",), strings=("iso3", "lic"),
                         text=("en", "zh", "img", "by", "wp"))

    # 各國的數量（依時間軸的年份累積）
    counts: dict[str, list[float | None]] = {}
    for iso3, items in by_country.items():
        ys = sorted(x["yt"] for x in items)
        counts[iso3] = [float(sum(1 for y in ys if y <= year)) for year in YEARS]
    world = [float(sum(1 for x in rows if x["yt"] <= year)) for year in YEARS]
    write_json(OUT / "castles-count.json", indicator_file("castles", "座", YEARS, counts, aggregates={"WLD": world}))

    # 左側欄的統計
    wd = wikidata_counts()
    pop_series = wpp.demographic(["TPopulation1July"], last_year=YEAR_END)["TPopulation1July"]
    pop = {iso3: s[YEAR_END] * 1000 for iso3, s in pop_series.items() if YEAR_END in s}
    country_rows = []
    for iso3, items in sorted(by_country.items(), key=lambda kv: -len(kv[1])):
        cats = Counter(x["c"] for x in items)
        top = min(items, key=lambda x: x["r"])
        country_rows.append([
            iso3, len(items), wd.get(iso3), round(pop[iso3]) if iso3 in pop else None,
            [cats.get(i, 0) for i in (1, 2, 3, 4)], top["zh"] or top["en"], top["en"],
        ])
    # 各世紀（西元前合併；1–999 年每 500 年；1000 年起每世紀）與類別
    bins = [("bc", None, 0), ("1", 1, 500), ("500", 500, 1000)] + [(str(c), c, c + 100) for c in range(1000, 2000, 100)] + [("2000", 2000, 2100)]
    centuries = []
    for key, lo, hi in bins:
        sel = [x for x in rows if x["y"] is not None and (lo is None or x["y"] >= lo) and x["y"] < hi]
        cats = Counter(x["c"] for x in sel)
        centuries.append([key, [cats.get(i, 0) for i in (1, 2, 3, 4)]])
    cats = Counter(x["c"] for x in rows)
    write_json(OUT / "castles-stats.json", {
        "snapshot": SNAPSHOT, "total": len(rows), "undated": sum(1 for x in rows if x["y"] is None),
        "approx": sum(1 for x in rows if x["ya"]), "categories": [cats.get(i, 0) for i in (1, 2, 3, 4)],
        "wikidataClasses": CLASSES, "popYear": YEAR_END,
        "fields": ["iso3", "n", "wikidata", "pop", "cats", "topZh", "topEn"],
        "countries": country_rows, "centuries": centuries,
    })
    write_json(OUT / "manifest.json", {"topic": "castles", "snapshot": SNAPSHOT, "source": CSV_URL, "count": len(rows)})

    tw = sorted(by_country.get("TWN", []), key=lambda x: x["r"])
    print(f"  台灣 {len(tw)} 座：{[(x['zh'] or x['en']) for x in tw]}")
    print(f"  有中文名稱 {sum(1 for x in rows if x['zh'])}、世界遺產 {sum(1 for x in rows if x['w'] == 1)}"
          f"（一部分 {sum(1 for x in rows if x['w'] == 2)}）、有參觀人數 {sum(1 for x in rows if x['v'])}")
    print(f"  Wikidata 各國合計：{sorted(wd.items(), key=lambda kv: -kv[1])[:8]}")
