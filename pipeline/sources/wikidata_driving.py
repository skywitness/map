"""Wikidata（CC0）：各國的行車方向（P1622 driving side：Q14565199 靠右、Q11920728 靠左），含改過方向的年份（P582 結束時間）。"""
from __future__ import annotations

import json
import urllib.parse
from dataclasses import dataclass, field

from common import download

ENDPOINT = "https://query.wikidata.org/sparql"
RIGHT = "http://www.wikidata.org/entity/Q14565199"
LEFT = "http://www.wikidata.org/entity/Q11920728"

QUERY = """
SELECT ?iso ?side ?rank ?end WHERE {
  ?c wdt:P298 ?iso .
  ?c p:P1622 ?st .
  ?st ps:P1622 ?side ; wikibase:rank ?rank .
  OPTIONAL { ?st pq:P582 ?end }
}
"""


@dataclass
class Driving:
    side: str  # "L" 或 "R"
    history: list[tuple[str, int]] = field(default_factory=list)  # [(以前的方向, 改的那一年)]


def driving_sides() -> dict[str, Driving]:
    url = f"{ENDPOINT}?{urllib.parse.urlencode({'query': QUERY, 'format': 'json'})}"
    path = download(url, "wikidata", "driving-side.json")
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)["results"]["bindings"]
    by: dict[str, list[tuple[str, str, int | None]]] = {}
    for r in rows:
        side = {RIGHT: "R", LEFT: "L"}.get(r["side"]["value"])
        if not side:
            continue
        rank = r["rank"]["value"].rsplit("#", 1)[1]
        end = int(r["end"]["value"][:4]) if "end" in r else None
        by.setdefault(r["iso"]["value"], []).append((side, rank, end))
    out: dict[str, Driving] = {}
    for iso3, sts in by.items():
        current = [s for s in sts if s[2] is None and s[1] != "DeprecatedRank"]
        current.sort(key=lambda s: s[1] != "PreferredRank")
        if not current:
            continue
        sides = {s[0] for s in current}
        if len(sides) > 1 and current[0][1] != "PreferredRank":
            raise RuntimeError(f"Wikidata 的 {iso3} 行車方向有兩個、沒有優先的：{sts}")
        history = sorted((s[0], s[2]) for s in sts if s[2] is not None and s[0] != current[0][0])
        out[iso3] = Driving(current[0][0], [(h[0], h[1]) for h in sorted(history, key=lambda h: h[1])])
    return out
