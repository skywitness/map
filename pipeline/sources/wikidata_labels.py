"""Wikidata（CC0）的名稱：一批 QID → 繁體中文、英文名稱（製作手冊第十六批 265 的行政區名稱）。

WDQS（query.wikidata.org）用 POST，一次 300 個 QID（VALUES），每批的回應依內容雜湊快取在 .cache/wikidata-labels/，
重跑不再查。中文名稱的優先順序跟 sources/wikidata.py 一樣：zh-tw、zh-hant、zh-hk，最後才用 zh（常是簡體，
只記下來、由呼叫的地方決定要不要用）。
"""
from __future__ import annotations

import hashlib
import http.client
import json
import time
import urllib.error
import urllib.parse
import urllib.request

from common import CACHE_DIR, USER_AGENT

ENDPOINT = "https://query.wikidata.org/sparql"
BATCH = 300
LANGS = ("zh-tw", "zh-hant", "zh-hk", "zh", "en", "mul")
QUERY = """
SELECT ?item ?label (lang(?label) AS ?lang) WHERE {
  VALUES ?item { %s }
  ?item rdfs:label ?label .
  FILTER(lang(?label) IN (%s))
}
"""


def _post(query: str) -> dict:
    data = urllib.parse.urlencode({"query": query, "format": "json"}).encode()
    request = urllib.request.Request(
        ENDPOINT, data=data, headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"}
    )
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            # 429（太頻繁）、502–504：等一下再試，照 Retry-After
            if e.code not in (429, 500, 502, 503, 504) or attempt == 4:
                raise
            wait = int(e.headers.get("Retry-After") or 30 * (attempt + 1))
            print(f"  WDQS 回 {e.code}，{wait} 秒後再試")
            time.sleep(wait)
        except (json.JSONDecodeError, ConnectionError, TimeoutError, http.client.HTTPException, urllib.error.URLError) as e:
            # 回應傳到一半斷掉（2026-11-01 查 5 萬多筆時遇過）：等一下再試
            if attempt == 4:
                raise
            print(f"  WDQS 的回應不完整（{type(e).__name__}），30 秒後再試")
            time.sleep(30)
    raise RuntimeError("unreachable")


def labels(qids: list[str]) -> dict[str, dict[str, str]]:
    """{qid: {語言: 名稱}}，語言只有 LANGS 裡的"""
    out: dict[str, dict[str, str]] = {}
    unique = sorted({q for q in qids if q and q.startswith("Q")})
    cache = CACHE_DIR / "wikidata-labels"
    cache.mkdir(parents=True, exist_ok=True)
    for i in range(0, len(unique), BATCH):
        batch = unique[i : i + BATCH]
        query = QUERY % (" ".join(f"wd:{q}" for q in batch), ", ".join(f'"{lang}"' for lang in LANGS))
        path = cache / f"{hashlib.sha256(query.encode()).hexdigest()[:16]}.json"
        if path.exists():
            result = json.loads(path.read_text(encoding="utf-8"))
        else:
            result = _post(query)
            path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
            time.sleep(2)
        for row in result["results"]["bindings"]:
            qid = row["item"]["value"].rsplit("/", 1)[-1]
            out.setdefault(qid, {})[row["lang"]["value"]] = row["label"]["value"]
    return out
