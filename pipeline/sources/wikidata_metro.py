"""Wikidata（CC0）：交通主題的地鐵站與各國的高鐵路線。

地鐵站（收錄規則見 topics/metro.py 的 STATION_RULE）：
- 候選 = P31 是地鐵站（Q928830）或它的子類別（倫敦地鐵站、柏林 U-Bahn 站…）的項目，
  加上所屬路網（P16）是地鐵（Q5503 或子類別）、P31 是一般車站類別（STATION_CLASSES）的項目。
- 先查地鐵站的子類別與地鐵路網（直接寫在車站的查詢裡會逾時），再分 5 種屬性、兩組車站（見 _station_set）各查一次：P31、座標與國家、日期（啟用 P1619、成立 P571、廢止 P576、停止營運 P3999、使用狀態 P5817）、
  路網與路線（P16、P81）、名稱（en、mul 與中文的各種變體）。地鐵路網、車站的路線（P81）各查一次（P31、日期、國家、所屬路網、使用狀態、名稱）。
高鐵：P31 是高速鐵路線（Q858485）或子類別的項目，查的屬性同路網。

- 查詢服務（WDQS）2026-10 在故障後限流（每個 IP 每分鐘 1 次，超過回 429），所以每次查詢前等到距離上一次 62 秒；
  失敗時 wikidata_profiles._sparql 會等一下再試。共 16 次，約 17 分鐘。
- User-Agent 寫專案網址（common.USER_AGENT），不帶個人資料；不用帳號、不用金鑰。
- 回應存在 .cache/wikidata/metro-*.json，要更新加 --refresh；資料日期用快取檔的修改時間。
- 中文名稱用 SPARQL 拿到的 zh-* 名稱，在本機用 OpenCC 轉成繁體（zh_name()）。
- 只取結構化的事實（日期、座標、名稱、所屬路網），不取維基百科條目的文字。
"""
from __future__ import annotations

import json
import time
from collections import defaultdict
from datetime import datetime, timezone

import common
from opencc import OpenCC
from common import CACHE_DIR
from sources.wikidata_profiles import _sparql

E = "http://www.wikidata.org/entity/"
_S2TW = OpenCC("s2tw")
METRO_STATION, RAPID_TRANSIT, HSR_LINE = "Q928830", "Q5503", "Q858485"
# 地鐵路網上、P31 只寫一般車站的（不含電車站、單軌站、路線、機廠）
STATION_CLASSES = {
    "Q55488": "railway station", "Q22808403": "underground station", "Q11670533": "elevated station",
    "Q22808404": "station located on surface", "Q55491": "underground railway station",
    "Q1147171": "interchange station", "Q20202072": "terminus", "Q124416148": "underground metro station",
    "Q4312270": "railway station above ground", "Q98280550": "station located in a cut",
}
LANGS = ("en", "mul", "zh-tw", "zh-hant", "zh-hk", "zh", "zh-hans", "zh-cn")

_lang_filter = ", ".join(f'"{l}"' for l in LANGS)

# 先查地鐵站的子類別與地鐵路網，車站的查詢用 VALUES 列出（直接寫 P31/P279* 與路網的 P279* 會逾時）
PRE_QUERIES = {
    "subclasses": f"SELECT ?o WHERE {{ ?o wdt:P279* wd:{METRO_STATION} . }}",
    "networks": f"SELECT DISTINCT ?o WHERE {{ ?o wdt:P31/wdt:P279* wd:{RAPID_TRANSIT} . }}",
    "hsr-classes": f"SELECT ?o WHERE {{ ?o wdt:P279* wd:{HSR_LINE} . }}",
}
# 路網、路線、高鐵路線要查的屬性
SYSTEM_PART = f"""{{ ?s wdt:P31 ?o . BIND("P31" AS ?p) }} UNION {{ ?s wdt:P1619 ?o . BIND("P1619" AS ?p) }}
  UNION {{ ?s wdt:P571 ?o . BIND("P571" AS ?p) }} UNION {{ ?s wdt:P17/wdt:P298 ?o . BIND("P17" AS ?p) }}
  UNION {{ ?s wdt:P16 ?o . BIND("P16" AS ?p) }} UNION {{ ?s wdt:P361 ?o . BIND("P361" AS ?p) }}
  UNION {{ ?s wdt:P5817 ?o . BIND("P5817" AS ?p) }} UNION {{ ?s wdt:P576 ?o . BIND("P576" AS ?p) }}
  UNION {{ ?s rdfs:label ?o . FILTER(LANG(?o) IN ({_lang_filter})) BIND("label" AS ?p) }}"""


def _station_set(branch: str) -> str:
    """車站：a 是 P31 為地鐵站（或子類別）的，b 是路網為地鐵、P31 為一般車站類別的（兩組有重疊，合併時去掉重複）。
    兩組寫成 UNION 放在同一個子查詢裡會逾時，所以每一種屬性分兩次查"""
    if branch == "a":
        subs = " ".join(f"wd:{q}" for q in _list("subclasses"))
        return f"VALUES ?k {{ {subs} }} ?s wdt:P31 ?k ."
    nets = " ".join(f"wd:{q}" for q in _list("networks"))
    plain = " ".join(f"wd:{q}" for q in STATION_CLASSES)
    return f"VALUES ?net {{ {nets} }} ?s wdt:P16 ?net . VALUES ?k {{ {plain} }} ?s wdt:P31 ?k ."


