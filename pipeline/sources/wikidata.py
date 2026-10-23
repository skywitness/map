"""Wikidata（CC0）：各國的最高點（P610）與最低點（P1589），含名稱、海拔、經緯度。

用來替 DEM 算出的最高、最低點加上名稱與官方海拔（例如玉山主峰 3,952 m）；
是否採用由 topics/elevation.py 拿 DEM 檢查，對不上就只用 DEM 的值、不寫名稱。
"""
from __future__ import annotations

import json
import re
import urllib.parse
from dataclasses import dataclass

from common import download

ENDPOINT = "https://query.wikidata.org/sparql"
METRE = "http://www.wikidata.org/entity/Q11573"
FOOT = "http://www.wikidata.org/entity/Q3710"

QUERY = """
SELECT ?iso ?kind ?pt ?elev ?unit ?rank ?coord ?lang ?label WHERE {
  ?c wdt:P298 ?iso .
  VALUES (?prop ?kind) { (wdt:P610 "high") (wdt:P1589 "low") }
  ?c ?prop ?pt .
  OPTIONAL { ?pt p:P2044 ?st . ?st wikibase:rank ?rank ; psv:P2044 [ wikibase:quantityAmount ?elev ; wikibase:quantityUnit ?unit ] }
  OPTIONAL { ?pt wdt:P625 ?coord }
  OPTIONAL {
    ?pt rdfs:label ?label . BIND(lang(?label) AS ?lang)
    FILTER(?lang IN ("zh-tw", "zh-hant", "zh-hk", "zh", "en", "mul"))
  }
}
"""

# 中文名稱的優先順序；zh 常常是簡體，放在繁體後面，用 S2T 轉成繁體
ZH_ORDER = ("zh-tw", "zh-hant", "zh-hk", "zh")
# 只有 zh（簡體）名稱的山、湖、河裡實際出現的簡體字（2026-10 抓的名稱）；Wikidata 的名稱有變時要補
S2T = str.maketrans(
    "亚伦内别区吕奥宁尔库杰渊湾盐纳罗苏莱萨诺谊贝赖达钦马鲁龙",
    "亞倫內別區呂奧寧爾庫傑淵灣鹽納羅蘇萊薩諾誼貝賴達欽馬魯龍",
)
EN_ORDER = ("en", "mul")
RANK_ORDER = {"PreferredRank": 0, "NormalRank": 1, "DeprecatedRank": 9}


@dataclass
class Point:
    qid: str
    zh: str | None
    en: str | None
    elevation: float | None
    lon: float | None
    lat: float | None


def extremes() -> dict[str, dict[str, list[Point]]]:
    """{ISO3: {"high": [Point…], "low": [Point…]}}。一個國家可能列了好幾個（例如兩座同高的山）。"""
    url = f"{ENDPOINT}?{urllib.parse.urlencode({'query': QUERY, 'format': 'json'})}"
    path = download(url, "wikidata", "country-extremes.json")
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)["results"]["bindings"]

    # 同一個點會因為多個海拔、多種語言的名稱而出現很多列，先依點彙整
    points: dict[tuple[str, str, str], dict] = {}
    for r in rows:
        key = (r["iso"]["value"], r["kind"]["value"], r["pt"]["value"].rsplit("/", 1)[-1])
        p = points.setdefault(key, {"labels": {}, "elevations": [], "coord": None})
        if "label" in r:
            p["labels"][r["lang"]["value"]] = r["label"]["value"]
        if "elev" in r and r["rank"]["value"].rsplit("#", 1)[-1] != "DeprecatedRank":
            value = float(r["elev"]["value"])
            unit = r["unit"]["value"]
            if unit == FOOT:
                value *= 0.3048
            if unit in (METRE, FOOT):
                p["elevations"].append((RANK_ORDER[r["rank"]["value"].rsplit("#", 1)[-1]], value))
        if "coord" in r and p["coord"] is None:
            m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r["coord"]["value"])
            if m:
                p["coord"] = (float(m.group(1)), float(m.group(2)))

    out: dict[str, dict[str, list[Point]]] = {}
    for (iso3, kind, qid), p in sorted(points.items()):
        labels = p["labels"]
        # 同一個點有多個海拔時：優先用標成「偏好」的；都一樣就取眾數（重複列出的值），再不然取中位數
        elevation = None
        if p["elevations"]:
            best = min(rank for rank, _ in p["elevations"])
            values = sorted({v for rank, v in p["elevations"] if rank == best})
            elevation = values[len(values) // 2]
        out.setdefault(iso3, {"high": [], "low": []})[kind].append(
            Point(
                qid=qid,
                zh=zh_name(labels),
                en=next((labels[k] for k in EN_ORDER if k in labels), None),
                elevation=elevation,
                lon=p["coord"][0] if p["coord"] else None,
                lat=p["coord"][1] if p["coord"] else None,
            )
        )
    return out


def zh_name(labels: dict[str, str]) -> str | None:
    for lang in ZH_ORDER:
        if lang in labels:
            return labels[lang].translate(S2T) if lang == "zh" else labels[lang]
    return None
