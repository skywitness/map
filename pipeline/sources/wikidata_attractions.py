"""景點地圖（博物館、動物園與水族館、主題樂園與雲霄飛車）的 Wikidata 項目（CC0）。

一次查全世界的博物館（含子類別約 8 萬個）會逾時：先查各大類的子類別（P279*），子類別每 BATCH 個查一次；直接標成
「博物館」（Q33506）的約 5 萬個一國（P17）查一次。快取在 .cache/wikidata/attractions/。
每個項目：直接的類別（P31，可能好幾個）、屬於哪一大類（ROOTS）、座標、維基百科條目數（sitelinks，篩選與排序用）、
英文與中文名稱（zh-tw、zh-hant、zh，前端用台灣用字的那個）、有沒有停用日期（P576、P3999，有的不收）。
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request

from common import CACHE_DIR, USER_AGENT

SPARQL = "https://query.wikidata.org/sparql"
CACHE = CACHE_DIR / "wikidata" / "attractions"
# 大類 → 根類別（含子類別）
ROOTS = {
    "museum": "Q33506",
    "zoo": "Q43501",
    "aquarium": "Q2281788",
    "theme-park": "Q2416723",
    "amusement-park": "Q194195",
    "roller-coaster": "Q204832",
}
# 博物館的類型（地圖上的顏色）→ 根類別（含子類別）；一個項目屬於好幾型時依 MUSEUM_TYPES 的順序取第一個，都不是的是「其他」
MUSEUM_TYPES = {
    "art": ["Q207694"],  # 美術館
    "nature": ["Q1970365", "Q588140", "Q2398990", "Q3499307"],  # 自然史博物館、科學博物館、科技博物館、科學中心
    # 歷史、考古、露天、地方、故居、民族學、軍事、人物紀念、宗教博物館
    "history": ["Q16735822", "Q3329412", "Q756102", "Q1595639", "Q2087181", "Q12104174", "Q2772772", "Q10624527", "Q92755865"],
}
# 博物館的子類別裡不算景點的：遺產鐵道、遊客中心、解說中心、自然中心、影片資料館、已關閉的博物館、「博物館概念」
NOT_MUSEUMS = {"Q420962", "Q18411786", "Q78458396", "Q1549731", "Q16761700", "Q726929", "Q1352795", "Q123124127", "Q60491487"}
COUNTRIES = """SELECT DISTINCT ?country ?cc WHERE { ?country wdt:P297 ?cc . ?country wdt:P31/wdt:P279* wd:Q6256 . }"""
CLASSES = """SELECT ?cls ?root WHERE {{ VALUES ?root {{ {roots} }} ?cls wdt:P279* ?root }}"""
# 查詢的共同部分：座標、維基百科條目數、名稱、停用日期
FIELDS = """
  ?item wdt:P625 ?coord ; wikibase:sitelinks ?sl .
  OPTIONAL {{ ?item rdfs:label ?en FILTER(LANG(?en) = "en") }}
  OPTIONAL {{ ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }}
  OPTIONAL {{ ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }}
  OPTIONAL {{ ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }}
  OPTIONAL {{ ?item wdt:P576|wdt:P3999 ?closed }}