STATION_PARTS = {
    "classes": '?s wdt:P31 ?o . BIND("P31" AS ?p)',
    "geo": '{ ?s wdt:P625 ?o . BIND("P625" AS ?p) } UNION { ?s wdt:P17/wdt:P298 ?o . BIND("P17" AS ?p) }',
    "dates": '{ ?s wdt:P1619 ?o . BIND("P1619" AS ?p) } UNION { ?s wdt:P571 ?o . BIND("P571" AS ?p) } '
             'UNION { ?s wdt:P576 ?o . BIND("P576" AS ?p) } UNION { ?s wdt:P3999 ?o . BIND("P3999" AS ?p) } '
             'UNION { ?s wdt:P5817 ?o . BIND("P5817" AS ?p) }',
    "links": '{ ?s wdt:P16 ?o . BIND("P16" AS ?p) } UNION { ?s wdt:P81 ?o . BIND("P81" AS ?p) }',
    "labels": f'?s rdfs:label ?o . FILTER(LANG(?o) IN ({_lang_filter})) BIND("label" AS ?p)',
}


def _queries() -> dict[str, str]:
    out = {
        f"{name}-{branch}": f"SELECT DISTINCT ?s ?p ?o WHERE {{ {_station_set(branch)} {part} }}"
        for name, part in STATION_PARTS.items() for branch in "ab"
    }
    nets = " ".join(f"wd:{q}" for q in _list("networks"))
    hsr = " ".join(f"wd:{q}" for q in _list("hsr-classes"))
    return {
        **out,
        "systems": f"SELECT DISTINCT ?s ?p ?o WHERE {{ VALUES ?s {{ {nets} }} {SYSTEM_PART} }}",
        "hsr": f"SELECT DISTINCT ?s ?p ?o WHERE {{ VALUES ?k {{ {hsr} }} ?s wdt:P31 ?k . {SYSTEM_PART} }}",
    }


def _lines_query() -> str:
    """車站的路線（P81）：屬於哪一個路網（P16、P361）。路線的清單從車站來，所以另外寫"""
    lines = sorted({l for p in stations().values() for l in p.get("P81", []) if l.startswith("Q")}, key=lambda q: int(q[1:]))
    return f"SELECT DISTINCT ?s ?p ?o WHERE {{ VALUES ?s {{ {' '.join(f'wd:{q}' for q in lines)} }} {SYSTEM_PART} }}"


_last_query = 0.0


def _query(name: str) -> list[dict]:
    """查詢（有快取就用快取）；限流：距離上一次實際查詢至少 62 秒"""
    global _last_query
    query = PRE_QUERIES.get(name) or (_lines_query() if name == "lines" else _queries()[name])
    filename = f"metro-{name}.json"
    if not (CACHE_DIR / "wikidata" / filename).exists() or common.REFRESH:
        wait = _last_query + 62 - time.time()
        if wait > 0:
            time.sleep(wait)
        _last_query = time.time()
    path = _sparql(query, filename)
    with open(path, encoding="utf-8") as f:
        return json.load(f)["results"]["bindings"]


def _list(name: str) -> list[str]:
    return sorted({_id(r["o"]) for r in _query(name) if r["o"]["value"].startswith(E)}, key=lambda q: int(q[1:]))


def _id(binding: dict) -> str:
    v = binding["value"]
    return v[len(E):] if v.startswith(E) else v


def _triples(name: str) -> dict[str, dict[str, list]]:
    """{QID: {屬性: [值…]}}；名稱是 {'label': [(語言, 文字)…]}"""
    out: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for r in _query(name):
        s = _id(r["s"])
        p = r["p"]["value"] if "p" in r else "P31"
        o = r["o"]
        if o["value"].startswith("http://www.wikidata.org/.well-known/genid/"):
            continue  # 「未知的值」
        if o.get("xml:lang"):
            out[s][p].append((o["xml:lang"], o["value"]))
        else:
            out[s][p].append(_id(o))
    return out


def stations() -> dict[str, dict[str, list]]:
    """{QID: {'P31', 'P625', 'P17', 'P1619', 'P571', 'P576', 'P3999', 'P5817', 'P16', 'P81', 'label': [...]}}"""
    merged: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for name in STATION_PARTS:
        for branch in "ab":
            for qid, props in _triples(f"{name}-{branch}").items():
                for p, values in props.items():
                    merged[qid][p] = sorted(set(merged[qid][p]) | set(values))
    return merged


def systems() -> dict[str, dict[str, list]]:
    """地鐵路網：{QID: {'P31', 'P1619', 'P571', 'P17', 'P16', 'P361', 'P5817', 'P576', 'label'}}"""
    return _triples("systems")


def lines() -> dict[str, dict[str, list]]:
    """車站的路線（同上的屬性）"""
    return _triples("lines")


def hsr_lines() -> dict[str, dict[str, list]]:
    return _triples("hsr")


def fetched_date() -> str:
    path = CACHE_DIR / "wikidata" / "metro-classes-a.json"
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).strftime("%Y-%m-%d")



def zh_name(p: dict) -> str | None:
    """繁體中文名稱：依序用 zh-tw、zh-hant、zh-hk，都沒有時用 zh、zh-hans、zh-cn，一律經過 OpenCC 的 s2tw（只換字、不換用語）。
    SPARQL 拿到的 zh-tw 名稱常常是直接複製的簡體（例如韓國的「千户站」），所以台灣、香港的名稱也轉一次（繁體轉了不會變）。
    其他主題用 wbgetentities 的 languagefallback（伺服器端轉換），但 2026-10 Wikidata 的 API 也在限流，
    1 萬多個車站要查一個多小時，所以改在本機轉換。"""
    labels = dict(l for l in p.get("label", []))
    for lang in ("zh-tw", "zh-hant", "zh-hk", "zh", "zh-hans", "zh-cn"):
        if labels.get(lang):
            return _S2TW.convert(labels[lang])
    return None