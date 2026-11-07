"""Wikidata 經 QLever（https://qlever.dev/api/wikidata）的 SPARQL（2026-11-07 起，取代 query.wikidata.org：它的 robots.txt
禁止 /sparql）。查詢照 Wikidata Query Service 的寫法（wd:、wdt:、wikibase:、rdfs:…），這裡補上 PREFIX；
429 照 Retry-After 等，沒寫的等 60、120… 秒，最多試 6 次。快取由呼叫的人管（回傳 bindings，跟舊的 _sparql 一樣）。
"""
from __future__ import annotations

import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request

from common import CACHE_DIR, USER_AGENT

ENDPOINT = "https://qlever.dev/api/wikidata"
PREFIXES = """PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX schema: <http://schema.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
"""
FALLBACK_LANGS = ["mul", "en-gb", "en-us", "en-ca", "de", "fr", "it", "es", "pt", "nl", "sv", "pl", "cs", "da", "nb", "nn",
                  "fi", "hu", "ro", "ca", "eu", "gl", "sk", "sl", "hr", "sr", "bs", "et", "lv", "lt", "is", "ga", "cy",
                  "id", "ms", "vi", "tr", "ru", "uk", "be", "bg", "mk", "el", "he", "ar", "fa", "hi", "th", "ka", "hy",
                  "ko", "ja"]


def bindings(query: str) -> list[dict]:
    body = query if query.lstrip().upper().startswith("PREFIX") else PREFIXES + query
    req = urllib.request.Request(ENDPOINT, data=urllib.parse.urlencode({"query": body}).encode(),
                                 headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                return json.load(r)["results"]["bindings"]
        except urllib.error.HTTPError as err:
            if err.code not in (429, 500, 502, 503, 504) or attempt == 5:
                raise
            wait = int(err.headers.get("Retry-After") or 60 * (attempt + 1))
        except (urllib.error.URLError, ConnectionError, TimeoutError):
            if attempt == 5:
                raise
            wait = 60 * (attempt + 1)
        print(f"    QLever（Wikidata）：等 {wait} 秒", flush=True)
        time.sleep(wait)
    raise RuntimeError("QLever 一直失敗，稍後再跑")


def cached(name: str, query: str) -> list[dict]:
    path = CACHE_DIR / "wikidata" / f"{name}.json"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(bindings(query)), encoding="utf-8")
    return json.loads(path.read_text(encoding="utf-8"))


def fallback_names(qids: list[str], prefix: str) -> dict[str, str]:
    """QID → 沒有英文標籤時用的名稱（FALLBACK_LANGS 裡第一個有的語言）；快取依 QID 清單的雜湊"""
    if not qids:
        return {}
    order = {lang: i for i, lang in enumerate(FALLBACK_LANGS)}
    key = hashlib.sha1(" ".join(sorted(qids)).encode()).hexdigest()[:10]
    rows = cached(f"{prefix}-labels-{key}", "SELECT ?item ?l WHERE { VALUES ?item { %s } ?item rdfs:label ?l }"
                  % " ".join(f"wd:{q}" for q in sorted(qids)))
    best: dict[str, tuple[int, str]] = {}
    for r in rows:
        q, label = r["item"]["value"].rsplit("/", 1)[1], r["l"]
        rank = order.get(label.get("xml:lang", ""), len(order) + 1)
        if q not in best or rank < best[q][0]:
            best[q] = (rank, label["value"])
    return {q: v for q, (_, v) in best.items()}
