"""Wikidata（CC0）：有人口與座標的地點，用來替 GHSL 的城市找中文名稱（城市主題）。

一次查出所有人口（P1082）3 萬以上、有地球座標（P625）的項目（約 5.4 萬個，不限類別：城市、鄉鎮、行政區都有），
連同英文或多語（mul）名稱與英文別名；比對在 topics/cities.py。中文名稱另外用 wbgetentities 查（sources/nobel.py）。

- 很多項目的英文名稱 2025 年起改放在「mul」（多語預設名稱），例如坦帕（Q49255）沒有 en 只有 mul，所以兩個都查。
- 查詢服務的逾時是 60 秒，名稱這一段約 40 秒；用 TSV（比 JSON 小 8 倍），失敗時等一下再試。
- 回應存在 .cache/wikidata/，要更新加 --refresh。
"""
from __future__ import annotations

import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

import common
from common import CACHE_DIR, USER_AGENT

ENDPOINT = "https://query.wikidata.org/sparql"
MIN_POPULATION = 30000

LABELS_QUERY = """
SELECT ?item ?lat ?lon ?pop ?name WHERE {
  ?item wdt:P1082 ?pop . FILTER(?pop >= %d)
  ?item p:P625/psv:P625 [ wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon ; wikibase:geoGlobe wd:Q2 ] .
  ?item rdfs:label ?name . FILTER(LANG(?name) = "en" || LANG(?name) = "mul")
}
"""
ALIASES_QUERY = """
SELECT ?item ?name WHERE {
  ?item wdt:P1082 ?pop . FILTER(?pop >= %d)
  ?item skos:altLabel ?name . FILTER(LANG(?name) = "en" || LANG(?name) = "mul")
}
"""


@dataclass
class Place:
    qid: str
    lat: float
    lon: float
    population: float
    labels: set[str] = field(default_factory=set)
    aliases: set[str] = field(default_factory=set)


def _query(query: str, filename: str) -> Path:
    target = CACHE_DIR / "wikidata" / filename
    if target.exists() and not common.REFRESH:
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    url = f"{ENDPOINT}?{urllib.parse.urlencode({'query': query})}"
    for attempt in range(4):
        try:
            print(f"  查詢 Wikidata（{filename}）")
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/tab-separated-values"})
            with urllib.request.urlopen(request, timeout=180) as resp:
                data = resp.read()
            break
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt == 3:
                raise
            wait = 30 * (attempt + 1)
            print(f"  Wikidata 查詢失敗（{e}），{wait} 秒後再試")
            time.sleep(wait)
    tmp = target.with_suffix(".part")
    tmp.write_bytes(data)
    tmp.replace(target)
    return target


def _rows(path: Path) -> list[list[str]]:
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    return [line.split("\t") for line in lines[1:] if line]


def _qid(uri: str) -> str:
    return uri.strip("<>").rsplit("/", 1)[1]


def _text(literal: str) -> str:
    """TSV 的字串是 "名稱"@en，裡面的 \\" 與 \\t 是跳脫的"""
    value = literal.rsplit("@", 1)[0]
    if value.startswith('"') and value.endswith('"'):
        value = value[1:-1]
    return value.replace('\\"', '"').replace("\\t", "\t").replace("\\\\", "\\")


def places(min_population: int = MIN_POPULATION) -> list[Place]:
    """人口與座標有好幾個值時（不同年份、不同測量點），用人口最多的那一筆與它的座標。"""
    out: dict[str, Place] = {}
    for item, lat, lon, pop, name in _rows(_query(LABELS_QUERY % min_population, f"places-{min_population}.tsv")):
        qid = _qid(item)
        p = float(pop)
        place = out.get(qid)
        if place is None or p > place.population:
            labels = place.labels if place else set()
            place = out[qid] = Place(qid, float(lat), float(lon), p, labels)
        place.labels.add(_text(name))
    for item, name in _rows(_query(ALIASES_QUERY % min_population, f"places-{min_population}-aliases.tsv")):
        place = out.get(_qid(item))
        if place:
            place.aliases.add(_text(name))
    return list(out.values())