"""
# 子類別（博物館本身以外）分批查；直接標成「博物館」（Q33506）的約 5 萬個，一國一次
BY_CLASS = "SELECT ?item ?cls ?coord ?sl ?en ?zhtw ?zhhant ?zh ?closed WHERE {{ VALUES ?cls {{ {classes} }} ?item wdt:P31 ?cls ." + FIELDS + "}}"
BY_COUNTRY = "SELECT ?item ?cls ?coord ?sl ?en ?zhtw ?zhhant ?zh ?closed WHERE {{ VALUES ?cls {{ wd:Q33506 }} ?item wdt:P31 ?cls ; wdt:P17 wd:{country} ." + FIELDS + "}}"
BATCH = 40


def _sparql(query: str) -> list[dict]:
    req = urllib.request.Request(
        SPARQL, data=urllib.parse.urlencode({"query": query}).encode(),
        headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"},
    )
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.load(r)["results"]["bindings"]
        except urllib.error.HTTPError as err:
            if err.code not in (429, 500, 502, 503, 504):
                raise
            time.sleep(int(err.headers.get("Retry-After") or 10 * (attempt + 1)) + 1)
        except (urllib.error.URLError, TimeoutError):
            time.sleep(10 * (attempt + 1))
    raise RuntimeError("Wikidata 的 SPARQL 一直失敗，稍後再跑")


def _cached(name: str, query: str) -> list[dict]:
    path = CACHE / f"{name}.json"
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(_sparql(query)), encoding="utf-8")
        time.sleep(1)
    return json.loads(path.read_text(encoding="utf-8"))


def classes() -> dict[str, set[str]]:
    """類別 QID → 屬於哪些大類"""
    roots = " ".join(f"wd:{q}" for q in ROOTS.values())
    by_root = {v: k for k, v in ROOTS.items()}
    out: dict[str, set[str]] = {}
    for r in _cached("_classes", CLASSES.format(roots=roots)):
        out.setdefault(r["cls"]["value"].rsplit("/", 1)[1], set()).add(by_root[r["root"]["value"].rsplit("/", 1)[1]])
    return out


# 沒有英文標籤的項目改用這些語言的名稱（依序取第一個）：Wikidata 2025 年起很多名稱只寫在多語言標籤 mul，
# 其次是英文的變體與其他語言（博物館大量匯入的德國、義大利、巴西等多半只有當地語言）
FALLBACK_LANGS = ["mul", "en-gb", "en-us", "en-ca", "de", "fr", "it", "es", "pt", "nl", "sv", "pl", "cs", "da", "nb", "nn",
                  "fi", "hu", "ro", "ca", "eu", "gl", "sk", "sl", "hr", "sr", "bs", "et", "lv", "lt", "is", "ga", "cy",
                  "id", "ms", "vi", "tr", "ru", "uk", "be", "bg", "mk", "el", "he", "ar", "fa", "hi", "th", "ka", "hy",
                  "ko", "ja"]
FALLBACK = """SELECT ?item ?l WHERE {{ VALUES ?item {{ {items} }} ?item rdfs:label ?l FILTER(LANG(?l) IN ({langs})) }}"""
LABEL_BATCH = 400


def fallback_names(qids: list[str]) -> dict[str, str]:
    """QID → 沒有英文標籤時用的名稱（FALLBACK_LANGS 裡第一個有的語言）"""
    order = {lang: i for i, lang in enumerate(FALLBACK_LANGS)}
    langs = ", ".join(f'"{lang}"' for lang in FALLBACK_LANGS)
    best: dict[str, tuple[int, str]] = {}
    todo = sorted(qids)
    for i in range(0, len(todo), LABEL_BATCH):
        batch = todo[i : i + LABEL_BATCH]
        rows = _cached(f"labels-{batch[0]}-{len(batch)}", FALLBACK.format(items=" ".join(f"wd:{q}" for q in batch), langs=langs))
        for r in rows:
            q, label = r["item"]["value"].rsplit("/", 1)[1], r["l"]
            rank = order.get(label.get("xml:lang", ""), len(order))
            if q not in best or rank < best[q][0]:
                best[q] = (rank, label["value"])
    return {q: v for q, (_, v) in best.items()}


def museum_types() -> dict[str, str]:
    """類別 QID → 博物館的類型（MUSEUM_TYPES 的 key）"""
    roots = {q: t for t, qs in MUSEUM_TYPES.items() for q in qs}
    found: dict[str, set[str]] = {}
    query = CLASSES.format(roots=" ".join(f"wd:{q}" for q in roots))
    for r in _cached("_museum_types", query):
        found.setdefault(r["cls"]["value"].rsplit("/", 1)[1], set()).add(roots[r["root"]["value"].rsplit("/", 1)[1]])
    order = list(MUSEUM_TYPES)
    return {c: min(ts, key=order.index) for c, ts in found.items()}


def countries() -> list[tuple[str, str]]:
    rows = _cached("_countries", COUNTRIES)
    return sorted({(r["country"]["value"].rsplit("/", 1)[1], r["cc"]["value"]) for r in rows}, key=lambda x: x[1])


def fetch() -> dict[str, dict]:
    """QID → {roots: set, classes: set, coord: (lon, lat), sl, en, zhtw, zhhant, zh, closed}"""
    cls_roots = classes()
    others = sorted(c for c in cls_roots if c != "Q33506")
    rows: list[dict] = []
    for i in range(0, len(others), BATCH):
        batch = others[i : i + BATCH]
        rows += _cached(f"classes-{i // BATCH:03d}", BY_CLASS.format(classes=" ".join(f"wd:{c}" for c in batch)))
    print(f"    Wikidata 景點：子類別 {len(others)} 個查完，{len(rows):,} 列", flush=True)
    todo = countries()
    for n, (qid, cc) in enumerate(todo):
        rows += _cached(f"museum-{cc}", BY_COUNTRY.format(country=qid))
        if n % 40 == 0:
            print(f"    Wikidata 博物館：{n + 1} / {len(todo)} 國", flush=True)
    out: dict[str, dict] = {}
    for r in rows:
        q = r["item"]["value"].rsplit("/", 1)[1]
        cls = r["cls"]["value"].rsplit("/", 1)[1]
        d = out.setdefault(q, {"roots": set(), "classes": set(), "coord": None, "sl": 0, "closed": False})
        d["roots"] |= cls_roots.get(cls, set())
        d["classes"].add(cls)
        if not d["coord"]:
            v = r["coord"]["value"]
            if v.startswith("Point("):
                lon, lat = v[6:-1].split()
                d["coord"] = (float(lon), float(lat))
        d["sl"] = max(d["sl"], int(r["sl"]["value"]))
        for k in ("en", "zhtw", "zhhant", "zh"):
            if k in r and not d.get(k):
                d[k] = r[k]["value"]
        if "closed" in r:
            d["closed"] = True
    return out
